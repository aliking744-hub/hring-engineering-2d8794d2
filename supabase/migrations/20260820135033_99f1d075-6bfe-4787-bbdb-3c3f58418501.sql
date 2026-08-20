-- 1) digital_products: hide file_path from client roles (column-level grants)
REVOKE SELECT ON public.digital_products FROM anon, authenticated;
GRANT SELECT (id, name, description, price, payment_link, category, download_count, is_active, created_at, updated_at, has_file, file_ext)
  ON public.digital_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.digital_products TO authenticated;
GRANT ALL ON public.digital_products TO service_role;

-- 2) scenarios_with_answers: use invoker security so caller RLS applies
ALTER VIEW public.scenarios_with_answers SET (security_invoker = on);

-- admins need base-table read access for the view to work
DROP POLICY IF EXISTS "Admins can view scenarios" ON public.scenarios;
CREATE POLICY "Admins can view scenarios"
  ON public.scenarios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.scenarios_with_answers FROM anon;
GRANT SELECT ON public.scenarios_with_answers TO authenticated;
GRANT ALL ON public.scenarios_with_answers TO service_role;