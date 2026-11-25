-- ===========================================================================
-- PLAYBOOK — condivisione in SOLA LETTURA (versione 0.17)
-- ---------------------------------------------------------------------------
-- Come usarlo: Supabase → il progetto → SQL Editor → New query,
-- incolla TUTTO questo file e premi "Run". Si può rilanciare senza danni.
--
-- Cosa crea:
--   1. condivisioni → i link creati dal coach (uno per playbook)
--   2. playbook_condiviso(codice) → la funzione che, dato il codice del
--      link, restituisce SOLO quel playbook (schemi, formazioni usate,
--      nome e logo della squadra). Chi ha il link può leggere, mai scrivere.
-- Le tabelle schemi/playbook/formazioni restano chiuse a chi non è collegato.
-- ===========================================================================

-- 1. CONDIVISIONI -------------------------------------------------------------
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

-- 2. LETTURA DI UN PLAYBOOK CONDIVISO ---------------------------------------
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
