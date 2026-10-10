// src/App.js - Main React Component
import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import TaskList from './components/TaskList';
import AddTaskForm from './components/AddTaskForm';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import { taskAPI } from './services/api';
import { buildTaskStats, getStatusTransitionUpdates, resolveLoggedTimes } from './utils/productivity';
import './App.css';

const STATUS_ORDER = { 'in-progress': 0, 'pending': 1, backlog: 1.5, 'hold': 2, 'completed': 3 };

// Sort keys are computed once per task (decorate-sort-undecorate) instead of
// re-parsing dates inside every comparison.
const sortTaskList = (tasksToSort) => tasksToSort
  .map(task => ({
    task,
    status: STATUS_ORDER[task.status] ?? 0,
    time: Date.parse(task.inProgressAt || task.completedAt || task.updatedAt || task.createdAt || 0) || 0,
    order: task.order !== undefined ? task.order : 0,
  }))
  .sort((a, b) => {
    if (a.status !== b.status) return a.status - b.status;
    if (a.task.status === 'completed') return b.time - a.time;
    if (a.order !== b.order) return a.order - b.order;
    return a.time - b.time;
  })
  .map(entry => entry.task);

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  // Callbacks read the latest tasks through a ref (and update via functional setState)
  // so their identities stay stable and memoized task rows don't all re-render.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  
  const sortTasks = useCallback((tasksToSort) => {
    setTasks(sortTaskList(tasksToSort));
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTasks = await taskAPI.getAllTasks();
      sortTasks(fetchedTasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [sortTasks]);

  // Accepts one task payload or an array (a big task broken down into 5-minute steps).
  const createTask = useCallback(async (dataOrList) => {
    try {
      setError(null);
      const payloads = resolveLoggedTimes(
        Array.isArray(dataOrList) ? dataOrList : [dataOrList],
        tasksRef.current
      );
      const newTasks = [];
      for (const data of payloads) {
        newTasks.push(await taskAPI.createTask({ status: showRecent ? 'pending' : 'hold', title: 'Example', ...data }));
      }
      setTasks(prev => sortTaskList([...prev, ...newTasks]));
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task. Please try again.');
      throw err;
    }
  }, [showRecent]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      setError(null);
      const currentTask = tasksRef.current.find(task => task._id === taskId);
      // "___at ...," typed into an inline edit backdates/completes the task. Its
      // createdAt is genuine, so it isn't flagged as backfilled (still counts for "planned").
      if (updates.loggedAt) {
        const [resolved] = resolveLoggedTimes(
          [{ ...(currentTask?.estimatedSlots ? { estimatedSlots: currentTask.estimatedSlots } : {}), ...updates }],
          tasksRef.current.filter(task => task._id !== taskId)
        );
        const { backfilled, ...timing } = resolved;
        updates = timing;
      }
      const updatedTask = await taskAPI.updateTask(taskId, {
        ...getStatusTransitionUpdates(currentTask, updates.status),
        ...updates
      });
      setTasks(prev => sortTaskList(prev.map(task => task._id === taskId ? updatedTask : task)));
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (taskId) => {
    try {
      setError(null);
      await taskAPI.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task. Please try again.');
      throw err;
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Background create/update syncs (services/api.js) resolve after the optimistic
  // local write already rendered, so server-computed fields (e.g. delayCount) need
  // to be merged into state here rather than waiting for the next manual refresh.
  useEffect(() => {
    const unsubscribe = taskAPI.subscribeToTaskSync((serverTask) => {
      const { tempId, ...cleanServerTask } = serverTask;
      const matchId = tempId ?? cleanServerTask._id;

      setTasks(prev => {
        const index = prev.findIndex(t => t._id === matchId);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...prev[index], ...cleanServerTask };
        return next;
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => taskAPI.subscribeToTasksRefreshed(sortTasks), [sortTasks]);

  const handleStatusToggle = useCallback(async (taskId, currentStatus, status) => {
    const statusCycle = { 'hold': 'in-progress', 'in-progress': 'completed', 'pending': 'in-progress' };
    const newStatus = status || statusCycle[currentStatus];
    await updateTask(taskId, { status: newStatus });
  }, [updateTask]);

  const handleDescriptionUpdate = useCallback(async (taskId, newDescription) => {
    await updateTask(taskId, { description: newDescription });
  }, [updateTask]);

  const handleTaskUpdate = useCallback(async (taskId, update) => {
    await updateTask(taskId, update);
  }, [updateTask]);

  const handleDelete = useCallback(async (taskId) => {
    await deleteTask(taskId);
  }, [deleteTask]);

  const handleReorder = useCallback(async (taskId, newOrder, newStatus) => {
    const task = tasksRef.current.find(t => t._id === taskId);
    const updates = { order: newOrder };
    if (newStatus && task && newStatus !== task.status) updates.status = newStatus;
    await updateTask(taskId, updates);
  }, [updateTask]);

  const filteredTasks = useMemo(() => {
    if (!showRecent) return tasks;
    const twoWeeksAgoMs = Date.now() - (14 * 24 * 60 * 60 * 1000);
    return tasks.filter(task => {
      if (task.status === 'hold' || task.status === 'backlog') return false;
      const dateString = task.updatedAt || task.createdAt;
      if (!dateString) return true; 
      return Date.parse(dateString) >= twoWeeksAgoMs;
    });
  }, [tasks, showRecent]);

  // Stats are built from every task (not just the visible filter) so week buckets
  // that straddle the 14-day "Recent" window still add up correctly.
  const taskStats = useMemo(() => buildTaskStats(tasks), [tasks]);

  const clearError = useCallback(() => setError(null), []);

  // Switching views can mount hundreds of rows; keep the click itself responsive.
  const toggleShowRecent = useCallback(() => startTransition(() => setShowRecent(prev => !prev)), []);

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        {error && <ErrorMessage message={error} onDismiss={clearError} />}
        
        {loading ? (
          <LoadingSpinner />
        ) : (
          <TaskList
            tasks={filteredTasks}
            stats={taskStats}
            onStatusToggle={handleStatusToggle}
            onDescriptionUpdate={handleDescriptionUpdate}
            onTaskUpdate={handleTaskUpdate}
            onDelete={handleDelete}
            onReorder={handleReorder}
            onRefresh={loadTasks}
            onShowRecentToggle={toggleShowRecent}
            showRecent={showRecent}
          />
        )}
      </main>
      <footer className="app-footer">
        <AddTaskForm
          isOpen={isAddingTask}
          onRefresh={loadTasks}
          onOpen={() => setIsAddingTask(true)}
          onClose={() => setIsAddingTask(false)}
          onSubmit={createTask}
        />
      </footer>
    </div>
  );
}

export default App;