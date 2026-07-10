import { CharacterComponent } from './components/CharacterComponent.js';
import { ArmorComponent } from './components/ArmorComponent.js';
import { ShopComponent } from './components/ShopComponent.js';
import { EconomyComponent } from './components/EconomyComponent.js';
import { PaymentModal } from './components/PaymentModal.js';
import { ItemEditorModal } from './components/ItemEditorModal.js';
import { InventoryComponent } from './components/InventoryComponent.js';

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

    // Initialize the Character View Component
    const characterView = new CharacterComponent("character-view-container");
    characterView.init();

    // Initialize the Armor View Component
    const armorView = new ArmorComponent("armor-view-container");
    armorView.init();

    // Initialize the Economy View Component
    const economyView = new EconomyComponent("economy-view-container");
    economyView.init();

    // Initialize the Inventory View Component
    const inventoryView = new InventoryComponent("inventory-view-container");
    inventoryView.init();

    // Initialize the Shop View Component
    const shopView = new ShopComponent("shop-view-container");
    shopView.init();

    // ─── Undo / Redo wiring ───────────────────────────────────────────────────
    const undoManager = new UndoManager();

    // Keep buttons in sync with every state broadcast
    document.addEventListener('characterUpdated', (e) => {
      undoManager.sync(e.detail);
    });

    // Button clicks
    undoManager.undoBtn.addEventListener('click', () => undoManager.performUndo());
    undoManager.redoBtn.addEventListener('click', () => undoManager.performRedo());

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
      }
    });

    // Seed initial button state from backend
    const initData = await eel.get_character()();
    undoManager.sync(initData);
};
