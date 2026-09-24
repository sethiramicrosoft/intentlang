# Reviewed Intent Resolution

## INTENT-RESOLUTION-001

Requirement text is not executable source. Intent resolution has three
deterministic outcomes:

1. `clarification` — unresolved decisions are returned as categorized,
   stable-ID questions with finite options;
2. `proposal` — all required answers are present and the proposed canonical
   source compiles without diagnostics; or
3. `unrecognized` — the maintained concept vocabulary cannot safely describe
   the request.

Clarification categories are:

- `security`: identity and authentication authority;
- `ownership`: record visibility and mutation scope;
- `workflow`: states, transitions, and invalid-transition behavior;
- `type`: field representation and validation;
- `default`: implicit initial values;
- `failure-mode`: unsupported or external side effects.

A proposal includes the original reviewed assumptions, canonical source, data,
security, workflow, and side-effect explanations, and a deterministic
confirmation fingerprint. Confirmation records bind that fingerprint to the
reviewed answers and canonical source. Neither optional AI output nor raw prose
may bypass this contract.
