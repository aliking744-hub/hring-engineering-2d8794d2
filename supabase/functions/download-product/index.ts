import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.productId === 'string' ? body.productId : null;
    if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
      return json({ error: 'Invalid product id' }, 400);
    }

    const { data: product, error: productErr } = await admin
      .from('digital_products')
      .select('id, name, file_path, is_active, download_count')
      .eq('id', productId)
      .maybeSingle();

    if (productErr || !product || !product.file_path) {
      return json({ error: 'فایلی برای دانلود وجود ندارد' }, 404);
    }

    // Authorization: admin OR purchaser
    const { data: adminRole } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    let allowed = !!adminRole;
    if (!allowed) {
      const { data: purchase } = await admin
        .from('user_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();
      allowed = !!purchase && product.is_active;
    }

    if (!allowed) return json({ error: 'شما این محصول را خریداری نکرده‌اید' }, 403);

    const bucket = product.file_path.startsWith('digital-assets/') && !product.file_path.startsWith('product-files/')
      ? 'product-files'
      : 'product-files';

    const { data: signed, error: signErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(product.file_path, 120, { download: product.name });

    if (signErr || !signed) {
      console.error('sign error', signErr);
      return json({ error: 'خطا در آماده‌سازی دانلود' }, 500);
    }

    await admin
      .from('digital_products')
      .update({ download_count: (product.download_count ?? 0) + 1 })
      .eq('id', productId);

    return json({ url: signed.signedUrl });
  } catch (e) {
    console.error('download-product error:', e);
    return json({ error: 'Internal error' }, 500);
  }
});
