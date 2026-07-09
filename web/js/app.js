import { CharacterComponent } from './components/CharacterComponent.js';

// Application initialization
window.onload = () => {
    // Initialize the Character View Component inside its container
    const characterView = new CharacterComponent("character-view-container");
    characterView.init();
};
