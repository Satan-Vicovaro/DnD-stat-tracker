import { CharacterComponent } from './components/CharacterComponent.js';
import { ArmorComponent } from './components/ArmorComponent.js';
import { ShopComponent } from './components/ShopComponent.js';
import { EconomyComponent } from './components/EconomyComponent.js';
import { PaymentModal } from './components/PaymentModal.js';
import { ItemEditorModal } from './components/ItemEditorModal.js';
import { InventoryComponent } from './components/InventoryComponent.js';

// Application initialization
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
};
