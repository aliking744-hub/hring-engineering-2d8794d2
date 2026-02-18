
-- Fix notifications table: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix audit_logs table: restrict INSERT to authenticated users (for own logs) or service_role
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert own audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT
TO service_role
WITH CHECK (true);
