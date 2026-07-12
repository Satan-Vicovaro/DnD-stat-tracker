/**
 * StatusEffectsComponent
 *
 * Panel shown in the "Postać" tab that lets the user add, edit, toggle, and
 * remove status effects.  Each effect has a title, description, active flag,
 * and an arbitrary list of stat modifiers (source, stat_name, value, mod_type).
 *
 * Supported stat_name values: max_hp | defense | ap | stamina | movement | str | dex | wis | cha
 */
export class StatusEffectsComponent {
  /** @param {string} containerId – id of the mount point div */
  constructor(containerId) {
    this.containerId = containerId;

    // Modal state
    this._editingId = null; // null → create mode, string → edit mode
    this._activeState = true;
    this._modifiers = []; // [{stat_name, value, mod_type}]
  }

  async init() {
    const res = await fetch('/components/status_effects.html');
    const html = await res.text();
    document.getElementById(this.containerId).innerHTML = html;

    this._bindModal();
    this._bindListEvents();

    document.addEventListener('characterUpdated', (e) => this.render(e.detail));

    const char = await eel.get_character()();
    this.render(char);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  // ─── List event binding ────────────────────────────────────────────────────

  _bindListEvents() {
    document.querySelectorAll('[data-se-toggle]').forEach(btn => {
      btn.onclick = () => this._toggle(btn.dataset.seToggle);
    });
    document.querySelectorAll('[data-se-edit]').forEach(btn => {
      btn.onclick = () => this._openEdit(btn.dataset.seEdit);
    });
    document.querySelectorAll('[data-se-delete]').forEach(btn => {
      btn.onclick = () => this._delete(btn.dataset.seDelete);
    });
  }

  // ─── API calls ─────────────────────────────────────────────────────────────

  async _toggle(statusId) {
    const char = await eel.toggle_status_effect(statusId)();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: char }));
  }

  async _delete(statusId) {
    const char = await eel.remove_status_effect(statusId)();
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: char }));
  }

  async _save() {
    const title = document.getElementById('se-input-title').value.trim();
    if (!title) {
      document.getElementById('se-input-title').classList.add('border-rose-500');
      return;
    }
    document.getElementById('se-input-title').classList.remove('border-rose-500');

    const desc = document.getElementById('se-input-desc').value.trim();
    const payload = {
      title,
      description: desc,
      active: this._activeState,
      modifiers: this._modifiers.map(m => ({
        source: title,
        stat_name: m.stat_name,
        value: parseFloat(m.value) || 0,
        mod_type: m.mod_type || 'ADD',
      })),
    };

    let char;
    if (this._editingId) {
      char = await eel.update_status_effect(this._editingId, payload)();
    } else {
      char = await eel.add_status_effect(payload)();
    }
    document.dispatchEvent(new CustomEvent('characterUpdated', { detail: char }));
    this._closeModal();
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────

  _bindModal() {
    document.getElementById('se-add-btn').onclick = () => this._openNew();
    document.getElementById('se-modal-close').onclick = () => this._closeModal();
    document.getElementById('se-modal-cancel').onclick = () => this._closeModal();
    document.getElementById('se-modal-save').onclick = () => this._save();
    document.getElementById('se-add-mod-btn').onclick = () => this._addModRow();

    // Active toggle button
    const activeBtn = document.getElementById('se-input-active-btn');
    activeBtn.onclick = () => {
      this._activeState = !this._activeState;
      this._syncActiveToggle();
    };

    // Close on backdrop click
    document.getElementById('se-modal-backdrop').onclick = (e) => {
      if (e.target.id === 'se-modal-backdrop') this._closeModal();
    };
  }

  _syncActiveToggle() {
    const btn = document.getElementById('se-input-active-btn');
    const knob = document.getElementById('se-input-active-knob');
    if (this._activeState) {
      btn.style.backgroundColor = '#7c3aed'; // purple-700
      knob.style.transform = 'translateX(16px)';
      btn.setAttribute('aria-checked', 'true');
    } else {
      btn.style.backgroundColor = '#374151'; // gray-700
      knob.style.transform = 'translateX(0)';
      btn.setAttribute('aria-checked', 'false');
    }
  }

  _openNew() {
    this._editingId = null;
    this._activeState = true;
    this._modifiers = [];
    document.getElementById('se-modal-title').textContent = 'Nowy status';
    document.getElementById('se-input-title').value = '';
    document.getElementById('se-input-desc').value = '';
    this._syncActiveToggle();
    this._renderModRows();
    this._showModal();
  }

  _openEdit(statusId) {
    // Read current data from rendered list (they were stored in data-* attrs) –
    // or ask the backend.  Easier: store the last received array on this.
    const se = (this._lastEffects || []).find(s => s.status_id === statusId);
    if (!se) return;

    this._editingId = statusId;
    this._activeState = se.active;
    this._modifiers = (se.modifiers || []).map(m => ({ ...m }));

    document.getElementById('se-modal-title').textContent = 'Edytuj status';
    document.getElementById('se-input-title').value = se.title;
    document.getElementById('se-input-desc').value = se.description || '';
    this._syncActiveToggle();
    this._renderModRows();
    this._showModal();
  }

  _showModal() {
    document.getElementById('se-modal-backdrop').classList.remove('hidden');
  }

  _closeModal() {
    document.getElementById('se-modal-backdrop').classList.add('hidden');
  }

  // ─── Modifier rows ─────────────────────────────────────────────────────────

  _addModRow(mod = { stat_name: 'max_hp', value: 0, mod_type: 'ADD' }) {
    this._modifiers.push({ ...mod });
    this._renderModRows();
  }

  _renderModRows() {
    const ul = document.getElementById('se-mod-list');
    const emptyP = document.getElementById('se-mod-empty');
    ul.innerHTML = '';

    if (this._modifiers.length === 0) {
      emptyP.style.display = '';
      return;
    }
    emptyP.style.display = 'none';

    const STATS = ['max_hp', 'defense', 'ap', 'stamina', 'movement', 'str', 'dex', 'wis', 'cha'];

    this._modifiers.forEach((mod, idx) => {
      const li = document.createElement('li');
      li.className = 'flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2';
      li.innerHTML = `
        <!-- stat select -->
        <select data-mod-idx="${idx}" data-mod-field="stat_name"
                class="flex-1 bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-gray-200 focus:border-purple-500 focus:outline-none">
          ${STATS.map(s => `<option value="${s}" ${mod.stat_name === s ? 'selected' : ''}>${this._statLabel(s)}</option>`).join('')}
        </select>
        <!-- value -->
        <input type="number" step="0.5" data-mod-idx="${idx}" data-mod-field="value"
               value="${mod.value}"
               class="w-20 bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-gray-200 text-right focus:border-purple-500 focus:outline-none" />
        <!-- mod_type -->
        <select data-mod-idx="${idx}" data-mod-field="mod_type"
                class="w-20 bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-gray-200 focus:border-purple-500 focus:outline-none">
          <option value="ADD" ${mod.mod_type === 'ADD' ? 'selected' : ''}>+/−</option>
          <option value="MULT" ${mod.mod_type === 'MULT' ? 'selected' : ''}>×</option>
        </select>
        <!-- remove -->
        <button data-mod-remove="${idx}"
                class="w-7 h-7 flex items-center justify-center rounded-md text-gray-600 hover:text-rose-400 hover:bg-rose-900/20 transition-colors shrink-0">
          ${this._iconTrash(14)}
        </button>
      `;
      ul.appendChild(li);
    });

    // Bind change events
    ul.querySelectorAll('[data-mod-idx]').forEach(el => {
      el.addEventListener('change', () => {
        const idx = parseInt(el.dataset.modIdx);
        const field = el.dataset.modField;
        this._modifiers[idx][field] = el.value;
      });
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.modIdx);
        const field = el.dataset.modField;
        this._modifiers[idx][field] = el.value;
      });
    });
    ul.querySelectorAll('[data-mod-remove]').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.modRemove);
        this._modifiers.splice(idx, 1);
        this._renderModRows();
      };
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Keep the last received effects for edit-mode lookup. */
  render(char) {
    this._lastEffects = char.status_effects || [];
    this._doRender(char);
  }

  _doRender(char) {
    const effects = char.status_effects || [];
    const list = document.getElementById('se-list');
    const empty = document.getElementById('se-empty');
    if (!list) return;

    Array.from(list.children).forEach(c => { if (c.id !== 'se-empty') c.remove(); });

    if (effects.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    effects.forEach(se => {
      const li = document.createElement('li');
      li.className = [
        'flex items-start gap-3 p-3 rounded-xl border transition-all duration-150',
        se.active
          ? 'bg-purple-900/20 border-purple-700/40 hover:border-purple-500/60'
          : 'bg-gray-800/40 border-gray-700/30 opacity-60 hover:opacity-80',
      ].join(' ');

      const modSummary = (se.modifiers || []).map(m => {
        const isMult = m.mod_type === 'MULT';
        const prefix = isMult ? 'x' : (m.value >= 0 ? '+' : '');
        return `${this._statLabel(m.stat_name)} ${prefix}${m.value}`;
      }).join(' · ') || 'Brak modyfikatorów';

      li.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-sm font-bold ${se.active ? 'text-purple-200' : 'text-gray-400'} truncate">${this._esc(se.title)}</span>
            ${se.active
              ? '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-700/50 text-purple-300 font-semibold uppercase tracking-wide shrink-0">Aktywny</span>'
              : '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-500 font-semibold uppercase tracking-wide shrink-0">Wył.</span>'}
          </div>
          ${se.description ? `<p class="text-xs text-gray-500 mb-1 line-clamp-2">${this._esc(se.description)}</p>` : ''}
          <p class="text-xs ${se.active ? 'text-purple-400/80' : 'text-gray-600'} font-mono">${this._esc(modSummary)}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button data-se-toggle="${se.status_id}" title="${se.active ? 'Dezaktywuj' : 'Aktywuj'}"
                  class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                         ${se.active ? 'text-purple-400 hover:bg-purple-700/30' : 'text-gray-500 hover:bg-gray-700/40'}">
            ${se.active ? this._iconPause() : this._iconPlay()}
          </button>
          <button data-se-edit="${se.status_id}" title="Edytuj"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors">
            ${this._iconEdit()}
          </button>
          <button data-se-delete="${se.status_id}" title="Usuń"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-rose-400 hover:bg-rose-900/20 transition-colors">
            ${this._iconTrash()}
          </button>
        </div>
      `;
      list.appendChild(li);
    });

    this._bindListEvents();
  }

  _statLabel(name) {
    const map = {
      max_hp: 'HP',
      defense: 'Obrona',
      ap: 'AP',
      stamina: 'Wytrzymałość',
      movement: 'Ruch',
      str: 'Siła',
      dex: 'Zręczność',
      wis: 'Mądrość',
      cha: 'Charyzma',
    };
    return map[name] || name;
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _iconPause(size = 16) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
  }
  _iconPlay(size = 16) {
    return `<svg width="${size}" height="${size}" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>`;
  }
  _iconEdit(size = 16) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;
  }
  _iconTrash(size = 16) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  }
}
