import { describe, expect, it } from 'vitest';
import { isPhotoPickerCancel } from '../devicePhoto';

describe('isPhotoPickerCancel', () => {
  it('treats the system cancel as a cancel', () => {
    expect(isPhotoPickerCancel({ message: 'User cancelled photos app' })).toBe(true);
    expect(isPhotoPickerCancel({ code: 'USER_CANCELLED' })).toBe(true);
  });

  it('does not hide a real camera failure', () => {
    expect(isPhotoPickerCancel({ message: 'Camera permission denied' })).toBe(false);
  });
});
