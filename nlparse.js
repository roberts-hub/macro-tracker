// nlparse.js — Analizador de lenguaje natural para "describe lo que comiste".
// Devuelve una lista de items {raw, food, grams, matched} para REVISIÓN editable.
const NLP = {
  NUM_WORDS: { un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8,
               medio:0.5, media:0.5, "1/2":0.5, "1/4":0.25, "3/4":0.75, par:2, "media docena":6, docena:12 },
  UNIT_WORDS: ["taza","tazas","cucharada","cucharadas","cda","cdas","cucharadita","cucharaditas","cdta",
               "rebanada","rebanadas","filete","filetes","vaso","vasos","lata","latas","scoop","scoops",
               "puño","punado","puno","punito","punitos","puñado","pieza","piezas","unidad","unidades","huevo","huevos","tortilla",
               "tortillas","porcion","porciones","plato","platos","barra","barras","taco","tacos","bolillo"],

  norm: s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),

  parseQty(nseg) {
    const half = /\by\s+(media|medio)\b/.test(nseg);    // "1 taza y media" = 1.5
    let m = nseg.match(/(\d+)\s*\/\s*(\d+)/);            // fracción 1/2, 3/4
    if (m) return parseInt(m[1]) / parseInt(m[2]);
    // fracción en palabras: "tres cuartos", "un cuarto", "dos tercios", "un octavo"
    m = nseg.match(/\b(un|una|uno|dos|tres|cuatro|cinco)\s+(cuartos?|tercios?|octavos?)\b/);
    if (m) { const n = this.NUM_WORDS[m[1]] || 1; const base = m[2][0] === "c" ? 0.25 : m[2][0] === "t" ? 1 / 3 : 0.125; return +(n * base).toFixed(3); }
    m = nseg.match(/(\d+(?:[.,]\d+)?)/);                 // número
    if (m) { let n = parseFloat(m[1].replace(",", ".")); if (half) n += 0.5; return n; }
    for (const w of Object.keys(this.NUM_WORDS))         // palabra (un, dos, media...)
      if (new RegExp("\\b" + w.replace(/\//g, "\\/") + "\\b").test(nseg)) { let n = this.NUM_WORDS[w]; if (half && n >= 1) n += 0.5; return n; }
    return 1;
  },

  // Divide en segmentos por comas, saltos, "y", "con", "más", "+"
  segments(text) {
    // No partir en "y media/medio" (es "uno y medio"), sí en el resto
    return text.split(/[\n,;]+|\s+y\s+(?!media\b|medio\b)|\s+con\s+|\s+mas\s+|\s+más\s+|\s*\+\s*/i)
               .map(s => s.trim()).filter(s => s.length > 1);
  },

  // Encuentra el mejor alimento dentro de un segmento (alias más largo contenido)
  matchFood(nseg, foods) {
    let best = null, bestLen = 0;
    for (const f of foods) {
      const keys = [this.norm(f.name), ...(f.aliases || []).map(this.norm)];
      for (const k of keys) {
        if (k.length >= 3 && nseg.includes(k) && k.length > bestLen) { best = f; bestLen = k.length; }
      }
    }
    return best;
  },

  // Calcula gramos según gramos/ml explícitos, unidad+porción, o porción por defecto
  gramsFor(nseg, food, qty) {
    const gM = nseg.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos)\b/);
    if (gM) return { g: parseFloat(gM[1].replace(",", ".")), note: "" };
    const mlM = nseg.match(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros)\b/);
    if (mlM) return { g: parseFloat(mlM[1].replace(",", ".")), note: "" };
    if (!food) return { g: Math.round(100 * qty), note: "" };

    // unidad mencionada (taza, cucharada, rebanada, puño...). Acepta plural con "s?"
    let unit = null;
    for (const u of this.UNIT_WORDS) if (new RegExp("\\b" + u + "s?\\b").test(nseg)) { unit = u.replace(/s$/, ""); break; }
    if (unit && food.portions) {
      const matching = food.portions.filter(p => this.norm(p.label).includes(unit));
      if (matching.length) {
        const labelNum = p => {
          const m = this.norm(p.label).match(/(\d+)\s*\/\s*(\d+)|(\d+)/);
          return m ? (m[1] ? parseInt(m[1]) / parseInt(m[2]) : parseInt(m[3])) : 1;
        };
        let port = matching.find(p => labelNum(p) === qty), mult = 1;
        if (!port) {                       // usa la porción de 1 unidad y multiplica
          port = matching.find(p => labelNum(p) === 1) || matching.find(p => labelNum(p) === 0.5) || matching[0];
          mult = qty / labelNum(port);
        }
        return { g: Math.round(port.g * mult), note: port.label };
      }
    }
    // Medidas genéricas cuando el alimento no tiene esa porción propia
    if (unit === "puno" || unit === "punado" || unit === "punito") return { g: Math.round(40 * qty) };   // puñado verdura/fruta troceada
    if (unit === "cucharada" || unit === "cda") return { g: Math.round(15 * qty) };  // cucharada
    if (unit === "cucharadita" || unit === "cdta") return { g: Math.round(5 * qty) }; // cucharadita
    if (food.portions && food.portions[0])
      return { g: Math.round(food.portions[0].g * qty), note: `${qty}× ${food.portions[0].label}` };
    return { g: Math.round(100 * qty), note: "" };
  },

  parse(text, foods) {
    const items = [];
    for (const seg of this.segments(text)) {
      const nseg = this.norm(seg);
      // si el usuario dio gramos/ml directos, la "cantidad" es 1 (no el número de gramos)
      const explicitG = /(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos|ml|mililitros)\b/.test(nseg);
      const qty = explicitG ? 1 : this.parseQty(nseg);
      const food = this.matchFood(nseg, foods);
      const { g } = this.gramsFor(nseg, food, qty);
      items.push({ raw: seg, food: food || null, grams: g > 0 ? g : 100, quantity: qty > 0 ? qty : 1, matched: !!food });
    }
    return items;
  },
};
if (typeof window !== "undefined") window.NLP = NLP;
