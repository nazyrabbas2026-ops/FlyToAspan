// Consent-gated, privacy-safe first-party analytics helper for FlyToAspan.
// Optional analytics ONLY fire when the user explicitly accepted analytics cookies.
// Never sends passport/TCKN, card data, tokens, passwords, or booking documents.

export const COOKIE_PREFERENCE_KEY = 'flytoaspan_cookie_preference_v1';
export const COOKIE_ANALYTICS_KEY = 'flytoaspan_cookie_analytics_v1';

export type CookieConsentState = 'accepted' | 'rejected' | null;

export function getCookieConsent(): CookieConsentState {
  try {
    const saved = localStorage.getItem(COOKIE_PREFERENCE_KEY);
    return saved === 'accepted' || saved === 'rejected' ? saved : null;
  } catch {
    return null;
  }
}

export function isAnalyticsAllowed(): boolean {
  try {
    const pref = localStorage.getItem(COOKIE_PREFERENCE_KEY);
    if (pref !== 'accepted') return false;
    const explicit = localStorage.getItem(COOKIE_ANALYTICS_KEY);
    return explicit !== '0';
  } catch {
    return false;
  }
}

export function saveCookieConsent(preference: 'accepted' | 'rejected', analyticsOptIn = preference === 'accepted') {
  try {
    localStorage.setItem(COOKIE_PREFERENCE_KEY, preference);
    localStorage.setItem(COOKIE_ANALYTICS_KEY, preference === 'accepted' && analyticsOptIn ? '1' : '0');
  } catch { /* ignore storage errors */ }
}

function getAnonSessionId(): string {
  try {
    let id = sessionStorage.getItem('flytoaspan_anon_sid');
    if (!id) {
      id = crypto.randomUUID().slice(0, 16);
      sessionStorage.setItem('flytoaspan_anon_sid', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function trackAnalyticsEvent(
  eventType: 'page_view' | 'search' | 'select' | 'passenger_form' | 'checkout_submit' | 'checkout_error' | 'booking_complete' | 'client_error',
  payload: { page?: string; productType?: string; metadata?: Record<string, string | number | boolean> } = {}
): void {
  // Technical client errors can still be reported only if analytics/telemetry allowed; strict opt-in gate!
  if (!isAnalyticsAllowed()) return;
  try {
    const body = JSON.stringify({
      eventType,
      page: payload.page || (typeof window !== 'undefined' ? window.location.pathname : ''),
      productType: payload.productType || '',
      sessionId: getAnonSessionId(),
      metadata: payload.metadata || {},
    });
    void fetch('/api/analytics/event', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* never interrupt UX */ });
  } catch { /* ignore */ }
}
