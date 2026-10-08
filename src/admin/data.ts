import { useCallback, useEffect, useState } from 'react';
import { fetchRaw } from '../data/catalog';
import { supabase } from '../lib/supabase';
import { errText, toast } from './ui';

export type AdminData = Awaited<ReturnType<typeof fetchRaw>>;

/** Toda la carta (incluye lo oculto, porque el admin lo puede ver por RLS). */
export function useAdminData() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await fetchRaw());
    } catch (e) {
      toast(errText(e as Error), 'error');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, loading, reload };
}

/** Guarda el orden de una lista (sort = posición). */
export async function saveOrder(table: 'categories' | 'products' | 'option_choices', ids: number[]) {
  const results = await Promise.all(ids.map((id, i) => supabase!.from(table).update({ sort: i }).eq('id', id)));
  const err = results.find((r) => r.error)?.error;
  if (err) toast(errText(err), 'error');
}

export function move<T>(list: T[], index: number, delta: number): T[] {
  const j = index + delta;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[index], out[j]] = [out[j], out[index]];
  return out;
}

/** Reduce la foto en el navegador (máx. 1200 px, JPEG) antes de subirla. */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85));
}

export async function uploadPhoto(file: File, slug: string): Promise<string | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    toast('Usa una foto JPG, PNG o WebP.', 'error');
    return null;
  }
  try {
    const blob = await prepareImage(file);
    const path = `products/${slug}-${Date.now()}.jpg`;
    const { error } = await supabase!.storage.from('menu').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    return supabase!.storage.from('menu').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    toast(errText(e as Error), 'error');
    return null;
  }
}
