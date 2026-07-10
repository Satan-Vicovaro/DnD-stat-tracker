export class FightComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.characterData = null;
  }

  async init() {
    const response = await fetch('/components/fight.html');
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    document.addEventListener('characterUpdated', (e) => {
      this.characterData = e.detail;
      this.render();
    });

    this.bindActions();

    this.characterData = await eel.get_character()();
    this.render();
  }

  bindActions() {
    const btnApply = document.getElementById('btn-apply-damage');
    btnApply.addEventListener('click', async () => {
      const amountInput = document.getElementById('fight-damage-amount');
      const amount = parseInt(amountInput.value) || 0;
      
      if (amount <= 0) return;

      const typeRadio = document.querySelector('input[name="fight_damage_type"]:checked');
      const damageType = typeRadio ? typeRadio.value : 'physical';

      // Call API
      this.characterData = await eel.apply_damage(damageType, amount)();
      document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));

      // Optional visual feedback
      btnApply.classList.add('bg-rose-400');
      setTimeout(() => btnApply.classList.remove('bg-rose-400'), 200);
    });
  }

  render() {
    if (!this.characterData) return;

    // 1. Render Health Bars
    const split = this.characterData.health_split;
    if (split) {
      // Armor
      const armorText = document.getElementById('fight-armor-hp-text');
      const armorBar = document.getElementById('fight-armor-hp-bar');
      armorText.innerText = `${split.armor_current_hp} / ${split.armor_max_hp}`;
      const armorPct = split.armor_max_hp > 0 ? (split.armor_current_hp / split.armor_max_hp) * 100 : 0;
      armorBar.style.width = `${armorPct}%`;

      // Base Health
      const baseText = document.getElementById('fight-base-hp-text');
      const baseBar = document.getElementById('fight-base-hp-bar');
      baseText.innerText = `${split.base_current_hp} / ${split.base_max_hp}`;
      const basePct = split.base_max_hp > 0 ? (split.base_current_hp / split.base_max_hp) * 100 : 0;
      baseBar.style.width = `${basePct}%`;

      // Mitigation Badge
      const mitigationBadge = document.getElementById('fight-mitigation-badge');
      if (mitigationBadge) {
        mitigationBadge.innerText = split.current_mitigation || 0;
      }
    }

    // 2. Render Equipped Items
    const equippedList = document.getElementById('fight-equipped-list');
    const emptyMsg = document.getElementById('fight-equipped-empty');
    
    const inventory = this.characterData.inventory || [];
    const equippedItems = inventory.filter(i => i.location === 'EQUIPPED');

    if (equippedItems.length === 0) {
      equippedList.innerHTML = '';
      emptyMsg.classList.remove('hidden');
    } else {
      emptyMsg.classList.add('hidden');
      let html = '';
      equippedItems.forEach((item, originalIndex) => {
        // We find the real index to preserve compatibility if we wanted to edit, but for display it's not strictly necessary.
        html += this.renderItemCard(item);
      });
      equippedList.innerHTML = html;
    }
  }

  renderItemCard(item) {
    const typeColor = item.item_type === "Weapon" ? "text-rose-400" : (item.item_type === "Armor" ? "text-emerald-400" : "text-gray-400");
    
    // Actions if weapon
    let actionsHtml = '';
    if (item.item_type === "Weapon" && item.actions && item.actions.length > 0) {
      actionsHtml = `<div class="mt-3 flex flex-col gap-2">` + item.actions.map(a => `
        <div class="bg-gray-900/60 rounded p-2 border border-gray-700/50">
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm font-bold text-rose-300">${a.action_name}</span>
            <span class="text-xs font-mono text-gray-500">Koszt: ${a.action_cost} PA</span>
          </div>
          <div class="text-[11px] text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
            ${a.hit_roll ? `<span>🎯 Trafienie: <span class="text-white">${a.hit_roll}</span></span>` : ''}
            ${a.damage_roll ? `<span>🩸 Obrażenia: <span class="text-white">${a.damage_roll}</span></span>` : ''}
          </div>
        </div>
      `).join('') + `</div>`;
    }

    return `
      <div class="bg-gray-700/30 rounded p-3 border border-gray-600 relative transition-colors">
        <h4 class="font-bold text-white leading-tight">${item.name}</h4>
        <div class="text-[10px] font-bold uppercase tracking-wider ${typeColor} mb-1">
            ${item.item_type}
        </div>
        ${item.description ? `<p class="text-xs text-gray-400 italic mt-1">${item.description}</p>` : ''}
        ${actionsHtml}
      </div>
    `;
  }
}
