// Description Interpreter — rule-based, no AI, finite vocabulary.
// Recognises common simple CRUD descriptions and converts them to IntentLang source.
// This is NOT unrestricted natural language processing.

export interface UnsupportedCapability {
  capability: string;
  code: string;
  message: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface InterpretedField {
  entityName: string;
  fieldName: string;
  type: "text" | "integer" | "boolean";
  required: boolean;
  unique: boolean;
  warnings: string[];
}

export interface InterpretProposal {
  kind: "proposal";
  appName: string;
  entityName: string;
  source: string;
  assumptions: string[];
  warnings: string[];
  unsupportedCapabilities: UnsupportedCapability[];
  supportedFieldCount: number;
}

export interface InterpretClarification {
  kind: "clarification";
  questions: ClarificationQuestion[];
  partialAssumptions: string[];
}

export interface InterpretUnrecognized {
  kind: "unrecognized";
  reason: string;
}

export type InterpretResult =
  | InterpretProposal
  | InterpretClarification
  | InterpretUnrecognized;

// ── Known top-level IntentLang keywords (for prose detection) ──────────────────

const TOP_LEVEL_KEYWORDS = [
  "application ",
  "authentication ",
  "role ",
  "a ",
  "an ",
  "each ",
  "action ",
  "allow ",
  "entity ",
  "--",
  "#",
];

/** Returns true if the text looks like a natural-language description, not IntentLang code. */
export function looksLikeProse(source: string): boolean {
  const lines = source.split("\n");
  const firstNonBlank = lines.find((l) => l.trim().length > 0);
  if (!firstNonBlank) return false;
  const trimmed = firstNonBlank.trim();
  // Check if it starts with a known top-level keyword
  for (const kw of TOP_LEVEL_KEYWORDS) {
    if (trimmed.toLowerCase().startsWith(kw.toLowerCase())) return false;
  }
  // If it contains spaces (multiple words) and sentence-like punctuation or 5+ words, it's prose
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount >= 4 || /[,?!;]/.test(trimmed);
}

// ── Field synonym table ───────────────────────────────────────────────────────

interface FieldSynonym {
  type: "text" | "integer" | "boolean";
  required?: boolean;
  unique?: boolean;
  camelName?: string;
  warning?: string;
}

const FIELD_SYNONYMS: Record<string, FieldSynonym> = {
  name: { type: "text", required: true },
  fullname: { type: "text", required: true, camelName: "fullName" },
  "full name": { type: "text", required: true, camelName: "fullName" },
  age: { type: "integer" },
  address: { type: "text" },
  dob: {
    type: "text",
    camelName: "dateOfBirth",
    warning:
      "DOB/date of birth is mapped to a text field — native date type is not yet supported in IntentLang.",
  },
  "date of birth": {
    type: "text",
    camelName: "dateOfBirth",
    warning:
      "Date of birth is mapped to a text field — native date type is not yet supported in IntentLang.",
  },
  birthday: {
    type: "text",
    camelName: "dateOfBirth",
    warning:
      "Birthday/date of birth is mapped to a text field — native date type is not yet supported in IntentLang.",
  },
  birthdate: {
    type: "text",
    camelName: "dateOfBirth",
    warning:
      "Birthdate is mapped to a text field — native date type is not yet supported in IntentLang.",
  },
  email: {
    type: "text",
    warning:
      "Email stored as text. Add unique constraint in IntentLang if needed.",
  },
  active: { type: "boolean" },
  completed: { type: "boolean" },
  done: { type: "boolean" },
  enabled: { type: "boolean" },
  quantity: { type: "integer" },
  count: { type: "integer" },
  amount: { type: "integer" },
  price: {
    type: "text",
    warning:
      "Price/money is stored as text — native currency type is not supported yet.",
  },
  cost: {
    type: "text",
    warning:
      "Cost/money is stored as text — native currency type is not supported yet.",
  },
  salary: {
    type: "text",
    warning:
      "Salary/money is stored as text — native currency type is not supported yet.",
  },
  description: { type: "text" },
  notes: { type: "text" },
  note: { type: "text" },
  title: { type: "text", required: true },
  phone: { type: "text" },
  status: { type: "text" },
  number: { type: "integer" },
  score: { type: "integer" },
  rating: { type: "integer" },
  year: { type: "integer" },
  category: { type: "text" },
  type: { type: "text" },
  label: { type: "text" },
  tag: { type: "text" },
};

// ── Unsupported capability patterns ─────────────────────────────────────────────

const UNSUPPORTED_PATTERNS: Array<{
  pattern: RegExp;
  code: string;
  capability: string;
  message: string;
}> = [
  {
    pattern: /\bsort(?:ing|ed)?\b|\border\s+by\b/i,
    code: "UNSUPPORTED_SORTING",
    capability: "sorting",
    message:
      "Sorting is not supported by IntentLang yet, so it was not added. The data-entry portion can be generated now.",
  },
  {
    pattern: /\bsearch\b|\bfilter\b(?!\s*field)/i,
    code: "UNSUPPORTED_SEARCH",
    capability: "search/filter",
    message: "Search and filter are not yet supported by IntentLang.",
  },
  {
    pattern: /\bdelete\b|\bremov(?:e|ing)\b/i,
    code: "UNSUPPORTED_DELETE",
    capability: "delete",
    message:
      "Delete is supported in IntentLang but the interpreter does not auto-generate it. Write the delete permission rules manually.",
  },
  {
    pattern: /\bupload\b|\battachment\b/i,
    code: "UNSUPPORTED_UPLOAD",
    capability: "file upload",
    message: "File upload is not supported by IntentLang.",
  },
  {
    pattern: /\bemail\s+notification\b|\bsend\s+email\b|\bnotif(?:y|ication)\b/i,
    code: "UNSUPPORTED_EMAIL_NOTIFICATION",
    capability: "email notification",
    message: "Email notifications are not supported by IntentLang.",
  },
];

// ── App/entity intent patterns ────────────────────────────────────────────────

const APP_INTENT_PATTERN =
  /\b(?:build|create|make|develop|design|have|want)\s+(?:a|an)\s+(?:(?:simple|basic|small|new)\s+)?(?:app|application|system|tool|website|web\s*app|program|database|form)\b/i;

// Patterns for "allow(s) users to add/create/enter their fields"
const USERS_ADD_FIELDS_PATTERN =
  /\ballow[s]?\s+(user[s]?|people|person[s]?|member[s]?|customer[s]?|client[s]?)\s+to\s+(?:add|create|enter|input|submit|record|store|manage)\s+(?:their\s+)?(?:own\s+)?(.+)/i;

// ── Field token extraction ─────────────────────────────────────────────────────

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+([a-z])/g, (_, c: string) => (c as string).toUpperCase());
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Normalise a raw token from the user's description to a known synonym key. */
function normaliseToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, " ");
}

