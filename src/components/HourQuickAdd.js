// src/components/HourQuickAdd.js - Inline input under an hour divider for logging
// tasks that were done in that hour.
import React, { useState, useRef, useEffect } from 'react';

const HourQuickAdd = ({ hourDate, onSubmit, onClose }) => {
  const [value, setValue] = useState('');
  // Not `disabled` while saving: that would drop focus and swallow the next entry.
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hour = hourDate.getHours();
  const label = `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`;

  const handleKeyDown = async (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Enter' || isSaving) return;
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    setIsSaving(true);
    try {
      await onSubmit(hourDate, text);
      setValue(''); // stay open for the next entry
    } catch (err) {
      console.error('Failed to log task:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="hour-quick-add fade-in">
      <input
        ref={inputRef}
        className="hour-quick-add-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => !value.trim() && onClose()}
        placeholder={`Done at ${label}… Enter to add · ~2 = 10 min · Goal >> a; b`}
        maxLength={500}
      />
    </div>
  );
};

export default React.memo(HourQuickAdd);
