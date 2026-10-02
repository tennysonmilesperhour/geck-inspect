import { describe, it, expect } from 'vitest';
import {
  buildVetRecordPayload,
  emptyVetForm,
  followUpStatus,
  sortVetRecords,
  vetFormError,
  vetFormFromRecord,
} from '../vetRecords';
import { buildInsertRecord } from '@/api/supabaseEntities';

describe('vet record form', () => {
  it('starts dated today with nothing else filled in', () => {
    expect(emptyVetForm('2026-10-02')).toEqual({
      date: '2026-10-02', vet_name: '', reason: '', findings: '', treatment: '', follow_up: '', attachments: [],
    });
  });

  it('needs a visit date, and a follow-up on or after it', () => {
    expect(vetFormError({ date: '' })).toMatch(/date of the visit/);
    expect(vetFormError({ date: '2026-10-02', follow_up: '2026-10-01' })).toMatch(/before the visit/);
    expect(vetFormError({ date: '2026-10-02', follow_up: '2026-10-02' })).toBeNull();
    expect(vetFormError({ date: '2026-10-02', follow_up: '' })).toBeNull();
  });

  it('trims text, stores blanks as empty and keeps the gecko id', () => {
    const payload = buildVetRecordPayload({
      ...emptyVetForm('2026-10-02'),
      vet_name: '  Dr. Rivera, Exotic Pet Clinic ',
      reason: 'Mouth check',
      findings: '   ',
      attachments: ['https://x/a.webp', ''],
    }, 'gecko-1');
    expect(payload).toEqual({
      animal_id: 'gecko-1',
      date: '2026-10-02',
      follow_up: '',
      vet_name: 'Dr. Rivera, Exotic Pet Clinic',
      reason: 'Mouth check',
      findings: null,
      treatment: null,
      attachments: ['https://x/a.webp'],
    });
  });

  it('saves a visit with no follow-up date (it used to fail)', () => {
    const payload = buildVetRecordPayload(emptyVetForm('2026-10-02'), 'gecko-1');
    const row = buildInsertRecord('VetRecord', payload, 'keeper@example.com', '2026-10-02T12:00:00.000Z');
    expect(row.follow_up).toBeNull();
    expect(row.created_by).toBe('keeper@example.com');
  });

  it('round-trips an existing record into the form', () => {
    const form = vetFormFromRecord({ date: '2026-09-01', reason: 'Fecal test', follow_up: null, attachments: null });
    expect(form.follow_up).toBe('');
    expect(form.attachments).toEqual([]);
    expect(form.reason).toBe('Fecal test');
  });
});

describe('vet record display', () => {
  it('says where a follow-up stands', () => {
    expect(followUpStatus({ follow_up: null }, '2026-10-02')).toBeNull();
    expect(followUpStatus({ follow_up: '2026-10-09' }, '2026-10-02')).toBe('upcoming');
    expect(followUpStatus({ follow_up: '2026-10-02' }, '2026-10-02')).toBe('today');
    expect(followUpStatus({ follow_up: '2026-09-30' }, '2026-10-02')).toBe('past');
  });

  it('lists the newest visit first', () => {
    const sorted = sortVetRecords([
      { id: 'a', date: '2026-08-01' },
      { id: 'b', date: '2026-09-15', created_date: '2026-09-15T10:00:00Z' },
      { id: 'c', date: '2026-09-15', created_date: '2026-09-15T12:00:00Z' },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});
