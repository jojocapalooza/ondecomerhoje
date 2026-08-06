# Gerar o APK e o AAB partindo do Lovable — passo a passo completo

Este guia assume que você **não tem nada instalado** no computador. Tudo é feito
pelo Lovable + GitHub (build na nuvem). O computador só é usado para baixar o
arquivo e, se você quiser, criar a chave de assinatura.

Resumo do fluxo:

```text
Lovable (código)  ->  GitHub (repositório)  ->  GitHub Actions (build)
      |                                              |
   Publish (API do app)                        APK / AAB para download
```

---

## Parte 0 — Publique o site antes de tudo (obrigatório)

O app Android é a interface **dentro do APK**, mas os dados (Google Places,
restaurantes, fotos) vêm da API do site publicado
(`https://ondecomerhoje.lovable.app`).

1. No Lovable, botão **Publish** (canto superior direito no desktop; no celular,
   `...` no canto inferior direito → **Publish**).
2. Confirme **Update**. Espere terminar.
3. Abra `https://ondecomerhoje.lovable.app` no navegador e confirme que a Home
   carrega restaurantes.

Se o site não estiver publicado, o app instala e abre, mas fica sem resultados.

> Se um dia você mudar de domínio, altere `VITE_MOBILE_API_BASE` (ou o valor
> padrão em `src/lib/mobile-bridge.ts`) e gere um APK novo.

---

## Parte 1 — Conectar o Lovable ao GitHub

1. No editor do Lovable, clique no **+** (Plus) na caixa de chat, embaixo à
   esquerda → **GitHub** → **Connect project**.
   - No celular: modo **Chat** → **+** → **GitHub**.
2. Autorize o **Lovable GitHub App** na tela do GitHub.
3. Escolha a conta/organização onde o repositório vai nascer.
4. Clique em **Create Repository**.

Ao terminar, o Lovable mostra o link do repositório. Tudo que já está no projeto
(incluindo os workflows `.github/workflows/android.yml` e
`android-release.yml`) vai junto no primeiro push.

O sync é bidirecional: cada mudança que você fizer no Lovable vira um commit
novo no GitHub, e cada commit dispara o build do APK debug automaticamente.

---

## Parte 2 — APK debug (para instalar no seu celular hoje)

O APK debug é assinado com a chave de depuração do Android. Serve para uso
pessoal e testes; **não serve** para a Play Store.

### 2.1 Rodar o build

1. Abra o repositório no GitHub.
2. Aba **Actions** (topo). Se aparecer "Workflows aren't being run on this
   forked repository", clique em **I understand my workflows, go ahead and
   enable them**.
3. Na barra lateral, clique em **Android APK**.
4. Botão **Run workflow** → branch `main` → **Run workflow**.
   (Ou simplesmente faça qualquer alteração no Lovable: o push na `main` já
   dispara sozinho.)

### 2.2 Acompanhar

Clique no run em andamento. As etapas aparecem em ordem:

| Etapa | O que faz | Tempo típico |
|---|---|---|
| Instalar dependências | `bun install` | 30–60 s |
| Gerar pacote web embutido | `bun run mobile:web` (renderiza a Home em HTML e limpa sourcemaps) | 1–2 min |
| Criar projeto Android | `bunx cap add android` | 20 s |
| Sincronizar Capacitor | copia `dist/client` para dentro do projeto nativo | 10 s |
| Enxugar o APK | R8, shrinkResources, ABIs `arm64-v8a`/`armeabi-v7a`, idiomas `pt`/`pt-rBR`/`en` | 5 s |
| Build do APK (debug) | `./gradlew assembleDebug` | 3–6 min |
| Tamanho do APK | imprime o `ls -lh` do arquivo | 1 s |

Total: **~6 a 10 minutos** (o primeiro é o mais lento porque baixa o Gradle e o
Android SDK).

### 2.3 Baixar

1. No fim da página do run, seção **Artifacts**.
2. Baixe **`onde-comer-hoje-apk`** (vem como `.zip`).
3. Descompacte: dentro está `app-debug.apk`.

### 2.4 Instalar no celular

1. Mande o `app-debug.apk` para o telefone (Google Drive, WhatsApp para si
   mesmo, Telegram, cabo USB — qualquer caminho).
2. Toque no arquivo. O Android vai avisar que a origem é desconhecida.
3. **Configurações → Permitir desta fonte** (ou "Instalar apps desconhecidos")
   para o app pelo qual você abriu o arquivo → volte e **Instalar**.
4. Abra **Onde Comer Hoje**. Na primeira busca ele pede **permissão de
   localização** — aceite "Ao usar o app" (o GPS vem do plugin nativo
   `@capacitor/geolocation`).

### 2.5 Se der erro

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "App não instalado" | já existe uma versão assinada com outra chave | desinstale a versão antiga e instale de novo |
| Tela branca ao abrir | pacote web não gerado | veja se a etapa "Gerar pacote web embutido" passou; rode o workflow de novo |
| Abre, mas sem restaurantes | site não publicado ou offline | publique no Lovable e teste `ondecomerhoje.lovable.app` no navegador |
| Não pede localização | permissão negada antes | Ajustes do Android → Apps → Onde Comer Hoje → Permissões → Localização |
| Workflow falha em `gradlew` | cache/SDK instável no runner | **Re-run all jobs** no GitHub |

---

## Parte 3 — AAB assinado (para a Google Play Store)

A Play Store só aceita **.aab assinado com a sua chave de release**. A chave é
criada **uma única vez** e nunca pode ser perdida — sem ela você não consegue
atualizar o app publicado.

