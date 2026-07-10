import { useEffect, useState, useCallback } from "react";

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