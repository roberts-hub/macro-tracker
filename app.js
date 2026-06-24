// app.js — UI, navegación y lógica de interacción.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString("es-MX");

  let currentDate = Store.todayKey();
  let pendingFood = null; // alimento elegido en el modal

  // ---------------- arranque ----------------
  function init() {
    Store.load();
    bindNav();
    bindModals();
    bindProfileForm();
    bindSync();
    Store.subscribe(renderAll);

    if (Store.state.sync?.enabled && window.Sync) Sync.syncOnLoad();

    if (!Store.state.profile) {
      openOnboarding();
    }
    renderAll();
    $("#dateLabel").textContent = friendlyDate(currentDate);
  }

  function friendlyDate(key) {
    const d = new Date(key + "T12:00:00");
    return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  }
  function keyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  function isToday(key) { return key === Store.todayKey(); }
  function changeDay(delta) {
    const d = new Date(currentDate + "T12:00:00"); d.setDate(d.getDate() + delta);
    const k = keyOf(d);
    if (k > Store.todayKey()) return; // no navegar al futuro
    currentDate = k; $("#dateLabel").textContent = friendlyDate(currentDate); renderToday();
  }
  function viewDay(key) { currentDate = key; $("#dateLabel").textContent = friendlyDate(currentDate); switchView("today"); }

  // ---------------- navegación ----------------
  function bindNav() {
    $$(".nav button").forEach(b => b.addEventListener("click", () => switchView(b.dataset.view)));
  }
  function switchView(name) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.view === name));
    renderAll();
  }

  // ---------------- render principal ----------------
  function renderAll() {
    if (!Store.state.profile) return;
    renderToday();
    renderProgress();
    renderProfile();
  }

  function targets() { return NUTRITION.computeTargets(Store.state.profile); }

  // ---------------- VISTA HOY ----------------
  function renderToday() {
    const t = targets();
    const tot = Store.dayTotals(currentDate);
    const host = $("#view-today");

    const kcalPct = Math.min(100, (tot.kcal / t.kcalTarget) * 100);
    const remaining = t.kcalTarget - tot.kcal;

    host.innerHTML = `
      <div class="datenav">
        <button id="dPrev" aria-label="Día anterior">‹</button>
        <div class="dlabel" id="dLabel">${isToday(currentDate) ? "Hoy" : friendlyDate(currentDate)}</div>
        <button id="dNext" aria-label="Día siguiente" ${isToday(currentDate) ? "disabled" : ""}>›</button>
      </div>
      ${isToday(currentDate) ? "" : `<button class="btn secondary small" id="dToday" style="margin:0 auto 14px;display:block">Volver a hoy</button>`}
      <div class="card">
        <div class="kcal-ring-wrap">
          ${ring(kcalPct, fmt(tot.kcal), "de " + fmt(t.kcalTarget) + " kcal")}
          <div class="ring-meta">
            <div class="line"><span>Meta</span><b>${fmt(t.kcalTarget)} kcal</b></div>
            <div class="line"><span>Consumido</span><b>${fmt(tot.kcal)}</b></div>
            <div class="line"><span>${remaining >= 0 ? "Restante" : "Excedido"}</span>
              <b class="${remaining < 0 ? "over" : ""}">${fmt(Math.abs(remaining))} kcal</b></div>
          </div>
        </div>
        ${macroBar("Proteína", "protein", tot.protein, t.proteinG, "g")}
        ${macroBar("Carbohidratos", "carbs", tot.carbs, t.carbsG, "g")}
        ${macroBar("Grasas", "fat", tot.fat, t.fatG, "g")}
        ${macroBar("Fibra", "fiber", tot.fiber, t.fiberG, "g")}
      </div>

      <div class="card">
        <div class="row spread">
          <h2 style="margin:0">Agua</h2>
          <b>${(tot.water/1000).toFixed(2)} / ${(t.waterMl/1000).toFixed(1)} L</b>
        </div>
        <div class="bar" style="margin-top:10px"><span style="width:${Math.min(100,(tot.water/t.waterMl)*100)}%;background:var(--water)"></span></div>
        <div class="row" style="margin-top:12px;gap:8px">
          <button class="btn secondary small" data-water="250">+250 ml</button>
          <button class="btn secondary small" data-water="500">+500 ml</button>
          <button class="btn secondary small" data-water="-250">-250 ml</button>
        </div>
      </div>

      ${mealBreakdownCard()}

      ${proteinMealCard(t)}

      <div class="row spread" style="margin:22px 4px 10px">
        <h2 class="sectitle">Comidas del día</h2>
        <button class="btn small" id="addFoodBtn">+ Agregar</button>
      </div>
      <div id="entriesList"></div>
    `;

    // anillo dibujado vía dasharray ya en HTML; eventos:
    $("#dPrev").addEventListener("click", () => changeDay(-1));
    $("#dNext").addEventListener("click", () => changeDay(1));
    const dToday = $("#dToday"); if (dToday) dToday.addEventListener("click", () => { currentDate = Store.todayKey(); renderToday(); });
    $("#addFoodBtn").addEventListener("click", openAddFood);
    $("#dateLabel").textContent = friendlyDate(currentDate);
    $$("[data-water]", host).forEach(b => b.addEventListener("click", () => {
      const cur = Store.dayTotals(currentDate).water;
      Store.setWater(currentDate, cur + Number(b.dataset.water));
    }));
    renderEntries();
  }

  const MEAL_COLORS = { Desayuno: "var(--ochre)", Almuerzo: "var(--olive)", Cena: "var(--clay)", Snack: "var(--mauve)", Otro: "var(--umber)" };

  function mealBreakdownCard() {
    const bd = Store.mealBreakdown(currentDate);
    if (!bd.length) return "";
    const dayKcal = bd.reduce((a, m) => a + m.kcal, 0);
    const bar = bd.map(m => `<span style="width:${m.pct}%;background:${MEAL_COLORS[m.meal] || 'var(--umber)'}"></span>`).join("");
    const rows = bd.map(m => `
      <div class="bd-row">
        <div class="bd-name"><i style="background:${MEAL_COLORS[m.meal] || 'var(--umber)'}"></i>${m.meal}</div>
        <div class="bd-right">
          <div class="bd-kcal"><b>${fmt(m.kcal)}</b> kcal · ${m.pct}%</div>
          <div class="bd-macros">P ${m.protein} · C ${m.carbs} · G ${m.fat} · ${m.items} item${m.items>1?'s':''}</div>
        </div>
      </div>`).join("");
    return `<div class="card">
      <h2>Desglose por comida</h2>
      <div class="bd-bar">${bar}</div>
      <div class="bd-total">Total del día <b>${fmt(dayKcal)} kcal</b></div>
      <div class="bd-list">${rows}</div>
    </div>`;
  }

  function proteinMealCard(t) {
    const meals = Store.proteinByMeal(currentDate);
    const order = ["Desayuno", "Almuerzo", "Cena", "Snack", "Otro"];
    const keys = order.filter(k => meals[k] != null);
    if (!keys.length) return "";
    const shortLabel = { ok: "óptimo", low: "baja", high: "alta" };
    const rows = keys.map(k => {
      const g = meals[k];
      const flag = NUTRITION.mealProteinFlag(g);
      const cls = flag.level === "ok" ? "good" : (flag.level === "low" ? "warn" : "bad");
      return `<div class="row spread" style="padding:7px 0;gap:10px">
        <span>${k}</span>
        <span class="pill ${cls}" title="${flag.msg}">${g} g · ${shortLabel[flag.level]}</span>
      </div>`;
    }).join("");
    return `<div class="card"><h2>Proteína por comida <span class="muted" style="text-transform:none">(ideal 20–40 g c/u)</span></h2>${rows}</div>`;
  }

  function renderEntries() {
    const host = $("#entriesList");
    const log = Store.state.logs[currentDate] || { entries: [] };
    if (!log.entries.length) {
      host.innerHTML = `<div class="center-empty">Aún no registras nada hoy.<br>Toca <b>+ Agregar</b> o describe lo que comiste.</div>`;
      return;
    }
    const order = ["Desayuno", "Almuerzo", "Cena", "Snack", "Otro"];
    const byMeal = {};
    log.entries.forEach(e => { (byMeal[e.meal || "Otro"] ||= []).push(e); });
    host.innerHTML = order.filter(m => byMeal[m]).map(m => {
      const items = byMeal[m].map(e => `
        <div class="entry">
          <div class="info" data-edit="${e.id}">
            <div class="nm">${e.name}</div>
            <div class="mc">${e.note ? e.note + " · " : ""}${e.grams} g · P ${e.protein} · C ${e.carbs} · G ${e.fat}</div>
          </div>
          <div class="kc">${fmt(e.kcal)}</div>
          <button class="del" data-del="${e.id}">✕</button>
        </div>`).join("");
      return `<div class="meal-group"><div class="meal-head">${m}</div>${items}</div>`;
    }).join("");
    $$("[data-del]", host).forEach(b => b.addEventListener("click", () => Store.removeEntry(currentDate, b.dataset.del)));
    $$("[data-edit]", host).forEach(el => el.addEventListener("click", () => editEntry(el.dataset.edit)));
  }

  // ---------------- anillos / barras ----------------
  function ring(pct, big, sub) {
    const R = 56, C = 2 * Math.PI * R;
    const off = C * (1 - Math.min(1, pct / 100));
    return `<div class="ring">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="${R}" stroke="var(--bg-elev)" stroke-width="11" fill="none"/>
        <circle cx="66" cy="66" r="${R}" stroke="var(--kcal)" stroke-width="11" fill="none"
          stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
      </svg>
      <div class="center"><div class="big">${big}</div><div class="sub">${sub}</div></div>
    </div>`;
  }

  function macroBar(name, cls, val, goal, unit) {
    const pct = goal > 0 ? (val / goal) * 100 : 0;
    const over = pct > 105;
    return `<div class="macro ${cls}">
      <div class="top">
        <span class="name">${name}</span>
        <span class="vals"><b class="${over ? "over" : ""}">${val}</b> / ${goal} ${unit} · <span class="pct">${Math.round(pct)}%</span></span>
      </div>
      <div class="bar"><span style="width:${Math.min(100, pct)}%"></span></div>
    </div>`;
  }

  // ---------------- VISTA PROGRESO ----------------
  function renderProgress() {
    const host = $("#view-progress");
    const t = targets();
    const trend = Store.weightTrend();
    const gain = NUTRITION.weeklyGainTarget(Store.state.profile.weightKg);

    let advice = `<div class="banner info">Registra tu peso ~2-3 veces por semana, en ayunas. El peso es el <b>verificador real</b> de si tu superávit es correcto.</div>`;
    if (trend) {
      const r = trend.ratePerWeek;
      if (r < gain.min) advice = `<div class="banner warn">Subiendo <b>${r} kg/sem</b> (meta ${gain.min}–${gain.max}). Vas lento: sube ~150 kcal/día y reevalúa en 1-2 semanas.</div>`;
      else if (r > gain.max) advice = `<div class="banner warn">Subiendo <b>${r} kg/sem</b> (meta ${gain.min}–${gain.max}). Demasiado rápido = más grasa. Baja ~150 kcal/día.</div>`;
      else advice = `<div class="banner good">Subiendo <b>${r} kg/sem</b> — dentro del rango ideal (${gain.min}–${gain.max} kg/sem). Mantén las calorías.</div>`;
    }

    host.innerHTML = `
      <div class="card">
        <h2>Peso corporal</h2>
        ${advice}
        ${weightChart()}
        <div class="row" style="gap:10px;margin-top:14px">
          <input type="number" id="wInput" placeholder="${Store.state.profile.weightKg} kg" step="0.1" inputmode="decimal">
          <button class="btn small" id="wAdd" style="white-space:nowrap">Registrar</button>
        </div>
        <div class="hint">Se guarda con la fecha de hoy.</div>
      </div>

      <div class="card">
        <h2>Resumen</h2>
        <div class="stat-grid">
          <div class="stat"><div class="v">${trend ? (trend.totalChange>0?"+":"")+trend.totalChange+" kg" : "—"}</div><div class="k">Cambio total${trend?` (${trend.days} d)`:""}</div></div>
          <div class="stat"><div class="v">${trend ? trend.ratePerWeek+" kg" : "—"}</div><div class="k">Ritmo semanal</div></div>
          <div class="stat"><div class="v">${gain.min}–${gain.max}</div><div class="k">Meta kg/sem</div></div>
          <div class="stat"><div class="v">${fmt(t.kcalTarget)}</div><div class="k">Meta kcal/día</div></div>
        </div>
      </div>

      <div class="card">
        <h2>Cumplimiento (últimos 7 días)</h2>
        ${adherence7()}
      </div>

      <div class="card">
        <h2>Historial de días</h2>
        ${historyList()}
      </div>
    `;
    $("#wAdd").addEventListener("click", () => {
      const v = parseFloat($("#wInput").value);
      if (v > 0) { Store.logWeight(Store.todayKey(), v); }
    });
    $$("[data-day]", host).forEach(el => el.addEventListener("click", () => viewDay(el.dataset.day)));
  }

  function historyList() {
    const days = Store.loggedDays();
    if (!days.length) return `<div class="center-empty">Aún no hay días registrados. Lo que comas se guarda por día automáticamente.</div>`;
    const t = targets();
    return days.slice(0, 30).map(d => {
      const kp = Math.round((d.kcal / t.kcalTarget) * 100);
      return `<div class="hist-row" data-day="${d.date}">
        <div><div class="hist-d">${friendlyDate(d.date)}${isToday(d.date) ? " · hoy" : ""}</div>
          <div class="hist-m">P ${d.protein} · C ${d.carbs} · G ${d.fat}</div></div>
        <div class="hist-k"><b>${fmt(d.kcal)}</b> kcal <span class="pill ${kp>=90&&kp<=110?'good':'warn'}">${kp}%</span></div>
      </div>`;
    }).join("");
  }

  function weightChart() {
    const w = Store.state.weights;
    if (w.length < 2) return `<div class="center-empty">Registra tu peso al menos 2 veces para ver la tendencia.</div>`;
    const W = 680, H = 170, pad = 28;
    const xs = w.map(p => new Date(p.date).getTime());
    const ys = w.map(p => p.kg);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys) - 0.5, maxY = Math.max(...ys) + 0.5;
    const X = t => pad + ((t - minX) / (maxX - minX || 1)) * (W - pad * 2);
    const Y = v => H - pad - ((v - minY) / (maxY - minY || 1)) * (H - pad * 2);
    const pts = w.map(p => `${X(new Date(p.date).getTime()).toFixed(0)},${Y(p.kg).toFixed(0)}`).join(" ");
    const dots = w.map(p => `<circle cx="${X(new Date(p.date).getTime()).toFixed(0)}" cy="${Y(p.kg).toFixed(0)}" r="3"/>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}"/>
      <polyline points="${pts}"/>${dots}
      <text x="${pad}" y="14">${maxY.toFixed(1)} kg</text>
      <text x="${pad}" y="${H-8}">${minY.toFixed(1)} kg</text>
    </svg>`;
  }

  function adherence7() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days.push(key);
    }
    const t = targets();
    const rows = days.map(key => {
      const tot = Store.dayTotals(key);
      if (!Store.state.logs[key] || !Store.state.logs[key].entries.length)
        return `<div class="row spread" style="padding:5px 0"><span class="muted">${shortDate(key)}</span><span class="muted">sin registro</span></div>`;
      const kp = Math.round((tot.kcal/t.kcalTarget)*100);
      const pp = Math.round((tot.protein/t.proteinG)*100);
      return `<div class="row spread" style="padding:5px 0">
        <span>${shortDate(key)}</span>
        <span><span class="pill ${kp>=90&&kp<=110?'good':'warn'}">${kp}% kcal</span>
        <span class="pill ${pp>=90?'good':'warn'}">${pp}% prot</span></span>
      </div>`;
    }).join("");
    return rows;
  }
  function shortDate(key){ const d=new Date(key+"T12:00:00"); return d.toLocaleDateString("es-MX",{weekday:"short",day:"numeric"}); }

  function bodyCompCard(p) {
    if (!p.bodyFat && !p.smm) return "";
    const w = p.weightKg, hM = (p.heightCm || 0) / 100;
    const ffm = p.bodyFat ? +(w * (1 - p.bodyFat / 100)).toFixed(1) : null;
    const ffmi = (ffm && hM) ? +(ffm / (hM * hM)).toFixed(1) : null;
    const fatKg = p.bodyFat ? +(w * p.bodyFat / 100).toFixed(1) : null;
    return `<div class="card">
      <h2>Composición corporal <span class="muted" style="text-transform:none">(InBody)</span></h2>
      <div class="stat-grid">
        ${p.bodyFat ? `<div class="stat"><div class="v">${p.bodyFat}%</div><div class="k">Grasa corporal</div></div>` : ""}
        ${fatKg != null ? `<div class="stat"><div class="v">${fatKg} kg</div><div class="k">Masa grasa</div></div>` : ""}
        ${p.smm ? `<div class="stat"><div class="v">${p.smm} kg</div><div class="k">Músculo (SMM)</div></div>` : ""}
        ${ffm != null ? `<div class="stat"><div class="v">${ffm} kg</div><div class="k">Masa libre de grasa</div></div>` : ""}
        ${ffmi != null ? `<div class="stat"><div class="v">${ffmi}</div><div class="k">FFMI</div></div>` : ""}
      </div>
      <div class="hint" style="margin-top:12px">Tu objetivo: subir SMM manteniendo % grasa bajo. Vuelve a medirte cada 4–6 semanas y actualiza estos datos para ver el progreso.</div>
    </div>`;
  }

  // ---------------- VISTA PERFIL ----------------
  function renderProfile() {
    const p = Store.state.profile;
    const t = targets();
    const host = $("#view-profile");
    host.innerHTML = `
      <div class="card">
        <h2>Tus metas calibradas</h2>
        <div class="stat-grid">
          <div class="stat"><div class="v">${fmt(t.maintenance)}</div><div class="k">Mantenimiento (TDEE)</div></div>
          <div class="stat"><div class="v">${fmt(t.kcalTarget)}</div><div class="k">Meta (superávit +${t.surplus})</div></div>
          <div class="stat"><div class="v">${t.proteinG} g</div><div class="k">Proteína (${(p.proteinPerKg||2).toFixed(1)} g/kg)</div></div>
          <div class="stat"><div class="v">${t.carbsG} g</div><div class="k">Carbohidratos</div></div>
          <div class="stat"><div class="v">${t.fatG} g</div><div class="k">Grasas</div></div>
          <div class="stat"><div class="v">${t.macroPct.protein}/${t.macroPct.carbs}/${t.macroPct.fat}</div><div class="k">% P/C/G</div></div>
        </div>
        <button class="btn secondary" style="margin-top:14px" id="editProfileBtn">Editar perfil y metas</button>
      </div>

      ${bodyCompCard(p)}

      <div class="card">
        <h2>Asistente IA (describe lo que comiste)</h2>
        <p class="muted" id="aiDesc"></p>
        <button class="btn secondary" id="aiBtn">${Store.state.ai?.enabled ? "Configuración de IA" : "Activar IA"}</button>
      </div>

      <div class="card">
        <h2>☁︎ Sincronizar celular ↔ compu</h2>
        <p class="muted" id="syncDesc"></p>
        <button class="btn secondary" id="syncBtn">${Store.state.sync?.enabled ? "Configuración de sincronización" : "Activar sincronización"}</button>
      </div>

      <div class="card">
        <h2>Datos</h2>
        <div class="row" style="gap:10px">
          <button class="btn secondary small" id="exportBtn">Exportar</button>
          <button class="btn secondary small" id="importBtn">Importar</button>
          <button class="btn secondary small" id="addCustomBtn">+ Alimento propio</button>
        </div>
      </div>
    `;
    $("#syncDesc").textContent = Store.state.sync?.enabled
      ? `Sincronización ACTIVA con el código "${Store.state.sync.code}". Usa el mismo código en tu otro dispositivo.`
      : "Conecta una base de datos gratis (Supabase) y usa un código para ver los mismos datos en celular y computadora.";
    $("#aiDesc").textContent = Store.state.ai?.enabled
      ? `IA ACTIVA con el modelo ${Store.state.ai.model}. Describe tu comida en lenguaje natural y la convierte en macros.`
      : "Conecta tu clave de Anthropic para que la IA estime los macros de cualquier platillo que describas. La clave se guarda solo en este dispositivo.";
    $("#editProfileBtn").addEventListener("click", () => openProfileEditor());
    $("#aiBtn").addEventListener("click", openAISettings);
    $("#syncBtn").addEventListener("click", openSyncModal);
    $("#exportBtn").addEventListener("click", exportData);
    $("#importBtn").addEventListener("click", importData);
    $("#addCustomBtn").addEventListener("click", openCustomFood);
  }

  // ---------------- AGREGAR COMIDA (modal) ----------------
  function openAddFood() {
    pendingFood = null;
    const aiOn = window.AI && AI.ready();
    showModal(`
      <h3>Agregar comida</h3>
      <div class="seg" id="mealSeg" style="margin:12px 0 16px">
        ${["Desayuno","Almuerzo","Cena","Snack"].map((m,i)=>`<button data-meal="${m}" class="${i===autoMeal()?'on':''}">${m}</button>`).join("")}
        ${aiOn ? `<button data-meal="auto" style="flex-basis:100%">Todo el día (la IA reparte)</button>` : ""}
      </div>

      <span class="lbl" style="display:block;margin-bottom:7px">Describe lo que comiste ${aiOn ? '<span class="ai-tag">IA activa</span>' : ''}</span>
      <textarea id="nlInput" rows="3" placeholder="Ej: dos tacos al pastor, una quesadilla y un agua de horchata"></textarea>
      <button class="btn" id="nlBtn" style="margin-top:10px">${aiOn ? "Analizar con IA" : "Analizar"}</button>
      <div class="hint" style="margin-top:8px">
        ${aiOn
          ? "La IA estima los macros de cualquier platillo. Revisas antes de guardar."
          : 'Detección básica por palabras. <a id="aiHint" href="#">Activar IA</a> para estimar cualquier platillo.'}
      </div>

      <div style="border-top:1px solid var(--line);margin:18px 0;padding-top:16px">
        <label class="field" style="margin:0">
          <span class="lbl">O busca un alimento</span>
          <input type="text" id="foodSearch" placeholder="ej: 4 huevos · 1 taza de arroz · pollo" autocomplete="off">
        </label>
        <div class="search-results" id="searchResults"></div>
      </div>
    `);
    let meal = ["Desayuno","Almuerzo","Cena","Snack"][autoMeal()];
    $$("#mealSeg button").forEach(b => b.addEventListener("click", () => {
      $$("#mealSeg button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); meal = b.dataset.meal;
    }));
    const search = $("#foodSearch");
    search.addEventListener("input", () => renderSearch(search.value, meal));
    renderSearch("", meal);
    $("#nlBtn").addEventListener("click", () => { analyzeDescription($("#nlInput").value, meal); });
    const aiHint = $("#aiHint"); if (aiHint) aiHint.addEventListener("click", (e) => { e.preventDefault(); openAISettings(); });
    setTimeout(() => $("#nlInput").focus(), 100);
  }

  // Decide IA vs heurística para "describe lo que comiste"
  async function analyzeDescription(text, meal) {
    if (!text.trim()) { toast("Escribe lo que comiste primero."); return; }
    if (!(window.AI && AI.ready())) { openNLReview(text, meal); return; }
    const btn = $("#nlBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Analizando con IA…"; }
    try {
      const items = await AI.parse(text, meal);
      if (!items.length) { toast("La IA no detectó alimentos. Intenta de nuevo."); if (btn){btn.disabled=false;btn.textContent="Analizar con IA";} return; }
      openAIReview(items, meal, text);
    } catch (e) {
      console.warn("IA falló:", e);
      toast((e.message || "Error con la IA") + " Uso detección básica.");
      openNLReview(text, meal);
    }
  }

  function autoMeal() {
    const h = new Date().getHours();
    if (h < 11) return 0; if (h < 16) return 1; if (h < 21) return 2; return 3;
  }

  // unidades de medida (NO incluye alimentos como huevo/taco/tortilla)
  const MEASURE_UNITS = ["taza","tazas","cucharada","cucharadas","cda","cdas","cucharadita","cucharaditas","cdta",
    "scoop","scoops","vaso","vasos","lata","latas","rebanada","rebanadas","filete","filetes",
    "porcion","porciones","plato","platos","pieza","piezas","unidad","unidades","puno","punado",
    "g","gr","grs","gramos","ml","mililitros"];
  const STOPWORDS = ["de","del","la","el","los","las","con","y","mi","mis","un","una","uno","dos","tres","cuatro",
    "cinco","seis","siete","ocho","medio","media","par","docena"];

  function cleanTerm(nq) {
    let t = " " + nq + " ";
    t = t.replace(/\d+\s*\/\s*\d+/g, " ").replace(/\d+([.,]\d+)?/g, " ");
    for (const w of [...MEASURE_UNITS, ...STOPWORDS]) t = t.replace(new RegExp("\\b" + w + "\\b", "g"), " ");
    return t.replace(/\s+/g, " ").trim();
  }

  let _offTimer = null, _offSeq = 0, _offCache = [];
  function renderSearch(q, meal) {
    if (meal === "auto") meal = MEAL_OPTS[autoMeal()]; // el buscador necesita un tiempo concreto
    const host = $("#searchResults");
    const foods = Store.allFoods();
    const norm = NLP.norm;
    const nq = norm(q);
    const term = cleanTerm(nq);
    const hasQty = /\d|\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|medio|media|par|docena)\b/.test(nq);

    // Sugerencia "Agregar rápido" cuando escribes cantidad + alimento (ej. "4 huevos")
    let quick = "";
    const best = q.trim() ? NLP.matchFood(nq, foods) : null;
    if (best && hasQty) {
      const g = NLP.gramsFor(nq, best, NLP.parseQty(nq)).g;
      const m = NUTRITION.macrosFor(best, g);
      quick = `<div class="food-opt quick" data-quick="${best.id}" data-grams="${g}" data-note="${q.trim().replace(/"/g,"&quot;")}">
        <div><div class="fn">Agregar “${q.trim()}”</div><div class="fm">${best.name} · ${g} g · ${fmt(m.kcal)} kcal</div></div>
        <span class="pill good">+ rápido</span></div>`;
    }

    const matches = (term ? foods.filter(f => norm(f.name).includes(term) || (f.aliases || []).some(a => norm(a).includes(term))) : foods).slice(0, 30);
    const list = matches.map(f => `
      <div class="food-opt" data-food="${f.id}">
        <div><div class="fn">${f.name}</div><div class="fm">${f.kcal} kcal · P${f.p} C${f.c} G${f.f} /100g</div></div>
        <span class="pill">+</span>
      </div>`).join("");

    const wantOff = q.trim().length >= 3 && window.OFF;
    host.innerHTML = quick + list + (wantOff ? `<div id="offResults"></div>` : (q.trim() && !list && !quick ? `<div class="center-empty">Escribe al menos 3 letras o usa “describe lo que comiste”.</div>` : ""));

    const qty = hasQty ? NLP.parseQty(nq) : 1;
    $$("[data-quick]", host).forEach(el => el.addEventListener("click", () => {
      const f = Store.findFood(el.dataset.quick); const g = Number(el.dataset.grams) || 100;
      Store.addEntry(currentDate, { foodId: f.id, name: f.name, grams: g, meal, note: el.dataset.note, ...NUTRITION.macrosFor(f, g) });
      closeModal(); toast(`Agregado a ${meal}: ${el.dataset.note}`);
    }));
    $$("[data-food]", host).forEach(el => el.addEventListener("click", () => openPortion(el.dataset.food, meal, { qty, query: q })));

    // Búsqueda en base global (Open Food Facts), con debounce
    if (wantOff) {
      const seq = ++_offSeq;
      clearTimeout(_offTimer);
      _offTimer = setTimeout(async () => {
        const box = document.getElementById("offResults"); if (!box) return;
        box.innerHTML = `<div class="meal-head">Base global · Open Food Facts</div><div class="muted" style="padding:6px 4px">Buscando…</div>`;
        const results = await OFF.search(q);
        if (seq !== _offSeq) return;
        const box2 = document.getElementById("offResults"); if (!box2) return;
        if (!results.length) { box2.innerHTML = ""; return; }
        _offCache = results;
        box2.innerHTML = `<div class="meal-head">Base global · Open Food Facts</div>` + results.map((r, i) => `
          <div class="food-opt" data-offidx="${i}">
            <div><div class="fn">${r.name}</div><div class="fm">${r.kcal} kcal · P${r.p} C${r.c} G${r.f} /100g</div></div>
            <span class="pill">+</span></div>`).join("");
        $$("[data-offidx]", box2).forEach(el => el.addEventListener("click", () => openPortion(_offCache[Number(el.dataset.offidx)], meal, { qty, query: q })));
      }, 450);
    }
  }

  function openPortion(foodId, meal, opts = {}) {
    const f = typeof foodId === "object" ? foodId : Store.findFood(foodId);
    if (!f) return;
    pendingFood = f;
    const portions = f.portions || [{ label: "100 g", g: 100 }];
    // gramos iniciales: respeta la cantidad escrita en el buscador (ej. "4 huevos")
    let initG = portions[0] ? portions[0].g : 100;
    let noteLabel = null;
    if (opts.query && /\d|\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|medio|media)\b/.test(NLP.norm(opts.query))) {
      initG = NLP.gramsFor(NLP.norm(opts.query), f, opts.qty || 1).g;
      noteLabel = opts.query.trim();
    }
    showModal(`
      <h3>${f.name}</h3>
      <p class="muted">${f.kcal} kcal · P${f.p} · C${f.c} · G${f.f} por 100 g</p>
      <span class="lbl">Porción rápida</span>
      <div class="seg" id="portionSeg" style="margin:8px 0 14px">
        ${portions.map(p => `<button data-g="${p.g}" data-label="${p.label.replace(/"/g,"&quot;")}">${p.label}</button>`).join("")}
      </div>
      <label class="field"><span class="lbl">Gramos</span>
        <input type="number" id="gramsInput" value="${initG}" inputmode="decimal"></label>
      <div id="macroPreview" class="card" style="margin:0 0 14px;background:var(--paper)"></div>
      <button class="btn" id="confirmAdd">Agregar a ${meal}</button>
    `);
    const gi = $("#gramsInput");
    const upd = () => {
      const g = Number(gi.value) || 0; const m = NUTRITION.macrosFor(f, g);
      $("#macroPreview").innerHTML = `<div class="row spread"><b>${fmt(m.kcal)} kcal</b><span class="muted">P ${m.protein} · C ${m.carbs} · G ${m.fat} · Fib ${m.fiber}</span></div>`;
    };
    $$("#portionSeg button").forEach(b => b.addEventListener("click", () => {
      $$("#portionSeg button").forEach(x => x.classList.remove("on")); b.classList.add("on");
      gi.value = b.dataset.g; noteLabel = b.dataset.label; upd();
    }));
    gi.addEventListener("input", () => { noteLabel = null; upd(); }); // si edita a mano, sin nota
    upd();
    $("#confirmAdd").addEventListener("click", () => {
      const g = Number(gi.value) || 0; if (g <= 0) return;
      Store.addEntry(currentDate, { foodId: f.id, name: f.name, grams: Math.round(g), meal, note: noteLabel || null, ...NUTRITION.macrosFor(f, g) });
      closeModal(); toast(`Agregado a ${meal}: ${f.name}`);
    });
  }

  // ---------------- Describe + revisión editable ----------------
  function nlRow(it) {
    const val = it.food ? it.food.name : (it.raw || "");
    const q = it.quantity && it.quantity > 0 ? it.quantity : 1;
    const baseGr = it.grams || 1;
    const perUnit = baseGr / q;
    return `<div class="nlrow ${it.matched ? "" : "unmatched"}" data-perunit="${perUnit}">
      <div class="nlmain">
        <input type="text" class="nlfood" list="allFoods" value="${val.replace(/"/g, "&quot;")}" placeholder="escribe el alimento">
        <button class="nldel" title="quitar">✕</button>
      </div>
      <div class="nlsub">
        <label class="qtylab">Cantidad<input type="number" class="nlqty" inputmode="decimal" step="any" value="${trimNum(q)}"></label>
        <label class="qtylab">Gramos<input type="number" class="nlgrams" inputmode="decimal" value="${it.grams}"></label>
        <span class="nlkc"></span>
      </div>
    </div>`;
  }

  function resolveFood(name, foods) {
    const n = NLP.norm(name);
    if (!n) return null;
    return foods.find(x => NLP.norm(x.name) === n)
        || foods.find(x => (x.aliases || []).some(a => NLP.norm(a) === n))
        || (n.length > 2 ? foods.find(x => NLP.norm(x.name).includes(n)) : null);
  }

  function openNLReview(text, meal) {
    if (meal === "auto") meal = MEAL_OPTS[autoMeal()]; // modo básico no reparte; usa el tiempo actual
    if (!text.trim()) { toast("Escribe lo que comiste primero."); return; }
    const foods = Store.allFoods();
    const items = NLP.parse(text, foods);
    if (!items.length) { toast("No detecté alimentos. Intenta describirlo distinto."); return; }
    const datalist = `<datalist id="allFoods">${foods.map(f => `<option value="${f.name.replace(/"/g, "&quot;")}"></option>`).join("")}</datalist>`;
    showModal(`
      <h3>Revisa lo detectado</h3>
      <p class="muted">Corrige el nombre o los gramos antes de guardar. Lo que no reconocí está marcado en rojo. Se agrega a <b>${meal}</b>.</p>
      ${datalist}
      <div id="nlRows">${items.map(nlRow).join("")}</div>
      <button class="btn secondary small" id="nlAddRow" style="margin:2px 0 16px">+ Otra línea</button>
      <button class="btn" id="nlConfirm">Agregar a ${meal}</button>
    `);

    const wireRow = (row) => {
      const fi = row.querySelector(".nlfood"), qi = row.querySelector(".nlqty"), gi = row.querySelector(".nlgrams"), kc = row.querySelector(".nlkc");
      const perUnit = Number(row.dataset.perunit) || 1;
      const upd = () => {
        const f = resolveFood(fi.value, foods);
        row.classList.toggle("unmatched", !f);
        kc.textContent = f ? fmt(NUTRITION.macrosFor(f, Number(gi.value) || 0).kcal) + " kcal" : "sin reconocer";
      };
      fi.addEventListener("input", upd);
      qi.addEventListener("input", () => { const q = Number(qi.value) || 0; gi.value = Math.round(perUnit * q); upd(); });
      gi.addEventListener("input", () => { if (perUnit > 0) qi.value = trimNum((Number(gi.value) || 0) / perUnit); upd(); });
      row.querySelector(".nldel").addEventListener("click", () => row.remove());
      upd();
    };
    $$("#nlRows .nlrow").forEach(wireRow);
    $("#nlAddRow").addEventListener("click", () => {
      const host = $("#nlRows");
      host.insertAdjacentHTML("beforeend", nlRow({ raw: "", food: null, grams: 100, quantity: 1, matched: false }));
      wireRow(host.lastElementChild);
    });
    $("#nlConfirm").addEventListener("click", () => {
      const added = [], failed = [];
      $$("#nlRows .nlrow").forEach(row => {
        const name = row.querySelector(".nlfood").value.trim();
        const qty = Number(row.querySelector(".nlqty").value) || 1;
        const grams = Number(row.querySelector(".nlgrams").value) || 0;
        if (!name) return;
        const f = resolveFood(name, foods);
        if (f && grams > 0) {
          const note = Math.abs(qty - 1) > 0.01 ? `${trimNum(qty)} ×` : null;
          Store.addEntry(currentDate, { foodId: f.id, name: f.name, grams: Math.round(grams), meal, note, ...NUTRITION.macrosFor(f, grams) });
          added.push(note ? `${f.name} (${trimNum(qty)}×)` : f.name);
        }
        else failed.push(name);
      });
      closeModal();
      if (added.length) toast(`Agregado a ${meal}: ${added.join(", ")}.` + (failed.length ? ` Sin reconocer: ${failed.join(", ")} — créalos en Perfil.` : ""));
      else toast("No se agregó nada. Revisa los nombres o crea el alimento en Perfil.");
    });
  }

  // ---------------- revisión de items estimados por IA ----------------
  function trimNum(n) { return (Math.round(n * 100) / 100).toString(); }

  const MEAL_OPTS = ["Desayuno", "Almuerzo", "Cena", "Snack"];
  function aiRow(it, defMeal) {
    const q = it.quantity && it.quantity > 0 ? it.quantity : 1;
    const baseGr = it.grams || 1;
    const perUnit = baseGr / q;
    const meal = it.meal || defMeal || "Snack";
    const opts = MEAL_OPTS.map(m => `<option ${m === meal ? "selected" : ""}>${m}</option>`).join("");
    return `<div class="nlrow" data-perunit="${perUnit}" data-basegr="${baseGr}" data-kcal="${it.kcal}" data-p="${it.protein}" data-c="${it.carbs}" data-f="${it.fat}" data-fib="${it.fiber || 0}">
      <div class="nlmain">
        <input type="text" class="aifood" value="${(it.name || "").replace(/"/g, "&quot;")}" placeholder="alimento">
        <button class="nldel" title="quitar">✕</button>
      </div>
      <div class="nlsub">
        <label class="qtylab">Cantidad<input type="number" class="aiqty" inputmode="decimal" step="any" value="${trimNum(q)}"></label>
        <label class="qtylab">Gramos<input type="number" class="aigrams" inputmode="decimal" value="${it.grams}"></label>
        <label class="qtylab">Comida<select class="aimeal">${opts}</select></label>
        <span class="nlkc"></span>
      </div>
    </div>`;
  }

  function openAIReview(items, meal, sourceText) {
    const auto = meal === "auto";
    const defMeal = auto ? MEAL_OPTS[autoMeal()] : meal;
    showModal(`
      <h3>Revisa lo detectado</h3>
      <p class="muted">${auto ? "La IA repartió cada alimento por tiempo de comida (puedes cambiarlo)." : `Se agrega a <b>${meal}</b>.`} Revisa cantidad y gramos (todo se reescala).</p>
      <div id="aiRows">${items.map(it => aiRow(it, defMeal)).join("")}</div>
      <button class="btn secondary small" id="aiAddRow" style="margin:2px 0 16px">+ Otra línea</button>
      <button class="btn" id="aiConfirm">Agregar${auto ? "" : ` a ${meal}`}</button>
    `);
    const macrosFor = (row, grams) => {
      const r = grams / (Number(row.dataset.basegr) || 1);
      return {
        grams: Math.round(grams),
        kcal: Math.round(Number(row.dataset.kcal) * r),
        protein: +(Number(row.dataset.p) * r).toFixed(1),
        carbs: +(Number(row.dataset.c) * r).toFixed(1),
        fat: +(Number(row.dataset.f) * r).toFixed(1),
        fiber: +(Number(row.dataset.fib) * r).toFixed(1),
      };
    };
    const wire = (row) => {
      const qi = row.querySelector(".aiqty"), gi = row.querySelector(".aigrams"), kc = row.querySelector(".nlkc");
      const perUnit = Number(row.dataset.perunit) || 1;
      const refreshKc = () => { kc.textContent = fmt(macrosFor(row, Number(gi.value) || 0).kcal) + " kcal"; };
      qi.addEventListener("input", () => { // cambiar cantidad → recalcula gramos
        const q = Number(qi.value) || 0; gi.value = Math.round(perUnit * q); refreshKc();
      });
      gi.addEventListener("input", () => { // cambiar gramos → recalcula cantidad
        const g = Number(gi.value) || 0; if (perUnit > 0) qi.value = trimNum(g / perUnit); refreshKc();
      });
      row.querySelector(".nldel").addEventListener("click", () => row.remove());
      refreshKc();
    };
    $$("#aiRows .nlrow").forEach(wire);
    $("#aiAddRow").addEventListener("click", () => {
      const host = $("#aiRows");
      host.insertAdjacentHTML("beforeend", aiRow({ name: "", quantity: 1, grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, defMeal));
      wire(host.lastElementChild);
    });
    $("#aiConfirm").addEventListener("click", () => {
      const added = [];
      $$("#aiRows .nlrow").forEach(row => {
        const name = row.querySelector(".aifood").value.trim();
        const qty = Number(row.querySelector(".aiqty").value) || 1;
        const rowMeal = row.querySelector(".aimeal").value;
        const m = macrosFor(row, Number(row.querySelector(".aigrams").value) || 0);
        if (!name || m.grams <= 0) return;
        const note = qty && Math.abs(qty - 1) > 0.01 ? `${trimNum(qty)} ×` : null;
        Store.addEntry(currentDate, { foodId: null, name, meal: rowMeal, note, ...m });
        added.push(name);
      });
      closeModal();
      toast(added.length ? `Agregado: ${added.join(", ")}.` : "No se agregó nada.");
    });
  }

  // ---------------- editar una comida registrada ----------------
  function editEntry(id) {
    const log = Store.state.logs[currentDate]; if (!log) return;
    const e = log.entries.find(x => x.id === id); if (!e) return;
    const f = Store.findFood(e.foodId);
    const meals = ["Desayuno", "Almuerzo", "Cena", "Snack"];
    showModal(`
      <h3>${e.name}</h3>
      ${f ? `<p class="muted">${f.kcal} kcal · P${f.p} · C${f.c} · G${f.f} por 100 g</p>` : `<p class="muted">Alimento personalizado</p>`}
      <span class="lbl" style="color:var(--ink-dim);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px">Comida</span>
      <div class="seg" id="edMeal" style="margin:8px 0 14px">${meals.map(m => `<button data-meal="${m}" class="${e.meal === m ? "on" : ""}">${m}</button>`).join("")}</div>
      <label class="field"><span class="lbl">Gramos</span><input type="number" id="edGrams" value="${e.grams}" inputmode="decimal"></label>
      <div id="edPrev" class="card" style="margin:0 0 14px;background:var(--paper)"></div>
      <button class="btn" id="edSave">Guardar cambios</button>
      <button class="btn secondary" id="edDel" style="margin-top:10px">Eliminar comida</button>
    `);
    let meal = e.meal;
    $$("#edMeal button").forEach(b => b.addEventListener("click", () => { $$("#edMeal button").forEach(x => x.classList.remove("on")); b.classList.add("on"); meal = b.dataset.meal; }));
    const gi = $("#edGrams");
    const calc = (g) => f ? NUTRITION.macrosFor(f, g) : {
      kcal: Math.round((e.kcal / e.grams) * g), protein: +((e.protein / e.grams) * g).toFixed(1),
      carbs: +((e.carbs / e.grams) * g).toFixed(1), fat: +((e.fat / e.grams) * g).toFixed(1), fiber: +(((e.fiber || 0) / e.grams) * g).toFixed(1),
    };
    const upd = () => { const m = calc(Number(gi.value) || 0); $("#edPrev").innerHTML = `<div class="row spread"><b>${fmt(m.kcal)} kcal</b><span class="muted">P ${m.protein} · C ${m.carbs} · G ${m.fat}</span></div>`; };
    gi.addEventListener("input", upd); upd();
    $("#edSave").addEventListener("click", () => { const g = Number(gi.value) || 0; if (g <= 0) return; Store.updateEntry(currentDate, id, { grams: Math.round(g), meal, ...calc(g) }); closeModal(); toast("Comida actualizada ✔"); });
    $("#edDel").addEventListener("click", () => { Store.removeEntry(currentDate, id); closeModal(); });
  }

  // ---------------- alimento propio ----------------
  function openCustomFood() {
    showModal(`
      <h3>Crear alimento propio</h3>
      <p class="muted">Valores por 100 g (revisa la etiqueta).</p>
      <label class="field"><span class="lbl">Nombre</span><input type="text" id="cfName"></label>
      <div class="two">
        <label class="field"><span class="lbl">Calorías</span><input type="number" id="cfKcal" inputmode="decimal"></label>
        <label class="field"><span class="lbl">Proteína (g)</span><input type="number" id="cfP" inputmode="decimal"></label>
        <label class="field"><span class="lbl">Carbos (g)</span><input type="number" id="cfC" inputmode="decimal"></label>
        <label class="field"><span class="lbl">Grasa (g)</span><input type="number" id="cfF" inputmode="decimal"></label>
      </div>
      <button class="btn" id="cfSave">Guardar alimento</button>
    `);
    $("#cfSave").addEventListener("click", () => {
      const name = $("#cfName").value.trim(); if (!name) return;
      Store.addCustomFood({
        name, aliases:[name.toLowerCase()],
        kcal:Number($("#cfKcal").value)||0, p:Number($("#cfP").value)||0,
        c:Number($("#cfC").value)||0, f:Number($("#cfF").value)||0, fib:0,
        portions:[{label:"100 g",g:100}],
      });
      closeModal(); toast("Alimento guardado ✔");
    });
  }

  // ---------------- onboarding / perfil ----------------
  function openOnboarding() { openProfileEditor(true); }

  function openProfileEditor(first = false) {
    const p = Store.state.profile || {  // valores de tu InBody (23/06/2026) como punto de partida
      weightKg: 77.3, heightCm: 181, age: 22, sex: "male", activity: "moderado",
      surplusKcal: 250, proteinPerKg: 2.2, fatPerKg: 1.0, bmrOverride: 1859,
      bodyFat: 10.9, smm: 39.7, goal: "muscle_gain",
    };
    showModal(`
      <h3>${first ? "Configura tu perfil" : "Editar perfil y metas"}</h3>
      <p class="muted">Con esto calculo tus calorías y macros con evidencia (Mifflin-St Jeor + ISSN).</p>
      <div class="two">
        <label class="field"><span class="lbl">Peso (kg)</span><input type="number" id="pfW" value="${p.weightKg}" inputmode="decimal"></label>
        <label class="field"><span class="lbl">Estatura (cm)</span><input type="number" id="pfH" value="${p.heightCm}" inputmode="decimal"></label>
        <label class="field"><span class="lbl">Edad</span><input type="number" id="pfA" value="${p.age}"></label>
        <label class="field"><span class="lbl">Sexo</span>
          <select id="pfS"><option value="male" ${p.sex==="male"?"selected":""}>Hombre</option><option value="female" ${p.sex==="female"?"selected":""}>Mujer</option></select></label>
      </div>
      <label class="field"><span class="lbl">Nivel de actividad</span>
        <select id="pfAct">${Object.entries(NUTRITION.ACTIVITY).map(([k,v])=>`<option value="${k}" ${p.activity===k?"selected":""}>${v.label}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">BMR medido (InBody) — opcional, más preciso</span>
        <input type="number" id="pfBmr" value="${p.bmrOverride||""}" placeholder="ej. 1859"></label>
      <div class="two">
        <label class="field"><span class="lbl">% Grasa corporal (InBody)</span><input type="number" id="pfBF" value="${p.bodyFat||""}" step="0.1" placeholder="ej. 10.9" inputmode="decimal"></label>
        <label class="field"><span class="lbl">Músculo esquelético SMM (kg)</span><input type="number" id="pfSMM" value="${p.smm||""}" step="0.1" placeholder="ej. 39.7" inputmode="decimal"></label>
      </div>
      <div class="two">
        <label class="field"><span class="lbl">Superávit (kcal)</span><input type="number" id="pfSur" value="${p.surplusKcal}"></label>
        <label class="field"><span class="lbl">Proteína (g/kg)</span><input type="number" id="pfPro" value="${p.proteinPerKg}" step="0.1" inputmode="decimal"></label>
      </div>
      <div class="hint">Recomendado: superávit 200–300 para subir lean · proteína 1.6–2.2 g/kg.</div>
      <div id="pfPreview" class="banner info"></div>
      <button class="btn" id="pfSave">Guardar</button>
    `);
    const fields = ["pfW","pfH","pfA","pfS","pfAct","pfBmr","pfBF","pfSMM","pfSur","pfPro"];
    const read = () => ({
      weightKg:Number($("#pfW").value)||0, heightCm:Number($("#pfH").value)||0,
      age:Number($("#pfA").value)||0, sex:$("#pfS").value, activity:$("#pfAct").value,
      bmrOverride:Number($("#pfBmr").value)||null, surplusKcal:Number($("#pfSur").value)||0,
      proteinPerKg:Number($("#pfPro").value)||2.0, fatPerKg:p.fatPerKg||1.0,
      bodyFat:Number($("#pfBF").value)||null, smm:Number($("#pfSMM").value)||null, goal:"muscle_gain",
    });
    const preview = () => {
      const t = NUTRITION.computeTargets(read());
      $("#pfPreview").innerHTML = `Meta: <b>${fmt(t.kcalTarget)} kcal</b> · Proteína <b>${t.proteinG} g</b> · Carbos <b>${t.carbsG} g</b> · Grasa <b>${t.fatG} g</b> (mant. ${fmt(t.maintenance)})`;
    };
    fields.forEach(id => $("#"+id).addEventListener("input", preview));
    preview();
    $("#pfSave").addEventListener("click", () => {
      const np = read(); if (np.weightKg<=0||np.heightCm<=0) return;
      Store.state.profile = np;
      // primera vez: registra el peso inicial
      if (first && !Store.state.weights.length) Store.logWeight(currentDate, np.weightKg);
      Store.save(); closeModal(); switchView("today"); toast("Perfil guardado ✔");
    });
  }

  // ---------------- IA (modal) ----------------
  const AI_PROVIDERS = {
    gemini: {
      label: "Google Gemini (gratis)",
      keyHint: "Empieza con AIza…",
      link: "https://aistudio.google.com/apikey",
      linkText: "aistudio.google.com/apikey",
      steps: `1. Entra a <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> e inicia sesión con tu cuenta de Google.<br>
              2. <b>Create API key</b> y cópiala.<br>
              3. Pégala abajo y dale <b>Guardar y probar</b>. <b>Gratis</b>, sin tarjeta.`,
      models: [["gemini-2.0-flash", "2.0 Flash — rápido (recomendado)"], ["gemini-2.5-flash", "2.5 Flash — más nuevo"], ["gemini-1.5-flash", "1.5 Flash — alternativa"]],
      defaultModel: "gemini-2.0-flash",
    },
    anthropic: {
      label: "Anthropic (Claude)",
      keyHint: "Empieza con sk-ant-…",
      link: "https://console.anthropic.com/settings/keys",
      linkText: "console.anthropic.com",
      steps: `1. Entra a <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com → API Keys</a>.<br>
              2. <b>Create Key</b>, cópiala (empieza con <b>sk-ant-</b>).<br>
              3. Pégala abajo y dale <b>Guardar y probar</b>. <span class="muted">Requiere saldo de API (aparte de tu plan de Claude).</span>`,
      models: [["claude-haiku-4-5", "Haiku 4.5 — rápido y económico"], ["claude-sonnet-4-6", "Sonnet 4.6 — más preciso"], ["claude-opus-4-8", "Opus 4.8 — máxima precisión"]],
      defaultModel: "claude-haiku-4-5",
    },
  };

  function openAISettings() {
    const a = Store.state.ai || {};
    const prov = a.provider || "gemini";
    const P = AI_PROVIDERS[prov];
    const curModel = (P.models.some(m => m[0] === a.model)) ? a.model : P.defaultModel;
    showModal(`
      <h3>Asistente IA</h3>
      <label class="field"><span class="lbl">Proveedor</span>
        <select id="aiProvider">
          ${Object.entries(AI_PROVIDERS).map(([k, v]) => `<option value="${k}" ${k===prov?"selected":""}>${v.label}</option>`).join("")}
        </select></label>
      <div class="banner info"><b>Cómo activarla (1 vez):</b><br>${P.steps}<br><span class="muted">La clave se guarda solo en este dispositivo y nunca se sincroniza.</span></div>
      <label class="field"><span class="lbl">Clave de API</span><input type="text" id="aiKey" value="${a.key || ""}" placeholder="${P.keyHint}" autocomplete="off"></label>
      <label class="field"><span class="lbl">Modelo</span>
        <select id="aiModel">${P.models.map(m => `<option value="${m[0]}" ${m[0]===curModel?"selected":""}>${m[1]}</option>`).join("")}</select></label>
      <div id="aiTestResult" class="hint" style="margin-bottom:12px">Cada análisis usa muy pocos tokens.</div>
      <button class="btn" id="aiSave">Guardar y probar</button>
      <button class="btn secondary" id="aiTest" style="margin-top:10px">Probar conexión</button>
      ${a.enabled ? `<button class="btn secondary" id="aiDisable" style="margin-top:10px">Desactivar IA</button>` : ""}
    `);
    // cambiar proveedor recarga el modal con sus instrucciones/modelos
    $("#aiProvider").addEventListener("change", (e) => {
      const np = e.target.value;
      Store.state.ai = { ...(Store.state.ai || {}), provider: np, model: AI_PROVIDERS[np].defaultModel, key: $("#aiKey").value.trim() };
      Store.save({ remote: false });
      openAISettings();
    });
    const saveCfg = () => {
      const provider = $("#aiProvider").value;
      const key = $("#aiKey").value.trim();
      const model = $("#aiModel").value;
      if (!key) { toast("Pega tu clave de API"); return false; }
      Store.state.ai = { enabled: true, provider, key, model };
      Store.save({ remote: false }); // la IA nunca se sincroniza
      return true;
    };
    const runTest = async () => {
      const res = $("#aiTestResult");
      res.style.color = "var(--ink-dim)"; res.textContent = "Probando conexión con la IA…";
      try {
        const item = await AI.test();
        res.style.color = "var(--olive)";
        res.textContent = `✓ Conexión exitosa. Ejemplo: ${item.name} ≈ ${Math.round(item.grams)} g, ${Math.round(item.kcal)} kcal.`;
        return true;
      } catch (e) {
        res.style.color = "var(--danger)";
        res.textContent = "✕ " + (e.message || "No se pudo conectar.");
        return false;
      }
    };
    $("#aiSave").addEventListener("click", async () => { if (saveCfg()) { const ok = await runTest(); if (ok) toast("IA activada y verificada"); } });
    $("#aiTest").addEventListener("click", async () => { if (saveCfg()) runTest(); });
    if (a.enabled) $("#aiDisable").addEventListener("click", () => {
      Store.state.ai = { enabled: false, provider: a.provider || "gemini", key: a.key, model: a.model };
      Store.save({ remote: false }); closeModal(); toast("IA desactivada");
    });
  }

  // ---------------- sincronización (modal) ----------------
  function openSyncModal() {
    const s = Store.state.sync || {};
    showModal(`
      <h3>☁︎ Sincronizar dispositivos</h3>
      <div class="banner info">Crea un proyecto gratis en <a href="https://supabase.com" target="_blank">supabase.com</a>, ejecuta el SQL que te di, y pega aquí tu URL y la "anon key". Luego usa el <b>mismo código</b> en tu celular y compu.</div>
      <label class="field"><span class="lbl">Supabase URL</span><input type="text" id="syUrl" value="${s.url||""}" placeholder="https://xxxx.supabase.co"></label>
      <label class="field"><span class="lbl">Anon key (public)</span><input type="text" id="syKey" value="${s.key||""}" placeholder="eyJ..."></label>
      <label class="field"><span class="lbl">Tu código personal de sincronización</span><input type="text" id="syCode" value="${s.code||""}" placeholder="ej. roberts-2026"></label>
      <div class="hint">Elige un código largo y privado. Quien lo tenga puede ver tus datos.</div>
      <button class="btn" id="syEnable">Activar y sincronizar</button>
      ${s.enabled?`<button class="btn secondary" id="syDisable" style="margin-top:10px">Desactivar</button>`:""}
    `);
    $("#syEnable").addEventListener("click", async () => {
      const url = $("#syUrl").value.trim().replace(/\/$/,"");
      const key = $("#syKey").value.trim();
      const code = $("#syCode").value.trim();
      if (!url||!key||!code) { toast("Completa los 3 campos"); return; }
      Store.state.sync = { enabled:true, url, key, code };
      Store.save({remote:false});
      toast("Conectando...");
      const remote = await Sync.pull();
      if (remote && (remote.updatedAt||0) > (Store.state.updatedAt||0)) Store.replace(remote);
      else await Sync.push(Store.state);
      closeModal(); toast("Sincronización activada ☁︎");
    });
    if (s.enabled) $("#syDisable").addEventListener("click", () => {
      Store.state.sync = { enabled:false, url:s.url, key:s.key, code:s.code };
      Store.save({remote:false}); closeModal(); toast("Sincronización desactivada");
    });
  }

  // ---------------- export / import ----------------
  function exportData() {
    const blob = new Blob([JSON.stringify(Store.state, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "macro-tracker-" + Store.todayKey() + ".json"; a.click();
  }
  function importData() {
    const inp = document.createElement("input"); inp.type="file"; inp.accept=".json";
    inp.onchange = () => {
      const file = inp.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => { try { Store.replace(JSON.parse(r.result)); toast("Datos importados ✔"); } catch { toast("Archivo inválido"); } };
      r.readAsText(file);
    };
    inp.click();
  }

  // ---------------- modal infra + toast ----------------
  function bindModals() {
    $("#modalBg").addEventListener("click", e => { if (e.target.id === "modalBg") closeModal(); });
  }
  function showModal(html) { $("#modalBody").innerHTML = html; $("#modalBg").classList.add("show"); }
  function closeModal() { $("#modalBg").classList.remove("show"); }
  function bindProfileForm() {}
  function bindSync() {}

  let toastTimer;
  function toast(msg) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id="toast"; document.body.appendChild(el);
      Object.assign(el.style,{position:"fixed",bottom:"96px",left:"50%",transform:"translateX(-50%)",background:"var(--bg-card)",border:"1px solid var(--line)",color:"var(--text)",padding:"12px 18px",borderRadius:"12px",zIndex:99,maxWidth:"90%",fontSize:"13px",boxShadow:"var(--shadow)",textAlign:"center"}); }
    el.textContent = msg; el.style.opacity="1";
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.style.opacity="0", 4200);
  }

  window.addEventListener("DOMContentLoaded", init);
  // expone para el botón de cerrar del modal
  window.closeModal = closeModal;
})();
