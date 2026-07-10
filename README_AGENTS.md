# Giera Kajzera - Deep Dive & Architecture Reference for Agents

This document provides a highly detailed breakdown of the "Giera Kajzera" repository. It is designed as a shortcut for future AI agents to quickly understand the core mechanics, data flow, architecture, and quirks of the codebase.

## 1. High-Level Architecture Overview

**Giera Kajzera** is a reactive RPG character dashboard and helper application. It operates with a **Python Backend** acting as the single source of truth, and a **Vanilla JS Frontend** acting as the view layer. 

The application uses **Eel** to bridge the gap between Python and web technologies. Eel hosts a local web server and opens a native-looking window (or browser), enabling seamless interop between Python functions and JavaScript.

- **Backend**: Python 3.10+ (Data Models, Logic, Serialization, Persistence)
- **Frontend**: HTML5, Vanilla JavaScript (ES6 Modules), TailwindCSS
- **Bridge**: Eel
- **Storage**: Local JSON files (autosave and named saves)

## 2. Backend Deep Dive

The backend is composed of several strictly separated layers.

### `main.py`
- The entry point of the application.
- Imports `api.py` to register Eel endpoints.
- Initializes Eel targeting the `web` directory and starts the application window (`eel.start()`).

### `models.py` (Data Schema & Business Logic)
- **Core Entity**: The `Character` class is the central state object. It tracks levels, base stats, damage taken, money, and inventory.
- **Modifiers & Providers**: Stats (Max HP, Defense, AP, Stamina, Movement) are calculated dynamically using `StatManager` and `ModifierProvider`s (like `CharacterBaseProvider` and `ItemModifierProvider`). This allows items or levels to automatically buff/debuff the character without hardcoding logic.
- **Polymorphism**: The `Item` dataclass is the base class for inventory. It is subclassed by `Weapon` (contains `ActionCard`s for attacks) and `Armor` (contains specific mitigation effects). 
- **Inventory Space**: Calculated dynamically in `Character.inventory_space`. It categorizes space into slots (quick, backpack, back, quiver) and parses item capacities based on equipped containers (e.g., "Plecak podróżnika", "Kołczan").

### `engine.py` (Game Engine & State Orchestration)
- Contains the `GameEngine` singleton (`game_engine`).
- **Persistence**: Automatically loads from `data/quick_save.json`. Provides `save()`, `create_named_save()`, and `load_named_save()` methods. Automatically saves after **every mutation**.
- **Undo / Redo System**: Implements a snapshot system (`_history` and `_future` stacks). Before any state mutation, `_snapshot()` is called to deep-copy the character state to the undo stack.
- **View Model**: The `get_character_view_model()` method translates the complex Python state (like dynamic HP splits between base HP and Armor HP, and mitigation logic) into a simplified dictionary specifically formatted for the frontend to consume.
- **Mutations**: Handles all business logic like `apply_damage`, `add_item_to_inventory`, `modify_armor_quantity`, etc.

### `serializer.py` (Persistence Translation)
- The single source of truth for converting live `Character` objects to plain dictionaries and back.
- **`build_item()`**: A critical function that reconstructs typed items (Weapon vs Armor vs Misc) based on a dictionary. It handles fallback values for editing items to preserve polymorphic data that might not be visible in the frontend editor.

### `api.py` (Eel Endpoints)
- Exposes backend functionality to JavaScript using the `@eel.expose` decorator.
- Every mutating endpoint (e.g., `modify_stat`, `add_item_to_inventory`) follows this pattern:
  1. Call the relevant `game_engine` mutation.
  2. Call `game_engine.save()` to auto-save to `quick_save.json`.
  3. Return `game_engine.get_character_view_model()` back to the frontend.

## 3. Frontend Deep Dive (`web/`)

The frontend is entirely component-based using Vanilla JavaScript, communicating with Python via Eel.

### `web/js/app.js` (Initialization & Wiring)
- Initializes all components (`CharacterComponent`, `InventoryComponent`, `FightComponent`, etc.).
- Wires up the **UndoManager** to listen for `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+S` (Save).
- Handles basic tab-switching logic.

### Components (`web/js/components/`)
- Each component (e.g., `ArmorComponent.js`, `ShopComponent.js`) is an ES6 class.
- **Rendering Pattern**: They typically fetch an HTML template (from `web/components/`), inject it into their container, and bind event listeners.
- **Reactivity Pattern (CRITICAL)**:
  - Components **do not** mutate state directly. They call exposed Eel functions (e.g., `await eel.modify_stat(...)()`).
  - The Eel function returns the new global state.
  - The component dispatches a global event: `document.dispatchEvent(new CustomEvent('characterUpdated', { detail: newState }))`.
  - **All components** listen for the `characterUpdated` event and re-render themselves automatically using the new data.

## 4. Key Data Flow & Directories

- `data/quick_save.json`: Auto-saved after every action.
- `data/saves/`: Manual timestamped saves.
- `config/armor_config.json`: Defines the base space, rules, and stat penalties/buffs for armor fragment types (Płytowa, Stalowa, itp.).
- `config/shop/`: Contains JSON files categorizing shop items (Weapons, Armor, Misc) that are fetched via `eel.get_shop_items()`.

## 5. Quirks and Agent Reminders

1. **Eel Async Syntax**: To call a Python function from JS and await the result, use double parentheses: `await eel.python_function_name(args)()`. The first call creates a closure; the second executes it.
2. **Tailwind CSS**: The frontend relies entirely on Tailwind utility classes. Avoid writing custom CSS in `<style>` blocks or `.css` files unless strictly necessary.
3. **Modals**: Implemented manually using absolute/fixed positioning and Tailwind opacity classes (`hidden`, `opacity-0`). State transitions are handled via `setTimeout` to allow CSS transitions to play.
4. **State Mutation**: Never update multiple components manually. If you change something, call the backend, get the view model, and fire the `characterUpdated` event. The UI will sync itself.
5. **Item Polymorphism**: If you are editing inventory logic, remember that `Item` can actually be `Weapon` or `Armor`. Rely on `serializer.build_item(dict, fallback=old_item)` to safely merge edits without losing subclass-specific fields.
6. **Damage & Armor**: Damage is split into "magical" (direct to base health) and "physical" (mitigated by armor fragments). The engine handles this complex distribution in `get_character_view_model()` and `apply_damage()`.
