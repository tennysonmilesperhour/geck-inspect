import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Home, GitBranch } from 'lucide-react';
import { KEEPER_MODE_STORAGE_KEY } from '@/lib/navItems';
import { captureEvent } from '@/lib/posthog';

/**
 * First-run role prompt. Most crested gecko owners keep one or two pets
 * and never breed, but the app (and its tour) default to the full
 * breeder-shaped layout. This asks once, up front, and sets Keeper mode
 * accordingly so a keeper's sidebar and tour aren't cluttered with
 * breeding and selling tools. Keeper mode is a nav-decluttering
 * preference only (BREEDER_ONLY_PAGES in navItems), not access control,
 * and it stays changeable in Settings.
 *
 * Props: { isOpen, onChoose(role) }. onChoose fires after the preference
 * is persisted so the caller can open the (now mode-appropriate) tour.
 */
export default function OnboardingRolePrompt({ isOpen, onChoose }) {
  const choose = (role) => {
    const keeper = role === 'keeper';
    try {
      localStorage.setItem(KEEPER_MODE_STORAGE_KEY, keeper ? '1' : '0');
      window.dispatchEvent(new Event('keeper_mode_changed'));
    } catch {
      // localStorage unavailable; the tour still runs, just unfiltered
    }
    captureEvent('onboarding_role_selected', { role });
    onChoose?.(role);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg" hideCloseButton>
        <div className="text-center space-y-2 pt-2">
          <h2 className="text-2xl font-bold text-slate-100">
            Welcome to Geck Inspect
          </h2>
          <p className="text-slate-400">
            One quick question so we can set things up for you. How do you keep
            your crested geckos?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => choose('keeper')}
            className="group rounded-xl border border-slate-700 bg-slate-800/60 hover:border-emerald-500/60 hover:bg-emerald-950/30 p-5 text-left transition-colors"
          >
            <Home className="w-7 h-7 text-emerald-400 mb-3" />
            <div className="font-semibold text-slate-100">I keep them as pets</div>
            <div className="text-sm text-slate-400 mt-1">
              Care logging, weights, morph ID, and the care guide. We'll hide the
              breeding and selling tools.
            </div>
          </button>
          <button
            type="button"
            onClick={() => choose('breeder')}
            className="group rounded-xl border border-slate-700 bg-slate-800/60 hover:border-emerald-500/60 hover:bg-emerald-950/30 p-5 text-left transition-colors"
          >
            <GitBranch className="w-7 h-7 text-emerald-400 mb-3" />
            <div className="font-semibold text-slate-100">I breed them</div>
            <div className="text-sm text-slate-400 mt-1">
              The full toolkit: pairings, clutches, lineage, sales stats, and
              storefront, plus everything a keeper gets.
            </div>
          </button>
        </div>

        <div className="text-center mt-2">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-slate-200"
            onClick={() => choose('breeder')}
          >
            A bit of both, show me everything
          </Button>
        </div>
        <p className="text-center text-xs text-slate-500">
          You can switch this anytime in Settings.
        </p>
      </DialogContent>
    </Dialog>
  );
}
