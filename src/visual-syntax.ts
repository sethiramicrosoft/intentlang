export type VisualTarget = "text" | "background" | "it";
interface DisplayText {
  value: string;
  quoted: boolean;
}
export type VisualStatement =
  | { kind: "show"; parts: DisplayText[]; separateLines?: boolean }
  | { kind: "layout"; mode: "words" | "single-line" }
  | { kind: "style"; target: VisualTarget; modifiers: string[] }
  | { kind: "place"; target: VisualTarget; position: string }
  | { kind: "move"; target: VisualTarget; from: string; to: string; seconds: number }
  | { kind: "across"; target: VisualTarget; seconds?: number };

interface Token {
  kind: "word" | "number" | "string" | "comma" | "period";
  value: string;
}

export const visualGrammarWords = [
  "show", "display", "make", "set", "place", "move", "slide", "the", "text",
  "background", "it", "and", "to", "at", "in", "from", "over", "seconds",
  "second", "across", "screen", "left", "right", "top", "bottom", "center", "middle",
  "pixels", "put", "each", "word", "on", "a", "new", "separate", "line", "lines",
  "one", "its", "own", "all", "words", "underline"
];

function tokenize(line: string): Token[] | undefined {
  const tokens: Token[] = [];
  let rest = line.trim();
  while (rest) {
    const match = /^(?:"(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[a-z]+|[.,])/i.exec(rest);
    if (!match) return undefined;
    const raw = match[0];
    const kind = raw.startsWith('"') ? "string" : raw === "," ? "comma" :
      raw === "." ? "period" : /^\d/.test(raw) ? "number" : "word";
    tokens.push({ kind, value: kind === "string" ? raw : raw.toLowerCase() });
    rest = rest.slice(raw.length).trimStart();
  }
  if (tokens.at(-1)?.kind === "period") tokens.pop();
  return tokens;
}

class SentenceParser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  private eat(word: string): boolean {
    if (this.tokens[this.index]?.value !== word) return false;
    this.index += 1;
    return true;
  }

  private take(kind: Token["kind"]): string | undefined {
    const token = this.tokens[this.index];
    if (token?.kind !== kind) return undefined;
    this.index += 1;
    return token.value;
  }

  private target(): VisualTarget | undefined {
    this.eat("the");
    const value = this.take("word");
    return value === "text" || value === "background" || value === "it" ? value : undefined;
  }

  private duration(): number | undefined {
    if (!this.eat("over")) return undefined;
    const value = this.take("number");
    if (value === undefined || !(this.eat("seconds") || this.eat("second"))) return undefined;
    return Number(value);
  }

  private modifiers(): string[] | undefined {
    const result: string[] = [];
    let words: string[] = [];
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index++]!;
      if (token.kind === "comma" || token.value === "and") {
        if (!words.length) return undefined;
        result.push(words.join(" "));
        words = [];
        if (token.kind === "comma") this.eat("and");
      } else if (token.kind === "word" || token.kind === "number") {
        words.push(token.value);
      } else {
        return undefined;
      }
    }
    if (!words.length) return undefined;
    result.push(words.join(" "));
    return result;
  }

  parse(): VisualStatement | undefined {
    const verb = this.take("word");
    let statement: VisualStatement | undefined;
    if (verb === "show" || verb === "display") {
      const literal = this.take("string");
      if (literal === undefined) return undefined;
      const parts = [literal];
      while (this.tokens[this.index]?.kind === "comma" || this.tokens[this.index]?.value === "and") {
        if (this.eat(",")) this.eat("and");
        else this.eat("and");
        const next = this.take("string");
        if (next === undefined) return undefined;
        parts.push(next);
      }
      if (parts.length > 1 || this.tokens[this.index]?.value === "on") {
        if (!this.eat("on") || !this.eat("separate") || !this.eat("lines")) return undefined;
      }
      statement = { kind: "show", parts: parts.map((value) => ({ value, quoted: true })) };
    } else if (verb === "put") {
      if (this.eat("each")) {
        if (!this.eat("word") || !this.eat("on")) return undefined;
        const separate = this.eat("a") && (this.eat("new") || this.eat("separate"));
        const own = !separate && this.eat("its") && this.eat("own");
        if (!(separate || own) || !this.eat("line")) return undefined;
        statement = { kind: "layout", mode: "words" };
      } else {
        this.eat("all");
        this.eat("the");
        if (!this.eat("text") || !this.eat("on") || !this.eat("one") || !this.eat("line")) return undefined;
        statement = { kind: "layout", mode: "single-line" };
      }
    } else {
      const target = this.target();
      if (!target) return undefined;
      if (verb === "underline") {
        statement = { kind: "style", target, modifiers: ["underlined"] };
      } else if (verb === "make" || verb === "set") {
        if (verb === "set") this.eat("to");
        const modifiers = this.modifiers();
        if (modifiers) statement = { kind: "style", target, modifiers };
      } else if (verb === "place") {
        if (!(this.eat("at") || this.eat("in"))) return undefined;
        this.eat("the");
        const position = this.take("word");
        if (position !== undefined) statement = { kind: "place", target, position };
      } else if (verb === "move" || verb === "slide") {
        if (this.eat("across")) {
          this.eat("the");
          this.eat("screen");
          if (this.index === this.tokens.length) {
            statement = { kind: "across", target };
          } else {
            const seconds = this.duration();
            if (seconds !== undefined) statement = { kind: "across", target, seconds };
          }
        } else if (this.eat("from")) {
          const from = this.take("word");
          if (!this.eat("to")) return undefined;
          const to = this.take("word");
          const seconds = this.duration();
          if (from !== undefined && to !== undefined && seconds !== undefined) {
            statement = { kind: "move", target, from, to, seconds };
          }
        }
      }
    }
    return this.index === this.tokens.length ? statement : undefined;
  }
}

function displayList(content: string): DisplayText[] | undefined {
  const parts: DisplayText[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index <= content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    const and = /^and\b/i.test(content.slice(index)) &&
      (index === 0 || /\s/.test(content[index - 1]!));
    if (index === content.length || character === "," || and) {
      const value = content.slice(start, index).trim();
      if (!value) return undefined;
      parts.push({ value, quoted: value.startsWith('"') });
      if (character === ",") {
        const conjunction = /^\s*and\b\s*/i.exec(content.slice(index + 1));
        if (conjunction) index += conjunction[0].length;
      } else if (and) {
        index += 2;
      }
      start = index + 1;
    }
  }
  return quoted ? undefined : parts;
}

export function parseVisualStatement(line: string): VisualStatement | undefined {
  const display = /^(?:show|display)\s+(.+)$/i.exec(line.trim());
  if (display) {
    const content = display[1]!;
    const list = /^(?:the words\s+)?(.+?)\s+on\s+separate\s+lines\.?$/i.exec(content);
    if (list) {
      const parts = displayList(list[1]!);
      return parts ? { kind: "show", parts, separateLines: true } : undefined;
    }
    if (!content.startsWith('"')) {
      return { kind: "show", parts: [{ value: content, quoted: false }] };
    }
  }
  const tokens = tokenize(line);
  return tokens ? new SentenceParser(tokens).parse() : undefined;
}
