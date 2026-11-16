import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath as urlToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const rootDir = urlToPath(new URL(".", import.meta.url));
const destDir = process.env.MAKEFUN_OUTPUT_DIR === undefined
  ? "/output"
  : process.env.MAKEFUN_OUTPUT_DIR;

const die = (message) => {
  console.error(`main.ts: ${message}`);
  process.exit(1);
};

const must = (ok, message) => {
  if (ok === false) die(message);
};

const gameDir = path.join(rootDir, "game");
const shotsDir = path.join(rootDir, "screenshots");
must(fs.existsSync(path.join(gameDir, "index.html")), "game/index.html is missing");
must(fs.existsSync(shotsDir), "screenshots/ is missing");

const shots = fs.readdirSync(shotsDir).filter((name) => name.startsWith(".") === false);
must(shots.length >= 3 && shots.length <= 4, `need 3 or 4 screenshots, found ${shots.length}`);
shots.forEach((name) => {
  const bytes = fs.statSync(path.join(shotsDir, name)).size;
  if (bytes > 262144) die(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
});

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(gameDir, path.join(destDir, "game"), { recursive: true });
fs.mkdirSync(path.join(destDir, "screenshots"), { recursive: true });
fs.cpSync(shotsDir, path.join(destDir, "screenshots"), { recursive: true });

const dossierOptions = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
fs.writeFileSync(path.join(destDir, "dossier.json"), buildDossier(destDir, dossierOptions));
console.log(`wrote ${destDir}/dossier.json (${shots.length} screenshots)`);
