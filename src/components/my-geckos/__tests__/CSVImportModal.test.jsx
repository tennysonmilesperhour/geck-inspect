// @vitest-environment jsdom
// The spreadsheet import says what the plan limit will do before anything
// is imported (experience review, finding J4), and the import button
// carries the number that will really be written.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ owned: [], filter: null, importer: null, events: [] }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => fx.events.push([name, props]) }));
vi.mock('@/entities/all', () => ({ Gecko: { filter: (...args) => fx.filter(...args) } }));
vi.mock('@/functions/importGeckosFromCSV', () => ({ importGeckosFromCSV: (...args) => fx.importer(...args) }));
vi.mock('@/functions/generateCSVTemplate', () => ({ generateCSVTemplate: async () => ({ data: '' }) }));
vi.mock('@/lib/activation', () => ({ recordGeckoAdded: () => {} }));

import CSVImportModal from '../CSVImportModal';

installDomHarness();

const FREE = { email: 'keeper@example.com', membership_tier: 'free' };
const BREEDER = { email: 'breeder@example.com', membership_tier: 'breeder' };

function csvFile(count) {
  const lines = ['Name,Sex,Morph'];
  for (let i = 1; i <= count; i += 1) lines.push(`Harlequin ${i},Female,Harlequin`);
  return new File([lines.join('\n')], 'collection.csv', { type: 'text/csv' });
}

async function openMappingStep(user, count) {
  render(
    <MemoryRouter>
      <CSVImportModal isOpen user={user} onClose={() => {}} onImportComplete={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.change(document.getElementById('csv-file'), { target: { files: [csvFile(count)] } });
  await screen.findByText(`${count} rows, 3 columns detected`);
  fireEvent.click(screen.getByRole('button', { name: /Map Columns/ }));
  await screen.findByText('Column Mapping');
}

beforeEach(() => {
  fx.events = [];
  fx.owned = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, created_by: FREE.email, archived: false })),
    { id: 'sold', created_by: FREE.email, archived: true },
  ];
  fx.filter = vi.fn(async () => fx.owned);
  fx.importer = vi.fn(async () => ({
    data: { success: true, results: { processed: 34, created: 4, updated: 0, skippedForLimit: 30, errors: [], warnings: [] } },
  }));
});

describe('the spreadsheet import and the gecko limit', () => {
  it('tells a Free member near the limit how many rows will be imported, before the import', async () => {
    await openMappingStep(FREE, 34);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain(
      'Your plan holds 10 geckos and you have 6. This file has 34 rows: the first 4 will be imported.',
    );
    expect(notice.textContent).toContain('Archived geckos do not count.');
    const plans = screen.getByRole('link', { name: 'See plans' });
    expect(plans.getAttribute('href')).toContain('/Membership?limit_type=geckos');
    expect(fx.filter).toHaveBeenCalledWith({ created_by: FREE.email });
    // Counted as shown once, however often the notice is drawn.
    expect(fx.events.filter(([name]) => name === 'upgrade_prompt_shown')).toHaveLength(1);

    const button = screen.getByRole('button', { name: 'Import 4 geckos' });
    expect(fx.importer).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(fx.importer).toHaveBeenCalledTimes(1));
    expect(fx.importer.mock.calls[0][0]).toMatchObject({ geckoLimit: 10 });
    expect(fx.importer.mock.calls[0][0].rows).toHaveLength(34);
    // The results step still reports it, without counting the prompt again.
    expect(await screen.findByText(/30 new geckos were not added/)).toBeTruthy();
    expect(fx.events.filter(([name]) => name === 'upgrade_prompt_shown')).toHaveLength(1);
  });

  it('will not start an import that the limit leaves empty', async () => {
    fx.owned = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, created_by: FREE.email, archived: false }));
    await openMappingStep(FREE, 3);
    expect((await screen.findByRole('status')).textContent).toContain(
      'Your plan holds 10 geckos and you have 10. This file has 3 rows: none of them can be imported.',
    );
    expect(screen.getByRole('button', { name: 'Import 0 geckos' }).hasAttribute('disabled')).toBe(true);
  });

  it('says nothing when the file fits', async () => {
    await openMappingStep(FREE, 4);
    await waitFor(() => expect(fx.filter).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Import 4 geckos' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says nothing on an unlimited plan and does not read the collection for it', async () => {
    await openMappingStep(BREEDER, 34);
    expect(screen.getByRole('button', { name: 'Import 34 geckos' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('link', { name: 'See plans' })).toBeNull();
    expect(fx.filter).not.toHaveBeenCalled();
  });
});
