// Native chrome that the website does not need: a dark status bar that
// matches the app background, so the WebView does not sit under the clock.
import { detectPlatform, isNativePlatform } from '@/lib/revenuecat';

export async function installNativeShell() {
  if (!isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    if (detectPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#020617' });
    }
  } catch (error) {
    console.warn('Native status bar could not be set.', error);
  }
}
