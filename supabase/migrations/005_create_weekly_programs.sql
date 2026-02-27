-- Weekly programs: caches per-week exercise data fetched from Google Sheets via N8N
-- Avoids repeated N8N calls on every page refresh
create table if not exists public.weekly_programs (
  user_id uuid references auth.users(id) on delete cascade not null,
  week_number integer not null,
  exercises jsonb not null default '[]',
  fetched_at timestamptz default now() not null,
  primary key (user_id, week_number)
);

create index if not exists idx_weekly_programs_user_id on public.weekly_programs(user_id);

alter table public.weekly_programs enable row level security;

create policy "Users can view own weekly programs"
  on public.weekly_programs for select
  using (auth.uid() = user_id);

create policy "Users can insert own weekly programs"
  on public.weekly_programs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own weekly programs"
  on public.weekly_programs for update
  using (auth.uid() = user_id);

create policy "Users can delete own weekly programs"
  on public.weekly_programs for delete
  using (auth.uid() = user_id);
