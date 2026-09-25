import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:4392";
const adminEmail = process.env.GRID_ADMIN_EMAIL;
const adminPassword = process.env.GRID_ADMIN_PASSWORD;
const fieldPassword = process.env.GRID_FIELD_PASSWORD;
const executivePassword = process.env.GRID_EXECUTIVE_PASSWORD;
if (!adminEmail || !adminPassword || !fieldPassword || !executivePassword) {
  throw new Error(
    "Set GRID_ADMIN_EMAIL, GRID_ADMIN_PASSWORD, GRID_FIELD_PASSWORD, and GRID_EXECUTIVE_PASSWORD."
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 1050 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function login(email, password) {
  await page.goto(baseUrl);
  const form = page.locator("#auth-login-form");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("#app-root:not(.hidden)").waitFor();
}

async function logout() {
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.locator("#auth-login-card:not(.hidden)").waitFor();
}

async function enableDarkTheme() {
  const theme = await page.locator("html").getAttribute("data-theme");
  if (theme !== "dark") {
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
  }
}

async function openEntity(name) {
  await page
    .locator("#entity-nav")
    .getByRole("button", { name, exact: true })
    .click();
  await page.locator("#entity-heading").filter({ hasText: name }).waitFor();
  await page.waitForFunction(
    () => document.querySelector("#page-status")?.textContent !== "Loading…"
  );
}

async function createRecord(entity, values, relationships = {}) {
  await openEntity(entity);
  const label = String(Object.values(values)[0]);
  if (
    await page
      .locator("#entity-table tbody")
      .getByText(label, { exact: true })
      .count()
  ) {
    return;
  }
  await page.getByRole("button", { name: `New ${entity}`, exact: true }).click();
  await page.locator("#entity-dialog[open]").waitFor();
  for (const [field, value] of Object.entries(values)) {
    const control = page.getByLabel(field, { exact: true });
    if (typeof value === "boolean") {
      if (value) await control.check();
      else await control.uncheck();
    } else {
      await control.fill(String(value));
    }
  }
  for (const [field, option] of Object.entries(relationships)) {
    await page.getByLabel(field, { exact: true }).selectOption({ label: option });
  }
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await Promise.race([
    page.locator("#entity-dialog").waitFor({ state: "hidden" }),
    page
      .locator("#entity-error")
      .filter({ hasText: /\S/ })
      .waitFor()
      .then(async () => {
        throw new Error(
          `${entity} create failed: ${await page
            .locator("#entity-error")
            .textContent()}`
        );
      })
  ]);
}

async function runAction(entity, action, label, completedState) {
  await openEntity(entity);
  const row = page.locator("#entity-table tbody tr").filter({ hasText: label });
  const headers = await page.locator("#entity-table thead th").allTextContents();
  const statusIndex = headers.indexOf("status");
  if (statusIndex < 0) throw new Error(`${entity} has no status column.`);
  const statusCell = row.locator("td").nth(statusIndex);
  const completedStates = Array.isArray(completedState)
    ? completedState
    : [completedState];
  for (const state of completedStates.filter(Boolean)) {
    if (await statusCell.getByText(state, { exact: true }).count()) return;
  }
  await page
    .getByRole("button", { name: `${action} ${label}`, exact: true })
    .click();
  await page.locator("#action-dialog[open]").waitFor();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/actions/${action}`)
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(
      `${entity} ${action} failed with ${response.status()}: ${await response.text()}`
    );
  }
  await page.locator("#action-dialog").waitFor({ state: "hidden" });
  await openEntity(entity);
  const expectedState = completedStates.filter(Boolean)[0];
  if (expectedState) {
    const refreshedRow = page
      .locator("#entity-table tbody tr")
      .filter({ hasText: label });
    const refreshedHeaders = await page
      .locator("#entity-table thead th")
      .allTextContents();
    await refreshedRow
      .locator("td")
      .nth(refreshedHeaders.indexOf("status"))
      .getByText(expectedState, { exact: true })
      .waitFor();
  }
}

async function provision(name, email, password, role) {
  await openEntity("User");
  if (
    await page
      .locator("#entity-table tbody")
      .getByText(email, { exact: true })
      .count()
  ) {
    return;
  }
  const form = page.locator("#provision-form");
  await form.getByLabel("Name", { exact: true }).fill(name);
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Temporary password", { exact: true }).fill(password);
  await form.getByLabel("Role", { exact: true }).selectOption({ label: role });
  await form.getByRole("button", { name: "Provision", exact: true }).click();
  await page
    .locator("#provision-error")
    .filter({ hasText: /Account provisioned|already in use/ })
    .waitFor();
}

await login(adminEmail, adminPassword);
await provision(
  "Noah Field Lead",
  "noah@gridshield.local",
  fieldPassword,
  "FieldLead"
);
await provision(
  "Priya Executive",
  "priya@gridshield.local",
  executivePassword,
  "Executive"
);
await logout();
await login(adminEmail, adminPassword);
await enableDarkTheme();

await createRecord("GridRegion", {
  "code (required)": "EAST-STORM",
  "name (required)": "Eastern Storm Restoration",
  weatherState: "severe wind and flooding",
  restorationPercent: "18"
});

await createRecord(
  "Substation",
  {
    "code (required)": "RIV-12",
    "name (required)": "Riverbend Primary Substation",
    municipality: "Riverbend",
    customersServed: "42800",
    loadPercent: "87"
  },
  {
    "region (required)": "EAST-STORM",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "Outage",
  {
    "incidentCode (required)": "OUT-2609",
    "title (required)": "Riverbend transmission fault",
    cause: "Windborne debris damaged the incoming transmission structure.",
    affectedCustomers: "42800",
    priority: "critical"
  },
  {
    "region (required)": "EAST-STORM",
    "substation (required)": "RIV-12",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "Crew",
  {
    "callSign (required)": "FALCON-7",
    "name (required)": "High Voltage Response Crew",
    specialty: "Transmission isolation and mobile transformer deployment",
    members: "8"
  },
  {
    "region (required)": "EAST-STORM",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "WorkOrder",
  {
    "orderCode (required)": "WO-1042",
    "title (required)": "Isolate damaged transmission bay",
    location: "Riverbend Primary - Bay 3",
    priority: "critical",
    estimatedMinutes: "120"
  },
  {
    "outage (required)": "OUT-2609",
    "crew (required)": "FALCON-7",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "SafetyPermit",
  {
    "permitCode (required)": "SP-883",
    "scope (required)":
      "Isolate Bay 3, prove dead, apply earths, and establish the controlled work zone.",
    hazardClass: "high-voltage electrical",
    isolationPoint: "RIV-12 incoming bay 3"
  },
  {
    "workOrder (required)": "WO-1042",
    "substation (required)": "RIV-12",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "CustomerImpact",
  {
    "area (required)": "Riverbend East and Central",
    affectedCustomers: "42800",
    criticalSites: "14",
    estimatedRestoreTime: "2026-09-25 18:30"
  },
  {
    "outage (required)": "OUT-2609",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "RestorationPlan",
  {
    "title (required)": "Riverbend staged restoration",
    sequence:
      "Isolate Bay 3, connect the mobile transformer, restore critical sites, then rotate residential feeders.",
    targetTime: "2026-09-25 18:30",
    progress: "28"
  },
  {
    "outage (required)": "OUT-2609",
    "crew (required)": "FALCON-7",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "Decision",
  {
    "title (required)": "Authorize mobile transformer deployment",
    context:
      "Fourteen critical sites and 42,800 customers are affected. Permanent repair exceeds the restoration target.",
    recommendation:
      "Release the regional mobile transformer and emergency logistics budget."
  },
  {
    "outage (required)": "OUT-2609",
    "owner (required)": "GridShield Administrator"
  }
);

await createRecord(
  "Update",
  {
    "headline (required)": "Riverbend emergency restoration activated",
    details:
      "The substation is isolated, Falcon-7 is deployed, and staged restoration is underway.",
    audience: "public and executive",
    severity: "red"
  },
  {
    "region (required)": "EAST-STORM",
    "outage (required)": "OUT-2609",
    "owner (required)": "GridShield Administrator"
  }
);

await runAction("GridRegion", "activate", "EAST-STORM", "emergency");
await runAction("Substation", "isolate", "RIV-12", "isolated");
await runAction("Outage", "assess", "OUT-2609", [
  "assessed",
  "escalated",
  "contained",
  "restored"
]);
await runAction("Outage", "escalate", "OUT-2609", [
  "escalated",
  "contained",
  "restored"
]);
await runAction("Crew", "deploy", "FALCON-7", "deployed");
await runAction("WorkOrder", "assign", "WO-1042", [
  "assigned",
  "in-progress",
  "complete"
]);
await runAction("WorkOrder", "start", "WO-1042", [
  "in-progress",
  "complete"
]);
await runAction("SafetyPermit", "approve", "SP-883", [
  "approved",
  "active",
  "closed"
]);
await runAction("SafetyPermit", "activate", "SP-883", ["active", "closed"]);
await runAction(
  "CustomerImpact",
  "notify",
  "Riverbend East and Central",
  ["notified", "resolved"]
);
await runAction(
  "RestorationPlan",
  "approve",
  "Riverbend staged restoration",
  ["approved", "in-progress", "complete"]
);
await runAction(
  "RestorationPlan",
  "start",
  "Riverbend staged restoration",
  ["in-progress", "complete"]
);
await runAction(
  "Update",
  "publish",
  "Riverbend emergency restoration activated",
  "published"
);

await openEntity("Outage");
await page.screenshot({
  path: "examples/grid-shield-outage.png",
  fullPage: true
});
await openEntity("SafetyPermit");
await page.screenshot({
  path: "examples/grid-shield-safety.png",
  fullPage: true
});
await openEntity("RestorationPlan");
await page.screenshot({
  path: "examples/grid-shield-restoration.png",
  fullPage: true
});

await page.setViewportSize({ width: 390, height: 844 });
await openEntity("GridRegion");
await page.screenshot({
  path: "examples/grid-shield-mobile.png",
  fullPage: true
});

await page.setViewportSize({ width: 1536, height: 1050 });
await logout();
await login("noah@gridshield.local", fieldPassword);
await createRecord(
  "WorkOrder",
  {
    "orderCode (required)": "WO-1051",
    "title (required)": "Connect mobile transformer feeder",
    location: "Riverbend Primary - emergency bus",
    priority: "critical",
    estimatedMinutes: "90"
  },
  {
    "outage (required)": "OUT-2609",
    "crew (required)": "FALCON-7"
  }
);
await runAction("WorkOrder", "assign", "WO-1051", [
  "assigned",
  "in-progress",
  "complete"
]);
await runAction("WorkOrder", "start", "WO-1051", [
  "in-progress",
  "complete"
]);
await openEntity("WorkOrder");
await page.screenshot({
  path: "examples/grid-shield-field.png",
  fullPage: true
});

await logout();
await login("priya@gridshield.local", executivePassword);
await openEntity("Decision");
if (await page.getByRole("button", { name: "New Decision", exact: true }).count()) {
  throw new Error("Executive should not see a create-decision control.");
}
const decision = page
  .locator("#entity-table tbody tr")
  .filter({ hasText: "Authorize mobile transformer deployment" });
if (!(await decision.getByText("approved", { exact: true }).count())) {
  await page
    .getByRole("button", {
      name: "approve Authorize mobile transformer deployment",
      exact: true
    })
    .click();
  await page.locator("#action-dialog[open]").waitFor();
  await page.screenshot({
    path: "examples/grid-shield-executive-approval.png",
    fullPage: true
  });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.locator("#action-dialog").waitFor({ state: "hidden" });
}
await page.screenshot({
  path: "examples/grid-shield-executive.png",
  fullPage: true
});

if (errors.length) {
  throw new Error(`Browser errors: ${errors.join(" | ")}`);
}
console.log("GridShield walkthrough completed with zero browser errors.");
await browser.close();
