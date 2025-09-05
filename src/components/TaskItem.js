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

  const handleStatusClick = async () => {
    try {
      await onStatusToggle(task._id, task.status);
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
        return '⏳';
      case 'in-progress':
        return '⚡';
      case 'completed':
        return '✅';
      default:
        return '❓';
    }
  };

  return (
    <div className={`task-item ${task.status} ${isFirst && task.status === 'in-progress' ? 'current-task' : ''} fade-in`}>
      <div className="task-content">
        <div className="task-header">
          <div className={`status-indicator ${task.status}`}></div>
          <div className="task-meta">
            {isFirst && task.status === 'in-progress' && (
              <span className="current-badge">Current Task</span>
            )}
            <span className="task-time">
              {formatDistanceToNow(new Date(task.created_at || task.createdAt))}
            </span>
          </div>
        </div>
        
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
          className={`status-button ${task.status}`}
          onClick={handleStatusClick}
          title={`Change status to ${getStatusButtonText(task.status).toLowerCase()}`}
        >
          <span className="status-icon">{getStatusIcon(task.status)}</span>
          <span className="status-text">{getStatusButtonText(task.status)}</span>
        </button>
        <button
        className='delete-button'
          title={`Delete task`}
          onClick={handleDeleteClick}
        >
          <span className="status-icon">🗑️ {(confirmDelete && (confirmDelete > new Date())) ? 'Click Twice': 'Delete'}</span>
        </button>
      </div>
    </div>
  );
};

export default TaskItem;