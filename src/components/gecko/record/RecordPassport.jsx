import { Suspense } from 'react';
import { ArrowRightLeft, Award, ExternalLink, Eye, EyeOff, FileText, GitBranch, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { passportUrl } from '@/lib/passportUtils';
import RecordCard from './RecordCard';
import { lazyOptional } from './loadOnDemand';

// Only a gecko with a passport has something to share.
const ShareMenu = lazyOptional(() => import('@/components/shared/ShareMenu'));

const PAPERS = [
  { id: 'ownership', label: 'Ownership certificate', busyLabel: 'Making the certificate...', icon: Award },
  { id: 'lineage', label: 'Lineage certificate', busyLabel: 'Making the certificate...', icon: GitBranch },
  {
    id: 'packet',
    label: 'Buyer packet',
    busyLabel: 'Building the packet...',
    icon: FileText,
    title: 'One PDF for the buyer: photo, traits, lineage, weights, feeding and the passport QR',
  },
];

/**
 * The passport, the transfer to a buyer, the printed papers and who can
 * see the gecko. Anyone can open and share an existing passport; making
 * one, the papers and the visibility switches need edit rights; only the
 * owner can transfer (the database refuses anyone else).
 *
 *   busy  the paper being made ('ownership', 'lineage' or 'packet'), or null
 */
export default function RecordPassport({
  gecko, access, busy = null, isPublic, galleryDisplay,
  onCreatePassport, onTransfer, onPaper, onTogglePublic, onToggleGallery, headingAs,
}) {
  const code = gecko.passport_code;
  const name = gecko.name || 'This gecko';
  if (!code && !access.canEdit) return null;

  return (
    <RecordCard id="passport" icon={QrCode} title="Passport and papers" headingAs={headingAs} contentClassName="space-y-4">
      {code ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">
            Passport <span className="font-mono text-slate-100">{code}</span>. Anyone with the link or the QR card sees {name}&apos;s public history.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <a href={`/passport/${code}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" /> View passport
              </a>
            </Button>
            {access.keeper ? (
              <Button asChild variant="outline">
                <a href={`/passport/${code}/qr`} target="_blank" rel="noopener noreferrer">
                  <QrCode className="w-4 h-4 mr-2" /> QR card
                </a>
              </Button>
            ) : <span />}
          </div>
          <Suspense fallback={null}>
            <ShareMenu
              url={passportUrl(code)}
              title={`${name} on Geck Inspect`}
              subtitle={[gecko.morphs_traits, gecko.sex].filter(Boolean).join(' · ')}
            />
          </Suspense>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            A passport gives {name} a public page and a QR card with its lineage and weigh-ins, so the buyer can claim it when you sell.
          </p>
          <Button variant="outline" onClick={onCreatePassport} className="w-full sm:w-auto">
            <QrCode className="w-4 h-4 mr-2" /> Make a passport
          </Button>
        </div>
      )}

      {access.canTransfer && (
        <Button variant="outline" onClick={onTransfer} className="w-full sm:w-auto border-amber-600 text-amber-300 hover:bg-amber-900/20">
          <ArrowRightLeft className="w-4 h-4 mr-2" /> Transfer to a new owner
        </Button>
      )}

      {access.canEdit && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Papers (PDF)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PAPERS.map((paper) => {
              const Icon = paper.icon;
              const working = busy === paper.id;
              return (
                <Button
                  key={paper.id}
                  variant="outline"
                  onClick={() => onPaper(paper.id)}
                  disabled={Boolean(busy)}
                  title={paper.title}
                >
                  {working
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {paper.busyLabel}</>
                    : <><Icon className="w-4 h-4 mr-2" /> {paper.label}</>}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {access.canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-slate-800 p-3 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="record-public" className="text-slate-200 flex items-center gap-2 cursor-pointer">
                {isPublic ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                Public display
              </Label>
              <Switch id="record-public" checked={isPublic} onCheckedChange={onTogglePublic} />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {isPublic ? 'Shown on your public profile.' : 'Hidden from everyone but you and your collection.'}
            </p>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="record-gallery" className="text-slate-200 cursor-pointer">Gallery display</Label>
              <Switch id="record-gallery" checked={Boolean(galleryDisplay)} onCheckedChange={onToggleGallery} />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Submit this gecko&apos;s photos to the public Gallery. Photos from established members appear right away; others appear after a quick check.</p>
          </div>
        </div>
      )}
    </RecordCard>
  );
}
