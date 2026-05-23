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

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Variable to keep track of the last rendered time group
  let lastGroupKey = null;

  return (
    <div className="task-list-container">
      <div className="task-list">
        {tasks.map((task, index) => {
          let divider = null;

          // Check if task is completed and has a timestamp (assuming 'updatedAt' exists)
          if (task.status === 'completed' && task.updatedAt) {
            const taskDate = new Date(task.updatedAt);
            
            // Create a unique key for the specific day and hour
            const dayString = taskDate.toLocaleDateString();
            const hour = taskDate.getHours();
            const groupKey = `${dayString}-${hour}`;

            // If this task belongs to a new day/hour, generate a divider
            if (groupKey !== lastGroupKey) {
              lastGroupKey = groupKey;
              
              // Format the display text (e.g., "May 23 • 2 PM")
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
                isFirst={index === 0}
                onStatusToggle={onStatusToggle}
                onDescriptionUpdate={onDescriptionUpdate}
                onDelete={onDelete}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                isDragged={draggedIndex === index}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TaskList;