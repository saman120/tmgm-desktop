// src/components/TaskItem.js
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { parseTaskShorthand } from '../utils/taskDescriptionParser';
import './TaskItem.css';

const TaskItem = ({ 
  task, 
  isFirst, 
  onStatusToggle, 
  onDescriptionUpdate,
  onDelete,
  onTaskUpdate, 
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragged,
  dragOverClass
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.description);
  const [confirmDelete, setConfirmDelete] = useState(0); // Using timestamp instead of Date object
  
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState(task.remarks || []);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const editRef = useRef(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && showRemarksModal) {
        setShowRemarksModal(false);
      }
    };
    if (showRemarksModal) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    }
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showRemarksModal]);

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
        const data = parseTaskShorthand(trimmedValue);
        await onTaskUpdate(task._id, data);
      } catch (error) {
        console.error('Failed to update description:', error);
        setEditValue(task.description);
      } finally {
        setIsLoading(false);
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
    } catch (error) {
      console.error('Failed to toggle status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    const now = Date.now();
    if (confirmDelete && confirmDelete > now) {
      setIsLoading(true);
      await onDelete(task._id); 
      setIsLoading(false);
      setConfirmDelete(0);
    } else {
      setConfirmDelete(now + 5000);
    }
  };

  useEffect(() => {
    let intervalId;
    const calculateElapsed = () => {
      const timestamp = task.inProgressAt || task.updatedAt || task.createdAt; 
      if (task.status === 'in-progress' && timestamp) {
        const diffMs = Date.now() - Date.parse(timestamp);
        const mins = Math.floor(diffMs / 60000);
        setElapsedMinutes(mins > 0 ? mins : 0);
      }
    };

    if (task.status === 'in-progress') {
      calculateElapsed();
      intervalId = setInterval(calculateElapsed, 30000);
    }
    return () => intervalId && clearInterval(intervalId);
  }, [task.status, task.inProgressAt, task.updatedAt, task.createdAt]);

  const handleIncrementDistraction = async () => {
    if (!onTaskUpdate) return;
    try {
      setIsLoading(true);
      await onTaskUpdate(task._id, { distractionCount: (task.distractionCount || 0) + 1 });
    } catch (error) {
      console.error('Failed to increment distraction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openRemarksModal = () => {
    setCurrentRemarks(task.remarks || []);
    setNewRemarkText('');
    setShowRemarksModal(true);
  };

  const addRemarkToList = (text) => {
    const trimmed = text.trim();
    if (!trimmed || currentRemarks.includes(trimmed)) return;
    setCurrentRemarks([...currentRemarks, trimmed]);
    setNewRemarkText('');
  };

  const handleAddRemark = (e) => {
    if (e) e.preventDefault();
    addRemarkToList(newRemarkText);
  };

  const handleRemoveRemark = (indexToRemove) => {
    setCurrentRemarks(currentRemarks.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSaveRemarks = async () => {
    if (!onTaskUpdate) return;
    
    let updates = { remarks: currentRemarks };
    const currentDistractionCount = task.distractionCount || 0;
    
    if (currentRemarks.length > currentDistractionCount) {
      updates.distractionCount = currentRemarks.length;
    }

    try {
      setIsLoading(true);
      await onTaskUpdate(task._id, updates);
      setShowRemarksModal(false);
    } catch (error) {
      console.error('Failed to save remarks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    return status === 'completed' ? '✔' : (elapsedMinutes || '');
  };
  
  const completedStyle = useMemo(() => {
    if (task.status !== 'completed') return {};
    
    const dC = task.delayCount || 0;
    const distC = task.distractionCount || 0;

    // dC < 0: completed noticeably early ("too soon"). dC in [0, 2): on schedule/small buffer.
    let delayColor = 'var(--comp-green)';
    if (dC < 0) delayColor = 'var(--comp-purple)';
    else if (dC > 1 && dC <= 5) delayColor = 'var(--comp-red-1)';
    else if (dC > 5 && dC <= 10) delayColor = 'var(--comp-red-2)';
    else if (dC > 10) delayColor = 'var(--comp-red-3)';

    let distColor = 'var(--comp-green)';
    if (distC > 1 && distC <= 5) distColor = 'var(--comp-yellow-1)';
    else if (distC > 5 && distC <= 10) distColor = 'var(--comp-yellow-2)';
    else if (distC > 10) distColor = 'var(--comp-yellow-3)';

    return { 
      background: `linear-gradient(135deg, ${delayColor} 0%, ${distColor} 100%)`,
      color: 'var(--text-main)' 
    };
  }, [task.status, task.delayCount, task.distractionCount]);

  return (
    <>
      <div 
        className={`task-item ${task.status} ${isFirst && task.status === 'in-progress' ? 'current-task' : ''} ${isDragged ? 'dragging' : ''} ${dragOverClass || ''} fade-in`}
        draggable={task.status !== 'completed'}
        style={completedStyle} 
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <div className="drag-handle" title="Drag to reorder">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle>
          </svg>
        </div>
        
        <div className="task-actions">
          {isLoading ? (
            <div className="loading-spinner-small" title="Loading..."></div>
          ) : (
            <div className={`status-indicator ${task.status}`} onClick={() => task.status !== 'completed' && handleStatusClick()}>
              {getStatusIcon(task.status)}
            </div>
          )}
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
        
        <div className="task-actions-right">
          {!isLoading && <>
            {(!!task.distractionCount) && <button 
              className={`count-button${task.status === 'completed' ? ' count-button-highlight' : ''}`}
              title="Double-click to increment Distractions" 
              onDoubleClick={handleIncrementDistraction}
            >
              <span className="status-icon">😵</span> {task.distractionCount || 0}
            </button>}

            {(task.status === 'completed' && !!task.delayCount) && <button
              className="count-button count-button-highlight"
              title={task.delayCount < 0 ? "Completed early" : "Completed late"}
            >
              <span className="status-icon">{task.delayCount < 0 ? '⚡' : '⏰'}</span> {Math.round(Math.abs(task.delayCount))}
            </button>}

            {task.status !== 'completed' && <button className='delete-button' title="Set completed" onClick={() => handleStatusClick('completed')}>
              <span className="status-icon">✅ </span>
            </button>}
            <button className='delete-button' title="Set pending" onClick={() => handleStatusClick('pending')}>
              <span className="status-icon">⌛ </span>
            </button>
            {task.status !== 'completed' && task.status !== 'hold' && <button className='delete-button' title="Hold task" onClick={() => handleStatusClick('hold')}>
              <span className="status-icon">🚫 </span>
            </button>}
            {task.status !== 'completed' && <button className='delete-button' onClick={handleDeleteClick} title="Delete task (click twice within 5 seconds to confirm)">
              <span className="status-icon">❌ </span>
            </button>}
          </>}
        </div>
      </div>

      {showRemarksModal && (
        <div className="remarks-modal-overlay" onClick={() => setShowRemarksModal(false)}>
          <div className="remarks-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Task Remarks</h3>
            <div className="remarks-list">
              {currentRemarks.length === 0 ? (
                <p className="no-remarks">No remarks yet. Add one below!</p>
              ) : (
                currentRemarks.map((rem, idx) => (
                  <div key={idx} className="remark-item">
                    <span>• {rem}</span>
                    <button className="remove-remark-btn" onClick={() => handleRemoveRemark(idx)} title="Remove this remark">✕</button>
                  </div>
                ))
              )}
            </div>
            <form className="remark-input-container" onSubmit={handleAddRemark}>
              <textarea 
                placeholder="Type a new remark... (Press Enter to add)" 
                value={newRemarkText}
                onChange={(e) => setNewRemarkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowRemarksModal(false);
                  else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddRemark();
                  }
                }}
                autoFocus
                className="remark-textarea"
                rows={2}
              />
              <button type="submit" disabled={!newRemarkText.trim()}>Add</button>
            </form>
            <div className="remarks-modal-actions">
              <button className="cancel-btn" onClick={() => setShowRemarksModal(false)}>Cancel</button>
              <button className="save-btn" onClick={handleSaveRemarks}>Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(TaskItem);