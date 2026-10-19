import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "struct"
  | "interface"
  | "trait"
  | "type"
  | "enum"
  | "variable"
  | "constant"
  | "heading";

export interface SymbolItem {
  name: string;
  kind: SymbolKind;
  line: number; // 1-indexed
  col: number;  // 1-indexed
  detail?: string;
  containerName?: string;
}

/**
 * Maps symbol kinds to appropriate VS Code Codicon names.
 */
export function getSymbolIcon(kind: SymbolKind): { icon: string; color: string } {
  switch (kind) {
    case "function":
    case "method":
      return { icon: "codicon-symbol-function", color: "#c084fc" }; // purple
    case "class":
      return { icon: "codicon-symbol-class", color: "#fbbf24" }; // amber
    case "struct":
      return { icon: "codicon-symbol-structure", color: "#fb923c" }; // orange
    case "interface":
      return { icon: "codicon-symbol-interface", color: "#38bdf8" }; // sky
    case "trait":
      return { icon: "codicon-symbol-interface", color: "#2dd4bf" }; // teal
    case "type":
    case "enum":
      return { icon: "codicon-symbol-enum", color: "#a78bfa" }; // violet
    case "variable":
      return { icon: "codicon-symbol-variable", color: "#60a5fa" }; // blue
    case "constant":
      return { icon: "codicon-symbol-constant", color: "#f472b6" }; // pink
    case "heading":
      return { icon: "codicon-markdown", color: "#4ade80" }; // emerald
    default:
      return { icon: "codicon-symbol-misc", color: "#a1a1aa" };
  }
}

/**
 * Extract outline symbols from a document using CodeMirror's Lezer AST
 * with regex fallback.
 */
export function extractSymbols(
  content: string,
  language: string,
  view?: EditorView | null
): SymbolItem[] {
  if (!content) return [];

  const lang = (language || "").toLowerCase();

  // 1. Try AST-based extraction if EditorView is provided and has syntaxTree
  if (view && view.state) {
    try {
      const astSymbols = extractFromSyntaxTree(view, lang);
      if (astSymbols && astSymbols.length > 0) {
        return astSymbols;
      }
    } catch {
      // Fallback to regex parser
    }
  }

  // 2. High-speed regex extractor
  return extractFromRegex(content, lang);
}

function extractFromSyntaxTree(view: EditorView, lang: string): SymbolItem[] | null {
  const tree = syntaxTree(view.state);
  if (!tree || tree.length === 0) return null;

  const doc = view.state.doc;
  const symbols: SymbolItem[] = [];

  tree.iterate({
    enter(node) {
      const nodeName = node.name;

      // --- JavaScript / TypeScript ---
      if (lang.includes("javascript") || lang.includes("typescript") || lang === "js" || lang === "ts" || lang === "jsx" || lang === "tsx") {
        if (nodeName === "FunctionDeclaration") {
          const id = node.node.getChild("VariableDefinition");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "function",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "function",
            });
          }
        } else if (nodeName === "ClassDeclaration") {
          const id = node.node.getChild("VariableDefinition");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "class",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "class",
            });
          }
        } else if (nodeName === "MethodDeclaration") {
          const id = node.node.getChild("PropertyDefinition");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "method",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "method",
            });
          }
        } else if (nodeName === "InterfaceDeclaration") {
          const id = node.node.getChild("TypeDefinition");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "interface",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "interface",
            });
          }
        } else if (nodeName === "TypeAliasDeclaration") {
          const id = node.node.getChild("TypeDefinition");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "type",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "type",
            });
          }
        }
      }

      // --- Rust ---
      else if (lang === "rust" || lang === "rs") {
        if (nodeName === "FunctionItem") {
          const id = node.node.getChild("BoundIdentifier");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "function",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "fn",
            });
          }
        } else if (nodeName === "StructItem") {
          const id = node.node.getChild("TypeIdentifier");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "struct",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "struct",
            });
          }
        } else if (nodeName === "EnumItem") {
          const id = node.node.getChild("TypeIdentifier");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "enum",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "enum",
            });
          }
        } else if (nodeName === "TraitItem") {
          const id = node.node.getChild("TypeIdentifier");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "trait",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "trait",
            });
          }
        }
      }

      // --- Python ---
      else if (lang === "python" || lang === "py") {
        if (nodeName === "FunctionDefinition") {
          const id = node.node.getChild("VariableName");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "function",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "def",
            });
          }
        } else if (nodeName === "ClassDefinition") {
          const id = node.node.getChild("ClassName");
          if (id) {
            const name = doc.sliceString(id.from, id.to);
            const line = doc.lineAt(id.from);
            symbols.push({
              name,
              kind: "class",
              line: line.number,
              col: id.from - line.from + 1,
              detail: "class",
            });
          }
        }
      }

      // --- Markdown Headings ---
      else if (lang.includes("markdown") || lang === "md") {
        if (nodeName.startsWith("ATXHeading") || nodeName === "SetextHeading") {
          const raw = doc.sliceString(node.from, node.to);
          const clean = raw.replace(/^#+\s*/, "").trim();
          if (clean) {
            const line = doc.lineAt(node.from);
            const level = (raw.match(/^#+/) || ["#"])[0].length;
            symbols.push({
              name: clean,
              kind: "heading",
              line: line.number,
              col: 1,
              detail: `H${level}`,
            });
          }
        }
      }
    },
  });

  return symbols.length > 0 ? symbols : null;
}

