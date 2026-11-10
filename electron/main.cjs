// Desktop shell: opens the built web app (dist/) in its own window.
// The app itself is unchanged; the same build also runs in a browser.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

// Set WOOLDOODLE_DEV_URL (e.g. http://127.0.0.1:5173) to point the window at the Vite dev server.
const DEV_URL = process.env.WOOLDOODLE_DEV_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 520,
    title: 'WoolDoodle',
    backgroundColor: '#f4efe6',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      // The page is plain web code: no Node access, isolated from this process.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Never open other sites inside the app window; hand links to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      if (/^https?:/i.test(url) && !DEV_URL) shell.openExternal(url);
    }
  });
}

const menu = Menu.buildFromTemplate([
  {
    label: 'Вид',
    submenu: [
      { role: 'reload', label: 'Перезагрузить' },
      { role: 'togglefullscreen', label: 'Во весь экран' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Обычный размер' },
      { role: 'zoomIn', label: 'Крупнее' },
      { role: 'zoomOut', label: 'Мельче' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Инструменты разработчика' },
    ],
  },
  { label: 'Окно', submenu: [{ role: 'minimize', label: 'Свернуть' }, { role: 'close', label: 'Закрыть' }] },
]);

// One running copy: a second launch focuses the existing window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(menu);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
