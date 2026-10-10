// src/components/PastEntryForm.js - Mark an existing task as done at an earlier time,
// or correct a completed task's start/end. (New past work is logged inline from the
// hour dividers — see HourQuickAdd.)
import React, { useState, useEffect } from 'react';
import { toDateTimeInputValue } from '../utils/dateUtils';
import { SLOT_MINUTES, getEstimatedSlots } from '../utils/productivity';
import './PastEntryForm.css';

const MINUTE = 60000;

const floorToSlot = (date) => {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % SLOT_MINUTES));
  return d;
};

const PRESETS = [
  { label: '30m ago', offsetMinutes: 30 },
  { label: '1h ago', offsetMinutes: 60 },
  { label: '2h ago', offsetMinutes: 120 },
  { label: '−1 day', offsetMinutes: 24 * 60 },
];

const PastEntryForm = ({ isOpen, task, onClose, onUpdate }) => {
  const [startValue, setStartValue] = useState('');
  const [duration, setDuration] = useState(SLOT_MINUTES);
  const [distractions, setDistractions] = useState(0);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !task) return;
    setError(null);
    setIsSaving(false);
    const start = task.inProgressAt ? new Date(task.inProgressAt) : floorToSlot(Date.now() - 60 * MINUTE);
    const end = task.completedAt ? new Date(task.completedAt) : null;
    const minutes = end && end > start ? Math.round((end - start) / MINUTE) : getEstimatedSlots(task) * SLOT_MINUTES;
    setStartValue(toDateTimeInputValue(start));
    setDuration(minutes);
    setDistractions(task.distractionCount || 0);
  }, [isOpen, task]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const applyPreset = (offsetMinutes) => {
    const base = offsetMinutes >= 24 * 60 && startValue ? new Date(startValue) : new Date();
    const target = offsetMinutes >= 24 * 60
      ? new Date(base.getTime() - 24 * 60 * MINUTE)
      : floorToSlot(Date.now() - offsetMinutes * MINUTE);
    setStartValue(toDateTimeInputValue(target));
  };

  const durationMinutes = Math.max(1, Number(duration) || SLOT_MINUTES);
  const start = startValue ? new Date(startValue) : null;
  const end = start ? new Date(start.getTime() + durationMinutes * MINUTE) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!start || Number.isNaN(start.getTime())) return setError('Pick when you started.');
    if (start.getTime() > Date.now()) return setError('Start time is in the future.');

    const distractionCount = Math.max(0, parseInt(distractions, 10) || 0);
    setIsSaving(true);
    try {
      await onUpdate(task._id, {
        status: 'completed',
        inProgressAt: start.toISOString(),
        completedAt: end.toISOString(),
        distractionCount,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save past entry:', err);
      setError('Failed to save. Please try again.');
      setIsSaving(false);
    }
  };

  const formatTime = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="summary-modal-overlay" onClick={!isSaving ? onClose : undefined}>
      <div className="summary-modal past-entry-modal" onClick={e => e.stopPropagation()}>
        <div className="summary-modal-header">
          <h3>{task.status === 'completed' ? 'Edit times' : 'Log as done earlier'}</h3>
          <button className="close-btn" onClick={onClose} disabled={isSaving}>✕</button>
        </div>

        <form className="past-entry-form" onSubmit={handleSubmit}>
          <div className="past-entry-task">{task.description}</div>

          <div className="past-entry-field">
            <span className="field-label">Started at</span>
            <input
              type="datetime-local"
              className="summary-input"
              value={startValue}
              max={toDateTimeInputValue(new Date())}
              onChange={(e) => setStartValue(e.target.value)}
            />
            <div className="past-entry-presets">
              {PRESETS.map(p => (
                <button type="button" key={p.label} className="past-entry-preset" onClick={() => applyPreset(p.offsetMinutes)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="past-entry-row">
            <label className="past-entry-field">
              <span className="field-label">Minutes</span>
              <input
                type="number"
                min={1}
                max={240}
                className="summary-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label className="past-entry-field">
              <span className="field-label">Distractions</span>
              <input
                type="number"
                min={0}
                max={50}
                className="summary-input"
                value={distractions}
                onChange={(e) => setDistractions(e.target.value)}
              />
            </label>
          </div>

          {start && !Number.isNaN(start.getTime()) && (
            <p className="past-entry-preview">
              {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              {' '}{formatTime(start)} – {formatTime(end)}
            </p>
          )}

          {error && <div className="past-entry-error">{error}</div>}

          <div className="summary-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="btn-save" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save as done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PastEntryForm;
