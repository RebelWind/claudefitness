-- Allow authenticated users to update their own user_programs
CREATE POLICY "Users can update own user_programs"
ON user_programs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
