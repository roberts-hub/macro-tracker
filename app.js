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

      ${proteinMealCard(t)}

      <div class="row spread" style="margin:22px 4px 10px">
        <h2 class="sectitle">Comidas de hoy</h2>
        <button class="btn small" id="addFoodBtn">+ Agregar</button>
      </div>
      <div id="entriesList"></div>
    `;

    // anillo dibujado vía dasharray ya en HTML; eventos:
    $("#addFoodBtn").addEventListener("click", openAddFood);
    $$("[data-water]", host).forEach(b => b.addEventListener("click", () => {
      const cur = Store.dayTotals(currentDate).water;
      Store.setWater(currentDate, cur + Number(b.dataset.water));
    }));
    renderEntries();
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
          <div class="info">
            <div class="nm">${e.name}</div>
            <div class="mc">${e.grams} g · P ${e.protein} · C ${e.carbs} · G ${e.fat}</div>
          </div>
          <div class="kc">${fmt(e.kcal)}</div>
          <button class="del" data-del="${e.id}">✕</button>
        </div>`).join("");
      return `<div class="meal-group"><div class="meal-head">${m}</div>${items}</div>`;
    }).join("");
    $$("[data-del]", host).forEach(b => b.addEventListener("click", () => Store.removeEntry(currentDate, b.dataset.del)));
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
    `;
    $("#wAdd").addEventListener("click", () => {
      const v = parseFloat($("#wInput").value);
      if (v > 0) { Store.logWeight(currentDate, v); }
    });
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
    $("#editProfileBtn").addEventListener("click", () => openProfileEditor());
    $("#syncBtn").addEventListener("click", openSyncModal);
    $("#exportBtn").addEventListener("click", exportData);
    $("#importBtn").addEventListener("click", importData);
    $("#addCustomBtn").addEventListener("click", openCustomFood);
  }

  // ---------------- AGREGAR COMIDA (modal) ----------------
  function openAddFood() {
    pendingFood = null;
    showModal(`
      <h3>Agregar comida</h3>
      <div class="seg" id="mealSeg" style="margin:12px 0">
        ${["Desayuno","Almuerzo","Cena","Snack"].map((m,i)=>`<button data-meal="${m}" class="${i===autoMeal()?'on':''}">${m}</button>`).join("")}
      </div>

      <label class="field">
        <span class="lbl">Buscar alimento</span>
        <input type="text" id="foodSearch" placeholder="pollo, arroz, huevo, whey..." autocomplete="off">
      </label>
      <div class="search-results" id="searchResults"></div>

      <div style="border-top:1px solid var(--line);margin:16px 0;padding-top:16px">
        <span class="lbl" style="display:block;margin-bottom:7px">O describe lo que comiste</span>
        <textarea id="nlInput" rows="3" placeholder="Ej: 2 huevos, 1 taza de avena, 1 scoop de whey y 1 plátano"></textarea>
        <button class="btn small" id="nlBtn" style="margin-top:10px">Analizar y agregar</button>
        <div class="hint" style="margin-top:8px">Detecto cantidades y alimentos automáticamente. Lo que no encuentre, lo puedes ajustar.</div>
      </div>
    `);
    let meal = ["Desayuno","Almuerzo","Cena","Snack"][autoMeal()];
    $$("#mealSeg button").forEach(b => b.addEventListener("click", () => {
      $$("#mealSeg button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); meal = b.dataset.meal;
    }));
    const search = $("#foodSearch");
    search.addEventListener("input", () => renderSearch(search.value, meal));
    renderSearch("", meal);
    $("#nlBtn").addEventListener("click", () => { quickAddNL($("#nlInput").value, meal); });
    setTimeout(()=>search.focus(), 100);
  }

  function autoMeal() {
    const h = new Date().getHours();
    if (h < 11) return 0; if (h < 16) return 1; if (h < 21) return 2; return 3;
  }

  function renderSearch(q, meal) {
    const host = $("#searchResults");
    const foods = Store.allFoods();
    const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    const nq = norm(q);
    const matches = (nq ? foods.filter(f => norm(f.name).includes(nq) || (f.aliases||[]).some(a=>norm(a).includes(nq))) : foods).slice(0, 30);
    host.innerHTML = matches.map(f => `
      <div class="food-opt" data-food="${f.id}">
        <div><div class="fn">${f.name}</div><div class="fm">${f.kcal} kcal · P${f.p} C${f.c} G${f.f} /100g</div></div>
        <span class="pill">+</span>
      </div>`).join("") || `<div class="center-empty">Sin resultados. Usa "describe lo que comiste" abajo o crea un alimento propio.</div>`;
    $$("[data-food]", host).forEach(el => el.addEventListener("click", () => openPortion(el.dataset.food, meal)));
  }

  function openPortion(foodId, meal) {
    const f = Store.findFood(foodId);
    pendingFood = f;
    showModal(`
      <h3>${f.name}</h3>
      <p class="muted">${f.kcal} kcal · P${f.p} · C${f.c} · G${f.f} por 100 g</p>
      <span class="lbl" style="color:var(--text-dim);font-size:13px;font-weight:600">Porción rápida</span>
      <div class="seg" id="portionSeg" style="margin:8px 0 14px">
        ${(f.portions||[{label:"100 g",g:100}]).map((p,i)=>`<button data-g="${p.g}" class="${i===0?'on':''}">${p.label}</button>`).join("")}
      </div>
      <label class="field"><span class="lbl">Gramos</span>
        <input type="number" id="gramsInput" value="${(f.portions&&f.portions[0]?f.portions[0].g:100)}" inputmode="decimal"></label>
      <div id="macroPreview" class="card" style="margin:0 0 14px;background:var(--bg-elev)"></div>
      <button class="btn" id="confirmAdd">Agregar a ${meal}</button>
    `);
    const gi = $("#gramsInput");
    const upd = () => {
      const g = Number(gi.value)||0; const m = NUTRITION.macrosFor(f, g);
      $("#macroPreview").innerHTML = `<div class="row spread"><b>${fmt(m.kcal)} kcal</b><span class="muted">P ${m.protein} · C ${m.carbs} · G ${m.fat} · Fib ${m.fiber}</span></div>`;
    };
    $$("#portionSeg button").forEach(b => b.addEventListener("click", () => {
      $$("#portionSeg button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
      gi.value = b.dataset.g; upd();
    }));
    gi.addEventListener("input", upd); upd();
    $("#confirmAdd").addEventListener("click", () => {
      const g = Number(gi.value)||0; if (g<=0) return;
      const m = NUTRITION.macrosFor(f, g);
      Store.addEntry(currentDate, { foodId:f.id, name:f.name, grams:g, meal, ...m });
      closeModal();
    });
  }

  // ---------------- Quick add lenguaje natural ----------------
  function quickAddNL(text, meal) {
    if (!text.trim()) return;
    const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    const foods = Store.allFoods();
    const chunks = text.split(/[\n,;]+| y /i).map(s=>s.trim()).filter(Boolean);
    const added = []; const failed = [];
    for (const chunk of chunks) {
      // cantidad inicial
      const numMatch = chunk.match(/^(\d+(?:[.,]\d+)?)\s*/);
      let qty = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : 1;
      const gMatch = chunk.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramos)\b/i);
      const rest = norm(chunk);
      // buscar alimento por inclusión de alias/nombre
      let best = null, bestLen = 0;
      for (const f of foods) {
        const keys = [norm(f.name), ...(f.aliases||[]).map(norm)];
        for (const k of keys) {
          if (k.length >= 3 && rest.includes(k) && k.length > bestLen) { best = f; bestLen = k.length; }
        }
      }
      if (!best) { failed.push(chunk); continue; }
      let grams;
      if (gMatch) grams = parseFloat(gMatch[1].replace(",", "."));
      else if (best.portions && best.portions[0]) grams = best.portions[0].g * qty;
      else grams = 100 * qty;
      const m = NUTRITION.macrosFor(best, grams);
      Store.addEntry(currentDate, { foodId:best.id, name:best.name, grams:Math.round(grams), meal, ...m });
      added.push(`${best.name} (${Math.round(grams)} g)`);
    }
    closeModal();
    let msg = added.length ? `Agregado: ${added.join(", ")}.` : "No reconocí alimentos.";
    if (failed.length) msg += ` No encontré: ${failed.join(", ")}. Búscalos manualmente o créalos.`;
    toast(msg);
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
    const p = Store.state.profile || {
      weightKg: 77, heightCm: 180, age: 25, sex: "male", activity: "moderado",
      surplusKcal: 250, proteinPerKg: 2.0, fatPerKg: 1.0, bmrOverride: null,
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
        <label class="field"><span class="lbl">Superávit (kcal)</span><input type="number" id="pfSur" value="${p.surplusKcal}"></label>
        <label class="field"><span class="lbl">Proteína (g/kg)</span><input type="number" id="pfPro" value="${p.proteinPerKg}" step="0.1" inputmode="decimal"></label>
      </div>
      <div class="hint">Recomendado: superávit 200–300 para subir lean · proteína 1.6–2.2 g/kg.</div>
      <div id="pfPreview" class="banner info"></div>
      <button class="btn" id="pfSave">Guardar</button>
    `);
    const fields = ["pfW","pfH","pfA","pfS","pfAct","pfBmr","pfSur","pfPro"];
    const read = () => ({
      weightKg:Number($("#pfW").value)||0, heightCm:Number($("#pfH").value)||0,
      age:Number($("#pfA").value)||0, sex:$("#pfS").value, activity:$("#pfAct").value,
      bmrOverride:Number($("#pfBmr").value)||null, surplusKcal:Number($("#pfSur").value)||0,
      proteinPerKg:Number($("#pfPro").value)||2.0, fatPerKg:p.fatPerKg||1.0, goal:"muscle_gain",
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
