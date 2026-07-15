export class FightComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.characterData = null;
    this.weaponInputs = {};
    this.openItemCards = new Set();
    this.plannedBuffs = {
      Obrona: 0,
      Akcje: 0,
      Wytrwałość: 0,
      Ruch: 0,
      "Redukcja obrażeń": 0,
      "Przerzucenie kostki": 0,
      Inne: 0,
    };
  }

  async init() {
    const response = await fetch("/components/fight.html");
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    document.addEventListener("characterUpdated", (e) => {
      this.characterData = e.detail;
      this.render();
    });

    this.bindActions();

    this.characterData = await eel.get_character()();
    this.render();
  }

  bindActions() {
    const btnApply = document.getElementById("btn-apply-damage");
    btnApply.addEventListener("click", async () => {
      const amountInput = document.getElementById("fight-damage-amount");
      const amount = parseInt(amountInput.value) || 0;

      if (amount <= 0) return;

      const typeRadio = document.querySelector(
        'input[name="fight_damage_type"]:checked',
      );
      const damageType = typeRadio ? typeRadio.value : "physical";

      // Call API
      this.characterData = await eel.apply_damage(damageType, amount)();
      document.dispatchEvent(
        new CustomEvent("characterUpdated", { detail: this.characterData }),
      );

      // Optional visual feedback
      btnApply.classList.add("bg-rose-400");
      setTimeout(() => btnApply.classList.remove("bg-rose-400"), 200);
    });

    // Manual Adjustments - Base Health
    document
      .getElementById("btn-heal-health")
      .addEventListener("click", async () => {
        const amt =
          parseInt(
            document.getElementById("fight-manual-health-amount").value,
          ) || 0;
        if (amt > 0) {
          this.characterData = await eel.adjust_health(amt)();
          document.dispatchEvent(
            new CustomEvent("characterUpdated", { detail: this.characterData }),
          );
        }
      });
    document
      .getElementById("btn-damage-health")
      .addEventListener("click", async () => {
        const amt =
          parseInt(
            document.getElementById("fight-manual-health-amount").value,
          ) || 0;
        if (amt > 0) {
          this.characterData = await eel.adjust_health(-amt)();
          document.dispatchEvent(
            new CustomEvent("characterUpdated", { detail: this.characterData }),
          );
        }
      });

    // Manual Adjustments - Armor Health
    document
      .getElementById("btn-heal-armor")
      .addEventListener("click", async () => {
        const amt =
          parseInt(
            document.getElementById("fight-manual-armor-amount").value,
          ) || 0;
        if (amt > 0) {
          this.characterData = await eel.adjust_armor_health(amt)();
          document.dispatchEvent(
            new CustomEvent("characterUpdated", { detail: this.characterData }),
          );
        }
      });
    document
      .getElementById("btn-damage-armor")
      .addEventListener("click", async () => {
        const amt =
          parseInt(
            document.getElementById("fight-manual-armor-amount").value,
          ) || 0;
        if (amt > 0) {
          this.characterData = await eel.adjust_armor_health(-amt)();
          document.dispatchEvent(
            new CustomEvent("characterUpdated", { detail: this.characterData }),
          );
        }
      });

    // Action Points controls
    const dispatchAP = (data) => {
      this.characterData = data;
      document.dispatchEvent(
        new CustomEvent("characterUpdated", { detail: data }),
      );
    };

    document
      .getElementById("btn-reset-ap")
      .addEventListener("click", async () => {
        dispatchAP(await eel.reset_action_points()());
      });

    document
      .getElementById("btn-ap-inc")
      .addEventListener("click", async () => {
        const cur =
          parseFloat(document.getElementById("fight-ap-input").value) || 0;
        dispatchAP(await eel.set_action_points(cur + 0.5)());
      });

    document
      .getElementById("btn-ap-dec")
      .addEventListener("click", async () => {
        const cur =
          parseFloat(document.getElementById("fight-ap-input").value) || 0;
        dispatchAP(await eel.set_action_points(Math.max(0, cur - 0.5))());
      });

    document
      .getElementById("btn-ap-set")
      .addEventListener("click", async () => {
        const val = parseFloat(document.getElementById("fight-ap-input").value);
        if (!isNaN(val) && val >= 0) {
          dispatchAP(await eel.set_action_points(val)());
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
      document.getElementById("fight-base-hp-text").innerText =
        `${split.base_current_hp} / ${split.base_max_hp}`;
      const hpPct =
        split.base_max_hp > 0
          ? (split.base_current_hp / split.base_max_hp) * 100
          : 0;
      document.getElementById("fight-base-hp-bar").style.width =
        `${Math.max(0, hpPct)}%`;

      // Render Armor HP (Shield)
      const armorBar = document.getElementById("fight-armor-hp-bar");
      document.getElementById("fight-armor-hp-value").innerText =
        `${split.armor_current_hp} / ${split.armor_max_hp}`;
      const armorPct =
        split.armor_max_hp > 0
          ? (split.armor_current_hp / split.armor_max_hp) * 100
          : 0;
      armorBar.style.width = `${armorPct}%`;

      // Mitigation Badge
      const mitigationBadge = document.getElementById("fight-mitigation-badge");
      if (mitigationBadge) {
        mitigationBadge.innerText = split.current_mitigation || 0;
      }
    }

    // 2a. Render Action Points bar
    const curAP = char.current_action_points ?? 0;
    const maxAP = char.ap?.total ?? 0;
    const apText = document.getElementById("fight-ap-text");
    const apBar = document.getElementById("fight-ap-bar");
    const apInput = document.getElementById("fight-ap-input");
    if (apText)
      apText.innerText = `${Number.isInteger(curAP) ? curAP : curAP.toFixed(2)} / ${Number.isInteger(maxAP) ? maxAP : maxAP.toFixed(2)}`;
    if (apBar)
      apBar.style.width = `${maxAP > 0 ? Math.max(0, Math.min(100, (curAP / maxAP) * 100)) : 0}%`;
    // Keep input in sync only when user is not actively editing it
    if (apInput && document.activeElement !== apInput) apInput.value = curAP;

    // Magia (Mana)
    if (char.magia) {
      const manaMax = char.magia.max_mana || 0;
      const currentMana = char.magia.current_mana || 0;
      const mCurEl = document.getElementById("fight-mana-current");
      const mMaxEl = document.getElementById("fight-mana-max");
      const mBarEl = document.getElementById("fight-mana-bar");

      if (mCurEl) mCurEl.innerText = currentMana;
      if (mMaxEl) mMaxEl.innerText = manaMax;
      if (mBarEl)
        mBarEl.style.width = `${manaMax > 0 ? (currentMana / manaMax) * 100 : 0}%`;

      const buffsContainer = document.getElementById(
        "fight-mana-buffs-container",
      );
      if (buffsContainer) {
        let buffsHtml = "";
        let totalCost = 0;
        const stats = [
          "Obrona",
          "Akcje",
          "Wytrwałość",
          "Ruch",
          "Redukcja obrażeń",
          "Leczenie",
          "Przerzucenie kostki",
          "Inne",
        ];
        stats.forEach((stat) => {
          const activeBuff = char.magia.mana_buffs[stat] || 0;
          const planned = this.plannedBuffs[stat] || 0;
          totalCost += planned;

          buffsHtml += `
            <div class="flex items-center justify-between bg-indigo-900/40 p-3 rounded-lg border border-indigo-500/30">
              <span class="text-sm text-indigo-300 font-bold w-full truncate" title="${stat}">${stat}</span>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono text-indigo-400">Aktywne: +${activeBuff}</span>
                <div class="flex items-center gap-1">
                  <button data-action="fight-mana-buff-dec" data-stat="${stat}" class="w-6 h-6 rounded bg-gray-700 text-white flex items-center justify-center font-bold hover:bg-rose-500 transition-colors ${planned > 0 ? "" : "opacity-50 cursor-not-allowed"}" ${planned > 0 ? "" : "disabled"}>-</button>
                  <span class="text-sm font-mono font-bold w-6 text-center text-indigo-200">${planned}</span>
                  <button data-action="fight-mana-buff-inc" data-stat="${stat}" class="w-6 h-6 rounded bg-gray-700 text-white flex items-center justify-center font-bold hover:bg-indigo-500 transition-colors ${currentMana - totalCost > 0 ? "" : "opacity-50 cursor-not-allowed"}" ${currentMana - totalCost > 0 ? "" : "disabled"}>+</button>
                </div>
              </div>
            </div>
          `;
        });
        buffsContainer.innerHTML = buffsHtml;

        const costEl = document.getElementById("fight-mana-planned-cost");
        if (costEl) costEl.innerText = totalCost;

        const btnActivate = document.getElementById(
          "btn-mana-activate-effects",
        );
        if (btnActivate) {
          btnActivate.disabled = totalCost === 0 || totalCost > currentMana;
        }
      }
    }

    // 2. Render Weapons & Consumables
    const weaponsList = document.getElementById("fight-weapons-list");
    const weaponsEmpty = document.getElementById("fight-weapons-empty");
    const consList = document.getElementById("fight-consumables-list");
    const consEmpty = document.getElementById("fight-consumables-empty");

    const inventory = this.characterData.inventory || [];

    let wHtml = "";
    let wCount = 0;
    let cHtml = "";
    let cCount = 0;

    inventory.forEach((item, originalIndex) => {
      if (item.item_type === "Weapon" && item.location === "EQUIPPED") {
        wHtml += this.renderItemCard(item, originalIndex, false);
        wCount++;
      }

      const hasConsumable = item.consumable_effects
        ? Object.keys(item.consumable_effects).length > 0
        : false;
      if (hasConsumable) {
        cHtml += this.renderItemCard(item, originalIndex, true);
        cCount++;
      }
    });

    if (weaponsList) {
      weaponsList.innerHTML = wHtml;
      if (weaponsEmpty) weaponsEmpty.classList.toggle("hidden", wCount > 0);
    }

    if (consList) {
      consList.innerHTML = cHtml;
      if (consEmpty) consEmpty.classList.toggle("hidden", cCount > 0);
    }

    // 3. Render read-only character stats panel
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };
    const fmt = (v) => (Number.isInteger(v) ? v : Number(v).toFixed(2));

    setText("fight-stat-name", char.name ?? "—");
    setText("fight-stat-level", char.level ?? "—");
    setText("fight-stat-hp", `${char.hp} / ${char.max_hp?.total ?? "?"}`);
    setText("fight-stat-def", fmt(char.defense?.total ?? 0));
    setText("fight-stat-ap", fmt(char.ap?.total ?? 0));
    setText("fight-stat-stam", fmt(char.stamina?.total ?? 0));
    setText("fight-stat-move", char.movement?.total ?? "—");
    setText("fight-stat-str", char.stats?.str?.total ?? "—");
    setText("fight-stat-dex", char.stats?.dex?.total ?? "—");
    setText("fight-stat-wis", char.stats?.wis?.total ?? "—");
    setText("fight-stat-cha", char.stats?.cha?.total ?? "—");

    this.bindDynamicActions();
  }

  bindDynamicActions() {
    const container = document.getElementById(this.containerId);

    // Bind Mana Buff buttons
    container
      .querySelectorAll('button[data-action="fight-mana-buff-inc"]')
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const stat = e.currentTarget.getAttribute("data-stat");
          this.plannedBuffs[stat] = (this.plannedBuffs[stat] || 0) + 1;
          this.render();
        });
      });
    container
      .querySelectorAll('button[data-action="fight-mana-buff-dec"]')
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const stat = e.currentTarget.getAttribute("data-stat");
          if (this.plannedBuffs[stat] > 0) {
            this.plannedBuffs[stat] -= 1;
            this.render();
          }
        });
      });

    const btnActivate = document.getElementById("btn-mana-activate-effects");
    if (btnActivate) {
      btnActivate.onclick = async () => {
        this.characterData = await eel.activate_mana_effects(
          this.plannedBuffs,
        )();
        for (let k in this.plannedBuffs) this.plannedBuffs[k] = 0;
        document.dispatchEvent(
          new CustomEvent("characterUpdated", { detail: this.characterData }),
        );
      };
    }

    const btnCancel = document.getElementById("btn-mana-cancel-effects");
    if (btnCancel) {
      btnCancel.onclick = async () => {
        this.characterData = await eel.cancel_mana_effects()();
        document.dispatchEvent(
          new CustomEvent("characterUpdated", { detail: this.characterData }),
        );
      };
    }

    // Bind toggle events for accordions to persist open state
    container.querySelectorAll("details[data-card-index]").forEach((el) => {
      el.addEventListener("toggle", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-card-index"));
        if (e.currentTarget.open) {
          this.openItemCards.add(idx);
        } else {
          this.openItemCards.delete(idx);
        }
      });
    });

    // Bind weapon inputs
    container.querySelectorAll("input[data-weapon-input]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const index = e.currentTarget.getAttribute("data-weapon-input");
        this.weaponInputs[index] = e.currentTarget.value;
        this.render(); // Re-render to update the displayed action

        // After re-render, focus the input again and push cursor to the end
        requestAnimationFrame(() => {
          const el = document.querySelector(
            `input[data-weapon-input="${index}"]`,
          );
          if (el) {
            el.focus();
            // Hack to move cursor to the end of a type="number" input after re-render
            const val = el.value;
            el.value = "";
            el.value = val;
          }
        });
      });
    });

    // Bind weapon attack buttons
    container
      .querySelectorAll('button[data-action="fight-weapon-use"]')
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const index = parseInt(e.currentTarget.getAttribute("data-index"));
          const actionCost =
            parseFloat(e.currentTarget.getAttribute("data-cost")) || 0;

          const curAP = this.characterData.current_action_points ?? 0;
          const errEl = container.querySelector(`[data-weapon-err="${index}"]`);

          if (actionCost > 0 && curAP < actionCost) {
            if (errEl) {
              errEl.textContent = `Za mało PA! Potrzebujesz ${actionCost} PA, masz ${Number.isInteger(curAP) ? curAP : curAP.toFixed(2)}.`;
              errEl.classList.remove("hidden");
            }
            return;
          }
          if (errEl) errEl.classList.add("hidden");

          // Drain AP
          this.characterData = await eel.set_action_points(
            Math.max(0, curAP - actionCost),
          )();
          document.dispatchEvent(
            new CustomEvent("characterUpdated", { detail: this.characterData }),
          );

          // Optional visual feedback
          const originalText = e.currentTarget.innerHTML;
          e.currentTarget.innerHTML = `<span>⚔</span> Atak!`;
          e.currentTarget.classList.replace("bg-rose-600", "bg-rose-400");
          setTimeout(() => {
            if (document.contains(e.currentTarget)) {
              e.currentTarget.innerHTML = originalText;
              e.currentTarget.classList.replace("bg-rose-400", "bg-rose-600");
            }
          }, 400);
        });
      });

    container
      .querySelectorAll('button[data-action="fight-use"]')
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const index = parseInt(e.currentTarget.getAttribute("data-index"));
          const item = this.characterData.inventory[index];

          // AP cost mirrors engine logic (engine.py use_inventory_item)
          const apCostMap = { BACKPACK: 2, BACK: 1 };
          const apCost = apCostMap[item.location] ?? 0;
          const curAP = this.characterData.current_action_points ?? 0;
          const apErrEl = container.querySelector(`[data-ap-err="${index}"]`);

          if (apCost > 0 && curAP < apCost) {
            if (apErrEl) {
              apErrEl.textContent = `Za mało PA! Potrzebujesz ${apCost} PA, masz ${Number.isInteger(curAP) ? curAP : curAP.toFixed(2)}.`;
              apErrEl.classList.remove("hidden");
            }
            return;
          }
          if (apErrEl) apErrEl.classList.add("hidden");

          let overrideValue = null;
          if (item.consumable_effects && item.consumable_effects.dynamic_heal) {
            // Read value from the inline input rendered on the card
            const inputEl = container.querySelector(
              `input[data-dynamic-index="${index}"]`,
            );
            const errEl = container.querySelector(
              `[data-dynamic-err="${index}"]`,
            );
            const parsed = inputEl ? parseInt(inputEl.value) : NaN;

            if (isNaN(parsed) || parsed < 0) {
              if (errEl) {
                errEl.textContent = "Wpisz poprawną wartość (≥ 0)";
                errEl.classList.remove("hidden");
              }
              return;
            }
            if (errEl) errEl.classList.add("hidden");
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
  }

  renderItemCard(item, index, isConsumable = false) {
    const typeColor =
      item.item_type === "Weapon"
        ? "text-rose-400"
        : item.item_type === "Armor"
          ? "text-emerald-400"
          : "text-gray-400";

    // Map internal location to human readable tag
    const locMap = {
      EQUIPPED: "W Rękach",
      BACKPACK: "Plecak (2 PA)",
      BACK: "Plecy (1 PA)",
      QUIVER: "Kołczan",
      WAGON: "Wóz",
    };
    const locTag = locMap[item.location] || item.location;
    const locBadge = `<span class="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/50 uppercase tracking-wider">${locTag}</span>`;

    const usesBadge =
      isConsumable && item.max_uses > 0
        ? `<span class="bg-teal-900/80 text-teal-300 text-[9px] px-1.5 py-0.5 rounded border border-teal-500/50">Użycia: ${item.current_uses}/${item.max_uses}</span>`
        : "";

    const spaceText = `<span class="text-gray-500 text-[9px]">Masa: ${item.space_taken}</span>`;

    let modsHtml = "";
    if (item.modifiers && item.modifiers.length > 0) {
      modsHtml =
        `<div class="mt-1.5 flex flex-wrap gap-1">` +
        item.modifiers
          .map(
            (m) =>
              `<span class="bg-indigo-900/50 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/30">${m.stat_name}: ${m.value > 0 ? "+" + m.value : m.value}</span>`,
          )
          .join("") +
        `</div>`;
    }

    // Handle generic properties
    let propsHtml = "";
    if (item.properties && Object.keys(item.properties).length > 0) {
      const propItems = Object.entries(item.properties)
        .map(([k, v]) => {
          let valHtml = v;
          if (typeof v === "string" && v.includes("||")) {
            const parts = v
              .split("||")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            valHtml = `<ul class="list-disc list-outside ml-5 block w-full mt-1 font-medium">${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
          }
          const formattedKey = k
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
          return `
          <div class="bg-black/50 px-3 py-2 rounded-lg border border-slate-700 flex flex-col items-start shadow-sm flex-1 min-w-[200px]">
            <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide mb-1">${formattedKey}:</span>
            <span class="font-bold text-white text-xs w-full">${valHtml}</span>
          </div>
        `;
        })
        .join("");

      propsHtml = `
        <div class="mt-3">
          <h4 class="text-[11px] font-bold text-indigo-400 mb-2 uppercase tracking-wider">Właściwości</h4>
          <div class="flex flex-wrap gap-2 w-full">
            ${propItems}
          </div>
        </div>
      `;
    }

    // Actions if weapon
    let actionsHtml = "";
    if (
      !isConsumable &&
      item.item_type === "Weapon" &&
      item.actions &&
      item.actions.length > 0
    ) {
      const inputVal =
        this.weaponInputs[index] !== undefined ? this.weaponInputs[index] : "";

      let selectedAction = null;
      if (inputVal !== "") {
        const numericVal = parseInt(inputVal);
        if (!isNaN(numericVal)) {
          // Sort actions by card_value ascending
          const sortedActions = [...item.actions].sort(
            (a, b) => parseInt(a.card_value) - parseInt(b.card_value),
          );
          for (let i = sortedActions.length - 1; i >= 0; i--) {
            if (numericVal >= parseInt(sortedActions[i].card_value)) {
              selectedAction = sortedActions[i];
              break;
            }
          }
        }
      }

      let selectedActionHtml = "";
      if (selectedAction) {
        const act = selectedAction;
        let descHtml = "";
        if (act.description) {
          const parts = act.description
            .split("||")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (parts.length === 1) descHtml = parts[0];
          else
            descHtml = `<ul class="list-disc list-outside space-y-1 ml-5">${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
        }

        const isUltimate = parseInt(act.card_value) >= 10;
        const cardWrapperClasses = isUltimate
          ? "bg-black/90 rounded-lg p-3 border-2 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.5)] mt-3 relative transition-all duration-300"
          : "bg-black/80 rounded-lg p-3 border-2 border-slate-600 shadow-md mt-3 relative transition-all duration-300";

        selectedActionHtml = `
          <div class="${cardWrapperClasses}">
            <div class="flex justify-between items-center text-indigo-200 mb-2 pb-2 border-b border-slate-600">
              <span class="text-sm font-extrabold tracking-wide">${act.action_name}</span>
              <span class="text-emerald-400 font-bold text-xs bg-emerald-900/40 px-2 py-1 rounded border border-emerald-500/30">AP: ${act.action_cost}</span>
            </div>
            <div class="flex flex-wrap gap-2 mb-2">
              <span class="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[9px] font-extrabold mr-1">Odp:</span> <span class="font-bold text-white text-xs">${act.card_value}</span></span>
              <span class="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[9px] font-extrabold mr-1">Zas:</span> <span class="font-bold text-white text-xs">${act.range || act.range_str || "-"}</span></span>
              <span class="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[9px] font-extrabold mr-1">Hit:</span> <span class="font-bold text-amber-400 text-xs">${act.hit_roll || "-"}</span></span>
              <span class="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[9px] font-extrabold mr-1">Dmg:</span> <span class="font-bold text-rose-400 text-xs">${act.damage_roll || "-"}</span></span>
              ${act.targets ? `<span class="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[9px] font-extrabold mr-1">Cel:</span> <span class="font-bold text-indigo-300 text-xs">${act.targets}</span></span>` : ""}
              ${act.turn_execution ? `<span class="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex items-center shadow-inner"><span class="text-slate-400 uppercase text-[9px] font-extrabold mr-1">Tura:</span> <span class="font-bold text-teal-300 text-xs">${act.turn_execution}</span></span>` : ""}
            </div>
            <div class="text-slate-200 italic text-xs leading-relaxed border-t border-slate-600/50 pt-2 mt-1 font-medium">${descHtml}</div>
            
            <div class="mt-3 flex flex-col gap-1">
              <button data-action="fight-weapon-use" data-index="${index}" data-cost="${act.action_cost}" class="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm py-1.5 px-3 rounded shadow-md transition-colors border border-rose-500/50 flex items-center justify-center gap-2">
                <span>⚔</span> Użyj
              </button>
              <span data-weapon-err="${index}" class="hidden text-[10px] text-rose-400 font-semibold text-center mt-1"></span>
            </div>
          </div>
        `;
      } else if (inputVal !== "") {
        selectedActionHtml = `<div class="text-xs text-rose-400 mt-2 font-semibold">Brak akcji dla tej wartości.</div>`;
      }

      actionsHtml = `
        <div class="mt-2 pt-2 border-t border-gray-600">
          <div class="flex items-center justify-between gap-2 mt-2">
            <label class="text-[10px] text-amber-400 font-bold uppercase tracking-wide">🎲 Wartość karty:</label>
            <input type="number" min="0" data-weapon-input="${index}" class="w-20 bg-gray-900 border border-amber-500/60 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-600 shadow-inner" value="${inputVal}" placeholder="np. 5">
          </div>
          ${selectedActionHtml}
        </div>
      `;
    }

    // Consumable specific UI
    let consHtml = "";
    if (isConsumable) {
      const isDynamic =
        item.consumable_effects && item.consumable_effects.dynamic_heal;

      if (isDynamic) {
        consHtml = `
          <div class="mt-3 flex flex-col gap-2 pt-3 border-t border-gray-600">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wide">🎲 Wynik rzutu leczenia:</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="np. 7"
                data-dynamic-index="${index}"
                class="w-20 bg-gray-900 border border-amber-500/60 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-600"
              />
              <button
                data-action="fight-use"
                data-index="${index}"
                class="flex-1 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded border border-teal-500 transition-colors shadow-[0_0_8px_rgba(20,184,166,0.3)]"
              >Użyj</button>
            </div>
            <span data-dynamic-err="${index}" class="hidden text-[10px] text-rose-400 font-semibold"></span>
            <span data-ap-err="${index}" class="hidden text-[10px] text-rose-400 font-semibold flex items-center gap-1"><span>⚡</span><span></span></span>
          </div>
        `;
      } else {
        consHtml = `
          <div class="mt-3 flex flex-col gap-2 pt-3 border-t border-gray-600">
            <div class="flex justify-end items-center gap-2">
              <button data-action="fight-use" data-index="${index}" class="w-full text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded border border-teal-500 transition-colors shadow-[0_0_8px_rgba(20,184,166,0.3)]">Użyj przedmiotu</button>
            </div>
            <span data-ap-err="${index}" class="hidden text-[10px] text-rose-400 font-semibold flex items-center gap-1"><span>⚡</span><span></span></span>
          </div>
        `;
      }
    }

    const isOpen = this.openItemCards.has(index) ? "open" : "";
    const arrowIcon = `<svg class="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;

    return `
      <details data-card-index="${index}" ${isOpen} class="bg-gray-800 rounded border border-gray-700 mb-3 shadow-sm group">
        <summary class="p-3 cursor-pointer select-none flex justify-between items-start hover:bg-gray-700/50 transition-colors list-none">
          <div class="flex-1 pr-3">
            <h4 class="font-bold text-white leading-tight">${item.name}${item.quantity > 1 ? ` <span class="text-indigo-400 font-bold ml-1 text-sm">(x${item.quantity})</span>` : ""}</h4>
            <div class="text-[10px] font-bold uppercase tracking-wider ${typeColor} mb-1 flex items-center flex-wrap gap-1 mt-0.5">
                <span>${item.item_type}</span> <span class="text-gray-500">&bull;</span> ${spaceText} ${item.action_cost ? `<span class="text-gray-500">&bull;</span> <span class="bg-amber-900/60 text-amber-400 text-[9px] px-1.5 py-0.5 rounded border border-amber-500/50">Akcja: ${item.action_cost}</span>` : ""} ${usesBadge ? `<span class="text-gray-500">&bull;</span> ${usesBadge}` : ""}
            </div>
            ${modsHtml}
          </div>
          <div class="flex flex-col items-end shrink-0 gap-1 mt-0.5">
            ${locBadge}
            ${arrowIcon}
          </div>
        </summary>
        <div class="p-3 border-t border-gray-700 bg-gray-800/50">
          ${item.description ? `<p class="text-[11px] text-gray-400 italic mb-2 leading-snug">${item.description}</p>` : ""}
          ${propsHtml}
          ${actionsHtml}
          ${consHtml}
        </div>
      </details>
    `;
  }
}
