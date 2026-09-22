import { createHash } from "node:crypto";
import type { Diagnostic } from "./model.js";
import { parseVisualStatement, visualGrammarWords } from "./visual-syntax.js";

export const colors: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#dc2626", orange: "#ea580c",
  yellow: "#facc15", green: "#15803d", blue: "#2563eb", purple: "#7c3aed",
  pink: "#db2777", gray: "#64748b", grey: "#64748b", teal: "#0f766e",
  navy: "#172554", "light blue": "#bae6fd", "light gray": "#e2e8f0",
};
export const sizes: Record<string, number> = { small: 24, medium: 40, large: 64, huge: 96 };
export const weights: Record<string, number> = { bold: 700, regular: 400, "not bold": 400 };
export const slants: Record<string, "normal" | "italic"> = { italic: "italic", upright: "normal", "not italic": "normal" };
export const underlines: Record<string, boolean> = {
  underline: true, underlined: true, "not underlined": false, "no underline": false
};
const positions = ["left", "right", "top", "bottom", "center"] as const;
export type VisualPosition = "left" | "right" | "top" | "bottom" | "center";
export interface VisualProgram {
  kind: "visual";
  text: string;
  textColor: string;
  backgroundColor: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  underlined: boolean;
  textLayout: "as-written" | "words" | "single-line";
  position: VisualPosition;
  movement?: {
    from: Exclude<VisualPosition, "center">;
    to: Exclude<VisualPosition, "center">;
    seconds: number;
  };
}
export type VisualCompileResult =
  | { ok: true; ir: VisualProgram; html: string }
  | { ok: false; diagnostics: VisualDiagnostic[] };

export interface VisualSuggestion {
  label: string;
  replacement: string;
}

export interface VisualDiagnostic extends Diagnostic {
  category: "syntax" | "ambiguity" | "typo";
  suggestions?: VisualSuggestion[];
}

export function compileVisualSource(source: string): VisualCompileResult {
  return compileProgram(source, true);
}

