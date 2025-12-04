const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec, spawn } = require("child_process");

const APP_DIRS = [
    "/usr/share/applications",
    path.join(os.homedir(), ".local/share/applications"),
];

const ICON_DIRS = [
    "/usr/share/pixmaps",
    "/usr/share/icons/hicolor/48x48/apps",
    "/usr/share/icons/hicolor/scalable/apps",
    path.join(os.homedir(), ".local/share/icons"),
];

function findIcon(iconName) {
    if (!iconName) return "🚀";

    // If absolute path
    if (iconName.startsWith("/")) {
        return fs.existsSync(iconName) ? iconName : "🚀";
    }

    // Search in common dirs
    const extensions = [".png", ".svg", ".xpm"];
    for (const dir of ICON_DIRS) {
        if (!fs.existsSync(dir)) continue;

        // Check exact match first (if extension included)
        const exactPath = path.join(dir, iconName);
        if (fs.existsSync(exactPath)) return exactPath;

        // Check with extensions
        for (const ext of extensions) {
            const iconPath = path.join(dir, iconName + ext);
            if (fs.existsSync(iconPath)) return iconPath;
        }
    }

    return "🚀";
}

let appsCache = [];
let lastCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

function loadApps() {
    const now = Date.now();
    if (appsCache.length > 0 && now - lastCacheTime < CACHE_TTL) {
        return;
    }

    appsCache = [];

    APP_DIRS.forEach((dir) => {
        if (!fs.existsSync(dir)) return;

        try {
            const files = fs.readdirSync(dir);
            files.forEach((file) => {
                if (!file.endsWith(".desktop")) return;

                try {
                    const content = fs.readFileSync(
                        path.join(dir, file),
                        "utf-8"
                    );
                    const nameMatch = content.match(/^Name=(.*)$/m);
                    const execMatch = content.match(/^Exec=(.*)$/m);
                    const iconMatch = content.match(/^Icon=(.*)$/m);
                    const noDisplayMatch =
                        content.match(/^NoDisplay=(true|1)$/im);

                    if (nameMatch && execMatch && !noDisplayMatch) {
                        // Clean up Exec command (remove %u, %F etc)
                        let execCmd = execMatch[1]
                            .replace(/%[a-zA-Z]/g, "")
                            .trim();

                        const iconPath = findIcon(
                            iconMatch ? iconMatch[1].trim() : null
                        );

                        appsCache.push({
                            title: nameMatch[1],
                            description: "Application",
                            icon: iconPath,
                            action: "exec",
                            value: execCmd,
                            originalFile: file,
                        });
                    }
                } catch (e) {
                    // Skip unreadable files
                }
            });
        } catch (e) {
            console.error(`Error reading app dir ${dir}:`, e);
        }
    });

    lastCacheTime = now;
}

// Load aliases
let aliases = {};
function loadAliases() {
    try {
        // In production, aliases are in userData
        // But plugins are loaded via require, so we need to find the path relative to userData or pass it in
        // Since we moved plugins to userData, we can look in parent dir
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
    prefix: "apps",
    search: async (query) => {
        loadApps();
        if (!query) return [];

        const q = query.toLowerCase();

        // Find all alias targets where the alias key starts with the query
        const matchedAliasTargets = Object.keys(aliases)
            .filter((aliasKey) => aliasKey.startsWith(q))
            .map((aliasKey) => aliases[aliasKey].toLowerCase());

        return appsCache
            .filter((app) => {
                const title = app.title.toLowerCase();
                const matchesQuery = title.includes(q);
                const matchesAlias = matchedAliasTargets.some((target) =>
                    title.includes(target)
                );

                return matchesQuery || matchesAlias;
            })
            .slice(0, 10);
    },

    execute: (item) => {
        if (item.action === "exec") {
            console.log(`Launching: ${item.value}`);
            const subprocess = spawn(item.value, {
                detached: true,
                stdio: "ignore",
                shell: true,
            });
            subprocess.unref();
        }
    },

    reloadAliases: () => {
        loadAliases();
    },
};
