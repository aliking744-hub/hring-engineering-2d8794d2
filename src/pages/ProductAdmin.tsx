import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';
import defaultLogo from '@/assets/logo.png';
import { toast } from 'sonner';

type SettingValueType = 'text' | 'boolean' | 'number' | 'json' | 'url';

interface SiteSetting {
  id: string;
  key: string;
  value: string | null;
  label: string | null;
  category: string;
  value_type: SettingValueType;
  is_public: boolean;
  updated_at: string;
}

interface CmsField {
  key: string;
  label: string;
  fallback: string;
  category: string;
  valueType?: SettingValueType;
  description?: string;
  multiline?: boolean;
}

interface VisibilityItem {
  id: string;
  label: string;
  description: string;
}

interface CustomFont {
  name: string;
  url: string;
}

interface BulkSettingItem {
  key: string;
  value: string | null;
  label: string | null;
  category: string;
  value_type: SettingValueType;
  is_public: boolean;
}

interface AdvancedEditor {
  key: string;
  value: string;
  label: string;
  category: string;
  valueType: SettingValueType;
  isPublic: boolean;
}

const BRAND_FIELDS: CmsField[] = [
  {
    key: 'site_name',
    label: 'نام برند و نرم‌افزار',
    fallback: 'HRing',
    category: 'branding',
    description: 'در عنوان صفحات، هدر و بخش‌های اصلی سایت استفاده می‌شود.',
  },
];

const LOGO_FIELDS: CmsField[] = [
  { key: 'logo_main', label: 'لوگوی اصلی', fallback: '', category: 'branding', valueType: 'url', description: 'هدر و صفحات عمومی' },
  { key: 'logo_footer', label: 'لوگوی فوتر', fallback: '', category: 'branding', valueType: 'url', description: 'پایین صفحهٔ اصلی' },
  { key: 'logo_auth', label: 'لوگوی ورود', fallback: '', category: 'branding', valueType: 'url', description: 'صفحهٔ ورود و ثبت‌نام' },
  { key: 'logo_favicon', label: 'آیکون مرورگر', fallback: '', category: 'branding', valueType: 'url', description: 'آیکون تب مرورگر؛ PNG یا WebP' },
];

const COLOR_FIELDS: CmsField[] = [
  { key: 'color_primary', label: 'رنگ اصلی', fallback: '#3b82f6', category: 'theme' },
  { key: 'color_accent', label: 'رنگ مکمل', fallback: '#b84ddb', category: 'theme' },
  { key: 'color_background', label: 'پس‌زمینه', fallback: '#070811', category: 'theme' },
  { key: 'color_card', label: 'رنگ کارت‌ها', fallback: '#0f1119', category: 'theme' },
  { key: 'color_foreground', label: 'رنگ متن اصلی', fallback: '#f8fafc', category: 'theme' },
];

const SEO_FIELDS: CmsField[] = [
  { key: 'seo_title', label: 'عنوان پیش‌فرض سایت', fallback: 'HRing - نرم افزار جامع منابع انسانی', category: 'seo' },
  {
    key: 'seo_description',
    label: 'توضیحات پیش‌فرض موتورهای جست‌وجو',
    fallback: 'HRing سیستم مدیریت منابع انسانی نسل جدید؛ استخدام، تحلیل و تصمیم‌یار منابع انسانی با هوش مصنوعی.',
    category: 'seo',
    multiline: true,
  },
  { key: 'seo_keywords', label: 'کلمات کلیدی', fallback: 'منابع انسانی, استخدام, مصاحبه, آنبوردینگ, HR, هوش مصنوعی', category: 'seo' },
  { key: 'seo_canonical_base_url', label: 'دامنهٔ اصلی سایت', fallback: 'https://hring.ir', category: 'seo', valueType: 'url' },
  { key: 'seo_og_image', label: 'تصویر اشتراک‌گذاری شبکه‌های اجتماعی', fallback: 'https://hring.ir/og-image.png', category: 'seo', valueType: 'url' },
];

