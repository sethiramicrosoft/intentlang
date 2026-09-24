import type {
  ActionIr,
  FieldDefault,
  PreconditionOperator
} from "../model.js";

export type WorkflowRecord = Record<string, FieldDefault>;

export interface WorkflowResult {
  ok: boolean;
  record: WorkflowRecord;
  failedMessage?: string;
}

function compare(
  left: FieldDefault,
  operator: PreconditionOperator,
  right: FieldDefault
): boolean {
  switch (operator) {
    case "is":
      return left === right;
    case "is not":
      return left !== right;
    case "is greater than":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "is at least":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "is less than":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "is at most":
      return typeof left === "number" && typeof right === "number" && left <= right;
  }
}

export function applyWorkflowAction(
  action: ActionIr,
  record: WorkflowRecord
): WorkflowResult {
  for (const precondition of action.preconditions) {
    const current = record[precondition.fieldName];
    if (
      current === undefined ||
      !compare(current, precondition.operator, precondition.value)
    ) {
      return {
        ok: false,
        record: { ...record },
        failedMessage: precondition.message
      };
    }
  }

  const next = { ...record };
  for (const assignment of action.assignments) {
    next[assignment.fieldName] = assignment.value;
  }
  return { ok: true, record: next };
}
