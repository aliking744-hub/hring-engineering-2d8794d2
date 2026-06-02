import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Plus, Building2, Trash2, Edit2, Search, Filter, Download, CheckCircle, Clock, XCircle } from 'lucide-react';
import * as XLSX from '@e965/xlsx';
import { TIER_NAMES, STATUS_NAMES } from '@/types/multiTenant';
import type { Company, SubscriptionTier, CompanyStatus } from '@/types/multiTenant';

// Corporate tiers only
const CORPORATE_TIERS: SubscriptionTier[] = [
  'corporate_expert',
  'corporate_decision_support',
  'corporate_decision_making',
];

const CompanyManager = () => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<SubscriptionTier | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    status: 'active' as CompanyStatus,
    subscription_tier: 'corporate_expert' as SubscriptionTier,
    monthly_credits: 100,
    max_members: 10,
  });

  // Filter companies based on search query and filters
  const filteredCompanies = useMemo(() => {
    let result = companies;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(company => 
        company.name.toLowerCase().includes(query) ||
        company.domain?.toLowerCase().includes(query) ||
        company.id.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(company => company.status === statusFilter);
    }
    
    // Subscription tier filter
    if (tierFilter !== 'all') {
      result = result.filter(company => company.subscription_tier === tierFilter);
    }
    
    return result;
  }, [companies, searchQuery, statusFilter, tierFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTierFilter('all');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || tierFilter !== 'all';

  // Statistics
  const stats = useMemo(() => ({
    total: companies.length,
    active: companies.filter(c => c.status === 'active').length,
    trial: companies.filter(c => c.status === 'trial').length,
    suspended: companies.filter(c => c.status === 'suspended').length,
  }), [companies]);

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredCompanies.map(company => ({
      'نام شرکت': company.name,
      'دامنه': company.domain || '-',
      'وضعیت': STATUS_NAMES[company.status],
      'اشتراک': TIER_NAMES[company.subscription_tier],
      'اعتبار مصرفی': company.used_credits,
      'اعتبار ماهانه': company.monthly_credits,
      'حداکثر اعضا': company.max_members,
      'تاریخ ایجاد': new Date(company.created_at).toLocaleDateString('fa-IR'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'شرکت‌ها');
    XLSX.writeFile(workbook, `companies-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({ title: 'فایل اکسل دانلود شد' });
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data as Company[]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت لیست شرکت‌ها',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update({
            name: formData.name,
            domain: formData.domain || null,
            status: formData.status,
            subscription_tier: formData.subscription_tier,
            monthly_credits: formData.monthly_credits,
            max_members: formData.max_members,
          })
          .eq('id', editingCompany.id);

        if (error) throw error;
        toast({ title: 'شرکت بروزرسانی شد' });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert({
            name: formData.name,
            domain: formData.domain || null,
            status: formData.status,
            subscription_tier: formData.subscription_tier,
            monthly_credits: formData.monthly_credits,
            max_members: formData.max_members,
          });

        if (error) throw error;
        toast({ title: 'شرکت ایجاد شد' });
      }

      setDialogOpen(false);
      setEditingCompany(null);
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره شرکت',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این شرکت مطمئن هستید؟')) return;

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'شرکت حذف شد' });
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف شرکت',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      domain: '',
      status: 'active',
      subscription_tier: 'corporate_expert',
      monthly_credits: 100,
      max_members: 10,
    });
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      domain: company.domain || '',
      status: company.status,
      subscription_tier: company.subscription_tier,
      monthly_credits: company.monthly_credits,
      max_members: company.max_members,
    });
    setDialogOpen(true);
  };

  const getStatusColor = (status: CompanyStatus) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'suspended': return 'bg-red-500/20 text-red-400';
      case 'trial': return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-col gap-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">کل شرکت‌ها</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">فعال</p>
              <p className="text-lg font-bold text-green-500">{stats.active}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10">
            <Clock className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">آزمایشی</p>
              <p className="text-lg font-bold text-yellow-500">{stats.trial}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">معلق</p>
              <p className="text-lg font-bold text-red-500">{stats.suspended}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            مدیریت شرکت‌ها
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredCompanies.length} از {companies.length})
            </span>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1">
              <Download className="w-4 h-4" />
              اکسل
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingCompany(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="glow-button gap-2">
                  <Plus className="w-4 h-4" />
                  شرکت جدید
                </Button>
              </DialogTrigger>
            <DialogContent className="glass-card border-border" dir="rtl">
              <DialogHeader>
                <DialogTitle>
                  {editingCompany ? 'ویرایش شرکت' : 'ایجاد شرکت جدید'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>نام شرکت</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="نام شرکت"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>دامنه (اختیاری)</Label>
                  <Input
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="example.com"
                    dir="ltr"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>وضعیت</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as CompanyStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">فعال</SelectItem>
                        <SelectItem value="trial">آزمایشی</SelectItem>
                        <SelectItem value="suspended">معلق</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>اشتراک</Label>
                    <Select
                      value={formData.subscription_tier}
                      onValueChange={(v) => setFormData({ ...formData, subscription_tier: v as SubscriptionTier })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corporate_expert">کارشناس</SelectItem>
                        <SelectItem value="corporate_decision_support">پشتیبان تصمیم</SelectItem>
                        <SelectItem value="corporate_decision_making">تصمیم‌ساز</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اعتبار ماهانه</Label>
                    <Input
                      type="number"
                      value={formData.monthly_credits}
                      onChange={(e) => setFormData({ ...formData, monthly_credits: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>حداکثر اعضا</Label>
                    <Input
                      type="number"
                      value={formData.max_members}
                      onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full glow-button">
                  {editingCompany ? 'بروزرسانی' : 'ایجاد'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام یا دامنه شرکت..."
              className="pr-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CompanyStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="trial">آزمایشی</SelectItem>
              <SelectItem value="suspended">معلق</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as SubscriptionTier | 'all')}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="اشتراک" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه اشتراک‌ها</SelectItem>
              {CORPORATE_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {TIER_NAMES[tier]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <Filter className="w-4 h-4" />
              پاک کردن
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredCompanies.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery ? 'شرکتی یافت نشد' : 'هیچ شرکتی ثبت نشده است'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">نام</TableHead>
                  <TableHead className="text-right">دامنه</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="text-right">اشتراک</TableHead>
                  <TableHead className="text-right">اعتبار</TableHead>
                  <TableHead className="text-right">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {company.domain || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(company.status)}>
                        {STATUS_NAMES[company.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {TIER_NAMES[company.subscription_tier]}
                    </TableCell>
                    <TableCell>
                      {company.used_credits} / {company.monthly_credits}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(company)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(company.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyManager;
