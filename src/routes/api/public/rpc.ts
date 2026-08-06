// Ponte HTTP pública usada pelo app Android.
//
// No APK o WebView roda em https://localhost, então uma chamada para
// /_serverFn/... do site publicado é bloqueada pelo navegador (CORS) — era a
// causa do "Não foi possível buscar restaurantes agora" mesmo com GPS e
// internet OK. Este endpoint expõe as mesmas consultas com cabeçalhos CORS.
//
// Segurança: só leitura de dados públicos do Google Places (nenhum dado de
// usuário, nenhuma escrita). A chave da API continua no servidor.
import { createFileRoute } from "@tanstack/react-router";

import {
  searchNearbyRestaurants,
  searchRestaurantsByText,
  reverseGeocode,
  geocodeAddress,
  getPlaceDetailsById,
  getRestaurantPlace,
} from "@/lib/google-places.functions";

const HANDLERS = {
  searchNearbyRestaurants,
  searchRestaurantsByText,
  reverseGeocode,
  geocodeAddress,
  getPlaceDetailsById,
  getRestaurantPlace,
} as const;

export type RpcName = keyof typeof HANDLERS;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/rpc")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: { fn?: string; data?: unknown };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        const fn = payload.fn;
        if (!fn || !(fn in HANDLERS)) return json({ error: "unknown_fn" }, 400);
        try {
          const handler = HANDLERS[fn as RpcName] as (opts: {
            data: unknown;
          }) => Promise<unknown>;
          const result = await handler({ data: payload.data });
          return json({ result: result ?? null });
        } catch (error) {
          console.error(`[rpc:${fn}]`, error);
          return json(
            { error: error instanceof Error ? error.message : "unexpected_error" },
            500,
          );
        }
      },
    },
  },
});
