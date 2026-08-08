// Camada compartilhada de descoberta de restaurantes usada pela Home e pela
// tela de Sugestões. Mantém a lógica atual (Google Places por proximidade ou
// texto, fallback mock, penalidade por distância) num único lugar.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  useSearchNearbyRestaurants,
  useSearchRestaurantsByText,
  useReverseGeocode,
} from "@/lib/data-rpc";
import { restaurants, SPECIAL_CATEGORIES, CATEGORY_QUERY_TERMS } from "@/lib/restaurants";
import { haversineKm, useUserLocation, type UseUserLocation } from "@/lib/favorites";
import type { NearbyRestaurant } from "@/lib/google-places.functions";

export type DiscoverItem = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  priceLevel: 1 | 2 | 3 | 4;
  photo: string;
  distance: number;
  latitude: number;
  longitude: number;
  allYouCanEat?: boolean;
  isNew?: boolean;
  promo?: boolean;
};

export type SortMode = "stars" | "best" | "reviews" | "near" | "new";

const AYCE_RE =
  /\b(rod[íi]zios?|all[-\s]?you[-\s]?can[-\s]?eat|coma(?:r)?\s+(?:à|a)\s+vontade|(?:a|à)\s+vontade|buffet\s+(?:livre|(?:à|a)\s+vontade)|espeto\s+corrido|sequ[êe]ncia\s+(?:livre|(?:à|a)\s+vontade))\b/;

