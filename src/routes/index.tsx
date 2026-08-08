import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  MapPin,
  Mic,
  Search,
  Sparkles,
  Star,
  Utensils,
  ChevronRight,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocationBar } from "@/components/LocationBar";
import { SuggestionCard } from "@/components/SuggestionCard";
import { cuisines } from "@/lib/restaurants";
import { useDiscover, sortDiscover, type SortMode } from "@/lib/discover";
import { getSearchHistory, pushSearch, clearSearchHistory } from "@/lib/favorites";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Onde Comer Hoje — Restaurantes perto de você" },
      {
        name: "description",
        content:
          "Bora comer algo incrível hoje? Descubra restaurantes próximos, novidades, os mais avaliados e explore por culinária.",
      },
      { property: "og:title", content: "Onde Comer Hoje — Restaurantes perto de você" },
      {
        property: "og:description",
        content: "Descubra restaurantes próximos, novidades e os mais avaliados da sua cidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const QUICK: { modo: SortMode; label: string; icon: typeof MapPin }[] = [
  { modo: "stars", label: "Mais Estrelas", icon: Star },
  { modo: "best", label: "Melhor Avaliado", icon: Sparkles },
  { modo: "reviews", label: "Mais Avaliações", icon: Utensils },
  { modo: "near", label: "Mais Próximos", icon: MapPin },
];

const CUISINE_EMOJI: Record<string, string> = {
  Italiana: "🍝",
  Japonesa: "🍣",
  Brasileira: "🍖",
  "Hambúrguer": "🍔",
  Pizzaria: "🍕",
  Chinesa: "🥡",
  Mexicana: "🌮",
  Francesa: "🥐",
  "Árabe": "🥙",
  Vegetariana: "🥗",
  Vegan: "🌱",
  "Pet-friendly": "🐾",
  "Biológico": "🌾",
  Brunch: "🥞",
  "Rodízio": "🍽️",
};

function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [showAuto, setShowAuto] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { geo, city, items, isLoading, usingRemote } = useDiscover();

  useEffect(() => setHistory(getSearchHistory()), []);

  // "Sugestões para você": os melhores da cidade (nota mais próxima de 5 com
  // maior volume de 5 estrelas) dentro de um raio de até 5 km, com viés pelo
  // histórico de busca quando ele existe.
  const top = useMemo(() => {
    const inCity = items.filter((r) => r.distance <= 5);
    const scored = sortDiscover(inCity.length >= 3 ? inCity : items, "stars");
    const terms = history.map((h) => h.toLowerCase().trim()).filter(Boolean);
    if (!terms.length) return scored.slice(0, 5);
    const matches = (r: (typeof scored)[number]) =>
      terms.some((t) => `${r.name} ${r.cuisine}`.toLowerCase().includes(t));
    return [...scored.filter(matches), ...scored.filter((r) => !matches(r))].slice(0, 5);
  }, [items, history]);

  // "Perto de você": bem avaliados priorizando a distância.
  const nearest = useMemo(() => sortDiscover(items, "near").slice(0, 5), [items]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query, items]);

  function submitSearch(q?: string) {
    const v = (q ?? query).trim();
    if (!v) return;
    pushSearch(v);
    setHistory(getSearchHistory());
    setShowAuto(false);
    inputRef.current?.blur();
    navigate({ to: "/sugestoes", search: { modo: "best", q: v } });
  }

  function startVoice() {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Reconhecimento de voz não é suportado neste navegador.");
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    setListening(true);
    rec.onresult = (e: any) => {
      const t = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setQuery(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-6">
      {/* Saudação */}
      <h1 className="text-base font-medium leading-tight tracking-tight text-muted-foreground">
        Pesquise abaixo
      </h1>

      {/* Busca */}
      <div className="relative mt-5">
        <div
          className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowAuto(true)}
            onBlur={() => setTimeout(() => setShowAuto(false), 150)}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            placeholder="O que você quiser"
            className="h-9 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <button
            onClick={startVoice}
            aria-label="Busca por voz"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
              listening
                ? "animate-pulse bg-destructive text-destructive-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={() => submitSearch()}
            aria-label="Buscar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {showAuto && (suggestions.length > 0 || history.length > 0) && (
          <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
            {suggestions.length > 0 && (
              <div className="p-2">
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sugestões
                </div>
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    onMouseDown={() => submitSearch(r.name)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Utensils className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.cuisine}</span>
                  </button>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div className="border-t border-border p-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Buscas recentes
                  </span>
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Atalhos rápidos */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {QUICK.map(({ modo, label }) => (
          <Link
            key={label}
            to="/sugestoes"
            search={{ modo }}
            className="truncate rounded-full border border-border bg-card px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-muted"
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <LocationBar geo={geo} cityFromGps={city} />
      </div>

      {/* Sugestões para você */}
      <Section
        title="Sugestões para você"
        to={{ modo: "stars" as SortMode }}
        empty={isLoading ? "Buscando lugares perto de você…" : undefined}
        items={top}
      />

      {/* Perto de você */}
      <Section
        title="Perto de você"
        to={{ modo: "near" as SortMode }}
        empty={isLoading ? "Buscando lugares perto de você…" : undefined}
        items={nearest}
      />

      {/* Explore por culinária */}
      <div className="mt-8">
        <h2 className="text-base font-bold tracking-tight">Explore por culinária</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {cuisines.map((c) => (
            <Link
              key={c}
              to="/sugestoes"
              search={{ modo: "stars" as SortMode, culinaria: c }}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3 transition-colors hover:bg-muted"
            >
              <span className="text-2xl leading-none">{CUISINE_EMOJI[c] ?? "🍴"}</span>
              <span className="w-full truncate text-center text-[11px] leading-tight text-muted-foreground">
                {c}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {!usingRemote && !isLoading && (
        <p className="mt-4 text-xs text-muted-foreground">
          Mostrando prévia local — ative a localização para resultados reais perto de você.
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  to,
  empty,
}: {
  title: string;
  items: ReturnType<typeof sortDiscover>;
  to: { modo: SortMode };
  empty?: string | undefined;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <Link
          to="/sugestoes"
          search={to}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary"
        >
          Ver todas <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {empty ?? "Nada por aqui ainda."}
        </p>
      ) : (
        <div className="-mr-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.slice(0, 5).map((r) => (
            <div key={r.id} className="snap-start">
              <SuggestionCard r={r} />
            </div>
          ))}
          <Link
            to="/sugestoes"
            search={to}
            className="flex w-[120px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-xs font-medium text-primary"
          >
            Ver todas
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
