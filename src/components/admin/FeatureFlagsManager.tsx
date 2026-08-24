import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Settings, Edit2, Gem } from 'lucide-react';
import { TIER_NAMES, ROLE_NAMES } from '@/types/multiTenant';
import type { FeaturePermission, SubscriptionTier, CompanyRole } from '@/types/multiTenant';

const ALL_TIERS: SubscriptionTier[] = [
  'individual_free',
  'individual_pro',
  'individual_plus',
  'corporate_expert',
  'corporate_decision_support',
  'corporate_decision_making',
];

const ALL_ROLES: CompanyRole[] = ['ceo', 'deputy', 'manager', 'employee'];

const FeatureFlagsManager = () => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFeature, setEditingFeature] = useState<FeaturePermission | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_permissions')
        .select('*')
        .order('feature_category', { ascending: true });

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        allowed_tiers: item.allowed_tiers as SubscriptionTier[],
        allowed_company_roles: item.allowed_company_roles as CompanyRole[] | null,
      })) as FeaturePermission[];
      
      setPermissions(typedData);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت دسترسی‌ها',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const toggleFeatureActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('feature_permissions')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setPermissions(prev => 
        prev.map(p => p.id === id ? { ...p, is_active: isActive } : p)
      );
      
      toast({ title: isActive ? 'قابلیت فعال شد' : 'قابلیت غیرفعال شد' });
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تغییر وضعیت',
        variant: 'destructive',
      });
    }
  };

  const handleSaveFeature = async () => {
    if (!editingFeature) return;

    try {
      const { error } = await supabase
        .from('feature_permissions')
        .update({
          allowed_tiers: editingFeature.allowed_tiers,
          allowed_company_roles: editingFeature.allowed_company_roles,
          allow_view: editingFeature.allow_view,
          allow_edit: editingFeature.allow_edit,
          credit_cost: editingFeature.credit_cost,
        })
        .eq('id', editingFeature.id);

      if (error) throw error;

      setPermissions(prev =>
        prev.map(p => p.id === editingFeature.id ? editingFeature : p)
      );
      
      setDialogOpen(false);
      setEditingFeature(null);
      toast({ title: 'تنظیمات ذخیره شد' });
    } catch (error) {
      console.error('Error saving feature:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره تنظیمات',
        variant: 'destructive',
      });
    }
  };

  const toggleTier = (tier: SubscriptionTier) => {
    if (!editingFeature) return;
    
    const tiers = editingFeature.allowed_tiers.includes(tier)
      ? editingFeature.allowed_tiers.filter(t => t !== tier)
      : [...editingFeature.allowed_tiers, tier];
    
    setEditingFeature({ ...editingFeature, allowed_tiers: tiers });
  };

  const toggleRole = (role: CompanyRole) => {
    if (!editingFeature) return;
    
    const currentRoles = editingFeature.allowed_company_roles || [];
    const roles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    setEditingFeature({ 
      ...editingFeature, 
      allowed_company_roles: roles.length > 0 ? roles : null 
    });
  };

  // Group by category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.feature_category]) {
      acc[perm.feature_category] = [];
    }
    acc[perm.feature_category].push(perm);
    return acc;
  }, {} as Record<string, FeaturePermission[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          مدیریت دسترسی قابلیت‌ها (Feature Flags)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {Object.entries(groupedPermissions).map(([category, features]) => (
            <AccordionItem key={category} value={category} className="border border-border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{category}</span>
                  <Badge variant="secondary">{features.length} قابلیت</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-8">فعال</TableHead>
                      <TableHead className="text-right">قابلیت</TableHead>
                      <TableHead className="text-right">پلن‌ها</TableHead>
                      <TableHead className="text-right">هزینه</TableHead>
                      <TableHead className="text-right w-12">ویرایش</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.map((feature) => (
                      <TableRow key={feature.id}>
                        <TableCell>
                          <Switch
                            checked={feature.is_active}
                            onCheckedChange={(checked) => toggleFeatureActive(feature.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{feature.feature_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {feature.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {feature.allowed_tiers.slice(0, 3).map((tier) => (
                              <Badge key={tier} variant="outline" className="text-xs">
                                {TIER_NAMES[tier]}
                              </Badge>
                            ))}
                            {feature.allowed_tiers.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{feature.allowed_tiers.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Gem className="w-4 h-4 text-primary" />
                            <span>{feature.credit_cost}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingFeature(feature);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-card border-border max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                ویرایش قابلیت: {editingFeature?.feature_name}
              </DialogTitle>
            </DialogHeader>
            {editingFeature && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">پلن‌های مجاز</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {ALL_TIERS.map((tier) => (
                      <div key={tier} className="flex items-center gap-2">
                        <Checkbox
                          id={tier}
                          checked={editingFeature.allowed_tiers.includes(tier)}
                          onCheckedChange={() => toggleTier(tier)}
                        />
                        <Label htmlFor={tier} className="cursor-pointer">
                          {TIER_NAMES[tier]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">نقش‌های شرکتی مجاز</Label>
                  <p className="text-sm text-muted-foreground">
                    فقط برای کاربران شرکتی اعمال می‌شود. اگر خالی باشد، همه نقش‌ها دسترسی دارند.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {ALL_ROLES.map((role) => (
                      <div key={role} className="flex items-center gap-2">
                        <Checkbox
                          id={role}
                          checked={editingFeature.allowed_company_roles?.includes(role) ?? false}
                          onCheckedChange={() => toggleRole(role)}
                        />
                        <Label htmlFor={role} className="cursor-pointer">
                          {ROLE_NAMES[role]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingFeature.allow_view}
                      onCheckedChange={(v) => setEditingFeature({ ...editingFeature, allow_view: v })}
                    />
                    <Label>اجازه مشاهده</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingFeature.allow_edit}
                      onCheckedChange={(v) => setEditingFeature({ ...editingFeature, allow_edit: v })}
                    />
                    <Label>اجازه ویرایش</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>هزینه اعتباری</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingFeature.credit_cost}
                      onChange={(e) => setEditingFeature({ 
                        ...editingFeature, 
                        credit_cost: parseInt(e.target.value) || 0 
                      })}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveFeature} className="w-full glow-button">
                  ذخیره تغییرات
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default FeatureFlagsManager;
