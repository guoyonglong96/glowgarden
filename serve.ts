import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { fileURLToPath as urlToPath } from "node:url";

const root = path.resolve(urlToPath(new URL("./game", import.meta.url)));
const portFlag = process.argv.indexOf("--port");
const requested = portFlag < 0 ? 8080 : Number(process.argv[portFlag + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
]);

const reply = (response, code, body) => {
  response.writeHead(code).end(body);
};

const serveFile = (request, response) => {
  const url = new URL(request.url === null || request.url === undefined ? "/" : request.url, "http://localhost");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    reply(response, 400, "bad request");
    return;
  }
  if (pathname.charAt(pathname.length - 1) === "/") pathname = `${pathname}index.html`;
  const file = path.resolve(path.join(root, path.normalize(pathname)));
  const inside = file === root || file.indexOf(root + path.sep) === 0;
  if (inside === false) {
    reply(response, 403, "forbidden");
    return;
  }
  let size;
  try {
    const stats = fs.statSync(file);
    if (stats.isFile() === false) throw new Error("not a file");
    size = stats.size;
  } catch {
    reply(response, 404, "not found");
    return;
  }
  const type = MIME.get(path.extname(file).toLowerCase());
  response.writeHead(200, {
    "content-type": type === undefined ? "application/octet-stream" : type,
    "content-length": size,
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(response);
};

http.createServer(serveFile).listen(port, "127.0.0.1", () => {
  console.log(`game/ is on http://localhost:${port}`);
});
