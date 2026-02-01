import { ELEMENTS, EFFECTS, STAGE_DATA, TERRAIN_TYPES, STAT_NAMES, CLASS_DATA, PERK_DATA, SKILL_DATABASE } from '../data/index.js';
import * as Formulas from '../utils/formulas.js';

const TIER_REQ = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 15 };

export class BattleSystem {
    constructor(grid, gameApp, chapter, stage, customParty = null) {
        this.grid = grid;
        this.gameApp = gameApp;
        this.chapter = Number(chapter);
        this.stage = Number(stage);
        this.confirmingItemSlot = null;
        this.customParty = customParty; 
        
        this.units = [];
        this.traps = []; 
        this.actionGaugeLimit = 100;
        
        this.currentUnit = null;
        this.viewingUnit = null; 
        this.selectedSkill = null;
        this.confirmingSkill = null;
        
        this.actions = { moved: false, acted: false };
        this.goldMod = 1.0;
        this.dropMod = 1.0;
        
        this.reachableHexes = []; 
        this.attackableHexes = []; 
        this.skillHexes = [];            
        this.hoverHex = null;
        this.textQueue = []; 
        this.projectiles = []; 
        this.isAnimating = false;
        this.isProcessingTurn = false;

        this.camera = { x: 0, y: 0 };
        this.isMouseDown = false;            
        this.isDraggingMap = false;    
        this.dragStart = { x: 0, y: 0 };
        this.dragCamStart = { x: 0, y: 0 };
        this.isAutoBattle = false;
        
        this.isBattleEnded = false;

        this.injectStyles();

        // [중요] 키보드 이벤트 핸들러 바인딩 (에러 방지)
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.handleKeyDown);
        
        // ResizeObserver 안전장치 추가
        this.resizeObserver = new ResizeObserver(() => {
            if(this.gameApp && this.gameApp.renderer && this.gameApp.renderer.canvas) {
                this.handleResize();
            }
        });
        
        if (this.grid && this.grid.canvas && this.grid.canvas.parentElement) {
            this.resizeObserver.observe(this.grid.canvas.parentElement);
        }

        // 오버레이 컨테이너 (중복 생성 방지)
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

        this.initUnits(chapter, stage);
        
        // 초기화 시점 안전장치
        setTimeout(() => {
            this.handleResize(); 
            this.centerCameraOnHeroes(); 
        }, 100);
        
