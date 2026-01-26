import { ELEMENTS, STAT_NAMES, CLASS_DATA, EFFECTS, HEX_SIZE, ITEM_DATA, STAGE_DATA } from './data.js';
import { createCursorFromEmoji } from './hex.js';

export class BattleSystem {
    constructor(grid, gameApp, chapter, stage) {
        this.grid = grid;
        this.gameApp = gameApp;
        this.chapter = Number(chapter);
        this.stage = Number(stage);
        this.units = [];
        this.turnQueue = [];
        this.currentUnit = null;
        this.viewingUnit = null; 
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.actions = { moved: false, attacked: false, skilled: false };
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

        this.initUnits(chapter, stage);
        this.processTextQueue(); 
        this.startTurn();
        this.bindEvents();
    }

    bindEvents() {
        this.grid.canvas.onmousedown = (e) => this.handleMouseDown(e);
        this.grid.canvas.onmousemove = (e) => this.handleMouseMove(e);
        this.grid.canvas.onmouseup = (e) => this.handleMouseUp(e);
        this.grid.canvas.onmouseleave = () => { 
             this.isMouseDown = false;
             this.isDraggingMap = false; 
             this.hideTooltip(); 
        };
        window.battle = this; 
    }

    getCanvasCoordinates(e) {
        const rect = this.grid.canvas.getBoundingClientRect();
        const scaleX = this.grid.canvas.width / rect.width;
        const scaleY = this.grid.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    initUnits(chapter, stage) {
        let idCounter = 1;
        let enemySpawnCount = 0; 
        const occupied = new Set();

        const myTeamData = this.gameApp.gameState.heroes.length > 0 
            ? this.gameApp.gameState.heroes 
            : [CLASS_DATA['KNIGHT'], CLASS_DATA['CLERIC']];

        const spawn = (data, team) => {
            let q, r;
            if (team === 0) {
                const col = 6 + (idCounter % 2); 
                const row = 3 + Math.floor((idCounter - 1) / 2) * 2;
                q = col - (row - (row & 1)) / 2;
                r = row;
            } else {
                enemySpawnCount++;
                const col = 15 - (enemySpawnCount % 2); 
                const row = 3 + Math.floor((enemySpawnCount - 1) / 2) * 2;
                q = col - (row - (row & 1)) / 2;
                r = row;
            }

            while(occupied.has(`${q},${r}`)) { r++; }
            occupied.add(`${q},${r}`);

            let unit;
            if (team === 0) {
                unit = data; 
                unit.q = q; unit.r = r; 
                unit.buffs = []; unit.cooldowns = {};
            } else {
                unit = JSON.parse(JSON.stringify(data));
                unit.q = q; unit.r = r; 
                unit.curHp = unit.hp; unit.curMp = unit.mp;
                unit.buffs = []; unit.cooldowns = {};
                unit.equipment = { weapon: null, armor: null, acc1: null, acc2: null, potion1: null, potion2: null };
            }

            unit.id = idCounter++;
            unit.team = team;
            unit.shake = 0; unit.bumpX = 0; unit.bumpY = 0;
            unit.stageActionXp = 0;
            unit.hasShownMaxXpMsg = false; // [NEW] Max XP 메시지 플래그
            
            if (team === 1 && chapter > 1) {
                const boost = (chapter - 1) * 0.5;
                unit.hp = Math.floor(unit.hp * (1 + boost));
                unit.str = Math.floor(unit.str * (1 + boost));
                unit.curHp = unit.hp;
            }
            this.units.push(unit);
        };

        myTeamData.forEach(d => spawn(d, 0));

        const stageInfo = STAGE_DATA[chapter] && STAGE_DATA[chapter][stage];
        if (stageInfo && stageInfo.enemies) {
            stageInfo.enemies.forEach(enemyKey => {
                if (CLASS_DATA[enemyKey]) spawn(CLASS_DATA[enemyKey], 1);
            });
        } else {
            const enemyCount = 1 + Math.floor(stage / 2);
            for(let i=0; i<enemyCount; i++) {
                spawn(CLASS_DATA['SLIME'], 1);
            }
        }
        // 1. 맵에 존재하는 모든 타일의 픽셀 좌표 합산
let totalTileX = 0;
let totalTileY = 0;
let tileCount = 0;

this.grid.hexes.forEach((_, key) => {
    const [q, r] = key.split(',').map(Number);
    const pos = this.grid.hexToPixel(q, r);
    totalTileX += pos.x;
    totalTileY += pos.y;
    tileCount++;
});

// 2. 모든 타일의 평균 좌표(정중앙)로 카메라 이동
if (tileCount > 0) {
    const centerX = totalTileX / tileCount;
    const centerY = totalTileY / tileCount;

    // 카메라의 좌상단 좌표를 (중앙 - 화면 절반)으로 설정하여 맵 중앙을 화면에 맞춤
    this.camera.x = centerX - (this.grid.canvas.width / 2);
    this.camera.y = centerY - (this.grid.canvas.height / 2);
}
        this.turnQueue = [...this.units].sort((a, b) => this.getStat(b, 'spd') - this.getStat(a, 'spd'));
    }
getEquipBonus(unit, stat) {
        let bonus = 0;
        if (!unit.equipment) return 0;
        
        Object.values(unit.equipment).forEach(itemId => {
            const item = ITEM_DATA[itemId];
            if (!item || !item.val) return;

            // 1. 무기: 공격 타입에 따라 str 또는 int에 보너스 합산
            if (item.type === 'WEAPON') {
                if (stat === 'str' && unit.atkType === 'PHYS') bonus += Number(item.val);
                if (stat === 'int' && unit.atkType === 'MAG') bonus += Number(item.val);
            } 
            // 2. 방어구: def(물리방어)에 보너스 합산
            else if (item.type === 'ARMOR' && stat === 'def') {
                bonus += Number(item.val);
            }
            // 3. 기타 액세서리 등: 아이템에 명시된 stat과 일치할 때 합산
            else if (item.stat === stat) {
                bonus += Number(item.val);
            }
        });
        return bonus;
    }
getStat(unit, stat, excludeBuffs = false) {
    // 1. 기초 스탯 가져오기 (NaN 방지를 위해 0 기본값 설정)
    let val = Number(unit[stat]) || 0;

    // 2. 장비 스탯 합산 로직
    if (unit.equipment) {
    
        Object.values(unit.equipment).forEach(itemId => {
            const item = ITEM_DATA[itemId];
            if (!item || !item.val) return; // 아이템 데이터가 없거나 수치가 없으면 스킵

            if (item.type === 'WEAPON') {
                if (stat === 'str' && unit.atkType === 'PHYS') val += Number(item.val);
                if (stat === 'int' && unit.atkType === 'MAG') val += Number(item.val);
            } 
                       else if (item.type === 'ARMOR' && stat === 'def') {
                val += Number(item.val);
            }
            
            else if (item.stat === stat) {
                val += Number(item.val);
            }
        });
    }

        if (stat === 'res') {const currentInt = this.getStat(unit, 'int', excludeBuffs);
        val += Math.floor(currentInt * 0.5);
    }
        if (stat === 'tenacity') {
    // 공식: 레벨 + (VIT * 0.5) + (AGI * 0.5)
    const baseVit = this.getStat(unit, 'vit', true);
    const baseAgi = this.getStat(unit, 'agi', true);
    val = (unit.level || 1) + Math.floor((baseVit * 0.5) + (baseAgi * 0.5));
}
        if (stat === 'crit') val = (unit.dex || 0) * 0.5;
        if (stat === 'eva') val = (unit.agi || 0) * 0.5;

        if (!excludeBuffs) {
            unit.buffs.forEach(b => {
                if (['str', 'int', 'vit', 'agi', 'def', 'dex'].includes(stat)) {
                    if (b.type === 'ATK_UP' && (stat === 'str' || stat === 'int')) val *= b.mult;
                    if (b.type === 'DEF_UP' && stat === 'def') val *= b.mult;
                    if (b.type === 'ATK_DOWN' && (stat === 'str' || stat === 'int')) val *= 0.5;
                    if (b.type === 'DEF_DOWN' && stat === 'def') val *= 0.5;
                    if (b.type === 'BURN' && stat === 'def') val *= 0.8;
                }
                if (stat === 'spd') {
                    if (b.type === 'SPD_DOWN') val *= b.mult;
                    if (b.type === 'INIT') val *= 2;
                }
                if (stat === 'mov') {
                    if (b.type === 'ROOT') val = 0;
                    if (b.type === 'FREEZE') val = 0;
                    if (b.type === 'SPD_MOVE') val += (b.mult > 1 ? 1 : -1);
                }
                if (stat === 'crit' && b.type === 'CRIT_UP') val += 30;
                if (stat === 'eva' && b.type === 'EVA') val += 30;
            });
        }

        if (stat === 'crit' || stat === 'eva') return val; 
        return Math.floor(val);
    }

    getDerivedStat(unit, type, excludeBuffs = false) {
        if (type === 'atk_phys') return this.getStat(unit, 'str', excludeBuffs);
        if (type === 'atk_mag') return this.getStat(unit, 'int', excludeBuffs);
        if (type === 'def') return this.getStat(unit, 'def', excludeBuffs);
        if (type === 'res') return this.getStat(unit, 'res', excludeBuffs);
        if (type === 'crit') return this.getStat(unit, 'crit', excludeBuffs);
        if (type === 'eva') return this.getStat(unit, 'eva', excludeBuffs);
        if (type === 'spd') return this.getStat(unit, 'spd', excludeBuffs);
        if (type === 'hp_max') return unit.hp; 
        if (type === 'mp_max') return unit.mp;
        if (type === 'hp_regen') return Math.max(1, Math.floor(this.getStat(unit, 'vit', excludeBuffs) * 0.5));
        if (type === 'mp_regen') return Math.max(1, Math.floor(this.getStat(unit, 'int', excludeBuffs) * 0.5));
        if (type === 'mov') return this.getStat(unit, 'mov', excludeBuffs);
        if (type === 'rng') return this.getStat(unit, 'rng', excludeBuffs);
        return 0;
    }

    regenResources(unit) {
        if (unit.curHp <= 0) return;
        const hpRegen = this.getDerivedStat(unit, 'hp_regen');
        const mpRegen = this.getDerivedStat(unit, 'mp_regen');
        unit.curHp = Math.min(unit.hp, unit.curHp + hpRegen);
        if(unit.mp > 0) unit.curMp = Math.min(unit.mp, unit.curMp + mpRegen);
    }

    showSpeechBubble(unit, text) {
        this.showFloatingText(unit, `"${text}"`, '#ffffff');
    }

    startTurn() {
        if (this.units.filter(u => u.team === 0).length === 0 || 
            this.units.filter(u => u.team === 1).length === 0) return;

            
        this.currentUnit = this.turnQueue.shift();
        this.turnQueue.push(this.currentUnit);
        
        if (this.currentUnit.curHp <= 0) { 
            this.startTurn(); 
            return; 
        }

        this.isProcessingTurn = true;
        this.log(`▶ ${this.currentUnit.name}의 턴`, 'log-turn');
        this.regenResources(this.currentUnit);
        this.viewingUnit = this.currentUnit;

        let skipTurn = false;
        
        for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
            const b = this.currentUnit.buffs[i];
            const info = EFFECTS[b.type];

            if (['STUN', 'FREEZE', 'SLEEP'].includes(b.type)) {
                this.log(`${this.currentUnit.name}: [${info.name}] 행동 불가!`, 'log-cc');
                this.showFloatingText(this.currentUnit, info.name, '#ff00ff');
                skipTurn = true;
            }

            if (b.type === 'BURN') {
                let dmg = Math.max(1, b.power || 10);
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                this.log(`🔥 화상 피해: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, '#ff8800');
                
                const neighbors = this.grid.getNeighbors(this.currentUnit);
                neighbors.forEach(n => {
                    const target = this.getUnitAt(n.q, n.r);
                    if (target && target.team === this.currentUnit.team && Math.random() < 0.3) {
                        this.applyStatus(target, { type: 'BURN', duration: 2 }, this.currentUnit);
                    }
                });

            } else if (b.type === 'POISON') {
                let dmg = Math.floor(this.currentUnit.hp * 0.05); dmg = Math.max(1, dmg);
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                this.log(`☠️ 맹독 피해: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, '#88ff00');
            }

            b.duration--;
            if (b.duration <= 0) this.currentUnit.buffs.splice(i, 1);
        }

        if (this.currentUnit.curHp <= 0) { 
            this.handleDeath(this.currentUnit); 
            this.endTurn(); 
            return; 
        }

        if (skipTurn) {
            this.updateStatusPanel();
            this.renderPartyList();
            setTimeout(() => this.endTurn(), 800);
            return;
        }

        this.actions = { moved: false, attacked: false, skilled: false };
        this.selectedSkill = null;
        this.confirmingSkill = null;

        if (!this.hasStatus(this.currentUnit, 'SHOCK')) {
            for (let skId in this.currentUnit.cooldowns) {
                if (this.currentUnit.cooldowns[skId] > 0) this.currentUnit.cooldowns[skId]--;
            }
        } else {
            this.log("⚡ 감전 상태! 쿨타임 정지.");
        }

        if (this.getStat(this.currentUnit, 'mov') <= 0) {
            this.actions.moved = true; 
            this.log("이동 불가 상태.");
        }

        this.updateStatusPanel();
        this.renderPartyList();
        this.updateCursor();

        if (this.currentUnit.team === 1) {
            this.runAI();
        } else {
            this.isProcessingTurn = false;
            this.calcReachable();
            this.renderUI();
            if (this.isAutoBattle) {
                setTimeout(() => this.runAllyAutoAI(), 300);}
        }
    }

