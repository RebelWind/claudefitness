-- Add current_week to user_programs as the single source of truth
-- for which week the user is on (advances only when all 3 workouts are done).
alter table public.user_programs
  add column if not exists current_week integer not null default 1;

-- Allow users to update their own program (needed for current_week updates)
create policy "Users can update own programs"
  on public.user_programs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