### 3.1 Criar a chave (keystore)

Precisa do `keytool`, que vem com o Java (JDK 21). Se você não quiser instalar
nada, use o Android Studio (**Build → Generate Signed Bundle → Create new...**),
que faz o mesmo pela interface.

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias ondecomerhoje
```

Ele pede: senha do keystore, seu nome, organização, cidade, país (BR) e
confirmação. Guarde em local seguro:

- o arquivo `release.jks`
- a senha do keystore
- o alias (`ondecomerhoje`)
- a senha da chave (normalmente a mesma do keystore)

### 3.2 Converter a chave em texto

O GitHub só guarda texto, então o `.jks` vai em base64:

```bash
# Linux
base64 -w0 release.jks > release.b64
# macOS
base64 -i release.jks -o release.b64
```

### 3.3 Cadastrar os secrets no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository
secret**. Crie os quatro, com estes nomes exatos:

| Nome | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | todo o conteúdo do `release.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `ondecomerhoje` |
| `ANDROID_KEY_PASSWORD` | senha da chave |

Esses são secrets **do GitHub**, não secrets do Lovable — o build acontece no
GitHub, então é lá que eles precisam estar.

### 3.4 Rodar o release

**Actions → Android Release (APK + AAB) → Run workflow**.
(Alternativa: criar uma tag `v1.0.0` e dar push — o workflow também escuta
tags `v*`.)

Baixe o artefato **`onde-comer-hoje-release`**, que contém:

- `app-release.apk` — instalável direto no celular, já assinado com a sua chave
- `app-release.aab` — o arquivo que sobe para a Play Store

Sem os secrets o workflow ainda roda, mas os arquivos saem **sem assinatura**
(serve só para medir tamanho).

### 3.5 Antes de cada nova versão na loja

Em `android/app/build.gradle` aumente:

- `versionCode` → inteiro, sempre +1 (a Play recusa repetido)
- `versionName` → texto visível, ex. `1.0.1`

Como a pasta `android/` é criada pelo workflow a cada run, o caminho estável é
editar isso no `scripts/android-slim.mjs` (peça aqui no Lovable que eu ajusto a
versão para você antes do build).

### 3.6 Enviar para a Play Store

1. Conta de desenvolvedor no **Google Play Console** (taxa única de US$ 25).
2. **Criar app**: nome "Onde Comer Hoje", idioma pt-BR, tipo App, gratuito.
3. **Produção → Criar novo lançamento** → upload do `app-release.aab`.
4. Deixe o **Play App Signing** ativado (recomendado pelo Google).
5. Preencha a ficha da loja:
   - ícone 512×512 PNG
   - capa 1024×500
   - 2 a 8 screenshots de telefone
   - descrição curta e completa
   - URL pública de política de privacidade
6. **Segurança dos dados**: declare **localização precisa**, usada para sugerir
   restaurantes próximos, não compartilhada com terceiros.
7. Classificação de conteúdo, público-alvo e países.
8. **Enviar para revisão** — costuma levar de 1 a 7 dias.

---

## Parte 4 — Ciclo do dia a dia

| Você mudou... | Precisa de APK novo? |
|---|---|
| Texto, cores, telas, filtros (frontend) | **Sim** — rode o workflow de novo |
| Lógica de busca no servidor / Google Places | Não — basta **Publish** no Lovable |
| Domínio da API | Sim (e atualizar `VITE_MOBILE_API_BASE`) |

Ou seja: com o app instalado, melhorias de dados chegam sozinhas; mudanças de
interface exigem um novo APK.

---

## Parte 5 — Caminho local (opcional, se quiser buildar no seu PC)

Requisitos: **JDK 21** + **Android Studio** (traz o SDK).

```bash
bun install
bun run android:add     # só a primeira vez, cria a pasta android/
bun run android:apk     # web + sync + slim + assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk

# release assinado:
export ANDROID_KEYSTORE_PATH=./release.jks
export ANDROID_KEYSTORE_PASSWORD='sua-senha'
export ANDROID_KEY_ALIAS=ondecomerhoje
export ANDROID_KEY_PASSWORD='sua-senha'
bun run android:aab     # -> android/app/build/outputs/bundle/release/app-release.aab
bun run android:release # -> .../apk/release/app-release.apk
```

`bun run android:open` abre no Android Studio, onde o botão **Run ▶** instala
direto no celular ligado por USB (com Depuração USB ativada).

---

## Parte 6 — O que já está pronto no projeto

| Arquivo | Papel |
|---|---|
| `capacitor.config.ts` | ID `com.ondecomerhoje.app`, nome "Onde Comer Hoje", `webDir: dist/client`, sem `server.url` (100% embutido) |
| `scripts/build-mobile.mjs` | build + renderiza a Home em HTML estático, remove sourcemaps e arquivos inúteis (~620 KB) |
| `scripts/android-slim.mjs` | R8, shrinkResources, 2 ABIs, 3 idiomas, sem metadados de dependência |
| `scripts/android-signing.mjs` | injeta a assinatura de release no `build.gradle` a partir dos secrets |
| `src/lib/mobile-bridge.ts` | redireciona só `/_serverFn/*` e `/api/*` para a API publicada |
| `src/lib/favorites.ts` | GPS nativo via `@capacitor/geolocation` no app, API do navegador na web |
| `.github/workflows/android.yml` | APK debug a cada push na `main` |
| `.github/workflows/android-release.yml` | APK + AAB assinados, manual ou por tag `v*` |

Única dependência nativa: `@capacitor/geolocation`. Permissão pedida: apenas
localização.
