// src/components/TaskList.js
import React, { useState } from 'react';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';
import './TaskList.css';

const TaskList = ({ 
  tasks, 
  onStatusToggle, 
  onDescriptionUpdate, 
  onRefresh,
  onDelete,
  onReorder 
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showRecent, setShowRecent] = useState(true); // NEW: Toggle state

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  // NEW: Filter logic
  const filteredTasks = showRecent 
    ? tasks.filter(task => {
        // Exclude 'hold' tasks
        if (task.status === 'hold') return false;
        
        // Check if task is within the last 14 days
        // (Assuming 'updatedAt' exists. If not, fallback to 'createdAt' or just return true)
        const dateString = task.updatedAt || task.createdAt;
        if (!dateString) return true; 
        
        const taskDate = new Date(dateString);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        return taskDate >= twoWeeksAgo;
      })
    : tasks;

  // Drag and Drop Handlers (Updated to use original array indices)
  const handleDragStart = (e, originalIndex) => {
    setDraggedIndex(originalIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', originalIndex);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, originalDropIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== originalDropIndex) {
      onReorder(draggedIndex, originalDropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  let lastGroupKey = null;

  return (
    <div className="task-list-container">
      {/* NEW: Toggle Header */}
      <div className="task-list-header">
        <div className="toggle-container">
          <button 
            className={`toggle-btn ${showRecent ? 'active' : ''}`}
            onClick={() => setShowRecent(true)}
          >
            Recent
          </button>
          <button 
            className={`toggle-btn ${!showRecent ? 'active' : ''}`}
            onClick={() => setShowRecent(false)}
          >
            All
          </button>
        </div>
      </div>

      <div className="task-list">
        {filteredTasks.map((task) => {
          // Find the task's true index in the un-filtered array for accurate reordering
          const originalIndex = tasks.findIndex(t => t._id === task._id);
          let divider = null;

          if (task.status === 'completed' && task.updatedAt) {
            const taskDate = new Date(task.updatedAt);
            const dayString = taskDate.toLocaleDateString();
            const hour = taskDate.getHours();
            const groupKey = `${dayString}-${hour}`;

            if (groupKey !== lastGroupKey) {
              lastGroupKey = groupKey;
              const displayDate = taskDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const ampm = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour % 12 || 12;

              divider = (
                <div className="time-divider" key={`divider-${groupKey}`}>
                  <span className="time-divider-text">
                    {displayDate} • {displayHour} {ampm}
                  </span>
                </div>
              );
            }
          }

          return (
            <React.Fragment key={task._id}>
              {divider}
              <TaskItem
                task={task}
                isFirst={originalIndex === 0}
                onStatusToggle={onStatusToggle}
                onDescriptionUpdate={onDescriptionUpdate}
                onDelete={onDelete}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, originalIndex)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, originalIndex)}
                onDragEnd={handleDragEnd}
                isDragged={draggedIndex === originalIndex}
              />
            </React.Fragment>
          );
        })}
        {filteredTasks.length === 0 && (
          <div className="empty-filter-state">
            No recent active tasks found.
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;