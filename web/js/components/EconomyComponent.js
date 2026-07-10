export class EconomyComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.characterData = null;
    this.bindEvents = this.bindEvents.bind(this);
  }

  async init() {
    // Load HTML template
    const response = await fetch('/components/economy.html');
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    // Listen for external updates
    document.addEventListener('characterUpdated', (e) => {
      this.characterData = e.detail;
      this.render();
    });

    // Fetch initial data
    await this.fetchData();
    this.bindEvents();
  }

  async fetchData() {
    this.characterData = await eel.get_character()();
    this.render();
  }

  bindEvents() {
    const attachHandlers = (currency) => {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      // +/- buttons
      container.querySelector(`.btn-${currency}-inc`).addEventListener("click", () => this.modifyMoney(currency, 1));
      container.querySelector(`.btn-${currency}-dec`).addEventListener("click", () => this.modifyMoney(currency, -1));
      
      // Direct input editing
      const inputEl = container.querySelector(`.economy-input-${currency}`);
      if (inputEl) {
        inputEl.addEventListener("change", (e) => {
          const newVal = parseInt(e.target.value);
          if (!isNaN(newVal) && newVal >= 0) {
            this.setMoney(currency, newVal);
          } else {
            // Revert to valid value if invalid input
            this.render();
          }
        });
      }
    };

    attachHandlers("gold");
    attachHandlers("silver");
    attachHandlers("copper");
  }

  async modifyMoney(currency, delta) {
    this.characterData = await eel.modify_money(currency, delta)();
    this.render();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
  }

  async setMoney(currency, value) {
    this.characterData = await eel.set_money(currency, value)();
    this.render();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: this.characterData }));
  }

  render() {
    if (!this.characterData || !this.characterData.economy) return;
    
    const { gold, silver, copper } = this.characterData.economy;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    const goldInput = container.querySelector(".economy-input-gold");
    if (goldInput) goldInput.value = gold;

    const silverInput = container.querySelector(".economy-input-silver");
    if (silverInput) silverInput.value = silver;

    const copperInput = container.querySelector(".economy-input-copper");
    if (copperInput) copperInput.value = copper;
  }
}
