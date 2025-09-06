// public/electron.js - Electron Main Process for React App
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const isDev = process.env.ELECTRON_IS_DEV === 'true';

let mainWindow;
let tray;
let notificationTimer;

// Create the main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 600,
        minHeight: 500,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        show: false,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        transparent: false
    });

    // Load the React app
    const startUrl = isDev 
        ? 'http://localhost:3000' 
        : `file://${path.join(__dirname, '../build/index.html')}`;
    
    mainWindow.loadURL(startUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.once('ready-to-show', () => {
        console.log("ready to show");
        mainWindow.show();
        
        // Setup notification timer after window is ready
        console.log("notification timer: call");
        setupNotificationTimer();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (notificationTimer) {
            clearInterval(notificationTimer);
        }
    });

    // Hide to tray instead of closing on macOS
    mainWindow.on('close', (event) => {
        if (process.platform === 'darwin' && !app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle navigation
    mainWindow.webContents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        require('electron').shell.openExternal(navigationUrl);
    });
}

// Create system tray
function createTray() {
    // Create tray icon
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    let icon;
    
    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            throw new Error('Icon not found');
        }
    } catch (error) {
        // Fallback: create a simple colored rectangle
        icon = nativeImage.createFromNamedImage('NSStatusNone');
    }
    
    icon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show TMGM',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isVisible()) {
                        mainWindow.focus();
                    } else {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit TMGM',
            accelerator: 'Cmd+Q',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('Task Manager - Click to open');

    tray.on('right-click', () => {
        tray.popUpContextMenu();
    });
}

// Setup notification timer (5 minutes = 300000ms)
function setupNotificationTimer() {
    // Clear existing timer
    if (notificationTimer) {
        console.log("notification timer: cleared");
        clearInterval(notificationTimer);
    }
    
    setTimeout(()=>{
        notificationTimer = setInterval(() => {
            console.log("notification timer: execution");
            if (mainWindow && !mainWindow.isDestroyed()) {
                console.log("notification timer: execution 2");
                mainWindow.webContents.send('check-in-progress-task');
            }
        }, 300000); // 5 minutes
    }, (5 - (new Date(new Date().setMinutes(new Date().getMinutes()+5)).getMinutes() % 5)) * 60000)
}

// IPC handlers
ipcMain.handle('show-notification', async (event, { title, body, silent = false }) => {
    if (Notification.isSupported()) {
        console.log('notification: supported');
        const notification = new Notification({
            title,
            body,
            silent,
            urgency: 'normal',
            timeoutType: 'default'
        });

        notification.on('click', () => {
            if (mainWindow) {
                mainWindow.webContents.send('notification-clicked');
                if (!mainWindow.isVisible()) {
                    mainWindow.show();
                }
                mainWindow.focus();
            }
        });

        notification.on('close', () => {
            // Handle notification close if needed
        });

        console.log('notification: showed');
        notification.show();
        return true;
    }
    console.log('notification: (not) supported');
    return false;
});

ipcMain.handle('focus-window', async () => {
    if (mainWindow) {
        if (!mainWindow.isVisible()) {
            mainWindow.show();
        }
        mainWindow.focus();
    }
});

ipcMain.handle('hide-window', async () => {
    if (mainWindow && mainWindow.isVisible()) {
        mainWindow.hide();
    }
});

ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

ipcMain.handle('quit-app', async () => {
    app.isQuitting = true;
    app.quit();
});

// App event handlers
app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Create application menu for macOS
    if (process.platform === 'darwin') {
        const template = [
            {
                label: app.getName(),
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services', submenu: [] },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectall' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
    if (notificationTimer) {
        clearInterval(notificationTimer);
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (navigationEvent, navigationUrl) => {
        navigationEvent.preventDefault();
        require('electron').shell.openExternal(navigationUrl);
    });
});

// macOS dock menu
if (process.platform === 'darwin') {
    app.whenReady().then(() => {
        const dockMenu = Menu.buildFromTemplate([
            {
                label: 'Show Task Manager',
                click() {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: 'New Task',
                click() {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                        mainWindow.webContents.send('trigger-add-task');
                    }
                }
            }
        ]);
        app.dock.setMenu(dockMenu);
    });
}