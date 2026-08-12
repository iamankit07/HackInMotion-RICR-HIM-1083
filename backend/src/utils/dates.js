const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Plans are reasoned about in whole days. Everything is normalised to UTC
 * midnight so that adding days never drifts across a daylight-saving boundary
 * and two servers in different regions agree on which day a session belongs to.
 */
export function startOfDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(value, days) {
  return new Date(startOfDay(value).getTime() + days * MS_PER_DAY);
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Every day from `from` to `to` inclusive that the student said they can study.
 * `studyDays` holds weekday numbers with 0 = Sunday.
 */
export function studyDaysBetween(from, to, studyDays) {
  const allowed = new Set(studyDays?.length ? studyDays : [0, 1, 2, 3, 4, 5, 6]);
  const total = daysBetween(from, to);
  const days = [];

  for (let offset = 0; offset <= total; offset += 1) {
    const day = addDays(from, offset);

    if (allowed.has(day.getUTCDay())) {
      days.push(day);
    }
  }

  return days;
}

export function toDateKey(value) {
  return startOfDay(value).toISOString().slice(0, 10);
}
