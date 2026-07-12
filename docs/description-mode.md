# Describe App Mode — Offline Interpreter

Studio's **Describe App** mode offers an offline, rule-based interpreter for converting plain-English descriptions into IntentLang source. This is **not** unrestricted natural language processing. The interpreter uses a finite vocabulary and finite patterns.

## When to use Describe App mode

- You are starting a new app and want a quick scaffold.
- You know roughly what entities and fields you need but do not know IntentLang grammar yet.
- You do not have an AI provider configured.

## Supported patterns

### App intent phrases (at least one required)

The description must contain a recognisable intent phrase:

```
I want to build an app that...
I want to create an app...
Build an app with...
Create an app that allows...
Make a simple app...
```

### Entity detection

When the description says `allows users to add their [fields]`, the interpreter defaults to:
- Entity name: `Person`
- App name: `People`
- Assumption: *"Interpreted 'users' as Person records, not login accounts."*

If you want authenticated user accounts (login required), use the **Todo** template as a starting point and adapt it manually.

### Supported field synonyms

| You write | Field name generated | Type | Notes |
|---|---|---|---|
| `name` | `name` | `text` (required) | |
| `age` | `age` | `integer` | |
| `address` | `address` | `text` | |
| `dob`, `date of birth`, `birthday`, `birthdate` | `dateOfBirth` | `text` | ⚠ Native date type not yet supported |
| `email` | `email` | `text` | ⚠ Unique constraint must be added manually if needed |
| `title` | `title` | `text` (required) | |
| `description`, `notes`, `note` | as-is | `text` | |
| `status`, `category`, `type`, `label`, `tag` | as-is | `text` | |
| `phone` | `phone` | `text` | |
| `quantity`, `count`, `amount`, `number`, `score`, `rating`, `year` | as-is | `integer` | |
| `active`, `done`, `completed`, `enabled` | as-is | `boolean` | |
| `price`, `cost`, `salary` | as-is | `text` | ⚠ Native money type not yet supported |

Fields not in this table are silently skipped. The interpreter will never guess an unknown field's type.

## Unsupported capabilities (listed, never silently omitted)

The following capabilities are recognised but not generated:

| Keyword detected | Code | Explanation |
|---|---|---|
| `sort`, `sorting`, `order by` | `UNSUPPORTED_SORTING` | Sorting is not yet supported by IntentLang. |
| `search`, `filter` | `UNSUPPORTED_SEARCH` | Search/filter are not yet supported. |
| `delete`, `remove` | `UNSUPPORTED_DELETE` | Delete rules require manual IntentLang statements. |
| `upload`, `attachment` | `UNSUPPORTED_UPLOAD` | File upload is not supported. |
| `email notification`, `notify` | `UNSUPPORTED_EMAIL_NOTIFICATION` | Notifications are not supported. |

When unsupported capabilities are detected, you must explicitly acknowledge them before the **Apply supported source to Editor** button is enabled. This prevents accidentally treating a partial result as a complete one.

## Worked example

**Input:**
```
I want to build an app that just allows users to add their name, age, address, DOB, then allow sorting
```

**Interpreter output:**

```intent
application People

a Person has a required name as text
a Person has an age as integer
a Person has an address as text
a Person has a dateOfBirth as text
```

**Assumptions:**
- Interpreted 'users' as Person records, not login accounts.

**Warnings:**
- DOB/date of birth is mapped to a text field — native date type is not yet supported in IntentLang.

**Not generated yet:**
- `UNSUPPORTED_SORTING`: Sorting is not supported by IntentLang yet, so it was not added. The data-entry portion can be generated now.

**Roadmap notes:**
- Native date type support is planned but not yet scoped.
- Sorting/ordering of records is a planned feature (`UNSUPPORTED_SORTING`). Track it in the issue tracker.

## Honest limitations

- The interpreter does NOT support: relationships between entities, authentication, roles, permissions, actions, or multi-entity descriptions.
- All proposals compile successfully before being offered to the user. An invalid proposal is a bug.
- The interpreter never adds authentication, roles, or permissions silently. Auth apps require manual IntentLang authoring or the AI path.
- Ambiguous cases (where interpretation changes semantics) show an assumption card explaining the choice. The offline interpreter always makes a deterministic choice — it does not ask clarifying questions before returning a proposal.

## After applying the proposal

1. Review the proposed source in the editor.
2. Save the file explicitly (**Save** button or `Ctrl+S`).
3. Generate the app explicitly (**Generate App**).

Applying a proposal does not save the file and does not generate an app. These are always separate, explicit steps.
