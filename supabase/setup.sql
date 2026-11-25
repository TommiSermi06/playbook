-- ===========================================================================
-- PLAYBOOK — preparazione del database Supabase
-- ---------------------------------------------------------------------------
-- Come usarlo: Supabase → il progetto → SQL Editor → New query,
-- incolla TUTTO questo file e premi "Run". Si può rilanciare senza danni.
--
-- Cosa crea:
--   1. profili  → nome e logo della squadra di ogni allenatore
--   2. schemi   → gli schemi del playbook (uno per riga, in formato JSON)
--   2b. formazioni → le formazioni create e salvate da ogni coach
--   2c. playbook   → i playbook di ogni coach (Tackle 11/9/7 o Flag 5)
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

-- 2b. FORMAZIONI SALVATE DAL COACH ------------------------------------------
create table if not exists public.formazioni (
  id         text primary key,
  utente     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dati       jsonb not null,
  modificato timestamptz not null default now()
);

create index if not exists formazioni_utente_idx on public.formazioni (utente);

alter table public.formazioni enable row level security;

drop policy if exists "formazioni: solo il proprietario" on public.formazioni;
create policy "formazioni: solo il proprietario" on public.formazioni
  for all to authenticated
  using (utente = auth.uid())
  with check (utente = auth.uid());

-- 2c. PLAYBOOK DEL COACH ------------------------------------------------------
create table if not exists public.playbook (
  id         text primary key,
  utente     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dati       jsonb not null,
  modificato timestamptz not null default now()
);

create index if not exists playbook_utente_idx on public.playbook (utente);

alter table public.playbook enable row level security;

drop policy if exists "playbook: solo il proprietario" on public.playbook;
create policy "playbook: solo il proprietario" on public.playbook
  for all to authenticated
  using (utente = auth.uid())
  with check (utente = auth.uid());

-- PERMESSI -------------------------------------------------------------------
-- Nei progetti Supabase recenti le tabelle create a mano non sono
-- accessibili all'app finché non lo si dice esplicitamente.
-- Le diamo SOLO agli utenti collegati ("authenticated"): le regole qui sopra
-- fanno comunque vedere a ognuno solo le proprie righe.
-- Gli utenti non collegati ("anon") restano senza accesso.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profili to authenticated;
grant select, insert, update, delete on public.schemi  to authenticated;
grant select, insert, update, delete on public.formazioni to authenticated;
grant select, insert, update, delete on public.playbook   to authenticated;

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

-- 4. CONDIVISIONE IN SOLA LETTURA (dalla versione 0.17) ---------------------
-- 4a. CONDIVISIONI -------------------------------------------------------------
create table if not exists public.condivisioni (
  codice   text primary key,
  utente   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  playbook text not null,
  ordine   jsonb not null default '[]'::jsonb,   -- ordine degli schemi nel playbook
  creato   timestamptz not null default now(),
  unique (utente, playbook)
);

alter table public.condivisioni enable row level security;

drop policy if exists "condivisioni: solo il proprietario" on public.condivisioni;
create policy "condivisioni: solo il proprietario" on public.condivisioni
  for all to authenticated
  using (utente = auth.uid())
  with check (utente = auth.uid());

grant select, insert, update, delete on public.condivisioni to authenticated;

-- 4b. LETTURA DI UN PLAYBOOK CONDIVISO ---------------------------------------
-- "security definer": la funzione legge le tabelle al posto di chi apre il
-- link, ma restituisce soltanto il playbook collegato a quel codice.
create or replace function public.playbook_condiviso(codice_link text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'playbook', p.dati,
    'ordine',   c.ordine,
    'squadra',  (select jsonb_build_object('nome_squadra', pr.nome_squadra, 'logo_url', pr.logo_url)
                 from profili pr where pr.id = c.utente),
    'schemi',   coalesce((select jsonb_agg(s.dati) from schemi s
                          where s.utente = c.utente and s.dati->>'playbook' = c.playbook), '[]'::jsonb),
    'formazioni', coalesce((select jsonb_agg(f.dati) from formazioni f
                          where f.utente = c.utente
                            and f.id in (select s.dati->>'formazione' from schemi s
                                         where s.utente = c.utente and s.dati->>'playbook' = c.playbook)), '[]'::jsonb)
  )
  from condivisioni c
  join playbook p on p.id = c.playbook and p.utente = c.utente
  where c.codice = codice_link and length(codice_link) >= 20;
$$;

