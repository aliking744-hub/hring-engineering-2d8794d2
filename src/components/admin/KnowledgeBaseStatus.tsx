import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';

interface CategoryStats {
  category: string;
  sources: number;
  chunks: number;
}

interface KnowledgeStats {
  active_sources: number;
  indexed_chunks: number;
  pending_sources: number;
  categories: CategoryStats[];
  embedding_model: string;
}

interface LegalSource {
  id: string;
  checksum: string;
  title: string;
  category: string;
  source_url: string | null;
  source_type: string;
  version: number;
  status: string;
  index_status: string;
  chunk_count: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  labor_law: 'قانون کار',
  social_security: 'تأمین اجتماعی',
  court_rulings: 'آرای دیوان',
  other: 'سایر منابع',
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'آماده',
  pending: 'نیازمند ایندکس',
  failed: 'ناموفق',
};

const KnowledgeBaseStatus = () => {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [sources, setSources] = useState<LegalSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const fetchKnowledgeBase = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      const [nextStats, nextSources] = await Promise.all([
        apiRequest<KnowledgeStats>('/legal/admin/stats'),
        apiRequest<LegalSource[]>('/legal/admin/sources?limit=100'),
      ]);
      setStats(nextStats);
      setSources(nextSources);
    } catch (loadError) {
      console.error('Knowledge-base status failed:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'دریافت وضعیت پایگاه دانش ناموفق بود');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKnowledgeBase();
    const refresh = () => void fetchKnowledgeBase(true);
    window.addEventListener('hring:legal-kb-changed', refresh);
    return () => window.removeEventListener('hring:legal-kb-changed', refresh);
  }, [fetchKnowledgeBase]);

  const reindex = async (source: LegalSource) => {
    setActiveAction(source.id);
    try {
      await apiRequest(`/legal/admin/sources/${source.id}/reindex`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success(`«${source.title}» دوباره ایندکس شد`);
      await fetchKnowledgeBase(true);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'ایندکس مجدد ناموفق بود');
    } finally {
      setActiveAction(null);
    }
  };

  const remove = async (source: LegalSource) => {
    if (!window.confirm(`منبع «${source.title}» و همه بردارهای آن حذف شوند؟`)) return;
    setActiveAction(source.id);
    try {
      await apiRequest(`/legal/admin/sources/${source.id}`, { method: 'DELETE' });
      toast.success('منبع و بردارهای آن حذف شد');
      await fetchKnowledgeBase(true);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'حذف منبع ناموفق بود');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            وضعیت پایگاه دانش حقوقی
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => void fetchKnowledgeBase()} disabled={isLoading}>
            <RefreshCw className={`ml-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            تازه‌سازی
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : stats ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />منابع فعال
                </div>
                <div className="mt-2 text-3xl font-bold text-primary">{stats.active_sources.toLocaleString('fa-IR')}</div>
              </div>
              <div className="rounded-xl border bg-secondary/40 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />بخش‌های ایندکس‌شده
                </div>
                <div className="mt-2 text-3xl font-bold">{stats.indexed_chunks.toLocaleString('fa-IR')}</div>
              </div>
              <div className="rounded-xl border bg-secondary/40 p-4">
                <div className="text-sm text-muted-foreground">نیازمند ایندکس مجدد</div>
                <div className="mt-2 text-3xl font-bold text-amber-500">{stats.pending_sources.toLocaleString('fa-IR')}</div>
              </div>
            </div>

            {stats.categories.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.categories.map((item) => (
                  <div key={item.category} className="rounded-lg border bg-secondary/30 p-3">
                    <div className="text-sm text-muted-foreground">{CATEGORY_LABELS[item.category] || item.category}</div>
                    <div className="mt-2 font-semibold">
                      {item.sources.toLocaleString('fa-IR')} منبع · {item.chunks.toLocaleString('fa-IR')} بخش
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border">
              <div className="flex flex-col gap-1 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-semibold">فهرست منابع و نسخه‌ها</div>
                <div className="text-xs text-muted-foreground">مدل: {stats.embedding_model}</div>
              </div>
              {sources.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  هنوز منبعی وارد نشده است.
                </p>
              ) : (
                <div className="divide-y">
                  {sources.map((source) => (
                    <div key={source.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{source.title}</span>
                          <Badge variant={source.index_status === 'ready' ? 'secondary' : 'outline'}>
                            {STATUS_LABELS[source.index_status] || source.index_status}
                          </Badge>
                          <Badge variant="outline">نسخه {source.version.toLocaleString('fa-IR')}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{CATEGORY_LABELS[source.category] || source.category}</span>
                          <span>{source.chunk_count.toLocaleString('fa-IR')} بخش</span>
                          <span dir="ltr">SHA-256: {source.checksum.slice(0, 12)}…</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activeAction === source.id}
                          onClick={() => void reindex(source)}
                        >
                          {activeAction === source.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RotateCw className="ml-2 h-4 w-4" />}
                          ایندکس مجدد
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={activeAction === source.id}
                          onClick={() => void remove(source)}
                        >
                          <Trash2 className="ml-2 h-4 w-4" />حذف
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default KnowledgeBaseStatus;
