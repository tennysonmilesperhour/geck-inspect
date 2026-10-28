import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { captureEvent } from '@/lib/posthog';
import { makePassport } from '@/lib/makePassport';
import { transferPriceDefault } from '@/lib/transfers';
import TransferDialog from './TransferDialog';

const money = (value) => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * The step after "Archive as sold": "Send Mango to the buyer". The member
 * can skip it with one tap. Sending opens the usual transfer form with the
 * sale price already in it, so the buyer gets a QR link or an email and
 * Mango arrives in their collection with its lineage and history. This is
 * the distribution loop in docs/planning/growth-plan-2026-10.md: every
 * gecko a breeder sells carries Geck Inspect to the buyer.
 *
 * A gecko with no passport gets one when the transfer is sent, never
 * before. A passport only works while the gecko is public, so both this
 * step and the transfer form say so first.
 *
 * Props:
 *   gecko           the gecko as just saved (archived, status Sold, sold_price)
 *   onClose()       the step is finished: skipped, cancelled or sent
 *   onPassportMade  called with the changed fields when a passport is made
 */
export default function SoldTransferStep({ gecko, onClose, onPassportMade }) {
  const [stage, setStage] = useState('offer');
  const madeCode = useRef(null);
  const name = gecko?.name || 'this gecko';
  // The same, at the start of a sentence.
  const Name = gecko?.name || 'This gecko';
  const hasPassport = Boolean(gecko?.passport_code);
  const price = transferPriceDefault({ sold_price: gecko?.sold_price });
  const facts = { has_passport: hasPassport, has_price: price !== '' };

  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    captureEvent('sold_transfer_step', { action: 'shown', ...facts });
    // Once per step; the facts are those of the gecko it opened for.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    captureEvent('sold_transfer_step', { action: 'skipped', ...facts });
    onClose?.();
  };

  const send = () => {
    captureEvent('sold_transfer_step', { action: 'send', ...facts });
    setStage('transfer');
  };

  // Runs inside the transfer form's Send, before the transfer is made, so
  // closing the form without sending leaves the gecko as it was. A second
  // try after a failed transfer does not make a second passport.
  const ensurePassport = async () => {
    if (hasPassport || madeCode.current) return;
    let fields;
    try {
      fields = await makePassport(gecko, { surface: 'sold_step' });
    } catch (error) {
      console.error('Passport not made before the transfer:', error);
      throw new Error(`The passport for ${name} could not be made, so nothing was sent. Please try again.`);
    }
    madeCode.current = fields.passport_code;
    onPassportMade?.(fields);
  };

  const passportLine = `Sending makes ${name} a passport and turns on Public display, so its passport page is public.`;

  if (stage === 'transfer') {
    return (
      <TransferDialog
        open
        onOpenChange={(open) => { if (!open) onClose?.(); }}
        animal={gecko}
        animalType="gecko"
        surface="sold_step"
        beforeSend={hasPassport ? undefined : ensurePassport}
        notice={hasPassport ? null : passportLine}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) skip(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            Send {name} to the buyer
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {Name} is archived as sold. Send the buyer a transfer link. When they accept, {name} moves into their
            collection with its lineage and history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {price !== '' && (
            <p className="text-slate-300">
              The sale price ({money(price)}) goes on the transfer, so the sale stays in your Business Tools after the
              buyer accepts.
            </p>
          )}
          {!hasPassport && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100" data-sold-step-passport>
              {Name} has no passport yet. Sending makes one and turns on Public display, so {name}&apos;s passport page
              is public. Anyone with the link or the QR card can see its photos, lineage and care history.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="border-slate-600" onClick={skip}>Not now</Button>
          <Button type="button" onClick={send}>
            <ArrowRightLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Send to the buyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
