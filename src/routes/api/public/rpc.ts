// Ponte HTTP pública usada pelo app Android.
//
// No APK o WebView roda em https://localhost, então uma chamada para
// /_serverFn/... do site publicado é bloqueada pelo navegador (CORS) — era a
// causa do "Não foi possível buscar restaurantes agora" mesmo com GPS e
// internet OK. Este endpoint expõe as mesmas consultas com cabeçalhos CORS.
//
// Segurança (camadas aplicadas):
// - só leitura de dados públicos do Google Places (nenhum dado de usuário,
//   nenhuma escrita); a chave da API continua no servidor;
// - payload validado com Zod (limites de raio, tamanho de texto, coordenadas);
// - rate limit por IP (30/min e 500/dia) contra varredura automatizada;
// - erros internos nunca vazam para o cliente.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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

// ---------- validação de entrada (limites duros, chaves extras ignoradas) ----------

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const radius = z.number().int().min(100).max(50_000).optional();
const languageCode = z.string().trim().min(2).max(10).optional();
const regionCode = z.string().trim().length(2).optional();
const query = z.string().trim().min(1).max(120);

const SCHEMAS: Record<RpcName, z.ZodTypeAny> = {
  searchNearbyRestaurants: z.object({
    latitude: lat,
    longitude: lng,
    radius,
    languageCode,
    regionCode,
  }),
  searchRestaurantsByText: z.object({
    query,
    latitude: lat.optional(),
    longitude: lng.optional(),
    radius,
    languageCode,
    regionCode,
  }),
  reverseGeocode: z.object({ latitude: lat, longitude: lng }),
  geocodeAddress: z.object({
    address: z.string().trim().min(2).max(200),
    regionCode,
  }),
  getPlaceDetailsById: z.object({ placeId: z.string().trim().min(2).max(300) }),
  getRestaurantPlace: z.object({
    query,
    latitude: lat.optional(),
    longitude: lng.optional(),
  }),
};

// ---------- rate limit por IP ----------
//
// Best-effort por instância do servidor: suficiente para barrar varreduras
// automatizadas e abuso casual. Um IP legítimo do app faz poucas consultas
// por minuto; 30/min e 500/dia é folgado para uso humano e apertado para bots.

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MAX_PER_MINUTE = 30;
const MAX_PER_DAY = 500;
const MAX_TRACKED_IPS = 10_000;

type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };
const buckets = new Map<string, Bucket>();

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}

function allowRequest(ip: string, now: number): boolean {
  // limpeza oportunista para o mapa não crescer sem limite
  if (buckets.size >= MAX_TRACKED_IPS) {
    for (const [key, b] of buckets) {
      if (now - b.minuteStart > MINUTE_MS && now - b.dayStart > DAY_MS) buckets.delete(key);
    }
    if (buckets.size >= MAX_TRACKED_IPS) buckets.clear();
  }
  let b = buckets.get(ip);
  if (!b) {
    b = { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0 };
    buckets.set(ip, b);
  }
  if (now - b.minuteStart > MINUTE_MS) {
    b.minuteStart = now;
    b.minuteCount = 0;
  }
  if (now - b.dayStart > DAY_MS) {
    b.dayStart = now;
    b.dayCount = 0;
  }
  if (b.minuteCount >= MAX_PER_MINUTE || b.dayCount >= MAX_PER_DAY) return false;
  b.minuteCount += 1;
  b.dayCount += 1;
  return true;
}

// ---------- respostas ----------

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}

export const Route = createFileRoute("/api/public/rpc")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        if (!allowRequest(clientIp(request), Date.now())) {
          return json({ error: "rate_limited" }, 429, { "retry-after": "60" });
        }

        let payload: { fn?: string; data?: unknown };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        const fn = payload.fn;
        if (!fn || !(fn in HANDLERS)) return json({ error: "unknown_fn" }, 400);

        const parsed = SCHEMAS[fn as RpcName].safeParse(payload.data);
        if (!parsed.success) return json({ error: "invalid_input" }, 400);

        try {
          const handler = HANDLERS[fn as RpcName] as (opts: { data: unknown }) => Promise<unknown>;
          const result = await handler({ data: parsed.data });
          return json({ result: result ?? null });
        } catch (error) {
          // detalhe do erro fica no log do servidor; o cliente recebe só um código
          console.error(`[rpc:${fn}]`, error);
          return json({ error: "unexpected_error" }, 500);
        }
      },
    },
  },
});
