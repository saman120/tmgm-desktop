// src/components/TaskList.js
import React, { useState, useEffect, useRef } from 'react';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';
import './TaskList.css';

const playBlipSound = () => {
  try {
    const audio = new Audio('/beep.mp3'); 
    audio.play().catch(e => console.warn("Audio play blocked by browser:", e));
  } catch (e) {
    console.error("Failed to play audio:", e);
  }
};

const TaskList = ({ 
  tasks,
  stats, 
  onStatusToggle, 
  onDescriptionUpdate, 
  onRefresh,
  onDelete,
  onReorder,
  onTaskUpdate,
  onShowRecentToggle,
  showRecent
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastPlayedMinuteRef = useRef(new Date().getMinutes());

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(new Date()), 10000); 
    return () => clearInterval(intervalId);
  }, []);

  const currentMinute = currentTime.getMinutes();

  useEffect(() => {
    if (currentMinute % 5 === 0 && lastPlayedMinuteRef.current !== currentMinute) {
      playBlipSound();
      lastPlayedMinuteRef.current = currentMinute;
    }
  }, [currentMinute]);
  
  const hasInProgress = tasks.some(t => t.status === 'in-progress');
  const isOvertime = hasInProgress && currentMinute < 15;
  
  let phase = 'working';
  if (!isOvertime) {
    if (currentMinute < 10) phase = 'rest';
    else if (currentMinute < 15) phase = 'planning';
  }

  const elapsedTime = currentMinute % 5;
  
  let completedInHr = 0;
  let elapsedSlot = 0;

  if (phase === 'working') {
    const targetDate = new Date(currentTime);
    if (isOvertime) targetDate.setHours(targetDate.getHours() - 1);
    
    // O(1) Lookup replacing the previous expensive array reduce loop
    const targetHourKey = `${targetDate.toLocaleDateString()}-${targetDate.getHours()}`;
    completedInHr = stats.hourly[targetHourKey]?.totalCompleted || 0;

    const slotMinutes = isOvertime ? (currentMinute + 60 - 15) : (currentMinute - 15);
    elapsedSlot = Math.floor(slotMinutes / 5) + 1; 
  }

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  const getHourlyStyle = (totalCompleted, expectedSlots) => {
    const ratio = expectedSlots / 9;
    const t = (mult) => mult * ratio;

    if (totalCompleted > t(9)) return { background: 'rgba(140, 225, 140, 0.9)', color: '#1d1d1f' }; 
    if (totalCompleted >= t(8)) return { background: 'rgba(190, 245, 190, 0.9)', color: '#1d1d1f' }; 
    if (totalCompleted >= t(6)) return { background: 'rgba(255, 235, 200, 0.9)', color: '#1d1d1f' }; 
    if (totalCompleted >= t(4)) return { background: 'rgba(255, 190, 190, 0.9)', color: '#1d1d1f' }; 
    if (totalCompleted >= t(2)) return { background: 'rgba(255, 140, 140, 0.9)', color: '#1d1d1f' }; 
    return { background: 'rgba(255, 90, 90, 0.9)', color: '#1d1d1f' }; 
  };

  const getDailyStyle = (dailyAvg) => {
    if (dailyAvg > 9) return { background: 'rgba(140, 225, 140, 0.9)', color: '#1d1d1f' }; 
    if (dailyAvg >= 7) return { background: 'rgba(190, 245, 190, 0.9)', color: '#1d1d1f' }; 
    if (dailyAvg >= 5) return { background: 'rgba(255, 235, 200, 0.9)', color: '#1d1d1f' }; 
    if (dailyAvg >= 3) return { background: 'rgba(255, 190, 190, 0.9)', color: '#1d1d1f' }; 
    return { background: 'rgba(255, 120, 120, 0.9)', color: '#1d1d1f' }; 
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
      if (dragOverIndex !== index) setDragOverIndex(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newArray = [...tasks];
    const [draggedTask] = newArray.splice(draggedIndex, 1);
    newArray.splice(dropIndex, 0, draggedTask);

    const prevTask = newArray[dropIndex - 1];
    const nextTask = newArray[dropIndex + 1];

    let newStatus = draggedTask.status;
    if (prevTask && nextTask && prevTask.status === nextTask.status) newStatus = prevTask.status;
    else if (prevTask) newStatus = prevTask.status;
    else if (nextTask) newStatus = nextTask.status;

    let newOrder;
    if (!prevTask) newOrder = (nextTask?.order || 0) - 10;
    else if (!nextTask) newOrder = (prevTask?.order || 0) + 10;
    else newOrder = (prevTask.order + nextTask.order) / 2;

    onReorder(draggedTask._id, newOrder, newStatus);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null); 
  };

  let lastDayKey = null;
  let lastHourKey = null;

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <div className="toggle-container">
          <button 
            className={`toggle-btn ${showRecent ? 'active' : ''}`}
            onClick={() => onShowRecentToggle()}
          >
            Recent Active
          </button>
          <button 
            className={`toggle-btn ${!showRecent ? 'active' : ''}`}
            onClick={() => onShowRecentToggle()}
          >
            All Tasks
          </button>
          <button className="refresh-button" onClick={onRefresh} title="Refresh tasks"></button>
        </div>

        <div className={`current-stats-container phase-${phase} fade-in`} onClick={() => playBlipSound()} title="Click for sound alert">
          <span className="stat-pill phase-indicator">
            {phase === 'rest' && '🛌 Rest'}
            {phase === 'planning' && '📝 Plan'}
            {phase === 'working' && '🔥 Work'}
          </span>
          <span className="stat-pill" title="Elapsed minutes in current 5m block">⏱️ {4-elapsedTime}m</span>
          {phase === 'working' && (
            <span className="stat-pill" title="Completed Tasks / Elapsed Slots">
              ✅ {completedInHr}/{elapsedSlot}
            </span>
          )}
        </div>
      </div>

      <div className="task-list">
        {tasks.map((task, index) => {
          let dayDivider = null;
          let hourDivider = null;

          if (task.status === 'completed' && (task.completedAt || task.updatedAt)) {
            const taskDate = new Date(task.completedAt || task.updatedAt);
            const dayKey = taskDate.toLocaleDateString();
            const hour = taskDate.getHours();
            const hourKey = `${dayKey}-${hour}`;

            if (dayKey !== lastDayKey) {
              lastDayKey = dayKey;
              const displayDate = taskDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
              const dayStats = stats.daily[dayKey] || { totalCompleted: 0 };
              const isToday = dayKey === currentTime.toLocaleDateString();
              
              let hoursElapsed = 8; 
              if (isToday) {
                const h = currentTime.getHours();
                const m = currentTime.getMinutes();
                hoursElapsed = h < 9 ? 1 : Math.max(0.5, (h - 9) + (m / 60)); 
              }

              const dailyAvg = dayStats.totalCompleted / hoursElapsed;
              const dayStyle = getDailyStyle(dailyAvg);

              dayDivider = (
                <div className="time-divider day-divider" key={`day-${dayKey}`}>
                  <span className="time-divider-text day-text" style={dayStyle} title={`Daily Avg: ${dailyAvg.toFixed(1)} slots/hr (over ${hoursElapsed.toFixed(1)} hrs)`}>
                    {displayDate}
                  </span>
                </div>
              );
            }

            if (hourKey !== lastHourKey) {
              lastHourKey = hourKey;
              const ampm = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour % 12 || 12;
              const hourStats = stats.hourly[hourKey] || { totalCompleted: 0 };
              const isCurrentHour = hourKey === `${currentTime.toLocaleDateString()}-${currentTime.getHours()}`;
              
              let expectedSlots = 9; 
              if (isCurrentHour) {
                const m = currentTime.getMinutes();
                expectedSlots = m < 15 ? 1 : Math.floor((m - 15) / 5) + 1;
              }

              const hourStyle = getHourlyStyle(hourStats.totalCompleted, expectedSlots);

              hourDivider = (
                <div className="time-divider hour-divider" key={`hour-${hourKey}`}>
                  <span className="time-divider-text hour-text" style={hourStyle} title={`Slots Completed: ${hourStats.totalCompleted} (Expected: ~${expectedSlots})`}>
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
      </div>
    </div>
  );
};

export default React.memo(TaskList);