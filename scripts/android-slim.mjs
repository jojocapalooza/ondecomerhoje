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
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
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

async function main() {
  if (!(await exists(GRADLE))) {
    console.error(`não encontrei ${GRADLE}. Rode antes: bunx cap add android`);
    process.exit(1);
  }

  let gradle = await readFile(GRADLE, "utf8");
  if (gradle.includes("slim APK")) {
    console.log("build.gradle já está enxugado.");
  } else {
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});