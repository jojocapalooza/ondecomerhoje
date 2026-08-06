// Gera o pacote web embutido no APK Android.
//
// 1. roda o build normal (bun run build)
// 2. sobe o servidor do build localmente e captura o HTML das telas
// 3. grava esse HTML em dist/client (webDir do Capacitor)
//
// Assim o APK abre instantaneamente com a interface vinda de dentro do
// aparelho; só as consultas de dados vão para a API publicada.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PORT = Number(process.env["MOBILE_PREVIEW_PORT"] ?? 4183);
const ROUTES = ["/", "/favoritos", "/trend", "/perfil"];
const OUT = "dist/client";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false, ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} falhou (${code})`))));
    child.on("error", reject);
  });
}

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`servidor de preview não respondeu em ${url}`);
}

async function main() {
  if (!process.argv.includes("--skip-build")) {
    await run("npx", ["vite", "build"]);
  }

  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1"], {
    stdio: "inherit",
  });

  try {
    await waitFor(`http://127.0.0.1:${PORT}/`);
    for (const route of ROUTES) {
      const res = await fetch(`http://127.0.0.1:${PORT}${route}`);
      if (!res.ok) throw new Error(`falha ao capturar ${route}: ${res.status}`);
      const html = await res.text();
      const file = route === "/" ? join(OUT, "index.html") : join(OUT, route.slice(1), "index.html");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html, "utf8");
      console.log(`capturado ${route} -> ${file}`);
    }
  } finally {
    server.kill("SIGTERM");
  }

  console.log("\nPacote web pronto em dist/client. Agora: bun run android:sync");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});