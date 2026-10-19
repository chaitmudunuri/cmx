use ignore::WalkBuilder;
use regex::RegexBuilder;
use serde::Serialize;
use std::collections::VecDeque;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct GrepMatch {
    pub path: String,
    pub rel_path: String,
    pub line_number: usize,
    pub line_text: String,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileSearchResult {
    pub path: String,
    pub rel_path: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct PreviewResult {
    pub lines: Vec<String>,
    pub start_line: usize,
    pub highlight_line: Option<usize>,
    pub total_lines: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitFileEntry {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Serialize)]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub files: Vec<GitFileEntry>,
}

/// Maximum file size allowed to be loaded into webview editor: 100 MB
const MAX_FILE_SIZE_BYTES: u64 = 100 * 1024 * 1024;

/// Cooperative search cancellation: every find_files / live_grep call bumps
/// its own generation counter; long walks check it and bail early so fast
/// typing doesn't queue overlapping full-tree scans. Frontend request ids
/// (QuickOpen / SidebarSearch) drop any stale results that still land.
static FIND_GEN: AtomicU64 = AtomicU64::new(0);
static GREP_GEN: AtomicU64 = AtomicU64::new(0);

fn find_alive(gen: u64) -> bool {
    FIND_GEN.load(Ordering::SeqCst) == gen
}

fn grep_alive(gen: u64) -> bool {
    GREP_GEN.load(Ordering::SeqCst) == gen
}

/// File names never worth grepping (generated / vendored / locks).
fn is_grep_skipped(file_name: &str) -> bool {
    const EXACT: &[&str] = &[
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "Cargo.lock",
        "poetry.lock",
        "Pipfile.lock",
    ];
    if EXACT.iter().any(|n| file_name.eq_ignore_ascii_case(n)) {
        return true;
    }
    const SUFFIXES: &[&str] = &[
        ".min.js",
        ".min.css",
        ".bundle.js",
        ".bundle.css",
        ".map",
        ".lock",
    ];
    let lower = file_name.to_ascii_lowercase();
    SUFFIXES.iter().any(|s| lower.ends_with(s))
}

/// Cheap binary sniff: NUL byte in the first 8KB means "not text".
fn looks_binary(path: &Path) -> bool {
    let Ok(mut f) = File::open(path) else {
        return true;
    };
    let mut buf = [0u8; 8192];
    let Ok(n) = f.read(&mut buf) else {
        return true;
    };
    buf[..n].contains(&0)
}

/// Read a file's contents as a UTF-8 string
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to read metadata for {}: {}", path, e))?;

        if metadata.len() > MAX_FILE_SIZE_BYTES {
            return Err(format!(
                "File is too large ({:.1} MB) to open in editor safely. Maximum size is 100 MB.",
                metadata.len() as f64 / (1024.0 * 1024.0)
            ));
        }

        let bytes = fs::read(&path)
            .map_err(|e| format!("Failed to read {}: {}", path, e))?;

        match String::from_utf8(bytes) {
            Ok(s) => Ok(s),
            Err(err) => {
                // Graceful fallback for files containing mixed encodings or special characters
                Ok(String::from_utf8_lossy(&err.into_bytes()).into_owned())
            }
        }
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        out.push(TABLE[(b0 >> 2) as usize] as char);
        out.push(TABLE[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[(((b1 & 15) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(b2 & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Read an image file and return a data: URL with base64 content
#[tauri::command]
pub async fn read_image_data(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "bmp" => "image/bmp",
            "avif" => "image/avif",
            _ => "application/octet-stream",
        };
        let bytes = fs::read(&path).map_err(|e| format!("Failed to read image {}: {}", path, e))?;
        let encoded = base64_encode(&bytes);
        Ok(format!("data:{};base64,{}", mime, encoded))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

/// Write content to a file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if let Some(parent) = p.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

/// Create a new empty file
#[tauri::command]
pub async fn create_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dirs: {}", e))?;
    }
    if !p.exists() {
        fs::write(p, "").map_err(|e| format!("Failed to create file: {}", e))?;
    }
    Ok(())
}

/// Create a new directory
#[tauri::command]
pub async fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))
}

/// Rename or move a file or folder
#[tauri::command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file or directory
#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete folder: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

/// Reveal in OS file manager (Finder / Explorer / File Manager)
#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| format!("Failed to reveal in Explorer: {}", e))?;
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let p = Path::new(&path);
        let dir = if p.is_dir() { p } else { p.parent().unwrap_or(p) };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

/// Query git status and current branch for a workspace folder
#[tauri::command]
pub async fn get_git_status(root_path: String) -> Result<GitStatusResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = Path::new(&root_path);
        if !root.exists() {
            return Ok(GitStatusResult {
                is_repo: false,
                branch: None,
                files: vec![],
            });
        }

        // Check if root is inside a git work tree
        let inside_output = std::process::Command::new("git")
            .arg("-C")
            .arg(&root_path)
            .arg("rev-parse")
            .arg("--is-inside-work-tree")
            .output();

        let is_inside = match inside_output {
            Ok(out) if out.status.success() => {
                String::from_utf8_lossy(&out.stdout).trim() == "true"
            }
            _ => false,
        };

        if !is_inside {
            return Ok(GitStatusResult {
                is_repo: false,
                branch: None,
                files: vec![],
            });
        }

        // Query branch
        let branch = std::process::Command::new("git")
            .arg("-C")
            .arg(&root_path)
            .arg("branch")
            .arg("--show-current")
            .output()
            .ok()
            .and_then(|out| {
                if out.status.success() {
                    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !s.is_empty() {
                        return Some(s);
                    }
                }
                None
            })
            .or_else(|| {
                std::process::Command::new("git")
                    .arg("-C")
                    .arg(&root_path)
                    .arg("rev-parse")
                    .arg("--abbrev-ref")
                    .arg("HEAD")
                    .output()
                    .ok()
                    .and_then(|out| {
                        if out.status.success() {
                            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                            if !s.is_empty() && s != "HEAD" {
                                return Some(s);
                            }
                        }
                        None
                    })
            });

        // Query status via porcelain
        let status_output = std::process::Command::new("git")
            .arg("-C")
            .arg(&root_path)
            .arg("status")
            .arg("--porcelain=v1")
            .arg("-uall")
            .output();

        let mut files = Vec::new();
        if let Ok(out) = status_output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    if line.len() < 4 {
                        continue;
                    }
                    let staged_char = line.chars().next().unwrap_or(' ');
                    let unstaged_char = line.chars().nth(1).unwrap_or(' ');
                    let mut path_part = line[3..].trim();

                    // Handle renames: "R  old -> new"
                    if let Some(pos) = path_part.find(" -> ") {
                        path_part = &path_part[pos + 4..];
                    }
                    let clean_path = path_part.trim_matches('"').replace('\\', "/");

                    let (status, staged) = if staged_char == '?' && unstaged_char == '?' {
                        ("U".to_string(), false)
                    } else if unstaged_char == 'M' {
                        ("M".to_string(), staged_char != ' ' && staged_char != '?')
                    } else if staged_char == 'M' {
                        ("M".to_string(), true)
                    } else if staged_char == 'A' || unstaged_char == 'A' {
                        ("A".to_string(), staged_char == 'A')
                    } else if staged_char == 'D' || unstaged_char == 'D' {
                        ("D".to_string(), staged_char == 'D')
                    } else if staged_char == 'R' || unstaged_char == 'R' {
                        ("R".to_string(), staged_char == 'R')
                    } else if staged_char == 'U' || unstaged_char == 'U' {
                        ("C".to_string(), false)
                    } else {
                        ("M".to_string(), staged_char != ' ')
                    };

                    files.push(GitFileEntry {
                        path: clean_path,
                        status,
                        staged,
                    });
                }
            }
        }

        Ok(GitStatusResult {
            is_repo: true,
            branch,
            files,
        })
    })
    .await
    .map_err(|e| format!("Git status task error: {}", e))?
}

