// The rack walk in Field Mode (experience review E4, 13 Nov 2026).
//
// A breeder feeding 40 crested geckos used to tap Back and pick the next
// one from the list after every log. Field Mode now follows one order:
// the geckos due today or overdue first (oldest first, the order of the
// Today screen), then everyone else by name. After a save the main button
// is "Next: Nimbus", and leaving shows what the session came to
// ("12 fed, 3 weighed, 1 refused").
//
// No React and no network here, so the rules are tested on their own
// (src/lib/__tests__/fieldWalk.test.js). The screen is
// src/pages/FieldMode.jsx.

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));

/**
 * The order Field Mode walks the collection in.
 *
 *   geckos     the geckos Field Mode lists
 *   todayData  the Today list ({ items: [{ kind, geckoId, groupId, due }] }),
 *              or null when the phone does not have it
 *   today      YYYY-MM-DD
 *
 * Returns { order, due }: `order` is every gecko, due ones first; `due`
 * maps a gecko id to the day its oldest feeding or weigh-in fell due. A
 * feeding group that is due counts for each of its geckos.
 */
export function walkOrder(geckos = [], todayData = null, today = null) {
  const list = (geckos || []).filter(Boolean);
  const day = String(today || todayData?.today || '').slice(0, 10);
  const due = new Map();
  const mark = (id, when) => {
    const key = String(id);
    if (!due.has(key) || when < due.get(key)) due.set(key, when);
  };
  for (const item of todayData?.items || []) {
    if (item?.kind !== 'feeding' && item?.kind !== 'weigh_in') continue;
    if (!item.due || !day || item.due > day) continue;
    if (item.geckoId) mark(item.geckoId, item.due);
    else if (item.groupId) {
      for (const gecko of list) {
        if (String(gecko.feeding_group_id || '') === String(item.groupId)) mark(gecko.id, item.due);
      }
    }
  }
  const dueFirst = list
    .filter((g) => due.has(String(g.id)))
    .sort((a, b) => {
      const da = due.get(String(a.id));
      const db = due.get(String(b.id));
      if (da !== db) return da < db ? -1 : 1;
      return byName(a, b);
    });
  const others = list.filter((g) => !due.has(String(g.id))).sort(byName);
  return { order: [...dueFirst, ...others], due };
}

/**
 * The gecko "Next" goes to: the first one after `currentId` in the walk
 * that has no log this session, wrapping round to the start. Null when
 * every other gecko has been logged.
 */
export function nextInWalk(order = [], currentId = null, handled = new Set()) {
  const at = order.findIndex((g) => String(g.id) === String(currentId));
  const ahead = at < 0 ? order : [...order.slice(at + 1), ...order.slice(0, at)];
  return ahead.find((g) => !handled.has(String(g.id))) || null;
}

/** The ids of the geckos with a log this session. */
export function handledIds(logs = []) {
  return new Set((logs || []).map((log) => String(log.geckoId)));
}

/**
 * What a session came to, for the line shown on leaving Field Mode:
 * "12 fed, 3 weighed, 1 refused". Empty when nothing was logged.
 *
 *   logs: [{ kind: 'fed' | 'weight' | 'shed' | 'note', accepted }]
 */
export function sessionSummary(logs = []) {
  const count = (test) => (logs || []).filter(test).length;
  const fed = count((l) => l.kind === 'fed' && l.accepted !== false);
  const refused = count((l) => l.kind === 'fed' && l.accepted === false);
  const weighed = count((l) => l.kind === 'weight');
  const sheds = count((l) => l.kind === 'shed');
  const notes = count((l) => l.kind === 'note');
  return [
    fed ? `${fed} fed` : null,
    weighed ? `${weighed} weighed` : null,
    refused ? `${refused} refused` : null,
    sheds ? `${sheds} ${sheds === 1 ? 'shed' : 'sheds'}` : null,
    notes ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : null,
  ].filter(Boolean).join(', ');
}
