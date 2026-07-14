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

    this.maxInput = document.getElementById("magia-max-input");
    this.btnDec = document.getElementById("btn-magia-current-dec");
    this.btnInc = document.getElementById("btn-magia-current-inc");
    this.btnEndDay = document.getElementById("btn-end-day");
    this.btnHeal = document.getElementById("btn-heal-remaining");

    if (this.maxInput) {
      this.maxInput.addEventListener("change", async (e) => {
        const val = parseInt(e.target.value) || 0;
        this.characterData = await eel.set_mana_config(val, null)();
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
      });
    }

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

    if (this.maxInput && document.activeElement !== this.maxInput) {
      this.maxInput.value = maxMana;
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
