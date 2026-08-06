// Camada única de acesso aos dados, ciente do ambiente:
// - Navegador / site publicado: chama o server function normalmente.
// - App Android (APK): chama /api/public/rpc do site publicado, que responde
//   com CORS liberado — o WebView local não consegue usar /_serverFn.
import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";

import { isNativeApp, MOBILE_API_BASE } from "./mobile-bridge";
import {
  searchNearbyRestaurants,
  searchRestaurantsByText,
  reverseGeocode,
  geocodeAddress,
  getPlaceDetailsById,
  getRestaurantPlace,
  type NearbyRestaurant,
  type UserPlaceInfo,
  type PlaceData,
} from "./google-places.functions";

type Caller<TIn, TOut> = (opts: { data: TIn }) => Promise<TOut>;

async function remoteCall<TOut>(fn: string, data: unknown): Promise<TOut> {
  const res = await fetch(`${MOBILE_API_BASE}/api/public/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fn, data }),
  });
  const payload = (await res.json().catch(() => null)) as { result?: TOut; error?: string } | null;
  if (!res.ok || !payload || payload.error) {
    throw new Error(payload?.error ?? `Falha na consulta (${res.status})`);
  }
  return payload.result as TOut;
}

function useDataFn<TIn, TOut>(name: string, fn: unknown): Caller<TIn, TOut> {
  const local = useServerFn(fn as never) as unknown as Caller<TIn, TOut>;
  return useCallback(
    (opts: { data: TIn }) => (isNativeApp() ? remoteCall<TOut>(name, opts.data) : local(opts)),
    [local, name],
  );
}

export function useSearchNearbyRestaurants() {
  return useDataFn<
    {
      latitude: number;
      longitude: number;
      radius?: number;
      languageCode?: string;
      regionCode?: string;
    },
    NearbyRestaurant[]
  >("searchNearbyRestaurants", searchNearbyRestaurants);
}

export function useSearchRestaurantsByText() {
  return useDataFn<
    {
      query: string;
      latitude?: number;
      longitude?: number;
      radius?: number;
      languageCode?: string;
      regionCode?: string;
    },
    NearbyRestaurant[]
  >("searchRestaurantsByText", searchRestaurantsByText);
}

export function useReverseGeocode() {
  return useDataFn<{ latitude: number; longitude: number }, UserPlaceInfo>(
    "reverseGeocode",
    reverseGeocode,
  );
}

export function useGeocodeAddress() {
  return useDataFn<{ address: string; regionCode?: string }, UserPlaceInfo | null>(
    "geocodeAddress",
    geocodeAddress,
  );
}

export function useGetPlaceDetailsById() {
  return useDataFn<{ placeId: string }, PlaceData | null>(
    "getPlaceDetailsById",
    getPlaceDetailsById,
  );
}

export function useGetRestaurantPlace() {
  return useDataFn<{ query: string; latitude?: number; longitude?: number }, PlaceData | null>(
    "getRestaurantPlace",
    getRestaurantPlace,
  );
}
