import { ITEM_DATA, STAGE_DATA, SKILL_DATABASE, CLASS_DATA, ELEMENTS, TERRAIN_TYPES, BUILDING_TYPES, TIER_REQ } from './data/index.js';
import { GameState, loadGame } from './state.js';
import { HexGrid } from './hex.js';
import { GameRenderer } from './render/renderer.js';
import { BattleSystem } from './systems/battle/BattleSystem.js';
import { TownSystem } from './systems/town/TownSystem.js';
import { HeroManager } from './systems/town/HeroManager.js';

class GameApp {
    constructor() {
        window.game = this;
        this.gameState = GameState; 
        this.itemData = ITEM_DATA;
        this.buildingData = BUILDING_TYPES;
        
        // 1. 하위 시스템 인스턴스 생성
        this.townSystem = new TownSystem(this);
        this.heroManager = new HeroManager(this);
        
        // 2. 게임 로드
        loadGame();

        // 3. 데이터 검증 및 초기화
        // 영웅 데이터가 없거나 깨져있으면 새 게임으로 초기화
        if (!this.gameState || !this.gameState.heroes || this.gameState.heroes.length === 0) {
            this.initNewGame();
        } else {
            // [호환성 패치] 기존 세이브에 없는 신규 재화/플래그 추가
            if (this.gameState.gold === undefined) this.gameState.gold = 2000;
            if (this.gameState.renown === undefined) this.gameState.renown = 100;
            if (this.gameState.ancientCoin === undefined) this.gameState.ancientCoin = 0;
            if (!this.gameState.flags) this.gameState.flags = {};
        }

        this.init();    
    }

    
    initNewGame() {
        console.log("🆕 게임 데이터 초기화 실행");
        
        // 1. 기본 값 리셋
        this.gameState.chapter = 1;
        this.gameState.stage = 0;
        this.gameState.gold = 2000;      // 초기 골드
        this.gameState.renown = 200;     // 명성
        this.gameState.ancientCoin = 3;  // 고대 주화
        this.gameState.templeTier = 1; // 신전 등급을 1로 강제 초기화
        this.gameState.shopTier = 1;   // 상점 등급을 1로 강제 초기화
        this.gameState.townLevel = 1;  // 마을 레벨 초기화
        
        // 2. 배열/객체 비우기 (참조 유지)
        if (this.gameState.inventory) this.gameState.inventory.length = 0; else this.gameState.inventory = [];
        if (this.gameState.heroes) this.gameState.heroes.length = 0; else this.gameState.heroes = [];
        if (this.gameState.clearedStages) this.gameState.clearedStages.length = 0; else this.gameState.clearedStages = [];
        if (this.gameState.recruitPool) this.gameState.recruitPool.length = 0; else this.gameState.recruitPool = [];
        
        //this.gameState.flags = {}; 
        this.gameState.shopStock = { weapon: [], armor: [], potion: [] };
        this.gameState.progress = { chapter: 1, stage: 0 };

        // 3. 주인공 생성 (데이터 안전장치 포함)
        const startKey = (typeof CLASS_DATA !== 'undefined' && CLASS_DATA['COMMANDER']) ? 'COMMANDER' : 'WARRIOR';
        this.addHero(startKey);
        
        // ▼▼▼ [신규 추가] 초기 장비 지급 및 커맨더 스킬 초기화 로직 ▼▼▼
        const hero = this.gameState.heroes[0]; // 방금 생성된 주인공
        if (hero) {
            // 직업별 초기 장비 정의 (ID는 items.js와 일치해야 함)
            const INITIAL_LOADOUT = {
                'WARRIOR': { mainHand: 'WP_SW_01', offHand: 'WP_SW_01', body: 'AR_LT_02' }, 
                'KNIGHT':   { mainHand: 'WP_SW_01', offHand: 'SH_03', body: 'AR_HV_00' }, 
                'ARCHER':   { mainHand: 'WP_BW_01', body: 'AR_LT_02' }, 
                'ROGUE':    { mainHand: 'WP_DG_01', body: 'AR_LT_02' }, 
                'SORCERER': { mainHand: 'WP_ST_01', body: 'AR_RB_00' }, 
                'CLERIC':   { mainHand: 'WP_MC_01', body: 'AR_RB_00' }, 
                'ALCHEMIST':{ mainHand: 'WP_TL_01', body: 'AR_RB_00' },                
                'MONK':     { mainHand: 'WP_FS_01', body: 'AR_LT_01' }, 
                'BARD':     { mainHand: 'WP_IN_01', body: 'AR_LT_01' }, 
                'DANCER':   { mainHand: 'WP_FN_01', body: 'AR_LT_01' }, 
                'COMMANDER':{ mainHand: 'WP_SW_01', body: 'AR_HV_00' }
            };

            const loadout = INITIAL_LOADOUT[hero.classKey];
            if (loadout) {
                if (loadout.mainHand) hero.equipment.mainHand = loadout.mainHand;
                if (loadout.offHand)  hero.equipment.offHand  = loadout.offHand;
                if (loadout.body)     hero.equipment.body     = loadout.body;
                console.log(`⚔️ [초기장비] ${hero.name}에게 기본 장비를 지급했습니다.`);
            }

            // 커맨더는 초기에 스킬 없이 시작 (신전에서 획득)
            if (hero.classKey === 'COMMANDER') {
                hero.skills = [];
                hero.equippedSkills = [];
                console.log(`🔒 [초기화] 커맨더의 스킬을 잠금 처리했습니다.`);
            }
        }
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        // 4. 저장 및 UI 즉시 반영
        this.saveGame();
        this.updateResourceDisplay(); 
    }

