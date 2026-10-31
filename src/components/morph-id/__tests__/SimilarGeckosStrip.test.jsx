// @vitest-environment jsdom
// The closest breeder-tagged reference photos under a Morph ID answer. They
// come from the answer itself (visual_evidence), found on the server in the
// request the member said yes to on the page. Until 28 Oct 2026 an answer
// without them ran a second visual search here that asked with the
// browser's confirm box, which the iPhone app does not reliably show.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ invoke: null, rpc: null }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args) => fx.invoke(...args) },
    rpc: (...args) => fx.rpc(...args),
  },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'p1', role: 'user' } }),
}));
vi.mock('@/components/shared/GeckoImage', () => ({
  default: ({ alt, src }) => <img alt={alt} src={src} />,
}));

import SimilarGeckosStrip from '@/components/morph-id/SimilarGeckosStrip';

installDomHarness();

beforeEach(() => {
  fx.invoke = vi.fn(async () => ({ data: { embedding: [0.1, 0.2] }, error: null }));
  fx.rpc = vi.fn(async () => ({ data: [], error: null }));
  window.confirm = vi.fn(() => true);
});

describe('SimilarGeckosStrip', () => {
  it('shows the reference photos the answer carries', () => {
    render(
      <SimilarGeckosStrip
        imageUrl="https://cdn.test/top.jpg"
        evidence={{ status: 'available', neighbors: [{ id: 'n1', image_url: 'https://cdn.test/ref.jpg', primary_morph: 'harlequin' }] }}
      />,
    );
    expect(screen.getByText('Visual evidence from the corpus')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Visual comparison labeled Harlequin' })).toBeTruthy();
    expect(fx.invoke).not.toHaveBeenCalled();
  });

  it('shows nothing for an answer without visual evidence, and sends nothing or asks nothing', async () => {
    const { container } = render(<SimilarGeckosStrip imageUrl="https://cdn.test/top.jpg" evidence={undefined} />);
    // Give any effect the chance to run.
    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fx.invoke).not.toHaveBeenCalled();
    expect(fx.rpc).not.toHaveBeenCalled();
  });
});
