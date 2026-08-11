import { createFileRoute, Link } from "@tanstack/react-router";
import { Hammer, Heart, MapPin, Moon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { clearSearchHistory, useFavorites } from "@/lib/favorites";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Onde Comer Hoje" },
      {
        name: "description",
        content: "Perfil em construção. Seus favoritos ficam salvos no próprio aparelho.",
      },
      { property: "og:title", content: "Perfil — Onde Comer Hoje" },
      {
        property: "og:description",
        content: "Perfil em construção. Seus favoritos ficam salvos no próprio aparelho.",
      },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { items } = useFavorites();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark(v: boolean) {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted">
          <Hammer className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Perfil em construção</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Ainda não há login nem cadastro. Por enquanto o app funciona sem conta: seus favoritos e
          buscas ficam guardados no armazenamento do próprio aparelho.
        </p>
        <Button asChild className="mt-4">
          <Link to="/favoritos">
            <Heart className="h-4 w-4" /> Ver meus favoritos ({items.length})
          </Link>
        </Button>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 p-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <Heart className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Favoritos salvos</div>
            <div className="text-sm text-muted-foreground">
              {items.length === 0
                ? "Nenhum lugar salvo ainda"
                : `${items.length} ${items.length === 1 ? "lugar" : "lugares"} neste aparelho`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <Moon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Tema escuro</div>
            <div className="text-sm text-muted-foreground">Conforto visual à noite</div>
          </div>
          <Switch checked={dark} onCheckedChange={toggleDark} />
        </div>

        <div className="flex items-center gap-3 p-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Localização</div>
            <div className="text-sm text-muted-foreground">
              Usada apenas no aparelho para ordenar os resultados por distância
            </div>
          </div>
        </div>

        <button
          onClick={() => clearSearchHistory()}
          className="flex w-full items-center gap-3 p-5 text-left hover:bg-muted"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Limpar histórico de buscas</div>
            <div className="text-sm text-muted-foreground">Remove as últimas buscas salvas</div>
          </div>
        </button>
      </div>
    </section>
  );
}
