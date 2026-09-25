import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:4391";
const adminEmail = process.env.ATLAS_ADMIN_EMAIL;
const adminPassword = process.env.ATLAS_ADMIN_PASSWORD;
const sitePassword = process.env.ATLAS_SITE_PASSWORD;
const supplierPassword = process.env.ATLAS_SUPPLIER_PASSWORD;
const executivePassword = process.env.ATLAS_EXECUTIVE_PASSWORD;
if (
  !adminEmail ||
  !adminPassword ||
  !sitePassword ||
  !supplierPassword ||
  !executivePassword
) {
  throw new Error(
    "Set ATLAS_ADMIN_EMAIL, ATLAS_ADMIN_PASSWORD, ATLAS_SITE_PASSWORD, " +
      "ATLAS_SUPPLIER_PASSWORD, and ATLAS_EXECUTIVE_PASSWORD."
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 1050 } });
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
  const recordLabel = String(Object.values(values)[0]);
  if (
    await page
      .locator("#entity-table tbody")
      .getByText(recordLabel, { exact: true })
      .count()
  ) {
    return;
  }
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

async function runAction(entity, action, recordLabel, completedState) {
  await openEntity(entity);
  const row = page
    .locator("#entity-table tbody tr")
    .filter({ hasText: recordLabel });
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
    .getByRole("button", { name: `${action} ${recordLabel}`, exact: true })
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
      .filter({ hasText: recordLabel });
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
  "Amara Site Manager",
  "amara@atlas.local",
  sitePassword,
  "SiteManager"
);
await provision(
  "Kenji Supplier Partner",
  "kenji@atlas.local",
  supplierPassword,
  "SupplierPartner"
);
await provision(
  "Elena Executive",
  "elena@atlas.local",
  executivePassword,
  "Executive"
);
await logout();
await login(adminEmail, adminPassword);
await enableDarkTheme();

await createRecord("Network", {
  "code (required)": "APAC-RES",
  "name (required)": "Asia Pacific Resilience Network",
  region: "Asia Pacific",
  resilienceScore: "68"
});

