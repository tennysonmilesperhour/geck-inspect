// @vitest-environment jsdom
// One component for the plan-limit notices (experience review, J6). It is
// presentation only: the caller's one line, the numbers when there are
// any, and the same "See plans" link and events every paywall uses.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ events: [] }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => fx.events.push([name, props]) }));

import PlanLimitNotice, { planLimitCount } from '../PlanLimitNotice';

installDomHarness();

const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => { fx.events = []; });

describe('PlanLimitNotice', () => {
  it('says what is limited, the numbers, the one line, and links to the plans', () => {
    show(
      <PlanLimitNotice what="Geckos" used={6} limit={10} limitType="geckos" surface="plan_limit_geckos">
        Archive one you no longer keep to free a slot.
      </PlanLimitNotice>,
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Geckos: 6 of 10 used');
    expect(notice.textContent).toContain('Archive one you no longer keep to free a slot.');
    expect(notice.getAttribute('data-plan-limit-notice')).toBe('geckos');
    const link = screen.getByRole('link', { name: 'See plans' });
    // The query the Membership page reads to know which paywall sent the member.
    expect(link.getAttribute('href')).toBe('/Membership?limit_type=geckos&surface=plan_limit_geckos&from_prompt=plan_limit_geckos');
    // The parent counts the view unless it asks the notice to.
    expect(fx.events).toEqual([]);
  });

  it('records the view once when asked, and the click with the same limit and surface', () => {
    const { rerender } = show(
      <PlanLimitNotice limitType="image_import" surface="image_import_locked" trackShown>
        This feature is included with the Breeder plan.
      </PlanLimitNotice>,
    );
    rerender(
      <MemoryRouter>
        <PlanLimitNotice limitType="image_import" surface="image_import_locked" trackShown>
          This feature is included with the Breeder plan.
        </PlanLimitNotice>
      </MemoryRouter>,
    );
    expect(fx.events).toEqual([['upgrade_prompt_shown', { limit_type: 'image_import', surface: 'image_import_locked' }]]);
    fireEvent.click(screen.getByRole('link', { name: 'See plans' }));
    expect(fx.events.at(-1)).toEqual(['upgrade_prompt_clicked', { limit_type: 'image_import', surface: 'image_import_locked' }]);
    expect(fx.events.filter(([name]) => name === 'upgrade_prompt_clicked')).toHaveLength(1);
  });

  it('has no heading without something to put in it, and passes data attributes through', () => {
    show(
      <PlanLimitNotice data-import-limit-notice limitType="geckos" surface="plan_limit_geckos" shape="modal">
        Your plan holds 10 geckos and you have 6.
      </PlanLimitNotice>,
    );
    const notice = screen.getByRole('status');
    expect(notice.hasAttribute('data-import-limit-notice')).toBe(true);
    expect(notice.querySelector('p')).toBeNull();
    expect(notice.className).toContain('text-center');
  });

  it('shows numbers only when both are real', () => {
    expect(planLimitCount(6, 10)).toBe('6 of 10 used');
    expect(planLimitCount(0, 1)).toBe('0 of 1 used');
    expect(planLimitCount(12, Infinity)).toBe('');
    expect(planLimitCount(undefined, 10)).toBe('');
    expect(planLimitCount(6, null)).toBe('');
    expect(planLimitCount('six', 10)).toBe('');
  });
});
