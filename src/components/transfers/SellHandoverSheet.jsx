import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SaleDetailsFields, { initialSaleDetails, saleDetailsPatch } from '@/components/business/SaleDetailsFields';
import { makePassport, passportPublicNote } from '@/lib/makePassport';
import SoldTransferStep from './SoldTransferStep';

// Whether the sheet offers "Make its passport" between the sale and the
// hand-over. Off. A passport makes the gecko's record public, and any
// signed-in member can read a public gecko's row. It was switched off on
// 13 November 2026 because that row carried the sale price. The sale
// price has since been moved out of the row, where only the gecko's
// keepers can read it (src/lib/geckoSalePrices.js), so that reason is
// gone. What a public row still shows other members is the owner's email
// address (created_by). Switching this on is Tennyson's decision
// (docs/OWNER-STEPS.md, E15): either now, accepting what every public
// gecko already shows, or once the email is held back too. While it is
// off the step is not drawn, not counted, and makePassport cannot be
// reached from here.
export const OFFER_PASSPORT_AT_SALE = false;

const STEPS = [
  { id: 'sale', label: 'Sale price and date' },
  { id: 'passport', label: 'Make its passport' },
  { id: 'handover', label: 'Hand it to the buyer' },
].filter((step) => step.id !== 'passport' || OFFER_PASSPORT_AT_SALE);

// Where the sheet goes once the sale is saved.
const AFTER_SALE = OFFER_PASSPORT_AT_SALE ? 'passport' : 'handover';

/**
 * Sell and hand over, on one sheet (experience review, section 8 item
 * 2). Marking a gecko Sold used to lead to separate places for the sale
 * price and the transfer. Here they are two short steps:
 *
 *   1. Sale price and date. Both optional. Saved with the sold status,
 *      by the same save "Archive as sold" has always used (onSaveSale).
 *   2. Hand it to the buyer. The existing step and transfer form
 *      (SoldTransferStep, TransferDialog), shown inline, so the QR code
 *      and link come from the one transfer code path, with every
 *      warning and confirmation it has.
 *
 * A passport step between the two is written but switched off: see
 * OFFER_PASSPORT_AT_SALE above. The sheet says nothing about passports,
 * for a gecko that has one or not.
 *
 * Each step saves by itself. Closing the sheet at any point keeps what
 * was saved and changes nothing else. Nothing here is a new page.
 *
 * Props:
 *   gecko         the gecko being sold
 *   saleSaved     true when the sale was already saved (the member came
 *                 through the archive dialog), so the sheet opens on the
 *                 hand-over
 *   onSaveSale    (saleFields) => the saved gecko, or null when the save
 *                 failed (the caller has already said why)
 *   onChanged     (fields) => void, after the passport step saved (only
 *                 when that step is switched on)
 *   canTransfer   only the owner can hand a gecko over
 *   guest         the demo: every step can be seen, nothing is saved
 *   onClose       the sheet is finished or was closed
 */
