// @vitest-environment jsdom
// Picking the top view wakes Morph ID's photo-matching model (17 Oct 2026),
// so a member who lingered on the page does not meet a model that is still
// booting when they tap Identify. Only { action: 'warm' } is sent: never the
// photo, its blob preview or its storage URL, and no consent prompt, because
// no member data leaves the browser.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({ data: { warmed: true }, error: null })),
  upload: vi.fn(async () => ({ file_url: 'https://mmuglfphhwlaluyfyxsp.supabase.co/storage/v1/object/public/uploads/top.webp' })),
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/integrations/Core', () => ({ UploadFile: mocks.upload }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => false }));
vi.mock('@/lib/devicePhoto', () => ({ captureDevicePhoto: vi.fn() }));

import ViewPhotoUploader from '@/components/morph-id/ViewPhotoUploader';
import { resetMorphIdWarmup } from '@/lib/morphIdWarmup';

installDomHarness();

describe('ViewPhotoUploader warm-up', () => {
  let confirm;

  beforeEach(() => {
    resetMorphIdWarmup();
    mocks.invoke.mockClear();
    mocks.upload.mockClear();
    confirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    URL.createObjectURL = vi.fn(() => 'blob:https://geckinspect.com/preview-1');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    confirm.mockRestore();
  });

  it('sends only { action: "warm" } when the top view is picked', async () => {
    const { container } = render(<ViewPhotoUploader onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Add top view/i }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('recognize-gecko-morph', { body: { action: 'warm' } });

    // The member then chooses the photo; it uploads, and nothing about it
    // reaches the warm-up.
    const input = container.querySelector('input[type="file"]');
    const file = new File(['gecko'], 'top.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByAltText('Top view').getAttribute('src')).toContain('storage/v1'));

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify(mocks.invoke.mock.calls);
    expect(sent).not.toContain('blob:');
    expect(sent).not.toContain('storage/v1');
    expect(sent).not.toContain('top.jpg');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not warm for the side view or the extra photos', async () => {
    render(<ViewPhotoUploader onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Add side view/i }));
    await userEvent.click(screen.getByRole('button', { name: /Add photo/i }));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('keeps working when the warm-up call fails', async () => {
    mocks.invoke.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    render(<ViewPhotoUploader onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Add top view/i }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Add side view/i })).toBeTruthy();
  });
});
