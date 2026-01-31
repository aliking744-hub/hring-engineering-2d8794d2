const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, country = 'ir' } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!firecrawlKey) {
      // Return mock data if no API key
      const mockCompanies = [
        {
          id: crypto.randomUUID(),
          name: 'نوآوران فین‌تک',
          url: 'https://example-fintech.ir',
          description: 'پلتفرم پرداخت نوین با رشد ۲۰۰٪ سالانه',
          industry: query.includes('فین') ? 'فین‌تک' : query,
          growthSignals: ['رشد کاربری بالا', 'جذب سرمایه اخیر', 'تیم قوی'],
          fundingStage: 'Series A',
          source: 'Demo Data'
        },
        {
          id: crypto.randomUUID(),
          name: 'سلامت دیجیتال',
          url: 'https://example-health.ir',
          description: 'اپلیکیشن مدیریت سلامت با ۵۰۰ هزار کاربر',
          industry: 'هلث‌تک',
          growthSignals: ['رشد ارگانیک', 'NPS بالا'],
          fundingStage: 'Seed',
          source: 'Demo Data'
        },
        {
          id: crypto.randomUUID(),
          name: 'یادگیری هوشمند',
          url: 'https://example-edu.ir',
          description: 'پلتفرم آموزش آنلاین با AI',
          industry: 'ادتک',
          growthSignals: ['محتوای منحصربفرد', 'تیم فنی قوی'],
          fundingStage: 'Pre-Seed',
          source: 'Demo Data'
        },
      ];

      return new Response(
        JSON.stringify({ success: true, companies: mockCompanies }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Firecrawl search API
    const searchQuery = `استارتاپ ${query} ایران جذب سرمایه رشد`;
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
        lang: 'fa',
        country: country,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', data);
      throw new Error(data.error || 'Search failed');
    }

    // Transform results to company format
    const companies = (data.data || []).map((result: any) => ({
      id: crypto.randomUUID(),
      name: extractCompanyName(result.title || ''),
      url: result.url || '',
      description: result.description || result.markdown?.slice(0, 200) || '',
      industry: query,
      growthSignals: extractGrowthSignals(result.markdown || result.description || ''),
      source: new URL(result.url || 'https://example.com').hostname,
    })).filter((c: any) => c.name);

    return new Response(
      JSON.stringify({ success: true, companies }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Web radar error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractCompanyName(title: string): string {
  // Simple extraction - get first meaningful part
  const cleaned = title
    .replace(/[-–|]/g, ' ')
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 3)
    .join(' ');
  return cleaned || title.slice(0, 30);
}

function extractGrowthSignals(content: string): string[] {
  const signals: string[] = [];
  const keywords = {
    'جذب سرمایه': 'جذب سرمایه اخیر',
    'رشد': 'رشد سریع',
    'کاربر': 'پایگاه کاربری قوی',
    'صادرات': 'پتانسیل صادرات',
    'نوآوری': 'نوآوری فنی',
    'تیم': 'تیم با تجربه',
  };
  
  for (const [keyword, signal] of Object.entries(keywords)) {
    if (content.includes(keyword) && signals.length < 3) {
      signals.push(signal);
    }
  }
  
  return signals.length > 0 ? signals : ['در حال بررسی'];
}