    init() {
        let needSave = false;

        // [데이터 호환성 패치]
        if (this.gameState.heroes) {
            this.gameState.heroes.forEach(hero => {
                if (hero.level === undefined || isNaN(Number(hero.level)) || hero.level < 1) {
                    hero.level = 1; needSave = true;
                }
                if (hero.maxXp === undefined || isNaN(Number(hero.maxXp)) || hero.maxXp <= 0) {
                    hero.maxXp = Math.floor(100 * Math.pow(1.2, hero.level - 1)); needSave = true;
                }
                if (hero.xp === undefined || isNaN(Number(hero.xp))) {
                    hero.xp = 0; needSave = true;
                }
                ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(stat => {
                    if (hero[stat] === undefined || isNaN(Number(hero[stat]))) {
                        hero[stat] = 10; needSave = true;
                    }
                });
            });
        }

        if (!this.gameState.flags) { this.gameState.flags = {}; needSave = true; }

        if (needSave) {
            console.log("💾 데이터 복구 및 저장 완료");
            this.saveGame();
        }

        if(!this.gameState.shopStock || Object.keys(this.gameState.shopStock).length === 0) {
            this.townSystem.refreshShopStock();
        }
        if(!this.gameState.recruitPool || this.gameState.recruitPool.length === 0) {
            this.townSystem.refreshTavern(false);
        }

        // --- 이벤트 리스너 ---
        const titleBtn = document.getElementById('scene-title');
        if(titleBtn) {
            titleBtn.onclick = (e) => {
                if(e.target.id === 'btn-reset-start') return; 
                if (this.gameState.heroes.length === 0) {
                    this.initNewGame(); return;
                }
                this.startBattle(1, 0, null); 
            };
        }

        const startResetBtn = document.getElementById('btn-reset-start');
        if(startResetBtn) {
            startResetBtn.onclick = (e) => { e.stopPropagation(); this.resetGame(); };
        }
        
        const link = (id, fn) => { 
            const el = document.getElementById(id); 
            if (el) typeof fn === 'function' ? el.onclick = fn.bind(this) : null;
        };
        
        // ▼▼▼ [수정] 모험 떠나기 버튼 삭제 (숨김 처리) ▼▼▼
        const battleBtn = document.getElementById('btn-battle');
        if (battleBtn) battleBtn.style.display = 'none';
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        link('btn-inn', () => this.townSystem.openInn());
        link('btn-tavern', () => this.townSystem.openTavern());
        link('btn-blacksmith', () => this.townSystem.openBlacksmith()); 
        link('btn-hero', () => this.heroManager.openUI());
        link('btn-sanctuary', () => this.townSystem.openTemple()); 
        link('btn-reset', this.resetGame);
        link('btn-sub-close', this.closeSubMenu);
        link('btn-open-hero', () => this.heroManager.openUI());

        // 파티 버튼 삭제
        const partyBtn = document.getElementById('btn-side-party');
        if (partyBtn) partyBtn.style.display = 'none';
        const openPartyBtn = document.getElementById('btn-open-party');
        if (openPartyBtn) openPartyBtn.style.display = 'none';

        link('btn-close-party', () => { 
            const el = document.getElementById('modal-party'); if(el) el.style.display = 'none'; 
        });
        link('btn-party-close', () => { 
            const el = document.getElementById('modal-party'); if(el) el.style.display = 'none'; 
        });
        link('btn-party-to-hero', () => { 
            const el = document.getElementById('modal-party'); if(el) el.style.display = 'none'; 
            this.heroManager.openUI(); 
        });
        
        const stageSelBackBtn = document.querySelector('#scene-stage-select .close-btn');
        if (stageSelBackBtn) {
            stageSelBackBtn.onclick = (e) => { e.stopPropagation(); this.closeStageSelect(); };
        }
        
        this.setupUIControls();
        this.updateResourceDisplay(); 
    }

    resetGame() {
        if(confirm("모든 데이터를 삭제하고 처음부터 시작하시겠습니까?")) {
            localStorage.removeItem('hexRpgSave'); 
            location.reload(); 
        }
    }

