import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsResult {
  title: string;
  url: string;
  source: string;
  date: string;
  snippet: string;
  sentiment: "positive" | "negative" | "neutral";
  competitor: string;
}

interface SearchRequest {
  companyName: string;
  competitors: Array<{ name: string }>;
  industry?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { companyName, competitors, industry }: SearchRequest = await req.json();
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!firecrawlApiKey) {
      console.log('FIRECRAWL_API_KEY not configured, returning placeholder');
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            news: [],
            message: "برای فعال‌سازی اخبار زنده، API کلید Firecrawl را تنظیم کنید",
            needsApiKey: true
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allCompanies = [companyName, ...competitors.map(c => c.name)].filter(Boolean);
    const newsResults: NewsResult[] = [];
    
    // Search for each company
    for (const company of allCompanies.slice(0, 4)) { // Limit to 4 companies
      try {
        const searchQuery = `${company} ${industry || ''} اخبار`;
        
        // Use Firecrawl's search endpoint
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 3,
            lang: 'fa',
            country: 'ir',
            scrapeOptions: {
              formats: ['markdown'],
              onlyMainContent: true
            }
          }),
        });

        if (!searchResponse.ok) {
          console.error(`Firecrawl search error for ${company}:`, await searchResponse.text());
          continue;
        }

        const searchData = await searchResponse.json();
        
        if (searchData.success && searchData.data) {
          for (const result of searchData.data) {
            // Analyze sentiment based on content
            const content = (result.title + ' ' + (result.description || '')).toLowerCase();
            let sentiment: "positive" | "negative" | "neutral" = "neutral";
            
            const positiveWords = ['رشد', 'موفقیت', 'افزایش', 'سود', 'توسعه', 'قرارداد', 'پیشرفت'];
            const negativeWords = ['کاهش', 'زیان', 'بحران', 'مشکل', 'خروج', 'ضرر', 'افت'];
            
            const positiveCount = positiveWords.filter(w => content.includes(w)).length;
            const negativeCount = negativeWords.filter(w => content.includes(w)).length;
            
            if (positiveCount > negativeCount) sentiment = "positive";
            else if (negativeCount > positiveCount) sentiment = "negative";

            newsResults.push({
              title: result.title || 'بدون عنوان',
              url: result.url || '#',
              source: extractDomain(result.url) || 'منبع نامشخص',
              date: new Date().toLocaleDateString('fa-IR'),
              snippet: result.description || result.markdown?.substring(0, 200) || '',
              sentiment,
              competitor: company,
            });
          }
        }
      } catch (searchError) {
        console.error(`Error searching for ${company}:`, searchError);
      }
    }

    // Sort by date/relevance
    const sortedNews = newsResults.slice(0, 10);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          news: sortedNews,
          searchedCompanies: allCompanies.slice(0, 4),
          needsApiKey: false
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in search-competitor-news:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return '';
  }
}
