# Electron App Setup Learnings

## Architecture
- Used Vite for renderer + esbuild for main/preload bundling
- electron-vite had config complexity issues; plain Vite + esbuild more straightforward
- Custom npm scripts (dev.mjs, build-main.mjs) manage separate build steps

## Key Files
- `src/main.ts` - Electron main process, creates BrowserWindow (1200x800)
- `src/preload.ts` - IPC context bridge (safe ipcRenderer exposure)
- `src/renderer/App.tsx` - React component rendering "Hello OpenUTM (Electron)"
- `src/renderer/main.tsx` - React entry point via ReactDOM.createRoot
- `index.html` - HTML entry point loading React app

## Build Process
1. Vite builds renderer (React + assets) → `dist/renderer/`
2. esbuild bundles main.ts → `dist/main.js`
3. esbuild bundles preload.ts → `dist/preload.js`

## Dev Setup
- Dev script spawns Vite dev server + Electron process + TypeScript watcher
- TypeScript strict mode enabled (noUnusedLocals, noUnusedParameters)
- Unused imports removed (Menu from electron, React from App.tsx)

## Window Config
- Title: "OpenUTM (Electron)" (set in main.ts)
- Size: 1200x800
- Context isolation enabled for security
- Preload script isolated via contextBridge
