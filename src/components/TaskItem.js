// src/components/TaskItem.js
import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from '../utils/dateUtils';
import './TaskItem.css';

const TaskItem = ({ 
  task, 
  isFirst, 
  onStatusToggle, 
  onDescriptionUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.description);
  const [confirmDelete, setConfirmDelte] = useState(false);
  const editRef = useRef(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
      setEditValue(task.description);
    }
  };

  const handleEditSubmit = async () => {
    const trimmedValue = editValue.trim();
    
    if (trimmedValue && trimmedValue !== task.description) {
      try {
        await onDescriptionUpdate(task._id, trimmedValue);
      } catch (error) {
        console.error('Failed to update description:', error);
        setEditValue(task.description); // Revert on error
      }
    } else {
      setEditValue(task.description); // Revert if empty or unchanged
    }
    
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditValue(task.description);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const handleStatusClick = async (status) => {
    try {
      await onStatusToggle(task._id, task.status, status);
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDeleteClick = async () => {
    if (confirmDelete && confirmDelete > new Date()) {
       await onDelete(task._id); 
       setConfirmDelte(false);
     } else setConfirmDelte(new Date().setSeconds(new Date().getSeconds()+5))
  }

  const getStatusButtonText = (status) => {
    const statusTexts = {
      'pending': 'Start',
      'in-progress': 'Complete',
      'completed': 'Restart'
    };
    return statusTexts[status] || 'Update';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '';
      case 'in-progress':
        return '';
      case 'completed':
        return '✔';
      default:
        return '';
    }
  };

  return (
    <div className={`task-item ${task.status} ${isFirst && task.status === 'in-progress' ? 'current-task' : ''} fade-in`}>
    <div className="task-actions">
    <div className={`status-indicator ${task.status}`} onClick={()=>handleStatusClick()}>{getStatusIcon(task.status)}</div>
    </div>
      <div className="task-content">
        <div className="task-description-container">
          {isEditing ? (
            <input
              ref={editRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="task-description-edit"
              maxLength={200}
            />
          ) : (
            <div
              className="task-description"
              onDoubleClick={handleDoubleClick}
              title="Double-click to edit"
            >
              {task.description}
            </div>
          )}
        </div>
      </div>
      <div className="task-actions">
      <button
      className='delete-button'
        title={`Delete task`}
        onClick={handleDeleteClick}
      >
        <span className="status-icon">❌ </span>
      </button>
      <button
      className='delete-button'
        title={`Delete task`}
        onClick={()=>handleStatusClick('hold')}
      >
        <span className="status-icon">🚫 </span>
      </button>
      <button
      className='delete-button'
        title={`Delete task`}
        onClick={()=>handleStatusClick('pending')}
      >
        <span className="status-icon">⌛ </span>
      </button>
    </div>
    </div>
  );
};

export default TaskItem;