revoke all on function public.playbook_condiviso(text) from public;
grant usage on schema public to anon;
grant execute on function public.playbook_condiviso(text) to anon, authenticated;


-- 5. CO-ALLENATORI (dalla versione 0.18) -------------------------------------
-- 5a. INVITI ------------------------------------------------------------------
create table if not exists public.collaboratori (
  playbook     text not null,
  proprietario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email        text not null,                 -- sempre in minuscolo
  utente       uuid references auth.users (id) on delete cascade, -- riempito quando l'invitato accede
  squadra      text,                          -- nome della squadra del proprietario (da mostrare)
  creato       timestamptz not null default now(),
  primary key (playbook, email)
);

create index if not exists collaboratori_utente_idx on public.collaboratori (utente);

alter table public.collaboratori enable row level security;

-- Vero se il playbook è mio
create or replace function public.mio_playbook(id_playbook text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from playbook where id = id_playbook and utente = auth.uid());
$$;

-- Vero se sono co-allenatore di quel playbook di quel proprietario
create or replace function public.collaboro(id_playbook text, id_proprietario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from collaboratori
                 where utente = auth.uid() and proprietario = id_proprietario and playbook = id_playbook);
$$;

-- Vero se io e l'altro coach siamo nello stesso staff (in un verso o nell'altro)
create or replace function public.stesso_staff(altro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from collaboratori c
                 where (c.utente = auth.uid() and c.proprietario = altro)
                    or (c.proprietario = auth.uid() and c.utente = altro));
$$;

revoke all on function public.mio_playbook(text) from public;
revoke all on function public.collaboro(text, uuid) from public;
revoke all on function public.stesso_staff(uuid) from public;
grant execute on function public.mio_playbook(text) to authenticated;
grant execute on function public.collaboro(text, uuid) to authenticated;
grant execute on function public.stesso_staff(uuid) to authenticated;

-- Il proprietario gestisce gli inviti, solo per i SUOI playbook
drop policy if exists "collaboratori: il proprietario gestisce" on public.collaboratori;
create policy "collaboratori: il proprietario gestisce" on public.collaboratori
  for all to authenticated
  using (proprietario = auth.uid())
  with check (proprietario = auth.uid() and public.mio_playbook(collaboratori.playbook));

