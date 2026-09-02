import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Sparkles, Download, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from '@e965/xlsx';
import { Employee } from '@/types/employee';
import { parseExcelData, generateSampleData } from '@/utils/sampleData';
import logo from '@/assets/logo.png';

interface UploadPageProps {
  onDataLoaded: (data: Employee[], name: string) => Promise<void>;
  historySlot?: React.ReactNode;
}

export function UploadPage({ onDataLoaded, historySlot }: UploadPageProps) {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: 'خطا',
        description: 'لطفا یک فایل اکسل (xlsx یا xls) انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

      const employees = parseExcelData(jsonData);

      toast({
        title: 'موفقیت',
        description: `${employees.length} رکورد با موفقیت بارگذاری شد`,
      });

      await onDataLoaded(employees, file.name);
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'مشکلی در خواندن فایل اکسل پیش آمد',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDemoData = useCallback(async () => {
    setIsLoading(true);
    const sampleData = generateSampleData(78);
    toast({
      title: 'داده نمونه',
      description: '78 رکورد نمونه بارگذاری شد',
    });
    try {
      await onDataLoaded(sampleData, `داده نمونه - ${new Date().toLocaleDateString('fa-IR')}`);
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded]);

  const handleDownloadTemplate = useCallback(() => {
    const templateData = [
      {
        'ردیف': 1,
        'کد پرسنلی': '10001',
        'نام': '(اختیاری)',
        'نام خانوادگی': '(اختیاری)',
        'جنسیت': 'مرد یا زن',
        'تاریخ تولد': '1370/01/15',
        'ماه تولد': 'فروردین',
        'مدرک تحصیلی': 'لیسانس',
        'رشته تحصیلی': 'مهندسی کامپیوتر',
        'وضعیت تاهل': 'متاهل یا مجرد',
        'تعداد فرزندان': 0,
        'معاونت': 'معاونت فناوری',
        'جایگاه شغلی': 'کارشناس',
        'نوع استخدام': 'قراردادی',
        'تاریخ استخدام': '1395/06/01',
        'محل فعالیت': 'ستاد یا پروژه',
        'منطقه': 1,
        'حقوق پرداختی': 50000000,
        'حقوق قراردادی': 45000000,
        'اضافه کار': 20,
        'امتیاز ارزشیابی': 85,
        'ارزیابی مدیرعامل': 80,
        'ارزیابی فردی': 90,
        'ارزیابی معاونت': 85,
        'ارزیابی مدیر مستقیم': 82,
        'عملکرد': 88,
        'دانش و تخصص': 85,
        'تعامل و رفتار': 90,
        'مسئولیت و وفاداری': 87,
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'کارمندان');

    worksheet['!cols'] = Object.keys(templateData[0]).map(() => ({ wch: 20 }));

    XLSX.writeFile(workbook, 'نمونه_اطلاعات_کارمندان.xlsx');

    toast({
      title: 'دانلود موفق',
      description: 'فایل نمونه اکسل دانلود شد',
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-300 relative" dir="rtl">
      {/* Top Bar */}
      <div className="absolute top-4 right-4 left-4 flex justify-between items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به پنل کاربری</span>
        </Button>
        {historySlot}
      </div>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 blur-2xl opacity-60 bg-primary/30 rounded-full animate-pulse" />
            <img
              src={logo}
              alt="hring logo"
              className="h-16 md:h-20 w-auto relative z-10"
            />
          </div>
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
            داشبورد منابع انسانی
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            فایل اکسل خود را آپلود کنید تا داشبورد تحلیلی خود را مشاهده کنید
          </p>
        </div>

        {/* Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            rounded-2xl p-8 md:p-12 text-center
            border-2 border-dashed transition-all duration-300 cursor-pointer
            bg-card/50 backdrop-blur-sm
            ${isDragging
              ? 'border-primary bg-primary/10 scale-105'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }
          `}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
            id="file-input"
          />

          <label htmlFor="file-input" className="cursor-pointer">
            <div className={`
              inline-flex items-center justify-center w-16 h-16 rounded-xl mb-6 transition-all
              ${isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted'}
            `}>
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className={`w-8 h-8 ${isDragging ? 'text-primary-foreground' : 'text-primary'}`} />
              )}
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-2">
              {isDragging ? 'فایل را رها کنید' : 'فایل اکسل را اینجا رها کنید'}
            </h3>
            <p className="text-muted-foreground mb-4">
              یا کلیک کنید تا فایل را انتخاب کنید
            </p>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="w-4 h-4" />
              <span>فرمت‌های پشتیبانی شده: XLSX, XLS</span>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Download Template Button */}
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="gap-2 px-6 py-3 border-accent/50 hover:bg-accent/10"
          >
            <Download className="w-4 h-4 text-accent" />
            <span>دانلود فایل نمونه اکسل</span>
          </Button>

          {/* Demo Button */}
          <Button
            onClick={handleDemoData}
            className="gap-2 px-6 py-3"
          >
            <Sparkles className="w-4 h-4" />
            <span>مشاهده با داده نمونه</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          فایل نمونه را دانلود کنید، اطلاعات کارمندان را پر کنید و آپلود کنید
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-12">
          {[
            { title: 'نمودارهای متنوع', desc: 'پای، میله‌ای، گیج' },
            { title: 'فیلترهای پیشرفته', desc: 'جنسیت، تحصیلات، معاونت' },
            { title: 'گزارش‌های جامع', desc: 'حقوق، اضافه کار، ارزیابی' },
          ].map((feature, i) => (
            <div key={i} className="rounded-lg p-4 text-center bg-card/50 backdrop-blur-sm border border-border">
              <h4 className="text-sm font-medium text-foreground mb-1">{feature.title}</h4>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
