import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface AuthResult {
  user: { id: string; email?: string } | null;
  isServiceRole: boolean;
  response: Response | null;
}

function deny(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Requires a valid Supabase JWT (or the service-role key for internal/cron calls).
 * Returns { response } that must be returned immediately when authentication fails.
 */
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return { user: null, isServiceRole: false, response: deny("Authentication required", 401) };
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) {
    return { user: null, isServiceRole: true, response: null };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { user: null, isServiceRole: false, response: deny("Authentication required", 401) };
  }

  return { user: data.user, isServiceRole: false, response: null };
}

/** Requires an authenticated admin (or service-role for internal calls). */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.response || auth.isServiceRole) return auth;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user!.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!data) {
    return { user: auth.user, isServiceRole: false, response: deny("Admin access required", 403) };
  }
  return auth;
}
