import { CLASS_DATA, ITEM_DATA, STAGE_DATA, ELEMENTS, TERRAIN_TYPES, SKILL_DATABASE, PERK_DATA } from './data/index.js';
import { GameState, loadGame } from './state.js';
import * as Formulas from './utils/formulas.js'; 
import { HexGrid } from './hex.js';
import { GameRenderer } from './render/renderer.js';
import { BattleSystem } from './systems/battle.js';

// 가중치 화살표 UI 헬퍼
const STAT_WEIGHTS = {
    'str': { 'atk_phys': 'high', 'hp_max': 'mid', 'def': 'low' },
    'int': { 'atk_mag': 'high', 'mp_max': 'mid', 'mp_regen': 'mid', 'res': 'mid', 'hit_mag': 'mid', 'spd': 'low' },
    'vit': { 'hp_max': 'high', 'def': 'mid', 'hp_regen': 'mid', 'tenacity': 'low' },
    'agi': { 'eva': 'high', 'hit_phys': 'mid', 'spd': 'mid', 'mov': 'low' },
    'dex': { 'hit_phys': 'high', 'hit_mag': 'high', 'crit': 'mid', 'atk_phys': 'low', 'atk_mag': 'low' },
    'vol': { 'atk_phys': 'mid', 'atk_mag': 'mid' },
    'luk': { 'crit': 'high', 'eva': 'mid', 'hit_phys': 'low', 'hit_mag': 'low', 'tenacity': 'low' }
};

function getArrowHtml(weight) {
    if (weight === 'high') return '<span class="arrow-high">⬆⬆</span>';
    if (weight === 'mid') return '<span class="arrow-mid">⬆</span>';   
    if (weight === 'low') return '<span class="arrow-low">↑</span>';   
    return '';
}

class GameApp {
    constructor() {
        this.gameState = GameState; 
        this.itemData = ITEM_DATA;
        loadGame();
        this.init();    
    }

    getStatCost(unit, statKey) {
        // 간단 로직 (추후 Formulas로 이동 가능)
        const val = unit[statKey] || 0;
        if (val >= 40) return 3;
        if (val >= 20) return 2;
        return 1;
    }

    allocateManageStat(statKey) {
        const hero = GameState.heroes[this.selectedHeroIdx];
        if (!hero) return;

        const cost = this.getStatCost(hero, statKey);
        if (hero.statPoints < cost) {
            this.showAlert(`포인트가 부족합니다! (필요: ${cost} PT)`);
            return;
        }

        hero[statKey]++;
        hero.statPoints -= cost;
        
        if (statKey === 'vit') { hero.hp += 10; hero.curHp += 10; }
        else if (statKey === 'int') { hero.mp += 5; hero.curMp += 5; }
        
        this.renderManageUI();
    }

