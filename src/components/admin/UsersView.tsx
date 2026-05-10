import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, User, KeyRound, Pencil, UserPlus } from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  full_name?: string | null;
  created_at: string;
}

const UsersView = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('خطا در دریافت لیست کاربران');
      console.error(error);
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const callAdmin = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-manage-users', { body: payload });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleCreate = async () => {
    if (!newEmail || !newPassword) {
      toast.error('ایمیل و رمز عبور الزامی است');
      return;
    }
    setBusy(true);
    try {
      await callAdmin({
        action: 'create',
        email: newEmail.trim(),
        password: newPassword,
        fullName: newFullName.trim(),
      });
      toast.success('کاربر با موفقیت ایجاد شد');
      setCreateOpen(false);
      setNewEmail(''); setNewPassword(''); setNewFullName('');
      fetchProfiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در ایجاد کاربر');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: Profile) => {
    setEditTarget(p);
    setEditEmail(p.email || '');
    setEditFullName(p.full_name || '');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await callAdmin({
        action: 'update_profile',
        userId: editTarget.id,
        email: editEmail.trim(),
        fullName: editFullName.trim(),
      });
      toast.success('اطلاعات کاربر به‌روزرسانی شد');
      setEditOpen(false);
      fetchProfiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در به‌روزرسانی');
    } finally {
      setBusy(false);
    }
  };

  const openReset = (p: Profile) => {
    setResetTarget(p);
    setResetPwd('');
    setResetOpen(true);
  };

  const handleReset = async () => {
    if (!resetTarget || resetPwd.length < 6) {
      toast.error('رمز عبور باید حداقل ۶ کاراکتر باشد');
      return;
    }
    setBusy(true);
    try {
      await callAdmin({
        action: 'reset_password',
        userId: resetTarget.id,
        newPassword: resetPwd,
      });
      toast.success('رمز عبور با موفقیت تغییر کرد');
      setResetOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در تغییر رمز عبور');
    } finally {
      setBusy(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">کاربران ثبت‌نام شده</h2>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{profiles.length} کاربر</span>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            افزودن کاربر
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-12">#</TableHead>
                <TableHead className="text-right">کاربر</TableHead>
                <TableHead className="text-right">تاریخ ثبت‌نام</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    هنوز کاربری ثبت‌نام نکرده
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile, index) => (
                  <TableRow key={profile.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm">{profile.full_name || '—'}</span>
                          <span dir="ltr" className="text-xs text-muted-foreground">
                            {profile.email || 'بدون ایمیل'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString('fa-IR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(profile)} className="gap-1">
                          <Pencil className="w-3.5 h-3.5" />
                          ویرایش
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openReset(profile)} className="gap-1">
                          <KeyRound className="w-3.5 h-3.5" />
                          ریست رمز
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن کاربر جدید</DialogTitle>
            <DialogDescription>کاربر بلافاصله فعال می‌شود و می‌تواند با این اطلاعات وارد شود.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>نام و نام خانوادگی</Label>
              <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="اختیاری" />
            </div>
            <div>
              <Label>ایمیل</Label>
              <Input dir="ltr" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>رمز عبور</Label>
              <Input dir="ltr" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="حداقل ۶ کاراکتر" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>انصراف</Button>
            <Button onClick={handleCreate} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              ایجاد کاربر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش کاربر</DialogTitle>
            <DialogDescription>تغییر ایمیل و نام کاربر.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>نام و نام خانوادگی</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>
            <div>
              <Label>ایمیل</Label>
              <Input dir="ltr" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>انصراف</Button>
            <Button onClick={handleEdit} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ریست رمز عبور</DialogTitle>
            <DialogDescription>
              تنظیم رمز عبور جدید برای: <span dir="ltr">{resetTarget?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>رمز عبور جدید</Label>
            <Input dir="ltr" type="text" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="حداقل ۶ کاراکتر" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={busy}>انصراف</Button>
            <Button onClick={handleReset} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              تغییر رمز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersView;
