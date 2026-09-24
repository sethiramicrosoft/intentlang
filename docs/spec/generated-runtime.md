# Generated Runtime Guarantees

## RUNTIME-GENERATION-001

For a valid business `ProgramIr`, generation produces synchronized database,
backend, frontend, and manifest artifacts.

The generated database preserves scalar types, required fields, uniqueness,
relationships, and delete behavior. The backend exposes the declared CRUD and
action operations while enforcing authentication and authorization
server-side. Client-side visibility is not an authorization boundary.

Mutations use transactions and idempotency keys. Updates and actions enforce
optimistic concurrency. Action preconditions are evaluated in the same
transaction as their assignments. Generated authentication stores password
hashes and session-token hashes rather than plaintext credentials.

Security-relevant successes and failures are audit logged without passwords,
session tokens, or CSRF tokens. Generated web output applies a restrictive
content security policy and escapes or validates source-controlled values
before using them in HTML, CSS, JavaScript, SQL, paths, or URLs.

Generation is deterministic for the same canonical IR and generator version.
Changing any of these obligations requires compatibility classification,
updated conformance evidence, and a reviewed language proposal.
