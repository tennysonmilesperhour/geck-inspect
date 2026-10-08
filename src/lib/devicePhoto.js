// Device camera and photo library for the iOS and Android apps.
//
// The website keeps its file input. Inside the app, the same buttons open
// the system camera or photo library through the native camera plugin, so
// morph identification and collection photos are a device capture, not a
// web form.
import { isNativePlatform } from '@/lib/revenuecat';

export function isPhotoPickerCancel(error) {
  const message = String(error?.message || error || '');
  return error?.code === 'USER_CANCELLED' || /cancel/i.test(message);
}

/**
 * Open the system prompt (take a photo or choose one) and return a File
 * the existing upload path already accepts. Returns null if the person
 * cancels. Throws on any other failure.
 */
export async function captureDevicePhoto() {
  if (!isNativePlatform()) {
    const error = new Error('The device camera is only available in the app.');
    error.code = 'not_native';
    throw error;
  }
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  let photo;
  try {
    photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      correctOrientation: true,
      saveToGallery: false,
      promptLabelHeader: 'Gecko photo',
      promptLabelCancel: 'Cancel',
      promptLabelPhoto: 'Choose from library',
      promptLabelPicture: 'Take photo',
    });
  } catch (error) {
    if (isPhotoPickerCancel(error)) return null;
    throw error;
  }
  if (!photo?.webPath) return null;
  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error('The photo could not be read from the device.');
  const blob = await response.blob();
  const format = photo.format === 'png' ? 'png' : 'jpeg';
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : `image/${format}`;
  return new File([blob], `gecko-${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`, { type });
}
