DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Client-callable RPCs
GRANT EXECUTE ON FUNCTION public.deduct_credits(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits() TO authenticated;

-- Helper functions required for RLS policy evaluation by signed-in users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_compass_role(uuid, compass_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_ceo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;