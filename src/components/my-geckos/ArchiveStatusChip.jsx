import { Archive, BadgeDollarSign, Flower2 } from 'lucide-react';

/**
 * Why a gecko left the active collection, as a quiet labelled chip.
 *
 * A gecko that died used to be marked with a skull emoji on its card. For
 * a keeper who lost an animal that reads as a joke, so it is now a plain
 * "In memory" chip in neutral colours (no alarm red), and every archive
 * reason is spelled out in words instead of an unlabelled emoji.
 */
export const ARCHIVE_STATUS = {
  death: { label: 'In memory', Icon: Flower2 },
  sold: { label: 'Sold', Icon: BadgeDollarSign },
  other: { label: 'Archived', Icon: Archive },
};

export function archiveStatusFor(reason) {
  return ARCHIVE_STATUS[reason] || ARCHIVE_STATUS.other;
}

export default function ArchiveStatusChip({ reason, className = '' }) {
  const { label, Icon } = archiveStatusFor(reason);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-950/85 px-2 py-0.5 text-xs font-medium text-slate-100 ${className}`}
    >
      <Icon className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
      {label}
    </span>
  );
}
