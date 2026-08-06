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