export function getFileIcon(filename: string): { icon: string; color?: string; label?: string } {
  const lower = filename.toLowerCase();

  // Special project & configuration files
  if (lower === ".gitignore" || lower === ".gitattributes" || lower === ".gitmodules") {
    return { icon: "codicon-source-control", color: "var(--file-git)" };
  }
  if (
    lower === "package.json" ||
    lower === "cargo.toml" ||
    lower === "tsconfig.json" ||
    lower === "vite.config.ts"
  ) {
    return { icon: "codicon-settings", color: "var(--file-config)" };
  }
  if (
    lower === "package-lock.json" ||
    lower === "pnpm-lock.yaml" ||
    lower === "cargo.lock" ||
    lower === "yarn.lock"
  ) {
    return { icon: "codicon-lock", color: "var(--file-lock)" };
  }
  if (lower.startsWith(".env")) {
    return { icon: "codicon-gear", color: "var(--file-env)" };
  }
  if (lower === "readme.md" || lower.startsWith("readme")) {
    return { icon: "codicon-book", color: "var(--file-doc)" };
  }
  if (
    lower === "dockerfile" ||
    lower.startsWith("dockerfile.") ||
    lower.endsWith(".dockerfile") ||
    lower === ".dockerignore"
  ) {
    return { icon: "codicon-package", color: "var(--file-docker)" };
  }

  const ext = lower.split(".").pop() ?? "";

  switch (ext) {
    case "ts":
      return { icon: "codicon-file-code", color: "var(--file-ts)" };
    case "tsx":
      return { icon: "codicon-file-code", color: "var(--file-react)" };
    case "js":
    case "mjs":
    case "cjs":
      return { icon: "codicon-file-code", color: "var(--file-js)" };
    case "jsx":
      return { icon: "codicon-file-code", color: "var(--file-react)" };
    case "json":
      return { icon: "codicon-json", color: "var(--file-json)" };
    case "rs":
      return { icon: "codicon-symbol-misc", color: "var(--file-rust)" };
    case "py":
      return { icon: "codicon-file-code", color: "var(--file-python)" };
    case "html":
    case "htm":
      return { icon: "codicon-code", color: "var(--file-html)" };
    case "css":
      return { icon: "codicon-symbol-color", color: "var(--file-css)" };
    case "scss":
    case "sass":
    case "less":
      return { icon: "codicon-symbol-color", color: "var(--file-css)" };
    case "md":
    case "markdown":
      return { icon: "codicon-markdown", color: "var(--file-md)" };
    case "c":
    case "cpp":
    case "cc":
    case "cxx":
    case "h":
    case "hpp":
      return { icon: "codicon-file-code", color: "var(--file-cpp)" };
    case "java":
      return { icon: "codicon-file-code", color: "var(--file-java)" };
    case "sql":
      return { icon: "codicon-database", color: "var(--file-sql)" };
    case "xml":
    case "svg":
      return { icon: "codicon-file-media", color: "var(--file-media)" };
    case "yaml":
    case "yml":
    case "toml":
      return { icon: "codicon-gear", color: "var(--file-config)" };
    case "sh":
    case "bash":
    case "zsh":
      return { icon: "codicon-terminal", color: "var(--file-shell)" };
    case "go":
      return { icon: "codicon-file-code", color: "var(--file-go)" };
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "ico":
    case "webp":
      return { icon: "codicon-file-media", color: "var(--file-media)" };
    default:
      return { icon: "codicon-file", color: "var(--file-default)" };
  }
}
