import { useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  User, 
  Camera, 
  Save, 
  Loader2, 
  ArrowRight,
  Mail,
  Briefcase,
  Building2,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { useSiteSettings } from "@/hooks/useSiteSettings";

// Resize image before upload
const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

const Profile = () => {
  const { user } = useAuth();
  const { context, refetch } = useUserContext();
  const { toast } = useToast();
  const { getSetting } = useSiteSettings();
  
  const [fullName, setFullName] = useState(context?.fullName || "");
  const [title, setTitle] = useState(context?.title || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(context?.fullName || "");
    setTitle(context?.title || "");
  }, [context?.fullName, context?.title]);

  // Dynamic texts
  const profilePageTitle = getSetting('profile_page_title', 'پروفایل کاربری');
  const profileBackBtn = getSetting('profile_back_btn', 'بازگشت به داشبورد');
  const profileAvatarHint = getSetting('profile_avatar_hint', 'برای تغییر تصویر، روی آن کلیک کنید');
  const profileEmailLabel = getSetting('profile_email_label', 'ایمیل');
  const profileNameLabel = getSetting('profile_name_label', 'نام و نام خانوادگی');
  const profileNamePlaceholder = getSetting('profile_name_placeholder', 'نام کامل خود را وارد کنید');
  const profileTitleLabel = getSetting('profile_title_label', 'عنوان شغلی');
  const profileTitlePlaceholder = getSetting('profile_title_placeholder', 'مثال: مدیر منابع انسانی');
  const profileSaveBtn = getSetting('profile_save_btn', 'ذخیره تغییرات');
  const profileCorporateLabel = getSetting('profile_corporate_label', 'حساب شرکتی');
  const profileRolePrefix = getSetting('profile_role_prefix', 'شما عضو یک حساب شرکتی هستید. نقش شما:');

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "خطا",
        description: "لطفاً یک فایل تصویری انتخاب کنید",
        variant: "destructive",
      });
      return;
    }

    // Max file size: 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "خطا",
        description: "حجم فایل نباید بیشتر از ۵ مگابایت باشد",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Resize image
      const resizedBlob = await resizeImage(file, 400, 400);
      
      // Create file path with user ID
      const filePath = `${user.id}/avatar.jpg`;
      
      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([filePath]);
      
      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, resizedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL (add timestamp to bust cache)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refetch();
      
      toast({
        title: "تصویر به‌روزرسانی شد",
        description: "تصویر پروفایل شما با موفقیت آپلود شد",
      });
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast({
        title: "خطا در آپلود",
        description: error instanceof Error ? error.message : "مشکلی در آپلود تصویر پیش آمد",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          title: title,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refetch();
      
      toast({
        title: "پروفایل به‌روزرسانی شد",
        description: "اطلاعات پروفایل شما با موفقیت ذخیره شد",
      });
    } catch (error: unknown) {
      console.error('Update error:', error);
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "مشکلی در ذخیره اطلاعات پیش آمد",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <>
      <Helmet>
        <title>{profilePageTitle} | HRing</title>
        <meta name="description" content="مشاهده و ویرایش پروفایل کاربری" />
      </Helmet>
      
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Back Button */}
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowRight className="w-4 h-4" />
            {profileBackBtn}
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="glass-card border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold">{profilePageTitle}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <Avatar className="w-28 h-28 border-4 border-primary/20">
                      <AvatarImage src={context?.avatarUrl || undefined} alt={fullName} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      ) : (
                        <Camera className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {profileAvatarHint}
                  </p>
                </div>

                {/* Profile Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email (Read Only) */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {profileEmailLabel}
                    </Label>
                    <Input 
                      value={user?.email || ""} 
                      disabled 
                      className="bg-secondary/50"
                    />
                  </div>

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {profileNameLabel}
                    </Label>
                    <Input 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={profileNamePlaceholder}
                    />
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      {profileTitleLabel}
                    </Label>
                    <Input 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={profileTitlePlaceholder}
                    />
                  </div>

                  {/* User Type Info */}
                  {context?.userType === 'corporate' && (
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 text-primary mb-2">
                        <Building2 className="w-5 h-5" />
                        <span className="font-medium">{profileCorporateLabel}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profileRolePrefix}{' '}
                        <span className="text-foreground font-medium">
                          {context.companyRole === 'ceo' && 'مدیرعامل'}
                          {context.companyRole === 'deputy' && 'معاون'}
                          {context.companyRole === 'manager' && 'مدیر'}
                          {context.companyRole === 'employee' && 'کارمند'}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        در حال ذخیره...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 ml-2" />
                        {profileSaveBtn}
                      </>
                    )}
                  </Button>
                </form>

                <div className="border-t border-border/60 pt-5">
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <Link to="/security">
                      <ShieldCheck className="h-4 w-4" />
                      امنیت حساب و ورود دومرحله‌ای
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Profile;
