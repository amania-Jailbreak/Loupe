const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    resizeWindow: (height) => ipcRenderer.send("resize-window", height),
    hideWindow: () => ipcRenderer.send("hide-window"),
    search: (query) => ipcRenderer.send("search-query", query),
    onResults: (callback) =>
        ipcRenderer.on("search-results", (event, results) => callback(results)),
    executeResult: (item) => ipcRenderer.send("execute-result", item),
    getAliases: () => ipcRenderer.invoke("get-aliases"),
    saveAliases: (aliases) => ipcRenderer.invoke("save-aliases", aliases),
    onResetSearch: (callback) =>
        ipcRenderer.on("reset-search", () => callback()),
});
