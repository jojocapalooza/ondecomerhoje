import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { cuisines } from "@/lib/restaurants";

export type FilterState = {
  cuisines: string[];
  maxDistance: number;
  minRating: number;
  priceLevels: number[];
};

export const defaultFilters: FilterState = {
  cuisines: [],
  maxDistance: 50,
  minRating: 0,
  priceLevels: [],
};

export function Filters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(value);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-6 border-t border-border p-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Culinária</div>
            <div className="flex flex-wrap gap-2">
              {cuisines.map((c) => {
                const checked = draft.cuisines.includes(c);
                return (
                  <label
                    key={c}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      checked ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          cuisines: v ? [...d.cuisines, c] : d.cuisines.filter((x) => x !== c),
                        }))
                      }
                      className="hidden"
                    />
                    {c}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Distância máxima</span>
              <span className="text-foreground">{draft.maxDistance} km</span>
            </div>
            <Slider
              min={1}
              max={50}
              step={1}
              value={[draft.maxDistance]}
              onValueChange={([v]) => setDraft((d) => ({ ...d, maxDistance: v }))}
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rating mínimo</div>
            <div className="flex flex-wrap gap-2">
              {[0, 3, 3.5, 4, 4.5].map((r) => (
                <button
                  key={r}
                  onClick={() => setDraft((d) => ({ ...d, minRating: r }))}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    draft.minRating === r ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {r === 0 ? "Todos" : `${r}★`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nível de preço</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((p) => {
                const active = draft.priceLevels.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        priceLevels: active ? d.priceLevels.filter((x) => x !== p) : [...d.priceLevels, p],
                      }))
                    }
                    className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                    }`}
                  >
                    {"$".repeat(p)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onChange(draft)}>
              Aplicar filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(defaultFilters);
                onChange(defaultFilters);
              }}
            >
              <X className="h-4 w-4" /> Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}