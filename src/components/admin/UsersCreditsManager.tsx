import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, Coins, Plus, Minus, Search, Download } from 'lucide-react';
import * as XLSX from '@e965/xlsx';

interface UserWithCredits {
  id: string;
  email: string | null;
  created_at: string;
  credits: number;
}

const UsersCreditsManager = () => {
  const [users, setUsers] = useState<UserWithCredits[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithCredits | null>(null);
  const [creditChange, setCreditChange] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.email?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast.error('خطا در دریافت لیست کاربران');
      console.error(profilesError);
      setLoading(false);
      return;
    }

    // Fetch credits for all users
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('user_id, credits');

    if (creditsError) {
      console.error(creditsError);
    }

    // Merge data
    const usersWithCredits = (profiles || []).map(profile => {
      const userCredit = credits?.find(c => c.user_id === profile.id);
      return {
        ...profile,
        credits: userCredit?.credits ?? 0
      };
    });

    setUsers(usersWithCredits);
    setLoading(false);
  };

  const handleEditCredits = (user: UserWithCredits) => {
    setEditingUser(user);
    setCreditChange('');
  };

  const handleAddCredits = async () => {
    if (!editingUser || !creditChange) return;
    
    const amount = parseInt(creditChange);
    if (isNaN(amount) || amount <= 0) {
      toast.error('مقدار نامعتبر است');
      return;
    }

    setSaving(true);
    
    const newCredits = editingUser.credits + amount;
    
    // Check if user has credits record
    const { data: existing } = await supabase
      .from('user_credits')
      .select('id')
      .eq('user_id', editingUser.id)
      .maybeSingle();

    let error;
    if (existing) {
      const result = await supabase
        .from('user_credits')
        .update({ credits: newCredits, updated_at: new Date().toISOString() })
        .eq('user_id', editingUser.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('user_credits')
        .insert({ user_id: editingUser.id, credits: newCredits });
      error = result.error;
    }

    if (error) {
      toast.error('خطا در بروزرسانی اعتبار');
      console.error(error);
    } else {
      toast.success(`${amount} اعتبار به کاربر اضافه شد`);
      setEditingUser(null);
      fetchUsers();
    }
    
    setSaving(false);
  };

  const handleSubtractCredits = async () => {
    if (!editingUser || !creditChange) return;
    
    const amount = parseInt(creditChange);
    if (isNaN(amount) || amount <= 0) {
      toast.error('مقدار نامعتبر است');
      return;
    }

    if (amount > editingUser.credits) {
      toast.error('مقدار بیش از اعتبار فعلی است');
      return;
    }

    setSaving(true);
    
    const newCredits = editingUser.credits - amount;
    
    const { error } = await supabase
      .from('user_credits')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', editingUser.id);

    if (error) {
      toast.error('خطا در بروزرسانی اعتبار');
      console.error(error);
    } else {
      toast.success(`${amount} اعتبار از کاربر کم شد`);
      setEditingUser(null);
      fetchUsers();
    }
    
    setSaving(false);
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredUsers.map((user, index) => ({
      'ردیف': index + 1,
      'ایمیل': user.email || 'بدون ایمیل',
      'اعتبار': user.credits,
      'تاریخ ثبت‌نام': new Date(user.created_at).toLocaleDateString('fa-IR'),
      'شناسه کاربر': user.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'کاربران');
    XLSX.writeFile(workbook, `users-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('فایل اکسل دانلود شد');
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">مدیریت کاربران و اعتبار</h2>
          <span className="text-muted-foreground">
            ({filteredUsers.length} از {users.length})
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
          <Download className="w-4 h-4" />
          صادرات اکسل
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی ایمیل یا شناسه کاربر..."
          className="pr-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-12">#</TableHead>
                <TableHead className="text-right">ایمیل</TableHead>
                <TableHead className="text-right">اعتبار</TableHead>
                <TableHead className="text-right">تاریخ ثبت‌نام</TableHead>
                <TableHead className="text-left w-32">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'کاربری یافت نشد' : 'هنوز کاربری ثبت‌نام نکرده'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <span dir="ltr">{user.email || 'بدون ایمیل'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <span className="font-bold">{user.credits}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('fa-IR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCredits(user)}
                      >
                        ویرایش اعتبار
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Credits Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش اعتبار کاربر</DialogTitle>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">
                کاربر: <span dir="ltr">{editingUser.email}</span>
              </div>
              <div className="flex items-center gap-2 text-lg">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span>اعتبار فعلی: <strong>{editingUser.credits}</strong></span>
              </div>
              
              <div className="space-y-2">
                <Label>مقدار تغییر</Label>
                <Input
                  type="number"
                  min="1"
                  value={creditChange}
                  onChange={(e) => setCreditChange(e.target.value)}
                  placeholder="مثال: 10"
                  dir="ltr"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleSubtractCredits}
              disabled={saving || !creditChange}
              className="gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
              کم کردن
            </Button>
            <Button
              onClick={handleAddCredits}
              disabled={saving || !creditChange}
              className="gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              افزودن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersCreditsManager;
