const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const robot = require('robotjs');
const AutoLaunch = require('auto-launch');
const fs = require('fs');
const log = require('electron-log');

let liveStore;
let tray = null;
let mainWindow;
let lastClipboardContent = null;

const defaultStore = {
  theme: 'dark',
  exitKey: 'Escape',
  launchOnStartup: true,
  activeGroup: 'Default',
  clipboardStore: { 
    'Default': [], 
    'Work': [], 
    'Code Snippets': [] 
  }
};

const saveDataPath = path.join(app.getPath('documents'), 'rival_app_data.json');

function showAppWindow() {
  if (process.platform === 'win32') {
    mainWindow.setFocusable(true);
  }
  mainWindow.show();
  mainWindow.focus();
}

function hideAppWindow() {
  if (process.platform === 'win32') {
    mainWindow.setFocusable(false);
  }
  mainWindow.hide();
}

function loadData() {
    try {
        if (fs.existsSync(saveDataPath)) {
            const rawData = fs.readFileSync(saveDataPath);
            liveStore = { ...defaultStore, ...JSON.parse(rawData) };
        } else {
            liveStore = defaultStore;
            fs.writeFileSync(saveDataPath, JSON.stringify(liveStore, null, 2));
        }
    } catch (error) {
        log.error('Failed to load data, using defaults.', error);
        liveStore = defaultStore;
    }
}

function saveData() {
    try {
        fs.writeFileSync(saveDataPath, JSON.stringify(liveStore, null, 2));
        log.info('Data saved successfully to:', saveDataPath);
    } catch (error) {
        log.error('Failed to save data!', error);
    }
}

const appLauncher = new AutoLaunch({
    name: 'Rival App',
    path: app.getPath('exe'),
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 550,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--squirrel-firstrun')) {
    showAppWindow();
  }

  mainWindow.on('blur', () => {
    if (!mainWindow.webContents.isDevToolsFocused()) {
      hideAppWindow();
    }
  });
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.ico'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Rival', click: () => { sendUpdatedGroups(); showAppWindow(); } },
        { type: 'separator' },
        { label: 'Quit Rival', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('Rival');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { sendUpdatedGroups(); showAppWindow(); });
}

function sendUpdatedGroups(event) {
    const data = { groups: Object.keys(liveStore.clipboardStore), activeGroup: liveStore.activeGroup };
    const target = event ? event.sender : mainWindow.webContents;
    target.send('show-groups', data);
}

function registerMainHotkey() {
  const hotkey = 'CommandOrControl+Shift+V';
  globalShortcut.unregisterAll();
  const success = globalShortcut.register(hotkey, () => { sendUpdatedGroups(); showAppWindow(); });
  if (!success) { log.error(`🔴 FAILED to register hotkey: "${hotkey}".`); } 
  else { log.info(`✅ Successfully registered hotkey: "${hotkey}"`); }
}

function checkClipboard() {
    const activeGroup = liveStore.activeGroup;
    const groupList = liveStore.clipboardStore[activeGroup];
    if (!groupList) return;

    const availableFormats = clipboard.availableFormats();
    let newItem = null;

    try {
        if (availableFormats.some(f => f.startsWith('image/'))) {
            const image = clipboard.readImage();
            if (!image.isEmpty()) {
                const content = image.toDataURL();
                if (content !== lastClipboardContent) {
                    newItem = { type: 'image', content };
                    lastClipboardContent = content;
                }
            }
        } else if (availableFormats.includes('text/html')) {
            const content = clipboard.readHTML();
            if (content && content !== lastClipboardContent) {
                newItem = { type: 'html', content };
                lastClipboardContent = content;
            }
        } else {
            const content = clipboard.readText();
            if (content && content !== lastClipboardContent) {
                newItem = { type: 'text', content };
                lastClipboardContent = content;
            }
        }
    } catch (error) {
        log.error('Error reading clipboard:', error);
        return;
    }

    if (!newItem) return;

    const existingIndex = groupList.findIndex(item => item.content === newItem.content);
    if (existingIndex > -1) {
        groupList.splice(existingIndex, 1);
    }
    
    groupList.unshift(newItem);
    if (groupList.length > 20) {
        groupList.pop();
    }
}

