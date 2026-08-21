import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Plus, RefreshCw, Save, Settings2, ShieldCheck } from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

interface SiteSetting {
  id: string;
  key: string;
  value: string | null;
  label: string | null;
  category: string;
  value_type: 'text' | 'boolean' | 'number' | 'json' | 'url';
  is_public: boolean;
  updated_at: string;
}

interface EditorState {
  key: string;
  value: string;
  label: string;
  category: string;
  valueType: SiteSetting['value_type'];
  isPublic: boolean;
}

const emptyEditor: EditorState = {
  key: '',
  value: '',
  label: '',
  category: 'general',
  valueType: 'text',
  isPublic: false,
};

const ProductAdmin = () => {
  const { context, loading: contextLoading } = useUserContext();
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const roles = context?.platformRoles || [];
  const canManageProduct = roles.includes('super_admin') || roles.includes('content_admin');

  const load = useCallback(async () => {
    if (!canManageProduct) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setSettings(await apiRequest<SiteSetting[]>('/admin/product/settings'));
    } catch (error) {
      console.error('Product admin load failed:', error);
      toast.error(error instanceof Error ? error.message : 'دریافت تنظیمات محصول انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [canManageProduct]);

  useEffect(() => {
    if (!contextLoading) void load();
  }, [contextLoading, load]);

  const filteredSettings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return settings;
    return settings.filter((setting) =>
      [setting.key, setting.label || '', setting.category, setting.value || '']
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, settings]);

  const categories = useMemo(
    () => Array.from(new Set(settings.map((setting) => setting.category))).sort(),
    [settings],
  );

  const openExisting = (setting: SiteSetting) => {
    setIsNew(false);
    setEditor({
      key: setting.key,
      value: setting.value || '',
      label: setting.label || '',
      category: setting.category,
      valueType: setting.value_type,
      isPublic: setting.is_public,
    });
    setEditorOpen(true);
  };

  const openNew = () => {
    setIsNew(true);
    setEditor(emptyEditor);
    setEditorOpen(true);
  };

  const save = async () => {
    const key = editor.key.trim();
    if (!/^[a-z0-9][a-z0-9_.-]{1,119}$/i.test(key)) {
      toast.error('کلید تنظیم نامعتبر است؛ از حروف، عدد، نقطه، خط تیره یا زیرخط استفاده کنید');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiRequest<SiteSetting>(`/admin/product/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({
          value: editor.value || null,
          label: editor.label.trim() || null,
          category: editor.category.trim() || 'general',
          value_type: editor.valueType,
          is_public: editor.isPublic,
        }),
      });
      setSettings((current) => {
        const exists = current.some((item) => item.key === updated.key);
        return exists
          ? current.map((item) => item.key === updated.key ? updated : item)
          : [...current, updated].sort((a, b) => a.key.localeCompare(b.key));
      });
      toast.success(isNew ? 'تنظیم جدید ساخته شد' : 'تنظیم محصول ذخیره شد');
      setEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره تنظیم انجام نشد');
    } finally {
      setSaving(false);
    }
  };

  if (contextLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManageProduct) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">دسترسی به Product Admin ندارید</h1>
            <p className="mt-2 text-sm text-muted-foreground">این پنل فقط برای سوپر ادمین و ادمین محصول/محتوا است.</p>
            <Button asChild className="mt-5"><Link to="/admin">بازگشت</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Product & Content Admin | HRing</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Product & Content Admin</h1>
              <p className="text-sm text-muted-foreground">تنظیمات عمومی، متن‌ها، visibility، SEO و رفتار محصول؛ بدون دسترسی به قرارداد شرکت‌ها.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>
              <Button onClick={openNew}><Plus className="ml-2 h-4 w-4" />تنظیم جدید</Button>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">کل تنظیمات</div><div className="mt-1 text-2xl font-bold">{settings.length.toLocaleString('fa-IR')}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Public settings</div><div className="mt-1 text-2xl font-bold">{settings.filter((item) => item.is_public).length.toLocaleString('fa-IR')}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">دسته‌ها</div><div className="mt-1 text-2xl font-bold">{categories.length.toLocaleString('fa-IR')}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />تنظیمات محصول</CardTitle><CardDescription>کلیدهای حساس و Secretها توسط Backend رد می‌شوند و در این پنل قابل ذخیره نیستند.</CardDescription></div>
                <Input className="max-w-sm" placeholder="جستجو در key، عنوان یا دسته..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>کلید</TableHead><TableHead>عنوان</TableHead><TableHead>دسته</TableHead><TableHead>نوع</TableHead><TableHead>دسترسی</TableHead><TableHead>آخرین تغییر</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredSettings.map((setting) => (
                      <TableRow key={setting.key} className="cursor-pointer" onClick={() => openExisting(setting)}>
                        <TableCell dir="ltr" className="font-mono text-xs">{setting.key}</TableCell>
                        <TableCell>{setting.label || '—'}</TableCell>
                        <TableCell><Badge variant="outline">{setting.category}</Badge></TableCell>
                        <TableCell>{setting.value_type}</TableCell>
                        <TableCell>{setting.is_public ? <span className="inline-flex items-center gap-1 text-sm"><Eye className="h-4 w-4" />Public</span> : <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><EyeOff className="h-4 w-4" />Private</span>}</TableCell>
                        <TableCell>{new Date(setting.updated_at).toLocaleString('fa-IR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent dir="rtl" className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{isNew ? 'تنظیم جدید محصول' : 'ویرایش تنظیم محصول'}</DialogTitle><DialogDescription>این فضا برای configuration محصول است؛ API key و credential در Secret Store قرار می‌گیرند، نه اینجا.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Key</Label><Input dir="ltr" disabled={!isNew} value={editor.key} onChange={(event) => setEditor((current) => ({ ...current, key: event.target.value }))} placeholder="landing.hero.title" /></div>
            <div className="grid gap-2"><Label>عنوان مدیریتی</Label><Input value={editor.label} onChange={(event) => setEditor((current) => ({ ...current, label: event.target.value }))} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>دسته</Label><Input value={editor.category} onChange={(event) => setEditor((current) => ({ ...current, category: event.target.value }))} placeholder="seo / landing / visibility" /></div>
              <div className="grid gap-2"><Label>نوع</Label><Select value={editor.valueType} onValueChange={(value) => setEditor((current) => ({ ...current, valueType: value as SiteSetting['value_type'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">text</SelectItem><SelectItem value="boolean">boolean</SelectItem><SelectItem value="number">number</SelectItem><SelectItem value="json">json</SelectItem><SelectItem value="url">url</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-2"><Label>مقدار</Label><Textarea dir={editor.valueType === 'json' || editor.valueType === 'url' ? 'ltr' : 'rtl'} rows={7} value={editor.value} onChange={(event) => setEditor((current) => ({ ...current, value: event.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>Public</Label><p className="text-xs text-muted-foreground">فقط تنظیمات لازم برای frontend عمومی Public شوند.</p></div><Switch checked={editor.isPublic} onCheckedChange={(checked) => setEditor((current) => ({ ...current, isPublic: checked }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductAdmin;