function extractFromRegex(content: string, lang: string): SymbolItem[] {
  const symbols: SymbolItem[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const text = lines[i];
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    // Markdown
    if (lang.includes("markdown") || lang === "md") {
      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        symbols.push({
          name: match[2].trim(),
          kind: "heading",
          line: lineNum,
          col: text.indexOf("#") + 1,
          detail: `H${match[1].length}`,
        });
      }
      continue;
    }

    // Rust
    if (lang === "rust" || lang === "rs") {
      const fnMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/);
      if (fnMatch) {
        symbols.push({
          name: fnMatch[1],
          kind: "function",
          line: lineNum,
          col: text.indexOf(fnMatch[1]) + 1,
          detail: "fn",
        });
        continue;
      }

      const structMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?struct\s+([a-zA-Z0-9_]+)/);
      if (structMatch) {
        symbols.push({
          name: structMatch[1],
          kind: "struct",
          line: lineNum,
          col: text.indexOf(structMatch[1]) + 1,
          detail: "struct",
        });
        continue;
      }

      const enumMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?enum\s+([a-zA-Z0-9_]+)/);
      if (enumMatch) {
        symbols.push({
          name: enumMatch[1],
          kind: "enum",
          line: lineNum,
          col: text.indexOf(enumMatch[1]) + 1,
          detail: "enum",
        });
        continue;
      }

      const traitMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?trait\s+([a-zA-Z0-9_]+)/);
      if (traitMatch) {
        symbols.push({
          name: traitMatch[1],
          kind: "trait",
          line: lineNum,
          col: text.indexOf(traitMatch[1]) + 1,
          detail: "trait",
        });
        continue;
      }

      const implMatch = trimmed.match(/^impl(?:<[^>]+>)?\s+(?:([a-zA-Z0-9_]+)\s+for\s+)?([a-zA-Z0-9_]+)/);
      if (implMatch) {
        const name = implMatch[1] ? `${implMatch[1]} for ${implMatch[2]}` : implMatch[2];
        symbols.push({
          name,
          kind: "type",
          line: lineNum,
          col: text.indexOf("impl") + 1,
          detail: "impl",
        });
        continue;
      }
    }

    // Python
    if (lang === "python" || lang === "py") {
      const defMatch = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)/);
      if (defMatch) {
        symbols.push({
          name: defMatch[1],
          kind: text.startsWith(" ") || text.startsWith("\t") ? "method" : "function",
          line: lineNum,
          col: text.indexOf(defMatch[1]) + 1,
          detail: "def",
        });
        continue;
      }

      const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: "class",
          line: lineNum,
          col: text.indexOf(classMatch[1]) + 1,
          detail: "class",
        });
        continue;
      }
    }

    // JavaScript / TypeScript / C++ / Go / General
    const jsFnMatch = trimmed.match(/^(?:export\s+(?:default\s+)?)?(?:async\s+)?function(?:\s*\*|\s+)\s*([a-zA-Z0-9_$]+)/);
    if (jsFnMatch) {
      symbols.push({
        name: jsFnMatch[1],
        kind: "function",
        line: lineNum,
        col: text.indexOf(jsFnMatch[1]) + 1,
        detail: "function",
      });
      continue;
    }

    const arrowFnMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/);
    if (arrowFnMatch) {
      symbols.push({
        name: arrowFnMatch[1],
        kind: "function",
        line: lineNum,
        col: text.indexOf(arrowFnMatch[1]) + 1,
        detail: "arrow fn",
      });
      continue;
    }

    const classMatch = trimmed.match(/^(?:export\s+(?:default\s+)?)?class\s+([a-zA-Z0-9_$]+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: "class",
        line: lineNum,
        col: text.indexOf(classMatch[1]) + 1,
        detail: "class",
      });
      continue;
    }

    const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/);
    if (ifaceMatch) {
      symbols.push({
        name: ifaceMatch[1],
        kind: "interface",
        line: lineNum,
        col: text.indexOf(ifaceMatch[1]) + 1,
        detail: "interface",
      });
      continue;
    }

    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*=/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: "type",
        line: lineNum,
        col: text.indexOf(typeMatch[1]) + 1,
        detail: "type",
      });
      continue;
    }

    const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+([a-zA-Z0-9_$]+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        kind: "enum",
        line: lineNum,
        col: text.indexOf(enumMatch[1]) + 1,
        detail: "enum",
      });
      continue;
    }

    // Go func
    if (lang === "go") {
      const goMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)/);
      if (goMatch) {
        symbols.push({
          name: goMatch[1],
          kind: "function",
          line: lineNum,
          col: text.indexOf(goMatch[1]) + 1,
          detail: "func",
        });
        continue;
      }
    }
  }

  return symbols;
}
