import { CharacterComponent } from './components/CharacterComponent.js';
import { ArmorComponent } from './components/ArmorComponent.js';
import { ShopComponent } from './components/ShopComponent.js';

// Application initialization
window.onload = () => {
    // Initialize the Character View Component
    const characterView = new CharacterComponent("character-view-container");
    characterView.init();

    // Initialize the Armor View Component
    const armorView = new ArmorComponent("armor-view-container");
    armorView.init();

    // Initialize the Shop View Component
    const shopView = new ShopComponent("shop-view-container");
    shopView.init();
};
