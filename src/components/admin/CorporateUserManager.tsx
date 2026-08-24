import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, UserPlus, Trash2, Building2, Gem } from 'lucide-react';
import { TIER_NAMES, ROLE_NAMES } from '@/types/multiTenant';
import type { SubscriptionTier, CompanyRole, Company } from '@/types/multiTenant';

interface UserWithDetails {
  id: string;
  email: string | null;
  full_name: string | null;
  user_type: string;
  subscription_tier: SubscriptionTier | null;
  monthly_credits: number;
  used_credits: number;
  is_active: boolean;
  company_membership?: {
    company_id: string;
    company_name: string;
    role: CompanyRole;
  } | null;
}

const CorporateUserManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    company_id: '',
    role: 'employee' as CompanyRole,
  });

  const fetchData = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch company memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('company_members')
        .select(`
          user_id,
          company_id,
          role,
          companies (
            name
          )
        `)
        .eq('is_active', true);

      if (membershipsError) throw membershipsError;

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .eq('status', 'active');

      if (companiesError) throw companiesError;
      setCompanies(companiesData as Company[]);

      // Merge data
      const usersWithDetails: UserWithDetails[] = (profiles || []).map((profile: any) => {
        const membership = memberships?.find((m: any) => m.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          user_type: profile.user_type || 'individual',
          subscription_tier: profile.subscription_tier,
          monthly_credits: profile.monthly_credits || 50,
          used_credits: profile.used_credits || 0,
          is_active: profile.is_active ?? true,
          company_membership: membership ? {
            company_id: membership.company_id,
            company_name: (membership.companies as any)?.name || '',
            role: membership.role as CompanyRole,
          } : null,
        };
      });

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت اطلاعات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignToCompany = async () => {
    if (!selectedUserId || !formData.company_id) return;

    try {
      // Update profile to corporate
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ user_type: 'corporate' })
        .eq('id', selectedUserId);

      if (profileError) throw profileError;

      // Add company membership
      const { error: membershipError } = await supabase
        .from('company_members')
        .insert({
          company_id: formData.company_id,
          user_id: selectedUserId,
          role: formData.role,
        });

      if (membershipError) throw membershipError;

      toast({ title: 'کاربر به شرکت اضافه شد' });
      setAssignDialogOpen(false);
      setSelectedUserId(null);
      fetchData();
    } catch (error) {
      console.error('Error assigning to company:', error);
      toast({
        title: 'خطا',
        description: 'خطا در اضافه کردن کاربر به شرکت',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromCompany = async (userId: string) => {
    if (!confirm('آیا از حذف کاربر از شرکت مطمئن هستید؟')) return;

    try {
      const { error: membershipError } = await supabase
        .from('company_members')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (membershipError) throw membershipError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ user_type: 'individual' })
        .eq('id', userId);

      if (profileError) throw profileError;

      toast({ title: 'کاربر از شرکت حذف شد' });
      fetchData();
    } catch (error) {
      console.error('Error removing from company:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف کاربر از شرکت',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateCredits = async (userId: string, credits: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ monthly_credits: credits })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, monthly_credits: credits } : u)
      );
      toast({ title: 'اعتبار بروزرسانی شد' });
    } catch (error) {
      console.error('Error updating credits:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بروزرسانی اعتبار',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateTier = async (userId: string, tier: SubscriptionTier) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, subscription_tier: tier } : u)
      );
      toast({ title: 'پلن بروزرسانی شد' });
    } catch (error) {
      console.error('Error updating tier:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بروزرسانی پلن',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRole = async (userId: string, companyId: string, newRole: CompanyRole) => {
    try {
      const { error } = await supabase
        .from('company_members')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => {
          if (u.id === userId && u.company_membership) {
            return {
              ...u,
              company_membership: { ...u.company_membership, role: newRole },
            };
          }
          return u;
        })
      );
      toast({ title: 'نقش بروزرسانی شد' });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بروزرسانی نقش',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const individualUsers = users.filter(u => u.user_type === 'individual');
  const corporateUsers = users.filter(u => u.user_type === 'corporate');

  return (
    <div className="space-y-6">
      {/* Corporate Users */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            کاربران شرکتی ({corporateUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {corporateUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              هیچ کاربر شرکتی وجود ندارد
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">نام</TableHead>
                    <TableHead className="text-right">ایمیل</TableHead>
                    <TableHead className="text-right">شرکت</TableHead>
                    <TableHead className="text-right">نقش</TableHead>
                    <TableHead className="text-right">اعتبار</TableHead>
                    <TableHead className="text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corporateUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || '-'}
                      </TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">
                        {user.email || '-'}
                      </TableCell>
                      <TableCell>
                        {user.company_membership?.company_name || '-'}
                      </TableCell>
                      <TableCell>
                        {user.company_membership ? (
                          <Select
                            value={user.company_membership.role}
                            onValueChange={(v) => handleUpdateRole(user.id, user.company_membership!.company_id, v as CompanyRole)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ceo">مدیرعامل</SelectItem>
                              <SelectItem value="deputy">معاون</SelectItem>
                              <SelectItem value="manager">مدیر</SelectItem>
                              <SelectItem value="employee">کارشناس</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">-</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Gem className="w-4 h-4 text-primary" />
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={user.monthly_credits}
                            onChange={(e) => handleUpdateCredits(user.id, parseInt(e.target.value) || 0)}
                            min={0}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveFromCompany(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Users */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            کاربران فردی ({individualUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {individualUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              هیچ کاربر فردی وجود ندارد
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">نام</TableHead>
                    <TableHead className="text-right">ایمیل</TableHead>
                    <TableHead className="text-right">پلن</TableHead>
                    <TableHead className="text-right">اعتبار</TableHead>
                    <TableHead className="text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individualUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || '-'}
                      </TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">
                        {user.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.subscription_tier || 'individual_free'}
                          onValueChange={(v) => handleUpdateTier(user.id, v as SubscriptionTier)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual_free">رایگان</SelectItem>
                            <SelectItem value="individual_pro">حرفه‌ای</SelectItem>
                            <SelectItem value="individual_plus">پلاس</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Gem className="w-4 h-4 text-primary" />
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={user.monthly_credits}
                            onChange={(e) => handleUpdateCredits(user.id, parseInt(e.target.value) || 0)}
                            min={0}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Building2 className="w-4 h-4 ml-1" />
                          اضافه به شرکت
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign to Company Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="glass-card border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle>اضافه کردن به شرکت</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>شرکت</Label>
              <Select
                value={formData.company_id}
                onValueChange={(v) => setFormData({ ...formData, company_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب شرکت" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نقش</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as CompanyRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ceo">مدیرعامل</SelectItem>
                  <SelectItem value="deputy">معاون</SelectItem>
                  <SelectItem value="manager">مدیر</SelectItem>
                  <SelectItem value="employee">کارشناس</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssignToCompany} className="w-full glow-button">
              تایید
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CorporateUserManager;
