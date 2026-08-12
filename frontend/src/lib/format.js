const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  return new Date(value).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}

export function formatWeekday(value) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}

export function daysUntil(value) {
  const target = Date.UTC(
    new Date(value).getUTCFullYear(),
    new Date(value).getUTCMonth(),
    new Date(value).getUTCDate(),
  );

  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Math.max(0, Math.round((target - start) / MS_PER_DAY));
}

export function isToday(value) {
  return daysUntil(value) === 0 && new Date(value) <= new Date(Date.now() + MS_PER_DAY);
}

/** 95 becomes "1 hr 35 min", 40 stays "40 min". */
export function formatMinutes(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export const SESSION_LABELS = {
  learn: 'Learn',
  revise: 'Revise',
  practice: 'Practice',
  test: 'Mock test',
};

export const SESSION_TONES = {
  learn: 'bg-saffron-soft text-saffron border-saffron/25',
  revise: 'bg-teal-soft text-teal border-teal/25',
  practice: 'bg-sunk text-ink-soft border-line',
  test: 'bg-clay-soft text-clay border-clay/25',
};
