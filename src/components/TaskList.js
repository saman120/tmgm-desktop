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
  onReorder,
  onTaskUpdate
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showRecent, setShowRecent] = useState(true);

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  const filteredTasks = showRecent 
    ? tasks.filter(task => {
        if (task.status === 'hold') return false;
        
        const dateString = task.updatedAt || task.createdAt;
        if (!dateString) return true; 
        
        const taskDate = new Date(dateString);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        return taskDate >= twoWeeksAgo;
      })
    : tasks;

  const sortTasks = (tasksToSort) => {
    const statusOrder = ['in-progress', 'pending', 'hold', 'completed'];

    return [...tasksToSort].sort((a, b) => {
      const statusA = statusOrder.indexOf(a.status || 'unknown');
      const statusB = statusOrder.indexOf(b.status || 'unknown');

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;

      if (orderA !== orderB) {
        return orderA - orderB; 
      }

      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  };

  const orderedTasks = sortTasks(filteredTasks);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedIndex !== index) {
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    }
  };

  // REMOVED: handleDragLeaveList has been completely removed to prevent bubbling flickers

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newArray = [...orderedTasks];
    const [draggedTask] = newArray.splice(draggedIndex, 1);
    newArray.splice(dropIndex, 0, draggedTask);

    const prevTask = newArray[dropIndex - 1];
    const nextTask = newArray[dropIndex + 1];

    let newStatus = draggedTask.status;
    if (prevTask && nextTask && prevTask.status === nextTask.status) {
      newStatus = prevTask.status;
    } else if (prevTask) {
      newStatus = prevTask.status;
    } else if (nextTask) {
      newStatus = nextTask.status;
    }

    let newOrder;
    if (!prevTask) {
      newOrder = (nextTask?.order || 0) - 1;
    } else if (!nextTask) {
      newOrder = (prevTask?.order || 0) + 1;
    } else {
      newOrder = (prevTask.order + nextTask.order) / 2;
    }

    onReorder(draggedTask._id, newOrder, newStatus);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null); // This safely closes the drop zone if the user lets go of the mouse outside the window
  };

  let lastGroupKey = null;

  return (
    // REMOVED: onDragLeave listener from this container div
    <div className="task-list-container">
      <div className="task-list-header">
        <div className="toggle-container">
          <button 
            className={`toggle-btn ${showRecent ? 'active' : ''}`}
            onClick={() => setShowRecent(true)}
          >
            Recent Active
          </button>
          <button 
            className={`toggle-btn ${!showRecent ? 'active' : ''}`}
            onClick={() => setShowRecent(false)}
          >
            All Tasks
          </button>
        </div>
      </div>

      <div className="task-list">
        {orderedTasks.map((task, index) => {
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

          let dragOverClass = '';
          if (dragOverIndex === index) {
            dragOverClass = draggedIndex < index ? 'drag-over-bottom' : 'drag-over-top';
          }

          return (
            <React.Fragment key={task._id}>
              {divider}
              <TaskItem
                task={task}
                isFirst={index === 0 && task.status === 'in-progress'}
                onStatusToggle={onStatusToggle}
                onDescriptionUpdate={onDescriptionUpdate}
                onDelete={onDelete}
                draggable={true}
                onTaskUpdate={onTaskUpdate}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                isDragged={draggedIndex === index}
                dragOverClass={dragOverClass}
              />
            </React.Fragment>
          );
        })}
        {orderedTasks.length === 0 && (
          <div className="empty-filter-state">
            No recent active tasks found.
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;