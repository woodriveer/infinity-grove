/**
 * Electron main process (AD-13): window, lifecycle, atomic save IO, Steam adapter.
 * The renderer is sandboxed (no Node), loaded from app:// with a strict CSP, and
 * reaches the platform only through the preload's igPlatform allowlist.
 */
import { app, BrowserWindow, ipcMain, net, powerMonitor, protocol, session } from 'electron';
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, writeSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { IPC } from '../bridge';
import { SteamAdapter, type SteamConfig } from './steam';

const isPackaged = app.isPackaged;
const projectRoot = resolve(__dirname, '..', '..');
const rendererRoot = join(isPackaged ? app.getAppPath() : projectRoot, 'dist');
const steamConfigPath = isPackaged ? join(process.resourcesPath, 'steam.json') : join(projectRoot, 'steam', 'steam.json');
const QUIT_TIMEOUT_MS = 3000;

// Overlay and background flags before 'ready' (AD-13, RFR-35).
SteamAdapter.enableOverlay();
app.commandLine.appendSwitch('in-process-gpu');
if (process.platform === 'win32') app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const CSP =
  "default-src 'self' app:; img-src 'self' app: data: blob:; media-src 'self' app: data: blob:; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self' app: data:; connect-src 'self' app: https: http://localhost:*; script-src 'self' app:";

const steam = new SteamAdapter();
let steamConfig: SteamConfig = { appId: 480, webApiIdentity: '' };
let win: BrowserWindow | null = null;
let quitting = false;

function userPath(...parts: string[]): string {
  return join(app.getPath('userData'), ...parts);
}

/** Atomic write: temp → fsync → rename (AD-12, NFR-2). */
function atomicWrite(file: string, bytes: Uint8Array): void {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}

function log(level: string, message: string): void {
  try {
    const file = userPath('logs', 'game.log');
    mkdirSync(join(file, '..'), { recursive: true });
    if (existsSync(file) && statSync(file).size > 2 * 1024 * 1024) renameSync(file, `${file}.1`);
    appendFileSync(file, `${new Date().toISOString()} ${level} ${message}\n`);
  } catch {
    /* logging never crashes the game */
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.steamAuthTicket, () => steam.getAuthTicketHex(steamConfig.webApiIdentity));
  ipcMain.handle(IPC.steamCloudRead, (_e, name: string) => steam.cloudRead(String(name)));
  ipcMain.handle(IPC.steamCloudWrite, (_e, name: string, bytes: Uint8Array) => steam.cloudWrite(String(name), new Uint8Array(bytes)));
  ipcMain.handle(IPC.steamOverlayOpenUrl, (_e, url: string) => {
    if (/^https:\/\//.test(String(url))) steam.openOverlayUrl(String(url));
  });
  ipcMain.handle(IPC.saveRead, () => {
    const file = userPath('save', 'save.bin');
    return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
  });
  ipcMain.handle(IPC.saveWrite, (_e, bytes: Uint8Array) => {
    atomicWrite(userPath('save', 'save.bin'), new Uint8Array(bytes));
    return true;
  });
  ipcMain.on(IPC.logWrite, (_e, entry: { level: string; message: string }) => log(String(entry?.level), String(entry?.message)));
}

function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = normalize(join(rendererRoot, relative));
    if (!file.startsWith(rendererRoot + sep)) return new Response('Forbidden', { status: 403 });
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    return new Response(response.body, { status: response.status, headers });
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#0E2A2A',
    title: 'Infinity Grove',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  // No navigation away from the game, no new windows.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void win.loadURL('app://game/index.html');
  steam.onMicroTxnAuthorization((r) => win?.webContents.send(IPC.steamMicroTxn, r));
}

app.whenReady().then(() => {
  try {
    steamConfig = { ...steamConfig, ...(JSON.parse(readFileSync(steamConfigPath, 'utf8')) as Partial<SteamConfig>) };
  } catch {
    log('warn', `steam config not found at ${steamConfigPath}; using defaults`);
  }
  steam.init(steamConfig);
  log('info', steam.status);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  registerAppProtocol();
  registerIpc();
  createWindow();
  powerMonitor.on('suspend', () => win?.webContents.send(IPC.appSuspend));
  powerMonitor.on('resume', () => win?.webContents.send(IPC.appResume));
});

// Give the renderer a bounded window to persist locally and to Steam Cloud (AD-20).
app.on('before-quit', (event) => {
  if (quitting || !win || win.isDestroyed()) return;
  event.preventDefault();
  quitting = true;
  const finish = () => {
    ipcMain.removeAllListeners(IPC.appQuitReady);
    app.quit();
  };
  const timer = setTimeout(finish, QUIT_TIMEOUT_MS);
  ipcMain.once(IPC.appQuitReady, () => {
    clearTimeout(timer);
    finish();
  });
  win.webContents.send(IPC.appBeforeQuit);
});

app.on('window-all-closed', () => app.quit());
