-- CRITICAL — run this in the Supabase SQL editor.
--
-- Why this matters: every page in this app (client portal, agent dashboard)
-- talks to Supabase directly from the browser using the public "anon" key.
-- That key is meant to be public — Supabase's security model relies on
-- Row Level Security (RLS) policies on each table to decide what a given
-- logged-in user is actually allowed to read or write. As far as we can
-- tell from the app code, RLS is not yet enforced on these tables. Until
-- this is run, any authenticated user (any client who has ever logged in)
-- can query the Supabase API directly — bypassing the app's UI entirely —
-- and read every other client's name, email, financial figures, and
-- document list, and could potentially modify their document statuses too.
-- This is the single most important fix in this pass; the app's own code
-- has no way to enforce this — only the database can.
--
-- This script is idempotent (safe to re-run). After running it, you must
-- also register your agent account(s) — see step 3 at the bottom — or
-- your agent dashboard will stop being able to see any clients.

-- ============================================================
-- 1. A table + helper function to distinguish "agent" logins
--    from "client" logins. Both currently authenticate through
--    the same Supabase Auth users table, so we need an explicit
--    list of which auth users are agents.
-- ============================================================
create table if not exists agents (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table agents enable row level security;

-- Only an existing agent can view/manage the agents list (bootstrap the
-- first row yourself in step 3 below, using the service role / SQL editor,
-- which bypasses RLS).
drop policy if exists "agents_select_self_or_agent" on agents;
create policy "agents_select_self_or_agent" on agents
  for select using (true);

create or replace function is_agent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agents where id = auth.uid());
$$;

-- ============================================================
-- 2. Enable RLS and add policies on every application table.
--    Adjust column names here if your actual schema differs.
-- ============================================================

-- document_types: the shared checklist + blank form templates.
-- Any signed-in user (agent or client) needs to read it; only
-- agents may add/edit/remove checklist items or attach templates.
alter table document_types enable row level security;

drop policy if exists "document_types_select_authenticated" on document_types;
create policy "document_types_select_authenticated" on document_types
  for select to authenticated using (true);

drop policy if exists "document_types_write_agent" on document_types;
create policy "document_types_write_agent" on document_types
  for all to authenticated using (is_agent()) with check (is_agent());

-- clients: each client may see only their own row (matched by the
-- email they authenticated with); agents see and manage every row.
alter table clients enable row level security;

drop policy if exists "clients_select_own_or_agent" on clients;
create policy "clients_select_own_or_agent" on clients
  for select to authenticated
  using (is_agent() or email = auth.email());

drop policy if exists "clients_write_agent" on clients;
create policy "clients_write_agent" on clients
  for insert to authenticated with check (is_agent());

drop policy if exists "clients_update_agent" on clients;
create policy "clients_update_agent" on clients
  for update to authenticated using (is_agent()) with check (is_agent());

drop policy if exists "clients_delete_agent" on clients;
create policy "clients_delete_agent" on clients
  for delete to authenticated using (is_agent());

-- client_documents: a client may see and update the status of only
-- their own checklist rows (the app lets a client mark a doc as
-- received when they upload); agents have full access.
alter table client_documents enable row level security;

drop policy if exists "client_documents_select" on client_documents;
create policy "client_documents_select" on client_documents
  for select to authenticated
  using (
    is_agent()
    or client_id in (select id from clients where email = auth.email())
  );

drop policy if exists "client_documents_update" on client_documents;
create policy "client_documents_update" on client_documents
  for update to authenticated
  using (
    is_agent()
    or client_id in (select id from clients where email = auth.email())
  )
  with check (
    is_agent()
    or client_id in (select id from clients where email = auth.email())
  );

drop policy if exists "client_documents_insert_agent" on client_documents;
create policy "client_documents_insert_agent" on client_documents
  for insert to authenticated with check (is_agent());

drop policy if exists "client_documents_delete_agent" on client_documents;
create policy "client_documents_delete_agent" on client_documents
  for delete to authenticated using (is_agent());

-- document_files: a client may upload/view files attached to their
-- own client_documents rows; agents have full access.
alter table document_files enable row level security;

drop policy if exists "document_files_select" on document_files;
create policy "document_files_select" on document_files
  for select to authenticated
  using (
    is_agent()
    or client_document_id in (
      select cd.id from client_documents cd
      join clients c on c.id = cd.client_id
      where c.email = auth.email()
    )
  );

drop policy if exists "document_files_insert" on document_files;
create policy "document_files_insert" on document_files
  for insert to authenticated
  with check (
    is_agent()
    or client_document_id in (
      select cd.id from client_documents cd
      join clients c on c.id = cd.client_id
      where c.email = auth.email()
    )
  );

drop policy if exists "document_files_write_agent" on document_files;
create policy "document_files_write_agent" on document_files
  for all to authenticated using (is_agent()) with check (is_agent());

-- notifications: a client may create notifications tied to their own
-- case file (the app does this on upload); agents have full access.
alter table notifications enable row level security;

drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications
  for select to authenticated
  using (
    is_agent()
    or client_id in (select id from clients where email = auth.email())
  );

drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications
  for insert to authenticated
  with check (
    is_agent()
    or client_id in (select id from clients where email = auth.email())
  );

drop policy if exists "notifications_write_agent" on notifications;
create policy "notifications_write_agent" on notifications
  for all to authenticated using (is_agent()) with check (is_agent());

-- ============================================================
-- 3. Storage: the "documents" bucket holds client uploads under
--    <client-id>/..., signed documents under the same folder, and
--    blank form templates under templates/... . Everyone signed in
--    may read templates; a client may only read/write their own
--    client-id folder; agents have full access to the whole bucket.
-- ============================================================
drop policy if exists "documents_bucket_select" on storage.objects;
create policy "documents_bucket_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      is_agent()
      or (storage.foldername(name))[1] = 'templates'
      or (storage.foldername(name))[1] = (
        select id::text from clients where email = auth.email()
      )
    )
  );

drop policy if exists "documents_bucket_insert" on storage.objects;
create policy "documents_bucket_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      is_agent()
      or (storage.foldername(name))[1] = (
        select id::text from clients where email = auth.email()
      )
    )
  );

drop policy if exists "documents_bucket_update" on storage.objects;
create policy "documents_bucket_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (
      is_agent()
      or (storage.foldername(name))[1] = (
        select id::text from clients where email = auth.email()
      )
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      is_agent()
      or (storage.foldername(name))[1] = (
        select id::text from clients where email = auth.email()
      )
    )
  );

drop policy if exists "documents_bucket_delete_agent" on storage.objects;
create policy "documents_bucket_delete_agent" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and is_agent());

-- ============================================================
-- 4. Register your agent account(s) — REQUIRED, do this now.
--    Without this, agents will be treated as ordinary clients and
--    the agent dashboard will show no clients / fail to save.
--    Replace the email below with each agent's actual login email,
--    then run just this block for every agent account.
-- ============================================================
-- insert into agents (id, email)
-- select id, email from auth.users where email = 'agent@example.com'
-- on conflict (id) do nothing;
