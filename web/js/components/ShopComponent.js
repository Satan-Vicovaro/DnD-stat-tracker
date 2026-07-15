export class ShopComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.shopData = {};
    this.activeTab = "";
  }

  async init() {
    const response = await fetch("/components/shop.html");
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    // Fetch shop data
    this.shopData = await eel.get_shop_items()();

    // Set active tab to the first category
    const categories = Object.keys(this.shopData);
    if (categories.length > 0) {
      this.activeTab = categories[0];
    }

    this.render();
  }

  render() {
    if (!this.activeTab) return;
    this.renderTabs();
    this.renderItems();
  }

  renderTabs() {
    const tabsContainer = document.getElementById("shop-tabs");
    const categories = Object.keys(this.shopData);

    tabsContainer.innerHTML = categories
      .map((cat) => {
        const isActive = cat === this.activeTab;
        const baseClasses =
          "px-4 py-2 rounded-md font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap border";
        const activeClasses = isActive
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white";

        return `<button class="${baseClasses} ${activeClasses}" data-tab="${cat}">
                ${cat}
              </button>`;
      })
      .join("");

    // Bind tab clicks
    tabsContainer.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.activeTab = e.currentTarget.getAttribute("data-tab");
        this.render();
      });
    });
  }

  renderItems() {
    const grid = document.getElementById("shop-items-grid");
    const items = this.shopData[this.activeTab] || [];

    grid.innerHTML = items
      .map((item, index) => {
        // 'name' is guaranteed by backend normalisation in get_shop_data()
        const name = item.name || "Nieznany Przedmiot";
        let cost = "?";
        if (item.cost_silver !== undefined && item.cost_silver !== null)
          cost = item.cost_silver;
        else if (
          item.quantity_or_cost !== undefined &&
          item.quantity_or_cost !== null
        )
          cost = item.quantity_or_cost;

        let detailsHtml = "";

        // If it has actions (Weapon)
        if (item.actions && item.actions.length > 0) {
          detailsHtml += `
          <div class="w-full">
            <h4 class="text-sm font-bold text-indigo-400 mb-3 uppercase tracking-wider">Akcje (${item.actions.length})</h4>
            <div class="flex flex-wrap gap-3">
              ${item.actions
                .map((act) => {
                  let descHtml = "";
                  if (act.description) {
                    const parts = act.description
                      .split("||")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    if (parts.length === 1) {
                      descHtml = parts[0];
                    } else {
                      descHtml = `<ul class="list-disc list-outside space-y-1 ml-5">${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
                    }
                  }

                  return `
                <div class="bg-black/80 rounded-lg p-4 border-2 border-slate-600 flex-1 min-w-[280px] max-w-sm shadow-md">
                  <div class="flex justify-between items-center text-indigo-200 mb-3 pb-2 border-b border-slate-600">
                    <span class="text-lg font-extrabold tracking-wide">${act.action_name}</span>
                    <span class="text-emerald-400 font-bold text-sm bg-emerald-900/40 px-2 py-1 rounded border border-emerald-500/30">AP: ${act.action_cost}</span>
                  </div>
                  <div class="flex flex-wrap gap-2 mb-3">
                    <span class="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[10px] font-extrabold mr-1.5">Odp:</span> <span class="font-bold text-white text-sm">${act.card_value !== undefined ? act.card_value : "&nbsp;"}</span></span>
                    <span class="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[10px] font-extrabold mr-1.5">Zas:</span> <span class="font-bold text-white text-sm">${act.range || act.range_str || "-"}</span></span>
                    <span class="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[10px] font-extrabold mr-1.5">Hit:</span> <span class="font-bold text-amber-400 text-sm">${act.hit_roll || "-"}</span></span>
                    <span class="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[10px] font-extrabold mr-1.5">Dmg:</span> <span class="font-bold text-rose-400 text-sm">${act.damage_roll || "-"}</span></span>
                    ${act.targets ? `<span class="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[10px] font-extrabold mr-1.5">Cel:</span> <span class="font-bold text-indigo-300 text-sm">${act.targets}</span></span>` : ''}
                    ${act.turn_execution ? `<span class="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[10px] font-extrabold mr-1.5">Tura:</span> <span class="font-bold text-teal-300 text-sm">${act.turn_execution}</span></span>` : ''}
                  </div>
                  <div class="text-slate-100 italic text-sm leading-relaxed border-t border-slate-600/50 pt-3 mt-1 font-medium">${descHtml}</div>
                </div>
                `;
                })
                .join("")}
            </div>
          </div>
        `;
        }

        // Handle generic properties for other items (armor, shields, misc)
        let otherProps = [];
        const excludeKeys = [
          "weapon_name",
          "name",
          "item_name",
          "tarcza",
          "zbroja",
          "cost_silver",
          "quantity_or_cost",
          "actions",
        ];

        for (const [key, value] of Object.entries(item)) {
          if (!excludeKeys.includes(key) && value) {
            if (Array.isArray(value)) {
              if (value.length > 0) {
                const formattedArray = value.map(v => {
                  if (typeof v === 'object' && v !== null) {
                    if (v.stat_name !== undefined && v.value !== undefined) {
                      return `${v.stat_name}: ${v.value > 0 ? '+' + v.value : v.value}`;
                    }
                    return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(', ');
                  }
                  return v;
                }).join(' || ');
                
                const formattedKey = key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase());
                otherProps.push({ k: formattedKey, v: formattedArray });
              }
            } else if (typeof value === "object") {
              // Nested object like effects
              for (const [subKey, subValue] of Object.entries(value)) {
                let finalVal = subValue;
                if (typeof subValue === 'object' && subValue !== null) {
                  finalVal = JSON.stringify(subValue);
                }
                const formattedSubKey = subKey
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase());
                otherProps.push({ k: formattedSubKey, v: finalVal });
              }
            } else {
              // Pretty format key
              const formattedKey = key
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
              otherProps.push({ k: formattedKey, v: value });
            }
          }
        }

        if (otherProps.length > 0) {
          detailsHtml += `
          <div class="${item.actions && item.actions.length > 0 ? "mt-6" : ""} w-full">
            <h4 class="text-sm font-bold text-indigo-400 mb-3 uppercase tracking-wider">Właściwości</h4>
            <div class="flex flex-wrap gap-3 w-full">
              ${otherProps
                .map((prop) => {
                  let valHtml = prop.v;
                  if (typeof prop.v === "string" && prop.v.includes("||")) {
                    const parts = prop.v
                      .split("||")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    valHtml = `<ul class="list-disc list-outside ml-5 block w-full mt-1 font-medium">${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
                  }

                  return `
                <div class="bg-black/80 px-4 py-3 rounded-lg border-2 border-slate-600 flex flex-col items-start shadow-md w-full">
                  <span class="text-slate-400 text-xs font-extrabold uppercase tracking-wide mb-1">${prop.k}:</span>
                  <span class="font-bold text-white text-sm md:text-base w-full">${valHtml}</span>
                </div>
                `;
                })
                .join("")}
            </div>
          </div>
        `;
        }

        return `
        <details class="bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-gray-700 hover:border-indigo-400 group/item">
          
          <summary class="p-4 flex justify-between items-center cursor-pointer select-none list-none outline-none">
            <!-- Left side: Name -->
            <div class="flex items-center gap-3">
              <div class="bg-gray-700 p-1.5 rounded-full group-hover/item:bg-indigo-600 transition-colors">
                <svg class="w-5 h-5 text-gray-300 group-hover/item:text-white group-open/item:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"></path></svg>
              </div>
              <h3 class="text-2xl font-extrabold text-white leading-tight group-hover/item:text-indigo-300 transition-colors">${name}</h3>
            </div>
            
            <!-- Right side: Cost -->
            <div class="bg-yellow-500/20 text-yellow-400 font-extrabold px-4 py-1.5 rounded border border-yellow-500/40 whitespace-nowrap flex items-center shadow-sm text-lg">
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/><path d="M10 6a4 4 0 100 8 4 4 0 000-8z"/></svg>
              ${cost} Ag
            </div>
          </summary>
          
          <!-- Expanded Content -->
          <div class="p-5 border-t border-gray-700 bg-gray-900/40 rounded-b-xl">
            <div class="flex flex-col md:flex-row justify-between items-start gap-6">
              <div class="flex-1 w-full flex flex-col">
                ${detailsHtml}
              </div>
              
              <!-- Right Button -->
              <div class="w-full md:w-auto flex-shrink-0 flex items-stretch md:self-end mt-4 md:mt-0">
                <button data-buy-index="${index}" class="w-full md:w-32 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-lg py-3 px-6 rounded-lg shadow-md transition-colors border-2 border-indigo-500/50 whitespace-nowrap flex items-center justify-center">
                  Kup
                </button>
              </div>
            </div>
          </div>
        </details>
      `;
      })
      .join("");

    // Bind Buy Buttons
    grid.querySelectorAll("button[data-buy-index]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const itemIndex = parseInt(
          e.currentTarget.getAttribute("data-buy-index"),
        );
        const itemData = items[itemIndex];

        // Prepare data for backend format
        const purchaseData = {
          // 'name' is guaranteed by backend normalisation in get_shop_data()
          name: itemData.name || "Przedmiot",
          description: itemData.description || "Ze sklepu.",
          space_taken: itemData.space_taken || 0.0,
          cost_silver: itemData.cost_silver,
          item_type:
            itemData.item_type || (
              this.activeTab === "Broń biała" ||
              this.activeTab === "Broń zasięgowa"
                ? "Weapon"
                : this.activeTab === "Zbroje"
                  ? "Armor"
                  : "Misc"
            ),
          actions: itemData.actions || [],
          // Consumable fields — must be forwarded so the Fight tab renders them
          // immediately without waiting for the _patch_item_consumables migration
          // that only runs on app restart.
          consumable_effects: itemData.consumable_effects || {},
          max_uses: itemData.max_uses ?? 1,
          current_uses: itemData.current_uses ?? 1,
          action_cost: itemData.action_cost || "",
          modifiers: itemData.modifiers || [],
          properties: itemData.properties || {},
        };

        if (window.paymentModal) {
          window.paymentModal.open(purchaseData, async (data, payment, quantity) => {
            const result = await eel.add_item_to_inventory(data, payment, quantity)();
            document.dispatchEvent(
              new CustomEvent("characterUpdated", { detail: result }),
            );
          });
        }
      });
    });
  }
}