        this.processTextQueue(); 
        this.renderUnitOverlaysLoop();
        this.nextTurn(); 
        this.bindEvents();
        
    }
    // battle.js - handleKeyDown 수정

    handleKeyDown(e) {
        if (this.isProcessingTurn || this.isBattleEnded) return;
        
        // 채팅창 등 입력 중이면 무시
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // [신규] H키: HUD 숨기기 토글
        if (e.key === 'h' || e.key === 'H') {
            window.isHudHidden = !window.isHudHidden;
            this.updateFloatingControls(); // 즉시 반영
            return; 
        }

        // Space: 턴 종료
        if (e.code === 'Space') {
            e.preventDefault();
            this.onTurnEndClick();
        }
        
        // M: 이동 모드
        if (e.key === 'm' || e.key === 'M') {
            this.onMoveClick();
        }

        // 숫자키 1~5: 스킬 단축키
        if (['1','2','3','4','5'].includes(e.key)) {
            const idx = parseInt(e.key) - 1;
            const activeSkills = (this.currentUnit?.skills || []).filter(s => s.type !== 'PASSIVE');
            // 스킬 선택 로직과 연동 (필요 시 구현)
             if (activeSkills[idx]) {
                const btn = document.querySelector(`.skill-btn[data-skill-id="${activeSkills[idx].id}"]`);
                if(btn) btn.click();
            }
        }
    }

    // battle.js - useItem 메서드 수정 (confirm 제거)

    useItem(slotIndex) {
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted) return;

        const slotKey = `potion${slotIndex + 1}`;
        let item = null;

        if (u.equipment && u.equipment[slotKey]) {
            const itemId = u.equipment[slotKey];
            if (this.gameApp.itemData) item = this.gameApp.itemData[itemId];
        } 
        else if (slotIndex === 0 && u.potion) {
            item = u.potion;
        }

        if (!item) {
            this.log("사용할 아이템이 없습니다.", "log-system");
            return;
        }

        // [수정] confirm 제거함. 즉시 실행.
        const itemSkill = {
            name: item.name,
            type: 'ITEM',
            target: 'SELF',
            mp: 0,
            cost: 50,
            rng: 0,
            icon: item.icon,
            main: { 
                type: item.effect || 'HEAL_PERCENT', 
                val: item.val || 0.3,
                target: 'SELF'
            }
        };
        
        this.selectedSkill = itemSkill;

        this.tryExecuteSkill(u, u).then(() => {
            if (u.equipment && u.equipment[slotKey]) {
                u.equipment[slotKey] = null;
            } else if (slotIndex === 0 && u.potion) {
                u.potion = null;
            }
            this.selectedSkill = null; 
            this.updateStatusPanel();
            this.updateFloatingControls();
        });
    }
    // [신규] 아이템 사용 요청 (V/X 팝업 띄우기)
    requestItemUse(slotIndex) {
        if (this.currentUnit.team !== 0 || this.actions.acted || this.isProcessingTurn) return;
        
        // 이미 열려있으면 닫기, 아니면 열기
        if (this.confirmingItemSlot === slotIndex) {
            this.cancelItem();
        } else {
            this.confirmingItemSlot = slotIndex;
            this.updateStatusPanel(); // UI 갱신 (팝업 표시)
        }
    }

    // [신규] 아이템 사용 취소 (X 버튼)
    cancelItem() {
        this.confirmingItemSlot = null;
        this.updateStatusPanel();
    }

    // [신규] 아이템 실제 사용 (V 버튼)
    executeItem(slotIndex) {
        this.confirmingItemSlot = null;
        this.useItem(slotIndex); // 수정된 useItem 호출
        this.updateStatusPanel();
    }

    // [신규] 플로팅 컨트롤에서 스킬 선택
    selectSkillFromFloat(sId) {
        const u = this.currentUnit;
        if (!u) return;
        const skill = u.skills.find(s => s.id === sId);
        if (!skill) return;

        if (u.curMp < skill.mp) {
            this.log("마나가 부족합니다.", "log-system");
            return;
        }

        // 같은거 누르면 취소, 아니면 선택
        if (this.selectedSkill === skill) {
            this.selectedSkill = null;
        } else {
            this.selectedSkill = skill;
            this.log(`[${skill.name}] 선택`, 'log-system');
        }

        // 모든 UI 갱신 (선택 상태 반영)
        this.updateFloatingControls(); 
        this.updateStatusPanel();
        this.updateCursor();
    }

    // [수정] 이벤트 바인딩 (ESC 키 핸들러 포함)
    bindEvents() {
        this.grid.canvas.onmousedown = (e) => this.handleMouseDown(e);
        this.grid.canvas.onmousemove = (e) => this.handleMouseMove(e);
        this.grid.canvas.onmouseup = (e) => this.handleMouseUp(e);
        this.grid.canvas.onmouseleave = () => { 
             this.isMouseDown = false;
             this.isDraggingMap = false; 
             this.hideTooltip(); 
        };
        this.grid.canvas.onwheel = (e) => this.handleWheel(e);
        
        // [신규] ESC 키로 스킬 취소
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.selectedSkill || this.confirmingSkill) {
                    this.log("스킬 선택 취소", "log-system");
                    this.selectedSkill = null;
                    this.confirmingSkill = null;
                    this.updateCursor();
                    this.updateStatusPanel();
                    this.updateFloatingControls();
                } else if (this.viewingUnit !== this.currentUnit) {
                    // 내 턴일 때 다른 유닛 보고 있으면 내 유닛으로 복귀
                    if (this.currentUnit && this.currentUnit.team === 0) {
                        this.viewingUnit = this.currentUnit;
                        this.updateStatusPanel();
                    }
                }
            }
            this.handleKeyDown(e); // 기존 핸들러도 호출
        });
        window.battle = this; 
    }

    // [누락 복구] 이동 가능 범위 계산
    calcReachable() {
        this.reachableHexes = [];
        if(this.actions.moved) return;

        let frontier = [{q:this.currentUnit.q, r:this.currentUnit.r}];
        let cost = new Map();
        cost.set(`${this.currentUnit.q},${this.currentUnit.r}`, 0);
        
        const moveRange = Formulas.getDerivedStat(this.currentUnit, 'mov');

        while(frontier.length > 0) {
            let cur = frontier.shift();
            this.grid.getNeighbors(cur).forEach(n => {
                const k = `${n.q},${n.r}`;
                if (!this.grid.hexes.has(k)) return;

                const tKey = this.grid.getTerrain(n.q, n.r);
                const tInfo = TERRAIN_TYPES[tKey] || TERRAIN_TYPES['GRASS_01'];
                const tileCost = tInfo.cost || 1;

                if (tileCost >= 99) return;

                const uAt = this.getUnitAt(n.q, n.r);
                if (!uAt || uAt === this.currentUnit) {
                    let newCost = cost.get(`${cur.q},${cur.r}`) + tileCost;
                    
                    if(newCost <= moveRange && (!cost.has(k) || newCost < cost.get(k))) {
                        cost.set(k, newCost);
                        frontier.push(n);
                        this.reachableHexes.push(n);
                    }
                }
            });
        }
    }

    // --------------------------------------------------------------------------------
    // 초기화 및 유닛 관리
    // --------------------------------------------------------------------------------

    initUnits(chapter, stage) {
        let idCounter = 1;
        const occupied = new Set();
        let myTeamData = [];
        
        if (this.customParty && this.customParty.length > 0) {
            myTeamData = this.customParty;
        } else {
            const allHeroes = this.gameApp.gameState.heroes;
            myTeamData = allHeroes.length > 0 ? allHeroes.slice(0, 6).map(h => ({ hero: h, q: null, r: null })) : [];
        }

        const HERO_BASE_COL = 7;
        const ENEMY_BASE_COL = 14;

        const spawn = (entryData, team, fixedQ = null, fixedR = null) => {
            let unit = (team === 0) ? entryData.hero : JSON.parse(JSON.stringify(entryData));
            
            if (unit.skillIds) {
                unit.skills = unit.skillIds.map(id => {
                    const s = SKILL_DATABASE[id];
                    if (!s) return null;
                    return JSON.parse(JSON.stringify({ ...s, id: id }));
                }).filter(s => s !== null);
            } else if (!unit.skills) {
                unit.skills = [];
            }

            let q, r;
            if (fixedQ != null && fixedR != null) {
                q = Number(fixedQ); r = Number(fixedR);
            } else {
                let col, row;
                if (team === 0) {
                    col = HERO_BASE_COL;
                    const rowOffsets = [0, 1, -1, 2, -2, 3];
                    const rowIdx = (idCounter - 1) % rowOffsets.length;
                    row = 6 + rowOffsets[rowIdx];
                } else {
                    col = ENEMY_BASE_COL;
                    const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4];
                    const rowIdx = (idCounter - 1) % rowOffsets.length;
                    row = 6 + rowOffsets[rowIdx];
                }
                q = col - (row - (row & 1)) / 2;
                r = row;
            }

            while (occupied.has(`${q},${r}`)) { r++; }
            occupied.add(`${q},${r}`);

            unit.q = q; unit.r = r;
            unit.facing = team === 0 ? 0 : 3;
            unit.buffs = [];
            if (!unit.perks) unit.perks = {};
            unit.id = idCounter++;
            unit.team = team;
            unit.shake = 0; unit.bumpX = 0; unit.bumpY = 0;
            unit.stageActionXp = 0;

            unit.hp = Formulas.getDerivedStat(unit, 'hp_max', true);
            unit.mp = Formulas.getDerivedStat(unit, 'mp_max', true);

            if (team === 0) {
                unit.curHp = (unit.curHp !== undefined && !isNaN(unit.curHp)) ? Math.min(unit.curHp, unit.hp) : unit.hp;
                unit.curMp = (unit.curMp !== undefined && !isNaN(unit.curMp)) ? Math.min(unit.curMp, unit.mp) : unit.mp;
            } else {
                unit.curHp = unit.hp;
                unit.curMp = unit.mp;
            }

            const spd = Formulas.getDerivedStat(unit, 'spd');
            unit.actionGauge = Math.min(50, spd * 0.5);

            this.units.push(unit);
        };

        myTeamData.forEach(d => spawn(d, 0, d.q, d.r));

        const stageInfo = STAGE_DATA[chapter] && STAGE_DATA[chapter][stage];
        if (stageInfo && stageInfo.enemies) {
            stageInfo.enemies.forEach(raw => {
                let entry = raw;
                let count = 1;
                if (entry.includes('*')) {
                    const p = entry.split('*');
                    entry = p[0];
                    count = parseInt(p[1]) || 1;
                }
                
                let key = entry;
                let q = null;
                let r = null;
                
                if (entry.includes(':')) {
                    const p = entry.split(':');
                    key = p[0];
                    q = Number(p[1]);
                    r = Number(p[2]);
                }
                
                key = key.trim().toUpperCase().replace(/,/g, '');
                
                if (CLASS_DATA[key]) {
                    for (let i = 0; i < count; i++) spawn(CLASS_DATA[key], 1, q, r);
                }
            });
        } else {
            if (CLASS_DATA['SLIME']) spawn(CLASS_DATA['SLIME'], 1);
        }
    }

    spawnUnit(key, team, q, r) {
        if (this.getUnitAt(q, r)) return;
        
        let data = CLASS_DATA[key];
        if (!data) {
            if (key === 'DECOY') data = { name: '미끼', icon: '🤡', hp: 50, mp: 0, str:0, int:0, vit:0, agi:0, dex:0, vol:0, luk:0, def:0, spd:10, skills:[] };
            else if (key === 'WALL_STONE') data = { name: '돌벽', icon: '🧱', hp: 100, mp: 0, str:0, int:0, vit:0, agi:0, dex:0, vol:0, luk:0, def:50, spd:1, skills:[] };
            else return;
        }

        const unit = JSON.parse(JSON.stringify(data));
        unit.id = 9000 + this.units.length + Math.floor(Math.random()*1000);
        unit.team = team;
        unit.q = q; unit.r = r;
        unit.facing = team === 0 ? 0 : 3;
        
        unit.hp = Formulas.getDerivedStat(unit, 'hp_max', true);
        unit.mp = Formulas.getDerivedStat(unit, 'mp_max', true);
        unit.curHp = unit.hp; unit.curMp = unit.mp;
        unit.actionGauge = 0; 
        unit.buffs = [];
        unit.equipment = {};
        unit.isSummon = true; 

        this.units.push(unit);
        this.log(`${unit.name} 소환!`, 'log-skill');
        this.triggerShakeAnimation(unit);
        this.renderPartyList();
    }

    // --------------------------------------------------------------------------------
    // 턴 및 흐름 제어
    // --------------------------------------------------------------------------------

    checkBattleEnd() {
        const enemies = this.units.filter(u => u.team === 1 && u.curHp > 0).length;
        const allies = this.units.filter(u => u.team === 0 && u.curHp > 0).length;
        if (enemies === 0) {
            if(!this.isBattleEnded) {
                this.isBattleEnded = true;
                setTimeout(() => this.gameApp.onBattleEnd(true), 500);
            }
            return true;
        }
        if (allies === 0) {
            if(!this.isBattleEnded) {
                this.isBattleEnded = true;
                setTimeout(() => this.gameApp.onBattleEnd(false), 500);
            }
            return true;
        }
        return false;
    }

    nextTurn() {
        if (this.checkBattleEnd()) return;

        let ready = this.units.filter(u => u.curHp > 0 && u.actionGauge >= this.actionGaugeLimit);
        
        if (ready.length > 0) {
            ready.sort((a, b) => b.actionGauge - a.actionGauge);
            this.currentUnit = ready[0];
            
            if (this.currentUnit.actionGauge > this.actionGaugeLimit * 2) {
                this.currentUnit.actionGauge = this.actionGaugeLimit;
            }
            this.startTurnLogic();
        } else {
            let minTick = Infinity;
            this.units.forEach(u => {
                if (u.curHp <= 0) return;
                let spd = Formulas.getDerivedStat(u, 'spd');
                if (spd <= 0) spd = 1;
                
                if (this.hasStatus(u, 'SHOCK')) return;

                const needed = (this.actionGaugeLimit - u.actionGauge) / spd;
                if (needed < minTick) minTick = needed;
            });

            if (minTick === Infinity || minTick < 0) minTick = 1;

            this.units.forEach(u => {
                if (u.curHp > 0 && !this.hasStatus(u, 'SHOCK')) {
                    let spd = Formulas.getDerivedStat(u, 'spd');
                    if (spd <= 0) spd = 1;
                    u.actionGauge += spd * minTick;
                }
            });
            
            requestAnimationFrame(() => this.nextTurn());
        }
    }

    startTurnLogic() {
        if (this.currentUnit.curHp <= 0) { this.endTurn(); return; }

        this.isProcessingTurn = true;
        this.log(`▶ ${this.currentUnit.name}의 턴`, 'log-turn');
        
        this.regenResources(this.currentUnit);
        this.viewingUnit = this.currentUnit;
        this.actions = { moved: false, acted: false };
        this.selectedSkill = null;
        this.confirmingSkill = null;

        if (this.currentUnit.skills) {
            const gaugePassive = this.currentUnit.skills.find(s => s.type === 'PASSIVE' && (s.main?.type === 'PASSIVE_GAUGE' || s.sub?.type === 'PASSIVE_GAUGE'));
            if (gaugePassive) {
                this.currentUnit.actionGauge += 10; 
            }
        }

        let skipTurn = false;
        
        for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
            const b = this.currentUnit.buffs[i];
            const info = EFFECTS[b.type];

            if (['CC_STUN', 'CC_FREEZE', 'CC_SLEEP', 'CC_FEAR', 'CC_CHARM'].includes(b.type)) {
                this.log(`${this.currentUnit.name}: [${info.name}] 행동 불가!`, 'log-cc');
                this.showFloatingText(this.currentUnit, info.name, '#ff00ff');
                skipTurn = true;
            }
            if (b.type === 'STATUS_BURN') {
                let dmg = Math.max(1, Math.floor(b.val * 10) || 5); 
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                this.log(`🔥 화상: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, '#ff8800');
            } else if (b.type === 'STATUS_POISON') {
                let dmg = Math.floor(this.currentUnit.hp * 0.05); dmg = Math.max(1, dmg);
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                this.log(`☠️ 맹독: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, '#88ff00');
            }   
                if (b.type === 'HEAL_REGEN') {
      // 최대 체력의 10% * 계수만큼 회복
      const healAmt = Math.floor(this.currentUnit.hp * 0.1 * (b.val || 1));
     this.currentUnit.curHp = Math.min(this.currentUnit.hp, this.currentUnit.curHp + healAmt);
     this.showFloatingText(this.currentUnit, `+${healAmt}`, '#5f5');
     this.log(`🌿 재생: +${healAmt}`, 'log-heal');

            }
            b.duration--;
            if (b.duration <= 0) {this.currentUnit.buffs.splice(i, 1);
        }
    }

        if (this.currentUnit.curHp <= 0) { 
            this.handleDeath(this.currentUnit); 
            this.endTurn(); 
            return; 
        }

        if (skipTurn) { 
            this.updateStatusPanel(); 
            this.renderPartyList(); 
            
            // [수정] 스턴 등으로 턴 스킵 시에도 게이지 차감 (50)
            this.currentUnit.actionGauge -= 50; 
            
            setTimeout(() => this.endTurn(), 800); 
            return; 
        }

        if (this.hasStatus(this.currentUnit, 'SHOCK')) {
             this.log("⚡ 감전 상태! 행동력 회복 불가.", "log-cc");
        }

        if (Formulas.getDerivedStat(this.currentUnit, 'mov') <= 0) {
            this.actions.moved = true; 
            this.log("이동 불가 상태.");
        } else {
            this.calcReachable();
        }

        this.updateStatusPanel();
        this.renderPartyList();
        this.updateCursor();
        
        if (this.currentUnit.team === 0) {
    this.isProcessingTurn = false; // 조작 잠금 해제
    this.updateFloatingControls(); // 컨트롤 생성
    this.updateStatusPanel();      // UI 갱신
}

        if (this.currentUnit.team === 1) { this.runAI(); } 
        else {
            if (this.hasStatus(this.currentUnit, 'CC_CONFUSE')) {
                this.log(`😵 ${this.currentUnit.name} 혼란 상태!`, 'log-cc');
                this.runAI(); 
            } else {
                this.isProcessingTurn = false; 
                this.renderUI();
                this.updateFloatingControls();
                if (this.isAutoBattle) setTimeout(() => this.runAllyAutoAI(), 300);
            }
        }
    }

    endTurn(manual = false) { 
    const f = document.getElementById('floating-controls'); 
    if(f) f.remove(); 
    
    this.isProcessingTurn = true; 
    
    // --- 행동 게이지 소모 로직 적용 ---
    if (this.actions.acted) {
        // 1. 스킬(행동)을 시전함: 추가 소모 없음 (이미 스킬 cost가 차감됨)
        this.log(`${this.currentUnit.name} 행동 완료.`, 'log-system');
    } 
    else if (this.actions.moved) {
        // 2. 이동만 하고 마침: 행동력 -20
        this.currentUnit.actionGauge -= 20;
        this.log(`${this.currentUnit.name} 이동 후 대기 (-20 AG)`, 'log-system');
    } 
    else {
        // 3. 아무 행동/이동 없이 마침: 행동력 -50
        this.currentUnit.actionGauge -= 50;
        this.log(`${this.currentUnit.name} 즉시 대기 (-50 AG)`, 'log-system');
    }
    // --------------------------------

    // 다음 턴을 위해 액션 상태 초기화
    this.actions = { moved: false, acted: false }; 
    
    setTimeout(() => this.nextTurn(), 100); 
}

    // --------------------------------------------------------------------------------
    // 이동 및 함정
    // --------------------------------------------------------------------------------

    placeTrap(q, r, type, casterId) {
        const existIdx = this.traps.findIndex(t => t.q === q && t.r === r);
        if (existIdx !== -1) this.traps.splice(existIdx, 1);

        this.traps.push({ q, r, type, casterId, duration: 99 });
        this.showFloatingText({q, r}, "TRAP SET", "#aaa");
        this.log("함정 설치 완료", 'log-skill');
    }

    async moveUnit(unit, q, r, cb) {
        const path = this.grid.findPath({q:unit.q, r:unit.r}, {q, r}, nh => {
            const uAt = this.units.find(target => 
                target.q === nh.q && target.r === nh.r && target.curHp > 0
            );
            return !uAt || uAt === unit;
        });
        
        if (path.length === 0) { if(cb) cb(); return; }
        
        this.isAnimating = true;
        
        // [신규] 이동 거리만큼 게이지 차감 (1칸당 2)
        const moveCost = Math.max(0, path.length - 2);
        unit.actionGauge -= moveCost;
        if(unit.team === 0) this.log(`이동 소모: ${moveCost}`, 'log-system');

        for (let s of path) {
            const dir = this.grid.getDirection({q: unit.q, r: unit.r}, s);
            unit.facing = dir;
            unit.q = s.q; unit.r = s.r;
            
            if (this.hasStatus(unit, 'STATUS_BLEED')) {
                let dmg = Math.max(1, Math.floor(unit.hp * 0.05));
                unit.curHp = Math.max(0, unit.curHp - dmg);
                this.showFloatingText(unit, `🩸-${dmg}`, '#ff0000');
                if (unit.curHp <= 0) { this.handleDeath(unit); break; }
            }

            const trapIdx = this.traps.findIndex(t => t.q === s.q && t.r === s.r && t.casterId !== unit.id);
            if (trapIdx !== -1) {
                const trap = this.traps[trapIdx];
                this.traps.splice(trapIdx, 1); 
                
                this.log(`${unit.name} 함정 발동!`, 'log-dmg');
                this.showFloatingText(unit, "TRAP!", "#f00");
                this.triggerShakeAnimation(unit);

                if (trap.type === 'TRAP_STUN') {
                    unit.curHp = Math.max(0, unit.curHp - 20);
                    this.showFloatingText(unit, "-20", "#f55");
                    this.applyStatus(unit, { type: 'CC_STUN', duration: 1, val: 1 }, {id: trap.casterId});
                }
                break;
            }
            
            if (unit === this.currentUnit) {
                this.updateFloatingControls();
            }

            await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        this.isAnimating = false;
        this.actions.moved = true; 
        this.calcReachable();
        this.updateStatusPanel();
        if(cb) cb();
    }

    // --------------------------------------------------------------------------------
    // 스킬 및 전투 로직
    // --------------------------------------------------------------------------------

    async tryExecuteSkill(targetHex, targetUnit) {
        if (this.hasStatus(this.currentUnit, 'CC_SILENCE')) {
            this.log("😶 침묵 상태입니다!", "log-cc");
            return;
        }

        const baseSkill = this.selectedSkill;
        if (!baseSkill) return;

        const skill = this.applyPerks(baseSkill, this.currentUnit);
        
        // [타겟 상속 로직]
        if (skill.main) { 
            if(!skill.main.target) skill.main.target = skill.target; 
            if(skill.main.area === undefined) skill.main.area = skill.area; 
        }
        if (skill.sub) { 
            if(!skill.sub.target) skill.sub.target = skill.target; 
            if(skill.sub.area === undefined) skill.sub.area = skill.area; 
        }

        if (this.currentUnit.curMp < skill.mp) {
            this.log("MP가 부족합니다!", "log-system");
            return;
        }

        let effectiveTarget = targetHex;
        if (!effectiveTarget) {
            const tType = skill.main.target;
            if (['SELF', 'ALLY_ALL'].includes(tType) || 
               (tType === 'AREA_ENEMY' && (skill.main.area||0) >= 99) ||
               skill.rng === 0) {
                effectiveTarget = this.currentUnit;
            }
        }

        const isGlobalSkill = ['SELF', 'ALLY_ALL'].includes(skill.main.target) || 
                              (skill.main.target === 'AREA_ENEMY' && (skill.main.area||0) >= 99);

        if (!isGlobalSkill && skill.main.type !== 'RESURRECT' && !skill.main.type.startsWith('SUMMON') && !effectiveTarget) return;

        if (!isGlobalSkill && effectiveTarget) {
             const dist = this.grid.getDistance(this.currentUnit, effectiveTarget);
             const rngBonus = Formulas.getStat(this.currentUnit, 'rng');
             if (dist > skill.rng + rngBonus) { this.log("사거리 밖입니다.", "log-system"); return; }
        }

        const doubleCastBuff = this.currentUnit.buffs.find(b => b.type === 'BUFF_DOUBLE_CAST');
        let castCount = 1;
        if (doubleCastBuff) {
            castCount = 2;
            this.log("⏩ 이중 시전 발동!", 'log-skill');
            this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b !== doubleCastBuff);
            this.updateStatusPanel();
        }

        for(let c = 0; c < castCount; c++) {
            if (c > 0) {
                await new Promise(r => setTimeout(r, 500));
                this.log("⏩ 연속 시전!", 'log-skill');
            }

            if (c === 0) {
                this.currentUnit.curMp -= skill.mp;
                let costRed = Formulas.getDerivedStat(this.currentUnit, 'cost_red');
                if (!costRed || costRed <= 0) costRed = 1.0; 
                const consume = Math.floor((skill.cost || 50) * costRed); 
                this.currentUnit.actionGauge -= consume;
                
                this.actions.acted = true;
                if (this.currentUnit.team === 0) this.gainActionXp(this.currentUnit, 10);
                
                this.log(`${this.currentUnit.name} [${skill.name}] 시전!`, 'log-skill');
                this.showSpeechBubble(this.currentUnit, skill.name);
            }
            
            if (effectiveTarget && effectiveTarget !== this.currentUnit) {
                const dir = this.grid.getDirection(this.currentUnit, effectiveTarget);
                this.currentUnit.facing = dir;
            }

            if (c === 0 && skill.moveType === 'DASH' && targetUnit && targetUnit !== this.currentUnit) {
                await this.playDashAnimation(this.currentUnit, targetUnit);
            }

            const combatOptions = {};
            let skipSub = false;

            if (skill.sub) {
                const t = skill.sub.type;
                const v = skill.sub.val || 1;
                
                if (t === 'ATK_SUREHIT') { combatOptions.sureHit = true; skipSub = true; }
                if (t === 'ATK_PENETRATE') { combatOptions.penetrate = v; skipSub = true; }
                if (t === 'ATK_EXECUTE') { combatOptions.execute = v; skipSub = true; }
                if (t === 'ATK_MOVE') { 
                    if (effectiveTarget) {
                        const dist = this.grid.getDistance(this.currentUnit, effectiveTarget);
                        combatOptions.distBonus = dist * (v || 0.1); 
                    }
                    skipSub = true; 
                }
                if (t === 'COST_HP') {
                    if (c === 0) {
                        const hpCost = Math.floor(this.currentUnit.hp * v);
                        this.currentUnit.curHp = Math.max(1, this.currentUnit.curHp - hpCost);
                        this.showFloatingText(this.currentUnit, `HP -${hpCost}`, '#f00');
                    }
                    skipSub = true;
                }
            }

            await this.processEffect(skill.main, effectiveTarget, targetUnit, this.currentUnit, combatOptions);
            
            if (skill.sub && !skipSub) {
                await new Promise(r => setTimeout(r, 300));
                await this.processEffect(skill.sub, effectiveTarget, targetUnit, this.currentUnit, combatOptions);
            }
        }

        if(this.currentUnit.team === 0) { 
            this.selectedSkill = null; // 선택 해제 -> 플로팅 투명화 해제
            this.updateStatusPanel(); 
            this.updateFloatingControls(); // 다시 그려서 나타나게 함
        }
        this.updateCursor();
    }

    async processEffect(eff, targetHex, clickedUnit, caster, options = {}) {
        if (eff.type === 'RESURRECT' || eff.type === 'REVIVE') {
            let deadAllies = this.units.filter(u => u.team === caster.team && u.curHp <= 0);
            if (deadAllies.length === 0) { this.log("대상 없음", "log-system"); return; }
            deadAllies.forEach(t => {
                t.curHp = Math.floor(t.hp * (eff.val || 0.3));
                this.showFloatingText(t, "REVIVE!", "#ffdd00");
                this.log(`✨ ${t.name} 부활!`, 'log-heal');
            });
            this.renderPartyList();
            return; 
        }

        let targets = this.collectTargets(eff, targetHex, clickedUnit, caster);

        if (targets.length === 0) { 
            if (eff.type.startsWith('SUMMON')) {
                if (targetHex && !this.getUnitAt(targetHex.q, targetHex.r)) {
                    const key = eff.type === 'SUMMON_WALL' ? 'WALL_STONE' : 'DECOY';
                    this.spawnUnit(key, caster.team, targetHex.q, targetHex.r);
                } else this.log("소환 공간 부족", 'log-system');
                return;
            }
            if (eff.type.startsWith('TRAP')) {
                if (targetHex) this.placeTrap(targetHex.q, targetHex.r, eff.type, caster.id);
                return;
            }
            if (eff.type === 'MOVE_TELEPORT') {
                if (targetHex && !this.getUnitAt(targetHex.q, targetHex.r)) {
                    caster.q = targetHex.q; caster.r = targetHex.r;
                    this.triggerShakeAnimation(caster);
                    this.log("순간이동!", 'log-skill');
                }
                return;
            }
            if (eff.type.startsWith('ECON') || eff.type.startsWith('UTIL')) {
                // UTIL 스킬이라도 대상을 못 찾으면 시전자에게 피드백을 주기 위해 추가
                targets.push(caster);
            }
        }
        
        for (const t of targets) {
            // [안전장치] 타겟이 이미 죽었으면 효과 적용 스킵 (부활 제외)
            if (t.curHp <= 0) continue;

            const type = eff.type;
            const val = (eff.val !== undefined) ? eff.val : (eff.mult || 1); 

            if (type.startsWith('DMG') || type.startsWith('ATK') || type.includes('DRAIN')) {
                if (['ATK_SUREHIT', 'ATK_PENETRATE', 'ATK_EXECUTE', 'ATK_MOVE'].includes(type)) continue;

                // [신규] 방어 비례 공격력 (ATK_DEF_SCALE)
                if (type === 'ATK_DEF_SCALE') {
                    options.defScaleBonus = val; 
                    await this.performAttack(caster, t, 1.0, "강타", false, caster.atkType, 1, options);
                    delete options.defScaleBonus; 
                    continue;
                }

                let dmgType = 'PHYS';
                if (type.includes('MAG')) dmgType = 'MAG';
                else if (type.includes('HOLY')) dmgType = 'HOLY';
                else if (type.includes('DARK')) dmgType = 'DARK';
                else if (caster.atkType) dmgType = caster.atkType;

                const isDrain = type.includes('DRAIN');
                const hitCount = (type === 'ATK_MULTI') ? val : 1;
                let finalMult = (type === 'ATK_MULTI') ? 1.0 : val;
                if (options.distBonus) finalMult += options.distBonus;

                if (type === 'ATK_CHAIN') {
                    const chainCount = val || 2;
                    let currentTarget = t;
                    let visited = [t.id];
                    await this.performAttack(caster, t, 1.0, "체인", false, 'MAG', 1, options);
                    for (let i = 1; i < chainCount; i++) {
                        await new Promise(r => setTimeout(r, 200));
                        const nextTarget = this.units
                            .filter(u => u.team === t.team && u.curHp > 0 && !visited.includes(u.id))
                            .sort((a, b) => this.grid.getDistance(currentTarget, a) - this.grid.getDistance(currentTarget, b))[0];
                        if (nextTarget && this.grid.getDistance(currentTarget, nextTarget) <= 3) {
                            visited.push(nextTarget.id);
                            currentTarget = nextTarget;
                            this.createProjectile(caster, nextTarget);
                            const chainMult = Math.pow(0.8, i);
                            this.log(`⚡ 체인 전이!`, 'log-skill');
                            await this.performAttack(caster, nextTarget, chainMult, "전이", false, 'MAG', 1, options);
                        } else break;
                    }
                } else {
                    await this.performAttack(caster, t, finalMult, "스킬", isDrain, dmgType, hitCount, options);
                }
            }
            // ----------------------------------------------------------------
            // [수정] 힐 로직: 타입에 따라 계산 방식 완전 분리 (HEAL_HP vs HEAL_PERCENT)
            // ----------------------------------------------------------------
            else if (type.startsWith('HEAL')) {
                let amt = 0;

                // [Type A] 체력 퍼센트 회복 (HEAL_PERCENT) - 몬스터 재생, 포션 등
                // 엑셀에서 Type을 'HEAL_PERCENT'로 지정해야 작동 (val 0.2 = 20%)
                if (type === 'HEAL_PERCENT') {
                    amt = Math.floor(t.hp * val); 
                    this.log(`[System] % 회복: ${amt} (MaxHP의 ${Math.floor(val*100)}%)`, 'log-system');
                }
                // [Type B] 완전 회복 (HEAL_FULL) - 부활, 풀포션
                else if (type === 'HEAL_FULL') {
                    amt = t.hp;
                }
                // [Type C] 일반 힐 (HEAL_HP, HEAL_MAG) - 영웅/힐러 스킬 (마법공격력 비례)
                else {
                    let power = Formulas.getDerivedStat(caster, 'atk_mag');
                    // 안전장치: 마공이 0이거나 없을 경우 레벨 기반 최소치 보장
                    if (!power || power <= 0) power = Math.max(1, caster.level * 2);
                    
                    amt = Math.floor(power * val); 
                }

                // [공통] 중독 상태면 힐량 50% 감소
                if (this.hasStatus(t, 'POISON')) amt = Math.floor(amt * 0.5); 
                
                // [공통] 치유량 증폭 패시브 적용 (시전자가 힐러일 때)
                if (caster.skills) {
                    caster.skills.forEach(s => {
                        if (s.type === 'PASSIVE' && (s.main?.type === 'PASSIVE_HEAL_POWER')) amt *= s.main.val;
                    });
                }

                amt = Math.floor(amt);
                const oldHp = t.curHp;
                t.curHp = Math.min(t.hp, t.curHp + amt);
                const realHeal = t.curHp - oldHp;

                this.showFloatingText(t, `+${realHeal}`, '#55ff55');
                this.log(`${t.name} 회복: ${realHeal}`, 'log-heal');
            }
            // ----------------------------------------------------------------

            else if (type.includes('MP') && (type.includes('HEAL') || type.includes('REGEN'))) {
                let amt = (val <= 1) ? Math.floor(t.mp * val) : val;
                t.curMp = Math.min(t.mp, t.curMp + amt);
                this.showFloatingText(t, `MP +${amt}`, '#55ccff');
            }
            else if (type.startsWith('GAUGE')) {
                let amount = (val <= 1) ? Math.floor(val * 100) : val;
                if (type.includes('FILL')) {
                    t.actionGauge = Math.min(this.actionGaugeLimit, t.actionGauge + amount);
                    this.showFloatingText(t, `Act +${amount}`, '#ffff00');
                } else if (type.includes('DRAIN') || type.includes('REDUCE')) {
                    t.actionGauge -= amount;
                    this.showFloatingText(t, `Act -${amount}`, '#888888');
                } else if (type.includes('SET') || type.includes('MAX')) {
                    t.actionGauge = type.includes('MAX') ? this.actionGaugeLimit : amount;
                    this.showFloatingText(t, `Act Reset`, '#ffffff');
                }
            }
            else if (type === 'PURIFY' || type === 'CLEANSE') {
                const removeCount = val || 1;
                const debuffs = t.buffs.filter(b => EFFECTS[b.type]?.type === 'debuff');
                for(let i=0; i<removeCount; i++) {
                    if(debuffs[i]) {
                        const idx = t.buffs.indexOf(debuffs[i]);
                        if(idx > -1) t.buffs.splice(idx, 1);
                    }
                }
                this.showFloatingText(t, "Cleanse", "#ffffff");
            }
            else if (type === 'MOVE_BEHIND') {
                const backHex = this.grid.getHexInDirection(t, caster, -1);
                if (backHex && !this.getUnitAt(backHex.q, backHex.r)) {
                    caster.q = backHex.q; caster.r = backHex.r;
                    this.log("배후로 이동!", 'log-skill');
                }
            }
            else if (type === 'MOVE_SWAP') {
                const tempQ = caster.q, tempR = caster.r;
                caster.q = t.q; caster.r = t.r;
                t.q = tempQ; t.r = tempR;
                this.showFloatingText(caster, "Swap!", "#fff");
            }
            else if (type === 'MOVE_BACK') {
                const dest = this.grid.getHexInDirection(caster, t, -val);
                if (!this.getUnitAt(dest.q, dest.r)) {
                    caster.q = dest.q; caster.r = dest.r;
                }
            }
            // [신규] 경제/유틸 스킬 구현
            else if (type.startsWith('ECON')) {
                if (type === 'ECON_STEAL') {
                    const gold = Math.floor(Math.random() * 50 * caster.level) + 10;
                    this.gameApp.gameState.gold += gold;
                    this.showFloatingText(caster, `+${gold} G`, '#ffd700');
                }
                else if (type === 'ECON_CREATE' || type === 'ECON_ITEM_GET') {
                    const items = ['POTION_S', 'POTION_M'];
                    const randItem = items[Math.floor(Math.random() * items.length)];
                    this.gameApp.gameState.inventory.push(randItem);
                    this.showFloatingText(caster, "Item Get!", "#fff");
                }
                else if (type === 'ECON_TRANSMUTE') {
                    this.gameApp.gameState.gold += 100;
                    this.showFloatingText(caster, "Transmute!", "#ffd700");
                }
                else if (type === 'ECON_GOLD' || type === 'PASSIVE_GOLD') {
                    this.goldMod *= val;
                    this.showFloatingText(caster, "Gold UP", "#ffd700");
                }
                else if (type === 'ECON_DROP_RATE' || type === 'PASSIVE_DROP') {
                    this.dropMod *= val;
                    this.showFloatingText(caster, "Drop UP", "#aaf");
                }
            }
            // [신규] 랜덤 상태이상
            else if (type === 'STATUS_RANDOM' || type === 'STATUS_RANDOM_DOT') {
                const pools = ['STATUS_BURN', 'STATUS_POISON', 'STATUS_BLEED', 'DEBUFF_DEF', 'DEBUFF_ATK', 'DEBUFF_SPD'];
                const rndType = pools[Math.floor(Math.random() * pools.length)];
                this.applyStatus(t, { type: rndType, duration: 2, val: val }, caster);
            }
            // [신규] 피해 저장 (버프로 처리)
            else if (type === 'DEF_STORE_DMG') {
                this.applyStatus(t, { type: 'DEF_STORE_DMG', duration: 2, val: val }, caster);
            }
            else if (type === 'UTIL_CD_RESET') {
                t.actionGauge = this.actionGaugeLimit;
                this.showFloatingText(t, "Ready!", "#fff");
            }
            // ================================================================
            // [수정] 은신 탐지 (UTIL_REVEAL) 구현
            // ================================================================
            else if (type === 'UTIL_REVEAL' || type === 'UTIL_SCAN') {
                this.showFloatingText(caster, "👁️ Scan", "#aaf");
                let found = false;
                
                // 모든 유닛 검사
                this.units.forEach(u => {
                    // 적군이고 은신(STEALTH) 상태인 경우
                    if (u.team !== caster.team && this.hasStatus(u, 'STEALTH')) {
                        // 은신 버프 제거
                        u.buffs = u.buffs.filter(b => b.type !== 'STEALTH');
                        this.showFloatingText(u, "REVEALED!", "#ff0000");
                        this.log(`👁️ ${u.name}의 은신이 발각되었습니다!`, 'log-cc');
                        found = true;
                    }
                });
                
                // (함정 탐지 로직이 있다면 여기에 추가)
                if (this.traps) {
                    this.traps.forEach(trap => {
                        // 함정 발견 처리 (시각적 효과 등)
                        this.showFloatingText(trap, "TRAP!", "#ff8800");
                    });
                }

                if (!found) this.log("탐지된 숨은 적이 없습니다.", "log-system");
            }
            else if (type === 'SPECIAL_TIME_STOP') {
                caster.actionGauge += 200; 
                this.showFloatingText(caster, "TIME STOP!", "#000");
                this.log("시간이 멈췄습니다! (연속 행동)", 'log-skill');
            }
            else {
                const info = EFFECTS[type];
                if(info) this.applyStatus(t, eff, caster);
            }
        }
    }

    async performAttack(atk, def, mult, name, isDrain, type, hitCount = 1, options = {}) {
        // 공격 행동 처리
        if(name !== "스킬" && name !== "흡수") this.actions.acted = true; 
        
        // [신규] 공격 시 자신의 은신(STEALTH) 해제
        if (this.hasStatus(atk, 'STEALTH')) {
            atk.buffs = atk.buffs.filter(b => b.type !== 'STEALTH');
            this.showFloatingText(atk, "Revealed", "#ccc");
            if(atk.team === 0) this.log(`${atk.name} 공격하여 은신 해제`, 'log-system');
        }

        const dir = this.grid.getDirection(atk, def);
        atk.facing = dir;

        if (!type) type = atk.atkType || 'PHYS';
        if (atk.team === 0) this.gainActionXp(atk, 5);

        for (let i = 0; i < hitCount; i++) {
            const dist = this.grid.getDistance(atk, def);
            if (dist > 1) this.createProjectile(atk, def);
            else this.triggerBumpAnimation(atk, def);

            await new Promise(resolve => setTimeout(() => {
                const result = Formulas.calculateDamage(atk, def, mult, type, this.grid, options);

                if (result.hitContext === 'BACKSTAB') this.showFloatingText(def, "BACK ATTACK!", "#f0f");
                if (result.hitContext === 'BLOCK') this.showFloatingText(def, "BLOCKED", "#aaa");
                if (result.hitContext === 'EXECUTE') this.showFloatingText(def, "EXECUTE!", "#f00");

                // [회피 처리 및 전장의 뮤즈 패시브]
                if (result.isMiss) {
                    this.showFloatingText(atk, result.text, "#888");
                    
                    // 전장의 뮤즈 (PASSIVE_EVA_BOOST) 체크
                    let boostAmount = 0;
                    const passiveSkill = (def.skills || []).find(s => s.type === 'PASSIVE' && s.main?.type === 'PASSIVE_EVA_BOOST');
                    if (passiveSkill) boostAmount = passiveSkill.main.val;

                    if (boostAmount === 0) {
                        const buff = def.buffs.find(b => b.type === 'PASSIVE_EVA_BOOST');
                        if (buff) boostAmount = buff.val;
                    }

                    if (boostAmount > 0) {
                        def.actionGauge += boostAmount;
                        this.showFloatingText(def, `Speed +${boostAmount}`, "#0ff");
                        this.log(`🎵 전장의 뮤즈: 행동력 +${boostAmount}`, 'log-skill');
                        if (this.viewingUnit === def) this.updateStatusPanel();
                    }

                    resolve(); return;
                }

                if (result.isWeak) this.showFloatingText(def, "Weak!", "#ffcc00");
                if (result.isResist) this.showFloatingText(def, "Resist", "#888");
                if (result.isCrit) this.showFloatingText(def, "CRIT!", "#f00");
                if (result.isCursed) this.showFloatingText(def, "Cursed!", "#b0b");

                let dmg = result.damage;
                
                if (result.text === "IMMUNE") { dmg = 0; this.showFloatingText(def, "IMMUNE", "#fff"); }
                
                if (this.hasStatus(def, 'CC_FREEZE')) {
                    dmg *= 2;
                    this.showFloatingText(def, "SHATTER!", "#aef");
                    def.buffs = def.buffs.filter(b => b.type !== 'CC_FREEZE');
                }
                if (this.hasStatus(def, 'CC_SLEEP')) {
                    this.showFloatingText(def, "Wake Up", "#fff");
                    def.buffs = def.buffs.filter(b => b.type !== 'CC_SLEEP');
                }

                const shield = def.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
                if (shield && dmg > 0) {
                    const absorbed = Math.min(shield.amount, dmg);
                    shield.amount -= absorbed;
                    dmg -= absorbed;
                    this.showFloatingText(def, `(${absorbed})`, "#00bfff"); 
                    if (shield.amount <= 0) def.buffs = def.buffs.filter(b => b !== shield);
                }

                def.curHp = Math.max(0, def.curHp - dmg);
                if(dmg > 0) this.showFloatingText(def, `-${dmg}`, '#f55');
                
                this.triggerShakeAnimation(def);
                this.log(`${atk.name} -> ${def.name}: ${dmg}`, 'log-dmg');

                if (isDrain && dmg > 0) {
                    let heal = Math.floor(dmg * 0.5); 
                    atk.curHp = Math.min(atk.hp, atk.curHp + heal);
                    this.showFloatingText(atk, `+${heal}`, '#5f5');
                }

                const reflectBuff = def.buffs.find(b => b.type === 'BUFF_REFLECT');
                if (reflectBuff && !options.isReflected && dmg > 0) { 
                    const reflectDmg = Math.floor(dmg * 0.5); 
                    if (reflectDmg > 0) {
                        atk.curHp -= reflectDmg;
                        this.showFloatingText(atk, `Reflect -${reflectDmg}`, '#f0f');
                        this.log(`반사 피해: ${reflectDmg}`, 'log-dmg');
                    }
                }

                if (def.curHp <= 0) this.handleDeath(def);
                this.renderPartyList();
                this.updateStatusPanel();
                
                resolve();
            }, dist > 1 ? 300 : 150));

            if (i < hitCount - 1) await new Promise(r => setTimeout(r, 200));
        }

        const dist = this.grid.getDistance(atk, def);
        const counterBuff = def.buffs.find(b => b.type === 'BUFF_COUNTER');
        if (counterBuff && def.curHp > 0 && dist === 1 && !options.isCounter) {
            this.log(`${def.name} 반격!`, 'log-skill');
            await new Promise(r => setTimeout(r, 300));
            await this.performAttack(def, atk, 0.8, "반격", false, 'PHYS', 1, { isCounter: true });
        }
    }

    applyStatus(target, data, caster) {
        const type = data.type; 
        const info = EFFECTS[type];
        
        // 데이터가 없으면 중단 (에러 방지)
        if (!info) {
            // console.warn(`[Effect Error] 정의되지 않은 효과입니다: ${type}`); 
            return;
        }
                
        // 3. 디버프 저항 로직
        if (info.type === 'debuff') {
            if (Formulas.getDerivedStat(target, 'tenacity') > 150) { 
                 this.showFloatingText(target, "IMMUNE", "#fff"); return; 
            }
            const atkPower = caster.level + (Formulas.getStat(caster, 'dex') * 0.5) + (Formulas.getStat(caster, 'int') * 0.5);
            const defPower = target.level + (Formulas.getStat(target, 'vit') * 0.5) + (Formulas.getStat(target, 'agi') * 0.5);
            let successChance = 75 + (atkPower - defPower);
            if (data.prob) successChance = data.prob;
            
            // 확률이 100이 아니면 최소/최대 보정
            if(data.prob !== 100) successChance = Math.max(10, Math.min(90, successChance));

            if (Math.random() * 100 > successChance) {
                this.log(`🛡️ ${target.name} 효과 저항!`, 'log-system');
                this.showFloatingText(target, "RESIST!", "#ffffff");
                return;
            }
        }
        
        const multiplier = (data.val !== undefined) ? data.val : (data.mult !== undefined ? data.mult : 1);

        // 4. 버프 객체 생성
        const buff = { 
            type: type, 
            name: info.name, 
            icon: info.icon, 
            duration: data.duration || 2, 
            val: multiplier, 
            casterId: caster.id,
            desc: info.desc || EFFECTS[type]?.desc || "" 
        };

        if (type === 'BUFF_SHIELD' || type === 'DEF_SHIELD') {
            const shieldVal = Math.floor(Formulas.getStat(caster, 'int') * multiplier * 2);
            buff.amount = shieldVal;
            this.log(`🛡️ ${target.name} 보호막: ${shieldVal}`, 'log-heal');
        }

        // 5. 중복 체크 및 적용
        const exist = target.buffs.find(b => b.type === type);
        if (exist) { 
            exist.duration = data.duration || 2; 
            exist.casterId = caster.id; 
            exist.val = multiplier;
            if(buff.amount) exist.amount = buff.amount; 
            this.log(`${target.name}: [${info.name}] 갱신`, 'log-effect'); 
        } 
        else { 
            target.buffs.push(buff); 
            this.log(`${target.name}: [${info.name}] 적용`, 'log-effect'); 
        }
        
        // 6. UI 갱신
        let color = info.type === 'buff' ? '#5f5' : '#f55';
        this.showFloatingText(target, `${info.name}`, color);
        
        this.renderPartyList(); 
        if (this.viewingUnit === target) {
            this.updateStatusPanel();
        }
    }

    // --------------------------------------------------------------------------------
    // AI
    // --------------------------------------------------------------------------------

    async runAI() {
        const ai = this.currentUnit;
        this.isProcessingTurn = true;
        this.log(`🤖 ${ai.name} 행동 중...`, 'log-effect');
        await new Promise(r => setTimeout(r, 600));

        if (this.hasStatus(ai, 'CC_CONFUSE')) {
            this.log(`😵 ${ai.name} 혼란 상태!`, 'log-cc');
            const neighbors = this.grid.getNeighbors(ai);
            const validMoves = neighbors.filter(n => !this.getUnitAt(n.q, n.r));
            if (validMoves.length > 0) {
                const r = validMoves[Math.floor(Math.random() * validMoves.length)];
                await this.moveUnit(ai, r.q, r.r);
            }
            await new Promise(r => setTimeout(r, 200));
            const nearUnits = this.units.filter(u => u !== ai && u.curHp > 0 && this.grid.getDistance(ai, u) <= 1);
            if (nearUnits.length > 0) {
                const randomTarget = nearUnits[Math.floor(Math.random() * nearUnits.length)];
                await this.performAttack(ai, randomTarget, 1.0, "혼란 공격");
            }
            this.endTurn(); return;
        }

        if (this.hasStatus(ai, 'FEAR') || this.hasStatus(ai, 'CC_FEAR')) {
            this.log(`😱 ${ai.name} 공포에 질려 도망칩니다!`, 'log-cc');
            const enemies = this.units.filter(u => u.team !== ai.team && u.curHp > 0);
            if (enemies.length > 0) {
                const nearestEnemy = enemies.sort((a,b) => this.grid.getDistance(ai, a) - this.grid.getDistance(ai, b))[0];
                this.calcReachable();
                let bestHex = null; let maxDist = -1;
                this.reachableHexes.forEach(h => {
                    const d = this.grid.getDistance(h, nearestEnemy);
                    if (d > maxDist) { maxDist = d; bestHex = h; }
                });
                if (bestHex && (bestHex.q !== ai.q || bestHex.r !== ai.r)) {
                    await this.moveUnit(ai, bestHex.q, bestHex.r);
                }
            }
            this.endTurn(); return;
        }

        let potentialTargets = [];
        if (this.hasStatus(ai, 'CHARM') || this.hasStatus(ai, 'CC_CHARM')) {
            potentialTargets = this.units.filter(u => u.team === ai.team && u.id !== ai.id && u.curHp > 0);
        } else {
            potentialTargets = this.units.filter(u => u.team !== ai.team && u.curHp > 0);
        }

        // =================================================================
        // [수정] 은신(STEALTH) 및 지정불가(BUFF_UNTARGETABLE) 상태인 적 제외
        // =================================================================
        potentialTargets = potentialTargets.filter(t => 
            !this.hasStatus(t, 'STEALTH') && !this.hasStatus(t, 'BUFF_UNTARGETABLE')
        );

        if (potentialTargets.length === 0) { 
            this.log("공격할 대상이 없습니다.", "log-system");
            this.endTurn(true); 
            return; 
        }

        let finalTarget = null;
        const tauntBuff = ai.buffs.find(b => b.type === 'AGGRO_TAUNT' || b.type === 'TAUNT');
        if (tauntBuff && tauntBuff.casterId) {
            const tauntSource = this.units.find(u => u.id === tauntBuff.casterId && u.curHp > 0);
            if (tauntSource) finalTarget = tauntSource;
        }

        if (!finalTarget) {
            const killable = potentialTargets.find(t => {
                const res = Formulas.calculateDamage(ai, t, 1.0, ai.atkType, this.grid);
                return res.damage >= t.curHp;
            });
            if (killable) finalTarget = killable;
            else finalTarget = potentialTargets.sort((a,b) => this.grid.getDistance(ai, a) - this.grid.getDistance(ai, b))[0];
        }

        if (!finalTarget) { this.endTurn(true); return; }

        let maxRange = ai.rng;
        if (ai.skills) {
            ai.skills.forEach(s => {
                if (ai.curMp >= s.mp && !['PASSIVE'].includes(s.type)) {
                    if (s.rng > maxRange) maxRange = s.rng;
                }
            });
        }

        const dist = this.grid.getDistance(ai, finalTarget);
        
        if (dist > maxRange) {
            this.calcReachable();
            let moveHex = null; 
            let minD = 999;
            
            this.reachableHexes.forEach(h => {
                const d = this.grid.getDistance(h, finalTarget);
                if (d < dist && d < minD) { minD = d; moveHex = h; }
            });
            
            if (moveHex && (moveHex.q !== ai.q || moveHex.r !== ai.r)) {
                await this.moveUnit(ai, moveHex.q, moveHex.r);
            } else {
                this.log("이동 경로 막힘", "log-system");
                this.endTurn(true); 
                return;
            }
        }

        const newDist = this.grid.getDistance(ai, finalTarget);
        let actionDone = false;

        if (ai.skills && ai.skills.length > 0) {
            const usableSkills = ai.skills.filter(s => 
                !['PASSIVE'].includes(s.type) && 
                ai.curMp >= s.mp && 
                newDist <= s.rng
            );

            if (usableSkills.length > 0) {
                usableSkills.sort((a, b) => (b.main?.val || 0) - (a.main?.val || 0));
                const bestSkill = usableSkills[0];
                this.selectedSkill = bestSkill;
                await new Promise(r => setTimeout(r, 300));
                await this.tryExecuteSkill(finalTarget, finalTarget); 
                actionDone = true;
            }
        }

        if (!actionDone) {
            if (newDist <= ai.rng) {
                await new Promise(r => setTimeout(r, 300));
                await this.performAttack(ai, finalTarget, 1.0, "공격");
                actionDone = true;
            } else {
                this.endTurn(true);
                return;
            }
        }

        this.endTurn();
    }

    async runAllyAutoAI() {
        if(!this.isAutoBattle || this.currentUnit.team !== 0) return;
        this.isProcessingTurn = true;
        await new Promise(r => setTimeout(r, 600));

        const u = this.currentUnit;
        
        // [수정] 아군 자동전투 시에도 은신한 적은 타겟에서 제외
        let ens = this.units.filter(e => e.team === 1 && e.curHp > 0);
        ens = ens.filter(t => !this.hasStatus(t, 'STEALTH') && !this.hasStatus(t, 'BUFF_UNTARGETABLE'));

        if(ens.length === 0){ this.endTurn(); return; }

        const skills = (u.skills || []).filter(s => !['PASSIVE'].includes(s.type) && u.curMp >= s.mp);
        let bestSkill = null;
        if (skills.length > 0) bestSkill = skills[0];

        const t = ens[0];
        this.calcReachable();
        const d = this.grid.getDistance(u, t);
        const range = bestSkill ? bestSkill.rng : u.rng;

        if (d > range && !this.actions.moved) {
            let b = null, m = 999;
            this.reachableHexes.forEach(h => {
                const dx = this.grid.getDistance(h, t);
                if (dx <= range && dx < m) { m = dx; b = h; }
            });
            if (b) await this.moveUnit(u, b.q, b.r);
        }

        const nd = this.grid.getDistance(u, t);
        if (bestSkill && nd <= bestSkill.rng) {
            this.selectedSkill = bestSkill;
            await this.tryExecuteSkill(t, t);
        } else if (nd <= u.rng) {
            await this.performAttack(u, t, 1.0, "공격");
        }

        this.endTurn();
    }

    // --------------------------------------------------------------------------------
    // UI 및 기타 유틸리티
    // --------------------------------------------------------------------------------

    updateCursor() { const v = document.getElementById('viewport'); if(this.selectedSkill) v.className = 'cursor-skill'; else if(this.hoverHex && this.getUnitAt(this.hoverHex.q, this.hoverHex.r)?.team === 1) v.className = 'cursor-attack'; else v.className = ''; }
    log(msg, type) { const box = document.getElementById('log-content'); if(box) { box.innerHTML += `<div class="log-entry ${type}">${msg}</div>`; document.getElementById('log-box').scrollTop = 9999; } }
    showTooltip(e, html) { const t = document.getElementById('global-tooltip'); if(t) { t.style.display='block'; t.innerHTML=html; let left = e.clientX + 15; let top = e.clientY + 15; if (left + 250 > window.innerWidth) left = window.innerWidth - 260; if (top + 150 > window.innerHeight) top = window.innerHeight - 160; t.style.left = left + 'px'; t.style.top = top + 'px'; } }
    hideTooltip() { document.getElementById('global-tooltip').style.display='none'; }
    showFloatingText(u, txt, col) { this.textQueue.push({u, txt, col, delay: this.textQueue.length * 200}); }
    
    handleMouseDown(e) { 
        if (this.isProcessingTurn && this.currentUnit.team !== 0) return; 
        
        // [수정] 상태이상 키워드(CC_) 통일 및 공포/매혹 추가
        if (this.currentUnit && this.currentUnit.team === 0) { 
            if (this.hasStatus(this.currentUnit, 'CC_STUN') || 
                this.hasStatus(this.currentUnit, 'CC_SLEEP') || 
                this.hasStatus(this.currentUnit, 'CC_FREEZE') || 
                this.hasStatus(this.currentUnit, 'CC_CONFUSE') ||
                this.hasStatus(this.currentUnit, 'CC_FEAR') ||    // 공포 추가
                this.hasStatus(this.currentUnit, 'CC_CHARM')) {   // 매혹 추가
                return; 
            } 
        } 
        
        const pos = this.getCanvasCoordinates(e); 
        this.isMouseDown = true; 
        this.isDraggingMap = false; 
        this.dragStart = { x: pos.x, y: pos.y }; 
        this.dragCamStart = { x: this.camera.x, y: this.camera.y }; 
        this.updateCursor(); 
    }

    handleMouseUp(e) { 
        this.isMouseDown = false; 
        if (this.isDraggingMap) { 
            this.isDraggingMap = false; 
            return; 
        } 
        this.handleClick(e); 
    }

    handleClick(e) { 
        if (this.isProcessingTurn || this.isAnimating) return; 
        if (!this.hoverHex || this.currentUnit.team !== 0) return; 
        
        // [수정] 조작 불가 상태 체크 (CC_ 접두어 사용)
        if (this.hasStatus(this.currentUnit, 'CC_STUN') || 
            this.hasStatus(this.currentUnit, 'CC_SLEEP') || 
            this.hasStatus(this.currentUnit, 'CC_FREEZE') || 
            this.hasStatus(this.currentUnit, 'CC_CONFUSE') || 
            this.hasStatus(this.currentUnit, 'CC_FEAR') || 
            this.hasStatus(this.currentUnit, 'CC_CHARM')) { 
            this.log("조작 불가 상태입니다.", "log-system"); 
            return; 
        } 
        
        const u = this.getUnitAt(this.hoverHex.q, this.hoverHex.r); 
        
        // [수정] 도발 체크 (AGGRO_TAUNT)
        const taunt = this.currentUnit.buffs.find(b => b.type === 'AGGRO_TAUNT'); 
        if (taunt && u && u.team === 1 && u.id !== taunt.casterId) { 
            this.log("도발 상태입니다! (대상 고정)", "log-cc"); 
            this.showFloatingText(this.currentUnit, "TAUNTED!", "#f55"); 
            return; 
        } 

        // [신규] 지정 불가 / 은신 체크 (BUFF_UNTARGETABLE, STEALTH)
        // 적(team === 1)을 클릭했는데 그 적이 지정 불가 상태라면 클릭 무효화
        if (u && u.team !== this.currentUnit.team) {
            if (this.hasStatus(u, 'BUFF_UNTARGETABLE') || this.hasStatus(u, 'STEALTH')) {
                this.log("타겟팅 할 수 없습니다! (은신/불가)", "log-system");
                return;
            }
        }

        if (this.selectedSkill) { 
            const dist = this.grid.getDistance(this.currentUnit, this.hoverHex); 
            const rngBonus = Formulas.getStat(this.currentUnit, 'rng'); 
            
            if (dist <= this.selectedSkill.rng + rngBonus) { 
                this.tryExecuteSkill(this.hoverHex, u); 
            } else { 
                this.log("사거리 밖입니다.", "log-system"); 
                // 스킬 선택 유지 (연속 사용 편의성)
            } 
        } else if (u && u.team === 1) { 
            this.log("스킬을 선택하세요.", "log-system"); 
            this.showFloatingText(this.currentUnit, "스킬 선택", "#fa0"); 
        } else if (!u && !this.actions.moved) { 
            if (this.reachableHexes.some(h => h.q === this.hoverHex.q && h.r === this.hoverHex.r)) { 
                this.moveUnit(this.currentUnit, this.hoverHex.q, this.hoverHex.r); 
            } 
        } 
    }

    handleMouseMove(e) { 
        const pos = this.getCanvasCoordinates(e); 
        if (this.isMouseDown) { 
            const dist = Math.sqrt(Math.pow(pos.x - this.dragStart.x, 2) + Math.pow(pos.y - this.dragStart.y, 2)); 
            if (dist > 5) this.isDraggingMap = true; 
            if (this.isDraggingMap) { 
                const dx = pos.x - this.dragStart.x; 
                const dy = pos.y - this.dragStart.y; 
                this.camera.x = this.dragCamStart.x - dx; 
                this.camera.y = this.dragCamStart.y - dy; 
                this.updateFloatingControls(); 
            } 
        } else { 
            const worldX = pos.x + this.camera.x; 
            const worldY = pos.y + this.camera.y; 
            this.hoverHex = this.grid.pixelToHex(worldX, worldY); 
            
            if (this.hoverHex) { 
                const u = this.getUnitAt(this.hoverHex.q, this.hoverHex.r); 
                if (u) { 
                    const ele = ELEMENTS[u.element || 'NONE'].name; 
                    // 버프 아이콘 표시
                    const statusText = u.buffs.map(b => `${b.icon} ${b.name}`).join('  ') || '상태이상 없음'; 
                    
                    let eleInfo = ""; 
                    if (this.currentUnit && this.currentUnit.team === 0 && u.team !== 0) { 
                        const myEle = this.currentUnit.element || 'NONE'; 
                        const targetEle = u.element || 'NONE'; 
                        if (ELEMENTS[myEle].strong === targetEle) eleInfo = `<br><span style="color:#fc0;">[Weak!]</span>`; 
                        else if (ELEMENTS[myEle].weak === targetEle) eleInfo = `<br><span style="color:#aaa;">[Resist]</span>`; 
                    } 
                    
                    const html = `
                        <div style='color:${u.team===0?"#48f":"#f44"}; font-weight:bold; font-size:16px'>${u.name} <span style='font-size:12px; color:#aaa;'>Lv.${u.level}</span></div>
                        <div style='font-size:12px'>속성: ${ele} ${eleInfo}</div>
                        <hr style='margin:5px 0; border-color:#555'>
                        <div>HP: <span style='color:#f55'>${Math.floor(u.curHp)}</span> / ${u.hp}</div>
                        <div>MP: <span style='color:#0cf'>${Math.floor(u.curMp)}</span> / ${u.mp}</div>
                        <div style='margin-top:5px; color:#ccc; font-size:11px; white-space: pre-wrap;'>${statusText}</div>
                    `; 
                    this.showTooltip(e, html); 
                } else { 
                    this.hideTooltip(); 
                } 
            } 
        } 
        this.updateCursor(); 
    }
    renderUnitOverlaysLoop() { if (this.isBattleEnded) return; this.renderUnitOverlays(); requestAnimationFrame(() => this.renderUnitOverlaysLoop()); }
    
    
    // battle.js - renderUnitOverlays 메서드 전체 교체

    renderUnitOverlays() {
        if (!this.overlayContainer) return;
        this.overlayContainer.innerHTML = '';
        
        // 1. 유닛 오버레이(HP, 게이지, 이름) 렌더링
        this.units.forEach(u => {
            if (u.curHp <= 0) return;

            const pos = this.getUnitScreenPos(u);
            // 화면 밖이면 렌더링 생략 (성능 최적화)
            if (pos.x < -50 || pos.x > window.innerWidth + 50 || pos.y < -50 || pos.y > window.innerHeight + 50) return;
            
            const div = document.createElement('div');
            div.className = 'unit-overlay';
            div.style.left = pos.x + 'px'; 
            div.style.top = pos.y + 'px';
            if (u === this.currentUnit) div.style.zIndex = '8000'; // HP바는 컨트롤보다 아래

            // HP 및 보호막 계산
            const maxHp = u.hp; 
            const curHp = u.curHp;
            const shieldBuff = u.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
            const shieldVal = shieldBuff ? shieldBuff.amount : 0;
            const totalMax = Math.max(maxHp, curHp + shieldVal);
            const hpPct = (curHp / totalMax) * 100;
            const shieldPct = (shieldVal / totalMax) * 100;
            
            // [중요] 변수 선언을 반드시 여기서 해야 함
            let agPct, agColor;

            // 행동력 게이지 계산
            if (u.actionGauge >= 0) { 
                agPct = Math.min(100, (u.actionGauge / this.actionGaugeLimit) * 100); 
                agColor = '#ffd700'; // 노란색
            } else { 
                // 음수일 때는 절대값 50을 기준으로 비율 표시 (붉은색)
                agPct = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); 
                agColor = '#ff3333'; 
            }

            let highlight = u === this.currentUnit ? `<div class="turn-highlight-circle"></div>` : '';
            
            // HTML 조립 (agPct가 위에서 계산되었으므로 안전함)
            div.innerHTML = `
                ${highlight}
                <div class="bar-group">
                    <div class="hp-row">
                        <div class="hp-fill" style="width:${hpPct}%; background:${u.team===0?'#4f4':'#f44'}"></div>
                        ${shieldVal > 0 ? `<div class="shield-fill" style="width:${shieldPct}%"></div>` : ''}
                    </div>
                    <div class="ag-row">
                        <div class="ag-fill" style="width:${agPct}%; background:${agColor};"></div>
                    </div>
                </div>
                <div class="name-tag">${u.name}</div>
            `;
            
            this.overlayContainer.appendChild(div);
        });

        // 2. 플로팅 컨트롤 위치 실시간 동기화
        this.updateFloatingPosition();
    }   

    // [신규] 플로팅 컨트롤 위치만 업데이트하는 함수
    updateFloatingPosition() {
        const wrapper = document.getElementById('floating-controls');
        const u = this.currentUnit;
        
        if (wrapper && u && this.grid && this.grid.canvas) {
            const screenPos = this.getUnitScreenPos(u); // 3D 높이 등 고려된 좌표
            
            // 캐릭터 머리 위 50px 위치
            wrapper.style.left = screenPos.x + 'px';
            wrapper.style.top = (screenPos.y - 50) + 'px';
        }
    }

    renderPartyList() {
        const listContainer = document.getElementById('party-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        const heroes = this.units.filter(u => u.team === 0);
        heroes.forEach(u => {
            const div = document.createElement('div');
            div.className = `party-unit ${u === this.currentUnit ? 'active-turn' : ''} ${u === this.viewingUnit ? 'viewing' : ''}`;
            const hpPct = (u.curHp / u.hp) * 100;
            const mpPct = (u.curMp / u.mp) * 100;
            // [수정] 행동력 게이지 색상 및 길이 계산
            let agPct, agColor;
            
            // 게이지가 0보다 크거나 같으면 (정상) -> 노란색
            if (u.actionGauge >= 0) { 
                agPct = Math.min(100, (u.actionGauge / this.actionGaugeLimit) * 100); 
                agColor = '#ffd700'; // 노란색
            } 
            // 게이지가 음수이면 (패널티) -> 붉은색
            else { 
                // 음수일 때는 절대값으로 꽉 차게 보여주거나 비율대로 보여줌 (여기선 50 기준 비율)
                agPct = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); 
                agColor = '#ff3333'; // 붉은색
            }
        const statusIcons = u.buffs
            .filter(b => b.type !== 'PASSIVE_BUFF')
            .map(b => b.icon).join(' ');
            div.innerHTML = `<div style="display:flex; align-items:center; width:100%; gap:10px; padding:8px;"><div style="font-size:24px;">${u.icon}</div><div style="flex:1;"><div style="display:flex; justify-content:space-between; font-size:11px;"><b>${u.name}</b> <span>Lv.${u.level}</span></div><div class="bar-container" style="height:5px; margin:2px 0;"><div class="bar-fill hp-fill" style="width:${hpPct}%"></div></div><div class="bar-container" style="height:3px;"><div class="bar-fill mp-fill" style="width:${mpPct}%"></div></div><div class="bar-container" style="height:3px; margin-top:1px; background:#220;"><div class="bar-fill" style="width:${agPct}%; background:${agColor};"></div></div><div style="font-size:10px; margin-top:2px;">${statusIcons}</div></div></div>`;
            div.onclick = () => { this.viewingUnit = u; this.updateStatusPanel(); this.renderPartyList(); };
            listContainer.appendChild(div);
        });
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        footer.innerHTML = `<button id="btn-auto-toggle" class="auto-btn-sidebar ${this.isAutoBattle ? 'active' : ''}">${this.isAutoBattle ? '🤖 AUTO ON' : '⚔️ AUTO OFF'}</button>`;
        footer.querySelector('button').onclick = () => { this.isAutoBattle = !this.isAutoBattle; this.renderPartyList(); if(this.isAutoBattle && this.currentUnit.team === 0 && !this.isProcessingTurn) { this.runAllyAutoAI(); } };
        listContainer.appendChild(footer);
    }

    // [BattleSystem 클래스 내부 - 덮어씌우기]
    updateStatusPanel() {
        const p = document.getElementById('bottom-panel');
    
        if (!this.viewingUnit) {
            p.innerHTML = '<div style="margin:auto;color:#666;font-size:12px;">유닛을 선택하세요</div>';
            return;
        }

        const u = this.viewingUnit;
        
        // [핵심 수정] 조건 분리
        // 1. 스킬/아이템 사용 가능: 내 턴 + 행동 안 함 + 처리 중 아님
        const canAct = (u.team === 0 && !this.actions.acted && !this.isProcessingTurn);
        // 2. 턴 종료 가능: 내 턴 + 처리 중 아님 (행동 여부 무관!)
        const canEndTurn = (u.team === 0 && !this.isProcessingTurn);

        const tierReqs = (typeof TIER_REQ !== 'undefined') ? TIER_REQ : { 1: 1, 2: 3, 3: 5, 4: 10, 5: 15 };
        const checkSkillLock = (skill) => {
            const reqLv = tierReqs[skill.tier] || 1;
            return u.level < reqLv;
        };

        const createRow = (key, label, val, isBase, idPrefix = 'val') => {
            let btnHtml = '';
            // 스탯 업 버튼 유지
            if (isBase && u.team === 0 && u.statPoints > 0) {
                btnHtml = `<button class="stat-up-btn" 
                               onclick="window.battle.allocateStat('${key}')" 
                               onmouseenter="window.battle.handleStatHover(event, '${key}', true)" 
                               onmouseleave="window.battle.hideTooltip()">+</button>`;
            }
            let valClass = 'val-normal';
            let displayVal = Math.floor(Number(val));
            if (key === 'crit' || key === 'eva') displayVal = parseFloat(val).toFixed(1) + '%';
            if (!isBase) {
                const baseVal = Formulas.getDerivedStat(u, key, true);
                if (val > baseVal) valClass = 'val-buff';
                else if (val < baseVal) valClass = 'val-debuff';
            }
            return `<div class="stat-row">
                        <span class="stat-label">${label}</span>
                        <div class="stat-val-box">
                            <span id="${idPrefix}-${key}" class="stat-val ${valClass}">${displayVal}</span>
                            ${btnHtml}
                        </div>
                    </div>`;
        };

        // 1. 프로필
        const hpP = (u.curHp / u.hp) * 100;
        const mpP = (u.curMp / u.mp) * 100;
        const xpP = (u.maxXp && u.maxXp > 0) ? (u.xp / u.maxXp) * 100 : 0;
        let agP, agC;
        if (u.actionGauge >= 0) { agP = Math.min(100, (u.actionGauge / this.actionGaugeLimit) * 100); agC = '#ffd700'; } 
        else { agP = Math.min(100, Math.abs(u.actionGauge)); agC = '#ff4444'; }

        const colProfile = `
        <div class="bp-col col-profile">
            <div class="portrait-lg">${u.icon}</div>
            <div class="basic-name">${u.name}</div>
            <div class="basic-lv">Lv.${u.level} ${u.team === 0 ? '(Hero)' : '(Enemy)'}</div>
            <div style="font-size:11px; width:100%; margin-top:5px; display:flex; flex-direction:column; gap:3px;">
                <div class="bar-container" style="height:14px;" title="HP"><div class="bar-fill hp-fill" style="width:${hpP}%"></div><div class="bar-text">HP ${Math.floor(u.curHp)}/${u.hp}</div></div>
                <div class="bar-container" style="height:14px;" title="MP"><div class="bar-fill mp-fill" style="width:${mpP}%"></div><div class="bar-text">MP ${Math.floor(u.curMp)}/${u.mp}</div></div>
                <div class="bar-container" style="height:10px; background:#220;" title="Action Gauge"><div class="bar-fill" style="width:${agP}%; background:${agC};"></div><div class="bar-text" style="font-size:9px;">ACT ${Math.floor(u.actionGauge)}</div></div>
            </div>
        </div>`;

        // 2. 스탯
        const colBase = `
        <div class="bp-col col-base"><div class="bp-header">BASIC STATS</div>
            ${createRow('str', '힘', Formulas.getStat(u, 'str'), true)}${createRow('int', '지능', Formulas.getStat(u, 'int'), true)}
            ${createRow('vit', '체력', Formulas.getStat(u, 'vit'), true)}${createRow('agi', '민첩', Formulas.getStat(u, 'agi'), true)}
            ${createRow('dex', '숙련', Formulas.getStat(u, 'dex'), true)}${createRow('vol', '변동', Formulas.getStat(u, 'vol'), true)}
            ${createRow('luk', '운', Formulas.getStat(u, 'luk'), true)}
            ${u.statPoints > 0 ? `<div style="text-align:center;color:gold;font-size:11px;margin-top:5px;">PT: ${u.statPoints}</div>` : ''}
        </div>`;

        const colCombat = `
        <div class="bp-col col-combat"><div class="bp-header">COMBAT</div>
            ${createRow('atk_phys', '물공', Formulas.getDerivedStat(u, 'atk_phys'), false)}${createRow('atk_mag', '마공', Formulas.getDerivedStat(u, 'atk_mag'), false)}
            ${createRow('def', '방어', Formulas.getDerivedStat(u, 'def'), false)}${createRow('res', '저항', Formulas.getDerivedStat(u, 'res'), false)}
            ${createRow('hit_phys', '명중', Formulas.getDerivedStat(u, 'hit_phys'), false)}${createRow('crit', '치명', Formulas.getDerivedStat(u, 'crit'), false)}
            ${createRow('eva', '회피', Formulas.getDerivedStat(u, 'eva'), false)}${createRow('spd', '속도', Formulas.getDerivedStat(u, 'spd'), false)}
        </div>`;

        // 3. 스킬
        let skillListHtml = '';
        if (u.skills) {
            u.skills.forEach(skill => {
                if (skill.type === 'PASSIVE') return;
                const isLocked = checkSkillLock(skill);
                const isManaLack = u.curMp < skill.mp;
                const isActive = (this.selectedSkill && this.selectedSkill.id === skill.id) ? 'active' : '';
                skillListHtml += `
                    <div class="skill-btn ${isActive} ${isLocked ? 'locked' : ''} ${!isLocked && isManaLack ? 'mana-lack' : ''}" 
                         data-skill-id="${skill.id}" 
                         title="${isLocked ? `잠김 (Lv.${tierReqs[skill.tier]} 필요)` : `${skill.name}\n${skill.desc}`}">
                        <div class="skill-icon">${isLocked ? '🔒' : (skill.icon || '⚔️')}</div>
                        <div class="skill-name">${skill.name}</div>
                        ${!isLocked ? `<div class="skill-cost">${skill.mp} MP</div>` : ''}
                    </div>`;
            });
        } else { skillListHtml = '<div style="color:#666; font-size:11px; margin:auto;">스킬 없음</div>'; }

        // 4. 아이템 (포션) - 유지 확인됨
        let itemSlotsHtml = '';
        for (let i = 0; i < 5; i++) {
            let item = null;
            const slotKey = `potion${i + 1}`;
            if (u.equipment && u.equipment[slotKey]) {
                const itemId = u.equipment[slotKey];
                if (this.gameApp.itemData) item = this.gameApp.itemData[itemId];
            } else if (i === 0 && u.potion) item = u.potion;

            if (item) {
                const isConfirming = (this.confirmingItemSlot === i);
                let popupHtml = isConfirming ? `<div class="item-confirm-popup" onclick="event.stopPropagation()"><div class="confirm-mini-btn ok" onclick="window.battle.executeItem(${i})">V</div><div class="confirm-mini-btn no" onclick="window.battle.cancelItem()">X</div></div>` : '';
                itemSlotsHtml += `<div class="potion-slot filled ${isConfirming ? 'confirming' : ''}" onclick="window.battle.requestItemUse(${i})" title="${item.name}\n${item.desc}">${item.icon}${popupHtml}</div>`;
            } else { itemSlotsHtml += `<div class="potion-slot empty"></div>`; }
        }

        const colSkills = `
        <div class="bp-col col-skills">
            <div class="bp-header">ACTIONS</div>
            <div class="skill-grid-container" id="battle-skill-list">${skillListHtml}</div>
            <div class="skill-footer">
                <div class="consumable-grid">${itemSlotsHtml}</div>
                <button id="btn-turn-end" class="turn-btn">턴 종료</button>
            </div>
        </div>`;

        // 5. 상태
        const allStatus = [...(u.conditions || []), ...(u.buffs || [])];
        const statusHtml = allStatus.map(b => `<div class="status-detail-item"><div class="status-icon-box">${b.icon || '✨'}</div><div class="status-info-box"><div class="st-name">${b.name}</div></div></div>`).join('') || '<div style="color:#666;font-size:11px;text-align:center;">상태이상 없음</div>';
        const passiveHtml = (u.skills || []).filter(s => s.type === 'PASSIVE' && !checkSkillLock(s)).map(s => `<div class="status-detail-item passive"><div class="status-icon-box">${s.icon || '🔸'}</div><div class="status-info-box"><div class="st-name">${s.name}</div></div></div>`).join('') || '<div style="color:#666;font-size:11px;text-align:center;">패시브 없음</div>';
        const colStatus = `<div class="bp-col col-status"><div class="bp-header">STATUS</div><div class="status-list">${statusHtml}</div><div class="bp-header" style="margin-top:5px;">PASSIVE</div><div class="status-list">${passiveHtml}</div></div>`;

        p.innerHTML = colProfile + colBase + colCombat + colSkills + colStatus;

        // [이벤트 연결]
        // 스킬 버튼 (행동 안 했을 때만)
        if (canAct) {
            const skillBtns = p.querySelectorAll('.skill-btn');
            skillBtns.forEach(btn => {
                if (btn.classList.contains('locked')) return;
                btn.onclick = () => {
                    const sId = btn.dataset.skillId;
                    if (this.selectSkillFromFloat) this.selectSkillFromFloat(sId);
                    else {
                        // Fallback
                        const skill = u.skills.find(s => s.id === sId);
                        if(u.curMp < skill.mp) return;
                        this.selectedSkill = (this.selectedSkill === skill) ? null : skill;
                        this.updateFloatingControls();
                        this.updateStatusPanel();
                        this.updateCursor();
                    }
                };
            });
        }

        // [이벤트 연결] 턴 종료 버튼 (행동 여부 무관!)
        if (canEndTurn) {
            setTimeout(() => {
                const endBtn = document.getElementById('btn-turn-end');
                if (endBtn) {
                    endBtn.onclick = (e) => {
                        e.stopPropagation(); 
                        if(window.battle) window.battle.onTurnEndClick();
                    };
                }
            }, 50);
        }

        // 항복 버튼 유지
        const logF = document.getElementById('log-footer'); 
        if(logF) { 
            logF.innerHTML = `<button id="btn-surrender" style="width:100%; background:#422; color:#f88; border:1px solid #633; padding:5px; cursor:pointer;">🏳️ 항복하기</button>`; 
            document.getElementById('btn-surrender').onclick = () => { 
                this.gameApp.showConfirm("정말 항복하시겠습니까? (패배 처리)", () => { this.gameApp.onBattleEnd(false, true); }); 
            }; 
        }
    }
    
    
