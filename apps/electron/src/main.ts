import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerIpcHandlers } from '../electron-src/ipc-handlers';
import { resolveAssetBasePath } from './asset-path';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  const appPath = app.getAppPath();
  const assetBase = resolveAssetBasePath(appPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(assetBase, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setTitle('OpenUTM (Electron)');

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(assetBase, 'renderer', 'index.html'));
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  try {
    registerIpcHandlers();
  } catch (error) {
    console.error('Failed to register Electron IPC handlers', error);
  }

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
