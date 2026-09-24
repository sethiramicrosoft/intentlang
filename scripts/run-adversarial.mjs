import { spawnSync } from "node:child_process";

const profile = process.argv[2] ?? "ci";
const casesPerSeed =
  profile === "release" ? 200_000 : profile === "quick" ? 100 : 1_000;
const seedCount = 5;
const totalCases = casesPerSeed * seedCount;

console.log(
  `IntentLang adversarial profile=${profile} seeds=${seedCount} casesPerSeed=${casesPerSeed} totalGeneratedPrograms=${totalCases}`
);

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "test/properties.test.ts",
    "test/authorization-matrix.test.ts",
    "test/workflow-invariants.test.ts",
    "test/runtime-properties.test.ts"
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      INTENTLANG_FUZZ_CASES: String(casesPerSeed)
    },
    stdio: "inherit"
  }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
