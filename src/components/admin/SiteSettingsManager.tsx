import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, Save, Plus, Trash2, Type, Image, FileText, Upload, ChevronDown, Home, LogIn, LayoutDashboard, User, FolderOpen, Settings, Search, Eye, EyeOff } from 'lucide-react';

// Landing page sections that can be toggled visible/hidden
const LANDING_SECTIONS = [
  { id: 'hero', label: 'بخش هیرو (Hero)', description: 'بخش اصلی بالای صفحه اول' },
  { id: 'dashboard_preview', label: 'پیش‌نمایش داشبورد', description: 'تصویر/پیش‌نمایش داشبورد' },
  { id: 'bento', label: 'گرید بنتو (قابلیت‌ها)', description: 'بخش معرفی قابلیت‌ها' },
  { id: 'legal', label: 'بخش مشاور حقوقی', description: 'معرفی ابزار حقوقی' },
  { id: 'shop', label: 'تیزر فروشگاه', description: 'بخش معرفی فروشگاه' },
  { id: 'faq', label: 'سوالات متداول', description: 'تیزر FAQ' },
  { id: 'testimonials', label: 'نظرات کاربران', description: 'بخش testimonials' },
  { id: 'blog', label: 'تیزر وبلاگ', description: 'آخرین مقالات وبلاگ' },
  { id: 'footer', label: 'فوتر', description: 'پایین صفحه' },
];

export const isSectionVisible = (settings: Record<string, string>, sectionId: string): boolean => {
  const v = settings[`section_visible_${sectionId}`];
  return v !== 'false'; // default visible
};

// Landing page sections that can be toggled visible/hidden
const LANDING_SECTIONS = [
  { id: 'hero', label: 'بخش هیرو (Hero)', description: 'بخش اصلی بالای صفحه اول' },
  { id: 'dashboard_preview', label: 'پیش‌نمایش داشبورد', description: 'تصویر/پیش‌نمایش داشبورد در صفحه اصلی' },
  { id: 'bento', label: 'گرید بنتو (قابلیت‌ها)', description: 'بخش معرفی قابلیت‌ها' },
  { id: 'legal', label: 'بخش مشاور حقوقی', description: 'معرفی ابزار حقوقی در صفحه اصلی' },
  { id: 'shop', label: 'تیزر فروشگاه', description: 'بخش معرفی فروشگاه' },
  { id: 'pricing_landing', label: 'پلن‌ها در صفحه اصلی', description: 'نمایش پلن‌های قیمت‌گذاری در landing' },
  { id: 'faq', label: 'سوالات متداول', description: 'تیزر FAQ در صفحه اصلی' },
  { id: 'testimonials', label: 'نظرات کاربران', description: 'بخش testimonials' },
  { id: 'blog', label: 'تیزر وبلاگ', description: 'آخرین مقالات وبلاگ در صفحه اصلی' },
  { id: 'footer', label: 'فوتر', description: 'پایین صفحه' },
];

const NAV_SECTIONS = [
  { id: 'nav_home', label: 'منو: خانه', description: 'لینک «خانه» در نوبار' },
  { id: 'nav_plans', label: 'منو: پلن‌ها', description: 'لینک «پلن‌ها» در نوبار' },
  { id: 'nav_shop', label: 'منو: فروشگاه', description: 'لینک «فروشگاه» در نوبار' },
  { id: 'nav_blog', label: 'منو: بلاگ', description: 'لینک «بلاگ» در نوبار' },
  { id: 'nav_dashboard', label: 'منو: داشبورد', description: 'لینک «داشبورد» در نوبار' },
  { id: 'nav_login', label: 'منو: دکمه ورود', description: 'دکمه ورود در نوبار' },
];

