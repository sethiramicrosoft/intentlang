import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:4387";
const adminEmail = process.env.LAUNCHOPS_ADMIN_EMAIL;
const adminPassword = process.env.LAUNCHOPS_ADMIN_PASSWORD;
const contributorPassword = process.env.LAUNCHOPS_CONTRIBUTOR_PASSWORD;
const executivePassword = process.env.LAUNCHOPS_EXECUTIVE_PASSWORD;
if (!adminEmail || !adminPassword || !contributorPassword || !executivePassword) {
  throw new Error("Set LAUNCHOPS_ADMIN_EMAIL, LAUNCHOPS_ADMIN_PASSWORD, LAUNCHOPS_CONTRIBUTOR_PASSWORD, and LAUNCHOPS_EXECUTIVE_PASSWORD.");
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function login(email, password) {
  await page.goto(baseUrl);
  const loginForm = page.locator("#auth-login-form");
  await loginForm.getByLabel("Email", { exact: true }).fill(email);
  await loginForm.getByLabel("Password", { exact: true }).fill(password);
  await loginForm.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("#app-root:not(.hidden)").waitFor();
}

async function logout() {
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.locator("#auth-login-card:not(.hidden)").waitFor();
}

async function openEntity(name) {
  await page.locator("#entity-nav").getByRole("button", { name, exact: true }).click();
  await page.locator("#entity-heading").filter({ hasText: name }).waitFor();
  await page.waitForFunction(() => document.querySelector("#page-status")?.textContent !== "Loading…");
}

async function createRecord(entity, values, relationships = {}) {
  await openEntity(entity);
  const recordLabel = String(Object.values(values)[0]);
  if (await page.locator("#entity-table tbody").getByText(recordLabel, { exact: true }).count()) return;
  await page.getByRole("button", { name: `New ${entity}`, exact: true }).click();
  await page.locator("#entity-dialog[open]").waitFor();
  for (const [label, value] of Object.entries(values)) {
    const control = page.getByLabel(label, { exact: true });
    if (typeof value === "boolean") {
      if (value) await control.check();
      else await control.uncheck();
    } else {
      await control.fill(String(value));
    }
  }
  for (const [label, option] of Object.entries(relationships)) {
    await page.getByLabel(label, { exact: true }).selectOption({ label: option });
  }
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await Promise.race([
    page.locator("#entity-dialog").waitFor({ state: "hidden" }),
    page.locator("#entity-error").filter({ hasText: /\S/ }).waitFor().then(async () => {
      throw new Error(`${entity} create failed: ${await page.locator("#entity-error").textContent()}`);
    })
  ]);
}

async function runAction(entity, action, recordLabel, completedState) {
  await openEntity(entity);
  const row = page.locator("#entity-table tbody tr").filter({ hasText: recordLabel });
  if (completedState && await row.getByText(completedState, { exact: true }).count()) return;
  await page.getByRole("button", { name: `${action} ${recordLabel}`, exact: true }).click();
  await page.locator("#action-dialog[open]").waitFor();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.locator("#action-dialog").waitFor({ state: "hidden" });
}

async function provision(name, email, password, role) {
  await openEntity("User");
  if (await page.locator("#entity-table tbody").getByText(email, { exact: true }).count()) return;
  const provisionForm = page.locator("#provision-form");
  await provisionForm.getByLabel("Name", { exact: true }).fill(name);
  await provisionForm.getByLabel("Email", { exact: true }).fill(email);
  await provisionForm.getByLabel("Temporary password", { exact: true }).fill(password);
  await provisionForm.getByLabel("Role", { exact: true }).selectOption({ label: role });
  await provisionForm.getByRole("button", { name: "Provision", exact: true }).click();
  const status = page.locator("#provision-error");
  await status.filter({ hasText: /Account provisioned|already in use/ }).waitFor();
}

await login(adminEmail, adminPassword);

await provision("Maya Contributor", "maya@launchops.local", contributorPassword, "Contributor");
await provision("Elena Executive", "elena@launchops.local", executivePassword, "Executive");

await createRecord("Program", {
  "code (required)": "NOVA",
  "name (required)": "Nova Customer Launch",
  "summary": "Coordinate product, security, operations, enablement, and executive go-live decisions.",
  "healthScore": "82"
});

await createRecord("Milestone", {
  "title (required)": "Public beta readiness",
  "targetDate": "2026-11-15",
  "progress": "64"
}, {
  "program (required)": "NOVA"
});

await createRecord("WorkItem", {
  "title (required)": "Complete production security review",
  "details": "Close threat-model findings, validate abuse controls, and publish the launch exception register.",
  "priority": "critical",
  "estimate": "8"
}, {
  "program (required)": "NOVA",
  "milestone (required)": "Public beta readiness",
  "owner (required)": "LaunchOps Administrator"
});

await createRecord("Risk", {
  "title (required)": "Vendor API rate limits",
  "impact": "high",
  "probability": "medium",
  "mitigation": "Enable queue backpressure, reserve burst capacity, and prepare degraded-mode fallbacks."
}, {
  "program (required)": "NOVA",
  "owner (required)": "LaunchOps Administrator"
});

await createRecord("Decision", {
  "title (required)": "Approve November public beta window",
  "context": "Security review is in progress; enablement and support readiness are on track.",
  "outcome": "Pending executive approval after the final risk review."
}, {
  "program (required)": "NOVA",
  "owner (required)": "LaunchOps Administrator"
});

await createRecord("Update", {
  "headline (required)": "Launch readiness checkpoint",
  "details": "Milestone is 64 percent complete. One high-impact external dependency remains escalated.",
  "health": "amber"
}, {
  "program (required)": "NOVA",
  "owner (required)": "LaunchOps Administrator"
});

await runAction("Program", "activate", "NOVA", "active");
await runAction("Milestone", "start", "Public beta readiness", "active");
await runAction("WorkItem", "start", "Complete production security review", "in-progress");
await runAction("Risk", "escalate", "Vendor API rate limits", "escalated");
await runAction("Update", "publish", "Launch readiness checkpoint", "published");

await openEntity("Program");
await page.screenshot({ path: "examples/launch-ops-admin.png", fullPage: true });

await openEntity("Risk");
await page.screenshot({ path: "examples/launch-ops-risk.png", fullPage: true });

await logout();
await login("maya@launchops.local", contributorPassword);

await createRecord("WorkItem", {
  "title (required)": "Finalize customer onboarding guide",
  "details": "Document first-run setup, troubleshooting, and the escalation path for beta customers.",
  "priority": "high",
  "estimate": "5"
}, {
  "program (required)": "NOVA",
  "milestone (required)": "Public beta readiness"
});
await runAction("WorkItem", "start", "Finalize customer onboarding guide", "in-progress");
await openEntity("WorkItem");
await page.screenshot({ path: "examples/launch-ops-contributor.png", fullPage: true });

await openEntity("User");
if (await page.locator("#entity-table tbody tr").count() !== 1) {
  throw new Error("Contributor should see only their own User record");
}

await logout();
await login("elena@launchops.local", executivePassword);
await openEntity("Decision");
if (await page.getByRole("button", { name: "New Decision", exact: true }).count()) {
  throw new Error("Executive should not see a create-decision control");
}
const decisionRow = page.locator("#entity-table tbody tr").filter({ hasText: "Approve November public beta window" });
if (!await decisionRow.getByText("approved", { exact: true }).count()) {
  await page.getByRole("button", { name: "approve Approve November public beta window", exact: true }).click();
  await page.locator("#action-dialog[open]").waitFor();
  await page.screenshot({ path: "examples/launch-ops-executive-approval.png", fullPage: true });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.locator("#action-dialog").waitFor({ state: "hidden" });
}
await page.screenshot({ path: "examples/launch-ops-executive.png", fullPage: true });

const decisionStatus = await page.locator("#entity-table tbody tr").first().locator("td").nth(3).textContent();
if (decisionStatus !== "approved") throw new Error(`Expected approved decision, got ${decisionStatus}`);
if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

console.log("LaunchOps walkthrough completed with zero browser errors.");
await browser.close();
