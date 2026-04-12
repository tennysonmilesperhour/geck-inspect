import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';

/**
 * AdminMigration — ARCHIVED.
 *
 * The Base44 → Supabase data migration has been completed. This page
 * previously accepted a Supabase service_role key in a browser input
 * field, which is a critical security anti-pattern. The migration
 * logic has been removed. If a future migration is needed, implement
 * it as a Supabase Edge Function triggered by a one-time admin endpoint.
 */
export default function AdminMigration() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-4">Migration Complete</h1>
      <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-6">
        <p className="text-emerald-300 font-medium text-lg mb-2">
          All data has been migrated to Supabase.
        </p>
        <p className="text-slate-400 text-sm">
          The Base44 → Supabase migration tool has been retired. The app is running
          entirely on Supabase. If you need to run another migration in the future,
          contact the dev team to set up a server-side Edge Function.
        </p>
      </div>
    </div>
  );
}
