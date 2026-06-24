// whoop.js — Cliente de la integración WHOOP (habla con tu Cloudflare Worker).
// Trae calorías quemadas, strain, recuperación y sueño, y los guarda por día
// en logs[fecha].activity. La sincronización con WHOOP corre vía el worker.
const WHOOPC = {
  cfg() { return window.Store.state.whoop || {}; },
  ready() { const c = this.cfg(); return !!(c.enabled && c.workerUrl && c.code); },
  base() { return (this.cfg().workerUrl || "").replace(/\/$/, ""); },
  loginUrl() { return this.base() + "/login?code=" + encodeURIComponent(this.cfg().code); },

  async sync() {
    if (!this.ready()) return { ok: false, error: "no_config" };
    try {
      const res = await fetch(this.base() + "/whoop?code=" + encodeURIComponent(this.cfg().code));
      const data = await res.json();
      if (data.error) return { ok: false, error: data.error };
      const days = data.days || {};
      let n = 0, today = null;
      const todayKey = window.Store.todayKey();
      for (const d in days) {
        const log = window.Store.dayLog(d);
        log.activity = Object.assign(log.activity || {}, days[d]);
        if (d === todayKey) today = log.activity;
        n++;
      }
      if (n) window.Store.save({ remote: false });
      return { ok: true, days: n, today };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  // Actividad de un día con datos reales (o null)
  activity(dateKey) {
    const log = window.Store.state.logs[dateKey];
    const a = log && log.activity;
    return a && (a.burned > 0 || a.strain > 0) ? a : null;
  },
};
if (typeof window !== "undefined") window.WHOOPC = WHOOPC;