interface ParsedField {
  fieldName: string;
  type: "text" | "integer" | "boolean";
  required: boolean;
  unique: boolean;
  warnings: string[];
}

function resolveField(raw: string): ParsedField | null {
  const norm = normaliseToken(raw);

  // Check multi-word synonyms first (longest match)
  for (const key of Object.keys(FIELD_SYNONYMS).sort(
    (a, b) => b.length - a.length
  )) {
    if (norm === key || norm.startsWith(key + " ") || norm.endsWith(" " + key)) {
      const syn = FIELD_SYNONYMS[key]!;
      const fieldName = syn.camelName ?? toCamelCase(key);
      return {
        fieldName,
        type: syn.type,
        required: syn.required ?? false,
        unique: syn.unique ?? false,
        warnings: syn.warning ? [syn.warning] : [],
      };
    }
  }

  // Exact match on first word
  const firstWord = norm.split(/\s+/)[0] ?? norm;
  if (FIELD_SYNONYMS[firstWord]) {
    const syn = FIELD_SYNONYMS[firstWord]!;
    const fieldName = syn.camelName ?? toCamelCase(firstWord);
    return {
      fieldName,
      type: syn.type,
      required: syn.required ?? false,
      unique: syn.unique ?? false,
      warnings: syn.warning ? [syn.warning] : [],
    };
  }

  // Unknown field: skip (don't guess types)
  return null;
}

/** Split a comma-separated field list, tolerating "then" and "and" connectors. */
function splitFieldList(raw: string): string[] {
  // Remove leading "their", "the", "a", "an"
  let clean = raw.replace(/^(?:their|the|a|an)\s+/i, "");
  // Split on commas, "and", "or" at start of segment
  const tokens = clean.split(/,|\bthen\b|\band\b/i);
  return tokens
    .map((t) => t.replace(/^\s*(?:their|the|a|an)\s+/i, "").trim())
    .filter((t) => t.length > 0);
}

// ── Main interpreter ──────────────────────────────────────────────────────────

