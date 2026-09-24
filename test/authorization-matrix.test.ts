import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { authorizeOperation } from "../src/language/authorization.js";
import type { PermissionOperation } from "../src/model.js";

test("LaunchOps authorization matrix is exhaustive and default deny", async () => {
  const source = await readFile("examples/launch-ops.intent", "utf8");
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const ir = result.ir;
  const operations: PermissionOperation[] = [
    "create",
    "read",
    "update",
    "run",
    "provision"
  ];

  for (const role of ir.roles) {
    const subject = { identityId: "user-1", roleId: role.id };
    for (const entity of ir.entities) {
      for (const operation of operations) {
        const actions =
          operation === "run"
            ? ir.actions.filter((action) => action.entityId === entity.id)
            : [undefined];
        for (const action of actions) {
          const unowned = authorizeOperation(
            ir,
            subject,
            operation,
            operation === "provision" ? "" : entity.id,
            action?.id,
            { id: "record-1", owner_id: "user-2" }
          );
          const candidates = ir.permissions.filter(
            (permission) =>
              permission.roleId === role.id &&
              permission.operation === operation &&
              permission.entityId ===
                (operation === "provision" ? "" : entity.id) &&
              (operation !== "run" || permission.actionId === action?.id)
          );
          const hasUnscoped = candidates.some(
            (permission) =>
              !permission.scope || permission.scope.kind === "force-owner"
          );
          assert.equal(
            unowned.allowed,
            hasUnscoped,
            `${role.name} ${operation} ${entity.name} ${action?.name ?? ""}`
          );
        }
      }
    }
  }

  assert.equal(
    authorizeOperation(ir, undefined, "read", ir.entities[0]!.id).allowed,
    false
  );
  assert.equal(
    authorizeOperation(
      ir,
      { identityId: "user-1", roleId: "unknown-role" },
      "read",
      ir.entities[0]!.id
    ).allowed,
    false
  );
});

test("owner and self scopes allow only the authenticated identity", () => {
  const result = compileSource(`application Scoped
authentication uses User identified by email
role Member
a User has a required unique email as text
a Task has a required title as text
each Task belongs to a User as owner on delete restrict
allow Member to read User where self
allow Member to read Task where owner is self
allow Member to create Task with owner as self
`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const subject = { identityId: "user-1", roleId: "member" };
  assert.equal(
    authorizeOperation(result.ir, subject, "read", "user", undefined, {
      id: "user-1"
    }).allowed,
    true
  );
  assert.equal(
    authorizeOperation(result.ir, subject, "read", "user", undefined, {
      id: "user-2"
    }).allowed,
    false
  );
  assert.equal(
    authorizeOperation(result.ir, subject, "read", "task", undefined, {
      id: "task-1",
      owner_id: "user-1"
    }).allowed,
    true
  );
  assert.equal(
    authorizeOperation(result.ir, subject, "read", "task", undefined, {
      id: "task-1",
      owner_id: "user-2"
    }).allowed,
    false
  );
  const create = authorizeOperation(result.ir, subject, "create", "task");
  assert.equal(create.allowed, true);
  assert.equal(create.forceOwner, true);
});
