import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    const sourceUrl = formData.get('sourceUrl') as string || 'uploaded-file';

    if (!file || !category) {
      return new Response(
        JSON.stringify({ error: 'فایل و دسته‌بندی الزامی است', logs }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`📁 فایل دریافت شد: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    log(`📂 دسته‌بندی: ${category}`);

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert to base64 using proper encoding (handles large files)
    const base64 = base64Encode(arrayBuffer);
    
    log('🤖 ارسال به هوش مصنوعی برای استخراج متن...');

    // Determine MIME type
    const mimeType = file.type || 'application/octet-stream';
    
    // Use Lovable AI to extract text from document
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `شما یک سیستم استخراج متن از اسناد حقوقی هستید. متن را به صورت کامل و دقیق استخراج کنید.
هر ماده قانونی را با عبارت "ماده X:" شروع کنید.
تبصره‌ها را با "تبصره:" یا "تبصره X:" مشخص کنید.
فقط متن اصلی سند را برگردانید، بدون توضیحات اضافی.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'لطفاً متن کامل این سند حقوقی را استخراج کنید. تمام مواد و تبصره‌ها را به ترتیب بنویسید:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      log(`❌ خطای AI: ${aiResponse.status}`);
      throw new Error(`AI error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '';

    if (!extractedText) {
      throw new Error('متنی از سند استخراج نشد');
    }

    log(`✅ متن استخراج شد: ${extractedText.length} کاراکتر`);

    // Split into articles
    const articleRegex = /ماده\s*(\d+|[۰-۹]+)\s*[-:–]/g;
    const chunks: { articleNumber: string; content: string }[] = [];
    
    let lastIndex = 0;
    let lastArticle = '';
    let match;
    
    const matches = [...extractedText.matchAll(articleRegex)];
    
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        match = matches[i];
        if (i > 0) {
          chunks.push({
            articleNumber: lastArticle,
            content: extractedText.slice(lastIndex, match.index).trim()
          });
        }
        lastIndex = match.index!;
        lastArticle = match[1];
      }
      // Add last chunk
      if (lastArticle) {
        chunks.push({
          articleNumber: lastArticle,
          content: extractedText.slice(lastIndex).trim()
        });
      }
    } else {
      // No articles found, save as single document
      chunks.push({
        articleNumber: '',
        content: extractedText.trim()
      });
    }

    log(`📊 ${chunks.length} بخش شناسایی شد`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embeddings and save
    let savedCount = 0;
    
    for (const chunk of chunks) {
      try {
        // Generate embedding
        const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: chunk.content.slice(0, 8000),
            model: 'text-embedding-3-small',
          }),
        });

        let embedding = null;
        if (embeddingResponse.ok) {
          const embData = await embeddingResponse.json();
          embedding = embData.data?.[0]?.embedding;
        }

        // Save to database
        const { error: insertError } = await supabase
          .from('legal_docs')
          .insert({
            content: chunk.content,
            category,
            source_url: `${sourceUrl}#${file.name}`,
            article_number: chunk.articleNumber || null,
            embedding: embedding ? JSON.stringify(embedding) : null,
          });

        if (insertError) {
          log(`⚠️ خطا در ذخیره: ${insertError.message}`);
        } else {
          savedCount++;
          if (chunk.articleNumber) {
            log(`✅ ماده ${chunk.articleNumber} ذخیره شد`);
          }
        }
      } catch (e) {
        log(`⚠️ خطا: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }

    log(`🎉 پردازش کامل شد: ${savedCount} بخش ذخیره شد`);

    return new Response(
      JSON.stringify({
        success: true,
        logs,
        stats: {
          totalChunks: chunks.length,
          savedCount,
          contentLength: extractedText.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
    log(`❌ خطا: ${errorMessage}`);
    
    return new Response(
      JSON.stringify({ error: errorMessage, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
