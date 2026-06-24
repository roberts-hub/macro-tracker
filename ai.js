// ai.js — Análisis con IA: convierte texto libre en items de comida con macros.
// Llama a la API de Claude directamente desde el navegador (clave del usuario,
// guardada solo en este dispositivo). Usa salida estructurada (JSON Schema).
const AI = {
  SYSTEM: `Eres un nutriólogo experto en alimentos de México y Latinoamérica.
El usuario describe en lenguaje natural lo que comió (en español). Conviértelo en una lista de alimentos con estimaciones realistas.
Para CADA alimento devuelve: name (nombre claro y corto, ej. "Taco al pastor"), grams (gramos TOTALES consumidos según la porción descrita), kcal, protein, carbs, fat, fiber (valores TOTALES para esa cantidad, no por 100 g).
Reglas:
- Usa porciones típicas reales (1 taco ≈ 85 g, 1 taza de arroz cocido ≈ 158 g, 1 huevo ≈ 50 g, 1 vaso ≈ 240 ml, etc.).
- Si dice una cantidad ("3 huevos", "dos tacos"), multiplícala.
- Sé preciso con comida mexicana (tacos, quesadillas, pozole, mole, tortas, aguas frescas, etc.).
- No inventes alimentos que no se mencionan. Si algo es ambiguo, haz tu mejor estimación realista.
- Redondea gramos a enteros y macros a 1 decimal.`,

  SCHEMA: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            grams: { type: "number" },
            kcal: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            fiber: { type: "number" },
          },
          required: ["name", "grams", "kcal", "protein", "carbs", "fat", "fiber"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },

  cfg() { return window.Store.state.ai || {}; },
  ready() { const c = this.cfg(); return !!(c.enabled && c.key); },

  async parse(text, meal) {
    const c = this.cfg();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": c.key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: c.model || "claude-haiku-4-5",
        max_tokens: 1024,
        system: this.SYSTEM,
        messages: [{ role: "user", content: `Comida del tiempo "${meal}". Texto: ${text}` }],
        output_config: { format: { type: "json_schema", schema: this.SCHEMA } },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) throw new Error("Clave de API inválida. Revísala en Perfil → Asistente IA.");
      if (res.status === 429) throw new Error("Límite de uso alcanzado. Intenta en un momento.");
      throw new Error("Error de la IA (" + res.status + "). " + body.slice(0, 120));
    }
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("La IA no pudo procesar ese texto.");
    const block = (data.content || []).find(b => b.type === "text");
    if (!block) throw new Error("Respuesta vacía de la IA.");
    const parsed = JSON.parse(block.text);
    return (parsed.items || []).map(it => ({
      name: it.name, grams: Math.round(it.grams) || 0,
      kcal: Math.round(it.kcal) || 0,
      protein: +(+it.protein).toFixed(1), carbs: +(+it.carbs).toFixed(1),
      fat: +(+it.fat).toFixed(1), fiber: +(+it.fiber || 0).toFixed(1),
    }));
  },
};
if (typeof window !== "undefined") window.AI = AI;
