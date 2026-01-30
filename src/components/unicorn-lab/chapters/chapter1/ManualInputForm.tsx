import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  Building2,
  Link2,
  Linkedin,
  FileText,
  Upload,
  DollarSign,
  Users,
  Flame,
  Loader2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ManualInputFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ManualInputForm = ({ onBack, onSuccess }: ManualInputFormProps) => {
  const [formData, setFormData] = useState({
    companyName: '',
    companyUrl: '',
    linkedinUrl: '',
    foundersBio: '',
    currentValuation: '',
    monthlyActiveUsers: '',
    burnRate: '',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      toast({
        title: "خطا",
        description: "نام شرکت الزامی است",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "خطا",
        description: "لطفاً ابتدا وارد شوید",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('unicorn_analyses')
        .insert({
          user_id: user.id,
          company_name: formData.companyName,
          company_url: formData.companyUrl || null,
          linkedin_url: formData.linkedinUrl || null,
          founders_bio: formData.foundersBio || null,
          current_valuation: formData.currentValuation ? Number(formData.currentValuation) : null,
          monthly_active_users: formData.monthlyActiveUsers ? Number(formData.monthlyActiveUsers) : null,
          burn_rate: formData.burnRate ? Number(formData.burnRate) : null,
          chapter: 'chapter_1',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "ثبت شد",
        description: "شرکت با موفقیت به صف تحلیل اضافه شد",
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error creating analysis:', err);
      toast({
        title: "خطا",
        description: err.message || "خطا در ثبت اطلاعات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle>اتاق دریافت اطلاعات دیجیتال</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">ورود دستی اطلاعات شرکت</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Building2 className="w-5 h-5 text-primary" />
                هویت شرکت
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>نام شرکت *</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="مثال: تالیا موبایل"
                    className="mt-1 bg-secondary/50"
                  />
                </div>
                <div>
                  <Label>آدرس وب‌سایت</Label>
                  <Input
                    value={formData.companyUrl}
                    onChange={(e) => setFormData({ ...formData, companyUrl: e.target.value })}
                    placeholder="https://example.com"
                    className="mt-1 bg-secondary/50"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <Label>لینکدین شرکت</Label>
                <Input
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                  className="mt-1 bg-secondary/50"
                  dir="ltr"
                />
              </div>

              <div>
                <Label>بیوگرافی بنیان‌گذاران</Label>
                <Textarea
                  value={formData.foundersBio}
                  onChange={(e) => setFormData({ ...formData, foundersBio: e.target.value })}
                  placeholder="سوابق، تجربیات و دستاوردهای بنیان‌گذاران..."
                  className="mt-1 bg-secondary/50 min-h-[100px]"
                />
              </div>
            </div>

            {/* Metrics Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                شاخص‌های کلیدی
              </div>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>ارزش‌گذاری (میلیون تومان)</Label>
                  <Input
                    type="number"
                    value={formData.currentValuation}
                    onChange={(e) => setFormData({ ...formData, currentValuation: e.target.value })}
                    placeholder="50000"
                    className="mt-1 bg-secondary/50"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>کاربران فعال ماهانه</Label>
                  <Input
                    type="number"
                    value={formData.monthlyActiveUsers}
                    onChange={(e) => setFormData({ ...formData, monthlyActiveUsers: e.target.value })}
                    placeholder="500000"
                    className="mt-1 bg-secondary/50"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>نرخ سوختن ماهانه (میلیون تومان)</Label>
                  <Input
                    type="number"
                    value={formData.burnRate}
                    onChange={(e) => setFormData({ ...formData, burnRate: e.target.value })}
                    placeholder="500"
                    className="mt-1 bg-secondary/50"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <FileText className="w-5 h-5 text-accent" />
                مستندات (اختیاری)
              </div>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="border-2 border-dashed border-border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer bg-secondary/20 text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">Pitch Deck</p>
                  <p className="text-xs text-muted-foreground">PDF</p>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer bg-secondary/20 text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">صورت‌های مالی</p>
                  <p className="text-xs text-muted-foreground">Excel</p>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer bg-secondary/20 text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">لیست کارکنان</p>
                  <p className="text-xs text-muted-foreground">Excel/CSV</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={onBack}>
                انصراف
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    در حال ثبت...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 ml-2" />
                    ثبت و افزودن به صف تحلیل
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ManualInputForm;
