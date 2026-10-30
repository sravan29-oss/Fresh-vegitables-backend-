import { DeliverySettings } from '../types';

export interface DeliverySlotOption {
  id: string;
  title: string;
  sub: string;
  available: boolean;
  tag?: string;
  badgeColor?: string;
  disabledReason?: string;
}

function parseTimeToMinutes(timeStr?: string, defaultMinutes = 0): number {
  if (!timeStr || typeof timeStr !== 'string') return defaultMinutes;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) return defaultMinutes;
  return h * 60 + (isNaN(m) ? 0 : m);
}

function formatMinutesTo12Hour(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m > 0 ? `:${m.toString().padStart(2, '0')}` : ':00';
  return `${h12}${mStr} ${period}`;
}

/**
 * Computes available delivery slots in real-time based on Indian Standard Time (Asia/Kolkata).
 * Adapts dynamically based on store settings and past cutoff times.
 */
export function getRealtimeDeliverySlots(settings?: DeliverySettings | null): DeliverySlotOption[] {
  // Current time in IST (Asia/Kolkata)
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

  const slots: DeliverySlotOption[] = [];

  // 1. EXPRESS DELIVERY (30 Mins)
  const expressEnabled = settings?.express_enabled !== false && settings?.is_delivery_active !== false;
  const expressStart = parseTimeToMinutes(settings?.express_start_time, 7 * 60); // 7:00 AM
  const expressEnd = parseTimeToMinutes(settings?.express_end_time, 21 * 60); // 9:00 PM

  if (expressEnabled) {
    const isExpressLive = currentMinutes >= expressStart && currentMinutes <= expressEnd;
    const startTimeFormatted = formatMinutesTo12Hour(expressStart);
    const endTimeFormatted = formatMinutesTo12Hour(expressEnd);

    slots.push({
      id: 'express',
      title: 'Express 30 Mins',
      sub: isExpressLive
        ? 'Immediate harvest run • Dispatch within 15–30 mins'
        : `Closed for night • Available daily ${startTimeFormatted} – ${endTimeFormatted}`,
      available: isExpressLive,
      tag: isExpressLive ? 'Fastest' : 'Offline at night',
      badgeColor: isExpressLive ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500',
      disabledReason: isExpressLive ? undefined : `Express delivery operates between ${startTimeFormatted} and ${endTimeFormatted}`,
    });
  }

  // 2. MORNING SLOT
  const morningEnabled = settings?.morning_slot_enabled !== false;
  const morningStart = parseTimeToMinutes(settings?.morning_slot_start, 7 * 60);
  const morningEnd = parseTimeToMinutes(settings?.morning_slot_end, 9 * 60);
  const morningCutoff = parseTimeToMinutes(settings?.morning_slot_cutoff, 8 * 60 + 30); // 8:30 AM cutoff

  const morningTimeRange = `${formatMinutesTo12Hour(morningStart)} – ${formatMinutesTo12Hour(morningEnd)}`;

  if (morningEnabled) {
    if (currentMinutes <= morningCutoff) {
      // Order early in morning before cutoff -> deliver today morning
      slots.push({
        id: 'morning',
        title: `Today Morning (${morningTimeRange})`,
        sub: 'Dawn fresh harvest batch • Doorstep delivery',
        available: true,
        tag: 'Today',
        badgeColor: 'bg-emerald-100 text-emerald-800',
      });
    } else {
      // Morning cutoff passed -> deliver tomorrow morning
      slots.push({
        id: 'morning_tomorrow',
        title: `Tomorrow Morning (${morningTimeRange})`,
        sub: 'Harvested at dawn tomorrow • Farm direct',
        available: true,
        tag: 'Tomorrow',
        badgeColor: 'bg-blue-100 text-blue-800',
      });
    }
  }

  // 3. EVENING SLOT
  const eveningEnabled = settings?.evening_slot_enabled !== false;
  const eveningStart = parseTimeToMinutes(settings?.evening_slot_start, 17 * 60); // 5:00 PM
  const eveningEnd = parseTimeToMinutes(settings?.evening_slot_end, 19 * 60); // 7:00 PM
  const eveningCutoff = parseTimeToMinutes(settings?.evening_slot_cutoff, 18 * 60 + 30); // 6:30 PM cutoff

  const eveningTimeRange = `${formatMinutesTo12Hour(eveningStart)} – ${formatMinutesTo12Hour(eveningEnd)}`;

  if (eveningEnabled) {
    if (currentMinutes <= eveningCutoff) {
      // Before evening cutoff -> deliver today evening
      slots.push({
        id: 'evening',
        title: `Today Evening (${eveningTimeRange})`,
        sub: 'Fresh afternoon batch • Post-work delivery',
        available: true,
        tag: 'Today',
        badgeColor: 'bg-emerald-100 text-emerald-800',
      });
    } else {
      // Evening cutoff passed -> deliver tomorrow evening
      slots.push({
        id: 'evening_tomorrow',
        title: `Tomorrow Evening (${eveningTimeRange})`,
        sub: 'Post-work evening slot tomorrow',
        available: true,
        tag: 'Tomorrow',
        badgeColor: 'bg-blue-100 text-blue-800',
      });
    }
  }

  return slots;
}
