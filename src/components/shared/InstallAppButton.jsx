import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Bell, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import { subscribeToPush } from "@/lib/webPush";

const DISMISSED_KEY = "geck_install_prompt_dismissed";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    /** @type {any} */ (window.navigator).standalone === true
  );
};

const detectPlatform = () => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) && !(/** @type {any} */ (window).MSStream);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
};

const notificationsSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * Install-app + enable-notifications prompt.
 *
 * Flow depends on install state:
 *   1. Not installed + has `beforeinstallprompt` (Android/desktop Chrome):
 *        single-tap native install prompt.
 *   2. Not installed + iOS Safari:
 *        dialog walks through Share → Add to Home Screen.
 *   3. Installed, notification permission not granted:
 *        button flips to "Enable Notifications" and prompts for
 *        permission when tapped. Post-tap, we register with the
 *        push manager (subscription storage arrives in a later phase).
 *   4. Installed + permission granted:
 *        component renders nothing ,  there's nothing to nag about.
 *
 * Dismissal only suppresses the pre-install state. Once the user
 * installs, the post-install notifications prompt surfaces once and
 * can be dismissed independently.
 */
export default function InstallAppButton() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [platform, setPlatform] = useState("other");
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showNotifHelp, setShowNotifHelp] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      // localStorage unavailable ,  just show the button.
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    // Listen for iOS display-mode changes in case the user launches
    // from the home-screen icon mid-session.
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = (e) => setInstalled(e.matches);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  // Four possible UI states:
  //   installed + granted      -> nothing to nag, render null
  //   installed + not granted  -> "Enable Notifications" button
  //   not installed + iOS      -> "Install App" button → iOS help dialog
  //   not installed + android  -> "Install App" button → native prompt
  const needsNotifPrompt =
    installed && notificationsSupported() && permission !== "granted";

  if (installed && !needsNotifPrompt) return null;
  if (!installed && platform === "other" && !deferredPrompt) return null;
  if (!installed && dismissed && !deferredPrompt && platform !== "ios") return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "dismissed") {
          try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
          setDismissed(true);
        }
      } catch (err) {
        console.warn("Install prompt failed:", err);
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }
    if (platform === "ios") {
      setShowIosHelp(true);
    }
  };

  const handleEnableNotifClick = async () => {
    if (!notificationsSupported()) {
      setShowNotifHelp(true);
      return;
    }
    if (isSubscribing) return;
    setIsSubscribing(true);
    // Apple requires the permission call to happen in a user-gesture
    // handler (this click). Don't await anything async before it.
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        if (result === "denied") setShowNotifHelp(true);
        return;
      }
      // Permission granted ,  subscribe the device with the push service
      // and persist the resulting keys to Supabase. subscribeToPush is
      // idempotent, so re-runs on the same device just upsert.
      if (user?.email) {
        const res = await subscribeToPush(user.email);
        if (!res.ok && res.reason !== "no-vapid-key") {
          console.warn("[push] subscribe failed:", res);
        }
      }
    } catch (err) {
      console.warn("Notification permission request failed:", err);
      setShowNotifHelp(true);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
    setDismissed(true);
  };

  // --- render ---
  if (needsNotifPrompt) {
    return (
      <>
        <div className="relative">
          <Button
            onClick={handleEnableNotifClick}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg text-sm pr-9"
            aria-label="Enable push notifications for Geck Inspect"
          >
            <Bell className="w-4 h-4 mr-2" />
            Enable Notifications
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notifications prompt"
            className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded text-emerald-50/80 hover:text-white hover:bg-emerald-800/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <Dialog open={showNotifHelp} onOpenChange={setShowNotifHelp}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Turn on notifications</DialogTitle>
              <DialogDescription>
                {permission === "denied"
                  ? "Notifications are blocked in your browser settings. Re-enable them to get push alerts."
                  : "We'll let you know about hatch alerts, feeding reminders, messages, and breeding milestones."}
              </DialogDescription>
            </DialogHeader>
            {permission === "denied" ? (
              <div className="space-y-3 text-sm mt-2">
                {platform === "ios" ? (
                  <>
                    <p className="text-muted-foreground">
                      On iPhone, open <strong>Settings</strong> →{" "}
                      <strong>Notifications</strong> → <strong>Geck Inspect</strong>{" "}
                      and switch <strong>Allow Notifications</strong> on.
                    </p>
                    <p className="text-muted-foreground">
                      If Geck Inspect isn&apos;t in the list yet, open the app from
                      your Home Screen once to register it.
                    </p>
                  </>
                ) : platform === "android" ? (
                  <p className="text-muted-foreground">
                    Open the <strong>Settings</strong> app →{" "}
                    <strong>Apps</strong> → <strong>Geck Inspect</strong> →{" "}
                    <strong>Notifications</strong> and toggle them on.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Tap the lock icon in your browser&apos;s address bar, find the
                    notifications permission, and switch it to <strong>Allow</strong>.
                  </p>
                )}
              </div>
            ) : (
              <ol className="space-y-3 text-sm mt-2">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">
                    1
                  </span>
                  <span className="flex-1">
                    Tap <strong>Enable Notifications</strong> below.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">
                    2
                  </span>
                  <span className="flex-1">
                    Tap <strong>Allow</strong> when your {platform === "ios" ? "iPhone" : "device"} asks.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">
                    3
                  </span>
                  <span className="flex-1">
                    Choose which alerts you want in <strong>Settings → Notifications</strong>.
                  </span>
                </li>
              </ol>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNotifHelp(false)}
              >
                Close
              </Button>
              {permission !== "denied" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setShowNotifHelp(false);
                    handleEnableNotifClick();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Enable
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Pre-install state
  return (
    <>
      <div className="relative">
        <Button
          onClick={handleInstallClick}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg text-sm pr-9"
          aria-label="Install Geck Inspect as an app on your phone"
        >
          <Download className="w-4 h-4 mr-2" />
          Install App on Phone
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded text-emerald-50/80 hover:text-white hover:bg-emerald-800/40 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Geck Inspect to your Home Screen</DialogTitle>
            <DialogDescription>
              iOS doesn&apos;t let apps install themselves, but it&apos;s two
              taps in Safari ,  and it unlocks push notifications too.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm mt-2">
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">
                1
              </span>
              <span className="flex-1">
                Tap the <Share className="inline w-4 h-4 mx-1 -mt-0.5" />{" "}
                <strong>Share</strong> button at the bottom of Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">
                2
              </span>
              <span className="flex-1">
                Scroll and tap <Plus className="inline w-4 h-4 mx-1 -mt-0.5" />{" "}
                <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">
                3
              </span>
              <span className="flex-1 flex items-start gap-1.5">
                Open Geck Inspect from your Home Screen
                <ArrowRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-400" />
                tap the <CheckCircle2 className="inline w-3.5 h-3.5 mx-0.5 -mt-0.5 text-emerald-400" />{" "}
                <strong>Enable Notifications</strong> button that appears.
              </span>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Hatch alerts, feeding reminders, messages, and breeding milestones
            show up right on your lock screen ,  no browser tab required.
            Requires iOS 16.4 or newer.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
