export type PageStatement =
  | { kind: "add"; element: string; name: string; parent?: string }
  | { kind: "set"; property: string; target: string; value: string; scope?: "style" | "attribute" }
  | { kind: "put"; target: string; parent: string }
  | { kind: "make"; phrase: string }
  | { kind: "underline"; target: string }
  | { kind: "show"; source: string }
  | { kind: "when"; target: string; body: string }
  | { kind: "onload"; body: string }
  | { kind: "onchange"; target: string; body: string }
  | { kind: "onenter"; target: string; body: string };

export function usesPageGrammar(source: string): boolean {
  return source.split(/\r?\n/).some((line) =>
    /^\s*(?:add|create)\b/i.test(line) ||
    /^\s*set\s+.+?\s+of\s+.+?\s+to\b/i.test(line) ||
    /^\s*put\s+.+?\s+inside\b/i.test(line) ||
    /^\s*when\s+.+?\s+is\s+clicked\s*,/i.test(line) ||
    /^\s*when\s+the\s+page\s+loads\s*,/i.test(line) ||
    /^\s*when\s+.+?\s+changes\s*,/i.test(line) ||
    /^\s*when\s+enter\s+is\s+pressed\s+in\s+.+?,/i.test(line));
}

export function parsePageStatement(line: string): PageStatement | undefined {
  const source = line.trim();
  const control = source.replace(/\.$/, "");
  const add = /^(?:add|create)\s+(?:(?:a|an|the)\s+)?(.+?)\s+(?:called|named)\s+(.+?)(?:\s+inside\s+(.+))?$/i.exec(control);
  if (add) return { kind: "add", element: add[1]!, name: add[2]!, ...(add[3] ? { parent: add[3] } : {}) };
  const set = /^set\s+(?:the\s+)?(?:(style|attribute)\s+)?(.+?)\s+of\s+(.+?)\s+to\s+(.+)$/i.exec(source);
  if (set) return {
    kind: "set", property: set[2]!, target: set[3]!, value: set[4]!,
    ...(set[1] ? { scope: set[1].toLowerCase() === "style" ? "style" : "attribute" } : {})
  };
  const put = /^put\s+(.+?)\s+inside\s+(.+)$/i.exec(control);
  if (put) return { kind: "put", target: put[1]!, parent: put[2]! };
  const make = /^make\s+(.+)$/i.exec(control);
  if (make) return { kind: "make", phrase: make[1]! };
  const underline = /^underline\s+(.+)$/i.exec(control);
  if (underline) return { kind: "underline", target: underline[1]! };
  if (/^(show|display)\s+/i.test(source)) return { kind: "show", source };
  // Checked before the plain "When ... is clicked, ..." pattern, since "the page" would
  // otherwise be read (and fail) as a clickable element name.
  const onload = /^when\s+the\s+page\s+loads\s*,\s*(.+?)\.?$/i.exec(control);
  if (onload) return { kind: "onload", body: onload[1]! };
  // Checked before the plain "is clicked" pattern too, since "the <name> changes" is a
  // distinct trigger, not a click.
  const onchange = /^when\s+(?:the\s+)?(.+?)\s+changes\s*,\s*(.+?)\.?$/i.exec(control);
  if (onchange) return { kind: "onchange", target: onchange[1]!, body: onchange[2]! };
  // Checked before the plain "is clicked" pattern too, since "Enter is pressed in <name>" is
  // a keyboard trigger, not a click -- most useful for submitting a single-field form without
  // requiring a visible button, while still being fully keyboard/screen-reader operable (the
  // browser's own native Enter-in-a-text-field behavior, not a custom key-trap).
  const onenter = /^when\s+enter\s+is\s+pressed\s+in\s+(.+?)\s*,\s*(.+?)\.?$/i.exec(control);
  if (onenter) return { kind: "onenter", target: onenter[1]!, body: onenter[2]! };
  const when = /^when\s+(?:the\s+)?(.+?)\s+is\s+clicked\s*,\s*(.+?)\.?$/i.exec(source);
  if (when) return { kind: "when", target: when[1]!, body: when[2]! };
  return undefined;
}

