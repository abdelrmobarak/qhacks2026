import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomAPI {
  startGoogleAuth: () => Promise<{ success: boolean; error?: string }>
  openExternal: (url: string) => Promise<{ success: boolean }>
  onAuthCompleted: (callback: () => void) => () => void
  showNotification: (title: string, body: string) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