const TEXT_GROUPS: Array<{ id: string; label: string; fields: CmsField[] }> = [
  {
    id: 'hero',
    label: 'بخش اصلی صفحهٔ اول',
    fields: [
      { key: 'hero_prefix', label: 'پیشوند عنوان', fallback: '{site_name}:', category: 'landing' },
      { key: 'hero_title', label: 'عنوان اصلی', fallback: 'سیستم مدیریت منابع انسانی', category: 'landing' },
      { key: 'hero_suffix', label: 'ادامهٔ عنوان', fallback: 'نسل جدید', category: 'landing' },
      { key: 'hero_subtitle', label: 'متن معرفی', fallback: 'قدرت گرفته از هوش مصنوعی. استخدام، مصاحبه و آنبوردینگ را به صورت خودکار و هوشمند مدیریت کنید.', category: 'landing', multiline: true },
      { key: 'hero_cta_primary', label: 'متن دکمهٔ اصلی', fallback: 'شروع کنید', category: 'landing' },
      { key: 'hero_cta_secondary', label: 'متن دکمهٔ دوم', fallback: 'مشاهده پلن‌ها', category: 'landing' },
    ],
  },
  {
    id: 'landing',
    label: 'معرفی قابلیت‌ها و داشبورد',
    fields: [
      { key: 'dashboard_title', label: 'عنوان پیش‌نمایش داشبورد', fallback: 'تجربه داشبورد مدرن', category: 'landing' },
      { key: 'dashboard_subtitle', label: 'زیرعنوان پیش‌نمایش داشبورد', fallback: 'طراحی شده برای بهره‌وری حداکثری', category: 'landing' },
      { key: 'dashboard_cta', label: 'دکمهٔ پیش‌نمایش داشبورد', fallback: 'مشاهده داشبورد کامل و فیلترها', category: 'landing' },
      { key: 'bento_title', label: 'عنوان قابلیت‌ها', fallback: 'همه چیز در یک پلتفرم', category: 'landing' },
      { key: 'bento_subtitle', label: 'توضیح قابلیت‌ها', fallback: 'چهار ماژول قدرتمند برای مدیریت کامل چرخه استخدام', category: 'landing' },
      { key: 'legal_badge', label: 'برچسب مشاور حقوقی', fallback: 'مجهز به هوش مصنوعی', category: 'landing' },
      { key: 'legal_title', label: 'عنوان مشاور حقوقی', fallback: 'مشاور حقوقی هوشمند', category: 'landing' },
      { key: 'legal_subtitle', label: 'توضیح مشاور حقوقی', fallback: 'سوالات حقوقی خود در زمینه قانون کار را بپرسید. می‌توانید تصویر یا PDF نیز پیوست کنید.', category: 'landing', multiline: true },
      { key: 'shop_title', label: 'عنوان فروشگاه', fallback: 'فروشگاه اسناد HR', category: 'landing' },
      { key: 'shop_subtitle', label: 'توضیح فروشگاه', fallback: 'قالب‌های آماده قرارداد و مستندات منابع انسانی', category: 'landing' },
      { key: 'blog_title', label: 'عنوان بلاگ', fallback: 'بلاگ و مقالات', category: 'landing' },
      { key: 'blog_subtitle', label: 'توضیح بلاگ', fallback: 'آخرین مطالب و مقالات تخصصی منابع انسانی', category: 'landing' },
    ],
  },
  {
    id: 'proof',
    label: 'اعتماد و آمار صفحهٔ اول',
    fields: [
      { key: 'testimonials_title', label: 'عنوان نظرات', fallback: 'نظرات', category: 'landing' },
      { key: 'testimonials_title_highlight', label: 'بخش برجستهٔ عنوان', fallback: 'مشتریان', category: 'landing' },
      { key: 'testimonials_subtitle', label: 'توضیح نظرات', fallback: 'ببینید چرا صدها شرکت به HRing اعتماد کرده‌اند', category: 'landing' },
      { key: 'stat_companies', label: 'عدد شرکت‌ها', fallback: '۵۰۰+', category: 'landing' },
      { key: 'stat_companies_label', label: 'عنوان شرکت‌ها', fallback: 'شرکت فعال', category: 'landing' },
      { key: 'stat_hiring', label: 'عدد استخدام‌ها', fallback: '۱۵,۰۰۰+', category: 'landing' },
      { key: 'stat_hiring_label', label: 'عنوان استخدام‌ها', fallback: 'استخدام موفق', category: 'landing' },
      { key: 'stat_satisfaction', label: 'عدد رضایت', fallback: '۹۸٪', category: 'landing' },
      { key: 'stat_satisfaction_label', label: 'عنوان رضایت', fallback: 'رضایت مشتریان', category: 'landing' },
      { key: 'stat_saving', label: 'عدد صرفه‌جویی', fallback: '۷۰٪', category: 'landing' },
      { key: 'stat_saving_label', label: 'عنوان صرفه‌جویی', fallback: 'صرفه‌جویی زمان', category: 'landing' },
    ],
  },
  {
    id: 'auth-dashboard',
    label: 'ورود، داشبورد و فوتر',
    fields: [
      { key: 'auth_title', label: 'عنوان صفحهٔ ورود', fallback: 'ورود به {site_name}', category: 'product' },
      { key: 'auth_subtitle', label: 'توضیح صفحهٔ ورود', fallback: 'به پلتفرم مدیریت منابع انسانی خوش آمدید', category: 'product' },
      { key: 'dashboard_credit_label', label: 'عنوان اعتبار داشبورد', fallback: 'اعتبار شرکت', category: 'product' },
      { key: 'dashboard_logout_btn', label: 'متن خروج', fallback: 'خروج', category: 'product' },
      { key: 'dashboard_search_placeholder', label: 'متن جست‌وجو', fallback: 'جستجو...', category: 'product' },
      { key: 'footer_credit', label: 'پیشوند سازنده', fallback: 'Architected by', category: 'footer' },
      { key: 'footer_author', label: 'نام سازنده', fallback: 'Ali Dehghani', category: 'footer' },
      { key: 'footer_ai', label: 'نام فناوری AI در فوتر', fallback: 'AI', category: 'footer' },
      { key: 'footer_copyright', label: 'متن حقوق سایت', fallback: 'تمامی حقوق محفوظ است', category: 'footer' },
    ],
  },
];

