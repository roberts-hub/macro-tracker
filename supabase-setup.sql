-- ============================================================
--  MacroTrack — Configuración de Supabase (sincronización)
--  Pega y ejecuta esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Tabla que guarda el estado completo por "código de sincronización"
create table if not exists tracker_state (
  code        text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 2) Habilitar Row Level Security
alter table tracker_state enable row level security;

-- 3) Política: permitir leer/escribir con la clave anónima (uso personal).
--    La seguridad real viene de que tu "código" sea largo y privado.
drop policy if exists "anon full access" on tracker_state;
create policy "anon full access"
  on tracker_state
  for all
  to anon
  using (true)
  with check (true);

-- Listo. Copia tu Project URL y la "anon public key"
-- (Settings → API) y pégalas en la app (Perfil → Activar sincronización).
