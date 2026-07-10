export class EconomyComponent {
  /**
   * @param {...string} containerIds - One or more element IDs to mount into.
   *   All containers stay in sync; UI events from any container update all.
   */
  constructor(...containerIds) {
    this.containerIds = containerIds;
    this.characterData = null;
  }

  async init() {
    // Load the HTML template once and stamp it into every container.
    const response = await fetch('/components/economy.html');
    const html = await response.text();
    for (const id of this.containerIds) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    }

    // Single event subscription covers all containers.
    document.addEventListener('characterUpdated', (e) => {
      this.characterData = e.detail;
      this.render();
    });

    // Single initial data fetch.
    this.characterData = await eel.get_character()();
    this.render();
    this.bindEvents();
  }

  bindEvents() {
    for (const id of this.containerIds) {
      this._bindContainerEvents(id);
    }
  }

  _bindContainerEvents(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const attachHandlers = (currency) => {
      const incBtn = container.querySelector(`.btn-${currency}-inc`);
      const decBtn = container.querySelector(`.btn-${currency}-dec`);
      const inputEl = container.querySelector(`.economy-input-${currency}`);

      if (incBtn) incBtn.addEventListener('click', () => this.modifyMoney(currency, 1));
      if (decBtn) decBtn.addEventListener('click', () => this.modifyMoney(currency, -1));

      if (inputEl) {
        inputEl.addEventListener('change', (e) => {
          const newVal = parseInt(e.target.value);
          if (!isNaN(newVal) && newVal >= 0) {
            this.setMoney(currency, newVal);
          } else {
            this.render(); // revert invalid input
          }
        });
      }
    };

    attachHandlers('gold');
    attachHandlers('silver');
    attachHandlers('copper');
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

    for (const id of this.containerIds) {
      const container = document.getElementById(id);
      if (!container) continue;

      const goldInput   = container.querySelector('.economy-input-gold');
      const silverInput = container.querySelector('.economy-input-silver');
      const copperInput = container.querySelector('.economy-input-copper');

      if (goldInput)   goldInput.value   = gold;
      if (silverInput) silverInput.value = silver;
      if (copperInput) copperInput.value = copper;
    }
  }
}
