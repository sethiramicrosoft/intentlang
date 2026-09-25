import { compileSource } from "../compiler.js";
import type { Diagnostic, ProgramIr } from "../model.js";
import { buildTraceMap } from "./trace.js";

export interface ServicePosition {
  line: number;
  character: number;
}

export interface ServiceRange {
  start: ServicePosition;
  end: ServicePosition;
}

export interface ServiceLocation {
  uri: string;
  range: ServiceRange;
}

export interface LanguageSymbol {
  name: string;
  kind: "application" | "entity" | "field" | "relationship" | "action" | "role";
  id?: string;
  range: ServiceRange;
  selectionRange: ServiceRange;
  detail: string;
}

export interface CompletionItem {
  label: string;
  kind: "keyword" | "snippet" | "symbol";
  insertText: string;
  detail: string;
}

export interface SemanticToken {
  line: number;
  startCharacter: number;
  length: number;
  tokenType: "keyword" | "type" | "property" | "function" | "enumMember" | "string" | "number";
}

export interface CodeAction {
  title: string;
  diagnosticCode: string;
  replacement?: { range: ServiceRange; text: string };
}

interface TokenOccurrence {
  name: string;
  range: ServiceRange;
}

const keywords = [
  "application",
  "authentication",
  "role",
  "entity",
  "action",
  "allow",
  "belongs",
  "require",
  "set",
  "module",
  "import",
  "export",
  "requires"
];

const snippets: CompletionItem[] = [
  {
    label: "application",
    kind: "snippet",
    insertText: "application ApplicationName",
    detail: "Declare the application."
  },
  {
    label: "entity",
    kind: "snippet",
    insertText: "entity EntityName with id entity-name",
    detail: "Declare an entity."
  },
  {
    label: "field",
    kind: "snippet",
    insertText: "  fieldName is required text with id entity-field-name",
    detail: "Declare a typed field."
  },
  {
    label: "action",
    kind: "snippet",
    insertText:
      "action transition a EntityName\n  require status is \"open\" otherwise \"Entity must be open\"\n  set status to \"done\"",
    detail: "Declare a guarded workflow action."
  },
  {
    label: "permission",
    kind: "snippet",
    insertText: "allow RoleName to read EntityName",
    detail: "Declare an explicit permission."
  }
];

function range(line: number, start: number, length: number): ServiceRange {
  return {
    start: { line, character: start },
    end: { line, character: start + length }
  };
}

function wordAt(source: string, position: ServicePosition): string | undefined {
  const line = source.replaceAll("\r\n", "\n").split("\n")[position.line] ?? "";
  const pattern = /[A-Za-z_][A-Za-z0-9_.-]*/g;
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (
      position.character >= start &&
      position.character <= start + match[0].length
    ) {
      return match[0];
    }
  }
  return undefined;
}

