import { ImageOff } from 'lucide-react';
import { isAmazonAffiliateProduct } from '@/lib/store/productImages';

export default function ProductImagePlaceholder({ product }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3 text-center text-slate-400 text-xs">
      <ImageOff className="w-6 h-6 text-slate-600" aria-hidden="true" />
      <span>{isAmazonAffiliateProduct(product) ? 'See photos on Amazon' : 'No image'}</span>
    </div>
  );
}
