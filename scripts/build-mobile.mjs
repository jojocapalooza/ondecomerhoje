// Gera o pacote web embutido no APK Android.
//
// 1. roda o build normal (bun run build)
// 2. sobe o servidor do build localmente e captura o HTML das telas
// 3. grava esse HTML em dist/client (webDir do Capacitor)
//
// Assim o APK abre instantaneamente com a interface vinda de dentro do
// aparelho; só as consultas de dados vão para a API publicada.
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile, rm, readdir, stat, readFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Só a raiz é pré-renderizada: dentro do APK o WebView sempre abre index.html
// e a navegação entre telas é feita no cliente. Guardar uma cópia de HTML por
// tela só inflaria o pacote com o mesmo conteúdo repetido.
const ROUTES = ["/"];
// Arquivos que não servem para nada dentro do APK.
const DROP = ["_headers", "robots.txt", "sitemap.xml", "favoritos", "trend", "perfil"];
const OUT = "dist/client";

// O nitro pode gerar em `dist/` ou em `.output/` dependendo da versão/preset.
// Lemos o manifesto para descobrir onde estão o handler e os arquivos públicos.
async function resolveBuildOutput() {
  for (const base of ["dist", ".output"]) {
    const manifest = join(base, "nitro.json");
    if (!existsSync(manifest)) continue;
    const json = JSON.parse(await readFile(manifest, "utf8"));
    const serverEntry = join(base, json.serverEntry ?? "server/index.mjs");
    const publicDir = join(base, json.publicDir ?? "client");
    if (existsSync(serverEntry)) return { base, serverEntry, publicDir };
  }
  // fallback: caminhos conhecidos
  for (const [serverEntry, publicDir] of [
    ["dist/server/index.mjs", "dist/client"],
    [".output/server/index.mjs", ".output/public"],
  ]) {
    if (existsSync(serverEntry)) return { base: dirname(dirname(serverEntry)), serverEntry, publicDir };
  }
  throw new Error("não encontrei o build do servidor (dist/ ou .output/). Rode o build antes.");
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await stat(p)).size;
  }
  return total;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false, ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} falhou (${code})`))));
    child.on("error", reject);
  });
}

// Renderiza uma rota chamando o handler do build direto em memória — não
// precisamos subir servidor nem ter runtime de edge instalado.
async function render(handler, route) {
  const request = new Request(`https://ondecomerhoje.lovable.app${route}`, {
    headers: { accept: "text/html", "user-agent": "onde-comer-hoje-mobile-build" },
  });
  // o runtime mutila `request.ip`; deixamos a propriedade gravável antes.
  Object.defineProperty(request, "ip", { value: "127.0.0.1", writable: true, configurable: true });
  const response = await handler.fetch(request, process.env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
  });
  if (!response.ok) throw new Error(`falha ao renderizar ${route}: ${response.status}`);
  return response.text();
}

async function main() {
  if (!process.argv.includes("--skip-build")) {
    await run("npx", ["vite", "build"]);
  }

  const { serverEntry, publicDir } = await resolveBuildOutput();
  console.log(`build encontrado: ${serverEntry} (público: ${publicDir})`);

  // O Capacitor lê sempre de dist/client; se o nitro gerou em outro lugar, copiamos.
  if (publicDir !== OUT) {
    await rm(OUT, { recursive: true, force: true });
    await mkdir(dirname(OUT), { recursive: true });
    await cp(publicDir, OUT, { recursive: true });
  }

  const mod = await import(pathToFileURL(join(process.cwd(), serverEntry)).href);
  const handler = mod.default ?? mod;

  for (const route of ROUTES) {
    const html = await render(handler, route);
    const file = route === "/" ? join(OUT, "index.html") : join(OUT, route.slice(1), "index.html");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html, "utf8");
    console.log(`capturado ${route} -> ${file}`);
  }

  for (const name of DROP) {
    await rm(join(OUT, name), { recursive: true, force: true });
  }
  // Sourcemaps nunca são lidos dentro do app e pesam mais que o código.
  if (existsSync(join(OUT, "assets"))) {
    for (const entry of await readdir(join(OUT, "assets"))) {
      if (entry.endsWith(".map")) await rm(join(OUT, "assets", entry), { force: true });
    }
  }

  const kb = Math.round((await dirSize(OUT)) / 1024);
  console.log(`\nPacote web pronto em dist/client — ${kb} KB.`);
  console.log("Agora: bun run android:sync (e scripts/android-slim.mjs antes do gradlew)");
}

main().then(
  // o handler do servidor mantém timers abertos; encerramos explicitamente.
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);