module.exports = {
    search: async (query) => {
        if (query.toLowerCase().startsWith("hello")) {
            return [
                {
                    title: "Hello World!",
                    description: "Greetings from Loupe",
                    icon: "👋",
                    action: "log",
                },
            ];
        }
        return [];
    },

    execute: (item) => {
        console.log("Hello World executed!");
    },
};
