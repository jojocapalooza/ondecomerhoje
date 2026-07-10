import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { RestaurantCard } from "@/components/RestaurantCard";
import { restaurants } from "@/lib/restaurants";

const cities = ["São Paulo", "Rio de Janeiro", "Belo Horizonte"];

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
  const [city, setCity] = useState(cities[0]);
  const list = restaurants
    .filter((r) => r.city === city)
    .sort((a, b) => b.rating * Math.log(b.reviews + 1) - a.rating * Math.log(a.reviews + 1));

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" /> Metrópole
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Best Trend em {city}</h1>
          <p className="mt-1 text-muted-foreground">Ranking atualizado por rating e volume de avaliações.</p>
        </div>
        <div className="flex gap-2">
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                city === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

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
    </section>
  );
}