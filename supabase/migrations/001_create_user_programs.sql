-- User programs table: stores n8n webhook results per user
create table if not exists public.user_programs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  program_key text unique not null,
  program_name text not null,
  google_file_id text,
  google_file_name text,
  created_at timestamptz default now() not null
);

-- Index for fast user lookup
create index if not exists idx_user_programs_user_id on public.user_programs(user_id);

-- RLS: users can only see/create their own programs
alter table public.user_programs enable row level security;

create policy "Users can view own programs"
  on public.user_programs for select
  using (auth.uid() = user_id);

create policy "Users can insert own programs"
  on public.user_programs for insert
  with check (auth.uid() = user_id);
