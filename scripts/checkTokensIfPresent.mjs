// Cross-repo token-parity guard. The actual checker lives at the monorepo root
// (../../scripts/check_token_parity.mjs) and reads BOTH the web and the extension
// token files. That only works in a full monorepo checkout (local dev / CI).
// On a standalone web checkout (e.g. Netlify builds only frontend/web), the
// sibling script isn't present, so we skip it — the production web bundle does
// not depend on the extension repo. This keeps the guard where it can run while
// never blocking the deploy.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const parityScript = path.resolve(here, "../../../scripts/check_token_parity.mjs");

if (!existsSync(parityScript)) {
  console.log(
    "[check:tokens] skipped — token-parity script not present in this checkout (standalone web build).",
  );
  process.exit(0);
}

const result = spawnSync(process.execPath, [parityScript], { stdio: "inherit" });
process.exit(result.status ?? 1);
