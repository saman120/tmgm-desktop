// src/services/api.js - API service for task management
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3840';

const STORAGE_KEYS = {
  tasks: 'tmgm_tasks',
  daySummaries: 'tmgm_day_summaries'
};

// localStorage is parsed once and kept in memory; writes update the in-memory copy
// immediately and are serialised to disk on a short debounce (and flushed when the
// window hides/unloads), so a click never pays for JSON-encoding thousands of tasks.
const storageCache = new Map();
const dirtyKeys = new Set();
let flushTimer = null;
const FLUSH_DELAY_MS = 250;

const readStorage = (key, fallback) => {
  if (storageCache.has(key)) return storageCache.get(key);
  let value = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = JSON.parse(raw) ?? fallback;
  } catch {
    value = fallback;
  }
  storageCache.set(key, value);
  return value;
};

const flushStorage = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  dirtyKeys.forEach((key) => {
    try {
      localStorage.setItem(key, JSON.stringify(storageCache.get(key)));
    } catch {
      // ignore storage write errors
    }
  });
  dirtyKeys.clear();
};

const writeStorage = (key, value) => {
  storageCache.set(key, value);
  dirtyKeys.add(key);
  if (!flushTimer) flushTimer = setTimeout(flushStorage, FLUSH_DELAY_MS);
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushStorage);
  window.addEventListener('pagehide', flushStorage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStorage();
  });
}

// Callers mutate what they read before writing it back, so hand out shallow copies
// to keep the cached value (and anything React holds) from changing underneath.
const getStoredTasks = () => [...readStorage(STORAGE_KEYS.tasks, [])];
const setStoredTasks = (tasks) => writeStorage(STORAGE_KEYS.tasks, Array.isArray(tasks) ? tasks : []);

const getStoredDaySummaries = () => ({ ...readStorage(STORAGE_KEYS.daySummaries, {}) });
const setStoredDaySummaries = (daySummaries) => writeStorage(STORAGE_KEYS.daySummaries, daySummaries || {});

// Local edits made while a full server refresh is in flight must win over the
// (older) server snapshot when it lands.
const locallyTouchedAt = new Map();
const locallyDeleted = new Set();
const markTouched = (id) => locallyTouchedAt.set(String(id), Date.now());

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
const tasksRefreshedListeners = new Set();
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
  // Get all tasks. Local-first: resolves immediately from storage when there is any,
  // and reconciles with the server in the background (subscribeToTasksRefreshed).
  // Only waits on the network on a first run with nothing stored.
  async getAllTasks() {
    const localTasks = getStoredTasks();
    const refresh = this.refreshFromServer();
    if (localTasks.length > 0) {
      runInBackground(refresh);
      return localTasks;
    }
    try {
      return (await refresh) ?? getStoredTasks();
    } catch {
      return getStoredTasks();
    }
  },

  async refreshFromServer() {
    const startedAt = Date.now();
    const tasks = await apiRequest('/api/tasks');
    if (!Array.isArray(tasks)) return null;

    const localById = new Map(getStoredTasks().map((task) => [String(task?._id), task]));
    const editedSinceStart = (id) => (locallyTouchedAt.get(id) || 0) >= startedAt;

    const serverIds = new Set();
    const serverTasks = [];
    tasks.forEach((task) => {
      const id = String(task?._id);
      serverIds.add(id);
      if (locallyDeleted.has(id)) return;
      const local = localById.get(id);
      serverTasks.push(local && editedSinceStart(id) ? local : mergeServerRecord(local, task));
    });
    // Keep tasks created offline whose POST never reached the server, and anything
    // created locally while this request was in flight.
    const localOnly = [...localById.values()].filter((task) => {
      const id = String(task?._id);
      return !serverIds.has(id) && (id.startsWith('local-') || editedSinceStart(id));
    });

    const normalized = [...serverTasks, ...localOnly];
    setStoredTasks(normalized);
    tasksRefreshedListeners.forEach((listener) => listener(normalized));
    return normalized;
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
    markTouched(tempId);

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
    markTouched(id);

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
    locallyDeleted.add(String(id));

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

  // Subscribe to the full task list arriving from a background server refresh.
  subscribeToTasksRefreshed(listener) {
    tasksRefreshedListeners.add(listener);
    return () => tasksRefreshedListeners.delete(listener);
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