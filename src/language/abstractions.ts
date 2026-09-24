import type { Diagnostic } from "../model.js";

export interface DeclarationExpansion {
  kind: "field-group" | "state-machine";
  source: string;
  sourceLine: number;
  target: string;
  statements: string[];
}

export type DeclarationExpandResult =
  | { ok: true; source: string; expansions: DeclarationExpansion[] }
  | { ok: false; diagnostics: Diagnostic[] };

interface FieldGroup {
  name: string;
  fields: string[];
  line: number;
}

function diagnostic(
  code: string,
  message: string,
  line: number,
  source: string,
  hint: string
): Diagnostic {
  return {
    code,
    message,
    line,
    column: Math.max(1, source.search(/\S/) + 1),
    length: Math.max(1, source.trim().length),
    hint
  };
}

function expandField(entity: string, field: string): string | undefined {
  const match =
    /^([a-z][A-Za-z0-9]*) as ((?:(?:required|unique) )*)(text|integer|boolean)(.*)$/.exec(
      field
    );
  if (!match) return undefined;
  return `a ${entity} has a ${match[2]}${match[1]} as ${match[3]}${match[4]}`;
}

export function expandDeclarationSource(
  source: string
): DeclarationExpandResult {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const output = [...lines];
  const diagnostics: Diagnostic[] = [];
  const fieldGroups = new Map<string, FieldGroup>();
  const expansions: DeclarationExpansion[] = [];
  const generated: string[] = [];
  const machineNames = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const trimmed = raw.trim();
    const groupMatch = /^field group ([A-Z][A-Za-z0-9]*)$/.exec(trimmed);
    if (groupMatch) {
      const name = groupMatch[1]!;
      const fields: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && /^\s{2}\S/.test(lines[cursor]!)) {
        fields.push(lines[cursor]!.trim());
        output[cursor] = "";
        cursor += 1;
      }
      if (fieldGroups.has(name)) {
        diagnostics.push(
          diagnostic("E057", `Field group "${name}" is already declared.`, index + 1, raw, "Field group names must be unique.")
        );
      } else if (fields.length === 0) {
        diagnostics.push(
          diagnostic("E058", `Field group "${name}" has no fields.`, index + 1, raw, "Add at least one indented field declaration.")
        );
      } else {
        const invalid = fields.find((field) => !expandField("Entity", field));
        if (invalid) {
          diagnostics.push(
            diagnostic("E060", `Field group "${name}" contains invalid field "${invalid}".`, index + 1, raw, 'Use "<name> as [required] [unique] <text|integer|boolean> ...".')
          );
        } else {
          fieldGroups.set(name, { name, fields, line: index + 1 });
        }
      }
      output[index] = "";
      index = cursor - 1;
      continue;
    }

    const applyMatch =
      /^apply fields ([A-Z][A-Za-z0-9]*) to ([A-Z][A-Za-z0-9]*)$/.exec(
        trimmed
      );
    if (applyMatch) {
      const group = fieldGroups.get(applyMatch[1]!);
      if (!group) {
        diagnostics.push(
          diagnostic("E059", `Field group "${applyMatch[1]}" is not declared.`, index + 1, raw, "Declare the field group before applying it.")
        );
      } else {
        const statements = group.fields.map((field) =>
          expandField(applyMatch[2]!, field)
        ) as string[];
        generated.push(...statements);
        expansions.push({
          kind: "field-group",
          source: group.name,
          sourceLine: index + 1,
          target: applyMatch[2]!,
          statements
        });
      }
      output[index] = "";
      continue;
    }

    const machineMatch =
      /^state machine ([A-Z][A-Za-z0-9]*) for ([A-Z][A-Za-z0-9]*) using ([a-z][A-Za-z0-9]*)$/.exec(
        trimmed
      );
    if (!machineMatch) continue;

    const [, machineName, entity, stateField] = machineMatch;
    const statements: string[] = [];
    const transitionNames = new Set<string>();
    let transitionDiagnostic = false;
    let cursor = index + 1;
    while (cursor < lines.length && /^\s{2}transition /.test(lines[cursor]!)) {
      const transitionLine = lines[cursor]!;
      const transition =
        /^\s{2}transition ([a-z][a-z0-9]*)$/.exec(transitionLine);
      if (!transition) break;
      const transitionName = transition[1]!;
      const body: string[] = [];
      output[cursor] = "";
      cursor += 1;
      while (
        cursor < lines.length &&
        /^\s{4}(?:require|set) /.test(lines[cursor]!)
      ) {
        body.push(lines[cursor]!.trim());
        output[cursor] = "";
        cursor += 1;
      }
      const hasRequire = body.some((line) => line.startsWith("require "));
      const setsState = body.some((line) =>
        line.startsWith(`set ${stateField} to `)
      );
      if (transitionNames.has(transitionName)) {
        transitionDiagnostic = true;
        diagnostics.push(
          diagnostic("E063", `State machine "${machineName}" repeats transition "${transitionName}".`, index + 1, raw, "Transition names must be unique within a state machine.")
        );
      } else if (!hasRequire || !setsState) {
        transitionDiagnostic = true;
        diagnostics.push(
          diagnostic("E062", `Transition "${transitionName}" must declare a precondition and set state field "${stateField}".`, index + 1, raw, "Add at least one require line and a set line for the state field.")
        );
      } else {
        transitionNames.add(transitionName);
        statements.push(
          `action ${transitionName} a ${entity}`,
          ...body.map((line) => `  ${line}`)
        );
      }
      while (cursor < lines.length && lines[cursor]!.trim() === "") {
        output[cursor] = "";
        cursor += 1;
      }
    }
    if (machineNames.has(machineName!)) {
      diagnostics.push(
        diagnostic("E061", `State machine "${machineName}" is already declared.`, index + 1, raw, "State machine names must be unique.")
      );
    } else if (statements.length === 0 && !transitionDiagnostic) {
      diagnostics.push(
        diagnostic("E062", `State machine "${machineName}" has no valid transitions.`, index + 1, raw, "Add at least one indented transition.")
      );
    } else {
      machineNames.add(machineName!);
      generated.push(...statements, "");
      expansions.push({
        kind: "state-machine",
        source: machineName!,
        sourceLine: index + 1,
        target: entity!,
        statements
      });
    }
    output[index] = "";
    index = cursor - 1;
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return {
    ok: true,
    source: [...output, ...generated].join("\n"),
    expansions
  };
}