function compileProgram(source: string, offerCorrections: boolean): VisualCompileResult {
  const ir: VisualProgram = {
    kind: "visual", text: "", textColor: colors.blue!, backgroundColor: colors.white!,
    fontSize: sizes.medium!, fontWeight: 400, fontStyle: "normal", underlined: false,
    textLayout: "as-written", position: "center"
  };
  const diagnostics: VisualDiagnostic[] = [];
  const seen = new Set<string>();
  const mentionedTargets = new Set<"text" | "background">();
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  function report(index: number, code: string, message: string, hint: string, suggestions?: VisualSuggestion[]): void {
    const original = lines[index] ?? "";
    diagnostics.push({
      code, message, hint, line: index + 1,
      category: code === "V008" ? "ambiguity" : "syntax",
      ...(suggestions ? { suggestions } : {}),
      column: Math.max(1, original.search(/\S/) + 1), length: Math.max(1, original.trim().length)
    });
  }
  function claim(key: string, index: number): boolean {
    if (seen.has(key)) {
      report(index, "V002", `More than one instruction sets ${key}.`,
        "Edit the existing instruction instead of adding a conflicting one.");
      return false;
    }
    seen.add(key);
    return true;
  }
  for (const [index, original] of lines.entries()) {
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    const statement = parseVisualStatement(line);
    if (!statement) {
      report(index, "V001", "This sentence is not part of the visual language.",
        "Try Show Hello world, Make the text large and bold, Put each word on a new line, or Move the text from left to right over 3 seconds.");
      continue;
    }
    if (statement.kind === "show") {
      if (!claim("text", index)) continue;
      const onlyPart = statement.parts.length === 1 ? statement.parts[0] : undefined;
      if (statement.separateLines && onlyPart && !onlyPart.quoted && /\s/.test(onlyPart.value)) {
        report(index, "V008", "The text does not specify where its line breaks should go.",
          "Choose one word per line, keep the phrase together, or separate your intended lines with commas.",
          [
            { label: "One word per line", replacement: `Show ${onlyPart.value}\nPut each word on a new line` },
            { label: "Keep the phrase together", replacement: `Show ${onlyPart.value}` }
          ]);
        continue;
      }
      let parts: unknown[];
      try {
        parts = statement.parts.map((part) => part.quoted ? JSON.parse(part.value) as unknown : part.value);
      } catch {
        report(index, "V003", "The quoted text contains an invalid escape.",
          "You can write Show followed by your text without quotes. For line breaks, add Put each word on a new line.");
        continue;
      }
      if (!parts.every((part): part is string => typeof part === "string" && part.trim().length > 0) ||
          parts.join("\n").length > 2000) {
        report(index, "V003", "Text must contain between 1 and 2000 characters and cannot be blank.",
          "Try: Show Hello, world!");
        continue;
      }
      ir.text = parts.join("\n");
      mentionedTargets.add("text");
      continue;
    }
    if (statement.kind === "layout") {
      if (claim("text layout", index)) ir.textLayout = statement.mode;
      mentionedTargets.add("text");
      continue;
    }

    let target: "text" | "background";
    if (statement.target === "it") {
      const possible: Array<"text" | "background"> =
        statement.kind === "style" && statement.modifiers.every((value) => Object.hasOwn(colors, value))
          ? ["text", "background"] : ["text"];
      const candidates = possible.filter((candidate) => mentionedTargets.has(candidate));
      if (candidates.length !== 1) {
        report(index, "V008",
          candidates.length > 1 ? '"It" could mean the text or the background.' : '"It" does not have a clear earlier target.',
          "Choose the target explicitly. Nothing was changed.",
          (candidates.length ? candidates : possible).map((candidate) => ({
            label: `Use the ${candidate}`, replacement: line.replace(/\bit\b/i, `the ${candidate}`)
          })));
        continue;
      }
      target = candidates[0]!;
    } else {
      target = statement.target;
      mentionedTargets.add(target);
    }

    if (statement.kind === "style") {
      for (const [modifierIndex, value] of statement.modifiers.entries()) {
        const pixels = /^(\d+) pixels$/.exec(value);
        if (target === "text" && value === "normal") {
          const meanings = [
            { modifier: "regular", label: "Normal weight (not bold)" },
            { modifier: "medium", label: "Medium text size" },
            { modifier: "upright", label: "Upright text (not italic)" }
          ];
          report(index, "V008", '"Normal" could describe text weight, size, or slant.',
            "Choose which property you want to set.",
            meanings.map(({ modifier, label }) => ({
              label,
              replacement: `Make the text ${statement.modifiers.map((item, i) => i === modifierIndex ? modifier : item).join(" and ")}.`
            })));
        } else if (target === "text" && (Object.hasOwn(sizes, value) || pixels)) {
          if (!claim("text size", index)) continue;
          const size = pixels ? Number(pixels[1]) : sizes[value]!;
          if (size < 12 || size > 160) {
            report(index, "V004", "Text size must be between 12 and 160 pixels.",
              "Try: Make the text large.");
          } else {
            ir.fontSize = size;
          }
        } else if (target === "text" && Object.hasOwn(weights, value)) {
          if (claim("text weight", index)) ir.fontWeight = weights[value]!;
        } else if (target === "text" && Object.hasOwn(slants, value)) {
          if (claim("text slant", index)) ir.fontStyle = slants[value]!;
        } else if (target === "text" && Object.hasOwn(underlines, value)) {
          if (claim("text underline", index)) ir.underlined = underlines[value]!;
        } else if (Object.hasOwn(colors, value)) {
          if (!claim(`${target} color`, index)) continue;
          if (target === "text") ir.textColor = colors[value]!;
          else ir.backgroundColor = colors[value]!;
        } else {
          report(index, "V004", `Unsupported ${target} style "${value}".`,
            target === "background" ? `Background colors: ${Object.keys(colors).join(", ")}.` :
              `Use a color, small/medium/large/huge, 12 to 160 pixels, bold, regular, italic, upright, underlined, or not underlined. Combine properties with "and" or commas.`);
        }
      }
      continue;
    }
    if (target !== "text") {
      report(index, "V004", "Only the text can be placed or moved.", "Use the text as the target.");
      continue;
    }
    if (statement.kind === "place") {
      const position = statement.position === "middle" ? "center" : statement.position;
      if (isPosition(position)) {
        if (claim("position", index)) ir.position = position;
      } else {
        report(index, "V004", `Unsupported position "${position}".`, "Use left, right, top, bottom, or center.");
      }
      continue;
    }
    const seconds = statement.seconds;
    if (seconds !== undefined && (seconds < 0.1 || seconds > 60)) {
      report(index, "V006", "Movement duration must be between 0.1 and 60 seconds.",
        "Try: Move the text from left to right over 3 seconds.");
      continue;
    }
    if (statement.kind === "across") {
      report(index, "V008", '"Across" does not specify which direction to move.',
        seconds === undefined ? "Choose a direction. These suggestions also propose a 3-second duration, which you can edit." :
          "Choose a direction; your duration is preserved.",
        [["left", "right"], ["right", "left"]].map(([from, to]) => ({
          label: `${from} to ${to}${seconds === undefined ? " (3 seconds)" : ""}`,
          replacement: `Move the text from ${from} to ${to} over ${seconds ?? 3} seconds.`
        })));
      continue;
    }
    const { from, to } = statement;
    if (!isEdge(from) || !isEdge(to)) {
      report(index, "V004", "The movement contains an unknown edge.",
        "Use left to right, right to left, top to bottom, or bottom to top.");
    } else if (({ left: "right", right: "left", top: "bottom", bottom: "top" })[from] !== to) {
      report(index, "V005", "Movement must run between opposite edges.",
        "Use left to right, right to left, top to bottom, or bottom to top.");
    } else if (claim("movement", index)) {
      ir.movement = { from, to, seconds: statement.seconds };
    }
  }
  if (!seen.has("text")) {
    report(0, "V007", "A visual program needs one Show instruction.", "Add: Show Hello, world!");
  }
  if (offerCorrections) {
    const suggestedLines = new Set<number>();
    for (const diagnostic of diagnostics) {
      if (suggestedLines.has(diagnostic.line)) continue;
      if (diagnostic.suggestions) {
        suggestedLines.add(diagnostic.line);
        continue;
      }
      if (diagnostic.code !== "V001" && diagnostic.code !== "V004") continue;
      const replacements = typoCandidates(lines[diagnostic.line - 1]!);
      const suggestions = replacements.filter((replacement) => {
        const amended = [...lines];
        amended[diagnostic.line - 1] = replacement;
        const check = compileProgram(amended.join("\n"), false);
        return check.ok || !check.diagnostics.some((item) => item.line === diagnostic.line);
      }).map((replacement) => ({ label: "Apply spelling suggestion", replacement }));
      if (suggestions.length) {
        diagnostic.category = "typo";
        diagnostic.suggestions = suggestions;
        diagnostic.hint += ` Did you mean: ${suggestions.map((item) => item.replacement).join(" or ")}`;
        suggestedLines.add(diagnostic.line);
      }
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, ir, html: renderVisualProgram(ir) };
}

function isPosition(value: string): value is VisualPosition {
  return positions.some((position) => position === value);
}

function isEdge(value: string): value is Exclude<VisualPosition, "center"> {
  return value !== "center" && isPosition(value);
}

export function oneEditAway(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let index = 0;
  while (index < left.length && left[index] === right[index]) index += 1;
  if (left.length === right.length) {
    return left.slice(index + 1) === right.slice(index + 1) ||
      (left[index] === right[index + 1] && left[index + 1] === right[index] &&
        left.slice(index + 2) === right.slice(index + 2));
  }
  return left.length > right.length
    ? left.slice(index + 1) === right.slice(index)
    : left.slice(index) === right.slice(index + 1);
}

function typoCandidates(line: string): string[] {
  const display = /^(\s*)([a-z]+)(\s+)(.+)$/i.exec(line);
  if (display) {
    const verb = display[2]!.toLowerCase();
    if (verb === "show" || verb === "display") return [];
    const candidates = ["show", "display"].filter((known) => oneEditAway(verb, known));
    if (candidates.length) {
      return candidates.map((candidate) => display[1] + candidate + display[3] + display[4]);
    }
  }
  const words = [...new Set([
    ...visualGrammarWords, ...Object.keys(colors), ...Object.keys(sizes),
    ...Object.keys(weights), ...Object.keys(slants), ...Object.keys(underlines), "normal"
  ].flatMap((phrase) => phrase.split(" ")))];
  const tokens: string[] = line.match(/"(?:[^"\\]|\\.)*"|[a-z]+|[^a-z"]+|"/gi) ?? [];
  if (tokens.includes('"')) return [];
  let candidates = [""];
  let changed = false;
  for (const token of tokens) {
    const word = token.toLowerCase();
    const matches = /^[a-z]{3,}$/i.test(token) && !words.includes(word)
      ? words.filter((known) => oneEditAway(word, known)) : [];
    if (matches.length) changed = true;
    candidates = candidates.flatMap((prefix) => (matches.length ? matches : [token]).map((value) => prefix + value)).slice(0, 6);
  }
  return changed ? candidates : [];
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function positionCss(position: VisualPosition): string {
  switch (position) {
    case "left": return "left:0;top:50%;transform:translate(0,-50%)";
    case "right": return "left:100%;top:50%;transform:translate(-100%,-50%)";
    case "top": return "left:50%;top:0;transform:translate(-50%,0)";
    case "bottom": return "left:50%;top:100%;transform:translate(-50%,-100%)";
    case "center": return "left:50%;top:50%;transform:translate(-50%,-50%)";
  }
}

