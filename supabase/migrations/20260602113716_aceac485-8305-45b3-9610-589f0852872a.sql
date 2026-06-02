
-- 1. Fix scenarios SELECT: require compass user
DROP POLICY IF EXISTS "Authenticated users can view active scenarios" ON public.scenarios;
CREATE POLICY "Compass users can view active scenarios"
ON public.scenarios FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND EXISTS (SELECT 1 FROM public.compass_user_roles WHERE user_id = auth.uid())
);

-- 2. support_chat_logs UPDATE: explicit non-null user_id
DROP POLICY IF EXISTS "Users can update own chat logs" ON public.support_chat_logs;
CREATE POLICY "Users can update own chat logs"
ON public.support_chat_logs FOR UPDATE
USING (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id);

-- 3. user_purchases: remove self-insert privilege escalation. Only service_role (edge functions) and admins may insert.
DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.user_purchases;

-- 4. unicorn-documents: explicit UPDATE policy with ownership
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'unicorn-documents' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'unicorn-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 5. Revoke EXECUTE on SECURITY DEFINER functions from anon (and authenticated where internal/trigger-only)
-- Trigger / internal-only functions: revoke from PUBLIC, anon, authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user_credits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_ip_address(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_ip_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_candidate_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_profile_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_low_credits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_credits() FROM PUBLIC, anon, authenticated;

-- Helper / RLS / RPC functions: revoke from anon only, keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_compass_role(uuid, compass_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_ceo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_company_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_credits() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_legal_docs(extensions.vector, double precision, integer, text) FROM PUBLIC, anon;