-- L'invitato vede i propri inviti
drop policy if exists "collaboratori: l'invitato vede" on public.collaboratori;
create policy "collaboratori: l'invitato vede" on public.collaboratori
  for select to authenticated
  using (utente = auth.uid() or email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- L'invitato può lasciare il playbook
drop policy if exists "collaboratori: l'invitato può lasciare" on public.collaboratori;
create policy "collaboratori: l'invitato può lasciare" on public.collaboratori
  for delete to authenticated
  using (utente = auth.uid());

grant select, insert, update, delete on public.collaboratori to authenticated;

-- All'accesso l'app "accetta" gli inviti fatti alla mail del coach
create or replace function public.accetta_inviti()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update collaboratori
     set utente = auth.uid()
   where utente is null
     and email = lower(coalesce(auth.jwt() ->> 'email', ''))
     and proprietario <> auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.accetta_inviti() from public;
grant execute on function public.accetta_inviti() to authenticated;

-- 5b. COSA PUÒ FARE UN CO-ALLENATORE ---------------------------------------
-- Schemi: leggere, creare, modificare ed eliminare quelli del playbook condiviso
drop policy if exists "schemi: co-allenatori" on public.schemi;
create policy "schemi: co-allenatori" on public.schemi
  for all to authenticated
  using (public.collaboro(schemi.dati ->> 'playbook', schemi.utente))
  with check (public.collaboro(schemi.dati ->> 'playbook', schemi.utente));

-- Playbook: solo leggere (nome e formato)
drop policy if exists "playbook: co-allenatori leggono" on public.playbook;
create policy "playbook: co-allenatori leggono" on public.playbook
  for select to authenticated
  using (public.collaboro(playbook.id, playbook.utente));

-- Formazioni: proprietario e co-allenatori vedono (non modificano) quelle
-- dell'altro, così i nomi delle formazioni compaiono giusti a tutti
drop policy if exists "formazioni: lo staff le vede" on public.formazioni;
create policy "formazioni: lo staff le vede" on public.formazioni
  for select to authenticated
  using (public.stesso_staff(formazioni.utente));


-- 6. PERMESSI E PROPOSTE (dalla versione 0.20) -------------------------------
-- 6a. PERMESSO SU OGNI INVITO --------------------------------------------------
alter table public.collaboratori
  add column if not exists permesso text not null default 'modifica'
  check (permesso in ('modifica', 'proposta', 'lettura'));

-- Vero se posso modificare direttamente quel playbook di quel proprietario
create or replace function public.posso_modificare(id_playbook text, id_proprietario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from collaboratori
                 where utente = auth.uid() and proprietario = id_proprietario
                   and playbook = id_playbook and permesso = 'modifica');
$$;

-- Vero se su quel playbook posso solo mandare proposte
create or replace function public.posso_proporre(id_playbook text, id_proprietario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from collaboratori
                 where utente = auth.uid() and proprietario = id_proprietario
                   and playbook = id_playbook and permesso = 'proposta');
$$;

revoke all on function public.posso_modificare(text, uuid) from public;
revoke all on function public.posso_proporre(text, uuid) from public;
grant execute on function public.posso_modificare(text, uuid) to authenticated;
grant execute on function public.posso_proporre(text, uuid) to authenticated;

-- 6b. SCHEMI: tutto lo staff legge, solo chi ha "modifica" scrive ------------
drop policy if exists "schemi: co-allenatori" on public.schemi;

drop policy if exists "schemi: lo staff legge" on public.schemi;
create policy "schemi: lo staff legge" on public.schemi
  for select to authenticated
  using (public.collaboro(schemi.dati ->> 'playbook', schemi.utente));

drop policy if exists "schemi: lo staff crea" on public.schemi;
create policy "schemi: lo staff crea" on public.schemi
  for insert to authenticated
  with check (public.posso_modificare(schemi.dati ->> 'playbook', schemi.utente));

drop policy if exists "schemi: lo staff modifica" on public.schemi;
create policy "schemi: lo staff modifica" on public.schemi
  for update to authenticated
  using (public.posso_modificare(schemi.dati ->> 'playbook', schemi.utente))
  with check (public.posso_modificare(schemi.dati ->> 'playbook', schemi.utente));

drop policy if exists "schemi: lo staff elimina" on public.schemi;
create policy "schemi: lo staff elimina" on public.schemi
  for delete to authenticated
  using (public.posso_modificare(schemi.dati ->> 'playbook', schemi.utente));

-- 6c. PROPOSTE -------------------------------------------------------------------
create table if not exists public.proposte (
  id           text primary key,
  playbook     text not null,
  proprietario uuid not null references auth.users (id) on delete cascade,
  autore       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autore_email text,
  schema_id    text not null,
  tipo         text not null check (tipo in ('modifica', 'nuovo', 'elimina')),
  dati         jsonb,                                   -- lo schema proposto
  stato        text not null default 'in attesa'
               check (stato in ('in attesa', 'accettata', 'rifiutata')),
  creato       timestamptz not null default now(),
  deciso       timestamptz
);

create index if not exists proposte_proprietario_idx on public.proposte (proprietario, stato);
create index if not exists proposte_autore_idx on public.proposte (autore);

alter table public.proposte enable row level security;

-- Chi ha il permesso "proposta" le manda, le vede e (una volta lette) le cancella
drop policy if exists "proposte: l'autore le manda" on public.proposte;
create policy "proposte: l'autore le manda" on public.proposte
  for insert to authenticated
  with check (autore = auth.uid() and stato = 'in attesa'
              and public.posso_proporre(proposte.playbook, proposte.proprietario));

drop policy if exists "proposte: l'autore le vede" on public.proposte;
create policy "proposte: l'autore le vede" on public.proposte
  for select to authenticated
  using (autore = auth.uid());

drop policy if exists "proposte: l'autore le cancella" on public.proposte;
create policy "proposte: l'autore le cancella" on public.proposte
  for delete to authenticated
  using (autore = auth.uid());

-- Il proprietario del playbook le vede e decide
drop policy if exists "proposte: il proprietario decide" on public.proposte;
create policy "proposte: il proprietario decide" on public.proposte
  for select to authenticated
  using (proprietario = auth.uid());

drop policy if exists "proposte: il proprietario aggiorna" on public.proposte;
create policy "proposte: il proprietario aggiorna" on public.proposte
  for update to authenticated
  using (proprietario = auth.uid())
  with check (proprietario = auth.uid());

drop policy if exists "proposte: il proprietario cancella" on public.proposte;
create policy "proposte: il proprietario cancella" on public.proposte
  for delete to authenticated
  using (proprietario = auth.uid());

grant select, insert, update, delete on public.proposte to authenticated;
