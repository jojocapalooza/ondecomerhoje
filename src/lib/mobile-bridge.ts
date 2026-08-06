// Ponte entre o app embutido no APK (Capacitor) e a API do site publicado.
//
// No APK, o WebView serve os arquivos locais em https://localhost, então uma
// chamada relativa como POST /_serverFn/... não encontraria backend algum.
// Aqui reescrevemos apenas essas chamadas de dados para a origem publicada.
// Todo o resto (HTML, JS, CSS, imagens) continua vindo de dentro do aparelho.

export const MOBILE_API_BASE =
  (import.meta.env["VITE_MOBILE_API_BASE"] as string | undefined)?.replace(/\/$/, "") ||
  "https://ondecomerhoje.lovable.app";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap && (cap.isNativePlatform?.() ?? true);
}

// As consultas de dados no APK passam por /api/public/rpc (com CORS liberado).
// /_serverFn não funciona de origem cruzada, por isso não é reescrito aqui.
const REMOTE_PATHS = ["/api/"];

function needsRemote(path: string) {
  return REMOTE_PATHS.some((p) => path.startsWith(p));
}

let installed = false;

/** Chamado uma vez no cliente. Sem efeito no navegador comum. */
export function installMobileBridge() {
  if (installed || typeof window === "undefined" || !isNativeApp()) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string" && needsRemote(input)) {
        return originalFetch(MOBILE_API_BASE + input, init);
      }
      if (input instanceof URL && needsRemote(input.pathname)) {
        return originalFetch(MOBILE_API_BASE + input.pathname + input.search, init);
      }
      if (input instanceof Request) {
        const url = new URL(input.url, window.location.origin);
        if (url.origin === window.location.origin && needsRemote(url.pathname)) {
          return originalFetch(
            new Request(MOBILE_API_BASE + url.pathname + url.search, input),
            init,
          );
        }
      }
    } catch {
      // qualquer erro de parsing cai no fetch original
    }
    return originalFetch(input as RequestInfo, init);
  };
}