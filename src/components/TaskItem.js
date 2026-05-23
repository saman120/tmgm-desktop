// src/components/TaskItem.js
import React, { useState, useRef, useEffect } from 'react';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // State for Remarks Modal
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState(task.remarks || []);
  const [newRemarkText, setNewRemarkText] = useState('');

  const editRef = useRef(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  // NEW: Global listener to close the remarks modal on "Escape"
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && showRemarksModal) {
        setShowRemarksModal(false);
      }
    };

    if (showRemarksModal) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
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
        await onDescriptionUpdate(task._id, trimmedValue);
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
    if (confirmDelete && confirmDelete > new Date()) {
      setIsLoading(true);
      await onDelete(task._id); 
      setIsLoading(false);
      setConfirmDelete(false);
    } else setConfirmDelete(new Date().setSeconds(new Date().getSeconds()+5))
  };

  const handleIncrementDelay = async () => {
    if (!onTaskUpdate) return;
    try {
      setIsLoading(true);
      await onTaskUpdate(task._id, { delayCount: (task.delayCount || 0) + 1 });
    } catch (error) {
      console.error('Failed to increment delay:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  // --- REMARKS LOGIC ---
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
    switch (status) {
      case 'completed': return '✔';
      default: return '';
    }
  };

  const getCompletedStyle = () => {
    if (task.status !== 'completed') return {};
    
    const dC = task.delayCount || 0;
    const distC = task.distractionCount || 0;

    let delayColor = 'rgba(235, 248, 235, 0.9)'; // Greenish base
    
    // Purple for 0 delays
    if (dC < 1) delayColor = 'rgba(247, 227, 250, 0.9)'; 
    else if (dC > 1 && dC <= 2) delayColor = 'rgba(255, 224, 224, 0.9)'; // slight red
    else if (dC > 2 && dC <= 5) delayColor = 'rgba(255, 180, 180, 0.9)'; // more red
    else if (dC > 5 && dC <= 10) delayColor = 'rgba(255, 120, 120, 0.9)'; // critical red
    else if (dC > 10) delayColor = 'rgba(255, 70, 70, 0.9)'; // bad red

    let distColor = 'rgba(235, 248, 235, 0.9)'; // Greenish base
    if (distC > 1 && distC <= 5) distColor = 'rgba(255, 245, 180, 0.9)'; // slight yellow
    else if (distC > 5 && distC <= 10) distColor = 'rgba(255, 220, 120, 0.9)'; // more yellow
    else if (distC > 10) distColor = 'rgba(255, 190, 70, 0.9)'; // critical yellow

    return { 
      background: `linear-gradient(135deg, ${delayColor} 0%, ${distColor} 100%)`,
      color: '#1d1d1f' // Keep text dark and readable
    };
  };

  return (
    <>
      <div 
        className={`task-item ${task.status} ${isFirst && task.status === 'in-progress' ? 'current-task' : ''} ${isDragged ? 'dragging' : ''} ${dragOverClass || ''} fade-in`}
        draggable={task.status !== 'completed'}
        style={getCompletedStyle()} // <-- CRUCIAL: This applies the background color to the task!
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
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
          {isLoading && <div className="loading-spinner-small" title="Loading..."></div>}
          {!isLoading && <div className={`status-indicator ${task.status}`} onClick={() => task.status !=='completed' && handleStatusClick()}>{getStatusIcon(task.status)}</div>}
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
            {(task.status !== 'completed' || !!task.remarks?.length) && <button 
              className="count-button remarks-btn" 
              title="Double-click to View/Add Remarks" 
              onDoubleClick={openRemarksModal}
            >
              <span className="status-icon">💬</span> {task.remarks?.length || 0}
            </button>}

            {(task.status !== 'completed' || !!task.distractionCount) && <button 
              className={"count-button"+(task.status === 'completed' ? ' count-button-highlight' : '')}
              title="Double-click to increment Distractions" 
              onDoubleClick={handleIncrementDistraction}
            >
              <span className="status-icon">😵</span> {task.distractionCount || 0}
            </button>}

            {(task.status === 'completed' && !!task.delayCount) && <button 
              className={"count-button"+(task.status === 'completed' ? ' count-button-highlight' : '')} 
            >
              <span className="status-icon">⏰</span> {task.delayCount || 0}
            </button>}

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

      {/* Remarks Modal Overlay */}
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
                    <button 
                      className="remove-remark-btn" 
                      onClick={() => handleRemoveRemark(idx)}
                      title="Remove this remark"
                    >
                      ✕
                    </button>
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
                  if (e.key === 'Escape') {
                    setShowRemarksModal(false); // Also close if they press Escape while typing
                  } else if (e.key === 'Enter' && !e.shiftKey) {
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

export default TaskItem;