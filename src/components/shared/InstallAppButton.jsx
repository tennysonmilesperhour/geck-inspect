import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [platform, setPlatform] = useState("other");
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setPlatform(detectPlatform());
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      // localStorage unavailable — just show the button.
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Don't show once installed, or if it's a desktop browser with no install support.
  if (installed) return null;
  if (platform === "other" && !deferredPrompt) return null;
  // User dismissed previously — respect that but only hide when there's
  // no live prompt ready.
  if (dismissed && !deferredPrompt && platform !== "ios") return null;

  const handleClick = async () => {
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

  const handleDismiss = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <>
      <div className="relative">
        <Button
          onClick={handleClick}
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
              iOS doesn&apos;t let apps install themselves, but it&apos;s just
              two taps in Safari:
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
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            The Geck Inspect icon will appear on your home screen and open like
            a regular app — no browser bar.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
