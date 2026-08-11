import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useFavorites, useUserLocation, haversineKm } from "@/lib/favorites";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos — Onde Comer Hoje" },
      { name: "description", content: "Seus restaurantes salvos em um só lugar." },
    ],
  }),
  component: Favoritos,
});

function Favoritos() {
  const { items } = useFavorites();
  const loc = useUserLocation().location;
  const list = items
    .map((r) => ({
      ...r,
      distance:
        loc && r.latitude != null && r.longitude != null
          ? +haversineKm(loc, { lat: r.latitude, lng: r.longitude }).toFixed(1)
          : (r.distance ?? 0),
    }))
    .sort((a, b) => a.distance - b.distance);
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Favoritos</h1>
      <p className="mt-1 text-muted-foreground">Os lugares que você quer voltar sempre.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Salvos no seu aparelho — funcionam mesmo sem conta.
      </p>
      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum restaurante favorito.</p>
          <p className="text-sm text-muted-foreground">Comece a adicionar tocando no coração dos cards.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </section>
  );
}