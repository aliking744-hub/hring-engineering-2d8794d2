import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Users,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface VerificationResult {
  category: string;
  icon: any;
  title: string;
  status: 'verified' | 'warning' | 'failed' | 'pending';
  claimed: string;
  verified: string;
  accuracy: number;
  details: string;
}

interface DigitalInterrogationProps {
  companyName: string;
  claims: {
    revenue?: number;
    employees?: number;
    users?: number;
  };
  onComplete: (results: VerificationResult[]) => void;
}

const DigitalInterrogation = ({ companyName, claims, onComplete }: DigitalInterrogationProps) => {
  const [verifying, setVerifying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);

  const verificationSteps: VerificationResult[] = [
    {
      category: 'financial',
      icon: FileCheck,
      title: 'تست پول واقعی',
      status: 'pending',
      claimed: claims.revenue ? `${claims.revenue} میلیون تومان` : 'عدم ارائه',
      verified: '-',
      accuracy: 0,
      details: 'بررسی داده‌های شاپرک و مالیات'
    },
    {
      category: 'employees',
      icon: Users,
      title: 'تست نیروی انسانی',
      status: 'pending',
      claimed: claims.employees ? `${claims.employees} نفر` : 'عدم ارائه',
      verified: '-',
      accuracy: 0,
      details: 'بررسی لیست بیمه تأمین اجتماعی'
    },
    {
      category: 'sentiment',
      icon: MessageSquare,
      title: 'تست رضایت واقعی',
      status: 'pending',
      claimed: '-',
      verified: '-',
      accuracy: 0,
      details: 'تحلیل کامنت‌های منفی و شکایات'
    },
    {
      category: 'organic',
      icon: TrendingUp,
      title: 'شاخص رشد ارگانیک',
      status: 'pending',
      claimed: claims.users ? `${claims.users} کاربر` : 'عدم ارائه',
      verified: '-',
      accuracy: 0,
      details: 'نسبت رشد بدون تبلیغات'
    },
  ];

  const getStatusIcon = (status: VerificationResult['status']) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: VerificationResult['status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-emerald-500/20 text-emerald-400">تأیید شد</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/20 text-amber-400">هشدار</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400">رد شد</Badge>;
      default:
        return <Badge variant="secondary">در انتظار</Badge>;
    }
  };

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">اتاق بازجویی دیجیتال</CardTitle>
            <p className="text-sm text-muted-foreground">
              تطبیق متقاطع ادعاها با داده‌های واقعی - {companyName}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {verificationSteps.map((step, index) => {
          const Icon = step.icon;
          const result = results.find(r => r.category === step.category);
          const currentResult = result || step;
          
          return (
            <motion.div
              key={step.category}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border transition-all ${
                currentResult.status === 'verified' ? 'bg-emerald-500/10 border-emerald-500/30' :
                currentResult.status === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                currentResult.status === 'failed' ? 'bg-red-500/10 border-red-500/30' :
                'bg-secondary/50 border-border'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground">{currentResult.title}</h4>
                    {getStatusBadge(currentResult.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{currentResult.details}</p>
                </div>
                
                <div className="text-left">
                  <div className="text-xs text-muted-foreground mb-1">ادعا</div>
                  <div className="font-medium text-foreground">{currentResult.claimed}</div>
                </div>
                
                <div className="text-left">
                  <div className="text-xs text-muted-foreground mb-1">تأیید</div>
                  <div className="font-medium text-foreground">{currentResult.verified}</div>
                </div>
                
                {currentResult.status !== 'pending' && (
                  <div className="w-24">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">دقت</span>
                      <span className={`font-bold ${
                        currentResult.accuracy >= 80 ? 'text-emerald-400' :
                        currentResult.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>{currentResult.accuracy}%</span>
                    </div>
                    <Progress value={currentResult.accuracy} className="h-1.5" />
                  </div>
                )}
                
                {getStatusIcon(currentResult.status)}
              </div>
            </motion.div>
          );
        })}
        
        <div className="pt-4 border-t border-border text-center text-sm text-muted-foreground">
          <ShieldAlert className="w-4 h-4 inline-block ml-1" />
          تطبیق متقاطع با منابع رسمی (شاپرک، بیمه، مالیات) در حال توسعه است
        </div>
      </CardContent>
    </Card>
  );
};

export default DigitalInterrogation;
