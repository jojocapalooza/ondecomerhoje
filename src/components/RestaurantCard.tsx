import { Link } from "@tanstack/react-router";
import { Heart, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFavorites } from "@/lib/favorites";
import { formatReviews, priceLabel, ratingColor, type Restaurant } from "@/lib/restaurants";

export function RestaurantCard({ r }: { r: Restaurant }) {
  const { has, toggle } = useFavorites();
  const fav = has(r.id);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5" style={{ boxShadow: "var(--shadow-card)" }}>
      <Link to="/restaurante/$id" params={{ id: r.id }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img src={r.photo} alt={r.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            {r.isNew && <Badge className="bg-primary text-primary-foreground border-0">Novo</Badge>}
            {r.promo && <Badge className="bg-warning text-foreground border-0">Promoção</Badge>}
          </div>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          toggle(r.id);
        }}
        aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/90 backdrop-blur transition-colors hover:bg-background"
      >
        <Heart className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : "text-foreground"}`} />
      </button>
      <Link to="/restaurante/$id" params={{ id: r.id }} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{r.name}</h3>
          <span className="shrink-0 text-sm text-muted-foreground">{priceLabel(r.priceLevel)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-sm">
          <Star className={`h-4 w-4 fill-current ${ratingColor(r.rating)}`} />
          <span className="font-semibold">{r.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">· {formatReviews(r.reviews)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{r.cuisine}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {r.distance} km
          </span>
        </div>
      </Link>
    </div>
  );
}