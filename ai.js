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

MEDIDAS INFORMALES / NO EXACTAS — estímalas con sentido común (esto es clave, el usuario casi siempre describe así):
- "un puño" / "puñado" de frutos secos (nueces, almendras, cacahuates) ≈ 30 g; un puño de fruta (fresas, mango, uvas) ≈ 80 g; un puño de hojas/ensalada ≈ 30 g.
- "un scoop"/"medida" de proteína whey ≈ 30 g (≈120 kcal, 24 g proteína); 2 scoops ≈ 60 g.
- "un scoop"/"bola"/"cucharón" de yogurt ≈ 60 g; "una cucharada" ≈ 15 g; "una cucharadita" ≈ 5 g.
- Piezas pequeñas por unidad: 1 nuez ≈ 5 g, 1 almendra ≈ 1.2 g, 1 fresa ≈ 12 g, 1 uva ≈ 5 g. Multiplica por la cantidad ("2 almendras" ≈ 2.4 g).
- "un chorrito"/"un poco" ≈ porción pequeña razonable; "un trozo"/"una rebanada" según el alimento.

SUPLEMENTOS SIN CALORÍAS — regístralos igual para que aparezcan en el día, con sus gramos y macros en 0 (o casi 0):
- "1 scoop de creatina" ≈ 5 g, kcal 0, proteína 0, carbs 0, grasa 0, fibra 0.
- Pre-entreno, vitaminas, electrolitos, café solo, té: kcal ≈ 0 y macros ≈ 0.

Ejemplos informales (síguelos):
- "batido con 2 scoops de whey y 1 de creatina" → dos items: {Proteína whey, quantity 2, grams 60, kcal 240, protein 48, carbs 6, fat 4, fiber 1} y {Creatina, quantity 1, grams 5, kcal 0, protein 0, carbs 0, fat 0, fiber 0}
- "un puño de fresas y un puño de mango" → {Fresas, quantity 1, grams 80, kcal 26, protein 0.6, carbs 6.2, fat 0.2, fiber 1.6} y {Mango, quantity 1, grams 80, kcal 48, protein 0.6, carbs 12, fat 0.3, fiber 1.3}
- "1 scoop de yogurt griego, 2 nueces y 2 almendras" → {Yogurt griego, quantity 1, grams 60, kcal 35, protein 6, carbs 2.2, fat 0.2, fiber 0}, {Nueces, quantity 2, grams 10, kcal 65, protein 1.5, carbs 1.4, fat 6.5, fiber 0.7}, {Almendras, quantity 2, grams 2.4, kcal 14, protein 0.5, carbs 0.5, fat 1.2, fiber 0.3}

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
  provider() { return this.cfg().provider || "gemini"; },

  _userMsg(text, meal) {
    return `Comida del tiempo "${meal}". Texto del usuario: ${text}\n\nDevuelve SOLO un objeto JSON con la forma {"items":[{name, quantity, grams, kcal, protein, carbs, fat, fiber}, ...]}.`;
  },

  _errMsg(status, body, provider) {
    if (status === 401 || status === 403)
      return provider === "gemini"
        ? "Clave de Gemini inválida o sin permiso. Revísala en Perfil → Asistente IA."
        : "Clave de API inválida o sin créditos. Revísala en Perfil → Asistente IA.";
    if (status === 429) return "Límite de uso alcanzado. Espera un momento e intenta de nuevo.";
    if (status === 404) return "Modelo no encontrado. Elige otro modelo en la configuración.";
    return "Error de la IA (" + status + "). " + (body || "").slice(0, 160);
  },

  // ----- Anthropic (Claude) -----
  async _anthropic(userText, maxTokens) {
    const c = this.cfg();
    const call = (useSchema) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": c.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" },
      body: JSON.stringify({
        model: c.model || "claude-haiku-4-5", max_tokens: maxTokens || 1024, system: this.SYSTEM,
        messages: [{ role: "user", content: userText }],
        ...(useSchema ? { output_config: { format: { type: "json_schema", schema: this.SCHEMA } } } : {}),
      }),
    });
    let res = await call(true);
    if (res.status === 400) res = await call(false);
    if (!res.ok) throw new Error(this._errMsg(res.status, await res.text(), "anthropic"));
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("La IA no pudo procesar ese texto.");
    const block = (data.content || []).find(b => b.type === "text");
    return block && block.text;
  },

  // ----- Google Gemini (capa gratuita) -----
  async _gemini(userText, maxTokens) {
    const c = this.cfg();
    const model = c.model || "gemini-2.0-flash";
    const genCfg = { responseMimeType: "application/json", maxOutputTokens: maxTokens || 2048, temperature: 0.2 };
    // Los modelos 2.5 "piensan" por defecto y consumen tokens de salida → desactivar
    if (/2\.5/.test(model)) genCfg.thinkingConfig = { thinkingBudget: 0 };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": c.key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: this.SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: genCfg,
      }),
    });
    if (!res.ok) throw new Error(this._errMsg(res.status, await res.text(), "gemini"));
    const data = await res.json();
    const cand = (data.candidates || [])[0];
    if (!cand) throw new Error("Respuesta vacía de Gemini (revisa el modelo).");
    if (cand.finishReason === "MAX_TOKENS") throw new Error("Respuesta cortada. Intenta otra vez o usa el modelo 2.0 Flash.");
    const part = ((cand.content || {}).parts || []).find(p => p.text);
    if (!part || !part.text) throw new Error("Gemini no devolvió texto (prueba el modelo 2.0 Flash).");
    return part.text;
  },

  async _raw(userText, maxTokens) {
    return this.provider() === "gemini" ? this._gemini(userText, maxTokens) : this._anthropic(userText, maxTokens);
  },

  _extractJSON(txt) {
    if (!txt) throw new Error("Respuesta vacía de la IA.");
    let s = txt.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    else { const a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a >= 0 && b > a) s = s.slice(a, b + 1); }
    return JSON.parse(s);
  },

  async parse(text, meal) {
    const parsed = this._extractJSON(await this._raw(this._userMsg(text, meal), 1024));
    return (parsed.items || []).map(it => ({
      name: it.name, quantity: +(+it.quantity) > 0 ? +it.quantity : 1,
      grams: Math.round(it.grams) || 0, kcal: Math.round(it.kcal) || 0,
      protein: +(+it.protein || 0).toFixed(1), carbs: +(+it.carbs || 0).toFixed(1),
      fat: +(+it.fat || 0).toFixed(1), fiber: +(+it.fiber || 0).toFixed(1),
    })).filter(it => it.name);
  },

  async test() {
    const parsed = this._extractJSON(await this._raw('Prueba: "1 huevo". Devuelve SOLO el JSON {"items":[...]} con name, grams, kcal, protein, carbs, fat, fiber.', 400));
    if (!parsed.items || !parsed.items.length) throw new Error("Conectó, pero no devolvió items.");
    return parsed.items[0];
  },
};
if (typeof window !== "undefined") window.AI = AI;
