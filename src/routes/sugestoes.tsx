import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { RestaurantCard } from "@/components/RestaurantCard";
import { LocationBar } from "@/components/LocationBar";
import { useDiscover, sortDiscover, type SortMode } from "@/lib/discover";
import { pushSearch } from "@/lib/favorites";
import { readPref, usePersistentState, writePref } from "@/lib/prefs";

type SearchParams = {
  modo: SortMode;
  q?: string;
  culinaria?: string;
};

const MODES: [SortMode, string][] = [
  ["stars", "Mais Estrelas"],
  ["best", "Melhor Avaliado"],
  ["reviews", "Mais Avaliações"],
  ["near", "Mais Próximos"],
];

export const Route = createFileRoute("/sugestoes")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    modo: (["near", "best", "stars", "reviews"].includes(String(search.modo))
      ? String(search.modo)
      : "stars") as SortMode,
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    culinaria:
      typeof search.culinaria === "string" && search.culinaria ? search.culinaria : undefined,
  }),
  component: Sugestoes,
  head: () => ({
    meta: [
      { title: "Sugestões de restaurantes perto de você | Onde Comer Hoje" },
      {
        name: "description",
        content:
          "Veja sugestões de restaurantes próximos: mais perto, novos lugares, mais avaliados e por culinária.",
      },
      { property: "og:title", content: "Sugestões de restaurantes perto de você" },
      {
        property: "og:description",
        content: "Descubra os melhores lugares para comer hoje, ordenados por proximidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Sugestoes() {
  const { modo, q, culinaria } = Route.useSearch();
  const navigate = useNavigate({ from: "/sugestoes" });
  const [term, setTerm] = useState(q ?? "");
  const [filters, setFilters] = usePersistentState<FilterState>(
    "sugestoes_filters",
    defaultFilters,
  );
  const [showFilters, setShowFilters] = usePersistentState("sugestoes_show_filters", false);
  const [visible, setVisible] = useState(12);

  // Restaura a última escolha (ordenação, busca, culinária) quando a tela é
  // aberta sem parâmetros — ex.: voltando de um restaurante ou pela barra.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (typeof window !== "undefined" && window.location.search) return;
    const saved = readPref<SearchParams>("sugestoes_search");
    if (saved) {
      setTerm(saved.q ?? "");
      navigate({ search: () => saved, replace: true });
    }
  }, [navigate]);

  // Guarda a escolha atual em memória local a cada mudança.
  useEffect(() => {
    if (restored.current) writePref<SearchParams>("sugestoes_search", { modo, q, culinaria });
  }, [modo, q, culinaria]);

  // Categoria escolhida na Home entra nos filtros salvos.
  useEffect(() => {
    if (!culinaria) return;
    setFilters((f) => (f.cuisines.includes(culinaria) ? f : { ...f, cuisines: [culinaria] }));
  }, [culinaria, setFilters]);

  useEffect(() => {
    setTerm(q ?? "");
  }, [q]);

  const selectedCuisines = useMemo(
    () => (culinaria && !filters.cuisines.length ? [culinaria] : filters.cuisines),
    [culinaria, filters.cuisines],
  );

  useEffect(() => {
    setVisible(12);
  }, [modo, q, filters]);

  const { geo, city, items, usingRemote, isLoading, error, refetch } = useDiscover({
    query: q ?? "",
    cuisines: selectedCuisines,
  });

  const list = useMemo(() => {
    const filtered = items.filter(
      (r) =>
        r.distance <= filters.maxDistance &&
        r.rating >= filters.minRating &&
        (!filters.priceLevels.length || filters.priceLevels.includes(r.priceLevel)),
    );
    return sortDiscover(filtered, modo);
  }, [items, filters, modo]);

  const title = q
    ? `Resultados para “${q}”`
    : culinaria
      ? `Culinária ${culinaria}`
      : (MODES.find(([m]) => m === modo)?.[1] ?? "Sugestões");

  function submit() {
    const v = term.trim();
    if (v) pushSearch(v);
    navigate({ search: (s: SearchParams) => ({ ...s, q: v || undefined }) });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Voltar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {isLoading
              ? "Buscando perto de você…"
              : `${list.length} ${list.length === 1 ? "lugar" : "lugares"}${city ? ` · ${city}` : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filtros"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5">
        <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="O que você quiser"
          className="h-9 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
        />
        <Button onClick={submit} className="h-9 shrink-0 rounded-xl text-sm">
          Buscar
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {MODES.map(([m, label]) => (
          <button
            key={m}
            onClick={() => navigate({ search: (s: SearchParams) => ({ ...s, modo: m }) })}
            className={`truncate rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
              modo === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <LocationBar geo={geo} cityFromGps={city} />
      </div>

      {showFilters && (
        <div className="mt-3">
          <Filters value={filters} onChange={setFilters} />
        </div>
      )}

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex-1 text-sm">
            Não foi possível buscar restaurantes agora. Verifique sua conexão e tente novamente.
          </p>
          <Button size="sm" variant="outline" onClick={refetch}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!usingRemote && !isLoading && (
        <p className="mt-3 text-xs text-muted-foreground">
          Mostrando prévia local — ative a localização para resultados reais perto de você.
        </p>
      )}

      {list.length === 0 && !isLoading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum lugar encontrado</p>
          <p className="text-sm text-muted-foreground">Tente outro termo ou ajuste os filtros.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.slice(0, visible).map((r) => (
              <RestaurantCard key={r.id} r={r} />
            ))}
          </div>
          {visible < list.length && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setVisible((v) => v + 12)}>
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}