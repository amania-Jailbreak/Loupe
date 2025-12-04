const {
    app,
    BrowserWindow,
    globalShortcut,
    ipcMain,
    screen,
} = require("electron");

// Disable sandbox to avoid issues with AppImage on some Linux distros
// This must be done before any other modules are loaded or app events are handled

const path = require("path");
const fs = require("fs");
const pluginManager = require("./pluginManager");

let mainWindow;
const ALIASES_PATH = path.join(__dirname, "aliases.json");

function createWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 800,
        height: 60, // Start with just the input bar
        x: Math.floor(width / 2 - 400),
        y: 200,
        frame: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        show: true,
        icon: path.join(__dirname, "images/Loupe.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadFile("index.html");

    // Hide window when it loses focus
    mainWindow.on("blur", () => {
        // Don't hide if devtools is opened (optional, for debugging)
        if (!mainWindow.webContents.isDevToolsOpened()) {
            app.quit();
        }
    });
}

app.whenReady().then(async () => {
    // Only sync if plugins dir doesn't exist or is empty
    const pluginsDir = pluginManager.pluginsDir;
    if (!fs.existsSync(pluginsDir) || fs.readdirSync(pluginsDir).length === 0) {
        await pluginManager.syncPlugins();
    }

    pluginManager.loadPlugins();
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// IPC handlers
ipcMain.on("resize-window", (event, height) => {
    if (mainWindow) {
        const [width] = mainWindow.getSize();
        mainWindow.setSize(width, height);
    }
});

ipcMain.on("hide-window", () => {
    app.quit();
});

ipcMain.on("search-query", async (event, query) => {
    const results = await pluginManager.search(query);
    event.reply("search-results", results);
});

ipcMain.on("execute-result", (event, item) => {
    pluginManager.execute(item);
});

// Alias Management
ipcMain.handle("get-aliases", () => {
    try {
        if (fs.existsSync(ALIASES_PATH)) {
            return JSON.parse(fs.readFileSync(ALIASES_PATH, "utf8"));
        }
    } catch (e) {
        console.error("Failed to read aliases:", e);
    }
    return {};
});

ipcMain.handle("save-aliases", (event, aliases) => {
    try {
        fs.writeFileSync(ALIASES_PATH, JSON.stringify(aliases, null, 4));
        pluginManager.reloadAliases(); // Notify plugins
        return true;
    } catch (e) {
        console.error("Failed to save aliases:", e);
        return false;
    }
});
