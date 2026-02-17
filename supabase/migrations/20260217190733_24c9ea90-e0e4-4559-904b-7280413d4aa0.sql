
-- 1. Fix payment_transactions: replace overly permissive system policies with service_role restricted ones
DROP POLICY IF EXISTS "System can insert transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.payment_transactions;

CREATE POLICY "Service role can insert transactions"
ON public.payment_transactions
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
ON public.payment_transactions
FOR UPDATE
TO service_role
USING (true);

-- 2. Fix candidates: remove duplicate policies without auth.uid() check
DROP POLICY IF EXISTS "Campaign owners can delete candidates" ON public.candidates;
DROP POLICY IF EXISTS "Campaign owners can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Campaign owners can update candidates" ON public.candidates;
DROP POLICY IF EXISTS "Campaign owners can view candidates" ON public.candidates;
