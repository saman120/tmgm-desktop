// src/utils/dateUtils.js - Date utility functions

// Unified date formatter to prevent key mismatches between stats and dividers
export const getLocalDayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
