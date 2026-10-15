import { useEffect, useState } from "react";

type ChatMode = "ai" | "admin";
type ChatStateListener = () => void;

class ChatStateStore {
  isOpen = false;
  mode: ChatMode = "ai";
  private listeners = new Set<ChatStateListener>();

  open(mode: ChatMode = "ai") {
    this.isOpen = true;
    this.mode = mode;
    this.notify();
    this.dispatchCustomEvent(mode);
  }

  close() {
    this.isOpen = false;
    this.notify();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.notify();
  }

  setMode(mode: ChatMode) {
    this.mode = mode;
    this.notify();
  }

  subscribe(listener: ChatStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.warn("[ChatStateStore] Listener error:", err);
      }
    }
  }

  private dispatchCustomEvent(mode: ChatMode) {
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("open_support_chat", { detail: { mode } }));
      } catch {
        // ignore
      }
    }
  }
}

export const chatState = new ChatStateStore();

/**
 * Bileşenlerin sohbet penceresini güvenle dinlemesini ve kontrol etmesini sağlayan kanca
 */
export function useChatState() {
  const [state, setState] = useState<{ isOpen: boolean; mode: ChatMode }>({
    isOpen: chatState.isOpen,
    mode: chatState.mode,
  });

  useEffect(() => {
    return chatState.subscribe(() => {
      setState({
        isOpen: chatState.isOpen,
        mode: chatState.mode,
      });
    });
  }, []);

  return {
    isOpen: state.isOpen,
    mode: state.mode,
    open: (mode: ChatMode = "ai") => chatState.open(mode),
    close: () => chatState.close(),
    toggle: () => chatState.toggle(),
    setMode: (mode: ChatMode) => chatState.setMode(mode),
  };
}

/**
 * Herhangi bir yerden sohbet penceresini AI veya Yönetici modunda açma yardımcı fonksiyonu
 */
export function openSupportChat(mode: ChatMode = "ai") {
  chatState.open(mode);
}
