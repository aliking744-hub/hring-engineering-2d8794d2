-- 1. Drop public read access on company_invites; validation will be done server-side via edge function
DROP POLICY IF EXISTS "Active invites can be read by invite code" ON public.company_invites;

-- 2. Tighten payment_transactions service-role policies
-- service_role bypasses RLS by design, so these permissive policies are unnecessary and confusing
DROP POLICY IF EXISTS "Service role can insert transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON public.payment_transactions;

-- 3. Lock down enumeration helper functions: callers must be authenticated AND
--    can only query themselves OR fellow members of the same company
CREATE OR REPLACE FUNCTION public.get_company_role(_user_id uuid, _company_id uuid)
RETURNS company_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id = auth.uid()
      AND is_active = true
  ) THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT role FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id = auth.uid()
      AND is_active = true
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Only allow checking yourself, or members of a company you belong to
  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1
    FROM public.company_members cm1
    JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
    WHERE cm1.user_id = auth.uid()
      AND cm1.is_active = true
      AND cm2.user_id = _user_id
      AND cm2.is_active = true
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id
      AND role = 'ceo'
      AND is_active = true
  );
END;
$$;

-- 4. Harden deduct_credits: validate amount range to prevent abuse / nonsense values
CREATE OR REPLACE FUNCTION public.deduct_credits(amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
      RETURN FALSE;
    END IF;

    IF amount IS NULL OR amount < 1 OR amount > 1000 THEN
      RAISE EXCEPTION 'Invalid deduction amount: must be between 1 and 1000';
    END IF;

    SELECT credits INTO current_credits
    FROM public.user_credits
    WHERE user_id = auth.uid()
    FOR UPDATE;

    IF current_credits IS NULL OR current_credits < amount THEN
        RETURN FALSE;
    END IF;

    UPDATE public.user_credits
    SET credits = credits - amount, updated_at = now()
    WHERE user_id = auth.uid();
    RETURN TRUE;
END;
$$;