export class ItemEditorModal {
  constructor(containerId) {
    this.containerId = containerId;
    this.isOpen = false;
    this.mode = 'new'; // 'new' or 'edit'
    this.editIndex = -1;
    this.modifiers = [];
    this.actions = [];
    this.willPay = false; // If true, process payment inline
    this.characterData = null;
    this.originalName = "";
  }

  async init() {
    const response = await fetch('/components/item_editor_modal.html');
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;
    this.bindEvents();
  }

  /** Shows/hides the Weapon-actions and Armor-details sections based on item type. */
  _applyTypeVisibility(type) {
    const actionsSection = document.getElementById('item-editor-actions-section');
    const armorSection = document.getElementById('item-editor-armor-section');
    actionsSection.classList.toggle('hidden', type !== 'Weapon');
    armorSection.classList.toggle('hidden', type !== 'Armor');
  }

  bindEvents() {
    document.getElementById('item-editor-modal-close').addEventListener('click', () => this.close());
    document.getElementById('item-editor-btn-cancel').addEventListener('click', () => this.close());

    document.getElementById('btn-add-modifier').addEventListener('click', () => {
      this.modifiers.push({ stat_name: 'max_hp', value: 1 });
      this.renderModifiers();
    });

    document.getElementById('btn-add-action').addEventListener('click', () => {
      this.actions.push({
        action_name: 'Nowa Akcja', action_cost: 1, card_value: 0,
        range_str: '', hit_roll: '', damage_roll: '', description: ''
      });
      this.renderActions();
    });

    document.getElementById('item-editor-type').addEventListener('change', (e) => {
      this._applyTypeVisibility(e.target.value);
    });

    document.getElementById('btn-item-buy').addEventListener('click', (e) => {
      this.willPay = !this.willPay;
      const btn = e.currentTarget;
      const paymentSection = document.getElementById('item-editor-payment-section');
      if (this.willPay) {
        btn.classList.replace('bg-yellow-600/30', 'bg-yellow-600');
        btn.classList.replace('text-yellow-500', 'text-white');
        btn.innerText = "Zakup (Płatność)";
        paymentSection.classList.remove('hidden');
        this.updateBalances();
      } else {
        btn.classList.replace('bg-yellow-600', 'bg-yellow-600/30');
        btn.classList.replace('text-white', 'text-yellow-500');
        btn.innerText = "Ustal Koszt";
        paymentSection.classList.add('hidden');
      }
      this.validatePayment();
    });

    ['gold', 'silver', 'copper'].forEach(coin => {
      const input = document.getElementById(`item-editor-${coin}`);
      if (input) {
        input.addEventListener('input', () => this.validatePayment());
      }
    });

    document.getElementById('item-editor-btn-save').addEventListener('click', () => this.handleSave());
  }

  async openNew() {
    this.mode = 'new';
    this.editIndex = -1;
    this.modifiers = [];
    this.actions = [];
    this.willPay = false;
    this.originalName = "";

    this.characterData = await eel.get_character()();

    document.getElementById('item-editor-title').innerText = "Stwórz Własny Przedmiot";
    document.getElementById('item-editor-cost-section').classList.remove('hidden');

    // Reset inputs
    document.getElementById('item-editor-name').value = "";
    document.getElementById('item-editor-type').value = "Misc";
    document.getElementById('item-editor-desc').value = "";
    document.getElementById('item-editor-space').value = "0";
    document.getElementById('item-editor-actions-section').classList.add('hidden');
    document.getElementById('item-editor-armor-section').classList.add('hidden');
    document.getElementById('item-editor-armor-effect').value = "";
    document.getElementById('item-editor-armor-uses').value = "";
    document.getElementById('item-editor-armor-cost-type').value = "";

    // Reset payment fields
    document.getElementById('item-editor-gold').value = "0";
    document.getElementById('item-editor-silver').value = "0";
    document.getElementById('item-editor-copper').value = "0";
    document.getElementById('item-editor-payment-section').classList.add('hidden');

    // Reset buy btn
    const btnBuy = document.getElementById('btn-item-buy');
    btnBuy.classList.replace('bg-yellow-600', 'bg-yellow-600/30');
    btnBuy.classList.replace('text-white', 'text-yellow-500');
    btnBuy.innerText = "Ustal Koszt";

    this.renderModifiers();
    this.validatePayment();
    this.show();
  }

  async openEdit(index, itemData) {
    this.mode = 'edit';
    this.editIndex = index;
    this.originalName = itemData.name || "";
    this.modifiers = JSON.parse(JSON.stringify(itemData.modifiers || []));
    this.actions = JSON.parse(JSON.stringify(itemData.actions || []));
    this.willPay = false;

    this.characterData = await eel.get_character()();

    document.getElementById('item-editor-title').innerText = "Edytuj Przedmiot";
    document.getElementById('item-editor-cost-section').classList.add('hidden');
    document.getElementById('item-editor-payment-section').classList.add('hidden');

    document.getElementById('item-editor-name').value = itemData.name || "";
    document.getElementById('item-editor-type').value = itemData.item_type || "Misc";
    document.getElementById('item-editor-desc').value = itemData.description || "";
    document.getElementById('item-editor-space').value = itemData.space_taken || "0";
    
    document.getElementById('item-editor-armor-effect').value = itemData.effect_value || "";
    document.getElementById('item-editor-armor-uses').value = itemData.uses_durability || "";
    document.getElementById('item-editor-armor-cost-type').value = itemData.cost_type || "";

    this._applyTypeVisibility(itemData.item_type || 'Misc');

    this.renderModifiers();
    this.renderActions();
    this.validatePayment();
    this.show();
  }

