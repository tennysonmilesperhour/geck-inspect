import { useEffect, useState } from 'react';
import { ArrowRightLeft, Check, Copy, Loader2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TRANSFER_TTL_HOURS, copyText, isValidEmail, parseSalePrice, startTransfer } from '@/lib/transfers';

/**
 * Seller's transfer form. Replaces the three browser pop-ups the gecko and
 * reptile records used to show. On send it creates the transfer, either as a
 * QR link the owner shows or shares, or as a claim link emailed to the buyer,
 * and shows the link so the seller can copy it too.
 * initialEmail fills the buyer's address when the owner arrives from a
 * buyer's transfer request (the passport page's "ask the owner" button).
 */
export default function TransferDialog({ open, onOpenChange, animal, animalType = 'gecko', initialEmail = '', onTransferred }) {
  const [mode, setMode] = useState('link');
  const [email, setEmail] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    // A buyer who asked from the passport page gave their email, so the
    // form opens on email mode with it filled in; otherwise a gecko opens
    // on the QR link.
    setMode(initialEmail || animalType !== 'gecko' ? 'email' : 'link');
    setEmail(initialEmail || '');
    setPrice(animal?.asking_price != null ? String(animal.asking_price) : '');
    setMessage('');
    setErrors({});
    setSubmitting(false);
    setResult(null);
    setCopied(false);
  }, [open, animal?.id, animal?.asking_price, animalType, initialEmail]);

  const animalName = animal?.name || (animalType === 'gecko' ? 'this gecko' : 'this animal');
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = {};
    if (mode === 'email' && !isValidEmail(email)) nextErrors.email = "Enter the buyer's email address.";
    const parsedPrice = parseSalePrice(price);
    if (!parsedPrice.ok) nextErrors.price = 'Enter a price like 250, or leave it blank.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const res = await startTransfer({ animalId: animal.id, animalType, toEmail: mode === 'email' ? email : null, salePrice: parsedPrice.value, message });
      setResult({ ...res, toEmail: mode === 'email' ? email.trim().toLowerCase() : null });
      onTransferred?.(res);
    } catch (error) {
      setErrors({ form: error?.message || 'The transfer could not be started. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        {!result ? (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-emerald-400" />Transfer {animalName}</DialogTitle>
              <DialogDescription>Create a link for the new owner. {animalName} stays in your collection until they accept. The link expires in {TRANSFER_TTL_HOURS} hours.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {animalType === 'gecko' && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">How will you share it?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={mode === 'link' ? 'default' : 'outline'} aria-pressed={mode === 'link'} onClick={() => setMode('link')}>QR link</Button>
                    <Button type="button" variant={mode === 'email' ? 'default' : 'outline'} aria-pressed={mode === 'email'} onClick={() => setMode('email')}>Email a buyer</Button>
                  </div>
                  <p className="text-xs text-slate-400">{mode === 'link' ? 'Anyone with this link and a verified account can accept it. Share it only with the new owner.' : 'Only the buyer signed in with this verified email can accept it. A QR code is included too.'}</p>
                </fieldset>
              )}
              {mode === 'email' && (
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-email">Buyer&apos;s email</Label>
                  <Input id="transfer-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="buyer@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'transfer-email-error' : undefined} />
                  {errors.email && <p id="transfer-email-error" className="text-xs text-red-400">{errors.email}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="transfer-price">Sale price (optional)</Label>
                <Input id="transfer-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="250" aria-invalid={!!errors.price} aria-describedby={errors.price ? 'transfer-price-error' : undefined} />
                {errors.price && <p id="transfer-price-error" className="text-xs text-red-400">{errors.price}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transfer-message">Message for the buyer (optional)</Label>
                <Textarea id="transfer-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} maxLength={1000} placeholder="Eating Pangea well, last weighed at 18 g." />
              </div>
              <p className="text-xs text-slate-400">The gecko keeps its identity and recorded history. Private gecko notes stay with you in Transfers. Shared collection and breeding records keep their existing access.</p>
              {errors.form && <p className="text-sm text-red-400" role="alert">{errors.form}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                {submitting ? 'Creating link...' : mode === 'email' ? 'Send transfer' : 'Create QR link'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Transfer started</DialogTitle>
              <DialogDescription>{!result.toEmail ? 'Let the new owner scan this code. They can create an account or sign in, then accept ownership.' : result.emailed ? `We emailed ${result.toEmail} a claim link. They can also scan this code.` : `The email to ${result.toEmail} did not go out. Share this QR code or copy the link.`}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="mx-auto w-fit rounded-lg bg-white p-4">
                <QRCodeSVG value={result.claimUrl} size={192} level="M" title="Transfer QR code" role="img" aria-label="Transfer QR code" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transfer-link">Claim link</Label>
                <div className="flex gap-2">
                  <Input id="transfer-link" readOnly value={result.claimUrl} onFocus={(event) => event.target.select()} className="font-mono text-xs min-w-0" />
                  <Button type="button" variant="outline" size="icon" aria-label="Copy link" onClick={async () => setCopied(await copyText(result.claimUrl))}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
                </div>
                <p className="text-xs text-slate-400" role="status">{copied ? 'Link copied.' : 'You can select and copy the link above.'}</p>
              </div>
              <p className="text-xs text-slate-400">Expires {result.expires_at ? new Date(result.expires_at).toLocaleString() : `in ${TRANSFER_TTL_HOURS} hours`}. View the QR code again or cancel the link from the Transfers tab in My Geckos.</p>
              {!result.toEmail && <p className="text-xs text-amber-300">Keep this link private. The first verified account to accept becomes the owner.</p>}
            </div>
            <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
