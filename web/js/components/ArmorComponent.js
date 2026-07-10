export class ArmorComponent {
    constructor(containerId) {
        this.containerId = containerId;
    }

    async init() {
        const response = await fetch('/components/armor.html');
        const html = await response.text();
        document.getElementById(this.containerId).innerHTML = html;

        // Listen for external updates
        document.addEventListener('characterUpdated', (e) => {
            this.render(e.detail);
        });

        // Since this component might render before or after CharacterComponent, 
        // we can share state by just fetching the current state.
        let char = await eel.get_character()();
        this.render(char);
    }

    async modifyArmor(armorName, delta) {
        let char = await eel.modify_armor_quantity(armorName, delta)();
        this.render(char);
        
        // Broadcast an event or directly update character component since they share the same data model.
        // For simplicity, we can trigger a custom event that CharacterComponent listens to.
        document.dispatchEvent(new CustomEvent('characterUpdated', { detail: char }));
    }

    render(char) {
        const armorData = char.armor;
        const container = document.getElementById("armor-list-container");
        
        // Rebuild list
        container.innerHTML = "";
        let totalFragments = 0;

        armorData.types.forEach(type => {
            totalFragments += type.quantity;
            
            const row = document.createElement("div");
            row.className = "flex justify-between items-center bg-gray-700/20 py-2 px-4 rounded-lg";
            
            row.innerHTML = `
                <div class="flex flex-col w-32">
                    <span class="text-gray-300 font-bold">${type.name}</span>
                    <span class="text-xs text-gray-500">${type.space_per_fragment} space / frag</span>
                </div>
                <div class="flex items-center space-x-3">
                    <button data-action="modify-armor" data-name="${type.name}" data-delta="-1" class="w-8 h-8 rounded-full bg-gray-700 hover:bg-rose-500/80 text-gray-300 flex items-center justify-center transition-colors font-bold">-</button>
                    <span class="font-bold text-fuchsia-300 text-lg w-6 text-center">${type.quantity}</span>
                    <button data-action="modify-armor" data-name="${type.name}" data-delta="1" class="w-8 h-8 rounded-full bg-gray-700 hover:bg-emerald-500/80 text-gray-300 flex items-center justify-center transition-colors font-bold ${armorData.remaining_space < type.space_per_fragment ? 'opacity-30 cursor-not-allowed' : ''}">+</button>
                </div>
                <div class="w-12 text-right">
                    <span class="text-sm font-semibold text-gray-400" title="Zużyte miejsce">${type.used_space}</span>
                </div>
            `;
            container.appendChild(row);
        });

        // Bind buttons
        const btns = container.querySelectorAll("[data-action='modify-armor']");
        btns.forEach(btn => {
            btn.addEventListener("click", () => {
                const name = btn.getAttribute("data-name");
                const delta = parseInt(btn.getAttribute("data-delta"));
                this.modifyArmor(name, delta);
            });
        });

        document.getElementById("armor-total-fragments").innerText = `${totalFragments} frag`;
        document.getElementById("armor-used-space").innerText = armorData.total_used_space;
        document.getElementById("armor-max-space").innerText = armorData.max_space;
        document.getElementById("armor-remaining-space").innerText = armorData.remaining_space;

        const percentage = (armorData.total_used_space / armorData.max_space) * 100;
        const bar = document.getElementById("armor-capacity-bar");
        bar.style.width = `${percentage}%`;
        
        if (percentage >= 100) {
            bar.classList.replace("bg-fuchsia-500", "bg-rose-500");
        } else {
            bar.classList.replace("bg-rose-500", "bg-fuchsia-500");
        }
    }
}
