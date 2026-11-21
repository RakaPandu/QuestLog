const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

process.on('uncaughtException', (err) => {
  fs.writeFileSync(path.join(__dirname, 'crash.log'), (err && err.stack) || String(err));
});

let mainWindow = null;
let serverProcess = null;
let isAppInitialized = false;

function checkServer(port, callback) {
  const req = http.get(`http://localhost:${port}/api/games`, (res) => {
    callback(true);
  });
  req.on('error', () => {
    callback(false);
  });
  req.setTimeout(500, () => {
    req.destroy();
    callback(false);
  });
}

function ensureServerRunning(callback) {
  checkServer(3001, (running) => {
    if (running) {
      callback();
      return;
    }

    const serverScript = path.join(__dirname, '../server.js');
    serverProcess = spawn('node', [serverScript], {
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore',
      windowsHide: true,
      shell: false
    });

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      checkServer(3001, (ready) => {
        if (ready || attempts > 30) {
          clearInterval(interval);
          callback();
        }
      });
    }, 200);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    frame: false, // Frameless native window - zero OS title bar
    backgroundColor: '#0c0e14',
    icon: path.join(__dirname, '../public/app.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true
    }
  });

  const loadApp = () => {
    mainWindow.loadURL('http://localhost:3001/').catch(() => {
      setTimeout(loadApp, 500);
    });
  };

  ensureServerRunning(() => {
    loadApp();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    isAppInitialized = true;
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  fs.writeFileSync(path.join(__dirname, 'boot.log'), 'app ready called at ' + new Date().toISOString() + '\n');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

app.on('window-all-closed', () => {
  if (isAppInitialized && process.platform !== 'darwin') {
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch (e) {}
    }
    app.quit();
  }
});
