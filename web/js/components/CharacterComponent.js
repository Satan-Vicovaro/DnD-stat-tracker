export class CharacterComponent {
    constructor(containerId) {
        this.containerId = containerId;
    }

    async init() {
        // Fetch and inject the HTML template
        const response = await fetch('/components/character.html');
        const html = await response.text();
        document.getElementById(this.containerId).innerHTML = html;

        this.bindEvents();

        // Listen for external updates (e.g., from ArmorComponent)
        window.addEventListener('characterUpdated', (e) => {
            this.render(e.detail);
        });

        // Load initial data from backend
        let char = await eel.get_character()();
        this.render(char);
    }

    bindEvents() {
        // Name input
        this.nameInput = document.getElementById("char-name");
        this.nameInput.addEventListener("change", (e) => this.updateName(e.target.value));

        // Stat modifiers (+ and - buttons)
        const container = document.getElementById(this.containerId);
        const statButtons = container.querySelectorAll("[data-action='modify-stat']");
        
        statButtons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const stat = btn.getAttribute("data-stat");
                const delta = parseInt(btn.getAttribute("data-delta"));
                this.modifyStat(stat, delta);
            });
        });
    }

    async updateName(newName) {
        let char = await eel.update_name(newName)();
        this.render(char);
    }

    async modifyStat(statName, delta) {
        let char = await eel.modify_stat(statName, delta)();
        this.render(char);
    }

    render(char) {
        this.nameInput.value = char.name;
        document.getElementById("char-level").innerText = char.level;

        document.getElementById("char-hp").innerText = `${char.hp} / ${char.max_hp}`;
        document.getElementById("char-def").innerText = Number.isInteger(char.defense) ? char.defense : char.defense.toFixed(1);
        document.getElementById("char-ap").innerText = Number.isInteger(char.ap) ? char.ap : char.ap.toFixed(1);
        document.getElementById("char-stam").innerText = Number.isInteger(char.stamina) ? char.stamina : char.stamina.toFixed(1);

        document.getElementById("stat-str").innerText = char.stats.str;
        document.getElementById("stat-dex").innerText = char.stats.dex;
        document.getElementById("stat-wis").innerText = char.stats.wis;
        document.getElementById("stat-cha").innerText = char.stats.cha;
    }
}
