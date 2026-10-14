import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubGlobal('window', {
  self: null,
  top: null,
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, onClick, className }) => (
    <a href={to} className={className} onClick={onClick}>{children}</a>
  ),
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { captureEvent } from '@/lib/posthog';
import UpgradePlansButton, { UpgradePlansLink } from '../UpgradePlansButton';

beforeEach(() => {
  navigate.mockClear();
  captureEvent.mockClear();
});

describe('upgrade plans controls', () => {
  it('records the click and opens Membership with the paywall query', () => {
    let tree;
    act(() => {
      tree = create(
        <UpgradePlansButton limitType="morph_id" surface="morph_id_locked" trackShown={false}>
          See plans
        </UpgradePlansButton>,
      );
    });
    const button = tree.root.findByType('button');
    expect(button.props.type).toBe('button');
    act(() => button.props.onClick());
    expect(captureEvent).toHaveBeenCalledWith('upgrade_prompt_clicked', {
      limit_type: 'morph_id',
      surface: 'morph_id_locked',
    });
    expect(navigate).toHaveBeenCalledWith(
      '/Membership?limit_type=morph_id&surface=morph_id_locked&from_prompt=morph_id_locked',
    );
    tree.unmount();
  });

  it('does not record a view when the parent already did', () => {
    let tree;
    act(() => {
      tree = create(
        <UpgradePlansButton limitType="geckos" surface="plan_limit_geckos" trackShown={false}>
          View Plans
        </UpgradePlansButton>,
      );
    });
    expect(captureEvent).not.toHaveBeenCalled();
    tree.unmount();
  });

  it('puts the same query on an inline plans link', () => {
    let tree;
    act(() => {
      tree = create(
        <UpgradePlansLink limitType="geckos" surface="plan_limit_geckos" trackShown>
          See plans
        </UpgradePlansLink>,
      );
    });
    const link = tree.root.findByType('a');
    expect(link.props.href).toBe(
      '/Membership?limit_type=geckos&surface=plan_limit_geckos&from_prompt=plan_limit_geckos',
    );
    act(() => link.props.onClick());
    expect(captureEvent).toHaveBeenCalledWith('upgrade_prompt_clicked', {
      limit_type: 'geckos',
      surface: 'plan_limit_geckos',
    });
    expect(navigate).not.toHaveBeenCalled();
    tree.unmount();
  });
});
