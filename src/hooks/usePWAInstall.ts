import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PWAPlatform = "ios" | "android" | "desktop";

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [platform, setPlatform] = useState<PWAPlatform>("android");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Standalone / PWA kontrolü (Zaten ana ekrana eklenmiş mi?)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();

    // iOS Tespiti (iPhone, iPad, iPod ve modern iPadOS MacIntel touch desteği)
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Android tespiti
    const isAndroidDevice = /android/.test(ua);
    setIsAndroid(isAndroidDevice);

    // Mobil genel tespiti
    const isMobileDevice =
      isIOSDevice || isAndroidDevice || /webos|blackberry|iemobile|opera mini/i.test(ua);
    setIsMobile(isMobileDevice);

    // Safari tespiti (iOS Safari veya Mac Safari)
    const isSafariBrowser = /safari/.test(ua) && !/chrome|crios|crmo|android|edg/.test(ua);
    setIsSafari(isSafariBrowser);

    // Platform belirle
    if (isIOSDevice) {
      setPlatform("ios");
    } else if (isAndroidDevice) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // Chromium tabanlı tarayıcılarda (Chrome, Edge, Samsung Internet vb.) yerel yükleme olayı
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.warn("PWA install error:", err);
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    isSafari,
    platform,
    install,
  };
}
