// Memória local de preferências de navegação (filtros, categorias, ordenação).
// Guardado no aparelho para que a escolha do usuário sobreviva à troca de
// telas — inclusive ao abrir um restaurante e voltar.
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "och_prefs_";

export function readPref<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writePref<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* armazenamento cheio ou indisponível */
  }
}

/** useState que se lembra do valor no aparelho. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = readPref<T>(key);
    if (saved !== undefined) setValue(saved);
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (hydrated.current) writePref(key, value);
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, setValue, reset] as const;
}