const PAGE_SECTIONS = [
  { id: 'page_upgrade', label: 'صفحه ارتقای پلن', description: 'صفحه /upgrade برای کاربران' },
  { id: 'page_shop', label: 'صفحه فروشگاه', description: 'صفحه /shop' },
  { id: 'page_blog', label: 'صفحه بلاگ', description: 'صفحه /blog' },
  { id: 'page_faq', label: 'صفحه FAQ', description: 'صفحه سوالات متداول' },
  { id: 'page_legal', label: 'صفحه مشاور حقوقی', description: 'صفحه /legal-advisor' },
  { id: 'support_chat', label: 'ویجت چت پشتیبانی', description: 'دکمه شناور پشتیبانی در گوشه صفحه' },
  { id: 'dashboard_upgrade_cta', label: 'دکمه ارتقا در داشبورد', description: 'CTA ارتقای پلن در داشبورد کاربر' },
];

const ALL_VISIBILITY_GROUPS = [
  { title: 'بخش‌های صفحه اصلی', items: LANDING_SECTIONS },
  { title: 'منوی ناوبری (Navbar)', items: NAV_SECTIONS },
  { title: 'صفحات و ویجت‌ها', items: PAGE_SECTIONS },
];

export const isSectionVisible = (settings: Record<string, string>, sectionId: string): boolean => {
  const v = settings[`section_visible_${sectionId}`];
  return v !== 'false'; // default visible
};

// Text settings groups configuration
const TEXT_GROUPS = [
  { 
    id: 'hero', 
    label: 'بخش هیرو', 
    icon: Home, 
    prefixes: ['hero_'],
    description: 'عناوین و متون بخش اصلی صفحه اول'
  },
  { 
    id: 'landing', 
    label: 'صفحه اصلی', 
    icon: Home, 
    prefixes: ['dashboard_title', 'dashboard_subtitle', 'dashboard_cta', 'bento_', 'legal_', 'shop_', 'testimonials_', 'stat_', 'blog_title', 'blog_subtitle'],
    description: 'سایر بخش‌های صفحه اصلی'
  },
  { 
    id: 'footer', 
    label: 'فوتر', 
    icon: Settings, 
    prefixes: ['footer_'],
    description: 'متون پایین صفحه'
  },
  { 
    id: 'auth', 
    label: 'صفحه ورود', 
    icon: LogIn, 
    prefixes: ['auth_'],
    description: 'عناوین و متون صفحه ورود و ثبت‌نام'
  },
  { 
    id: 'dashboard_page', 
    label: 'داشبورد', 
    icon: LayoutDashboard, 
    prefixes: ['dashboard_page_', 'dashboard_credit', 'dashboard_back', 'dashboard_upgrade', 'dashboard_logout', 'dashboard_search', 'dashboard_corporate'],
    description: 'عناوین و متون صفحه داشبورد'
  },
  { 
    id: 'profile', 
    label: 'پروفایل', 
    icon: User, 
    prefixes: ['profile_'],
    description: 'عناوین و متون صفحه پروفایل'
  },
  { 
    id: 'other', 
    label: 'سایر', 
    icon: FolderOpen, 
    prefixes: [],
    description: 'متون دسته‌بندی نشده'
  },
];

interface SiteSetting {
  id: string;
  key: string;
  value: string | null;
  label: string | null;
}

interface CustomFont {
  name: string;
  url: string;
}

// Default available fonts in the system
const DEFAULT_FONTS = [
  { value: 'IRANSans', label: 'ایران سنس (پیش‌فرض)' },
  { value: 'BNazanin', label: 'بی نازنین' },
  { value: 'Afarin', label: 'آفرین' },
  { value: 'Inter', label: 'Inter (انگلیسی)' },
];

// Font setting keys and their labels
const FONT_SETTINGS = [
  { key: 'font_heading', label: 'فونت عناوین', description: 'عناوین اصلی و تیترها' },
  { key: 'font_body', label: 'فونت متن', description: 'متن‌های بدنه و پاراگراف‌ها' },
  { key: 'font_button', label: 'فونت دکمه‌ها', description: 'متن داخل دکمه‌ها' },
  { key: 'font_nav', label: 'فونت منو', description: 'آیتم‌های نوبار و منو' },
];

