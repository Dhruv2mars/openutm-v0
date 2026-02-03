import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc-handlers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

/**
 * Create main application window
 */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setTitle('OpenUTM (Electron)');

  const url = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, '../renderer/index.html')}`;
  mainWindow.loadURL(url);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

/**
 * Register all IPC handlers for backend communication
 */
const initializeBackend = () => {
  try {
    registerIpcHandlers();
    console.log('[Backend] IPC handlers registered');
  } catch (err) {
    console.error('[Backend] Failed to register IPC handlers:', err);
    throw err;
  }
};

/**
 * App lifecycle events
 */
app.on('ready', () => {
  initializeBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

export { mainWindow };
