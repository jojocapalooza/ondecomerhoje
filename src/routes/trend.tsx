import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReverseGeocode, useSearchNearbyRestaurants } from "@/lib/data-rpc";
import { MapPin, Flame, Gem, Trophy, Navigation, Clock } from "lucide-react";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useUserLocation, haversineKm } from "@/lib/favorites";

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

type Mode = "trending" | "gems" | "top" | "nearby";
const MODES: Array<{ id: Mode; label: string; icon: typeof Flame; hint: string; emoji: string }> = [
  { id: "trending", label: "Em Alta", icon: Flame, emoji: "🔥", hint: "no auge da popularidade" },
  { id: "gems", label: "Achadinhos", icon: Gem, emoji: "💎", hint: "segredos dos locais" },
  { id: "top", label: "Consagrados", icon: Trophy, emoji: "🏆", hint: "clássicos de reputação sólida" },
  { id: "nearby", label: "Próximos", icon: Navigation, emoji: "📍", hint: "perto de você agora" },
];

function modeDescription(mode: Mode, city?: string): string {
  switch (mode) {
    case "trending":
      return `Lugares no pico de popularidade em ${city ?? "sua região"}: nota alta e volume de reviews em faixa de crescimento — nem estreantes, nem clássicos saturados.`;
    case "gems":
      return `Os segredos mais bem guardados de ${city ?? "sua cidade"}: notas altíssimas com público ainda enxuto, o tipo de lugar que morador local recomenda.`;
    case "top":
      return `Clássicos consagrados de ${city ?? "sua cidade"}: reputação sustentada com muito volume e nota consistentemente alta ao longo do tempo.`;
    case "nearby":
      return `Ao alcance dos seus passos agora — proximidade real, priorizando quem está aberto e o que faz sentido para o horário atual.`;
  }
}

