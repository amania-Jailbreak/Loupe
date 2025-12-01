const { clipboard } = require("electron");

module.exports = {
    search: async (query) => {
        try {
            // Simple regex to check if it looks like math
            if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(query)) {
                // Use Function constructor for safer eval (still risky but okay for local calculator)
                // or just eval since it's a local app
                const result = eval(query);
                if (
                    result !== undefined &&
                    !isNaN(result) &&
                    isFinite(result)
                ) {
                    return [
                        {
                            title: result.toString(),
                            description: `Calculate: ${query}`,
                            icon: "🧮",
                            action: "copy",
                            value: result.toString(),
                        },
                    ];
                }
            }
        } catch (e) {
            // Ignore errors
        }
        return [];
    },

    execute: (item) => {
        if (item.action === "copy") {
            clipboard.writeText(item.value);
            console.log("Copied to clipboard:", item.value);
        }
    },
};
