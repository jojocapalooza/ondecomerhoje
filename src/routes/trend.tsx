import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, TrendingUp, Gem, Crown, Navigation } from "lucide-react";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useUserLocation, haversineKm } from "@/lib/favorites";
import {
  searchNearbyRestaurants,
  reverseGeocode,
} from "@/lib/google-places.functions";

type City = {
  name: string;
  lat: number;
  lng: number;
  country: string; // ISO-2
  population: number; // habitantes aproximados
  detected?: boolean;
};

// Metrópoles (1M+ hab). Agrupadas por país para respeitar a localidade do usuário.
const METROPOLISES: City[] = [
  // Brasil
  { name: "São Paulo", lat: -23.5505, lng: -46.6333, country: "BR", population: 12300000 },
  { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, country: "BR", population: 6700000 },
  { name: "Brasília", lat: -15.7939, lng: -47.8828, country: "BR", population: 3100000 },
  { name: "Salvador", lat: -12.9777, lng: -38.5016, country: "BR", population: 2900000 },
  { name: "Fortaleza", lat: -3.7319, lng: -38.5267, country: "BR", population: 2700000 },
  { name: "Belo Horizonte", lat: -19.9167, lng: -43.9345, country: "BR", population: 2500000 },
  { name: "Manaus", lat: -3.119, lng: -60.0217, country: "BR", population: 2200000 },
  { name: "Curitiba", lat: -25.4284, lng: -49.2733, country: "BR", population: 1960000 },
  { name: "Recife", lat: -8.0476, lng: -34.877, country: "BR", population: 1650000 },
  { name: "Porto Alegre", lat: -30.0346, lng: -51.2177, country: "BR", population: 1490000 },
  { name: "Goiânia", lat: -16.6869, lng: -49.2648, country: "BR", population: 1540000 },
  { name: "Belém", lat: -1.4558, lng: -48.4902, country: "BR", population: 1500000 },
  { name: "Campinas", lat: -22.9099, lng: -47.0626, country: "BR", population: 1220000 },
  // Portugal
  { name: "Lisboa", lat: 38.7223, lng: -9.1393, country: "PT", population: 2900000 },
  { name: "Porto", lat: 41.1579, lng: -8.6291, country: "PT", population: 1730000 },
  // Estados Unidos
  { name: "New York", lat: 40.7128, lng: -74.006, country: "US", population: 8300000 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, country: "US", population: 3900000 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, country: "US", population: 2700000 },
  { name: "Houston", lat: 29.7604, lng: -95.3698, country: "US", population: 2300000 },
  { name: "Miami", lat: 25.7617, lng: -80.1918, country: "US", population: 6100000 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194, country: "US", population: 4700000 },
  // Argentina
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816, country: "AR", population: 3100000 },
  { name: "Córdoba", lat: -31.4201, lng: -64.1888, country: "AR", population: 1500000 },
  { name: "Rosario", lat: -32.9442, lng: -60.6505, country: "AR", population: 1300000 },
  // Espanha
  { name: "Madrid", lat: 40.4168, lng: -3.7038, country: "ES", population: 3300000 },
  { name: "Barcelona", lat: 41.3851, lng: 2.1734, country: "ES", population: 1620000 },
  // México
  { name: "Ciudad de México", lat: 19.4326, lng: -99.1332, country: "MX", population: 9200000 },
  { name: "Guadalajara", lat: 20.6597, lng: -103.3496, country: "MX", population: 1460000 },
  // Reino Unido
  { name: "London", lat: 51.5074, lng: -0.1278, country: "GB", population: 9000000 },
  // França
  { name: "Paris", lat: 48.8566, lng: 2.3522, country: "FR", population: 2100000 },
  // Itália
  { name: "Roma", lat: 41.9028, lng: 12.4964, country: "IT", population: 2800000 },
  { name: "Milano", lat: 45.4642, lng: 9.19, country: "IT", population: 1370000 },
];

