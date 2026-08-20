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
        .select(PRODUCT_COLUMNS)
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

  const createProduct = async (
    product: Omit<DigitalProduct, 'id' | 'created_at' | 'updated_at' | 'download_count' | 'has_file' | 'file_ext'>
  ) => {
    const { data, error } = await supabase
      .from('digital_products')
      .insert(product)
      .select('id')
      .single();

    if (error) throw error;
    await fetchProducts();
    return data;
  };

  const updateProduct = async (id: string, updates: Record<string, unknown>) => {
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
      .from('product-files')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;
    return filePath;
  };

  // Downloads are authorized server-side (admin or verified purchase) and
  // served through a short-lived signed URL from the private bucket.
  const downloadFile = async (productId: string, fileName: string) => {
    const { data, error } = await supabase.functions.invoke('download-product', {
      body: { productId },
    });

    if (error) throw error;
    if (!data?.url) throw new Error(data?.error || 'download failed');

    const a = document.createElement('a');
    a.href = data.url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download counting happens server-side in the download-product function.
  const incrementDownloadCount = async (_productId: string) => {
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
