import { spawn, spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { argv, platform } from 'node:process';

const KB = 1024;
const MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONFIG = {
  // Total time we keep sampling after the app reaches its "ready" state (ms).
  sampleWindowMs: 5000,
  // Gap between consecutive resource samples (ms).
  sampleIntervalMs: 150,
  // Gap between settle-check samples during startup (ms).
  settleIntervalMs: 50,
  // The process is "ready" once %CPU stays at or below this for `n` straight
  // samples. Detects the end of the launch burst (JIT, first paint, preloads).
  readyCpuThreshold: 5,
  readyStableSamples: 4,
  // Hard cap on how long we wait for startup (ms).
  startupTimeoutMs: 15000,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function findBinary(explicit) {
  if (explicit) {
    if (!statSync(explicit).isFile()) throw new Error(`Not a file: ${explicit}`);
    return explicit;
  }
  for (const c of ['src-tauri/target/release/cmx', 'target/release/cmx']) {
    try {
      if (statSync(c).isFile()) return c;
    } catch { /* keep looking */ }
  }
  throw new Error(
    'Binary not found. Build with `pnpm tauri build`, or pass ' +
    '`--bin /path/to/cmx`.'
  );
}

function totalPhysicalBytes() {
  const out = spawnSync('sysctl', ['-n', 'hw.memsize'], { encoding: 'utf8' });
  const n = Number(out.stdout?.trim());
  return Number.isFinite(n) && n > 0 ? n : 8 * 1024 * 1024 * 1024;
}

// ---------------------------------------------------------------------------
// Process launcher
// ---------------------------------------------------------------------------

function launch(bin) {
  // Tauri apps on macOS often re-exec under the .app bundle; keep the direct
  // binary so we can observe the process we started. We locate the *main*
  // process (highest CPU) if the binary spawns helper/webview processes.
  const child = spawn(bin, [], {
    stdio: 'ignore',
    detached: true,
  });
  return child;
}

// Sample one process by pid, returning { cpu, rssBytes } or null if gone.
function sample(pid) {
  const out = spawnSync('ps', ['-o', 'pid=,%cpu=,rss=', '-p', String(pid)], {
    encoding: 'utf8',
  });
  const line = out.stdout?.trim();
  if (!line) return null;
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const cpu = Number(parts[1]);
  const rssKb = Number(parts[2]);
  if (!Number.isFinite(cpu) || !Number.isFinite(rssKb)) return null;
  return { cpu, rssBytes: Math.round(rssKb * KB) };
}

function isAlive(pid) {
  const out = spawnSync('kill', ['-0', String(pid)], { encoding: 'utf8' });
  return out.status === 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Startup measurement
// ---------------------------------------------------------------------------

async function measureStartup(pid) {
  const t0 = process.hrtime.bigint();
  let stable = 0;
  let lastCpu = Infinity;

  while (true) {
    const elapsed = Number(process.hrtime.bigint() - t0) / 1e6;
    if (elapsed > CONFIG.startupTimeoutMs) {
      return { ready: false, startupMs: elapsed, reason: 'timeout' };
    }
    if (!isAlive(pid)) {
      return { ready: false, startupMs: elapsed, reason: 'process-exited' };
    }
    const s = sample(pid);
    if (s && s.cpu <= CONFIG.readyCpuThreshold) {
      if (lastCpu <= CONFIG.readyCpuThreshold) stable += 1;
      else stable = 1;
      lastCpu = s.cpu;
      if (stable >= CONFIG.readyStableSamples) {
        return { ready: true, startupMs: elapsed, readyCpu: s.cpu };
      }
    } else {
      stable = 0;
      lastCpu = s?.cpu ?? Infinity;
    }
    await sleep(CONFIG.settleIntervalMs);
  }
}

// ---------------------------------------------------------------------------
// Profiling
// ---------------------------------------------------------------------------

async function profile(pid, windowMs, intervalMs) {
  const samples = [];
  const end = Date.now() + windowMs;
  while (Date.now() < end) {
    if (!isAlive(pid)) break;
    const s = sample(pid);
    if (s) samples.push(s);
    await sleep(intervalMs);
  }
  return samples;
}

function stat(samples, physicalBytes) {
  if (samples.length === 0) return null;
  const cpus = samples.map((s) => s.cpu);
  const rss = samples.map((s) => s.rssBytes);

  const avgCpu = cpus.reduce((a, b) => a + b, 0) / cpus.length;
  const peakCpu = Math.max(...cpus);

  const avgRss = rss.reduce((a, b) => a + b, 0) / rss.length;
  const peakRss = Math.max(...rss);

  const ramPct = (peakRss / Number(physicalBytes)) * 100;

  return {
    samples: samples.length,
    cpu: { avg: avgCpu, peak: peakCpu },
    mem: { avgBytes: avgRss, peakBytes: peakRss, ramPercent: ramPct },
  };
}

// ---------------------------------------------------------------------------
// Single run
// ---------------------------------------------------------------------------

async function runOnce(bin) {
  const child = launch(bin);
  const pid = child.pid;

  const startup = await measureStartup(pid);
  if (!startup.ready) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    return { ready: false, reason: startup.reason };
  }

  const samples = await profile(pid, CONFIG.sampleWindowMs, CONFIG.sampleIntervalMs);
  const s = stat(samples, totalPhysicalBytes());
  if (!s) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    return { ready: false, reason: 'no-samples' };
  }

  try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }

  return {
    ready: true,
    startupMs: startup.startupMs,
    cpuAvg: s.cpu.avg,
    cpuPeak: s.cpu.peak,
    rssPeakMb: s.mem.peakBytes / MB,
    rssAvgMb: s.mem.avgBytes / MB,
    ramPercent: s.mem.ramPercent,
    samples: s.samples,
  };
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function summarize(field, runs) {
  const vals = runs.map((r) => r[field]);
  return { median: median(vals), mean: mean(vals), min: Math.min(...vals), max: Math.max(...vals) };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = argv.slice(2);

  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const bin = findBinary(flag('--bin'));
  const runs = Math.max(1, Number(flag('--runs')) || 1);
  const windowMs = Number(flag('--window')) || CONFIG.sampleWindowMs;
  CONFIG.sampleWindowMs = windowMs;

  if (platform !== 'darwin') {
    console.warn('Note: %CPU figures assume macOS `ps` semantics.');
  }

  const mem = totalPhysicalBytes();
  console.log(`cmx — performance benchmark (${runs} run${runs > 1 ? 's' : ''})`);
  console.log(`binary         : ${bin}`);
  console.log(`physical RAM   : ${(mem / MB).toFixed(0)} MB`);
  console.log('');

  const results = [];
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  run ${i + 1}/${runs} ... `);
    const r = await runOnce(bin);
    if (!r.ready) {
      console.log(`FAILED (${r.reason})`);
      results.push({ ready: false });
      continue;
    }
    console.log(`startup ${r.startupMs.toFixed(0)}ms | cpu ${r.cpuAvg.toFixed(1)}% | rss ${r.rssPeakMb.toFixed(1)}MB`);
    results.push(r);
  }

  const ok = results.filter((r) => r.ready);
  if (ok.length === 0) {
    console.error('\nERROR: every run failed. Is the app buildable/runnable?');
    process.exit(1);
  }

  const s = (name, unit) => {
    const v = summarize(name, ok);
    return `${v.median.toFixed(1)}${unit}`;
  };

  console.log('');
  console.log('Summary (per run)');
  console.log('------------------');
  console.log(`  startup (ms)      median ${s('startupMs', '')}  range ${Math.min(...ok.map((r) => r.startupMs)).toFixed(0)}–${Math.max(...ok.map((r) => r.startupMs)).toFixed(0)}`);
  console.log(`  cpu avg (%)       median ${s('cpuAvg', '')}`);
  console.log(`  cpu peak (%)      median ${s('cpuPeak', '')}`);
  console.log(`  rss avg (MB)      median ${s('rssAvgMb', '')}`);
  console.log(`  rss peak (MB)     median ${s('rssPeakMb', '')}`);
  console.log(`  peak vs RAM (%)   median ${s('ramPercent', '')}`);
  console.log(`  valid runs        ${ok.length}/${runs}`);

  // Machine-readable output for CI / charts.
  console.log('');
  console.log('__CMX_BENCH__' + JSON.stringify({
    bin,
    runs: ok.length,
    physical_ram_mb: mem / MB,
    startup_ms: summarize('startupMs', ok),
    cpu_avg: summarize('cpuAvg', ok),
    cpu_peak: summarize('cpuPeak', ok),
    rss_avg_mb: summarize('rssAvgMb', ok),
    rss_peak_mb: summarize('rssPeakMb', ok),
    ram_percent: summarize('ramPercent', ok),
  }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
