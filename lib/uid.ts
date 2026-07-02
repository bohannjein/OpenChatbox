/** Random id: crypto.randomUUID when available, Math.random fallback (older browsers / non-secure contexts). */
export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
