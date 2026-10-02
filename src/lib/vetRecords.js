// Vet visits logged on a gecko (vet_records table). The gecko record's Vet
// section writes them, the public passport's Vet tab and the data export
// read them, and enqueue_vet_followups() sends the keeper a reminder on
// the follow-up date (see supabase/migrations/20261002212410_*).

const TEXT_FIELDS = ['vet_name', 'reason', 'findings', 'treatment'];

export const MAX_VET_ATTACHMENTS = 6;

/** A blank form for a new visit, dated today. */
export function emptyVetForm(today) {
  return {
    date: today,
    vet_name: '',
    reason: '',
    findings: '',
    treatment: '',
    follow_up: '',
    attachments: [],
  };
}

/** The form for editing an existing visit. */
export function vetFormFromRecord(record) {
  return {
    date: record?.date || '',
    vet_name: record?.vet_name || '',
    reason: record?.reason || '',
    findings: record?.findings || '',
    treatment: record?.treatment || '',
    follow_up: record?.follow_up || '',
    attachments: Array.isArray(record?.attachments) ? record.attachments : [],
  };
}

/**
 * What is wrong with the form, or null when it can be saved. Dates are
 * YYYY-MM-DD strings, so comparing them as text compares the days.
 */
export function vetFormError(form) {
  if (!form?.date) return 'Pick the date of the visit.';
  if (form.follow_up && form.follow_up < form.date) {
    return 'The follow-up date is before the visit.';
  }
  return null;
}

/**
 * The row to save. Text is trimmed and a blank field is stored as empty
 * (null). A blank follow-up date stays '' here; the entity layer turns a
 * blank date into null for every table (supabaseEntities.js).
 */
export function buildVetRecordPayload(form, animalId) {
  const row = { date: form.date, follow_up: form.follow_up || '' };
  if (animalId) row.animal_id = animalId;
  for (const key of TEXT_FIELDS) {
    const value = typeof form[key] === 'string' ? form[key].trim() : '';
    row[key] = value || null;
  }
  row.attachments = (form.attachments || []).filter(Boolean);
  return row;
}

/**
 * Where a visit's follow-up stands against today: 'upcoming', 'today',
 * 'past', or null when there is none.
 */
export function followUpStatus(record, today) {
  if (!record?.follow_up) return null;
  if (record.follow_up > today) return 'upcoming';
  if (record.follow_up === today) return 'today';
  return 'past';
}

/** Newest visit first; on the same day, the most recently logged first. */
export function sortVetRecords(records) {
  return [...(records || [])].sort((a, b) => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    return (b.created_date || '').localeCompare(a.created_date || '');
  });
}
