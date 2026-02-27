-- Allow users to delete their own account.
-- All related data (user_programs, baselines, workout_logs) is removed
-- automatically via ON DELETE CASCADE foreign keys.
create or replace function public.delete_own_account()
returns void
language sql
security definer
as $$
  delete from auth.users where id = auth.uid();
$$;
