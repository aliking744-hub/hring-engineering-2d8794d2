import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  Copy,
  CreditCard,
  Edit,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/hooks/useCompany';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';
import { CompanyRole, ROLE_NAMES } from '@/types/multiTenant';
import { toast } from 'sonner';

interface CreatedCompanyUser {
  id: string;
  email: string;
  full_name: string | null;
  role: CompanyRole;
}

const MANAGED_ROLES: CompanyRole[] = ['deputy', 'manager', 'employee'];

const CompanyMembers = () => {
  const { context, loading: contextLoading, refetch: refetchContext } = useUserContext();
  const {
    company,
    members,
    invites,
    loading,
    isCEO,
    canInvite,
    createInvite,
    removeMember,
    updateMemberRole,
    toggleInvitePermission,
    deactivateInvite,
    refetch,
  } = useCompany();

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [newRole, setNewRole] = useState<CompanyRole>('employee');
  const [initialCredits, setInitialCredits] = useState(0);
  const [creditAmount, setCreditAmount] = useState(0);

  const [inviteRole, setInviteRole] = useState<CompanyRole>('employee');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);

  const [targetUser, setTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');

  const permissions = context?.companyPermissions || [];
  const canReadMembers = permissions.includes('company.members.read');
  const canManageMembers = permissions.includes('company.members.manage');
  const canManageInvites = permissions.includes('company.invites.manage') || canInvite;

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (a.role === 'ceo' ? -1 : b.role === 'ceo' ? 1 : 0)),
    [members],
  );

  const refreshAll = async () => {
    await Promise.all([refetch(), refetchContext()]);
  };

  const createUser = async () => {
    if (!context?.companyId) return;
    if (!email.trim() || !fullName.trim() || password.length < 10) {
      toast.error('ایمیل، نام و رمز حداقل ۱۰ کاراکتری الزامی است');
      return;
    }
    setBusy(true);
    try {
      await apiRequest<CreatedCompanyUser>(`/companies/${context.companyId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role: newRole,
          initial_credits: initialCredits,
        }),
      });
      toast.success('کاربر شرکت ایجاد شد');
      setCreateOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setNewRole('employee');
      setInitialCredits(0);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت کاربر انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const createNewInvite = async () => {
    setBusy(true);
    try {
      const result = await createInvite(inviteRole, inviteMaxUses, 7);
      if (!result) throw new Error('ساخت دعوت‌نامه انجام نشد');
      toast.success('دعوت‌نامه ساخته شد');
      setInviteOpen(false);
      setInviteRole('employee');
      setInviteMaxUses(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در ساخت دعوت‌نامه');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!context?.companyId || !targetUser || newPassword.length < 10) return;
    setBusy(true);
    try {
      await apiRequest<void>(
        `/companies/${context.companyId}/users/${targetUser.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ new_password: newPassword }),
        },
      );
      toast.success('رمز عبور تغییر کرد و نشست‌های قبلی کاربر بسته شد');
      setPasswordOpen(false);
      setNewPassword('');
      setTargetUser(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر رمز انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const updateProfile = async () => {
    if (!context?.companyId || !targetUser) return;
    setBusy(true);
    try {
      await apiRequest(`/companies/${context.companyId}/users/${targetUser.id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: editName.trim() || null,
          title: editTitle.trim() || null,
        }),
      });
      toast.success('پروفایل کاربر به‌روزرسانی شد');
      setProfileOpen(false);
      setTargetUser(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ویرایش پروفایل انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const allocateCredits = async () => {
    if (!context?.companyId || !targetMemberId || creditAmount <= 0) return;
    setBusy(true);
    try {
      await apiRequest<void>(
        `/companies/${context.companyId}/members/${targetMemberId}/credits`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: creditAmount,
            reason: 'تخصیص اعتبار توسط مدیر شرکت',
          }),
        },
      );
      toast.success('اعتبار به حساب کاربر منتقل شد');
      setCreditOpen(false);
      setCreditAmount(0);
      setTargetMemberId(null);
      setTargetUser(null);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تخصیص اعتبار انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberId: string) => {
    if (!window.confirm('این کاربر از شرکت غیرفعال شود؟')) return;
    const ok = await removeMember(memberId);
    ok ? toast.success('کاربر غیرفعال شد') : toast.error('عملیات انجام نشد');
  };

  const copyInvite = async (code: string) => {
    const url = `${window.location.origin}/auth?invite=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(url);
    toast.success('لینک دعوت کپی شد');
  };

  if (contextLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!context?.companyId || !company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-bold">حساب شرکتی یافت نشد</h2>
            <p className="mb-5 text-sm text-muted-foreground">این حساب عضو هیچ شرکت فعالی نیست.</p>
            <Button asChild><Link to="/dashboard">بازگشت به داشبورد</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>مدیریت کاربران | {company.name}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/dashboard"><ChevronLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">مدیریت کاربران شرکت</h1>
                <p className="text-sm text-muted-foreground">{company.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void refreshAll()}>
                <RefreshCw className="ml-2 h-4 w-4" /> تازه‌سازی
              </Button>
              {canManageInvites && (
                <Button variant="outline" onClick={() => setInviteOpen(true)}>
                  <Link2 className="ml-2 h-4 w-4" /> دعوت‌نامه
                </Button>
              )}
              {canManageMembers && (
                <Button onClick={() => setCreateOpen(true)}>
                  <UserPlus className="ml-2 h-4 w-4" /> کاربر جدید
                </Button>
              )}
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">اعضای فعال</div><div className="mt-1 text-2xl font-bold">{members.length} / {company.max_members}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">نقش شما</div><div className="mt-1 text-lg font-bold">{context.companyRole ? ROLE_NAMES[context.companyRole] : '—'}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">دعوت‌نامه فعال</div><div className="mt-1 text-2xl font-bold">{invites.length}</div></CardContent></Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> اعضا</CardTitle>
              <CardDescription>اطلاعات این جدول فقط از tenant فعلی خوانده می‌شود.</CardDescription>
            </CardHeader>
            <CardContent>
              {!canReadMembers ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                  سطح دسترسی مشاهده اعضا برای نقش شما فعال نیست.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>کاربر</TableHead><TableHead>نقش</TableHead><TableHead>دعوت</TableHead><TableHead className="text-left">عملیات</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sortedMembers.map((member) => {
                        const protectedCeo = member.role === 'ceo';
                        const name = member.profile?.full_name || member.profile?.email || member.user_id;
                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="font-medium">{name}</div>
                              <div className="text-xs text-muted-foreground">{member.profile?.email}</div>
                              {member.profile?.title && <div className="text-xs text-muted-foreground">{member.profile.title}</div>}
                            </TableCell>
                            <TableCell>
                              {canManageMembers && !protectedCeo ? (
                                <Select value={member.role} onValueChange={(value) => void updateMemberRole(member.id, value as CompanyRole)}>
                                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                  <SelectContent>{MANAGED_ROLES.map((role) => <SelectItem key={role} value={role}>{ROLE_NAMES[role]}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : <Badge>{ROLE_NAMES[member.role]}</Badge>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={member.can_invite || protectedCeo}
                                  disabled={!isCEO || protectedCeo}
                                  onCheckedChange={(checked) => void toggleInvitePermission(member.id, checked)}
                                />
                                <span className="text-xs text-muted-foreground">{member.can_invite || protectedCeo ? 'مجاز' : 'غیرفعال'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {canManageMembers && !protectedCeo && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setTargetUser({ id: member.user_id, name });
                                      setEditName(member.profile?.full_name || '');
                                      setEditTitle(member.profile?.title || '');
                                      setProfileOpen(true);
                                    }}
                                  ><Edit className="h-4 w-4" /></Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setTargetUser({ id: member.user_id, name });
                                      setTargetMemberId(member.id);
                                      setPasswordOpen(true);
                                    }}
                                  ><KeyRound className="h-4 w-4" /></Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="تخصیص اعتبار"
                                    onClick={() => {
                                      setTargetUser({ id: member.user_id, name });
                                      setTargetMemberId(member.id);
                                      setCreditAmount(0);
                                      setCreditOpen(true);
                                    }}
                                  ><CreditCard className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void remove(member.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {(canManageInvites || invites.length > 0) && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> دعوت‌نامه‌ها</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {invites.length === 0 && <p className="text-sm text-muted-foreground">دعوت‌نامه فعالی وجود ندارد.</p>}
                {invites.map((invite) => (
                  <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                    <div>
                      <div className="flex items-center gap-2"><code className="font-bold">{invite.invite_code}</code><Badge variant="secondary">{ROLE_NAMES[invite.role]}</Badge></div>
                      <p className="mt-1 text-xs text-muted-foreground">استفاده: {invite.used_count} / {invite.max_uses ?? '∞'}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => void copyInvite(invite.invite_code)}><Copy className="ml-2 h-4 w-4" /> کپی لینک</Button>
                      {canManageInvites && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void deactivateInvite(invite.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>ساخت کاربر شرکتی</DialogTitle><DialogDescription>این حساب مستقیماً داخل tenant فعلی ساخته می‌شود.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>نام و نام خانوادگی</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>ایمیل</Label><Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>رمز عبور اولیه</Label><Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} /></div>
            <div><Label>نقش</Label><Select value={newRole} onValueChange={(v) => setNewRole(v as CompanyRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MANAGED_ROLES.map((role) => <SelectItem key={role} value={role}>{ROLE_NAMES[role]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>اعتبار اولیه کاربر</Label><Input type="number" min={0} value={initialCredits} onChange={(e) => setInitialCredits(Math.max(0, Number(e.target.value) || 0))} /><p className="mt-1 text-xs text-muted-foreground">از اعتبار شرکت کم و به حساب شخصی این کاربر منتقل می‌شود.</p></div>
          </div>
          <DialogFooter><Button onClick={() => void createUser()} disabled={busy}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ساخت کاربر</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>دعوت‌نامه جدید</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>نقش</Label><Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MANAGED_ROLES.map((role) => <SelectItem key={role} value={role}>{ROLE_NAMES[role]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>حداکثر تعداد استفاده</Label><Input type="number" min={1} max={1000} value={inviteMaxUses} onChange={(e) => setInviteMaxUses(Number(e.target.value) || 1)} /></div>
          </div>
          <DialogFooter><Button onClick={() => void createNewInvite()} disabled={busy}>ساخت دعوت‌نامه</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تخصیص اعتبار به {targetUser?.name}</DialogTitle>
            <DialogDescription>این مقدار از مانده شرکت کم و به حساب شخصی کاربر منتقل می‌شود.</DialogDescription>
          </DialogHeader>
          <div><Label>تعداد اعتبار</Label><Input type="number" min={1} value={creditAmount} onChange={(e) => setCreditAmount(Math.max(0, Number(e.target.value) || 0))} /></div>
          <DialogFooter><Button onClick={() => void allocateCredits()} disabled={busy || creditAmount <= 0}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تخصیص اعتبار</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>تغییر رمز {targetUser?.name}</DialogTitle><DialogDescription>پس از تغییر رمز، تمام نشست‌های قبلی این کاربر لغو می‌شود.</DialogDescription></DialogHeader>
          <Input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} placeholder="رمز جدید" />
          <DialogFooter><Button onClick={() => void resetPassword()} disabled={busy || newPassword.length < 10}>تغییر رمز</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>ویرایش پروفایل {targetUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4"><div><Label>نام</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div><div><Label>عنوان شغلی</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div></div>
          <DialogFooter><Button onClick={() => void updateProfile()} disabled={busy}>ذخیره</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompanyMembers;
