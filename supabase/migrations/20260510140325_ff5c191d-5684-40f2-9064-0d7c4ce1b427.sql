
CREATE OR REPLACE FUNCTION public.deduct_credits(amount integer, feature_key text DEFAULT NULL, description text DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, feature_key, description)
    VALUES (auth.uid(), -amount, 'deduction', feature_key, description);

    RETURN TRUE;
END;
$function$;
