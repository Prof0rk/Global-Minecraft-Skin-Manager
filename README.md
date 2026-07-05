![Logo](github/logo.png)

# Global Minecraft Skin Manager

## What it is
A simple tool for Windows and Linux that lets premium Minecraft players manage and change their skins.

## How to build from source
Make sure you have Node.js and npm installed on your system.

1. Clone this repository and open the folder.
2. Install the required packages:
   ```bash
   npm install
   ```
3. Start the application in development mode:
   ```bash
   npm start
   ```
4. Build portable executables:
   - **Linux AppImage**: `npm run pack:linux`
   - **Windows Portable EXE**: `npm run pack:win`
   - **Both platforms**: `npm run pack:all`

![Screenshot](github/screenshot.png)
