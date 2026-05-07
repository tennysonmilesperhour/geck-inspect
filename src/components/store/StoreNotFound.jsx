import { Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';
import Seo from '@/components/seo/Seo';

export default function StoreNotFound() {
  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Not found' }]}>
      <Seo title="Page not found — Geck Inspect Supplies" path="/Store" description="" noIndex />
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-slate-100">We couldn't find that page.</h1>
        <p className="text-sm text-slate-400 mt-2">
          <Link to="/Store" className="text-emerald-300 hover:text-emerald-200">Back to Supplies</Link>
        </p>
      </div>
    </StoreLayout>
  );
}
