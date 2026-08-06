import type { CapacitorConfig } from "@capacitor/cli";

// App Android do "Onde Comer Hoje".
// O app é totalmente embutido: os arquivos web ficam dentro do APK (webDir),
// não há `server.url` apontando para um site externo. O celular fornece GPS,
// permissões e o WebView; só as consultas de dados saem para a internet.
const config: CapacitorConfig = {
  appId: "com.ondecomerhoje.app",
  appName: "Onde Comer Hoje",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
  server: {
    // https://localhost dentro do WebView permite geolocalização e APIs seguras.
    androidScheme: "https",
  },
};

export default config;