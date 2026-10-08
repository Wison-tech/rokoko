import { useCallback, useEffect, useRef, useState } from 'react';

function read<T>(key: string, fallback: T, parse: (raw: unknown) => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

/**
 * Estado guardado en localStorage y sincronizado entre pestañas.
 * `parse` valida lo leído (los datos guardados pueden ser de una versión vieja).
 */
export function useStored<T>(key: string, fallback: T, parse: (raw: unknown) => T = (r) => r as T) {
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const [value, setValue] = useState<T>(() => read(key, fallback, parse));

  const skipWrite = useRef(false);
  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* almacenamiento bloqueado: el dato vive solo en esta visita */
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      skipWrite.current = true;
      setValue(read(key, fallback, parseRef.current));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback((next: T | ((prev: T) => T)) => setValue(next), []);
  return [value, update] as const;
}
