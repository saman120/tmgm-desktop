// src/components/EmptyState.js
import React from 'react';
import { CheckCircle, RefreshCw, Plus } from 'lucide-react';
import './EmptyState.css';

const EmptyState = ({ onRefresh }) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <CheckCircle size={64} />
      </div>
      
      <h3 className="empty-state-title">No tasks yet</h3>
      <p className="empty-state-description">
        You're all caught up! Create your first task to get started on your productivity journey.
      </p>
      
      <div className="empty-state-actions">
        <button 
          className="btn btn-primary empty-action-btn"
          onClick={() => {
            // Scroll to bottom to show add task form
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }}
        >
          <Plus size={16} />
          <span>Create First Task</span>
        </button>
        
        <button 
          className="btn btn-secondary empty-action-btn"
          onClick={onRefresh}
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>
      
      <div className="empty-state-tips">
        <h4>Quick Tips:</h4>
        <ul>
          <li>Double-click any task description to edit it</li>
          <li>Click status buttons to change task progress</li>
          <li>The first task is automatically in progress</li>
          <li>Get reminders every 5 minutes for active tasks</li>
        </ul>
      </div>
    </div>
  );
};

export default EmptyState;