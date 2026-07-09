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
        const container = document.getElementById(this.containerId);
        
        // Name input
        this.nameInput = document.getElementById("char-name");
        this.nameInput.addEventListener("change", (e) => this.updateName(e.target.value));

        // Level modifiers (+ and - buttons)
        const lvlButtons = container.querySelectorAll("[data-action='modify-level']");
        lvlButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const delta = parseInt(btn.getAttribute("data-delta"));
                this.modifyLevel(delta);
            });
        });

        // Stat modifiers (+ and - buttons)
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

    async modifyLevel(delta) {
        let char = await eel.modify_level(delta)();
        this.render(char);
    }

    render(char) {
        this.nameInput.value = char.name;
        document.getElementById("char-level").innerText = char.level;
        document.getElementById("unspent-points").innerText = char.unspent_stat_points;

        // Render main numbers
        document.getElementById("char-hp").innerText = `${char.hp} / ${char.max_hp.total}`;
        document.getElementById("char-def").innerText = Number.isInteger(char.defense.total) ? char.defense.total : char.defense.total.toFixed(1);
        document.getElementById("char-ap").innerText = Number.isInteger(char.ap.total) ? char.ap.total : char.ap.total.toFixed(1);
        document.getElementById("char-stam").innerText = Number.isInteger(char.stamina.total) ? char.stamina.total : char.stamina.total.toFixed(1);
        document.getElementById("char-move").innerText = char.movement.total;

        // Helper to render breakdown tooltips
        const renderBreakdown = (containerId, breakdownArray) => {
            const container = document.getElementById(containerId);
            container.innerHTML = breakdownArray.map(item => {
                const colorClass = item.value >= 0 ? "text-emerald-400" : "text-rose-400";
                const sign = item.value > 0 ? "+" : "";
                return `<li class="flex justify-between">
                          <span class="text-gray-400">${item.source}</span>
                          <span class="${colorClass} font-semibold">${sign}${item.value}</span>
                        </li>`;
            }).join('');
        };

        renderBreakdown("breakdown-hp", char.max_hp.breakdown);
        renderBreakdown("breakdown-def", char.defense.breakdown);
        renderBreakdown("breakdown-ap", char.ap.breakdown);
        renderBreakdown("breakdown-stam", char.stamina.breakdown);
        renderBreakdown("breakdown-move", char.movement.breakdown);

        document.getElementById("stat-str").innerText = char.stats.str;
        document.getElementById("stat-dex").innerText = char.stats.dex;
        document.getElementById("stat-wis").innerText = char.stats.wis;
        document.getElementById("stat-cha").innerText = char.stats.cha;
    }
}