type Mode = "trending" | "hidden" | "must" | "closest";
const MODES: Array<{ id: Mode; label: string; icon: typeof TrendingUp; hint: string }> = [
  { id: "trending", label: "Em Alta", icon: TrendingUp, hint: "reviews × rating" },
  { id: "hidden", label: "Achadinhos", icon: Gem, hint: "gemas com poucas reviews" },
  { id: "must", label: "Imperdíveis", icon: Crown, hint: "consagrados pela crítica" },
  { id: "closest", label: "Mais Próximo", icon: Navigation, hint: "perto de você" },
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

  // País do usuário; fallback Brasil quando não há geo.
  const userCountry = geoQuery.data?.countryCode ?? "BR";

  // Metrópole detectada = cidade do reverse geocode SE ela é uma metrópole conhecida,
  // caso contrário a metrópole mais próxima do mesmo país.
  const cities: City[] = useMemo(() => {
    const sameCountry = METROPOLISES.filter((c) => c.country === userCountry);
    const pool = sameCountry.length > 0 ? sameCountry : METROPOLISES;

    let detected: City | null = null;
    if (loc) {
      const nearest = [...pool].sort(
        (a, b) =>
          haversineKm(loc, { lat: a.lat, lng: a.lng }) -
          haversineKm(loc, { lat: b.lat, lng: b.lng }),
      )[0];
      const detectedName = geoQuery.data?.city;
      const matchByName = detectedName
        ? pool.find((c) => c.name.toLowerCase() === detectedName.toLowerCase())
        : null;
      detected = { ...(matchByName ?? nearest), detected: true };
    }

    const rest = pool
      .filter((c) => c.name !== detected?.name)
      .sort((a, b) => {
        if (loc) {
          return (
            haversineKm(loc, { lat: a.lat, lng: a.lng }) -
            haversineKm(loc, { lat: b.lat, lng: b.lng })
          );
        }
        return b.population - a.population;
      })
      .slice(0, 7);
    return detected ? [detected, ...rest] : rest;
  }, [loc, geoQuery.data?.city, userCountry]);

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && cities[0]) setSelected(cities[0].name);
  }, [cities, selected]);
  useEffect(() => {
    // Se o país mudou e a cidade selecionada não pertence mais à lista, reseta.
    if (selected && cities.length && !cities.some((c) => c.name === selected)) {
      setSelected(cities[0].name);
    }
  }, [cities, selected]);

  const city = cities.find((c) => c.name === selected) ?? cities[0];
  const [mode, setMode] = useState<Mode>("trending");

  const nearby = useQuery({
    queryKey: ["trend-nearby", city?.name, city?.lat, city?.lng],
    queryFn: () =>
      fetchNearby({
        data: {
          latitude: city!.lat,
          longitude: city!.lng,
          radius: 20000,
          regionCode: userCountry,
        },
      }),
    enabled: !!city,
    staleTime: 5 * 60 * 1000,
  });

  const list = useMemo(() => {
    const data = nearby.data ?? [];
    const origin = loc ?? (city ? { lat: city.lat, lng: city.lng } : null);
    const enriched = data
      .filter((r) => r.rating > 0 && r.reviews > 0)
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
        distance: origin
          ? +haversineKm(origin, { lat: r.latitude, lng: r.longitude }).toFixed(1)
          : 0,
      }));

    const score = (r: (typeof enriched)[number]) => {
      switch (mode) {
        // 📈 Em Alta: volume × qualidade
        case "trending":
          return r.reviews * r.rating;
        // 💎 Achadinhos: alta nota com pouca exposição
        case "hidden":
          return r.reviews >= 10 && r.reviews <= 400 && r.rating >= 4.3
            ? r.rating / Math.log10(r.reviews + 10)
            : -Infinity;
        // 👑 Imperdíveis: consagrados (muitas reviews + nota bem acima de 4)
        case "must":
          return r.reviews * Math.max(r.rating - 4.0, 0);
        // 📍 Mais Próximo: proximidade priorizada, ponderada por rating
        case "closest":
          return (r.rating || 3) / (r.distance + 0.3);
      }
    };

    return enriched
      .map((r) => ({ r, s: score(r) }))
      .filter((x) => Number.isFinite(x.s))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.r)
      .slice(0, 24);
  }, [nearby.data, loc, city, mode]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" />
            {city?.detected ? "Metrópole detectada" : "Metrópole"}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Best Trend em {city?.name ?? "sua região"}</h1>
          <p className="mt-1 text-muted-foreground">
            {loc && geoQuery.data?.city
              ? `Ranking real do Google Maps em metrópoles próximas de ${geoQuery.data.city}${
                  geoQuery.data.country ? `, ${geoQuery.data.country}` : ""
                }.`
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

      {/* Modos de ranking */}
      <div className="mt-6 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border hover:bg-muted"
              }`}
              title={m.hint}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{m.label}</span>
              <span
                className={`hidden text-xs sm:inline ${
                  active ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                · {m.hint}
              </span>
            </button>
          );
        })}
      </div>

      {nearby.isLoading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Sem resultados para este modo em {city?.name}. Tente outro filtro ou outra metrópole próxima.
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