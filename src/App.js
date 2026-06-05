// src/App.js - Main React Component
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TaskList from './components/TaskList';
import AddTaskForm from './components/AddTaskForm';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import { taskAPI } from './services/api';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  
  const sortTasks = useCallback((tasksToSort) => {
    const sortedTasks = [...tasksToSort].sort((a, b) => {
      const statusOrder = { 'in-progress': 0, 'pending': 1, backlog: 1.5, 'hold': 2, 'completed': 3 };
      const statusDiff = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
      
      if (statusDiff !== 0) return statusDiff;

      // FIX: Prioritize inProgressAt so the array perfectly matches the grouping engine!
      const timeA = Date.parse(a.inProgressAt || a.completedAt || a.updatedAt || a.createdAt || 0);
      const timeB = Date.parse(b.inProgressAt || b.completedAt || b.updatedAt || b.createdAt || 0);

      if (a.status === 'completed') return timeB - timeA;

      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;

      if (orderA !== orderB) return orderA - orderB; 
      
      return timeA - timeB;
    });

    setTasks(sortedTasks);
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTasks = await taskAPI.getAllTasks();
      sortTasks(fetchedTasks.map(task => ({ ...task, delayCount: Math.round(task.delayCount || 0) })));
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [sortTasks]);

  const createTask = useCallback(async (data) => {
    try {
      setError(null);
      const newTask = await taskAPI.createTask({ ...data, status: showRecent ? 'pending' : 'hold', title: 'Example' });
      sortTasks([...tasks, newTask]);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task. Please try again.');
      throw err;
    }
  }, [tasks, showRecent, sortTasks]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      setError(null);
      const updatedTask = await taskAPI.updateTask(taskId, updates);
      sortTasks(tasks.map(task => task._id === taskId ? updatedTask : task));
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    }
  }, [tasks, sortTasks]);

  const deleteTask = useCallback(async (taskId) => {
    try {
      setError(null);
      await taskAPI.deleteTask(taskId);
      sortTasks(tasks.filter(t => t._id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task. Please try again.');
      throw err;
    }
  }, [tasks, sortTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  const handleReorder = useCallback(async (taskId, newOrder) => {
    await updateTask(taskId, { order: newOrder });
    sortTasks(tasks.map(task => task._id === taskId ? { ...task, order: newOrder } : task));
  }, [tasks, sortTasks, updateTask]);

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

  // Pre-calculate stats using inProgressAt as the primary grouping key
  const taskStats = useMemo(() => {
    const daily = {};
    const hourly = {};
    
    filteredTasks.forEach(task => {
      if (task.status === 'completed') {
        // Fallback safely to completedAt or updatedAt only if inProgressAt is somehow missing
        const timestamp = task.inProgressAt || task.completedAt || task.updatedAt;
        
        if (timestamp) {
          const taskDate = new Date(timestamp);
          const dayKey = taskDate.toLocaleDateString();
          const hourKey = `${dayKey}-${taskDate.getHours()}`;

          if (!daily[dayKey]) daily[dayKey] = { totalCompleted: 0 };
          if (!hourly[hourKey]) hourly[hourKey] = { totalCompleted: 0 };

          const taskWeight = 1 + (task.distractionCount || 0);
          daily[dayKey].totalCompleted += taskWeight;
          hourly[hourKey].totalCompleted += taskWeight;
        }
      }
    });
    return { daily, hourly };
  }, [filteredTasks]);

  const clearError = useCallback(() => setError(null), []);
  const toggleShowRecent = useCallback(() => setShowRecent(prev => !prev), []);

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