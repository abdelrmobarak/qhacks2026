import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const BACKEND_URL = 'http://localhost:8000'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 1100,
    minHeight: 750,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: !is.dev,
      zoomFactor: 1.1
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // OAuth IPC: open Google consent in a modal BrowserWindow, intercept callback
  ipcMain.handle('auth:start-google', async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/google/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const { auth_url } = (await response.json()) as { auth_url: string }

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const authWindow = new BrowserWindow({
          width: 600,
          height: 700,
          parent: mainWindow!,
          modal: true,
          show: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        })

        let resolved = false
        const finish = async (url: string): Promise<void> => {
          if (resolved) return
          if (!url.includes('/auth/callback') || !url.includes('token=')) return

          resolved = true
          const parsed = new URL(url)
          const token = parsed.searchParams.get('token')

          if (token) {
            await session.defaultSession.cookies.set({
              url: BACKEND_URL,
              name: 'sandbox_session',
              value: token,
              path: '/',
              httpOnly: true
            })
          }

          authWindow.close()
          resolve({ success: true })
        }

        authWindow.webContents.on('will-redirect', (_event, url) => finish(url))
        authWindow.webContents.on('will-navigate', (_event, url) => finish(url))

        authWindow.on('closed', () => {
          if (!resolved) {
            resolved = true
            resolve({ success: false, error: 'Window closed' })
          }
        })

        authWindow.loadURL(auth_url)
      })
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })

  // Open URLs in system browser (for Stripe checkout etc.)
  ipcMain.handle('auth:open-external', async (_event, url: string) => {
    await shell.openExternal(url)
    return { success: true }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
