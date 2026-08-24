import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Pencil, Key, Save, X, Plus, Trash2 } from "lucide-react";
import type { SubscriptionTier, CompanyRole } from "@/types/multiTenant";
import { TIER_NAMES, ROLE_NAMES } from "@/types/multiTenant";

interface FeaturePermission {
  id: string;
  feature_key: string;
  feature_name: string;
  feature_category: string;
  description: string | null;
  allowed_tiers: SubscriptionTier[];
  allowed_company_roles: CompanyRole[] | null;
  credit_cost: number;
  is_active: boolean;
  allow_view: boolean;
  allow_edit: boolean;
}

const ALL_TIERS: SubscriptionTier[] = [
  'individual_free',
  'individual_pro',
  'individual_plus',
  'corporate_expert',
  'corporate_decision_support',
  'corporate_decision_making',
];

const ALL_ROLES: CompanyRole[] = ['ceo', 'deputy', 'manager', 'employee'];

const CATEGORIES = [
  { value: 'text_generation', label: 'تولید متن' },
  { value: 'image_generation', label: 'تولید تصویر' },
  { value: 'analytics', label: 'تحلیل' },
  { value: 'deep_search', label: 'جستجوی عمیق' },
  { value: 'complex_analysis', label: 'تحلیل پیچیده' },
  { value: 'free_tools', label: 'ابزار رایگان' },
  { value: 'demo', label: 'دمو' },
];

