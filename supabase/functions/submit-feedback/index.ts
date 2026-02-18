import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's auth token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use authenticated user's ID — never trust client-supplied userId
    const userId = data.claims.sub;

    const { rating, comment } = await req.json();

    if (!rating) {
      return new Response(JSON.stringify({ error: "rating is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for database operations after identity is verified
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has already submitted feedback
    const { data: existingFeedback } = await supabase
      .from('site_feedback')
      .select('id, rewarded')
      .eq('user_id', userId);

    const isFirstFeedback = !existingFeedback || existingFeedback.length === 0;

    // Insert the feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('site_feedback')
      .insert({
        user_id: userId,
        rating,
        comment: comment || null,
        rewarded: isFirstFeedback
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("Error inserting feedback:", feedbackError);
      throw new Error("Failed to submit feedback");
    }

    let diamondsAwarded = 0;

    // Award 50 diamonds if first feedback
    if (isFirstFeedback) {
      const { data: userCredits } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

      if (userCredits) {
        await supabase
          .from('user_credits')
          .update({ credits: userCredits.credits + 50 })
          .eq('user_id', userId);
        diamondsAwarded = 50;
      } else {
        await supabase
          .from('user_credits')
          .insert({ user_id: userId, credits: 50 });
        diamondsAwarded = 50;
      }

      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: 50,
          transaction_type: 'feedback_reward',
          description: 'پاداش ثبت اولین نظر'
        });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      isFirstFeedback,
      diamondsAwarded,
      message: isFirstFeedback 
        ? "فدای محبت شما! ۵۰ الماس ناقابل تقدیم نگاهتون شد." 
        : "ممنون از نظر ارزشمندتون!"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("submit-feedback error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
