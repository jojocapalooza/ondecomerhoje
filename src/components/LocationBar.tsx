// Barra de localização: mostra de onde vêm os resultados e oferece o
// fallback manual (digitar cidade/endereço) quando o GPS é negado,
// não é suportado ou falha. Sem isso o app fica inutilizável no desktop.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useGeocodeAddress } from "@/lib/data-rpc";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";

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
  const [address, setAddress] = useState("");
  const runGeocode = useGeocodeAddress();

  const search = useMutation({
    mutationFn: (value: string) => runGeocode({ data: { address: value } }),
    onSuccess: (place) => {
      if (!place) return;
      geo.setManualLocation(
        place.latitude,
        place.longitude,
        place.city ?? place.formatted ?? address.trim(),
      );
      setAddress("");
    },
  });

  const needsFallback =
    geo.status === "denied" || geo.status === "unsupported" || geo.status === "error";
  const activeLabel = geo.label ?? cityFromGps;

  const needsAddress = needsFallback && !geo.location;

  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          {geo.status === "locating" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : needsAddress ? (
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
                : needsAddress
                  ? "Informe sua cidade"
                  : "Sem localização"}
          </p>
        </div>
      </div>

      {needsAddress && (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = address.trim();
            if (v) search.mutate(v);
          }}
        >
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Cidade ou bairro"
            className="h-9 flex-1 min-w-[200px]"
          />
          <Button type="submit" className="h-9" disabled={search.isPending || !address.trim()}>
            {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar"}
          </Button>
          {search.isError && (
            <p className="w-full text-xs text-destructive">
              Endereço não encontrado. Tente cidade e estado.
            </p>
          )}
          {search.isSuccess && !search.data && (
            <p className="w-full text-xs text-muted-foreground">Nenhum lugar encontrado.</p>
          )}
        </form>
      )}
    </div>
  );
}
