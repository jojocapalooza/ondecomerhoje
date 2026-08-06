// Barra de localização: mostra de onde vêm os resultados e oferece o
// fallback manual (digitar cidade/endereço) quando o GPS é negado,
// não é suportado ou falha. Sem isso o app fica inutilizável no desktop.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, LocateFixed, Loader2, AlertTriangle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { geocodeAddress } from "@/lib/google-places.functions";
import type { UseUserLocation } from "@/lib/favorites";

export function LocationBar({
  geo,
  cityFromGps,
}: {
  geo: UseUserLocation;
  cityFromGps?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const runGeocode = useServerFn(geocodeAddress);

  const search = useMutation({
    mutationFn: (value: string) => runGeocode({ data: { address: value } }),
    onSuccess: (place) => {
      if (!place) return;
      geo.setManualLocation(
        place.latitude,
        place.longitude,
        place.city ?? place.formatted ?? address.trim(),
      );
      setOpen(false);
      setAddress("");
    },
  });

  const needsFallback =
    geo.status === "denied" || geo.status === "unsupported" || geo.status === "error";
  const activeLabel = geo.label ?? cityFromGps;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          {geo.status === "locating" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : needsFallback ? (
            <AlertTriangle className="h-4 w-4 text-warning" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {geo.status === "locating" && !geo.location
              ? "Detectando sua localização…"
              : activeLabel
                ? activeLabel
                : geo.location
                  ? "Localização detectada"
                  : "Sem localização"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {geo.error
              ? geo.error
              : geo.source === "manual"
                ? "Endereço informado por você — salvo neste dispositivo."
                : geo.location
                  ? "GPS do aparelho. Você pode informar outro endereço."
                  : "Informe sua cidade para ver restaurantes próximos."}
          </p>
        </div>
        <div className="flex gap-2">
          {geo.source === "manual" ? (
            <Button variant="outline" size="sm" onClick={geo.clearManualLocation}>
              <LocateFixed className="mr-1.5 h-3.5 w-3.5" /> Usar GPS
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={geo.requestGps}
              disabled={geo.status === "locating"}
            >
              <LocateFixed className="mr-1.5 h-3.5 w-3.5" /> Tentar de novo
            </Button>
          )}
          <Button size="sm" variant={needsFallback ? "default" : "ghost"} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Informar endereço"}
          </Button>
        </div>
      </div>

      {(open || (needsFallback && !geo.location)) && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = address.trim();
            if (v) search.mutate(v);
          }}
        >
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Cidade, bairro ou endereço (ex.: Copacabana, Rio de Janeiro)"
            className="h-10 flex-1 min-w-[220px]"
          />
          <Button type="submit" className="h-10" disabled={search.isPending || !address.trim()}>
            {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar este local"}
          </Button>
          {search.isError && (
            <p className="w-full text-xs text-destructive">
              Não conseguimos localizar esse endereço. Tente escrever a cidade e o estado.
            </p>
          )}
          {search.isSuccess && !search.data && (
            <p className="w-full text-xs text-muted-foreground">
              Nenhum lugar encontrado com esse texto.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
