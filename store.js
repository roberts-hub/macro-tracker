// store.js — Estado de la app, persistencia local y enganche de sincronización.
const KEY = "macrotracker_v1";

const Store = {
  state: {
    profile: null,          // ver nutrition.computeTargets
    logs: {},               // { "YYYY-MM-DD": { entries:[], water:0 } }
    weights: [],            // [{date:"YYYY-MM-DD", kg:Number}]
    customFoods: [],        // alimentos creados por el usuario
    sync: { enabled: false, url: "", key: "", code: "" },
    ai: { enabled: false, provider: "gemini", key: "", model: "gemini-2.0-flash" }, // solo local, NUNCA se sincroniza
    updatedAt: 0,
  },
  _subs: [],
  _saveTimer: null,

  // ---- ciclo de vida ----
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
    } catch (e) { console.warn("No se pudo leer el estado local", e); }
    return this.state;
  },

  save({ remote = true } = {}) {
    this.state.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {}
    this._emit();
    if (remote && this.state.sync?.enabled && window.Sync) {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => window.Sync.push(this.state), 800);
    }
  },

  // Reemplaza el estado completo (usado al recibir datos remotos)
  replace(newState) {
    this.state = { ...this.state, ...newState };
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {}
    this._emit();
  },

  subscribe(fn) { this._subs.push(fn); return () => { this._subs = this._subs.filter(f => f !== fn); }; },
  _emit() { this._subs.forEach(fn => { try { fn(this.state); } catch (e) { console.error(e); } }); },

  // ---- helpers de fecha ----
  todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },

  dayLog(dateKey) {
    if (!this.state.logs[dateKey]) this.state.logs[dateKey] = { entries: [], water: 0 };
    return this.state.logs[dateKey];
  },

  // ---- comidas ----
  addEntry(dateKey, entry) {
    const log = this.dayLog(dateKey);
    log.entries.push({ id: "e" + Date.now() + Math.floor(Math.random() * 1e4), ts: Date.now(), ...entry });
    this.save();
  },
  updateEntry(dateKey, id, patch) {
    const log = this.dayLog(dateKey);
    const e = log.entries.find(x => x.id === id);
    if (e) Object.assign(e, patch);
    this.save();
  },
  removeEntry(dateKey, id) {
    const log = this.dayLog(dateKey);
    log.entries = log.entries.filter(x => x.id !== id);
    this.save();
  },
  setWater(dateKey, ml) { this.dayLog(dateKey).water = Math.max(0, ml); this.save(); },

  // ---- actividad diaria (WHOOP / manual) ----
  dayActivity(dateKey) {
    const l = this.dayLog(dateKey);
    if (!l.activity) l.activity = { burned: 0, sleepH: 0, recovery: 0, strain: 0 };
    return l.activity;
  },
  setActivity(dateKey, patch) { Object.assign(this.dayActivity(dateKey), patch); this.save(); },

  // ---- peso ----
  logWeight(dateKey, kg) {
    const i = this.state.weights.findIndex(w => w.date === dateKey);
    if (i >= 0) this.state.weights[i].kg = kg;
    else this.state.weights.push({ date: dateKey, kg });
    this.state.weights.sort((a, b) => a.date.localeCompare(b.date));
    // mantener el perfil con el último peso
    if (this.state.profile) this.state.profile.weightKg = kg;
    this.save();
  },

  // ---- alimentos personalizados ----
  addCustomFood(food) {
    food.id = "c" + Date.now();
    food.custom = true;
    this.state.customFoods.push(food);
    this.save();
  },
  allFoods() { return [...(window.FOOD_DB || []), ...this.state.customFoods]; },
  findFood(id) { return this.allFoods().find(f => f.id === id); },

  // ---- totales de un día ----
  dayTotals(dateKey) {
    const log = this.state.logs[dateKey] || { entries: [], water: 0 };
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: log.water || 0 };
    for (const e of log.entries) {
      t.kcal += e.kcal || 0; t.protein += e.protein || 0;
      t.carbs += e.carbs || 0; t.fat += e.fat || 0; t.fiber += e.fiber || 0;
    }
    for (const k of ["protein", "carbs", "fat", "fiber"]) t[k] = +t[k].toFixed(1);
    t.kcal = Math.round(t.kcal);
    return t;
  },

  // Proteína agrupada por comida (desayuno/almuerzo/cena/snack)
  proteinByMeal(dateKey) {
    const log = this.state.logs[dateKey] || { entries: [] };
    const meals = {};
    for (const e of log.entries) {
      const m = e.meal || "Otro";
      meals[m] = (meals[m] || 0) + (e.protein || 0);
    }
    Object.keys(meals).forEach(k => meals[k] = +meals[k].toFixed(1));
    return meals;
  },

  // Días con registro (para el historial), del más reciente al más antiguo
  loggedDays() {
    return Object.keys(this.state.logs)
      .filter(k => (this.state.logs[k].entries || []).length)
      .sort((a, b) => b.localeCompare(a))
      .map(k => ({ date: k, ...this.dayTotals(k) }));
  },

  // Desglose por comida: kcal/macros de cada comida y su % del total del día
  mealBreakdown(dateKey) {
    const log = this.state.logs[dateKey] || { entries: [] };
    const order = ["Desayuno", "Almuerzo", "Cena", "Snack", "Otro"];
    const meals = {};
    for (const e of log.entries) {
      const m = e.meal || "Otro";
      (meals[m] ||= { kcal: 0, protein: 0, carbs: 0, fat: 0, items: 0 });
      meals[m].kcal += e.kcal || 0; meals[m].protein += e.protein || 0;
      meals[m].carbs += e.carbs || 0; meals[m].fat += e.fat || 0; meals[m].items++;
    }
    const total = Object.values(meals).reduce((a, m) => a + m.kcal, 0) || 1;
    return order.filter(m => meals[m]).map(m => ({
      meal: m, kcal: Math.round(meals[m].kcal),
      protein: +meals[m].protein.toFixed(1), carbs: +meals[m].carbs.toFixed(1), fat: +meals[m].fat.toFixed(1),
      items: meals[m].items, pct: Math.round((meals[m].kcal / total) * 100),
    }));
  },

  // Tendencia de peso: promedio semanal y ritmo (kg/sem)
  weightTrend() {
    const w = this.state.weights;
    if (w.length < 2) return null;
    const first = w[0], last = w[w.length - 1];
    const days = (new Date(last.date) - new Date(first.date)) / 86400000;
    if (days <= 0) return null;
    const ratePerWeek = ((last.kg - first.kg) / days) * 7;
    return {
      first, last, days: Math.round(days),
      ratePerWeek: +ratePerWeek.toFixed(2),
      totalChange: +(last.kg - first.kg).toFixed(1),
    };
  },
};

if (typeof window !== "undefined") window.Store = Store;
