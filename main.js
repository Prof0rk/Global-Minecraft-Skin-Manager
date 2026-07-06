const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

process.env.USER_DATA_PATH = app.getPath('userData');
require('./server.js');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 950,
    minHeight: 650,
    title: 'Global Minecraft Skin Manager',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#070913',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

ipcMain.handle('login-microsoft', async () => {
  return new Promise((resolve, reject) => {
    if (!mainWindow) {
      return reject(new Error('Main window not initialized'));
    }

    const authWindow = new BrowserWindow({
      width: 520,
      height: 680,
      parent: mainWindow,
      modal: true,
      show: true,
      title: 'Sign in to Microsoft',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const client_id = '00000000402b5328';
    const redirect_uri = 'https://login.live.com/oauth20_desktop.srf';
    const scopes = 'XboxLive.signin offline_access';
    
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}&prompt=select_account`;

    authWindow.loadURL(authUrl);

    let resolved = false;

    const checkRedirect = (url) => {
      if (url.startsWith(redirect_uri)) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (code) {
          resolved = true;
          resolve(code);
          authWindow.close();
        } else if (error) {
          resolved = true;
          reject(new Error(error));
          authWindow.close();
        }
      }
    };

    authWindow.webContents.on('will-navigate', (event, url) => {
      checkRedirect(url);
    });

    authWindow.webContents.on('will-redirect', (event, url) => {
      checkRedirect(url);
    });

    authWindow.on('closed', () => {
      if (!resolved) {
        reject(new Error('Login window closed by user.'));
      }
    });
  });
});

ipcMain.handle('is-electron', () => {
  return true;
});
