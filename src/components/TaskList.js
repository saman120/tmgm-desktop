// src/components/TaskList.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';
import DaySummaryForm from './DaySummaryForm'; 
import { taskAPI } from '../services/api';
import { getLocalDayKey } from '../utils/dateUtils';
import './TaskList.css';

const playBlipSound = () => {
  try {
    const soundPath = process.env.PUBLIC_URL + '/beep.mp3';
    const audio = new Audio(soundPath);
    audio.play().catch(e => console.warn("Audio play blocked:", e));
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

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [summaryModalDay, setSummaryModalDay] = useState(null);
  const [daySummaries, setDaySummaries] = useState({});

  const [isBreathingLoading, setIsBreathingLoading] = useState(false);
  const [lastBreathedHour, setLastBreathedHour] = useState(localStorage.getItem('lastBreathedHour') || null);

  const refreshDaySummaries = useCallback(() => {
    taskAPI.getAllDaySummaries().then(setDaySummaries).catch(() => {});
  }, []);

  useEffect(() => {
    refreshDaySummaries();
  }, [refreshDaySummaries]);

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(intervalId);
  }, []);

  const currentMinute = currentTime.getMinutes();
  const currentHourKey = `${getLocalDayKey(currentTime)}-${currentTime.getHours()}`;
  const currentMinuteKey = `${currentHourKey}-${currentMinute}`;

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
    
    const targetHourKey = `${getLocalDayKey(targetDate)}-${targetDate.getHours()}`;
    completedInHr = stats.hourly[targetHourKey]?.totalCompleted || 0;

    const slotMinutes = isOvertime ? (currentMinute + 60 - 15) : (currentMinute - 15);
    elapsedSlot = Math.floor(slotMinutes / 5) + 1; 
  }

  const toggleGroup = (key, defaultCollapsed = false) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : !defaultCollapsed
    }));
  };
  
  const getHourlyStyle = (totalCompleted, expectedSlots, isOffTime) => {
    if (isOffTime) {
      if (totalCompleted >= 6) return { background: 'var(--stat-off-green-1)', color: 'var(--stat-text-light)' }; 
      if (totalCompleted >= 4) return { background: 'var(--stat-off-green-2)', color: 'var(--stat-text-dark)' };
      if (totalCompleted >= 2) return { background: 'var(--stat-green-1)', color: 'var(--stat-text-dark)' }; 
      if (totalCompleted > 0) return { background: 'var(--stat-off-green-3)', color: 'var(--stat-text-dark)' }; 
      return { background: 'var(--stat-off-green-4)', color: 'var(--stat-text-dark)' }; 
    }

    const ratio = expectedSlots / 9;
    const t = (mult) => mult * ratio;

    if (totalCompleted > t(9)) return { background: 'var(--stat-green-1)', color: 'var(--stat-text-dark)' }; 
    if (totalCompleted >= t(8)) return { background: 'var(--stat-green-2)', color: 'var(--stat-text-dark)' }; 
    if (totalCompleted >= t(6)) return { background: 'var(--stat-yellow)', color: 'var(--stat-text-dark)' }; 
    if (totalCompleted >= t(4)) return { background: 'var(--stat-red-1)', color: 'var(--stat-text-dark)' }; 
    if (totalCompleted >= t(2)) return { background: 'var(--stat-red-2)', color: 'var(--stat-text-dark)' }; 
    return { background: 'var(--stat-red-3)', color: 'var(--stat-text-dark)' }; 
  };

  // Added isNeutral parameter to fall back to grey in the early morning
  const getDailyStyle = (dailyAvg, isOffTime, isNeutral = false) => {
    if (isNeutral) {
      return { background: 'var(--hover-bg)', color: 'var(--text-muted)' };
    }

    if (isOffTime) {
      if (dailyAvg > 6) return { background: 'var(--stat-off-green-1)', color: 'var(--stat-text-light)' }; 
      if (dailyAvg >= 4) return { background: 'var(--stat-off-green-2)', color: 'var(--stat-text-dark)' };
      if (dailyAvg > 0) return { background: 'var(--stat-green-1)', color: 'var(--stat-text-dark)' }; 
      return { background: 'var(--stat-off-green-4)', color: 'var(--stat-text-dark)' }; 
    }

    if (dailyAvg > 9) return { background: 'var(--stat-green-1)', color: 'var(--stat-text-dark)' }; 
    if (dailyAvg >= 7) return { background: 'var(--stat-green-2)', color: 'var(--stat-text-dark)' }; 
    if (dailyAvg >= 5) return { background: 'var(--stat-yellow)', color: 'var(--stat-text-dark)' }; 
    if (dailyAvg >= 3) return { background: 'var(--stat-red-1)', color: 'var(--stat-text-dark)' }; 
    if (dailyAvg > 0) return { background: 'var(--stat-red-2)', color: 'var(--stat-text-dark)' }; 
    return { background: 'var(--stat-red-dark)', color: 'var(--stat-text-light)' }; 
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

  const handleBreathingExercise = async () => {
    const today = getLocalDayKey(currentTime);
    setIsBreathingLoading(true);
    try {
      const currentSummary = await taskAPI.getDaySummaryByDate(today);
      const dataToUpdate = currentSummary || {};
      
      await taskAPI.updateDaySummaryByDate(today, {
        ...dataToUpdate,
        breathingExec: (dataToUpdate.breathingExec || 0) + 1
      });
      
      playBlipSound();
      
      setLastBreathedHour(currentHourKey);
      localStorage.setItem('lastBreathedHour', currentHourKey);

    } catch (err) {
      console.error('Failed to log breathing exercise:', err);
    } finally {
      setIsBreathingLoading(false);
    }
  };

  const renderElements = useMemo(() => {
    const elements = [];

    let currentDayIter = new Date(currentTime);
    currentDayIter.setHours(0, 0, 0, 0);

    let oldestDateMs = currentDayIter.getTime();
    if (!showRecent && tasks.length > 0) {
        tasks.forEach(t => {
           if (t.status === 'completed') {
               const ts = t.inProgressAt || t.completedAt || t.updatedAt;
               if (ts && Date.parse(ts) < oldestDateMs) {
                   oldestDateMs = Date.parse(ts);
               }
           }
        });
    } else {
        oldestDateMs = currentDayIter.getTime() - (14 * 24 * 60 * 60 * 1000);
    }
    const cutoffDay = new Date(oldestDateMs);
    cutoffDay.setHours(0, 0, 0, 0);

    let lastDayKey = null;
    let lastHourKey = null;

    const pushDayDivider = (dateObj, dayKey) => {
      const displayDate = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      const dayStats = stats.daily[dayKey] || { totalCompleted: 0 };
      const isToday = dayKey === getLocalDayKey(currentTime);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      // Check if it's before 10 AM on the current day with 0 completed tasks
      const isEarlyMorningNeutral = isToday && currentTime.getHours() < 10 && dayStats.totalCompleted === 0;

      let hoursElapsed = 8;
      if (isToday) {
          const h = currentTime.getHours();
          const m = currentTime.getMinutes();
          hoursElapsed = h < 9 ? 1 : Math.max(0.5, (h - 9) + (m / 60));
      }

      const dailyAvg = dayStats.totalCompleted / hoursElapsed;
      const dayStyle = getDailyStyle(dailyAvg, isWeekend, isEarlyMorningNeutral);
      const isCollapsed = collapsedGroups[dayKey] ?? !isToday;

      const statsText = ` • ${dayStats.totalCompleted} slots (${dailyAvg.toFixed(1)}/hr)`;
      const hasSummary = !!daySummaries[dayKey];

      elements.push(
          <div className="time-divider day-divider" key={`day-${dayKey}`}>
              <span
                className="time-divider-text day-text"
                style={{ ...dayStyle, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => toggleGroup(dayKey, !isToday)}
                title={`Daily Avg: ${dailyAvg.toFixed(1)} slots/hr (over ${hoursElapsed.toFixed(1)} hrs)`}
              >
                  <span>{isCollapsed ? '▶ ' : '▼ '} {displayDate}{statsText}</span>

                  <button
                    className="day-summary-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSummaryModalDay(dayKey);
                    }}
                    title={hasSummary ? "Edit Day Summary" : "Add Day Summary"}
                  >
                    {hasSummary ? '📝' : '➕'}
                  </button>
              </span>
          </div>
      );

      lastDayKey = dayKey;
      lastHourKey = null;
    };

    const pushHourDivider = (dateObj, hourKey) => {
      const hour = dateObj.getHours();
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const hourStats = stats.hourly[hourKey] || { totalCompleted: 0 };
      const isCurrentHour = hourKey === `${getLocalDayKey(currentTime)}-${currentTime.getHours()}`;

      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const isOffHour = hour < 9 || hour >= 19;
      const isOffTime = isWeekend || isOffHour;

      let expectedSlots = 9;
      if (isCurrentHour && !isOffTime) {
          const m = currentTime.getMinutes();
          expectedSlots = m < 15 ? 1 : Math.floor((m - 15) / 5) + 1;
      } else if (isOffTime) {
          expectedSlots = isCurrentHour ? 1 : hourStats.totalCompleted || 1;
      }

      const hourStyle = getHourlyStyle(hourStats.totalCompleted, expectedSlots, isOffTime);
      const isCollapsed = collapsedGroups[hourKey] ?? false;

      const statsText = isOffTime
        ? ` • ${hourStats.totalCompleted} slots`
        : ` • ${hourStats.totalCompleted}/${expectedSlots} slots`;

      elements.push(
          <div className="time-divider hour-divider" key={`hour-${hourKey}`}>
              <span
                className="time-divider-text hour-text"
                style={{ ...hourStyle, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleGroup(hourKey, false)}
                title={isOffTime ? `Off-hours slots: ${hourStats.totalCompleted}` : `Slots Completed: ${hourStats.totalCompleted} (Expected: ~${expectedSlots})`}
              >
                  {isCollapsed ? '▶ ' : '▼ '} {displayHour} {ampm}{statsText}
              </span>
          </div>
      );
      lastHourKey = hourKey;
    };

    tasks.forEach((task, index) => {
        let dragOverClass = '';
        if (dragOverIndex === index) {
            dragOverClass = draggedIndex < index ? 'drag-over-bottom' : 'drag-over-top';
        }

        if (task.status !== 'completed') {
            elements.push(
                <TaskItem
                    key={task._id}
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
            );
            return;
        }

        const timestamp = task.inProgressAt || task.completedAt || task.updatedAt;
        const taskDate = new Date(timestamp || currentTime);

        const dayKey = getLocalDayKey(taskDate);
        const hour = taskDate.getHours();
        const hourKey = `${dayKey}-${hour}`;

        const taskDayStart = new Date(taskDate);
        taskDayStart.setHours(0, 0, 0, 0);

        while (currentDayIter > taskDayStart) {
            const emptyDayKey = getLocalDayKey(currentDayIter);
            if (emptyDayKey !== lastDayKey) {
                pushDayDivider(currentDayIter, emptyDayKey);
            }
            currentDayIter.setDate(currentDayIter.getDate() - 1);
        }

        if (dayKey !== lastDayKey) {
            pushDayDivider(taskDate, dayKey);
            currentDayIter.setDate(currentDayIter.getDate() - 1);
        }

        const isDayCollapsed = collapsedGroups[dayKey] ?? (dayKey !== getLocalDayKey(currentTime));

        if (!isDayCollapsed && hourKey !== lastHourKey) {
            pushHourDivider(taskDate, hourKey);
        }

        const isHourCollapsed = collapsedGroups[hourKey] ?? false;

        if (!isDayCollapsed && !isHourCollapsed) {
            elements.push(
                <TaskItem
                    key={task._id}
                    task={task}
                    isFirst={false}
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
            );
        }
    });

    while (currentDayIter >= cutoffDay) {
        const emptyDayKey = getLocalDayKey(currentDayIter);
        if (emptyDayKey !== lastDayKey) {
            pushDayDivider(currentDayIter, emptyDayKey);
        }
        currentDayIter.setDate(currentDayIter.getDate() - 1);
    }

    return elements;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, stats, collapsedGroups, showRecent, draggedIndex, dragOverIndex, daySummaries, currentMinuteKey]);

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  const canBreatheThisHour = lastBreathedHour !== currentHourKey;

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
          
          {/* Removed the phase === 'rest' check so it shows for the entire hour until clicked */}
          {canBreatheThisHour && (
            <button 
              className="stat-pill breathing-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleBreathingExercise();
              }}
              disabled={isBreathingLoading}
              title="Log Breathing Exercise (+1)"
            >
              {isBreathingLoading ? '⏳...' : '🫁 Breathe'}
            </button>
          )}

          <span className="stat-pill phase-indicator">
            {phase === 'rest' && '🌿 Rest'}
            {phase === 'planning' && '📝 Plan'}
            {phase === 'working' && '🔥 Work'}
          </span>
          <span className="stat-pill" title="Elapsed minutes in current 5m block">⏱️ {5-elapsedTime}m</span>
          {phase === 'working' && (
            <span className="stat-pill" title="Completed Tasks / Elapsed Slots">
              ✅ {completedInHr}/{elapsedSlot}
            </span>
          )}
        </div>
      </div>

      <div className="task-list">
        {renderElements}
      </div>

      <DaySummaryForm
        isOpen={!!summaryModalDay}
        date={summaryModalDay}
        onClose={() => {
          setSummaryModalDay(null);
          refreshDaySummaries();
        }}
      />
    </div>
  );
};

export default React.memo(TaskList);