app.whenReady().then(() => {
  try {
    loadData();
    createWindow();
    createTray();
    registerMainHotkey();
    setInterval(checkClipboard, 500);
    if (liveStore.launchOnStartup) { appLauncher.enable(); } 
    else { appLauncher.disable(); }
  } catch (e) {
    log.error("🔴 APPLICATION STARTUP ERROR:", e);
  }
});

ipcMain.on('request-groups-view', (event) => sendUpdatedGroups(event));
ipcMain.on('get-group-items', (event, groupName) => { liveStore.activeGroup = groupName; mainWindow.webContents.send('show-items', liveStore.clipboardStore[groupName] || []); });
ipcMain.on('get-settings', (event) => { event.returnValue = { theme: liveStore.theme, exitKey: liveStore.exitKey, launchOnStartup: liveStore.launchOnStartup }; });
ipcMain.on('save-settings', (event, settings) => {
    liveStore.theme = settings.theme;
    liveStore.exitKey = settings.exitKey;
    liveStore.launchOnStartup = settings.launchOnStartup;
    if (liveStore.launchOnStartup) { appLauncher.enable(); } 
    else { appLauncher.disable(); }
});
ipcMain.on('reset-settings', (event) => { 
    liveStore.theme = defaultStore.theme;
    liveStore.exitKey = defaultStore.exitKey;
    liveStore.launchOnStartup = defaultStore.launchOnStartup;
    sendUpdatedGroups(event);
});
ipcMain.on('hide-window', () => { if (mainWindow) { hideAppWindow(); } });
ipcMain.on('quit-app', () => { app.isQuitting = true; app.quit(); });
ipcMain.on('paste-item', (event, item) => {
    if (!item || !item.type) return;
    switch (item.type) {
        case 'text':
            clipboard.writeText(item.content);
            break;
        case 'html':
            clipboard.write({ html: item.content, text: item.content.replace(/<[^>]*>?/gm, '') });
            break;
        case 'image':
            clipboard.writeImage(nativeImage.createFromDataURL(item.content));
            break;
    }
    hideAppWindow();
    setTimeout(() => {
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
    }, 100);
});
ipcMain.on('delete-item', (event, { groupName, itemToDelete }) => {
    const groupList = liveStore.clipboardStore[groupName];
    if (groupList) {
        const itemIndex = groupList.findIndex(i => i.content === itemToDelete.content && i.type === itemToDelete.type);
        if (itemIndex > -1) {
            groupList.splice(itemIndex, 1);
        }
    }
    mainWindow.webContents.send('show-items', groupList || []);
});
ipcMain.on('add-group', (event, groupName) => { if (groupName && !liveStore.clipboardStore[groupName]) { liveStore.clipboardStore[groupName] = []; sendUpdatedGroups(event); } });
ipcMain.on('delete-group', (event, groupName) => { if (groupName !== 'Default' && liveStore.clipboardStore[groupName]) { delete liveStore.clipboardStore[groupName]; if (liveStore.activeGroup === groupName) { liveStore.activeGroup = 'Default'; } sendUpdatedGroups(event); } });
ipcMain.on('edit-group-name', (event, { oldName, newName }) => { if (oldName !== 'Default' && newName && !liveStore.clipboardStore[newName]) { liveStore.clipboardStore[newName] = liveStore.clipboardStore[oldName]; delete liveStore.clipboardStore[oldName]; if (liveStore.activeGroup === oldName) { liveStore.activeGroup = newName; } sendUpdatedGroups(event); } });

app.on('before-quit', () => { saveData(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });