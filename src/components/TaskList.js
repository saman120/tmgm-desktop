// src/components/TaskList.js
import React, { useMemo, useState } from 'react';
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

      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  };

  const orderedTasks = sortTasks(filteredTasks);

  const stats = useMemo(() => {
    const daily = {};
    const hourly = {};
    
    orderedTasks.forEach(task => {
      if (task.status === 'completed' && (task.completedAt || task.updatedAt)) {
        const taskDate = new Date(task.completedAt || task.updatedAt);
        const dayKey = taskDate.toLocaleDateString();
        const hourKey = `${dayKey}-${taskDate.getHours()}`;

        if (!daily[dayKey]) daily[dayKey] = { delayCount: 0, distractionCount: 0 };
        if (!hourly[hourKey]) hourly[hourKey] = { delayCount: 0, distractionCount: 0 };

        const dC = task.delayCount || 0;
        const distC = task.distractionCount || 0;

        daily[dayKey].delayCount += dC;
        daily[dayKey].distractionCount += distC;
        
        hourly[hourKey].delayCount += dC;
        hourly[hourKey].distractionCount += distC;
      }
    });
    return { daily, hourly };
  }, [orderedTasks]);

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  const getGroupStyle = (dC, distC) => {
    let delayColor = 'rgba(235, 248, 235, 0.9)';
    
    if (dC < 1) delayColor = 'rgba(230, 210, 255, 0.9)'; 
    else if (dC > 1 && dC <= 2) delayColor = 'rgba(255, 224, 224, 0.9)';
    else if (dC > 2 && dC <= 5) delayColor = 'rgba(255, 180, 180, 0.9)';
    else if (dC > 5 && dC <= 10) delayColor = 'rgba(255, 120, 120, 0.9)';
    else if (dC > 10) delayColor = 'rgba(255, 70, 70, 0.9)';

    let distColor = 'rgba(235, 248, 235, 0.9)';
    if (distC > 1 && distC <= 5) distColor = 'rgba(255, 245, 180, 0.9)';
    else if (distC > 5 && distC <= 10) distColor = 'rgba(255, 220, 120, 0.9)';
    else if (distC > 10) distColor = 'rgba(255, 190, 70, 0.9)';

    return { 
      background: `linear-gradient(135deg, ${delayColor} 0%, ${distColor} 100%)`,
      color: '#1d1d1f'
    };
  };

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

  let lastDayKey = null;
  let lastHourKey = null;

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
          let dayDivider = null;
          let hourDivider = null;

          if (task.status === 'completed' && (task.completedAt || task.updatedAt)) {
            const taskDate = new Date(task.completedAt || task.updatedAt);
            const dayKey = taskDate.toLocaleDateString();
            const hour = taskDate.getHours();
            const hourKey = `${dayKey}-${hour}`;

            // Check if we need a new Day Divider
            if (dayKey !== lastDayKey) {
              lastDayKey = dayKey;
              const displayDate = taskDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
              
              const dayStats = stats.daily[dayKey] || { delayCount: 0, distractionCount: 0 };
              const dayStyle = getGroupStyle(dayStats.delayCount, dayStats.distractionCount);

              dayDivider = (
                <div className="time-divider day-divider" key={`day-${dayKey}`}>
                  <span className="time-divider-text day-text" style={dayStyle}>
                    {displayDate}
                  </span>
                </div>
              );
            }

            // Check if we need a new Hour Divider
            if (hourKey !== lastHourKey) {
              lastHourKey = hourKey;
              const ampm = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour % 12 || 12;
              
              const hourStats = stats.hourly[hourKey] || { delayCount: 0, distractionCount: 0 };
              const hourStyle = getGroupStyle(hourStats.delayCount, hourStats.distractionCount);

              hourDivider = (
                <div className="time-divider hour-divider" key={`hour-${hourKey}`}>
                  <span className="time-divider-text hour-text" style={hourStyle}>
                    {displayHour} {ampm}
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
              {dayDivider}
              {hourDivider}
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