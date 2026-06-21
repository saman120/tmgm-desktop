// src/components/AddTaskForm.js
import React, { useState, useRef, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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
      setIsSubmitting(true);
      setDescription('');
      const data = { description: trimmedDescription };

      const split = trimmedDescription.split('###');
      if (split[1] ) {
        const splitComma = split[1].split(',');
        const distractionCount = parseInt(splitComma[0], 10);
        const inProgressAt = splitComma[1] && new Date(new Date().toISOString().split('T')[0]+'T'+splitComma[1]);
        const completedAt = splitComma[2] && new Date(new Date().toISOString().split('T')[0]+'T'+splitComma[2]);
        if( distractionCount >= 0){
          data.distractionCount = distractionCount;
        } 
        if(inProgressAt){
          data.inProgressAt = inProgressAt;
        }
        if(completedAt){
          data.completedAt = completedAt;
        }
      }
      await onSubmit(data);
    } catch (error) {
      console.error('Failed to create task:', error);
      setDescription(trimmedDescription);
    } finally {
      setIsSubmitting(false);
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
            required
          />
        </div>
      </form>
    </div>
  );
};

export default React.memo(AddTaskForm);