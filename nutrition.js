// nutrition.js — Cálculos nutricionales puros, basados en evidencia.
// Fuentes: Mifflin-St Jeor (Am J Clin Nutr 1990); ISSN Position Stands 2017;
// Morton 2018 meta-análisis; Helms 2023 (superávit y ritmo de ganancia).

const NUTRITION = {
  // Calorías por gramo de cada macro
  KCAL: { protein: 4, carbs: 4, fat: 9 },

  // Factores de actividad (multiplican el BMR para obtener TDEE/mantenimiento)
  ACTIVITY: {
    sedentario:   { factor: 1.2,   label: "Sedentario (poco o nada de ejercicio)" },
    ligero:       { factor: 1.375, label: "Ligero (1-3 días/sem)" },
    moderado:     { factor: 1.55,  label: "Moderado (3-5 días/sem)" },
    activo:       { factor: 1.725, label: "Activo (6-7 días/sem)" },
    muy_activo:   { factor: 1.9,   label: "Muy activo (2x/día o trabajo físico)" },
  },

  // BMR con Mifflin-St Jeor. sex: 'male' | 'female'
  bmrMifflin({ weightKg, heightCm, age, sex }) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return Math.round(base + (sex === "female" ? -161 : 5));
  },

  // TDEE = BMR * factor de actividad
  tdee(bmr, activityKey) {
    const a = this.ACTIVITY[activityKey] || this.ACTIVITY.moderado;
    return Math.round(bmr * a.factor);
  },

  // Calcula todas las metas diarias a partir del perfil.
  // profile: { weightKg, heightCm, age, sex, activity, bmrOverride?, surplusKcal,
  //            proteinPerKg, fatPerKg }
  computeTargets(profile) {
    const bmr = profile.bmrOverride
      ? Math.round(profile.bmrOverride)
      : this.bmrMifflin(profile);
    const maintenance = this.tdee(bmr, profile.activity);

    const surplus = profile.surplusKcal ?? 250;
    const kcalTarget = maintenance + surplus;

    // Proteína primero (g/kg), luego grasa (g/kg), el resto a carbohidratos.
    const proteinG = Math.round((profile.proteinPerKg ?? 2.0) * profile.weightKg);
    const fatG = Math.round((profile.fatPerKg ?? 1.0) * profile.weightKg);
    const proteinKcal = proteinG * this.KCAL.protein;
    const fatKcal = fatG * this.KCAL.fat;
    const carbsKcal = Math.max(0, kcalTarget - proteinKcal - fatKcal);
    const carbsG = Math.round(carbsKcal / this.KCAL.carbs);

    // Fibra recomendada ~14 g por cada 1000 kcal
    const fiberG = Math.round((kcalTarget / 1000) * 14);
    // Agua objetivo ~35 ml/kg + extra por actividad
    const waterMl = Math.round(profile.weightKg * 40);

    // Proteína por comida objetivo (asumiendo 4 comidas) dentro de 20-40 g
    const perMealProtein = Math.round(proteinG / 4);

    return {
      bmr, maintenance, surplus, kcalTarget,
      proteinG, fatG, carbsG, fiberG, waterMl, perMealProtein,
      macroPct: {
        protein: Math.round((proteinKcal / kcalTarget) * 100),
        fat: Math.round((fatKcal / kcalTarget) * 100),
        carbs: Math.round((carbsKcal / kcalTarget) * 100),
      },
    };
  },

  // Ritmo de ganancia recomendado (kg/semana) según peso corporal: 0.25-0.5%/sem
  weeklyGainTarget(weightKg) {
    return {
      min: +(weightKg * 0.0025).toFixed(2),
      max: +(weightKg * 0.005).toFixed(2),
    };
  },

  // Evalúa una comida concreta por su contenido de proteína (20-40 g ideal)
  mealProteinFlag(proteinG) {
    if (proteinG < 20) return { level: "low", msg: "Baja en proteína (ideal 20-40 g)" };
    if (proteinG > 55) return { level: "high", msg: "Muy alta en una sola toma" };
    return { level: "ok", msg: "Proteína en rango óptimo" };
  },

  // Calcula macros de un alimento por gramos
  macrosFor(food, grams) {
    const r = grams / 100;
    return {
      kcal: Math.round(food.kcal * r),
      protein: +(food.p * r).toFixed(1),
      carbs: +(food.c * r).toFixed(1),
      fat: +(food.f * r).toFixed(1),
      fiber: +((food.fib || 0) * r).toFixed(1),
    };
  },
};

if (typeof window !== "undefined") window.NUTRITION = NUTRITION;
