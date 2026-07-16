import { CharacterComponent } from './components/CharacterComponent.js';
import { ArmorComponent } from './components/ArmorComponent.js';
import { ShopComponent } from './components/ShopComponent.js?v=3';
import { EconomyComponent } from './components/EconomyComponent.js';
import { PaymentModal } from './components/PaymentModal.js';
import { ItemEditorModal } from './components/ItemEditorModal.js';
import { InventoryComponent } from './components/InventoryComponent.js?v=2';
import { SaveLoadModal } from './components/SaveLoadModal.js';
import { FightComponent } from './components/FightComponent.js';
import { StatusEffectsComponent } from './components/StatusEffectsComponent.js';
import { NotesComponent } from './components/NotesComponent.js';
import { MagiaComponent } from './components/MagiaComponent.js';
import { ServerComponent } from './components/ServerComponent.js';

// ─── Global Sync Status Helper ───────────────────────────────────────────────
window.updateSyncStatus = (isSuccess, textMsg = null) => {
  const indicator = document.getElementById("sync-indicator");
  const dot = document.getElementById("sync-dot");
  const text = document.getElementById("sync-text");
  
  if (!indicator) return;
  indicator.classList.remove("hidden");
  
  if (isSuccess === true) {
    dot.className = "w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
    text.textContent = textMsg || "Zsynchronizowano";
  } else if (isSuccess === false) {
    dot.className = "w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]";
    text.textContent = textMsg || "Błąd synchronizacji";
  } else {
    dot.className = "w-2 h-2 rounded-full bg-gray-500";
    text.textContent = textMsg || "Oczekuje...";
  }
};
// Expose to Eel
eel.expose(window.updateSyncStatus, "updateSyncStatus");

// ─── Undo / Redo Manager ─────────────────────────────────────────────────────

class UndoManager {
  constructor() {
    this.undoBtn  = document.getElementById('btn-undo');
    this.redoBtn  = document.getElementById('btn-redo');
    this.toast    = document.getElementById('undo-toast');
    this._toastTimer = null;
  }


  /** Sync button enabled/disabled state from the latest view model. */
  sync(characterData) {
    this.undoBtn.disabled = !(characterData?.can_undo ?? false);
    this.redoBtn.disabled = !(characterData?.can_redo ?? false);
  }

  /** Check if focus is inside a text field (keyboard shortcut should be skipped). */
  _inTextField() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  async performUndo() {
    if (this.undoBtn.disabled) return;
    const charData = await eel.undo()();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: charData }));
    this._showToast('↩ Cofnięto', 'text-indigo-400');
  }

  async performRedo() {
    if (this.redoBtn.disabled) return;
    const charData = await eel.redo()();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: charData }));
    this._showToast('↪ Ponowiono', 'text-emerald-400');
  }

  _showToast(text, colorClass) {
    this.toast.textContent = text;
    // Reset classes then apply the colour
    this.toast.className = `text-xs font-semibold transition-opacity duration-300 pointer-events-none ${colorClass}`;
    this.toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toast.style.opacity = '0'; }, 1500);
  }
}

// ─── Application initialization ──────────────────────────────────────────────

