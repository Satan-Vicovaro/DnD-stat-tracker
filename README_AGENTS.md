# Giera Kajzera - Project Architecture & Context for Agents

This document provides a high-level summary of the repository's architecture, data flow, and frontend/backend integration to help future AI agents quickly understand the codebase.

## 1. Tech Stack
- **Backend**: Python 3.10+
- **Frontend**: HTML5, Vanilla JavaScript (ES6 Modules), TailwindCSS
- **Bridge**: `Eel` library (a lightweight GUI library for Python that hosts a local webserver and allows Python/JS interop)
- **Data Storage**: Local JSON file (`data/character_data.json`), acting as a persistent database for the game state.

## 2. Core Architecture

The application is an RPG character dashboard/helper. It features a reactive, component-based frontend communicating seamlessly with a Python backend that acts as the single source of truth.

### Backend (`engine.py`, `models.py`)
- **`models.py`**: Contains strict `dataclass` definitions representing the game's data structures (`Hero`, `Item`, `Weapon`, `Armor`, `ActionCard`, etc.). It encapsulates the complex nesting of stats, economy, and inventory items.
- **`engine.py`**: The core logic controller. It instantiates the `GameEngine`, loads data from `data/character_data.json`, and exposes functions to the frontend via `@eel.expose`. Every time a state-mutating function is called (e.g., adding an item, modifying a stat), it immediately saves the new state back to the JSON file.

### Frontend (`web/`)
- **Structure**: Vanilla JS using an object-oriented component approach. The main initialization happens in `web/js/app.js`.
- **Components (`web/js/components/` & `web/components/`)**: The UI is divided into classes like `CharacterComponent.js`, `InventoryComponent.js`, `ArmorComponent.js`, `EconomyComponent.js`, `ShopComponent.js`, and `ItemEditorModal.js`. Each component fetches its own HTML template asynchronously during `init()` and injects it into the DOM.
- **Data Flow**: 
  1. JS components request data from Python using `await eel.get_character()()`.
  2. To update data, JS components call an exposed Python mutation function (e.g., `eel.add_item_to_inventory()()`).
  3. The Python function returns the newly updated character state.
  4. The JS component then broadcasts this state across the frontend using a custom document-level event: `document.dispatchEvent(new CustomEvent('characterUpdated', { detail: updatedData }))`.
  5. All components listen for the `characterUpdated` event on the `document` object and re-render themselves instantly.

## 3. Key Quirks and Design Patterns to Know

- **Inheritance in Data Models**: Inventory items are heavily polymorphic. Base class `Item` can be up-casted to `Weapon` (which holds a list of `ActionCard`s) or `Armor` (which holds `effect_value`, `uses_durability`, and `cost_type`). When editing an item, ensure you preserve these specific class instances rather than wiping them back to generic `Item`s.
- **Tailwind**: Tailwind utility classes are heavily relied upon. Do not introduce custom CSS unless strictly necessary.
- **The Global Event Bus**: Do not try to manually update different components from one place. Rely entirely on the `characterUpdated` event dispatched on the `document` object to keep the UI in sync. Always dispatch this event after a backend mutation.
- **Modals**: The application uses custom modal implementations (`ItemEditorModal`, `PaymentModal`). They toggle visibility using Tailwind's `hidden` and `opacity-0` utility classes alongside simple `setTimeout`s for transitions.
- **Synchronous vs Asynchronous Eel**: Remember that calling an exposed Eel function from JavaScript requires double parentheses if you want to `await` it: `await eel.python_function_name(args)()`! The first call creates a closure, and the second call executes it asynchronously.

## 4. Current State
As of the last session, the application has robust real-time updates across all components, supports inline economy payments within the item creator, features a dedicated Weapon Actions (Attacks) manager within the Item Editor, and safely preserves advanced item types (like Armor) during edits.
