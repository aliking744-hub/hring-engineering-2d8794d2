import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey2 = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUserClient2 = createClient(supabaseUrl2, supabaseAnonKey2, {
    global: { headers: { Authorization: authHeader } }
  });

  const token2 = authHeader.replace('Bearer ', '');
  const { data: claimsData2, error: claimsError2 } = await supabaseUserClient2.auth.getClaims(token2);
  if (claimsError2 || !claimsData2?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use authenticated user ID
  const authenticatedUserId = claimsData2.claims.sub;

  try {
    const { messages, sessionId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch system prompt and phone from settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['support_system_prompt', 'support_phone']);

    // Fetch feature permissions for knowledge base
    const { data: features } = await supabase
      .from('feature_permissions')
      .select('feature_key, feature_name, feature_category, allowed_tiers, allowed_company_roles, credit_cost, is_active')
      .eq('is_active', true);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
      if (s.key && s.value) settingsMap[s.key] = s.value;
    });

    const supportPhone = settingsMap['support_phone'] || '09123456789';

    // Build comprehensive knowledge base
    const knowledgeBase = `
## اطلاعات پلتفرم HRing

### انواع کاربران فردی (B2C):

1. **رایگان (individual_free)**:
   - اعتبار: ۵۰ واحد (فقط یکبار)
   - دسترسی: ماژول‌ها، محاسبه هزینه استخدام
   - بدون ذخیره ابری
   - هدهانتینگ، آنبوردینگ و قطب‌نما مخفی است

2. **کارشناس (individual_expert)**:
   - اعتبار: ۶۰۰ واحد/ماه
   - دسترسی کامل به ماژول‌ها

3. **حرفه‌ای (individual_pro)**:
   - اعتبار: ۶۰۰ واحد/ماه  
   - دسترسی به ماژول‌ها + هدهانتینگ هوشمند
   - آنبوردینگ و قطب‌نما مخفی است

4. **پلاس (individual_plus)**:
   - اعتبار: ۲۵۰۰ واحد/ماه
   - همه امکانات + دموی قطب‌نما و آنبوردینگ (فقط مشاهده)
   - ذخیره ابری فعال

### انواع کاربران شرکتی (B2B):

1. **کارشناس شرکتی (corporate_expert)**:
   - تا ۵ کاربر
   - دسترسی کامل + آنبوردینگ

2. **پشتیبان تصمیم (corporate_decision_support)**:
   - تا ۱۰ کاربر
   - همه امکانات + قطب‌نمای استراتژیک (محدود)

3. **تصمیم‌ساز (corporate_decision_making)**:
   - تا ۵۰ کاربر
   - همه قابلیت‌ها + داشبورد کامل

### نقش‌های شرکتی:
- **مدیرعامل (ceo)**: مدیریت کامل شرکت، کاربران و تنظیمات
- **معاون (deputy)**: مدیریت دعوت‌نامه‌ها و دسترسی به اکثر امکانات
- **مدیر (manager)**: دسترسی به گزارشات و ابزارها
- **کارشناس (employee)**: دسترسی پایه به ابزارها

### فیچرها و هزینه اعتبار:
${features?.map(f => `- ${f.feature_name}: ${f.credit_cost} اعتبار`).join('\n') || ''}

### صفحات اصلی:
- **داشبورد** (/dashboard): صفحه اصلی پنل کاربری
- **ماژول‌ها** (/modules): ابزارهای هوش مصنوعی
- **ارتقا** (/upgrade): خرید پلن و اعتبار
- **فروشگاه** (/shop): محصولات دیجیتال
- **وکیل جیبی** (/legal-advisor): مشاوره حقوقی کار

### شماره پشتیبانی: ${supportPhone}
`;

    let systemPrompt = settingsMap['support_system_prompt'] || 
      `تو یک دستیار پشتیبانی فوق‌العاده مودب، فروتن و صمیمی HRing هستی که به زبان فارسی عامیانه ولی محترمانه صحبت می‌کنی.

${knowledgeBase}

## دستورالعمل‌ها:
- از اطلاعات بالا برای پاسخ‌دهی استفاده کن
- اگر کسی درباره پلن‌ها سوال کرد، جزئیات دقیق بده
- اگر درباره قیمت سوال شد، به صفحه /upgrade هدایت کن
- اگر درباره فیچر خاصی سوال شد، بگو چقدر اعتبار می‌خواد و کدوم پلن‌ها دسترسی دارن
- اگر کسی درباره "مشاوره حقوقی" یا "قانون کار" سوال کرد، به بخش "وکیل جیبی" هدایت کن
- اگر موضوع نامربوط بود: "برای راهنمایی بیشتر با پشتیبانی تماس بگیرید: ${supportPhone}"`;

    // Replace placeholder with actual phone
    systemPrompt = systemPrompt.replace(/{SUPPORT_PHONE}/g, supportPhone);

    console.log("Processing chat request for session:", sessionId);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تعداد درخواست‌ها زیاد است، لطفاً کمی صبر کنید." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "اعتبار سرویس تمام شده است." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "خطا در پردازش درخواست" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the chat to database (async, don't wait)
    const logChat = async (assistantResponse: string) => {
      try {
        const allMessages = [
          ...messages,
          { role: 'assistant', content: assistantResponse }
        ];

        // Check if session exists
        const { data: existing } = await supabase
          .from('support_chat_logs')
          .select('id, messages')
          .eq('session_id', sessionId)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('support_chat_logs')
            .update({ 
          messages: allMessages,
              user_id: authenticatedUserId 
            })
            .eq('id', existing.id);
        } else {
          // Create new
          await supabase
            .from('support_chat_logs')
            .insert({
              session_id: sessionId,
              user_id: authenticatedUserId,
              messages: allMessages
            });
        }
      } catch (err) {
        console.error("Error logging chat:", err);
      }
    };

    // Create a transform stream to capture the response for logging
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let fullResponse = "";

    // Process the stream
    (async () => {
      const reader = response.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value, { stream: true });
          
          // Parse SSE to extract content for logging
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) fullResponse += content;
              } catch {}
            }
          }
          
          await writer.write(value);
        }
      } finally {
        writer.close();
        // Log after stream is complete
        if (fullResponse) {
          logChat(fullResponse);
        }
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("hring-support error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
