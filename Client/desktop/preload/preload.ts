/**
 * Preload (AD-13): exposes exactly the IgPlatformBridge allowlist as
 * window.igPlatform, and nothing else. The shell smoke test asserts the key set.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type IgPlatformBridge } from '../bridge';

function subscribe<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T));
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const bridge: IgPlatformBridge = {
  steam: {
    getAuthTicket: () => ipcRenderer.invoke(IPC.steamAuthTicket),
    cloud: {
      read: (name) => ipcRenderer.invoke(IPC.steamCloudRead, name),
      write: (name, bytes) => ipcRenderer.invoke(IPC.steamCloudWrite, name, bytes),
    },
    overlay: { openUrl: (url) => ipcRenderer.invoke(IPC.steamOverlayOpenUrl, url) },
    onOverlayActivated: (cb) => subscribe(IPC.steamOverlayActivated, cb),
    onMicroTxnAuthorization: (cb) => subscribe(IPC.steamMicroTxn, cb),
  },
  save: {
    read: () => ipcRenderer.invoke(IPC.saveRead),
    write: (bytes) => ipcRenderer.invoke(IPC.saveWrite, bytes),
  },
  app: {
    onSuspend: (cb) => subscribe(IPC.appSuspend, cb),
    onResume: (cb) => subscribe(IPC.appResume, cb),
    onBeforeQuit: (cb, timeoutMs) =>
      subscribe(IPC.appBeforeQuit, () => {
        const done = () => ipcRenderer.send(IPC.appQuitReady);
        Promise.race([Promise.resolve(cb()), new Promise((r) => setTimeout(r, timeoutMs))]).then(done, done);
      }),
  },
  log: { write: (entry) => ipcRenderer.send(IPC.logWrite, entry) },
};

contextBridge.exposeInMainWorld('igPlatform', bridge);
