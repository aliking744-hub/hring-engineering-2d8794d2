import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZARINPAL_MERCHANT_ID = Deno.env.get("ZARINPAL_MERCHANT_ID");
const ZARINPAL_API_URL = "https://payment.zarinpal.com/pg/v4/payment";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Transitional fallback only. The independent billing API is authoritative.
// Corporate plans are deliberately excluded and require contacting support.
const PLAN_PRICES: Record<string, number> = {
  individual_pro: 1476000,
  individual_plus: 3998000,
};

const PLAN_CREDITS: Record<string, number> = {
  individual_free: 0,
  individual_pro: 2000,
  individual_plus: 6000,
};

interface PaymentRequest {
  action: "init" | "verify";
  plan_type?: string;
  authority?: string;
  callback_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid token");
    }

    const body: PaymentRequest = await req.json();
    console.log("Payment request:", body);

    if (body.action === "init") {
      // Initialize payment
      if (!body.plan_type || !body.callback_url) {
        throw new Error("plan_type and callback_url are required");
      }

      const amount = PLAN_PRICES[body.plan_type];
      if (!amount) {
        throw new Error("Invalid plan type");
      }

      // Get user profile for company check
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      // Call Zarinpal API
      const zarinpalResponse = await fetch(`${ZARINPAL_API_URL}/request.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          amount: amount * 10, // Convert to Rials
          description: `ارتقا به پلن ${body.plan_type}`,
          callback_url: body.callback_url,
          metadata: {
            email: user.email,
            plan_type: body.plan_type,
          },
        }),
      });

      const zarinpalData = await zarinpalResponse.json();
      console.log("Zarinpal response:", zarinpalData);

      if (zarinpalData.data?.code !== 100) {
        throw new Error(`Zarinpal error: ${zarinpalData.errors?.message || "Unknown error"}`);
      }

      const authority = zarinpalData.data.authority;

      // Save transaction
      const { error: insertError } = await supabase
        .from("payment_transactions")
        .insert({
          user_id: user.id,
          company_id: membership?.company_id || null,
          amount: amount,
          plan_type: body.plan_type,
          authority: authority,
          status: "pending",
          description: `ارتقا به پلن ${body.plan_type}`,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Failed to save transaction");
      }

      return new Response(
        JSON.stringify({
          success: true,
          authority: authority,
          payment_url: `https://payment.zarinpal.com/pg/StartPay/${authority}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (body.action === "verify") {
      // Verify payment
      if (!body.authority) {
        throw new Error("authority is required");
      }

      // Get transaction
      const { data: transaction, error: txError } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("authority", body.authority)
        .maybeSingle();

      if (txError || !transaction) {
        throw new Error("Transaction not found");
      }

      if (transaction.status === "verified") {
        return new Response(
          JSON.stringify({ success: true, message: "Already verified", ref_id: transaction.ref_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify with Zarinpal
      const verifyResponse = await fetch(`${ZARINPAL_API_URL}/verify.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          amount: transaction.amount * 10,
          authority: body.authority,
        }),
      });

      const verifyData = await verifyResponse.json();
      console.log("Verify response:", verifyData);

      if (verifyData.data?.code === 100 || verifyData.data?.code === 101) {
        // Payment successful
        const refId = verifyData.data.ref_id;

        // Update transaction
        await supabase
          .from("payment_transactions")
          .update({ status: "verified", ref_id: String(refId) })
          .eq("id", transaction.id);

        // Update user's subscription and credits
        const creditAmount = PLAN_CREDITS[transaction.plan_type] || 0;
        
        if (transaction.company_id) {
          // Corporate subscription
          await supabase
            .from("companies")
            .update({ 
              subscription_tier: transaction.plan_type,
              monthly_credits: creditAmount,
              used_credits: 0,
              credit_pool: creditAmount,
              last_credit_reset: new Date().toISOString()
            })
            .eq("id", transaction.company_id);
        } else {
          // Individual subscription
          await supabase
            .from("profiles")
            .update({ 
              subscription_tier: transaction.plan_type,
              monthly_credits: creditAmount,
              used_credits: 0,
              last_credit_reset: new Date().toISOString()
            })
            .eq("id", transaction.user_id);
            
          // Also update user_credits table
          await supabase
            .from("user_credits")
            .update({ credits: creditAmount })
            .eq("user_id", transaction.user_id);
        }

        return new Response(
          JSON.stringify({ success: true, ref_id: refId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Payment failed
        await supabase
          .from("payment_transactions")
          .update({ status: "failed" })
          .eq("id", transaction.id);

        throw new Error("Payment verification failed");
      }
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    console.error("Payment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
