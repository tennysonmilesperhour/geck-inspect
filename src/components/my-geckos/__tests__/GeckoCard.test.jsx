// @vitest-environment jsdom
// The gecko card opens the record from its photo (the guest tour says "Tap
// any gecko's photo for its full record"), as well as from the corner eye
// button, and the card's other controls still do only their own job.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

vi.mock('@/components/innovations/WeightHealthBadge', () => ({ default: () => null }));

import GeckoCard from '@/components/my-geckos/GeckoCard';
import { TOURS } from '@/lib/guestTour';

installDomHarness();

const NIMBUS = {
  id: 'g1',
  name: 'Nimbus',
  sex: 'Male',
  status: 'Holdback',
  morphs_traits: 'Lilly White, Harlequin',
  image_urls: ['https://example.com/nimbus.jpg'],
  quality_score: 8.2,
};

function renderCard(props = {}) {
  const onView = vi.fn();
  const onEdit = vi.fn();
  render(<GeckoCard gecko={NIMBUS} onView={onView} onEdit={onEdit} canEdit {...props} />);
  return { onView, onEdit };
}

describe('the gecko card', () => {
  it('opens the record when the photo is tapped', async () => {
    const { onView, onEdit } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: "Open Nimbus's record" }));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(NIMBUS);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('the photo is a real button a keyboard can reach and press', async () => {
    const { onView } = renderCard();
    const photo = screen.getByRole('button', { name: "Open Nimbus's record" });
    expect(photo.tagName).toBe('BUTTON');
    expect(photo.getAttribute('type')).toBe('button');
    await userEvent.tab();
    expect(document.activeElement).toBe(photo);
    await userEvent.keyboard('{Enter}');
    expect(onView).toHaveBeenCalledTimes(1);
    // The photo is still described for screen readers inside it.
    expect(photo.querySelector('img')?.getAttribute('alt')).toBe('Nimbus');
  });

  it('holds no other control inside the photo button', () => {
    renderCard();
    const photo = screen.getByRole('button', { name: "Open Nimbus's record" });
    expect(photo.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);
  });

  it('keeps the eye button, and Edit opens only the edit form', async () => {
    const { onView, onEdit } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'View Nimbus' }));
    expect(onView).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Nimbus' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('a card with nothing to open draws a plain photo, not a button', () => {
    render(<GeckoCard gecko={NIMBUS} canEdit={false} />);
    expect(screen.queryByRole('button', { name: "Open Nimbus's record" })).toBeNull();
    expect(screen.getByRole('img', { name: 'Nimbus' })).toBeTruthy();
  });

  it('is what the guest tour tells a visitor to tap', () => {
    const step = TOURS.flatMap((tour) => tour.steps).find((s) => s.id === 'collection-list');
    expect(step.body).toContain("Tap any gecko's photo for its full record.");
  });

  it('a gecko with no photo still opens from its initials tile', async () => {
    const { onView } = renderCard({ gecko: { ...NIMBUS, image_urls: [], photo_is_illustrative: true } });
    await userEvent.click(screen.getByRole('button', { name: "Open Nimbus's record" }));
    expect(onView).toHaveBeenCalledTimes(1);
  });
});
