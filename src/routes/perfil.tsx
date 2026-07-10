import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, LogOut, MapPin, Moon, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { clearSearchHistory, useFavorites } from "@/lib/favorites";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Onde Comer Hoje" },
      { name: "description", content: "Suas informações, estatísticas e configurações." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { ids } = useFavorites();
  const [notif, setNotif] = useState(true);
  const [dark, setDark] = useState(false);
  const [radius, setRadius] = useState(10);

  function toggleDark(v: boolean) {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">VC</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Visitante</h1>
          <p className="text-sm text-muted-foreground">visitante@ondecomer.app</p>
        </div>
        <Button variant="outline">Editar perfil</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Favoritos", value: ids.length },
          { label: "Visitados", value: 12 },
          { label: "Categoria top", value: "Italiana" },
          { label: "Tempo economizado", value: "2h" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <SettingRow icon={<Bell className="h-4 w-4" />} title="Notificações" desc="Novos restaurantes 4.5★ perto de você">
          <Switch checked={notif} onCheckedChange={setNotif} />
        </SettingRow>
        <SettingRow icon={<Moon className="h-4 w-4" />} title="Tema escuro" desc="Ative para conforto visual à noite">
          <Switch checked={dark} onCheckedChange={toggleDark} />
        </SettingRow>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><MapPin className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="font-medium">Raio de busca padrão</div>
              <div className="text-sm text-muted-foreground">Distância máxima usada nas buscas</div>
            </div>
            <div className="text-sm font-medium">{radius} km</div>
          </div>
          <Slider className="mt-4" min={1} max={50} step={1} value={[radius]} onValueChange={([v]) => setRadius(v)} />
        </div>
        <button
          onClick={() => {
            clearSearchHistory();
            alert("Histórico de buscas limpo.");
          }}
          className="flex w-full items-center gap-3 p-5 text-left hover:bg-muted"
        >
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><Trash2 className="h-4 w-4" /></div>
          <div className="flex-1">
            <div className="font-medium">Limpar histórico de buscas</div>
            <div className="text-sm text-muted-foreground">Remove as últimas buscas salvas</div>
          </div>
        </button>
      </div>

      <Button variant="destructive" className="w-full sm:w-auto">
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </section>
  );
}

function SettingRow({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted">{icon}</div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}