    updateResourceDisplay() {
        const goldEl = document.getElementById('ui-gold');
        if (goldEl) {
            const gold = this.gameState.gold || 0;
            const renown = this.gameState.renown || 0;
            const coin = this.gameState.ancientCoin || 0;
            
            goldEl.innerHTML = `
                <span style="margin-right:15px;">💰 ${gold.toLocaleString()}</span>
                <span style="margin-right:15px; color:#ff9955;">🎖️ ${renown}</span>
                <span style="color:#4ff;">🧿 ${coin}</span>
            `;
        }
        const subMenuGold = document.getElementById('sub-menu-gold');
        if(subMenuGold) {
             subMenuGold.innerText = `💰 ${this.gameState.gold.toLocaleString()}`;
        }
    }

    closeSubMenu() {
        document.getElementById('scene-sub-menu').classList.remove('active');
        document.getElementById('scene-battle').classList.add('active');
        if (window.battle && window.battle.currentUnit) {
            window.battle.centerCameraOnUnit(window.battle.currentUnit);
            window.battle.updateFloatingControls();
        }
    }

    setupUIControls() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'h' || e.key === 'H') {
                window.isHudHidden = !window.isHudHidden;
                if (window.battle) {
                    window.battle.updateFloatingControls();
                }
            }
        });
    }

    // =========================================================================
    // [스테이지 선택]
    // =========================================================================
    openBattleSelect() {
        this.showScene('scene-stage-select');
        this.renderChapterList();
        this.renderStageList(this.gameState.progress.chapter);
    }

    closeStageSelect() {
        const battle = window.battle;
        if (battle && battle.isBattleEnded) {
            this.startBattle(battle.chapter, battle.stage, battle.customParty);
        } else {
            this.showScene('scene-battle');
            if (battle && battle.currentUnit) {
                battle.centerCameraOnUnit(battle.currentUnit);
                battle.updateFloatingControls();
            }
        }
    }

    renderChapterList() {
        const list = document.getElementById('chapter-list');
        if(!list) return;
        list.innerHTML = '';
        for(let i=1; i<=3; i++) {
            const btn = document.createElement('button');
            btn.className = `chapter-btn ${i === this.gameState.progress.chapter ? 'active' : ''}`;
            btn.textContent = `Chapter ${i}`;
            btn.onclick = () => this.renderStageList(i);
            list.appendChild(btn);
        }
    }

    renderStageList(chapter) {
        const list = document.getElementById('stage-list'); 
        if(!list) return;
        list.innerHTML = '';
        for(let i=1; i<=10; i++) {
            const isCleared = (chapter < this.gameState.progress.chapter) || (chapter === this.gameState.progress.chapter && i < this.gameState.progress.stage);
            const isLocked = (chapter > this.gameState.progress.chapter) || (chapter === this.gameState.progress.chapter && i > this.gameState.progress.stage);
            
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

    // =========================================================================
    // [전투 준비 화면]
    // =========================================================================
    openBattlePrep(chapter, stage) {
        const stageKey = `${chapter}-${stage}`;
        if (!this.gameState.clearedStages) this.gameState.clearedStages = [];
        
        const isCleared = this.gameState.clearedStages.includes(stageKey);
        const isTown = (stage === 0); 

        // 이미 깼거나 마을이면 바로 진입
        if (isCleared || isTown) {
            const activeParty = this.gameState.heroes
                .filter(h => h.curHp > 0)
                .slice(0, 6)
                .map((h, idx) => {
                    return { hero: h, q: null, r: null, rosterIdx: idx }; 
                });

            if (activeParty.length === 0) {
                this.showAlert("출전 가능한 영웅이 없습니다!");
                return;
            }
            this.prepState = { chapter, stage, party: activeParty, leaderIdx: 0 };
            this.startBattle(chapter, stage, activeParty);
            return;
        }

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
        const battle = window.battle;
        if (battle) {
            if (battle.isBattleEnded) {
                this.startBattle(battle.chapter, battle.stage, battle.customParty);
            } else {
                this.showScene('scene-battle');
                if (battle.currentUnit) {
                    battle.centerCameraOnUnit(battle.currentUnit);
                    battle.updateFloatingControls();
                }
            }
        } else {
            this.showScene('scene-stage-select');
        }
    }

    getStartPositions(chapter, stage) {
        const stageData = STAGE_DATA[chapter]?.[stage];
        if (!stageData) return ["0,0", "1,0", "0,1", "-1,0", "0,-1", "1,-1"]; 

        let positions = [];
        if (stageData.deployment && stageData.deployment.length > 0) {
            return stageData.deployment; 
        }
        if (stageData.structures) {
            for (const str of stageData.structures) {
                const parts = str.split(':');
                if (parts[0] === 'START_POINT') {
                    const q = parseInt(parts[1]);
                    const r = parseInt(parts[2]);
                    positions.push(`${q},${r}`);
                    const neighbors = [[1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1]];
                    for(const [dq, dr] of neighbors) {
                        positions.push(`${q+dq},${r+dr}`);
                    }
                }
            }
        }
        if (positions.length > 0) return [...new Set(positions)];
        return ["0,0", "1,0", "0,1", "-1,0", "0,-1", "1,-1"];
    }

    renderPrepUI() {
        const { chapter, stage, party, leaderIdx } = this.prepState;
        
        if (!STAGE_DATA[chapter] || !STAGE_DATA[chapter][stage]) {
            console.error(`[Error] Missing stage data: ${chapter}-${stage}`);
            return;
        }

        const stageData = STAGE_DATA[chapter][stage];
        const titleEl = document.getElementById('prep-title');
        const countEl = document.getElementById('prep-count');
        
        if(titleEl) titleEl.textContent = `PREPARE FOR STAGE ${chapter}-${stage}`;
        if(countEl) countEl.textContent = `${party.length} / 6`;

        // 1. 미니맵 렌더링
        const mapWrapper = document.getElementById('prep-minimap');
        if(!mapWrapper) return;
        mapWrapper.innerHTML = '';

        const deployablePositions = this.getStartPositions(chapter, stage);

        const hexList = [];
        const HEX_SIZE_PREP = 20; 
        const getAxial = (col, row) => ({ q: col - (row - (row & 1)) / 2, r: row });
        const getRawHexPixel = (q, r) => ({ x: HEX_SIZE_PREP * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r), y: HEX_SIZE_PREP * (3/2 * r) });

        const mapCols = stageData.cols || 10;
        const mapRows = stageData.rows || 10;

        for (let r = 0; r < mapRows; r++) for (let c = 0; c < mapCols; c++) hexList.push(getAxial(c, r));

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        hexList.forEach(h => {
            const p = getRawHexPixel(h.q, h.r);
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });

        const mapWidth = (maxX - minX) + (HEX_SIZE_PREP * 2); 
        const mapHeight = (maxY - minY) + (HEX_SIZE_PREP * 1.8);
        const containerW = 880, containerH = 480;
        let scale = Math.min(containerW / mapWidth, containerH / mapHeight);
        if (scale > 1.3) scale = 1.3; 

        const offsetX = (containerW / scale - mapWidth) / 2 - minX + HEX_SIZE_PREP;
        const offsetY = (containerH / scale - mapHeight) / 2 - minY + HEX_SIZE_PREP;

        mapWrapper.style.transform = `scale(${scale})`;
        mapWrapper.style.transformOrigin = '0 0'; 

        const hexToPixel = (q, r) => {
            const raw = getRawHexPixel(q, r);
            return { x: raw.x + offsetX, y: raw.y + offsetY };
        };

        hexList.forEach(h => {
            const key = `${h.q},${h.r}`;
            const mapVal = stageData.map ? stageData.map[key] : null;
            let tKey = mapVal ? ((typeof mapVal === 'string') ? mapVal : mapVal.key) : 'GRASS_01';
            const terrainInfo = TERRAIN_TYPES[tKey];

            if (terrainInfo) {
                const pos = hexToPixel(h.q, h.r);
                const hex = document.createElement('div');
                hex.className = 'hex-tile'; 
                hex.style.backgroundColor = terrainInfo.color;
                hex.style.left = `${pos.x - 20}px`; 
                hex.style.top = `${pos.y - 22}px`;
                
                if (deployablePositions.includes(key)) {
                    hex.classList.add('zone-ally'); 
                    hex.ondrop = (e) => { e.preventDefault(); hex.classList.remove('drag-valid'); this.handlePrepDrop(e, h.q, h.r); };
                    hex.ondragover = (e) => { e.preventDefault(); hex.classList.add('drag-hover'); };
                    hex.ondragleave = (e) => { hex.classList.remove('drag-hover'); };
                } else {
                    hex.style.filter = 'brightness(0.9)'; 
                }
                mapWrapper.appendChild(hex);
            }
        });

        // 적 유닛 표시
        if (stageData.enemies) {
            stageData.enemies.forEach(raw => {
                let entry = raw.split('*')[0]; 
                if (entry.includes(':')) {
                    const [eKey, qStr, rStr] = entry.split(':');
                    const q = parseInt(qStr), r = parseInt(rStr);
                    if (!isNaN(q) && !isNaN(r)) {
                        const pos = hexToPixel(q, r);
                        const unit = document.createElement('div');
                        unit.className = 'hex-unit enemy';
                        const mData = CLASS_DATA[eKey] || { icon: '👾', name: 'Unknown' };
                        unit.textContent = mData.icon;
                        unit.style.left = `${pos.x - 18}px`; 
                        unit.style.top = `${pos.y - 20}px`;
                        mapWrapper.appendChild(unit);
                    }
                }
            });
        }

        // 아군 유닛 표시
        party.forEach((pData, idx) => {
            const pos = hexToPixel(pData.q, pData.r);
            const unit = document.createElement('div');
            unit.className = `hex-unit hero ${idx === leaderIdx ? 'is-leader' : ''}`;
            unit.textContent = pData.hero.icon;
            unit.style.left = `${pos.x - 18}px`;
            unit.style.top = `${pos.y - 20}px`;
            
            unit.draggable = true;
            unit.onclick = (e) => { e.stopPropagation(); this.removeHeroFromPrep(idx); };
            unit.ondragstart = (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'map', idx: idx })); };
            unit.ondragover = (e) => { e.preventDefault(); };
            unit.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); this.handlePrepDrop(e, pData.q, pData.r, idx); };
            mapWrapper.appendChild(unit);
        });

        // 2. 우측/하단 패널 정보 업데이트
        const enemiesList = stageData.enemies || [];
        const enemyListEl = document.getElementById('prep-enemy-list');
        const weaknessCounts = {}; 

        if (enemyListEl) {
            enemyListEl.innerHTML = '';
            enemiesList.forEach(raw => {
                let [entry, countStr] = raw.split('*');
                let count = parseInt(countStr) || 1;
                let key = entry.split(':')[0];
                const eData = CLASS_DATA[key];
                if(eData) {
                    const elInfo = ELEMENTS[eData.element];
                    if(elInfo && elInfo.weak) {
                        weaknessCounts[elInfo.weak] = (weaknessCounts[elInfo.weak] || 0) + count;
                        const card = document.createElement('div');
                        card.className = 'enemy-card-mini';
                        card.innerHTML = `<span style="font-size:20px;">${eData.icon}</span><div><div style="font-weight:bold;color:#f88;">${eData.name} x${count}</div><div style="font-size:10px;">약점: ${ELEMENTS[elInfo.weak].icon}</div></div>`;
                        enemyListEl.appendChild(card);
                    }
                }
            });
        }

        const bestEle = Object.keys(weaknessCounts).sort((a,b) => weaknessCounts[b] - weaknessCounts[a])[0];
        const tipEl = document.getElementById('prep-tip');
        if (tipEl) {
            tipEl.innerHTML = bestEle 
                ? `💡 추천 속성: <b>${ELEMENTS[bestEle].name} ${ELEMENTS[bestEle].icon}</b>` 
                : `💡 상성을 고려하여 배치하세요.`;
        }

        const deployedListEl = document.getElementById('prep-deployed-list');
        if (deployedListEl) {
            deployedListEl.innerHTML = '';
            party.forEach((pData, idx) => {
                const isLeader = (idx === this.prepState.leaderIdx);
                const div = document.createElement('div');
                div.className = `deployed-card ${isLeader ? 'active-leader' : ''}`;
                div.innerHTML = `<span style="font-size:20px;">${pData.hero.icon}</span><div>${pData.hero.name}</div>${isLeader?'👑':''}`;
                div.onclick = () => { this.prepState.leaderIdx = idx; this.renderPrepUI(); };
                deployedListEl.appendChild(div);
            });
        }

        const rosterEl = document.getElementById('prep-roster');
        if (rosterEl) {
            rosterEl.innerHTML = '';
            this.gameState.heroes.forEach((h, originalIdx) => {
                const isDeployed = this.prepState.party.some(p => p.rosterIdx === originalIdx);
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
                        <div class="mini-bar-bg" title="HP"><div class="mini-bar-fill hp-fill" style="width:${hpPct}%"></div></div>
                        <div class="mini-bar-bg" title="MP"><div class="mini-bar-fill mp-fill" style="width:${mpPct}%"></div></div>
                    </div>
                `;
                
                if (!isDeployed && !isDead) {
                    card.draggable = true;
                    card.ondragstart = (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'roster', hIdx: originalIdx })); };
                    card.ondblclick = () => this.autoPlaceHero(h, originalIdx); 
                }
                rosterEl.appendChild(card);
            });
        }
    }

    handlePrepDrop(e, q, r, targetUnitIdx = -1) {
        try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            const party = this.prepState.party;

            if (data.type === 'roster') {
                const heroIdx = data.hIdx;
                const hero = GameState.heroes[heroIdx];
                if (hero.curHp <= 0) { this.showAlert("기절한 영웅입니다."); return; }
                if (party.some(p => p.rosterIdx === heroIdx)) return;
                if (party.length >= 6) { this.showAlert("최대 6명!"); return; }
                
                const existingIdx = party.findIndex(p => p.q === q && p.r === r);
                if (existingIdx !== -1) party[existingIdx] = { hero: hero, q, r, rosterIdx: heroIdx };
                else party.push({ hero: hero, q, r, rosterIdx: heroIdx });
            } 
            else if (data.type === 'map') {
                const fromIdx = data.idx;
                const destIdx = party.findIndex(p => p.q === q && p.r === r);
                if (destIdx !== -1 && destIdx !== fromIdx) {
                    const tempQ = party[fromIdx].q; const tempR = party[fromIdx].r;
                    party[fromIdx].q = q; party[fromIdx].r = r;
                    party[destIdx].q = tempQ; party[destIdx].r = tempR;
                } else {
                    party[fromIdx].q = q; party[fromIdx].r = r;
                }
            }
            this.renderPrepUI();
        } catch(err) { console.error(err); }
    }

    removeHeroFromPrep(idx) {
        this.prepState.party.splice(idx, 1);
        if (this.prepState.leaderIdx >= this.prepState.party.length) this.prepState.leaderIdx = 0;
        this.renderPrepUI();
    }

    clearParty() {
        this.prepState.party = [];
        this.prepState.leaderIdx = 0;
        this.renderPrepUI();
    }

    autoPlaceHero(hero, originalIdx) {
        if (this.prepState.party.length >= 6) return;
        
        const deployable = this.getStartPositions(this.prepState.chapter, this.prepState.stage);
        
        for (const posKey of deployable) {
            const [q, r] = posKey.split(',').map(Number);
            if (!this.prepState.party.some(p => p.q === q && p.r === r)) {
                this.prepState.party.push({ hero: hero, q, r, rosterIdx: originalIdx });
                this.renderPrepUI();
                return;
            }
        }
        this.showAlert("빈 공간이 없습니다!");
    }

    autoFormParty() {
        const { chapter, stage } = this.prepState;
        const deployable = this.getStartPositions(chapter, stage);
        
        if (deployable.length === 0) {
            this.showAlert("배치 가능한 구역이 없습니다!");
            return;
        }

        const stageData = STAGE_DATA[chapter][stage];
        const enemies = stageData.enemies || [];
        const weakMap = {};
        enemies.forEach(raw => {
            const key = raw.split(':')[0]; 
            const eData = CLASS_DATA[key];
            if(eData && ELEMENTS[eData.element]) weakMap[ELEMENTS[eData.element].weak] = true;
        });

        const scoredHeroes = GameState.heroes
            .filter(h => h.curHp > 0)
            .map((h, i) => {
                let score = h.level * 10 + (h.str + h.int + h.def) * 0.5;
                if (weakMap[h.element]) score += 50;
                return { hero: h, originalIdx: i, score: score };
            })
            .sort((a, b) => b.score - a.score); 

        this.prepState.party = [];
        const deployCount = Math.min(6, scoredHeroes.length, deployable.length);

        for (let i = 0; i < deployCount; i++) {
            const c = scoredHeroes[i];
            const [q, r] = deployable[i].split(',').map(Number);
            this.prepState.party.push({ hero: c.hero, q, r, rosterIdx: c.originalIdx });
        }
        this.prepState.leaderIdx = 0;
        this.renderPrepUI();
    }

    confirmBattleStart() {
        if (this.prepState.party.length === 0) return this.showAlert("최소 1명의 영웅이 필요합니다!");
        
        const finalParty = [...this.prepState.party];
        if (this.prepState.leaderIdx > 0) {
            const leader = finalParty.splice(this.prepState.leaderIdx, 1)[0];
            finalParty.unshift(leader);
        }
        this.startBattle(this.prepState.chapter, this.prepState.stage, finalParty);
    }

    // =========================================================================
    // [전투 시작]
    // =========================================================================
    startBattle(chapter, stage, customParty) {
        // [안전장치] 영웅이 없으면 전투 시작 금지
        if ((!customParty && this.gameState.heroes.length === 0) || (customParty && customParty.length === 0)) {
            console.warn("⛔ 영웅이 없어 전투를 시작할 수 없습니다.");
            this.showAlert("전투에 내보낼 영웅이 없습니다!");
            return;
        }

        this.showScene('scene-battle');
        
        setTimeout(() => {
            const canvas = document.getElementById('gridCanvas');
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }

            window.grid = new HexGrid(canvas); 
            window.renderer = new GameRenderer(canvas, window.grid); 

            const stageData = STAGE_DATA[chapter]?.[stage];
            if (stageData) {
                // 1. 지형 로드
                if (stageData.map) {
                    Object.entries(stageData.map).forEach(([pos, val]) => {
                        const [q, r] = pos.split(',').map(Number);
                        window.grid.setTerrain(q, r, val); 
                    });
                }
                
                // 2. 건물 데이터 로드
                if (stageData.structures) {
                    stageData.structures.forEach(str => {
                        const parts = str.split(':');
                        if(parts.length >= 3) {
                            const type = parts[0];
                            const q = parseInt(parts[1]);
                            const r = parseInt(parts[2]);
                            const text = parts.slice(3).join(':'); 
                            
                            const cell = window.grid.terrainMap.get(`${q},${r}`) || { key: 'GRASS_01', h:0 };
                            cell.building = { key: type, text: text };
                            window.grid.setTerrain(q, r, cell);
                        }
                    });
                }
            }
            
            window.battle = new BattleSystem(window.grid, this, chapter, stage, customParty);
            
        }, 50);
    }

    // [수정] 보상 스킵, 패배 처리, 마을 복귀 로직 개선
    onBattleEnd(victory, isSurrender = false, skipReward = false, customTarget = null) {
        if (victory && skipReward) {
            this.proceedToNextStage(false, customTarget); 
            return; 
        }

        const modal = document.getElementById('battle-result-modal');
        modal.style.display = 'flex';
        const title = document.getElementById('battle-result-title');
        const desc = document.getElementById('battle-result-desc');
        const modalBtns = document.querySelector('.modal-btns');

        if (victory) {
            title.textContent = "VICTORY!"; 
            title.style.color = "gold";
            
            // 승리 보상은 BattleSystem에서 처리되므로 여기선 단순 메시지
            desc.textContent = "전투 승리!";

            this.proceedToNextStage(true, customTarget); 
            
            modalBtns.innerHTML = `<button id="btn-next-stage">이동하기</button><button id="btn-return-town-res">마을로</button>`;
            
            document.getElementById('btn-next-stage').onclick = () => { 
                modal.style.display='none'; 
                this.openBattlePrep(this.gameState.progress.chapter, this.gameState.progress.stage); 
            };
            document.getElementById('btn-return-town-res').onclick = () => {
                modal.style.display = 'none';
                this.closeSubMenu(); 
            };
        } 
        else {
            title.textContent = "DEFEAT..."; 
            title.style.color = "#f44";
            desc.textContent = isSurrender ? "도망쳤습니다..." : "패배했습니다...";
            
            modalBtns.innerHTML = `<button id="btn-defeat-back">이전 지역으로 돌아가기</button>`;
            
            document.getElementById('btn-defeat-back').onclick = () => {
                modal.style.display = 'none';
                if (this.gameState.returnPoint) {
                    const { chapter, stage } = this.gameState.returnPoint;
                    this.startBattle(chapter, stage, null);
                } 
                else {
                    this.startBattle(1, 0, null);
                }
            };
        }

        this.saveGame();
        this.updateResourceDisplay(); 
    }

    proceedToNextStage(onlySave = false, customTarget = null) {
        const prog = this.gameState.progress;
        
        if (customTarget) {
            prog.chapter = customTarget.chapter;
            prog.stage = customTarget.stage;
        } else {
            if (prog.stage < 10) {
                prog.stage++;
            } else if (prog.chapter < 3) {
                prog.chapter++;
                prog.stage = 1;
            }
        }
        
        this.saveGame();
        
        if (!onlySave) {
            this.openBattlePrep(prog.chapter, prog.stage);
        }
    }

    showScene(id) {
        document.querySelectorAll('.scene').forEach(el => el.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        window.isBattleActive = (id === 'scene-battle');
        if(id === 'scene-sub-menu') this.updateResourceDisplay();
        const tooltip = document.getElementById('global-tooltip');
        if(tooltip) tooltip.style.display = 'none';
    }

    showConfirm(msg, onYes) {
        if(confirm(msg)) onYes();
    }

    showAlert(msg) {
        alert(msg);
    }

    saveGame() { 
        localStorage.setItem('hexRpgSave', JSON.stringify(this.gameState)); 
    }

    // [Party Manager]
    openPartyManager() {
        const modal = document.getElementById('modal-party');
        if(modal) modal.style.display = 'flex';
        this.renderPartyUI();
    }

    renderPartyUI() {
        const MAX_SLOTS = 5; 
        const UNLOCKED_SLOTS = 3; 

        const slotsContainer = document.getElementById('party-slots-container');
        const rosterContainer = document.getElementById('party-roster-list');
        const countDisplay = document.getElementById('party-count-val');

        if (!slotsContainer || !rosterContainer) return;
        
        slotsContainer.innerHTML = '';
        rosterContainer.innerHTML = '';

        let currentPartyCount = 0;

        for (let i = 0; i < MAX_SLOTS; i++) {
            const isLocked = i >= UNLOCKED_SLOTS;
            const hero = this.gameState.heroes[i]; 
            
            const slot = document.createElement('div');
            
            if (isLocked) {
                slot.className = 'party-slot-card locked';
                slot.innerHTML = `<div class="slot-icon-area">🔒</div><div class="slot-desc">Locked</div>`;
            } else if (hero) {
                currentPartyCount++;
                const isLeader = (i === 0);
                slot.className = `party-slot-card filled ${isLeader ? 'leader' : ''}`;
                
                slot.innerHTML = `
                    ${isLeader ? '<div class="leader-badge" style="pointer-events:none;">LEADER</div>' : ''}
                    <div class="slot-icon-area" style="pointer-events:none;">${hero.icon}</div>
                    <div class="slot-name" style="pointer-events:none;">${hero.name}</div>
                    <div class="slot-desc" style="pointer-events:none;">Lv.${hero.level} ${hero.classKey}</div>
                    ${!isLeader ? '<div class="remove-hint" style="pointer-events:none; color:#f55; font-size:10px; margin-top:auto;">Click to Remove</div>' : ''}
                `;
                
                if (!isLeader) {
                    slot.onclick = (e) => {
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        this.removeFromParty(i);
                    };
                }
            } else {
                slot.className = 'party-slot-card empty';
                slot.innerHTML = `<div class="slot-icon-area" style="opacity:0.2;">➕</div><div class="slot-desc">Empty Slot</div>`;
            }
            slotsContainer.appendChild(slot);
        }
        
        if(countDisplay) countDisplay.innerText = currentPartyCount;

        for (let i = UNLOCKED_SLOTS; i < this.gameState.heroes.length; i++) {
            const hero = this.gameState.heroes[i];
            if (!hero) continue;

            const card = document.createElement('div');
            card.className = 'roster-mini-card';
            card.innerHTML = `
                <div class="r-icon" style="pointer-events:none;">${hero.icon}</div>
                <div class="r-name" style="pointer-events:none;">${hero.name}</div>
                <div class="r-lv" style="pointer-events:none;">Lv.${hero.level}</div>
            `;
            card.onclick = () => this.addToParty(i);
            rosterContainer.appendChild(card);
        }
    }
    
    removeFromParty(partyIndex) {
        if (partyIndex === 0) {
            this.showAlert("리더는 파티에서 제외할 수 없습니다.");
            return;
        }
        const hero = this.gameState.heroes[partyIndex];
        if (!hero) return; 
        this.gameState.heroes[partyIndex] = undefined; 
        this.gameState.heroes.push(hero); 
        this.renderPartyUI();
        if(window.battle) window.battle.renderPartyList(); 
    }

    addToParty(rosterIndex) {
        let targetSlot = -1;
        if (!this.gameState.heroes[1]) targetSlot = 1;
        else if (!this.gameState.heroes[2]) targetSlot = 2;
        
        if (targetSlot === -1) {
            this.showAlert("파티 슬롯이 꽉 찼습니다!\n먼저 파티원을 클릭해 대기 상태로 보내세요.");
            return;
        }

        const temp = this.gameState.heroes[targetSlot]; 
        this.gameState.heroes[targetSlot] = this.gameState.heroes[rosterIndex];
        this.gameState.heroes[rosterIndex] = temp;
        
        const partyPart = this.gameState.heroes.slice(0, 3);
        const rosterPart = this.gameState.heroes.slice(3).filter(h => h !== undefined);
        this.gameState.heroes = [...partyPart, ...rosterPart];

        this.renderPartyUI(); 
        if(window.battle) window.battle.renderPartyList(); 
    }
    
    addHero(key) {
        if (!CLASS_DATA[key]) {
            console.error(`Invalid Hero Key: ${key}`);
            if (key !== 'WARRIOR' && CLASS_DATA['WARRIOR']) return this.addHero('WARRIOR');
            return;
        }
        
        const heroData = CLASS_DATA[key];
        const hero = JSON.parse(JSON.stringify(heroData));
        hero.classKey = key; 
        hero.level = hero.level || 1; 

        if (hero.skillIds) {
            hero.skills = hero.skillIds.map(id => {
                const s = SKILL_DATABASE[id];
                if (!s) return null;
                return JSON.parse(JSON.stringify({ ...s, id: id }));
            }).filter(s => s !== null);
        } else if (!hero.skills) {
            hero.skills = [];
        }

        let defaultBasic = '1000';
        if (hero.skillIds && hero.skillIds.length > 0) {
            const firstId = parseInt(hero.skillIds[0]);
            defaultBasic = (Math.floor(firstId / 1000) * 1000).toString();
        }
        hero.equippedBasic = defaultBasic;

        const learnableSkills = hero.skills.filter(s => {
            const reqLv = TIER_REQ[s.tier] || 1; 
            return hero.level >= reqLv;
        });
        hero.equippedSkills = learnableSkills.slice(0, 6).map(s => s.id);

        hero.curHp = hero.hp; 
        hero.curMp = hero.mp;
        hero.xp = 0; 
        hero.maxXp = 100; 
        hero.statPoints = 0;
        hero.perks = {}; 

        hero.equipment = { 
            head: null, neck: null, body: null, legs: null, ring: null, 
            mainHand: null, offHand: null, 
            pocket1: null, pocket2: null, pocket3: null, pocket4: null 
        };

        ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(stat => {
            hero[stat] = hero[stat] || 10;
        });

        this.gameState.heroes.push(hero);
        this.saveGame(); 
        return hero;
    }
}

window.game = new GameApp();