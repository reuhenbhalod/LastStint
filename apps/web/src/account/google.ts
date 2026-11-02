// Google Identity Services (the "Sign in with Google" button), loaded on demand. Only the
// pieces we use are typed.

interface GoogleId {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select?: boolean;
  }): void;
  renderButton(el: HTMLElement, options: Record<string, string | number>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

let loading: Promise<GoogleId> | null = null;

export function loadGoogle(): Promise<GoogleId> {
  loading ??= new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google.accounts.id);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () =>
      window.google ? resolve(window.google.accounts.id) : reject(new Error('no google'));
    s.onerror = () => {
      loading = null;
      reject(new Error('Google sign-in didn’t load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
