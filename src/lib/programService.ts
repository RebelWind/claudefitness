import { supabase } from './supabase';
import { createNewProgram, generateProgramKey } from './n8nService';

export interface UserProgram {
  id: string;
  user_id: string;
  program_key: string;
  program_name: string;
  google_file_id: string | null;
  google_file_name: string | null;
  created_at: string;
  current_week: number;
}

export async function saveUserProgram(
  userId: string,
  programKey: string,
  programName: string,
  googleFileId?: string,
  googleFileName?: string,
): Promise<UserProgram> {
  const { data, error } = await supabase
    .from('user_programs')
    .insert({
      user_id: userId,
      program_key: programKey,
      program_name: programName,
      google_file_id: googleFileId || null,
      google_file_name: googleFileName || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserProgram(userId: string): Promise<UserProgram | null> {
  const { data, error } = await supabase
    .from('user_programs')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Ensures a program exists for the given user.
 * If no program is found in Supabase, creates one via N8N and saves it.
 * Returns the program (existing or newly created), or null on failure.
 */
export async function ensureProgramExists(userId: string): Promise<UserProgram | null> {
  const existing = await getUserProgram(userId);
  if (existing?.google_file_id) return existing;

  // No program — create via N8N
  const programKey = generateProgramKey();
  const programName = `${programKey}-SuperHeroDongu`;

  const result = await createNewProgram(programKey);

  if (!result.success || !result.googleFileId) {
    return null;
  }

  return saveUserProgram(
    userId,
    programKey,
    programName,
    result.googleFileId,
    result.googleFileName,
  );
}

export async function updateCurrentWeek(userId: string, week: number): Promise<void> {
  const { error } = await supabase
    .from('user_programs')
    .update({ current_week: week })
    .eq('user_id', userId);

  if (error) throw error;
}
