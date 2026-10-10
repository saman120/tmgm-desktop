// src/components/TaskList.js
import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';
import DaySummaryForm from './DaySummaryForm'; 
import ProgressInsights from './ProgressInsights';
import { taskAPI } from '../services/api';
import { getLocalDayKey, formatDayLabel, formatShortDate } from '../utils/dateUtils';
import {
  OFFICIAL_START_HOUR,
  OFFICIAL_END_HOUR,
  TOTAL_EXPECTED_DAILY_SLOTS,
  getExpectedDaySlots,
  getExpectedWeekSlots,
  getWeekStart,
  getWeekKey,
  summarizeBucket,
  formatPercent,
  getScoreStyle,
  getTaskBucketTime
} from '../utils/productivity';
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
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const closeInsights = useCallback(() => setIsInsightsOpen(false), []);

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

  const toggleGroup = useCallback((key, defaultCollapsed = false) => {
    startTransition(() => setCollapsedGroups(prev => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : !defaultCollapsed
    })));
  }, []);
  
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

  // Drag handlers are stable (they read live values through refs) and receive the
  // row index from TaskItem, so memoized rows only re-render when their own
  // isDragged / dragOverClass props change.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const draggedIndexRef = useRef(null);
  const dragOverIndexRef = useRef(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const resetDrag = useCallback(() => {
    draggedIndexRef.current = null;
    dragOverIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback((e, index) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
    const dragged = draggedIndexRef.current;
    if (dragged !== null && dragged !== index && dragOverIndexRef.current !== index) {
      dragOverIndexRef.current = index;
      setDragOverIndex(index);
    }
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    const dragged = draggedIndexRef.current;
    if (dragged === null || dragged === dropIndex) {
      resetDrag();
      return;
    }

    const newArray = [...tasksRef.current];
    const [draggedTask] = newArray.splice(dragged, 1);
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

    onReorderRef.current(draggedTask._id, newOrder, newStatus);
    resetDrag();
  }, [resetDrag]);

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

  // Layout (dividers + which tasks are visible) only depends on data, so it is built
  // once per data change; drag state is applied in a cheap second pass below.
  const layout = useMemo(() => {
    const elements = [];

    // Recent: at least the last 14 days; All: back to the oldest completed task
    // (the grouping pass below extends the range to cover every completed task).
    const cutoffDay = new Date(currentTime);
    cutoffDay.setHours(0, 0, 0, 0);
    if (showRecent) cutoffDay.setDate(cutoffDay.getDate() - 14);

    let lastWeekKey = null;

    const pushWeekDivider = (dateObj, weekKey) => {
      const weekStart = getWeekStart(dateObj);
      const week = summarizeBucket(stats.weekly[weekKey], getExpectedWeekSlots(weekStart, currentTime));
      const displayWeek = formatShortDate(weekStart);

      elements.push(
          <div className="time-divider week-divider" key={`week-${weekKey}`}>
              <span
                className="time-divider-text week-text"
                style={getScoreStyle(week.score)}
                title={`Week of ${displayWeek}: ${week.completed}/${week.expected} slots • ${week.tasks} tasks • ${week.distractions} distractions • focus ${formatPercent(week.focus)} • estimate accuracy ${formatPercent(week.accuracy)} • planned ahead ${formatPercent(week.planned)}`}
              >
                  Week of {displayWeek} • {week.completed}/{week.expected} slots • score {week.score ?? '–'}
              </span>
          </div>
      );
      lastWeekKey = weekKey;
    };

    const pushDayDivider = (dateObj, dayKey) => {
      const weekKey = getWeekKey(dateObj);
      if (weekKey !== lastWeekKey) pushWeekDivider(dateObj, weekKey);

      const displayDate = formatDayLabel(dateObj);
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

      const expectedSlotsSoFar = getExpectedDaySlots(dateObj, currentTime);
      const remainingSlots = Math.max(0, expectedSlotsSoFar - dayStats.totalCompleted);
      const statsText = isWeekend
        ? ` • ${dayStats.totalCompleted} slots`
        : ` • ${dayStats.totalCompleted}/${expectedSlotsSoFar} slots (${remainingSlots} remaining)`;
      const hasSummary = !!daySummaries[dayKey];
      const dayMetrics = summarizeBucket(stats.daily[dayKey], expectedSlotsSoFar);
      const metricsTitle = `${dayMetrics.tasks} tasks • ${dayMetrics.distractions} distractions • focus ${formatPercent(dayMetrics.focus)} • estimate accuracy ${formatPercent(dayMetrics.accuracy)} • planned ahead ${formatPercent(dayMetrics.planned)} • score ${dayMetrics.score ?? '–'}`;

      elements.push(
          <div className="time-divider day-divider" key={`day-${dayKey}`}>
              <span
                className="time-divider-text day-text"
                style={{ ...dayStyle, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => toggleGroup(dayKey, !isToday)}
                title={`${isWeekend ? `${dayStats.totalCompleted} slots (weekend)` : `${dayStats.totalCompleted} of ${expectedSlotsSoFar} expected slots so far (official ${OFFICIAL_START_HOUR}am-${OFFICIAL_END_HOUR - 12}pm, full-day target ${TOTAL_EXPECTED_DAILY_SLOTS}), ${remainingSlots} remaining`} • ${dailyAvg.toFixed(1)} slots/hr avg (over ${hoursElapsed.toFixed(1)} hrs)\n${metricsTitle}`}
              >
                  <span>{isCollapsed ? '▶ ' : '▼ '} {displayDate}{statsText}</span>
                  {dayMetrics.score !== null && <span className="divider-score">{dayMetrics.score}</span>}

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
      const hourMetrics = summarizeBucket(stats.hourly[hourKey]);
      const hourMetricsTitle = `${hourMetrics.tasks} tasks • ${hourMetrics.distractions} distractions • estimate accuracy ${formatPercent(hourMetrics.accuracy)} • planned ahead ${formatPercent(hourMetrics.planned)}`;
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
                title={`${isOffTime ? `Off-hours slots: ${hourStats.totalCompleted}` : `Slots Completed: ${hourStats.totalCompleted} (Expected: ~${expectedSlots})`}\n${hourMetricsTitle}`}
              >
                  {isCollapsed ? '▶ ' : '▼ '} {displayHour} {ampm}{statsText}
              </span>
          </div>
      );
    };

    // Group completed tasks by day and hour (tasks arrive newest first).
    const todayStart = new Date(currentTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayKey = getLocalDayKey(currentTime);
    const completedByDay = new Map();
    let newestDayMs = todayStart.getTime();
    let oldestDayMs = cutoffDay.getTime();

    tasks.forEach((task, index) => {
        if (task.status !== 'completed') {
            elements.push({ task, index, isFirst: index === 0 && task.status === 'in-progress' });
            return;
        }

        const taskDate = new Date(getTaskBucketTime(task) || currentTime);
        const dayKey = getLocalDayKey(taskDate);
        const hour = taskDate.getHours();
        if (!completedByDay.has(dayKey)) {
            completedByDay.set(dayKey, new Map());
            const dayStart = new Date(taskDate);
            dayStart.setHours(0, 0, 0, 0);
            newestDayMs = Math.max(newestDayMs, dayStart.getTime());
            oldestDayMs = Math.min(oldestDayMs, dayStart.getTime());
        }
        const hours = completedByDay.get(dayKey);
        if (!hours.has(hour)) hours.set(hour, []);
        hours.get(hour).push({ task, index, isFirst: false });
    });

    const dayIter = new Date(newestDayMs);
    while (dayIter.getTime() >= oldestDayMs) {
        const dayKey = getLocalDayKey(dayIter);
        pushDayDivider(dayIter, dayKey);

        const isDayCollapsed = collapsedGroups[dayKey] ?? (dayKey !== todayKey);
        if (!isDayCollapsed) {
            const hoursWithTasks = completedByDay.get(dayKey) || new Map();
            [...hoursWithTasks.keys()].sort((a, b) => b - a).forEach(hour => {
                const hourDate = new Date(dayIter);
                hourDate.setHours(hour, 0, 0, 0);
                const hourKey = `${dayKey}-${hour}`;
                pushHourDivider(hourDate, hourKey);

                if (collapsedGroups[hourKey] ?? false) return;
                hoursWithTasks.get(hour).forEach(row => elements.push(row));
            });
        }
        dayIter.setDate(dayIter.getDate() - 1);
    }

    return elements;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, stats, collapsedGroups, showRecent, daySummaries, currentMinuteKey]);

  const renderElements = useMemo(() => layout.map(row => {
    if (React.isValidElement(row)) return row;
    const { task, index, isFirst } = row;
    let dragOverClass = '';
    if (dragOverIndex === index) {
      dragOverClass = draggedIndex < index ? 'drag-over-bottom' : 'drag-over-top';
    }
    return (
      <TaskItem
        key={task._id}
        task={task}
        isFirst={isFirst}
        onStatusToggle={onStatusToggle}
        onDescriptionUpdate={onDescriptionUpdate}
        onDelete={onDelete}
        draggable={true}
        onTaskUpdate={onTaskUpdate}
        index={index}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={resetDrag}
        isDragged={draggedIndex === index}
        dragOverClass={dragOverClass}
      />
    );
  }), [layout, draggedIndex, dragOverIndex, onStatusToggle, onDescriptionUpdate, onDelete, onTaskUpdate, handleDragStart, handleDragOver, handleDrop, resetDrag]);

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
          <button
            className="toggle-btn progress-btn"
            onClick={() => setIsInsightsOpen(true)}
            title="Hourly / daily / weekly progress"
          >
            📊
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
        metrics={summaryModalDay ? summarizeBucket(stats.daily[summaryModalDay], getExpectedDaySlots(new Date(`${summaryModalDay}T00:00:00`), currentTime)) : null}
        onClose={() => {
          setSummaryModalDay(null);
          refreshDaySummaries();
        }}
      />

      <ProgressInsights
        isOpen={isInsightsOpen}
        onClose={closeInsights}
        stats={stats}
        daySummaries={daySummaries}
        now={currentTime}
      />
    </div>
  );
};

export default React.memo(TaskList);