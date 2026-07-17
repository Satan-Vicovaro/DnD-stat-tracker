export class ServerComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(this.containerId);
    this.syncUrl =
      localStorage.getItem("syncServerUrl") || "http://localhost:8000/api/sync";
    this.syncEnabled = localStorage.getItem("syncEnabled") !== "false"; // Default true
  }

  async init() {
    this.render();
    this.attachEvents();
    // Initialize backend config
    await eel.set_sync_config(this.syncUrl, this.syncEnabled)();
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg mb-8 max-w-2xl mx-auto mt-10">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/>
          </svg>
          Konfiguracja Serwera
        </h2>

        <div class="space-y-6">
          <!-- Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-white font-semibold">Synchronizacja w tle</h3>
              <p class="text-sm text-gray-400 mt-1">Automatycznie wysyłaj stan gry na serwer Game Mastera po każdej zmianie.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="sync-toggle" class="sr-only peer" ${this.syncEnabled ? "checked" : ""}>
              <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>

          <!-- URL Input -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Adres serwera</label>
            <input type="text" id="sync-url" value="${this.syncUrl}" class="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="http://localhost:2137/api/sync">
          </div>

          <!-- Actions -->
          <div class="pt-4 flex gap-4">
            <button id="btn-save-sync" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              Zapisz
            </button>
            <button id="btn-test-sync" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Testuj połączenie
            </button>
          </div>
          <div id="sync-test-result" class="text-sm font-semibold hidden"></div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const btnSave = document.getElementById("btn-save-sync");
    const btnTest = document.getElementById("btn-test-sync");
    const inputUrl = document.getElementById("sync-url");
    const toggleSync = document.getElementById("sync-toggle");
    const testResult = document.getElementById("sync-test-result");

    btnSave.addEventListener("click", async () => {
      this.syncUrl = inputUrl.value.trim();
      this.syncEnabled = toggleSync.checked;

      localStorage.setItem("syncServerUrl", this.syncUrl);
      localStorage.setItem("syncEnabled", this.syncEnabled);

      await eel.set_sync_config(this.syncUrl, this.syncEnabled)();

      // Update local UI
      btnSave.classList.replace("bg-indigo-600", "bg-emerald-600");
      btnSave.classList.replace("hover:bg-indigo-700", "hover:bg-emerald-700");
      setTimeout(() => {
        btnSave.classList.replace("bg-emerald-600", "bg-indigo-600");
        btnSave.classList.replace(
          "hover:bg-emerald-700",
          "hover:bg-indigo-700",
        );
      }, 1000);

      if (!this.syncEnabled) {
        window.updateSyncStatus(false, "Wyłączona");
      } else {
        window.updateSyncStatus(null, "Oczekuje...");
      }
    });

    btnTest.addEventListener("click", async () => {
      btnTest.disabled = true;
      btnTest.textContent = "Testowanie...";
      testResult.classList.add("hidden");

      try {
        const url = inputUrl.value.trim();
        const success = await eel.test_sync_connection(url)();

        testResult.classList.remove("hidden");
        if (success) {
          testResult.textContent = "Połączenie udane!";
          testResult.className =
            "text-sm font-semibold text-emerald-400 mt-2 block";
          window.updateSyncStatus(true, "Połączony");
        } else {
          testResult.textContent = "Błąd połączenia. Sprawdź serwer.";
          testResult.className =
            "text-sm font-semibold text-red-400 mt-2 block";
          window.updateSyncStatus(false, "Błąd");
        }
      } catch (err) {
        testResult.classList.remove("hidden");
        testResult.textContent = "Wystąpił błąd komunikacji.";
        testResult.className = "text-sm font-semibold text-red-400 mt-2 block";
        window.updateSyncStatus(false, "Błąd");
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = "Testuj połączenie";
      }
    });
  }
}
