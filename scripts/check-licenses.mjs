import { readFile } from "node:fs/promises";

const lock = JSON.parse(
  await readFile(new URL("../package-lock.json", import.meta.url)),
);
const blocked = /(?:^|[^A-Z])(A?GPL)(?:-|\b)/i;
const problems = [];

for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/") || metadata.dev === true) continue;
  if (path.startsWith("node_modules/@humanleg/")) continue;

  const license = metadata.license;
  if (!license) {
    problems.push(`${path}: missing license metadata`);
  } else if (blocked.test(license)) {
    problems.push(`${path}: blocked copyleft license ${license}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Production dependency license metadata check passed.");
}
