import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skull, DollarSign, HelpCircle } from 'lucide-react';
import SaleDetailsFields, { initialSaleDetails, saleDetailsPatch } from '@/components/business/SaleDetailsFields';

const REASONS = [
  { value: 'death', label: 'Passed Away', icon: Skull, color: 'border-red-500 text-red-400 bg-red-900/20 hover:bg-red-900/40' },
  { value: 'sold', label: 'Sold', icon: DollarSign, color: 'border-blue-500 text-blue-400 bg-blue-900/20 hover:bg-blue-900/40' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'border-slate-500 text-slate-300 bg-slate-800 hover:bg-slate-700' },
];

/**
 * Asks why a gecko is being archived. "Passed Away" and "Other" confirm
 * straight away; "Sold" first asks what it sold for, so Business Tools
 * has the real price. onConfirm(reason, extraFields).
 */
export default function ArchiveReasonDialog({ open, onConfirm, onCancel, geckoName, gecko, defaultSaleCategory = '' }) {
  const [selected, setSelected] = useState(null);
  const [sale, setSale] = useState(() => initialSaleDetails(gecko, defaultSaleCategory));

  const reset = () => {
    setSelected(null);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected, selected === 'sold' ? saleDetailsPatch(sale) : {});
    reset();
  };

  const handleSelectReason = (reason) => {
    if (reason === 'sold') {
      setSelected('sold');
      setSale(initialSaleDetails(gecko, defaultSaleCategory));
      return;
    }
    setSelected(reason);
    // Other reasons confirm immediately
    setTimeout(() => {
      onConfirm(reason, {});
      reset();
    }, 0);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Archive {geckoName}</DialogTitle>
          <p className="text-slate-400 text-sm">Why is this gecko being archived?</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          {REASONS.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              onClick={() => handleSelectReason(value)}
              className={`touch:min-h-11 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                selected === value ? color.replace('hover:', '') : 'border-slate-700 text-slate-400 bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

        {selected === 'sold' && <SaleDetailsFields value={sale} onChange={setSale} />}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} className="border-slate-600">Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="bg-yellow-700 hover:bg-yellow-800 text-white"
          >
            {selected === 'sold' ? 'Archive as sold' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
