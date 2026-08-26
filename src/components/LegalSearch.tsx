import { useState } from 'react';
import DOMPurify from 'dompurify';
import { ExternalLink, FileText, Loader2, Scale, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/api';

const ALL_CATEGORIES = 'all';
const CATEGORIES = [
  { value: ALL_CATEGORIES, label: 'همه دسته‌ها' },
  { value: 'labor_law', label: 'قانون کار' },
  { value: 'social_security', label: 'تأمین اجتماعی' },
  { value: 'court_rulings', label: 'آرای دیوان' },
  { value: 'other', label: 'سایر منابع' },
];

interface SearchResult {
  id: string;
  source_id: string;
  title: string;
  content: string;
  category: string;
  source_url: string | null;
  article_number: string | null;
  similarity: number;
  source_version: number;
  published_at: string | null;
}

const LegalSearch = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      toast.error('لطفاً عبارت جستجو را وارد کنید');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await apiRequest<SearchResult[]>('/legal/search', {
        method: 'POST',
        body: JSON.stringify({
          query: normalizedQuery,
          category: category === ALL_CATEGORIES ? null : category,
          match_count: 15,
          match_threshold: 0.12,
        }),
      });
      setResults(data);
      if (data.length === 0) {
        toast.info('برای این عبارت سند معتبر و مرتبطی پیدا نشد');
      } else {
        toast.success(`${data.length.toLocaleString('fa-IR')} نتیجه مستند یافت شد`);
      }
    } catch (error) {
      console.error('Legal search failed:', error);
      toast.error(error instanceof Error ? error.message : 'خطا در جستجوی قوانین');
    } finally {
      setIsSearching(false);
    }
  };

  const categoryLabel = (value: string) => (
    CATEGORIES.find((item) => item.value === value)?.label || value
  );

  const similarityColor = (similarity: number) => {
    if (similarity >= 0.8) return 'bg-green-500';
    if (similarity >= 0.6) return 'bg-emerald-500';
    if (similarity >= 0.4) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const highlightQuery = (text: string) => {
    const holder = document.createElement('div');
    holder.textContent = text;
    let highlighted = holder.innerHTML;
    query.split(/\s+/).filter((word) => word.length > 2).forEach((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      highlighted = highlighted.replace(
        new RegExp(`(${escapedWord})`, 'gi'),
        '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>',
      );
    });
    return DOMPurify.sanitize(highlighted, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['class'],
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            جستجوی مستند قوانین
          </CardTitle>
          <CardDescription>
            پاسخ‌ها فقط از منابع ثبت‌شده و دارای ارجاع دقیق نمایش داده می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="query" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                سؤال یا عبارت جستجو
              </Label>
              <Input
                id="query"
                placeholder="مثال: مرخصی زایمان در قانون کار"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleSearch();
                }}
                disabled={isSearching}
                className="text-base"
              />
            </div>
            <div className="space-y-2 md:w-52">
              <Label>دسته‌بندی</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSearching}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => void handleSearch()}
            disabled={isSearching || query.trim().length < 2}
            className="w-full"
            size="lg"
          >
            {isSearching ? (
              <><Loader2 className="ml-2 h-5 w-5 animate-spin" />در حال جستجو...</>
            ) : (
              <><Search className="ml-2 h-5 w-5" />جستجو</>
            )}
          </Button>
        </CardContent>
      </Card>

      {hasSearched && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            نتایج جستجو
            {results.length > 0 && (
              <Badge variant="secondary" className="mr-2">
                {results.length.toLocaleString('fa-IR')} مورد
              </Badge>
            )}
          </h3>
          {results.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>سند مرتبطی پیدا نشد؛ نتیجه حدسی نمایش داده نمی‌شود.</p>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pl-4">
                {results.map((result, index) => (
                  <Card key={result.id} className="overflow-hidden transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-base">{result.title}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{categoryLabel(result.category)}</Badge>
                            {result.article_number && (
                              <Badge variant="secondary">ماده {result.article_number}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              نسخه {result.source_version.toLocaleString('fa-IR')} · #{(index + 1).toLocaleString('fa-IR')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className={`h-2 w-2 rounded-full ${similarityColor(result.similarity)}`} />
                            {Math.round(result.similarity * 100).toLocaleString('fa-IR')}٪ تطابق
                          </span>
                          {result.source_url && (
                            <a
                              href={result.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                              aria-label={`مشاهده منبع ${result.title}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p
                        className="whitespace-pre-wrap text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: highlightQuery(
                            result.content.length > 900
                              ? `${result.content.slice(0, 900)}...`
                              : result.content,
                          ),
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
