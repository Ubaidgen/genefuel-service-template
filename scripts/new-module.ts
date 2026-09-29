/**
 * Scaffolds a new feature module from the `example` module.
 *
 *   npm run new:module -- lab-order
 *   npm run new:module -- lab-order --plural lab-orders
 *
 * Copies src/modules/example and test/modules/example, renames every
 * identifier/table/route/scope, wires the module into app.module.ts and
 * schema.ts, and formats the result. The example module is the template, so
 * it is always compiled, linted and tested — the scaffold cannot rot.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED = new Set(["example", "core", "config", "health", "internal", "auth", "audit", "test"]);

function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

function fail(message: string): never {
  console.error(`new:module: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const name = args[0];
const pluralFlag = args.indexOf("--plural");
if (!name || name.startsWith("-")) fail("usage: npm run new:module -- <kebab-name> [--plural <kebab-plural>]");
if (!KEBAB.test(name)) fail(`"${name}" is not kebab-case (e.g. lab-order)`);
if (RESERVED.has(name)) fail(`"${name}" is reserved`);

const plural = pluralFlag >= 0 ? args[pluralFlag + 1] : pluralize(name);
if (!plural || !KEBAB.test(plural) || plural === name) fail("--plural must be a different kebab-case word");

const words = (k: string) => k.split("-");
const pascal = (k: string) =>
  words(k)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join("");
const camel = (k: string) => pascal(k).replace(/^./, (c) => c.toLowerCase());
const snake = (k: string) => words(k).join("_");
const upper = (k: string) => snake(k).toUpperCase();
const human = (k: string) => words(k).join(" ");

const n = {
  kebab: name,
  kebabPlural: plural,
  snake: snake(name),
  snakePlural: snake(plural),
  camel: camel(name),
  camelPlural: camel(plural),
  pascal: pascal(name),
  pascalPlural: pascal(plural),
  upper: upper(name),
  upperPlural: upper(plural),
  human: human(name),
  humanPlural: human(plural),
};

/** Order matters: context-specific rules first, generic identifier rules last. */
function transform(source: string): string {
  return (
    source
      // Import specifiers and file paths → kebab file names.
      .replace(/(["'])([^"'\n]*?\.js)\1/g, (_m, q: string, spec: string) => {
        const renamed = spec.replace(/examples/g, n.kebabPlural).replace(/example/g, n.kebab);
        return `${q}${renamed}${q}`;
      })
      // Member-facing label and README heading.
      .replace('{ one: "example", many: "examples" }', `{ one: "${n.human}", many: "${n.humanPlural}" }`)
      .replace(/^# example module/m, `# ${n.human} module`)
      // HTTP routes.
      .replace(/path: "internal\/examples"/g, `path: "internal/${n.kebabPlural}"`)
      .replace(/path: "examples"/g, `path: "${n.kebabPlural}"`)
      .replace(/\/v1\/(internal\/)?examples/g, (_m, internal = "") => `/v1/${internal}${n.kebabPlural}`)
      // Service-token scopes and advisory-lock keys ("examples:archive", `examples:${id}`).
      .replace(/(["`])examples:/g, `$1${n.kebabPlural}:`)
      // SQL identifiers.
      .replace(/examples_/g, `${n.snakePlural}_`)
      .replace(/example_status/g, `${n.snake}_status`)
      .replace(/"examples"/g, `"${n.snakePlural}"`)
      // Audit actions / resource types.
      .replace(/"example\./g, `"${n.snake}.`)
      .replace(/"example"/g, `"${n.snake}"`)
      // Identifiers.
      .replace(/EXAMPLES/g, n.upperPlural)
      .replace(/EXAMPLE/g, n.upper)
      .replace(/Examples/g, n.pascalPlural)
      .replace(/Example/g, n.pascal)
      .replace(/examples/g, n.camelPlural)
      .replace(/example/g, n.camel)
  );
}

function renamePath(path: string): string {
  return path.replace(/examples/g, n.kebabPlural).replace(/example/g, n.kebab);
}

function copyTree(fromDir: string, toDir: string, written: string[]): void {
  for (const entry of readdirSync(fromDir)) {
    const from = join(fromDir, entry);
    const to = join(toDir, renamePath(entry));
    if (statSync(from).isDirectory()) {
      copyTree(from, to, written);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, transform(readFileSync(from, "utf8")));
    written.push(to);
  }
}

function insertAtMarker(file: string, marker: string, line: string): void {
  const source = readFileSync(file, "utf8");
  if (!source.includes(marker)) fail(`marker "${marker}" missing in ${file}`);
  if (source.includes(line)) return;
  writeFileSync(file, source.replace(marker, `${line}\n${marker}`));
}

const srcDir = join("src/modules", n.kebab);
const testDir = join("test/modules", n.kebab);
if (existsSync(srcDir) || existsSync(testDir)) fail(`module "${n.kebab}" already exists`);

const written: string[] = [];
copyTree("src/modules/example", srcDir, written);
copyTree("test/modules/example", testDir, written);

const indent = (s: string) => `    ${s}`;
insertAtMarker(
  "src/app.module.ts",
  "// new-module:import",
  `import { ${n.pascal}Module } from "./modules/${n.kebab}/index.js";`,
);
insertAtMarker("src/app.module.ts", indent("// new-module:module"), indent(`${n.pascal}Module,`));
insertAtMarker(
  "src/schema.ts",
  "// new-module:schema",
  `export { ${n.camelPlural}, ${n.camel}Status } from "./modules/${n.kebab}/index.js";`,
);

execFileSync("npx", ["biome", "check", "--write", srcDir, testDir, "src/app.module.ts", "src/schema.ts"], {
  stdio: "ignore",
});

console.log(`Created module "${n.kebab}" (${written.length} files):`);
for (const file of written) console.log(`  ${file}`);
console.log(`
Next steps:
  1. Model the real domain: types.ts, domain/, access.ts, errors.ts, persistence/${n.kebab}.schema.ts
  2. npm run db:generate -- --name add_${n.snakePlural}   (review the SQL before committing)
  3. Adjust the tests in ${testDir} — keep the security suite; every route needs its 401/403/404/400/429 cases
  4. npm run verify && npm run test:integration
  5. Delete what you do not need (e.g. the internal archive route) — unused routes are attack surface
  6. Before the first production deploy, remove ExampleModule from src/app.module.ts imports (keep the folder)`);
