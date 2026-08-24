import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Gem, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * A component that gates access to features based on user permissions.
 * Use this to wrap any feature that should be restricted by subscription tier.
 */
const FeatureGate = ({ 
  featureKey, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGateProps) => {
  const navigate = useNavigate();
  const { checkAccess, getCreditCost } = useFeaturePermissions();
  
  const access = checkAccess(featureKey);
  const creditCost = getCreditCost(featureKey);

  // User has access - render children
  if (access.hasAccess) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // No upgrade prompt - render nothing
  if (!showUpgradePrompt) {
    return null;
  }

  // Default locked state UI
  return (
    <Card className="glass-card border-primary/20 overflow-hidden">
      <CardContent className="p-6 relative">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
        
        <div className="relative z-20 text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          
          <h3 className="text-xl font-bold text-foreground mb-2">
            این قابلیت قفل است
          </h3>
          
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            {access.reason || 'برای دسترسی به این قابلیت، پلن خود را ارتقا دهید یا با مدیر سیستم تماس بگیرید.'}
          </p>

          {creditCost > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Gem className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                هزینه استفاده: <strong className="text-foreground">{creditCost}</strong> اعتبار
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              بازگشت
            </Button>
            <Button 
              className="glow-button text-foreground"
              onClick={() => navigate('/upgrade')}
            >
              <Crown className="w-4 h-4 ml-2" />
              مشاهده پلن‌ها
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeatureGate;
