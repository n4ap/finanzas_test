/** Solo http(s): evita enlaces `javascript:` o `data:` procedentes de datos externos (feeds, importaciones). */
export const safeHttpUrl = (s: string | null | undefined): string | null => {
  if (!s) return null;
  try { const u = new URL(s.trim()); return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
};