const VISIBILITY_GROUPS: Array<{ label: string; items: VisibilityItem[] }> = [
  {
    label: 'بخش‌های صفحهٔ اصلی',
    items: [
      { id: 'hero', label: 'بخش اصلی (Hero)', description: 'عنوان و دکمه‌های ابتدای صفحه' },
      { id: 'hero_cta_secondary', label: 'دکمهٔ مشاهده پلن‌ها', description: 'دکمهٔ دوم بخش اصلی' },
      { id: 'dashboard_preview', label: 'پیش‌نمایش داشبورد', description: 'تصویر و معرفی داشبورد' },
      { id: 'bento', label: 'معرفی قابلیت‌ها', description: 'کارت‌های قابلیت‌های اصلی' },
      { id: 'legal', label: 'معرفی مشاور حقوقی', description: 'تیزر ابزار حقوقی' },
      { id: 'shop', label: 'معرفی فروشگاه', description: 'تیزر فروشگاه اسناد' },
      { id: 'pricing_landing', label: 'پلن‌ها', description: 'بخش قیمت‌گذاری صفحهٔ اصلی' },
      { id: 'faq', label: 'سوالات متداول', description: 'تیزر FAQ' },
      { id: 'testimonials', label: 'نظرات و آمار', description: 'اعتماد اجتماعی و آمار' },
      { id: 'blog', label: 'بلاگ', description: 'آخرین مقاله‌ها' },
      { id: 'footer', label: 'فوتر', description: 'پایین صفحهٔ اصلی' },
    ],
  },
  {
    label: 'منوی سایت',
    items: [
      { id: 'nav_home', label: 'خانه', description: 'لینک خانه' },
      { id: 'nav_plans', label: 'پلن‌ها', description: 'لینک پلن‌ها' },
      { id: 'nav_shop', label: 'فروشگاه', description: 'لینک فروشگاه' },
      { id: 'nav_blog', label: 'بلاگ', description: 'لینک بلاگ' },
      { id: 'nav_dashboard', label: 'داشبورد', description: 'لینک داشبورد' },
      { id: 'nav_login', label: 'دکمهٔ ورود', description: 'ورود و ثبت‌نام' },
    ],
  },
  {
    label: 'صفحات و ابزارها',
    items: [
      { id: 'page_upgrade', label: 'صفحهٔ ارتقای پلن', description: '/upgrade' },
      { id: 'page_shop', label: 'صفحهٔ فروشگاه', description: '/shop' },
      { id: 'page_blog', label: 'صفحهٔ بلاگ', description: '/blog' },
      { id: 'page_faq', label: 'صفحهٔ FAQ', description: '/faq' },
      { id: 'page_legal', label: 'مشاور حقوقی', description: '/legal-advisor' },
      { id: 'support_chat', label: 'چت پشتیبانی', description: 'دکمهٔ شناور پشتیبانی' },
      { id: 'dashboard_upgrade_cta', label: 'دکمهٔ ارتقا در داشبورد', description: 'CTA ارتقای پلن' },
    ],
  },
];

