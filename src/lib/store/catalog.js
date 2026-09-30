// Page through the full active catalog; featured status must not hide products.
const CATALOG_FIELDS = `id, slug, name, short_description, our_price_cents,
  compare_at_price_cents, images, fulfillment_mode, vendor_id,
  free_shipping_eligible, is_featured, status, vendor_product_url, vendor_extra`;
const PAGE_SIZE = 100;

export async function fetchStoreCatalog(client) {
  const products = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from('store_products')
      .select(CATALOG_FIELDS).eq('status', 'active')
      .order('created_date', { ascending: false }).order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    products.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return products;
  }
}
