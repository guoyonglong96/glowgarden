// Glowgarden entrypoint (Node 22, standard library only). The game is
// the static files under game/ (game/index.html plus its ES modules, no
// library and no network request). This program hands the entry in: it
// copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

function fail(message) {
  console.error("main.ts: " + message);
  process.exit(1);
}

// Guardrails that mirror the sealed scorer's caps, so a bad entry fails
// loudly here instead of silently at grading time.
const gameDir = join(here, "game");
const shotsDir = join(here, "screenshots");
if (!existsSync(join(gameDir, "index.html"))) fail("game/index.html is missing");
if (!existsSync(shotsDir)) fail("screenshots/ is missing");
const shots = readdirSync(shotsDir).filter((name) => !name.startsWith("."));
if (shots.length < 3 || shots.length > 4) fail("need 3 or 4 screenshots, found " + shots.length);
for (const name of shots) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > 262144) fail("screenshot " + name + " is " + bytes + " bytes, over the 256 KiB cap");
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, "game"), { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });
cpSync(shotsDir, join(out, "screenshots"), { recursive: true });

writeFileSync(
  join(out, "dossier.json"),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log("wrote " + out + "/dossier.json (" + shots.length + " screenshots)");
