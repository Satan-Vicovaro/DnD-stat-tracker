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
      // +/- buttons
      document.getElementById(`btn-${currency}-inc`).addEventListener("click", () => this.modifyMoney(currency, 1));
      document.getElementById(`btn-${currency}-dec`).addEventListener("click", () => this.modifyMoney(currency, -1));
      
      // Direct input editing
      const inputEl = document.getElementById(`economy-${currency}`);
      inputEl.addEventListener("change", (e) => {
        const newVal = parseInt(e.target.value);
        if (!isNaN(newVal) && newVal >= 0) {
          this.setMoney(currency, newVal);
        } else {
          // Revert to valid value if invalid input
          this.render();
        }
      });
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
    
    document.getElementById("economy-gold").value = gold;
    document.getElementById("economy-silver").value = silver;
    document.getElementById("economy-copper").value = copper;
  }
}
