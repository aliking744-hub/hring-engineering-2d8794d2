
-- 1) Notifications: restrict INSERT to self
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 2) support_chat_logs: remove anonymous-update loophole
DROP POLICY IF EXISTS "Users can update own chat logs" ON public.support_chat_logs;
CREATE POLICY "Users can update own chat logs"
ON public.support_chat_logs
FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat logs" ON public.support_chat_logs;
CREATE POLICY "Users can insert own chat logs"
ON public.support_chat_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3) credit_transactions: remove client INSERT path; only service_role/admin
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.credit_transactions;

-- 4) strategic_intents: limit SELECT to compass users
DROP POLICY IF EXISTS "Authenticated users can view active intents" ON public.strategic_intents;
CREATE POLICY "Compass users can view active intents"
ON public.strategic_intents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.compass_user_roles
    WHERE compass_user_roles.user_id = auth.uid()
  )
);

-- 5) strategic_bets: limit SELECT to compass users
DROP POLICY IF EXISTS "Authenticated users can view bets" ON public.strategic_bets;
CREATE POLICY "Compass users can view bets"
ON public.strategic_bets
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.compass_user_roles
    WHERE compass_user_roles.user_id = auth.uid()
  )
);
