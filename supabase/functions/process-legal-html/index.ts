import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple HTML parser to extract text content
function parseHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  
  // Replace common block elements with newlines
  text = text.replace(/<\/?(div|p|br|li|tr|h[1-6])[^>]*>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

// Smart chunking - split by "ماده" (Article) in Persian
function smartChunk(content: string): { chunks: string[]; articleNumbers: string[] } {
  const chunks: string[] = [];
  const articleNumbers: string[] = [];
  
  // Match "ماده" followed by Persian/Arabic numbers
  const articlePattern = /(?=ماده\s+[\u06F0-\u06F9۰-۹0-9]+)/g;
  const parts = content.split(articlePattern);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length < 20) continue;
    
    // Extract article number
    const numberMatch = trimmed.match(/^ماده\s+([\u06F0-\u06F9۰-۹0-9]+)/);
    const articleNumber = numberMatch ? numberMatch[1] : null;
    
    if (articleNumber) {
      chunks.push(trimmed);
      articleNumbers.push(articleNumber);
    } else if (chunks.length === 0 && trimmed.length > 50) {
      // Preamble or intro text
      chunks.push(trimmed);
      articleNumbers.push('مقدمه');
    }
  }
  
  // If no articles found, chunk by paragraphs
  if (chunks.length === 0) {
    const paragraphs = content.split(/\n{2,}/);
    let currentChunk = '';
    let chunkIndex = 1;
    
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      
      if (currentChunk.length + trimmed.length > 2000) {
        if (currentChunk) {
          chunks.push(currentChunk);
          articleNumbers.push(`بخش ${chunkIndex}`);
          chunkIndex++;
        }
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
      articleNumbers.push(`بخش ${chunkIndex}`);
    }
  }
  
  return { chunks, articleNumbers };
}

// Generate embedding using Gemini
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] }
        })
      }
    );
    
    if (!response.ok) {
      console.error('Embedding error:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  
  const logs: string[] = [];
  
  try {
    const { htmlContent, sourceUrl, category } = await req.json();
    
    if (!htmlContent || !sourceUrl || !category) {
      return new Response(
        JSON.stringify({ success: false, error: 'محتوای HTML، URL و دسته‌بندی الزامی است', logs: ['خطا: پارامترهای ورودی ناقص'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logs.push(`دریافت HTML با طول ${htmlContent.length.toLocaleString('fa-IR')} کاراکتر`);
    logs.push(`URL منبع: ${sourceUrl}`);
    logs.push(`دسته‌بندی: ${category}`);
    
    // Parse HTML to text
    logs.push('در حال استخراج متن از HTML...');
    const textContent = parseHTML(htmlContent);
    logs.push(`متن استخراج شده: ${textContent.length.toLocaleString('fa-IR')} کاراکتر`);
    
    if (textContent.length < 100) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'محتوای متنی کافی یافت نشد', 
          logs: [...logs, 'خطا: محتوای متنی کافی یافت نشد'] 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Chunk the content
    logs.push('در حال تقسیم محتوا به مواد...');
    const { chunks, articleNumbers } = smartChunk(textContent);
    logs.push(`تعداد ${chunks.length} بخش/ماده یافت شد`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get Gemini API key for embeddings
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    
    let savedCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const articleNumber = articleNumbers[i];
      
      logs.push(`پردازش ${articleNumber}...`);
      
      // Generate embedding if API key available
      let embedding: number[] | null = null;
      if (geminiKey) {
        embedding = await generateEmbedding(chunk, geminiKey);
        if (embedding) {
          logs.push(`Embedding تولید شد برای ${articleNumber}`);
        }
      }
      
      // Save to database
      const { error: insertError } = await supabase
        .from('legal_docs')
        .insert({
          content: chunk,
          category,
          source_url: sourceUrl,
          article_number: articleNumber,
          embedding: embedding ? JSON.stringify(embedding) : null
        });
      
      if (insertError) {
        logs.push(`خطا در ذخیره ${articleNumber}: ${insertError.message}`);
      } else {
        savedCount++;
        logs.push(`${articleNumber} ذخیره شد ✓`);
      }
    }
    
    logs.push(`پردازش کامل شد: ${savedCount} از ${chunks.length} بخش ذخیره شد`);
    
    return new Response(
      JSON.stringify({
        success: true,
        logs,
        stats: {
          totalChunks: chunks.length,
          savedCount,
          contentLength: textContent.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
    logs.push(`خطا: ${errorMessage}`);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
