// src/utils/dateUtils.js - Date utility functions

// Unified date formatter to prevent key mismatches between stats and dividers
export const getLocalDayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Date#toLocaleDateString builds a new Intl.DateTimeFormat on every call, which adds up
// across hundreds of dividers; these reuse one formatter per format.
const dayLabelFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const weekdayDayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' });

export const formatDayLabel = (date) => dayLabelFormat.format(date);
export const formatShortDate = (date) => shortDateFormat.format(date);
export const formatWeekdayDay = (date) => weekdayDayFormat.format(date);

// Local "YYYY-MM-DDTHH:MM" for <input type="datetime-local">.
export const toDateTimeInputValue = (date) => {
  const d = new Date(date);
  return `${getLocalDayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
