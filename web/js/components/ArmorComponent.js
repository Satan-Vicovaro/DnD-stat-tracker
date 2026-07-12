export class ArmorComponent {
  constructor(containerId, isReadonly = false) {
    this.containerId = containerId;
    this.isReadonly = isReadonly;
    this.container = null;
  }

  async init() {
    const response = await fetch("/components/armor.html");
    const html = await response.text();
    this.container = document.getElementById(this.containerId);
    this.container.innerHTML = html;

    // Listen for external updates
    document.addEventListener("characterUpdated", (e) => {
      this.render(e.detail);
    });

    // Since this component might render before or after CharacterComponent,
    // we can share state by just fetching the current state.
    let char = await eel.get_character()();
    this.render(char);
  }

  async modifyArmor(armorName, delta) {
    let char = await eel.modify_armor_quantity(armorName, delta)();
    this.render(char);

    // Broadcast an event or directly update character component since they share the same data model.
    // For simplicity, we can trigger a custom event that CharacterComponent listens to.
    document.dispatchEvent(
      new CustomEvent("characterUpdated", { detail: char }),
    );
  }

  render(char) {
    const armorData = char.armor;
    const container = this.container.querySelector(".armor-list-container");

    // Rebuild list
    container.innerHTML = "";
    let totalFragments = 0;

    armorData.types.forEach((type) => {
      totalFragments += type.quantity;

      const row = document.createElement("div");
      row.className =
        "flex justify-between items-center bg-gray-700/20 py-2 px-4 rounded-lg";

      let buttonsHtml = "";
      if (this.isReadonly) {
        buttonsHtml = `<span class="font-bold text-fuchsia-300 text-lg w-6 text-center">${type.quantity}</span>`;
      } else {
        buttonsHtml = `
                    <button data-action="modify-armor" data-name="${type.name}" data-delta="-1" class="w-8 h-8 rounded-full bg-gray-700 hover:bg-rose-500/80 text-gray-300 flex items-center justify-center transition-colors font-bold">-</button>
                    <span class="font-bold text-fuchsia-300 text-lg w-6 text-center">${type.quantity}</span>
                    <button data-action="modify-armor" data-name="${type.name}" data-delta="1" class="w-8 h-8 rounded-full bg-gray-700 hover:bg-emerald-500/80 text-gray-300 flex items-center justify-center transition-colors font-bold ${armorData.remaining_space < type.space_per_fragment ? "opacity-30 cursor-not-allowed" : ""}">+</button>
                `;
      }

      const hpColor =
        type.current_hp < type.max_hp && type.max_hp > 0
          ? "text-rose-400"
          : "text-emerald-400";
      const hpDisplay =
        type.max_hp > 0
          ? `<span class="text-[10px] ${hpColor} font-mono font-bold">HP: ${type.current_hp} / ${type.max_hp}</span>`
          : "";

      row.innerHTML = `
                <div class="flex flex-col w-32">
                    <span class="text-gray-300 font-bold">${type.name}</span>
                    <div class="flex flex-col">
                      <span class="text-[10px] text-gray-500">${type.space_per_fragment} space / frag</span>
                      ${hpDisplay}
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    ${buttonsHtml}
                </div>
                <div class="w-12 text-right">
                    <span class="text-sm font-semibold text-gray-400" title="Zużyte miejsce">${type.used_space}</span>
                </div>
            `;
      container.appendChild(row);
    });

    // Bind buttons
    const btns = container.querySelectorAll("[data-action='modify-armor']");
    if (!this.isReadonly) {
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const name = btn.getAttribute("data-name");
          const delta = parseInt(btn.getAttribute("data-delta"));
          this.modifyArmor(name, delta);
        });
      });
    }

    this.container.querySelector(".armor-total-fragments").innerText =
      `${totalFragments} frag`;

    const split = char.health_split;
    const brokenFragments = split ? split.broken_fragments || 0 : 0;
    const brokenBadge = this.container.querySelector(".armor-broken-fragments");
    if (brokenFragments > 0) {
      brokenBadge.innerText = `${brokenFragments} zniszczonych! (Redukują mniej obrażeń)`;
      brokenBadge.classList.remove("hidden");
    } else {
      brokenBadge.classList.add("hidden");
    }

    this.container.querySelector(".armor-used-space").innerText =
      armorData.total_used_space;
    this.container.querySelector(".armor-max-space").innerText =
      armorData.max_space;
    this.container.querySelector(".armor-remaining-space").innerText =
      armorData.remaining_space;

    const maxSpace = armorData.max_space || 24;
    const intactPct = (armorData.intact_space / maxSpace) * 100;
    const damagedPct = (armorData.damaged_space / maxSpace) * 100;

    this.container.querySelector(".armor-capacity-bar-intact").style.width =
      `${intactPct}%`;
    this.container.querySelector(".armor-capacity-bar-damaged").style.width =
      `${damagedPct}%`;
  }
}
