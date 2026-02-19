-- Baselines: stores exercise starting values per user/group/exercise
create table if not exists public.baselines (
  user_id uuid references auth.users(id) on delete cascade not null,
  exercise_group text not null,
  exercise_id text not null,
  initial_weight_kg numeric not null default 0,
  initial_reps integer not null default 0,
  created_at timestamptz default now() not null,
  primary key (user_id, exercise_group, exercise_id)
);

create index if not exists idx_baselines_user_id on public.baselines(user_id);

alter table public.baselines enable row level security;

create policy "Users can view own baselines"
  on public.baselines for select
  using (auth.uid() = user_id);

create policy "Users can insert own baselines"
  on public.baselines for insert
  with check (auth.uid() = user_id);

create policy "Users can update own baselines"
  on public.baselines for update
  using (auth.uid() = user_id);

-- Workout logs: stores completed workout data with exercises as JSONB
create table if not exists public.workout_logs (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  week_number integer not null,
  workout_type text not null,
  day_in_week integer not null,
  date date not null,
  exercises jsonb not null default '[]',
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz default now() not null,
  unique (user_id, week_number, workout_type)
);

create index if not exists idx_workout_logs_user_id on public.workout_logs(user_id);

alter table public.workout_logs enable row level security;

create policy "Users can view own workout logs"
  on public.workout_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own workout logs"
  on public.workout_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workout logs"
  on public.workout_logs for update
  using (auth.uid() = user_id);
