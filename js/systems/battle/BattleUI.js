import { 
    ITEM_DATA, 
    SKILL_DATABASE, 
    CLASS_DATA, 
    TIER_REQ, 
    EFFECTS, 
    ELEMENTS,
    TERRAIN_TYPES 
} from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';
import { JOB_CLASS_DATA } from '../../data/classes.js';
import { PORTRAIT_DATA } from '../../data/portraits.js';

export class BattleUI {
    constructor(battleSystem, canvas) {
        this.battle = battleSystem;
        this.canvas = canvas;
        
        this.textQueue = [];
        this.lastTextTime = 0;
        this._lastTargets = [];
        this._lastTerrain = null;
        this.lockedTargetPanel = false;

        // ⭐ 주야간(Day & Night) 시스템 상태 초기화
        this.timeState = { 
            hour: this.battle.gameApp?.gameState?.startHour ?? 11, // 기본 정오 시작
            actions: 0 
        };

        this._cachedRect = this.canvas.getBoundingClientRect();
        this.resizeHandler = () => {
            if (this.canvas) this._cachedRect = this.canvas.getBoundingClientRect();
        };
        window.addEventListener('resize', this.resizeHandler);

        // 맵 위 유닛 이펙트 컨테이너
        this.overlayContainer = document.getElementById('unit-overlays');
        if (!this.overlayContainer) {
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'unit-overlays';
            Object.assign(this.overlayContainer.style, {
                position: 'absolute', top: '0', left: '0', 
                pointerEvents: 'none', width: '100%', height: '100%', zIndex: '100'
            });
            document.body.appendChild(this.overlayContainer);
        }

        // 글로벌 툴팁 컨테이너
        let tooltip = document.getElementById('global-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'global-tooltip';
            tooltip.style.cssText = 'display:none; position:fixed; background:rgba(20,15,10,0.95); border:1px solid #8d6e63; padding:10px; border-radius:6px; color:#d7ccc8; font-size:12px; z-index:100000; box-shadow:0 4px 15px rgba(0,0,0,0.9); pointer-events:none; min-width:180px; text-align:left;';
            document.body.appendChild(tooltip);
        }

        if (!document.getElementById('force-fullscreen-styles')) {
            const style = document.createElement('style');
            style.id = 'force-fullscreen-styles';
            style.innerHTML = `
                #bottom-panel { display: none !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; }
                .battle-layout, #scene-battle { grid-template-rows: 1fr !important; grid-template-columns: 260px 1fr 260px !important; padding-bottom: 0 !important; height: 100vh !important; }
                #viewport-container, #viewport, canvas { height: 100vh !important; max-height: 100vh !important; }
                
                #sidebar-left, #sidebar-right { display: flex; flex-direction: column; overflow: hidden; height: 100vh; position: relative; z-index: 10000; }
                
                /* 커스텀 스크롤바 스타일 */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #5d4037; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #8d6e63; }
                .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #5d4037 rgba(0,0,0,0.3); }
            `;
            document.head.appendChild(style);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        }

        const oldLog = document.getElementById('draggable-log-container');
        if (oldLog) oldLog.remove();

        if (!document.getElementById('surrender-btn-container')) {
            const surr = document.createElement('div');
            surr.id = 'surrender-btn-container';
            surr.style.cssText = 'position: absolute; bottom: 20px; left: 20px; z-index: 10001;';
            surr.innerHTML = `<button id="btn-surrender" style="background:#2d1717; color:#e57373; border:1px solid #8e3636; border-radius:4px; padding:6px 16px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s; box-shadow: 0 4px 8px rgba(0,0,0,0.6);" onmouseover="this.style.background='#422323'" onmouseout="this.style.background='#2d1717'">🏳️ 항복하기</button>`;
            document.body.appendChild(surr);

            setTimeout(() => {
                const btn = document.getElementById('btn-surrender');
                if (btn) btn.onclick = () => {
                    if(this.battle.gameApp) {
                        this.battle.gameApp.showConfirm("정말 항복하시겠습니까?", () => { this.battle.endBattleSequence(false, true); });
                    }
                };
            }, 50);
        }

        const rightPanel = document.getElementById('sidebar-right');
        if (rightPanel && !document.getElementById('battle-log-wrapper')) {
            rightPanel.innerHTML = ''; 
            
            const targetWrapper = document.createElement('div');
            targetWrapper.id = 'target-info-wrapper';
            targetWrapper.style.cssText = 'flex: 1; overflow: hidden; display: flex; flex-direction: column;';
            
            const logWrapper = document.createElement('div');
            logWrapper.id = 'battle-log-wrapper';
            logWrapper.style.cssText = 'height: 250px; background: rgba(18, 15, 13, 0.98); border-top: 2px solid #5d4037; display: flex; flex-direction: column; flex-shrink: 0; pointer-events: auto;';
            logWrapper.innerHTML = `
                <div style="width: 100%; height: 26px; background: #3e2723; display:flex; align-items:center; justify-content:center; font-size: 11px; color: #bcaaa4; font-weight:bold; border-bottom: 1px solid #5d4037; flex-shrink: 0;">
                    ≡ BATTLE LOG ≡
                </div>
                <div id="log-box" class="custom-scrollbar" style="flex: 1; overflow-y: auto; padding: 10px; font-size: 11px; color: #d7ccc8; word-break: keep-all;">
                    <div id="log-content" style="display:flex; flex-direction:column; gap:4px;"></div>
                </div>
            `;
            
            rightPanel.appendChild(targetWrapper);
            rightPanel.appendChild(logWrapper);

            const logBoxEl = document.getElementById('log-box');
            if (logBoxEl) {
                logBoxEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
            }
        }

        // ⭐ 주야간 UI 및 필터 초기화 실행
        this.initDayNightUI();

        this._rafId = null;
        this._isDestroyed = false;
        this.renderLoop = this.renderLoop.bind(this);
        this._rafId = requestAnimationFrame(this.renderLoop);
    }

    destroy() {
        this._isDestroyed = true;
        window.removeEventListener('resize', this.resizeHandler);
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = null;
    }

    // =========================================================================
    // ⭐ [신규] 워크래프트 스타일 주야간(Day & Night) 시스템
    // =========================================================================

    initDayNightUI() {
        // 1. 맵 전체를 덮는 색상 필터 (UI 뒤에 위치해야 하므로 z-index 50)
        let filterOverlay = document.getElementById('day-night-filter');
        if (!filterOverlay) {
            filterOverlay = document.createElement('div');
            filterOverlay.id = 'day-night-filter';
            filterOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 50; mix-blend-mode: multiply; transition: background 2.5s ease-in-out; background: rgba(0,0,0,0);';
            document.body.appendChild(filterOverlay);
        }

        // 2. 중앙 상단 시계 UI 생성 (최상단 노출)
        let clockContainer = document.getElementById('warcraft-clock');
        if (!clockContainer) {
            clockContainer = document.createElement('div');
            clockContainer.id = 'warcraft-clock';
            clockContainer.style.cssText = 'position: absolute; top: 15px; left: 50%; transform: translateX(-50%); z-index: 10005; display: flex; flex-direction: column; align-items: center; pointer-events: none; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.8));';
            
            // 12개의 점 위치 계산 (삼각함수 적용)
            let dotsHtml = '';
            for (let i = 0; i < 12; i++) {
                const angle = (i * 30) * (Math.PI / 180);
                const x = 32 + 38 * Math.sin(angle) - 4; // 중심 32, 반지름 38, 점 크기 보정(-4)
                const y = 32 - 38 * Math.cos(angle) - 4;
                dotsHtml += `<div id="time-dot-${i}" style="position:absolute; left:${x}px; top:${y}px; width:8px; height:8px; border-radius:50%; background:#3e2723; border:1px solid #1a1210; transition: background 0.5s, box-shadow 0.5s;"></div>`;
            }

            clockContainer.innerHTML = `
                <div style="position: relative; width: 64px; height: 64px;">
                    <div style="position:absolute; top:4px; left:4px; width:56px; height:56px; background:#1a1210; border-radius:50%; border:2px solid #5d4037;"></div>
                    
                    <div id="time-center-icon" style="position:absolute; top:8px; left:8px; width:48px; height:48px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:28px; transition: 1s ease-in-out; text-shadow: 0 0 10px rgba(255,255,255,0.5);">
                        ☀️
                    </div>
                    
                    <div id="time-dots-container" style="position:absolute; top:0; left:0; width:64px; height:64px;">
                        ${dotsHtml}
                    </div>
                </div>
            `;
            document.body.appendChild(clockContainer);
        }
        
        // 초기 렌더링
        this.updateDayNightVisuals();
    }

    /**
     * 외부(BattleSystem, SkillProcessor)에서 턴이 종료될 때마다 호출하는 함수
     * ex) this.battle.ui.addTimeAction(1);
     */
    addTimeAction(amount = 1) {
        this.timeState.actions += amount;
        
        if (this.timeState.actions >= 10) {
            const hoursPassed = Math.floor(this.timeState.actions / 10);
            this.timeState.actions = this.timeState.actions % 10; // 나머지 이월
            
            this.timeState.hour = (this.timeState.hour + hoursPassed) % 24;
            
            this.log(`🔔 시간이 흘러 [${this.getTimeNameByHour(this.timeState.hour)}] 시간대가 되었습니다.`, 'log-system');
        }
        
        this.updateDayNightVisuals();
    }

    updateDayNightVisuals() {
        const h = this.timeState.hour;

        // 1. 색상 필터 업데이트
        const filterEl = document.getElementById('day-night-filter');
        if (filterEl) {
            filterEl.style.background = this.getFilterColorByHour(h);
        }

        // 2. 중앙 아이콘 (낮: 06시~17시, 밤: 18시~05시)
        const isDay = (h >= 6 && h < 18);
        const centerIcon = document.getElementById('time-center-icon');
        if (centerIcon) {
            centerIcon.innerHTML = isDay ? '☀️' : '🌙';
            // ⭐ 아날로그 시계처럼 1시간(1점)에 30도씩 회전
            centerIcon.style.transform = `rotate(${(h % 12) * 30}deg)`; 
            
            // 미니멀리즘을 위해 기존 툴팁 속성 제거
            if (centerIcon.parentElement.title) {
                centerIcon.parentElement.removeAttribute('title');
            }
        }

        // 3. 12개의 Dot 조명 업데이트 (아날로그 시계 방식)
        const activeDotIndex = h % 12; // 0 ~ 11 (12시간 기준)
        const isPM = h >= 12; // 현재 오전/오후 판별

        for (let i = 0; i < 12; i++) {
            const dot = document.getElementById(`time-dot-${i}`);
            if (dot) {
                if (i === activeDotIndex) {
                    // 현재 시각: 가장 밝게 빛나는 하늘색 점
                    dot.style.background = '#00e5ff'; 
                    dot.style.boxShadow = '0 0 8px #00e5ff, 0 0 15px #00e5ff';
                    dot.style.border = '1px solid #fff';
                } else if (i < activeDotIndex) {
                    // ⭐ 지나간 시각: 해당 점이 '낮'인지 '밤'인지 계산하여 색상 분리
                    const dotHour = isPM ? (12 + i) : i; 
                    const isDotDay = (dotHour >= 6 && dotHour < 18);

                    if (isDotDay) {
                        dot.style.background = '#ffca28'; // 낮에 지나간 시간 (밝은 점)
                        dot.style.boxShadow = 'none';
                    } else {
                        dot.style.background = '#283593'; // 밤에 지나간 시간 (희미한 푸른 점)
                        dot.style.boxShadow = 'inset 0 0 4px rgba(0,0,0,0.5)';
                    }
                    dot.style.border = '1px solid #1a1210';
                } else {
                    // 아직 오지 않은 시각: 꺼진 점
                    dot.style.background = '#3e2723'; 
                    dot.style.boxShadow = 'none';
                    dot.style.border = '1px solid #1a1210';
                }
            }
        }
    }

