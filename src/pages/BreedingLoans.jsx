import { useState, useEffect, useCallback } from 'react';
import { User, Gecko, BreedingLoan } from '@/entities/all';
import { format, isPast, parseISO } from 'date-fns';
import { todayLocalISO } from '@/lib/dateUtils';
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
import PageHeader from '@/components/shared/PageHeader';

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
    proposed:  { className: 'bg-emerald-500/10 text-emerald-400', label: 'Proposed' },
    active:    { className: 'bg-emerald-500/15 text-emerald-300', label: 'Active' },
    overdue:   { className: 'bg-amber-500/15 text-amber-300',     label: 'Overdue' },
    returned:  { className: 'bg-slate-700/60 text-slate-300',     label: 'Returned' },
    cancelled: { className: 'bg-red-500/15 text-red-300',         label: 'Cancelled' },
  };
  const s = styles[status] || styles.proposed;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
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
    : (loan.created_by || 'Unknown lender');

  const handleMarkReturned = async () => {
    try {
      await BreedingLoan.update(loan.id, {
        status: 'returned',
        actual_return: todayLocalISO(),
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
      className={`rounded-xl p-4 md:p-6 border ${
        displayStatus === 'overdue'
          ? 'bg-amber-500/10 border-amber-500/40'
          : 'bg-slate-900 border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold truncate text-slate-100">
              {gecko?.name || loan.animal_id || 'Unknown Gecko'}
            </h3>
            <StatusBadge status={displayStatus} />
          </div>
          {gecko?.morphs_traits && (
            <p className="text-xs mb-1 text-slate-500">{gecko.morphs_traits}</p>
          )}
        </div>
        {displayStatus === 'overdue' && (
          <AlertTriangle size={18} className="flex-shrink-0 mt-1 text-amber-400" />
        )}
      </div>

      {/* Counterparty */}
      <div className="flex items-center gap-2 mb-2">
        <UserIcon size={14} className="text-slate-500" />
        <span className="text-sm text-slate-200">
          {isOutgoing ? 'Borrower' : 'Lender'}: <strong>{counterparty}</strong>
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={14} className="text-slate-500" />
        <span className="text-sm text-slate-200">
          {loan.loan_start ? format(parseISO(loan.loan_start), 'MMM d, yyyy') : 'Not started'}
          {', '}
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
          <DollarSign size={14} className="text-slate-500" />
          <span className="text-sm text-slate-200">
            Stud fee: ${Number(loan.stud_fee).toFixed(2)}
            {loan.stud_fee_paid
              ? <span className="ml-2 text-xs font-medium text-emerald-400">(Paid)</span>
              : <span className="ml-2 text-xs font-medium text-amber-400">(Unpaid)</span>
            }
          </span>
        </div>
      )}

      {/* Offspring agreement */}
      {loan.offspring_agreement && (
        <div className="flex items-start gap-2 mb-2">
          <FileText size={14} className="mt-0.5 flex-shrink-0 text-slate-500" />
          <span className="text-sm text-slate-200">
            {loan.offspring_agreement}
          </span>
        </div>
      )}

      {/* Condition notes */}
      {loan.condition_on_loan && (
        <p className="text-xs mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-slate-200">
          Condition on loan: {loan.condition_on_loan}
        </p>
      )}

      {/* Notes */}
      {loan.notes && (
        <p className="text-xs mt-2 text-slate-500">
          {loan.notes}
        </p>
      )}

      {/* Actions */}
      {(displayStatus === 'active' || displayStatus === 'overdue') && isOutgoing && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <Button
            size="sm"
            onClick={handleMarkReturned}
            className="text-xs"
          >
            <CheckCircle2 size={14} className="mr-1" />
            Mark Returned
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="text-xs"
          >
            Cancel Loan
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── New Loan Modal ────────────────────────────────────────────── */

function NewLoanModal({ open, onClose, geckos, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    animal_id: '',
    borrower_email: '',
    borrower_name: '',
    purpose: '',
    loan_start: todayLocalISO(),
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
        loan_start: todayLocalISO(), expected_return: '',
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            New Breeding Loan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Gecko */}
          <div>
            <Label className="text-slate-200">Gecko</Label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-200">Borrower Email *</Label>
              <Input
                type="email"
                value={form.borrower_email}
                onChange={e => set('borrower_email', e.target.value)}
                placeholder="borrower@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-200">Borrower Name</Label>
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
            <Label className="text-slate-200">Purpose</Label>
            <Input
              value={form.purpose}
              onChange={e => set('purpose', e.target.value)}
              placeholder="e.g. Breeding project, stud service"
              className="mt-1"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-200">Loan Start</Label>
              <Input
                type="date"
                value={form.loan_start}
                onChange={e => set('loan_start', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-200">Expected Return</Label>
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
            <Label className="text-slate-200">Stud Fee (optional)</Label>
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
            <Label className="text-slate-200">Offspring Agreement</Label>
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
            <Label className="text-slate-200">Condition Notes</Label>
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
            <Label className="text-slate-200">Additional Notes</Label>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
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
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-emerald-500/10">
        <ArrowLeftRight size={28} className="text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold mb-1 text-slate-100">
        No {type === 'out' ? 'outgoing' : 'incoming'} loans
      </h3>
      <p className="text-sm max-w-sm text-slate-500">
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
        BreedingLoan.filter({ created_by: email }),
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
    .filter(l => l.created_by === userEmail)
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  const borrowed = loans
    .filter(l => l.borrower_email === userEmail && l.created_by !== userEmail)
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

  const activeCount = loans.filter(l => computeStatus(l) === 'active' || computeStatus(l) === 'overdue').length;
  const overdueCount = loans.filter(l => computeStatus(l) === 'overdue').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={Handshake}
          title="Breeding Loans"
          description="Track geckos loaned out for breeding and borrowed from others."
        >
          <Button onClick={() => setShowNewLoan(true)}>
            <Plus size={16} className="mr-2" />
            New Loan
          </Button>
        </PageHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-4 text-center bg-slate-900 border border-slate-700">
            <p className="text-2xl font-bold text-slate-100">{loans.length}</p>
            <p className="text-xs text-slate-500">Total Loans</p>
          </div>
          <div className="rounded-xl p-4 text-center bg-slate-900 border border-slate-700">
            <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div
            className={`rounded-xl p-4 text-center bg-slate-900 border ${
              overdueCount > 0 ? 'border-amber-500/40' : 'border-slate-700'
            }`}
          >
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
              {overdueCount}
            </p>
            <p className="text-xs text-slate-500">Overdue</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger
              value="out"
              className="text-sm data-[state=active]:shadow-sm transition-colors"
            >
              <Handshake size={14} className="mr-1.5" />
              Loaned Out ({loanedOut.length})
            </TabsTrigger>
            <TabsTrigger
              value="in"
              className="text-sm data-[state=active]:shadow-sm transition-colors"
            >
              <ArrowLeftRight size={14} className="mr-1.5" />
              Borrowed ({borrowed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="out">
            {loanedOut.length === 0 ? (
              <EmptyLoans type="out" />
            ) : (
              <div className="grid grid-cols-1 gap-4">
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
              <div className="grid grid-cols-1 gap-4">
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