const FONT_FIELDS: CmsField[] = [
  { key: 'font_heading', label: 'فونت عنوان‌ها', fallback: 'Afarin', category: 'branding' },
  { key: 'font_body', label: 'فونت متن‌ها', fallback: 'IRANSans', category: 'branding' },
  { key: 'font_button', label: 'فونت دکمه‌ها', fallback: 'IRANSans', category: 'branding' },
  { key: 'font_nav', label: 'فونت منو', fallback: 'IRANSans', category: 'branding' },
];

const BASE_FONTS = [
  { name: 'IRANSans', label: 'ایران‌سنس' },
  { name: 'BNazanin', label: 'بی‌نازنین' },
  { name: 'Afarin', label: 'آفرین' },
  { name: 'Inter', label: 'Inter' },
];

const emptyAdvanced: AdvancedEditor = {
  key: '', value: '', label: '', category: 'general', valueType: 'text', isPublic: false,
};

const safeAssetName = (value: string) => value.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');

const ProductAdmin = () => {
  const { context, loading: contextLoading } = useUserContext();
  const { refetch: refetchPublicSettings } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [textSearch, setTextSearch] = useState('');
  const [fontName, setFontName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedIsNew, setAdvancedIsNew] = useState(false);
  const [advancedEditor, setAdvancedEditor] = useState<AdvancedEditor>(emptyAdvanced);

  const roles = context?.platformRoles || [];
  const canManageProduct = roles.includes('super_admin') || roles.includes('content_admin');

  const load = useCallback(async () => {
    if (!canManageProduct) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await apiRequest<SiteSetting[]>('/admin/product/settings');
      setSettings(rows);
      setValues(Object.fromEntries(rows.map((item) => [item.key, item.value || ''])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت تنظیمات سایت انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [canManageProduct]);

  useEffect(() => {
    if (!contextLoading) void load();
  }, [contextLoading, load]);

  const siteName = values.site_name || 'HRing';
  const fallbackFor = (field: CmsField) => field.fallback.split('{site_name}').join(siteName);
  const valueFor = (field: CmsField) => values[field.key] || fallbackFor(field);
  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const mergeRows = (rows: SiteSetting[]) => {
    setSettings((current) => {
      const byKey = new Map(current.map((item) => [item.key, item]));
      rows.forEach((item) => byKey.set(item.key, item));
      return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
    });
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((item) => [item.key, item.value || ''])),
    }));
  };

  const saveItems = async (items: BulkSettingItem[], busyKey: string, message = 'تنظیمات ذخیره شد') => {
    if (!items.length) return false;
    setBusy(busyKey);
    try {
      const rows = await apiRequest<SiteSetting[]>('/admin/product/settings/bulk', {
        method: 'PUT',
        body: JSON.stringify({ settings: items }),
      });
      mergeRows(rows);
      await refetchPublicSettings();
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره تنظیمات انجام نشد');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const itemForField = (field: CmsField, value = valueFor(field)): BulkSettingItem => ({
    key: field.key,
    value: value.trim() || null,
    label: field.label,
    category: field.category,
    value_type: field.valueType || 'text',
    is_public: true,
  });

  const saveFieldGroup = (fields: CmsField[], key: string, message?: string) =>
    saveItems(fields.map((field) => itemForField(field)), key, message);

  const saveColors = () => {
    const invalid = COLOR_FIELDS.find((field) => !/^#[0-9a-fA-F]{6}$/.test(valueFor(field)));
    if (invalid) {
      toast.error(`رنگ «${invalid.label}» باید مثل #3b82f6 و شش‌رقمی باشد`);
      return;
    }
    void saveFieldGroup(COLOR_FIELDS, 'colors-save', 'رنگ‌های سایت ذخیره شدند');
  };

  const uploadAsset = async (field: CmsField, file: File, kind: 'logos' | 'fonts') => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم فایل باید کمتر از ۱۰ مگابایت باشد');
      return null;
    }
    const extension = safeAssetName(file.name.split('.').pop() || 'bin');
    const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const objectPath = `cms/${kind}/${safeAssetName(field.key)}-${unique}.${extension}`;
    const body = new FormData();
    body.append('file', file);
    setBusy(`upload:${field.key}`);
    try {
      const result = await apiRequest<{ path: string }>(
        `/compat/storage/products/upload/${objectPath}`,
        { method: 'POST', body },
      );
      return `/api/v1/compat/storage/public/products/${result.path.split('/').map(encodeURIComponent).join('/')}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'آپلود فایل انجام نشد');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const uploadLogo = async (field: CmsField, file: File) => {
    const url = await uploadAsset(field, file, 'logos');
    if (!url) return;
    setValue(field.key, url);
    await saveItems([itemForField(field, url)], `save:${field.key}`, 'لوگو ذخیره شد');
  };

  const customFonts = useMemo<CustomFont[]>(() => {
    try {
      const parsed: unknown = JSON.parse(values.custom_fonts || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is CustomFont => (
        typeof item === 'object' && item !== null
        && typeof (item as CustomFont).name === 'string'
        && typeof (item as CustomFont).url === 'string'
      ));
    } catch {
      return [];
    }
  }, [values.custom_fonts]);

  const fontOptions = useMemo(() => [
    ...BASE_FONTS,
    ...customFonts.map((font) => ({ name: font.name, label: font.name })),
  ], [customFonts]);

  const uploadFont = async (file: File) => {
    const cleanName = fontName.trim();
    if (!/^[\p{L}\p{N} _-]{2,60}$/u.test(cleanName)) {
      toast.error('یک نام ساده برای فونت وارد کن');
      return;
    }
    const field: CmsField = { key: 'custom_fonts', label: 'فونت‌های سفارشی', fallback: '[]', category: 'branding', valueType: 'json' };
    const url = await uploadAsset(field, file, 'fonts');
    if (!url) return;
    const next = [...customFonts.filter((item) => item.name !== cleanName), { name: cleanName, url }];
    const serialized = JSON.stringify(next);
    setValue('custom_fonts', serialized);
    if (await saveItems([itemForField(field, serialized)], 'save:custom_fonts', 'فونت اضافه شد')) setFontName('');
  };

  const removeFont = async (font: CustomFont) => {
    if (!window.confirm(`فونت «${font.name}» از فهرست CMS حذف شود؟`)) return;
    const field: CmsField = { key: 'custom_fonts', label: 'فونت‌های سفارشی', fallback: '[]', category: 'branding', valueType: 'json' };
    const serialized = JSON.stringify(customFonts.filter((item) => item.name !== font.name));
    setValue('custom_fonts', serialized);
    await saveItems([itemForField(field, serialized)], 'save:custom_fonts', 'فونت از فهرست حذف شد');
  };

  const toggleVisibility = async (item: VisibilityItem, visible: boolean) => {
    const key = `section_visible_${item.id}`;
    setValue(key, String(visible));
    const saved = await saveItems([{
      key,
      value: String(visible),
      label: `نمایش ${item.label}`,
      category: 'visibility',
      value_type: 'boolean',
      is_public: true,
    }], `visibility:${item.id}`, visible ? 'بخش فعال شد' : 'بخش مخفی شد');
    if (!saved) await load();
  };

  const filteredTextGroups = useMemo(() => {
    const query = textSearch.trim().toLowerCase();
    if (!query) return TEXT_GROUPS;
    return TEXT_GROUPS
      .map((group) => ({
        ...group,
        fields: group.fields.filter((field) => [field.key, field.label, values[field.key] || '']
          .some((value) => value.toLowerCase().includes(query))),
      }))
      .filter((group) => group.fields.length);
  }, [textSearch, values]);

  const openAdvanced = (setting?: SiteSetting) => {
    setAdvancedIsNew(!setting);
    setAdvancedEditor(setting ? {
      key: setting.key,
      value: setting.value || '',
      label: setting.label || '',
      category: setting.category,
      valueType: setting.value_type,
      isPublic: setting.is_public,
    } : emptyAdvanced);
    setAdvancedOpen(true);
  };

  const saveAdvanced = async () => {
    const key = advancedEditor.key.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.:-]{0,159}$/.test(key)) {
      toast.error('کلید تنظیم نامعتبر است');
      return;
    }
    const saved = await saveItems([{
      key,
      value: advancedEditor.value || null,
      label: advancedEditor.label.trim() || null,
      category: advancedEditor.category.trim() || 'general',
      value_type: advancedEditor.valueType,
      is_public: advancedEditor.isPublic,
    }], 'advanced-save', advancedIsNew ? 'تنظیم جدید ساخته شد' : 'تنظیم ذخیره شد');
    if (saved) setAdvancedOpen(false);
  };

  if (contextLoading || loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!canManageProduct) {
    return <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl"><Card className="max-w-md"><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto mb-3 h-12 w-12 text-destructive" /><h1 className="text-xl font-bold">دسترسی به CMS سایت نداری</h1><Button asChild className="mt-5"><Link to="/admin">بازگشت</Link></Button></CardContent></Card></div>;
  }

  return (
    <>
      <Helmet><title>CMS و تنظیمات سایت | {siteName}</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
          <Button variant="outline" asChild className="mb-5"><Link to="/admin"><ArrowRight className="ml-2 h-4 w-4" />بازگشت به مرکز مدیریت</Link></Button>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Settings2 className="h-6 w-6 text-primary" />CMS و تنظیمات سایت</h1><p className="mt-1 text-sm text-muted-foreground">برند، لوگو، رنگ‌ها، فونت‌ها، متن‌ها، نمایش بخش‌ها و SEO را بدون تغییر کد مدیریت کن.</p></div>
            <Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>
          </div>

          <Card className="mb-5 border-primary/30 bg-primary/5"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="font-medium">تغییرات این CMS واقعی و سراسری‌اند</div><div className="mt-1 text-sm text-muted-foreground">فایل‌ها در MinIO خود HRing و تنظیمات در PostgreSQL ذخیره می‌شوند؛ خود این CMS هیچ وابستگی به Supabase ندارد.</div></div><Badge>Backend مستقل</Badge></CardContent></Card>

          <Tabs defaultValue="brand" className="space-y-5">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 lg:grid-cols-6">
              <TabsTrigger value="brand">برند و لوگو</TabsTrigger><TabsTrigger value="colors">رنگ و فونت</TabsTrigger><TabsTrigger value="texts">متن‌ها</TabsTrigger><TabsTrigger value="visibility">نمایش بخش‌ها</TabsTrigger><TabsTrigger value="seo">SEO</TabsTrigger><TabsTrigger value="advanced">پیشرفته</TabsTrigger>
            </TabsList>

            <TabsContent value="brand" className="space-y-5">
              <Card><CardHeader><CardTitle>هویت برند</CardTitle><CardDescription>نام برند بلافاصله در عنوان صفحات و هدر سایت استفاده می‌شود.</CardDescription></CardHeader><CardContent className="space-y-4">{BRAND_FIELDS.map((field) => <div key={field.key} className="grid gap-2"><Label>{field.label}</Label><Input value={valueFor(field)} onChange={(event) => setValue(field.key, event.target.value)} /><p className="text-xs text-muted-foreground">{field.description}</p></div>)}<Button onClick={() => void saveFieldGroup(BRAND_FIELDS, 'brand-save', 'هویت برند ذخیره شد')} disabled={busy === 'brand-save'}>{busy === 'brand-save' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره نام برند</Button></CardContent></Card>
              <div className="grid gap-4 md:grid-cols-2">{LOGO_FIELDS.map((field) => { const current = values[field.key] || ''; return <Card key={field.key}><CardHeader><CardTitle className="text-base">{field.label}</CardTitle><CardDescription>{field.description}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border bg-muted/30 p-4"><img src={current || defaultLogo} alt={field.label} className="max-h-full max-w-full object-contain" /></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild disabled={busy === `upload:${field.key}`}><label className="cursor-pointer"><Upload className="ml-2 h-4 w-4" />انتخاب فایل<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy === `upload:${field.key}`} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(field, file); event.currentTarget.value = ''; }} /></label></Button>{current && <Button variant="ghost" className="text-destructive" onClick={() => { setValue(field.key, ''); void saveItems([itemForField(field, '')], `save:${field.key}`, 'لوگو حذف شد'); }}><Trash2 className="ml-2 h-4 w-4" />حذف</Button>}</div><div className="grid gap-2"><Label className="text-xs">یا آدرس HTTPS</Label><div className="flex gap-2"><Input dir="ltr" value={current} onChange={(event) => setValue(field.key, event.target.value)} /><Button size="icon" variant="outline" onClick={() => void saveItems([itemForField(field)], `save:${field.key}`)}><Save className="h-4 w-4" /></Button></div></div></CardContent></Card>; })}</div>
            </TabsContent>

            <TabsContent value="colors" className="space-y-5">
              <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />رنگ‌های اصلی سایت</CardTitle><CardDescription>بعد از ذخیره، رنگ‌ها روی کل سایت و پنل‌ها اعمال می‌شوند.</CardDescription></div><Button variant="outline" onClick={() => setValues((current) => ({ ...current, ...Object.fromEntries(COLOR_FIELDS.map((field) => [field.key, field.fallback])) }))}><RotateCcw className="ml-2 h-4 w-4" />مقادیر پیشنهادی</Button></div></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{COLOR_FIELDS.map((field) => { const colorValue = valueFor(field); const pickerValue = /^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : field.fallback; return <div key={field.key} className="space-y-3 rounded-xl border p-4"><Label>{field.label}</Label><input type="color" value={pickerValue} onChange={(event) => setValue(field.key, event.target.value)} className="h-14 w-full cursor-pointer rounded-lg border bg-transparent p-1" /><Input dir="ltr" value={colorValue} onChange={(event) => /^#[0-9a-fA-F]{0,6}$/.test(event.target.value) && setValue(field.key, event.target.value)} /></div>; })}</div><Button className="mt-5" onClick={saveColors} disabled={busy === 'colors-save'}><Save className="ml-2 h-4 w-4" />ذخیره رنگ‌ها</Button></CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" />فونت بخش‌های سایت</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FONT_FIELDS.map((field) => <div key={field.key} className="space-y-2 rounded-xl border p-4"><Label>{field.label}</Label><Select value={valueFor(field)} onValueChange={(value) => setValue(field.key, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fontOptions.map((font) => <SelectItem key={`${field.key}-${font.name}`} value={font.name}><span style={{ fontFamily: font.name }}>{font.label}</span></SelectItem>)}</SelectContent></Select><div className="rounded bg-muted p-3 text-center" style={{ fontFamily: valueFor(field) }}>نمونه متن فارسی</div></div>)}</div><Button onClick={() => void saveFieldGroup(FONT_FIELDS, 'fonts-save', 'فونت‌های سایت ذخیره شدند')} disabled={busy === 'fonts-save'}><Save className="ml-2 h-4 w-4" />ذخیره انتخاب فونت‌ها</Button><div className="border-t pt-5"><h3 className="mb-3 font-medium">افزودن فونت سفارشی</h3><div className="flex flex-wrap gap-2"><Input className="max-w-xs" value={fontName} onChange={(event) => setFontName(event.target.value)} placeholder="نام فونت" /><Button variant="outline" asChild disabled={busy === 'upload:custom_fonts'}><label className="cursor-pointer"><Upload className="ml-2 h-4 w-4" />انتخاب فایل فونت<input type="file" accept=".ttf,.otf,.woff,.woff2" disabled={busy === 'upload:custom_fonts'} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFont(file); event.currentTarget.value = ''; }} /></label></Button></div>{customFonts.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{customFonts.map((font) => <div key={font.name} className="flex items-center justify-between rounded-lg border p-3"><span style={{ fontFamily: font.name }}>{font.name} — نمونه فارسی</span><Button size="icon" variant="ghost" onClick={() => void removeFont(font)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}</div></CardContent></Card>
            </TabsContent>

            <TabsContent value="texts" className="space-y-5">
              <Card><CardContent className="p-4"><Input value={textSearch} onChange={(event) => setTextSearch(event.target.value)} placeholder="جست‌وجو در عنوان یا کلید متن..." /></CardContent></Card>
              {filteredTextGroups.map((group) => <Card key={group.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{group.label}</CardTitle><Button size="sm" onClick={() => void saveFieldGroup(group.fields, `texts:${group.id}`, 'متن‌های این بخش ذخیره شدند')}><Save className="ml-2 h-4 w-4" />ذخیره این بخش</Button></div></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{group.fields.map((field) => <div key={field.key} className={field.multiline ? 'md:col-span-2' : ''}><Label>{field.label}</Label>{field.multiline ? <Textarea className="mt-2 min-h-24" value={valueFor(field)} onChange={(event) => setValue(field.key, event.target.value)} /> : <Input className="mt-2" value={valueFor(field)} onChange={(event) => setValue(field.key, event.target.value)} />}<div dir="ltr" className="mt-1 text-left font-mono text-[10px] text-muted-foreground">{field.key}</div></div>)}</CardContent></Card>)}
            </TabsContent>

            <TabsContent value="visibility" className="space-y-5">
              <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-4 text-sm text-muted-foreground">خاموش‌کردن هر گزینه فقط آن بخش را مخفی می‌کند و اطلاعاتش را حذف نمی‌کند.</CardContent></Card>
              {VISIBILITY_GROUPS.map((group) => <Card key={group.label}><CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />{group.label}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{group.items.map((item) => { const key = `section_visible_${item.id}`; const visible = (values[key] || 'true') !== 'false'; return <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${visible ? '' : 'border-destructive/30 bg-destructive/5 opacity-75'}`}><div><div className="flex items-center gap-2 font-medium">{visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-destructive" />}{item.label}</div><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div><Switch checked={visible} disabled={busy === `visibility:${item.id}`} onCheckedChange={(checked) => void toggleVisibility(item, checked)} /></div>; })}</CardContent></Card>)}
            </TabsContent>

            <TabsContent value="seo">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" />تنظیمات SEO و اشتراک‌گذاری</CardTitle><CardDescription>این مقادیر مستقیماً در title، meta description، canonical و Open Graph صفحهٔ اصلی استفاده می‌شوند.</CardDescription></CardHeader><CardContent className="space-y-4">{SEO_FIELDS.map((field) => <div key={field.key} className="grid gap-2"><Label>{field.label}</Label>{field.multiline ? <Textarea value={valueFor(field)} onChange={(event) => setValue(field.key, event.target.value)} /> : <Input dir={field.valueType === 'url' ? 'ltr' : 'rtl'} value={valueFor(field)} onChange={(event) => setValue(field.key, event.target.value)} />}<div dir="ltr" className="text-left font-mono text-[10px] text-muted-foreground">{field.key}</div></div>)}<Button onClick={() => void saveFieldGroup(SEO_FIELDS, 'seo-save', 'تنظیمات SEO ذخیره شد')}><Save className="ml-2 h-4 w-4" />ذخیره SEO</Button></CardContent></Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-5">
              <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>تنظیمات پیشرفته</CardTitle><CardDescription>برای کلیدهای خاص آینده؛ Secret و API Key در این بخش قابل ذخیره نیستند.</CardDescription></div><Button onClick={() => openAdvanced()}><Plus className="ml-2 h-4 w-4" />تنظیم جدید</Button></div></CardHeader><CardContent className="space-y-2">{settings.map((setting) => <button type="button" key={setting.key} onClick={() => openAdvanced(setting)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-right hover:bg-muted/40"><div><div className="font-medium">{setting.label || setting.key}</div><div dir="ltr" className="mt-1 text-left font-mono text-xs text-muted-foreground">{setting.key}</div></div><div className="flex items-center gap-2"><Badge variant="outline">{setting.category}</Badge><Badge variant={setting.is_public ? 'default' : 'secondary'}>{setting.is_public ? 'Public' : 'Private'}</Badge></div></button>)}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}><DialogContent dir="rtl" className="sm:max-w-2xl"><DialogHeader><DialogTitle>{advancedIsNew ? 'تنظیم جدید' : 'ویرایش تنظیم'}</DialogTitle><DialogDescription>این بخش برای configuration غیرمحرمانه است.</DialogDescription></DialogHeader><div className="grid gap-4"><div><Label>کلید</Label><Input dir="ltr" disabled={!advancedIsNew} value={advancedEditor.key} onChange={(event) => setAdvancedEditor((current) => ({ ...current, key: event.target.value }))} /></div><div><Label>عنوان مدیریتی</Label><Input value={advancedEditor.label} onChange={(event) => setAdvancedEditor((current) => ({ ...current, label: event.target.value }))} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>دسته</Label><Input value={advancedEditor.category} onChange={(event) => setAdvancedEditor((current) => ({ ...current, category: event.target.value }))} /></div><div><Label>نوع</Label><Select value={advancedEditor.valueType} onValueChange={(value: SettingValueType) => setAdvancedEditor((current) => ({ ...current, valueType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">text</SelectItem><SelectItem value="boolean">boolean</SelectItem><SelectItem value="number">number</SelectItem><SelectItem value="json">json</SelectItem><SelectItem value="url">url</SelectItem></SelectContent></Select></div></div><div><Label>مقدار</Label><Textarea dir={advancedEditor.valueType === 'text' ? 'rtl' : 'ltr'} className="min-h-32" value={advancedEditor.value} onChange={(event) => setAdvancedEditor((current) => ({ ...current, value: event.target.value }))} /></div><div className="flex items-center justify-between rounded-xl border p-3"><div><Label>Public</Label><p className="text-xs text-muted-foreground">فقط داده‌ای که frontend لازم دارد عمومی شود.</p></div><Switch checked={advancedEditor.isPublic} onCheckedChange={(checked) => setAdvancedEditor((current) => ({ ...current, isPublic: checked }))} /></div></div><DialogFooter><Button onClick={() => void saveAdvanced()} disabled={busy === 'advanced-save'}>{busy === 'advanced-save' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
};

export default ProductAdmin;
