-- ===========================================================================
-- PLAYBOOK — PERMESSI DEI CO-ALLENATORI E PROPOSTE (versione 0.20)
-- ---------------------------------------------------------------------------
-- Come usarlo: Supabase → il progetto → SQL Editor → New query,
-- incolla TUTTO questo file e premi "Run". Si può rilanciare senza danni.
-- (Serve aver già eseguito coallenatori.sql.)
--
-- Ogni invito ha un permesso:
--   "modifica"  → il coach modifica gli schemi direttamente
--   "proposta"  → il coach manda proposte; il proprietario le accetta o rifiuta
--   "lettura"   → il coach vede e stampa, senza modificare
-- ===========================================================================

-- 1. PERMESSO SU OGNI INVITO --------------------------------------------------
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

-- 2. SCHEMI: tutto lo staff legge, solo chi ha "modifica" scrive ------------
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

-- 3. PROPOSTE -------------------------------------------------------------------
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
