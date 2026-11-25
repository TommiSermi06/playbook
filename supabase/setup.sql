-- ===========================================================================
-- PLAYBOOK — preparazione del database Supabase
-- ---------------------------------------------------------------------------
-- Come usarlo: Supabase → il progetto → SQL Editor → New query,
-- incolla TUTTO questo file e premi "Run". Si può rilanciare senza danni.
--
-- Cosa crea:
--   1. profili  → nome e logo della squadra di ogni allenatore
--   2. schemi   → gli schemi del playbook (uno per riga, in formato JSON)
--   3. loghi    → cartella (bucket) per le immagini dei loghi
-- E le REGOLE DI SICUREZZA (Row Level Security): ogni allenatore può
-- leggere e modificare SOLO i propri dati.
-- ===========================================================================

-- 1. PROFILI -----------------------------------------------------------------
create table if not exists public.profili (
  id           uuid primary key references auth.users (id) on delete cascade,
  nome_squadra text,
  logo_url     text,
  aggiornato   timestamptz not null default now()
);

alter table public.profili enable row level security;

drop policy if exists "profilo: solo il proprietario" on public.profili;
create policy "profilo: solo il proprietario" on public.profili
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. SCHEMI ------------------------------------------------------------------
create table if not exists public.schemi (
  id         text primary key,
  utente     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dati       jsonb not null,
  modificato timestamptz not null default now()
);

create index if not exists schemi_utente_idx on public.schemi (utente);

alter table public.schemi enable row level security;

drop policy if exists "schemi: solo il proprietario" on public.schemi;
create policy "schemi: solo il proprietario" on public.schemi
  for all to authenticated
  using (utente = auth.uid())
  with check (utente = auth.uid());

-- 3. LOGHI (Storage) ---------------------------------------------------------
-- Bucket pubblico in lettura: i loghi devono comparire nell'app e nelle stampe.
-- Ognuno può scrivere solo nella propria cartella: loghi/<id utente>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loghi', 'loghi', true, 2097152, array['image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png'];

drop policy if exists "loghi: carica nella propria cartella" on storage.objects;
create policy "loghi: carica nella propria cartella" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'loghi' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "loghi: aggiorna nella propria cartella" on storage.objects;
create policy "loghi: aggiorna nella propria cartella" on storage.objects
  for update to authenticated
  using (bucket_id = 'loghi' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "loghi: elimina nella propria cartella" on storage.objects;
create policy "loghi: elimina nella propria cartella" on storage.objects
  for delete to authenticated
  using (bucket_id = 'loghi' and (storage.foldername(name))[1] = auth.uid()::text);

-- Serve anche poter "vedere" il proprio file per sovrascriverlo (upsert)
drop policy if exists "loghi: leggi la propria cartella" on storage.objects;
create policy "loghi: leggi la propria cartella" on storage.objects
  for select to authenticated
  using (bucket_id = 'loghi' and (storage.foldername(name))[1] = auth.uid()::text);
