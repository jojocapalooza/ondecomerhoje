import { Link } from "@tanstack/react-router";
import { MapPin, Star } from "lucide-react";

import { priceLabel, ratingColor } from "@/lib/restaurants";
import type { DiscoverItem } from "@/lib/discover";

/** Card compacto usado nos carrosséis horizontais (formato app). */
export function SuggestionCard({ r }: { r: DiscoverItem }) {
  return (
    <Link
      to="/restaurante/$id"
      params={{ id: r.id }}
      className="block w-[168px] shrink-0 sm:w-[200px]"
    >
      <div className="overflow-hidden rounded-2xl bg-muted">
        <img
          src={r.photo}
          alt={r.name}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      <div className="mt-2 min-w-0">
        <h3 className="truncate text-sm font-semibold leading-tight">{r.name}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {r.cuisine} · {priceLabel(r.priceLevel)}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <Star className={`h-3.5 w-3.5 fill-current ${ratingColor(r.rating)}`} />
          <span className="font-semibold">{r.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">({r.reviews})</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {r.distance < 1 ? `${Math.round(r.distance * 1000)} m` : `${r.distance} km`}
          </span>
        </div>
      </div>
    </Link>
  );
}