// [BattleSystem 클래스 내부 - 덮어씌우기]
    updateFloatingControls() {
        const wId = 'floating-controls';
        const oldWrapper = document.getElementById(wId);
        const u = this.currentUnit;
        
        // 1. 표시 조건 체크
        // [수정] this.actions.acted(행동함) 조건 삭제 -> 행동 해도 '턴 종료' 버튼은 보여야 하니까요.
        if (!u || u.team !== 0 || this.isProcessingTurn || this.isTargeting || !this.grid || !this.grid.canvas) {
            if (oldWrapper) oldWrapper.remove();
            return;
        }

        let wrapper = oldWrapper;
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = wId;
            document.body.appendChild(wrapper);
        }
        
        // 투명화 조건 (H키 or 스킬 선택 중)
        if (window.isHudHidden || this.selectedSkill) {
            wrapper.classList.add('hud-hidden');
        } else {
            wrapper.classList.remove('hud-hidden');
        }

        // 2. 스킬 목록 (행동을 안 했을 때만 표시)
        let skillsHtml = '';
        if (u.skills && !this.actions.acted) { // [수정] acted가 false일 때만 스킬 그림
            const activeSkills = u.skills.filter(s => s.type !== 'PASSIVE');
            if (activeSkills.length > 0) {
                skillsHtml += `<div class="float-skill-grid" id="float-skill-scroller">`;
                
                activeSkills.forEach(s => {
                    const isActive = (this.selectedSkill && this.selectedSkill.id === s.id) ? 'active' : '';
                    const isLocked = (u.level < (TIER_REQ[s.tier] || 1));
                    const isManaLack = u.curMp < s.mp;
                    let costRed = Formulas.getDerivedStat(u, 'cost_red');
                    if(!costRed || costRed <= 0) costRed = 1.0;
                    const finalCost = Math.floor((s.cost || 50) * costRed);
                    const tooltipContent = `
                        <div style='font-weight:bold;color:gold'>${s.name}</div>
                        <div style='font-size:10px;color:#ccc'>${s.desc || ''}</div>
                        <div style='display:flex; gap:8px; margin-top:2px;'>
                            <span style='color:#0cf;font-size:10px'>MP ${s.mp}</span>
                            <span style='color:#f88;font-size:10px'>Cost ${finalCost}</span>
                        </div>`;
                    
                    skillsHtml += `
                        <div class="float-skill-btn ${isActive} ${isLocked?'locked':''} ${!isLocked && isManaLack?'mana-lack':''}" 
                             onmousedown="event.stopPropagation()"
                             onclick="window.battle.selectSkillFromFloat('${s.id}')"
                             onmouseenter="window.battle.showTooltip(event, \`${tooltipContent}\`)"
                             onmouseleave="window.battle.hideTooltip()">
                             ${s.icon || '⚔️'}
                        </div>`;
                });
                skillsHtml += `</div>`;
            }
        }

        // 3. 턴 종료 버튼 (항상 표시)
        const endBtnHtml = `
            <div class="float-end-btn" 
                 onmousedown="event.stopPropagation()"
                 onclick="window.battle.onTurnEndClick()" 
                 onmouseenter="window.battle.showTooltip(event, '턴 종료 (Space)')"
                 onmouseleave="window.battle.hideTooltip()">
                 🛑
            </div>`;

        wrapper.innerHTML = `
        <div class="hud-guide-text">H: UI 숨기기</div>
        ${skillsHtml}
        ${endBtnHtml}
    `;
        this.updateFloatingPosition();

        // 4. 스크롤 로직 유지 (기존 코드와 동일)
        const scroller = document.getElementById('float-skill-scroller');
        if (scroller) {
            const ROW_HEIGHT = 38; 
            scroller.addEventListener('wheel', (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                if (scroller.dataset.isScrolling === "true") return;
                const direction = Math.sign(e.deltaY);
                scroller.scrollBy({ top: direction * ROW_HEIGHT, behavior: 'smooth' });
                scroller.dataset.isScrolling = "true";
                setTimeout(() => { if(scroller) scroller.dataset.isScrolling = "false"; }, 200);
            }, { passive: false });
        }
    }

    onTurnEndClick() {
        this.actions.acted = true;
        this.actions.moved = true;
        this.endTurn();
    }

    renderUI() {
        const box=document.getElementById('control-panel-grid'); if(!box||!this.viewingUnit) return;
        const isMy=(this.currentUnit===this.viewingUnit && this.currentUnit.team===0 && !this.isProcessingTurn);
        box.innerHTML=''; const h=document.createElement('div'); h.className='bp-header'; h.innerText=isMy?'스킬':'정보'; box.appendChild(h);
        const grid=document.createElement('div'); grid.className='skill-grid';
        if(this.viewingUnit.skills){
            this.viewingUnit.skills.forEach(baseS=>{
                const req=TIER_REQ[baseS.tier]||1; const lock=req>this.viewingUnit.level; const passive=baseS.type==='PASSIVE';
                const s=this.applyPerks(baseS, this.viewingUnit);
                const btn=document.createElement('div'); const manaLack=this.viewingUnit.curMp<s.mp;
                let cls=`skill-btn ${this.selectedSkill?.id===s.id?'active':''}`;
                if(lock||passive||!isMy) cls+=' disabled'; if(lock) cls+=' locked'; if(manaLack&&!lock&&!passive) cls+=' mana-lack';
                btn.className=cls;
                
                let costRed = Formulas.getDerivedStat(this.viewingUnit, 'cost_red');
                if(!costRed || costRed <= 0) costRed = 1.0;
                const finalCost=Math.floor((s.cost||50)*costRed);
                
                btn.innerHTML=`<div class="skill-icon">${s.icon||'⚔️'}</div><div class="skill-name">${s.name}</div>`;
                if(!lock&&!passive&&finalCost>0) btn.innerHTML+=`<div class="cooldown-overlay" style="background:rgba(0,0,0,0.6);font-size:10px;">⌛${finalCost}</div>`;
                btn.onclick=()=>{
                    if(lock||passive||!isMy||this.actions.acted) return;
                    if(manaLack) { this.log("마나 부족", "log-system"); return; }
                    const tType=s.main?.target||'ENEMY_SINGLE';
                    const nonT=['SELF','ALLY_ALL'].includes(tType)||(tType==='AREA_ENEMY'&&(s.main.area||0)>=99)||s.rng===0;
                    if(nonT){ if(this.confirmingSkill&&this.confirmingSkill.id===s.id) this.confirmingSkill=null; else this.confirmingSkill=s; this.selectedSkill=null; this.updateStatusPanel(); }
                    else { this.selectedSkill=(this.selectedSkill&&this.selectedSkill.id===s.id)?null:s; this.confirmingSkill=null; this.updateCursor(); this.updateStatusPanel(); }
                };
                grid.appendChild(btn);
            });
        }
        box.appendChild(grid);
        
        if(isMy) { 
            const tBtn=document.createElement('div'); 
            tBtn.className='turn-btn-wrapper'; 
            tBtn.innerHTML=`<div class="turn-btn">⏩ 턴 종료</div>`; 
            tBtn.onclick=()=>{if(!this.isProcessingTurn) this.endTurn(true);}; 
            box.appendChild(tBtn); 
        }
    }

    showSpeechBubble(u, t) { this.showFloatingText(u, `"${t}"`, '#fff'); }
    processTextQueue() { if(this.textQueue.length>0){ const now=Date.now(); if(!this.lastTextTime||now-this.lastTextTime>200){ const {u,txt,col}=this.textQueue.shift(); const pos=this.getUnitScreenPos(u); const el=document.createElement('div'); el.className='floating-text'; el.textContent=txt; el.style.color=col; Object.assign(el.style,{position:'fixed',left:pos.x+'px',top:(pos.y-20)+'px',pointerEvents:'none',zIndex:'10000',transition:'all 3s',fontSize:'16px',fontWeight:'bold',textShadow:'1px 1px 2px #000'}); document.body.appendChild(el); setTimeout(()=>{ el.style.top=(pos.y-100)+'px'; el.style.opacity='0'; },50); setTimeout(()=>el.remove(),3000); this.lastTextTime=now; } } requestAnimationFrame(()=>this.processTextQueue()); }
    createDummyForStats(u){ return JSON.parse(JSON.stringify(u)); }
    handleStatHover(e,k,p){ if(p&&this.viewingUnit&&this.viewingUnit.statPoints>0) this.updateStatPreviewValues(this.viewingUnit,k); }
    updateStatPreviewValues(u,k){ const cur=this.createDummyForStats(u); const nxt=this.createDummyForStats(u); nxt[k]++; if(k==='vit') nxt.hp+=5; if(k==='int') nxt.mp+=5; const setP=(id,ck)=>{ const v1=Formulas.getDerivedStat(cur,ck); const v2=Formulas.getDerivedStat(nxt,ck); const el=document.getElementById(id); if(el) el.textContent=(v2>v1)?'▲':''; }; const atkKey=u.atkType==='MAG'?'atk_mag':'atk_phys'; setP('prev-atk',atkKey); setP('prev-def','def'); setP('prev-res','res'); setP('prev-crit','crit'); setP('prev-eva','eva'); setP('prev-spd','spd'); }
    allocateStat(k){ const u=this.viewingUnit; if(!u||u.team!==0) return; if(u.statPoints<1) return; u[k]++; u.statPoints--; if(k==='vit'){u.hp+=5;u.curHp+=5;} if(k==='int'){u.mp+=5;u.curMp+=5;} this.updateStatusPanel(); this.showFloatingText(u,"UP!","#ff0"); this.gameApp.saveGame(); }
    applyPerks(baseSkill, caster) { const skill = JSON.parse(JSON.stringify(baseSkill)); if (!caster.perks) return skill; Object.values(caster.perks).forEach(perkId => { if (perkId && perkId.startsWith(skill.id)) { const perkData = PERK_DATA[perkId]; if (perkData) { if (perkData.cost !== undefined) skill.cost = perkData.cost; if (perkData.rng !== undefined) skill.rng = perkData.rng; if (perkData.mp !== undefined) skill.mp = perkData.mp; if (perkData.main) skill.main = { ...skill.main, ...perkData.main }; if (perkData.sub) skill.sub = { ...skill.sub, ...perkData.sub }; } } }); return skill; }
    getUnitScreenPos(unit) { let worldX, worldY; if (unit.visualPos) { worldX = unit.visualPos.x; worldY = unit.visualPos.y; } else { const tKey = this.grid.getTerrain(unit.q, unit.r); const height = TERRAIN_TYPES[tKey]?.height || 0; const p = this.grid.hexToPixel3D(unit.q, unit.r, height); worldX = p.x; worldY = p.y; } const cx = worldX - this.camera.x; const cy = worldY - this.camera.y; const rect = this.grid.canvas.getBoundingClientRect(); const scaleX = rect.width / this.grid.canvas.width; const scaleY = rect.height / this.grid.canvas.height; return { x: rect.left + cx * scaleX, y: rect.top + cy * scaleY }; }
    getCanvasCoordinates(e) { const rect = this.grid.canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
    createProjectile(start, end) { const sPos = this.grid.hexToPixel(start.q, start.r); const ePos = this.grid.hexToPixel(end.q, end.r); this.projectiles.push({ x:sPos.x, y:sPos.y, tx:ePos.x, ty:ePos.y, t:0, speed:0.1 }); }
    triggerBumpAnimation(u, target) { const s = this.grid.hexToPixel(u.q, u.r); const t = this.grid.hexToPixel(target.q, target.r); const dx = t.x - s.x; const dy = t.y - s.y; u.bumpX = dx * 0.3; u.bumpY = dy * 0.3; }
    triggerShakeAnimation(u) { u.shake = 10; }
    gainActionXp(unit, amount) { if (unit.stageActionXp >= 50) { if(!unit.hasShownMaxXpMsg) { this.log("경험치 제한 도달", "log-system"); unit.hasShownMaxXpMsg = true; } return; } unit.stageActionXp = (unit.stageActionXp || 0) + amount; unit.xp += amount; this.checkLevelUp(unit); this.gameApp.saveGame(); }
    gainKillXp(amount) { this.units.filter(u => u.team === 0 && u.curHp > 0).forEach(u => { u.xp += amount; this.showFloatingText(u, `+${amount} XP`, '#fff'); this.checkLevelUp(u); this.gameApp.saveGame(); }); }
    checkLevelUp(unit) { if (!unit.maxXp) return; if (unit.xp >= unit.maxXp) { unit.xp -= unit.maxXp; unit.level++; unit.statPoints += 6; ['str','int','vit','agi','dex','vol','luk'].forEach(s => unit[s]++); unit.maxXp = Math.floor(unit.maxXp * 1.2); const maxHp = Formulas.getDerivedStat(unit, 'hp_max', true); const maxMp = Formulas.getDerivedStat(unit, 'mp_max', true); unit.hp = maxHp; unit.curHp = unit.hp; unit.mp = maxMp; unit.curMp = unit.mp; this.showFloatingText(unit, "LEVEL UP!", "#ffff00"); this.log(`🎉 ${unit.name} 레벨 업!`, 'log-skill'); this.showSpeechBubble(unit, "강해졌다!"); this.gameApp.saveGame(); } }
    handleDeath(unit) {
        const revivePassive = (unit.skills || []).find(s => s.type === 'PASSIVE' && s.main?.type === 'PASSIVE_REVIVE_SELF');
        if (revivePassive && !unit.revivedOnce) {
            unit.revivedOnce = true; 
            const recoverPct = revivePassive.main.val || 0.5;
            unit.curHp = Math.max(1, Math.floor(unit.hp * recoverPct));
            this.showFloatingText(unit, "RESURRECT!", "#ffdd00");
            this.log(`✝️ ${unit.name} 자가 부활! (HP: ${unit.curHp})`, 'log-heal');
            this.triggerShakeAnimation(unit); 
            this.renderPartyList();
            if (this.viewingUnit === unit) this.updateStatusPanel();
            return; 
        }
        this.log(`☠ ${unit.name} 사망`, 'log-dmg'); 
        if (unit.team === 1) { 
            const prog = this.gameApp.gameState.progress; 
            const isRepeat = (this.chapter < prog.chapter) || (this.chapter === prog.chapter && this.stage < prog.stage); 
            let xp = (unit.level || 1) * 20; 
            if (isRepeat) xp = Math.max(1, Math.floor(xp * 0.1)); 
            this.gainKillXp(xp); 
        } 
        const enemies = this.units.filter(u => u.team === 1 && u.curHp > 0).length; 
        const allies = this.units.filter(u => u.team === 0 && u.curHp > 0).length; 
        if (!this.isBattleEnded) { 
            if (enemies === 0) { 
                this.isBattleEnded = true; 
                this.isAutoBattle = false; 
                setTimeout(() => this.gameApp.onBattleEnd(true), 1000); 
            } else if (allies === 0) { 
                this.isBattleEnded = true; 
                this.isAutoBattle = false; 
                setTimeout(() => this.gameApp.onBattleEnd(false, false), 1000); 
            } 
        } 
        this.renderPartyList(); 
    }
    getUnitAt(q, r) { return this.units.find(u => u.q === q && u.r === r && u.curHp > 0); }
    hasStatus(unit, type) { return unit.buffs && unit.buffs.some(b => b.type === type); }
    collectTargets(effectData, targetHex, clickedUnit, caster) { let targets = []; const units = this.units.filter(u => u.curHp > 0); const center = targetHex || caster; const targetType = effectData.target; if (targetType === 'SELF') targets.push(caster); else if (targetType === 'ENEMY_SINGLE' && clickedUnit && clickedUnit.team !== caster.team) targets.push(clickedUnit); else if (targetType === 'ALLY_SINGLE' && clickedUnit && clickedUnit.team === caster.team) targets.push(clickedUnit); else if (targetType === 'AREA_ENEMY') { units.forEach(u => { if (u.team !== caster.team && this.grid.getDistance(u, center) <= (effectData.area||0)) targets.push(u); }); } else if (targetType === 'AREA_CIRCLE' || targetType === 'AREA_SELF') { units.forEach(u => { if (u.team !== caster.team && this.grid.getDistance(u, center) <= (effectData.area||0)) targets.push(u); }); } else if (targetType === 'ALLY_ALL') units.forEach(u => { if (u.team === caster.team) targets.push(u); }); else if (targetType === 'ENEMY_ALL') units.forEach(u => { if (u.team !== caster.team) targets.push(u); }); else if (targetType === 'LINE') { const lineHexes = this.grid.getLine(caster, center, 10); units.forEach(u => { if(u.team !== caster.team && lineHexes.some(h => h.q === u.q && h.r === u.r)) targets.push(u); }); } return targets; }
    centerCameraOnHeroes() { let totalX=0, totalY=0, count=0; const targets = this.units.filter(u => u.team===0).length > 0 ? this.units.filter(u => u.team===0) : this.units; targets.forEach(u => { const p = this.grid.hexToPixel(u.q, u.r); totalX+=p.x; totalY+=p.y; count++; }); if(count>0) { this.camera.x = totalX/count - this.grid.canvas.width/2; this.camera.y = totalY/count - this.grid.canvas.height/2; } }
    handleResize() { const parent = this.grid.canvas.parentElement; if (parent) { this.grid.canvas.width = parent.clientWidth; this.grid.canvas.height = parent.clientHeight; } this.updateFloatingControls(); }
    handleWheel(e) { if (e.target !== this.grid.canvas) return; e.preventDefault(); const delta = e.deltaY > 0 ? -0.1 : 0.1; const newScale = this.grid.scale + delta; this.grid.setScale(newScale); this.updateFloatingControls(); }
    
    injectStyles() {
        if (document.getElementById('battle-system-styles')) return;
        const style = document.createElement('style');
        style.id = 'battle-system-styles';
        style.innerHTML = `
            /* 플로팅 컨트롤 컨테이너 */
            #floating-controls {
                position: fixed; z-index: 9999; 
                display: flex; flex-direction: row; align-items: flex-start; gap: 5px;
                pointer-events: auto; transition: opacity 0.2s;
                transform: translate(-50%, -100%);
            }
            .hud-hidden { opacity: 0 !important; pointer-events: none !important; }

            /* [수정] 스킬 그리드: 높이 40px 고정, 스크롤바 숨김 */
            .float-skill-grid {
                display: grid; 
                grid-template-columns: repeat(3, 1fr);
                gap: 4px; padding: 3px; /* 패딩을 줄여서 높이 최적화 */
                
                background: #151515; border: 1px solid #555; border-radius: 6px;
                width: 130px; 
                height: 42px; /* 아이콘(34)+패딩(3*2)+보정 = 42px 고정 */
                
                overflow-y: hidden; /* 스크롤바 숨김 (JS로 제어) */
                box-shadow: 0 4px 10px rgba(0,0,0,0.9);
            }

            /* 스킬 버튼 */
            .float-skill-btn {
                width: 34px; height: 34px; 
                background: #25252a; border: 1px solid #444; border-radius: 4px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 18px; position: relative; flex-shrink: 0;
            }
            .float-skill-btn:hover { border-color: gold; background: #353540; }
            .float-skill-btn.active { border-color: gold; box-shadow: 0 0 5px gold; background: #443300; }
            .float-skill-btn.locked { opacity: 0.3; pointer-events: none; filter: grayscale(100%); }
            .float-skill-btn.mana-lack { opacity: 0.6; background: #311; border-color: #522; color: #f55; }

            /* 턴 종료 버튼 */
            .float-end-btn {
                width: 34px; height: 34px; 
                background: linear-gradient(135deg, #722, #511); 
                border: 1px solid #944; border-radius: 6px;
                color: white; font-size: 16px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.4);
                margin-top: 3px; /* 그리드 패딩과 줄맞춤 */
            }
            .float-end-btn:hover { background: linear-gradient(135deg, #933, #722); transform: scale(1.05); border-color: #f66; }
            
            /* 오버레이 (HP바, 이름 등) */
            .unit-overlay { position: absolute; transform: translate(-50%, -50%); pointer-events: none; width:0; height:0; }
            /* [수정] H키 안내 문구 스타일 */
            .hud-guide-text { 
                position: absolute; 
                top: -16px; 
                right: 0; 
                font-size: 9px; 
                color: rgba(255, 255, 255, 0.7); 
                font-weight: bold; 
                text-shadow: 1px 1px 0 #000; 
                pointer-events: none; 
                
                /* 기본 상태: 안 보임 */
                opacity: 0; 
                transition: opacity 0.2s; 
            }
            
            /* [신규] 마우스를 올렸을 때만 안내 문구가 보임 */
            #floating-controls:hover .hud-guide-text { 
                opacity: 1; 
            }
            .bar-group { position: absolute; bottom: 35px; left: 50%; transform: translateX(-50%); width: 40px; display: flex; flex-direction: column; gap:1px; }
            .hp-row { display: flex; width: 100%; height: 5px; background: #222; border: 1px solid #000; }
            .hp-fill { background: #f44; height: 100%; transition: width 0.2s; }
            .shield-fill { background: #00bfff; height: 100%; transition: width 0.2s; }
            .xp-fill { background: #7a7a7a; height: 100%; transition: width 0.2s; }
            .ag-row { width: 100%; height: 3px; background: #000; border: 1px solid #000; }
            .ag-fill { background: #ffd700; height: 100%; transition: width 0.2s; }

            .name-tag { position: absolute; top: 25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #ccc; font-size: 9px; padding: 1px 3px; border-radius: 3px; white-space: nowrap; text-shadow: 1px 1px 1px #000; border: 1px solid #333; z-index: 20; }

            .turn-highlight-circle { position: absolute; top: 20px; left: 0; width: 50px; height: 30px; border: 2px solid #ffd700; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 10px #ffd700; z-index: -1; animation: pulseBorder 1.5s infinite; }
            @keyframes pulseBorder { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } 50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } }
            
            .item-confirm-popup { position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; background: rgba(0,0,0,0.9); padding: 4px; border-radius: 4px; border: 1px solid #666; z-index: 9999; }
        `;
        document.head.appendChild(style);
    }
    
    regenResources(unit) { if (unit.curHp <= 0) return; const hpRegen = Formulas.getDerivedStat(unit, 'hp_regen'); const mpRegen = Formulas.getDerivedStat(unit, 'mp_regen'); unit.curHp = Math.min(unit.hp, unit.curHp + hpRegen); if(unit.mp > 0) unit.curMp = Math.min(unit.mp, unit.curMp + mpRegen); }
}