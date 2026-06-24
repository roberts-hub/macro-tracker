# ⌚ Conectar WHOOP a MacroTrack (automático)

Esto trae **calorías quemadas, strain, sueño y recuperación** a tu app, y calcula tu **balance real** (comido − quemado). Es una sola configuración (~10 min). Lo haces 1 vez.

Necesitas 2 cuentas gratis: **Cloudflare** (para un mini-servidor) y tu **WHOOP**.

---

## Paso 1 — Crea el Worker en Cloudflare (gratis)
1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) y crea cuenta (gratis).
2. **Workers & Pages → Create → Workers → Create Worker**. Ponle nombre (ej. `macrotrack-whoop`) → **Deploy**.
3. Ya tienes una URL tipo `https://macrotrack-whoop.tu-sub.workers.dev`. **Cópiala** (la usarás en los pasos 2 y 4).
4. **Edit code** → borra todo y pega el contenido del archivo **`whoop-worker.js`** → **Deploy**.

## Paso 2 — Crea tu app de WHOOP
1. Entra a [developer.whoop.com](https://developer.whoop.com) e inicia sesión con tu cuenta WHOOP.
2. Crea una nueva app:
   - **Scopes:** marca `read:cycles`, `read:recovery`, `read:sleep`, `read:profile`, `offline`.
   - **Redirect URI:** pega la URL de tu Worker + `/callback`, así:
     `https://macrotrack-whoop.tu-sub.workers.dev/callback`
3. Guarda. Copia el **Client ID** y el **Client Secret**.

## Paso 3 — Mete los secretos al Worker
En tu Worker (Cloudflare) → **Settings → Variables and Secrets** → agrega 2:
- `WHOOP_CLIENT_ID` = (tu Client ID)
- `WHOOP_CLIENT_SECRET` = (tu Client Secret)  ← márcalo como **Secret/Encrypt**

Luego **Storage & Databases → KV → Create namespace** (ej. `whoop_tokens`). Vuelve al Worker → **Settings → Bindings → Add → KV namespace**:
- Variable name: **`TOKENS`**  · KV namespace: el que creaste.

**Redeploy** el Worker.

## Paso 4 — Conecta desde la app
1. Abre MacroTrack → **Perfil → Conectar WHOOP**.
2. Pega la **URL de tu Worker** y elige un **código personal** (ej. `roberts-whoop`).
3. **Guardar y conectar** → te manda a WHOOP a autorizar → vuelves a la app y dice **"WHOOP conectado ✔"**.

¡Listo! La app traerá tus datos de WHOOP cada vez que la abras. Verás:
- En **Hoy**: tarjeta WHOOP con calorías quemadas, strain, recuperación, sueño y **tu balance real**.
- En **Coach**: tu balance real (comido − quemado) y avisos si tu recuperación está baja.

---

### Notas
- Tu código personal va solo en la app; los tokens viven en tu Worker (tu Cloudflare). Nada sensible se guarda en la app.
- Si algo falla en "Sincronizar ahora", revisa que el `Redirect URI` de WHOOP sea **idéntico** a `TU_WORKER/callback` y que el binding KV se llame exactamente `TOKENS`.
