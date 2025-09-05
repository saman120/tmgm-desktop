// public/preload.js - Preload script for secure IPC communication
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Notification methods
    showNotification: (options) => ipcRenderer.invoke('show-notification', options),
    
    // Window management
    focusWindow: () => ipcRenderer.invoke('focus-window'),
    hideWindow: () => ipcRenderer.invoke('hide-window'),
    
    // App methods
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    
    // Event listeners for main process communications
    onCompleteCurrentTask: (callback) => {
        const wrappedCallback = () => callback();
        ipcRenderer.on('complete-current-task', wrappedCallback);
        return () => ipcRenderer.removeListener('complete-current-task', wrappedCallback);
    },
    
    onCheckInProgressTask: (callback) => {
        const wrappedCallback = () => callback();
        ipcRenderer.on('check-in-progress-task', wrappedCallback);
        return () => ipcRenderer.removeListener('check-in-progress-task', wrappedCallback);
    },
    
    onNotificationClicked: (callback) => {
        const wrappedCallback = () => callback();
        ipcRenderer.on('notification-clicked', wrappedCallback);
        return () => ipcRenderer.removeListener('notification-clicked', wrappedCallback);
    },
    
    onTriggerAddTask: (callback) => {
        const wrappedCallback = () => callback();
        ipcRenderer.on('trigger-add-task', wrappedCallback);
        return () => ipcRenderer.removeListener('trigger-add-task', wrappedCallback);
    },
    
    // Platform detection
    platform: process.platform,
    
    // Remove all listeners (cleanup)
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});