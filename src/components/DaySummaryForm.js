// src/components/DaySummaryForm.js
import React, { useState, useEffect } from 'react';
import './DaySummaryForm.css';
import { taskAPI } from '../services/api';

// Easily add or remove fields here
const SUMMARY_FIELDS = [
  { id: 'morningBM', label: 'Morning B.M.', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'morningWalk', label: 'Morning Walk', type: 'toggle', min: 1, max: 10, group: 'Morning' },
  { id: 'selfWork', label: 'Self work', type: 'toggle', min: 1, max: 10, group: 'Day' },
  { id: 'newInvestment', label: 'New/Investment', type: 'toggle', min: 1, max: 10, group: 'Day' },
  { id: 'foodHabit', label: 'Food habit', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'morningRoutine', label: 'Morning routine', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'bmLevel', label: 'B.M. level', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'freshnessLevel', label: 'Freshness level', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'stressLevel', label: 'Stress level', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'tirednessLevel', label: 'Tiredness level', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'healthLevel', label: 'Health level', type: 'numberSlider', min: 1, max: 10, group: 'DaySummary' },
  { id: 'breathingExec', label: 'Breathing exec', type: 'number', min: 1, max: 10, group: 'Day' },
  { id: 'mm', label: 'MM', type: 'number', min: 1, max: 10, group: 'Other' },
];

const DaySummaryForm = ({ isOpen, date, onClose }) => {
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch existing summary data when the modal opens
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
        // If it fails (e.g., 404 Not Found because it doesn't exist yet), we just default to empty
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

  return (
    <div className="summary-modal-overlay" onClick={!isLoading ? onClose : undefined}>
      <div className="summary-modal" onClick={e => e.stopPropagation()}>
        <div className="summary-modal-header">
          <h3>Summary for {date}</h3>
          <button 
            className="close-btn" 
            onClick={onClose}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {error && <div className="error-message" style={{ color: '#ff3b30', fontSize: '13px', marginBottom: '8px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="summary-form">
          {SUMMARY_FIELDS.map(field => (
            <div className="form-group" key={field.id}>
              <label htmlFor={field.id}>{field.label}</label>
              
              {field.type === 'textarea' ? (
                <textarea
                  id={field.id}
                  className="summary-input"
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  rows={3}
                  disabled={isLoading}
                />
              ) : (
                <input
                  id={field.id}
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  className="summary-input"
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  disabled={isLoading}
                />
              )}
            </div>
          ))}

          <div className="summary-modal-actions">
            <button 
              type="button" 
              className="btn-cancel" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-save"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Summary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DaySummaryForm;