    endTurn() { 
        this.isProcessingTurn = false;
        setTimeout(() => this.startTurn(), 100);
    }

    getStatCost(unit, statKey) {
        const val = unit[statKey] || 0;
        if (val >= 40) return 3;
        if (val >= 20) return 2;
        return 1;
    }

    allocateStat(statKey) {
        const unit = this.viewingUnit; 
        if (!unit || unit.team !== 0) return;
        const cost = this.getStatCost(unit, statKey);
        if (unit.statPoints < cost) {
            this.log(`포인트 부족! (필요: ${cost})`);
            return;
        }
        
        unit[statKey]++;
        unit.statPoints -= cost;
        if (statKey === 'vit') { unit.hp += 5; unit.curHp += 5; }
        else if (statKey === 'int') { unit.mp += 5; unit.curMp += 5; }

        this.log(`${unit.name}: ${STAT_NAMES[statKey]} 상승!`, 'log-effect');
        this.updateStatusPanel(); 
        this.showFloatingText(unit, "UP!", "#ffff00");
    }

    createDummyForStats(unit) {
        const d = JSON.parse(JSON.stringify(unit));
        d.buffs = unit.buffs; 
        return d;
    }

    handleStatHover(e, key, isPreview = false) {
        const u = this.viewingUnit;
        if (isPreview && u) {
            const cost = this.getStatCost(u, key);
            if (u.statPoints >= cost) {
                this.updateStatPreviewValues(u, key);
            }
        }
    }