export function interpretDescription(
  description: string,
  options?: { usersAnswer?: "person" | "auth-user" }
): InterpretResult {
  const desc = description.trim();

  // Step 1: Check for app intent
  if (!APP_INTENT_PATTERN.test(desc)) {
    // Also accept sentences that start with action phrases
    const hasActionPhrase =
      /^(?:I want|I need|I'd like|Create|Build|Make|Design|Add|Allow)/i.test(
        desc
      );
    if (!hasActionPhrase) {
      return {
        kind: "unrecognized",
        reason:
          "Could not detect an app intent. Try starting with: 'I want to build an app that...' or 'Create an app with...'",
      };
    }
  }

  // Step 2: Detect unsupported capabilities in the full description
  const unsupportedCapabilities: UnsupportedCapability[] = [];
  for (const up of UNSUPPORTED_PATTERNS) {
    if (up.pattern.test(desc)) {
      if (!unsupportedCapabilities.some((u) => u.code === up.code)) {
        unsupportedCapabilities.push({
          capability: up.capability,
          code: up.code,
          message: up.message,
        });
        // Reset regex state
        up.pattern.lastIndex = 0;
      }
    }
  }

  // Step 3: Extract field list
  const addMatch = USERS_ADD_FIELDS_PATTERN.exec(desc);
  let rawFieldSegment = "";
  let entityWord = "person";
  let entityIsUsers = false;

  if (addMatch) {
    rawFieldSegment = addMatch[2] ?? "";
    // The entity word is the first capture group
    const entityWordRaw = addMatch[1] ?? "person";
    entityWord = entityWordRaw.toLowerCase().replace(/s$/, "");
    entityIsUsers =
      entityWord === "user" ||
      entityWord === "member";
  } else {
    // Fallback: look for "with [fields]" or "including [fields]" or "fields: ..."
    const withMatch =
      /\bwith\s+(?:fields?:?\s+)?(.+?)(?:\s+and\s+(?:allow|sort|search|filter|delete|upload)|$)/i.exec(
        desc
      );
    if (withMatch) {
      rawFieldSegment = withMatch[1] ?? "";
    } else {
      // Last resort: everything after "add" or "enter" or "create"
      const afterVerb =
        /\b(?:add|enter|create|input|submit|record|store)\b\s+(?:their\s+|the\s+|a\s+)?(.+)/i.exec(
          desc
        );
      if (afterVerb) {
        rawFieldSegment = afterVerb[1] ?? "";
      }
    }
  }

  // Step 4: Determine entity name
  // Default: when "users" is detected, assume Person records (not auth accounts).
  // The proposal includes a clear assumption note. The caller can pass usersAnswer='auth-user'
  // to explicitly request auth-user path.

  // Step 5: Resolve entity and app names
  let entityName: string;
  let appName: string;
  const assumptions: string[] = [];

  if (entityIsUsers && options?.usersAnswer === "auth-user") {
    // Authenticated user path (not generated yet — unsupported by simple interpreter)
    return {
      kind: "unrecognized",
      reason:
        "Authenticated user accounts require authentication blocks in IntentLang. Use the Todo or Issue Tracker template as a starting point.",
    };
  } else if (entityIsUsers) {
    entityName = "Person";
    appName = "People";
    assumptions.push(
      "Interpreted 'users' as Person records, not login accounts. If you want authenticated user accounts, use the Todo template and add authentication."
    );
  } else {
    // Capitalise the entity word
    entityName =
      entityWord.charAt(0).toUpperCase() + entityWord.slice(1).toLowerCase();
    appName = entityName + "s";
    assumptions.push(
      `Interpreted the entity as '${entityName}' (records stored in the app).`
    );
  }

  // Step 6: Parse fields
  const fieldTokens = splitFieldList(rawFieldSegment);
  const parsedFields: ParsedField[] = [];
  const warnings: string[] = [];
  const fieldWarnings: string[] = [];

  for (const token of fieldTokens) {
    // Skip tokens that look like unsupported capability phrases
    let isUnsupported = false;
    for (const up of UNSUPPORTED_PATTERNS) {
      if (up.pattern.test(token)) {
        isUnsupported = true;
        up.pattern.lastIndex = 0;
        break;
      }
    }
    if (isUnsupported) continue;

    const field = resolveField(token);
    if (field) {
      // Deduplicate by fieldName
      if (!parsedFields.some((f) => f.fieldName === field.fieldName)) {
        parsedFields.push(field);
        fieldWarnings.push(...field.warnings);
      }
    }
    // Unknown fields are silently skipped (finite vocabulary)
  }

  warnings.push(...fieldWarnings);

  if (parsedFields.length === 0) {
    return {
      kind: "unrecognized",
      reason:
        "No recognisable fields found. The offline interpreter supports a finite vocabulary: name, age, address, DOB, email, title, status, quantity, description, done, active, completed, and a few others.",
    };
  }

  // Step 7: Build IntentLang source
  const lines: string[] = [`application ${appName}`, ""];
  for (const f of parsedFields) {
    const art1 = articleFor(entityName);
    const requiredPart = f.required ? "required " : "";
    const uniquePart = f.unique ? "unique " : "";
    const art2 = articleFor(f.fieldName);
    lines.push(
      `${art1} ${entityName} has ${art2} ${requiredPart}${uniquePart}${f.fieldName} as ${f.type}`
    );
  }

  const source = lines.join("\n") + "\n";

  return {
    kind: "proposal",
    appName,
    entityName,
    source,
    assumptions,
    warnings,
    unsupportedCapabilities,
    supportedFieldCount: parsedFields.length,
  };
}
