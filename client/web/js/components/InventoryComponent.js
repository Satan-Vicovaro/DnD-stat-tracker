export class InventoryComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.characterData = null;
    this.wagonItems = [];
  }

  async init() {
    const response = await fetch("/components/inventory.html");
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    document.addEventListener("characterUpdated", (e) => {
      this.characterData = e.detail;
      this.render();
    });

    document.addEventListener("wagonUpdated", (e) => {
      this.wagonItems = e.detail || [];
      this.render();
    });

    document.addEventListener("forceWagonRefresh", () => {
      this.fetchWagon();
    });

    document
      .getElementById("btn-add-custom-item")
      .addEventListener("click", () => {
        if (window.itemEditorModal) {
          window.itemEditorModal.openNew();
        }
      });

    this.characterData = await eel.get_character()();
    this.fetchWagon();
    this.render();
  }

  async fetchWagon() {
    try {
      let domain = localStorage.getItem("syncDomain") || "localhost:8000";
      domain = domain.trim().replace(/^https?:\/\//i, "").replace(/^wss?:\/\//i, "").split("/")[0];
      const protocol = (window.location.protocol === "https:" || domain.includes("https")) ? "https:" : "http:";
      const url = `${protocol}//${domain}/api/wagon`;
      
      const res = await fetch(url);
      if (res.ok) {
        this.wagonItems = await res.json();
        this.render();
      }
    } catch (e) {
      console.warn("Failed to fetch initial wagon state:", e);
    }
  }

  async setLocation(index, newLocation) {
    const item = this.characterData.inventory[index];
    if (item.location === newLocation) return;

    if (newLocation === "WAGON") {
      try {
        let domain = localStorage.getItem("syncDomain") || "localhost:8000";
        domain = domain.trim().replace(/^https?:\/\//i, "").replace(/^wss?:\/\//i, "").split("/")[0];
        const protocol = (window.location.protocol === "https:" || domain.includes("https")) ? "https:" : "http:";
        const url = `${protocol}//${domain}/api/wagon/add`;
        
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item)
        });
        
        if (res.ok) {
          // Remove from local inventory
          this.characterData = await eel.remove_inventory_item(index)();
          document.dispatchEvent(
            new CustomEvent("characterUpdated", { detail: this.characterData }),
          );
        } else {
          alert("Nie udało się dodać przedmiotu do wozu.");
          this.render(); // Reset the select dropdown
        }
      } catch (e) {
        console.error("Failed to move item to wagon", e);
        alert("Błąd połączenia z serwerem.");
        this.render(); // Reset the select dropdown
      }
      return;
    }

    item.location = newLocation;
    this.characterData = await eel.edit_inventory_item(index, item)();
    document.dispatchEvent(
      new CustomEvent("characterUpdated", { detail: this.characterData }),
    );
  }

  async dropItem(index) {
    if (confirm("Czy na pewno chcesz wyrzucić ten przedmiot?")) {
      this.characterData = await eel.remove_inventory_item(index)();
      document.dispatchEvent(
        new CustomEvent("characterUpdated", { detail: this.characterData }),
      );
    }
  }

  render() {
    if (!this.characterData) return;

    const spaces = this.characterData.inventory_space;
    if (spaces) {
      // Helper to update a space bar
      const updateBar = (idPrefix, spaceData, colorClass) => {
        const spaceText = document.getElementById(
          `inventory-space-${idPrefix}-text`,
        );
        const spaceBar = document.getElementById(
          `inventory-space-${idPrefix}-bar`,
        );
        if (!spaceText || !spaceBar) return;

        spaceText.innerText = `${spaceData.used.toFixed(1)} / ${spaceData.max.toFixed(1)}`;
        const pct = Math.min(
          100,
          Math.max(0, (spaceData.used / (spaceData.max || 1)) * 100),
        );
        spaceBar.style.width = `${pct}%`;

        // Remove existing colors
        spaceBar.className = `h-2 rounded-full transition-all duration-500`;
        spaceText.className = `font-mono text-sm font-bold`;

        if (spaceData.used > spaceData.max) {
          spaceBar.classList.add("bg-red-500");
          spaceText.classList.add("text-red-500");
        } else {
          spaceBar.classList.add(`bg-${colorClass}`);
          spaceText.classList.add("text-white");
        }
      };

      updateBar("quick", spaces.quick, "emerald-500");
      updateBar("backpack", spaces.backpack, "indigo-500");
      updateBar("back", spaces.back, "blue-500");

      const quiverSection = document.getElementById("section-quiver");
      if (spaces.quiver) {
        quiverSection.classList.remove("hidden");
        updateBar("quiver", spaces.quiver, "rose-500");
      }
    }

    // Render Lists
    const eqList = document.getElementById("inventory-list-equipped");
    const bpList = document.getElementById("inventory-list-backpack");
    const backList = document.getElementById("inventory-list-back");
    const quiverList = document.getElementById("inventory-list-quiver");
    const stashList = document.getElementById("inventory-list-stash");
    const clothesList = document.getElementById("inventory-list-clothes");
    const wgList = document.getElementById("inventory-list-wagon");

    let eqHtml = "",
      bpHtml = "",
      backHtml = "",
      quiverHtml = "",
      stashHtml = "",
      clothesHtml = "",
      wgHtml = "";
    let eqCount = 0,
      bpCount = 0,
      backCount = 0,
      quiverCount = 0,
      stashCount = 0,
      clothesCount = 0,
      wgCount = 0;
    let hasClothesInInventory = false;

    const inventory = this.characterData.inventory || [];

    inventory.forEach((item, index) => {
      if (item.is_clothes) {
        hasClothesInInventory = true;
      }
      const itemHtml = this.renderItemCard(item, index);
      if (item.location === "EQUIPPED") {
        eqHtml += itemHtml;
        eqCount++;
      } else if (item.location === "BACKPACK") {
        bpHtml += itemHtml;
        bpCount++;
      } else if (item.location === "BACK") {
        backHtml += itemHtml;
        backCount++;
      } else if (item.location === "QUIVER") {
        quiverHtml += itemHtml;
        quiverCount++;
      } else if (item.location === "CLOTHES") {
        clothesHtml += itemHtml;
        clothesCount++;
      } else if (item.location === "STASH") {
        stashHtml += itemHtml;
        stashCount++;
      }
    });

    (this.wagonItems || []).forEach((item) => {
      wgHtml += this.renderWagonItemCard(item);
      wgCount++;
    });

    if (eqList) eqList.innerHTML = eqHtml;
    if (bpList) bpList.innerHTML = bpHtml;
    if (backList) backList.innerHTML = backHtml;
    if (quiverList) quiverList.innerHTML = quiverHtml;
    if (clothesList) clothesList.innerHTML = clothesHtml;
    if (stashList) stashList.innerHTML = stashHtml;
    if (wgList) wgList.innerHTML = wgHtml;

    document
      .getElementById("inventory-empty-equipped")
      ?.classList.toggle("hidden", eqCount > 0);
    document
      .getElementById("inventory-empty-backpack")
      ?.classList.toggle("hidden", bpCount > 0);
    document
      .getElementById("inventory-empty-back")
      ?.classList.toggle("hidden", backCount > 0);
    document
      .getElementById("inventory-empty-quiver")
      ?.classList.toggle("hidden", quiverCount > 0);
    document
      .getElementById("inventory-empty-clothes")
      ?.classList.toggle("hidden", clothesCount > 0);
    document
      .getElementById("inventory-empty-stash")
      ?.classList.toggle("hidden", stashCount > 0);
    document
      .getElementById("inventory-empty-wagon")
      ?.classList.toggle("hidden", wgCount > 0);

    const clothesSection = document.getElementById("section-clothes");
    if (clothesSection) {
      if (hasClothesInInventory) {
        clothesSection.classList.remove("hidden");
      } else {
        clothesSection.classList.add("hidden");
      }
    }

    // Bind item actions (Move, Edit, Drop)
    this.bindItemActions();
  }

  renderItemCard(item, index) {
    let modsHtml = "";
    if (item.modifiers && item.modifiers.length > 0) {
      modsHtml =
        `<div class="mt-2 flex flex-wrap gap-1">` +
        item.modifiers
          .map(
            (m) =>
              `<span class="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30">${m.stat_name}: ${m.value > 0 ? "+" + m.value : m.value}</span>`,
          )
          .join("") +
        `</div>`;
    }

    const typeColor =
      item.item_type === "Weapon"
        ? "text-rose-400"
        : item.item_type === "Armor"
          ? "text-emerald-400"
          : "text-gray-400";
    const nameLower = (item.name || "").toLowerCase();

    // Active Container logic
    const isActive = item.is_active_container;
    const borderClass = isActive
      ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
      : "border-gray-700 shadow-sm";
    const spaceText = isActive
      ? `<span class="text-amber-400 font-bold">Daje miejsce: ${item.granted_space}</span>`
      : `<span class="text-gray-500">Masa: ${item.space_taken}</span>`;
    const activeBadge = isActive
      ? `<span class="bg-amber-900/80 text-amber-300 text-[9px] px-1.5 py-0.5 rounded border border-amber-500/50">AKTYWNE POJEMNOŚĆ</span>`
      : "";

    const hasConsumable = item.consumable_effects
      ? Object.keys(item.consumable_effects).length > 0
      : false;
    const usesBadge =
      hasConsumable && item.max_uses > 0
        ? `<span class="bg-teal-900/80 text-teal-300 text-[9px] px-1.5 py-0.5 rounded border border-teal-500/50">Użycia: ${item.current_uses}/${item.max_uses}</span>`
        : "";

    const showQuiverOption = true;

    const providesSpace =
      item.modifiers &&
      item.modifiers.some((m) => {
        const match = [
          "backpack_space",
          "quick_space",
          "quiver_space",
          "back_space",
        ].includes(m.stat_name);
        return match;
      });

    return `
      <div class="bg-gray-800 rounded p-3 border ${borderClass} transition-colors">
        <div class="flex justify-between items-start gap-4">
          <!-- Left side: info -->
          <div class="flex-1 min-w-0 pr-2">
            <h4 class="font-bold text-white leading-tight">${item.name}${item.quantity > 1 ? ` <span class="text-indigo-400 font-bold ml-1 text-sm">(x${item.quantity})</span>` : ""}</h4>
            <div class="text-[10px] font-bold uppercase tracking-wider ${typeColor} mb-1 flex items-center flex-wrap gap-1 mt-1">
                <span>${item.item_type}</span> <span class="text-gray-500">&bull;</span> ${spaceText} ${activeBadge} ${usesBadge}
            </div>
            ${
              item.description
                ? item.description.includes("||")
                  ? `<ul class="list-disc list-outside ml-4 mt-1.5 text-[11px] text-gray-400 italic leading-snug">${item.description
                      .split("||")
                      .map((p) => `<li>${p.trim()}</li>`)
                      .join("")}</ul>`
                  : `<p class="text-[11px] text-gray-400 italic mt-1.5 leading-snug">${item.description}</p>`
                : ""
            }
            ${modsHtml}
          </div>
          
          <!-- Right side: actions -->
          <div class="flex flex-col items-stretch justify-start gap-2 shrink-0 w-[140px] bg-gray-900/40 p-2 rounded border border-gray-700/50">
            <select data-action="move" data-index="${index}" class="bg-gray-800 text-[10px] text-white border border-gray-600 rounded px-1.5 py-1 focus:outline-none w-full font-semibold cursor-pointer">
              <option value="EQUIPPED" ${item.location === "EQUIPPED" ? "selected" : ""}>Podręczne</option>
              <option value="BACKPACK" ${item.location === "BACKPACK" ? "selected" : ""}>Plecak</option>
              <option value="BACK" ${item.location === "BACK" ? "selected" : ""}>Plecy</option>
              ${showQuiverOption ? `<option value="QUIVER" ${item.location === "QUIVER" ? "selected" : ""}>Kołczan</option>` : ""}
              ${item.is_clothes ? `<option value="CLOTHES" ${item.location === "CLOTHES" ? "selected" : ""}>Założone (Ubranie)</option>` : ""}
              <option value="STASH" ${item.location === "STASH" ? "selected" : ""}>Schowek</option>
              <option value="WAGON" class="text-yellow-400 font-bold">Do Wozu (Wspólny)</option>
            </select>
            
            ${hasConsumable ? `<button data-action="use" data-index="${index}" class="text-[10px] font-bold bg-teal-600 hover:bg-teal-500 text-white px-2 py-1.5 rounded w-full border border-teal-500 transition-colors shadow-sm">Użyj przedmiotu</button>` : ""}
            
            ${providesSpace ? `<button data-action="toggle_equip" data-index="${index}" class="text-[10px] font-bold ${item.is_equipped ? "bg-amber-600 hover:bg-amber-500 border-amber-500" : "bg-gray-600 hover:bg-gray-500 border-gray-500"} text-white px-2 py-1.5 rounded w-full border transition-colors shadow-sm mt-1 mb-0.5">${item.is_equipped ? "Zdejmij" : "Załóż"}</button>` : ""}
            
            <div class="flex gap-1 w-full justify-between mt-0.5 pt-1.5 border-t border-gray-700/50">
              <button data-action="edit" data-index="${index}" class="flex-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-1 py-1 rounded border border-indigo-500 transition-colors">Edytuj</button>
              <button data-action="drop" data-index="${index}" class="flex-1 text-[10px] font-bold bg-red-900/60 hover:bg-red-800 text-red-200 px-1 py-1 rounded border border-red-700 transition-colors">Wyrzuć</button>
            </div>
          </div>
        </div>

        <!-- Full width bottom section for actions (ability cards) -->
        ${(() => {
          if (item.actions && item.actions.length > 0) {
            return `
            <details class="mt-3 group/actions border-t border-gray-700/60 pt-3">
              <summary class="text-xs font-bold text-indigo-400 uppercase tracking-wider cursor-pointer select-none flex items-center gap-2 outline-none">
                <svg class="w-3 h-3 transition-transform group-open/actions:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"></path></svg>
                Akcje (${item.actions.length})
              </summary>
              <div class="flex flex-wrap gap-2 mt-2">
                ${item.actions
                  .map((act) => {
                    let descHtml = "";
                    if (act.description) {
                      const parts = act.description
                        .split("||")
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      if (parts.length === 1) descHtml = parts[0];
                      else
                        descHtml = `<ul class="list-disc list-outside space-y-0.5 ml-4">${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
                    }
                    return `
                   <div class="bg-black/60 rounded-md p-2.5 border border-slate-600 flex-1 min-w-[200px] max-w-xs shadow-sm">
                     <div class="flex justify-between items-center text-indigo-200 mb-2 pb-1 border-b border-slate-600/60">
                       <span class="text-sm font-bold tracking-wide">${act.action_name}</span>
                       <span class="text-emerald-400 font-bold text-[10px] bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-500/30">AP: ${act.action_cost}</span>
                     </div>
                     <div class="flex flex-wrap gap-1.5 mb-2">
                       <span class="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[8px] font-bold mr-1">Odp:</span> <span class="font-bold text-white text-[10px]">${act.card_value !== undefined ? act.card_value : "&nbsp;"}</span></span>
                       <span class="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[8px] font-bold mr-1">Zas:</span> <span class="font-bold text-white text-[10px]">${act.range || act.range_str || "-"}</span></span>
                       <span class="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[8px] font-bold mr-1">Traf:</span> <span class="font-bold text-amber-400 text-[10px]">${act.hit_roll || "-"}</span></span>
                       <span class="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[8px] font-bold mr-1">Obr:</span> <span class="font-bold text-rose-400 text-[10px]">${act.damage_roll || "-"}</span></span>
                       ${act.targets ? `<span class="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[8px] font-bold mr-1">Cel:</span> <span class="font-bold text-indigo-300 text-[10px]">${act.targets}</span></span>` : ""}
                       ${act.turn_execution ? `<span class="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[8px] font-bold mr-1">Tura:</span> <span class="font-bold text-teal-300 text-[10px]">${act.turn_execution}</span></span>` : ""}
                     </div>
                     <div class="text-slate-200 italic text-[10px] leading-relaxed border-t border-slate-600/40 pt-1.5 mt-0.5 font-medium">${descHtml}</div>
                   </div>
                   `;
                  })
                  .join("")}
              </div>
            </details>
            `;
          }
          return "";
        })()}
      </div>
    `;
  }

  renderWagonItemCard(item) {
    const typeColor =
      item.item_type === "Weapon"
        ? "text-rose-400"
        : item.item_type === "Armor"
          ? "text-emerald-400"
          : "text-gray-400";

    return `
      <div class="bg-gray-800 rounded p-3 border border-yellow-700/50 shadow-sm transition-colors opacity-90">
        <div class="flex justify-between items-start gap-4">
          <div class="flex-1 min-w-0 pr-2">
            <h4 class="font-bold text-white leading-tight">${item.name}${item.quantity > 1 ? ` <span class="text-indigo-400 font-bold ml-1 text-sm">(x${item.quantity})</span>` : ""}</h4>
            <div class="text-[10px] font-bold uppercase tracking-wider ${typeColor} mb-1 flex items-center flex-wrap gap-1 mt-1">
                <span>${item.item_type}</span> <span class="text-gray-500">&bull;</span> <span class="text-gray-500">Masa: ${item.space_taken}</span>
            </div>
            ${
              item.description
                ? item.description.includes("||")
                  ? `<ul class="list-disc list-outside ml-4 mt-1.5 text-[11px] text-gray-400 italic leading-snug">${item.description
                      .split("||")
                      .map((p) => `<li>${p.trim()}</li>`)
                      .join("")}</ul>`
                  : `<p class="text-[11px] text-gray-400 italic mt-1.5 leading-snug">${item.description}</p>`
                : ""
            }
          </div>
          <div class="flex flex-col items-stretch justify-start gap-2 shrink-0 w-[100px]">
            <button data-action="take_from_wagon" data-id="${item.item_id}" class="text-[10px] font-bold bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-2 rounded border border-yellow-500 transition-colors shadow-sm">Zabierz z wozu</button>
          </div>
        </div>
      </div>
    `;
  }

  bindItemActions() {
    const container = document.getElementById(this.containerId);

    container
      .querySelectorAll('select[data-action="move"]')
      .forEach((select) => {
        select.addEventListener("change", (e) => {
          const index = parseInt(e.target.getAttribute("data-index"));
          this.setLocation(index, e.target.value);
        });
      });

    container
      .querySelectorAll('button[data-action="toggle_equip"]')
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const idx = parseInt(e.currentTarget.dataset.index, 10);
          try {
            const res = await window.eel.toggle_equip_inventory_item(idx)();
            if (!res.success) {
              alert(res.message);
            } else {
              this.characterData = res.character;
              document.dispatchEvent(
                new CustomEvent("characterUpdated", {
                  detail: this.characterData,
                }),
              );
              this.render();
            }
          } catch (err) {
            console.error("Failed to toggle equip", err);
          }
        });
      });

    container.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"));
        const item = this.characterData.inventory[index];
        if (window.itemEditorModal) {
          window.itemEditorModal.openEdit(index, item);
        }
      });
    });

    container.querySelectorAll('button[data-action="drop"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"));
        this.dropItem(index);
      });
    });

    container.querySelectorAll('button[data-action="use"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"));
        const item = this.characterData.inventory[index];

        let overrideValue = null;
        if (item.consumable_effects && item.consumable_effects.dynamic_heal) {
          const val = prompt(
            `Rzuć kośćmi (lub wpisz wartość leczenia) dla: ${item.name}`,
          );
          if (val === null) return; // cancelled
          const parsed = parseInt(val);
          if (isNaN(parsed) || parsed < 0) {
            alert("Wprowadzono niepoprawną wartość.");
            return;
          }
          overrideValue = parsed;
        }

        this.characterData = await eel.use_inventory_item(
          index,
          overrideValue,
        )();
        document.dispatchEvent(
          new CustomEvent("characterUpdated", { detail: this.characterData }),
        );
      });
    });

    container.querySelectorAll('button[data-action="take_from_wagon"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const itemId = e.currentTarget.getAttribute("data-id");
        try {
          let domain = localStorage.getItem("syncDomain") || "localhost:8000";
          domain = domain.trim().replace(/^https?:\/\//i, "").replace(/^wss?:\/\//i, "").split("/")[0];
          const protocol = (window.location.protocol === "https:" || domain.includes("https")) ? "https:" : "http:";
          const url = `${protocol}//${domain}/api/wagon/remove`;
          
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_id: itemId })
          });
          
          if (res.ok) {
            const data = await res.json();
            const item = data.item;
            if (item) {
              this.characterData = await eel.add_item_to_inventory_raw(item)();
              document.dispatchEvent(
                new CustomEvent("characterUpdated", { detail: this.characterData }),
              );
            }
          } else {
            alert("Przedmiot nie istnieje lub został już zabrany.");
          }
        } catch (err) {
          console.error("Failed to take item from wagon", err);
          alert("Błąd połączenia z serwerem.");
        }
      });
    });
  }
}
