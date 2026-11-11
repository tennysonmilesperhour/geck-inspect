import { useCallback, useState } from 'react';
import { GitBranch, Home, Layers, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { KEEPER_MODE_STORAGE_KEY } from '@/lib/navItems';
import { readOnboarding, saveOnboarding } from '@/lib/onboardingState';
import { captureEvent } from '@/lib/posthog';

/**
 * The first-run question: "How do you keep your crested geckos?"
 *
 * It used to be a pop-up that opened 1.5 seconds after a new member's first
 * screen, on top of the "add your first gecko" card they had started
 * reading, and closing it without choosing was saved as "show me
 * everything" for good. It is now part of the page: the first panel of the
 * first-gecko card (FirstGeckoStarter, and the same card on Today), and a
 * slim card above the list for a member who already has geckos and has not
 * answered (someone who claimed a transfer or imported a spreadsheet).
 * "Not now" hides it until the next visit and saves nothing.
 *
 * The answer sets Keeper mode, which trims the menu to the pages a pet
 * keeper uses. It is a menu preference, not access control, and it can be
 * changed in Settings.
 */

const SNOOZE_KEY = 'geck_inspect_role_question_snoozed';

const readSnoozed = () => {
  try { return sessionStorage.getItem(SNOOZE_KEY) === '1'; } catch { return false; }
};

/**
 * Whether to ask, and what to do with the answer.
 *
 *   needed      ask now (signed in, never answered, not put off this visit)
 *   answer(role, surface)  save 'keeper' or 'breeder' and stop asking
 *   snooze()    stop asking until the next visit
 */
export function useRoleQuestion(user) {
  const email = user?.email || null;
  const eligible = Boolean(email) && !user?.is_guest;
  const [answered, setAnswered] = useState(false);
  const [snoozed, setSnoozed] = useState(readSnoozed);
  const unanswered = eligible && !answered && !readOnboarding(user).seen;

  const answer = useCallback((role, surface = 'unknown') => {
    const keeper = role === 'keeper';
    try {
      localStorage.setItem(KEEPER_MODE_STORAGE_KEY, keeper ? '1' : '0');
      // The app shell re-filters its menu when it hears this.
      window.dispatchEvent(new Event('keeper_mode_changed'));
    } catch {
      // Storage blocked: the profile still gets the answer below.
    }
    captureEvent('onboarding_role_selected', { role, surface });
    saveOnboarding(supabase, email, { completed: true, role, keeperMode: keeper });
    setAnswered(true);
  }, [email]);

  const snooze = useCallback(() => {
    try { sessionStorage.setItem(SNOOZE_KEY, '1'); } catch { /* storage blocked */ }
    captureEvent('onboarding_role_snoozed');
    setSnoozed(true);
  }, []);

  return { needed: unanswered && !snoozed, answer, snooze };
}

const CHOICES = [
  {
    role: 'keeper',
    icon: Home,
    title: 'I keep them as pets',
    body: 'Care logging, weights, Morph ID and the care guide. Breeding and selling tools stay out of the menu.',
  },
  {
    role: 'breeder',
    icon: GitBranch,
    title: 'I breed them',
    body: 'Pairings, eggs, lineage, value estimates and sales, plus everything a keeper gets.',
  },
  {
    // "A bit of both" has always been saved as breeder: the full menu.
    role: 'breeder',
    icon: Layers,
    title: 'A bit of both',
    body: 'Show me everything.',
  },
];

/**
 * The three choices. `compact` lays them out as one row of short buttons
 * for the slim card; the default is three cards with a line of help each.
 */
export function RoleChoices({ onChoose, compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {CHOICES.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => onChoose(c.role)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-emerald-500/60 hover:bg-emerald-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <c.icon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            {c.title}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {CHOICES.map((c) => (
        <button
          key={c.title}
          type="button"
          onClick={() => onChoose(c.role)}
          className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left transition-colors hover:border-emerald-500/60 hover:bg-emerald-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-100">{c.title}</span>
            <span className="mt-0.5 block text-xs text-slate-400">{c.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The slim card for a member who has geckos but never answered. Renders
 * nothing once answered or put off.
 */
export default function RoleQuestionCard({ question, surface, className = '' }) {
  if (!question?.needed) return null;
  return (
    <section
      aria-labelledby="role-question-title"
      className={`relative rounded-xl border border-slate-700 bg-slate-900 p-4 pr-12 ${className}`}
    >
      <h2 id="role-question-title" className="text-sm font-semibold text-slate-100">
        How do you keep your crested geckos?
      </h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-400">
        One answer sets up your menu. You can change it any time in Settings.
      </p>
      <RoleChoices compact onChoose={(role) => question.answer(role, surface)} />
      <button
        type="button"
        onClick={question.snooze}
        aria-label="Not now"
        title="Not now"
        className="touch-hit absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
