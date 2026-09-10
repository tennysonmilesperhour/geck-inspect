import { Link } from 'react-router-dom';
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

/**
 * One sign-in gate for every page that needs an account.
 *
 * Pages used to each hand-roll this state ("Access Denied", "Login
 * Required", "Please log in to view...") with no button and, on phones,
 * no side padding, so a guest exploring the demo hit a dead wall with
 * copy that changed from page to page. This renders the same centered
 * card everywhere, always with a way forward.
 */
export default function SignInRequired({
  title = 'Sign in to continue',
  description = 'This page is tied to your account. Sign in or create a free account to use it.',
  icon: Icon = LockKeyhole,
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md text-center rounded-xl border border-slate-700 bg-slate-900 px-5 py-8 md:px-8 md:py-10">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-emerald-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-100">{title}</h2>
        <p className="text-sm md:text-base text-slate-400 mt-2">{description}</p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button asChild className="w-full sm:w-auto">
            <Link to={createPageUrl('AuthPortal')}>
              <LogIn className="w-4 h-4" />
              Sign in
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to={createPageUrl('AuthPortal')}>
              <UserPlus className="w-4 h-4" />
              Create account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
