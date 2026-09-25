import { execFileSync } from "node:child_process";
import { validateGovernance } from "../dist/src/language/governance.js";

function changedFiles() {
  const explicit = process.env.INTENTLANG_CHANGED_FILES;
  if (explicit) return explicit.split(/\r?\n/).filter(Boolean);
  const base = process.env.GOVERNANCE_BASE;
  try {
    const tracked = execFileSync(
      "git",
      base
        ? ["diff", "--name-only", `${base}...HEAD`]
        : ["diff", "--name-only", "HEAD"],
      { encoding: "utf8" }
    ).split(/\r?\n/).filter(Boolean);
    const untracked = base
      ? []
      : execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
          encoding: "utf8"
        }).split(/\r?\n/).filter(Boolean);
    return [...new Set([...tracked, ...untracked])];
  } catch (error) {
    throw new Error(
      `Unable to determine changed files: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const report = await validateGovernance(process.cwd(), changedFiles());
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
