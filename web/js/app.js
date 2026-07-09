import { CharacterComponent } from './components/CharacterComponent.js';
import { ArmorComponent } from './components/ArmorComponent.js';

// Application initialization
window.onload = () => {
    // Initialize the Character View Component
    const characterView = new CharacterComponent("character-view-container");
    characterView.init();

    // Initialize the Armor View Component
    const armorView = new ArmorComponent("armor-view-container");
    armorView.init();
};