/// List the entries in a directory, returning them sorted (directories first, then alphabetical)
#[tauri::command]
pub async fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("{} is not a directory", path));
    }

    let mut entries = Vec::new();
    let read_dir =
        fs::read_dir(dir_path).map_err(|e| format!("Failed to read dir {}: {}", path, e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if metadata.is_dir()
            && matches!(
                name.as_str(),
                "node_modules"
                    | "target"
                    | ".git"
                    | "dist"
                    | "build"
                    | "__pycache__"
                    | ".next"
                    | ".nuxt"
            )
        {
            continue;
        }

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
        });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

/// Telescope-style file finder (find files by name / path respecting .gitignore).
/// Ranked (filename hit > path hit, earlier + shorter wins), capped, and
/// cooperatively cancellable: a newer call aborts an in-flight walk.
#[tauri::command]
pub async fn find_files(
    root: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<FileSearchResult>, String> {
    let my_gen = FIND_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let max_results = limit.unwrap_or(100);
    let root_path = Path::new(&root);
    if !root_path.exists() {
        return Ok(Vec::new());
    }

    let query_lower = query.to_lowercase();
    let query_terms: Vec<&str> = query_lower.split_whitespace().collect();

    // Empty query: first N files in walk order (cheap, bounded).
    if query_terms.is_empty() {
        let mut results = Vec::new();
        let walker = WalkBuilder::new(root_path)
            .hidden(true)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build();
        for result in walker {
            if !find_alive(my_gen) {
                break;
            }
            if let Ok(entry) = result {
                if entry.file_type().map_or(false, |ft| ft.is_file()) {
                    results.push(FileSearchResult {
                        path: entry.path().to_string_lossy().to_string(),
                        rel_path: entry
                            .path()
                            .strip_prefix(root_path)
                            .unwrap_or(entry.path())
                            .to_string_lossy()
                            .to_string(),
                        name: entry.file_name().to_string_lossy().to_string(),
                    });
                    if results.len() >= max_results {
                        break;
                    }
                }
            }
        }
        return Ok(results);
    }

    // Scored collection (capped well above `limit`), then rank + truncate.
    // Full walk is bounded by cancellation: typing another key aborts this one.
    const COLLECT_CAP: usize = 2000;
    let mut scored: Vec<(i64, FileSearchResult)> = Vec::new();
    let walker = WalkBuilder::new(root_path)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .build();

    for result in walker {
        if !find_alive(my_gen) {
            break;
        }
        let Ok(entry) = result else { continue };
        if !entry.file_type().map_or(false, |ft| ft.is_file()) {
            continue;
        }
        let rel_path = entry
            .path()
            .strip_prefix(root_path)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .to_string();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if let Some(score) = score_file_match(
            &file_name.to_lowercase(),
            &rel_path.to_lowercase(),
            &query_terms,
        ) {
            scored.push((
                score,
                FileSearchResult {
                    path: entry.path().to_string_lossy().to_string(),
                    rel_path,
                    name: file_name,
                },
            ));
            if scored.len() >= COLLECT_CAP {
                break;
            }
        }
    }

    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored.truncate(max_results);
    Ok(scored.into_iter().map(|(_, r)| r).collect())
}

/// Rank a file against all query terms. None = no match.
/// Filename hits outrank path hits; earlier + shorter paths win ties.
fn score_file_match(name_lower: &str, rel_lower: &str, terms: &[&str]) -> Option<i64> {
    let mut score: i64 = 0;
    for term in terms {
        match rel_lower.find(term) {
            Some(pos) => {
                score -= pos as i64;
                if name_lower.contains(term) {
                    score += 100;
                    if name_lower.starts_with(term) {
                        score += 50;
                    }
                }
            }
            None => return None,
        }
    }
    score -= rel_lower.len() as i64 / 10;
    Some(score)
}

/// Ripgrep-style live content search with context window.
/// Streams each file line-by-line (no whole-file buffering), skips generated
/// / lock / binary files, and aborts cooperatively when a newer search starts.
#[tauri::command]
pub async fn live_grep(
    root: String,
    query: String,
    case_sensitive: Option<bool>,
    limit: Option<usize>,
) -> Result<Vec<GrepMatch>, String> {
    let my_gen = GREP_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let max_results = limit.unwrap_or(100);
    let root_path = Path::new(&root);
    if !root_path.exists() {
        return Ok(Vec::new());
    }

    let is_case_sensitive = case_sensitive.unwrap_or(false);
    let regex = RegexBuilder::new(&regex::escape(&query))
        .case_insensitive(!is_case_sensitive)
        .build()
        .map_err(|e| e.to_string())?;

    let mut matches = Vec::new();
    let walker = WalkBuilder::new(root_path)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .build();

    for result in walker {
        if !grep_alive(my_gen) {
            break;
        }
        let Ok(entry) = result else { continue };
        if !entry.file_type().map_or(false, |ft| ft.is_file()) {
            continue;
        }
        let path = entry.path();

        // Skip files larger than 5MB to avoid hanging on large logs/bundles
        if let Ok(meta) = entry.metadata() {
            if meta.len() > 5 * 1024 * 1024 {
                continue;
            }
        }

        let file_name = entry.file_name().to_string_lossy();
        if is_grep_skipped(&file_name) {
            continue;
        }
        if looks_binary(path) {
            continue;
        }

        let Ok(file) = File::open(path) else {
            continue;
        };
        let reader = BufReader::new(file);

        // Streaming scan: 2-line lookahead gives context_after for free while
        // every line is still tested exactly once; `before` holds context.
        let mut before: VecDeque<String> = VecDeque::with_capacity(2);
        let mut ahead: VecDeque<String> = VecDeque::with_capacity(2);
        let mut lines_iter = reader.lines();
        for _ in 0..2 {
            match lines_iter.next() {
                Some(Ok(l)) => ahead.push_back(l),
                _ => break,
            }
        }

        let full_path = path.to_string_lossy().to_string();
        let rel_path = path
            .strip_prefix(root_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        let mut line_number = 0usize;
        loop {
            if (line_number & 255) == 0 && !grep_alive(my_gen) {
                return Ok(matches);
            }
            let Some(line_text) = ahead.pop_front() else {
                break;
            };
            match lines_iter.next() {
                Some(Ok(l)) => ahead.push_back(l),
                Some(Err(_)) => break, // decode error mid-file: stop this file
                None => {}
            }
            line_number += 1;

            if regex.is_match(&line_text) {
                matches.push(GrepMatch {
                    path: full_path.clone(),
                    rel_path: rel_path.clone(),
                    line_number,
                    line_text: line_text.clone(),
                    context_before: before.iter().cloned().collect(),
                    context_after: ahead.iter().take(2).cloned().collect(),
                });
                if matches.len() >= max_results {
                    return Ok(matches);
                }
            }
            before.push_back(line_text);
            if before.len() > 2 {
                before.pop_front();
            }
        }
    }

    Ok(matches)
}

/// Get preview window around a specific line of a file (for Telescope context viewer).
/// Streams with O(1) memory: one pass counts lines, a second pass re-reads
/// just the window (cheap via the OS page cache).
#[tauri::command]
pub async fn get_preview(
    path: String,
    target_line: Option<usize>,
    radius: Option<usize>,
) -> Result<PreviewResult, String> {
    let r = radius.unwrap_or(25);

    let file = File::open(&path).map_err(|e| format!("Failed to open {}: {}", path, e))?;
    let mut total_lines = 0usize;
    for line in BufReader::new(file).lines() {
        line.map_err(|_| "Binary or non-UTF8 file".to_string())?;
        total_lines += 1;
    }

    if total_lines == 0 {
        return Ok(PreviewResult {
            lines: Vec::new(),
            start_line: 1,
            highlight_line: None,
            total_lines: 0,
        });
    }

    let center = target_line.unwrap_or(1).clamp(1, total_lines);
    let start_line = center.saturating_sub(r + 1) + 1;
    let end_line = (center + r).min(total_lines);

    let file2 = File::open(&path).map_err(|e| format!("Failed to open {}: {}", path, e))?;
    let mut lines = Vec::with_capacity(end_line - start_line + 1);
    for (idx, line) in BufReader::new(file2).lines().enumerate() {
        let n = idx + 1;
        if n < start_line {
            continue;
        }
        if n > end_line {
            break;
        }
        lines.push(line.map_err(|_| "Binary or non-UTF8 file".to_string())?);
    }

    Ok(PreviewResult {
        lines,
        start_line,
        highlight_line: target_line,
        total_lines,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    fn test_root(tag: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("cmx-search-{}-{}", tag, std::process::id()));
        let _ = stdfs::remove_dir_all(&root);
        stdfs::create_dir_all(root.join("src")).unwrap();
        stdfs::write(root.join("src").join("main.rs"), "fn main() {\n    println!(\"hello\");\n}\n").unwrap();
        stdfs::write(root.join("src").join("helper.rs"), "// nothing\n").unwrap();
        stdfs::write(root.join("notes.md"), "# hello world\n").unwrap();
        stdfs::write(root.join("app.min.js"), "var hello=1;".repeat(50)).unwrap();
        stdfs::write(root.join("package-lock.json"), "{\"hello\": true}").unwrap();
        // binary-looking file containing the query as raw bytes
        stdfs::write(root.join("blob.bin"), b"\x00\x01hello\x02\x03").unwrap();
        root
    }

    #[test]
    fn score_prefers_filename_hits() {
        let terms = vec!["main"];
        let a = score_file_match("main.rs", "src/main.rs", &terms).unwrap();
        let b = score_file_match("helper.rs", "src/main_helper.rs", &terms);
        // path-only dir hit still matches but scores lower than filename hit
        assert!(b.is_some());
        assert!(a > b.unwrap());
        assert!(score_file_match("other.rs", "src/other.rs", &terms).is_none());
    }

    #[test]
    fn grep_skips_generated_and_locks() {
        assert!(is_grep_skipped("package-lock.json"));
        assert!(is_grep_skipped("app.min.js"));
        assert!(is_grep_skipped("bundle.BUNDLE.JS"));
        assert!(!is_grep_skipped("main.rs"));
    }

    #[test]
    fn live_grep_streams_with_context_and_skips() {
        let root = test_root("grep");
        let rs = tauri::async_runtime::block_on(live_grep(
            root.to_string_lossy().to_string(),
            "hello".to_string(),
            Some(false),
            Some(50),
        ))
        .unwrap();
        let paths: Vec<&str> = rs.iter().map(|m| m.rel_path.as_str()).collect();
        // real hits found …
        assert!(paths.iter().any(|p| p.ends_with("main.rs")));
        assert!(paths.iter().any(|p| p.ends_with("notes.md")));
        // … generated / lock / binary files skipped
        assert!(!paths.iter().any(|p| p.ends_with("app.min.js")));
        assert!(!paths.iter().any(|p| p.ends_with("package-lock.json")));
        assert!(!paths.iter().any(|p| p.ends_with("blob.bin")));
        // context windows: println line has 1 line before, fn line + } after
        let m = rs.iter().find(|m| m.rel_path.ends_with("main.rs")).unwrap();
        assert_eq!(m.line_number, 2);
        assert_eq!(m.context_before, vec!["fn main() {".to_string()]);
        assert_eq!(m.context_after, vec!["}".to_string()]);
        let _ = stdfs::remove_dir_all(&root);
    }

    #[test]
    fn find_files_ranks_and_limits() {
        let root = test_root("find");
        let rs = tauri::async_runtime::block_on(find_files(
            root.to_string_lossy().to_string(),
            "main".to_string(),
            Some(50),
        ))
        .unwrap();
        assert!(!rs.is_empty());
        // filename hit first
        assert!(rs[0].rel_path.ends_with("main.rs"));
        let limited = tauri::async_runtime::block_on(find_files(
            root.to_string_lossy().to_string(),
            "h".to_string(),
            Some(2),
        ))
        .unwrap();
        assert!(limited.len() <= 2);
        let _ = stdfs::remove_dir_all(&root);
    }

    #[test]
    fn get_preview_window_is_bounded() {
        let root = test_root("preview");
        let big = root.join("big.txt");
        let content: String = (1..=500).map(|i| format!("line {i}\n")).collect();
        stdfs::write(&big, &content).unwrap();
        let r = tauri::async_runtime::block_on(get_preview(
            big.to_string_lossy().to_string(),
            Some(250),
            Some(5),
        ))
        .unwrap();
        assert_eq!(r.total_lines, 500);
        assert_eq!(r.start_line, 245);
        assert_eq!(r.lines.len(), 11);
        assert_eq!(r.lines[5], "line 250");
        let _ = stdfs::remove_dir_all(&root);
    }

    #[test]
    fn git_status_non_git_dir_returns_safely() {
        let temp = std::env::temp_dir().join(format!("cmx-non-git-{}", std::process::id()));
        let _ = stdfs::create_dir_all(&temp);
        let res = tauri::async_runtime::block_on(get_git_status(temp.to_string_lossy().to_string())).unwrap();
        assert!(!res.is_repo);
        assert!(res.branch.is_none());
        assert!(res.files.is_empty());
        let _ = stdfs::remove_dir_all(&temp);
    }

    #[test]
    fn git_status_detects_branch_and_untracked_files() {
        let temp = std::env::temp_dir().join(format!("cmx-git-test-{}", std::process::id()));
        let _ = stdfs::remove_dir_all(&temp);
        let _ = stdfs::create_dir_all(&temp);

        // Run git init
        let init = std::process::Command::new("git")
            .arg("-C")
            .arg(&temp)
            .arg("init")
            .output();

        if let Ok(out) = init {
            if out.status.success() {
                // Create an untracked file
                stdfs::write(temp.join("hello.txt"), "hello").unwrap();

                let res = tauri::async_runtime::block_on(get_git_status(temp.to_string_lossy().to_string())).unwrap();
                assert!(res.is_repo);
                assert!(res.files.iter().any(|f| f.path == "hello.txt" && f.status == "U"));
            }
        }
        let _ = stdfs::remove_dir_all(&temp);
    }
}
