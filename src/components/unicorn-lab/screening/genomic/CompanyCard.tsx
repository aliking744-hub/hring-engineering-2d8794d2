import { motion } from "framer-motion";
import { 
  Building2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Eye,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StartupEntry } from "./GenomicScreeningMain";

interface CompanyCardProps {
  company: StartupEntry;
  onStartAnalysis: () => void;
  onViewDetails: () => void;
}

const CompanyCard = ({ company, onStartAnalysis, onViewDetails }: CompanyCardProps) => {
  const getStatusBadge = () => {
    if (company.chapter_1_approved) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
          <CheckCircle2 className="w-3 h-3 ml-1" />
          تأیید شده
        </Badge>
      );
    }
    if (company.analysis_result) {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">
          <AlertCircle className="w-3 h-3 ml-1" />
          منتظر بررسی
        </Badge>
      );
    }
    if (company.status === 'processing') {
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
          <Clock className="w-3 h-3 ml-1 animate-spin" />
          در حال تحلیل
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 ml-1" />
        در انتظار
      </Badge>
    );
  };

  const getUScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 75) return 'text-teal-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <Card className="hover:border-primary/50 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground truncate">
                {company.company_name}
              </h3>
              {getStatusBadge()}
            </div>
            
            <p className="text-sm text-muted-foreground truncate mb-2">
              {company.company_url || 'بدون وب‌سایت'}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {company.u_score && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span className={`font-bold ${getUScoreColor(company.u_score)}`}>
                    U-Score: {company.u_score}
                  </span>
                </span>
              )}
              {company.current_valuation && (
                <span>
                  ارزش: {(company.current_valuation / 1000).toFixed(0)}B تومان
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(company.created_at).toLocaleDateString('fa-IR')}
              </span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            {!company.analysis_result ? (
              <Button onClick={onStartAnalysis}>
                <Play className="w-4 h-4 ml-2" />
                شروع تحلیل
              </Button>
            ) : (
              <Button variant="outline" onClick={onViewDetails}>
                <Eye className="w-4 h-4 ml-2" />
                مشاهده
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyCard;
