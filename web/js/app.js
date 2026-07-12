import { CharacterComponent } from './components/CharacterComponent.js';
import { ArmorComponent } from './components/ArmorComponent.js';
import { ShopComponent } from './components/ShopComponent.js';
import { EconomyComponent } from './components/EconomyComponent.js';
import { PaymentModal } from './components/PaymentModal.js';
import { ItemEditorModal } from './components/ItemEditorModal.js';
import { InventoryComponent } from './components/InventoryComponent.js';
import { SaveLoadModal } from './components/SaveLoadModal.js';
import { FightComponent } from './components/FightComponent.js';
import { StatusEffectsComponent } from './components/StatusEffectsComponent.js';
import { NotesComponent } from './components/NotesComponent.js';

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
    // Initialize Modals
    window.paymentModal = new PaymentModal("payment-modal-container");
    await window.paymentModal.init();

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
