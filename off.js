// off.js — Búsqueda en Open Food Facts (datos abiertos reales, gratis, sin API key).
// Da acceso a ~3M+ productos reales. No inventa nada: usa los valores publicados.
const OFF = {
  async search(q) {
    const term = (q || "").trim();
    if (term.length < 3) return [];
    try {
      const url = "https://world.openfoodfacts.org/cgi/search.pl"
        + "?search_terms=" + encodeURIComponent(term)
        + "&search_simple=1&action=process&json=1&page_size=12&sort_by=unique_scans_n"
        + "&fields=code,product_name,product_name_es,brands,nutriments";
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const seen = new Set();
      return (data.products || []).map(p => {
        const n = p.nutriments || {};
        const kcal = n["energy-kcal_100g"];
        const name = (p.product_name_es || p.product_name || "").trim();
        if (kcal == null || !name) return null;
        const label = name.slice(0, 48) + (p.brands ? " · " + String(p.brands).split(",")[0].trim() : "");
        return {
          id: "off_" + (p.code || name),
          name: label,
          kcal: Math.round(kcal),
          p: +(+n.proteins_100g || 0).toFixed(1),
          c: +(+n.carbohydrates_100g || 0).toFixed(1),
          f: +(+n.fat_100g || 0).toFixed(1),
          fib: +(+n.fiber_100g || 0).toFixed(1),
          portions: [{ label: "100 g", g: 100 }, { label: "1 porción (30 g)", g: 30 }],
          off: true,
        };
      }).filter(x => {
        if (!x) return false;
        const k = x.name.toLowerCase();
        if (seen.has(k)) return false; seen.add(k); return true;
      }).slice(0, 8);
    } catch (e) { console.warn("OFF search falló:", e); return []; }
  },
};
if (typeof window !== "undefined") window.OFF = OFF;
