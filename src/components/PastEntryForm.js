// src/components/PastEntryForm.js - Log work that was done earlier (an hour ago,
// yesterday...) or correct the timing of an existing task.
import React, { useState, useEffect, useRef } from 'react';
import { parseTaskInput } from '../utils/taskDescriptionParser';
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

// `task` set → edit/complete that task; otherwise log new completed task(s).
const PastEntryForm = ({ isOpen, task, onClose, onCreate, onUpdate }) => {
  const [description, setDescription] = useState('');
  const [startValue, setStartValue] = useState('');
  const [duration, setDuration] = useState(SLOT_MINUTES);
  const [distractions, setDistractions] = useState(0);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const descriptionRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSaving(false);
    if (task) {
      const start = task.inProgressAt ? new Date(task.inProgressAt) : floorToSlot(Date.now() - 60 * MINUTE);
      const end = task.completedAt ? new Date(task.completedAt) : null;
      const minutes = end && end > start ? Math.round((end - start) / MINUTE) : getEstimatedSlots(task) * SLOT_MINUTES;
      setDescription(task.description);
      setStartValue(toDateTimeInputValue(start));
      setDuration(minutes);
      setDistractions(task.distractionCount || 0);
    } else {
      setDescription('');
      setStartValue(toDateTimeInputValue(floorToSlot(Date.now() - 60 * MINUTE)));
      setDuration(SLOT_MINUTES);
      setDistractions(0);
      setTimeout(() => descriptionRef.current?.focus(), 0);
    }
  }, [isOpen, task]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const applyPreset = (offsetMinutes) => {
    const base = offsetMinutes >= 24 * 60 && startValue ? new Date(startValue) : new Date();
    const target = offsetMinutes >= 24 * 60
      ? new Date(base.getTime() - 24 * 60 * MINUTE)
      : floorToSlot(Date.now() - offsetMinutes * MINUTE);
    setStartValue(toDateTimeInputValue(target));
  };

  const payloads = task ? [] : parseTaskInput(description.trim() || ' ');
  const stepCount = task ? 1 : Math.max(1, payloads.length);
  const durationMinutes = Math.max(1, Number(duration) || SLOT_MINUTES);
  const start = startValue ? new Date(startValue) : null;
  const end = start ? new Date(start.getTime() + stepCount * durationMinutes * MINUTE) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!start || Number.isNaN(start.getTime())) return setError('Pick when you started.');
    if (start.getTime() > Date.now()) return setError('Start time is in the future.');
    if (!task && !description.trim()) return setError('Describe what you did.');

    const distractionCount = Math.max(0, parseInt(distractions, 10) || 0);
    setIsSaving(true);
    try {
      if (task) {
        await onUpdate(task._id, {
          status: 'completed',
          inProgressAt: start.toISOString(),
          completedAt: end.toISOString(),
          distractionCount,
        });
      } else {
        // Steps of a breakdown are laid out back to back from the start time.
        await onCreate(payloads.map((payload, i) => {
          const stepStart = new Date(start.getTime() + i * durationMinutes * MINUTE);
          return {
            ...payload,
            status: 'completed',
            inProgressAt: stepStart.toISOString(),
            completedAt: new Date(stepStart.getTime() + durationMinutes * MINUTE).toISOString(),
            distractionCount: i === 0 ? distractionCount : 0,
            backfilled: true,
          };
        }));
      }
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
          <h3>{task ? (task.status === 'completed' ? 'Edit times' : 'Log as done earlier') : 'Log past task'}</h3>
          <button className="close-btn" onClick={onClose} disabled={isSaving}>✕</button>
        </div>

        <form className="past-entry-form" onSubmit={handleSubmit}>
          {task ? (
            <div className="past-entry-task">{task.description}</div>
          ) : (
            <label className="past-entry-field">
              <span className="field-label">What did you do?</span>
              <input
                ref={descriptionRef}
                className="summary-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task, or Big task >> step 1; step 2"
                maxLength={500}
              />
            </label>
          )}

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
              <span className="field-label">Minutes{stepCount > 1 ? ' per step' : ''}</span>
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
              {stepCount > 1 ? `${stepCount} tasks, ` : ''}
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