    updateStatPreviewValues(unit, statKey) {
        const dummyCurrent = this.createDummyForStats(unit);
        const dummyNext = this.createDummyForStats(unit);
        dummyNext[statKey]++;
        if(statKey === 'vit') dummyNext.hp += 5; 
        if(statKey === 'int') dummyNext.mp += 5;

        const setPreview = (id, curKey) => {
            const v1 = this.getDerivedStat(dummyCurrent, curKey); 
            const v2 = this.getDerivedStat(dummyNext, curKey);
            const el = document.getElementById(id);
            if (el) {
                if (v2 > v1) el.textContent = `▲`;
                else el.textContent = ``; 
            }
        };

        const atkKey = unit.atkType === 'MAG' ? 'atk_mag' : 'atk_phys';
        setPreview('prev-atk', atkKey);
        setPreview('prev-def', 'def');
        setPreview('prev-res', 'res');
        setPreview('prev-hp_max', 'hp_max');
        setPreview('prev-hpr', 'hp_regen');
        setPreview('prev-mp_max', 'mp_max');
        setPreview('prev-mpr', 'mp_regen');
        setPreview('prev-crit', 'crit');
        setPreview('prev-eva', 'eva');
        setPreview('prev-ten', 'tenacity');
        
        const baseEl = document.getElementById(`prev-base-${statKey}`);
        if(baseEl) baseEl.textContent = `▲`;
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
            }
        } else {
            const worldX = pos.x + this.camera.x;
            const worldY = pos.y + this.camera.y;
            this.hoverHex = this.grid.pixelToHex(worldX, worldY);
            
            if (this.hoverHex) {
                const u = this.getUnitAt(this.hoverHex.q, this.hoverHex.r);
                if (u) {
                    const ele = ELEMENTS[u.element || 'NONE'].name;
                    const statusText = u.buffs.map(b => `${b.icon}${b.name}(${b.duration})`).join(', ') || '없음';
                    let eleInfo = "";
                    if (this.currentUnit && this.currentUnit.team === 0 && u.team !== 0) {
                        const myEle = this.currentUnit.element || 'NONE';
                        const targetEle = u.element || 'NONE';
                        if (ELEMENTS[myEle].strong === targetEle) eleInfo = `<br><span style="color:#ffcc00; font-weight:bold;">[상성 유리: Weak!]</span>`;
                        else if (ELEMENTS[myEle].weak === targetEle) eleInfo = `<br><span style="color:#aaa; font-weight:bold;">[상성 불리: Resist]</span>`;
                    }
                    const html = `
                    <div style='color:${u.team===0?"#48f":"#f44"}; font-weight:bold; font-size:16px'>${u.name} <span style='font-size:12px; color:#aaa;'>Lv.${u.level}</span></div>
                    <div style='font-size:12px'>속성: ${ele} ${eleInfo}</div>
                    <hr style='margin:5px 0; border-color:#555'>
                    <div>HP: <span style='color:#f55'>${Math.floor(u.curHp)}</span> / ${u.hp}</div>
                    <div>MP: <span style='color:#0cf'>${Math.floor(u.curMp)}</span> / ${u.mp}</div>
                    <div style='margin-top:5px; color:#ccc; font-size:11px;'>상태: ${statusText}</div>
                    `;
                    this.showTooltip(e, html);
                } else {
                    this.hideTooltip();
                }
            }
        }
        this.updateCursor();
    }

    updateStatusPanel() {
        const p = document.getElementById('bottom-panel');
        if(!this.viewingUnit) { p.innerHTML = '<div style="margin:auto;color:#666">유닛을 선택하세요</div>'; return; }
        
        const u = this.viewingUnit;
        
        const createRow = (key, label, val, isBase, idPrefix='val') => {
            let btnHtml = '';
            if (isBase && u.team === 0 && u.statPoints > 0) {
                const cost = this.getStatCost(u, key);
                const disabled = u.statPoints < cost ? 'disabled' : '';
                btnHtml = `<button class="stat-up-btn ${disabled}" 
                    ${disabled ? '' : `onclick="window.battle.allocateStat('${key}')"`}
                    onmouseenter="window.battle.handleStatHover(event, '${key}', true)"
                    onmouseleave="window.battle.hideTooltip()">+</button>`;
            }

            let valClass = 'val-normal';
            let displayVal = val;
            if (key === 'crit' || key === 'eva') displayVal = parseFloat(val).toFixed(1) + '%';
            
            if (!isBase) {
                const currentVal = parseFloat(val);
                const baseVal = this.getDerivedStat(u, key === 'atk' ? (u.atkType==='MAG'?'atk_mag':'atk_phys') : key, true);
                if (key !== 'mov' && key !== 'rng') {
                    if (currentVal > baseVal) valClass = 'val-buff';
                    else if (currentVal < baseVal) valClass = 'val-debuff';
                }
            }
            const previewSpan = `<span id="prev-${idPrefix==='val'?'':idPrefix+'-'}${key}" class="stat-arrow"></span>`;
            return `<div class="stat-row">
                <span class="stat-label">${label}</span>
                <div class="stat-val-box">
                    <span id="${idPrefix}-${key}" class="stat-val ${valClass}">${displayVal}</span>
                    ${previewSpan}
                    ${btnHtml}
                </div>
            </div>`;
        };

        const atk = u.atkType === 'MAG' ? this.getStat(u, 'int') : this.getStat(u, 'str');
        const atkLabel = u.atkType === 'MAG' ? '공격력(마법)' : '공격력(물리)';
        const def = this.getStat(u, 'def');
        const statusListHtml = u.buffs.length > 0 
            ? u.buffs.map(b => `<div class="status-text-item">${b.icon} <b>${b.name}</b>: ${EFFECTS[b.type]?.desc}</div>`).join('') 
            : `<div class="status-text-item" style="color:#666;text-align:center;">상태이상 없음</div>`;

     p.innerHTML = `
            <div class="bp-col col-profile">
                <div class="portrait-lg">${u.icon}</div>
                <div class="basic-name">${u.name}</div>
                <div class="basic-lv">Lv.${u.level} ${u.team===0?'(Hero)':'(Enemy)'}</div>
                <div style="font-size:11px; width:100%; margin-top:5px;">
                    HP <div class="bar-container"><div class="bar-fill hp-fill" style="width:${(u.curHp/u.hp)*100}%"></div><div class="bar-text">${Math.floor(u.curHp)}/${u.hp}</div></div>
                    MP <div class="bar-container"><div class="bar-fill mp-fill" style="width:${(u.curMp/u.mp)*100}%"></div><div class="bar-text">${Math.floor(u.curMp)}/${u.mp}</div></div>
                    <div style="height:2px; margin-top:2px; background:#222;"><div style="height:100%; width:${(u.xp/u.maxXp)*100}%; background:#ccc;"></div></div>
                </div>
            </div>

            <div class="bp-col col-base">
                <div class="bp-header">기초</div>
                ${createRow('str', '힘', u.str, true, 'val-base')}
                ${createRow('int', '지능', u.int, true, 'val-base')}
                ${createRow('vit', '체력', u.vit, true, 'val-base')}
                ${createRow('agi', '민첩', u.agi, true, 'val-base')}
                ${createRow('dex', '손재주', u.dex, true, 'val-base')}
                ${createRow('def', '방어', u.def, true, 'val-base')}
                ${u.statPoints > 0 ? `<div style="text-align:center;color:gold;font-size:11px;margin-top:5px;">PT: ${u.statPoints}</div>` : ''}
            </div>

            <div class="bp-col col-combat">
                <div class="bp-header">전투</div>
                ${createRow('atk', atkLabel, atk, false)}
                ${createRow('def', '물리방어', def, false)}
                ${createRow('res', '마법저항', this.getStat(u,'res'), false)}
                ${createRow('hp_max', '최대체력', u.hp, false)}
                ${createRow('hpr', '체력재생', this.getDerivedStat(u,'hp_regen'), false)}
                ${createRow('mp_max', '최대마나', u.mp, false)}
                ${createRow('mpr', '마나재생', this.getDerivedStat(u,'mp_regen'), false)}
                ${createRow('crit', '치명타율', this.getStat(u,'crit'), false)}
                ${createRow('eva', '회피율', this.getStat(u,'eva'), false)}
                ${createRow('ten', '상태저항', this.getStat(u,'tenacity'), false)}
                ${createRow('spd', '속도', this.getStat(u,'spd'), false)}
            </div>

            <div class="bp-col col-control" id="control-panel-grid"></div>

            <div class="bp-col col-status">
                <div class="bp-header">상태</div>
                <div class="status-list">${statusListHtml}</div>
                <div class="action-flags">
                    <div class="flag-pill ${this.actions.moved?'done':'available'}">이동</div>
                    <div class="flag-pill ${this.actions.attacked?'done':'available'}">공격</div>
                    <div class="flag-pill ${this.actions.skilled?'done':'available'}">스킬</div>
                </div>
            </div>
        `;
        if (this.currentUnit.team === 0 && !this.isProcessingTurn) {
            this.renderUI();
        }
        
        const logFooter = document.getElementById('log-footer');
        if(logFooter) {
            logFooter.innerHTML = `<button id="btn-surrender" style="width:100%; background:#422; color:#f88; border:1px solid #633; padding:5px; cursor:pointer;">🏳️ 항복하기</button>`;
            document.getElementById('btn-surrender').onclick = () => {
                this.gameApp.showConfirm("정말 항복하시겠습니까? (패배 처리, 보상 없음)", () => {
                    this.gameApp.onBattleEnd(false, true);
                });
            };
        }
        
    }

    renderPartyList() {
        const listContainer = document.getElementById('party-list');
        listContainer.innerHTML = '';
        
        // 레이아웃 설정을 위해 flex-direction을 column으로 고정
        listContainer.style.display = "flex";
        listContainer.style.flexDirection = "column";
        listContainer.style.height = "100%";

        // 1. [영역 분리] 유닛 리스트 스크롤 영역 생성
        const scrollArea = document.createElement('div');
        scrollArea.style.flex = "1";
        scrollArea.style.overflowY = "auto";
        scrollArea.style.paddingRight = "5px";

        this.units.filter(u => u.team === 0).forEach(u => {
            const div = document.createElement('div');
            div.className = `party-unit ${u===this.currentUnit?'active-turn':''} ${u===this.viewingUnit?'viewing':''}`;
            
            const hpPct = (u.curHp / u.hp) * 100;
            const mpPct = (u.curMp / u.mp) * 100;
            const xpPct = (u.xp / u.maxXp) * 100;
            const isDead = u.curHp <= 0;
            const statusIcons = u.buffs.map(b => b.icon).slice(0, 5).join(' ');

            // [수정] 아이콘 옆 오른쪽에 배치될 LVUP 버튼 로직
            // 스탯 포인트가 있을 때만 버튼이 보입니다.
            const lvUpBtn = u.statPoints > 0 
                ? `<button class="lv-up-inner-btn" onclick="event.stopPropagation(); window.battle.viewingUnit=window.battle.units.find(x=>x.id===${u.id}); window.battle.updateStatusPanel();">LVUP</button>` 
                : '';

            div.innerHTML = `
    <div style="display:flex; align-items:center; width:100%; gap:12px; padding:8px;">
        <div class="party-portrait" style="width:50px; height:50px; font-size:30px; ${isDead?'filter:grayscale(100%)':''}">${u.icon}</div>
        
        <div class="party-info-stack" style="flex:1; display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="party-name" style="font-weight:bold;">${u.name}</span>
                <span style="font-size:11px; color:#aaa;">Lv.${u.level}</span>
            </div>
            <div class="bar-container" style="height:6px;"><div class="bar-fill hp-fill" style="width:${hpPct}%"></div></div>
            <div class="bar-container" style="height:4px;"><div class="bar-fill mp-fill" style="width:${mpPct}%"></div></div>
            <div class="bar-container" style="height:2px;"><div class="bar-fill xp-fill" style="width:${xpPct}%"></div></div>
            <div style="font-size:12px; margin-top:2px; min-height:14px;">${statusIcons}</div>
        </div>

        <div style="width:40px; display:flex; justify-content:center;">
            ${lvUpBtn}
        </div>
    </div>
`;

            div.onclick = () => { 
                this.viewingUnit = u; 
                this.updateStatusPanel(); 
                this.renderPartyList(); 
            };
            scrollArea.appendChild(div);
        });

        listContainer.appendChild(scrollArea);

        // 2. [영역 분리] 하단 자동 전투 버튼 고정 영역
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        footer.innerHTML = `
            <button id="btn-auto-toggle" class="auto-btn-sidebar ${this.isAutoBattle ? 'active' : ''}">
                ${this.isAutoBattle ? '🤖 자동 전투 ON' : '⚔️ 자동 전투 OFF'}
            </button>
        `;
        listContainer.appendChild(footer);

        // 자동 전투 버튼 클릭 이벤트 연결
        const autoBtn = footer.querySelector('#btn-auto-toggle');
        autoBtn.onclick = () => {
            this.isAutoBattle = !this.isAutoBattle;
            this.log(`자동 전투 ${this.isAutoBattle ? '활성화' : '비활성화'}`, "log-system");
            this.renderPartyList(); // 버튼 상태(색상 등) 갱신을 위해 다시 그림
            
            // 아군 턴일 때 자동전투를 켜면 즉시 실행
            if (this.isAutoBattle && this.currentUnit?.team === 0 && !this.isProcessingTurn) {
                this.runAllyAutoAI();
            }
        };
    }

    createProjectile(start, end) {
        const sPos = this.grid.hexToPixel(start.q, start.r);
        const ePos = this.grid.hexToPixel(end.q, end.r);
        this.projectiles.push({ x:sPos.x, y:sPos.y, tx:ePos.x, ty:ePos.y, t:0, speed:0.1 });
    }
    triggerBumpAnimation(u, target) {
        const s = this.grid.hexToPixel(u.q, u.r);
        const t = this.grid.hexToPixel(target.q, target.r);
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        u.bumpX = dx * 0.3; 
        u.bumpY = dy * 0.3;
    }
    triggerShakeAnimation(u) { u.shake = 10; }

    async runAI() {
        const aiUnit = this.currentUnit;
        this.isProcessingTurn = true; 
        this.log(`🤖 ${aiUnit.name} 생각 중...`, 'log-effect');
        await new Promise(r => setTimeout(r, 600));

        if (this.hasStatus(aiUnit, 'CONFUSE')) {
             this.log(`😵 ${aiUnit.name} 혼란!`, 'log-cc');
             await new Promise(r => setTimeout(r, 600));
             const neighbors = this.grid.getNeighbors(aiUnit);
             if(neighbors.length > 0) {
                 const rnd = neighbors[Math.floor(Math.random() * neighbors.length)];
                 await this.moveUnit(aiUnit, rnd.q, rnd.r);
             }
             this.endTurn(); return;
        }

        let forcedTarget = null;
        const tauntBuff = aiUnit.buffs.find(b => b.type === 'TAUNT');
        if (tauntBuff && tauntBuff.casterId) {
            forcedTarget = this.units.find(u => u.id === tauntBuff.casterId && u.curHp > 0);
            if(forcedTarget) this.log("🤬 도발 당함!", "log-cc");
        }

        let targets = this.units.filter(u => u.team === 0 && u.curHp > 0);
        if (targets.length === 0) { this.endTurn(); return; }

        let target = forcedTarget;
        if (!target) {
            let minD = 999;
            targets.forEach(u => {
                const d = this.grid.getDistance(aiUnit, u);
                if(d < minD) { minD = d; target = u; }
            });
        }
        
        if (!target) { this.endTurn(); return; }

        const dist = this.grid.getDistance(aiUnit, target);
        
        if (dist > aiUnit.rng) {
             this.calcReachable();
             let bestHex = null; let minD = 999;
             this.reachableHexes.forEach(h => {
                 const d = this.grid.getDistance(h, target);
                 if (d < minD) { minD = d; bestHex = h; }
             });
             
             if (bestHex) {
                 await this.moveUnit(aiUnit, bestHex.q, bestHex.r);
             }
        }

        const newDist = this.grid.getDistance(aiUnit, target);
        let actionDone = false;
        
        if (aiUnit.skills) {
            const usableSkill = aiUnit.skills.find(s => 
                aiUnit.curMp >= s.mp && (aiUnit.cooldowns[s.id] || 0) === 0 &&
                newDist <= s.rng
            );
            if (usableSkill) {
                this.selectedSkill = usableSkill;
                await new Promise(r => setTimeout(r, 300));
                this.tryExecuteSkill(target, target); 
                actionDone = true;
            }
        }

        if (!actionDone && newDist <= aiUnit.rng) {
            await new Promise(r => setTimeout(r, 300));
            this.performAttack(aiUnit, target, 1.0, "공격");
            actionDone = true;
        }

        setTimeout(() => this.endTurn(), 500);
    }

    async runAllyAutoAI() {
    if (!this.isAutoBattle || this.currentUnit.team !== 0) return;
    this.isProcessingTurn = true;
    await new Promise(r => setTimeout(r, 600));

    const unit = this.currentUnit;
    const enemies = this.units.filter(u => u.team === 1 && u.curHp > 0);
    const allies = this.units.filter(u => u.team === 0 && u.curHp > 0);
    
    if (enemies.length === 0) { this.endTurn(); return; }

    // --- 1. [힐러 로직] (기존 유지) ---
    if (unit.classKey === 'CLERIC' || unit.atkType === 'MAG') {
        const woundedAlly = allies.find(a => a.curHp < a.hp * 0.6);
        const healSkill = unit.skills?.find(s => s.main.type === 'HEAL');
        
        if (woundedAlly && healSkill && unit.curMp >= healSkill.mp && (unit.cooldowns[healSkill.id] || 0) === 0) {
            if (this.grid.getDistance(unit, woundedAlly) <= healSkill.rng) {
                this.selectedSkill = healSkill;
                await new Promise(r => setTimeout(r, 300));
                this.tryExecuteSkill(woundedAlly, woundedAlly);
                await new Promise(r => setTimeout(r, 500));
                this.endTurn(); return;
            }
        }
    }

    // --- 2. [지능형 타겟팅] 공격 가능한 적 중 최우선 순위 선정 ---
    this.calcReachable(); // 이동 범위 계산
    
    // 공격 가능한 적(이동해서라도 때릴 수 있는 적) 필터링
    let reachableEnemies = enemies.filter(e => 
        this.reachableHexes.some(h => this.grid.getDistance(h, e) <= unit.rng) || 
        this.grid.getDistance(unit, e) <= unit.rng
    );

    let target;
    if (reachableEnemies.length > 0) {
        // 때릴 수 있는 적이 있다면 그중 체력 낮은 순으로 타겟팅
        target = [...reachableEnemies].sort((a, b) => (a.curHp / a.hp) - (b.curHp / b.hp))[0];
    } else {
        // 모든 적이 이동 거리 밖에 있다면, 그냥 가장 만만한 놈 향해 전진
        target = [...enemies].sort((a, b) => (a.curHp / a.hp) - (b.curHp / b.hp))[0];
    }

    // --- 3. [이동 전략] 포지셔닝 ---
    if (!this.actions.moved) {
        let bestHex = { q: unit.q, r: unit.r };
        let bestScore = -9999;

        this.reachableHexes.concat([{q: unit.q, r: unit.r}]).forEach(h => {
            if (this.getUnitAt(h.q, h.r) && (h.q !== unit.q || h.r !== unit.r)) return;

            const distToTarget = this.grid.getDistance(h, target);
            let score = 0;

            if (unit.rng > 1) {
                if (distToTarget === unit.rng) score = 1000;
                else if (distToTarget < unit.rng) score = 500 + distToTarget; 
                else score = 1000 - (distToTarget - unit.rng) * 100;
            } else {
                score = 1000 - distToTarget; 
            }

            if (score > bestScore) {
                bestScore = score;
                bestHex = h;
            }
        });

        if (bestHex.q !== unit.q || bestHex.r !== unit.r) {
            await this.moveUnit(unit, bestHex.q, bestHex.r);
        }
    }

    // --- 4. [최종 타겟 확정] 이동 후 내 사거리 안에 들어온 '실제 타겟' 재설정 ---
    // 이동 후에 원래 목표가 사거리 밖일 수 있으므로, 현재 사거리 내 적들을 다시 확인
    let enemiesInRange = enemies.filter(e => this.grid.getDistance(unit, e) <= unit.rng);
    
    if (enemiesInRange.length > 0) {
        // 원래 타겟이 사거리 안에 있다면 유지, 없다면 사거리 안의 적 중 가장 피 낮은 놈 선택
        if (!enemiesInRange.includes(target)) {
            target = [...enemiesInRange].sort((a, b) => (a.curHp / a.hp) - (b.curHp / b.hp))[0];
            this.log(`⚔️ ${unit.name}: 주변의 ${target.name}으로 공격 대상을 변경!`, 'log-effect');
        }

        // --- 5. [공격 실행] 스킬 또는 평타 ---
        let actionDone = false;
        if (!this.actions.skilled && unit.skills) {
            const usableSkills = unit.skills.filter(s => 
                unit.curMp >= s.mp && (unit.cooldowns[s.id] || 0) === 0 &&
                this.grid.getDistance(unit, target) <= s.rng
            );

            if (usableSkills.length > 0) {
                const bestSkill = usableSkills.sort((a, b) => (b.main.mult || 0) - (a.main.mult || 0))[0];
                if (unit.curMp > unit.mp * 0.5 || (target.curHp / target.hp) < 0.4) {
                    this.selectedSkill = bestSkill;
                    await new Promise(r => setTimeout(r, 300));
                    this.tryExecuteSkill(target, target);
                    actionDone = true;
                }
            }
        }

        if (!actionDone && !this.actions.attacked) {
            await new Promise(r => setTimeout(r, 300));
            this.performAttack(unit, target, 1.0, "공격");
        }
    }

    await new Promise(r => setTimeout(r, 500));
    this.endTurn();
}
    processEffect(eff, targetHex, clickedUnit, caster) {
        if (eff.type === 'RESURRECT') { this.log("부활 기능은 준비중입니다.", "log-system"); return; }
        let targets = this.collectTargets(eff, targetHex, clickedUnit, caster);
        if (targets.length === 0) return;
        targets.forEach(t => {
            if (eff.type === 'NUCKBACK') {
                const dest = this.grid.getHexInDirection(caster, t, 2);
                t.q = dest.q; t.r = dest.r;
                this.log(`${t.name} 넉백됨!`, 'log-cc');
                return;
            }
            if (eff.type === 'DMG') this.performAttack(caster, t, eff.mult, "스킬", false, eff.dmgType);
            else if (eff.type === 'DRAIN') this.performAttack(caster, t, eff.mult, "흡수", true, eff.dmgType);
            else if (eff.type === 'HEAL') {
                let power = this.getStat(caster, eff.dmgType==='PHYS'?'str':'int');
                let amt = Math.floor(power * eff.mult);
                if (this.hasStatus(t, 'POISON')) amt = Math.floor(amt * 0.5); 
                t.curHp = Math.min(t.hp, t.curHp + amt);
                this.showFloatingText(t, `+${amt}`, '#55ff55');
                this.log(`${t.name} 회복: ${amt}`, 'log-heal');
            }
            else if (eff.type === 'PURIFY') {
                t.buffs = t.buffs.filter(b => EFFECTS[b.type]?.type !== 'debuff');
                this.showFloatingText(t, "Cleanse", "#ffffff");
            }
            else {
                const info = EFFECTS[eff.type];
                if(info) this.applyStatus(t, eff, caster);
            }
        });
    }

    collectTargets(effectData, targetHex, clickedUnit, caster) {
        let targets = [];
        const units = this.units.filter(u => u.curHp > 0);
        const center = targetHex || caster;
        if (effectData.target === 'SELF') targets.push(caster);
        else if (effectData.target === 'ENEMY_SINGLE' && clickedUnit && clickedUnit.team !== caster.team) targets.push(clickedUnit);
        else if (effectData.target === 'ALLY_SINGLE' && clickedUnit && clickedUnit.team === caster.team) targets.push(clickedUnit);
        else if (effectData.target === 'AREA_ENEMY') {
            units.forEach(u => { if (u.team !== caster.team && this.grid.getDistance(u, center) <= (effectData.area||0)) targets.push(u); });
        }
        else if (effectData.target === 'ALLY_ALL') units.forEach(u => { if (u.team === caster.team) targets.push(u); });
        else if (effectData.target === 'LINE') {
            // [NEW] 직선 스킬 로직
            const range = 10; // 맵 끝까지
            const lineHexes = this.grid.getLine(caster, center, range);
            units.forEach(u => { 
                if(u.team !== caster.team && lineHexes.some(h => h.q === u.q && h.r === u.r)) targets.push(u); 
            });
        }
        return targets;
    }

    applyStatus(target, data, caster) {
        const info = EFFECTS[data.type];
        if (!info) return;
        if (info.type === 'debuff') {
        // 1. 공격자 적중력: 레벨 + DEX 절반 + INT 절반
        const atkPower = caster.level + (this.getStat(caster, 'dex') * 0.5) + (this.getStat(caster, 'int') * 0.5);
        
        // 2. 방어자 저항력: 레벨 + VIT 절반 + AGI 절반
        const defPower = target.level + (this.getStat(target, 'vit') * 0.5) + (this.getStat(target, 'agi') * 0.5);

        // 3. 확률 계산 (기본 75% + 차이값)
        let successChance = 75 + (atkPower - defPower);
        
        // 최소 10%, 최대 90%로 보정 (완전 면역이나 무조건 적중 방지)
        successChance = Math.max(10, Math.min(90, successChance));

        if (Math.random() * 100 > successChance) {
            this.log(`🛡️ ${target.name}이(가) 효과를 저항했습니다! (확률: ${Math.floor(successChance)}%)`, 'log-system');
            this.showFloatingText(target, "RESIST!", "#ffffff");
            return;
        }
    }
        const buff = { 
            type: data.type, name: info.name, icon: info.icon, 
            duration: data.duration, mult: data.mult, casterId: caster.id 
        };
        const exist = target.buffs.find(b => b.type === data.type);
        if (exist) { exist.duration = data.duration; exist.casterId = caster.id; this.log(`${target.name}: [${info.name}] 갱신`, 'log-effect'); } 
        else { target.buffs.push(buff); this.log(`${target.name}: [${info.name}] 적용`, 'log-effect'); }
        let color = info.type === 'buff' ? '#5f5' : '#f55';
        this.showFloatingText(target, `${info.name}`, color);
        this.renderPartyList();
    }

    hasStatus(unit, type) { return unit.buffs && unit.buffs.some(b => b.type === type); }

    handleMouseDown(e) { 
        if (this.isProcessingTurn && this.currentUnit.team !== 0) return;
        const pos = this.getCanvasCoordinates(e);
        this.isMouseDown = true; 
        this.isDraggingMap = false; 
        this.dragStart = { x: pos.x, y: pos.y }; 
        this.dragCamStart = { x: this.camera.x, y: this.camera.y }; 
        this.updateCursor();
    }
    
    handleMouseUp(e) { 
        this.isMouseDown = false; 
        if (this.isDraggingMap) { this.isDraggingMap = false; return; }
        this.handleClick(e);
    }
    
    handleClick(e) {
        if (this.isProcessingTurn || this.isAnimating) return;
        if (!this.hoverHex || this.currentUnit.team !== 0) return;
        // [수정] 죽은 유닛 클릭 방지
        const u = this.getUnitAt(this.hoverHex.q, this.hoverHex.r);
        if (u && u.curHp <= 0) return;
        
        if (this.selectedSkill) {
            const dist = this.grid.getDistance(this.currentUnit, this.hoverHex);
            if (dist <= this.selectedSkill.rng) {
                this.tryExecuteSkill(this.hoverHex, u);
            } else {
                this.log("스킬 선택 취소", "log-system");
                this.selectedSkill = null;
                this.updateCursor();
                this.updateStatusPanel();
            }
        } 
        else if (u && u.team === 1) {
            if (this.actions.attacked) {
                this.log("이미 공격했습니다.", "log-system");
                return;
            }
            const dist = this.grid.getDistance(this.currentUnit, u);
            if (dist <= this.currentUnit.rng) {
                this.performAttack(this.currentUnit, u, 1.0, "공격");
            } 
            else if (!this.actions.moved) {
                this.handleMoveAndAttack(u);
            } else {
                this.log("사거리가 부족합니다.", "log-system");
            }
        } 
        else if (!u && !this.actions.moved) {
            if (this.reachableHexes.some(h => h.q === this.hoverHex.q && h.r === this.hoverHex.r)) {
                this.moveUnit(this.currentUnit, this.hoverHex.q, this.hoverHex.r);
            }
        }
    }

    async handleMoveAndAttack(targetUnit) {
        let candidates = [];
        this.reachableHexes.forEach(hex => {
            if (this.grid.getDistance(hex, targetUnit) <= this.currentUnit.rng) {
                candidates.push({hex, dist: this.grid.getDistance(this.currentUnit, hex)});
            }
        });
        
        if (candidates.length > 0) {
            candidates.sort((a,b) => a.dist - b.dist);
            const bestMove = candidates[0].hex;
            await this.moveUnit(this.currentUnit, bestMove.q, bestMove.r);
            await new Promise(r => setTimeout(r, 200));
            this.performAttack(this.currentUnit, targetUnit, 1.0, "공격");
        } else {
            this.log("이동해도 공격할 수 없습니다 (너무 멈).", "log-system");
        }
    }
    
    async moveUnit(unit, q, r, cb) {
        const path = this.grid.findPath({q:unit.q, r:unit.r}, {q, r}, nh => {
            // 해당 칸에 '누구든'(살아있든 죽었든) 있는지 확인합니다.
            const uAt = this.units.find(target => target.q === nh.q && target.r === nh.r);
            
            // 1. 아무도 없거나(!uAt) 
            // 2. 그 자리에 있는 게 나 자신(uAt === unit)일 때만 통과 가능
            return !uAt || uAt === unit;
        });
        if (path.length === 0) { if(cb) cb(); return; }
        this.isAnimating = true;
        for (let s of path) {
            unit.q = s.q; unit.r = s.r;
            if (this.hasStatus(unit, 'BLEED')) {
                let dmg = Math.floor(unit.hp * 0.05);
                unit.curHp = Math.max(0, unit.curHp - dmg);
                this.showFloatingText(unit, `🩸-${dmg}`, '#ff0000');
            }
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        this.isAnimating = false;
        this.actions.moved = true;
        this.calcReachable();
        this.updateStatusPanel();
        if(cb) cb();
    }
    
    performAttack(atk, def, mult, name, isDrain, type) {
        if(name !== "스킬") this.actions.attacked = true; 
        
        if (!type) type = atk.atkType;

        if (atk.team === 0) this.gainActionXp(atk, 5);

        const dist = this.grid.getDistance(atk, def);
        if (dist > 1) this.createProjectile(atk, def);
        else this.triggerBumpAnimation(atk, def);

        setTimeout(() => {
            let val = this.getStat(atk, type==='MAG'?'int':'str');
            let defense = type === 'MAG' ? this.getStat(def, 'res') : this.getStat(def, 'def');
            
            let eleMult = 1.0;
            const atkEle = ELEMENTS[atk.element || 'NONE'];
            const defEle = ELEMENTS[def.element || 'NONE'];
            if (atkEle.strong === def.element) { eleMult = 1.3; this.showFloatingText(def, "Weak!", "#ffcc00"); }
            else if (atkEle.weak === def.element) { eleMult = 0.8; this.showFloatingText(def, "Resist", "#888888"); }

            let dmg = Math.max(1, Math.floor(val * mult * eleMult * (100 / (100 + defense))));
            
            if (Math.random() * 100 < this.getStat(atk, 'crit')) { 
                dmg = Math.floor(dmg * 1.5); 
                this.showFloatingText(def, "CRIT!", "#f00"); 
            }
            if (this.hasStatus(def, 'INVINCIBLE')) {
                dmg = 0; this.showFloatingText(def, "IMMUNE", "#fff");
            }
            if (this.hasStatus(def, 'FREEZE')) {
                dmg *= 2;
                this.showFloatingText(def, "SHATTER!", "#aef");
                def.buffs = def.buffs.filter(b => b.type !== 'FREEZE');
            }
            if (this.hasStatus(def, 'SLEEP')) {
                this.showFloatingText(def, "Wake Up", "#fff");
                def.buffs = def.buffs.filter(b => b.type !== 'SLEEP');
            }

            def.curHp = Math.max(0, def.curHp - dmg);
            this.showFloatingText(def, `-${dmg}`, '#f55');
            this.triggerShakeAnimation(def);
            this.log(`${atk.name} -> ${def.name}: ${dmg}`, 'log-dmg');

            if (isDrain && dmg > 0) {
                let heal = Math.floor(dmg * 0.5);
                atk.curHp = Math.min(atk.hp, atk.curHp + heal);
                this.showFloatingText(atk, `+${heal}`, '#5f5');
            }

            if (def.curHp <= 0) this.handleDeath(def);
            this.renderPartyList();
            this.updateStatusPanel();
        }, dist > 1 ? 300 : 150);
    }
    
    // [NEW] MAX XP 로그 중복 방지
    gainActionXp(unit, amount) {
        if (unit.stageActionXp >= 50) {
             if(!unit.hasShownMaxXpMsg) {
                 this.log("행동 경험치가 최대치에 도달했습니다.", "log-system");
                 unit.hasShownMaxXpMsg = true;
             }
             return;
        }
        unit.stageActionXp = (unit.stageActionXp || 0) + amount;
        unit.xp += amount;
        this.checkLevelUp(unit);
        this.gameApp.saveGame();
    }

    gainKillXp(amount) {
        this.units.filter(u => u.team === 0 && u.curHp > 0).forEach(u => {
            u.xp += amount;
            this.showFloatingText(u, `+${amount} XP`, '#fff');
            this.checkLevelUp(u);
            this.gameApp.saveGame();
        });
    }

    checkLevelUp(unit) {
        if (unit.xp >= unit.maxXp) {
            unit.xp -= unit.maxXp;
            unit.level++;
            unit.statPoints += 3;
            unit.maxXp = Math.floor(unit.maxXp * 1.2);
            unit.hp += 10; unit.curHp = unit.hp;
            unit.mp += 5; unit.curMp = unit.mp;
            this.showFloatingText(unit, "LEVEL UP!", "#ffff00");
            this.log(`🎉 ${unit.name} 레벨 업! (Lv.${unit.level})`, 'log-skill');
            this.showSpeechBubble(unit, "강해졌다!");
            this.gameApp.saveGame();
        }
    }

    tryExecuteSkill(targetHex, targetUnit) {
        const skill = this.selectedSkill;
        if (!skill) return;
        
        if (this.currentUnit.curMp < skill.mp) {
            this.log("MP가 부족합니다!", "log-system");
            return;
        }

        let effectiveTarget = targetHex;
        if (!effectiveTarget && ['SELF', 'ALLY_ALL', 'ENEMY_ALL'].includes(skill.main.target)) effectiveTarget = this.currentUnit;
        if (!effectiveTarget && skill.main.target.includes('ENEMY') && targetUnit) effectiveTarget = targetUnit;

        if (skill.main.target.includes('ENEMY') || skill.main.target === 'ALLY_SINGLE') {
             const dist = this.grid.getDistance(this.currentUnit, effectiveTarget || this.currentUnit);
             if (dist > skill.rng) { this.log("사거리 밖입니다.", "log-system"); return; }
        }

        this.currentUnit.curMp -= skill.mp;
        this.currentUnit.cooldowns[skill.id] = skill.cool;
        this.actions.skilled = true;
        
        if (this.currentUnit.team === 0) {
            this.gainActionXp(this.currentUnit, 10);
        }

        this.log(`${this.currentUnit.name} [${skill.name}] 시전!`, 'log-skill');
        this.showSpeechBubble(this.currentUnit, skill.name);

        this.processEffect(skill.main, effectiveTarget, targetUnit, this.currentUnit);
        if (skill.sub) {
            setTimeout(() => this.processEffect(skill.sub, effectiveTarget, targetUnit, this.currentUnit), 300);
        }

        if(this.currentUnit.team === 0) { 
            this.selectedSkill = null; 
            this.updateStatusPanel(); 
        }
        this.updateCursor();
    }
    
    handleDeath(unit) {
        this.log(`☠ ${unit.name} 사망`, 'log-dmg');
        
        const enemies = this.units.filter(u => u.team === 1 && u.curHp > 0).length;
        const allies = this.units.filter(u => u.team === 0 && u.curHp > 0).length;
        
        if (unit.team === 1) {
            const prog = this.gameApp.gameState.progress;

            // [디버깅 로그] 보상이 이상하다면 콘솔(F12)을 확인하세요
            console.log(`현재: ${this.chapter}-${this.stage}, 진행도: ${prog.chapter}-${prog.stage}`);

            // 반복 클리어 판정 로직
            const isRepeat = (this.chapter < prog.chapter) || 
                             (this.chapter === prog.chapter && this.stage < prog.stage);
            
            let xpReward = (unit.level || 1) * 20;
            
            if (isRepeat) {
                xpReward = Math.max(1, Math.floor(xpReward * 0.1)); 
                this.log("💡 반복 클리어: 보상이 10%만 지급됩니다.", "log-system");
            }
            
            this.gainKillXp(xpReward);
        }

        if (enemies === 0 || allies === 0) {
            this.isAutoBattle = false; 
            
            if (enemies === 0) {
             setTimeout(() => this.gameApp.onBattleEnd(true), 1000);
}   
                else {
                setTimeout(() => this.gameApp.onBattleEnd(false, false), 1000);
            }
        }
        this.renderPartyList();
    }

    
    // [수정] 죽은 유닛도 리턴하되, 사용하는 쪽에서 curHp 체크 필요 (렌더링 위해)
    // 그러나 로직상 '살아있는 유닛'만 가져오는게 편하므로 getUnitAt은 살아있는 것만.
    // 렌더링 루프에서는 units 배열 전체를 돌므로 문제없음.
    getUnitAt(q, r) { return this.units.find(u => u.q === q && u.r === r && u.curHp > 0); }
    
    calcReachable() {
        this.reachableHexes = [];
        if(this.actions.moved) return;
        let frontier = [{q:this.currentUnit.q, r:this.currentUnit.r}];
        let cost = new Map(); cost.set(`${this.currentUnit.q},${this.currentUnit.r}`, 0);
        const moveRange = this.getStat(this.currentUnit, 'mov');
        while(frontier.length > 0) {
            let cur = frontier.shift();
            this.grid.getNeighbors(cur).forEach(n => {
                const k = `${n.q},${n.r}`;
                if(this.grid.hexes.has(k) && !this.getUnitAt(n.q, n.r)) {
                    let newCost = cost.get(`${cur.q},${cur.r}`) + 1;
                    if(newCost <= moveRange && !cost.has(k)) {
                        cost.set(k, newCost); frontier.push(n); this.reachableHexes.push(n);
                    }
                }
            });
        }
    }
    
    updateCursor() {
        const v = document.getElementById('viewport');
        if(this.selectedSkill) v.className = 'cursor-skill';
        else if(this.hoverHex && this.getUnitAt(this.hoverHex.q, this.hoverHex.r)?.team === 1) v.className = 'cursor-attack';
        else v.className = '';
    }
    
    log(msg, type) {
        const box = document.getElementById('log-content');
        if(box) {
            box.innerHTML += `<div class="log-entry ${type}">${msg}</div>`;
            document.getElementById('log-box').scrollTop = 9999;
        }
    }
    
    showTooltip(e, html) { 
        const t = document.getElementById('global-tooltip'); 
        if(t) { 
            t.style.display='block'; t.innerHTML=html; 
            t.style.left=(e.clientX+15)+'px'; 
            t.style.top=(e.clientY+15)+'px'; 
        }
    }
    
    hideTooltip() { document.getElementById('global-tooltip').style.display='none'; }
    
    showFloatingText(u, txt, col) { 
        this.textQueue.push({u, txt, col, delay: this.textQueue.length * 200}); 
    }
    
    renderUI() {
        const box = document.getElementById('control-panel-grid');
        if(!box || this.currentUnit.team !== 0) return;
        box.innerHTML = '';
        const header = document.createElement('div'); header.className='bp-header'; header.innerText='스킬';
        box.appendChild(header);
        const grid = document.createElement('div'); grid.className='skill-grid';
        
        this.currentUnit.skills.forEach(s => {
            const btn = document.createElement('div');
            const cd = this.currentUnit.cooldowns[s.id] || 0;
            const manaLack = this.currentUnit.curMp < s.mp;
            
            btn.className = `skill-btn ${this.selectedSkill===s?'active':''} ${cd>0?'disabled':''} ${manaLack?'mana-lack':''}`;
            btn.innerHTML = `<div class="skill-icon">${s.icon}</div><div class="skill-name">${s.name}</div>`;
            
            if(cd > 0) btn.innerHTML += `<div class="cooldown-overlay">${Math.ceil(cd)}</div>`;
            
            if (this.confirmingSkill === s) {
                btn.innerHTML = `
                    <div class="confirm-overlay">
                        <div class="confirm-btn">시전</div>
                        <div class="cancel-btn">취소</div>
                    </div>`;
                btn.querySelector('.confirm-btn').onclick = (e) => {
                    e.stopPropagation();
                    this.selectedSkill = s; 
                    this.tryExecuteSkill(null, null); 
                    this.confirmingSkill = null;
                };
                btn.querySelector('.cancel-btn').onclick = (e) => {
                    e.stopPropagation();
                    this.confirmingSkill = null;
                    this.updateStatusPanel();
                };
            } else {
                btn.onclick = () => {
                    if(cd > 0 || this.actions.skilled || this.isProcessingTurn) return;
                    if(manaLack) { this.log("마나가 부족합니다.", "log-system"); return; }
                    
                    if (['SELF', 'ALLY_ALL'].includes(s.main.target)) {
                        if (this.confirmingSkill === s) this.confirmingSkill = null;
                        else this.confirmingSkill = s;
                        this.updateStatusPanel();
                    } else {
                        this.selectedSkill = (this.selectedSkill === s) ? null : s;
                        this.confirmingSkill = null;
                        this.updateCursor();
                        this.updateStatusPanel(); 
                    }
                };
            }

            btn.onmouseenter = (e) => {
                const info = `<div style="font-weight:bold;color:gold">${s.name}</div>
                <div>${s.desc}</div><hr style="margin:2px 0">
                <div style="${manaLack?'color:red':''}">MP: ${s.mp} | Cool: ${s.cool}</div>`;
                this.showTooltip(e, info);
            };
            btn.onmouseleave = () => this.hideTooltip();
            grid.appendChild(btn);
        });
        box.appendChild(grid);
        
        const turnBtn = document.createElement('div');
        turnBtn.className = 'turn-btn-wrapper';
        turnBtn.innerHTML = `<div class="turn-btn">턴 종료</div>`;
        turnBtn.onclick = () => { if(!this.isProcessingTurn) this.endTurn(); };
        box.appendChild(turnBtn);
    }
    
    async processTextQueue() {
        if(this.textQueue.length > 0) {
            const now = Date.now();
            if (!this.lastTextTime || now - this.lastTextTime > 200) {
                const {u, txt, col} = this.textQueue.shift();
                const pos = this.grid.hexToPixel(u.q, u.r);
                const drawX = pos.x - this.camera.x;
                const drawY = pos.y - this.camera.y;
                const el = document.createElement('div');
                el.className = 'floating-text'; el.textContent = txt; el.style.color = col;
                el.style.left = drawX + 'px'; el.style.top = (drawY - 40) + 'px';
                document.getElementById('overlay-layer').appendChild(el);
                setTimeout(() => el.remove(), 1000);
                this.lastTextTime = now;
            }
        }
        requestAnimationFrame(() => this.processTextQueue());
    }
}