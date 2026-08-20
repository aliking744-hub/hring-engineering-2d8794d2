import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { sourceUrl, category } = await req.json();

    if (!sourceUrl || !category) {
      return new Response(
        JSON.stringify({ error: 'sourceUrl and category are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const logs: string[] = [];
    const addLog = (message: string) => {
      console.log(message);
      logs.push(`[${new Date().toLocaleTimeString('fa-IR')}] ${message}`);
    };

    addLog(`در حال دریافت URL: ${sourceUrl}`);

    // Fetch HTML content
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`خطا در دریافت صفحه: ${response.status}`);
    }

    // Get response as array buffer and decode as UTF-8 for Persian text
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const html = decoder.decode(buffer);

    addLog('صفحه با موفقیت دریافت شد');

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('nav, header, footer, aside, .sidebar, .navigation, .menu, .footer, .header, script, style, noscript, iframe').remove();

    // Extract main content - try common content selectors
    let mainContent = '';
    const contentSelectors = [
      'article',
      '.content',
      '.main-content',
      '#content',
      '#main',
      '.post-content',
      '.article-content',
      '.entry-content',
      'main',
      '.container .row',
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > mainContent.length) {
          mainContent = text;
        }
      }
    }

    // Clean up whitespace
    mainContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    addLog(`متن استخراج شد (${mainContent.length} کاراکتر)`);

    // Smart chunking by "ماده" (Article)
    const articlePattern = /ماده\s*[۰-۹0-9]+/g;
    const chunks: { content: string; articleNumber: string | null }[] = [];

    // Find all article positions
    const matches = [...mainContent.matchAll(articlePattern)];
    
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index!;
        const end = i < matches.length - 1 ? matches[i + 1].index! : mainContent.length;
        const chunkContent = mainContent.slice(start, end).trim();
        
        // Extract article number
        const articleMatch = matches[i][0];
        const numberMatch = articleMatch.match(/[۰-۹0-9]+/);
        const articleNumber = numberMatch ? numberMatch[0] : null;

        if (chunkContent.length > 10) { // Only include chunks with meaningful content
          chunks.push({
            content: chunkContent,
            articleNumber
          });
        }
      }
    } else {
      // If no articles found, split by paragraphs or use whole content
      const paragraphs = mainContent.split(/\n+/).filter(p => p.trim().length > 50);
      if (paragraphs.length > 0) {
        paragraphs.forEach((p, idx) => {
          chunks.push({
            content: p.trim(),
            articleNumber: null
          });
        });
      } else {
        chunks.push({
          content: mainContent,
          articleNumber: null
        });
      }
    }

    addLog(`تعداد ${chunks.length} ماده یافت شد`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate embeddings and save to database
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    let savedCount = 0;

    for (const chunk of chunks) {
      try {
        // Generate embedding using Gemini
        let embedding = null;
        
        if (geminiApiKey) {
          const embeddingResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                  parts: [{ text: chunk.content.slice(0, 2000) }] // Limit text length for embedding
                }
              }),
            }
          );

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            embedding = embeddingData.embedding?.values || null;
          }
        }

        // Insert into database
        const { error } = await supabase
          .from('legal_docs')
          .insert({
            content: chunk.content,
            category,
            source_url: sourceUrl,
            article_number: chunk.articleNumber,
            embedding
          });

        if (error) {
          console.error('Error inserting chunk:', error);
        } else {
          savedCount++;
        }
      } catch (e) {
        console.error('Error processing chunk:', e);
      }
    }

    addLog(`تعداد ${savedCount} رکورد در دیتابیس ذخیره شد`);

    return new Response(
      JSON.stringify({
        success: true,
        logs,
        stats: {
          totalChunks: chunks.length,
          savedCount,
          contentLength: mainContent.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-legal-docs:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'خطای ناشناخته',
        logs: [`خطا: ${error instanceof Error ? error.message : 'خطای ناشناخته'}`]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
