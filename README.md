# 🥗 MacroTrack — Tu tracker de calorías y macros

App web instalable (PWA) para llevar tu alimentación diaria y subir de peso *lean*.
Calibrada con evidencia (Mifflin-St Jeor, ISSN Position Stands, Morton 2018, Helms 2023).

## Qué hace
- **Perfil** → calcula mantenimiento (TDEE), superávit, y metas de proteína/carbos/grasa.
- **Registro de comidas** → busca alimentos o **describe lo que comiste** ("3 huevos, 1 taza de avena, 1 scoop de whey") y lo convierte en calorías y macros.
- **Dashboard** → anillo de calorías, barras de macros con % de cumplimiento, agua, y **proteína por comida** (alerta si una comida queda baja, ideal 20–40 g).
- **Progreso** → gráfica de peso + **coach adaptativo**: te dice si subir/bajar calorías según tu ritmo real (meta 0.25–0.5 %/sem).
- **Sincronización** celular ↔ computadora vía Supabase (gratis).
- Funciona **offline** (PWA) y guarda tus datos en el dispositivo.

## Cómo usarlo en celular y computadora a la vez (sincronizar)

### 1. Súbelo a una URL gratis
Elige la más fácil:
- **Netlify Drop** (sin cuenta): ve a https://app.netlify.com/drop y arrastra **toda la carpeta** `macro-tracker`. Te da una URL al instante.
- **Cloudflare Pages** o **Vercel**: también gratis, conectando esta carpeta.

Abre esa URL en el celular y la compu → "Agregar a pantalla de inicio" para instalarla como app.

### 2. Activa la sincronización (gratis, 5 min, una vez)
1. Crea un proyecto gratis en https://supabase.com
2. En Supabase → **SQL Editor** → pega y ejecuta el archivo `supabase-setup.sql`.
3. En Supabase → **Settings → API**, copia el **Project URL** y la **anon public key**.
4. En la app → **Perfil → Activar sincronización**, pega URL + key y elige un **código personal** (largo y privado, ej. `roberts-bulk-2026`).
5. Pon el **mismo código** en tu otro dispositivo. ✅ Listo: lo que registres en uno aparece en el otro.

> Sin sincronización, la app funciona igual pero los datos quedan solo en cada dispositivo
> (puedes mover datos con **Exportar/Importar** en Perfil).

## Archivos
- `index.html` — app
- `foods.js` — base de datos de alimentos (editable)
- `nutrition.js` — cálculos (BMR, TDEE, metas)
- `store.js` — estado y guardado local
- `sync.js` — sincronización Supabase
- `app.js` — interfaz
- `supabase-setup.sql` — SQL para activar el sync