export default function SellHandoverSheet({
  gecko, saleSaved = false, defaultSaleCategory = '', onSaveSale, onChanged, canTransfer = true, guest = false, onClose,
}) {
  // The gecko as the steps have left it so far.
  const [current, setCurrent] = useState(gecko);
  const [step, setStep] = useState(saleSaved ? AFTER_SALE : 'sale');
  const [states, setStates] = useState({
    sale: saleSaved ? 'done' : 'todo',
    passport: gecko?.passport_code ? 'done' : 'todo',
    handover: 'todo',
  });
  const [sale, setSale] = useState(() => initialSaleDetails(gecko, defaultSaleCategory));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const name = current?.name || 'this gecko';
  const Name = current?.name || 'This gecko';
  const mark = (id, state) => setStates((prev) => ({ ...prev, [id]: state }));
  const go = (next) => { setError(''); setStep(next); };

  const saveSale = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await onSaveSale?.(saleDetailsPatch(sale));
      if (!saved) {
        setError('The sale was not saved, so nothing has changed. Try again.');
        return;
      }
      setCurrent((prev) => ({ ...prev, ...saved }));
      mark('sale', 'done');
      go(AFTER_SALE);
    } catch (failure) {
      setError(failure?.message || 'The sale was not saved, so nothing has changed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const makeIt = async () => {
    if (!OFFER_PASSPORT_AT_SALE || busy) return;
    setBusy(true);
    setError('');
    try {
      const fields = await makePassport(current, { surface: 'sold_sheet' });
      setCurrent((prev) => ({ ...prev, ...fields }));
      mark('passport', 'done');
      onChanged?.(fields);
    } catch (failure) {
      console.error('Passport not made:', failure);
      setError('The passport was not made, so nothing has changed. Try again, or skip it for now.');
    } finally {
      setBusy(false);
    }
  };

  const finishHandover = () => onClose?.();
  const stepNumber = STEPS.findIndex((s) => s.id === step) + 1;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose?.(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md max-h-[90dvh] overflow-y-auto" data-sell-sheet>
        <DialogHeader>
          <DialogTitle className="text-slate-100">Sell and hand over {name}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {STEPS.length === 3
              ? 'Three short steps. Each one saves by itself, so you can stop after any of them.'
              : 'Two short steps. Each one saves by itself, so you can stop after the first.'}
          </DialogDescription>
        </DialogHeader>

        {guest && (
          <p className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300" data-sell-guest>
            This is the demo, so nothing here is saved. Create an account to sell and hand over your own geckos.
          </p>
        )}

        <ol className={`grid gap-2 ${STEPS.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} aria-label="Steps">
          {STEPS.map(({ id, label }, index) => {
            const state = states[id];
            const active = id === step;
            return (
              <li
                key={id}
                data-sell-step-state={state}
                aria-current={active ? 'step' : undefined}
                className={`rounded-lg border p-2 text-xs ${active ? 'border-emerald-500 bg-emerald-950/40 text-slate-100' : 'border-slate-700 bg-slate-800/40 text-slate-400'}`}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${state === 'done' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                    {state === 'done' ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                  </span>
                  <span>{label}</span>
                </span>
                {state !== 'todo' && <span className="mt-1 block text-slate-400">{state === 'done' ? 'Done' : 'Skipped'}</span>}
              </li>
            );
          })}
        </ol>

        {step === 'sale' && (
          <section className="space-y-4" data-sell-step="sale" aria-label={`Step ${stepNumber} of ${STEPS.length}: sale price and date`}>
            <p className="text-sm text-slate-300">
              What did {name} sell for, and when? Both are optional. Saving archives {name} as sold.
            </p>
            <SaleDetailsFields value={sale} onChange={setSale} />
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-slate-600" disabled={busy} onClick={() => onClose?.()}>Cancel</Button>
              {guest ? (
                <Button type="button" onClick={() => { mark('sale', 'skipped'); go(AFTER_SALE); }}>Next</Button>
              ) : (
                <Button type="button" disabled={busy} onClick={saveSale}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {busy ? 'Saving...' : 'Archive as sold'}
                </Button>
              )}
            </DialogFooter>
          </section>
        )}

        {OFFER_PASSPORT_AT_SALE && step === 'passport' && (
          <section className="space-y-4" data-sell-step="passport" aria-label={`Step ${stepNumber} of ${STEPS.length}: make its passport`}>
            {current?.passport_code ? (
              <p className="text-sm text-slate-300" data-sell-passport="done">
                {Name} has a passport ({current.passport_code}). Its public page and QR card go to the buyer with it.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-300">Give the buyer {name}&apos;s full history.</p>
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100" data-sell-passport-warning>
                  {passportPublicNote(name)}
                </p>
              </>
            )}
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <DialogFooter className="gap-2">
              {current?.passport_code || guest ? (
                <Button type="button" onClick={() => { if (!current?.passport_code) mark('passport', 'skipped'); go('handover'); }}>Next</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" className="border-slate-600" disabled={busy} onClick={() => { mark('passport', 'skipped'); go('handover'); }}>
                    Skip
                  </Button>
                  <Button type="button" disabled={busy} onClick={makeIt}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {busy ? 'Making it...' : 'Make its passport'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </section>
        )}

        {step === 'handover' && (
          <section className="space-y-4" data-sell-step="handover" aria-label={`Step ${stepNumber} of ${STEPS.length}: hand it to the buyer`}>
            {canTransfer && !guest ? (
              <SoldTransferStep inline gecko={current} onClose={finishHandover} />
            ) : (
              <>
                <p className="text-sm text-slate-300">
                  {guest
                    ? `The buyer scans a QR code or opens a link, signs in, and ${name} moves into their collection with its lineage and history.`
                    : `Only ${name}'s owner can hand it to a buyer. Ask them to open this record and choose Share, then Transfer to a new owner.`}
                </p>
                <DialogFooter>
                  <Button type="button" onClick={finishHandover}>Done</Button>
                </DialogFooter>
              </>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
