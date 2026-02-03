const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    //mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('scan-directory', async (event, dirPath) => {
  const results = [];

  async function scanDir(currentPath, relativePath) {
    if (!relativePath) relativePath = '';

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    const yamlFile = entries.find(e =>
      e.isFile() && (e.name === 'kustomization.yaml' || e.name === 'kustomization.yml')
    );

    if (yamlFile) {
      const content = await fs.readFile(
        path.join(currentPath, yamlFile.name),
        'utf-8'
      );
      results.push({
        path: relativePath || '.',
        content: content
      });
    }

    for (const entry of entries) {
      if (entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules') {
        const newRelPath = relativePath
          ? relativePath + '/' + entry.name
          : entry.name;
        await scanDir(path.join(currentPath, entry.name), newRelPath);
      }
    }
  }

  await scanDir(dirPath, '');
  return results;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
