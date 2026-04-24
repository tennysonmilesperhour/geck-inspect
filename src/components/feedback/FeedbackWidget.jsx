import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { SupportMessage } from '@/entities/all';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Bug,
  Lightbulb,
  Heart,
  Star,
} from 'lucide-react';

/**
 * Floating feedback widget — anchored to the bottom-right corner of every
 * authenticated page. Opens a dialog where the user picks a feedback type
 * (general, bug, feature request) plus an optional 1-5 star rating, then
 * fires straight into support_messages. Admins triage it from the support
 * inbox with the "Feedback" filter.
 *
 * Hidden on mobile auth/onboarding routes so it doesn't cover important UI.
 */

const TYPES = [
  { id: 'feedback', label: 'General feedback', icon: Heart, color: 'text-emerald-400' },
  { id: 'bug_report', label: 'Report a bug', icon: Bug, color: 'text-rose-400' },
  { id: 'feature_request', label: 'Suggest a feature', icon: Lightbulb, color: 'text-amber-400' },
];

function StarRow({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className="p-1 transition-transform hover:scale-110"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            className={`w-6 h-6 ${
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('feedback');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(0);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setSubject('');
    setBody('');
    setRating(0);
    setSent(false);
    setType('feedback');
  };

  const handleClose = (next) => {
    if (isSending) return;
    setOpen(next);
    if (!next) {
      // Reset shortly after close so the success state isn't visible mid-fade.
      setTimeout(reset, 200);
    }
  };

  const handleSubmit = async () => {
    if (!body.trim()) {
      toast({
        title: 'Add a message',
        description: 'Tell us what you’re thinking.',
        variant: 'destructive',
      });
      return;
    }
    setIsSending(true);
    try {
      const meta = TYPES.find((t) => t.id === type);
      await SupportMessage.create({
        user_email: user?.email || email || null,
        subject: subject.trim() || `[${meta?.label || 'Feedback'}]`,
        body: body.trim(),
        status: 'new',
        source: type,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
        rating: rating || null,
      });
      setSent(true);
      toast({
        title: 'Sent — thank you!',
        description: 'An admin will see this in the inbox.',
      });
    } catch (err) {
      console.error('Feedback submit failed:', err);
      toast({
        title: 'Could not send',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    }
    setIsSending(false);
  };

  const activeMeta = TYPES.find((t) => t.id === type) || TYPES[0];
  const ActiveIcon = activeMeta.icon;

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed right-5 z-[60] flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 px-4 py-3 text-sm font-semibold transition-all hover:scale-105 active:scale-95 print:hidden bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
          {sent ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold">Thanks for the feedback</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Your message landed in the admin inbox. We read every one.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reset}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Send another
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleClose(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ActiveIcon className={`w-5 h-5 ${activeMeta.color}`} />
                  Share your thoughts
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Reports go straight to the Geck Inspect team. We reply in-app.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                          active
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${active ? t.color : 'text-slate-400'}`} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {!user && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                      Email (so we can reply)
                    </label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                    Subject (optional)
                  </label>
                  <Input
                    placeholder={
                      type === 'bug_report'
                        ? 'What broke?'
                        : type === 'feature_request'
                          ? 'What should we build?'
                          : 'A short summary'
                    }
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                    Message
                  </label>
                  <Textarea
                    placeholder={
                      type === 'bug_report'
                        ? 'What did you do, what happened, and what did you expect?'
                        : 'Tell us more…'
                    }
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    className="bg-slate-950 border-slate-700 text-slate-100 min-h-32"
                  />
                </div>

                {type === 'feedback' && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                      Overall rating (optional)
                    </label>
                    <StarRow value={rating} onChange={setRating} />
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  We capture the page you’re on automatically so we can reproduce issues.
                </p>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSending || !body.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
