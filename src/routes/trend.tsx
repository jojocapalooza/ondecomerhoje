import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useUserLocation, haversineKm } from "@/lib/favorites";
import {
  searchNearbyRestaurants,
  reverseGeocode,
} from "@/lib/google-places.functions";

type City = { name: string; lat: number; lng: number; detected?: boolean };

// Top metrópoles como base — usadas quando o usuário não permite geolocalização
// e como sugestões de cidades próximas quando a detectada não faz parte.
const BASE_CITIES: City[] = [
  { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
  { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { name: "Belo Horizonte", lat: -19.9167, lng: -43.9345 },
  { name: "Brasília", lat: -15.7939, lng: -47.8828 },
  { name: "Curitiba", lat: -25.4284, lng: -49.2733 },
  { name: "Porto Alegre", lat: -30.0346, lng: -51.2177 },
  { name: "Salvador", lat: -12.9777, lng: -38.5016 },
  { name: "Recife", lat: -8.0476, lng: -34.877 },
  { name: "Fortaleza", lat: -3.7319, lng: -38.5267 },
  { name: "Lisboa", lat: 38.7223, lng: -9.1393 },
  { name: "Porto", lat: 41.1579, lng: -8.6291 },
];

export const Route = createFileRoute("/trend")({
  head: () => ({
    meta: [
      { title: "Best Trend — Restaurantes mais bem avaliados" },
      { name: "description", content: "Os restaurantes mais bem avaliados da sua metrópole." },
    ],
  }),
  component: Trend,
});

function Trend() {
  const loc = useUserLocation();
  const fetchGeo = useServerFn(reverseGeocode);
  const fetchNearby = useServerFn(searchNearbyRestaurants);

  const geoQuery = useQuery({
    queryKey: ["geo", loc?.lat, loc?.lng],
    queryFn: () => fetchGeo({ data: { latitude: loc!.lat, longitude: loc!.lng } }),
    enabled: !!loc,
    staleTime: 60 * 60 * 1000,
  });

  // Lista de cidades: detectada primeiro, depois as mais próximas do usuário
  const cities: City[] = useMemo(() => {
    const detected: City | null =
      loc && geoQuery.data?.city
        ? { name: geoQuery.data.city, lat: loc.lat, lng: loc.lng, detected: true }
        : null;
    const rest = [...BASE_CITIES]
      .filter((c) => c.name !== detected?.name)
      .sort((a, b) =>
        loc
          ? haversineKm(loc, { lat: a.lat, lng: a.lng }) -
            haversineKm(loc, { lat: b.lat, lng: b.lng })
          : 0,
      )
      .slice(0, 6);
    return detected ? [detected, ...rest] : rest;
  }, [loc, geoQuery.data?.city]);

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && cities[0]) setSelected(cities[0].name);
  }, [cities, selected]);

  const city = cities.find((c) => c.name === selected) ?? cities[0];

  const nearby = useQuery({
    queryKey: ["trend-nearby", city?.name, city?.lat, city?.lng],
    queryFn: () =>
      fetchNearby({
        data: {
          latitude: city!.lat,
          longitude: city!.lng,
          radius: 15000,
          regionCode: geoQuery.data?.countryCode,
        },
      }),
    enabled: !!city,
    staleTime: 5 * 60 * 1000,
  });

  const list = useMemo(() => {
    const data = nearby.data ?? [];
    return data
      .map((r) => ({
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        rating: r.rating,
        reviews: r.reviews,
        priceLevel: r.priceLevel,
        photo: r.photo,
        latitude: r.latitude,
        longitude: r.longitude,
        distance: loc
          ? +haversineKm(loc, { lat: r.latitude, lng: r.longitude }).toFixed(1)
          : +haversineKm(
              { lat: city!.lat, lng: city!.lng },
              { lat: r.latitude, lng: r.longitude },
            ).toFixed(1),
      }))
      // Ranking mantém rating x volume, com leve penalidade por distância.
      .sort(
        (a, b) =>
          b.rating * Math.log(b.reviews + 1) - b.distance * 0.4 -
          (a.rating * Math.log(a.reviews + 1) - a.distance * 0.4),
      );
  }, [nearby.data, loc, city]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" /> Metrópole
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Best Trend em {city?.name ?? "sua região"}</h1>
          <p className="mt-1 text-muted-foreground">
            {loc && geoQuery.data?.city
              ? `Ranking real do Google Maps para ${geoQuery.data.city} e cidades próximas.`
              : "Ative a localização para ver o ranking real perto de você."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c.name)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                city?.name === c.name
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {c.detected ? "📍 " : ""}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {nearby.isLoading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Sem resultados no Google Maps para esta região.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r, i) => (
            <div key={r.id} className="relative">
              <div className="absolute -left-2 -top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-foreground text-background text-sm font-bold shadow-lg">
                {i + 1}
              </div>
              <RestaurantCard r={r} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}