// ============================================================
//  MacroTrack ↔ WHOOP — Cloudflare Worker (OAuth + datos)
//  Pégalo en un Worker de Cloudflare. Necesita:
//   - Variables: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET (Settings → Variables)
//   - KV namespace enlazado como  TOKENS
//  Ver la guía en WHOOP-SETUP.md
// ============================================================
const WHOOP_AUTH  = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API   = "https://api.prod.whoop.com/developer";
const SCOPES = "read:cycles read:recovery read:sleep read:profile offline";
const APP_URL = "https://roberts-hub.github.io/macro-tracker/";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = url.origin;
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    // 1) Iniciar OAuth — la app abre /login?code=<tu_codigo>
    if (url.pathname === "/login") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Falta ?code=", { status: 400 });
      const a = new URL(WHOOP_AUTH);
      a.searchParams.set("response_type", "code");
      a.searchParams.set("client_id", env.WHOOP_CLIENT_ID);
      a.searchParams.set("redirect_uri", origin + "/callback");
      a.searchParams.set("scope", SCOPES);
      a.searchParams.set("state", code);
      return Response.redirect(a.toString(), 302);
    }

    // 2) Callback de WHOOP — intercambia el code por tokens y los guarda
    if (url.pathname === "/callback") {
      const authCode = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!authCode || !state) return new Response("Falta code/state", { status: 400 });
      const r = await fetch(WHOOP_TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: authCode,
          client_id: env.WHOOP_CLIENT_ID,
          client_secret: env.WHOOP_CLIENT_SECRET,
          redirect_uri: origin + "/callback",
        }),
      });
      if (!r.ok) return new Response("Error al obtener token: " + (await r.text()), { status: 500 });
      await saveTokens(env, state, await r.json());
      return Response.redirect(APP_URL + "?whoop=ok", 302);
    }

    // 3) Datos — la app pide /whoop?code=<tu_codigo>
    if (url.pathname === "/whoop") {
      const code = url.searchParams.get("code");
      if (!code) return json({ error: "falta code" }, 400, cors);
      let tok = await getTokens(env, code);
      if (!tok) return json({ error: "no_conectado" }, 401, cors);
      if (Date.now() > tok.expires_at - 60000) {
        tok = await refresh(env, code, tok.refresh_token);
        if (!tok) return json({ error: "refresh_fallido" }, 401, cors);
      }
      const h = { Authorization: "Bearer " + tok.access_token };
      const [cycles, recov, sleep] = await Promise.all([
        fetch(WHOOP_API + "/v2/cycle?limit=8", { headers: h }).then(safeJson),
        fetch(WHOOP_API + "/v2/recovery?limit=8", { headers: h }).then(safeJson),
        fetch(WHOOP_API + "/v2/activity/sleep?limit=8", { headers: h }).then(safeJson),
      ]);
      const days = {};
      const D = (d) => (days[d] = days[d] || {});
      for (const c of (cycles.records || [])) {
        const d = (c.start || "").slice(0, 10); if (!d) continue;
        const s = c.score || {};
        if (s.kilojoule != null) D(d).burned = Math.round(s.kilojoule / 4.184);
        if (s.strain != null) D(d).strain = +Number(s.strain).toFixed(1);
        if (s.average_heart_rate != null) D(d).avgHr = Math.round(s.average_heart_rate);
      }
      for (const rc of (recov.records || [])) {
        const d = (rc.created_at || "").slice(0, 10); if (!d) continue;
        const s = rc.score || {};
        if (s.recovery_score != null) D(d).recovery = Math.round(s.recovery_score);
        if (s.hrv_rmssd_milli != null) D(d).hrv = Math.round(s.hrv_rmssd_milli);
        if (s.resting_heart_rate != null) D(d).rhr = Math.round(s.resting_heart_rate);
      }
      for (const sl of (sleep.records || [])) {
        const d = (sl.start || "").slice(0, 10); if (!d) continue;
        const s = sl.score || {}, st = s.stage_summary || {};
        if (s.sleep_performance_percentage != null) D(d).sleepPerf = Math.round(s.sleep_performance_percentage);
        const ms = (st.total_light_sleep_time_milli || 0) + (st.total_slow_wave_sleep_time_milli || 0) + (st.total_rem_sleep_time_milli || 0);
        if (ms) D(d).sleepH = +(ms / 3600000).toFixed(1);
      }
      return json({ days }, 200, cors);
    }

    return new Response("MacroTrack ↔ WHOOP worker activo. Rutas: /login?code= · /callback · /whoop?code=", { headers: { "content-type": "text/plain" } });
  },
};

async function saveTokens(env, code, tok) {
  await env.TOKENS.put("whoop:" + code, JSON.stringify({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: Date.now() + (tok.expires_in || 3600) * 1000,
  }));
}
async function getTokens(env, code) {
  const v = await env.TOKENS.get("whoop:" + code);
  return v ? JSON.parse(v) : null;
}
async function refresh(env, code, refresh_token) {
  const r = await fetch(WHOOP_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token,
      client_id: env.WHOOP_CLIENT_ID, client_secret: env.WHOOP_CLIENT_SECRET, scope: "offline",
    }),
  });
  if (!r.ok) return null;
  await saveTokens(env, code, await r.json());
  return getTokens(env, code);
}
async function safeJson(r) { try { return await r.json(); } catch { return {}; } }
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...cors } });
}