    getFilterColorByHour(h) {
        if (h >= 5 && h < 7) return 'rgba(100, 100, 180, 0.2)'; // 새벽 (청보라)
        if (h >= 7 && h < 11) return 'rgba(255, 255, 200, 0.05)'; // 아침 (연한 노랑)
        if (h >= 11 && h < 15) return 'rgba(0, 0, 0, 0)'; // 정오 (필터 없음)
        if (h >= 15 && h < 18) return 'rgba(255, 150, 50, 0.15)'; // 오후 (금빛)
        if (h >= 18 && h < 22) return 'rgba(180, 50, 0, 0.3)'; // 저녁 (노을)
        return 'rgba(10, 15, 40, 0.55)'; // 밤 (심야)
    }

    getTimeNameByHour(h) {
        if (h >= 5 && h < 7) return '새벽';
        if (h >= 7 && h < 11) return '아침';
        if (h >= 11 && h < 15) return '정오';
        if (h >= 15 && h < 18) return '오후';
        if (h >= 18 && h < 22) return '저녁';
        return '밤';
    }

    // =========================================================================

    renderLoop() {
        if (this._isDestroyed || this.battle.isBattleEnded) return;
        this.renderUnitOverlays();
        this.processTextQueue();
        this.updatePanelDynamics(); 
        this._rafId = requestAnimationFrame(this.renderLoop);
    }

    renderUI() {
        this.renderPartyList(); 
        if (this._lastTargets || this._lastTerrain) {
            this.updateRightPanel(this._lastTargets, this._lastTerrain);
        }
        this.updateFloatingControls();
    }

    updateStatusPanel() {
        this.renderUI();
    }

    updatePanelDynamics() {
        const u = this.battle.currentUnit;
        if (u) this._syncUnitBarsAndStatus(u, 'left');

        if (this._lastTargets && this._lastTargets.length === 1) {
            this._syncUnitBarsAndStatus(this._lastTargets[0], 'right-0');
        } else if (this._lastTargets && this._lastTargets.length > 1) {
            this._lastTargets.forEach((tu, idx) => {
                this._syncUnitBarsAndStatus(tu, `right-${idx}`, true);
            });
        }
    }

    _syncUnitBarsAndStatus(u, prefix, isMini = false) {
        if (!u) return;
        
        const hpFill = document.getElementById(`bar-${prefix}-hp-fill`);
        const hpText = document.getElementById(`bar-${prefix}-hp-text`);
        if (hpFill && hpText) {
            const hpP = Math.max(0, Math.min(100, (u.curHp / u.hp) * 100));
            hpFill.style.width = `${hpP}%`;
            hpText.innerText = isMini ? `HP: ${Math.floor(u.curHp)}` : `${Math.floor(u.curHp)}/${u.hp}`;
        }

        const mpFill = document.getElementById(`bar-${prefix}-mp-fill`);
        const mpText = document.getElementById(`bar-${prefix}-mp-text`);
        if (mpFill && mpText) {
            const mpP = Math.max(0, Math.min(100, (u.curMp / u.mp) * 100));
            mpFill.style.width = `${mpP}%`;
            mpText.innerText = isMini ? `MP: ${Math.floor(u.curMp)}` : `${Math.floor(u.curMp)}/${u.mp}`;
        }

        const wtFill = document.getElementById(`bar-${prefix}-wt-fill`);
        const wtText = document.getElementById(`bar-${prefix}-wt-text`);
        if (wtFill && wtText) {
            let agP = 0, agC = 'linear-gradient(180deg, #ffca28 0%, #f57c00 100%)';
            if (u.actionGauge >= 0) { 
                agP = Math.min(100, (u.actionGauge / this.battle.actionGaugeLimit) * 100); 
            } else { 
                agP = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); 
                agC = 'linear-gradient(180deg, #ef5350 0%, #c62828 100%)'; 
            }
            wtFill.style.width = `${agP}%`;
            wtFill.style.background = agC;
            wtText.innerText = Math.floor(u.actionGauge||0);
        }

