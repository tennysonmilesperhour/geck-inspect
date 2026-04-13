/**
 * Passport verification page — publicly accessible.
 *
 * Renders a gecko's digital passport from the ?data= URL parameter.
 * No authentication required — anyone with the link can verify.
 */
import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { GeckoPassportViewer } from '@/components/innovations/GeckoPassport';
import { ShieldCheck } from 'lucide-react';
import Seo from '@/components/seo/Seo';

export default function PassportPage() {
  const [params] = useSearchParams();
  const token = params.get('data');

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <Seo
        title="Gecko Passport Verification"
        description="Verify a crested gecko's lineage, morph classification, and provenance on Geck Inspect."
        noindex
      />
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm mb-6">
            <ShieldCheck className="w-5 h-5" />
            Geck Inspect
          </Link>
        </div>
        <GeckoPassportViewer token={token} />
      </div>
    </div>
  );
}
