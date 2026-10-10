// src/services/api.js - API service for task management
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3840';

const STORAGE_KEYS = {
  tasks: 'tmgm_tasks',
  daySummaries: 'tmgm_day_summaries'
};

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write errors
  }
};

const getStoredTasks = () => readStorage(STORAGE_KEYS.tasks, []);
const setStoredTasks = (tasks) => writeStorage(STORAGE_KEYS.tasks, Array.isArray(tasks) ? tasks : []);

const getStoredDaySummaries = () => readStorage(STORAGE_KEYS.daySummaries, {});
const setStoredDaySummaries = (daySummaries) => writeStorage(STORAGE_KEYS.daySummaries, daySummaries || {});

// The backend may not persist fields it doesn't know about (e.g. estimatedSlots, goal,
// newer day-summary fields), so server copies are layered over the local record rather
// than replacing it outright.
const mergeServerRecord = (localRecord, serverRecord) => ({ ...(localRecord || {}), ...serverRecord });

const runInBackground = (promise) => {
  promise.catch(() => {
    // ignore background sync errors
  });
};

// Notifies subscribers when a background sync resolves with the server's
// authoritative copy of a task (e.g. server-computed fields like delayCount),
// since the optimistic local write returned by create/updateTask happens
// before that round-trip completes.
const taskSyncListeners = new Set();
const notifyTaskSynced = (task) => {
  if (!task) return;
  taskSyncListeners.forEach((listener) => listener(task));
};

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new APIError(
        `API request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
        response.status
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Handle network errors, CORS issues, etc.
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new APIError('Network error - Please check your connection and ensure the API server is running', 0);
    }
    
    throw new APIError(`Request failed: ${error.message}`, 0);
  }
};

export const taskAPI = {
  // Get all tasks
  async getAllTasks() {
    try {
      const tasks = await apiRequest('/api/tasks');
      const localById = new Map(getStoredTasks().map((task) => [String(task?._id), task]));
      const serverTasks = (Array.isArray(tasks) ? tasks : [])
        .map((task) => mergeServerRecord(localById.get(String(task?._id)), task));
      // Keep tasks created offline whose POST never reached the server.
      const unsyncedLocalTasks = [...localById.values()]
        .filter((task) => String(task?._id).startsWith('local-'));
      const normalized = [...serverTasks, ...unsyncedLocalTasks];
      setStoredTasks(normalized);
      return normalized;
    } catch {
      return getStoredTasks();
    }
  },

  // Get task by ID
  async getTaskById(id) {
    const tasks = getStoredTasks();
    const localTask = tasks.find((task) => String(task?._id) === String(id)) || null;

    runInBackground(
      apiRequest(`/api/tasks/${id}`).then((serverTask) => {
        if (!serverTask) return;
        const nextTasks = getStoredTasks();
        const index = nextTasks.findIndex((task) => String(task?._id) === String(id));
        const merged = mergeServerRecord(nextTasks[index], serverTask);
        if (index >= 0) {
          nextTasks[index] = merged;
        } else {
          nextTasks.push(merged);
        }
        setStoredTasks(nextTasks);
        notifyTaskSynced(merged);
      })
    );

    return localTask;
  },

  // Create new task
  async createTask(taskData) {
    const localTasks = getStoredTasks();
    const tempId = taskData?._id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const localTask = { createdAt: now, updatedAt: now, ...taskData, _id: tempId };
    setStoredTasks([...localTasks, localTask]);

    runInBackground(
      apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      }).then((createdTask) => {
        if (!createdTask) return;
        const current = getStoredTasks();
        const localCopy = current.find((task) => String(task?._id) === String(tempId)) || localTask;
        const merged = mergeServerRecord(localCopy, createdTask);
        const next = current.map((task) => (String(task?._id) === String(tempId) ? merged : task));
        setStoredTasks(next);
        notifyTaskSynced({ ...merged, tempId });
      })
    );

    return localTask;
  },

  // Update existing task
  async updateTask(id, updates) {
    const localTasks = getStoredTasks();
    const index = localTasks.findIndex((task) => String(task?._id) === String(id));
    const updatedAt = new Date().toISOString();
    const updatedLocalTask = index >= 0
      ? { ...localTasks[index], updatedAt, ...updates }
      : { _id: id, updatedAt, ...updates };

    if (index >= 0) {
      localTasks[index] = updatedLocalTask;
    } else {
      localTasks.push(updatedLocalTask);
    }
    setStoredTasks(localTasks);

    runInBackground(
      apiRequest(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }).then((serverTask) => {
        if (!serverTask) return;
        const current = getStoredTasks();
        const serverIndex = current.findIndex((task) => String(task?._id) === String(id));
        const merged = mergeServerRecord(current[serverIndex], serverTask);
        if (serverIndex >= 0) {
          current[serverIndex] = merged;
        } else {
          current.push(merged);
        }
        setStoredTasks(current);
        notifyTaskSynced(merged);
      })
    );

    return updatedLocalTask;
  },

  // Delete task
  async deleteTask(id) {
    const localTasks = getStoredTasks();
    setStoredTasks(localTasks.filter((task) => String(task?._id) !== String(id)));

    runInBackground(
      apiRequest(`/api/tasks/${id}`, {
        method: 'DELETE'
      })
    );

    return { success: true };
  },

  // Subscribe to server-authoritative task data arriving after a background sync
  // (e.g. server-computed fields like delayCount). Returns an unsubscribe function.
  subscribeToTaskSync(listener) {
    taskSyncListeners.add(listener);
    return () => taskSyncListeners.delete(listener);
  },

  // Get all day summaries (local-first data is already the full map, no network round-trip needed)
  async getAllDaySummaries() {
    return getStoredDaySummaries();
  },

  // Get day summary by date
  async getDaySummaryByDate(date) {
    const allSummaries = getStoredDaySummaries();
    const localSummary = allSummaries?.[date] ?? null;

    runInBackground(
      apiRequest(`/api/day-summaries/${date}`).then((serverSummary) => {
        if (!serverSummary) return;
        const current = getStoredDaySummaries();
        current[date] = mergeServerRecord(current[date], serverSummary);
        setStoredDaySummaries(current);
      })
    );

    return localSummary;
  },

  // Update day summary by date
  async updateDaySummaryByDate(date, daySummaryData) {
    const allSummaries = getStoredDaySummaries();
    const updatedLocalSummary = {
      ...(allSummaries[date] || {}),
      ...daySummaryData
    };
    allSummaries[date] = updatedLocalSummary;
    setStoredDaySummaries(allSummaries);

    runInBackground(
      apiRequest(`/api/day-summaries/${date}`, {
        method: 'PUT',
        body: JSON.stringify(daySummaryData)
      }).then((serverSummary) => {
        if (!serverSummary) return;
        const current = getStoredDaySummaries();
        current[date] = mergeServerRecord(current[date], serverSummary);
        setStoredDaySummaries(current);
      })
    );

    return updatedLocalSummary;
  },
};

// Export API utilities
export { APIError, apiRequest };
export default taskAPI;