function occurrences(source: string, name: string): TokenOccurrence[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_.-])`, "g");
  return source
    .replaceAll("\r\n", "\n")
    .split("\n")
    .flatMap((line, lineIndex) =>
      Array.from(line.matchAll(pattern), (match) => ({
        name,
        range: range(lineIndex, match.index ?? 0, name.length)
      }))
    );
}

export function documentSymbols(source: string): LanguageSymbol[] {
  const symbols: LanguageSymbol[] = [];
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  for (let line = 0; line < lines.length; line += 1) {
    const text = lines[line]!;
    const patterns: Array<{
      kind: LanguageSymbol["kind"];
      expression: RegExp;
      detail: string;
    }> = [
      { kind: "application", expression: /^\s*application\s+([A-Z][A-Za-z0-9]*)/, detail: "application" },
      { kind: "entity", expression: /^\s*entity\s+([A-Z][A-Za-z0-9]*)/, detail: "entity" },
      { kind: "entity", expression: /^\s*(?:a|an)\s+([A-Z][A-Za-z0-9]*)\s+has\s+/, detail: "entity" },
      { kind: "field", expression: /^\s{2}([a-z][A-Za-z0-9]*)\s+is\s+/, detail: "field" },
      { kind: "field", expression: /^\s*(?:a|an)\s+[A-Z][A-Za-z0-9]*\s+has\s+(?:a|an)\s+(?:required\s+)?(?:unique\s+)?([a-z][A-Za-z0-9]*)\s+as\s+/, detail: "field" },
      { kind: "relationship", expression: /^\s*(?:each\s+)?[A-Z][A-Za-z0-9]*\s+belongs\s+to\s+(?:(?:a|an)\s+)?[A-Z][A-Za-z0-9]*\s+as\s+([a-z][A-Za-z0-9]*)/, detail: "relationship" },
      { kind: "action", expression: /^\s*action\s+([a-z][A-Za-z0-9]*)\s+/, detail: "action" },
      { kind: "role", expression: /^\s*role\s+([A-Z][A-Za-z0-9]*)/, detail: "role" }
    ];
    for (const candidate of patterns) {
      const match = candidate.expression.exec(text);
      if (!match) continue;
      const name = match[1]!;
      const start = text.indexOf(name, match.index);
      symbols.push({
        name,
        kind: candidate.kind,
        range: range(line, 0, text.length),
        selectionRange: range(line, start, name.length),
        detail: candidate.detail
      });
    }
  }
  const result = compileSource(source);
  if (result.ok) {
    const ids = new Map<string, string>();
    ids.set(result.ir.application.name, result.ir.application.id);
    for (const entity of result.ir.entities) {
      ids.set(entity.name, entity.id);
      for (const field of entity.fields) ids.set(field.name, field.id);
    }
    for (const action of result.ir.actions) ids.set(action.name, action.id);
    for (const role of result.ir.roles) ids.set(role.name, role.id);
    for (const relationship of result.ir.relationships) {
      ids.set(relationship.name, relationship.id);
    }
    for (const symbol of symbols) symbol.id = ids.get(symbol.name);
  }
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    if (symbol.kind === "field") return true;
    const key = `${symbol.kind}:${symbol.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function languageDiagnostics(source: string): Diagnostic[] {
  const result = compileSource(source);
  return result.ok ? [] : result.diagnostics;
}

export function definitionAt(
  source: string,
  uri: string,
  position: ServicePosition
): ServiceLocation | undefined {
  const word = wordAt(source, position);
  const matches = documentSymbols(source).filter(
    (candidate) => candidate.name === word
  );
  const symbol = matches.length === 1 ? matches[0] : undefined;
  return symbol ? { uri, range: symbol.selectionRange } : undefined;
}

export function referencesAt(
  source: string,
  uri: string,
  position: ServicePosition
): ServiceLocation[] {
  const word = wordAt(source, position);
  if (
    !word ||
    documentSymbols(source).filter((candidate) => candidate.name === word)
      .length !== 1
  ) {
    return [];
  }
  return word
    ? occurrences(source, word).map((item) => ({ uri, range: item.range }))
    : [];
}

export function renameAt(
  source: string,
  uri: string,
  position: ServicePosition,
  newName: string
): { changes: Record<string, Array<{ range: ServiceRange; newText: string }>> } {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(newName)) {
    throw new Error("Rename target must be an IntentLang identifier.");
  }
  const word = wordAt(source, position);
  const declarations = documentSymbols(source).filter(
    (symbol) => symbol.name === word
  );
  if (!word || declarations.length !== 1) {
    throw new Error(
      declarations.length > 1
        ? "Rename is ambiguous because multiple declarations use this name."
        : "Rename requires a declared symbol."
    );
  }
  return {
    changes: {
      [uri]: occurrences(source, word).map((item) => ({
        range: item.range,
        newText: newName
      }))
    }
  };
}

