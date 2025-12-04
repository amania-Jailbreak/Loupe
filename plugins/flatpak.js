const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

let flatpakCache = [];
let lastCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes

// Common Flatpak icon locations
const FLATPAK_ICON_BASE = [
    "/var/lib/flatpak/exports/share/icons",
    process.env.HOME + "/.local/share/flatpak/exports/share/icons",
];

function findFlatpakIcon(appId) {
    // Try to find icon in standard paths
    // Structure is usually .../icons/hicolor/<size>/apps/<appId>.png
    const sizes = ["128x128", "64x64", "48x48", "scalable"];
    const extensions = [".png", ".svg"];

    for (const baseDir of FLATPAK_ICON_BASE) {
        if (!fs.existsSync(baseDir)) continue;

        // Check hicolor theme structure
        const hicolorDir = path.join(baseDir, "hicolor");
        if (fs.existsSync(hicolorDir)) {
            for (const size of sizes) {
                for (const ext of extensions) {
                    const iconPath = path.join(
                        hicolorDir,
                        size,
                        "apps",
                        appId + ext
                    );
                    if (fs.existsSync(iconPath)) {
                        return iconPath;
                    }
                }
            }
        }
    }
    return "📦";
}

function loadFlatpaks() {
    return new Promise((resolve) => {
        const now = Date.now();
        if (flatpakCache.length > 0 && now - lastCacheTime < CACHE_TTL) {
            resolve(flatpakCache);
            return;
        }

        exec(
            "flatpak list --app --columns=name,application,description",
            (error, stdout) => {
                if (error) {
                    console.error("Error listing flatpaks:", error);
                    resolve([]);
                    return;
                }

                const lines = stdout.split("\n");
                const apps = [];

                lines.forEach((line) => {
                    if (!line.trim()) return;
                    // Simple tab/space splitting might be fragile, but flatpak output is usually tab separated with --columns
                    const parts = line.split("\t");
                    if (parts.length >= 2) {
                        const appId = parts[1].trim();
                        apps.push({
                            title: parts[0].trim(),
                            description: `Flatpak: ${parts[2] || ""}`,
                            icon: findFlatpakIcon(appId),
                            action: "run-flatpak",
                            value: appId, // Application ID
                        });
                    }
                });

                flatpakCache = apps;
                lastCacheTime = now;
                resolve(apps);
            }
        );
    });
}

// Load aliases
let aliases = {};
function loadAliases() {
    try {
        const aliasPath = path.join(__dirname, "../aliases.json");
        if (fs.existsSync(aliasPath)) {
            aliases = JSON.parse(fs.readFileSync(aliasPath, "utf8"));
        }
    } catch (e) {
        console.error("Failed to load aliases:", e);
    }
}
loadAliases();

module.exports = {
    prefix: "flatpak",
    search: async (query) => {
        if (!query) return [];

        const apps = await loadFlatpaks();
        const q = query.toLowerCase();

        // Find all alias targets where the alias key starts with the query
        const matchedAliasTargets = Object.keys(aliases)
            .filter((aliasKey) => aliasKey.startsWith(q))
            .map((aliasKey) => aliases[aliasKey].toLowerCase());

        return apps
            .filter((app) => {
                const title = app.title.toLowerCase();
                const desc = app.description
                    ? app.description.toLowerCase()
                    : "";

                const matchesQuery = title.includes(q) || desc.includes(q);
                const matchesAlias = matchedAliasTargets.some((target) =>
                    title.includes(target)
                );

                return matchesQuery || matchesAlias;
            })
            .slice(0, 10);
    },

    execute: (item) => {
        if (item.action === "run-flatpak") {
            console.log(`Running Flatpak: ${item.value}`);
            const subprocess = spawn("flatpak", ["run", item.value], {
                detached: true,
                stdio: "ignore",
            });
            subprocess.unref();
        }
    },

    reloadAliases: () => {
        loadAliases();
    },
};