  renderModifiers() {
    const list = document.getElementById('item-editor-modifiers-list');

    if (this.modifiers.length === 0) {
      list.innerHTML = `<div class="text-gray-500 text-xs italic text-center py-2">Brak modyfikatorów</div>`;
      return;
    }

    list.innerHTML = this.modifiers.map((mod, i) => `
      <div class="flex items-center gap-2 bg-gray-800 p-2 rounded border border-gray-600">
        <select class="mod-stat flex-1 bg-gray-700 text-white text-sm rounded px-2 py-1 outline-none" data-idx="${i}">
          <option value="max_hp" ${mod.stat_name === 'max_hp' ? 'selected' : ''}>Maks. HP</option>
          <option value="defense" ${mod.stat_name === 'defense' ? 'selected' : ''}>Obrona</option>
          <option value="ap" ${mod.stat_name === 'ap' ? 'selected' : ''}>Punkty Akcji</option>
          <option value="stamina" ${mod.stat_name === 'stamina' ? 'selected' : ''}>Wytrwałość</option>
          <option value="movement" ${mod.stat_name === 'movement' ? 'selected' : ''}>Ruch (ft)</option>
          <option value="str" ${mod.stat_name === 'str' ? 'selected' : ''}>Siła</option>
          <option value="dex" ${mod.stat_name === 'dex' ? 'selected' : ''}>Zręczność</option>
          <option value="wis" ${mod.stat_name === 'wis' ? 'selected' : ''}>Wiedza</option>
          <option value="cha" ${mod.stat_name === 'cha' ? 'selected' : ''}>Charyzma</option>
        </select>
        <input type="number" class="mod-val w-20 bg-gray-700 text-white text-sm rounded px-2 py-1 outline-none text-center" data-idx="${i}" value="${mod.value}">
        <button class="mod-del text-red-400 hover:text-red-300 px-2" data-idx="${i}">✕</button>
      </div>
    `).join('');

    // Bind mod events
    list.querySelectorAll('.mod-stat').forEach(el => {
      el.addEventListener('change', (e) => {
        this.modifiers[e.target.dataset.idx].stat_name = e.target.value;
      });
    });
    list.querySelectorAll('.mod-val').forEach(el => {
      el.addEventListener('change', (e) => {
        this.modifiers[e.target.dataset.idx].value = parseFloat(e.target.value) || 0;
      });
    });
    list.querySelectorAll('.mod-del').forEach(el => {
      el.addEventListener('click', (e) => {
        this.modifiers.splice(e.target.dataset.idx, 1);
        this.renderModifiers();
      });
    });
  }

