export class PaymentModal {
  constructor(containerId) {
    this.containerId = containerId;
    this.itemData = null;
    this.characterData = null;
    this.onConfirmCallback = null;
    this.isOpen = false;
  }

  async init() {
    const response = await fetch('/components/payment_modal.html');
    const html = await response.text();
    document.getElementById(this.containerId).innerHTML = html;

    // Bind document level event to update character data when it changes
    document.addEventListener('characterUpdated', (e) => {
      this.characterData = e.detail;
      if (this.isOpen) {
        this.updateBalances();
      }
    });

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('payment-modal-close').addEventListener('click', () => this.close());
    document.getElementById('payment-btn-cancel').addEventListener('click', () => this.close());

    document.getElementById('payment-btn-confirm').addEventListener('click', () => this.handleConfirm());

    // Validation listeners on inputs
    ['gold', 'silver', 'copper'].forEach(coin => {
      const input = document.getElementById(`payment-input-${coin}`);
      input.addEventListener('input', () => this.validate());
    });
  }

  async open(itemData, onConfirm) {
    this.itemData = itemData;
    this.onConfirmCallback = onConfirm;

    // Fetch latest character data if we don't have it
    if (!this.characterData) {
      this.characterData = await eel.get_character()();
    }

    // Populate UI
    document.getElementById('payment-item-name').innerText = itemData.name || "Nieznany przedmiot";

    let costText = "Brak";
    if (itemData.cost_silver) {
      costText = `${itemData.cost_silver} Srebra`;
    } else if (itemData.cost_type) {
      costText = itemData.cost_type; // e.g. for armor
    }
    document.getElementById('payment-item-cost').innerText = costText;

    // Reset inputs
    document.getElementById('payment-input-gold').value = 0;
    document.getElementById('payment-input-silver').value = 0;
    document.getElementById('payment-input-copper').value = 0;
    const qtyInput = document.getElementById('payment-input-quantity');
    if (qtyInput) qtyInput.value = 1;

    this.updateBalances();
    this.validate();

    // Show modal
    const backdrop = document.getElementById('payment-modal-backdrop');
    const content = document.getElementById('payment-modal-content');

    backdrop.classList.remove('hidden');
    // slight delay for animation
    setTimeout(() => {
      backdrop.classList.remove('opacity-0');
      content.classList.remove('scale-95');
    }, 10);

    this.isOpen = true;
  }

  updateBalances() {
    if (!this.characterData || !this.characterData.economy) return;
    const { gold, silver, copper } = this.characterData.economy;

    document.getElementById('payment-current-gold').innerText = gold;
    document.getElementById('payment-current-silver').innerText = silver;
    document.getElementById('payment-current-copper').innerText = copper;
  }

  validate() {
    if (!this.characterData || !this.characterData.economy) return false;
    const { gold, silver, copper } = this.characterData.economy;

    const inputGold = parseInt(document.getElementById('payment-input-gold').value) || 0;
    const inputSilver = parseInt(document.getElementById('payment-input-silver').value) || 0;
    const inputCopper = parseInt(document.getElementById('payment-input-copper').value) || 0;

    const isValid = inputGold >= 0 && inputSilver >= 0 && inputCopper >= 0 &&
                    inputGold <= gold && inputSilver <= silver && inputCopper <= copper;

    const errorMsg = document.getElementById('payment-error-msg');
    const confirmBtn = document.getElementById('payment-btn-confirm');

    if (!isValid) {
      errorMsg.classList.remove('hidden');
      confirmBtn.disabled = true;
      confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      errorMsg.classList.add('hidden');
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    return isValid;
  }

  async handleConfirm() {
    if (!this.validate()) return;

    const payment = {
      gold: parseInt(document.getElementById('payment-input-gold').value) || 0,
      silver: parseInt(document.getElementById('payment-input-silver').value) || 0,
      copper: parseInt(document.getElementById('payment-input-copper').value) || 0
    };

    let quantity = 1;
    const qtyInput = document.getElementById('payment-input-quantity');
    if (qtyInput) quantity = parseInt(qtyInput.value) || 1;

    if (this.onConfirmCallback) {
      // Show loading state
      const btn = document.getElementById('payment-btn-confirm');
      const originalText = btn.innerText;
      btn.innerText = "Przetwarzanie...";
      btn.disabled = true;

      await this.onConfirmCallback(this.itemData, payment, quantity);

      btn.innerText = originalText;
      btn.disabled = false;
    }

    this.close();
  }

  close() {
    const backdrop = document.getElementById('payment-modal-backdrop');
    const content = document.getElementById('payment-modal-content');

    backdrop.classList.add('opacity-0');
    content.classList.add('scale-95');

    setTimeout(() => {
      backdrop.classList.add('hidden');
      this.isOpen = false;
    }, 300);
  }
}