const FeaturePermissionsManager = () => {
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFeature, setEditingFeature] = useState<FeaturePermission | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    feature_key: '',
    feature_name: '',
    feature_category: 'text_generation',
    description: '',
    allowed_tiers: [] as SubscriptionTier[],
    allowed_company_roles: [] as CompanyRole[],
    credit_cost: 0,
    is_active: true,
    allow_view: true,
    allow_edit: false,
  });

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_permissions')
        .select('*')
        .order('feature_category', { ascending: true })
        .order('feature_name', { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "خطا",
        description: "خطا در دریافت دسترسی‌ها",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (feature: FeaturePermission) => {
    setEditingFeature(feature);
    setFormData({
      feature_key: feature.feature_key,
      feature_name: feature.feature_name,
      feature_category: feature.feature_category,
      description: feature.description || '',
      allowed_tiers: feature.allowed_tiers || [],
      allowed_company_roles: feature.allowed_company_roles || [],
      credit_cost: feature.credit_cost,
      is_active: feature.is_active,
      allow_view: feature.allow_view,
      allow_edit: feature.allow_edit,
    });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingFeature(null);
    setFormData({
      feature_key: '',
      feature_name: '',
      feature_category: 'text_generation',
      description: '',
      allowed_tiers: [],
      allowed_company_roles: [],
      credit_cost: 0,
      is_active: true,
      allow_view: true,
      allow_edit: false,
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.feature_key || !formData.feature_name) {
      toast({
        title: "خطا",
        description: "کلید و نام فیچر الزامی است",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        feature_key: formData.feature_key,
        feature_name: formData.feature_name,
        feature_category: formData.feature_category,
        description: formData.description || null,
        allowed_tiers: formData.allowed_tiers,
        allowed_company_roles: formData.allowed_company_roles.length > 0 ? formData.allowed_company_roles : null,
        credit_cost: formData.credit_cost,
        is_active: formData.is_active,
        allow_view: formData.allow_view,
        allow_edit: formData.allow_edit,
      };

      if (isCreating) {
        const { error } = await supabase
          .from('feature_permissions')
          .insert(payload);

        if (error) throw error;
        toast({ title: "موفق", description: "فیچر جدید اضافه شد" });
      } else if (editingFeature) {
        const { error } = await supabase
          .from('feature_permissions')
          .update(payload)
          .eq('id', editingFeature.id);

        if (error) throw error;
        toast({ title: "موفق", description: "تغییرات ذخیره شد" });
      }

      setIsDialogOpen(false);
      fetchPermissions();
    } catch (error: any) {
      console.error('Error saving permission:', error);
      toast({
        title: "خطا",
        description: error.message || "خطا در ذخیره",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا مطمئن هستید؟')) return;

    try {
      const { error } = await supabase
        .from('feature_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "موفق", description: "فیچر حذف شد" });
      fetchPermissions();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: "خطا",
        description: "خطا در حذف",
        variant: "destructive",
      });
    }
  };

  const toggleTier = (tier: SubscriptionTier) => {
    setFormData(prev => ({
      ...prev,
      allowed_tiers: prev.allowed_tiers.includes(tier)
        ? prev.allowed_tiers.filter(t => t !== tier)
        : [...prev.allowed_tiers, tier]
    }));
  };

  const toggleRole = (role: CompanyRole) => {
    setFormData(prev => ({
      ...prev,
      allowed_company_roles: prev.allowed_company_roles.includes(role)
        ? prev.allowed_company_roles.filter(r => r !== role)
        : [...prev.allowed_company_roles, role]
    }));
  };

  const getCategoryLabel = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.label || cat;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5" />
            مدیریت دسترسی فیچرها
          </h2>
          <p className="text-sm text-muted-foreground">
            تعیین کنید هر فیچر برای کدام پلن‌ها و نقش‌ها فعال باشد
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 ml-2" />
          فیچر جدید
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام فیچر</TableHead>
                <TableHead>کلید</TableHead>
                <TableHead>دسته</TableHead>
                <TableHead>اعتبار</TableHead>
                <TableHead>تیرهای مجاز</TableHead>
                <TableHead>نقش‌ها</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell className="font-medium">{perm.feature_name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {perm.feature_key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCategoryLabel(perm.feature_category)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={perm.credit_cost === 0 ? "secondary" : "default"}>
                      {perm.credit_cost === 0 ? "رایگان" : perm.credit_cost}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {perm.allowed_tiers?.slice(0, 3).map(tier => (
                        <Badge key={tier} variant="secondary" className="text-xs">
                          {TIER_NAMES[tier]?.split(' - ')[0] || tier}
                        </Badge>
                      ))}
                      {perm.allowed_tiers?.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{perm.allowed_tiers.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {perm.allowed_company_roles?.map(role => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {ROLE_NAMES[role]}
                        </Badge>
                      )) || <span className="text-muted-foreground text-xs">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={perm.is_active ? "default" : "secondary"}>
                      {perm.is_active ? "فعال" : "غیرفعال"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(perm)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(perm.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "افزودن فیچر جدید" : `ویرایش: ${editingFeature?.feature_name}`}
            </DialogTitle>
            <DialogDescription>
              تنظیم دسترسی‌ها و پارامترهای فیچر
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>کلید فیچر (انگلیسی)</Label>
                <Input
                  value={formData.feature_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, feature_key: e.target.value }))}
                  placeholder="smart_ad"
                  disabled={!isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label>نام فیچر</Label>
                <Input
                  value={formData.feature_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, feature_name: e.target.value }))}
                  placeholder="آگهی‌نویس هوشمند"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>دسته‌بندی</Label>
                <Select
                  value={formData.feature_category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, feature_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>هزینه اعتبار</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.credit_cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, credit_cost: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>توضیحات</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="توضیح مختصر..."
              />
            </div>

            {/* Tiers Selection */}
            <div className="space-y-3">
              <Label>تیرهای مجاز</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_TIERS.map(tier => (
                  <div key={tier} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`tier-${tier}`}
                      checked={formData.allowed_tiers.includes(tier)}
                      onCheckedChange={() => toggleTier(tier)}
                    />
                    <label
                      htmlFor={`tier-${tier}`}
                      className="text-sm cursor-pointer"
                    >
                      {TIER_NAMES[tier]}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Roles Selection */}
            <div className="space-y-3">
              <Label>نقش‌های شرکتی مجاز (اختیاری)</Label>
              <div className="grid grid-cols-4 gap-2">
                {ALL_ROLES.map(role => (
                  <div key={role} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`role-${role}`}
                      checked={formData.allowed_company_roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <label
                      htmlFor={`role-${role}`}
                      className="text-sm cursor-pointer"
                    >
                      {ROLE_NAMES[role]}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                اگر هیچ نقشی انتخاب نشود، همه نقش‌ها دسترسی دارند
              </p>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>فعال</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  checked={formData.allow_view}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_view: checked }))}
                />
                <Label>اجازه مشاهده</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  checked={formData.allow_edit}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_edit: checked }))}
                />
                <Label>اجازه ویرایش</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="w-4 h-4 ml-2" />
              انصراف
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeaturePermissionsManager;