window.onload = async () => {
    // ─── Initial Routing ───────────────────────────────────────────────────────
    const appSelection = document.getElementById("app-selection");
    const appCharacter = document.getElementById("app-character");
    const appGm = document.getElementById("app-gm");

    document.getElementById("btn-select-character").addEventListener("click", () => {
        appSelection.classList.add("hidden");
        appSelection.classList.remove("flex");
        appCharacter.classList.remove("hidden");
    });

    document.getElementById("btn-select-gm").addEventListener("click", () => {
        appSelection.classList.add("hidden");
        appSelection.classList.remove("flex");
        appGm.classList.remove("hidden");
        appGm.classList.add("flex");
        if (typeof fetchAndRenderPlayers === 'function') fetchAndRenderPlayers();
    });

    document.getElementById("btn-gm-back").addEventListener("click", () => {
        appGm.classList.add("hidden");
        appGm.classList.remove("flex");
        appSelection.classList.remove("hidden");
        appSelection.classList.add("flex");
    });

    // Initialize Modals
    window.paymentModal = new PaymentModal("payment-modal-container");
    await window.paymentModal.init();

    // ─── GM Panel Logic ────────────────────────────────────────────────────────
    const gmPlayersGrid = document.getElementById("gm-players-grid");
    const gmTopBar = document.getElementById("gm-top-bar");
    let currentGmPlayerView = null;
    let gmAutoRefreshInterval = null;

    window.fetchAndRenderPlayers = async function() {
        gmPlayersGrid.innerHTML = '<div class="text-gray-500 text-center col-span-full py-20 animate-pulse">Ładowanie graczy...</div>';
        const players = await eel.get_remote_players_list()();
        if (!players || players.length === 0) {
            gmPlayersGrid.innerHTML = '<div class="text-gray-500 text-center col-span-full py-20">Brak graczy na serwerze.</div>';
            return;
        }
        gmPlayersGrid.innerHTML = '';
        players.forEach(p => {
            const card = document.createElement("div");
            card.className = "bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-lg hover:border-emerald-500 cursor-pointer transition-colors relative";
            const statusDot = p.is_online ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500";
            const statusText = p.is_online ? "Online" : "Offline";
            card.innerHTML = `
                <div class="absolute top-4 right-4 flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full ${statusDot}"></div>
                    <span class="text-xs text-gray-400 font-semibold">${statusText}</span>
                </div>
                <h2 class="text-2xl font-bold text-emerald-400 mb-2">${p.name}</h2>
                <p class="text-gray-400">Poziom: <span class="text-white font-semibold">${p.level}</span></p>
                <p class="text-gray-400">HP: <span class="text-white font-semibold">${p.hp}</span></p>
            `;
            card.addEventListener("click", () => openGmPlayerView(p.name));
            gmPlayersGrid.appendChild(card);
        });
    };

    document.getElementById("btn-gm-refresh-list").addEventListener("click", fetchAndRenderPlayers);

    async function refreshGmPlayerView() {
        if (!currentGmPlayerView) return;
        const data = await eel.get_remote_player_view(currentGmPlayerView)();
        if (data) {
            document.dispatchEvent(new CustomEvent('characterUpdated', { detail: data }));
        }
    }

    async function openGmPlayerView(playerName) {
        currentGmPlayerView = playerName;
        document.body.classList.add("gm-readonly");
        appGm.classList.add("hidden");
        appGm.classList.remove("flex");
        appCharacter.classList.remove("hidden");
        gmTopBar.classList.remove("hidden");
        document.getElementById("gm-view-player-name").textContent = playerName;
        
        // Disable regular save shortcuts etc
        document.getElementById('btn-undo').disabled = true;
        document.getElementById('btn-redo').disabled = true;
        document.getElementById('btn-load-saves').disabled = true;
        
        await refreshGmPlayerView();
        
        if (gmAutoRefreshInterval) clearInterval(gmAutoRefreshInterval);
        gmAutoRefreshInterval = setInterval(refreshGmPlayerView, 5000);
    }

    document.getElementById("btn-gm-refresh").addEventListener("click", refreshGmPlayerView);

    document.getElementById("btn-gm-exit-view").addEventListener("click", async () => {
        currentGmPlayerView = null;
        if (gmAutoRefreshInterval) clearInterval(gmAutoRefreshInterval);
        document.body.classList.remove("gm-readonly");
        gmTopBar.classList.add("hidden");
        appCharacter.classList.add("hidden");
        appGm.classList.remove("hidden");
        appGm.classList.add("flex");
        
        // Restore local character to UI
        const initData = await eel.get_character()();
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: initData }));
    });


    window.itemEditorModal = new ItemEditorModal("item-editor-modal-container");
    await window.itemEditorModal.init();

    window.saveLoadModal = new SaveLoadModal("saveload-modal-container");
    await window.saveLoadModal.init();

    // Initialize the Character View Component
    const characterView = new CharacterComponent("character-view-container");
    characterView.init();

    // Initialize the Armor View Component
    const armorView = new ArmorComponent("armor-view-container");
    armorView.init();

    const magiaView = new MagiaComponent("magia-view-container");
    magiaView.init();

    // Single EconomyComponent instance mounts to both tabs simultaneously.
    const economyView = new EconomyComponent(
      "economy-view-container-items",
      "economy-view-container-shop"
    );
    economyView.init();

    // Initialize the Inventory View Component
    const inventoryView = new InventoryComponent("inventory-view-container");
    inventoryView.init();

    const fightView = new FightComponent("fight-view-container");
    fightView.init();

    const fightArmorView = new ArmorComponent("fight-armor-view-container", true);
    fightArmorView.init();

    const statusEffectsView = new StatusEffectsComponent("status-effects-view-container");
    statusEffectsView.init();

    // Initialize the Shop View Component
    const shopView = new ShopComponent("shop-view-container");
    shopView.init();

    // Initialize the Notes View Component
    const notesView = new NotesComponent("notes-view-container");
    notesView.init();

    // Initialize the Server Component
    const serverView = new ServerComponent("server-view-container");
    serverView.init();

    // ─── Undo / Redo wiring ───────────────────────────────────────────────────
    const undoManager = new UndoManager();

    // Keep buttons in sync with every state broadcast
    document.addEventListener('characterUpdated', (e) => {
      undoManager.sync(e.detail);
    });

    // Button clicks
    undoManager.undoBtn.addEventListener('click', () => undoManager.performUndo());
    undoManager.redoBtn.addEventListener('click', () => undoManager.performRedo());

    document.getElementById('btn-load-saves').addEventListener('click', () => {
      window.saveLoadModal.open();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+S → Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        (async () => {
          const filename = await eel.create_named_save()();
          if (filename) {
            undoManager._showToast('Zapisano!', 'text-blue-400');
          }
        })();
        return;
      }

      if (undoManager._inTextField()) return;

      // Ctrl+Z → Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoManager.performUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z → Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        undoManager.performRedo();
        return;
      }
    });

    // Seed initial button state from backend
    const initData = await eel.get_character()();
    undoManager.sync(initData);

    // ─── Tab Switching Logic ──────────────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Reset all tabs
        tabBtns.forEach(b => {
          b.classList.remove('bg-gray-800', 'text-white', 'border-t', 'border-l', 'border-r', 'border-gray-700');
          b.classList.add('bg-transparent', 'text-gray-400');
        });
        tabPanes.forEach(p => {
          p.classList.remove('block');
          p.classList.add('hidden');
        });

        // Set active tab
        btn.classList.remove('bg-transparent', 'text-gray-400');
        btn.classList.add('bg-gray-800', 'text-white', 'border-t', 'border-l', 'border-r', 'border-gray-700');
        
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        document.getElementById(targetId).classList.add('block');
      });
    });
};
