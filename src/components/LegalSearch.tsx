import { useState } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2, Scale, ExternalLink, FileText, Sparkles } from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'همه دسته‌ها' },
  { value: 'labor_law', label: 'قانون کار' },
  { value: 'social_security', label: 'تامین اجتماعی' },
  { value: 'court_rulings', label: 'آرای دیوان' },
];

interface SearchResult {
  id: string;
  content: string;
  category: string;
  source_url: string;
  article_number: string | null;
  similarity: number;
}

const LegalSearch = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('لطفاً عبارت جستجو را وارد کنید');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('search-legal-docs', {
        body: { 
          query, 
          category: category || null,
          matchCount: 15,
          matchThreshold: 0.3
        }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results || []);
        if (data.results?.length === 0) {
          toast.info('نتیجه‌ای یافت نشد');
        } else {
          toast.success(`${data.results.length} نتیجه یافت شد`);
        }
      } else {
        toast.error(data.error || 'خطا در جستجو');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('خطا در جستجو');
    } finally {
      setIsSearching(false);
    }
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return 'bg-green-500';
    if (similarity >= 0.6) return 'bg-emerald-500';
    if (similarity >= 0.4) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  // Escape HTML to prevent XSS attacks
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const highlightQuery = (text: string, query: string) => {
    // First escape the content to prevent XSS
    const escapedText = escapeHtml(text);
    if (!query.trim()) return escapedText;

    const words = query.split(/\s+/).filter(w => w.length > 2);
    let highlighted = escapedText;
    words.forEach(word => {
      // Escape regex special characters in the search word
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedWord})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>');
    });
    // Final defense-in-depth sanitization
    return DOMPurify.sanitize(highlighted, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['class'],
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            جستجوی هوشمند قوانین
          </CardTitle>
          <CardDescription>
            با استفاده از هوش مصنوعی، قوانین مرتبط با سوال خود را پیدا کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="query" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                سوال یا عبارت جستجو
              </Label>
              <Input
                id="query"
                placeholder="مثال: حقوق مرخصی زایمان چقدر است؟"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isSearching}
                className="text-lg"
              />
            </div>

            <div className="w-48 space-y-2">
              <Label>دسته‌بندی</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSearching}>
                <SelectTrigger>
                  <SelectValue placeholder="همه دسته‌ها" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleSearch} 
            disabled={isSearching || !query.trim()}
            className="w-full"
            size="lg"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                در حال جستجو...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 ml-2" />
                جستجو
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              نتایج جستجو
              {results.length > 0 && (
                <Badge variant="secondary" className="mr-2">
                  {results.length} مورد
                </Badge>
              )}
            </h3>
          </div>

          {results.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>نتیجه‌ای برای جستجوی شما یافت نشد</p>
              <p className="text-sm mt-2">سعی کنید عبارت دیگری جستجو کنید یا دسته‌بندی را تغییر دهید</p>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pl-4">
                {results.map((result, index) => (
                  <Card key={result.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-normal">
                            {getCategoryLabel(result.category)}
                          </Badge>
                          {result.article_number && (
                            <Badge variant="secondary">
                              ماده {result.article_number}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div 
                              className={`w-2 h-2 rounded-full ${getSimilarityColor(result.similarity)}`} 
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(result.similarity * 100)}% مطابقت
                            </span>
                          </div>
                          <a
                            href={result.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p 
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightQuery(
                            result.content.length > 500 
                              ? result.content.slice(0, 500) + '...' 
                              : result.content,
                            query
                          )
                        }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};

export default LegalSearch;
