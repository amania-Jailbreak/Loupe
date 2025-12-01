const fs = require("fs");
const path = require("path");

class PluginManager {
    constructor() {
        this.plugins = [];
        this.pluginsDir = path.join(__dirname, "plugins");
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

        const promises = this.plugins.map(async (plugin) => {
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
