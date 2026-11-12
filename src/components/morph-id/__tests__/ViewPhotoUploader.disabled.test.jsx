// @vitest-environment jsdom
// With no Morph ID scan left the photo slots stay on the page, greyed out
// (12 Nov 2026). They used to vanish behind a locked card, so a member
// could not see what Morph ID asks for or that it comes back.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({ data: { warmed: true }, error: null })),
  upload: vi.fn(async () => ({ file_url: 'https://cdn.test/top.webp' })),
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/integrations/Core', () => ({ UploadFile: mocks.upload }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => false }));
vi.mock('@/lib/devicePhoto', () => ({ captureDevicePhoto: vi.fn() }));

import ViewPhotoUploader from '@/components/morph-id/ViewPhotoUploader';

installDomHarness();

describe('ViewPhotoUploader, disabled', () => {
  it('keeps every slot in sight and takes no photo', async () => {
    const onChange = vi.fn();
    const { container } = render(<ViewPhotoUploader onChange={onChange} disabled />);
    const slots = ['Add top view', 'Add side view', 'Add photo'].map((name) => screen.getByRole('button', { name: new RegExp(name, 'i') }));
    for (const slot of slots) expect(slot.disabled).toBe(true);
    expect(container.querySelector('input[type="file"]').disabled).toBe(true);
    // The prompt to add photos would be an instruction that cannot be followed.
    expect(screen.queryByText('Add a top view and a side view to identify the morph.')).toBeNull();

    await userEvent.click(slots[0]);
    // Nothing is woken or uploaded, and the page hears of no photos.
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith({ urls: [], ready: false });
  });

  it('is live by default', () => {
    render(<ViewPhotoUploader onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Add top view/i }).disabled).toBe(false);
    expect(screen.getByText('Add a top view and a side view to identify the morph.')).toBeTruthy();
  });
});
