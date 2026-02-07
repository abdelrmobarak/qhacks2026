import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
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
      const response = await fetch('http://localhost:8000/auth/google/start', {
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

        authWindow.webContents.on('will-redirect', (_event, url) => {
          if (url.includes('/auth/google/callback')) {
            // Let the backend handle the callback to set the cookie, then close
            authWindow.webContents.on('did-finish-load', () => {
              // Extract cookies from the auth window and relay to main window
              authWindow.webContents.session.cookies
                .get({ url: 'http://localhost:8000' })
                .then((cookies) => {
                  const sessionCookie = cookies.find((c) => c.name === 'sandbox_session')
                  if (sessionCookie && mainWindow) {
                    mainWindow.webContents.session.cookies.set({
                      url: 'http://localhost:8000',
                      name: sessionCookie.name,
                      value: sessionCookie.value,
                      path: sessionCookie.path || '/',
                      httpOnly: sessionCookie.httpOnly,
                      secure: sessionCookie.secure
                    })
                  }
                })
                .finally(() => {
                  authWindow.close()
                  resolve({ success: true })
                })
            })
          }
        })

        // Also handle navigation for non-redirect flows
        authWindow.webContents.on('will-navigate', (_event, url) => {
          if (url.includes('/auth/google/callback')) {
            authWindow.webContents.on('did-finish-load', () => {
              authWindow.webContents.session.cookies
                .get({ url: 'http://localhost:8000' })
                .then((cookies) => {
                  const sessionCookie = cookies.find((c) => c.name === 'sandbox_session')
                  if (sessionCookie && mainWindow) {
                    mainWindow.webContents.session.cookies.set({
                      url: 'http://localhost:8000',
                      name: sessionCookie.name,
                      value: sessionCookie.value,
                      path: sessionCookie.path || '/',
                      httpOnly: sessionCookie.httpOnly,
                      secure: sessionCookie.secure
                    })
                  }
                })
                .finally(() => {
                  authWindow.close()
                  resolve({ success: true })
                })
            })
          }
        })

        authWindow.on('closed', () => {
          resolve({ success: false, error: 'Window closed' })
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
