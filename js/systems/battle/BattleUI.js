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
import { UI } from '../../render/uiController.js';

export class BattleUI {
    constructor(battleSystem, canvas) {
        this.battle = battleSystem;
        this.canvas = canvas;
        this._lastTargets = [];
        this._lastTerrain = null;
        this.lockedTargetPanel = false;

        // ⭐ 주야간(Day & Night) 시스템 상태 초기화
        this.timeState = { 
            hour: this.battle.gameApp?.gameState?.startHour ?? 11, // 기본 정오 시작
            actions: 0 
        };

        this.activeMenuPath = ['root'];
        this.expandedCards = new Set(); // ⭐ 세부정보 창 확장 상태를 저장하는 변수 추가
        this.toggleDetailCard = (id) => {
            if (this.expandedCards.has(id)) this.expandedCards.delete(id);
            else this.expandedCards.add(id);
        };
        this.toggleMenuNode = (node, depth) => {
            if (this.activeMenuPath[depth] === node) {
                // 이미 열려있던 메뉴를 다시 클릭하면 해당 깊이에서 닫음
                this.activeMenuPath.length = depth; 
            } else {
                // 새 메뉴를 클릭하면 더 깊은 하위 메뉴들을 닫고 이 메뉴를 엶
                this.activeMenuPath.length = depth;
                this.activeMenuPath[depth] = node;
            }
            this.updateFloatingControls();
        };

        this._cachedRect = this.canvas.getBoundingClientRect();
        this.resizeHandler = () => {
            if (this.canvas) this._cachedRect = this.canvas.getBoundingClientRect();
        };
        window.addEventListener('resize', this.resizeHandler);

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

        // ⭐ [버그 수정] 재입장 시 좌우측 UI(사이드바)가 사라지는 현상 해결
        // 이전 전투 종료 시 hideAllCombatUI()가 걸어둔 inline display:none을 해제합니다.
        const resetPanelIds = ['sidebar-left', 'sidebar-right', 'floating-controls', 'unit-overlays'];
        resetPanelIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = '';
                el.style.opacity = '';
                // ⭐ [치명적 버그 수정] unit-overlays는 화면 전체를 덮는 투명막이므로 무조건 클릭을 통과(none)시켜야 합니다.
                // 빈 문자열('')로 초기화해버리면 기본값(auto)이 되어 맵 클릭과 드래그를 전부 막아버리는 원인이 됩니다.
                if (id === 'unit-overlays') {
                    el.style.pointerEvents = 'none';
                } else {
                    el.style.pointerEvents = '';
                }
            }
        });

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
                /* 1. 하단 패널 완전 제거 및 전체화면 강제 확장 */
                #bottom-panel { display: none !important; }
                .battle-layout, #scene-battle { 
                    display: block !important; 
                    width: 100vw !important; 
                    height: 100vh !important; 
                    overflow: hidden !important; 
                    background: #111 !important; 
                }
                #viewport-container, #viewport, canvas { 
                    width: 100vw !important; 
                    height: 100vh !important; 
                    max-height: 100vh !important; 
                    position: absolute !important; 
                    top: 0; left: 0; 
                }
                
                /* 2. 좌우 사이드바를 맵 위에 뜨는 플로팅(Floating) 컨테이너로 변환 */
                #sidebar-left { 
                    position: absolute !important; 
                    left: 20px !important; 
                    bottom: 20px !important; 
                    width: 280px !important; 
                    height: auto !important; 
                    max-height: 85vh !important; 
                    z-index: 10000; 
                    background: transparent !important; 
                    border: none !important; 
                    pointer-events: none; /* 빈 공간 클릭 통과 */
                    display: flex; flex-direction: column; justify-content: flex-end;
                }
                #sidebar-right { 
                    position: absolute !important; 
                    right: 20px !important; 
                    bottom: 20px !important; 
                    width: 280px !important; 
                    height: auto !important; 
                    max-height: 85vh !important; 
                    z-index: 10000; 
                    background: transparent !important; 
                    border: none !important; 
                    pointer-events: none; 
                    display: flex; flex-direction: column; justify-content: flex-end; gap: 15px;
                }
                
                /* 3. 플로팅 위젯 기본 스타일 (양피지/가죽 느낌) */
                .floating-widget {
                    background: var(--panel-bg, rgba(26, 18, 16, 0.95));
                    border: 3px double var(--wood-dark, #5d4037);
                    border-radius: 8px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.8);
                    pointer-events: auto; /* 위젯 영역은 클릭 가능 */
                    overflow: hidden;
                    display: flex; flex-direction: column;
                }

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
        if (!document.getElementById('action-ui-styles-v6')) {
            const style = document.createElement('style');
            style.id = 'action-ui-styles-v6';
            style.innerHTML = `
                @keyframes slideInLeftUI { from { transform: translateX(-150%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideInRightUI { from { transform: translateX(150%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .panel-anim-left { animation: slideInLeftUI 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .panel-anim-right { animation: slideInRightUI 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
            `;
            document.head.appendChild(style);
        }

        const oldLog = document.getElementById('draggable-log-container');
        if (oldLog) oldLog.remove();

        if (!document.getElementById('surrender-btn-container')) {
            const surr = document.createElement('div');
            surr.id = 'surrender-btn-container';
            // 항복 버튼을 우측 상단으로 이동시켜 시야 확보
            surr.style.cssText = 'position: absolute; top: 20px; right: 20px; z-index: 10001;';
            surr.innerHTML = `<button id="btn-surrender" style="background:var(--wood-dark, #3e2723); color:#e57373; border:2px solid #8e3636; border-radius:4px; padding:8px 20px; cursor:pointer; font-size:13px; font-weight:bold; transition:0.2s; box-shadow: 2px 4px 8px rgba(0,0,0,0.6); font-family: var(--font-game, 'Orbitron');" onmouseover="this.style.background='#500'" onmouseout="this.style.background='var(--wood-dark, #3e2723)'">🏳️ SURRENDER</button>`;
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
            targetWrapper.style.cssText = 'display: flex; flex-direction: column; pointer-events: none;';
            
            // ⭐ 하단 중앙 지형 정보 컨테이너 추가
            let terrainWrapper = document.getElementById('terrain-info-wrapper');
            if (!terrainWrapper) {
                terrainWrapper = document.createElement('div');
                terrainWrapper.id = 'terrain-info-wrapper';
                document.body.appendChild(terrainWrapper);
            }
            
            const logWrapper = document.createElement('div');
            logWrapper.id = 'battle-log-wrapper';
            // 로그창을 플로팅 위젯 스타일로 변경
            logWrapper.className = 'floating-widget';
            logWrapper.style.cssText = 'height: 200px; flex-shrink: 0; transition: opacity 0.3s ease; opacity: 0.8;';
            logWrapper.onmouseenter = () => logWrapper.style.opacity = '1';
            logWrapper.onmouseleave = () => logWrapper.style.opacity = '0.8';
            logWrapper.innerHTML = `
                <div style="width: 100%; height: 28px; background: var(--wood-dark, #3e2723); display:flex; align-items:center; justify-content:center; font-size: 12px; color: var(--gold, #ffca28); font-weight:bold; border-bottom: 2px solid var(--border-dim, #5d4037); flex-shrink: 0; font-family: var(--font-game, 'Orbitron'); letter-spacing: 2px;">
                    📜 BATTLE LOG
                </div>
                <div id="log-box" class="custom-scrollbar" style="flex: 1; overflow-y: auto; padding: 10px; font-size: 12px; color: #d7ccc8; word-break: keep-all; font-family: var(--font-main, sans-serif); background: var(--item-bg, rgba(20,15,10,0.8));">
                    <div id="log-content" style="display:flex; flex-direction:column; gap:4px;"></div>
                </div>
            `;
            
            // 상단부터 target -> log 순으로 쌓이도록
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

    // =========================================================================
    // ⭐ 워크래프트 스타일 주야간(Day & Night) 시스템
    // =========================================================================

    initDayNightUI() {
        let filterOverlay = document.getElementById('day-night-filter');
        if (!filterOverlay) {
            filterOverlay = document.createElement('div');
            filterOverlay.id = 'day-night-filter';
            filterOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 50; mix-blend-mode: multiply; transition: background 2.5s ease-in-out; background: rgba(0,0,0,0);';
            document.body.appendChild(filterOverlay);
        }

        let clockContainer = document.getElementById('warcraft-clock');
        if (!clockContainer) {
            clockContainer = document.createElement('div');
            clockContainer.id = 'warcraft-clock';
            clockContainer.style.cssText = 'position: absolute; top: 15px; left: 50%; transform: translateX(-50%); z-index: 10005; display: flex; flex-direction: column; align-items: center; pointer-events: none; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.8));';
            
            let dotsHtml = '';
            for (let i = 0; i < 12; i++) {
                const angle = (i * 30) * (Math.PI / 180);
                const x = 32 + 38 * Math.sin(angle) - 4; 
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
        
        this.updateDayNightVisuals();
    }

    addTimeAction(amount = 1) {
        this.timeState.actions += amount;
        
        if (this.timeState.actions >= 10) {
            const hoursPassed = Math.floor(this.timeState.actions / 10);
            this.timeState.actions = this.timeState.actions % 10; 
            
            this.timeState.hour = (this.timeState.hour + hoursPassed) % 24;
            
            this.log(`🔔 시간이 흘러 [${this.getTimeNameByHour(this.timeState.hour)}] 시간대가 되었습니다.`, 'log-system');
        }
        
        this.updateDayNightVisuals();
    }

    updateDayNightVisuals() {
        const h = this.timeState.hour;

        const filterEl = document.getElementById('day-night-filter');
        if (filterEl) {
            filterEl.style.background = this.getFilterColorByHour(h);
        }

        const isDay = (h >= 6 && h < 18);
        const centerIcon = document.getElementById('time-center-icon');
        if (centerIcon) {
            centerIcon.innerHTML = isDay ? '☀️' : '🌙';
            centerIcon.style.transform = `rotate(${(h % 12) * 30}deg)`; 
            
            if (centerIcon.parentElement.title) {
                centerIcon.parentElement.removeAttribute('title');
            }
        }

        const activeDotIndex = h % 12; 
        const isPM = h >= 12; 

        for (let i = 0; i < 12; i++) {
            const dot = document.getElementById(`time-dot-${i}`);
            if (dot) {
                if (i === activeDotIndex) {
                    dot.style.background = '#00e5ff'; 
                    dot.style.boxShadow = '0 0 8px #00e5ff, 0 0 15px #00e5ff';
                    dot.style.border = '1px solid #fff';
                } else if (i < activeDotIndex) {
                    const dotHour = isPM ? (12 + i) : i; 
                    const isDotDay = (dotHour >= 6 && dotHour < 18);

                    if (isDotDay) {
                        dot.style.background = '#ffca28'; 
                        dot.style.boxShadow = 'none';
                    } else {
                        dot.style.background = '#283593'; 
                        dot.style.boxShadow = 'inset 0 0 4px rgba(0,0,0,0.5)';
                    }
                    dot.style.border = '1px solid #1a1210';
                } else {
                    dot.style.background = '#3e2723'; 
                    dot.style.boxShadow = 'none';
                    dot.style.border = '1px solid #1a1210';
                }
            }
        }
    }

    getFilterColorByHour(h) {
        if (h >= 5 && h < 7) return 'rgba(100, 100, 180, 0.2)'; 
        if (h >= 7 && h < 11) return 'rgba(255, 255, 200, 0.05)'; 
        if (h >= 11 && h < 15) return 'rgba(0, 0, 0, 0)'; 
        if (h >= 15 && h < 18) return 'rgba(255, 150, 50, 0.15)'; 
        if (h >= 18 && h < 22) return 'rgba(180, 50, 0, 0.3)'; 
        return 'rgba(10, 15, 40, 0.55)'; 
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
        if (this._isDestroyed) return;
        
        // ⭐ 전투가 종료 상태가 되면 찌꺼기 CSS와 방해 UI를 즉시 청소 (화면 잠금 원천 차단)
        if (this.battle.isBattleEnded) {
            if (!this._cleanupDone) {
                this.hideAllCombatUI();
                this._cleanupDone = true;
            }
            return;
        }

        // ⭐ [버그 수정] 스킬 시전 종료 감지 및 플로팅 UI 자동 복구 로직
        // isProcessingTurn 상태가 변하는 순간을 포착합니다.
        const currentProcessing = this.battle.isProcessingTurn;
        if (this._prevProcessing !== currentProcessing) {
            this._prevProcessing = currentProcessing;
            // 시전 중(true)에서 시전 완료(false)로 바뀌었을 때 플로팅 컨트롤을 즉각 새로고침합니다.
            if (!currentProcessing) {
                this.updateFloatingControls();
            }
        }

        // ⭐ [버그 수정] 둘러보기 모드(Free View) 시 나가는 버튼을 중앙 상단에 표시
        if (this.battle.isFreeView && !document.getElementById('exit-freeview-btn')) {
            const exitBtn = document.createElement('button');
            exitBtn.id = 'exit-freeview-btn';
            exitBtn.innerHTML = '👁️ 둘러보기 종료';
            exitBtn.style.cssText = 'position:absolute; top:80px; left:50%; transform:translateX(-50%); z-index:10000; background:rgba(0,0,0,0.8); color:#0ff; border:2px solid #0ff; padding:10px 20px; font-weight:bold; border-radius:5px; cursor:pointer; font-size:16px; font-family:var(--font-game); text-shadow:0 0 5px #00f; box-shadow:0 0 10px rgba(0,255,255,0.5);';
            exitBtn.onclick = () => {
                this.battle.isFreeView = false;
                if (this.battle.currentUnit) {
                    this.battle.centerCameraOnUnit(this.battle.currentUnit);
                }
                exitBtn.remove();
            };
            document.body.appendChild(exitBtn);
        } else if (!this.battle.isFreeView && document.getElementById('exit-freeview-btn')) {
            document.getElementById('exit-freeview-btn').remove();
        }

        this.renderUnitOverlays();
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

    _generateLShapePanel(u, isAlly, titleText = null, prefix = 'left', animClass = '') {
        const panelBg = 'rgba(35, 22, 16, 0.8)'; 
        
        const logWrap = document.getElementById('battle-log-wrapper');
        if (logWrap && logWrap.parentElement && logWrap.parentElement.id === 'sidebar-right') {
            document.body.appendChild(logWrap); 
        }

        if (!document.getElementById('l-shape-width-fix-v16')) {
            const style = document.createElement('style');
            style.id = 'l-shape-width-fix-v16';
            style.innerHTML = `
                #sidebar-left, #sidebar-right { width: max-content !important; background: transparent !important; box-shadow: none !important; border: none !important; z-index: 99999 !important; }
                #sidebar-left { left: 20px !important; } #sidebar-right { right: 20px !important; }
                
                #battle-log-wrapper { position: fixed !important; top: 100px !important; right: 20px !important; width: 320px !important; max-height: 200px !important; z-index: 99999 !important; pointer-events: auto !important; }
                #surrender-btn-container { position: fixed !important; top: 15px !important; right: 20px !important; z-index: 99999 !important; }
                #btn-surrender { padding: 4px 10px !important; font-size: 11px !important; border-width: 1px !important; }

                @keyframes slideInLeftUI { 0% { transform: translateX(-150%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
                @keyframes slideInRightUI { 0% { transform: translateX(150%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
                @keyframes slideOutLeftUI { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-150%); opacity: 0; visibility: hidden; } }
                @keyframes slideOutRightUI { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(150%); opacity: 0; visibility: hidden; } }
            `;
            document.head.appendChild(style);
        }

        if (!u) return '';
        const hpP = u.isTerrainMock ? 0 : Math.max(0, Math.min(100, (u.curHp / u.hp) * 100));
        const mpP = u.isTerrainMock ? 0 : Math.max(0, Math.min(100, (u.curMp / u.mp) * 100));
        let agP = 0, agC = 'linear-gradient(180deg, #ffca28 0%, #f57c00 100%)';
        if (!u.isTerrainMock) {
            if (u.actionGauge >= 0) { agP = Math.min(100, (u.actionGauge / this.battle.actionGaugeLimit) * 100); } 
            else { agP = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); agC = 'linear-gradient(180deg, #ef5350 0%, #c62828 100%)'; }
        }

        let jobName = u.job || '견습생';
        if (jobName === '무직') jobName = '견습생';
        let classNameKr = ""; 
        let classNameEn = "";
        const classNum = u.classLevel || 1;
        
        if (!u.isTerrainMock && u.classKey && typeof JOB_CLASS_DATA !== 'undefined') {
            let classInfo = JOB_CLASS_DATA[u.classKey];
            if (!classInfo) classInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === u.classKey && c.classLevel === classNum);
            if (!classInfo) classInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === u.classKey);
            if (classInfo) { 
                jobName = classInfo.jobName || jobName; 
                classNameKr = classInfo.className || ""; 
                classNameEn = classInfo.classNameEn || ""; 
            }
        }
        
        let classDisplay = "";
        if (classNameEn || classNameKr) {
            classDisplay = `Class ${classNum}. ${classNameEn} ${classNameKr ? `(${classNameKr})` : ''}`.trim();
        }
        
        let deadTextHtml = '';
        if (u.isFullyDead) deadTextHtml = `<span style="color:#f55; font-weight:bold; font-size:12px; margin-bottom:5px;">[☠️ 사망]</span>`;
        else if (u.isIncapacitated) deadTextHtml = `<span style="color:#f55; font-weight:bold; font-size:12px; margin-bottom:5px;">[☠️ 전투 불능: ${u.deathTimer}턴 남음]</span>`;
        
        let buffsHtml = '';
        (u.buffs || []).forEach(b => {
            if (b.type !== '-') {
                const isDebuff = b.type.includes('DEBUFF') || b.type.includes('CC_') || b.type.includes('STAT_');
                const bCol = isDebuff ? '#e57373' : '#81c784'; 
                
                let detailHtml = '';
                if (b.amount !== undefined) detailHtml += `<div style='color:#4fc3f7; font-size:11px; margin-top:2px; font-weight:bold;'>보호막 량: ${Math.floor(b.amount)}</div>`;
                else if (b.val !== undefined && b.val !== 1 && b.val !== 0) {
                    if (b.val < 10) { 
                        const pct = Math.abs(Math.round((b.val > 1 ? b.val - 1 : 1 - b.val) * 100));
                        if (pct > 0) detailHtml += `<div style='color:#ffb74d; font-size:11px; margin-top:2px; font-weight:bold;'>수치: ${pct}% ${b.val > 1 || !isDebuff ? '증가' : '감소'}</div>`;
                    } else detailHtml += `<div style='color:#ffb74d; font-size:11px; margin-top:2px; font-weight:bold;'>수치: ${Math.floor(b.val)}</div>`;
                }

                let displayName = b.name || String(b.type);
                const tooltipStr = `<div style='color:${bCol};font-weight:bold;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;margin-bottom:4px;font-family:var(--font-main);'>${b.icon||'✨'} ${displayName}</div>${detailHtml}<div style='color:#ffca28; font-size:12px; margin-top:8px; font-weight:bold; font-family:var(--font-game);'>남은 턴: ${b.duration >= 99 ? '영구 유지' : b.duration}</div>`;
                const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

                buffsHtml += `<div style="width:22px; height:22px; background:rgba(0,0,0,0.3); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:13px; cursor:help; position:relative;" data-tip="${encodedTooltip}" onmouseenter="if(window.battle && window.battle.ui) window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="if(window.battle && window.battle.ui) window.battle.ui.hideTooltip()">${b.icon||'✨'}</div>`;
            }
        });

        let passivesHtml = '';
        const equippedSkillIds = (u.equippedSkills || []).filter(id => id !== null);
        const equippedPassives = (u.skills || []).filter(s => equippedSkillIds.includes(s.id) && (s.part === 'S' || s.part === 'P' || s.type === 'PASSIVE'));
        
        equippedPassives.forEach(p => {
            const tooltipStr = `<div style='color:#ffca28;font-weight:bold;'>${p.name}</div><div style='margin-top:4px;'>${p.desc||''}</div>`;
            const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            passivesHtml += `<div style="width:22px; height:22px; background:rgba(0,0,0,0.3); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:13px; cursor:help;" data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()">${p.icon||'💡'}</div>`;
        });

        // ⭐ 지형 정보 추출 (캐릭터가 밟고 있는 지형 or 맨땅 그 자체)
        let terrainIcon = '🟫';
        let terrainName = '알 수 없음';
        let terrainHeight = u.isTerrainMock ? (u.level || 0) : 0;
        let terrainEffect = '특수 효과 없음';

        if (u.isTerrainMock) {
            terrainIcon = u.icon;
            terrainName = u.name;
            terrainEffect = u.terrainEffectDesc || '특수 효과 없음';
        } else if (this.battle && this.battle.grid && u.q !== undefined && u.r !== undefined) {
            const tData = this.battle.grid.getTerrainData(u.q, u.r) || { key: 'PLAIN', h: 0 };
            const tInfo = (typeof TERRAIN_TYPES !== 'undefined') ? TERRAIN_TYPES[tData.key] : null;
            if (tInfo) {
                terrainName = tInfo.name || tData.key;
                terrainHeight = tData.h || 0;
                
                if (tData.key.includes('FOREST')) terrainIcon = '🌳';
                else if (tData.key.includes('WATER') || tData.key.includes('SWAMP')) terrainIcon = '💧';
                else if (tData.key.includes('LAVA') || tData.key.includes('VOLCANO')) terrainIcon = '🌋';
                else if (tData.key.includes('SNOW') || tData.key.includes('ICE')) terrainIcon = '❄️';
                else if (tData.key.includes('WALL')) terrainIcon = '🧱';
                else if (tData.key.includes('ROAD')) terrainIcon = '🛣️';
                else if (tData.key.includes('GRASS') || tData.key.includes('PLAIN')) terrainIcon = '🌱';

                if (tInfo.desc) {
                    terrainEffect = tInfo.desc;
                } else if (tInfo.effect) {
                    const val = tInfo.effect.val;
                    const sign = val > 0 ? '+' : '';
                    if (tInfo.effect.type.startsWith('DMG')) terrainEffect = `매 턴 ${val}% 피해`;
                    else if (tInfo.effect.type === 'HEAL_PCT') terrainEffect = `매 턴 ${val}% 회복`;
                    else if (tInfo.effect.type === 'BUFF_EVA') terrainEffect = `회피율 ${sign}${val}%`;
                    else if (tInfo.effect.type === 'BUFF_DEF') terrainEffect = `방어력 ${sign}${val}`;
                }
            }
        }

        // 지형 툴팁 조립
        const terrainTooltip = `<div style='color:#ffca28;font-weight:bold;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;margin-bottom:4px;font-family:var(--font-main);'>${terrainIcon} ${terrainName}</div><div style='color:#ebd9b4; font-size:12px; margin-top:4px; font-family:var(--font-game);'>고도(H): ${terrainHeight}</div><div style='color:#81c784; font-size:12px; margin-top:4px; font-family:var(--font-main); font-weight:bold;'>${terrainEffect}</div>`;
        const encodedTerrainTooltip = terrainTooltip.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const statNoBtn = (k, lbl, valColor = '#ffffff') => {
            if (u.isTerrainMock) {
                return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; font-size:12px; box-sizing:border-box;">
                    <span style="display:flex; align-items:baseline; gap:4px; white-space:nowrap;">${lbl}</span><span style="color:#5d4037; font-weight:bold; font-family:var(--font-game); font-size:14px;">-</span></div>`;
            }
            let baseVal = k === 'jump' ? (u.jump || 1) : Formulas.getStat(u, k);
            let curVal = baseVal;
            if (k === 'mov') curVal = Formulas.getDerivedStat(u, 'mov');
            else if (k === 'jump') {
                let jMod = 0; (u.buffs || []).forEach(b => { if (b.type.includes('JUMP')) jMod += (parseFloat(b.val) || 0); });
                curVal = Math.max(0, baseVal + jMod);
            } else if (k === 'rng') {
                let rMod = 0; (u.buffs || []).forEach(b => { if (b.type.includes('RANGE')) rMod += (parseFloat(b.val) || 0); });
                curVal = Math.max(0, baseVal + rMod);
            }

            let valHtml = `<span style="color:${valColor}; font-weight:bold; font-family:var(--font-game); font-size:14px; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">${Math.floor(baseVal)}</span>`;
            if (Math.floor(curVal) > Math.floor(baseVal)) valHtml += `<span style="color:#64dd17; font-weight:bold; font-size:12px; margin-left:4px; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">(${Math.floor(curVal)})</span>`;
            else if (Math.floor(curVal) < Math.floor(baseVal)) valHtml += `<span style="color:#ff5252; font-weight:bold; font-size:12px; margin-left:4px; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">(${Math.floor(curVal)})</span>`;

            return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; font-size:12px; box-sizing:border-box;">
                <span style="display:flex; align-items:baseline; gap:4px; white-space:nowrap;">${lbl}</span><div style="display:flex; align-items:baseline; justify-content:flex-end;">${valHtml}</div></div>`;
        };

        const statCombat = (k, lbl, valColor = '#ffffff') => {
            if (u.isTerrainMock) {
                return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; font-size:12px; box-sizing:border-box;">
                    <span style="display:flex; align-items:baseline; gap:4px; white-space:nowrap;">${lbl}</span><span style="color:#5d4037; font-weight:bold; font-family:var(--font-game); font-size:14px;">-</span></div>`;
            }
            let val = Formulas.getDerivedStat(u, k);
            let disp = Math.floor(val);
            if (k === 'crit' || k === 'eva') disp = parseFloat(val).toFixed(1) + '%';
            return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; font-size:12px; box-sizing:border-box;">
                <span style="display:flex; align-items:baseline; gap:4px; white-space:nowrap;">${lbl}</span><div style="display:flex; align-items:center; justify-content:flex-end;">
                <span style="color:${valColor}; font-weight:bold; font-family:var(--font-game); font-size:14px; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">${disp}</span></div></div>`;
        };

        const portraitSrc = (typeof PORTRAIT_DATA !== 'undefined' && (PORTRAIT_DATA[u.id] || PORTRAIT_DATA[u.key] || PORTRAIT_DATA[u.classKey])) || u.portrait;        
        
        const isRight = prefix.startsWith('right');
        const flexDirection = isRight ? 'row-reverse' : 'row';
        const portraitImgRadius = isRight ? '0 8px 0 0' : '8px 0 0 0';
        const portraitBarsRadius = isRight ? '0 0 8px 0' : '0 0 0 8px';
        const armRadius = isRight ? '8px 0 0 8px' : '0 8px 8px 0';
        
        let inlineAnimStyle = "opacity: 1;";
        if (animClass) {
            const animName = isRight ? 'slideInRightUI' : 'slideInLeftUI';
            inlineAnimStyle = `opacity: 0; animation: ${animName} 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) 0s 1 normal forwards !important;`;
        }

        return `
        <div id="card-${prefix}" style="display:flex; flex-direction:${flexDirection}; align-items:flex-end; filter:drop-shadow(2px 4px 10px rgba(0,0,0,0.8)); margin-bottom: 5px; pointer-events:auto; width:max-content; flex-wrap:nowrap; ${inlineAnimStyle}">
            
            <div style="width:300px; display:flex; flex-direction:column; position:relative; z-index:2; flex-shrink:0;">
                <div style="width:300px; height:300px; position:relative; border:none; border-radius:${portraitImgRadius}; background:${panelBg}; overflow:hidden;">
                    ${portraitSrc 
                        ? `<img src="${portraitSrc}" style="width:100%; height:100%; object-fit:cover;">` 
                        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:120px; filter:drop-shadow(2px 4px 6px rgba(0,0,0,0.8));">${u.icon||'👤'}</div>`
                    }
                    <div style="position:absolute; bottom:0; width:100%; background:linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, transparent 100%); color:#fff; text-align:center; padding:25px 5px 10px 5px; box-sizing:border-box;">
                        <div style="color:#ffca28; font-size:18px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow: 1px 1px 3px #000;">${u.name}</div>
                        <div style="color:#ebd9b4; font-size:13px; font-weight:bold; margin-top:4px; text-shadow: 1px 1px 2px #000;">${u.isTerrainMock ? `고도(Height): ${u.level}` : `Lv.${u.level||1} ${jobName}`}</div>
                        ${classDisplay && !u.isTerrainMock ? `<div style="color:#ce93d8; font-size:12px; font-weight:bold; margin-top:2px; text-shadow: 1px 1px 2px #000;">${classDisplay}</div>` : ''}
                    </div>
                </div>
                
                <div style="width:100%; background:${panelBg}; border:none; border-radius:${portraitBarsRadius}; padding:6px 8px; box-sizing:border-box; display:flex; flex-direction:column; gap:0;">
                    <div style="width:100%; height:14px; background:#3e2723; position:relative;">
                        <div id="bar-${prefix}-hp-fill" style="width:${hpP}%; height:100%; background:linear-gradient(90deg, #8b0000, #b22222); transition:width 0.2s;"></div>
                        <div id="bar-${prefix}-hp-text" style="position:absolute; width:100%; top:0; line-height:14px; text-align:center; color:#ebd9b4; font-size:10px; font-weight:bold; text-shadow:1px 1px 0 #000; font-family:var(--font-game);">${u.isTerrainMock ? '지형 기물 (파괴 불가)' : `HP ${Math.floor(u.curHp)}/${u.hp}`}</div>
                    </div>
                    <div style="width:100%; height:10px; background:#122030; position:relative;">
                        <div id="bar-${prefix}-mp-fill" style="width:${mpP}%; height:100%; background:linear-gradient(90deg, #0d47a1, #1976d2); transition:width 0.2s;"></div>
                        <div id="bar-${prefix}-mp-text" style="position:absolute; width:100%; top:0; line-height:10px; text-align:center; color:#ebd9b4; font-size:9px; font-weight:bold; text-shadow:1px 1px 0 #000; font-family:var(--font-game);">${u.isTerrainMock ? '마력 없음' : `MP ${Math.floor(u.curMp)}/${u.mp}`}</div>
                    </div>
                    <div style="width:100%; height:6px; background:#302212; position:relative;">
                        <div id="bar-${prefix}-wt-fill" style="width:${agP}%; height:100%; background:${agC}; transition:width 0.2s;"></div>
                    </div>
                </div>
            </div>
            
            <div style="background:${panelBg}; border:none; border-radius:${armRadius}; padding:10px 14px; display:flex; flex-direction:column; justify-content:flex-end; gap:8px; width:380px; box-sizing:border-box; flex-shrink:0;">
                
                ${deadTextHtml}

                <div style="display:flex; justify-content:space-between; align-items:stretch; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
                    <div style="display:flex; flex-direction:column; gap:6px; flex:1;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:11px; font-weight:bold; color:#85a372; width:30px; font-family:var(--font-main);">상태</span>
                            <div style="display:flex; flex-wrap:wrap; gap:4px; flex:1;">
                                ${u.isTerrainMock ? `<span style="color:#a1887f; font-size:11px; font-family:var(--font-main);">${u.terrainCostDesc || '이동 제약 없음'}</span>` : (buffsHtml || '<span style="color:#a1887f; font-size:11px; font-family:var(--font-main);">없음</span>')}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:11px; font-weight:bold; color:#cfa76e; width:30px; font-family:var(--font-main);">특성</span>
                            <div style="display:flex; flex-wrap:wrap; gap:4px; flex:1;">
                                ${u.isTerrainMock ? `<span style="color:#a1887f; font-size:11px; font-family:var(--font-main);">${u.terrainEffectDesc || '특수 효과 없음'}</span>` : (passivesHtml || '<span style="color:#a1887f; font-size:11px; font-family:var(--font-main);">없음</span>')}
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding-left:12px; border-left:1px dashed rgba(255,255,255,0.2); margin-left:8px;">
                        <span style="font-size:10px; color:#b8a898; margin-bottom:4px; font-family:var(--font-main); font-weight:bold;">${u.isTerrainMock ? '대상' : '지형'}</span>
                        <div style="width:28px; height:28px; background:rgba(0,0,0,0.3); border:1px solid var(--border-dim); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:help; box-shadow:inset 0 0 5px rgba(0,0,0,0.5);" 
                             data-tip="${encodedTerrainTooltip}" 
                             onmouseenter="if(window.battle && window.battle.ui) window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" 
                             onmouseleave="if(window.battle && window.battle.ui) window.battle.ui.hideTooltip()">
                            ${terrainIcon}
                        </div>
                    </div>
                </div>
                
                ${(() => {
                    const fontCfg = { enSize: '12px', enColor: '#ebd9b4', krSize: '8px', krColor: '#a1887f' };
                    const lbl = (en, kr) => `<span style="font-size:${fontCfg.enSize}; color:${fontCfg.enColor}; font-family:var(--font-game);">${en}</span> <span style="font-size:${fontCfg.krSize}; color:${fontCfg.krColor}; font-weight:normal; font-family:var(--font-main);">(${kr})</span>`;
                    
                    return `
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:4px;">
                        ${statCombat('atk_phys', lbl('ATK', '공격력'), '#d87060')}
                        ${statCombat('atk_mag', lbl('MATK', '주문력'), '#d87060')}
                        ${statCombat('spd', lbl('SPD', '속도'), '#709fa6')}

                        ${statCombat('def', lbl('DEF', '방어력'), '#85a372')}
                        ${statCombat('res', lbl('MDEF', '마법방어력'), '#85a372')}
                        ${statCombat('tenacity', lbl('MRES', '저항력'), '#85a372')}

                        ${statCombat('hit_phys', lbl('HIT', '명중률'), '#cfa76e')}
                        ${statCombat('eva', lbl('EVA', '회피율'), '#cfa76e')}
                        ${statCombat('crit', lbl('CRIT', '치명타율'), '#cfa76e')}                  

                        ${statNoBtn('mov', lbl('MOV', '이동력'), '#b8a898')}
                        ${statNoBtn('rng', lbl('RNG', '사거리'), '#b8a898')}
                        ${statNoBtn('jump', lbl('JMP', '도약력'), '#b8a898')}
                    </div>
                    `;
                })()}

            </div>
        </div>`;
    }

    // ⭐ [완벽 개편] 턴 종료 시 양쪽 패널이 구석으로 완전히 밀려 나가며, 우측 타겟 정보도 초기화됨
    playTurnEndAnimation() {
        const leftCards = document.querySelectorAll('[id^="card-left"]');
        const rightCards = document.querySelectorAll('[id^="card-right"]');
        
        leftCards.forEach(card => {
            card.style.animation = 'slideOutLeftUI 0.4s cubic-bezier(0.8, 0.2, 0.8, 1) forwards !important';
        });
        rightCards.forEach(card => {
            card.style.animation = 'slideOutRightUI 0.4s cubic-bezier(0.8, 0.2, 0.8, 1) forwards !important';
        });
        
        // ⭐ 애니메이션이 끝나는 시점(0.4초)에 우측 패널을 완전히 비워서 이전 턴의 캐릭터가 남지 않도록 조치
        setTimeout(() => {
            const rightPanel = document.getElementById('target-info-wrapper');
            if (rightPanel) rightPanel.innerHTML = '';
            this._lastTargets = [];
        }, 400);

        // 다음 턴에 무조건 새롭게 '밀려 들어오는' 등장 애니메이션을 보장하기 위해 ID 초기화
        this._animLeftUnitId = null;
        this._animRightTargetId = null;
    }

    // ⭐ [완벽 개편] 이동 등 동일 캐릭터 연속 조작 시 애니메이션 생략, 턴 바뀔 때만 애니메이션 적용
    renderPartyList() {
        const leftPanel = document.getElementById('sidebar-left');
        const u = this.battle.currentUnit;
        if (!leftPanel || !u) return;

        const existingCard = document.getElementById('card-left');
        
        if (existingCard && this._animLeftUnitId !== u.id && !existingCard.classList.contains('sliding-out')) {
            // 다른 캐릭터로 턴이 넘어갔을 경우 (퇴장 -> 입장)
            existingCard.classList.add('sliding-out');
            existingCard.style.setProperty('animation', 'slideOutLeftUI 0.35s cubic-bezier(0.8, 0.2, 0.8, 1) forwards', 'important');
            this.battle.isUIAnimating = true;

            if (this._renderLeftTimeout) clearTimeout(this._renderLeftTimeout);

            this._renderLeftTimeout = setTimeout(() => {
                this._executeRenderPartyList(u, leftPanel, false); // false: 애니메이션 재생 O
            }, 350);
        } else if (!existingCard || this._animLeftUnitId === u.id) {
            // 초기 렌더링이거나, 이동을 마친 동일한 캐릭터일 경우 (즉시 갱신)
            const isSameUnit = (existingCard && this._animLeftUnitId === u.id);
            this._executeRenderPartyList(u, leftPanel, isSameUnit);
        }
    }

    _executeRenderPartyList(u, leftPanel, isSameUnit = false) {
        this._animLeftUnitId = u.id;
        
        let swapBtnHtml = '';
        if (u.team === 0 && (u.homunculusId || u.ownerId)) {
            const isHomun = !!u.ownerId;
            const targetName = isHomun ? "본체" : "호문";
            const targetIcon = isHomun ? "🧙‍♂️" : "👻";
            swapBtnHtml = `
                <div class="floating-widget" style="display:flex; gap:8px; margin-top:10px; width:100%; padding:10px; box-sizing:border-box; z-index:100; pointer-events:auto;">
                    <button id="btn-swap-homun" style="flex:1; background:#4a2b3d; color:#f8bbd0; border:none; border-radius:4px; padding:8px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s; box-shadow: 2px 2px 0 rgba(0,0,0,0.5);">
                        🔄 ${targetIcon} ${targetName}
                    </button>
                    <button id="btn-transposition" style="flex:1; background:#283593; color:#bbdefb; border:none; border-radius:4px; padding:8px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s; box-shadow: 2px 2px 0 rgba(0,0,0,0.5);">
                        🌌 치환
                    </button>
                </div>
            `;
        }

        // ⭐ isSameUnit이 true면 animClass를 비워서 깜빡임 방지
        const animClass = isSameUnit ? '' : 'panel-anim-left';
        const cardHtml = this._generateLShapePanel(u, u.team === 0, null, 'left', animClass);
        
        leftPanel.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column;">
                ${cardHtml}
                ${swapBtnHtml}
            </div>
        `;

        if (!isSameUnit) {
            this.battle.isUIAnimating = true;
            setTimeout(() => {
                this.battle.isUIAnimating = false;
                this.updateFloatingControls();
            }, 500);
        } else {
            this.updateFloatingControls(); // 애니메이션 없이 즉시 버튼 등 갱신
        }

        setTimeout(() => {
            const swapBtn = document.getElementById('btn-swap-homun');
            if (swapBtn) swapBtn.onclick = () => { if(this.battle.toggleHomunculusControl) this.battle.toggleHomunculusControl(); };
            const transBtn = document.getElementById('btn-transposition');
            if (transBtn) transBtn.onclick = () => { if(this.battle.executeTransposition) this.battle.executeTransposition(); };
        }, 50);
    }
    

    updateRightPanel(targets = [], terrain = null) {
        if (targets.length > 0 && !terrain) {
            const u = targets[0];
            if (this.battle && this.battle.grid && u.q !== undefined && u.r !== undefined) {
                try {
                    if (typeof this.battle.grid.getTerrainData === 'function') {
                        const tData = this.battle.grid.getTerrainData(u.q, u.r);
                        if (tData) terrain = tData;
                    } else if (typeof this.battle.grid.getTerrain === 'function') {
                        const tKey = this.battle.grid.getTerrain(u.q, u.r);
                        if (tKey) terrain = { key: tKey, h: 0 };
                    }
                } catch (e) {
                    console.warn("Terrain parsing error:", e);
                }
            }
        }

        this._lastTargets = targets;
        this._lastTerrain = terrain;

        const rightPanel = document.getElementById('target-info-wrapper') || document.getElementById('sidebar-right');
        
        // ⭐ 기존의 분리된 지형 정보 패널 컨테이너는 완전히 비우고 숨김 (삭제와 동일한 효과)
        let terrainPanel = document.getElementById('terrain-info-wrapper');
        if (terrainPanel) {
            terrainPanel.innerHTML = '';
            terrainPanel.style.display = 'none';
        }

        if (!rightPanel) return; 

        // ⭐ 맨땅(빈 헥스) 클릭 시 지형을 가짜 유닛(Mock)으로 만들어 단일 타겟으로 취급
        if (targets.length === 0 && terrain) {
            const tKey = typeof terrain === 'string' ? terrain : (terrain.key || 'UNKNOWN');
            const tHeight = terrain.h || 0;
            let tInfo = null;
            if (typeof TERRAIN_TYPES !== 'undefined') tInfo = TERRAIN_TYPES[tKey];
            const tName = tInfo ? tInfo.name : tKey;
            
            let tIcon = '🟫';
            if (tKey.includes('FOREST')) tIcon = '🌳';
            else if (tKey.includes('WATER') || tKey.includes('SWAMP')) tIcon = '💧';
            else if (tKey.includes('LAVA') || tKey.includes('VOLCANO')) tIcon = '🌋';
            else if (tKey.includes('SNOW') || tKey.includes('ICE')) tIcon = '❄️';
            else if (tKey.includes('WALL')) tIcon = '🧱';
            else if (tKey.includes('ROAD')) tIcon = '🛣️';
            else if (tKey.includes('GRASS') || tKey.includes('PLAIN')) tIcon = '🌱';

            let costDesc = tInfo ? `이동 소모력: ${tInfo.cost >= 99 ? '진입 불가' : tInfo.cost}` : '';
            let effectDesc = tInfo && tInfo.desc ? tInfo.desc : '특수 효과 없음';
            if (tInfo && tInfo.effect && !tInfo.desc) {
                const val = tInfo.effect.val;
                const sign = val > 0 ? '+' : ''; 
                if (tInfo.effect.type.startsWith('DMG')) effectDesc = `매 턴 ${val}% 피해`;
                else if (tInfo.effect.type === 'HEAL_PCT') effectDesc = `매 턴 ${val}% 회복`;
                else if (tInfo.effect.type === 'BUFF_EVA') effectDesc = `회피율 ${sign}${val}%`;
                else if (tInfo.effect.type === 'BUFF_DEF') effectDesc = `방어력 ${sign}${val}`;
            }

            // 가짜 유닛 객체 생성
            targets = [{
                id: 'terrain_mock',
                name: tName,
                level: tHeight, 
                job: '지형 (Terrain)',
                classKey: null,
                icon: tIcon,
                hp: 1, curHp: 1, mp: 1, curMp: 1, actionGauge: 0,
                buffs: [], equippedSkills: [], skills: [],
                atk_phys: 0, def: 0, atk_mag: 0, res: 0, hit_phys: 0, eva: 0, crit: 0, tenacity: 0, spd: 0, mov: 0, jump: 0, rng: 0,
                isTerrainMock: true,
                terrainCostDesc: costDesc,
                terrainEffectDesc: effectDesc
            }];
        }

        let animClass = '';
        if (targets.length > 0) {
            const mainTargetId = targets[0].id;
            if (this._animRightTargetId !== mainTargetId) {
                this._animRightTargetId = mainTargetId;
                animClass = 'panel-anim-right';
            }
        } else {
            this._animRightTargetId = null;
        }

        if (targets.length === 0) {
            rightPanel.innerHTML = '';
        } else if (targets.length === 1) {
            const u = targets[0];
            let titleText = u.team === 0 ? '🟢 타겟 정보 (아군)' : '🔴 타겟 정보 (적군)';
            if (u.isTerrainMock) titleText = '🏞️ 지형 정보';
            
            rightPanel.innerHTML = `<div style="margin-bottom:10px;">${this._generateLShapePanel(u, u.team === 0, titleText, 'right-0', animClass)}</div>`;
        } else {
            let html = `<div class="${animClass}" style="display:flex; flex-direction:column; max-height:60vh; margin-bottom:10px;">`;
            html += `<div class="floating-widget" style="background: rgba(198, 40, 40, 0.9); color: #fff; padding:8px; font-size:13px; font-weight:bold; text-align:center; margin-bottom:8px; border-color: #ff5252; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">다중 타겟 (${targets.length}명)</div>`;
            html += `<div class="custom-scrollbar" style="display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding-right:5px;">`;
            targets.forEach((u, idx) => {
                const titleText = u.team === 0 ? `🟢 타겟 ${idx+1} (아군)` : `🔴 타겟 ${idx+1} (적군)`;
                html += this._generateLShapePanel(u, u.team === 0, titleText, `right-${idx}`, '');
            });
            html += `</div></div>`;
            rightPanel.innerHTML = html;
        }
    }

    // =========================================================================
    // ⭐ [완벽 개편] 계단식(Diagonal Spread) 밀러 컬럼 플로팅 컨트롤
    // =========================================================================
    updateFloatingControls() {
        const wId = 'floating-controls';
        let wrapper = document.getElementById(wId);
        const u = this.battle.currentUnit;
        if (this.battle.isUIAnimating) {
            if (wrapper) wrapper.classList.add('hud-hidden');
            return;
        }

        if (!this.battle.selectedSkill && !this.battle.isMovingMode) {
            this.lockedTargetPanel = false;
        }
        
        if (this.battle.isMovingMode || this.battle.selectedSkill) {
            this.activeMenuPath = ['root'];
        }

        if (!u || u.team !== 0 || this.battle.isProcessingTurn || this.battle.isPeaceful || !this.battle.grid || !this.battle.grid.canvas) {
            if (wrapper) wrapper.classList.add('hud-hidden');
            this.activeMenuPath = ['root']; 
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
            this.activeMenuPath = ['root'];
            return; 
        } else {
            wrapper.classList.remove('hud-hidden');
        }

        // ⭐ UI 계단식 사선 배치(Diagonal Spread) 및 탭 연결 디자인 적용 CSS
        if (!document.getElementById('action-ui-styles-v5')) {
            const olds = ['action-ui-styles', 'action-ui-styles-v2', 'action-ui-styles-v3', 'action-ui-styles-v4'];
            olds.forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });

            const style = document.createElement('style');
            style.id = 'action-ui-styles-v5';
            style.innerHTML = `
                .floating-menu-container { display: flex; flex-direction: row; pointer-events: auto; align-items: flex-start; transition: transform 0.2s ease; }
                
                /* ⭐ 하위 메뉴가 위로 뻗어나가는 입체적 겹침(Overlap) 연출 - 폭 축소 */
                .menu-col { display: flex; flex-direction: column; background: rgba(26, 18, 16, 0.98); border: 2px solid #5d4037; border-radius: 6px; padding: 4px; gap: 2px; min-width: 85px; flex-shrink: 0; box-shadow: -4px 4px 12px rgba(0,0,0,0.8); max-height: 55vh; overflow-y: auto; overflow-x: hidden; position: relative; pointer-events: auto; }
                
                /* 뎁스별 고도(z-index) 및 사선 여백(margin) 설정 - 겹침 대폭 강화 */
                .menu-col.depth-0 { z-index: 10; margin-top: 0; }
                .menu-col.depth-1 { z-index: 11; margin-left: -30px; margin-top: -12px; }
                .menu-col.depth-2 { z-index: 12; margin-left: -30px; margin-top: -24px; }
                .menu-col.depth-3 { z-index: 13; margin-left: -30px; margin-top: -36px; }

                /* ⭐ 버튼 내부 여백 및 폰트 크기 미세 조정으로 컴팩트함 극대화 */
                .menu-btn { background: #2e211b; border: 1px solid #5d4037; border-radius: 3px; padding: 5px 6px; color: #d7ccc8; font-size: 11px; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; justify-content: space-between; align-items: center; white-space: normal; word-break: keep-all; line-height: 1.2; font-family: var(--font-main); gap: 4px; width: 100%; box-sizing: border-box; }
                .menu-btn:hover:not(.disabled) { background: #4e342e; border-color: #ffca28; color: #fff; }
                
                /* ⭐ 활성(선택)된 버튼은 탭처럼 돌출되며 우측 테두리가 사라져 다음 메뉴와 이어짐 */
                .menu-btn.active { background: #3e2723; border-color: #ffca28; border-right-color: transparent; color: #ffca28; box-shadow: 0 0 5px rgba(255,202,40,0.5); transform: translateX(6px); z-index: 5; position: relative; }
                
                .menu-btn.disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(100%); pointer-events: auto !important; }
                .cost-info { display: flex; justify-content: space-between; margin-top: 6px; border-top: 1px dashed #5d4037; padding-top: 6px; font-weight: bold; font-size: 10px; width: 100%; }
            `;
            document.head.appendChild(style);
        }

        const codeDrawnBubbleTail = `
            <svg style="position: absolute; top: 15px; left: -14px; width: 16px; height: 20px; pointer-events: none; z-index: 10; overflow: visible;">
                <path d="M 14 0 L 0 0 L 14 18 Z" fill="rgba(26, 18, 16, 0.98)" stroke="#5d4037" stroke-width="2" stroke-linejoin="round" />
                <path d="M 14 -1 L 14 19" stroke="rgba(26, 18, 16, 0.98)" stroke-width="4" />
            </svg>
        `;

        if (selSkill && isSelfCast) {
            // 단독 시전창 처리 (변동 없음)
            wrapper.innerHTML = `
            <div class="floating-menu-container" onpointerdown="event.stopPropagation();" onclick="event.stopPropagation();">
                <div class="menu-col depth-0" style="padding: 10px; align-items: center; min-width: 100px;">
                    ${codeDrawnBubbleTail}
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <div style="font-size:24px;">${selSkill.icon || '✨'}</div>
                        <div style="font-size:12px; color:#ffca28; font-weight:bold; margin-top:2px; text-align:center;">${selSkill.name}</div>
                    </div>
                    <div style="display:flex; gap:4px; width: 100%; margin-top:4px;">
                        <div class="menu-btn" style="background:#2e7d32; border-color:#4caf50; color:#fff; justify-content:center; padding:6px;" onclick="window.battle.confirmSkillSelf()">시전</div>
                        <div class="menu-btn" style="background:#c62828; border-color:#ef5350; color:#fff; justify-content:center; padding:6px;" onclick="window.battle.cancelAction()">취소</div>
                    </div>
                </div>
            </div>`;
            return;
        }

        // --- 데이터 수집 헬퍼 ---
        const getItemInfo = (id) => {
            if (!id) return null;
            if (typeof ITEM_DATA !== 'undefined' && ITEM_DATA[id]) return ITEM_DATA[id];
            if (this.battle.gameApp && this.battle.gameApp.itemData && this.battle.gameApp.itemData[id]) return this.battle.gameApp.itemData[id];
            return { name: String(id), icon: '💊', desc: '상세 정보 없음' };
        };

        const hasMoved = this.battle.actions.moved;
        const hasActed = this.battle.actions.acted;
        const isMoveMode = this.battle.isMovingMode;
        const isAtkMode = selSkill && (selSkill.id === (u.equippedBasic || '1000'));
        const classLv = u.classLevel || u.level || 1;
        const costRed = Formulas.getDerivedStat(u, 'cost_red') || 1.0;

        let availableItems = [];
        const maxPockets = this.battle.getMaxPockets ? this.battle.getMaxPockets(u) : 4;
        for (let i = 1; i <= maxPockets; i++) {
            const eqData = u.equipment ? u.equipment[`pocket${i}`] : null;
            if (!eqData) continue;
            
            const itemId = typeof eqData === 'object' ? eqData.id : eqData;
            if (!itemId || String(itemId).trim() === '') continue;

            const itemDef = getItemInfo(itemId);
            if (itemDef) {
                availableItems.push({ index: i - 1, item: itemDef });
            }
        }

        let skillsObjList = [];
        if (u.equippedSkills) {
            u.equippedSkills.forEach(sId => {
                if (!sId || sId === '1000') return;
                if (sId.startsWith('CAT_')) {
                    skillsObjList.push({ isCategory: true, name: sId.replace('CAT_', '') });
                    return;
                }
                const sk = u.skills.find(s => s && s.id === sId);
                if (sk) {
                    const part = sk.part || (sk.type === 'PASSIVE' ? 'S' : 'A');
                    if (part === 'A' && classLv >= (typeof TIER_REQ !== 'undefined' ? (TIER_REQ[sk.tier] || 1) : 1)) {
                        skillsObjList.push(sk);
                    }
                }
            });
        }
        if (u.skills) {
            u.skills.forEach(sk => {
                if (sk && sk.isStolen) skillsObjList.push(sk);
            });
        }

        const buildSkillBtn = (s) => {
            const isManaLack = u.curMp < (s.mp||0);
            let isMaterialLack = false;
            let materialTooltipHtml = '';
            
            if (s.itemCost && Array.isArray(s.itemCost) && s.itemCost.length > 0) {
                const validCosts = s.itemCost.filter(id => id && String(id).trim() !== '');

                if (validCosts.length > 0) {
                    materialTooltipHtml += `<div style="margin-top:4px; padding-top:4px; border-top:1px dotted #5d4037; font-size:11px;">`;
                    const reqItems = {};
                    validCosts.forEach(id => { reqItems[id] = (reqItems[id] || 0) + 1; });

                    for (const [itemId, reqCount] of Object.entries(reqItems)) {
                        let hasCount = 0;
                        if (u.equipment) {
                            const currentPockets = this.battle.getMaxPockets ? this.battle.getMaxPockets(u) : 4;
                            for (let i = 1; i <= currentPockets; i++) {
                                const eqData = u.equipment[`pocket${i}`];
                                if (!eqData) continue;
                                const eqId = typeof eqData === 'object' ? eqData.id : eqData;                            
                                const eqCount = typeof eqData === 'object' ? (eqData.count || 1) : 1;
                                if (eqId === itemId) hasCount += eqCount;
                            }
                        }
                        
                        const itemDef = getItemInfo(itemId);
                        const itemName = itemDef ? itemDef.name : String(itemId);

                        if (hasCount >= reqCount) {
                            materialTooltipHtml += `<div style="color:#a5d6a7; margin-top:2px; font-weight:bold;">✔️ ${itemName} (${hasCount}/${reqCount})</div>`;
                        } else {
                            materialTooltipHtml += `<div style="color:#e57373; margin-top:2px;">❌ ${itemName} (${hasCount}/${reqCount})</div>`;
                            isMaterialLack = true;
                        }
                    }
                    materialTooltipHtml += `</div>`;
                }
            }

            const isDisabled = isManaLack || hasActed || isMaterialLack;
            let cls = `menu-btn ${this.battle.selectedSkill?.id === s.id ? 'active' : ''}`;
            if (isDisabled) cls += ' disabled';
            const finalCost = Math.floor((s.cost !== undefined ? s.cost : 50) * costRed);
            
            let nameDisplay = s.name;
            let tooltipExtra = '';
            if (s.isStolen) {
                nameDisplay = `<span style="color:#e040fb;">${s.name}</span> <span style="background:#e040fb; color:#fff; border-radius:3px; padding:1px 4px; font-size:9px; margin-left:4px; font-weight:bold; vertical-align:middle;">FREE</span>`;
                tooltipExtra = `<div style='color:#e040fb; font-size:10px; margin-top:2px; font-weight:bold;'>[훔쳐온 스킬: ${s.stolenDuration}턴 유지 / 사용 시 소멸]</div>`;
            }

            // ⭐ 1. 스킬 설명 가져오기
            let finalDesc = s.desc;
            if (!finalDesc || finalDesc.trim() === '') {
                if (typeof SKILL_DATABASE !== 'undefined' && SKILL_DATABASE !== null) {
                    if (s.id && SKILL_DATABASE[s.id]) {
                        finalDesc = SKILL_DATABASE[s.id].desc;
                    }
                }
            }
            if (!finalDesc || finalDesc.trim() === '') finalDesc = '상세 설명이 없습니다.';

            // ⭐ 2. HTML 렌더링 보호 및 데이터베이스 내 하드코딩된 색상 태그 무력화 (근본적 해결)
            // DB에 어두운 색상이나 빨간색 폰트 태그가 있으면 툴팁 CSS를 덮어쓰므로 해당 태그를 정규식으로 제거합니다.
            finalDesc = String(finalDesc)
                .replace(/\n/g, '<br>')
                .replace(/\r/g, '')
                .replace(/<font[^>]*>/gi, '') 
                .replace(/<\/font>/gi, '')
                .replace(/<span[^>]*style=["'][^"']*color:[^"']*["'][^>]*>/gi, '<span>');

            // ⭐ 3. (핵심) CSS 적용 보장 및 가독성 강화를 위해 !important와 텍스트 그림자(text-shadow) 추가.
            // 인라인 스타일 작성 시 쌍따옴표(")를 사용하여 브라우저 DOM 파싱 호환성을 극대화합니다.
            const tooltipStr = `<div style="color:#ffca28 !important; font-weight:bold; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">${s.name}</div>${tooltipExtra}<div style="color:#d7ccc8 !important; margin-top:6px; line-height:1.4; font-size:12px; opacity:1 !important; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">${finalDesc}</div>${materialTooltipHtml}<div class="cost-info" style="margin-top:8px; border-top:1px dashed #5d4037; padding-top:6px;"><span style="color:#90caf9 !important; font-weight:bold;">MP: ${s.mp||0}</span><span style="color:#ffcc80 !important; font-weight:bold;">WT: ${finalCost}</span></div>`;

            // ⭐ 4. 따옴표 치환
            const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');            
            const skillClickAttr = isDisabled ? '' : `onclick="event.stopPropagation(); window.battle.selectSkillFromFloat('${s.id}')"`;
            
            // ⭐ 5. 반환 객체 역시 불필요한 공백과 줄바꿈을 최소화하여 조립합니다.
            return `<div class="${cls}" ${skillClickAttr} data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()" style="display:flex; flex-direction:column; align-items:flex-start;"><div style="width:100%;"><span>${s.icon||'✨'}</span> ${nameDisplay}</div></div>`;
        };
        const active = this.activeMenuPath; 

        // ⭐ 3. 밀러 컬럼 방식으로 순차적 가로 렌더링 조립 (클래스 depth-* 로 계층 부여)
        
        // ⭐ 3. 밀러 컬럼 방식으로 순차적 가로 렌더링 조립 (클래스 depth-* 로 계층 부여)
        
        let depth0Html = `
            <div class="menu-col depth-0 custom-scrollbar">
                <div class="menu-btn ${hasMoved ? 'disabled' : ''} ${isMoveMode ? 'active' : ''}" onclick="event.stopPropagation(); window.battle.enterMoveMode()" onmouseenter="if(window.battle.ui.activeMenuPath[1]) { window.battle.ui.activeMenuPath.length = 1; window.battle.ui.updateFloatingControls(); }"><span>🚶 이동</span></div>
                <div class="menu-btn ${hasActed ? 'disabled' : ''} ${active[1] === 'act' ? 'active' : ''}" onclick="${hasActed ? '' : `event.stopPropagation(); window.battle.ui.toggleMenuNode('act', 1)`}" onmouseenter="${hasActed ? '' : `if(window.battle.ui.activeMenuPath[1] !== 'act') window.battle.ui.toggleMenuNode('act', 1)`}">
                    <span>⚡ 행동</span> <span style="font-size:10px; opacity:0.6;">▶</span>
                </div>
                <div class="menu-btn" onclick="event.stopPropagation(); window.battle.onTurnEndClick()" style="color:#e57373;" onmouseenter="if(window.battle.ui.activeMenuPath[1]) { window.battle.ui.activeMenuPath.length = 1; window.battle.ui.updateFloatingControls(); }"><span>🛑 대기</span></div>
                <div style="font-size:10px; color:#8d6e63; text-align:center; margin-top:2px; padding-top:4px; border-top:1px dashed #4e342e; pointer-events:none; font-family:var(--font-main); letter-spacing:-0.5px;">H:숨기기</div>
            </div>
        `;

        let depth1Html = '';
        if (active[1] === 'act') {
            depth1Html = `
                <div class="menu-col depth-1 custom-scrollbar">
                    <div class="menu-btn ${isAtkMode ? 'active' : ''}" onclick="event.stopPropagation(); window.battle.selectSkillFromFloat('basic')" onmouseenter="if(window.battle.ui.activeMenuPath[2]) { window.battle.ui.activeMenuPath.length = 2; window.battle.ui.updateFloatingControls(); }"><span>⚔️ 공격</span></div>
                    <div class="menu-btn ${active[2] === 'skill' ? 'active' : ''}" onclick="event.stopPropagation(); window.battle.ui.toggleMenuNode('skill', 2)" onmouseenter="if(window.battle.ui.activeMenuPath[2] !== 'skill') window.battle.ui.toggleMenuNode('skill', 2)">
                        <span>✨ 스킬</span> <span style="font-size:10px; opacity:0.6;">▶</span>
                    </div>
                    <div class="menu-btn ${active[2] === 'item' ? 'active' : ''}" onclick="event.stopPropagation(); window.battle.ui.toggleMenuNode('item', 2)" onmouseenter="if(window.battle.ui.activeMenuPath[2] !== 'item') window.battle.ui.toggleMenuNode('item', 2)">
                        <span>💊 아이템</span> <span style="font-size:10px; opacity:0.6;">▶</span>
                    </div>
                </div>
            `;
        }

        let depth2Html = '';
        if (active[2] === 'skill') {
            depth2Html = `<div class="menu-col depth-2 custom-scrollbar">`;
            if (skillsObjList.length > 0) {
                skillsObjList.forEach(s => {
                    if (s.isCategory) {
                        const isOpen = active[3] === 'CAT_' + s.name;
                        depth2Html += `
                            <div class="menu-btn ${isOpen ? 'active' : ''}" onclick="event.stopPropagation(); window.battle.ui.toggleMenuNode('CAT_${s.name}', 3)" onmouseenter="if(window.battle.ui.activeMenuPath[3] !== 'CAT_${s.name}') window.battle.ui.toggleMenuNode('CAT_${s.name}', 3)">
                                <span>📁 ${s.name}</span> <span style="font-size:10px; opacity:0.6;">▶</span>
                            </div>
                        `;
                    } else {
                        depth2Html += buildSkillBtn(s);
                    }
                });
            } else {
                depth2Html += `<div style="color:#bcaaa4; font-size:12px; font-weight:bold; text-align:center; padding:20px 10px;">스킬 없음</div>`;
            }
            depth2Html += `</div>`;
        } else if (active[2] === 'item') {
            depth2Html = `<div class="menu-col depth-2 custom-scrollbar">`;
            if (availableItems.length > 0) {
                availableItems.forEach(obj => {
                    const tooltipStr = `<div style='color:#ffca28;font-weight:bold;'>${obj.item.name}</div><div style='margin-top:4px;'>${obj.item.desc||''}</div>`;
                    const encodedTooltip = tooltipStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    // ⭐ 근본 해결: 엉뚱한 requestItemUse를 삭제하고, BattleSystem.js의 useItem과 직접 연결
                    depth2Html += `<div class="menu-btn ${hasActed ? 'disabled' : ''}" data-tip="${encodedTooltip}" onmouseenter="window.battle.ui.showTooltip(event, this.getAttribute('data-tip'))" onmouseleave="window.battle.ui.hideTooltip()" onclick="${hasActed ? '' : `event.stopPropagation(); window.battle.useItem(${obj.index})`}">
                        <span>${obj.item.icon||'💊'} ${obj.item.name}</span>
                    </div>`;
                });
            } else {
                depth2Html += `<div style="color:#bcaaa4; font-size:12px; font-weight:bold; text-align:center; padding:20px 10px;">아이템 없음</div>`;
            }
            depth2Html += `</div>`;
        }

        let depth3Html = '';
        if (active[2] === 'skill' && active[3] && active[3].startsWith('CAT_')) {
            const catName = active[3].replace('CAT_', '');
            const subSkills = u.skills.filter(sk => sk.category === catName && sk.type !== 'PASSIVE' && classLv >= (typeof TIER_REQ !== 'undefined' ? (TIER_REQ[sk.tier]||1) : 1));
            
            depth3Html = `<div class="menu-col depth-3 custom-scrollbar">`;
            if (subSkills.length > 0) {
                subSkills.forEach(sub => depth3Html += buildSkillBtn(sub));
            } else {
                depth3Html += `<div style="color:#bcaaa4; font-size:12px; font-weight:bold; text-align:center; padding:20px 10px;">스킬 없음</div>`;
            }
            depth3Html += `</div>`;
        }

        wrapper.innerHTML = `
            <div class="floating-menu-container" onpointerdown="event.stopPropagation();" onclick="event.stopPropagation();">
                ${codeDrawnBubbleTail}
                ${depth0Html}
                ${depth1Html}
                ${depth2Html}
                ${depth3Html}
            </div>
        `;

        setTimeout(() => {
            const el = document.getElementById('floating-controls');
            if (!el) return;
            const container = el.querySelector('.floating-menu-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    const shift = rect.right - window.innerWidth + 20; 
                    container.style.transform = `translateX(-${shift}px)`;
                } else {
                    container.style.transform = 'none';
                }
            }
        }, 10);
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
        
        // ⭐ [핵심 버그 수정] 오버레이(HP바)가 상태창을 뚫고 나오는 문제 근본 해결
        // 오버레이 컨테이너가 body에 붙어있으면 CSS 규칙 상 상태창 위로 올라갈 수밖에 없습니다.
        // 따라서 오버레이를 game-frame 내부로 옮기고 z-index를 낮춰 상태창(z-index: 99999) 밑으로 강제 편입시킵니다.
        if (this.overlayContainer.parentElement === document.body) {
            const gameFrame = document.getElementById('game-frame') || document.getElementById('scene-battle');
            if (gameFrame) {
                gameFrame.appendChild(this.overlayContainer);
                this.overlayContainer.style.zIndex = '50'; 
            }
        }

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

            const isFullyDead = u.curHp <= 0 && !u.isIncapacitated; 
            const isIncapacitated = u.curHp <= 0 && u.isIncapacitated;
            const displayIcon = isFullyDead ? '🪦' : (isIncapacitated ? `⏳${u.deathTimer || 0}` : u.icon);

            const pos = this.getUnitScreenPos(u);
            if (pos.x < -50 || pos.x > window.innerWidth + 50 || pos.y < -50 || pos.y > window.innerHeight + 50) return;
            
            let customOpacity = '1';
            let customFilter = 'none';
            let customGroundGlow = '';
            let hideBar = false;

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
                
                // ⭐ 이름표 완전 삭제, MP바 삭제, HP-WT 밀착(gap:0), WT 5분할 눈금 추가
                div.innerHTML = `
                    <div class="turn-highlight-wrap">${customGroundGlow}</div>
                    <div class="discovery-wrap"></div>
                    <div class="speech-wrap"></div>
                    <div class="dead-sprite-icon" style="display:${(isFullyDead || isIncapacitated) ? 'block' : 'none'}; font-size:24px; font-weight:bold; color:#ffdd00; text-align:center; background:rgba(0,0,0,0.6); padding:2px 6px; border-radius:6px; border:1px solid #ffdd00; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)); margin-bottom: 5px;">${displayIcon}</div>
                    
                    <div class="overlay-anchor-group" style="display:${(hideBar || isFullyDead) ? 'none' : 'flex'}; flex-direction:column; align-items:center; opacity: ${isFullyDead ? '0.6' : customOpacity}; filter: ${isFullyDead ? 'grayscale(100%)' : customFilter}; gap:0;">
                        <div class="status-row" style="display:none; gap:2px; margin-bottom:2px; flex-direction:row; justify-content:center; align-items:center;"></div>
                        
                        <div class="bar-group" style="width:36px; display:flex; flex-direction:column; gap:0; border:1px solid #1a1210; box-shadow:0 1px 3px rgba(0,0,0,0.8);">
                            <div class="hp-row" style="height:5px; background:#311; position:relative; border-bottom:1px solid rgba(0,0,0,0.5);">
                                <div class="hp-fill" style="height:100%; width:100%; background:${u.team===0?'#66bb6a':'#e57373'}; transition:width 0.2s;"></div>
                                <div class="shield-fill" style="height:100%; width:0%; position:absolute; top:0; left:0; background:rgba(255,255,255,0.4); transition:width 0.2s;"></div>
                            </div>
                            
                            <div class="ag-row" style="height:4px; background:#220; position:relative;">
                                <div class="ag-fill" style="height:100%; width:0%; background:#ffca28; transition:width 0.2s;"></div>
                                <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; pointer-events:none;">
                                    <div style="flex:1; border-right:1px solid rgba(0,0,0,0.8);"></div>
                                    <div style="flex:1; border-right:1px solid rgba(0,0,0,0.8);"></div>
                                    <div style="flex:1; border-right:1px solid rgba(0,0,0,0.8);"></div>
                                    <div style="flex:1; border-right:1px solid rgba(0,0,0,0.8);"></div>
                                    <div style="flex:1;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                this.overlayContainer.appendChild(div);

                div._hpFill = div.querySelector('.hp-fill');
                div._shieldFill = div.querySelector('.shield-fill');
                div._agFill = div.querySelector('.ag-fill');
                div._highlightWrap = div.querySelector('.turn-highlight-wrap');
                div._statusRow = div.querySelector('.status-row');
                div._speechWrap = div.querySelector('.speech-wrap');
                div._discoveryWrap = div.querySelector('.discovery-wrap');
                div._deadSpriteIcon = div.querySelector('.dead-sprite-icon'); 
                div._anchorGroup = div.querySelector('.overlay-anchor-group');
                
                this._overlayCache.set(uniqueId, div);
            }

            const finalX = pos.x + (UNIT_LEFT_OFFSET * currentScale);
            const finalY = pos.y - (UNIT_HEIGHT_OFFSET * currentScale);
            
            if (div.style.left !== finalX + 'px') div.style.left = finalX + 'px';
            if (div.style.top !== finalY + 'px') div.style.top = finalY + 'px';
            
            // ⭐ [버그 해결] 오버레이의 최대 Z-index를 8000 -> 800으로 대폭 낮춰 정보창(99999)을 절대 뚫고 오지 못하게 막음
            const newZIndex = (u === this.battle.currentUnit) ? '800' : Math.floor(finalY).toString();
            if (div.style.zIndex !== newZIndex) div.style.zIndex = newZIndex;
            
            if (div._deadSpriteIcon) {
                div._deadSpriteIcon.style.display = (isFullyDead || isIncapacitated) ? 'block' : 'none';
                div._deadSpriteIcon.innerHTML = displayIcon;
            }
            if (div._anchorGroup) {
                div._anchorGroup.style.display = (hideBar || isFullyDead) ? 'none' : 'flex';
                div._anchorGroup.style.opacity = isFullyDead ? '0.6' : customOpacity;
                div._anchorGroup.style.filter = isFullyDead ? 'grayscale(100%)' : customFilter;
            }

            const maxHp = u.hp || 1;
            const curHp = u.curHp || 0;
            const safeBuffs = u.buffs || []; 
            const shieldBuff = safeBuffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
            const shieldVal = shieldBuff ? shieldBuff.amount : 0;
            const totalMax = Math.max(maxHp, curHp + shieldVal);
            const hpPct = Math.floor((curHp / totalMax) * 100);
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
        UI.log(msg, type);
    }

    showFloatingText(u, txt, col) {
        UI.showFloatingText(u, txt, col);
    }
    updateCursor() {
        const v = document.getElementById('viewport'); 
        if(this.battle.selectedSkill) v.className = 'cursor-skill'; 
        else if(this.battle.hoverHex && this.battle.getUnitAt(this.battle.hoverHex.q, this.battle.hoverHex.r)?.team === 1) v.className = 'cursor-attack'; 
        else v.className = ''; 
    }
    destroy() {
        this._isDestroyed = true;
        this._cleanupDone = true;
        window.removeEventListener('resize', this.resizeHandler);
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = null;
        
        // ⭐ 클래스가 메모리에서 파괴될 때도 확실하게 이중 청소
        this.hideAllCombatUI(); 
    }

    hideAllCombatUI() {
        // ⭐ 1. 마을 UI(하단 패널 등)를 강제로 숨기고 있던 전체화면 CSS 완벽 삭제
        const styles = document.getElementById('force-fullscreen-styles');
        if (styles) styles.remove();

        // ⭐ 2. 주야간 필터, 항복 버튼, 그리고 body에 직접 붙은 지형 정보 패널까지 완벽하게 강제 삭제 (근본 해결)
        const removableIds = ['day-night-filter', 'warcraft-clock', 'surrender-btn-container', 'terrain-info-wrapper', 'exit-freeview-btn'];
        removableIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // ⭐ 3. 마우스 클릭을 가로채거나 화면을 가리는 전투 전용 플로팅 패널들 무력화
        const hideIds = [
            'floating-controls', 'status-panel', 'time-panel', 
            'turn-queue-panel', 'unit-overlays', 'sidebar-left', 
            'sidebar-right'
        ];
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.style.pointerEvents = 'none'; // 클릭 방해 속성 제거
            }
        });

        // ⭐ [버그 수정] 승리/패배 팝업 시 화면 중앙 하단을 가리는 기본 마을 UI(bottom-panel) 강제 숨김 처리 유지
        const bottomUI = document.getElementById('bottom-panel');
        if (bottomUI) {
            bottomUI.style.display = 'none';
            bottomUI.style.opacity = '0';
            bottomUI.style.pointerEvents = 'none';
        }
        
        // ⭐ [버그 수정] 전투 결과창(Victory/Defeat)이 다른 모든 UI 위에 올라오도록 z-index 최상단 부여
        const resultScreens = document.querySelectorAll('.battle-result-screen, #victory-screen, #defeat-screen, .reward-modal');
        resultScreens.forEach(screen => {
            if (screen) {
                screen.style.zIndex = '9999999'; 
            }
        });
    }
}