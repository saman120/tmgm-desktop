// src/components/TaskItem.js
import React, { useState, useRef, useEffect } from 'react';
import './TaskItem.css';

const TaskItem = ({ 
  task, 
  isFirst, 
  onStatusToggle, 
  onDescriptionUpdate,
  onDelete,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragged
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.description);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
        setIsLoading(true);
        await onDescriptionUpdate(task._id, trimmedValue);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to update description:', error);
        setEditValue(task.description);
      }
    } else {
      setEditValue(task.description);
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
      setIsLoading(true);
      await onStatusToggle(task._id, task.status, status);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDeleteClick = async () => {
    if (confirmDelete && confirmDelete > new Date()) {
      setIsLoading(true);
      await onDelete(task._id); 
      setIsLoading(false);
      setConfirmDelete(false);
    } else setConfirmDelete(new Date().setSeconds(new Date().getSeconds()+5))
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✔';
      default: return '';
    }
  };

  return (
    <div 
      className={`task-item ${task.status} ${isFirst && task.status === 'in-progress' ? 'current-task' : ''} ${isDragged ? 'dragging' : ''} fade-in`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* SVG Drag Handle on the far left */}
      <div className="drag-handle" title="Drag to reorder">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="5" r="1"></circle>
          <circle cx="9" cy="12" r="1"></circle>
          <circle cx="9" cy="19" r="1"></circle>
          <circle cx="15" cy="5" r="1"></circle>
          <circle cx="15" cy="12" r="1"></circle>
          <circle cx="15" cy="19" r="1"></circle>
        </svg>
      </div>
      
      <div className="task-actions">
        <div className={`status-indicator ${task.status}`} onClick={() => handleStatusClick()}>{getStatusIcon(task.status)}</div>
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
        {isLoading && <div className="loading-spinner-small" title="Loading..."></div>}
        {!isLoading && <>
          <button className='delete-button' title={`Set pending`} onClick={() => handleStatusClick('pending')}>
          <span className="status-icon">⌛ </span>
          </button>
          <button className='delete-button' title={`Hold task`} onClick={() => handleStatusClick('hold')}>
            <span className="status-icon">🚫 </span>
          </button>
          <button className='delete-button' onClick={handleDeleteClick} title="Delete task (click twice within 5 seconds to confirm)">
            <span className="status-icon">❌ </span>
          </button>
        </>}
      </div>
    </div>
  );
};

export default TaskItem;