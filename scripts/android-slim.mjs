// Enxuga o APK gerado pelo Capacitor.
//
// A ideia vem do mesmo princípio do Floci: um artefato único, pequeno e que
// abre rápido, sem carregar nada que não é usado. Aqui isso significa:
//   - R8 ligado (remove classes/recursos Java e AndroidX não usados)
//   - só as arquiteturas de celular reais (sem x86 de emulador)
//   - só os idiomas e densidades que o app usa
//   - sem debug symbols nem metadados de dependências no pacote
//
// Roda depois de `cap add/sync android`, antes do gradlew.
import { readFile, writeFile, access } from "node:fs/promises";

const GRADLE = "android/app/build.gradle";
const PROGUARD = "android/app/proguard-rules.pro";
const GRADLE_PROPS = "android/gradle.properties";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";

const SLIM_BLOCK = `
    // --- slim APK (gerado por scripts/android-slim.mjs) ---
    defaultConfig {
        // celulares reais apenas; x86/x86_64 são só para emulador
        ndk { abiFilters 'arm64-v8a', 'armeabi-v7a' }
        // o app é em português; corta as traduções AndroidX não usadas
        resourceConfigurations += ['pt', 'pt-rBR', 'en']
    }
    buildTypes {
        debug {
            // O AGP exige minifyEnabled para usar shrinkResources; no debug
            // deixamos os dois desligados (build rápido e instalável).
            debuggable true
            minifyEnabled false
            shrinkResources false
        }
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    packagingOptions {
        jniLibs { useLegacyPackaging false }
        resources {
            excludes += ['META-INF/*.version', 'META-INF/*.kotlin_module', 'DebugProbesKt.bin', 'kotlin-tooling-metadata.json']
        }
    }
    dependenciesInfo {
        includeInApk false
        includeInBundle false
    }
    // --- fim slim APK ---
`;

// R8 precisa manter os plugins do Capacitor, que são achados por reflexão.
const KEEP_RULES = `
# --- slim APK: mantém o que o Capacitor resolve por reflexão ---
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public *; }
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keepattributes *Annotation*, JavascriptInterface
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-dontwarn com.getcapacitor.**
`;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Remove o bloco buildTypes { ... } que o Capacitor gera, para que as nossas
// definições não sejam sobrescritas (o release do template usa
// minifyEnabled false, o que quebra o shrinkResources).
function stripBuildTypes(source) {
  const marker = /\n[ \t]*buildTypes\s*\{/.exec(source);
  if (!marker) return source;
  const start = marker.index;
  let i = source.indexOf("{", start);
  let depth = 0;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return source;
  return source.slice(0, start) + source.slice(i + 1);
}

const PROPS = [
  ["org.gradle.parallel", "true"],
  ["org.gradle.caching", "true"],
  ["org.gradle.daemon", "true"],
  ["org.gradle.configuration-cache", "true"],
  ["org.gradle.jvmargs", "-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8"],
  ["android.nonTransitiveRClass", "true"],
  ["android.enableR8.fullMode", "true"],
];

// Permissões mínimas: internet, estado da rede e localização (GPS do aparelho).
const PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
];

async function ensurePermissions() {
  if (!(await exists(MANIFEST))) return;
  let xml = await readFile(MANIFEST, "utf8");
  const missing = PERMISSIONS.filter((p) => !xml.includes(`"${p}"`));
  if (!missing.length) {
    console.log("AndroidManifest.xml já tem as permissões necessárias.");
    return;
  }
  const lines = missing.map((p) => `    <uses-permission android:name="${p}" />`).join("\n");
  xml = xml.replace("</manifest>", `${lines}\n</manifest>`);
  await writeFile(MANIFEST, xml, "utf8");
  console.log(`AndroidManifest.xml: adicionadas ${missing.length} permissão(ões).`);
}

async function main() {
  if (!(await exists(GRADLE))) {
    console.error(`não encontrei ${GRADLE}. Rode antes: bunx cap add android`);
    process.exit(1);
  }

  let gradle = await readFile(GRADLE, "utf8");
  if (gradle.includes("slim APK")) {
    console.log("build.gradle já está enxugado.");
  } else {
    gradle = stripBuildTypes(gradle);
    // insere dentro do bloco android { ... } (primeira ocorrência)
    const idx = gradle.indexOf("android {");
    if (idx === -1) throw new Error("bloco android { } não encontrado em build.gradle");
    const insertAt = gradle.indexOf("\n", idx) + 1;
    gradle = gradle.slice(0, insertAt) + SLIM_BLOCK + gradle.slice(insertAt);
    await writeFile(GRADLE, gradle, "utf8");
    console.log("build.gradle enxugado (R8, ABIs, idiomas, packaging).");
  }

  const rules = (await exists(PROGUARD)) ? await readFile(PROGUARD, "utf8") : "";
  if (!rules.includes("slim APK")) {
    await writeFile(PROGUARD, rules + KEEP_RULES, "utf8");
    console.log("proguard-rules.pro com as regras de keep do Capacitor.");
  }

  // Gradle mais rápido no CI: cache de build, execução paralela e daemon.
  if (await exists(GRADLE_PROPS)) {
    let props = await readFile(GRADLE_PROPS, "utf8");
    for (const [key, value] of PROPS) {
      const re = new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m");
      props = re.test(props)
        ? props.replace(re, `${key}=${value}`)
        : `${props.trimEnd()}\n${key}=${value}\n`;
    }
    await writeFile(GRADLE_PROPS, props, "utf8");
    console.log("gradle.properties otimizado (parallel, caching, daemon, R8 full mode).");
  }

  await ensurePermissions();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});