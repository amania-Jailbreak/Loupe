const searchInput = document.getElementById("search-input");
const suggestionOverlay = document.getElementById("suggestion-overlay");
const resultsContainer = document.getElementById("results-container");

let selectedIndex = 0;
let currentResults = [];

searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    if (query.trim() === "") {
        suggestionOverlay.value = "";
        renderResults([]);
        window.electronAPI.resizeWindow(60); // Reset to input height
        return;
    }
    window.electronAPI.search(query);
});

window.electronAPI.onResults((results) => {
    currentResults = results;
    selectedIndex = 0;

    // Update suggestion overlay
    const query = searchInput.value;
    let suggestion = "";

    if (query) {
        const lowerQuery = query.toLowerCase();

        // 1. Check for explicit suggestion from result (e.g. plugin commands)
        if (
            results.length > 0 &&
            results[0].suggestion &&
            results[0].suggestion.toLowerCase().startsWith(lowerQuery)
        ) {
            suggestion = results[0].suggestion;
        }
        // 2. Check Aliases
        else {
            const matchedAlias = Object.keys(aliases).find(
                (a) =>
                    a.toLowerCase().startsWith(lowerQuery) &&
                    a.toLowerCase() !== lowerQuery
            );
            if (matchedAlias) {
                suggestion = matchedAlias;
            }
            // 3. Check top result title
            else if (results.length > 0) {
                const topResult = results[0].title;
                if (topResult.toLowerCase().startsWith(lowerQuery)) {
                    suggestion = topResult;
                }
            }
        }
    }

    if (suggestion) {
        // Preserve user's case for the typed part, append the rest from suggestion
        const matchPart = query;
        const suggestionPart = suggestion.substring(query.length);
        suggestionOverlay.value = matchPart + suggestionPart;
    } else {
        suggestionOverlay.value = "";
    }

    renderResults(results);
});
function renderResults(results) {
    resultsContainer.innerHTML = "";

    if (results.length === 0) {
        window.electronAPI.resizeWindow(60);
        return;
    }

    results.forEach((result, index) => {
        const div = document.createElement("div");
        div.className = `result-item ${
            index === selectedIndex ? "selected" : ""
        }`;

        let iconContent;
        if (
            result.icon &&
            (result.icon.startsWith("/") || result.icon.startsWith("file://"))
        ) {
            iconContent = `<img src="${result.icon}" style="width: 100%; height: 100%; object-fit: contain;">`;
        } else {
            iconContent = result.icon || "🔍";
        }

        div.innerHTML = `
            <div class="result-icon">${iconContent}</div>
            <div class="result-content">
                <div class="result-title">${result.title}</div>
                <div class="result-description">${
                    result.description || ""
                }</div>
            </div>
        `;
        div.addEventListener("click", () => {
            executeResult(result);
        });
        div.addEventListener("mouseenter", () => {
            selectedIndex = index;
            updateSelection();
        });
        resultsContainer.appendChild(div);
    });

    // Calculate total height (input + results)
    // Assuming max 400px for results
    const resultsHeight = Math.min(results.length * 60, 400);
    window.electronAPI.resizeWindow(60 + resultsHeight);
}

function updateSelection() {
    const items = resultsContainer.children;
    for (let i = 0; i < items.length; i++) {
        if (i === selectedIndex) {
            items[i].classList.add("selected");
            items[i].scrollIntoView({ block: "nearest" });
        } else {
            items[i].classList.remove("selected");
        }
    }
}

function executeResult(result) {
    window.electronAPI.executeResult(result);
    searchInput.value = "";
    renderResults([]);
    window.electronAPI.hideWindow();
}

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();
        if (
            suggestionOverlay.value &&
            suggestionOverlay.value !== searchInput.value
        ) {
            searchInput.value = suggestionOverlay.value;
            // Trigger search with new value
            window.electronAPI.search(searchInput.value);
        }
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentResults.length;
        updateSelection();
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex =
            (selectedIndex - 1 + currentResults.length) % currentResults.length;
        updateSelection();
    } else if (e.key === "Enter") {
        if (currentResults.length > 0) {
            executeResult(currentResults[selectedIndex]);
        }
    } else if (e.key === "Escape") {
        if (settingsView.style.display !== "none") {
            closeSettings();
        } else {
            window.electronAPI.hideWindow();
        }
    }
});

// Settings Logic
const settingsBtn = document.getElementById("settings-btn");
const settingsView = document.getElementById("settings-view");
const closeSettingsBtn = document.getElementById("close-settings");
const aliasTableBody = document.querySelector("#alias-table tbody");
const addAliasBtn = document.getElementById("add-alias-btn");
const aliasKeyInput = document.getElementById("alias-key");
const aliasValueInput = document.getElementById("alias-value");

let aliases = {};

// Load aliases on startup
window.electronAPI.getAliases().then((a) => (aliases = a));

settingsBtn.addEventListener("click", async () => {
    if (settingsView.style.display === "none") {
        await openSettings();
    } else {
        closeSettings();
    }
});

closeSettingsBtn.addEventListener("click", closeSettings);

async function openSettings() {
    resultsContainer.style.display = "none";
    settingsView.style.display = "block";
    aliases = await window.electronAPI.getAliases();
    renderAliases();
    window.electronAPI.resizeWindow(460); // Fixed height for settings
}

function closeSettings() {
    settingsView.style.display = "none";
    resultsContainer.style.display = "block";
    // Restore window size based on results or input only
    if (currentResults.length > 0) {
        const resultsHeight = Math.min(currentResults.length * 60, 400);
        window.electronAPI.resizeWindow(60 + resultsHeight);
    } else {
        window.electronAPI.resizeWindow(60);
    }
}

function renderAliases() {
    aliasTableBody.innerHTML = "";
    Object.entries(aliases).forEach(([key, value]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${key}</td>
            <td>${value}</td>
            <td><button class="delete-btn" data-key="${key}">Delete</button></td>
        `;
        aliasTableBody.appendChild(tr);
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const key = e.target.getAttribute("data-key");
            delete aliases[key];
            saveAliases();
        });
    });
}

addAliasBtn.addEventListener("click", () => {
    const key = aliasKeyInput.value.trim();
    const value = aliasValueInput.value.trim();

    if (key && value) {
        aliases[key] = value;
        aliasKeyInput.value = "";
        aliasValueInput.value = "";
        saveAliases();
    }
});

async function saveAliases() {
    const success = await window.electronAPI.saveAliases(aliases);
    if (success) {
        renderAliases();
    } else {
        alert("Failed to save aliases");
    }
}

window.electronAPI.onResetSearch(() => {
    searchInput.value = "";
    suggestionOverlay.value = "";
    renderResults([]);
    window.electronAPI.resizeWindow(60);
    if (settingsView.style.display !== "none") {
        closeSettings();
    }
});