export function hoverAt(
  source: string,
  position: ServicePosition
): { contents: string; range?: ServiceRange } | undefined {
  const word = wordAt(source, position);
  const matches = documentSymbols(source).filter(
    (candidate) => candidate.name === word
  );
  const symbol = matches.length === 1 ? matches[0] : undefined;
  if (!symbol) return undefined;
  const result = compileSource(source);
  let detail = `${symbol.kind} ${symbol.name}`;
  if (result.ok && symbol.kind === "entity") {
    const entity = result.ir.entities.find((candidate) => candidate.name === symbol.name);
    if (entity) detail += ` — ${entity.fields.length} fields`;
  }
  if (symbol.id) detail += `\nStable ID: ${symbol.id}`;
  return { contents: detail, range: symbol.selectionRange };
}

export function completionsAt(
  source: string,
  position: ServicePosition
): CompletionItem[] {
  const line = source.replaceAll("\r\n", "\n").split("\n")[position.line] ?? "";
  const prefix = line.slice(0, position.character).trimStart().toLowerCase();
  const symbols = documentSymbols(source).map((symbol) => ({
    label: symbol.name,
    kind: "symbol" as const,
    insertText: symbol.name,
    detail: symbol.kind
  }));
  if (/^(allow|action|authentication|.*belongs to)\b/.test(prefix)) {
    return symbols;
  }
  return [...snippets, ...keywords.map((keyword) => ({
    label: keyword,
    kind: "keyword" as const,
    insertText: keyword,
    detail: "IntentLang keyword"
  }))];
}

export function codeActions(source: string): CodeAction[] {
  return languageDiagnostics(source).map((diagnostic) => {
    const diagnosticRange = range(
      Math.max(0, diagnostic.line - 1),
      Math.max(0, diagnostic.column - 1),
      diagnostic.length
    );
    if (diagnostic.code === "E004") {
      return {
        title: "Add application declaration",
        diagnosticCode: diagnostic.code,
        replacement: {
          range: range(0, 0, 0),
          text: "application ApplicationName\n"
        }
      };
    }
    return {
      title: diagnostic.hint,
      diagnosticCode: diagnostic.code,
      replacement: undefined,
      range: diagnosticRange
    } as CodeAction & { range: ServiceRange };
  });
}

export function semanticTokens(source: string): SemanticToken[] {
  const tokens: SemanticToken[] = [];
  const symbolKinds = new Map(
    documentSymbols(source).map((symbol) => [symbol.name, symbol.kind])
  );
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  for (let line = 0; line < lines.length; line += 1) {
    for (const match of lines[line]!.matchAll(/[A-Za-z_][A-Za-z0-9_.-]*|"[^"]*"|\b\d+\b/g)) {
      const text = match[0];
      let tokenType: SemanticToken["tokenType"] | undefined;
      if (keywords.includes(text)) tokenType = "keyword";
      else if (text.startsWith('"')) tokenType = "string";
      else if (/^\d+$/.test(text)) tokenType = "number";
      else {
        const kind = symbolKinds.get(text);
        tokenType =
          kind === "entity"
            ? "type"
            : kind === "field" || kind === "relationship"
              ? "property"
              : kind === "action"
                ? "function"
                : kind === "role"
                  ? "enumMember"
                  : undefined;
      }
      if (tokenType) {
        tokens.push({
          line,
          startCharacter: match.index ?? 0,
          length: text.length,
          tokenType
        });
      }
    }
  }
  return tokens;
}

export function moduleLinks(
  source: string,
  uri: string
): Array<{ range: ServiceRange; target: string; alias: string }> {
  return source
    .replaceAll("\r\n", "\n")
    .split("\n")
    .flatMap((line, lineIndex) => {
      const match = /^\s*import\s+"([^"]+)"\s+as\s+([A-Z][A-Za-z0-9]*)/.exec(line);
      if (!match) return [];
      const start = line.indexOf(match[1]!);
      return [{
        range: range(lineIndex, start, match[1]!.length),
        target: new URL(match[1]!, uri).toString(),
        alias: match[2]!
      }];
    });
}

export function traceLinks(source: string, uri: string) {
  const result = compileSource(source);
  return result.ok ? buildTraceMap(source, result.ir, uri).links : [];
}

export function compiledProgram(source: string): ProgramIr | undefined {
  const result = compileSource(source);
  return result.ok ? result.ir : undefined;
}
