import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, ArrowRight, Columns3, X } from 'lucide-react';
import { TEMPLATE_FIELDS, requiredFieldsCovered, unmappedSourceColumns } from './columnMapper';

/**
 * Interactive column mapping UI.
 *
 * Shows a two-column layout: template field on the left, a dropdown of source
 * CSV columns on the right. Includes a data preview and coverage indicators.
 */
export default function CSVColumnMapper({
  sourceHeaders,
  previewRows,
  mapping,
  onMappingChange,
}) {
  const coverage = useMemo(() => requiredFieldsCovered(mapping), [mapping]);
  const unmapped = useMemo(() => unmappedSourceColumns(mapping, sourceHeaders), [mapping, sourceHeaders]);

  const mappedCount = TEMPLATE_FIELDS.filter(f => mapping[f.key] != null).length;

  /** Build options list: "skip" + every source header not already used by another field */
  const optionsFor = (fieldKey) => {
    const usedByOthers = new Set(
      Object.entries(mapping)
        .filter(([k, v]) => k !== fieldKey && v != null)
        .map(([, v]) => v)
    );
    return sourceHeaders
      .map((h, i) => ({ label: h, index: i }))
      .filter(({ index }) => !usedByOthers.has(index) || mapping[fieldKey] === index);
  };

  const handleChange = (fieldKey, value) => {
    onMappingChange({
      ...mapping,
      [fieldKey]: value === '__skip__' ? null : Number(value),
    });
  };

  /** Get a preview value for a mapped field (from the first data row) */
  const previewValue = (fieldKey) => {
    const idx = mapping[fieldKey];
    if (idx == null || !previewRows[0]) return null;
    return previewRows[0][idx] || null;
  };

  return (
    <div className="space-y-4">
      {/* Coverage summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Columns3 className="w-4 h-4 text-sage-400" />
          <span>
            <strong className="text-white">{mappedCount}</strong> of{' '}
            {TEMPLATE_FIELDS.length} fields mapped
          </span>
        </div>
        {coverage.mapped < coverage.total && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Required: {coverage.missing.map(f => f.label).join(', ')}
          </div>
        )}
        {coverage.mapped === coverage.total && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <Check className="w-3.5 h-3.5" />
            All required fields mapped
          </div>
        )}
      </div>

      {/* Mapping rows */}
      <div className="border border-slate-700/60 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr,auto,1fr,1fr] gap-2 items-center px-3 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <span>Geck Inspect Field</span>
          <span></span>
          <span>Your CSV Column</span>
          <span>Preview</span>
        </div>

        <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-800/50">
          {TEMPLATE_FIELDS.map(({ key, label, required }) => {
            const isMapped = mapping[key] != null;
            const preview = previewValue(key);

            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr,auto,1fr,1fr] gap-2 items-center px-3 py-2 transition-colors ${
                  isMapped ? 'bg-slate-900/40' : 'bg-slate-900/20'
                }`}
              >
                {/* Template field */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-200 truncate">{label}</span>
                  {required && (
                    <Badge className="bg-amber-900/40 text-amber-300 border-amber-700/50 text-[10px] px-1.5 py-0 shrink-0">
                      req
                    </Badge>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isMapped ? 'text-emerald-500' : 'text-slate-600'}`} />

                {/* Source column select */}
                <Select
                  value={isMapped ? String(mapping[key]) : '__skip__'}
                  onValueChange={(v) => handleChange(key, v)}
                >
                  <SelectTrigger className={`h-8 text-xs ${
                    isMapped
                      ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-200'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400'
                  }`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <X className="w-3 h-3" /> Skip
                      </span>
                    </SelectItem>
                    {optionsFor(key).map(({ label: hdr, index }) => (
                      <SelectItem key={index} value={String(index)}>
                        {hdr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Preview */}
                <div className="text-xs text-slate-500 truncate min-w-0" title={preview || ''}>
                  {preview || <span className="italic">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unmapped source columns notice */}
      {unmapped.length > 0 && (
        <div className="text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">
            Skipped columns from your CSV ({unmapped.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {unmapped.map(({ header, index }) => (
              <Badge
                key={index}
                variant="outline"
                className="text-[10px] text-slate-500 border-slate-700"
              >
                {header}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Data preview table */}
      {previewRows.length > 0 && mappedCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">
            Preview (first {Math.min(previewRows.length, 3)} rows as they'll be imported):
          </p>
          <div className="overflow-x-auto border border-slate-700/60 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {TEMPLATE_FIELDS.filter(f => mapping[f.key] != null).map(f => (
                    <th key={f.key} className="px-2 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {previewRows.slice(0, 3).map((row, ri) => (
                  <tr key={ri} className="bg-slate-900/30">
                    {TEMPLATE_FIELDS.filter(f => mapping[f.key] != null).map(f => (
                      <td key={f.key} className="px-2 py-1.5 text-slate-300 whitespace-nowrap max-w-[150px] truncate">
                        {row[mapping[f.key]] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
