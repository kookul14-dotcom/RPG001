export class UIController {
    constructor() {
        this.textQueue = [];
        this._lastTextTimes = new Map();
        
        // ⭐ [신규] 현재 화면에서 애니메이션 중인 텍스트 갯수를 추적
        this.activeTextCount = 0; 
        
        this._rafId = null;
        this.renderLoop = this.renderLoop.bind(this);
        this.startLoop();
    }

    startLoop() {
        if (!this._rafId) {
            this._rafId = requestAnimationFrame(this.renderLoop);
        }
    }

    renderLoop() {
        this.processTextQueue();
        this._rafId = requestAnimationFrame(this.renderLoop);
    }

    showFloatingText(u, txt, col) {
        this.textQueue.push({ u, txt, col });
    }

    log(msg, type) {
        const box = document.getElementById('log-content');
        if (box) {
            box.insertAdjacentHTML('beforeend', `<div class="log-entry ${type}" style="margin-bottom:2px; padding-bottom:2px; border-bottom:1px dashed #3e2723;">${msg}</div>`);
            if (box.childElementCount > 100) {
                box.removeChild(box.firstElementChild);
            }
            const logBox = document.getElementById('log-box');
            if (logBox) logBox.scrollTop = logBox.scrollHeight;
        }
    }

    processTextQueue() { 
        if (this.textQueue.length === 0) return;
        
        const now = Date.now();
        const toProcess = [];
        const remaining = [];
        const processedUnits = new Set();

        for (const item of this.textQueue) {
            const uId = item.u ? item.u.id : 'global';
            const lastTime = this._lastTextTimes.get(uId) || 0;
            
            if (!processedUnits.has(uId) && (now - lastTime > 450)) {
                toProcess.push(item);
                processedUnits.add(uId);
                this._lastTextTimes.set(uId, now);
            } else {
                remaining.push(item);
            }
        }

        this.textQueue = remaining;

        for (const {u, txt, col} of toProcess) {
            let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            
            if (window.battle && window.battle.ui) {
                if (u && u.visualPos) {
                    pos = window.battle.ui.getUnitScreenPos(u);
                } else if (u && u.q !== undefined && u.r !== undefined) {
                    pos = window.battle.ui.getHexScreenPos(u.q, u.r);
                }
            }

            const el = document.createElement('div'); 
            el.className = 'floating-text'; 
            el.textContent = txt; 
            
            Object.assign(el.style, {
                position: 'absolute', 
                left: (pos.x + window.scrollX) + 'px', 
                top: (pos.y + window.scrollY - 30) + 'px', 
                color: col || '#fff',
                pointerEvents: 'none', 
                zIndex: '9999999',
            }); 
            
            // ⭐ [신규] 텍스트가 화면에 나타날 때 카운트 증가
            this.activeTextCount++; 
            document.body.appendChild(el); 
            
            setTimeout(() => { 
                el.remove(); 
                // ⭐ [신규] 3초 뒤 애니메이션이 끝나고 사라질 때 카운트 감소
                this.activeTextCount = Math.max(0, this.activeTextCount - 1); 
            }, 3000); 
        } 
    }

    // =================================================================
    // ⭐ [신규] 카메라 매니저 등에서 안전하게 호출할 수 있는 대기 함수
    // =================================================================
    async waitForAllTexts() {
        let safetyCount = 0;
        // 큐에 대기 중인 텍스트가 있거나, 화면에 떠 있는 텍스트가 있다면 0.1초씩 무한 대기 (최대 5초 안전장치)
        while ((this.textQueue.length > 0 || this.activeTextCount > 0) && safetyCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            safetyCount++;
        }
        // 애니메이션이 완전히 투명해지고 사라진 후 약간의 시각적 여유(Delay) 추가
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

export const UI = new UIController();