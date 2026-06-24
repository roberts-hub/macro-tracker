// ai.js — Análisis con IA: convierte texto libre en items de comida con macros.
// Llama a la API de Claude directamente desde el navegador (clave del usuario,
// guardada solo en este dispositivo). Usa salida estructurada (JSON Schema).
const AI = {
  SYSTEM: `Eres un nutriólogo experto en alimentos de México y Latinoamérica.
El usuario describe en lenguaje natural lo que comió (en español). Conviértelo en una lista de alimentos con estimaciones realistas.

Para CADA alimento devuelve: name (nombre claro y corto, ej. "Huevo", "Taco al pastor"), quantity (la cantidad numérica indicada, ej. 4), grams (gramos TOTALES = porción unitaria × quantity), kcal, protein, carbs, fat, fiber (TODOS valores TOTALES para esa cantidad completa, NUNCA por 100 g ni por unidad).

⚠️ REGLA MÁS IMPORTANTE — MULTIPLICA POR LA CANTIDAD:
Si el usuario indica un número o palabra de cantidad (4, cuatro, dos, tres, media, un par, una docena), DEBES multiplicar la porción de UNA unidad por esa cantidad. Jamás devuelvas la porción de 1 sola unidad cuando se piden varias. Verifica al final que grams y macros correspondan a la cantidad total pedida.

Ejemplos exactos (síguelos):
- "4 huevos" → quantity 4, grams 200 (4×50), kcal 286, protein 26, carbs 2.2, fat 19, fiber 0
- "2 tacos al pastor" → quantity 2, grams 170 (2×85), kcal 452, protein 24, carbs 36, fat 22, fiber 4
- "3 huevos y 1 taza de arroz" → dos items: {Huevo, quantity 3, grams 150, kcal 215, ...} y {Arroz blanco cocido, quantity 1, grams 158, kcal 205, ...}
- "media taza de avena" → quantity 0.5, grams 40

Porciones unitarias de referencia: 1 huevo ≈ 50 g, 1 taco ≈ 85 g, 1 taza de arroz/avena cocidos ≈ 158 g (avena cruda 1 taza ≈ 80 g), 1 rebanada de pan ≈ 28 g, 1 vaso/agua ≈ 240 ml, 1 quesadilla ≈ 120 g.

Otras reglas:
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
            quantity: { type: "number" },
            grams: { type: "number" },
            kcal: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            fiber: { type: "number" },
          },
          required: ["name", "quantity", "grams", "kcal", "protein", "carbs", "fat", "fiber"],
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