// Pesos contextuais por horário do dia para o modo Próximos.
// A busca traz `cuisine` normalizado em pt-BR — usamos como proxy de intenção.
function contextualWeight(cuisine: string, hour: number, isWeekend: boolean): number {
  if (hour >= 5 && hour < 11) {
    if (cuisine === "Café" || cuisine === "Padaria") return 1.6;
    if (cuisine === "Bar") return 0.55;
    return 1;
  }
  if (hour >= 11 && hour < 15) {
    if (cuisine === "Bar") return 0.75;
    if (cuisine === "Café" || cuisine === "Padaria") return 0.9;
    return 1.15;
  }
  if (hour >= 15 && hour < 18) {
    if (cuisine === "Café" || cuisine === "Padaria") return 1.35;
    if (cuisine === "Bar") return 0.85;
    return 1;
  }
  if (hour >= 18 && hour < 23) {
    if (cuisine === "Bar") return isWeekend ? 1.55 : 1.25;
    if (cuisine === "Pizzaria" || cuisine === "Hambúrguer") return 1.3;
    if (cuisine === "Café" || cuisine === "Padaria") return 0.75;
    return 1.15;
  }
  if (cuisine === "Bar") return 1.7;
  if (cuisine === "Hambúrguer" || cuisine === "Pizzaria" || cuisine === "Fast Food") return 1.4;
  if (cuisine === "Café" || cuisine === "Padaria") return 0.55;
  return 0.9;
}

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
  const loc = useUserLocation().location;
  const fetchGeo = useReverseGeocode();
  const fetchNearby = useSearchNearbyRestaurants();

  const geoQuery = useQuery({
    queryKey: ["geo", loc?.lat, loc?.lng],
    queryFn: () => fetchGeo({ data: { latitude: loc!.lat, longitude: loc!.lng } }),
    enabled: !!loc,
    staleTime: 60 * 60 * 1000,
  });

  // País do usuário; fallback Brasil quando não há geo.
  const userCountry = geoQuery.data?.countryCode ?? "BR";

  // Cidade principal = a cidade REAL do usuário (do reverse geocode), mesmo
  // que não seja metrópole. As demais opções são apenas cidades AO REDOR
  // (mesmo país, até ~150 km) — nunca cidades aleatórias de longe.
  const cities: City[] = useMemo(() => {
    const sameCountry = METROPOLISES.filter((c) => c.country === userCountry);
    const detectedName = geoQuery.data?.city;

    let detected: City | null = null;
    if (loc) {
      const matchByName = detectedName
        ? sameCountry.find((c) => c.name.toLowerCase() === detectedName.toLowerCase())
        : null;
      detected = matchByName
        ? { ...matchByName, detected: true }
        : {
            name: detectedName ?? "Sua cidade",
            lat: loc.lat,
            lng: loc.lng,
            country: userCountry,
            population: 0,
            detected: true,
          };
    }

    const AROUND_KM = 150;
    const rest = loc
      ? sameCountry
          .filter((c) => c.name !== detected?.name)
          .map((c) => ({ c, d: haversineKm(loc, { lat: c.lat, lng: c.lng }) }))
          .filter((x) => x.d <= AROUND_KM)
          .sort((a, b) => a.d - b.d)
          .slice(0, 5)
          .map((x) => x.c)
      : (sameCountry.length > 0 ? sameCountry : METROPOLISES)
          .sort((a, b) => b.population - a.population)
          .slice(0, 6);
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
  const activeMode = MODES.find((m) => m.id === mode)!;

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
        openNow: r.openNow,
        distance: origin
          ? +haversineKm(origin, { lat: r.latitude, lng: r.longitude }).toFixed(1)
          : 0,
      }));

    // Thresholds relativos à cidade — evita hardcode global e adapta-se à densidade local.
    const reviewsSorted = enriched.map((r) => r.reviews).sort((a, b) => a - b);
    const percentile = (p: number) =>
      reviewsSorted.length
        ? reviewsSorted[Math.min(reviewsSorted.length - 1, Math.floor(p * reviewsSorted.length))]
        : 0;
    const p25 = percentile(0.25);
    const p60 = percentile(0.6);
    const p85 = percentile(0.85);

    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    const score = (r: (typeof enriched)[number]) => {
      switch (mode) {
        // 🔥 Em Alta — proxy de "spike": nota forte + volume em faixa de crescimento (sino em ~600 reviews).
        case "trending": {
          if (r.rating < 4.3) return -Infinity;
          if (r.reviews < Math.max(80, p25)) return -Infinity;
          if (r.reviews > Math.max(2500, p85 * 1.5)) return -Infinity;
          const bell = Math.exp(-Math.pow(Math.log10(r.reviews) - Math.log10(600), 2) / 0.35);
          return Math.pow(r.rating - 3.5, 2) * bell * 100;
        }
        // 💎 Achadinhos — nota altíssima com volume moderado-baixo relativo à cidade.
        case "gems": {
          const min = Math.max(15, Math.min(p25, 30));
          const max = Math.max(350, p60);
          if (r.rating < 4.4) return -Infinity;
          if (r.reviews < min || r.reviews > max) return -Infinity;
          return (r.rating - 3.5) * (1 / Math.log10(r.reviews + 20)) * 10;
        }
        // 🏆 Consagrados — clássicos de alto volume sustentado e nota alta consistente.
        case "top": {
          const heavy = Math.max(800, p85);
          if (r.reviews < heavy) return -Infinity;
          if (r.rating < 4.4) return -Infinity;
          return Math.pow(r.rating - 3.8, 2) * Math.log10(r.reviews + 10);
        }
        // 📍 Próximos — distância + aberto agora + contexto de horário.
        case "nearby": {
          if (r.rating < 3.8) return -Infinity;
          const distancePenalty = 1 / (r.distance + 0.4);
          const openBoost = r.openNow === true ? 1.35 : r.openNow === false ? 0.6 : 1;
          const ctx = contextualWeight(r.cuisine, hour, isWeekend);
          return r.rating * distancePenalty * openBoost * ctx;
        }
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
            {city?.detected ? "Sua cidade" : "Cidade vizinha"}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {activeMode.emoji} {activeMode.label} em {city?.name ?? "sua região"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {modeDescription(mode, city?.name)}
          </p>
          {mode === "nearby" && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Contexto: {new Date().getHours()}h ·{" "}
              {new Date().getDay() === 0 || new Date().getDay() === 6 ? "fim de semana" : "dia útil"}
            </div>
          )}
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
          Sem resultados para este modo em {city?.name}. Tente outro filtro ou uma cidade vizinha acima.
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