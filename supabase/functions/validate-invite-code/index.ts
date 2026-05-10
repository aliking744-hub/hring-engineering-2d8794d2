import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviteCode } = await req.json();

    if (
      !inviteCode ||
      typeof inviteCode !== "string" ||
      inviteCode.length < 4 ||
      inviteCode.length > 64
    ) {
      return new Response(
        JSON.stringify({ is_valid: false, error: "کد دعوت نامعتبر است" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invite, error } = await admin
      .from("company_invites")
      .select(
        "id, invite_code, role, company_id, max_uses, used_count, expires_at, is_active, companies(name, status)",
      )
      .eq("invite_code", inviteCode)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ is_valid: false, error: "کد دعوت نامعتبر است" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const company = (invite.companies as any) || {};

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          id: invite.id,
          role: invite.role,
          company_id: invite.company_id,
          company_name: company.name || "",
          error: "کد دعوت منقضی شده است",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (invite.max_uses && invite.used_count >= invite.max_uses) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          id: invite.id,
          role: invite.role,
          company_id: invite.company_id,
          company_name: company.name || "",
          error: "ظرفیت استفاده از این کد دعوت پر شده است",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (company.status === "suspended") {
      return new Response(
        JSON.stringify({
          is_valid: false,
          id: invite.id,
          role: invite.role,
          company_id: invite.company_id,
          company_name: company.name || "",
          error: "این شرکت در حال حاضر غیرفعال است",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        is_valid: true,
        id: invite.id,
        role: invite.role,
        company_id: invite.company_id,
        company_name: company.name || "",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("validate-invite-code error:", err);
    return new Response(
      JSON.stringify({ is_valid: false, error: "خطا در بررسی کد دعوت" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
