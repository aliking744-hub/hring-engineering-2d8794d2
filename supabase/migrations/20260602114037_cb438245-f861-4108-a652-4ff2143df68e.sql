
CREATE TABLE public.hr_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  employee_count integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_uploads TO authenticated;
GRANT ALL ON public.hr_uploads TO service_role;

ALTER TABLE public.hr_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own HR uploads"
ON public.hr_uploads FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert their own HR uploads"
ON public.hr_uploads FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update their own HR uploads"
ON public.hr_uploads FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own HR uploads"
ON public.hr_uploads FOR DELETE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admin can manage all HR uploads"
ON public.hr_uploads FOR ALL
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_hr_uploads_user_created ON public.hr_uploads(user_id, created_at DESC);
