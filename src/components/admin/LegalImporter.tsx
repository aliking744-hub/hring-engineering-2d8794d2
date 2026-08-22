import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, Database, Globe, CheckCircle, AlertCircle, ClipboardPaste, Upload } from 'lucide-react';

const CATEGORIES = [
  { value: 'labor_law', label: 'قانون کار' },
  { value: 'social_security', label: 'تامین اجتماعی' },
  { value: 'court_rulings', label: 'آرای دیوان' },
];

const LegalImporter = () => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<{ totalChunks?: number; savedCount?: number; contentLength?: number } | null>(null);
  
  // Manual HTML paste mode
  const [htmlContent, setHtmlContent] = useState('');
  const [manualSourceUrl, setManualSourceUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  
  // Document upload state
  const [docSourceUrl, setDocSourceUrl] = useState('');
  const [docCategory, setDocCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      toast.error('لطفاً فقط فایل HTML آپلود کنید');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setHtmlContent(content);
      toast.success(`فایل ${file.name} بارگذاری شد`);
    };
    reader.onerror = () => {
      toast.error('خطا در خواندن فایل');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDocFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(ext)) {
      toast.error('فرمت فایل پشتیبانی نمی‌شود. فرمت‌های مجاز: PDF, Word, TXT');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حداکثر حجم فایل 10 مگابایت است');
      return;
    }
    
    setSelectedFile(file);
    toast.success(`فایل ${file.name} انتخاب شد`);
  };

  const handleDocumentProcess = async () => {
    if (!selectedFile || !docCategory) {
      toast.error('لطفاً فایل و دسته‌بندی را انتخاب کنید');
      return;
    }

    setIsProcessing(true);
    setLogs(['شروع پردازش فایل...']);
    setStats(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', docCategory);
      formData.append('sourceUrl', docSourceUrl || 'uploaded-document');

      const response = await fetch(
        '/functions/v1/extract-document-text',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
      }

      if (data.stats) {
        setStats(data.stats);
      }

      if (data.success) {
        toast.success(`${data.stats?.savedCount || 0} بخش با موفقیت وارد شد`);
        setSelectedFile(null);
        if (docFileInputRef.current) {
          docFileInputRef.current.value = '';
        }
      } else {
        toast.error(data.error || 'خطا در پردازش');
      }
    } catch (error) {
      console.error('Error processing document:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
      setLogs(prev => [...prev, `خطا: ${errorMessage}`]);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!sourceUrl || !category) {
      toast.error('لطفاً URL و دسته‌بندی را وارد کنید');
      return;
    }

    setIsProcessing(true);
    setLogs(['شروع پردازش...']);
    setStats(null);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-legal-docs', {
        body: { sourceUrl, category }
      });

      if (error) throw error;

      if (data.logs) {
        setLogs(data.logs);
      }

      if (data.stats) {
        setStats(data.stats);
      }

      if (data.success) {
        toast.success(`${data.stats?.savedCount || 0} ماده با موفقیت وارد شد`);
      } else {
        toast.error(data.error || 'خطا در پردازش');
      }
    } catch (error) {
      console.error('Error processing:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
      setLogs(prev => [...prev, `خطا: ${errorMessage}`]);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualProcess = async () => {
    if (!htmlContent || !category || !manualSourceUrl) {
      toast.error('لطفاً HTML، URL منبع و دسته‌بندی را وارد کنید');
      return;
    }

    setIsProcessing(true);
    setLogs(['شروع پردازش محتوای دستی...']);
    setStats(null);

    try {
      const { data, error } = await supabase.functions.invoke('process-legal-html', {
        body: { htmlContent, sourceUrl: manualSourceUrl, category }
      });

      if (error) throw error;

      if (data.logs) {
        setLogs(data.logs);
      }

      if (data.stats) {
        setStats(data.stats);
      }

      if (data.success) {
        toast.success(`${data.stats?.savedCount || 0} ماده با موفقیت وارد شد`);
        setHtmlContent('');
      } else {
        toast.error(data.error || 'خطا در پردازش');
      }
    } catch (error) {
      console.error('Error processing:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
      setLogs(prev => [...prev, `خطا: ${errorMessage}`]);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            وارد کردن اسناد حقوقی
          </CardTitle>
          <CardDescription>
            صفحات قوانین را وارد کرده و در پایگاه دانش ذخیره کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="document" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="document" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                آپلود فایل
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4" />
                ورود دستی HTML
              </TabsTrigger>
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                اسکرپ از URL
              </TabsTrigger>
            </TabsList>

            {/* Document Upload Tab */}
            <TabsContent value="document" className="space-y-4 mt-4">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4">
                <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">فرمت‌های پشتیبانی شده:</h4>
                <p className="text-sm text-green-700 dark:text-green-400">
                  PDF، Word (doc, docx)، متن ساده (txt) - حداکثر ۱۰ مگابایت
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="docSourceUrl" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    آدرس URL منبع (اختیاری)
                  </Label>
                  <Input
                    id="docSourceUrl"
                    type="url"
                    placeholder="https://example.com/law.pdf"
                    value={docSourceUrl}
                    onChange={(e) => setDocSourceUrl(e.target.value)}
                    disabled={isProcessing}
                    dir="ltr"
                    className="text-left"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docCategory" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    دسته‌بندی
                  </Label>
                  <Select value={docCategory} onValueChange={setDocCategory} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب دسته‌بندی..." />
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  انتخاب فایل
                </Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.rtf"
                    onChange={handleDocFileSelect}
                    ref={docFileInputRef}
                    className="hidden"
                    disabled={isProcessing}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => docFileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="mb-2"
                  >
                    <Upload className="w-5 h-5 ml-2" />
                    انتخاب فایل
                  </Button>
                  {selectedFile ? (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      ✅ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      فایل PDF، Word یا متنی را انتخاب کنید
                    </p>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleDocumentProcess} 
                disabled={isProcessing || !selectedFile || !docCategory}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    در حال پردازش با هوش مصنوعی...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 ml-2" />
                    استخراج متن و ذخیره
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Manual HTML Tab */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">راهنما:</h4>
                <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>صفحه قانون را در مرورگر خود باز کنید</li>
                  <li>کلید F12 را بزنید یا راست کلیک → Inspect</li>
                  <li>در تب Elements، روی تگ html راست کلیک → Copy → Copy outerHTML</li>
                  <li>محتوا را در کادر زیر paste کنید</li>
                </ol>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manualSourceUrl" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    آدرس URL منبع
                  </Label>
                  <Input
                    id="manualSourceUrl"
                    type="url"
                    placeholder="https://qavanin.ir/Law/..."
                    value={manualSourceUrl}
                    onChange={(e) => setManualSourceUrl(e.target.value)}
                    disabled={isProcessing}
                    dir="ltr"
                    className="text-left"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manualCategory" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    دسته‌بندی
                  </Label>
                  <Select value={category} onValueChange={setCategory} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب دسته‌بندی..." />
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="htmlContent" className="flex items-center gap-2">
                    <ClipboardPaste className="w-4 h-4" />
                    محتوای HTML صفحه
                  </Label>
                  <div>
                    <input
                      type="file"
                      accept=".html,.htm"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      className="hidden"
                      disabled={isProcessing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                    >
                      <Upload className="w-4 h-4 ml-2" />
                      آپلود فایل HTML
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="htmlContent"
                  placeholder="محتوای HTML را اینجا paste کنید یا فایل آپلود کنید..."
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  disabled={isProcessing}
                  dir="ltr"
                  className="text-left font-mono text-xs min-h-[200px]"
                />
                {htmlContent && (
                  <p className="text-xs text-muted-foreground">
                    {htmlContent.length.toLocaleString('fa-IR')} کاراکتر
                  </p>
                )}
              </div>

              <Button 
                onClick={handleManualProcess} 
                disabled={isProcessing || !htmlContent || !category || !manualSourceUrl}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    در حال پردازش...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 ml-2" />
                    پردازش و ذخیره
                  </>
                )}
              </Button>
            </TabsContent>

            {/* URL Scrape Tab */}
            <TabsContent value="url" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sourceUrl" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    آدرس URL منبع
                  </Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    placeholder="https://rc.majlis.ir/fa/law/..."
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    disabled={isProcessing}
                    dir="ltr"
                    className="text-left"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    دسته‌بندی
                  </Label>
                  <Select value={category} onValueChange={setCategory} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب دسته‌بندی..." />
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
                onClick={handleProcess} 
                disabled={isProcessing || !sourceUrl || !category}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    در حال پردازش...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 ml-2" />
                    پردازش و ذخیره
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Logs Section */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📋 گزارش پردازش
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30 p-4">
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-2"
                  >
                    {log.includes('خطا') ? (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    ) : log.includes('ذخیره شد') || log.includes('موفقیت') ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 shrink-0" />
                    )}
                    <span className={log.includes('خطا') ? 'text-destructive' : ''}>{log}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {stats && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{stats.totalChunks || 0}</div>
                  <div className="text-xs text-muted-foreground">ماده یافت شده</div>
                </div>
                <div className="rounded-lg bg-green-500/10 p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.savedCount || 0}</div>
                  <div className="text-xs text-muted-foreground">ذخیره شده</div>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.contentLength?.toLocaleString('fa-IR') || 0}</div>
                  <div className="text-xs text-muted-foreground">کاراکتر</div>
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
