import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// The transfer form and the "send it to the buyer" step each open as a
// dialog of their own, and also sit inside the sold sheet as its last
// step (SellHandoverSheet). This is the one switch between the two, so
// neither has a second copy of its content.

const join = (...names) => names.filter(Boolean).join(' ');

const inlineParts = {
  Header: ({ className, children }) => <div className={join('space-y-1.5', className)}>{children}</div>,
  // A heading inside the sheet, which has its own title.
  Title: ({ className, children }) => <h3 className={join('text-base font-semibold text-slate-100', className)}>{children}</h3>,
  Description: ({ className, children }) => <p className={join('text-sm text-slate-400', className)}>{children}</p>,
  Footer: ({ className, children }) => <div className={join('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>{children}</div>,
};

const dialogParts = { Header: DialogHeader, Title: DialogTitle, Description: DialogDescription, Footer: DialogFooter };

/** The header, title, description and footer to use: the dialog's own, or plain ones inline. */
export const frameParts = (inline) => (inline ? inlineParts : dialogParts);

/**
 * The content in its own dialog, or (inline) as a plain block inside
 * the sheet that is already open around it.
 */
export default function StepFrame({ inline = false, open = true, onOpenChange, className, children }) {
  if (inline) return open ? <div data-transfer-inline className="space-y-4">{children}</div> : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>{children}</DialogContent>
    </Dialog>
  );
}
