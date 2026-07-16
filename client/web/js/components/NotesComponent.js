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

    // Initialize EasyMDE
    this.editor = new EasyMDE({
      element: document.getElementById('notes-editor'),
      spellChecker: false,
      status: false,
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "guide"],
      placeholder: "Tutaj możesz wpisać swoje notatki, przemyślenia z sesji, plany...",
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
        const content = this.editor.value();
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

    this.editor.codemirror.on('change', () => {
      if (this.isUpdating) return; // Prevent loop when updated from backend
      
      this.saveStatus.style.opacity = '1';
      this.saveStatus.textContent = 'Oczekujące...';
      this.saveStatus.classList.remove('text-emerald-400');
      this.saveStatus.classList.add('text-gray-400');

      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(triggerSave, 1000);
    });

    this.editor.codemirror.on('blur', () => {
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
          setTimeout(() => {
            if (this.editor) {
              this.editor.codemirror.refresh();
            }
          }, 10);
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
    if (this.editor && this.editor.value() !== currentNotes) {
      this.isUpdating = true;
      this.editor.value(currentNotes);
      this.isUpdating = false;
    }
  }
}
