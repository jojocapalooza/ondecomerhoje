import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Search, MapPin, Star, TrendingUp, Clock, Utensils } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { RestaurantCard } from "@/components/RestaurantCard";
import { restaurants, SPECIAL_CATEGORIES, CATEGORY_QUERY_TERMS } from "@/lib/restaurants";
import { getSearchHistory, pushSearch, clearSearchHistory, useUserLocation, haversineKm } from "@/lib/favorites";
import {
  searchNearbyRestaurants,
  searchRestaurantsByText,
  reverseGeocode,
  type NearbyRestaurant,
} from "@/lib/google-places.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

type Tab = "restaurante" | "localidade";
type Sort = "stars" | "best" | "reviews" | "near";

function Home() {
  const [tab, setTab] = useState<Tab>("restaurante");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState<Sort>("best");
  const [history, setHistory] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [visible, setVisible] = useState(9);
  const [showAuto, setShowAuto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const userLoc = useUserLocation();
  const fetchNearby = useServerFn(searchNearbyRestaurants);
  const fetchText = useServerFn(searchRestaurantsByText);
  const fetchGeo = useServerFn(reverseGeocode);

  // Reverse geocode: descobre país/cidade para adaptar região
  const geoQuery = useQuery({
    queryKey: ["geo", userLoc?.lat, userLoc?.lng],
    queryFn: () => fetchGeo({ data: { latitude: userLoc!.lat, longitude: userLoc!.lng } }),
    enabled: !!userLoc,
    staleTime: 60 * 60 * 1000,
  });
  const regionCode = geoQuery.data?.countryCode;

  // Combina texto digitado (nome do restaurante OU nome de prato) +
  // palavras-chave das categorias especiais selecionadas. É isso que
  // é enviado ao Google Places para achar pratos como "feijoada",
  // "sushi de salmão", ou filtrar por Vegan/Pet-friendly/Brunch etc.
  const specialSelected = useMemo(
    () =>
      filters.cuisines.filter((c) =>
        (SPECIAL_CATEGORIES as readonly string[]).includes(c),
      ),
    [filters.cuisines],
  );
  const classicSelected = useMemo(
    () =>
      filters.cuisines.filter(
        (c) => !(SPECIAL_CATEGORIES as readonly string[]).includes(c),
      ),
    [filters.cuisines],
  );
  const effectiveQuery = useMemo(() => {
    const parts = [
      debounced,
      ...specialSelected.map((s) => CATEGORY_QUERY_TERMS[s] ?? s),
    ].filter(Boolean);
    return parts.join(" ").trim();
  }, [debounced, specialSelected]);

  // Lista de restaurantes: por texto (quando há busca) ou por proximidade
  const nearbyQuery = useQuery({
    queryKey: ["nearby", userLoc?.lat, userLoc?.lng, regionCode],
    queryFn: () =>
      fetchNearby({
        data: {
          latitude: userLoc!.lat,
          longitude: userLoc!.lng,
          radius: 5000,
          regionCode,
        },
      }),
    enabled: !!userLoc && !effectiveQuery,
    staleTime: 5 * 60 * 1000,
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
  });

  const remoteList: NearbyRestaurant[] | undefined = effectiveQuery
    ? textQuery.data
    : nearbyQuery.data;
  const loadingRemote = effectiveQuery ? textQuery.isLoading : nearbyQuery.isLoading;
  const usingRemote = !!userLoc && !!remoteList;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => setHistory(getSearchHistory()), []);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const src = usingRemote && remoteList ? remoteList : restaurants;
    return src.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query, usingRemote, remoteList]);

  const filtered = useMemo(() => {
    // Base: dados reais do Google Places (se houver geolocalização), senão fallback mock.
    const base = usingRemote && remoteList
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
          isNew: false,
          promo: false,
        }))
      : restaurants;
    const withDist = base.map((r) => ({
      ...r,
      distance: userLoc
        ? +haversineKm(userLoc, { lat: r.latitude, lng: r.longitude }).toFixed(1)
        : (r as { distance?: number }).distance ?? 0,
    }));
    let list = withDist.filter((r) => {
      // Quando usamos dados do Google, ele já casou por texto (nome, prato,
      // categoria). Só aplicamos o filtro local de texto no fallback mock.
      if (!usingRemote && debounced) {
        const q = debounced.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !r.cuisine.toLowerCase().includes(q)
        )
          return false;
      }
      // Rodízio é exclusivo para all-you-can-eat / buffet livre. O Google
      // devolve churrascarias à la carte junto — filtramos por indícios no
      // nome ou tipo do lugar.
      if (specialSelected.includes("Rodízio")) {
        const hay = `${r.name} ${r.cuisine}`.toLowerCase();
        const isAyce =
          (r as { allYouCanEat?: boolean }).allYouCanEat ||
          /\b(rod[íi]zios?|all[-\s]?you[-\s]?can[-\s]?eat|coma(?:r)?\s+(?:à|a)\s+vontade|(?:à|a)\s+vontade|buffet\s+(?:livre|(?:à|a)\s+vontade|pre[çc]o\s+fixo)|pre[çc]o\s+fixo|valor\s+fixo|fixed\s+price|espeto\s+corrido|sequ[êe]ncia\s+(?:livre|(?:à|a)\s+vontade))\b/.test(
            hay,
          );
        if (!isAyce) return false;
      }
      // Categorias clássicas (Italiana, Japonesa, …) filtram por rótulo.
      // Categorias especiais (Vegan, Brunch, …) já entraram como palavra-chave
      // no textSearch — não filtramos localmente porque o Google raramente
      // devolve esse rótulo em `cuisine`.
      if (classicSelected.length && !classicSelected.includes(r.cuisine)) return false;
      if (r.distance > filters.maxDistance) return false;
      if (r.rating < filters.minRating) return false;
      if (filters.priceLevels.length && !filters.priceLevels.includes(r.priceLevel)) return false;
      return true;
    });
    // Proximidade é sempre um fator forte, independente do filtro/aba escolhida.
    // Cada modo mantém seu critério principal, mas a distância penaliza opções distantes.
    const proximityPenalty = (d: number, weight: number) => d * weight;
    switch (sort) {
      case "stars":
        list = [...list].sort(
          (a, b) => (b.rating - proximityPenalty(b.distance, 0.15)) - (a.rating - proximityPenalty(a.distance, 0.15)),
        );
        break;
      case "best":
        list = [...list].sort(
          (a, b) =>
            (b.rating * Math.log(b.reviews + 1) - proximityPenalty(b.distance, 0.4)) -
            (a.rating * Math.log(a.reviews + 1) - proximityPenalty(a.distance, 0.4)),
        );
        break;
      case "reviews":
        list = [...list].sort(
          (a, b) => (Math.log(b.reviews + 1) - proximityPenalty(b.distance, 0.2)) - (Math.log(a.reviews + 1) - proximityPenalty(a.distance, 0.2)),
        );
        break;
      case "near":
        list = [...list].sort((a, b) => a.distance - b.distance);
        break;
    }
    return list;
  }, [debounced, filters, classicSelected, specialSelected, sort, userLoc, usingRemote, remoteList]);

  function startVoice() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Reconhecimento de voz não é suportado neste navegador.");
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    setListening(true);
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setQuery(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  }

  function submitSearch(q?: string) {
    const v = (q ?? query).trim();
    if (!v) return;
    pushSearch(v);
    setHistory(getSearchHistory());
    setQuery(v);
    setShowAuto(false);
    inputRef.current?.blur();
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-20 text-primary-foreground">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" /> Descoberta inteligente de restaurantes
            </div>
            <h1 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">Onde você quer comer hoje?</h1>
            <p className="mt-3 text-primary-foreground/85 md:text-lg">
              Busque por nome, culinária ou localidade. Encontre o restaurante certo em segundos.
            </p>
          </div>

          {/* Tabs */}
          <div className="mt-8 inline-flex rounded-full bg-white/10 p-1 backdrop-blur">
            {(["restaurante", "localidade"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-5 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === t ? "bg-background text-foreground" : "text-primary-foreground/80 hover:text-primary-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-3 max-w-2xl">
            {tab === "restaurante" ? (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-2xl bg-background p-2 shadow-lg">
                  <div className="pl-2 text-muted-foreground">
                    <Search className="h-5 w-5" />
                  </div>
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowAuto(true)}
                    onBlur={() => setTimeout(() => setShowAuto(false), 150)}
                    onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                    placeholder="Buscar por restaurante, prato ou categoria (ex.: sushi, feijoada, vegan)…"
                    className="h-11 flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none text-base"
                  />
                  <button
                    onClick={startVoice}
                    aria-label="Busca por voz"
                    className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                      listening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                  <Button onClick={() => submitSearch()} className="h-10 rounded-xl">Buscar</Button>
                </div>
                {showAuto && (suggestions.length > 0 || history.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
                    {suggestions.length > 0 && (
                      <div className="p-2">
                        <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestões</div>
                        {suggestions.map((r) => (
                          <button
                            key={r.id}
                            onMouseDown={() => submitSearch(r.name)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                          >
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.cuisine}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {history.length > 0 && (
                      <div className="border-t border-border p-2">
                        <div className="flex items-center justify-between px-3 py-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscas recentes</div>
                          <button
                            onMouseDown={() => {
                              clearSearchHistory();
                              setHistory([]);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            limpar
                          </button>
                        </div>
                        {history.map((h) => (
                          <button
                            key={h}
                            onMouseDown={() => submitSearch(h)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{h}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <MapPreview />
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <Filters value={filters} onChange={setFilters} />
          </aside>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {filtered.length} {filtered.length === 1 ? "restaurante" : "restaurantes"}
                  {usingRemote && geoQuery.data?.city && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      · próximos a {geoQuery.data.city}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {!userLoc
                    ? "Ative a localização para ver restaurantes reais perto de você."
                    : loadingRemote
                      ? "Buscando restaurantes próximos no Google Maps…"
                      : usingRemote
                        ? "Resultados reais do Google Maps, ordenados por proximidade."
                        : "Mostrando prévia local — sem cobertura de dados na sua região."}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["stars", "★ Mais estrelas"],
                  ["best", "Melhor avaliado"],
                  ["reviews", "Mais avaliações"],
                  ["near", "Mais próximo"],
                ] as [Sort, string][]).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sort === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Nenhum restaurante encontrado</p>
                <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.slice(0, visible).map((r) => (
                    <RestaurantCard key={r.id} r={r} />
                  ))}
                </div>
                {visible < filtered.length && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="outline" onClick={() => setVisible((v) => v + 6)}>
                      Carregar mais
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MapPreview() {
  return (
    <div className="rounded-2xl bg-background p-4 shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.92 0.02 210) 1px, transparent 1px), linear-gradient(90deg, oklch(0.92 0.02 210) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {restaurants.slice(0, 8).map((r, i) => {
          const c = r.rating >= 4.5 ? "bg-success" : r.rating >= 3.5 ? "bg-warning" : r.rating >= 2.5 ? "bg-orange-500" : "bg-destructive";
          return (
            <div
              key={r.id}
              className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-md ${c}`}
              style={{ left: `${15 + (i * 11) % 70}%`, top: `${20 + (i * 17) % 60}%` }}
              title={r.name}
            >
              <Star className="h-4 w-4 fill-current" />
            </div>
          );
        })}
        <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-background/95 p-3 text-sm text-foreground shadow-lg backdrop-blur">
          <div className="font-medium">Mapa interativo em preview</div>
          <div className="text-xs text-muted-foreground">
            Para ativar mapa completo com rotas e clustering, conecte uma chave do Google Maps.
          </div>
        </div>
      </div>
    </div>
  );
}