await createRecord(
  "Facility",
  {
    "code (required)": "SG-HUB",
    "name (required)": "Singapore Final Assembly Hub",
    country: "Singapore",
    capacityPercent: "62"
  },
  {
    "network (required)": "APAC-RES",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "Supplier",
  {
    "code (required)": "NX-SEM",
    "name (required)": "Nexus Semiconductor",
    category: "Edge controllers",
    riskTier: "critical"
  },
  {
    "network (required)": "APAC-RES",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "Shipment",
  {
    "trackingCode (required)": "NX-7841",
    "description (required)": "Priority edge-controller allocation",
    origin: "Hsinchu",
    destination: "Singapore",
    expectedDate: "2026-10-02",
    priority: "critical"
  },
  {
    "network (required)": "APAC-RES",
    "supplier (required)": "NX-SEM",
    "facility (required)": "SG-HUB",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "InventoryAlert",
  {
    "item (required)": "NX-44 edge controller",
    currentDays: "4",
    targetDays: "21",
    severity: "critical"
  },
  {
    "network (required)": "APAC-RES",
    "facility (required)": "SG-HUB",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "Disruption",
  {
    "title (required)": "Taiwan Strait capacity shock",
    "summary (required)":
      "Port restrictions and carrier reallocation threaten controller supply for three assembly programs.",
    impact: "critical",
    probability: "high"
  },
  {
    "network (required)": "APAC-RES",
    "facility (required)": "SG-HUB",
    "supplier (required)": "NX-SEM",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "RecoveryPlan",
  {
    "title (required)": "Dual-route semiconductor recovery",
    strategy:
      "Reserve premium air capacity, qualify the Osaka buffer stock, and sequence critical customer builds first.",
    targetDate: "2026-10-05",
    progress: "35"
  },
  {
    "disruption (required)": "Taiwan Strait capacity shock",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "Decision",
  {
    "title (required)": "Authorize premium air bridge",
    context:
      "Four days of controller inventory remain and the delayed sea route misses two committed production windows.",
    recommendation:
      "Approve premium air freight and release the Osaka safety-stock transfer."
  },
  {
    "disruption (required)": "Taiwan Strait capacity shock",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await createRecord(
  "Update",
  {
    "headline (required)": "Critical controller disruption activated",
    details:
      "The control tower activated the dual-route recovery plan. Executive approval is pending for premium freight.",
    audience: "executive",
    health: "red"
  },
  {
    "network (required)": "APAC-RES",
    "owner (required)": "AtlasGrid Administrator"
  }
);

await runAction("Network", "activate", "APAC-RES", "active");
await runAction("Facility", "restrict", "SG-HUB", "restricted");
await runAction(
  "Shipment",
  "dispatch",
  "NX-7841",
  ["in-transit", "delayed", "delivered"]
);
await runAction("Shipment", "delay", "NX-7841", ["delayed", "delivered"]);
await runAction(
  "InventoryAlert",
  "acknowledge",
  "NX-44 edge controller",
  "acknowledged"
);
await runAction(
  "Disruption",
  "escalate",
  "Taiwan Strait capacity shock",
  "escalated"
);
await runAction(
  "RecoveryPlan",
  "approve",
  "Dual-route semiconductor recovery",
  ["approved", "in-progress", "complete"]
);
await runAction(
  "RecoveryPlan",
  "start",
  "Dual-route semiconductor recovery",
  ["in-progress", "complete"]
);
await runAction(
  "Update",
  "publish",
  "Critical controller disruption activated",
  "published"
);

await openEntity("Disruption");
await page.screenshot({
  path: "examples/atlas-grid-disruption.png",
  fullPage: true
});

await openEntity("RecoveryPlan");
await page.screenshot({
  path: "examples/atlas-grid-recovery.png",
  fullPage: true
});

await page.setViewportSize({ width: 390, height: 844 });
await openEntity("Network");
await page.screenshot({
  path: "examples/atlas-grid-mobile.png",
  fullPage: true
});

await page.setViewportSize({ width: 1536, height: 1050 });
await logout();
await login("kenji@atlas.local", supplierPassword);
await createRecord(
  "Shipment",
  {
    "trackingCode (required)": "NX-7918",
    "description (required)": "Emergency Osaka buffer transfer",
    origin: "Osaka",
    destination: "Singapore",
    expectedDate: "2026-09-29",
    priority: "critical"
  },
  {
    "network (required)": "APAC-RES",
    "supplier (required)": "NX-SEM",
    "facility (required)": "SG-HUB"
  }
);
await runAction(
  "Shipment",
  "dispatch",
  "NX-7918",
  ["in-transit", "delayed", "delivered"]
);
await openEntity("Shipment");
await page.screenshot({
  path: "examples/atlas-grid-supplier.png",
  fullPage: true
});

await logout();
await login("elena@atlas.local", executivePassword);
await openEntity("Decision");
if (await page.getByRole("button", { name: "New Decision", exact: true }).count()) {
  throw new Error("Executive should not see a create-decision control.");
}
const decisionRow = page
  .locator("#entity-table tbody tr")
  .filter({ hasText: "Authorize premium air bridge" });
if (!(await decisionRow.getByText("approved", { exact: true }).count())) {
  await page
    .getByRole("button", {
      name: "approve Authorize premium air bridge",
      exact: true
    })
    .click();
  await page.locator("#action-dialog[open]").waitFor();
  await page.screenshot({
    path: "examples/atlas-grid-executive-approval.png",
    fullPage: true
  });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.locator("#action-dialog").waitFor({ state: "hidden" });
}
await page.screenshot({
  path: "examples/atlas-grid-executive.png",
  fullPage: true
});

if (errors.length) {
  throw new Error(`Browser errors: ${errors.join(" | ")}`);
}
console.log("Atlas Grid walkthrough completed with zero browser errors.");
await browser.close();
