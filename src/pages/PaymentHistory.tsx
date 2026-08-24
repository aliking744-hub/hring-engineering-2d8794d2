import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { 
  Receipt, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  CreditCard,
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import Navbar from '@/components/Navbar';
import AuroraBackground from '@/components/AuroraBackground';

interface PaymentTransaction {
  id: string;
  amount_toman: number;
  plan_type: string;
  status: string;
  ref_id: string | null;
  created_at: string;
  description: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  individual_free: 'رایگان',
  individual_pro: 'حرفه‌ای',
  individual_plus: 'پلاس',
  corporate_expert: 'شرکتی - کارشناس',
  corporate_decision_support: 'پشتیبان تصمیم',
  corporate_decision_making: 'تصمیم‌ساز',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  verified: { label: 'موفق', icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default' },
  pending: { label: 'در انتظار', icon: <Clock className="h-4 w-4" />, variant: 'secondary' },
  failed: { label: 'ناموفق', icon: <XCircle className="h-4 w-4" />, variant: 'destructive' },
  cancelled: { label: 'لغوشده', icon: <XCircle className="h-4 w-4" />, variant: 'outline' },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('fa-IR').format(price);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function PaymentHistory() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await apiRequest<PaymentTransaction[]>('/billing/payments');
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'خطا در دریافت تاریخچه',
        description: error instanceof Error ? error.message : 'تاریخچه پرداخت دریافت نشد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const totalPaid = transactions
    .filter(t => t.status === 'verified')
    .reduce((sum, t) => sum + t.amount_toman, 0);

  const successfulPayments = transactions.filter(t => t.status === 'verified').length;

  return (
    <>
      <Helmet>
        <title>تاریخچه پرداخت‌ها | HRing</title>
        <meta name="description" content="مشاهده تاریخچه پرداخت‌ها و فاکتورها" />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        <AuroraBackground />
        <div className="relative z-10">
          <Navbar />
          
          <div className="container mx-auto px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">تاریخچه پرداخت‌ها</h1>
                  <p className="text-muted-foreground">
                    مشاهده تمام تراکنش‌ها و فاکتورهای شما
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/dashboard" className="gap-2">
                      <ArrowRight className="w-4 h-4" />
                      بازگشت به داشبورد
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/upgrade">
                      <CreditCard className="h-4 w-4 ml-2" />
                      ارتقای پلن
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      مجموع پرداختی
                    </CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPrice(totalPaid)} <span className="text-sm font-normal">تومان</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      پرداخت‌های موفق
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{successfulPayments}</div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل تراکنش‌ها
                    </CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{transactions.length}</div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Transactions Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    لیست تراکنش‌ها
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">هنوز تراکنشی ندارید</h3>
                      <p className="text-muted-foreground mb-4">
                        با ارتقای پلن، اولین پرداخت شما در اینجا نمایش داده می‌شود
                      </p>
                      <Button asChild>
                        <Link to="/upgrade">
                          ارتقای پلن
                          <ArrowRight className="h-4 w-4 mr-2" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">تاریخ</TableHead>
                            <TableHead className="text-right">پلن</TableHead>
                            <TableHead className="text-right">مبلغ</TableHead>
                            <TableHead className="text-right">وضعیت</TableHead>
                            <TableHead className="text-right">کد پیگیری</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((transaction) => {
                            const statusConfig = STATUS_CONFIG[transaction.status] || STATUS_CONFIG.pending;
                            return (
                              <TableRow key={transaction.id}>
                                <TableCell className="font-medium">
                                  {formatDate(transaction.created_at)}
                                </TableCell>
                                <TableCell>
                                  {PLAN_NAMES[transaction.plan_type] || transaction.plan_type}
                                </TableCell>
                                <TableCell>
                                  {formatPrice(transaction.amount_toman)} تومان
                                </TableCell>
                                <TableCell>
                                  <Badge variant={statusConfig.variant} className="gap-1">
                                    {statusConfig.icon}
                                    {statusConfig.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {transaction.ref_id || '-'}
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
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
