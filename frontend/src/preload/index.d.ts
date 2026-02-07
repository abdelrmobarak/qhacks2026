import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomAPI {
  startGoogleAuth: () => Promise<{ success: boolean; error?: string }>
  openExternal: (url: string) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