    init() {
        if(GameState.heroes.length === 0) {
            const allHeroes = [
                'WARRIOR', 'KNIGHT', 'MONK', 'ROGUE', 'ARCHER', 
                'SORCERER', 'CLERIC', 'BARD', 'DANCER', 'ALCHEMIST'
            ];
            allHeroes.forEach(key => this.addHero(key));
        }
        
        if(GameState.shopStock.length === 0) this.refreshShopStock();
        if(!GameState.recruitPool || GameState.recruitPool.length === 0) this.refreshTavern(false);

        document.getElementById('scene-title').onclick = () => this.enterTown();
        
        const link = (id, fn) => { const el=document.getElementById(id); if(el) el.onclick = fn.bind(this); };
        link('btn-battle', this.openBattleSelect);
        link('btn-inn', this.openInn);
        link('btn-tavern', this.openTavern);
        link('btn-blacksmith', this.openBlacksmith);
        link('btn-hero', this.openHeroManage);
        link('btn-sanctuary', this.openSanctuary);
        link('btn-reset', this.resetGame);
        link('btn-town-return-1', this.enterTown);
        link('btn-sub-close', this.enterTown);
        // ============================================================
        // [신규] UI 컨트롤 (투명도 슬라이더 & H키 토글)
        // ============================================================
        const uiSlider = document.getElementById('ui-opacity-slider');
        
        // 1. 투명도 조절 이벤트
        if (uiSlider) {
            uiSlider.addEventListener('input', (e) => {
                const opacity = e.target.value;
                // 투명도를 조절할 대상 ID 목록
                const targets = ['skill-panel', 'bottom-panel', 'log-box', 'floating-controls'];
                targets.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.opacity = opacity;
                });
            });
        }

        // 2. UI 숨기기/켜기 (H키 & 버튼)
        const toggleUI = () => {
            const targets = ['skill-panel', 'bottom-panel', 'log-box', 'floating-controls', 'ui-controls'];
            // 상태 추적용 변수 (window 객체에 저장)
            window.isUiHidden = !window.isUiHidden;
            
            targets.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    // ui-controls(설정창)는 완전히 숨기지 않고 반투명하게 남길지, 아예 숨길지 선택
                    // 여기서는 H키로 설정창까지 싹 다 숨기는 로직
                    if (window.isUiHidden) el.classList.add('ui-hidden');
                    else {
                        el.classList.remove('ui-hidden');
                        // 켜질 때 슬라이더 값으로 투명도 복구
                        if(id !== 'ui-controls' && uiSlider) el.style.opacity = uiSlider.value;
                    }
                }
            });
        };

        // 버튼 클릭 시 토글
        const toggleBtn = document.getElementById('ui-toggle-btn');
        if(toggleBtn) toggleBtn.onclick = toggleUI;

        // 키보드 H 입력 시 토글
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            // H키: 플로팅 패널(#floating-controls)만 투명화 토글
            if (e.key === 'h' || e.key === 'H') {
                const hud = document.getElementById('floating-controls');
                window.isHudHidden = !window.isHudHidden; // 상태 전역 변수로 저장

                if (hud) {
                    if (window.isHudHidden) hud.classList.add('hud-hidden');
                    else hud.classList.remove('hud-hidden');
                }
            }
        });
    }

    showConfirm(msg, onYes) {
        const modal = document.getElementById('system-modal');
        const msgEl = document.getElementById('sys-modal-msg');
        const btnsEl = document.getElementById('sys-modal-btns');
        msgEl.textContent = msg;
        btnsEl.innerHTML = '';
        const yesBtn = document.createElement('button');
        yesBtn.className = 'sys-btn confirm'; yesBtn.textContent = '확인';
        yesBtn.onclick = () => { modal.style.display='none'; onYes(); };
        const noBtn = document.createElement('button');
        noBtn.className = 'sys-btn'; noBtn.textContent = '취소';
        noBtn.onclick = () => { modal.style.display='none'; };
        btnsEl.append(yesBtn, noBtn);
        modal.style.display = 'flex';
    }

    showAlert(msg) {
        const modal = document.getElementById('system-modal');
        const msgEl = document.getElementById('sys-modal-msg');
        const btnsEl = document.getElementById('sys-modal-btns');
        msgEl.textContent = msg;
        btnsEl.innerHTML = `<button class="sys-btn" onclick="document.getElementById('system-modal').style.display='none'">닫기</button>`;
        modal.style.display = 'flex';
    }

    saveGame() { 
        // State Proxy가 자동 처리하지만, 명시적 호출용
        localStorage.setItem('hexRpgSave', JSON.stringify(GameState)); 
    }
    
    // ============================================================
    // 전투 준비 (Battle Prep)
    // ============================================================

    openBattlePrep(chapter, stage) {
        this.showScene('scene-battle-prep');
        
        this.prepState = {
            chapter: chapter,
            stage: stage,
            party: [], 
            leaderIdx: 0 
        };
        
        this.renderPrepUI();
    }

    closePrep() {
        this.showScene('scene-stage-select');
    }

    renderPrepUI() {
        const { chapter, stage, party, leaderIdx } = this.prepState;
        const stageData = STAGE_DATA[chapter][stage];
        document.getElementById('prep-title').textContent = `PREPARE FOR STAGE ${chapter}-${stage}`;
        document.getElementById('prep-count').textContent = `${party.length} / 6`;

        const mapWrapper = document.getElementById('prep-minimap');
        mapWrapper.innerHTML = '';

        const hexToPixel = (q, r) => {
            const size = 20; 
            const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
            const y = size * (3/2 * r);
            return { x: x + 60, y: y + 60 }; 
        };

        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 22; c++) {
                const q = c - (r - (r & 1)) / 2;
                const key = `${q},${r}`; 
                const pos = hexToPixel(q, r);
                
                const hex = document.createElement('div');
                hex.className = 'hex-tile'; 

                if (stageData.map && stageData.map[key]) {
                    const tKey = stageData.map[key];
                    const terrainInfo = TERRAIN_TYPES[tKey];
                    if (terrainInfo) hex.style.backgroundColor = terrainInfo.color;
                } else {
                    hex.style.backgroundColor = TERRAIN_TYPES['GRASS_01'].color;
                }

                const isDeployZone = stageData.deployment && stageData.deployment.includes(key);
                if (isDeployZone) {
                    hex.classList.add('zone-ally'); 
                    hex.ondrop = (e) => { e.preventDefault(); hex.classList.remove('drag-valid'); this.handlePrepDrop(e, q, r); };
                    hex.ondragover = (e) => { e.preventDefault(); hex.classList.add('drag-hover'); };
                    hex.ondragleave = (e) => { hex.classList.remove('drag-hover'); };
                } else {
                    hex.style.filter = 'brightness(0.7)';
                }

                hex.style.left = pos.x + 'px';
                hex.style.top = pos.y + 'px';
                mapWrapper.appendChild(hex);
            }
        }

        party.forEach((pData, idx) => {
            const pos = hexToPixel(pData.q, pData.r);
            const unit = document.createElement('div');
            const isLeader = (idx === leaderIdx);
            unit.className = `hex-unit hero ${isLeader ? 'is-leader' : ''}`;
            unit.textContent = pData.hero.icon;
            unit.style.left = pos.x + 'px';
            unit.style.top = pos.y + 'px';
            unit.onclick = (e) => { e.stopPropagation(); this.removeHeroFromPrep(idx); };
            unit.draggable = true;
            unit.ondragstart = (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'map', idx: idx })); };
            unit.ondragover = (e) => { e.preventDefault(); };
            unit.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); this.handlePrepDrop(e, pData.q, pData.r, idx); };
            mapWrapper.appendChild(unit);
        });

        // 적군 정보
        const enemies = stageData.enemies || ['SLIME'];
        const weaknessCounts = {};
        const enemyListEl = document.getElementById('prep-enemy-list');
        enemyListEl.innerHTML = '';

        const occupied = new Set();
        let autoEnemyIdx = 0;

        enemies.forEach(rawEntry => {
            let entry = rawEntry;
            let count = 1;
            
            if (entry.includes('*')) {
                const parts = entry.split('*');
                entry = parts[0];
                count = parseInt(parts[1]) || 1;
            }

            let key = entry;
            let fixedQ = null;
            let fixedR = null;

            if (entry.includes(':')) {
                const parts = entry.split(':');
                key = parts[0];
                if (parts[1]) fixedQ = Number(parts[1]);
                if (parts[2]) fixedR = Number(parts[2]);
            }

            key = key.trim().toUpperCase().replace(/,/g, '');
            const eData = CLASS_DATA[key];

            if(eData) {
                const elInfo = ELEMENTS[eData.element];
                weaknessCounts[elInfo.weak] = (weaknessCounts[elInfo.weak] || 0) + count;
                
                const card = document.createElement('div');
                card.className = 'enemy-card-mini';
                card.innerHTML = `
                    <span style="font-size:20px;">${eData.icon}</span>
                    <div>
                        <div style="font-weight:bold;color:#f88;font-size:12px;">${eData.name} ${count > 1 ? `x${count}` : ''}</div>
                        <div style="font-size:10px;color:#888;">약점: ${ELEMENTS[elInfo.weak].icon}</div>
                    </div>`;
                enemyListEl.appendChild(card);

                for(let i = 0; i < count; i++) {
                    let q, r;
                    if (fixedQ != null && fixedR != null) {
                        q = fixedQ; r = fixedR;
                    } else {
                        const ENEMY_BASE_COL = 14; 
                        const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4];
                        const row = 6 + rowOffsets[autoEnemyIdx % 8];
                        const col = ENEMY_BASE_COL + Math.floor(autoEnemyIdx / 8);
                        q = col - (row - (row & 1)) / 2;
                        r = row;
                        autoEnemyIdx++;
                    }
                    while(occupied.has(`${q},${r}`)) { r++; }
                    occupied.add(`${q},${r}`);

                    const pos = hexToPixel(q, r);
                    const unit = document.createElement('div');
                    unit.className = 'hex-unit enemy';
                    unit.textContent = eData.icon;
                    unit.style.left = pos.x + 'px';
                    unit.style.top = pos.y + 'px';
                    mapWrapper.appendChild(unit);
                }
            }
        });

        const deployedListEl = document.getElementById('prep-deployed-list');
        deployedListEl.innerHTML = '';
        party.forEach((pData, idx) => {
            const isLeader = (idx === leaderIdx);
            const div = document.createElement('div');
            div.className = `deployed-card ${isLeader ? 'active-leader' : ''}`;
            div.innerHTML = `<span style="font-size:20px;">${pData.hero.icon}</span><div style="flex:1;"><div style="font-size:12px; color:#eee; font-weight:bold;">${pData.hero.name}</div><div style="font-size:10px; color:#888;">${pData.hero.classKey}</div></div><div class="leader-crown-icon">👑</div>`;
            div.onclick = () => { this.prepState.leaderIdx = idx; this.renderPrepUI(); };
            deployedListEl.appendChild(div);
        });

        const bestEle = Object.keys(weaknessCounts).sort((a,b) => weaknessCounts[b] - weaknessCounts[a])[0];
        document.getElementById('prep-tip').innerHTML = bestEle ? `💡 추천 속성: <b>${ELEMENTS[bestEle].name} ${ELEMENTS[bestEle].icon}</b>` : `💡 상성을 고려하여 배치하세요.`;

        const rosterEl = document.getElementById('prep-roster');
        rosterEl.innerHTML = '';
        GameState.heroes.forEach((h, originalIdx) => {
            const isDeployed = party.some(p => p.rosterIdx === originalIdx);
            const hpPct = (h.curHp / h.hp) * 100;
            const mpPct = (h.curMp / h.mp) * 100;
            const isDead = h.curHp <= 0;

            const card = document.createElement('div');
            card.className = `roster-card-h ${isDeployed ? 'deployed' : ''}`;
            if (isDead) {
                card.style.filter = 'grayscale(100%) brightness(0.5)';
                card.style.cursor = 'not-allowed';
            }

            card.innerHTML = `
                <div style="font-size:24px; margin-bottom:2px;">${h.icon}</div>
                <div style="font-size:11px; font-weight:bold; color:#eee; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:90px;">${h.name}</div>
                <div style="font-size:9px; color:#888;">Lv.${h.level} ${h.classKey}</div>
                
                <div class="mini-bars">
                    <div class="mini-bar-bg" title="HP: ${Math.floor(h.curHp)}/${h.hp}">
                        <div class="mini-bar-fill hp-fill" style="width:${hpPct}%"></div>
                    </div>
                    <div class="mini-bar-bg" title="MP: ${Math.floor(h.curMp)}/${h.mp}">
                        <div class="mini-bar-fill mp-fill" style="width:${mpPct}%"></div>
                    </div>
                </div>
            `;
            
            if (!isDeployed) {
                card.draggable = true;
                card.ondragstart = (e) => {
                    e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'roster', hIdx: originalIdx }));
                };
                card.ondblclick = () => this.autoPlaceHero(h, originalIdx); 
            }
            rosterEl.appendChild(card);
        });
    }

    handlePrepDrop(e, q, r, targetUnitIdx = -1) {
        try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            const party = this.prepState.party;

            if (data.type === 'roster') {
                const heroIdx = data.hIdx;
                const hero = GameState.heroes[heroIdx];
                if (hero.curHp <= 0) {
                    this.showAlert("기절한 영웅은 출전할 수 없습니다.\n여관에서 회복시켜 주세요.");
                    return;
                }

                if (party.some(p => p.rosterIdx === heroIdx)) return;

                if (party.length >= 6) {
                    this.showAlert("최대 6명!");
                    return;
                }
                
                const existingIdx = party.findIndex(p => p.q === q && p.r === r);
                if (existingIdx !== -1) {
                    party[existingIdx] = { hero: hero, q: q, r: r, rosterIdx: heroIdx };
                } else {
                    party.push({ hero: hero, q: q, r: r, rosterIdx: heroIdx });
                }
            } 
            else if (data.type === 'map') {
                const fromIdx = data.idx;
                const destIdx = party.findIndex(p => p.q === q && p.r === r);
                
                if (destIdx !== -1 && destIdx !== fromIdx) {
                    const tempQ = party[fromIdx].q;
                    const tempR = party[fromIdx].r;
                    party[fromIdx].q = q;
                    party[fromIdx].r = r;
                    party[destIdx].q = tempQ;
                    party[destIdx].r = tempR;
                } else {
                    party[fromIdx].q = q;
                    party[fromIdx].r = r;
                }
            }
            this.renderPrepUI();
        } catch(err) {
            console.error("Drop Error:", err);
        }
    }

    removeHeroFromPrep(idx) {
        this.prepState.party.splice(idx, 1);
        if (this.prepState.leaderIdx === idx) this.prepState.leaderIdx = 0; 
        else if (this.prepState.leaderIdx > idx) this.prepState.leaderIdx--;
        this.renderPrepUI();
    }

    clearParty() {
        this.prepState.party = [];
        this.prepState.leaderIdx = 0;
        this.renderPrepUI();
    }

    autoPlaceHero(hero, originalIdx) {
        if (this.prepState.party.length >= 6) return;
        if (this.prepState.party.some(p => p.rosterIdx === originalIdx)) return;

        const stageData = STAGE_DATA[this.prepState.chapter][this.prepState.stage];
        const deployment = stageData.deployment || [];

        for (const posKey of deployment) {
            const [q, r] = posKey.split(',').map(Number);
            
            if (!this.prepState.party.some(p => p.q === q && p.r === r)) {
                this.prepState.party.push({ hero: hero, q: q, r: r, rosterIdx: originalIdx });
                this.renderPrepUI();
                return;
            }
        }
        
        this.showAlert("배치할 수 있는 빈 공간이 없습니다!");
    }

    autoFormParty() {
        const { chapter, stage } = this.prepState;
        const stageData = STAGE_DATA[chapter][stage];
        
        const deployment = stageData.deployment || []; 
        
        if (deployment.length === 0) {
            this.showAlert("이 스테이지에는 지정된 배치 구역이 없습니다!");
            return;
        }

        const enemies = stageData.enemies || [];
        const weakMap = {};
        enemies.forEach(raw => {
            const key = raw.split(':')[0]; 
            const eData = CLASS_DATA[key];
            if(eData) weakMap[ELEMENTS[eData.element].weak] = true;
        });

        const scoredHeroes = GameState.heroes
            .filter(h => h.curHp > 0)
            .map(h => ({ 
                hero: h, 
                originalIdx: GameState.heroes.indexOf(h) 
            }))
            .map(item => {
                const h = item.hero;
                // [변경] Formulas 사용
                const scoreStat = Formulas.getStat(h, 'str') + Formulas.getStat(h, 'int') + Formulas.getStat(h, 'def');
                let score = h.level * 10 + scoreStat * 0.5;
                if (weakMap[h.element]) score += 50; 
                return { ...item, score };
            })
            .sort((a, b) => b.score - a.score); 

        this.prepState.party = [];
        
        const deployCount = Math.min(6, scoredHeroes.length, deployment.length);

        for (let i = 0; i < deployCount; i++) {
            const c = scoredHeroes[i];
            const [q, r] = deployment[i].split(',').map(Number);
            
            this.prepState.party.push({ 
                hero: c.hero, 
                q: q, 
                r: r, 
                rosterIdx: c.originalIdx 
            });
        }
        
        this.prepState.leaderIdx = 0; 
        this.renderPrepUI();
    }

    confirmBattleStart() {
        const finalParty = this.prepState.party; 
        if (finalParty.length === 0) {
            this.showAlert("최소 1명의 영웅이 필요합니다!");
            return;
        }
        
        const leaderIdx = this.prepState.leaderIdx;
        if (leaderIdx > 0 && leaderIdx < finalParty.length) {
            const leader = finalParty.splice(leaderIdx, 1)[0];
            finalParty.unshift(leader);
        }

        this.startBattle(this.prepState.chapter, this.prepState.stage, finalParty);
    }

    startBattle(chapter, stage, customParty) {
        this.showScene('scene-battle');
        
        setTimeout(() => {
            const canvas = document.getElementById('gridCanvas');
            
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }

            // [변경] 렌더러와 그리드 분리 초기화
            window.grid = new HexGrid(canvas); // 데이터만 관리
            window.renderer = new GameRenderer(canvas, window.grid); // 렌더링 담당

            const stageData = STAGE_DATA[chapter]?.[stage];
            if (stageData && stageData.map) {
                Object.entries(stageData.map).forEach(([pos, terrainKey]) => {
                    const [q, r] = pos.split(',').map(Number);
                    window.grid.setTerrain(q, r, terrainKey); 
                });
            }
            
            window.battle = new BattleSystem(window.grid, this, chapter, stage, customParty);
            
        }, 50);
    }

    // ============================================================
    // 기본 기능 (상점, 여관, 리셋 등)
    // ============================================================

    resetGame() {
        this.showConfirm("정말 초기화하시겠습니까? 모든 데이터가 사라집니다.", () => {
            localStorage.removeItem('hexRpgSave'); 
            localStorage.clear(); 
            location.reload();
        });
    }

    addHero(key) {
        if (!CLASS_DATA[key]) return;
        const heroData = CLASS_DATA[key];
        
        // 1. 데이터 깊은 복사 (원본 보호)
        const hero = JSON.parse(JSON.stringify(heroData));
        hero.classKey = key; 
        
        // 2. [핵심] 스킬 ID를 실제 스킬 데이터로 변환
        // (영웅은 skillIds를 가지고 있고, 몬스터는 skills를 직접 가지고 있음)
        if (hero.skillIds) {
            hero.skills = hero.skillIds.map(id => {
                const s = SKILL_DATABASE[id];
                if (!s) {
                    console.warn(`Skill ID ${id} not found for ${key}`);
                    return null;
                }
                // 스킬 객체 복사 및 ID 주입
                return JSON.parse(JSON.stringify({ ...s, id: id }));
            }).filter(s => s !== null);
        } else if (!hero.skills) {
            hero.skills = []; // 스킬이 없는 경우 빈 배열
        }

        // 3. 상태값 초기화
        // (units.js에서 1/10 스케일로 설정한 hp, mp를 현재값으로 적용)
        hero.curHp = hero.hp; 
        hero.curMp = hero.mp;
        
        hero.xp = 0; 
        hero.maxXp = 100; 
        hero.statPoints = 0;
        
        // 4. [신규] 특성(Perk) 시스템 초기화
        hero.perks = {}; 

        // 5. 장비 슬롯 초기화
        hero.equipment = { weapon: null, armor: null, acc1: null, acc2: null, potion1: null, potion2: null };
        
        // 6. 스탯 안전장치 (데이터 누락 대비 기본값 10 설정)
        ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(stat => {
            hero[stat] = hero[stat] || 10;
        });
        

        GameState.heroes.push(hero);
    }

    showScene(id) {
        document.querySelectorAll('.scene').forEach(el => el.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        window.isBattleActive = (id === 'scene-battle');
        if(id === 'scene-sub-menu') this.updateSubMenuGold();
        document.getElementById('global-tooltip').style.display = 'none'; 
    }
    
    enterTown() {
        this.updateTownUI();
        this.showScene('scene-town');
        document.getElementById('battle-result-modal').style.display='none';
    }
    updateTownUI() {
        document.getElementById('display-gold').textContent = `💰 ${GameState.gold}`;
        document.getElementById('display-faith').textContent = `✨ ${GameState.faith}`;
    }
    updateSubMenuGold() {
        const el = document.getElementById('sub-menu-gold');
        if(el) el.textContent = `💰 ${GameState.gold}`;
    }

    refreshShopStock() {
        const keys = Object.keys(ITEM_DATA);
        GameState.shopStock = [];
        for(let i=0; i<10; i++) { 
            const key = keys[Math.floor(Math.random() * keys.length)];
            GameState.shopStock.push({ id: key, sold: false }); 
        }
    }

    openBlacksmith() {
        this.showScene('scene-sub-menu');
        document.getElementById('sub-menu-title').textContent = "▼ FORGE";
        const content = document.getElementById('sub-menu-content');

        let html = `
            <div style="padding: 20px; width: 100%; max-width: 1200px; margin: auto;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px;">
        `;

        GameState.shopStock.forEach((stockItem, idx) => {
            const item = ITEM_DATA[stockItem.id];
            html += `
                <div class="game-card ${stockItem.sold ? 'sold-out' : ''}" 
                     onmouseenter="game.showItemTooltip(event, '${stockItem.id}')" onmouseleave="game.hideTooltip()">
                    <div class="card-big-icon">${item.icon}</div>
                    <div style="font-family: var(--font-game); font-size: 14px; color: #eee; margin-bottom: 5px;">${item.name}</div>
                    <div style="color: #666; font-size: 11px; margin-bottom: 15px;">${item.type}</div>
                    <button class="item-btn buy" onclick="game.buyItem(${idx})" ${stockItem.sold ? 'disabled' : ''} 
                            style="width: 100%; border-radius: 4px; font-family: var(--font-game);">
                        ${stockItem.sold ? 'SOLD OUT' : `${item.cost} G`}
                    </button>
                </div>`;
        });

        html += `</div></div>`;
        content.innerHTML = html;
    }

    buyItem(stockIdx) {
        const stockItem = GameState.shopStock[stockIdx];
        const item = ITEM_DATA[stockItem.id];
        
        if (stockItem.sold) return; 
        
        if (GameState.gold >= item.cost) {
            GameState.gold -= item.cost;
            GameState.inventory.push(stockItem.id);
            stockItem.sold = true; 
            this.updateSubMenuGold();
            this.openBlacksmith(); 
            
        } else {
            this.showAlert("골드가 부족합니다.");
        }
    }

    openTavern() {
        this.showScene('scene-sub-menu');
        document.getElementById('sub-menu-title').textContent = "▼ TAVERN";
        const content = document.getElementById('sub-menu-content');
        
        let html = `
            <div style="width: 100%; display: flex; justify-content: center; padding-top: 50px;">
                <div style="display: grid; grid-template-columns: repeat(3, 280px); gap: 40px;">
        `;

        GameState.recruitPool.forEach((hero, idx) => {
            const cost = hero.level * 300 + 200;
            const canHire = GameState.gold >= cost;
            html += `
                <div class="game-card">
                    <div class="card-big-icon">${hero.icon}</div>
                    <h3 style="font-family: var(--font-game); color: var(--gold); margin: 5px 0;">${hero.name}</h3>
                    <div style="color: #888; font-size: 13px; margin-bottom: 20px;">Lv.${hero.level} ${hero.classKey}</div>
                    <button class="hire-btn" ${canHire ? '' : 'disabled'} 
                            onclick="game.hireHero(${idx}, ${cost})" 
                            style="width: 100%; height: 45px; font-family: var(--font-game);">
                        ${canHire ? `HIRE: ${cost}G` : 'LACK OF GOLD'}
                    </button>
                </div>`;
        });

        html += `</div></div>`;
        content.innerHTML = html;
    }

    refreshTavern(isPaid = false) {
        const HERO_CLASSES = [
            'WARRIOR', 'KNIGHT', 'MONK', 'ROGUE', 'ARCHER', 
            'SORCERER', 'CLERIC', 'BARD', 'DANCER', 'ALCHEMIST'
        ];

        const owned = new Set(GameState.heroes.map(h => h.classKey));
        const available = HERO_CLASSES.filter(k => !owned.has(k));
        
        GameState.recruitPool = [];
        
        if (available.length > 0) {
            for (let i = available.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [available[i], available[j]] = [available[j], available[i]];
            }
            
            available.slice(0, 3).forEach(k => {
                const h = JSON.parse(JSON.stringify(CLASS_DATA[k]));
                h.classKey = k; 
                
                h.hp += Math.floor(Math.random() * 20); 
                h.curHp = h.hp; 
                h.curMp = h.mp;
                h.xp = 0; 
                h.maxXp = 100; 
                h.statPoints = 0; 
                h.equipment = { weapon: null, armor: null, acc1: null, acc2: null, potion1: null, potion2: null };
                
                h.vol = h.vol || 10; 
                h.luk = h.luk || 10;

                GameState.recruitPool.push(h);
            });
        }
    }

    hireHero(idx, cost) {
        if (GameState.heroes.length >= 20) { this.showAlert("영웅은 최대 20명까지만 고용할 수 있습니다."); return; }
        if (GameState.gold >= cost) {
            GameState.gold -= cost;
            const h = GameState.recruitPool.splice(idx, 1)[0];
            GameState.heroes.push(h);
            this.updateSubMenuGold();
            this.openTavern();
            this.showAlert("고용 완료!");
        }
    }

    openHeroManage(selectedIdx = 0) {
        this.showScene('scene-sub-menu');
        document.getElementById('sub-menu-title').textContent = "영웅 관리";
        const content = document.getElementById('sub-menu-content');
        
        content.innerHTML = `
            <div class="manage-container">
                <div class="manage-col">
                    <div class="col-header">ROSTER</div>
                    <div class="col-body" id="manage-list"></div>
                </div>
                <div class="manage-col">
                    <div class="col-header">EQUIPMENT</div>
                    <div class="col-body" id="manage-visual"></div>
                </div>
                <div class="manage-col">
                    <div class="col-header">STATS & BAG</div>
                    <div class="col-body" id="manage-stats"></div>
                </div>
            </div>`;
        
        if (!GameState.heroes[selectedIdx]) selectedIdx = 0;
        this.selectedHeroIdx = selectedIdx;
        this.renderManageUI();
    }

    // 미리보기 기능
    previewStatImpact(statKey) {
        this.clearStatPreview(); 
        const hero = GameState.heroes[this.selectedHeroIdx];
        if (!hero) return;

        const impacts = STAT_WEIGHTS[statKey];
        if (!impacts) return;

        for (const [combatStat, weight] of Object.entries(impacts)) {
            const el = document.getElementById(`c-stat-${combatStat}`);
            if (el) {
                const arrowSpan = el.querySelector('.stat-preview-arrow');
                if (arrowSpan) {
                    arrowSpan.innerHTML = getArrowHtml(weight);
                }
            }
        }
    }

    clearStatPreview() {
        document.querySelectorAll('.stat-preview-arrow').forEach(el => {
            el.textContent = ''; 
        });
    }

    // [main.js] GameApp 클래스 내부의 renderManageUI 메서드를 이 코드로 덮어씌우세요.

    renderManageUI() {
        if (GameState.heroes.length === 0) {
            const content = document.getElementById('sub-menu-content');
            content.innerHTML = "<div style='text-align:center; margin-top:50px; color:#666;'>고용된 영웅이 없습니다.</div>";
            return;
        }

        const hero = GameState.heroes[this.selectedHeroIdx];
        const content = document.getElementById('sub-menu-content');

        const heroBios = {
            'WARRIOR': "수많은 전장을 지나며 이름보다 흉터가 먼저 알려졌다.",
            'SORCERER': "메테오로 식당을 날려 먹은 뒤 영구 제명되었습니다.",
            'ARCHER': "전장에서 화살을 줍다 적과 눈이 마주칠 때가 가장 괴롭다.",
            'CLERIC': "치유는 오직 현금 결제만 가능합니다.",
            'MONK': "평화를 설파하며 주먹으로 싸움을 끝냅니다.",
            'ROGUE': "독약병을 깨뜨려 민폐가 일상입니다.",
            'BARD': "박수 소리가 없으면 조금 토라지는 예술가.",
            'DANCER': "춤은 아름답지만, 작별 인사는 늘 빠릅니다.",
            'ALCHEMIST': "세 번의 폭발 뒤 남는 건 성취 혹은 재.",
            'KNIGHT': "방패를 들어 올릴 때마다 작은 한숨을 쉽니다."
        };

        const getStatDetail = (key) => {
            const base = Number(hero[key]) || 0;
            let bonus = 0;
            Object.values(hero.equipment).forEach(itemId => {
                if (itemId && ITEM_DATA[itemId]) {
                    const item = ITEM_DATA[itemId];
                    if (item.type === 'WEAPON' && ((hero.atkType === 'PHYS' && key === 'str') || (hero.atkType === 'MAG' && key === 'int'))) bonus += item.val;
                    if (item.type === 'ARMOR' && key === 'def') bonus += item.val;
                    if (item.stat === key) bonus += item.val;
                }
            });
            return { base, bonus };
        };

        const getCombatVal = (stat) => {
            return Formulas.getDerivedStat(hero, stat, true);
        };

        const hpPct = (hero.curHp / hero.hp) * 100;
        const mpPct = (hero.curMp / hero.mp) * 100;
        const xpPct = (hero.xp / hero.maxXp) * 100;

        const barsHtml = `
            <div class="manage-bar-group">
                <div class="manage-bar-row">
                    <span style="width:20px; font-weight:bold; color:#f55;">HP</span> 
                    <div class="m-bar-bg"><div class="bar-fill hp-fill" style="width:${hpPct}%"></div></div> 
                    <span style="width:60px; text-align:right;">${Math.floor(hero.curHp)}/${hero.hp}</span>
                </div>
                <div class="manage-bar-row">
                    <span style="width:20px; font-weight:bold; color:#0cf;">MP</span> 
                    <div class="m-bar-bg"><div class="bar-fill mp-fill" style="width:${mpPct}%"></div></div> 
                    <span style="width:60px; text-align:right;">${Math.floor(hero.curMp)}/${hero.mp}</span>
                </div>
                <div class="manage-bar-row">
                    <span style="width:20px; font-weight:bold; color:#aaa;">XP</span> 
                    <div class="m-bar-bg"><div class="bar-fill xp-fill" style="width:${xpPct}%"></div></div> 
                    <span style="width:60px; text-align:right;">${Math.floor(hero.xp)}/${hero.maxXp}</span>
                </div>
            </div>`;

        let skillsHtml = `<div class="equip-group-title" style="margin-top:10px;"><span>SKILLS</span></div><div style="display:grid; grid-template-columns:1fr; gap:5px; margin-bottom:15px;">`;

        if (Array.isArray(hero.skills) && hero.skills.length > 0) {
            hero.skills.forEach(s => {
                if (!s) return;
                const icon = s.icon || '❓';
                const name = s.name || '알 수 없는 스킬';
                const desc = s.desc || '데이터를 불러올 수 없습니다.';
                const mp = s.mp || 0;
                const cool = s.cool || 0;

                skillsHtml += `
                    <div style="background:#1a1a1a; padding:6px 10px; border-radius:4px; display:flex; align-items:center; gap:10px; border:1px solid #333;">
                        <div style="font-size:18px;">${icon}</div>
                        <div style="flex:1;">
                            <div style="color:gold; font-size:11px; font-weight:bold;">${name}</div>
                            <div style="color:#666; font-size:10px;">${desc}</div>
                        </div>
                        <div style="text-align:right; font-size:10px; color:#888;">
                            <div>MP ${mp}</div>
                            <div>Cool ${cool}</div>
                        </div>
                    </div>`;
            });
        } else {
            skillsHtml += `<div style="color:#666; font-size:11px; text-align:center; padding:10px;">습득한 스킬이 없습니다.</div>`;
        }
        skillsHtml += `</div>`;

        content.innerHTML = `
            <div class="manage-container">
                <div class="manage-col">
                    <div class="col-header">▼ ROSTER</div>
                    <div class="col-body" id="manage-list"></div>
                </div>

                <div class="manage-col">
                    <div class="col-header">▼ EQUIPMENT & BAG</div>
                    <div class="col-body" style="padding:15px; display:flex; flex-direction:column; align-items:center;">
                        <div style="font-size: 70px; margin-bottom:10px;">${hero.icon}</div>
                        <h2 style="color:gold; margin:0; font-family:'Orbitron';">LV.${hero.level} ${hero.name}</h2>
                        
                        <div style="font-size:12px; color:#888; text-align:center; line-height:1.4; margin:10px 0 10px; padding:10px; background:rgba(0,0,0,0.3); border-radius:4px; width:100%;">
                            ${heroBios[hero.classKey] || "이 영웅은 비밀이 많습니다."}
                        </div>

                        <div class="equipment-layout" style="margin-top:10px; width:100%;">
                            ${this.renderSlot(hero, 'weapon', '무기', '🗡️')}
                            ${this.renderSlot(hero, 'armor', '갑옷', '🛡️')}
                            ${this.renderSlot(hero, 'acc1', '장신구 I', '💍')}
                            ${this.renderSlot(hero, 'acc2', '장신구 II', '📿')}
                            ${this.renderSlot(hero, 'potion1', '슬롯 I', '🧪')}
                            ${this.renderSlot(hero, 'potion2', '슬롯 II', '💊')}
                        </div>

                        <div style="margin-top: 20px; width:100%; border-top: 1px solid #444; padding-top: 10px;">
                            <div style="font-size: 11px; color: gold; margin-bottom: 8px; font-family: 'Orbitron'; text-align:center;">INVENTORY</div>
                            <div id="mini-inventory" class="mini-inven-grid"></div>
                        </div>
                    </div>
                </div>

                <div class="manage-col">
                    <div class="col-header">▼ STATUS</div>
                    <div class="col-body" style="padding:15px; display:flex; flex-direction:column;">
                        
                        ${barsHtml}

                        <div class="stat-panel-container">
                            <div class="stat-panel" style="flex:1;">
                                <div class="stat-sub-header">BASIC (PT: ${hero.statPoints})</div>
                                ${['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].map(key => {
                                    const d = getStatDetail(key);
                                    return `
                                    <div class="stat-box" onmouseenter="game.previewStatImpact('${key}')" onmouseleave="game.clearStatPreview()">
                                        <span class="stat-key">${key.toUpperCase()}</span>
                                        <div class="stat-value-group">
                                            <span class="stat-value-num" style="font-family:var(--font-game); font-size:14px; color:#eee;">
                                                ${d.base}${d.bonus > 0 ? `<span class="stat-bonus" style="color:#5f5; font-size:11px; margin-left:4px;">(+${d.bonus})</span>` : ''}
                                            </span>
                                            <div style="width: 16px; display: flex; justify-content: center; flex-shrink: 0;"> 
                                                ${hero.statPoints > 0 ? `<button class="stat-up-btn" onclick="game.allocateManageStat('${key}')">+</button>` : ''}
                                            </div>
                                        </div>
                                    </div>`;
                                }).join('')}
                            </div>

                            <div class="stat-panel" style="flex:1;">
                                <div class="stat-sub-header">COMBAT</div>
                                ${[
                                    { id: 'atk_phys', label: '물리공격', key: 'atk_phys' },
                                    { id: 'atk_mag', label: '마법공격', key: 'atk_mag' },
                                    { id: 'def', label: '물리방어', key: 'def' },
                                    { id: 'res', label: '마법저항', key: 'res' },
                                    { id: 'hit_phys', label: '물리명중', key: 'hit_phys' },
                                    { id: 'hit_mag', label: '마법명중', key: 'hit_mag' },
                                    { id: 'crit', label: '치명타', key: 'crit' },
                                    { id: 'eva', label: '회피율', key: 'eva' },
                                    { id: 'tenacity', label: '상태저항', key: 'tenacity' },
                                    { id: 'spd', label: '행동속도', key: 'spd' }
                                ].map(stat => `
                                    <div class="stat-box" id="c-stat-${stat.id}">
                                        <div class="stat-label-group" style="display:flex; align-items:center; gap:10px; flex:1;">
                                            <span class="stat-key" style="font-family:var(--font-main); font-size:11px; color:#aaa;">${stat.label}</span>
                                            <span class="stat-preview-arrow" style="display:inline-block; width:20px; color:#0f0; font-weight:bold; text-align:center; font-size:14px;"></span> 
                                        </div>
                                        <span class="stat-value-num" style="font-family:var(--font-game); font-size:14px; color:#eee; text-align:right; min-width:45px;">
                                            ${getCombatVal(stat.key)}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        ${skillsHtml}

                        <button class="dismiss-btn" style="margin-top: auto;" onclick="game.dismissHero(${this.selectedHeroIdx})">영웅 방출 (Release)</button>
                    </div>
                </div>
            </div>
        `;

        this.renderHeroList();
        this.renderGridInventory(hero);
    }

    renderHeroList() {
        const listEl = document.getElementById('manage-list');
        listEl.innerHTML = GameState.heroes.map((h, idx) => `
            <div class="hero-list-item ${idx === this.selectedHeroIdx ? 'selected' : ''}" onclick="game.changeSelectedHero(${idx})">
                <div class="list-icon">${h.icon}</div>
                <div class="list-info">
                    <h4>${h.name}</h4>
                    <span>Lv.${h.level} ${h.classKey}</span>
                </div>
            </div>
        `).join('');
    }

    renderGridInventory(hero) {
        const invEl = document.getElementById('mini-inventory');
        let html = '';
        for (let i = 0; i < 20; i++) {
            const itemId = GameState.inventory[i];
            if (itemId) {
                const item = ITEM_DATA[itemId];
                const canEquip = (!item.jobs || item.jobs.length === 0) || item.jobs.includes(hero.classKey);
                html += `
                    <div class="mini-item" style="opacity:${canEquip ? 1 : 0.3};" 
                            onclick="game.equipItem(${this.selectedHeroIdx}, ${i})"
                            onmouseenter="game.showItemTooltip(event, '${itemId}')" onmouseleave="game.hideTooltip()">
                        <span class="item-icon">${item.icon}</span>
                    </div>`;
            } else {
                html += `<div class="mini-item empty" style="background:rgba(255,255,255,0.03); border:1px dashed #333;"></div>`;
            }
        }
        invEl.innerHTML = html;
    }

    changeSelectedHero(idx) {
        this.selectedHeroIdx = idx;
        this.renderManageUI();
    }

    renderSlot(hero, slotKey, label, placeholderIcon) {
        const itemId = hero.equipment[slotKey];
        const item = itemId ? ITEM_DATA[itemId] : null;
        const filledClass = item ? 'filled' : '';
        
        return `
        <div class="equip-slot-modern ${filledClass}"
                onclick="game.unequipItem(${this.selectedHeroIdx}, '${slotKey}')"
                onmouseenter="${item ? `game.showItemTooltip(event, '${itemId}')` : ''}"
                onmouseleave="game.hideTooltip()">
            <div class="slot-bg-icon">${item ? item.icon : placeholderIcon}</div>
            <div class="slot-info">
                <span class="slot-name">${item ? item.name : label}</span>
                ${!item ? `<span class="slot-placeholder">비어있음</span>` : ''}
            </div>
        </div>`;
    }

    equipItem(heroIdx, invIdx) {
        const hero = GameState.heroes[heroIdx];
        const itemId = GameState.inventory[invIdx];
        const item = ITEM_DATA[itemId];

        if (item.jobs && item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
            this.showAlert("이 직업은 착용할 수 없습니다.");
            return;
        }

        let slotToUse = null;
        if (item.type === 'WEAPON') slotToUse = 'weapon';
        else if (item.type === 'ARMOR') slotToUse = 'armor';
        else if (item.type === 'ACC') slotToUse = !hero.equipment.acc1 ? 'acc1' : (!hero.equipment.acc2 ? 'acc2' : 'acc1');
        else if (item.type === 'POTION') slotToUse = !hero.equipment.potion1 ? 'potion1' : (!hero.equipment.potion2 ? 'potion2' : 'potion1');

        if (hero.equipment[slotToUse]) GameState.inventory.push(hero.equipment[slotToUse]);
        hero.equipment[slotToUse] = itemId;
        GameState.inventory.splice(invIdx, 1);
        this.renderManageUI();
        this.saveGame();
    }

    unequipItem(heroIdx, slotKey) {
        const hero = GameState.heroes[heroIdx];
        if (hero.equipment[slotKey]) {
            GameState.inventory.push(hero.equipment[slotKey]);
            hero.equipment[slotKey] = null;
            this.renderManageUI();
            this.saveGame();
        }
    }

    dismissHero(idx) {
        const h = GameState.heroes[idx];
        Object.keys(h.equipment).forEach(slot => {
            if(h.equipment[slot]) GameState.inventory.push(h.equipment[slot]);
        });
        this.showConfirm(`${h.name} 영웅을 떠나보내시겠습니까?`, () => {
            GameState.heroes.splice(idx, 1);
            this.selectedHeroIdx = 0;
            this.renderManageUI();
            this.saveGame();
        });
    }

    showItemTooltip(e, itemId) {
        const item = ITEM_DATA[itemId];
        const tooltip = document.getElementById('global-tooltip');
        if(!item) return;
        let jobsStr = (!item.jobs || item.jobs.length === 0) ? "모든 직업" : item.jobs.join(', ');
        
        tooltip.innerHTML = `
            <div class="tt-title">${item.icon} ${item.name}</div>
            <div class="tt-type">${item.type} | 가격: ${item.cost}</div>
            <div class="tt-stat">${item.desc}</div>
            <div class="tt-job">착용: ${jobsStr}</div>
        `;
        tooltip.style.display = 'block';
        this.moveTooltip(e);
    }

    hideTooltip() { document.getElementById('global-tooltip').style.display = 'none'; }

    moveTooltip(e) {
        const tooltip = document.getElementById('global-tooltip');
        if(tooltip.style.display === 'block') {
            const x = Math.min(e.clientX + 15, window.innerWidth - 240);
            const y = Math.min(e.clientY + 15, window.innerHeight - 150);
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
    }

    openBattleSelect() {
        this.showScene('scene-stage-select');
        this.renderChapterList();
        this.renderStageList(GameState.progress.chapter);
    }
    renderChapterList() {
        const list = document.getElementById('chapter-list');
        list.innerHTML = '';
        for(let i=1; i<=3; i++) {
            const btn = document.createElement('button');
            btn.className = `chapter-btn ${i === GameState.progress.chapter ? 'active' : ''}`;
            btn.textContent = `Chapter ${i}`;
            btn.onclick = () => this.renderStageList(i);
            list.appendChild(btn);
        }
    }
    renderStageList(chapter) {
        const list = document.getElementById('stage-list'); 
        list.innerHTML = '';
        for(let i=1; i<=10; i++) {
            const isCleared = (chapter < GameState.progress.chapter) || (chapter === GameState.progress.chapter && i < GameState.progress.stage);
            const isLocked = (chapter > GameState.progress.chapter) || (chapter === GameState.progress.chapter && i > GameState.progress.stage);
            
            const btn = document.createElement('div');
            btn.className = `hero-list-item ${isLocked ? 'locked' : ''} ${isCleared ? 'selected' : ''}`;
            btn.style.flexDirection = "column";
            btn.style.justifyContent = "center";
            btn.style.height = "100px";

            btn.innerHTML = `
                <h3 style="font-family: var(--font-game); margin: 0; color: ${isLocked ? '#444' : 'var(--gold)'};">STAGE ${chapter}-${i}</h3>
                <span style="font-size: 11px; color: #888;">${isCleared ? '✓ COMPLETED' : (isLocked ? '🔒 LOCKED' : 'READY TO BATTLE')}</span>
            `;
            if(!isLocked) btn.onclick = () => this.openBattlePrep(chapter, i);
            list.appendChild(btn);
        }
    }

    onBattleEnd(victory, isSurrender = false) {
        const modal = document.getElementById('battle-result-modal');
        modal.style.display = 'flex';
        const title = document.getElementById('battle-result-title');
        const desc = document.getElementById('battle-result-desc');
        const modalBtns = document.querySelector('.modal-btns');

        if (victory) {
            title.textContent = "VICTORY!"; title.style.color = "gold";
            const currentChapter = Number(window.battle?.chapter) || 1;
            const currentStage = Number(window.battle?.stage) || 1;
            const prog = GameState.progress;

            const isFirstClear = (currentChapter > prog.chapter) || (currentChapter === prog.chapter && currentStage >= prog.stage);
            const isRepeat = !isFirstClear;

            const stageInfo = STAGE_DATA[currentChapter]?.[currentStage];
            let baseReward = stageInfo ? (stageInfo.rewardGold || 100) : 100;
            let reward = isRepeat ? Math.floor(baseReward * 0.1) : baseReward; 

            GameState.gold += reward;
            desc.textContent = isRepeat ? `보상: ${reward} 골드 (반복 클리어)` : `보상: ${reward} 골드 획득!`;

            if (isFirstClear) {
                if (prog.stage < 10) prog.stage++;
                else if (prog.chapter < 3) { prog.chapter++; prog.stage = 1; }
            }
            if (window.battle) window.battle.isAutoBattle = false;
            this.refreshShopStock(); this.refreshTavern(false);
            
            modalBtns.innerHTML = `<button id="btn-next-stage">다음 스테이지</button><button id="btn-return-town-res">마을로 돌아가기</button>`;
            document.getElementById('btn-next-stage').onclick = () => { 
                modal.style.display='none'; 
                this.openBattlePrep(prog.chapter, prog.stage); 
            };
            document.getElementById('btn-return-town-res').onclick = () => this.enterTown();

        } else {
            title.textContent = "DEFEAT..."; title.style.color = "#f44";
            if (isSurrender) desc.textContent = "도망쳤습니다... (보상 없음)";
            else {
                const consolation = Math.floor(50 * GameState.progress.chapter);
                GameState.gold += consolation;
                desc.textContent = `패배... (위로금 ${consolation} G)`;
            }
            modalBtns.innerHTML = `<button id="btn-return-town-fail">마을로 돌아가기</button>`;
            document.getElementById('btn-return-town-fail').onclick = () => this.enterTown();
        }
    }

    openInn() {
        this.showScene('scene-sub-menu');
        document.getElementById('sub-menu-title').textContent = "여관";
        document.getElementById('sub-menu-content').innerHTML = '';
        GameState.heroes.forEach(h => {
            const missing = h.hp - h.curHp;
            const cost = missing * 2;
            const card = document.createElement('div'); card.className = 'hero-card';
            card.innerHTML = `<div class="card-header"><div class="card-icon">${h.icon}</div><div>${h.name} HP:${Math.floor(h.curHp)}/${h.hp}</div></div><button class="hire-btn" onclick="game.healHero('${h.name}', ${cost})" ${missing<=0?'disabled':''}>${missing<=0?'완전회복':'치료 '+cost+'G'}</button>`;
            document.getElementById('sub-menu-content').appendChild(card);
        });
    }
    healHero(name, cost) {
        const h = GameState.heroes.find(x => x.name === name);
        if(h && GameState.gold >= cost) { GameState.gold -= cost; h.curHp = h.hp; this.updateSubMenuGold(); this.openInn(); this.saveGame(); } 
        else { this.showAlert("골드 부족"); }
    }
    openSanctuary() { this.showPlaceholder("성소", "준비중"); }
    showPlaceholder(t, m) { this.showScene('scene-sub-menu'); document.getElementById('sub-menu-title').textContent=t; document.getElementById('sub-menu-content').innerHTML=`<div style="padding:50px; text-align:center;">${m}</div>`; }
}

const canvas = document.getElementById('gridCanvas');
window.isBattleActive = false;
window.game = new GameApp();