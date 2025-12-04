const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class PluginManager {
    constructor() {
        this.plugins = [];
        if (app.isPackaged) {
            // If running as AppImage, look next to the AppImage file
            if (process.env.APPIMAGE) {
                this.pluginsDir = path.join(
                    path.dirname(process.env.APPIMAGE),
                    "plugins"
                );
            } else {
                // Otherwise look next to the executable
                this.pluginsDir = path.join(
                    path.dirname(process.execPath),
                    "plugins"
                );
            }
        } else {
            this.pluginsDir = path.join(__dirname, "plugins");
        }

        this.configPath = path.join(
            path.dirname(this.pluginsDir),
            "plugins.json"
        );
        this.disabledPlugins = new Set();
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(
                    fs.readFileSync(this.configPath, "utf8")
                );
                if (config.disabledPlugins) {
                    this.disabledPlugins = new Set(config.disabledPlugins);
                }
            }
        } catch (e) {
            console.error("Failed to load plugin config:", e);
        }
    }

    saveConfig() {
        try {
            const config = {
                disabledPlugins: Array.from(this.disabledPlugins),
            };
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4));
        } catch (e) {
            console.error("Failed to save plugin config:", e);
        }
    }

    async syncPlugins() {
        const REPO_API_URL =
            "https://api.github.com/repos/amania-Jailbreak/Loupe/contents/plugins";
        console.log("Checking for plugin updates from GitHub...");

        try {
            const response = await fetch(REPO_API_URL);
            if (!response.ok) {
                console.warn(
                    `Failed to fetch plugin list: ${response.statusText}`
                );
                return;
            }

            const files = await response.json();

            if (!fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
            }

            for (const file of files) {
                if (file.name.endsWith(".js") && file.type === "file") {
                    try {
                        const fileRes = await fetch(file.download_url);
                        if (fileRes.ok) {
                            const content = await fileRes.text();
                            fs.writeFileSync(
                                path.join(this.pluginsDir, file.name),
                                content
                            );
                            console.log(`Synced plugin: ${file.name}`);
                        }
                    } catch (err) {
                        console.error(`Failed to download ${file.name}:`, err);
                    }
                }
            }
        } catch (error) {
            console.error("Plugin sync error (offline?):", error.message);
        }
    }

    loadPlugins() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir);
        }

        const files = fs.readdirSync(this.pluginsDir);

        this.plugins = [];
        files.forEach((file) => {
            if (file.endsWith(".js")) {
                try {
                    const pluginPath = path.join(this.pluginsDir, file);
                    // Clear cache to allow hot reloading if needed
                    delete require.cache[require.resolve(pluginPath)];
                    const plugin = require(pluginPath);
                    if (plugin.search && plugin.execute) {
                        this.plugins.push({
                            name: file.replace(".js", ""),
                            module: plugin,
                        });
                        console.log(`Loaded plugin: ${file}`);
                    }
                } catch (err) {
                    console.error(`Failed to load plugin ${file}:`, err);
                }
            }
        });
    }

    async search(query) {
        let allResults = [];

        // System Commands
        if (query === "Loupe-Plugin:Sync") {
            return [
                {
                    title: "Sync Plugins",
                    description: "Download latest plugins from GitHub",
                    icon: "🔄",
                    action: "system-sync",
                    plugin: "system",
                },
            ];
        }

        const promises = this.plugins.map(async (plugin) => {
            const prefix = plugin.module.prefix;
            const isEnabled = !this.disabledPlugins.has(plugin.name);

            // Check for toggle commands
            if (prefix) {
                const disableCmd = `${prefix} disable`;
                const enableCmd = `${prefix} enable`;

                if (isEnabled && disableCmd.startsWith(query)) {
                    return [
                        {
                            title: `Disable ${plugin.name}`,
                            description: `Action: ${disableCmd}`,
                            suggestion: disableCmd,
                            icon: "🚫",
                            action: "system-disable",
                            value: plugin.name,
                            plugin: "system",
                        },
                    ];
                }
                if (!isEnabled && enableCmd.startsWith(query)) {
                    return [
                        {
                            title: `Enable ${plugin.name}`,
                            description: `Action: ${enableCmd}`,
                            suggestion: enableCmd,
                            icon: "✅",
                            action: "system-enable",
                            value: plugin.name,
                            plugin: "system",
                        },
                    ];
                }
            }

            if (!isEnabled) return [];

            try {
                const results = await plugin.module.search(query);
                // Add plugin name to results for identification if needed
                return results.map((r) => ({ ...r, plugin: plugin.name }));
            } catch (err) {
                console.error(`Error in plugin ${plugin.name}:`, err);
                return [];
            }
        });

        const resultsArray = await Promise.all(promises);
        resultsArray.forEach((results) => {
            allResults = allResults.concat(results);
        });

        return allResults;
    }

    execute(item) {
        if (item.plugin === "system") {
            if (item.action === "system-sync") {
                this.syncPlugins().then(() => {
                    this.loadPlugins();
                    console.log("Plugins synced and reloaded");
                });
                return;
            }
            if (item.action === "system-toggle") {
                if (this.disabledPlugins.has(item.value)) {
                    this.disabledPlugins.delete(item.value);
                } else {
                    this.disabledPlugins.add(item.value);
                }
                this.saveConfig();
                return;
            }
            if (item.action === "system-disable") {
                this.disabledPlugins.add(item.value);
                this.saveConfig();
                return;
            }
            if (item.action === "system-enable") {
                this.disabledPlugins.delete(item.value);
                this.saveConfig();
                return;
            }
        }

        const plugin = this.plugins.find((p) => p.name === item.plugin);
        if (plugin) {
            try {
                plugin.module.execute(item);
            } catch (err) {
                console.error(
                    `Error executing item in plugin ${plugin.name}:`,
                    err
                );
            }
        }
    }

    reloadAliases() {
        this.plugins.forEach((plugin) => {
            if (plugin.module.reloadAliases) {
                try {
                    plugin.module.reloadAliases();
                } catch (err) {
                    console.error(
                        `Error reloading aliases in plugin ${plugin.name}:`,
                        err
                    );
                }
            }
        });
    }
}

module.exports = new PluginManager();
