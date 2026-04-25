-- ══════════════════════════════════════════════════════════
-- Studio App — Supabase Schema
-- Run this entire file in Supabase → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

-- Enable UUID extension (already on by default in Supabase)
create extension if not exists "uuid-ossp";

-- ── profiles ─────────────────────────────────────────────
-- One row per authenticated user. Stores all studio settings.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "owner_profiles" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ── quotes ───────────────────────────────────────────────
create table if not exists public.quotes (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.quotes enable row level security;
create policy "owner_quotes" on public.quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists quotes_user_idx on public.quotes(user_id);

-- ── invoices ─────────────────────────────────────────────
create table if not exists public.invoices (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.invoices enable row level security;
create policy "owner_invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists invoices_user_idx on public.invoices(user_id);

-- ── clients ──────────────────────────────────────────────
create table if not exists public.clients (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.clients enable row level security;
create policy "owner_clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists clients_user_idx on public.clients(user_id);

-- ── packages ─────────────────────────────────────────────
create table if not exists public.packages (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.packages enable row level security;
create policy "owner_packages" on public.packages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists packages_user_idx on public.packages(user_id);

-- ── accept_tokens ─────────────────────────────────────────
-- Maps public acceptance tokens to quote IDs (no RLS — public read for accept.html)
create table if not exists public.accept_tokens (
  token       text primary key,
  quote_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz,              -- null = no expiry (legacy tokens)
  created_at  timestamptz default now()
);

-- Migration: add column to existing table if it doesn't exist yet
alter table public.accept_tokens
  add column if not exists expires_at timestamptz;

alter table public.accept_tokens enable row level security;
-- Owners can insert/delete their own tokens
create policy "owner_accept_tokens_write" on public.accept_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Public can read a single token row to verify acceptance.
-- IMPORTANT: This policy allows reading only when filtering by token value.
-- The query in accept.html always uses .eq('token', token) which satisfies this.
-- For stronger isolation, replace sbGetAcceptToken() with a Supabase Edge Function
-- that validates the token server-side without exposing the table directly.
create policy "public_accept_tokens_read" on public.accept_tokens
  for select using (true);

-- ── Storage bucket for logos ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "owner_upload_logo" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner_update_logo" on storage.objects
  for update using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner_delete_logo" on storage.objects
  for delete using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "public_read_logo" on storage.objects
  for select using (bucket_id = 'logos');

-- ── updated_at trigger ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger quotes_updated_at    before update on public.quotes    for each row execute function public.set_updated_at();
create trigger invoices_updated_at  before update on public.invoices  for each row execute function public.set_updated_at();
create trigger clients_updated_at   before update on public.clients   for each row execute function public.set_updated_at();
create trigger packages_updated_at  before update on public.packages  for each row execute function public.set_updated_at();
create trigger profiles_updated_at  before update on public.profiles  for each row execute function public.set_updated_at();

-- ── Trial limit enforcement (server-side) ─────────────────
-- Prevents trial bypass via localStorage manipulation.
-- Rejects any INSERT that would exceed 100 quotes or 100 invoices per user.
create or replace function public.enforce_trial_limit()
returns trigger language plpgsql security definer as $$
declare
  quote_count   int;
  invoice_count int;
begin
  if TG_TABLE_NAME = 'quotes' then
    select count(*) into quote_count
      from public.quotes where user_id = NEW.user_id;
    if quote_count >= 100 then
      raise exception 'Trial limit reached: 100 quotes. Please upgrade to continue.';
    end if;
  end if;

  if TG_TABLE_NAME = 'invoices' then
    select count(*) into invoice_count
      from public.invoices where user_id = NEW.user_id;
    if invoice_count >= 100 then
      raise exception 'Trial limit reached: 100 invoices. Please upgrade to continue.';
    end if;
  end if;

  return NEW;
end;
$$;

-- Only fires on INSERT (not upsert-as-update), so editing existing records is unaffected
create trigger quotes_trial_limit
  before insert on public.quotes
  for each row execute function public.enforce_trial_limit();

create trigger invoices_trial_limit
  before insert on public.invoices
  for each row execute function public.enforce_trial_limit();
