import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ClipboardPaste,
  Database,
  FileText,
  Globe,
  Loader2,
  ScanText,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';

const CATEGORIES = [
  { value: 'labor_law', label: 'قانون کار' },
  { value: 'social_security', label: 'تأمین اجتماعی' },
  { value: 'court_rulings', label: 'آرای دیوان' },
  { value: 'other', label: 'سایر منابع' },
];

interface LegalSource {
  id: string;
  title: string;
  version: number;
  chunk_count: number;
  checksum: string;
}

interface LegalImportResponse {
  success: boolean;
  duplicate: boolean;
  ocr_used: boolean;
  source: LegalSource;
  logs: string[];
}

const LegalImporter = () => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastImport, setLastImport] = useState<LegalImportResponse | null>(null);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const finishImport = (result: LegalImportResponse) => {
    setLogs(result.logs);
    setLastImport(result);
    window.dispatchEvent(new CustomEvent('hring:legal-kb-changed'));
    if (result.duplicate) {
      toast.info('این سند قبلاً ثبت شده بود؛ رکورد تکراری ساخته نشد');
    } else {
      toast.success(`${result.source.chunk_count.toLocaleString('fa-IR')} بخش ایندکس شد`);
    }
  };

  const runImport = async (
    operation: () => Promise<LegalImportResponse>,
    start: string,
  ): Promise<boolean> => {
    setIsProcessing(true);
    setLogs([start]);
    setLastImport(null);
    try {
      finishImport(await operation());
      return true;
    } catch (error) {
      console.error('Legal import failed:', error);
      const message = error instanceof Error ? error.message : 'خطای ناشناخته';
      setLogs((current) => [...current, `خطا: ${message}`]);
      toast.error(message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDocumentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const allowed = ['.pdf', '.docx', '.txt', '.rtf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'];
    if (!allowed.includes(extension)) {
      toast.error('فرمت فایل پشتیبانی نمی‌شود');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حداکثر حجم فایل ۱۰ مگابایت است');
      event.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleHtmlFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.html?$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      toast.error('فقط فایل HTML تا حجم ۱۰ مگابایت مجاز است');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHtmlContent(String(reader.result || ''));
      if (!title.trim()) setTitle(file.name.replace(/\.html?$/i, ''));
    };
    reader.onerror = () => toast.error('خواندن فایل HTML ناموفق بود');
    reader.readAsText(file, 'UTF-8');
  };

  const importDocument = () => {
    if (!selectedFile || !title.trim() || !category) {
      toast.error('عنوان، دسته‌بندی و فایل را کامل کنید');
      return;
    }
    const body = new FormData();
    body.append('file', selectedFile);
    body.append('title', title.trim());
    body.append('category', category);
    if (sourceUrl.trim()) body.append('source_url', sourceUrl.trim());
    void (async () => {
      const succeeded = await runImport(
        () => apiRequest<LegalImportResponse>('/legal/admin/sources/upload', {
          method: 'POST',
          body,
        }),
        'استخراج امن متن و ساخت embedding محلی آغاز شد...',
      );
      if (succeeded) {
        setSelectedFile(null);
        if (documentInputRef.current) documentInputRef.current.value = '';
      }
    })();
  };

  const importHtml = () => {
    if (!title.trim() || !category || htmlContent.trim().length < 20) {
      toast.error('عنوان، دسته‌بندی و محتوای HTML را کامل کنید');
      return;
    }
    void (async () => {
      const succeeded = await runImport(
        () => apiRequest<LegalImportResponse>('/legal/admin/sources/html', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            category,
            source_url: sourceUrl.trim() || null,
            html_content: htmlContent,
          }),
        }),
        'پاک‌سازی HTML و ایندکس منبع آغاز شد...',
      );
      if (succeeded) setHtmlContent('');
    })();
  };

  const importUrl = () => {
    if (!title.trim() || !category || !sourceUrl.trim()) {
      toast.error('عنوان، دسته‌بندی و URL را کامل کنید');
      return;
    }
    void runImport(
      () => apiRequest<LegalImportResponse>('/legal/admin/sources/url', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category,
          source_url: sourceUrl.trim(),
        }),
      }),
      'اعتبارسنجی URL عمومی و دریافت منبع آغاز شد...',
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            وارد کردن اسناد حقوقی
          </CardTitle>
          <CardDescription>
            فایل، HTML یا URL را با metadata منبع ثبت و بدون وابستگی به سرویس خارجی ایندکس کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalTitle">عنوان منبع</Label>
              <Input
                id="legalTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثال: قانون کار جمهوری اسلامی ایران"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                دسته‌بندی
              </Label>
              <Select value={category} onValueChange={setCategory} disabled={isProcessing}>
                <SelectTrigger><SelectValue placeholder="انتخاب دسته‌بندی..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="document" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="document" className="gap-2">
                <Upload className="h-4 w-4" />آپلود فایل
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <ClipboardPaste className="h-4 w-4" />ورود HTML
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-2">
                <Globe className="h-4 w-4" />دریافت URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="document" className="mt-4 space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                PDF، DOCX، TXT، RTF و تصاویر اسکن‌شده؛ حداکثر ۱۰ مگابایت. OCR فارسی داخل سرور انجام می‌شود.
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentSourceUrl">URL مرجع (اختیاری)</Label>
                <Input
                  id="documentSourceUrl"
                  type="url"
                  dir="ltr"
                  className="text-left"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://example.com/law.pdf"
                  disabled={isProcessing}
                />
              </div>
              <div className="rounded-lg border-2 border-dashed p-7 text-center">
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.rtf,.png,.jpg,.jpeg,.webp,.tif,.tiff"
                  onChange={handleDocumentSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="ml-2 h-4 w-4" />انتخاب فایل
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">
                  {selectedFile
                    ? `${selectedFile.name} — ${(selectedFile.size / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} KB`
                    : 'هنوز فایلی انتخاب نشده است'}
                </p>
              </div>
              <Button className="w-full" onClick={importDocument} disabled={isProcessing || !selectedFile}>
                {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ScanText className="ml-2 h-4 w-4" />}
                استخراج، OCR و ایندکس
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manualSourceUrl">URL مرجع (اختیاری)</Label>
                <Input
                  id="manualSourceUrl"
                  type="url"
                  dir="ltr"
                  className="text-left"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://qavanin.ir/..."
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="htmlContent">محتوای HTML</Label>
                  <input
                    ref={htmlFileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={handleHtmlFile}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => htmlFileInputRef.current?.click()}>
                    <Upload className="ml-2 h-4 w-4" />فایل HTML
                  </Button>
                </div>
                <Textarea
                  id="htmlContent"
                  dir="ltr"
                  className="min-h-[220px] text-left font-mono text-xs"
                  value={htmlContent}
                  onChange={(event) => setHtmlContent(event.target.value)}
                  placeholder="HTML را اینجا جای‌گذاری کنید..."
                  disabled={isProcessing}
                />
              </div>
              <Button className="w-full" onClick={importHtml} disabled={isProcessing || htmlContent.trim().length < 20}>
                {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
                پاک‌سازی و ایندکس HTML
              </Button>
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                فقط URL عمومی HTTP/HTTPS پذیرفته می‌شود؛ مسیرهای داخلی، redirect و فایل بیش از ۱۰ مگابایت مسدودند.
              </div>
              <div className="space-y-2">
                <Label htmlFor="remoteSourceUrl">URL منبع</Label>
                <Input
                  id="remoteSourceUrl"
                  type="url"
                  dir="ltr"
                  className="text-left"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://rc.majlis.ir/fa/law/..."
                  disabled={isProcessing}
                />
              </div>
              <Button className="w-full" onClick={importUrl} disabled={isProcessing || !sourceUrl.trim()}>
                {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Globe className="ml-2 h-4 w-4" />}
                دریافت امن و ایندکس URL
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">گزارش پردازش</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[190px] rounded-md border bg-muted/30 p-4">
              <div className="space-y-2 text-sm">
                {logs.map((log, index) => (
                  <div key={`${index}-${log}`} className="flex items-start gap-2">
                    {log.includes('خطا')
                      ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      : <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />}
                    <span className={log.includes('خطا') ? 'text-destructive' : ''}>{log}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {lastImport && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{lastImport.source.chunk_count.toLocaleString('fa-IR')}</div>
                  <div className="text-xs text-muted-foreground">بخش یکتا</div>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{lastImport.source.version.toLocaleString('fa-IR')}</div>
                  <div className="text-xs text-muted-foreground">نسخه منبع</div>
                </div>
                <div className="rounded-lg bg-green-500/10 p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{lastImport.ocr_used ? 'انجام شد' : lastImport.duplicate ? 'تکراری' : 'آماده'}</div>
                  <div className="text-xs text-muted-foreground">وضعیت</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LegalImporter;
