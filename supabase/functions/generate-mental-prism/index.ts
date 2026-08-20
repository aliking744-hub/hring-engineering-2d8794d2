import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Check if this is a free-form analysis request or question generation
    if (body.prompt) {
      // Free-form AI analysis (for CEO Dashboard)
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'شما یک تحلیلگر استراتژیک هوشمند سازمانی هستید. پاسخ‌های خود را به فارسی و به صورت مختصر، کاربردی و ساختارمند ارائه دهید.' },
            { role: 'user', content: body.prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه صبر کنید.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'اعتبار کافی نیست. لطفاً اعتبار خود را شارژ کنید.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      return new Response(JSON.stringify({ analysis: content || 'تحلیل انجام شد.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Original question generation logic
    const { intentTitle, intentDescription, strategicWeight, toleranceZone } = body;

    const systemPrompt = `شما یک دستیار هوشمند برای طراحی تست‌های قضاوت موقعیتی (Situational Judgment Test) هستید.
بر اساس دستور استراتژیک داده شده، سه سوال موقعیتی طراحی کنید که میزان درک و همسویی معاونین با ذهنیت مدیرعامل را بسنجد.

قوانین:
1. هر سوال باید یک موقعیت فرضی واقع‌گرایانه باشد
2. هر سوال دقیقاً سه گزینه داشته باشد
3. گزینه‌ها باید متمایز و منطقی باشند
4. سوالات باید مستقیماً به دستور استراتژیک مرتبط باشند
5. پاسخ را فقط به صورت JSON بدهید

فرمت خروجی (فقط JSON):
{
  "questions": [
    {
      "question": "متن سوال موقعیتی",
      "option_a": "گزینه اول",
      "option_b": "گزینه دوم", 
      "option_c": "گزینه سوم"
    }
  ]
}`;

    const userPrompt = `دستور استراتژیک:
عنوان: ${intentTitle}
شرح: ${intentDescription}
وزن استراتژیک: ${strategicWeight}/10 (هرچه بالاتر، اهمیت بیشتر)
حد تحمل انحراف: ${toleranceZone}/10 (هرچه پایین‌تر، نیاز به اجرای دقیق‌تر)

لطفاً سه سوال موقعیتی برای سنجش درک معاونین از این دستور طراحی کنید.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه صبر کنید.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'اعتبار کافی نیست. لطفاً اعتبار خود را شارژ کنید.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonContent = content;
    if (content.includes('```json')) {
      jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      jsonContent = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonContent.trim());

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-mental-prism:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'خطای ناشناخته' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
