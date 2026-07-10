import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Globe, Heart, MapPin, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFavorites } from "@/lib/favorites";
import { formatReviews, priceLabel, ratingColor, restaurants, type Restaurant } from "@/lib/restaurants";

export const Route = createFileRoute("/restaurante/$id")({
  loader: ({ params }) => {
    const r = restaurants.find((x) => x.id === params.id);
    if (!r) throw notFound();
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

  return (
    <article>
      <div className="relative">
        <div className="relative h-64 md:h-96 w-full overflow-hidden bg-muted">
          <img src={r.photo} alt={r.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <Link to="/" className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-sm backdrop-blur hover:bg-background">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-4">
          <div className="relative -mt-24 rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{r.cuisine}</Badge>
                  <Badge variant="outline">{priceLabel(r.priceLevel)}</Badge>
                  {r.isNew && <Badge className="bg-primary text-primary-foreground border-0">Novo</Badge>}
                  {r.promo && <Badge className="bg-warning text-foreground border-0">Promoção</Badge>}
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">{r.name}</h1>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Star className={`h-4 w-4 fill-current ${ratingColor(r.rating)}`} />
                  <span className="font-semibold">{r.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">· {formatReviews(r.reviews)}</span>
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {r.address} · {r.distance} km
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => toggle(r.id)} aria-label="Favoritar">
                  <Heart className={fav ? "fill-destructive text-destructive" : ""} />
                </Button>
                <Button asChild>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Traçar rota
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="info">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="menu">Cardápio</TabsTrigger>
            <TabsTrigger value="reco">Pratos recomendados</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Endereço" value={r.address} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={r.phone} />
            <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={r.website ?? "—"} />
            <InfoRow icon={<Star className="h-4 w-4" />} label="Horário" value={r.hours} />
          </TabsContent>

          <TabsContent value="menu" className="mt-6 space-y-3">
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
            {r.userReviews.map((u, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{u.user.split(" ").map((s) => s[0]).join("").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{u.user}</div>
                    <div className="text-xs text-muted-foreground">{u.date}</div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-current text-warning" />
                    <span className="font-medium">{u.rating}</span>
                  </div>
                </div>
                <p className="mt-3 text-sm">{u.text}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </article>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-medium">{value}</div>
      </div>
    </div>
  );
}