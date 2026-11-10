import { readFile } from "node:fs/promises";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const manifest = JSON.parse(
  await readFile(new URL("../server.json", import.meta.url)),
);
const schemaUrl = manifest.$schema;

if (!schemaUrl?.startsWith("https://static.modelcontextprotocol.io/schemas/")) {
  throw new Error("server.json must reference an official MCP Registry schema");
}

const response = await fetch(schemaUrl);
if (!response.ok) {
  throw new Error(`Could not fetch MCP schema: ${response.status}`);
}

const schema = await response.json();
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(manifest)) {
  console.error(validate.errors);
  process.exitCode = 1;
} else {
  console.log("server.json official schema validation passed.");
}
