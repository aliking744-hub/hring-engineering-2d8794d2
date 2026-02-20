
CREATE TABLE public.learning_path_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  employee_email TEXT,
  job_title TEXT NOT NULL,
  industry TEXT NOT NULL,
  seniority_level TEXT NOT NULL,
  education_level TEXT NOT NULL,
  field_of_study TEXT,
  experience_years INTEGER NOT NULL,
  training_months INTEGER,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_path_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own records"
ON public.learning_path_records
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can view their own records"
ON public.learning_path_records
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own records"
ON public.learning_path_records
FOR DELETE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE INDEX idx_learning_path_records_user_id ON public.learning_path_records(user_id);
CREATE INDEX idx_learning_path_records_created_at ON public.learning_path_records(created_at DESC);
