// src/components/AddTaskForm.js
import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Save, RefreshCw } from 'lucide-react';
import './AddTaskForm.css';

const AddTaskForm = ({ isOpen, onOpen, onClose, onSubmit, onRefresh }) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedDescription = description.trim();
    
    if (!trimmedDescription || isSubmitting) return;

    try {
      setDescription('');
      await onSubmit(trimmedDescription);
      
    } catch (error) {
      console.error('Failed to create task:', error);
      setDescription(trimmedDescription);
      // Keep form open on error so user can retry
    } finally {
    }
  };

  const handleCancel = () => {
    setDescription('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) {
    return (
      <div className="add-task-section">
        <button className="add-task-button" onClick={onOpen}>
          <Plus size={20} />
          <span>Add New Task</span>
        </button>

        <button 
          className="refresh-button"
          onClick={onRefresh}
          title="Refresh tasks"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="add-task-section active">
      <form className="add-task-form" onSubmit={handleSubmit}>
        
        <div className="form-content">
          <input
            ref={inputRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            className="task-input"
            maxLength={500}
            disabled={isSubmitting}
            required
          />
        </div>
      </form>
    </div>
  );
};

export default AddTaskForm;