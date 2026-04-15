import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Package, CheckCircle2 } from 'lucide-react';
import { bookShipment, IS_DEMO } from '@/integrations/ShipZeros';
import { User } from '@/entities/all';

// Hoisted outside the component so React doesn't remount inputs on
// every parent re-render (which would cause focus loss on keystroke).
function AddressFields({ values, onChange, prefix }) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-slate-400 text-xs">{prefix} name</Label>
        <Input
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Full name"
          className="bg-slate-950 border-slate-700 text-slate-100 h-9"
        />
      </div>
      <div>
        <Label className="text-slate-400 text-xs">Street address</Label>
        <Input
          value={values.address}
          onChange={(e) => onChange('address', e.target.value)}
          placeholder="123 Main St"
          className="bg-slate-950 border-slate-700 text-slate-100 h-9"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-slate-400 text-xs">City</Label>
          <Input
            value={values.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="City"
            className="bg-slate-950 border-slate-700 text-slate-100 h-9"
          />
        </div>
        <div>
          <Label className="text-slate-400 text-xs">State</Label>
          <Input
            value={values.state}
            onChange={(e) => onChange('state', e.target.value.toUpperCase().slice(0, 2))}
            placeholder="CA"
            maxLength={2}
            className="bg-slate-950 border-slate-700 text-slate-100 h-9"
          />
        </div>
        <div>
          <Label className="text-slate-400 text-xs">ZIP</Label>
          <Input
            value={values.zip}
            onChange={(e) => onChange('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="90210"
            maxLength={5}
            className="bg-slate-950 border-slate-700 text-slate-100 h-9"
          />
        </div>
      </div>
      <div>
        <Label className="text-slate-400 text-xs">Phone</Label>
        <Input
          value={values.phone}
          onChange={(e) => onChange('phone', e.target.value.replace(/[^0-9() +-]/g, ''))}
          placeholder="(555) 123-4567"
          className="bg-slate-950 border-slate-700 text-slate-100 h-9"
        />
      </div>
    </div>
  );
}

export default function ShippingBookingForm({ quote, onBooked }) {
  const [sender, setSender] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });
  const [recipient, setRecipient] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Pre-fill sender from user profile
  useEffect(() => {
    User.me().then((u) => {
      if (u) {
        setSender((prev) => ({
          ...prev,
          name: u.full_name || prev.name,
        }));
      }
    }).catch(() => {});
  }, []);

  const updateSender = (field, value) =>
    setSender((prev) => ({ ...prev, [field]: value }));
  const updateRecipient = (field, value) =>
    setRecipient((prev) => ({ ...prev, [field]: value }));

  const isValid =
    sender.name &&
    sender.address &&
    sender.city &&
    sender.state &&
    sender.zip &&
    sender.phone &&
    recipient.name &&
    recipient.address &&
    recipient.city &&
    recipient.state &&
    recipient.zip &&
    recipient.phone;

  const handleBook = async (e) => {
    e.preventDefault();
    if (!isValid || !quote) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await bookShipment({
        quoteId: quote.quoteId,
        sender,
        recipient,
        notes,
      });
      setResult(res);
      onBooked?.({ ...res, _recipient: recipient, _sender: sender });
    } catch (err) {
      setError(err.message || 'Booking failed');
    }
    setIsLoading(false);
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Shipment booked!</h3>
        <div className="space-y-2 text-sm">
          <p className="text-slate-300">
            Tracking #:{' '}
            <span className="font-mono text-emerald-300">{result.trackingNumber}</span>
          </p>
          <p className="text-slate-300">
            Service: <span className="text-white">{result.service}</span>
          </p>
          <p className="text-slate-300">
            Est. delivery:{' '}
            <span className="text-white">{result.estimatedDelivery}</span>
          </p>
        </div>
        {result.labelUrl && result.labelUrl !== '#demo-label' && (
          <a href={result.labelUrl} target="_blank" rel="noopener noreferrer">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Package className="w-4 h-4 mr-2" /> Print shipping label
            </Button>
          </a>
        )}
        {IS_DEMO && (
          <p className="text-xs text-amber-400/70 mt-2">
            Demo mode — label printing will be available once the integration is live.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleBook} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Sender (you)</h4>
          <AddressFields values={sender} onChange={updateSender} prefix="Sender" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Recipient (buyer)</h4>
          <AddressFields values={recipient} onChange={updateRecipient} prefix="Recipient" />
        </div>
      </div>

      <div>
        <Label htmlFor="ship-notes" className="text-slate-300">
          Shipping notes (optional)
        </Label>
        <Textarea
          id="ship-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special handling instructions, animal species/morph info..."
          rows={3}
          className="bg-slate-950 border-slate-700 text-slate-100"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!isValid || isLoading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-5"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Booking shipment...
          </>
        ) : (
          <>
            <Package className="w-4 h-4 mr-2" /> Book shipment — ${quote?.price?.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}
