const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec, spawn } = require("child_process");

const HOME_DIR = os.homedir();
const SEARCH_DIRS = [
    HOME_DIR,
    path.join(HOME_DIR, "Documents"),
    path.join(HOME_DIR, "Downloads"),
    path.join(HOME_DIR, "Pictures"),
    path.join(HOME_DIR, "Music"),
    path.join(HOME_DIR, "Videos"),
    path.join(HOME_DIR, "Desktop"),
    path.join(HOME_DIR, "ドキュメント"), // Japanese localized folders
    path.join(HOME_DIR, "ダウンロード"),
    path.join(HOME_DIR, "ピクチャ"),
    path.join(HOME_DIR, "ミュージック"),
    path.join(HOME_DIR, "ビデオ"),
    path.join(HOME_DIR, "デスクトップ"),
];

module.exports = {
    search: async (query) => {
        if (!query || query.length < 2) return []; // Require at least 2 chars

        const q = query.toLowerCase();
        let results = [];

        // Deduplicate search dirs (in case English and Japanese paths are same or symlinked)
        const uniqueDirs = [
            ...new Set(SEARCH_DIRS.filter((d) => fs.existsSync(d))),
        ];

        for (const dir of uniqueDirs) {
            try {
                const files = fs.readdirSync(dir, { withFileTypes: true });

                for (const file of files) {
                    if (file.isDirectory() && !file.name.startsWith(".")) {
                        if (file.name.toLowerCase().includes(q)) {
                            results.push({
                                title: file.name,
                                description: `Folder in ${path.basename(dir)}`,
                                icon: "📂",
                                action: "open-folder",
                                value: path.join(dir, file.name),
                            });
                        }
                    }
                }
            } catch (e) {
                // Ignore access errors
            }
        }

        return results.slice(0, 10);
    },

    execute: (item) => {
        if (item.action === "open-folder") {
            console.log(`Opening folder: ${item.value}`);
            const subprocess = spawn("xdg-open", [item.value], {
                detached: true,
                stdio: "ignore",
            });
            subprocess.unref();
        }
    },
};
