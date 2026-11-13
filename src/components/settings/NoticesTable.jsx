import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SaveError, SaveTick } from './SaveStatus';

/**
 * One row per kind of notice, from the two stored lists (Settings.jsx):
 * `emailKinds` are the email grouping keys, `pushKinds` the push keys.
 * A push kind names the email switch its mail follows (`email`, the same
 * mapping the send-email function uses); `shared` means it is the same
 * notice as that email row, so the two switches sit on one row. The
 * other push kinds get their own row under it, with an empty email cell.
 * Every key of both lists appears exactly once.
 */
export function buildNoticeRows(emailKinds, pushKinds) {
  const rows = [];
  const placed = new Set();
  for (const kind of emailKinds) {
    const twin = pushKinds.find((p) => p.email === kind.key && p.shared);
    if (twin) placed.add(twin.key);
    rows.push({ id: `email:${kind.key}`, label: kind.label, description: kind.description, emailKey: kind.key, pushKey: twin?.key || null, parentLabel: null });
    for (const p of pushKinds) {
      if (p.email !== kind.key || p.shared) continue;
      placed.add(p.key);
      rows.push({ id: `push:${p.key}`, label: p.label, description: p.description, emailKey: null, pushKey: p.key, parentLabel: kind.label });
    }
  }
  // A push kind with no email switch behind it still gets its row.
  for (const p of pushKinds) {
    if (placed.has(p.key)) continue;
    rows.push({ id: `push:${p.key}`, label: p.label, description: p.description, emailKey: null, pushKey: p.key, parentLabel: null });
  }
  return rows;
}

// An empty cell: blank to the eye, "Not available" to a screen reader.
const EmptyCell = () => <span className="sr-only">Not available</span>;

// A column whose master switch is off is dimmed here, on a wrapper: an
// app-wide rule (layout-theme.css) forces every switch to full opacity,
// so the switch's own disabled style never shows.
const Dimmable = ({ off, children }) => (
  <span className={cn('inline-flex', off && 'opacity-40')}>{children}</span>
);

/**
 * Settings, Reminders: the notices table (finding J7). It replaces the
 * two long switch lists (email, then push) with one table: a row per
 * kind of notice, a column for Email and one for Push. Each switch still
 * writes the same key of the same list as before. A column whose master
 * switch is off stays visible, disabled, so the member can see what
 * would arrive. `showPush` is false where this browser cannot take web
 * push; the column is left out there, as the push list was.
 */
export default function NoticesTable({
  emailKinds, pushKinds, emailTypes, pushTypes, emailOn, pushOn, showPush,
  onToggleEmail, onTogglePush, emailStatus, pushStatus, onRetryEmail, onRetryPush,
}) {
  const rows = useMemo(() => buildNoticeRows(emailKinds, pushKinds), [emailKinds, pushKinds]);
  const visible = showPush ? rows : rows.filter((r) => r.emailKey);
  const email = Array.isArray(emailTypes) ? emailTypes : [];
  const push = Array.isArray(pushTypes) ? pushTypes : [];
  const cell = 'w-16 px-2 py-3 text-center align-middle';

  return (
    <div>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Choose what reaches you, and how.</p>
        <span className="flex items-center gap-3">
          <SaveTick status={emailStatus} />
          {emailStatus?.state !== 'saving' && <SaveTick status={pushStatus} />}
        </span>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Notices by email{showPush ? ' and by push' : ''}</caption>
          <thead className="bg-slate-800/60 text-xs text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Kind of notice</th>
              <th scope="col" className="w-16 px-2 py-2 text-center font-medium">
                Email{!emailOn && <span className="block font-normal">Off</span>}
              </th>
              {showPush && (
                <th scope="col" className="w-16 px-2 py-2 text-center font-medium">
                  Push{!pushOn && <span className="block font-normal">Off</span>}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={cn('px-3 py-3 font-normal align-top', row.parentLabel && 'pl-7')}>
                  <span className="block font-medium text-slate-200">{row.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {row.description}
                    {row.parentLabel && ` Its email follows ${row.parentLabel}.`}
                  </span>
                </th>
                <td className={cell}>
                  {row.emailKey ? (
                    <Dimmable off={!emailOn}>
                      <Switch
                        id={`email-${row.emailKey}`}
                        aria-label={`${row.label}, email`}
                        checked={email.includes(row.emailKey)}
                        disabled={!emailOn}
                        onCheckedChange={() => onToggleEmail(row.emailKey)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </Dimmable>
                  ) : <EmptyCell />}
                </td>
                {showPush && (
                  <td className={cell}>
                    {row.pushKey ? (
                      <Dimmable off={!pushOn}>
                        <Switch
                          id={`push-${row.pushKey}`}
                          aria-label={`${row.label}, push`}
                          checked={push.includes(row.pushKey)}
                          disabled={!pushOn}
                          onCheckedChange={() => onTogglePush(row.pushKey)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </Dimmable>
                    ) : <EmptyCell />}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveError status={emailStatus} onRetry={onRetryEmail} />
      <SaveError status={pushStatus} onRetry={onRetryPush} />
    </div>
  );
}
