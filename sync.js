// sync.js — Sincronización opcional entre dispositivos vía Supabase (REST).
// Modelo simple "código de sincronización": una fila por código en la tabla
// tracker_state { code TEXT PK, data JSONB, updated_at TIMESTAMPTZ }.
// Sin login: quien tenga el código (no adivinable) ve y edita esos datos.

const Sync = {
  cfg() { return window.Store.state.sync || {}; },
  ready() { const c = this.cfg(); return !!(c.enabled && c.url && c.key && c.code); },

  _headers() {
    const c = this.cfg();
    return {
      "apikey": c.key,
      "Authorization": "Bearer " + c.key,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation",
    };
  },

  // Sube el estado completo (upsert por código)
  async push(state) {
    if (!this.ready()) return { ok: false, reason: "no-config" };
    const c = this.cfg();
    try {
      const payload = {
        code: c.code,
        data: { profile: state.profile, logs: state.logs, weights: state.weights, customFoods: state.customFoods, updatedAt: state.updatedAt },
        updated_at: new Date().toISOString(),
      };
      const res = await fetch(`${c.url}/rest/v1/tracker_state?on_conflict=code`, {
        method: "POST", headers: this._headers(), body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()));
      this._setStatus("ok", "Sincronizado");
      return { ok: true };
    } catch (e) {
      this._setStatus("error", "Error al sincronizar");
      console.warn("Sync push falló:", e);
      return { ok: false, reason: e.message };
    }
  },

  // Descarga el estado remoto
  async pull() {
    if (!this.ready()) return null;
    const c = this.cfg();
    try {
      const res = await fetch(`${c.url}/rest/v1/tracker_state?code=eq.${encodeURIComponent(c.code)}&select=data,updated_at`, {
        headers: this._headers(),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();
      this._setStatus("ok", "Conectado");
      return rows[0]?.data || null;
    } catch (e) {
      this._setStatus("error", "Sin conexión");
      console.warn("Sync pull falló:", e);
      return null;
    }
  },

  // Fusiona remoto al cargar: gana el de updatedAt más reciente.
  async syncOnLoad() {
    if (!this.ready()) return;
    const remote = await this.pull();
    if (remote && (remote.updatedAt || 0) > (window.Store.state.updatedAt || 0)) {
      window.Store.replace(remote);
    } else {
      this.push(window.Store.state);
    }
  },

  _setStatus(level, msg) {
    const el = document.getElementById("syncStatus");
    if (!el) return;
    el.dataset.level = level;
    el.textContent = level === "ok" ? "☁︎ " + msg : "⚠︎ " + msg;
  },
};

if (typeof window !== "undefined") window.Sync = Sync;
