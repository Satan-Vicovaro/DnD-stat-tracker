export class InventoryComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.characterData = null;
  }

  async init() {
    const response = await fetch('/components/inventory.html');
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    document.addEventListener('characterUpdated', (e) => {
      this.characterData = e.detail;
      this.render();
    });

    document.getElementById('btn-add-custom-item').addEventListener('click', () => {
      if (window.itemEditorModal) {
        window.itemEditorModal.openNew();
      }
    });

    this.characterData = await eel.get_character()();
    this.render();
  }

  async setLocation(index, newLocation) {
    const item = this.characterData.inventory[index];
    if (item.location === newLocation) return;

    item.location = newLocation;
    this.characterData = await eel.edit_inventory_item(index, item)();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
  }

  async dropItem(index) {
    if (confirm("Czy na pewno chcesz wyrzucić ten przedmiot?")) {
      this.characterData = await eel.remove_inventory_item(index)();
      document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
    }
  }

  render() {
    if (!this.characterData) return;

    // Render Space Bar
    const space = this.characterData.inventory_space;
    if (space) {
      const spaceText = document.getElementById('inventory-space-text');
      const spaceBar = document.getElementById('inventory-space-bar');

      spaceText.innerText = `${space.used.toFixed(1)} / ${space.max.toFixed(1)}`;

      const pct = Math.min(100, Math.max(0, (space.used / space.max) * 100));
      spaceBar.style.width = `${pct}%`;

      if (space.used > space.max) {
        spaceBar.classList.replace('bg-indigo-500', 'bg-red-500');
        spaceText.classList.replace('text-white', 'text-red-500');
      } else {
        spaceBar.classList.replace('bg-red-500', 'bg-indigo-500');
        spaceText.classList.replace('text-red-500', 'text-white');
      }
    }

    // Render Lists
    const eqList = document.getElementById('inventory-list-equipped');
    const bpList = document.getElementById('inventory-list-backpack');
    const wgList = document.getElementById('inventory-list-wagon');

    let eqHtml = "", bpHtml = "", wgHtml = "";
    let eqCount = 0, bpCount = 0, wgCount = 0;

    const inventory = this.characterData.inventory || [];

    inventory.forEach((item, index) => {
      const itemHtml = this.renderItemCard(item, index);
      if (item.location === "EQUIPPED") { eqHtml += itemHtml; eqCount++; }
      else if (item.location === "BACKPACK") { bpHtml += itemHtml; bpCount++; }
      else if (item.location === "WAGON") { wgHtml += itemHtml; wgCount++; }
    });

    eqList.innerHTML = eqHtml;
    bpList.innerHTML = bpHtml;
    wgList.innerHTML = wgHtml;

    document.getElementById('inventory-empty-equipped').classList.toggle('hidden', eqCount > 0);
    document.getElementById('inventory-empty-backpack').classList.toggle('hidden', bpCount > 0);
    document.getElementById('inventory-empty-wagon').classList.toggle('hidden', wgCount > 0);

    // Bind item actions (Move, Edit, Drop)
    this.bindItemActions();
  }

  renderItemCard(item, index) {
    let modsHtml = "";
    if (item.modifiers && item.modifiers.length > 0) {
      modsHtml = `<div class="mt-2 flex flex-wrap gap-1">` +
        item.modifiers.map(m => `<span class="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30">${m.stat_name}: ${m.value > 0 ? '+' + m.value : m.value}</span>`).join('') +
        `</div>`;
    }

    const typeColor = item.item_type === "Weapon" ? "text-rose-400" : (item.item_type === "Armor" ? "text-emerald-400" : "text-gray-400");

    return `
      <div class="bg-gray-800 rounded p-3 border border-gray-700 shadow-sm relative group/card">
        <div class="flex justify-between items-start">
          <div class="flex-1 pr-2">
            <h4 class="font-bold text-white leading-tight">${item.name}</h4>
            <div class="text-[10px] font-bold uppercase tracking-wider ${typeColor} mb-1">${item.item_type} &bull; <span class="text-gray-500">Masa: ${item.space_taken}</span></div>
            ${item.description ? `<p class="text-xs text-gray-400 italic mt-1 line-clamp-2">${item.description}</p>` : ''}
            ${modsHtml}
          </div>
        </div>
        
        <!-- Hover actions overlay -->
        <div class="absolute inset-0 bg-gray-900/95 rounded flex flex-col justify-center items-center opacity-0 group-hover/card:opacity-100 transition-opacity p-2 gap-2">
          
          <select data-action="move" data-index="${index}" class="bg-gray-800 text-xs text-white border border-gray-600 rounded px-2 py-1 focus:outline-none w-full max-w-[150px]">
            <option value="EQUIPPED" ${item.location === "EQUIPPED" ? "selected" : ""}>Założone</option>
            <option value="BACKPACK" ${item.location === "BACKPACK" ? "selected" : ""}>Do Plecaka</option>
            <option value="WAGON" ${item.location === "WAGON" ? "selected" : ""}>Do Wozu</option>
          </select>
          
          <div class="flex gap-2 w-full max-w-[150px] justify-between">
            <button data-action="edit" data-index="${index}" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded w-full border border-indigo-500 transition-colors">Edytuj</button>
            <button data-action="drop" data-index="${index}" class="text-xs bg-red-900/60 hover:bg-red-800 text-red-200 px-2 py-1 rounded w-full border border-red-700 transition-colors">Wyrzuć</button>
          </div>

        </div>
      </div>
    `;
  }

  bindItemActions() {
    const container = document.getElementById(this.containerId);

    container.querySelectorAll('select[data-action="move"]').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        this.setLocation(index, e.target.value);
      });
    });

    container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        const item = this.characterData.inventory[index];
        if (window.itemEditorModal) {
          window.itemEditorModal.openEdit(index, item);
        }
      });
    });

    container.querySelectorAll('button[data-action="drop"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        this.dropItem(index);
      });
    });
  }
}
