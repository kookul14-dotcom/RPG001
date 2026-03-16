export class UIController {
    constructor() {
        this.textQueue = [];
        this._lastTextTimes = new Map();
        this._textOffsets = new Map(); // Y축 겹침 방지 오프셋
        
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

    // =================================================================
    // ⭐ [신규] 텍스트 내용을 분석하여 1~6단계 우선순위(Priority)를 자동 부여
    // 번호가 낮을수록(1순위) 먼저 화면에 출력됩니다.
    // =================================================================
    determinePriority(txt) {
        const t = String(txt).toUpperCase();
        
        // 🥇 1순위: 사전 판정 및 특수 방어
        if (t.includes('배후') || t.includes('막음') || t.includes('면역') || t.includes('무효') || 
            t.includes('패링') || t.includes('요격') || t.includes('비호') || t.includes('회피') || 
            t.includes('MISS') || t.includes('선견') || t.includes('역전세') || t.includes('수호천사') || 
            t.includes('금강불괴') || t.includes('불멸')) return 1;
            
        // 💀 6순위: 최종 결과 (가장 마지막에 떠야 제맛)
        if (t.includes('사망') || t.includes('처형') || t.includes('EXORCISED') || 
            t.includes('소멸') || t.includes('CRUMBLED')) return 6;
            
        // 🎖️ 5순위: 보상 및 시스템 (데미지, 상태이상 다 뜨고 난 후)
        if (t.includes('XP') || t.includes('G') || t.includes('획득') || 
            t.includes('탈취') || t.includes('훔침') || t.includes('레벨업')) return 5;
            
        // 🥉 3순위: 서브 자원 소모 및 반사 피해 (메인 데미지 직후)
        if (t.includes('MP') || t.includes('THORNS') || t.includes('REFLECT') || 
            t.includes('(') || t.includes('방패') || t.includes('반사')) return 3;
            
        // 🏅 4순위: 상태이상 및 버프/디버프 (데미지와 자원 소모 사이 또는 직후)
        if (t.includes('기절') || t.includes('출혈') || t.includes('중독') || t.includes('매혹') || 
            t.includes('공포') || t.includes('침묵') || t.includes('석화') || t.includes('수면') || 
            t.includes('혼란') || t.includes('은신') || t.includes('도발') || t.includes('조준') || 
            t.includes('지연') || t.includes('해제') || t.includes('정화') || t.includes('깨어남') || 
            t.includes('차단') || t.includes('유지') || t.includes('다 카포')) return 4;
            
        // 🥈 2순위: 메인 데미지 및 힐 (숫자로만 된 것들, 가장 기본)
        return 2;
    }

    showFloatingText(u, txt, col) {
        // 들어온 텍스트의 등급을 매겨서 큐에 타임스탬프와 함께 삽입
        const priority = this.determinePriority(txt);
        this.textQueue.push({ u, txt, col, priority, timestamp: Date.now() });
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
        
        // ⭐ 유닛(캐릭터)별로 대기열을 그룹화 (A를 때리고 B를 때리면 동시에 각각 떠야 함)
        const unitQueues = new Map();
        for (const item of this.textQueue) {
            const uId = item.u ? item.u.id : 'global';
            if (!unitQueues.has(uId)) unitQueues.set(uId, []);
            unitQueues.get(uId).push(item);
        }

        const toProcess = [];
        const remaining = [];

        // 오프셋(높이 쌓임) 쿨타임 초기화
        for (const [uId, lastTime] of this._lastTextTimes.entries()) {
            if (now - lastTime > 1500) {
                this._textOffsets.set(uId, 0);
            }
        }

        for (const [uId, queue] of unitQueues.entries()) {
            // ⭐ 큐 정렬: 1순위 -> 6순위. 순위가 같으면 먼저 들어온 순서대로!
            queue.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.timestamp - b.timestamp;
            });

            const lastTime = this._lastTextTimes.get(uId) || 0;
            
            // ⭐ 0.35초(350ms) 간격으로 하나씩 순차적으로 팝업!
            if (now - lastTime > 350) {
                toProcess.push(queue[0]); // 가장 우선순위가 높은 1개 추출
                this._lastTextTimes.set(uId, now);
                
                // 나머지는 다시 대기열로 돌려보냄
                for (let i = 1; i < queue.length; i++) remaining.push(queue[i]);
            } else {
                // 아직 0.35초가 안 지났으면 전부 대기열 유지
                for (let i = 0; i < queue.length; i++) remaining.push(queue[i]);
            }
        }

        this.textQueue = remaining;

        // 화면에 렌더링
        for (const {u, txt, col} of toProcess) {
            let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const uId = u ? u.id : 'global';
            
            if (window.battle && window.battle.ui) {
                if (u && u.visualPos) {
                    pos = window.battle.ui.getUnitScreenPos(u);
                } else if (u && u.q !== undefined && u.r !== undefined) {
                    pos = window.battle.ui.getHexScreenPos(u.q, u.r);
                }
            }

            // Y축 스태킹(겹침 방지) 및 X축 지터링(타격감 흔들림)
            let currentOffset = this._textOffsets.get(uId) || 0;
            const jitterX = (Math.random() - 0.5) * 15; 
            const startY = pos.y + window.scrollY - 30 - currentOffset;

            // 다음 텍스트는 18px 더 위에서 시작되도록 예약
            this._textOffsets.set(uId, currentOffset + 18);

            const el = document.createElement('div'); 
            el.className = 'floating-text'; 
            el.textContent = txt; 
            
            Object.assign(el.style, {
                position: 'absolute', 
                left: (pos.x + window.scrollX + jitterX) + 'px', 
                top: startY + 'px', 
                color: col || '#fff',
                pointerEvents: 'none', 
                zIndex: '9999999',
                // ⭐ 가독성을 위한 검은색 이중 테두리 그림자
                textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000',
                fontWeight: 'bold',
                fontSize: '14px' // ⭐ 글자 크기 축소 (기존 18~24px -> 14px)
            }); 
            
            this.activeTextCount++; 
            document.body.appendChild(el); 
            
            // ⭐ 글자가 뿅! 하고 나타났다 부드럽게 승천하는 애니메이션
            el.animate([
                { opacity: 1, transform: 'translate(-50%, 0) scale(1.3)' }, // 살짝 크게 등장
                { opacity: 1, transform: 'translate(-50%, -5px) scale(1)', offset: 0.15 },
                { opacity: 0.8, transform: 'translate(-50%, -20px)' },
                { opacity: 0, transform: 'translate(-50%, -35px)' }
            ], {
                duration: 1500, // 1.5초 유지
                easing: 'ease-out',
                fill: 'forwards'
            });

            setTimeout(() => { 
                el.remove(); 
                this.activeTextCount = Math.max(0, this.activeTextCount - 1); 
            }, 1500); 
        } 
    }

    async waitForAllTexts() {
        let safetyCount = 0;
        // 화면에 그려진 텍스트나 큐에 남은 텍스트가 있으면 다 끝날 때까지 대기
        while ((this.textQueue.length > 0 || this.activeTextCount > 0) && safetyCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            safetyCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

export const UI = new UIController();