  renderActions() {
    const list = document.getElementById('item-editor-actions-list');

    if (this.actions.length === 0) {
      list.innerHTML = `<div class="text-gray-500 text-xs italic text-center py-2">Brak zdefiniowanych akcji</div>`;
      return;
    }

    list.innerHTML = this.actions.map((act, i) => `
      <div class="bg-gray-800 p-3 rounded border border-gray-600 shadow-sm relative">
        <button class="act-del absolute top-2 right-2 text-red-400 hover:text-red-300 px-1 font-bold" data-idx="${i}">✕</button>
        <div class="grid grid-cols-2 gap-2 mb-2 pr-6">
          <div class="flex flex-col">
            <label class="text-[10px] text-gray-400 uppercase font-bold">Nazwa</label>
            <input type="text" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none focus:border-indigo-500 border border-transparent" data-idx="${i}" data-field="action_name" value="${act.action_name || ''}">
          </div>
          <div class="flex flex-col">
            <label class="text-[10px] text-emerald-400 uppercase font-bold">Koszt (AP)</label>
            <input type="number" step="0.5" min="0" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-emerald-500/30" data-idx="${i}" data-field="action_cost" value="${act.action_cost || 0}">
          </div>
        </div>
        <div class="grid grid-cols-4 gap-2 mb-2">
          <div class="flex flex-col">
            <label class="text-[10px] text-slate-400 uppercase font-bold">Odp</label>
            <input type="number" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-transparent" data-idx="${i}" data-field="card_value" value="${act.card_value || 0}">
          </div>
          <div class="flex flex-col">
            <label class="text-[10px] text-slate-400 uppercase font-bold">Zasięg</label>
            <input type="text" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-transparent" data-idx="${i}" data-field="range_str" value="${act.range_str || ''}">
          </div>
          <div class="flex flex-col">
            <label class="text-[10px] text-amber-400 uppercase font-bold">Hit Roll</label>
            <input type="text" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-transparent" data-idx="${i}" data-field="hit_roll" value="${act.hit_roll || ''}">
          </div>
          <div class="flex flex-col">
            <label class="text-[10px] text-rose-400 uppercase font-bold">Dmg Roll</label>
            <input type="text" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-transparent" data-idx="${i}" data-field="damage_roll" value="${act.damage_roll || ''}">
          </div>
        </div>
        <div class="flex flex-col">
          <label class="text-[10px] text-gray-400 uppercase font-bold">Opis</label>
          <input type="text" class="act-val bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-transparent" data-idx="${i}" data-field="description" value="${act.description || ''}">
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.act-val').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = e.target.dataset.idx;
        const field = e.target.dataset.field;
        let val = e.target.value;
        if (e.target.type === 'number') val = parseFloat(val) || 0;
        this.actions[idx][field] = val;
      });
    });
    list.querySelectorAll('.act-del').forEach(el => {
      el.addEventListener('click', (e) => {
        this.actions.splice(e.target.dataset.idx, 1);
        this.renderActions();
      });
    });
  }

  updateBalances() {
    if (!this.characterData || !this.characterData.economy) return;
    const { gold, silver, copper } = this.characterData.economy;
    document.getElementById('item-editor-gold-balance').innerText = gold;
    document.getElementById('item-editor-silver-balance').innerText = silver;
    document.getElementById('item-editor-copper-balance').innerText = copper;
  }

  validatePayment() {
    if (!this.willPay || this.mode === 'edit') {
      document.getElementById('item-editor-btn-save').disabled = false;
      document.getElementById('item-editor-btn-save').classList.remove('opacity-50', 'cursor-not-allowed');
      document.getElementById('item-editor-payment-error').classList.add('hidden');
      return true;
    }

    if (!this.characterData || !this.characterData.economy) return false;
    const { gold, silver, copper } = this.characterData.economy;

    const inputGold = parseInt(document.getElementById('item-editor-gold').value) || 0;
    const inputSilver = parseInt(document.getElementById('item-editor-silver').value) || 0;
    const inputCopper = parseInt(document.getElementById('item-editor-copper').value) || 0;

    const isValid = inputGold >= 0 && inputSilver >= 0 && inputCopper >= 0 &&
                    inputGold <= gold && inputSilver <= silver && inputCopper <= copper;

    const errorMsg = document.getElementById('item-editor-payment-error');
    const saveBtn = document.getElementById('item-editor-btn-save');

    if (!isValid) {
      errorMsg.classList.remove('hidden');
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      errorMsg.classList.add('hidden');
      saveBtn.disabled = false;
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    return isValid;
  }

  async handleSave() {
    if (this.willPay && !this.validatePayment()) return;

    let inputName = document.getElementById('item-editor-name').value.trim();
    if (!inputName) {
      inputName = this.mode === 'edit' ? this.originalName : "Nowy Przedmiot";
    }

    const itemData = {
      name: inputName,
      item_type: document.getElementById('item-editor-type').value,
      description: document.getElementById('item-editor-desc').value,
      space_taken: parseFloat(document.getElementById('item-editor-space').value) || 0.0,
      location: "BACKPACK", // Default to backpack for new items
      modifiers: this.modifiers,
      actions: this.actions,
      effect_value: document.getElementById('item-editor-armor-effect').value,
      uses_durability: document.getElementById('item-editor-armor-uses').value,
      cost_type: document.getElementById('item-editor-armor-cost-type').value
    };

    if (this.mode === 'edit') {
      // Keep old location if editing
      const oldItem = await eel.get_character()().then(c => c.inventory[this.editIndex]);
      itemData.location = oldItem.location;

      const charData = await eel.edit_inventory_item(this.editIndex, itemData)();
      document.dispatchEvent(new CustomEvent('characterUpdated', { detail: charData }));
      this.close();

    } else {
      let payment = { gold: 0, silver: 0, copper: 0 };
      if (this.willPay) {
        payment = {
          gold: parseInt(document.getElementById('item-editor-gold').value) || 0,
          silver: parseInt(document.getElementById('item-editor-silver').value) || 0,
          copper: parseInt(document.getElementById('item-editor-copper').value) || 0
        };
      }
      
      const charData = await eel.add_item_to_inventory(itemData, payment)();
      document.dispatchEvent(new CustomEvent('characterUpdated', { detail: charData }));
      this.close();
    }
  }

  show() {
    const backdrop = document.getElementById('item-editor-modal-backdrop');
    const content = document.getElementById('item-editor-modal-content');

    backdrop.classList.remove('hidden');
    setTimeout(() => {
      backdrop.classList.remove('opacity-0');
      content.classList.remove('scale-95');
    }, 10);
    this.isOpen = true;
  }

  close() {
    const backdrop = document.getElementById('item-editor-modal-backdrop');
    const content = document.getElementById('item-editor-modal-content');

    backdrop.classList.add('opacity-0');
    content.classList.add('scale-95');

    setTimeout(() => {
      backdrop.classList.add('hidden');
      this.isOpen = false;
    }, 300);
  }
}
