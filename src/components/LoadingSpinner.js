// src/components/LoadingSpinner.js
import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = "Loading tasks..." }) => {
  return (
    <div className="loading-container">
      <Loader2 size={32} className="loading-spinner" />
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default LoadingSpinner;