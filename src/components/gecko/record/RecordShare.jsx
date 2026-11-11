import { Link } from 'react-router-dom';
import { ArrowRightLeft, Copy, ExternalLink, QrCode, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { passportUrl } from '@/lib/passportUtils';

const ITEM = 'cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 focus:bg-slate-800 focus:text-white';

function Row({ icon: Icon, title, hint }) {
  return (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </>
  );
}

/**
 * Share, in the record's top bar: the passport, its QR card and the
 * transfer to a new owner, one tap from anywhere in the record.
 *
 * These used to live only in "Sharing and records", near the bottom of a
 * long page (about 3,900 px of scroll on a phone), which is a long way to
 * go for the thing a breeder does at the moment of a sale. That section is
 * still there, with the papers and the visibility switches.
 *
 * Anyone can open and copy an existing passport; making one needs edit
 * rights; only the owner can transfer (the database refuses anyone else).
 *
 *   backTo  where the passport page's Back link returns (the record)
 */
export default function RecordShare({ gecko, access, backTo, onCreatePassport, onTransfer }) {
  const code = gecko?.passport_code;
  const name = gecko?.name || 'this gecko';
  if (!code && !access?.canEdit && !access?.canTransfer) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(passportUrl(code));
      toast({ title: 'Passport link copied', description: `Paste it anywhere to share ${name}'s history.` });
    } catch {
      toast({ title: 'Could not copy the link', description: passportUrl(code), variant: 'destructive' });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Share ${name}`}>
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[99999] w-72 border-slate-700 bg-slate-900 p-1.5 text-slate-100"
      >
        {code ? (
          <>
            <DropdownMenuItem asChild className={ITEM}>
              <Link to={`/passport/${code}`} state={{ backTo }}>
                <Row icon={ExternalLink} title="View passport" hint="The public page a buyer sees" />
              </Link>
            </DropdownMenuItem>
            {access?.keeper && (
              <DropdownMenuItem asChild className={ITEM}>
                <Link to={`/passport/${code}/qr`} state={{ backTo }}>
                  <Row icon={QrCode} title="QR card" hint="Print it or save it for the tub" />
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className={ITEM} onSelect={copyLink}>
              <Row icon={Copy} title="Copy passport link" hint={code} />
            </DropdownMenuItem>
          </>
        ) : access?.canEdit ? (
          <DropdownMenuItem className={ITEM} onSelect={() => onCreatePassport?.()}>
            <Row
              icon={QrCode}
              title="Make a passport"
              hint={`A public page and QR card with its lineage and weigh-ins. This makes ${name}'s record public so the link works.`}
            />
          </DropdownMenuItem>
        ) : null}
        {access?.canTransfer && (
          <DropdownMenuItem className={ITEM} onSelect={() => onTransfer?.()}>
            <Row icon={ArrowRightLeft} title="Transfer to a new owner" hint="A link or QR code the buyer scans to take over the record" />
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
