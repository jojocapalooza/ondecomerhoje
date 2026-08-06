# App Android — Onde Comer Hoje

O app é o mesmo site, empacotado com **Capacitor** (única dependência nativa).
Toda a interface fica **dentro do APK**, e o aparelho fornece GPS, permissões e
o navegador do sistema. Só as consultas de restaurantes saem para a internet.

- ID do app: `com.ondecomerhoje.app`
- Nome na tela: `Onde Comer Hoje`
- Pasta web embutida: `dist/client`
- API usada pelo app: `https://ondecomerhoje.lovable.app`
  (troque com a variável `VITE_MOBILE_API_BASE` antes do build, se quiser)

## Opção 1 — APK na nuvem (GitHub Actions)

1. Conecte o projeto ao GitHub (menu **+ → GitHub → Connect project**).
2. O workflow `.github/workflows/android.yml` roda a cada push na `main`
   (ou manualmente em **Actions → Android APK → Run workflow**).
3. Ao terminar, baixe o arquivo em **Actions → run → Artifacts →
   `onde-comer-hoje-apk`**.
4. No celular, abra o APK e permita "instalar de fontes desconhecidas".

O APK gerado é **debug** (assinado com chave de depuração) — perfeito para
instalar no seu aparelho. Para publicar na Play Store depois é preciso uma
chave de release.

## Opção 2 — Build local (Android Studio)

Requisitos: JDK 21, Android Studio com SDK instalado.

```bash
bun install
bun run mobile:web      # build + gera as telas embutidas em dist/client
bun run android:add     # só na primeira vez: cria a pasta android/
bun run android:sync    # copia o web para o projeto nativo
bun run android:slim    # enxuga o projeto nativo (R8, ABIs, idiomas)
bun run android:open    # abre no Android Studio (Run ▶ instala no celular)
```

Ou direto para o arquivo:

```bash
bun run android:apk
# APK em android/app/build/outputs/apk/debug/app-debug.apk
```

## Como funciona a independência do aparelho

- `src/lib/favorites.ts` usa o plugin nativo `@capacitor/geolocation` no app
  (pede a permissão de localização do Android) e a API do navegador na web.
- `src/lib/mobile-bridge.ts` redireciona apenas as chamadas de dados
  (`/_serverFn/*`, `/api/*`) para a API publicada; HTML, CSS, JS e ícones vêm
  de dentro do APK.
- `scripts/build-mobile.mjs` renderiza as telas principais (`/`, `/favoritos`,
  ...) — hoje só a raiz, porque o WebView sempre abre `index.html` e o resto da
  navegação é feita no cliente.

## Por que o APK é pequeno

A meta é a mesma de um binário único e leve: nada que não é usado entra no
pacote.

- **Um só plugin nativo** (`@capacitor/geolocation`). Removidos `app`,
  `browser`, `status-bar` e `assets`, que não eram usados.
- **R8 + shrinkResources** ligados no debug e no release: classes e recursos
  AndroidX não usados são removidos (as regras de `keep` do Capacitor ficam em
  `proguard-rules.pro`).
- **Só ABIs de celular real** (`arm64-v8a`, `armeabi-v7a`) — sem x86 de
  emulador.
- **Só os idiomas usados** (`pt`, `pt-rBR`, `en`) nas bibliotecas.
- **Sem sourcemaps, sem `_headers`/`robots.txt`/`sitemap`, sem HTML duplicado
  por rota** dentro do APK; o pacote web fica em torno de **620 KB**
  (comprimido no APK, bem menos).
- **Sem `dependenciesInfo`** e sem metadados de build no pacote.

Tudo isso é aplicado por `scripts/android-slim.mjs`, que roda automaticamente
no workflow e via `bun run android:apk`.

## Depois de mudar o app

Mudanças visuais exigem gerar um APK novo (`bun run mobile:web` +
`android:sync`). Mudanças de dados/API entram sozinhas, porque vêm do site
publicado.
---

## Passo a passo: gerar o APK (debug, para instalar no seu celular)

### Caminho A — na nuvem, sem instalar nada

1. Conecte o projeto ao GitHub: menu **+ → GitHub → Connect project**.
2. Vá em **Actions → Android APK → Run workflow** (ou apenas dê um push na `main`).
3. Espere ~6–10 min. Ao terminar, abra o run → **Artifacts** →
   `onde-comer-hoje-apk` → baixe o `.zip` e extraia o `app-debug.apk`.
4. Envie o arquivo para o celular (Drive, cabo, Telegram…), toque nele e
   permita **"instalar apps de fontes desconhecidas"**.

### Caminho B — no seu computador

Requisitos: **JDK 21** e **Android SDK** (Android Studio já inclui os dois).

```bash
bun install
bun run android:add     # só a primeira vez
bun run android:apk     # build web + sync + slim + gradlew assembleDebug
```
Resultado: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Passo a passo: gerar o AAB (release assinado, para a Play Store)

A Play Store **só aceita AAB assinado com a sua chave de release**. Faça uma vez:

### 1. Criar a chave (keystore)

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias ondecomerhoje
```
Guarde o `release.jks` e as senhas em local seguro: **perder essa chave impede
atualizar o app na loja depois**.

### 2. Build local do AAB

```bash
export ANDROID_KEYSTORE_PATH=./release.jks
export ANDROID_KEYSTORE_PASSWORD='sua-senha'
export ANDROID_KEY_ALIAS=ondecomerhoje
export ANDROID_KEY_PASSWORD='sua-senha'

bun run android:aab       # AAB  -> android/app/build/outputs/bundle/release/app-release.aab
bun run android:release   # APK  -> android/app/build/outputs/apk/release/app-release.apk
```

### 3. Build na nuvem do AAB (GitHub Actions)

1. Converta a chave em texto:
   `base64 -w0 release.jks > release.b64` (no macOS: `base64 -i release.jks -o release.b64`).
2. No GitHub, em **Settings → Secrets and variables → Actions → New secret**, crie:
   - `ANDROID_KEYSTORE_BASE64` → conteúdo do `release.b64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
3. Rode **Actions → Android Release (APK + AAB) → Run workflow**
   (ou crie uma tag `v1.0.0` e dê push).
4. Baixe o artefato `onde-comer-hoje-release` — contém o `.apk` e o `.aab`.

Sem os secrets o workflow ainda roda, mas o release sai **sem assinatura**
(serve para testar tamanho, não para a loja).

### 4. Enviar para a Play Store

1. Crie a conta de desenvolvedor no **Google Play Console** (taxa única de US$ 25).
2. **Criar app** → nome "Onde Comer Hoje", idioma pt-BR, app gratuito.
3. Em **Produção → Criar novo lançamento**, faça upload do `app-release.aab`.
4. Preencha o obrigatório: ícone 512×512, capa 1024×500, 2+ screenshots,
   descrição, política de privacidade (URL pública) e o formulário de
   **Segurança dos dados** — declare o uso de **localização precisa** para
   sugerir restaurantes próximos.
5. Envie para revisão (costuma levar de 1 a 7 dias).

### Versão do app

Antes de cada envio novo à loja, aumente em `android/app/build.gradle`:
`versionCode` (+1, inteiro) e `versionName` (ex.: `1.0.1`). O Play recusa
uploads com `versionCode` repetido.
