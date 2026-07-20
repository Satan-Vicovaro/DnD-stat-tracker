export class NotesComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.editor = null;
    this.isUpdating = false;
    this.saveTimeout = null;
    this.saveStatus = null;
  }

  async init() {
    // Load HTML structure
    const response = await fetch('/components/notes.html');
    this.container.innerHTML = await response.text();

    this.saveStatus = document.getElementById('notes-save-status');

    // Initialize TOAST UI Editor
    this.editor = new toastui.Editor({
      el: document.getElementById('notes-editor'),
      height: '600px',
      initialEditType: 'wysiwyg',
      previewStyle: 'tab',
      theme: 'dark',
      initialValue: "",
    });

    // Handle autosave when typing
    const triggerSave = async () => {
      clearTimeout(this.saveTimeout);
      this.saveStatus.style.opacity = '1';
      this.saveStatus.textContent = 'Zapisywanie...';
      this.saveStatus.classList.remove('text-emerald-400');
      this.saveStatus.classList.add('text-gray-400');

      try {
        const content = this.editor.getMarkdown();
        const updatedChar = await eel.update_notes(content)();
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: updatedChar }));
        
        this.saveStatus.textContent = 'Zapisano';
        this.saveStatus.classList.remove('text-gray-400');
        this.saveStatus.classList.add('text-emerald-400');
        
        setTimeout(() => {
          if (this.saveStatus.textContent === 'Zapisano') {
            this.saveStatus.style.opacity = '0';
          }
        }, 2000);
      } catch (e) {
        console.error("Notes save failed", e);
      }
    };

    this.editor.on('change', () => {
      if (this.isUpdating) return; // Prevent loop when updated from backend
      
      this.saveStatus.style.opacity = '1';
      this.saveStatus.textContent = 'Oczekujące...';
      this.saveStatus.classList.remove('text-emerald-400');
      this.saveStatus.classList.add('text-gray-400');

      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(triggerSave, 1000);
    });

    this.editor.on('blur', () => {
      if (this.isUpdating) return;
      triggerSave();
    });

    // Listen for global character updates (e.g. undo/redo or load save)
    document.addEventListener('characterUpdated', (e) => {
      this.render(e.detail);
    });

    // Fix editor refresh issue when tab becomes visible
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-target') === 'tab-content-notes') {
          // TOAST UI Editor usually handles resize automatically,
          // but we can force a layout update if needed.
        }
      });
    });

    // Fetch initial state so notes are displayed on load
    let char = await eel.get_character()();
    this.render(char);
  }

  render(characterData) {
    if (!characterData) return;
    
    // Only update if it's different to avoid resetting cursor position
    const currentNotes = characterData.notes || "";
    if (this.editor && this.editor.getMarkdown() !== currentNotes) {
      this.isUpdating = true;
      this.editor.setMarkdown(currentNotes, false); // false = do not move cursor to end
      this.isUpdating = false;
    }
  }
}
