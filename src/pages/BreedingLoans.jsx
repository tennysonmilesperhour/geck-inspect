import { useState, useEffect, useCallback } from 'react';
import { User, Gecko, BreedingLoan } from '@/entities/all';
import { format, isPast, parseISO } from 'date-fns';
import {
  Handshake, Plus, Calendar, AlertTriangle, CheckCircle2, ArrowLeftRight,
  User as UserIcon, DollarSign, FileText, Loader2, Send,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

/* ─── Design tokens ─────────────────────────────────────────────── */
const C = {
  forest:    '#e2e8f0',
  moss:      '#94a3b8',
  sage:      '#10b981',
  paleSage:  'rgba(16,185,129,0.1)',
  warmWhite: '#020617',
  gold:      '#f59e0b',
  goldLight: 'rgba(245,158,11,0.15)',
  red:       '#ef4444',
  slate:     '#cbd5e1',
  muted:     '#64748b',
  cardBg:    '#0f172a',
  border:    'rgba(51,65,85,0.5)',
};

/* ─── Helpers ───────────────────────────────────────────────────── */

function computeStatus(loan) {
  if (loan.status === 'returned' || loan.status === 'cancelled') return loan.status;
  if (loan.status === 'active' && loan.expected_return && !loan.actual_return) {
    if (isPast(parseISO(loan.expected_return))) return 'overdue';
  }
  return loan.status;
}

function StatusBadge({ status }) {
  const styles = {
    proposed:  { bg: C.paleSage, text: C.sage,  label: 'Proposed' },
    active:    { bg: '#E0F0E0', text: C.sage,   label: 'Active' },
    overdue:   { bg: C.goldLight, text: '#92650A', label: 'Overdue' },
    returned:  { bg: '#E8E8E8', text: '#6B6B6B', label: 'Returned' },
    cancelled: { bg: '#F0E0E0', text: C.red,     label: 'Cancelled' },
  };
  const s = styles[status] || styles.proposed;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

/* ─── Loan card ─────────────────────────────────────────────────── */

function LoanCard({ loan, geckoMap, isOutgoing, onRefresh }) {
  const { toast } = useToast();
  const gecko = geckoMap[loan.animal_id];
  const displayStatus = computeStatus(loan);
  const counterparty = isOutgoing
    ? (loan.borrower_name || loan.borrower_email || 'Unknown borrower')
    : (loan.lender_user_id || 'Unknown lender');

  const handleMarkReturned = async () => {
    try {
      await BreedingLoan.update(loan.id, {
        status: 'returned',
        actual_return: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'Marked as returned', description: gecko?.name || 'Loan updated' });
      onRefresh();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await BreedingLoan.update(loan.id, { status: 'cancelled' });
      toast({ title: 'Loan cancelled' });
      onRefresh();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{
        border: `1px solid ${displayStatus === 'overdue' ? 'rgba(196,134,10,0.35)' : 'rgba(51,65,85,0.5)'}`,
        backgroundColor: displayStatus === 'overdue' ? 'rgba(253,243,224,0.3)' : '#fff',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className="text-base font-semibold truncate"
              style={{ color: C.forest, fontFamily: "'DM Serif Display', serif" }}
            >
              {gecko?.name || loan.animal_id || 'Unknown Gecko'}
            </h3>
            <StatusBadge status={displayStatus} />
          </div>
          {gecko?.morph && (
            <p className="text-xs mb-1" style={{ color: C.muted }}>{gecko.morph}</p>
          )}
        </div>
        {displayStatus === 'overdue' && (
          <AlertTriangle size={18} style={{ color: C.gold }} className="flex-shrink-0 mt-1" />
        )}
      </div>

      {/* Counterparty */}
      <div className="flex items-center gap-2 mb-2">
        <UserIcon size={14} style={{ color: C.muted }} />
        <span className="text-sm" style={{ color: C.slate }}>
          {isOutgoing ? 'Borrower' : 'Lender'}: <strong>{counterparty}</strong>
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={14} style={{ color: C.muted }} />
        <span className="text-sm" style={{ color: C.slate }}>
          {loan.loan_start ? format(parseISO(loan.loan_start), 'MMM d, yyyy') : 'Not started'}
          {' — '}
          {loan.actual_return
            ? format(parseISO(loan.actual_return), 'MMM d, yyyy')
            : loan.expected_return
              ? format(parseISO(loan.expected_return), 'MMM d, yyyy')
              : 'No end date'}
        </span>
      </div>

      {/* Stud fee */}
      {loan.stud_fee != null && loan.stud_fee > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={14} style={{ color: C.muted }} />
          <span className="text-sm" style={{ color: C.slate }}>
            Stud fee: ${Number(loan.stud_fee).toFixed(2)}
            {loan.stud_fee_paid
              ? <span className="ml-2 text-xs font-medium" style={{ color: C.sage }}>(Paid)</span>
              : <span className="ml-2 text-xs font-medium" style={{ color: C.gold }}>(Unpaid)</span>
            }
          </span>
        </div>
      )}

      {/* Offspring agreement */}
      {loan.offspring_agreement && (
        <div className="flex items-start gap-2 mb-2">
          <FileText size={14} style={{ color: C.muted }} className="mt-0.5 flex-shrink-0" />
          <span className="text-sm" style={{ color: C.slate }}>
            {loan.offspring_agreement}
          </span>
        </div>
      )}

      {/* Condition notes */}
      {loan.condition_on_loan && (
        <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: C.paleSage, color: C.slate }}>
          Condition on loan: {loan.condition_on_loan}
        </p>
      )}

      {/* Notes */}
      {loan.notes && (
        <p className="text-xs mt-2" style={{ color: C.muted }}>
          {loan.notes}
        </p>
      )}

      {/* Actions */}
      {(displayStatus === 'active' || displayStatus === 'overdue') && isOutgoing && (
        <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid rgba(51,65,85,0.3)' }}>
          <Button
            size="sm"
            onClick={handleMarkReturned}
            className="text-xs"
            style={{ backgroundColor: C.sage, color: '#fff' }}
          >
            <CheckCircle2 size={14} className="mr-1" />
            Mark Returned
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="text-xs"
            style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.muted }}
          >
            Cancel Loan
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── New Loan Modal ────────────────────────────────────────────── */

function NewLoanModal({ open, onClose, geckos, userEmail, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    animal_id: '',
    borrower_email: '',
    borrower_name: '',
    purpose: '',
    loan_start: new Date().toISOString().split('T')[0],
    expected_return: '',
    stud_fee: '',
    offspring_agreement: '',
    condition_on_loan: '',
    notes: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.animal_id) {
      toast({ title: 'Please select a gecko', variant: 'destructive' });
      return;
    }
    if (!form.borrower_email) {
      toast({ title: 'Borrower email is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await BreedingLoan.create({
        animal_id: form.animal_id,
        lender_user_id: userEmail,
        borrower_email: form.borrower_email,
        borrower_name: form.borrower_name,
        status: 'proposed',
        purpose: form.purpose || null,
        loan_start: form.loan_start || null,
        expected_return: form.expected_return || null,
        stud_fee: form.stud_fee ? parseFloat(form.stud_fee) : null,
        stud_fee_paid: false,
        offspring_agreement: form.offspring_agreement || null,
        condition_on_loan: form.condition_on_loan || null,
        notes: form.notes || null,
      });
      toast({ title: 'Loan created', description: 'The breeding loan has been proposed.' });
      onCreated();
      onClose();
      setForm({
        animal_id: '', borrower_email: '', borrower_name: '', purpose: '',
        loan_start: new Date().toISOString().split('T')[0], expected_return: '',
        stud_fee: '', offspring_agreement: '', condition_on_loan: '', notes: '',
      });
    } catch (err) {
      toast({ title: 'Error creating loan', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>
            New Breeding Loan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Gecko */}
          <div>
            <Label style={{ color: C.slate }}>Gecko</Label>
            <Select value={form.animal_id} onValueChange={v => set('animal_id', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a gecko..." />
              </SelectTrigger>
              <SelectContent>
                {geckos.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name || g.id} {g.morph ? `(${g.morph})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Borrower info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label style={{ color: C.slate }}>Borrower Email *</Label>
              <Input
                type="email"
                value={form.borrower_email}
                onChange={e => set('borrower_email', e.target.value)}
                placeholder="borrower@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label style={{ color: C.slate }}>Borrower Name</Label>
              <Input
                value={form.borrower_name}
                onChange={e => set('borrower_name', e.target.value)}
                placeholder="Jane Doe"
                className="mt-1"
              />
            </div>
          </div>

          {/* Purpose */}
          <div>
            <Label style={{ color: C.slate }}>Purpose</Label>
            <Input
              value={form.purpose}
              onChange={e => set('purpose', e.target.value)}
              placeholder="e.g. Breeding project, stud service"
              className="mt-1"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label style={{ color: C.slate }}>Loan Start</Label>
              <Input
                type="date"
                value={form.loan_start}
                onChange={e => set('loan_start', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label style={{ color: C.slate }}>Expected Return</Label>
              <Input
                type="date"
                value={form.expected_return}
                onChange={e => set('expected_return', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Stud fee */}
          <div>
            <Label style={{ color: C.slate }}>Stud Fee (optional)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.stud_fee}
              onChange={e => set('stud_fee', e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
          </div>

          {/* Offspring agreement */}
          <div>
            <Label style={{ color: C.slate }}>Offspring Agreement</Label>
            <Textarea
              value={form.offspring_agreement}
              onChange={e => set('offspring_agreement', e.target.value)}
              placeholder="e.g. Lender receives pick of first clutch"
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Condition notes */}
          <div>
            <Label style={{ color: C.slate }}>Condition Notes</Label>
            <Textarea
              value={form.condition_on_loan}
              onChange={e => set('condition_on_loan', e.target.value)}
              placeholder="Note gecko's current condition, weight, any concerns"
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Notes */}
          <div>
            <Label style={{ color: C.slate }}>Additional Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any other details..."
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} style={{ color: C.muted }}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            style={{ backgroundColor: C.sage, color: '#fff' }}
          >
            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
            Create Loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Empty state ───────────────────────────────────────────────── */

function EmptyLoans({ type }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: C.paleSage }}
      >
        <ArrowLeftRight size={28} style={{ color: C.sage }} />
      </div>
      <h3 className="text-lg font-medium mb-1" style={{ color: C.forest, fontFamily: "'DM Serif Display', serif" }}>
        No {type === 'out' ? 'outgoing' : 'incoming'} loans
      </h3>
      <p className="text-sm max-w-sm" style={{ color: C.muted }}>
        {type === 'out'
          ? 'When you loan geckos for breeding, they will appear here.'
          : 'When someone loans you a gecko, it will appear here.'}
      </p>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */

export default function BreedingLoans() {
  const [user, setUser] = useState(null);
  const [geckos, setGeckos] = useState([]);
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [activeTab, setActiveTab] = useState('out');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      const email = currentUser.email;

      const [userGeckos, lentLoans, borrowedLoans] = await Promise.all([
        Gecko.filter({ created_by: email }),
        BreedingLoan.filter({ lender_user_id: email }),
        BreedingLoan.filter({ borrower_email: email }),
      ]);

      setGeckos(userGeckos.filter(g => !g.archived));

      // Merge and deduplicate
      const allLoans = [...lentLoans];
      const lentIds = new Set(lentLoans.map(l => l.id));
      for (const b of borrowedLoans) {
        if (!lentIds.has(b.id)) allLoans.push(b);
      }
      setLoans(allLoans);
    } catch (err) {
      console.error('Failed to load breeding loans:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const geckoMap = {};
  for (const g of geckos) {
    geckoMap[g.id] = g;
  }

  const userEmail = user?.email || '';
  const loanedOut = loans
    .filter(l => l.lender_user_id === userEmail)
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  const borrowed = loans
    .filter(l => l.borrower_email === userEmail && l.lender_user_id !== userEmail)
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

  const activeCount = loans.filter(l => computeStatus(l) === 'active' || computeStatus(l) === 'overdue').length;
  const overdueCount = loans.filter(l => computeStatus(l) === 'overdue').length;

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: C.sage }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-12"
      style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-2xl mb-1"
              style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
            >
              Breeding Loans
            </h1>
            <p className="text-sm" style={{ color: C.muted }}>
              Track geckos loaned out for breeding and borrowed from others.
            </p>
          </div>
          <Button
            onClick={() => setShowNewLoan(true)}
            style={{ backgroundColor: C.sage, color: '#fff' }}
          >
            <Plus size={16} className="mr-2" />
            New Loan
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className="rounded-xl p-4 text-center"
            style={{ border: '1px solid rgba(51,65,85,0.5)', backgroundColor: '#0f172a' }}
          >
            <p className="text-2xl font-bold" style={{ color: C.forest }}>{loans.length}</p>
            <p className="text-xs" style={{ color: C.muted }}>Total Loans</p>
          </div>
          <div
            className="rounded-xl p-4 text-center"
            style={{ border: '1px solid rgba(51,65,85,0.5)', backgroundColor: '#0f172a' }}
          >
            <p className="text-2xl font-bold" style={{ color: C.sage }}>{activeCount}</p>
            <p className="text-xs" style={{ color: C.muted }}>Active</p>
          </div>
          <div
            className="rounded-xl p-4 text-center"
            style={{
              border: overdueCount > 0 ? '1px solid rgba(196,134,10,0.35)' : '1px solid rgba(51,65,85,0.5)',
              backgroundColor: overdueCount > 0 ? 'rgba(253,243,224,0.3)' : '#fff',
            }}
          >
            <p className="text-2xl font-bold" style={{ color: overdueCount > 0 ? C.gold : C.forest }}>
              {overdueCount}
            </p>
            <p className="text-xs" style={{ color: C.muted }}>Overdue</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className="grid grid-cols-2 w-full max-w-xs mx-auto mb-6 p-1 h-10"
            style={{ backgroundColor: C.paleSage }}
          >
            <TabsTrigger
              value="out"
              className="text-sm data-[state=active]:shadow-sm transition-colors"
              style={{
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <Handshake size={14} className="mr-1.5" />
              Loaned Out ({loanedOut.length})
            </TabsTrigger>
            <TabsTrigger
              value="in"
              className="text-sm data-[state=active]:shadow-sm transition-colors"
              style={{
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <ArrowLeftRight size={14} className="mr-1.5" />
              Borrowed ({borrowed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="out">
            {loanedOut.length === 0 ? (
              <EmptyLoans type="out" />
            ) : (
              <div className="grid gap-4">
                {loanedOut.map(loan => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    geckoMap={geckoMap}
                    isOutgoing={true}
                    onRefresh={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="in">
            {borrowed.length === 0 ? (
              <EmptyLoans type="in" />
            ) : (
              <div className="grid gap-4">
                {borrowed.map(loan => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    geckoMap={geckoMap}
                    isOutgoing={false}
                    onRefresh={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New loan modal */}
      <NewLoanModal
        open={showNewLoan}
        onClose={() => setShowNewLoan(false)}
        geckos={geckos}
        userEmail={userEmail}
        onCreated={loadData}
      />
    </div>
  );
}
