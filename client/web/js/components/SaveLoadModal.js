export class SaveLoadModal {
  constructor(containerId) {
    this.containerId = containerId;
    this.isOpen = false;
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    const response = await fetch('/components/saveload_modal.html');
    const html = await response.text();
    container.innerHTML = html;

    this.backdrop = document.getElementById('saveload-modal-backdrop');
    this.content = document.getElementById('saveload-modal-content');
    this.closeBtn = document.getElementById('saveload-modal-close');
    this.savesList = document.getElementById('saves-list');

    this.closeBtn.addEventListener('click', () => this.close());
    
    // Close on clicking backdrop
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop.firstElementChild || e.target === this.backdrop) {
        this.close();
      }
    });
  }

  async open() {
    this.isOpen = true;
    
    // Fetch saves before showing
    this.savesList.innerHTML = '<div class="text-center text-gray-500 py-8 animate-pulse">Ładowanie zapisów...</div>';
    
    this.backdrop.classList.remove('hidden');
    // slight delay to allow display:block to apply before animating opacity
    setTimeout(() => {
      this.backdrop.classList.remove('opacity-0');
      this.content.classList.remove('scale-95');
    }, 10);

    await this.renderSaves();
  }

  close() {
    this.isOpen = false;
    this.backdrop.classList.add('opacity-0');
    this.content.classList.add('scale-95');
    setTimeout(() => {
      this.backdrop.classList.add('hidden');
    }, 300); // matches duration-300
  }

  async renderSaves() {
    const saves = await eel.list_named_saves()();
    
    if (!saves || saves.length === 0) {
      this.savesList.innerHTML = '<div class="text-center text-gray-500 py-8">Brak zapisanych gier. (Użyj Ctrl+S aby zapisać)</div>';
      return;
    }

    this.savesList.innerHTML = '';
    
    saves.forEach(save => {
      // Basic formatting of the timestamp (e.g. 2026-07-10T17-43-17 to readable string)
      let readableTime = save.timestamp;
      try {
         // Replace the dash before hours with a T or space to parse correctly if it was ISO-like but messed up
         const parsed = new Date(save.timestamp.replace(/T(\d+)-(\d+)-(\d+)/, 'T$1:$2:$3'));
         if (!isNaN(parsed)) {
             readableTime = parsed.toLocaleString('pl-PL');
         }
      } catch(e) {}

      const item = document.createElement('div');
      item.className = 'group flex items-center justify-between p-4 bg-gray-700/30 border border-gray-600 rounded-xl hover:bg-gray-700/60 hover:border-indigo-500/50 transition-all cursor-pointer';
      
      item.innerHTML = `
        <div class="flex flex-col">
          <span class="text-lg font-semibold text-gray-200 group-hover:text-indigo-300 transition-colors">${save.hero_name} - Poziom ${save.level}</span>
          <span class="text-sm text-gray-400 font-mono">${readableTime}</span>
          <span class="text-xs text-gray-500">${save.filename}</span>
        </div>
        <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
          Wczytaj
        </button>
      `;

      item.addEventListener('click', async () => {
         await this.loadSave(save.filename);
      });

      this.savesList.appendChild(item);
    });
  }

  async loadSave(filename) {
    // Show some loading state or block the UI briefly
    this.savesList.innerHTML = '<div class="text-center text-indigo-400 py-8 animate-pulse font-semibold">Wczytywanie...</div>';
    
    const newCharacterData = await eel.load_named_save(filename)();
    
    if (newCharacterData) {
       document.dispatchEvent(new CustomEvent('characterUpdated', { detail: newCharacterData }));
       this.close();
    } else {
       this.savesList.innerHTML = '<div class="text-center text-red-400 py-8 font-semibold">Nie udało się wczytać zapisu!</div>';
       setTimeout(() => this.renderSaves(), 2000);
    }
  }
}
