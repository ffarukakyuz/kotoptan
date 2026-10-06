// Web Audio API ile harici mp3 dosyasına bağımlı kalmadan kristal netliğinde bildirim sesleri üretir

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let audioCtx: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAudioContext(): any {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const AudioContextClass = w.AudioContext || w.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn("[Sound] getAudioContext failed:", err);
    return null;
  }
}

/**
 * Müşteriye yönetici yanıt verdiğinde çalan hoş 2 tonlu bildirim sesi (587Hz -> 880Hz)
 */
export function playCustomerNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Ton (Re5 - 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // 2. Ton (La5 - 880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);

    // Mobil cihazlarda titreşim
    if (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      try {
        navigator.vibrate([100, 50, 150]);
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.warn("[Sound] Error playing customer chime:", e);
  }
}

/**
 * Yönetici paneline yeni müşteri mesajı düştüğünde çalan dikkat çekici 3 tonlu zil sesi (Do5 -> Mi5 -> Sol5)
 */
export function playAdminAlertChime() {
  if (typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });

    if (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      try {
        navigator.vibrate([150, 80, 200]);
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.warn("[Sound] Error playing admin chime:", e);
  }
}

/**
 * Tarayıcı Web Notification izin kontrolü ve isteme
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.Notification || typeof w.Notification !== "function") {
    return false;
  }
  try {
    if (w.Notification.permission === "granted") {
      return true;
    }
    if (
      w.Notification.permission !== "denied" &&
      typeof w.Notification.requestPermission === "function"
    ) {
      const result = await w.Notification.requestPermission();
      return result === "granted";
    }
  } catch (err) {
    console.warn("[Notification] permission request error:", err);
  }
  return false;
}

/**
 * Tarayıcı bildirimi gönder
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendBrowserNotification(title: string, options?: any) {
  if (typeof window === "undefined") {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.Notification || typeof w.Notification !== "function") {
    return;
  }

  try {
    if (w.Notification.permission === "granted") {
      const notif = new w.Notification(title, {
        icon: "/favicon.png",
        badge: "/favicon.png",
        ...options,
      });
      notif.onclick = () => {
        if (typeof window !== "undefined") {
          window.focus();
        }
        try {
          notif.close();
        } catch {
          // ignore
        }
      };
    }
  } catch (e) {
    console.warn("[Notification] Error creating notification:", e);
  }
}
