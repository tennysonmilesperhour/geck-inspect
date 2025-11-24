import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));

export default function AuthPortal() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    }>
      <LoginPortal />
    </Suspense>
  );
}