import { supabase } from './supabase';

export interface UserProgram {
  id: string;
  user_id: string;
  program_key: string;
  program_name: string;
  google_file_id: string | null;
  google_file_name: string | null;
  created_at: string;
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
