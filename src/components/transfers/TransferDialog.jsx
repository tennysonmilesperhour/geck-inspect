import { useEffect, useState } from 'react';
import { ArrowRightLeft, Check, Copy, Loader2, MailCheck, MailWarning } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  TRANSFER_TTL_HOURS,
  copyText,
  isValidEmail,
  parseSalePrice,
  startTransfer,
} from '@/lib/transfers';

/**
 * Seller's transfer form. Replaces the three browser pop-ups the gecko and
 * reptile records used to show. On send it creates the transfer, emails the
 * buyer their claim link, and shows the link so the seller can copy it too.
 */
export default function TransferDialog({ open, onOpenChange, animal, animalType = 'gecko', onTransferred }) {
  const [email, setEmail] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (open) {
      setEmail('');
      setPrice(animal?.asking_price != null ? String(animal.asking_price) : '');
      setMessage('');
      setErrors({});
      setSubmitting(false);
      setResult(null);
      setCopied(false);
    }
  }, [open, animal?.id]);

  const animalName = animal?.name || (animalType === 'gecko' ? 'this gecko' : 'this animal');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!isValidEmail(email)) nextErrors.email = "Enter the buyer's email address.";
    const parsedPrice = parseSalePrice(price);
    if (!parsedPrice.ok) nextErrors.price = 'Enter a price like 250, or leave it blank.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await startTransfer({
        animalId: animal.id,
        animalType,
        toEmail: email,
        salePrice: parsedPrice.value,
        message,
      });
      setResult({ ...res, toEmail: email.trim().toLowerCase() });
      if (onTransferred) onTransferred(res);
    } catch (err) {
      setErrors({ form: err?.message || 'The transfer could not be started. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const ok = await copyText(result.claimUrl);
    setCopied(ok);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
        {!result ? (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                Transfer {animalName}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                We email the buyer a claim link. When they accept, {animalName} moves to their
                collection with its full history. The link works for {TRANSFER_TTL_HOURS} hours.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="transfer-email" className="text-slate-200">Buyer&apos;s email</Label>
                <Input
                  id="transfer-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="buyer@example.com"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                  aria-invalid={!!errors.email}
                  autoFocus
                />
                {errors.email ? (
                  <p className="text-xs text-red-400">{errors.email}</p>
                ) : (
                  <p className="text-xs text-slate-500">They claim it by signing in with this address.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-price" className="text-slate-200">Sale price (optional)</Label>
                <Input
                  id="transfer-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="250"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                  aria-invalid={!!errors.price}
                />
                {errors.price && <p className="text-xs text-red-400">{errors.price}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-message" className="text-slate-200">Message for the buyer (optional)</Label>
                <Textarea
                  id="transfer-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Eating Pangea well, last weighed at 18 g."
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>

              {errors.form && (
                <p className="text-sm text-red-400" role="alert">{errors.form}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-slate-600" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                {submitting ? 'Sending...' : 'Send transfer'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {result.emailed
                  ? <MailCheck className="w-5 h-5 text-emerald-400" />
                  : <MailWarning className="w-5 h-5 text-amber-400" />}
                Transfer started
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {result.emailed
                  ? `We emailed ${result.toEmail} a link to claim ${animalName}.`
                  : `The email to ${result.toEmail} did not go out. Copy the link below and send it to them yourself.`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-2">
              <Label htmlFor="transfer-link" className="text-slate-200">Claim link</Label>
              <div className="flex gap-2">
                <Input
                  id="transfer-link"
                  readOnly
                  value={result.claimUrl}
                  onFocus={(e) => e.target.select()}
                  className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-xs"
                />
                <Button type="button" variant="outline" className="border-slate-600 shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="sr-only">Copy link</span>
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                The link expires in {TRANSFER_TTL_HOURS} hours. You can copy it again, resend it or cancel the
                transfer from the Transfers tab in My Geckos.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
