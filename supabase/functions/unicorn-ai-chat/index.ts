import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  question: string;
  companyId: string;
  mode: 'interrogation' | 'admin_analysis';
  context?: {
    company?: string;
    engineResults?: Record<string, unknown>;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { question, companyId, mode, context } = await req.json() as ChatRequest;

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    
    const apiKey = geminiKey || lovableKey;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          response: 'برای استفاده از چت هوش مصنوعی، لطفاً کلید API را تنظیم کنید.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = mode === 'interrogation'
      ? `شما یک بازجوی دیجیتال هستید که سوالات سخت درباره استارتاپ‌ها می‌پرسید. 
         به ادعاها شک کنید و دنبال شواهد واقعی باشید.
         پاسخ‌ها را کوتاه و مستقیم بدهید.`
      : `شما یک مشاور تحلیلی هستید که به ادمین کمک می‌کنید نتایج تحلیل را درک کند.
         بر اساس داده‌های موجود، توصیه‌های عملی ارائه دهید.`;

    const contextInfo = context ? `
شرکت: ${context.company || 'نامشخص'}
نتایج موتورها: ${context.engineResults ? JSON.stringify(context.engineResults) : 'هنوز تحلیل نشده'}
` : '';

    const prompt = `${systemPrompt}

${contextInfo}

سوال کاربر: ${question}

پاسخ کوتاه و مفید بدهید:`;

    const response = await fetch(
      geminiKey 
        ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
        : 'https://api.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(lovableKey && { 'Authorization': `Bearer ${apiKey}` })
        },
        body: JSON.stringify(
          geminiKey 
            ? {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
              }
            : {
                model: 'google/gemini-2.5-flash',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 500
              }
        )
      }
    );

    const data = await response.json();
    
    let responseText = '';
    if (geminiKey) {
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'پاسخی دریافت نشد';
    } else {
      responseText = data.choices?.[0]?.message?.content || 'پاسخی دریافت نشد';
    }

    return new Response(
      JSON.stringify({ success: true, response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Chat error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        response: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
