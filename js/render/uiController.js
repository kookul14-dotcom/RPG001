
export class UIController {
    constructor() {
        this.textQueue = [];
    }


    showFloatingText(u, txt, col) {

        if (window.battle) {
            window.battle.textQueue.push({ u, txt, col, delay: window.battle.textQueue.length * 200 });
        }
    }

    log(msg, type) {
        const box = document.getElementById('log-content');
        if (box) {
            box.innerHTML += `<div class="log-entry ${type}">${msg}</div>`;
            document.getElementById('log-box').scrollTop = 9999;
        }
    }
}

export const UI = new UIController();