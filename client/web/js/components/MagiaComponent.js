export class MagiaComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.characterData = null;
  }

  async init() {
    const response = await fetch('/components/magia.html');
    const html = await response.text();
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = html;

    document.addEventListener('characterUpdated', (e) => {
      this.characterData = e.detail;
      this.render();
    });

    this.bindEvents();

    this.characterData = await eel.get_character()();
    this.render();
  }

  bindEvents() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.maxDisplay = document.getElementById("magia-max-display");
    this.btnDec = document.getElementById("btn-magia-current-dec");
    this.btnInc = document.getElementById("btn-magia-current-inc");
    this.btnEndDay = document.getElementById("btn-end-day");
    this.btnHeal = document.getElementById("btn-heal-remaining");

    const adjustCurrent = async (delta) => {
      const current = this.characterData?.magia?.current_mana || 0;
      const max = this.characterData?.magia?.max_mana || 0;
      let newVal = current + delta;
      if (newVal < 0) newVal = 0;
      if (newVal > max) newVal = max;
      
      this.characterData = await eel.set_mana_config(max, newVal)();
      document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
    };

    if (this.btnDec) this.btnDec.addEventListener("click", () => adjustCurrent(-1));
    if (this.btnInc) this.btnInc.addEventListener("click", () => adjustCurrent(1));

    if (this.btnEndDay) {
      this.btnEndDay.addEventListener("click", async () => {
        this.characterData = await eel.end_day()();
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
      });
    }

    if (this.btnHeal) {
      this.btnHeal.addEventListener("click", async () => {
        this.characterData = await eel.heal_remaining_mana()();
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
      });
    }
  }

  render() {
    if (!this.characterData || !this.characterData.magia) return;

    const maxMana = this.characterData.magia.max_mana || 0;
    const currentMana = this.characterData.magia.current_mana || 0;

    if (this.maxDisplay) this.maxDisplay.innerText = maxMana;

    const renderBreakdown = (containerId, breakdownArray) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = breakdownArray
        .map((item) => {
          const colorClass =
            item.value >= 0 ? "text-emerald-400" : "text-rose-400";
          const sign = item.value > 0 ? "+" : "";
          return `<li class="flex justify-between">
                          <span class="text-gray-400">${item.source}</span>
                          <span class="${colorClass} font-semibold">${sign}${item.value}</span>
                        </li>`;
        })
        .join("");
    };

    if (this.characterData.magia.max_mana_breakdown) {
      renderBreakdown("breakdown-mana", this.characterData.magia.max_mana_breakdown.breakdown);
    }

    const turnDisplay = document.getElementById("magia-turn-display");
    if (turnDisplay) turnDisplay.innerText = this.characterData.magia.mana_per_turn || 0;

    if (this.characterData.magia.mana_per_turn_breakdown) {
      renderBreakdown("breakdown-mana-turn", this.characterData.magia.mana_per_turn_breakdown.breakdown);
    }

    const curText = document.getElementById("magia-current-text");
    const maxText = document.getElementById("magia-max-text");
    const curBar = document.getElementById("magia-current-bar");
    
    if (curText) curText.innerText = currentMana;
    if (maxText) maxText.innerText = maxMana;
    if (curBar) curBar.style.width = `${maxMana > 0 ? (currentMana / maxMana) * 100 : 0}%`;

    if (this.btnHeal) {
      const canHeal = currentMana > 0 && this.characterData.hp < this.characterData.max_hp.total;
      if (canHeal) {
        this.btnHeal.classList.remove("opacity-50", "cursor-not-allowed");
        this.btnHeal.disabled = false;
      } else {
        this.btnHeal.classList.add("opacity-50", "cursor-not-allowed");
        this.btnHeal.disabled = true;
      }
    }
  }
}
