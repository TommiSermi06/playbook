-- ===========================================================================
-- PLAYBOOK — CO-ALLENATORI (versione 0.18, corretto nella 0.19)
-- ---------------------------------------------------------------------------
-- Come usarlo: Supabase → il progetto → SQL Editor → New query,
-- incolla TUTTO questo file e premi "Run". Si può rilanciare senza danni.
--
-- Il proprietario di un playbook invita un altro coach con la sua email.
-- Quando quel coach accede con la stessa email, il playbook compare tra i
-- suoi e può modificarne gli schemi. Il playbook resta del proprietario:
-- solo lui può rinominarlo, eliminarlo, condividerlo o togliere un invito.
-- ===========================================================================

-- 0. CONTROLLI DI APPOGGIO ---------------------------------------------------
-- Le regole delle tabelle si chiamano a vicenda (inviti ↔ playbook): per non
-- girare in tondo ("infinite recursion") i controlli stanno in funzioni
-- "security definer", che leggono le tabelle senza riapplicare le regole.
-- (Le funzioni si riferiscono a tabelle create più sotto: per questo la
--  tabella collaboratori va creata prima delle funzioni.)

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

-- 2. COSA PUÒ FARE UN CO-ALLENATORE ---------------------------------------
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
