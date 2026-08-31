import { useEffect, useState, useCallback } from 'react';
import { History, FileSpreadsheet, Trash2, Loader2, Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Employee } from '@/types/employee';

export interface HrUpload {
  id: string;
  name: string;
  employee_count: number;
  is_demo: boolean;
  created_at: string;
}

export interface HrUploadRecord extends HrUpload {
  records: Employee[];
}

interface UploadHistorySheetProps {
  onLoad: (employees: Employee[], uploadId: string, name: string, isDemo: boolean) => void;
  currentUploadId?: string | null;
  trigger?: React.ReactNode;
  refreshKey?: number;
}

export function UploadHistorySheet({ onLoad, currentUploadId, trigger, refreshKey }: UploadHistorySheetProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HrUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await apiRequest<HrUpload[]>('/hr-data/uploads?limit=50'));
    } catch {
      toast({ title: 'خطا', description: 'بارگذاری تاریخچه ناموفق بود', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList, refreshKey]);

  const handleLoad = async (item: HrUpload) => {
    const { id, name } = item;
    setLoadingId(id);
    try {
      const upload = await apiRequest<HrUploadRecord>(`/hr-data/uploads/${id}`);
      onLoad(upload.records, upload.id, upload.name, upload.is_demo);
      setOpen(false);
      toast({ title: 'بارگذاری شد', description: 'اطلاعات قبلی بازیابی شد' });
    } catch {
      toast({ title: 'خطا', description: 'بارگذاری داده ناموفق بود', variant: 'destructive' });
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('این بارگذاری حذف شود؟')) return;
    try {
      await apiRequest<void>(`/hr-data/uploads/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
      toast({ title: 'حذف شد' });
    } catch {
      toast({ title: 'خطا', description: 'حذف ناموفق بود', variant: 'destructive' });
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <History className="w-4 h-4" />
            <span>تاریخچه بارگذاری‌ها</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col" dir="rtl">
        <SheetHeader className="text-right">
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            تاریخچه بارگذاری‌ها
          </SheetTitle>
          <SheetDescription>فایل‌های اکسلی که قبلاً بارگذاری کرده‌اید</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">هنوز هیچ فایلی بارگذاری نکرده‌اید</p>
            </div>
          ) : (
            <div className="space-y-2 pb-6">
              {items.map(item => {
                const isActive = item.id === currentUploadId;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleLoad(item)}
                    disabled={loadingId === item.id}
                    className={`w-full text-right rounded-xl border p-3 transition-all hover:border-primary/60 hover:bg-primary/5 ${
                      isActive ? 'border-primary bg-primary/10' : 'border-border bg-card/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <FileSpreadsheet className="w-4 h-4 text-primary mt-1 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{item.employee_count} رکورد</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {loadingId === item.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDelete(item.id, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