// Logo setting keys
const LOGO_SETTINGS = [
  { key: 'logo_main', label: 'لوگوی اصلی', description: 'لوگوی هدر و صفحات اصلی' },
  { key: 'logo_footer', label: 'لوگوی فوتر', description: 'لوگوی پایین صفحه' },
  { key: 'logo_auth', label: 'لوگوی ورود', description: 'لوگوی صفحه ورود و ثبت‌نام' },
  { key: 'logo_favicon', label: 'فاوآیکون', description: 'آیکون تب مرورگر' },
];

const SiteSettingsManager = () => {
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [uploadingFont, setUploadingFont] = useState(false);
  const [activeTab, setActiveTab] = useState('texts');
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  
  // New setting form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  
  // New font form
  const [showNewFontForm, setShowNewFontForm] = useState(false);
  const [newFontName, setNewFontName] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  // Load custom fonts from settings
  useEffect(() => {
    const fontsJson = settings.find(s => s.key === 'custom_fonts')?.value;
    if (fontsJson) {
      try {
        const fonts = JSON.parse(fontsJson) as CustomFont[];
        setCustomFonts(fonts);
        // Load fonts dynamically
        fonts.forEach(font => loadFontFace(font.name, font.url));
      } catch {
        setCustomFonts([]);
      }
    }
  }, [settings]);

  const loadFontFace = (name: string, url: string) => {
    // Avoid duplicating styles for the same font
    const existingStyle = document.querySelector(`style[data-font="${name}"]`);
    if (existingStyle) existingStyle.remove();

    const cleanUrl = url.split('#')[0];
    const ext = cleanUrl.split('?')[0]?.split('.').pop()?.toLowerCase();
    const format =
      ext === 'woff2'
        ? 'woff2'
        : ext === 'woff'
          ? 'woff'
          : ext === 'otf'
            ? 'opentype'
            : ext === 'ttf'
              ? 'truetype'
              : undefined;

    const style = document.createElement('style');
    style.setAttribute('data-font', name);
    style.textContent = `
      @font-face {
        font-family: '${name}';
        src: url('${url}')${format ? ` format('${format}')` : ''};
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  };
  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('خطا در دریافت تنظیمات');
      console.error(error);
    } else {
      setSettings(data || []);
      // Initialize edited values
      const values: Record<string, string> = {};
      (data || []).forEach(s => {
        values[s.key] = s.value || '';
      });
      setEditedValues(values);
    }
    setLoading(false);
  };

  const getSettingByKey = (key: string) => {
    return settings.find(s => s.key === key);
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSetting = async (key: string, label: string) => {
    const newValue = editedValues[key];
    const existing = getSettingByKey(key);

    setSaving(true);

    if (existing) {
      if (newValue === existing.value) {
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from('site_settings')
        .update({ value: newValue })
        .eq('id', existing.id);

      if (error) {
        toast.error('خطا در ذخیره تنظیمات');
        console.error(error);
      } else {
        toast.success('تنظیمات ذخیره شد');
        fetchSettings();
      }
    } else {
      // Create new setting
      const { error } = await supabase
        .from('site_settings')
        .insert({ key, label, value: newValue });

      if (error) {
        toast.error('خطا در ایجاد تنظیم');
        console.error(error);
      } else {
        toast.success('تنظیمات ذخیره شد');
        fetchSettings();
      }
    }
    setSaving(false);
  };

  const handleLogoUpload = async (key: string, label: string, file: File) => {
    setUploadingLogo(key);

    const fileExt = file.name.split('.').pop();
    const fileName = `${key}_${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('خطا در آپلود لوگو');
      console.error(uploadError);
      setUploadingLogo(null);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    // Save to settings
    const existing = getSettingByKey(key);
    if (existing) {
      await supabase
        .from('site_settings')
        .update({ value: publicUrl })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('site_settings')
        .insert({ key, label, value: publicUrl });
    }

    toast.success('لوگو آپلود شد');
    setEditedValues(prev => ({ ...prev, [key]: publicUrl }));
    fetchSettings();
    setUploadingLogo(null);
  };

  const handleFontUpload = async (file: File) => {
    if (!newFontName.trim()) {
      toast.error('لطفاً نام فونت را وارد کنید');
      return;
    }

    setUploadingFont(true);

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'ttf';

    // IMPORTANT: Storage keys cannot contain many unicode characters.
    // So we generate a safe, ASCII-only filename and keep the original font name only for display.
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const fileName = `font_${id}.${fileExt}`;
    const filePath = `fonts/${fileName}`;

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('خطا در آپلود فونت');
      console.error(uploadError);
      setUploadingFont(false);
      return;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('products').getPublicUrl(filePath);

    // Add to custom fonts
    const newFont: CustomFont = { name: newFontName.trim(), url: publicUrl };
    const updatedFonts = [...customFonts, newFont];

    // Save to settings
    const existing = getSettingByKey('custom_fonts');
    const fontsJson = JSON.stringify(updatedFonts);

    if (existing) {
      await supabase
        .from('site_settings')
        .update({ value: fontsJson })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('site_settings')
        .insert({ key: 'custom_fonts', label: 'فونت‌های سفارشی', value: fontsJson });
    }

    // Load the font immediately
    loadFontFace(newFont.name, newFont.url);

    toast.success('فونت آپلود شد');
    setNewFontName('');
    setShowNewFontForm(false);
    fetchSettings();
    setUploadingFont(false);
  };
  const handleDeleteFont = async (fontName: string) => {
    if (!confirm(`آیا از حذف فونت "${fontName}" مطمئن هستید؟`)) return;

    const updatedFonts = customFonts.filter(f => f.name !== fontName);
    const fontsJson = JSON.stringify(updatedFonts);
    
    const existing = getSettingByKey('custom_fonts');
    if (existing) {
      await supabase
        .from('site_settings')
        .update({ value: fontsJson })
        .eq('id', existing.id);
    }

    toast.success('فونت حذف شد');
    fetchSettings();
  };

  const handleSaveAll = async () => {
    setSaving(true);
    
    const updates = settings
      .filter(s => editedValues[s.key] !== s.value)
      .map(s => 
        supabase
          .from('site_settings')
          .update({ value: editedValues[s.key] })
          .eq('id', s.id)
      );

    if (updates.length === 0) {
      toast.info('تغییری وجود ندارد');
      setSaving(false);
      return;
    }

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast.error('خطا در ذخیره برخی تنظیمات');
    } else {
      toast.success('تمام تنظیمات ذخیره شد');
      fetchSettings();
    }
    setSaving(false);
  };

  const handleAddNew = async () => {
    if (!newKey.trim() || !newLabel.trim()) {
      toast.error('کلید و برچسب الزامی است');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .insert({
        key: newKey.trim().toLowerCase().replace(/\s+/g, '_'),
        label: newLabel.trim(),
        value: newValue.trim()
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('این کلید قبلاً وجود دارد');
      } else {
        toast.error('خطا در ایجاد تنظیم');
      }
      console.error(error);
    } else {
      toast.success('تنظیم جدید اضافه شد');
      setNewKey('');
      setNewLabel('');
      setNewValue('');
      setShowNewForm(false);
      fetchSettings();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این تنظیم مطمئن هستید؟')) return;

    const { error } = await supabase
      .from('site_settings')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('خطا در حذف تنظیم');
      console.error(error);
    } else {
      toast.success('تنظیم حذف شد');
      fetchSettings();
    }
  };

  // Combine default and custom fonts
  const allFonts = [
    ...DEFAULT_FONTS,
    ...customFonts.map(f => ({ value: f.name, label: `${f.name} (سفارشی)` }))
  ];

  // Filter out font and logo settings from text settings
  const textSettings = settings.filter(s => 
    !FONT_SETTINGS.some(f => f.key === s.key) && 
    !LOGO_SETTINGS.some(l => l.key === s.key) &&
    s.key !== 'custom_fonts'
  );

  // Filter text settings by search query
  const filteredTextSettings = useMemo(() => {
    if (!searchQuery.trim()) return textSettings;
    const query = searchQuery.toLowerCase();
    return textSettings.filter(s => 
      s.key.toLowerCase().includes(query) ||
      s.label?.toLowerCase().includes(query) ||
      s.value?.toLowerCase().includes(query)
    );
  }, [textSettings, searchQuery]);

  // Group text settings by category (using filtered settings)
  const groupedSettings = useMemo(() => {
    const groups: Record<string, SiteSetting[]> = {};
    
    TEXT_GROUPS.forEach(group => {
      groups[group.id] = [];
    });

    filteredTextSettings.forEach(setting => {
      let assigned = false;
      
      for (const group of TEXT_GROUPS) {
        if (group.id === 'other') continue;
        
        for (const prefix of group.prefixes) {
          if (setting.key.startsWith(prefix) || setting.key === prefix.replace('_', '')) {
            groups[group.id].push(setting);
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
      
      if (!assigned) {
        groups['other'].push(setting);
      }
    });

    return groups;
  }, [filteredTextSettings]);

  // Track open groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    TEXT_GROUPS.forEach(g => { initial[g.id] = true; });
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">تنظیمات ظاهری سایت</h2>
        <Button
          onClick={handleSaveAll}
          disabled={saving}
          className="gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          ذخیره همه تغییرات
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="texts" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">متون</span>
          </TabsTrigger>
          <TabsTrigger value="fonts" className="gap-2">
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">فونت‌ها</span>
          </TabsTrigger>
          <TabsTrigger value="logos" className="gap-2">
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">لوگوها</span>
          </TabsTrigger>
          <TabsTrigger value="visibility" className="gap-2">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">نمایش بخش‌ها</span>
          </TabsTrigger>
        </TabsList>

        {/* Texts Tab */}
        <TabsContent value="texts">
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی کلید، برچسب یا مقدار..."
                className="pr-10"
              />
            </div>

            {/* New Setting Button */}
            <Button
              variant="outline"
              onClick={() => setShowNewForm(!showNewForm)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              تنظیم متنی جدید
            </Button>

            {/* New Setting Form */}
            {showNewForm && (
              <Card>
                <CardHeader>
                  <CardTitle>افزودن متن جدید</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>کلید (انگلیسی)</Label>
                      <Input
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        placeholder="hero_title"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>برچسب</Label>
                      <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="عنوان هیرو"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>مقدار</Label>
                      <Input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="متن مورد نظر"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddNew} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                    افزودن
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Grouped Text Settings */}
            <div className="space-y-4">
              {TEXT_GROUPS.map((group) => {
                const groupSettings = groupedSettings[group.id] || [];
                if (groupSettings.length === 0) return null;
                
                const IconComponent = group.icon;
                
                return (
                  <Collapsible
                    key={group.id}
                    open={openGroups[group.id]}
                    onOpenChange={() => toggleGroup(group.id)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <IconComponent className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{group.label}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary">{groupSettings.length} مورد</Badge>
                              <ChevronDown 
                                className={`w-5 h-5 text-muted-foreground transition-transform ${
                                  openGroups[group.id] ? 'rotate-180' : ''
                                }`} 
                              />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="space-y-4 border-t pt-4">
                            {groupSettings.map((setting) => (
                              <div key={setting.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-base font-medium">
                                    {setting.label || setting.key}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                      {setting.key}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(setting.id)}
                                      className="text-destructive hover:text-destructive h-8 w-8"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    value={editedValues[setting.key] || ''}
                                    onChange={(e) => handleValueChange(setting.key, e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleSaveSetting(setting.key, setting.label || setting.key)}
                                    disabled={saving || editedValues[setting.key] === setting.value}
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
              
              {filteredTextSettings.length === 0 && (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      {searchQuery ? 'نتیجه‌ای یافت نشد' : 'هنوز متنی وجود ندارد'}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Fonts Tab */}
        <TabsContent value="fonts">
          <div className="space-y-6">
            {/* Custom Fonts Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    فونت‌های سفارشی
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFontForm(!showNewFontForm)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    افزودن فونت
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  فایل‌های فونت (TTF, OTF, WOFF) خود را آپلود کنید تا در سایت استفاده شوند.
                </p>

                {/* New Font Form */}
                {showNewFontForm && (
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
                    <div className="space-y-2">
                      <Label>نام فونت</Label>
                      <Input
                        value={newFontName}
                        onChange={(e) => setNewFontName(e.target.value)}
                        placeholder="مثال: یکان"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>فایل فونت</Label>
                      <label className="block">
                        <input
                          type="file"
                          accept=".ttf,.otf,.woff,.woff2"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFontUpload(file);
                          }}
                        />
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          disabled={uploadingFont || !newFontName.trim()}
                          asChild
                        >
                          <span>
                            {uploadingFont ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            انتخاب فایل فونت
                          </span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        فرمت‌های مجاز: TTF, OTF, WOFF, WOFF2
                      </p>
                    </div>
                  </div>
                )}

                {/* Custom Fonts List */}
                {customFonts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 border border-dashed border-border rounded-lg">
                    هنوز فونت سفارشی اضافه نشده
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {customFonts.map((font) => (
                      <div 
                        key={font.name} 
                        className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium" style={{ fontFamily: font.name }}>
                            {font.name}
                          </p>
                          <p 
                            className="text-sm text-muted-foreground mt-1"
                            style={{ fontFamily: font.name }}
                          >
                            نمونه متن فارسی
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFont(font.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Font Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  تنظیمات فونت بخش‌ها
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  فونت هر بخش از سایت را از لیست فونت‌های موجود انتخاب کنید.
                </p>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  {FONT_SETTINGS.map((fontSetting) => {
                    const currentValue = editedValues[fontSetting.key] || 'IRANSans';
                    return (
                      <div key={fontSetting.key} className="space-y-3 p-4 rounded-lg border border-border bg-card">
                        <div>
                          <Label className="text-base font-medium">{fontSetting.label}</Label>
                          <p className="text-xs text-muted-foreground mt-1">{fontSetting.description}</p>
                        </div>
                        <Select
                          value={currentValue}
                          onValueChange={(value) => handleValueChange(fontSetting.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="انتخاب فونت" />
                          </SelectTrigger>
                          <SelectContent>
                            {allFonts.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                <span style={{ fontFamily: font.value }}>{font.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Preview */}
                        <div 
                          className="p-3 rounded bg-muted text-center"
                          style={{ fontFamily: currentValue }}
                        >
                          <span className="text-lg">نمونه متن فارسی</span>
                          <span className="text-sm block text-muted-foreground">Sample English Text</span>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveSetting(fontSetting.key, fontSetting.label)}
                          disabled={saving}
                          className="w-full"
                        >
                          <Save className="w-4 h-4 ml-2" />
                          ذخیره
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logos Tab */}
        <TabsContent value="logos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                مدیریت لوگوها
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                لوگوهای مختلف سایت را در اینجا آپلود و مدیریت کنید.
              </p>
              
              <div className="grid gap-6 sm:grid-cols-2">
                {LOGO_SETTINGS.map((logoSetting) => {
                  const currentValue = editedValues[logoSetting.key] || '';
                  const isUploading = uploadingLogo === logoSetting.key;
                  
                  return (
                    <div key={logoSetting.key} className="space-y-3 p-4 rounded-lg border border-border bg-card">
                      <div>
                        <Label className="text-base font-medium">{logoSetting.label}</Label>
                        <p className="text-xs text-muted-foreground mt-1">{logoSetting.description}</p>
                      </div>
                      
                      {/* Current Logo Preview */}
                      <div className="h-24 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {currentValue ? (
                          <img 
                            src={currentValue} 
                            alt={logoSetting.label}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="text-muted-foreground text-sm">لوگو تنظیم نشده</div>
                        )}
                      </div>
                      
                      {/* Upload Button */}
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleLogoUpload(logoSetting.key, logoSetting.label, file);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            className="w-full gap-2"
                            disabled={isUploading}
                            asChild
                          >
                            <span>
                              {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              آپلود لوگو جدید
                            </span>
                          </Button>
                        </label>
                        
                        {currentValue && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const existing = getSettingByKey(logoSetting.key);
                              if (existing) handleDelete(existing.id);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Manual URL Input */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">یا آدرس مستقیم:</Label>
                        <div className="flex gap-2">
                          <Input
                            value={currentValue}
                            onChange={(e) => handleValueChange(logoSetting.key, e.target.value)}
                            placeholder="https://..."
                            dir="ltr"
                            className="flex-1 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleSaveSetting(logoSetting.key, logoSetting.label)}
                            disabled={saving}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visibility Tab */}
        <TabsContent value="visibility">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                نمایش/عدم نمایش بخش‌های صفحه اصلی
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                با کلیک روی آیکون چشم می‌توانید هر بخش از صفحه اصلی سایت را موقتاً مخفی یا نمایان کنید. تغییرات بلافاصله ذخیره می‌شوند.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {LANDING_SECTIONS.map((section) => {
                  const key = `section_visible_${section.id}`;
                  const currentVal = editedValues[key] ?? getSettingByKey(key)?.value ?? 'true';
                  const isVisible = currentVal !== 'false';

                  const toggleVisibility = async () => {
                    const newVal = isVisible ? 'false' : 'true';
                    setEditedValues(prev => ({ ...prev, [key]: newVal }));
                    const existing = getSettingByKey(key);
                    setSaving(true);
                    if (existing) {
                      const { error } = await supabase
                        .from('site_settings')
                        .update({ value: newVal })
                        .eq('id', existing.id);
                      if (error) toast.error('خطا در ذخیره');
                      else {
                        toast.success(isVisible ? `«${section.label}» مخفی شد` : `«${section.label}» نمایان شد`);
                        fetchSettings();
                      }
                    } else {
                      const { error } = await supabase
                        .from('site_settings')
                        .insert({ key, label: `نمایش ${section.label}`, value: newVal });
                      if (error) toast.error('خطا در ذخیره');
                      else {
                        toast.success(isVisible ? `«${section.label}» مخفی شد` : `«${section.label}» نمایان شد`);
                        fetchSettings();
                      }
                    }
                    setSaving(false);
                  };

                  return (
                    <div
                      key={section.id}
                      className={`p-4 rounded-lg border flex items-center justify-between transition-all ${
                        isVisible ? 'border-border bg-card' : 'border-destructive/30 bg-destructive/5 opacity-70'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{section.label}</p>
                          <Badge variant={isVisible ? 'default' : 'destructive'} className="text-xs">
                            {isVisible ? 'نمایان' : 'مخفی'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleVisibility}
                        disabled={saving}
                        className={isVisible ? 'text-primary' : 'text-destructive'}
                        title={isVisible ? 'مخفی کن' : 'نمایان کن'}
                      >
                        {isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Guide */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">نحوه استفاده در کد:</h4>
          <div className="space-y-2">
            <code className="text-sm text-muted-foreground block bg-background p-3 rounded">
              {`// دریافت تنظیم`}<br/>
              {`const { getSetting } = useSiteSettings();`}<br/>
              {`const heroTitle = getSetting('hero_title');`}
            </code>
            <code className="text-sm text-muted-foreground block bg-background p-3 rounded">
              {`// استفاده از فونت`}<br/>
              {`const { fonts } = useSiteSettings();`}<br/>
              {`<h1 style={{ fontFamily: fonts.heading }}>عنوان</h1>`}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SiteSettingsManager;
