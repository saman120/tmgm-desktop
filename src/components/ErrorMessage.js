// src/components/ErrorMessage.js
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ErrorMessage = ({ message, onDismiss }) => {
  return (
    <div className="error-container">
      <div className="error-content">
        <AlertTriangle size={20} color="#c62828" />
        <span className="error-message">{message}</span>
        {onDismiss && (
          <button 
            className="error-dismiss"
            onClick={onDismiss}
            title="Dismiss error"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;