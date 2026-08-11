import { useEffect, useState, useCallback, useRef } from "react";
import { isNativeApp } from "./mobile-bridge";

// Favoritos guardam um retrato completo do restaurante (não só o id), porque a
// maioria dos lugares vem do Google Places e não existe no banco local — sem o
// retrato a tela de Favoritos ficaria sempre vazia.
const KEY = "och_favorites_v2";
const LEGACY_KEY = "och_favorites";

export type FavoriteItem = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  priceLevel: 1 | 2 | 3 | 4;
  photo: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  googleMapsUri?: string;
  savedAt?: number;
};

function read(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as FavoriteItem[]).filter((x) => x && typeof x.id === "string") : [];
    }
    // migração: versão antiga guardava apenas os ids
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    if (Array.isArray(legacy) && legacy.length) {
      return legacy
        .filter((id: unknown) => typeof id === "string")
        .map((id: string) => ({
          id,
          name: id,
          cuisine: "Restaurante",
          rating: 0,
          reviews: 0,
          priceLevel: 2 as const,
          photo: "",
        }));
    }
    return [];
  } catch {
    return [];
  }
}

function write(items: FavoriteItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // armazenamento cheio/bloqueado: mantém apenas em memória nesta sessão
  }
  window.dispatchEvent(new Event("favorites-changed"));
}

export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  useEffect(() => {
    setItems(read());
    const on = () => setItems(read());
    window.addEventListener("storage", on);
    window.addEventListener("favorites-changed", on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener("favorites-changed", on);
    };
  }, []);

  const toggle = useCallback((input: FavoriteItem | string) => {
    const id = typeof input === "string" ? input : input.id;
    const cur = read();
    const next = cur.some((x) => x.id === id)
      ? cur.filter((x) => x.id !== id)
      : typeof input === "string"
        ? cur
        : [{ ...input, savedAt: Date.now() }, ...cur];
    write(next);
  }, []);

  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), []);

  const ids = items.map((x) => x.id);
  return { ids, items, toggle, remove, has: (id: string) => ids.includes(id) };
}

const SEARCH_KEY = "och_search_history";
export function pushSearch(q: string) {
  if (!q.trim()) return;
  const cur: string[] = JSON.parse(localStorage.getItem(SEARCH_KEY) || "[]");
  const next = [q, ...cur.filter((x) => x !== q)].slice(0, 5);
  localStorage.setItem(SEARCH_KEY, JSON.stringify(next));
}
export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEARCH_KEY) || "[]");
  } catch {
    return [];
  }
}
export function clearSearchHistory() {
  localStorage.removeItem(SEARCH_KEY);
}

// ---------- Geolocalização do usuário ----------
export type UserLocation = { lat: number; lng: number } | null;

/** Origem da localização em uso: GPS do aparelho ou endereço digitado. */
export type LocationSource = "gps" | "manual" | "cache";
export type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unsupported" | "error";

const LOC_KEY = "och_last_location";
const LOC_TTL = 24 * 60 * 60 * 1000; // 1 dia: evita pedir GPS a cada visita

type StoredLocation = {
  lat: number;
  lng: number;
  label?: string;
  source: LocationSource;
  at: number;
};

function readStoredLocation(): StoredLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredLocation;
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number") return null;
    // Endereço escolhido manualmente não expira; GPS em cache expira em 1 dia.
    if (v.source !== "manual" && Date.now() - (v.at ?? 0) > LOC_TTL) return null;
    return v;
  } catch {
    return null;
  }
}

function writeStoredLocation(v: StoredLocation) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify(v));
  } catch {
    // localStorage cheio ou bloqueado: seguimos só em memória
  }
}

export type UseUserLocation = {
  location: UserLocation;
  status: LocationStatus;
  source: LocationSource | null;
  label: string | null;
  error: string | null;
  /** Pede o GPS novamente (usado no botão "tentar de novo"). */
  requestGps: () => void;
  /** Define manualmente a localização (fallback quando não há GPS). */
  setManualLocation: (lat: number, lng: number, label?: string) => void;
  /** Volta a usar o GPS e descarta o endereço manual. */
  clearManualLocation: () => void;
};