        const buffSig = (u.buffs || []).map(b => b.type + b.duration + (b.amount || '') + (b.val || '')).join(',');
        const sigEl = document.getElementById(`sig-${prefix}`);
        if (sigEl && sigEl.dataset.sig !== buffSig) {
            if (prefix === 'left') this.renderPartyList();
            else this.updateRightPanel(this._lastTargets, this._lastTerrain);
        }
    }

    showTooltip(e, html) { 
        const t = document.getElementById('global-tooltip'); 
        if(t) { 
            t.style.display = 'block'; 
            t.innerHTML = html; 
            let left = e.clientX + 15; 
            let top = e.clientY + 15; 
            if (left + 220 > window.innerWidth) left = e.clientX - 230; 
            if (top + 100 > window.innerHeight) top = e.clientY - 120; 
            t.style.left = left + 'px'; 
            t.style.top = top + 'px'; 
        } 
    }
    
    hideTooltip() { 
        const t = document.getElementById('global-tooltip');
        if(t) t.style.display = 'none'; 
        this.clearStatPreviews(); 
    }

    handleStatHover(e, baseStatKey, unitId) { 
        let u = this.battle.units.find(x => String(x.id) === String(unitId));
        if (!u) u = this.battle.viewingUnit || this.battle.currentUnit;
        if (!u || u.team !== 0 || u.statPoints <= 0) return;
        
        const curAtkP = Formulas.getDerivedStat(u, 'atk_phys'); 
        const curAtkM = Formulas.getDerivedStat(u, 'atk_mag'); 
        const curDef = Formulas.getDerivedStat(u, 'def'); 
        const curRes = Formulas.getDerivedStat(u, 'res'); 
        const curCrit = Formulas.getDerivedStat(u, 'crit'); 
        const curEva = Formulas.getDerivedStat(u, 'eva'); 
        const curHit = Formulas.getDerivedStat(u, 'hit_phys'); 
        const curSpd = Formulas.getDerivedStat(u, 'spd'); 

        u[baseStatKey] = (u[baseStatKey] || 0) + 1;
        if (u.hero) u.hero[baseStatKey] = (u.hero[baseStatKey] || 0) + 1;

        const nxtAtkP = Formulas.getDerivedStat(u, 'atk_phys'); 
        const nxtAtkM = Formulas.getDerivedStat(u, 'atk_mag'); 
        const nxtDef = Formulas.getDerivedStat(u, 'def'); 
        const nxtRes = Formulas.getDerivedStat(u, 'res'); 
        const nxtCrit = Formulas.getDerivedStat(u, 'crit'); 
        const nxtEva = Formulas.getDerivedStat(u, 'eva'); 
        const nxtHit = Formulas.getDerivedStat(u, 'hit_phys'); 
        const nxtSpd = Formulas.getDerivedStat(u, 'spd'); 

        u[baseStatKey]--;
        if (u.hero) u.hero[baseStatKey]--;

        const updateArrow = (baseId, v1, v2, combatKey) => { 
            const diff = v2 - v1;
            const els = document.querySelectorAll(`[id="${baseId}-${u.id}"]`); 
            els.forEach(el => {
                if (diff >= 2 || (combatKey==='hp' && diff>=5) || (combatKey==='mp' && diff>=5)) {
                    el.innerHTML = '<span style="color:#ffca28; font-weight:bold; font-size:12px;">▲▲</span>';
                } else if (diff >= 1) {
                    el.innerHTML = '<span style="color:#81c784; font-weight:bold; font-size:11px;">▲</span>';
                } else if (diff > 0) {
                    el.innerHTML = '<span style="color:#a5d6a7; font-weight:normal; font-size:10px;">↑</span>';
                } else {
                    el.innerHTML = '';
                }
            });
        }; 
        
        updateArrow('prev-atk_phys', curAtkP, nxtAtkP, 'atk_phys'); 
        updateArrow('prev-atk_mag', curAtkM, nxtAtkM, 'atk_mag'); 
        updateArrow('prev-def', curDef, nxtDef, 'def'); 
        updateArrow('prev-res', curRes, nxtRes, 'res'); 
        updateArrow('prev-crit', curCrit, nxtCrit, 'crit'); 
        updateArrow('prev-eva', curEva, nxtEva, 'eva'); 
        updateArrow('prev-hit_phys', curHit, nxtHit, 'hit_phys'); 
        updateArrow('prev-spd', curSpd, nxtSpd, 'spd'); 
    }

    clearStatPreviews() {
        const els = document.querySelectorAll('[id^="prev-"]');
        els.forEach(el => el.innerHTML = '');
    }
    
    allocateStat(k, unitId) { 
        let u = this.battle.units.find(x => String(x.id) === String(unitId));
        if (!u) u = this.battle.viewingUnit || this.battle.currentUnit;
        if (!u || u.team !== 0 || u.statPoints < 1) return; 
        
        u[k] = (u[k] || 0) + 1; 
        u.statPoints--; 
        if (k === 'vit') { u.hp += 5; u.curHp += 5; } 
        if (k === 'int') { u.mp += 5; u.curMp += 5; } 
        
        const baseHero = u.hero || u.originalHero || (this.battle.gameApp && this.battle.gameApp.gameState && this.battle.gameApp.gameState.heroes && this.battle.gameApp.gameState.heroes.find(h => h.id === u.id));
        
        if (baseHero && baseHero !== u) {
            baseHero[k] = (baseHero[k] || 0) + 1;
            baseHero.statPoints = u.statPoints;
            if (k === 'vit') { baseHero.hp += 5; baseHero.curHp += 5; } 
            if (k === 'int') { baseHero.mp += 5; baseHero.curMp += 5; } 
        }
        
        this.renderUI();
        
        this.showFloatingText(u, "STAT UP!", "#ffca28"); 
        if (this.battle.gameApp && this.battle.gameApp.saveGame) this.battle.gameApp.saveGame(); 
        
        if (u.statPoints > 0) this.handleStatHover(null, k, u.id);
        else this.clearStatPreviews();
    }

    _generatePortraitCardHtml(u, isAlly, titleText = null, prefix = 'left') {
        if (!u) return '';
        const themeColor = isAlly ? '#4a90e2' : '#e24a4a';
        const titleHtml = titleText ? `<div class="panel-header" style="background: ${themeColor}22; color: ${themeColor}; border-bottom: 2px solid ${themeColor}; font-size:14px; font-weight:bold; padding:8px;">${titleText}</div>` : '';

        const hpP = Math.max(0, Math.min(100, (u.curHp / u.hp) * 100));
        const mpP = Math.max(0, Math.min(100, (u.curMp / u.mp) * 100));
        let agP = 0, agC = 'linear-gradient(180deg, #ffca28 0%, #f57c00 100%)';
        if (u.actionGauge >= 0) { agP = Math.min(100, (u.actionGauge / this.battle.actionGaugeLimit) * 100); } 
        else { agP = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); agC = 'linear-gradient(180deg, #ef5350 0%, #c62828 100%)'; }

        let jobName = u.job || '견습생';
        if (jobName === '무직') jobName = '견습생';
        let classNameEn = ""; let classNameKr = ""; 
        if (u.classKey && typeof JOB_CLASS_DATA !== 'undefined') {
            let classInfo = JOB_CLASS_DATA[u.classKey];
            if (!classInfo) classInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === u.classKey && c.classLevel === (u.classLevel||1));
            if (!classInfo) classInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === u.classKey);
            if (classInfo) { jobName = classInfo.jobName; classNameEn = classInfo.classNameEn; classNameKr = classInfo.className; }
        }
        const classNum = u.classLevel || 1;
        let classDisplay = classNameEn ? `Class ${classNum}: ${classNameEn} (${classNameKr})` : jobName;
        let infoText = `Lv.${u.level || 1} ${jobName} | ${classDisplay}`;
        
        // ⭐ [상태창] 전투 불능 상태 명시
        if (u.isFullyDead) {
            infoText += `<br><span style="color:#f55; font-weight:bold;">[☠️ 완전 사망]</span>`;
        } else if (u.isIncapacitated) {
            infoText += `<br><span style="color:#f55; font-weight:bold;">[☠️ 전투 불능 - 남은 시간: ${u.deathTimer}턴]</span>`;
        }
        let buffsHtml = '';
        const buffSig = (u.buffs || []).map(b => b.type + b.duration + (b.amount || '') + (b.val || '')).join(',');
        (u.buffs || []).forEach(b => {
            const isDebuff = b.type.includes('DEBUFF') || b.type.includes('CC_') || b.type.includes('STAT_');
            const bCol = isDebuff ? '#e57373' : '#81c784';
            
            let detailHtml = '';
            if (b.amount !== undefined) {
                detailHtml += `<div style='color:#4fc3f7; font-size:11px; margin-top:2px;'>보호막 량: ${Math.floor(b.amount)}</div>`;
            } else if (b.val !== undefined && b.val !== 1 && b.val !== 0) {
                if (b.val < 10) { 
                    const pct = Math.abs(Math.round((b.val > 1 ? b.val - 1 : 1 - b.val) * 100));
                    if (pct > 0) detailHtml += `<div style='color:#ffb74d; font-size:11px; margin-top:2px;'>수치: ${pct}% ${b.val > 1 || !isDebuff ? '증가' : '감소'}</div>`;
                } else {
                    detailHtml += `<div style='color:#ffb74d; font-size:11px; margin-top:2px;'>수치: ${Math.floor(b.val)}</div>`;
                }
            }

            let descText = '';
            const typeUp = String(b.type).toUpperCase();
            if (typeUp.includes('POISON')) descText = '매 턴 독 피해를 입습니다.';
            else if (typeUp.includes('BLEED')) descText = '매 턴 출혈 피해, 이동시 추가 피해를 입고, 받는 회복량이 반감됩니다.';
            else if (typeUp.includes('BURN')) descText = '매 턴 화염 피해를 입으며 주변으로 번질 수 있습니다.';
            else if (typeUp.includes('FREEZE')) descText = '빙결상태로 행동할 수 없습니다.';
            else if (typeUp.includes('STUN')) descText = '기절하여 행동할 수 없습니다.';
            else if (typeUp.includes('SLEEP')) descText = '수면 상태로 행동할 수 없습니다.';
            else if (typeUp.includes('PARALYSIS')) descText = '마비되어 행동할 수 없습니다.';
            else if (typeUp.includes('PETRIFY')) descText = '돌로 굳어져 행동할 수 없습니다.';
            else if (typeUp.includes('CONFUSE') || typeUp.includes('CONFUSION')) descText = '혼란에 빠져 무작위 대상을 공격하며 조작할 수 없습니다.';
            else if (typeUp.includes('CHARM') || typeUp.includes('PUPPET')) descText = '매혹되어 아군을 공격합니다.';
            else if (typeUp.includes('SILENCE') || typeUp.includes('MUTE')) descText = '침묵에 빠져 마법/주문을 사용할 수 없습니다.';
            else if (typeUp.includes('CURSE')) descText = '저주받아 기본 공격 외의 스킬을 사용할 수 없습니다.';
            else if (typeUp.includes('BLIND')) descText = '명중률이 크게 감소합니다.';
            else if (typeUp.includes('GRAVITY') || typeUp.includes('GROUNDED')) descText = '비행이 해제되며 넉백/밀치기에 면역이 됩니다.';
            else if (typeUp.includes('BIND') || typeUp.includes('ROOT')) descText = '포박되어 이동할 수 없습니다.';
            else if (typeUp.includes('SHIELD')) descText = '피해를 흡수하는 보호막입니다.';
            else if (typeUp.includes('IMMUNE') || typeUp.includes('INVINCIBLE') || typeUp.includes('PROTECT')) descText = '상태이상에 걸리지 않는 면역 상태입니다.';
            else if (typeUp.includes('REGEN')) descText = '매 턴마다 생명력이나 마나를 회복합니다.';
            else if (typeUp.includes('CHANNELED')) descText = '연주 또는 춤을 유지하는 상태입니다.';
            else if (typeUp.includes('CASTING')) descText = '강력한 주문을 집중하여 시전 중입니다.';
            else if (typeUp.includes('FREECAST')) descText = '다음 스킬 사용 시 마나와 행동력을 소모하지 않습니다.';
            else if (typeUp.includes('STEALTH')) descText = '은신하여 단일 공격 대상으로 지정되지 않습니다.';
            else if (typeUp.includes('ATK') && !typeUp.includes('MATK')) descText = '물리 공격력 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('DEF') && !typeUp.includes('MDEF')) descText = '물리 방어력 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('MAG') || typeUp.includes('MATK') || typeUp.includes('INT')) descText = '마법 공격력 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('RES') || typeUp.includes('MDEF')) descText = '마법 저항력 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('SPD') || typeUp.includes('AGI') || typeUp.includes('WT')) descText = '행동 속도 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('ACC') || typeUp.includes('HIT')) descText = '명중률 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('EVA') || typeUp.includes('DODGE')) descText = '회피율 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('CRIT')) descText = '치명타 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('MOVE') || typeUp.includes('MOV') || typeUp.includes('JUMP')) descText = '이동력 관련 스탯이 변동된 상태입니다.';
            else if (typeUp.includes('TAUNT')) descText = '시선이 끌려 특정 대상을 강제로 공격하게 됩니다.';
            else if (typeUp.includes('FEAR') || typeUp.includes('DEMORALIZE')) descText = '전의를 상실하여 행동의 제약을 받습니다.';
            else if (typeUp.includes('ALL_STAT') || typeUp.includes('BUFF_ALL')) descText = '모든 전투 스탯이 상승한 상태입니다.';

            if (descText) {
                detailHtml += `<div style='color:#d7ccc8; font-size:11px; margin-top:4px; line-height:1.3; max-width: 180px; white-space: normal;'>${descText}</div>`;
            }

            if (b.isAura) detailHtml += `<div style='color:#ce93d8; font-size:10px; margin-top:4px; font-weight:bold;'>[오라 효과 적용 중]</div>`;

            // ⭐ [근본 해결] 이름이 없거나 '-'인 스탯 버프의 이름을 type 기반으로 자동 복구
            let displayName = b.name;
            if (!displayName || displayName === '-' || displayName === 'undefined') {
                displayName = String(b.type)
                    .replace('BUFF_STAT_GEAR', '장비 스탯 보정')
                    .replace('BUFF_STAT_ATK', '물리 공격력 증가')
                    .replace('BUFF_STAT_DEF', '물리 방어력 증가')
                    .replace('BUFF_STAT_WT', 'WT 단축(행동 가속)')
                    .replace('BUFF_ENCHANT_ELEM', '지형 속성 부여')
                    .replace('STAT_BLIND', '실명')
                    .replace('STAT_BLEED', '출혈')
                    .replace('STAT_CONFUSION', '혼란')
                    .replace('STAT_CHARM', '매혹')
                    .replace('STAT_FREEZE', '빙결')
                    .replace('STAT_SILENCE', '침묵')
                    .replace('STAT_STUN', '기절')
                    .replace('STAT_SLEEP', '수면')
                    .replace('STAT_FEAR', '공포')
                    .replace('STAT_DEMORALIZED', '전의 상실');
            }

            // ⭐ [근본 해결] type이 '-'인 쓸모없는 더미 데이터는 화면에 렌더링하지 않고 완벽히 필터링
            if (b.type !== '-') {
                const tooltipStr = `<div style='color:${bCol};font-weight:bold;font-size:13px;border-bottom:1px solid #5d4037;padding-bottom:3px;margin-bottom:3px;'>${b.icon||'✨'} ${displayName}</div>${detailHtml}<div style='color:#ffca28; font-size:11px; margin-top:6px; font-weight:bold;'>남은 턴: ${b.duration >= 99 ? '영구/채널링 유지' : b.duration}</div>`;
                const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

                buffsHtml += `<div style="width:28px; height:28px; background:#1a1210; border:1px solid ${bCol}; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:help; position:relative;" data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()">${b.icon||'✨'}${b.amount ? '<div style="position:absolute; bottom:-4px; right:-2px; color:#4fc3f7; font-size:10px; font-weight:bold; text-shadow:1px 1px 0 #000;">+</div>' : ''}</div>`;
            }
        });

        let passivesHtml = '';
        // ⭐ [기획 반영] 보유 스킬이 아닌, '장착한 스킬(equippedSkills)' 중 S, P 파트만 표시
        const equippedSkillIds = (u.equippedSkills || []).filter(id => id !== null);
        const equippedPassives = (u.skills || []).filter(s => 
            equippedSkillIds.includes(s.id) && (s.part === 'S' || s.part === 'P' || s.type === 'PASSIVE')
        );

        equippedPassives.forEach(p => {
            const tooltipStr = `<div style='color:#ffca28;font-weight:bold;'>${p.name}</div><div style='margin-top:4px;'>${p.desc||''}</div>`;
            const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            passivesHtml += `<div style="width:28px; height:28px; background:#1a1210; border:1px solid #8d6e63; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:help;" data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()">${p.icon||'💡'}</div>`;
        });

        const statBase = (k, lbl) => {
            let val = Formulas.getStat(u, k);
            let btnHtml = (isAlly && u.statPoints > 0) ? `<button style="background:#4e342e; border:1px solid #ffca28; color:#ffca28; border-radius:3px; cursor:pointer; width:16px; height:16px; line-height:12px; padding:0; margin-left:4px; font-weight:bold;" onclick="window.battle.ui.allocateStat('${k}', '${u.id}')" onmouseenter="window.battle.ui.handleStatHover(event, '${k}', '${u.id}')" onmouseleave="window.battle.ui.hideTooltip()">+</button>` : '';
            return `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; background:rgba(0,0,0,0.4); padding:4px 6px; border-radius:3px; border:1px solid #3e2723; font-size:11px;"><span style="color:#bcaaa4; width:35%; text-align:left;">${lbl}</span><div style="display:flex; align-items:center; justify-content:flex-end; flex:1;"><span style="color:#fff; font-weight:bold;">${Math.floor(val)}</span><span id="prev-${k}-${u.id}" style="display:inline-block; width:22px; text-align:right; margin-left:4px;"></span>${btnHtml}</div></div>`;
        };

        const statNoBtn = (k, lbl) => {
            // 1. 기본 스탯 추출
            let baseVal = k === 'jump' ? (u.jump || 1) : Formulas.getStat(u, k);
            let curVal = baseVal;
            
            // 2. 버프/너프가 적용된 최종 변동 스탯 계산
            if (k === 'mov') {
                curVal = Formulas.getDerivedStat(u, 'mov');
            } else if (k === 'jump') {
                let jMod = 0;
                (u.buffs || []).forEach(b => {
                    const bType = String(b.type).toUpperCase();
                    if (bType === 'BUFF_STAT_JUMP' || bType === 'BUFF_JUMP') jMod += (parseFloat(b.val) || 0);
                    if (bType === 'DEBUFF_STAT_JUMP' || bType === 'DEBUFF_JUMP') jMod -= (parseFloat(b.val) || 0);
                });
                curVal = Math.max(0, baseVal + jMod);
            } else if (k === 'rng') {
                let rMod = 0;
                (u.buffs || []).forEach(b => {
                    if (b.type === 'BUFF_CAST_RANGE') rMod += (parseFloat(b.val) || 0);
                    if (b.type === 'DEBUFF_CAST_RANGE') rMod -= (parseFloat(b.val) || 0);
                });
                curVal = Math.max(0, baseVal + rMod);
            }

            // 3. 변동폭에 따른 컬러 렌더링 HTML 조합
            let valHtml = `<span style="color:#fff; font-weight:bold;">${Math.floor(baseVal)}</span>`;
            
            if (Math.floor(curVal) > Math.floor(baseVal)) {
                // 버프일 경우 아래쪽에 초록색 숫자 표시
                valHtml += `<span style="color:#81c784; font-weight:bold; font-size:10px; margin-top:2px; line-height:1;">${Math.floor(curVal)}</span>`;
            } else if (Math.floor(curVal) < Math.floor(baseVal)) {
                // 너프일 경우 아래쪽에 붉은색 숫자 표시
                valHtml += `<span style="color:#e57373; font-weight:bold; font-size:10px; margin-top:2px; line-height:1;">${Math.floor(curVal)}</span>`;
            }

            // 4. 최종 DOM 반환
            return `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; background:rgba(0,0,0,0.4); padding:4px 6px; border-radius:3px; border:1px solid #3e2723; font-size:11px; min-height:26px;">
                <span style="color:#bcaaa4; width:35%; text-align:left;">${lbl}</span>
                <div style="display:flex; align-items:center; justify-content:flex-end; flex:1;">
                    <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">
                        ${valHtml}
                    </div>
                    <span style="display:inline-block; width:22px; margin-left:4px;"></span>
                </div>
            </div>`;
        };

        const statCombat = (k, lbl) => {
            let val = Formulas.getDerivedStat(u, k);
            let disp = Math.floor(val);
            if (k === 'crit' || k === 'eva') disp = parseFloat(val).toFixed(1) + '%';
            return `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; background:rgba(0,0,0,0.4); padding:4px 6px; border-radius:3px; border:1px solid #3e2723; font-size:11px;"><span style="color:#bcaaa4; width:45%; text-align:left; line-height:1.2; word-break:keep-all;">${lbl}</span><div style="display:flex; align-items:center; justify-content:flex-end; flex:1;"><span style="color:#fff; font-weight:bold;">${disp}</span><span id="prev-${k}-${u.id}" style="display:inline-block; width:22px; text-align:right; margin-left:4px;"></span></div></div>`;
        };

        const portraitSrc = (typeof PORTRAIT_DATA !== 'undefined' && (PORTRAIT_DATA[u.id] || PORTRAIT_DATA[u.key] || PORTRAIT_DATA[u.classKey])) || u.portrait;        
        const portraitHtml = portraitSrc 
            ? `<img src="${portraitSrc}" alt="${u.name}" style="width: 100%; max-width: 300px; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; border: none; display: block; margin: 0 auto;">` 
            : `${u.icon || '👤'}`;

        const portraitContainerStyle = portraitSrc
            ? `width:100%; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; border-radius:8px;`
            : `font-size:80px; width:100%; min-height:140px; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, #2a1f1c 0%, #1a1210 100%); border:2px solid ${themeColor}; border-radius:8px; box-shadow:inset 0 0 20px rgba(0,0,0,0.9); flex-shrink:0;`;

        return `
            <div style="display:flex; flex-direction:column; height: 100%; overflow:hidden;">
                ${titleHtml}
                <div id="sig-${prefix}" data-sig="${buffSig}" style="display:none;"></div>
                
                <div style="padding:15px 15px 5px 15px; display:flex; flex-direction:column; gap:10px; flex-shrink:0;">
                    <div style="${portraitContainerStyle}">
                        ${portraitHtml}
                    </div>
                    
                    <div style="text-align:center;">
                        <div style="font-size:18px; font-weight:bold; color:#ffca28; text-shadow:1px 1px 2px #000;">${u.name}</div>
                        <div style="font-size:11px; color:#d7ccc8; margin-top:4px; line-height:1.4;">${infoText}</div>
                        ${u.statPoints > 0 && isAlly ? `<div style="font-size:10px; color:#ffca28; margin-top:4px; font-weight:bold;">남은 스탯 포인트: ${u.statPoints}</div>` : ''}
                    </div>

                    <div style="display:flex; flex-direction:column; gap:6px; background:rgba(0,0,0,0.5); padding:12px; border-radius:6px; border:1px solid #5d4037; margin-top:4px;">
                        <div style="display:flex; align-items:center; gap:8px;"><span style="color:#e57373; width:22px; font-weight:bold; font-size:11px;">HP</span>
                            <div style="flex:1; height:14px; background:#2d1717; border-radius:3px; border:1px solid #4a2b2b; position:relative; overflow:hidden;">
                                <div id="bar-${prefix}-hp-fill" style="width:${hpP}%; height:100%; background:linear-gradient(180deg, #d32f2f 0%, #b71c1c 100%); transition:width 0.2s ease-out;"></div>
                                <div id="bar-${prefix}-hp-text" style="position:absolute; width:100%; text-align:center; top:0; left:0; line-height:14px; color:#fff; font-size:11px; font-weight:bold; text-shadow:1px 1px 0 #000;">${Math.floor(u.curHp)}/${u.hp}</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;"><span style="color:#64b5f6; width:22px; font-weight:bold; font-size:11px;">MP</span>
                            <div style="flex:1; height:14px; background:#122030; border-radius:3px; border:1px solid #1c324a; position:relative; overflow:hidden;">
                                <div id="bar-${prefix}-mp-fill" style="width:${mpP}%; height:100%; background:linear-gradient(180deg, #1976d2 0%, #0d47a1 100%); transition:width 0.2s ease-out;"></div>
                                <div id="bar-${prefix}-mp-text" style="position:absolute; width:100%; text-align:center; top:0; left:0; line-height:14px; color:#fff; font-size:11px; font-weight:bold; text-shadow:1px 1px 0 #000;">${Math.floor(u.curMp)}/${u.mp}</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;"><span style="color:#ffb300; width:22px; font-weight:bold; font-size:11px;">WT</span>
                            <div style="flex:1; height:14px; background:#302212; border-radius:3px; border:1px solid #4a341c; position:relative; overflow:hidden;">
                                <div id="bar-${prefix}-wt-fill" style="width:${agP}%; height:100%; background:${agC}; transition:width 0.2s ease-out;"></div>
                                <div id="bar-${prefix}-wt-text" style="position:absolute; width:100%; text-align:center; top:0; left:0; line-height:14px; color:#fff; font-size:11px; font-weight:bold; text-shadow:1px 1px 0 #000;">${Math.floor(u.actionGauge||0)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="custom-scrollbar" style="padding:5px 15px 15px 15px; display:flex; flex-direction:column; gap:10px; overflow-y:auto; flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-size:11px; color:#81c784; font-weight:bold; width:35px;">상태</div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; flex:1;">
                            ${buffsHtml || '<span style="color:#6d4c41; font-size:10px;">없음</span>'}
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid #3e2723; padding-bottom:8px;">
                        <div style="font-size:11px; color:#ffca28; font-weight:bold; width:35px;">패시브</div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; flex:1;">
                            ${passivesHtml || '<span style="color:#6d4c41; font-size:10px;">없음</span>'}
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-top:4px;">
                        ${statBase('str','STR')}${statBase('int','INT')}
                        ${statBase('vit','VIT')}${statBase('agi','AGI')}
                        ${statBase('dex','DEX')}${statBase('vol','VOL')}
                        ${statBase('luk','LUK')}<div style="width:48%;"></div>
                        
                        <div style="grid-column: 1 / -1; border-top:1px dashed #5d4037; margin:2px 0;"></div>
                        
                        ${statNoBtn('mov','이동력')}${statNoBtn('rng','사거리')}
                        ${statNoBtn('jump','도약력')}<div style="width:48%;"></div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; border-top:1px dashed #5d4037; padding-top:8px; margin-top:4px;">
                        ${statCombat('atk_phys','물리<br>공격력')}${statCombat('atk_mag','마법<br>공격력')}
                        ${statCombat('def','방어력')}${statCombat('res','마법저항')}
                        ${statCombat('hit_phys','명중률')}${statCombat('crit','치명타')}
                        ${statCombat('eva','회피율')}${statCombat('spd','행동속도')}
                    </div>
                </div>
            </div>
        `;
    }

    renderPartyList() {
        const leftPanel = document.getElementById('sidebar-left');
        const u = this.battle.currentUnit;
        if (!leftPanel || !u) return;

        let swapBtnHtml = '';
        if (u.team === 0 && (u.homunculusId || u.ownerId)) {
            const isHomun = !!u.ownerId;
            const targetName = isHomun ? "본체" : "호문";
            const targetIcon = isHomun ? "🧙‍♂️" : "👻";
            swapBtnHtml = `
                <div style="display:flex; gap:6px; margin-top:10px; width:100%; padding:0 10px;">
                    <button id="btn-swap-homun" style="flex:1; background:#4a2b3d; color:#f8bbd0; border:1px solid #ad1457; border-radius:4px; padding:6px; cursor:pointer; font-size:11px; font-weight:bold; transition:0.2s;">
                        🔄 ${targetIcon} ${targetName}
                    </button>
                    <button id="btn-transposition" style="flex:1; background:#283593; color:#bbdefb; border:1px solid #1565c0; border-radius:4px; padding:6px; cursor:pointer; font-size:11px; font-weight:bold; transition:0.2s;">
                        🌌 치환
                    </button>
                </div>
            `;
        }

        const titleText = u.team === 0 ? '🟢 현재 턴 (아군)' : '🔴 현재 턴 (적군)';
        const cardHtml = this._generatePortraitCardHtml(u, u.team === 0, titleText, 'left');
        leftPanel.innerHTML = `<div style="flex:1; overflow:hidden; display:flex; flex-direction:column;">${cardHtml}</div>` + (swapBtnHtml ? `<div style="flex-shrink:0; margin-bottom:15px;">${swapBtnHtml}</div>` : '');

        setTimeout(() => {
            const swapBtn = document.getElementById('btn-swap-homun');
            if (swapBtn) swapBtn.onclick = () => { if(this.battle.toggleHomunculusControl) this.battle.toggleHomunculusControl(); };

            const transBtn = document.getElementById('btn-transposition');
            if (transBtn) transBtn.onclick = () => { if(this.battle.executeTransposition) this.battle.executeTransposition(); };
        }, 50);
    }

    updateRightPanel(targets = [], terrain = null) {
        // ⭐ [근본 수정] 입력계에서 적 정보만 보내고 지형을 null로 보냈을 때,
        // 타겟이 서 있는 발밑의 좌표(q, r)를 읽어 맵에서 지형 데이터를 스스로 가져옵니다.
        if (targets.length > 0 && !terrain) {
            const u = targets[0];
            if (this.battle && this.battle.grid && u.q !== undefined && u.r !== undefined) {
                const tData = this.battle.grid.getTerrainData(u.q, u.r);
                if (tData) terrain = tData;
            }
        }

        this._lastTargets = targets;
        this._lastTerrain = terrain;

        const rightPanel = document.getElementById('target-info-wrapper') || document.getElementById('sidebar-right');
        if (!rightPanel) return;

        if (targets.length === 0 && !terrain) {
            rightPanel.innerHTML = '<div class="panel-header" style="background: rgba(226, 74, 74, 0.1); color: #e24a4a; border-bottom: 2px solid #e24a4a; font-size:14px; font-weight:bold; padding:8px;">TARGET INFO</div><div style="padding:20px; text-align:center; color:#8d6e63; font-size:13px;">대상이 없습니다.</div>';
            return;
        }

        let targetsHtml = '';
        let terrainHtml = '';

        // 1. 유닛(타겟) 렌더링 블록
        if (targets.length === 1) {
            const u = targets[0];
            const titleText = u.team === 0 ? '🟢 타겟 정보 (아군)' : '🔴 타겟 정보 (적군)';
            const cardHtml = this._generatePortraitCardHtml(u, u.team === 0, titleText, 'right-0');
            // flex:1 을 부여하여 스탯창 내부의 스크롤이 원활히 동작하게 함
            targetsHtml = `<div style="flex:1; overflow:hidden; display:flex; flex-direction:column;">${cardHtml}</div>`;

        } else if (targets.length > 1) {
            targetsHtml += `<div style="flex:1; overflow:hidden; display:flex; flex-direction:column;">`;
            targetsHtml += `<div class="panel-header" style="flex-shrink:0; color: #e57373; border-bottom: 2px solid #c62828; padding:8px; font-size:14px; font-weight:bold;">다중 타겟 (${targets.length}명)</div><div class="custom-scrollbar" style="padding: 10px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex:1;">`;
            targets.forEach((u, idx) => {
                const isAlly = u.team === 0;
                const themeColor = isAlly ? '#4a90e2' : '#e24a4a';
                const hpP = Math.max(0, Math.min(100, (u.curHp / u.hp) * 100));
                const mpP = Math.max(0, Math.min(100, (u.curMp / u.mp) * 100));
                
                targetsHtml += `
                <div id="sig-right-${idx}" data-sig="" style="display:none;"></div>
                <div style="display: flex; background: #1a1210; border: 1px solid ${themeColor}; border-radius: 6px; padding: 8px; gap: 10px; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
                    <div style="font-size: 24px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #111; border: 1px solid #3a2e24; border-radius: 4px; flex-shrink: 0;">${u.icon || '👤'}</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 13px; font-weight: bold; color: #ffca28; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</div>
                        <div style="display:flex; gap:4px; margin-top:4px;">
                            <div style="width:100%; height:8px; background:#1e1e1e; border-radius:2px; overflow:hidden; position:relative;">
                                <div id="bar-right-${idx}-hp-fill" style="width:${hpP}%; height:100%; background:linear-gradient(90deg, #d32f2f, #b71c1c);"></div>
                                <div id="bar-right-${idx}-hp-text" style="position:absolute; width:100%; top:0; left:0; font-size:8px; line-height:8px; text-align:center; color:#fff;">HP: ${Math.floor(u.curHp)}</div>
                            </div>
                            <div style="width:100%; height:8px; background:#1e1e1e; border-radius:2px; overflow:hidden; position:relative;">
                                <div id="bar-right-${idx}-mp-fill" style="width:${mpP}%; height:100%; background:linear-gradient(90deg, #1976d2, #0d47a1);"></div>
                                <div id="bar-right-${idx}-mp-text" style="position:absolute; width:100%; top:0; left:0; font-size:8px; line-height:8px; text-align:center; color:#fff;">MP: ${Math.floor(u.curMp)}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
            targetsHtml += '</div></div>';
        }

        // 2. 지형(테레인) 렌더링 블록
        if (terrain) {
            let tInfo = null;
            if (typeof TERRAIN_TYPES !== 'undefined') tInfo = TERRAIN_TYPES[terrain.key];
            const tName = tInfo ? tInfo.name : terrain.key;
            let effectHtml = '<span style="color:#8d6e63;">특수 효과 없음</span>';
            
            if (tInfo && tInfo.effect) {
                if (tInfo.effect.type.startsWith('DMG')) effectHtml = `<span style="color:#e57373;">매 턴 ${tInfo.effect.val}% 피해</span>`;
                else if (tInfo.effect.type === 'HEAL_PCT') effectHtml = `<span style="color:#81c784;">매 턴 ${tInfo.effect.val}% 회복</span>`;
                else if (tInfo.effect.type === 'APPLY_STATUS') effectHtml = `<span style="color:#ce93d8;">상태이상 부여 지대</span>`;
                else if (tInfo.effect.type === 'BUFF_EVA') effectHtml = `<span style="color:#81c784;">회피율 +${tInfo.effect.val}%</span>`;
                else if (tInfo.effect.type === 'BUFF_DEF') effectHtml = `<span style="color:#81c784;">방어력 +${tInfo.effect.val}</span>`;
            }

            const terrainBorder = targetsHtml !== '' ? 'border-top: 2px solid #5d4037;' : '';
            const terrainHeaderTitle = targetsHtml !== '' ? '🔽 지형 정보' : '🏞️ 지형 정보';

            // flex-shrink: 0 을 주어 유닛 정보의 스크롤 하단에 고정된 크기로 부착되도록 설계
            terrainHtml = `
                <div style="flex-shrink:0; background: rgba(20, 15, 10, 0.95); ${terrainBorder} display:flex; flex-direction:column; box-shadow: 0 -4px 10px rgba(0,0,0,0.5); z-index:10;">
                    <div class="panel-header" style="background: rgba(255, 202, 40, 0.1); color: #ffca28; padding: 6px 10px; font-size: 12px; font-weight: bold; border-bottom: 1px solid #5d4037;">
                        ${terrainHeaderTitle}
                    </div>
                    <div style="padding: 10px 15px;">
                        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 14px; font-weight: bold; color: #ffca28;">${tName}</span>
                            <span style="font-size: 11px; color: #bcaaa4; border: 1px solid #3e2723; padding: 2px 6px; border-radius: 4px; background: #000;">고도: ${terrain.h || 0}</span>
                        </div>
                        <div style="font-size: 11px; padding: 6px; background: rgba(0,0,0,0.5); border-radius: 4px; border: 1px dashed #5d4037; text-align:center;">
                            ${effectHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        // 3. 최종 조립 (타겟 정보 + 지형 정보 결합)
        rightPanel.innerHTML = targetsHtml + terrainHtml;
    }

    updateFloatingControls() {
        const wId = 'floating-controls';
        let wrapper = document.getElementById(wId);
        const u = this.battle.currentUnit;

        if (!this.battle.selectedSkill && !this.battle.isMovingMode) {
            this.lockedTargetPanel = false;
        }
        
        if (!u || u.team !== 0 || this.battle.isProcessingTurn || this.battle.isPeaceful || !this.battle.grid || !this.battle.grid.canvas) {
            if (wrapper) wrapper.classList.add('hud-hidden');
            return;
        }

        const index = this.battle.units.indexOf(u);
        const uniqueId = String(u.id ? u.id : `hero-${u.team}-${index}`);
        const unitDiv = document.getElementById(`unit-overlay-${uniqueId}`);
        if (!unitDiv) return;

        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = wId;
        }
        if (wrapper.parentNode !== unitDiv) unitDiv.appendChild(wrapper);
        
        wrapper.style.position = 'absolute';
        wrapper.style.left = '35px';
        wrapper.style.top = '15px'; 
        wrapper.style.transform = 'none';
        wrapper.style.zIndex = '9999999'; 
        
        const selSkill = this.battle.selectedSkill;
        let isSelfCast = false;
        if (selSkill) {
            const mainTarget = String(selSkill.target || 'ENEMY').toUpperCase().trim();
            const rng = parseInt(selSkill.rng) || 0;
            isSelfCast = ['SELF', 'AREA_SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'AREA_ALL'].includes(mainTarget) || 
                         (mainTarget === 'AREA_ENEMY' && parseInt(selSkill.area) >= 99) || 
                         (rng === 0 && !['ENEMY_SINGLE', 'ANY', 'ALLY_SINGLE'].includes(mainTarget));
        }

        if (window.isHudHidden || (selSkill && !isSelfCast) || this.battle.isMovingMode) {
            wrapper.classList.add('hud-hidden');
            return; 
        } else {
            wrapper.classList.remove('hud-hidden');
        }

        if (!document.getElementById('action-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'action-ui-styles';
            style.innerHTML = `
                .action-btn { flex: 1; text-align: center; background: #2e211b; border: 1px solid #5d4037; border-radius: 4px; padding: 6px 8px; color: #d7ccc8; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.1s; white-space: nowrap; }
                .action-btn:hover:not(.disabled) { background: #4e342e; border-color: #ffca28; color:#fff; }
                .action-btn.active { background: #3e2723; border-color: #ffca28; box-shadow: 0 0 5px #ffca28; color: #ffca28; }
                .action-btn.disabled { opacity: 0.4; pointer-events: none; filter: grayscale(100%); }
                
                .list-btn { background: #1a1210; border: 1px solid #3e2723; border-radius: 3px; padding: 6px; color: #bcaaa4; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: 0.1s; margin-bottom: 2px; white-space: nowrap; width: 100%; box-sizing: border-box; }
                .list-btn:hover:not(.disabled) { background: #3e2723; border-color: #8d6e63; color: #fff; }
                .list-btn.active { border-color: #ffca28; background: #3e2723; color: #ffca28; box-shadow: 0 0 5px rgba(255,202,40,0.5); }
                
                /* ⭐ [근본 해결] 다른 글로벌 CSS에 의해 마우스 호버가 무시되지 않도록 pointer-events: auto !important; 강제 부여 */
                .list-btn.disabled { opacity: 0.4; cursor: not-allowed; color: #6d4c41; pointer-events: auto !important; }
                
                .skill-cat-wrap { position: relative; width: 100%; }
                
                .skill-sub-menu { position: absolute; top: 0; left: 100%; margin-left: 4px; display: none; flex-direction: column; background: rgba(26, 18, 16, 0.98); border: 1px solid #5d4037; padding: 4px; border-radius: 4px; box-shadow: 2px 2px 10px rgba(0,0,0,0.8); z-index: 1000; min-width: 120px; max-height: 50vh; overflow-y: auto; }
                .skill-sub-menu::-webkit-scrollbar { width: 4px; }
                .skill-sub-menu::-webkit-scrollbar-track { background: transparent; }
                .skill-sub-menu::-webkit-scrollbar-thumb { background: #5d4037; border-radius: 2px; }
                
                .skill-cat-wrap:hover .skill-sub-menu, .skill-cat-wrap.open .skill-sub-menu { display: flex; }
                
                .cost-info { display: flex; justify-content: space-between; margin-top: 8px; border-top: 1px dashed #5d4037; padding-top: 8px; font-weight: bold; }
            `;
            document.head.appendChild(style);
        }

        const codeDrawnBubbleTail = `
            <svg style="position: absolute; top: 15px; left: -14px; width: 16px; height: 20px; pointer-events: none; z-index: 10; overflow: visible;">
                <path d="M 14 0 L 0 0 L 14 18 Z" fill="rgba(26, 18, 16, 0.95)" stroke="#5d4037" stroke-width="2" stroke-linejoin="round" />
                <path d="M 14 -1 L 14 19" stroke="rgba(26, 18, 16, 0.95)" stroke-width="4" />
            </svg>
        `;

        if (selSkill && isSelfCast) {
            const targetType = String(selSkill.target || '').toUpperCase();
            const isGlobal = ['GLOBAL', 'ENEMY_ALL', 'ALLY_ALL', 'AREA_ALL'].includes(targetType) || 
                             parseInt(selSkill.area) >= 99 || 
                             parseInt(selSkill.rng) >= 99;

            if (!isGlobal) {
                if (this.battle._lastSelfCastSkill !== selSkill.id) {
                    this.battle._lastSelfCastSkill = selSkill.id;
                    
                    // ⭐ 시각적 범위 표시도 무조건 RangeManager의 단일 출처 함수를 통과하여 동기화
                    if (this.battle.rangeManager) {
                        this.battle.areaZone = this.battle.rangeManager.getSplashHexes(u, u, selSkill);
                    } else {
                        // fallback (에러 방지용)
                        const areaVal = selSkill.area ? String(selSkill.area) : '0';
                        const rngVal = parseInt(selSkill.rng) || 0;
                        if (areaVal !== '0') {
                            this.battle.areaZone = this.battle.grid.getShapeHexes(u, u, areaVal);
                        } else if (rngVal > 0) {
                            this.battle.areaZone = this.battle.grid.getHexesInRange(u, rngVal);
                        } else {
                            this.battle.areaZone = [{ q: u.q, r: u.r }]; 
                        }
                    }
                }
            } else {
                if (this.battle._lastSelfCastSkill !== selSkill.id) {
                    this.battle._lastSelfCastSkill = selSkill.id;
                    this.battle.areaZone = []; 
                }
            }
        } else {
            this.battle._lastSelfCastSkill = null;
        }

        if (isSelfCast) {
            wrapper.innerHTML = `
            <div style="background: rgba(26, 18, 16, 0.95); border: 2px solid #5d4037; border-radius: 16px; padding: 15px; display: flex; flex-direction: column; align-items: center; gap: 8px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.8)); pointer-events: auto; min-width: 120px; position: relative;">
                ${codeDrawnBubbleTail}
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <div style="font-size:28px;">${selSkill.icon || '✨'}</div>
                    <div style="font-size:13px; color:#ffca28; font-weight:bold; margin-top:4px; text-align:center;">${selSkill.name}</div>
                </div>
                <div style="display:flex; gap:6px; width: 100%; margin-top:5px;">
                    <div class="action-btn" style="background:#2e7d32; border-color:#4caf50; color:#fff;" onclick="window.battle.confirmSkillSelf()">시전</div>
                    <div class="action-btn" style="background:#c62828; border-color:#ef5350; color:#fff;" onclick="window.battle.cancelAction()">취소</div>
                </div>
            </div>`;
            return;
        }

        const hasMoved = this.battle.actions.moved;
        const hasActed = this.battle.actions.acted;
        const isMoveMode = this.battle.isMovingMode;
        const isAtkMode = selSkill && (selSkill.id === (u.equippedBasic || '1000'));
        const classLv = u.classLevel || u.level || 1;
        const costRed = Formulas.getDerivedStat(u, 'cost_red') || 1.0;

        let itemsHtml = '';
        let itemFound = false;
        for (let i = 1; i <= 6; i++) {
            const eqData = u.equipment ? u.equipment[`pocket${i}`] : null;
            const itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            if (itemId) {
                const item = this.battle.gameApp.itemData[itemId];
                if (item) {
                    itemFound = true;
                    const tooltipStr = `<div style='color:#ffca28;font-weight:bold;'>${item.name}</div><div style='margin-top:4px;'>${item.desc||''}</div>`;
                    const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    
                    // ⭐ [근본 해결] 비활성화 시 클릭(onclick) 속성을 바인딩하지 않도록 분리
                    const itemClickAttr = hasActed ? '' : `onclick="window.battle.requestItemUse(${i-1})"`;
                    itemsHtml += `<div class="list-btn ${hasActed ? 'disabled' : ''}" ${itemClickAttr} data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()">${item.icon || '💊'} <span style="flex:1; text-align:left;">${item.name}</span></div>`;
                }
            }
        }
        if (!itemFound) itemsHtml = `<div style="color:#6d4c41; font-size:11px; text-align:center; padding:10px 0;">아이템 없음</div>`;

        const buildSkillBtn = (s) => {
            const isManaLack = u.curMp < (s.mp||0);
            
            // ⭐ 배열 형태의 itemCost 데이터를 분석하여 재료 요구량 및 보유량 검증
            let isMaterialLack = false;
            let materialTooltipHtml = '';
            
            if (s.itemCost && s.itemCost.length > 0) {
                materialTooltipHtml += `<div style="margin-top:4px; padding-top:4px; border-top:1px dotted #5d4037; font-size:11px;">`;
                
                // itemCost 배열("IT_POTION" 등)을 순회하며 필요한 재료 개수(reqCount) 정리
                const reqItems = {};
                s.itemCost.forEach(id => {
                    reqItems[id] = (reqItems[id] || 0) + 1;
                });

                // 각 필요 재료별로 보유량을 검사
                for (const [itemId, reqCount] of Object.entries(reqItems)) {
                    let hasCount = 0;
                    
                    // 영웅이 장착한 1~8번 포켓 전체를 순회하며 해당 재료 개수를 합산
                    if (u.equipment) {
                        for (let i = 1; i <= 8; i++) {
                            const eqData = u.equipment[`pocket${i}`];
                            if (!eqData) continue;
                            const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
                            const eqCount = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : 1;
                            
                            if (eqId === itemId) {
                                hasCount += eqCount;
                            }
                        }
                    }

                    // 게임 글로벌 데이터에서 아이템 이름 조회 (안전장치로 못 찾으면 ID 그대로 노출)
                    const itemData = (this.battle.gameApp && this.battle.gameApp.itemData) ? this.battle.gameApp.itemData[itemId] : null;
                    const itemName = itemData ? itemData.name : itemId;

                    if (hasCount >= reqCount) {
                        // 보유량이 충분한 경우: 흰색 텍스트로 표시
                        materialTooltipHtml += `<div style="color:#d7ccc8; margin-top:2px;">✔️ ${itemName} (${hasCount}/${reqCount})</div>`;
                    } else {
                        // 보유량이 부족한 경우: 회색 글씨(#808080) 적용 및 시전 불가 마킹
                        materialTooltipHtml += `<div style="color:#808080; margin-top:2px;">❌ ${itemName} (${hasCount}/${reqCount})</div>`;
                        isMaterialLack = true;
                    }
                }
                materialTooltipHtml += `</div>`;
            }

            // ⭐ 마나 부족, 이미 행동함, 또는 재료 부족(isMaterialLack) 여부 통합 확인
            const isDisabled = isManaLack || hasActed || isMaterialLack;
            let cls = `list-btn ${this.battle.selectedSkill?.id === s.id ? 'active' : ''}`;
            if (isDisabled) cls += ' disabled';
            const finalCost = Math.floor((s.cost !== undefined ? s.cost : 50) * costRed);
            
            let nameDisplay = s.name;
            let tooltipExtra = '';
            if (s.isStolen) {
                nameDisplay = `<span style="color:#e040fb;">${s.name}</span> <span style="background:#e040fb; color:#fff; border-radius:3px; padding:1px 4px; font-size:9px; margin-left:4px; font-weight:bold; vertical-align:middle;">FREE</span>`;
                tooltipExtra = `<div style='color:#e040fb; font-size:10px; margin-top:2px; font-weight:bold;'>[훔쳐온 스킬: ${s.stolenDuration}턴 유지 / 사용 시 소멸]</div>`;
            }

            // 완성된 재료 툴팁 HTML(materialTooltipHtml)을 최종 툴팁 문자열에 결합
            const tooltipStr = `<div style='color:#ffca28;font-weight:bold;'>${s.name}</div>${tooltipExtra}<div style='color:#d7ccc8;margin-top:4px;'>${s.desc||''}</div>${materialTooltipHtml}<div class='cost-info'><span style='color:#90caf9'>MP: ${s.mp||0}</span><span style='color:#ffcc80'>WT: ${finalCost}</span></div>`;
            const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            // ⭐ [근본 해결] 비활성화 상태일 때는 onclick 속성 자체를 HTML에 렌더링하지 않아 클릭을 완벽히 차단합니다.
            const skillClickAttr = isDisabled ? '' : `onclick="window.battle.selectSkillFromFloat('${s.id}')"`;
            
            return `<div class="${cls}" ${skillClickAttr} data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()" style="display:flex; align-items:center;"><span>${s.icon||'✨'} ${nameDisplay}</span></div>`;
        };

        let skillsHtml = ''; let skillsObjList = [];
        if (u.equippedSkills) {
            u.equippedSkills.forEach(sId => {
                if (!sId || sId === '1000') return; // 빈 슬롯(null) 무시
                
                // ⭐ [신규] 카테고리 스킬 그룹 추가
                if (sId.startsWith('CAT_')) {
                    const catName = sId.replace('CAT_', '');
                    skillsObjList.push({ isCategory: true, name: catName });
                    return;
                }

                const sk = u.skills.find(s => s && s.id === sId);
                
                if (sk) {
                    const part = sk.part || (sk.type === 'PASSIVE' ? 'S' : 'A');
                    // ⭐ [기획 반영] A 파트(Action)만 전투 명령 목록에 추가
                    if (part === 'A' && classLv >= (typeof TIER_REQ !== 'undefined' ? (TIER_REQ[sk.tier] || 1) : 1)) {
                        skillsObjList.push(sk);
                    }
                }
            });
        }
        
        if (u.skills) {
            u.skills.forEach(sk => {
                if (sk && sk.isStolen) {
                    skillsObjList.push(sk);
                }
            });
        }

        if (skillsObjList.length > 0) {
            skillsObjList.forEach(s => {
                if (s.isCategory) {
                    const subSkills = u.skills.filter(sk => sk.category === s.name && sk.type !== 'PASSIVE' && classLv >= (typeof TIER_REQ !== 'undefined' ? (TIER_REQ[sk.tier]||1) : 1));
                    let subHtml = ''; subSkills.forEach(sub => subHtml += buildSkillBtn(sub));
                    const isOpen = this.battle.expandedCategory === s.name;
                    const arrowIcon = isOpen ? '📌' : '▶'; 
                    skillsHtml += `
                        <div class="skill-cat-wrap ${isOpen ? 'open' : ''}">
                            <div class="list-btn ${hasActed ? 'disabled' : ''}" onclick="window.battle.toggleCategory('${s.name}')">
                                <span>📁 ${s.name}</span> <span style="font-size:10px; color:${isOpen?'#90caf9':'#8d6e63'};">${arrowIcon}</span>
                            </div>
                            <div class="skill-sub-menu">${subHtml}</div>
                        </div>`;
                } else {
                    skillsHtml += buildSkillBtn(s);
                }
            });
        } else {
            skillsHtml = `<div style="color:#6d4c41; font-size:11px; text-align:center; padding:10px 0;">스킬 없음</div>`;
        }

        wrapper.innerHTML = `
            <div style="background: rgba(26, 18, 16, 0.95); border: 2px solid #5d4037; border-radius: 16px; display: flex; flex-direction: column; width: max-content; padding: 12px; filter: drop-shadow(0 6px 15px rgba(0,0,0,0.8)); pointer-events: auto; position: relative;">
                ${codeDrawnBubbleTail}
                
                <div class="hud-guide-text" style="position:absolute; top:-18px; right:0; color:#d7ccc8;">H: 숨기기</div>
                
                <div style="display: flex; gap: 4px; border-bottom: 1px dashed #5d4037; padding-bottom: 8px; margin-bottom: 8px; z-index: 20;">
                    <div class="action-btn ${hasMoved ? 'disabled' : ''} ${isMoveMode ? 'active' : ''}" onclick="window.battle.enterMoveMode()">🚶 이동</div>
                    <div class="action-btn ${hasActed ? 'disabled' : ''} ${isAtkMode ? 'active' : ''}" onclick="window.battle.selectSkillFromFloat('basic')">⚔️ 공격</div>
                    <div class="action-btn" onclick="window.battle.onTurnEndClick()" style="background:#4e342e; border-color:#8d6e63;">🛑 대기</div>
                </div>
                
                <div style="display: flex; gap: 8px; z-index: 20;">
                    <div style="display: flex; flex-direction: column; width: 110px; border-right: 1px dashed #5d4037; padding-right: 5px;">
                        <div style="font-size:10px; color:#bcaaa4; margin-bottom:4px; text-align:center; font-weight:bold;">ITEMS</div>
                        ${itemsHtml}
                    </div>
                    <div style="display: flex; flex-direction: column; width: 130px;">
                        <div style="font-size:10px; color:#bcaaa4; margin-bottom:4px; text-align:center; font-weight:bold;">SKILLS</div>
                        ${skillsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    getUnitScreenPos(unit) {
        let worldX, worldY;
        if (unit.visualPos) { worldX = unit.visualPos.x; worldY = unit.visualPos.y; }
        else {
            const tKey = this.battle.grid.getTerrain(unit.q, unit.r);
            const height = TERRAIN_TYPES[tKey]?.height || 0;
            const p = this.battle.grid.hexToPixel3D(unit.q, unit.r, height);
            worldX = p.x; worldY = p.y;
        }
        const cx = worldX - this.battle.camera.x;
        const cy = worldY - this.battle.camera.y;
        const rect = this._cachedRect || this.canvas.getBoundingClientRect();
        return { x: rect.left + cx, y: rect.top + cy };
    }

    getHexScreenPos(q, r) {
        const tKey = this.battle.grid.getTerrain(q, r);
        const height = TERRAIN_TYPES[tKey]?.height || 0;
        const p = this.battle.grid.hexToPixel3D(q, r, height);
        const cx = p.x - this.battle.camera.x;
        const cy = p.y - this.battle.camera.y;
        const rect = this._cachedRect || this.canvas.getBoundingClientRect();
        return { x: rect.left + cx, y: rect.top + cy };
    }

    updateFloatingPosition() {}

    renderUnitOverlays() {
        if (!this.overlayContainer) return;
        
        if (this.battle.isBattleEnded) {
            this.overlayContainer.style.display = 'none';
            return;
        } else {
            this.overlayContainer.style.display = 'block';
        }
                
        if (!document.getElementById('battle-dynamic-styles')) {
            const style = document.createElement('style');
            style.id = 'battle-dynamic-styles';
            style.innerHTML = `
                @keyframes floatMark {
                    0%, 100% { transform: translateX(-50%) translateY(0); }
                    50% { transform: translateX(-50%) translateY(-5px); }
                }
            `;
            document.head.appendChild(style);
        }

        if (!this._overlayCache) this._overlayCache = new Map();

        const activeUnitIds = new Set();
        const UNIT_HEIGHT_OFFSET = 70; 
        const UNIT_LEFT_OFFSET = 0;
        const currentScale = this.battle.grid ? (this.battle.grid.scale || 1) : 1;

        this.battle.units.forEach((u, index) => {
            if (u.type === 'OBJECT' && !u.isWall && !(u.key && u.key.includes('WALL'))) return;

            const uniqueId = String(u.id ? u.id : `hero-${u.team}-${index}`);
            activeUnitIds.add(uniqueId);

            // ⭐ [에러 원인 수정] 기존 isDead 대신 분리된 상태 변수 적용
            const isFullyDead = u.curHp <= 0 && !u.isIncapacitated; 
            const isIncapacitated = u.curHp <= 0 && u.isIncapacitated;
            const displayIcon = isFullyDead ? '🪦' : u.icon;

            const pos = this.getUnitScreenPos(u);
            if (pos.x < -50 || pos.x > window.innerWidth + 50 || pos.y < -50 || pos.y > window.innerHeight + 50) return;
            
            let customOpacity = '1';
            let customFilter = 'none';
            let customGroundGlow = '';
            let hideBar = false;

            // 전투 불능 시 회색(흑백) 필터 적용
            if (isIncapacitated) {
                customOpacity = '0.7';
                customFilter = 'grayscale(100%) brightness(70%)';
                hideBar = true; 
            } else {
                const isStealthed = u.buffs && u.buffs.some(b => b.type.includes('STEALTH'));
                const isTrap = u.key && u.key.includes('TRAP');
                if (isStealthed || isTrap) customOpacity = '0.4';
            }

            if (u.type === 'OBJECT') {
                if (u.isWall) customOpacity = '0.7';
                if (u.key && (u.key.includes('ZONE') || u.key === 'WALL_FIRE')) {
                    if (u.key === 'ZONE_POISON') {
                        customGroundGlow = `<div style="width:60px; height:40px; background:radial-gradient(ellipse, rgba(138,43,226,0.6) 0%, rgba(0,0,0,0) 70%); border-radius:50%; position:absolute; top:30px; left:50%; transform:translateX(-50%); pointer-events:none; box-shadow: 0 0 15px purple; animation: pulseBorder 2s infinite;"></div>`;
                    } else if (u.key === 'ZONE_GRAVITY') {
                        customGroundGlow = `<div style="width:60px; height:40px; background:radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 70%); border-radius:50%; position:absolute; top:30px; left:50%; transform:translateX(-50%); pointer-events:none; box-shadow: 0 0 15px #a0f; animation: pulseBorder 2s infinite;"></div>`;
                    }
                    hideBar = true;
                }
            }

            const channelBuff = u.buffs && u.buffs.find(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
            const isCasting = u.isCharging || (u.buffs && u.buffs.some(b => b.type === 'BUFF_CASTING'));

            if (channelBuff) {
                const turnsLeft = channelBuff.duration || 1;
                customGroundGlow += `<div style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); font-size:16px; font-weight:bold; color:#0ff; text-shadow: 0 0 5px #00f; animation: pulseBorder 1.5s infinite; pointer-events:none; z-index:10; white-space:nowrap;">🎶${turnsLeft}</div>`;
                customGroundGlow += `<div style="width:45px; height:25px; background:radial-gradient(ellipse, rgba(0, 255, 255, 0.4) 0%, rgba(0,0,0,0) 70%); border-radius:50%; position:absolute; top:40px; left:50%; transform:translateX(-50%); pointer-events:none; box-shadow: 0 0 10px #0ff; animation: pulseBorder 2s infinite; z-index:-1;"></div>`;
            } 
            else if (isCasting) {
                const turnsLeft = u.chargeTurnLimit || 1;
                customGroundGlow += `<div style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); font-size:14px; font-weight:bold; color:#ffca28; text-shadow: 0 0 5px #f00; animation: pulseBorder 0.8s infinite; pointer-events:none; z-index:10; white-space:nowrap;">⏳${turnsLeft}</div>`;
                customGroundGlow += `<div style="width:45px; height:25px; background:radial-gradient(ellipse, rgba(255, 202, 40, 0.5) 0%, rgba(0,0,0,0) 70%); border-radius:50%; position:absolute; top:40px; left:50%; transform:translateX(-50%); pointer-events:none; box-shadow: 0 0 10px #ffca28; animation: pulseBorder 0.8s infinite; z-index:-1;"></div>`;
            }

            let div = this._overlayCache.get(uniqueId);
            if (!div) {
                div = document.createElement('div');
                div.id = `unit-overlay-${uniqueId}`;
                div.className = 'unit-overlay';
                
                div.innerHTML = `
                    <div class="turn-highlight-wrap">${customGroundGlow}</div>
                    <div class="discovery-wrap"></div>
                    <div class="speech-wrap"></div>
                    <div class="dead-sprite-icon" style="display:${isFullyDead ? 'block' : 'none'}; font-size:32px; text-align:center; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)); margin-bottom: 5px;">${displayIcon}</div>
                    
                    <div class="overlay-anchor-group" style="display:${(hideBar || isFullyDead) ? 'none' : 'flex'}; flex-direction:column; align-items:center; opacity: ${isFullyDead ? '0.6' : customOpacity}; filter: ${isFullyDead ? 'grayscale(100%)' : customFilter};">                        
                        <div class="status-row" style="display:none; gap:2px; margin-bottom:4px; flex-direction:row; justify-content:center; align-items:center;"></div>
                        <div class="bar-group" style="width:36px; display:flex; flex-direction:column; gap:1px;">
                            <div class="hp-row" style="height:4px; background:#311; position:relative;">
                                <div class="hp-fill" style="height:100%; width:100%; background:${u.team===0?'#66bb6a':'#e57373'}"></div>
                                <div class="shield-fill" style="height:100%; width:0%; position:absolute; top:0; left:0; background:rgba(255,255,255,0.4);"></div>
                            </div>
                            <div class="mp-row" style="height:2px; background:#123;">
                                <div class="mp-fill" style="height:100%; width:100%; background:#42a5f5;"></div>
                            </div>
                            <div class="ag-row" style="height:2px; background:#220;">
                                <div class="ag-fill" style="height:100%; width:0%; background:#ffca28;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="name-tag" style="margin-top:27px; color:#d7ccc8; text-shadow:1px 1px 0 #000;">${u.name}</div>
                `;
                this.overlayContainer.appendChild(div);

                div._hpFill = div.querySelector('.hp-fill');
                div._shieldFill = div.querySelector('.shield-fill');
                div._mpFill = div.querySelector('.mp-fill'); 
                div._agFill = div.querySelector('.ag-fill');
                div._highlightWrap = div.querySelector('.turn-highlight-wrap');
                div._statusRow = div.querySelector('.status-row');
                div._speechWrap = div.querySelector('.speech-wrap');
                div._discoveryWrap = div.querySelector('.discovery-wrap');
                div._deadSpriteIcon = div.querySelector('.dead-sprite-icon'); 
                div._anchorGroup = div.querySelector('.overlay-anchor-group');
                div._nameTag = div.querySelector('.name-tag'); 
                
                this._overlayCache.set(uniqueId, div);
            }

            const finalX = pos.x + (UNIT_LEFT_OFFSET * currentScale);
            const finalY = pos.y - (UNIT_HEIGHT_OFFSET * currentScale);
            
            if (div.style.left !== finalX + 'px') div.style.left = finalX + 'px';
            if (div.style.top !== finalY + 'px') div.style.top = finalY + 'px';
            
            const newZIndex = (u === this.battle.currentUnit) ? '8000' : Math.floor(finalY).toString();
            if (div.style.zIndex !== newZIndex) div.style.zIndex = newZIndex;
            
            // ⭐ [버그 수정됨] isDead 대신 isFullyDead 사용 및 동적 필터 업데이트 적용
            if (div._deadSpriteIcon) {
                div._deadSpriteIcon.style.display = isFullyDead ? 'block' : 'none';
                div._deadSpriteIcon.innerHTML = displayIcon;
            }
            if (div._anchorGroup) {
                div._anchorGroup.style.display = (hideBar || isFullyDead) ? 'none' : 'flex';
                // 캐싱된 상태에서도 실시간으로 투명도와 흑백 필터가 반영되도록 스타일 강제 갱신
                div._anchorGroup.style.opacity = isFullyDead ? '0.6' : customOpacity;
                div._anchorGroup.style.filter = isFullyDead ? 'grayscale(100%)' : customFilter;
            }

            const maxHp = u.hp || 1;
            const curHp = u.curHp || 0;
            const maxMp = u.mp || 1; 
            const curMp = u.curMp || 0;
            const safeBuffs = u.buffs || []; 
            const shieldBuff = safeBuffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
            const shieldVal = shieldBuff ? shieldBuff.amount : 0;
            const totalMax = Math.max(maxHp, curHp + shieldVal);
            const hpPct = Math.floor((curHp / totalMax) * 100);
            const mpPct = Math.floor((curMp / maxMp) * 100);
            const shieldPct = Math.floor((shieldVal / totalMax) * 100);
            
            let agPct, agColor;
            const ag = u.actionGauge || 0; 
            if (ag >= 0) { 
                agPct = Math.floor(Math.min(100, (ag / this.battle.actionGaugeLimit) * 100)); 
                agColor = '#ffca28';
            } else { 
                agPct = Math.floor(Math.min(100, (Math.abs(ag) / 50) * 100)); 
                agColor = '#e57373';
            }

            if (div._hpFill) div._hpFill.style.width = hpPct + '%';
            if (div._shieldFill) div._shieldFill.style.width = shieldVal > 0 ? shieldPct + '%' : '0%';
            if (div._mpFill) div._mpFill.style.width = mpPct + '%';
            if (div._agFill) {
                div._agFill.style.width = agPct + '%';
                div._agFill.style.background = agColor;
            }

            if (div._highlightWrap) {
                const shouldHighlight = u === this.battle.currentUnit;
                const hasHighlight = div._highlightWrap.childElementCount > 0;
                if (shouldHighlight && !hasHighlight) div._highlightWrap.innerHTML = '<div class="turn-highlight-circle"></div>';
                else if (!shouldHighlight && hasHighlight) div._highlightWrap.innerHTML = '';
            }

            if (div._statusRow) {
                const buffSignature = safeBuffs.map(b => b.type).join(',');
                if (div._statusRow.dataset.buffSig !== buffSignature) {
                    div._statusRow.dataset.buffSig = buffSignature;
                    const uniqueBuffs = [];
                    const seenTypes = new Set();
                    safeBuffs.forEach(b => {
                        if (!seenTypes.has(b.type)) { seenTypes.add(b.type); uniqueBuffs.push(b); }
                    });

                    div._statusRow.style.display = uniqueBuffs.length > 0 ? 'flex' : 'none';
                    if (uniqueBuffs.length > 0) {
                        div._statusRow.innerHTML = uniqueBuffs.slice(0, 5)
                            .map(b => {
                                let iconStr = b.icon || '🔸';
                                let isBuff = b.isBuff !== false;
                                if (b.type && (b.type.includes('DEBUFF') || b.type.includes('DOWN'))) isBuff = false;
                                if (isBuff) {
                                    iconStr = iconStr.replace('▼', '▲').replace('🔽', '🔼');
                                    iconStr = `<span style="color:#e57373; text-shadow: 1px 1px 0 #000;">${iconStr}</span>`; 
                                } else {
                                    iconStr = iconStr.replace('▲', '▼').replace('🔼', '🔽');
                                    iconStr = `<span style="color:#81c784; text-shadow: 1px 1px 0 #000;">${iconStr}</span>`; 
                                }
                                return `<div class="status-icon-mini">${iconStr}</div>`;
                            }).join('');
                    }
                }
            }

            if (div._speechWrap) {
                const newSpeech = u.speechText || '';
                if (div._speechWrap.dataset.speech !== newSpeech) {
                    div._speechWrap.dataset.speech = newSpeech;
                    div._speechWrap.innerHTML = newSpeech ? `<div class="speech-bubble">${newSpeech}</div>` : '';
                }
            }

            if (div._discoveryWrap) {
                const shouldShow = !!u.isDiscoverySignaling;
                const isShowing = div._discoveryWrap.childElementCount > 0;
                if (shouldShow && !isShowing) {
                    div._discoveryWrap.innerHTML = `
                        <div style="position: absolute; top: -55px; left: 50%; transform: translateX(-50%); font-size: 28px; color: #ffdd00; font-weight: bold; text-shadow: 0 0 5px #ff0000, 0 0 10px #ff0000; z-index: 9999; pointer-events: none; animation: floatMark 1s infinite ease-in-out;">!</div>
                    `;
                } else if (!shouldShow && isShowing) div._discoveryWrap.innerHTML = '';
            }
        });

        for (const [id, div] of this._overlayCache.entries()) {
            if (!activeUnitIds.has(id)) {
                div.remove();
                this._overlayCache.delete(id);
            }
        }
    }

    log(msg, type) {
        const box = document.getElementById('log-content');
        if(box) {
            box.insertAdjacentHTML('beforeend', `<div class="log-entry ${type}" style="margin-bottom:2px; padding-bottom:2px; border-bottom:1px dashed #3e2723;">${msg}</div>`);
            if (box.childElementCount > 100) {
                box.removeChild(box.firstElementChild);
            }
            const logBox = document.getElementById('log-box');
            if(logBox) logBox.scrollTop = logBox.scrollHeight;
        }
    }

    showFloatingText(u, txt, col) {
        this.textQueue.push({u, txt, col});
    }

    processTextQueue() { 
        if (this.textQueue.length === 0) return;
        
        const now = Date.now();
        if (!this._lastTextTimes) this._lastTextTimes = new Map();

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
            const pos = (u && u.visualPos) ? this.getUnitScreenPos(u) : this.getHexScreenPos(u.q, u.r); 
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
            
            document.body.appendChild(el); 
            setTimeout(() => el.remove(), 3000); 
        } 
    }

    updateCursor() { 
        const v = document.getElementById('viewport'); 
        if(this.battle.selectedSkill) v.className = 'cursor-skill'; 
        else if(this.battle.hoverHex && this.battle.getUnitAt(this.battle.hoverHex.q, this.battle.hoverHex.r)?.team === 1) v.className = 'cursor-attack'; 
        else v.className = ''; 
    }
    hideAllCombatUI() {
        // 1. 야간 필터 완전히 제거 (월드맵/마을 오염 방지)
        const nightFilter = document.getElementById('night-filter-overlay');
        if (nightFilter) nightFilter.remove();

        // 2. 불필요한 전투 UI 겹침 방지 (숨김 처리)
        const uiElements = [
            'floating-controls', 
            'status-panel', 
            'time-panel', 
            'turn-queue-panel', 
            'unit-overlays'
        ];
        uiElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }
}