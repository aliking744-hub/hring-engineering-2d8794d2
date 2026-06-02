import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Download,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from '@e965/xlsx';

interface ExcelUploaderProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface ParsedCompany {
  companyName: string;
  companyUrl?: string;
  linkedinUrl?: string;
  foundersBio?: string;
  currentValuation?: number;
  monthlyActiveUsers?: number;
  burnRate?: number;
  valid: boolean;
  error?: string;
}

const ExcelUploader = ({ onBack, onSuccess }: ExcelUploaderProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCompany[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = async (file: File) => {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      toast({
        title: "فرمت نامعتبر",
        description: "لطفاً فایل Excel یا CSV آپلود کنید",
        variant: "destructive"
      });
      return;
    }

    setFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const parsed: ParsedCompany[] = jsonData.map((row: any) => {
        const companyName = row['نام شرکت'] || row['company_name'] || row['name'] || '';
        
        return {
          companyName: String(companyName).trim(),
          companyUrl: row['وب‌سایت'] || row['company_url'] || row['url'] || '',
          linkedinUrl: row['لینکدین'] || row['linkedin_url'] || row['linkedin'] || '',
          foundersBio: row['بنیان‌گذاران'] || row['founders_bio'] || row['founders'] || '',
          currentValuation: Number(row['ارزش‌گذاری'] || row['valuation'] || 0) || undefined,
          monthlyActiveUsers: Number(row['کاربران'] || row['users'] || row['mau'] || 0) || undefined,
          burnRate: Number(row['نرخ سوختن'] || row['burn_rate'] || row['burn'] || 0) || undefined,
          valid: !!companyName,
          error: !companyName ? 'نام شرکت الزامی است' : undefined
        };
      });

      setParsedData(parsed);
      
      const validCount = parsed.filter(p => p.valid).length;
      toast({
        title: "فایل پردازش شد",
        description: `${validCount} شرکت از ${parsed.length} رکورد شناسایی شد`
      });

    } catch (err) {
      console.error('Error parsing file:', err);
      toast({
        title: "خطا در پردازش",
        description: "فایل قابل خواندن نیست",
        variant: "destructive"
      });
    }
  };

  const handleUpload = async () => {
    if (!user) {
      toast({ title: "خطا", description: "لطفاً ابتدا وارد شوید", variant: "destructive" });
      return;
    }

    const validCompanies = parsedData.filter(p => p.valid);
    if (validCompanies.length === 0) {
      toast({ title: "خطا", description: "هیچ شرکت معتبری یافت نشد", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < validCompanies.length; i++) {
        const company = validCompanies[i];
        
        await supabase.from('unicorn_analyses').insert({
          user_id: user.id,
          company_name: company.companyName,
          company_url: company.companyUrl || null,
          linkedin_url: company.linkedinUrl || null,
          founders_bio: company.foundersBio || null,
          current_valuation: company.currentValuation || null,
          monthly_active_users: company.monthlyActiveUsers || null,
          burn_rate: company.burnRate || null,
          chapter: 'screening',
          status: 'pending'
        });

        setUploadProgress(Math.round(((i + 1) / validCompanies.length) * 100));
      }

      toast({
        title: "آپلود کامل شد",
        description: `${validCompanies.length} شرکت به صف تحلیل اضافه شد`
      });

      onSuccess();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({
        title: "خطا در آپلود",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'نام شرکت': 'مثال: تالیا موبایل',
        'وب‌سایت': 'https://example.com',
        'لینکدین': 'https://linkedin.com/company/...',
        'بنیان‌گذاران': 'سوابق بنیان‌گذاران',
        'ارزش‌گذاری': 50000,
        'کاربران': 500000,
        'نرخ سوختن': 500
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Companies');
    XLSX.writeFile(wb, 'unicorn-lab-template.xlsx');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">آپلود لیست شرکت‌ها</h2>
          <p className="text-sm text-muted-foreground">فایل Excel یا CSV با اطلاعات استارتاپ‌ها</p>
        </div>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }`}
            >
              <FileSpreadsheet className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                فایل Excel یا CSV را اینجا رها کنید
              </h3>
              <p className="text-muted-foreground mb-4">
                یا کلیک کنید برای انتخاب فایل
              </p>
              <Button variant="outline" onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}>
                <Download className="w-4 h-4 ml-2" />
                دانلود قالب نمونه
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => { setFile(null); setParsedData([]); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Parsed Data Preview */}
              {parsedData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">پیش‌نمایش داده‌ها</h4>
                    <div className="flex gap-2">
                      <Badge variant="default" className="bg-emerald-500">
                        <Check className="w-3 h-3 ml-1" />
                        {parsedData.filter(p => p.valid).length} معتبر
                      </Badge>
                      {parsedData.filter(p => !p.valid).length > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 ml-1" />
                          {parsedData.filter(p => !p.valid).length} خطا
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {parsedData.slice(0, 10).map((company, index) => (
                      <div 
                        key={index}
                        className={`p-3 rounded-lg border ${
                          company.valid 
                            ? 'bg-secondary/30 border-border' 
                            : 'bg-destructive/10 border-destructive/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {company.valid ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                            <span className="font-medium text-foreground">
                              {company.companyName || '(بدون نام)'}
                            </span>
                          </div>
                          {company.companyUrl && (
                            <span className="text-xs text-muted-foreground">
                              {company.companyUrl}
                            </span>
                          )}
                        </div>
                        {company.error && (
                          <p className="text-xs text-destructive mt-1">{company.error}</p>
                        )}
                      </div>
                    ))}
                    {parsedData.length > 10 && (
                      <p className="text-center text-muted-foreground text-sm py-2">
                        و {parsedData.length - 10} شرکت دیگر...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    در حال آپلود... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={onBack} disabled={uploading}>
                  انصراف
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || parsedData.filter(p => p.valid).length === 0}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      در حال آپلود...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 ml-2" />
                      آپلود {parsedData.filter(p => p.valid).length} شرکت
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ExcelUploader;