export function useUserLocation(): UseUserLocation {
  const [location, setLocation] = useState<UserLocation>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [source, setSource] = useState<LocationSource | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const apply = useCallback(
    (lat: number, lng: number, src: LocationSource, lbl?: string, persist = true) => {
      if (cancelled.current) return;
      setLocation({ lat, lng });
      setSource(src);
      setLabel(lbl ?? null);
      setStatus("ready");
      setError(null);
      if (persist) writeStoredLocation({ lat, lng, label: lbl, source: src, at: Date.now() });
    },
    [],
  );

  const requestGps = useCallback(async () => {
    setError(null);
    setStatus("locating");
    try {
      // No app Android o GPS vem do aparelho via plugin nativo (permissão do
      // sistema). No navegador usamos a API padrão.
      if (isNativeApp()) {
        try {
          const { Geolocation } = await import("@capacitor/geolocation");
          let perm = await Geolocation.checkPermissions();
          if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
            perm = await Geolocation.requestPermissions();
          }
          if (perm.location === "denied" && perm.coarseLocation === "denied") {
            setStatus("denied");
            setError("Permissão de localização negada. Informe sua cidade ou endereço.");
            return;
          }
          // Em cidades grandes (prédios altos, GPS frio) a primeira leitura
          // costuma estourar o tempo: tentamos rápido e depois com precisão
          // alta e mais tempo antes de desistir.
          const attempts = [
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
            { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
          ];
          for (const opts of attempts) {
            try {
              const p = await Geolocation.getCurrentPosition(opts);
              apply(p.coords.latitude, p.coords.longitude, "gps");
              return;
            } catch {
              // tenta a próxima estratégia
            }
          }
          if (!cancelled.current) {
            setStatus("error");
            setError(
              "O GPS do aparelho não respondeu. Informe sua cidade ou endereço para continuar.",
            );
          }
          return;
        } catch {
          // cai no navigator abaixo
        }
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setStatus("unsupported");
        setError("Este dispositivo não fornece localização. Informe sua cidade ou endereço.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => apply(p.coords.latitude, p.coords.longitude, "gps"),
        (err) => {
          if (cancelled.current) return;
          const denied = err.code === err.PERMISSION_DENIED;
          setStatus(denied ? "denied" : "error");
          setError(
            denied
              ? "Permissão de localização negada. Informe sua cidade ou endereço."
              : err.code === err.TIMEOUT
                ? "O GPS demorou para responder. Informe sua cidade ou endereço."
                : "Não conseguimos obter sua localização. Informe sua cidade ou endereço.",
          );
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
      );
    } catch {
      if (!cancelled.current) {
        setStatus("error");
        setError("Não conseguimos obter sua localização. Informe sua cidade ou endereço.");
      }
    }
  }, [apply]);

  useEffect(() => {
    cancelled.current = false;
    const stored = readStoredLocation();
    if (stored) {
      // Mostra os resultados na hora com a última posição conhecida (cache)…
      apply(stored.lat, stored.lng, stored.source, stored.label, false);
      // …e só volta ao GPS se a origem não foi uma escolha manual.
      if (stored.source !== "manual") void requestGps();
    } else {
      void requestGps();
    }
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setManualLocation = useCallback(
    (lat: number, lng: number, lbl?: string) => apply(lat, lng, "manual", lbl),
    [apply],
  );

  const clearManualLocation = useCallback(() => {
    try {
      localStorage.removeItem(LOC_KEY);
    } catch {
      /* ignore */
    }
    setLabel(null);
    void requestGps();
  }, [requestGps]);

  return {
    location,
    status,
    source,
    label,
    error,
    requestGps: () => void requestGps(),
    setManualLocation,
    clearManualLocation,
  };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}