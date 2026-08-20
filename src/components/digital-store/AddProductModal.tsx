import { useState, useEffect, useRef } from 'react';
import { X, Upload, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DigitalProduct, useDigitalProducts } from '@/hooks/useDigitalProducts';
import { toast } from 'sonner';

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  editingProduct: DigitalProduct | null;
}

const categories = ['عمومی', 'قراردادها', 'قانونی', 'ارزیابی', 'آنبوردینگ', 'آموزش'];

const AddProductModal = ({ open, onClose, editingProduct }: AddProductModalProps) => {
  const { createProduct, updateProduct, uploadFile } = useDigitalProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    payment_link: '',
    category: 'عمومی',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        price: String(editingProduct.price),
        description: editingProduct.description || '',
        payment_link: editingProduct.payment_link || '',
        category: editingProduct.category || 'عمومی',
      });
    } else {
      setFormData({
        name: '',
        price: '',
        description: '',
        payment_link: '',
        category: 'عمومی',
      });
    }
    setFile(null);
  }, [editingProduct, open]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('فقط فایل‌های PDF و Excel مجاز هستند');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('حجم فایل نباید بیشتر از ۱۰ مگابایت باشد');
      return;
    }
    
    setFile(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-8 h-8 text-muted-foreground" />;
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      return <FileSpreadsheet className="w-8 h-8 text-emerald-400" />;
    }
    return <FileText className="w-8 h-8 text-sky-400" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('نام محصول الزامی است');
      return;
    }
    
    if (!formData.price || isNaN(Number(formData.price))) {
      toast.error('قیمت معتبر وارد کنید');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingProduct) {
        // Update existing product
        const updates: Record<string, unknown> = {
          name: formData.name.trim(),
          price: Number(formData.price),
          description: formData.description.trim() || null,
          payment_link: formData.payment_link.trim() || null,
          category: formData.category,
        };

        if (file) {
          updates.file_path = await uploadFile(file, editingProduct.id);
        }

        await updateProduct(editingProduct.id, updates);

        toast.success('محصول با موفقیت ویرایش شد');
      } else {
        // Create new product
        const newProduct = await createProduct({
          name: formData.name.trim(),
          price: Number(formData.price),
          description: formData.description.trim() || null,
          payment_link: formData.payment_link.trim() || null,
          category: formData.category,
          is_active: true,
        });

        if (file && newProduct) {
          const filePath = await uploadFile(file, newProduct.id);
          await updateProduct(newProduct.id, { file_path: filePath });
        }

        toast.success('محصول با موفقیت ایجاد شد');
      }

      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('خطا در ذخیره محصول');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {editingProduct ? 'ویرایش محصول' : 'افزودن محصول جدید'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">نام محصول *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثال: قرارداد کار تمام‌وقت"
              className="bg-secondary/50 border-border"
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price" className="text-foreground">قیمت (تومان) *</Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="مثال: 49000"
              className="bg-secondary/50 border-border"
              dir="ltr"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-foreground">دسته‌بندی</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">توضیحات</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="توضیح کوتاه درباره محصول..."
              className="bg-secondary/50 border-border min-h-[80px]"
            />
          </div>

          {/* Payment Link */}
          <div className="space-y-2">
            <Label htmlFor="payment_link" className="text-foreground">لینک پرداخت (زرین‌پال/زیبال)</Label>
            <Input
              id="payment_link"
              type="url"
              value={formData.payment_link}
              onChange={(e) => setFormData({ ...formData, payment_link: e.target.value })}
              placeholder="https://zarinp.al/..."
              className="bg-secondary/50 border-border"
              dir="ltr"
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-foreground">آپلود فایل (PDF / Excel)</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-6 cursor-pointer
                transition-all duration-200 text-center
                ${isDragging 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-2">
                {getFileIcon()}
                {file ? (
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p>فایل را بکشید و رها کنید</p>
                    <p>یا کلیک کنید</p>
                  </div>
                )}
              </div>

              {editingProduct?.has_file && !file && (
                <p className="text-xs text-primary mt-2">
                  فایل فعلی بارگذاری شده است{editingProduct.file_ext ? ` (${editingProduct.file_ext})` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 glow-button text-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  در حال ذخیره...
                </>
              ) : (
                editingProduct ? 'ذخیره تغییرات' : 'ایجاد محصول'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border"
            >
              انصراف
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductModal;
