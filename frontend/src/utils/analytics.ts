// Marketing Analytics & E-Commerce Event Tracker (Phase 18)
// Compatible with Google Analytics 4, Meta Pixel, and GTM dataLayer

type AnalyticsEvent =
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'sign_up'
  | 'login'
  | 'apply_coupon';

export function trackEvent(eventName: AnalyticsEvent, params: Record<string, any> = {}) {
  try {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      ...params,
    };

    // 1. Google Tag Manager / GA4 dataLayer
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push(payload);
    }

    // 2. Meta Pixel simulation
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('trackCustom', eventName, params);
    }

    // In development mode, log clean analytics telemetry
    if (import.meta.env.DEV) {
      console.log(`📊 [Analytics Tracking] ${eventName}:`, params);
    }
  } catch (err) {
    // Non-blocking telemetry
  }
}
