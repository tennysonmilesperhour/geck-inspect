// The catalog still contains generated stand-ins from the August seed.
// Filter at every display boundary so old rows and guest cart snapshots cannot
// present category artwork as a picture of the linked Amazon product.
export function isAmazonAffiliateProduct(product) {
  if (product?.fulfillment_mode !== 'affiliate_redirect') return false;
  try {
    const { hostname } = new URL(product.vendor_product_url);
    return hostname === 'amazon.com' || hostname.endsWith('.amazon.com') || hostname === 'amzn.to';
  } catch {
    return false;
  }
}

export function productImages(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  if (!isAmazonAffiliateProduct(product)) return images;

  return images.filter((image) => {
    if (!image?.url) return false;
    if (image.kind === 'representative' || image.source === 'geck_inspect_original') return false;
    // The older SVG category illustrations have only a product-level marker.
    // A real photo's explicit per-image source takes precedence over that flag
    // if a later catalog edit left the legacy flag behind.
    if (product.vendor_extra?.image_is_generated_category_art === true) {
      return image.kind === 'supplier_example' || image.source === 'amazon_creator_connections';
    }
    return true;
  });
}

export function primaryProductImage(product) {
  const images = productImages(product);
  return images.find((image) => image.is_primary) || images[0] || null;
}
