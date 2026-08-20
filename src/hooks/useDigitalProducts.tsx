import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface DigitalProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  payment_link: string | null;
  has_file: boolean | null;
  file_ext: string | null;
  category: string | null;
  download_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PRODUCT_COLUMNS =
  'id, name, description, price, payment_link, has_file, file_ext, category, download_count, is_active, created_at, updated_at';


export interface UserPurchase {
  id: string;
  user_id: string;
  product_id: string;
  purchased_at: string;
}

export const useDigitalProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('digital_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    if (!user) {
      setPurchases([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchPurchases()]);
      setLoading(false);
    };
    load();
  }, [fetchProducts, fetchPurchases]);

  const createProduct = async (product: Omit<DigitalProduct, 'id' | 'created_at' | 'updated_at' | 'download_count'>) => {
    const { data, error } = await supabase
      .from('digital_products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    await fetchProducts();
    return data;
  };

  const updateProduct = async (id: string, updates: Partial<DigitalProduct>) => {
    const { error } = await supabase
      .from('digital_products')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('digital_products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchProducts();
  };

  const uploadFile = async (file: File, productId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${productId}.${fileExt}`;
    const filePath = `digital-assets/${fileName}`;

    const { error } = await supabase.storage
      .from('products')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;
    return filePath;
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('products')
      .download(filePath);

    if (error) throw error;

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const incrementDownloadCount = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    await supabase
      .from('digital_products')
      .update({ download_count: product.download_count + 1 })
      .eq('id', productId);

    await fetchProducts();
  };

  const hasPurchased = (productId: string): boolean => {
    return purchases.some(p => p.product_id === productId);
  };

  const recordPurchase = async (productId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_purchases')
      .insert({ user_id: user.id, product_id: productId });

    if (error && !error.message.includes('duplicate')) throw error;
    await fetchPurchases();
  };

  return {
    products,
    purchases,
    loading,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadFile,
    downloadFile,
    incrementDownloadCount,
    hasPurchased,
    recordPurchase,
  };
};
