REVOKE ALL ON FUNCTION public.handle_new_user_credits() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_ip_before_insert() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_ip_address(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_candidate_access() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_profile_access() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_low_credits() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_monthly_credits() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.search_legal_docs(extensions.vector, double precision, integer, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_credits(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_credits(integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_credits() FROM anon;
REVOKE ALL ON FUNCTION public.get_company_role(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_company_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_compass_role(uuid, compass_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE ALL ON FUNCTION public.is_ceo(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_company_ceo(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_company_member(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Anyone can read feature permissions" ON public.feature_permissions;
CREATE POLICY "Authenticated users can read feature permissions"
  ON public.feature_permissions FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.feature_permissions FROM anon;

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Public can read non-sensitive site settings"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (key !~* '(secret|token|api[_-]?key|password|passwd|credential|private|webhook|smtp|merchant)');
CREATE POLICY "Admins can read all site settings"
  ON public.site_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS has_ceo_answer boolean
  GENERATED ALWAYS AS (ceo_answer IS NOT NULL AND ceo_answer <> '') STORED;
REVOKE SELECT (ceo_answer) ON public.scenarios FROM anon, authenticated;

CREATE OR REPLACE VIEW public.scenarios_with_answers
WITH (security_invoker = off) AS
  SELECT s.*
  FROM public.scenarios s
  WHERE auth.uid() IS NOT NULL
    AND (public.is_ceo(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.scenarios_with_answers TO authenticated;

ALTER TABLE public.digital_products
  ADD COLUMN IF NOT EXISTS has_file boolean
  GENERATED ALWAYS AS (file_path IS NOT NULL) STORED;
ALTER TABLE public.digital_products
  ADD COLUMN IF NOT EXISTS file_ext text
  GENERATED ALWAYS AS (lower(split_part(reverse(split_part(reverse(file_path), '.', 1)), '.', 1))) STORED;
REVOKE SELECT (file_path) ON public.digital_products FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins manage product files" ON storage.objects;
CREATE POLICY "Admins manage product files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'admin'::app_role));