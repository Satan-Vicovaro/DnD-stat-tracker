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

    // Manual Adjustments - Base Health
    document.getElementById('btn-heal-health').addEventListener('click', async () => {
        const amt = parseInt(document.getElementById('fight-manual-health-amount').value) || 0;
        if (amt > 0) {
            this.characterData = await eel.adjust_health(amt)();
            document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
        }
    });
    document.getElementById('btn-damage-health').addEventListener('click', async () => {
        const amt = parseInt(document.getElementById('fight-manual-health-amount').value) || 0;
        if (amt > 0) {
            this.characterData = await eel.adjust_health(-amt)();
            document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
        }
    });

    // Manual Adjustments - Armor Health
    document.getElementById('btn-heal-armor').addEventListener('click', async () => {
        const amt = parseInt(document.getElementById('fight-manual-armor-amount').value) || 0;
        if (amt > 0) {
            this.characterData = await eel.adjust_armor_health(amt)();
            document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
        }
    });
    document.getElementById('btn-damage-armor').addEventListener('click', async () => {
        const amt = parseInt(document.getElementById('fight-manual-armor-amount').value) || 0;
        if (amt > 0) {
            this.characterData = await eel.adjust_armor_health(-amt)();
            document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
        }
    });
  }

  render() {
    if (!this.characterData) return;

    // 1. Render Health Bars
    const char = this.characterData;
    const split = char.health_split;
    if (split) {
      // Render Base HP
      document.getElementById('fight-base-hp-text').innerText = `${split.base_current_hp} / ${split.base_max_hp}`;
      const hpPct = split.base_max_hp > 0 ? (split.base_current_hp / split.base_max_hp) * 100 : 0;
      document.getElementById('fight-base-hp-bar').style.width = `${Math.max(0, hpPct)}%`;
      
      // Render Armor HP (Shield)
      const armorBar = document.getElementById('fight-armor-hp-bar');
      document.getElementById('fight-armor-hp-value').innerText = `${split.armor_current_hp} / ${split.armor_max_hp}`;
      const armorPct = split.armor_max_hp > 0 ? (split.armor_current_hp / split.armor_max_hp) * 100 : 0;
      armorBar.style.width = `${armorPct}%`;


      // Mitigation Badge
      const mitigationBadge = document.getElementById('fight-mitigation-badge');
      if (mitigationBadge) {
        mitigationBadge.innerText = split.current_mitigation || 0;
      }
    }

    // 2. Render Weapons & Consumables
    const weaponsList = document.getElementById('fight-weapons-list');
    const weaponsEmpty = document.getElementById('fight-weapons-empty');
    const consList = document.getElementById('fight-consumables-list');
    const consEmpty = document.getElementById('fight-consumables-empty');
    
    const inventory = this.characterData.inventory || [];

    let wHtml = '';
    let wCount = 0;
    let cHtml = '';
    let cCount = 0;

    inventory.forEach((item, originalIndex) => {
      if (item.item_type === 'Weapon') {
        wHtml += this.renderItemCard(item, originalIndex, false);
        wCount++;
      }
      
      const hasConsumable = item.consumable_effects ? Object.keys(item.consumable_effects).length > 0 : false;
      if (hasConsumable) {
        cHtml += this.renderItemCard(item, originalIndex, true);
        cCount++;
      }
    });

    if (weaponsList) {
      weaponsList.innerHTML = wHtml;
      if (weaponsEmpty) weaponsEmpty.classList.toggle('hidden', wCount > 0);
    }
    
    if (consList) {
      consList.innerHTML = cHtml;
      if (consEmpty) consEmpty.classList.toggle('hidden', cCount > 0);
    }

    this.bindDynamicActions();
  }

  bindDynamicActions() {
    const container = document.getElementById(this.containerId);
    container.querySelectorAll('button[data-action="fight-use"]').forEach(btn => {
      // remove old listener if any (easiest way is to clone or just assume they are new DOM elements)
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        const item = this.characterData.inventory[index];
        
        let overrideValue = null;
        if (item.consumable_effects && item.consumable_effects.dynamic_heal) {
            const val = prompt(`Rzuć kośćmi (lub wpisz wartość leczenia) dla: ${item.name}`);
            if (val === null) return; // cancelled
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed < 0) {
                alert("Wprowadzono niepoprawną wartość.");
                return;
            }
            overrideValue = parsed;
        }

        this.characterData = await eel.use_inventory_item(index, overrideValue)();
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
      });
    });
  }

  renderItemCard(item, index, isConsumable = false) {
    const typeColor = item.item_type === "Weapon" ? "text-rose-400" : (item.item_type === "Armor" ? "text-emerald-400" : "text-gray-400");
    
    // Map internal location to human readable tag
    const locMap = { "EQUIPPED": "W Rękach", "BACKPACK": "Plecak (2 PA)", "BACK": "Plecy (1 PA)", "QUIVER": "Kołczan", "WAGON": "Wóz" };
    const locTag = locMap[item.location] || item.location;
    const locBadge = `<span class="bg-indigo-900/50 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/50">[${locTag}]</span>`;

    // Actions if weapon
    let actionsHtml = '';
    if (!isConsumable && item.item_type === "Weapon" && item.actions && item.actions.length > 0) {
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

    // Consumable specific UI
    let consHtml = '';
    if (isConsumable) {
       const usesBadge = item.max_uses > 0 ? `<span class="bg-teal-900/80 text-teal-300 text-[9px] px-1.5 py-0.5 rounded border border-teal-500/50">Użycia: ${item.current_uses}/${item.max_uses}</span>` : "";
       consHtml = `
         <div class="mt-3 flex justify-between items-center gap-2">
           ${usesBadge}
           <button data-action="fight-use" data-index="${index}" class="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded border border-teal-500 transition-colors shadow-[0_0_8px_rgba(20,184,166,0.3)]">Użyj</button>
         </div>
       `;
    }

    return `
      <div class="bg-gray-700/30 rounded p-3 border border-gray-600 relative transition-colors">
        <div class="flex justify-between items-start">
          <h4 class="font-bold text-white leading-tight">${item.name}</h4>
          ${locBadge}
        </div>
        <div class="text-[10px] font-bold uppercase tracking-wider ${typeColor} mb-1">
            ${item.item_type}
        </div>
        ${item.description ? `<p class="text-xs text-gray-400 italic mt-1">${item.description}</p>` : ''}
        ${actionsHtml}
        ${consHtml}
      </div>
    `;
  }
}