function renderVisualProgram(ir: VisualProgram): string {
  const motion = ir.movement;
  const text = ir.textLayout === "words" ? ir.text.trim().split(/\s+/).join("\n") :
    ir.textLayout === "single-line" ? ir.text.replace(/\s+/g, " ") : ir.text;
  const css = `
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:${ir.backgroundColor};color:${ir.textColor};font-family:system-ui,sans-serif}
main{position:absolute;inset:24px;overflow:hidden}
#text{position:absolute;margin:0;width:max-content;max-width:100%;max-height:100%;overflow:auto;
white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;font-size:${ir.fontSize}px;line-height:1.2;
font-weight:${ir.fontWeight};font-style:${ir.fontStyle};
text-decoration-line:${ir.underlined ? "underline" : "none"};
${positionCss(motion?.from ?? ir.position)};
${motion ? `animation:travel ${motion.seconds}s linear 1 both` : ""}}
${motion ? `@keyframes travel{from{${positionCss(motion.from)}}to{${positionCss(motion.to)}}}` : ""}
@media(prefers-reduced-motion:reduce){#text{animation:none;${positionCss(ir.position)}}}
`;
  const hash = createHash("sha256").update(css).digest("base64");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${hash}'; base-uri 'none'; form-action 'none'">
<title>IntentLang Visual</title><style>${css}</style></head>
<body><main aria-label="Visual scene"><p id="text">${escapeHtml(text)}</p></main></body></html>
`;
}
