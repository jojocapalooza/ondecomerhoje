import { useEffect, useState, useCallback } from "react";
import { isNativeApp } from "./mobile-bridge";

const KEY = "och_favorites";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const on = () => setIds(read());
    window.addEventListener("storage", on);
    window.addEventListener("favorites-changed", on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener("favorites-changed", on);
    };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("favorites-changed"));
  }, []);
  return { ids, toggle, has: (id: string) => ids.includes(id) };
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

export function useUserLocation(): UserLocation {
  const [loc, setLoc] = useState<UserLocation>(null);
  useEffect(() => {
    let cancelled = false;
    const set = (lat: number, lng: number) => {
      if (!cancelled) setLoc({ lat, lng });
    };

    async function locate() {
      // No app Android, o GPS vem do próprio aparelho via plugin nativo
      // (pede a permissão do sistema). No navegador usamos a API padrão.
      if (isNativeApp()) {
        try {
          const { Geolocation } = await import("@capacitor/geolocation");
          const perm = await Geolocation.requestPermissions();
          if (perm.location === "denied" && perm.coarseLocation === "denied") return;
          const p = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 5 * 60 * 1000,
          });
          set(p.coords.latitude, p.coords.longitude);
          return;
        } catch {
          // cai no navigator abaixo
        }
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (p) => set(p.coords.latitude, p.coords.longitude),
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
      );
    }

    void locate();
    return () => {
      cancelled = true;
    };
  }, []);
  return loc;
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