export function useDiscover({
  query = "",
  cuisines = [],
  geo: externalGeo,
}: {
  query?: string;
  cuisines?: string[];
  geo?: UseUserLocation;
} = {}) {
  const ownGeo = useUserLocation();
  const geo = externalGeo ?? ownGeo;
  const userLoc = geo.location;
  const fetchNearby = useSearchNearbyRestaurants();
  const fetchText = useSearchRestaurantsByText();
  const fetchGeo = useReverseGeocode();

  const geoQuery = useQuery({
    queryKey: ["geo", userLoc?.lat, userLoc?.lng],
    queryFn: () => fetchGeo({ data: { latitude: userLoc!.lat, longitude: userLoc!.lng } }),
    enabled: !!userLoc,
    staleTime: 60 * 60 * 1000,
  });
  const regionCode = geoQuery.data?.countryCode;

  const specialSelected = useMemo(
    () => cuisines.filter((c) => (SPECIAL_CATEGORIES as readonly string[]).includes(c)),
    [cuisines],
  );
  const classicSelected = useMemo(
    () => cuisines.filter((c) => !(SPECIAL_CATEGORIES as readonly string[]).includes(c)),
    [cuisines],
  );

  const effectiveQuery = useMemo(() => {
    const parts = [
      query.trim(),
      ...specialSelected.map((s) => CATEGORY_QUERY_TERMS[s] ?? s),
    ].filter(Boolean);
    return parts.join(" ").trim();
  }, [query, specialSelected]);

  const nearbyQuery = useQuery({
    queryKey: ["nearby", userLoc?.lat, userLoc?.lng, regionCode],
    queryFn: () =>
      fetchNearby({
        data: { latitude: userLoc!.lat, longitude: userLoc!.lng, radius: 5000, regionCode },
      }),
    enabled: !!userLoc && !effectiveQuery,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  const textQuery = useQuery({
    queryKey: ["places-text", effectiveQuery, userLoc?.lat, userLoc?.lng, regionCode],
    queryFn: () =>
      fetchText({
        data: {
          query: effectiveQuery,
          latitude: userLoc?.lat,
          longitude: userLoc?.lng,
          regionCode,
        },
      }),
    enabled: !!effectiveQuery,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const remoteList: NearbyRestaurant[] | undefined = effectiveQuery
    ? textQuery.data
    : nearbyQuery.data;
  const usingRemote = !!userLoc && !!remoteList;

  const items = useMemo<DiscoverItem[]>(() => {
    const base: DiscoverItem[] =
      usingRemote && remoteList
        ? remoteList.map((r) => ({
            id: r.id,
            name: r.name,
            cuisine: r.cuisine,
            rating: r.rating,
            reviews: r.reviews,
            priceLevel: r.priceLevel,
            photo: r.photo,
            latitude: r.latitude,
            longitude: r.longitude,
            allYouCanEat: r.allYouCanEat,
            distance: 0,
          }))
        : restaurants.map((r) => ({
            id: r.id,
            name: r.name,
            cuisine: r.cuisine,
            rating: r.rating,
            reviews: r.reviews,
            priceLevel: r.priceLevel,
            photo: r.photo,
            latitude: r.latitude,
            longitude: r.longitude,
            distance: r.distance,
            isNew: r.isNew,
            promo: r.promo,
          }));

    return base
      .map((r) => ({
        ...r,
        distance: userLoc
          ? +haversineKm(userLoc, { lat: r.latitude, lng: r.longitude }).toFixed(1)
          : r.distance,
      }))
      .filter((r) => {
        if (!usingRemote && query.trim()) {
          const q = query.trim().toLowerCase();
          if (!r.name.toLowerCase().includes(q) && !r.cuisine.toLowerCase().includes(q))
            return false;
        }
        if (specialSelected.includes("Rodízio")) {
          const hay = `${r.name} ${r.cuisine}`.toLowerCase();
          if (!(r.allYouCanEat || AYCE_RE.test(hay))) return false;
        }
        if (classicSelected.length && !classicSelected.includes(r.cuisine)) return false;
        return true;
      });
  }, [usingRemote, remoteList, userLoc, query, specialSelected, classicSelected]);

  return {
    geo,
    city: geoQuery.data?.city,
    countryCode: regionCode,
    items,
    usingRemote,
    isLoading: effectiveQuery ? textQuery.isLoading : nearbyQuery.isLoading,
    error: effectiveQuery ? textQuery.error : nearbyQuery.error,
    refetch: () => void (effectiveQuery ? textQuery.refetch() : nearbyQuery.refetch()),
  };
}

export function sortDiscover(list: DiscoverItem[], mode: SortMode): DiscoverItem[] {
  const p = (d: number, w: number) => d * w;
  const arr = [...list];
  switch (mode) {
    case "stars":
      // Estrelas primeiro (o mais próximo de 5), depois o volume estimado de
      // avaliações 5 estrelas e, por fim, um leve desempate por distância.
      return withFallback(arr, (r) => r.rating >= 4 && r.reviews >= 20).sort(
        (a, b) => starsScore(b) - starsScore(a),
      );
    case "best":
      return arr.sort(
        (a, b) =>
          b.rating * Math.log(b.reviews + 1) -
          p(b.distance, 0.4) -
          (a.rating * Math.log(a.reviews + 1) - p(a.distance, 0.4)),
      );
    case "reviews":
      return arr.sort(
        (a, b) =>
          Math.log(b.reviews + 1) - p(b.distance, 0.2) - (Math.log(a.reviews + 1) - p(a.distance, 0.2)),
      );
    case "new":
      // Sem data de abertura pública: lugares com menos avaliações e boa nota
      // funcionam como proxy de "novidade / recém-descoberto" por perto.
      return arr
        .filter((r) => r.rating >= 4)
        .sort(
          (a, b) =>
            b.rating - Math.log(b.reviews + 1) * 0.35 - p(b.distance, 0.3) -
            (a.rating - Math.log(a.reviews + 1) * 0.35 - p(a.distance, 0.3)),
        );
    case "near":
    default:
      // Distância em primeiro lugar; entre os vizinhos, os mais bem avaliados
      // (nota média alta + muitas avaliações) sobem.
      return withFallback(arr, (r) => r.rating >= 3.8).sort((a, b) => nearScore(a) - nearScore(b));
  }
}

/** Aplica o filtro de qualidade, mas nunca devolve lista vazia. */
function withFallback(arr: DiscoverItem[], ok: (r: DiscoverItem) => boolean) {
  const kept = arr.filter(ok);
  return kept.length >= 3 ? kept : arr;
}

/** Fatia de avaliações 5 estrelas estimada a partir da nota média. */
function fiveStarWeight(r: DiscoverItem) {
  const share = Math.max(0, Math.min(1, (r.rating - 3.4) / 1.6));
  return Math.log10(1 + r.reviews * share);
}

/**
 * "Sugestões para você": prioridade absoluta à nota (quanto mais perto de 5,
 * melhor), reforçada pelo volume de 5 estrelas; a distância só desempata.
 */
function starsScore(r: DiscoverItem) {
  const gapToFive = 5 - r.rating; // 0 = perfeito
  return -gapToFive * 10 + fiveStarWeight(r) * 1.4 - Math.min(r.distance, 15) * 0.08;
}

/**
 * "Perto de você": distância manda (menor = melhor), com desconto para quem é
 * muito bem avaliado (nota alta e muitas avaliações).
 */
function nearScore(r: DiscoverItem) {
  const quality = (r.rating - 3.8) * 0.5 + fiveStarWeight(r) * 0.35;
  return r.distance - Math.min(quality, 1.5);
}