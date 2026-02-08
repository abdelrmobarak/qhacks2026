import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  startGoogleAuth: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('auth:start-google'),
  openExternal: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('auth:open-external', url),
  onAuthCompleted: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('auth:completed', listener)
    return () => ipcRenderer.removeListener('auth:completed', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
