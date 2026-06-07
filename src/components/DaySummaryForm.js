// src/components/DaySummaryForm.js
import React, { useState, useEffect } from 'react';
import './DaySummaryForm.css';
import { taskAPI } from '../services/api';

const SUMMARY_FIELDS = [
  { id: 'morningBM', label: 'Morning B.M.', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'morningWalk', label: 'Morning Walk', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'breathingExec', label: 'Breathing exec', type: 'numberReadOnly', min: 1, max: 10, group: 'Morning' },
  { id: 'selfWork', label: 'Self work', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'newInvestment', label: 'New/Investment', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'redFlags', label: 'Red Flags (M)', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'bmLevel', label: 'B.M. level', type: 'numberBar', min: 1, max: 10, group: 'DaySummary' },
  { id: 'foodHabit', label: 'Food habit', type: 'numberBar', min: 1, max: 10, group: 'DaySummary' },
  { id: 'freshnessLevel', label: 'Freshness level', type: 'numberBar', min: 1, max: 10, group: 'DaySummary' },
  // Added reverseColor: true to stressLevel
  { id: 'stressLevel', label: 'Stress level', type: 'numberBar', min: 1, max: 10, group: 'DaySummary', reverseColor: true },
  { id: 'tirednessLevel', label: 'Tiredness level', type: 'numberBar', min: 1, max: 10, group: 'DaySummary' },
  { id: 'healthLevel', label: 'Health level', type: 'numberBar', min: 1, max: 10, group: 'DaySummary' },
];

// Helper function updated to support reversing the color logic (Green to Red)
const getColorForValue = (value, min, max, reverse = false) => {
  const clampedValue = Math.max(min, Math.min(value, max));
  let percentage = (clampedValue - min) / (max - min);
  
  // If reverse is true, 1 = Green and 10 = Red
  if (reverse) {
    percentage = 1 - percentage;
  }
  
  const hue = percentage * 120;
  return `hsl(${hue}, 90%, 45%)`; 
};

const DaySummaryForm = ({ isOpen, date, onClose }) => {
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!isOpen || !date) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await taskAPI.getDaySummaryByDate(date);
        setFormData(data || {});
      } catch (err) {
        console.error('Failed to fetch day summary:', err);
        setFormData({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [isOpen, date]);

  if (!isOpen) return null;

  const handleChange = (id, value) => {
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await taskAPI.updateDaySummaryByDate(date, formData);
      onClose();
    } catch (err) {
      console.error('Failed to save summary:', err);
      setError('Failed to save summary. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const groupedFields = SUMMARY_FIELDS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {});

  const renderField = (field) => {
    const value = formData[field.id];

    if (field.type === 'toggle') {
      // Determine the active color based on the specific field ID
      const activeColor = field.id === 'redFlags' ? '#ff3b30' : '#4caf50';

      return (
        <div className="compact-form-group compact-toggle" key={field.id}>
          <label className="field-label" htmlFor={field.id}>{field.label}</label>
          <label className="toggle-switch">
            <input
              id={field.id}
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(field.id, e.target.checked)}
              disabled={isLoading}
            />
            <span 
              className="toggle-slider" 
              style={!!value ? { backgroundColor: activeColor } : {}}
            ></span>
          </label>
        </div>
      );
    }

    if (field.type === 'numberBar') {
      const currentVal = value !== undefined ? value : field.min;
      // Pass the new reverseColor property to our helper function
      const dynamicColor = getColorForValue(currentVal, field.min, field.max, field.reverseColor);
      
      const percentage = ((currentVal - field.min) / (field.max - field.min)) * 100;

      return (
        <div className="compact-form-group compact-range" key={field.id}>
          <div className="range-header">
            <label className="field-label" htmlFor={field.id}>{field.label}</label>
            <span 
              className="range-value"
              style={{
                backgroundColor: dynamicColor,
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.85em',
                fontWeight: 'bold',
                transition: 'background-color 0.3s ease'
              }}
            >
              {currentVal}
            </span>
          </div>
          <input
            id={field.id}
            type="range"
            min={field.min}
            max={field.max}
            className="summary-slider"
            value={currentVal}
            onChange={(e) => handleChange(field.id, Number(e.target.value))}
            disabled={isLoading}
            style={{ 
              accentColor: dynamicColor,
              background: `linear-gradient(to right, ${dynamicColor} ${percentage}%, #e0e0e0 ${percentage}%)`,
              transition: 'accent-color 0.3s ease'
            }}
          />
        </div>
      );
    }

    if (field.type === 'numberReadOnly') {
      return (
        <div className="compact-form-group" key={field.id}>
          <label className="field-label" htmlFor={field.id}>{field.label}</label>
          <input
            id={field.id}
            type="number"
            className="summary-input"
            value={value !== undefined ? value : ''}
            readOnly
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed', backgroundColor: 'var(--hover-bg)' }}
          />
        </div>
      );
    }

    return (
      <div className="compact-form-group" key={field.id}>
        <label className="field-label" htmlFor={field.id}>{field.label}</label>
        <input
          id={field.id}
          type={field.type}
          min={field.min}
          max={field.max}
          className="summary-input"
          value={value || ''}
          onChange={(e) => handleChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
          disabled={isLoading}
        />
      </div>
    );
  };

  return (
    <div className="summary-modal-overlay" onClick={!isLoading ? onClose : undefined}>
      <div className="summary-modal" onClick={e => e.stopPropagation()}>
        <div className="summary-modal-header">
          <h3>Summary for {date}</h3>
          <button className="close-btn" onClick={onClose} disabled={isLoading}>✕</button>
        </div>

        {error && <div className="error-message" style={{ color: '#ff3b30', fontSize: '13px', marginBottom: '8px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="summary-form compact-layout">
          {Object.entries(groupedFields).map(([groupName, fields]) => (
            <div className="summary-group" key={groupName}>
              <h4 className="summary-group-title">{groupName}</h4>
              <div className="summary-group-grid">
                {fields.map(field => renderField(field))}
              </div>
            </div>
          ))}

          <div className="summary-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Summary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DaySummaryForm;