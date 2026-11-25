-- ===========================================================================
-- PLAYBOOK — CO-ALLENATORI (versione 0.18)
-- ---------------------------------------------------------------------------
-- Come usarlo: Supabase → il progetto → SQL Editor → New query,
-- incolla TUTTO questo file e premi "Run". Si può rilanciare senza danni.
--
-- Il proprietario di un playbook invita un altro coach con la sua email.
-- Quando quel coach accede con la stessa email, il playbook compare tra i
-- suoi e può modificarne gli schemi. Il playbook resta del proprietario:
-- solo lui può rinominarlo, eliminarlo, condividerlo o togliere un invito.
-- ===========================================================================

-- 1. INVITI ------------------------------------------------------------------
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

-- Il proprietario gestisce gli inviti, solo per i SUOI playbook
drop policy if exists "collaboratori: il proprietario gestisce" on public.collaboratori;
create policy "collaboratori: il proprietario gestisce" on public.collaboratori
  for all to authenticated
  using (proprietario = auth.uid())
  with check (
    proprietario = auth.uid()
    and exists (select 1 from public.playbook p
                where p.id = collaboratori.playbook and p.utente = auth.uid())
  );

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

-- 2. COSA PUÒ FARE UN CO-ALLENATORE ---------------------------------------
-- Schemi: leggere, creare, modificare ed eliminare quelli del playbook condiviso
drop policy if exists "schemi: co-allenatori" on public.schemi;
create policy "schemi: co-allenatori" on public.schemi
  for all to authenticated
  using (exists (select 1 from public.collaboratori c
                 where c.utente = auth.uid()
                   and c.proprietario = schemi.utente
                   and c.playbook = schemi.dati ->> 'playbook'))
  with check (exists (select 1 from public.collaboratori c
                 where c.utente = auth.uid()
                   and c.proprietario = schemi.utente
                   and c.playbook = schemi.dati ->> 'playbook'));

-- Playbook: solo leggere (nome e formato)
drop policy if exists "playbook: co-allenatori leggono" on public.playbook;
create policy "playbook: co-allenatori leggono" on public.playbook
  for select to authenticated
  using (exists (select 1 from public.collaboratori c
                 where c.utente = auth.uid()
                   and c.playbook = playbook.id
                   and c.proprietario = playbook.utente));

-- Formazioni: proprietario e co-allenatori vedono (non modificano) quelle
-- dell'altro, così i nomi delle formazioni compaiono giusti a tutti
drop policy if exists "formazioni: lo staff le vede" on public.formazioni;
create policy "formazioni: lo staff le vede" on public.formazioni
  for select to authenticated
  using (exists (select 1 from public.collaboratori c
                 where (c.utente = auth.uid() and c.proprietario = formazioni.utente)
                    or (c.proprietario = auth.uid() and c.utente = formazioni.utente)));
