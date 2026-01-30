-- Create storage bucket for unicorn lab documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('unicorn-documents', 'unicorn-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for unicorn documents storage
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'unicorn-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'unicorn-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'unicorn-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create unicorn_analyses table to store analysis results
CREATE TABLE public.unicorn_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Company Profile
  company_name TEXT NOT NULL,
  company_url TEXT,
  linkedin_url TEXT,
  founders_bio TEXT,
  current_valuation BIGINT,
  monthly_active_users BIGINT,
  burn_rate BIGINT,
  
  -- Uploaded Documents
  pitch_deck_path TEXT,
  financials_path TEXT,
  employees_list_path TEXT,
  
  -- Analysis Results
  u_score INTEGER,
  analysis_result JSONB,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unicorn_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own analyses
CREATE POLICY "Users can view their own analyses"
ON public.unicorn_analyses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses"
ON public.unicorn_analyses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses"
ON public.unicorn_analyses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
ON public.unicorn_analyses
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_unicorn_analyses_updated_at
BEFORE UPDATE ON public.unicorn_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_unicorn_analyses_user_id ON public.unicorn_analyses(user_id);
CREATE INDEX idx_unicorn_analyses_status ON public.unicorn_analyses(status);
CREATE INDEX idx_unicorn_analyses_created_at ON public.unicorn_analyses(created_at DESC);