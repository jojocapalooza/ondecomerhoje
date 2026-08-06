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
import { mkdir, writeFile, rm, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

// Só a raiz é pré-renderizada: dentro do APK o WebView sempre abre index.html
// e a navegação entre telas é feita no cliente. Guardar uma cópia de HTML por
// tela só inflaria o pacote com o mesmo conteúdo repetido.
const ROUTES = ["/"];
// Arquivos que não servem para nada dentro do APK.
const DROP = ["_headers", "robots.txt", "sitemap.xml", "favoritos", "trend", "perfil"];
const OUT = "dist/client";

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

  const mod = await import(pathToFileURL(join(process.cwd(), "dist/server/index.mjs")).href);
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
  for (const entry of await readdir(join(OUT, "assets"))) {
    if (entry.endsWith(".map")) await rm(join(OUT, "assets", entry), { force: true });
  }

  const kb = Math.round((await dirSize(OUT)) / 1024);
  console.log(`\nPacote web pronto em dist/client — ${kb} KB.`);
  console.log("Agora: bun run android:sync (e scripts/android-slim.mjs antes do gradlew)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});