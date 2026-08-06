// Configura a assinatura de release do projeto Android gerado pelo Capacitor.
//
// Lê as variáveis de ambiente (vindas dos secrets do GitHub ou do seu terminal):
//   ANDROID_KEYSTORE_PATH      caminho do .jks/.keystore
//   ANDROID_KEYSTORE_PASSWORD  senha do keystore
//   ANDROID_KEY_ALIAS          alias da chave
//   ANDROID_KEY_PASSWORD       senha da chave (default: senha do keystore)
//
// Sem essas variáveis o script sai sem erro: o build de release continua
// possível, mas sairá "unsigned".
import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const GRADLE = "android/app/build.gradle";

const {
  ANDROID_KEYSTORE_PATH,
  ANDROID_KEYSTORE_PASSWORD,
  ANDROID_KEY_ALIAS,
  ANDROID_KEY_PASSWORD,
} = process.env;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(GRADLE))) {
    console.error(`não encontrei ${GRADLE}. Rode antes: bunx cap add android`);
    process.exit(1);
  }

  if (!ANDROID_KEYSTORE_PATH || !ANDROID_KEYSTORE_PASSWORD || !ANDROID_KEY_ALIAS) {
    console.log("sem keystore configurado; release sairá sem assinatura.");
    return;
  }

  let gradle = await readFile(GRADLE, "utf8");
  if (gradle.includes("release signing")) {
    console.log("assinatura de release já configurada.");
    return;
  }

  const storeFile = resolve(ANDROID_KEYSTORE_PATH).replace(/\\/g, "/");
  const keyPassword = ANDROID_KEY_PASSWORD || ANDROID_KEYSTORE_PASSWORD;

  const block = `
    // --- release signing (gerado por scripts/android-signing.mjs) ---
    signingConfigs {
        release {
            storeFile file('${storeFile}')
            storePassword '${ANDROID_KEYSTORE_PASSWORD}'
            keyAlias '${ANDROID_KEY_ALIAS}'
            keyPassword '${keyPassword}'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
    // --- fim release signing ---
`;

  const idx = gradle.indexOf("android {");
  if (idx === -1) throw new Error("bloco android { } não encontrado em build.gradle");
  const insertAt = gradle.indexOf("\n", idx) + 1;
  gradle = gradle.slice(0, insertAt) + block + gradle.slice(insertAt);
  await writeFile(GRADLE, gradle, "utf8");
  console.log("assinatura de release configurada em build.gradle.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
