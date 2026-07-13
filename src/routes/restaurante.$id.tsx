import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Clock, Globe, Heart, MapPin, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFavorites } from "@/lib/favorites";
import { formatReviews, priceLabel, ratingColor, restaurants, type Restaurant } from "@/lib/restaurants";
import { getRestaurantPlace, type PlaceData } from "@/lib/google-places.functions";

const placeQueryOptions = (r: Restaurant) =>
  queryOptions({
    queryKey: ["place", r.id],
    queryFn: () =>
      getRestaurantPlace({
        data: {
          query: `${r.name} ${r.city}`,
          latitude: r.latitude,
          longitude: r.longitude,
        },
      }),
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

export const Route = createFileRoute("/restaurante/$id")({
  loader: async ({ params, context }) => {
    const r = restaurants.find((x) => x.id === params.id);
    if (!r) throw notFound();
    void context.queryClient.prefetchQuery(placeQueryOptions(r));
    return { r };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Restaurante — Onde Comer Hoje" }, { name: "robots", content: "noindex" }] };
    }
    const r = loaderData.r;
    return {
      meta: [
        { title: `${r.name} — Onde Comer Hoje` },
        { name: "description", content: `${r.cuisine} · ${r.rating.toFixed(1)}★ · ${r.address}` },
        { property: "og:title", content: r.name },
        { property: "og:description", content: `${r.cuisine} · ${r.rating.toFixed(1)}★ · ${formatReviews(r.reviews)}` },
        { property: "og:image", content: r.photo },
        { name: "twitter:image", content: r.photo },
      ],
    };
  },
  component: Detail,
  notFoundComponent: NotFoundRestaurant,
});

function NotFoundRestaurant() {
  return (
    <div className="mx-auto max-w-3xl p-10 text-center">
      <p className="text-lg font-semibold">Restaurante não encontrado</p>
      <Link to="/" className="mt-3 inline-block text-primary">Voltar à Home</Link>
    </div>
  );
}

function Detail() {
  const { r } = Route.useLoaderData() as { r: Restaurant };
  const { has, toggle } = useFavorites();
  const fav = has(r.id);
  const fetchPlace = useServerFn(getRestaurantPlace);
  const { data: place } = useSuspenseQuery({
    ...placeQueryOptions(r),
    queryFn: () =>
      fetchPlace({
        data: { query: `${r.name} ${r.city}`, latitude: r.latitude, longitude: r.longitude },
      }),
  });

  const heroPhoto = place?.photos[0] ?? r.photo;
  const gallery = place?.photos.slice(1, 5) ?? [];
  const address = place?.address ?? r.address;
  const phone = place?.phone ?? r.phone;
  const website = place?.website ?? r.website;
  const rating = place?.rating ?? r.rating;
  const reviewsCount = place?.userRatingCount ?? r.reviews;
  const priceLvl = (place?.priceLevel ?? r.priceLevel) as 1 | 2 | 3 | 4;
  const location = place?.location ?? { latitude: r.latitude, longitude: r.longitude };
  const mapsUri =
    place?.googleMapsUri ??
    `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;

  return (
    <article>
      <div className="relative">
        <div className="relative h-64 md:h-96 w-full overflow-hidden bg-muted">
          <img src={heroPhoto} alt={r.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <Link to="/" className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-sm backdrop-blur hover:bg-background">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          {place && (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Dados do Google Maps
            </span>
          )}
        </div>
        <div className="mx-auto max-w-5xl px-4">
          <div className="relative -mt-24 rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{r.cuisine}</Badge>
                  <Badge variant="outline">{priceLabel(priceLvl)}</Badge>
                  {r.isNew && <Badge className="bg-primary text-primary-foreground border-0">Novo</Badge>}
                  {r.promo && <Badge className="bg-warning text-foreground border-0">Promoção</Badge>}
                  {place?.openNow !== undefined && (
                    <Badge className={place.openNow ? "bg-success text-white border-0" : "bg-destructive text-white border-0"}>
                      {place.openNow ? "Aberto agora" : "Fechado"}
                    </Badge>
                  )}
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">{place?.name ?? r.name}</h1>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Star className={`h-4 w-4 fill-current ${ratingColor(rating)}`} />
                  <span className="font-semibold">{rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">· {formatReviews(reviewsCount)}</span>
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {address} · {r.distance} km
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => toggle(r.id)} aria-label="Favoritar">
                  <Heart className={fav ? "fill-destructive text-destructive" : ""} />
                </Button>
                <Button asChild>
                  <a href={mapsUri} target="_blank" rel="noreferrer">
                    Traçar rota
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {gallery.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {gallery.map((src, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={src} alt={`${r.name} - foto ${i + 2}`} loading="lazy" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="info">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="menu">Cardápio</TabsTrigger>
            <TabsTrigger value="reco">Pratos recomendados</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Endereço" value={address} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={phone ?? "—"} />
              <InfoRow
                icon={<Globe className="h-4 w-4" />}
                label="Website"
                value={website ?? "—"}
                href={website}
              />
              <InfoRow
                icon={<Star className="h-4 w-4" />}
                label="Avaliação Google"
                value={`${rating.toFixed(1)} · ${formatReviews(reviewsCount)}`}
              />
            </div>
            {place?.openingHours && place.openingHours.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4" /> Horários de funcionamento
                </div>
                <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  {place.openingHours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="menu" className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sugestões da casa — o cardápio oficial pode ser consultado no {" "}
              {website ? (
                <a href={website} target="_blank" rel="noreferrer" className="text-primary underline">
                  site do restaurante
                </a>
              ) : (
                "site do restaurante"
              )}
              .
            </p>
            {r.menu.map((m) => (
              <div key={m.name} className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs">
                    <Star className="h-3 w-3 fill-current text-warning" />
                    <span className="font-medium">{m.rating}</span>
                  </div>
                </div>
                <div className="shrink-0 text-lg font-bold text-primary">R$ {m.price.toFixed(2)}</div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reco" className="mt-6 space-y-3">
            {r.recommended.map((p) => (
              <div key={p.name} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <div className="inline-flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-current text-warning" />
                    <span className="font-medium">{p.rating}</span>
                    <span className="text-muted-foreground">· {p.mentions} menções</span>
                  </div>
                </div>
                <p className="mt-1 text-sm italic text-muted-foreground">"{p.quote}"</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reviews" className="mt-6 space-y-3">
            {place && place.reviews.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">Avaliações públicas do Google Maps</p>
                {place.reviews.map((u, i) => (
                  <ReviewCard
                    key={i}
                    author={u.author}
                    photo={u.authorPhoto}
                    rating={u.rating}
                    date={u.relativeTime}
                    text={u.text}
                  />
                ))}
              </>
            ) : (
              r.userReviews.map((u, i) => (
                <ReviewCard key={i} author={u.user} rating={u.rating} date={u.date} text={u.text} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </article>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-medium text-primary hover:underline">
            {value}
          </a>
        ) : (
          <div className="mt-0.5 truncate font-medium">{value}</div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  author,
  photo,
  rating,
  date,
  text,
}: {
  author: string;
  photo?: string;
  rating: number;
  date: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar>
          {photo && <AvatarImage src={photo} alt={author} />}
          <AvatarFallback>
            {author
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-medium">{author}</div>
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>
        <div className="inline-flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-current text-warning" />
          <span className="font-medium">{rating}</span>
        </div>
      </div>
      {text && <p className="mt-3 whitespace-pre-line text-sm">{text}</p>}
    </div>
  );
}