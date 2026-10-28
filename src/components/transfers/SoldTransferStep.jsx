import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { captureEvent } from '@/lib/posthog';
import { claimUrlFor, copyText, findPendingTransfer, transferPriceDefault } from '@/lib/transfers';
import TransferDialog from './TransferDialog';

const money = (value) => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// "October 27", in the member's own time zone. Blank when the row has no date.
const dayOf = (iso) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';
};

/**
 * The step after "Archive as sold": "Send Mango to the buyer". The member
 * can skip it with one tap. Sending opens the usual transfer form with the
 * sale price already in it, so the buyer gets a QR link or an email and
 * Mango arrives in their collection with its lineage and history. This is
 * the distribution loop in docs/planning/growth-plan-2026-10.md: every
 * gecko a breeder sells carries Geck Inspect to the buyer.
 *
 * The step sends the transfer only. It never makes a passport and never
 * turns on Public display: create_transfer and the claim page's preview
 * both work on a private gecko. Once the buyer accepts, Mango is theirs,
 * and they can make a passport from its record if they want one.
 *
 * A new link cancels any link already pending for the gecko, so the step
 * first reads the seller's own pending link. When there is one, it says
 * plainly that a new link replaces the one sent on that day, and lets the
 * seller keep it (and see it again) instead.
 *
 * Props:
 *   gecko    the gecko as just saved (archived, status Sold, sold_price)
 *   onClose  the step is finished: skipped, kept, cancelled or sent
 */
export default function SoldTransferStep({ gecko, onClose }) {
  // checking (nothing shown yet), offer, existing (the link already sent)
  // or transfer (the transfer form).
  const [stage, setStage] = useState('checking');
  // The seller's pending link for this gecko: null when there is none,
  // undefined when the check could not be made.
  const [pending, setPending] = useState(null);
  const [copied, setCopied] = useState(false);
  const name = gecko?.name || 'this gecko';
  // The same, at the start of a sentence.
  const Name = gecko?.name || 'This gecko';
  const price = transferPriceDefault({ sold_price: gecko?.sold_price });
  const facts = {
    has_passport: Boolean(gecko?.passport_code),
    has_price: price !== '',
    has_pending: pending === undefined ? null : Boolean(pending),
  };

  useEffect(() => {
    let live = true;
    findPendingTransfer({ animalId: gecko?.id })
      .then((row) => { if (live) setPending(row); })
      .catch((error) => {
        console.warn('Could not check for a transfer link already sent:', error);
        if (live) setPending(undefined);
      })
      .finally(() => { if (live) setStage('offer'); });
    return () => { live = false; };
  }, [gecko?.id]);

  const shown = useRef(false);
  useEffect(() => {
    if (stage !== 'offer' || shown.current) return;
    shown.current = true;
    captureEvent('sold_transfer_step', { action: 'shown', ...facts });
    // Once per step, after the check; the facts are those it opened with.
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    captureEvent('sold_transfer_step', { action: 'skipped', ...facts });
    onClose?.();
  };

  const keep = () => {
    captureEvent('sold_transfer_step', { action: 'kept_existing', ...facts });
    setStage('existing');
  };

  const send = () => {
    captureEvent('sold_transfer_step', { action: 'send', ...facts });
    setStage('transfer');
  };

  if (stage === 'checking') return null;

  const sentOn = dayOf(pending?.created_date);
  const pendingTo = String(pending?.to_email || '').trim();

  if (stage === 'transfer') {
    return (
      <TransferDialog
        open
        onOpenChange={(open) => { if (!open) onClose?.(); }}
        animal={gecko}
        animalType="gecko"
        surface="sold_step"
        notice={pending
          ? `This replaces the link you sent${sentOn ? ` on ${sentOn}` : ''}. That link stops working.`
          : null}
      />
    );
  }

  if (stage === 'existing' && pending) {
    const claimUrl = claimUrlFor(pending.token);
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">The link you sent for {name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {pendingTo
                ? `Only ${pendingTo} can accept it.`
                : 'Share it only with the new owner. The first verified account to accept becomes the owner.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="mx-auto w-fit rounded-lg bg-white p-4">
              <QRCodeSVG value={claimUrl} size={192} level="M" title="Transfer QR code" role="img" aria-label="Transfer QR code" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sold-step-existing-link">Claim link</Label>
              <div className="flex gap-2">
                <Input id="sold-step-existing-link" readOnly value={claimUrl} onFocus={(event) => event.target.select()} className="font-mono text-xs min-w-0" />
                <Button type="button" variant="outline" size="icon" aria-label="Copy link" onClick={async () => setCopied(await copyText(claimUrl))}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-400" role="status">{copied ? 'Link copied.' : 'You can select and copy the link above.'}</p>
            </div>
            <p className="text-xs text-slate-400">
              {pending.expires_at ? `Expires ${new Date(pending.expires_at).toLocaleString()}. ` : ''}
              You can find it again in the Transfers tab in My Geckos.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => onClose?.()}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          {pending && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100" data-sold-step-pending>
              {pendingTo
                ? `You already emailed ${pendingTo} a transfer link for ${name}${sentOn ? ` on ${sentOn}` : ''}.`
                : `You already made a QR transfer link for ${name}${sentOn ? ` on ${sentOn}` : ''}.`}
              {' '}A new link replaces it, and the one you sent stops working. Keep it if the buyer already has it.
            </p>
          )}
          {pending === undefined && (
            <p className="text-slate-400">
              If you already sent a transfer link for {name}, a new one replaces it and the old link stops working.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          {pending ? (
            <>
              <Button type="button" variant="outline" className="border-slate-600" onClick={keep}>Keep the link I sent</Button>
              <Button type="button" onClick={send}>
                <ArrowRightLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Send a new link
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" className="border-slate-600" onClick={skip}>Not now</Button>
              <Button type="button" onClick={send}>
                <ArrowRightLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Send to the buyer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
