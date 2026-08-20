import { useState } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Download, 
  Eye, 
  EyeOff,
  FileSpreadsheet,
  FileText,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DigitalProduct, useDigitalProducts } from '@/hooks/useDigitalProducts';
import { toast } from 'sonner';
import AddProductModal from './AddProductModal';

const AdminProductTable = () => {
  const { products, loading, deleteProduct, updateProduct, downloadFile, incrementDownloadCount } = useDigitalProducts();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DigitalProduct | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price);
  };

  const getFileIcon = (filePath: string | null) => {
    if (!filePath) return <FileText className="w-4 h-4" />;
    if (filePath.includes('.xlsx') || filePath.includes('.xls')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    return <FileText className="w-4 h-4 text-sky-400" />;
  };

  const handleDelete = async (product: DigitalProduct) => {
    if (!confirm(`آیا از حذف "${product.name}" مطمئن هستید؟`)) return;
    
    try {
      setDeletingId(product.id);
      await deleteProduct(product.id);
      toast.success('محصول با موفقیت حذف شد');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('خطا در حذف محصول');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (product: DigitalProduct) => {
    try {
      await updateProduct(product.id, { is_active: !product.is_active });
      toast.success(product.is_active ? 'محصول غیرفعال شد' : 'محصول فعال شد');
    } catch (error) {
      console.error('Error toggling product:', error);
      toast.error('خطا در تغییر وضعیت');
    }
  };

  const handleDownload = async (product: DigitalProduct) => {
    if (!product.has_file) {
      toast.error('فایلی برای دانلود وجود ندارد');
      return;
    }
    
    try {
      await downloadFile(product.id, product.name);
      await incrementDownloadCount(product.id);
      toast.success('دانلود شروع شد');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('خطا در دانلود فایل');
    }
  };

  const handleEdit = (product: DigitalProduct) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">مدیریت محصولات</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {products.length} محصول ثبت شده
          </p>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="glow-button text-foreground"
        >
          <Plus className="w-4 h-4 ml-2" />
          افزودن محصول جدید
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-right text-muted-foreground">نام محصول</TableHead>
              <TableHead className="text-right text-muted-foreground">دسته‌بندی</TableHead>
              <TableHead className="text-right text-muted-foreground">قیمت (تومان)</TableHead>
              <TableHead className="text-right text-muted-foreground">دانلودها</TableHead>
              <TableHead className="text-right text-muted-foreground">وضعیت</TableHead>
              <TableHead className="text-right text-muted-foreground">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  هنوز محصولی ثبت نشده است
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id} className="border-border/30 hover:bg-secondary/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {getFileIcon(product.file_ext)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-secondary/50 border-border">
                      {product.category || 'عمومی'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {formatPrice(product.price)} T
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Download className="w-4 h-4" />
                      <span>{product.download_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={product.is_active 
                        ? "bg-green-500/20 text-green-400 border-green-500/30" 
                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      }
                    >
                      {product.is_active ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                        className="h-8 w-8 hover:bg-primary/20"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(product)}
                        className="h-8 w-8 hover:bg-primary/20"
                      >
                        {product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      {product.has_file && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(product)}
                          className="h-8 w-8 hover:bg-primary/20"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product)}
                        disabled={deletingId === product.id}
                        className="h-8 w-8 hover:bg-destructive/20 text-destructive"
                      >
                        {deletingId === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <AddProductModal 
        open={showModal} 
        onClose={handleCloseModal}
        editingProduct={editingProduct}
      />
    </div>
  );
};

export default AdminProductTable;
