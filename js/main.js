import { ITEM_DATA, STAGE_DATA, SKILL_DATABASE, CLASS_DATA, ELEMENTS, TERRAIN_TYPES, BUILDING_TYPES, TIER_REQ, JOB_CLASS_DATA } from './data/index.js';
import { GameState, loadGame } from './state.js';
import { HexGrid } from './hex.js';
import { GameRenderer } from './render/renderer.js';
import { BattleSystem } from './systems/battle/BattleSystem.js';
import { TownSystem } from './systems/town/TownSystem.js';
import { HeroManager } from './systems/town/HeroManager.js';
import { SkillManager } from './systems/town/SkillManager.js';
import { PORTRAIT_DATA } from './data/portraits.js';
import { SandboxManager } from './systems/battle/SandboxManager.js';

class GameApp {
    constructor() {
        window.game = this;
        this.gameState = GameState; 
        this.itemData = ITEM_DATA;
        this.buildingData = BUILDING_TYPES;
        this.townSystem = new TownSystem(this);
        this.heroManager = new HeroManager(this);
        this.skillManager = new SkillManager(this); 
        
        loadGame();

        if (!this.gameState || !this.gameState.heroes || this.gameState.heroes.length === 0) {
            this.initNewGame();
        } else {
            if (this.gameState.gold === undefined) this.gameState.gold = 2000;
            if (this.gameState.renown === undefined) this.gameState.renown = 100;
            if (this.gameState.ancientCoin === undefined) this.gameState.ancientCoin = 0;
            if (!this.gameState.flags) this.gameState.flags = {};
        }

        this.init();    
    }

    initNewGame() {
        console.log("🆕 게임 데이터 초기화 실행 (간소화 모드)");
        
        this.gameState.chapter = 1;
        this.gameState.stage = 0;
        this.gameState.gold = 5000;   
        this.gameState.renown = 200;     
        this.gameState.ancientCoin = 10;  
        this.gameState.templeTier = 1; 
        this.gameState.shopTier = 1;   
        this.gameState.townLevel = 1; 

        if (this.gameState.inventory) this.gameState.inventory.length = 0; else this.gameState.inventory = [];
        this.gameState.heroes = [];
        if (this.gameState.clearedStages) this.gameState.clearedStages.length = 0; else this.gameState.clearedStages = [];
        if (this.gameState.recruitPool) this.gameState.recruitPool.length = 0; else this.gameState.recruitPool = [];

        this.gameState.progress = { chapter: 1, stage: 0 };

        const STARTING_CLASSES = [
            'WARRIOR', 'KNIGHT', 'ARCHER', 'THIEF', 'SORCERER', 'MARTIAL ARTIST',
            'CLERIC' , 'BARD', 'DANCER', 'ALCHEMIST'
        ];
        
        const INITIAL_LOADOUT = {
            'WARRIOR': { mainHand: 'WP_SW_01', offHand: 'WP_SW_01', body: 'AR_LT_02' }, 
            'KNIGHT':   { mainHand: 'WP_SW_01', offHand: 'SH_03', body: 'AR_HV_00' }, 
            'ARCHER':   { mainHand: 'WP_BW_01', body: 'AR_LT_02' }, 
            'THIEF':    { mainHand: 'WP_DG_01', body: 'AR_LT_02' }, 
            'SORCERER': { mainHand: 'WP_ST_01', body: 'AR_RB_00' }, 
            'CLERIC':   { mainHand: 'WP_MC_01', body: 'AR_RB_00' }, 
            'ALCHEMIST':{ mainHand: 'WP_TL_01', body: 'AR_RB_00' },                
            'MARTIAL ARTIST':     { mainHand: 'WP_FS_01', body: 'AR_LT_01' }, 
            'BARD':     { mainHand: 'WP_IN_01', body: 'AR_LT_01' }, 
            'DANCER':   { mainHand: 'WP_FN_01', body: 'AR_LT_01' }
        };

        STARTING_CLASSES.forEach(key => {
            const hero = this.addHero(key);
            if (hero) {
                const loadout = INITIAL_LOADOUT[key];
                if (loadout) {
                    if (loadout.mainHand) hero.equipment.mainHand = loadout.mainHand;
                    if (loadout.offHand)  hero.equipment.offHand  = loadout.offHand;
                    if (loadout.body)     hero.equipment.body     = loadout.body;
                }
            }
        });

        console.log(`⚔️ [초기화] ${STARTING_CLASSES.length}명의 영웅 지급 완료.`);

        this.saveGame();
        this.updateResourceDisplay(); 
    }

    init() {
        let needSave = false;

        if (this.gameState.heroes) {
            this.gameState.heroes.forEach(hero => {
                if (!hero) return; 
                
                if ((!hero.skills || hero.skills.length === 0) && hero.skillIds && typeof SKILL_DATABASE !== 'undefined') {
                    hero.skills = hero.skillIds.map(id => {
                        const s = SKILL_DATABASE[id];
                        return s ? JSON.parse(JSON.stringify({ ...s, id: id })) : null;
                    }).filter(s => s !== null);
                }
                
                // 장착 스킬 슬롯이 훼손되었을 경우 기본값 강제 복원
                if (!hero.equippedSkills || hero.equippedSkills.length !== 6) {
                    hero.equippedSkills = [null, null, null, null, null, null];
                }

                if (hero.level === undefined || isNaN(Number(hero.level)) || hero.level < 1) {
                    hero.level = 1; needSave = true;
                }
                if (hero.maxXp === undefined || isNaN(Number(hero.maxXp)) || hero.maxXp <= 0) {                    hero.maxXp = Math.floor(100 * Math.pow(1.2, hero.level - 1)); needSave = true;
                }
                if (hero.xp === undefined || isNaN(Number(hero.xp))) {
                    hero.xp = 0; needSave = true;
                }
                ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(stat => {
                    if (hero[stat] === undefined || isNaN(Number(hero[stat]))) {
                        hero[stat] = 10; needSave = true;
                    }
                });

                // ⭐ [버그 수정] 자동배치가 안 되는 문제(curHp가 undefined)를 방지하기 위해 신규 공식으로 HP/MP 갱신
                const calcHp = Math.floor(50 + (hero.level * 5) + (hero.vit * 10) + (hero.str * 2));
                const calcMp = Math.floor((hero.baseMp || 0) + (hero.level * 2) + (hero.int * 5) + (hero.vol * 2));
                
                if (!hero.hp || hero.hp <= 0) { hero.hp = calcHp; needSave = true; }
                if (!hero.mp || hero.mp <= 0) { hero.mp = calcMp; needSave = true; }
                if (hero.curHp === undefined || hero.curHp === null || isNaN(hero.curHp)) { hero.curHp = hero.hp; needSave = true; }
                if (hero.curMp === undefined || hero.curMp === null || isNaN(hero.curMp)) { hero.curMp = hero.mp; needSave = true; }
            });
        }

        if (!this.gameState.flags) { this.gameState.flags = {}; needSave = true; }

        if (needSave) {
            console.log("💾 데이터 복구 및 저장 완료");
            this.saveGame();
        }

      const titleBtn = document.getElementById('scene-title');
        if(titleBtn) {
            titleBtn.onclick = (e) => {
                if(e.target.id === 'btn-reset-start') return; 
                if (this.gameState.heroes.length === 0) {
                    this.initNewGame();
                }
                this.openWorldMap(); 
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

        const battleBtn = document.getElementById('btn-battle');
        if (battleBtn) battleBtn.style.display = 'none';

        link('btn-reset', this.resetGame);
        link('btn-sub-close', this.closeSubMenu); 
        
        link('btn-close-party', () => { 
            const el = document.getElementById('modal-party'); if(el) el.style.display = 'none'; 
        });
        link('btn-party-close', () => { 
            const el = document.getElementById('modal-party'); if(el) el.style.display = 'none'; 
        });
        
        const stageSelBackBtn = document.querySelector('#scene-stage-select .close-btn');
        if (stageSelBackBtn) {
            stageSelBackBtn.style.display = 'none'; 
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
                <span class="res-item res-gold">💰 ${gold.toLocaleString()}</span>
                <span class="res-item res-renown">🎖️ ${renown}</span>
                <span class="res-item res-coin">🧿 ${coin}</span>
            `;
        }
        const subMenuGold = document.getElementById('sub-menu-gold');
        if(subMenuGold) {
             subMenuGold.innerText = `💰 ${this.gameState.gold.toLocaleString()}`;
        }
    }

    closeSubMenu() {
        if (this.townSystem) this.townSystem.removeNPC();       
        document.getElementById('scene-sub-menu').classList.remove('active');
        this.enterVillage();
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
    // [월드맵 시스템] 
    // =========================================================================
    openWorldMap() {
        this.showScene('scene-stage-select');
        this.renderWorldMap();
    }

    renderWorldMap() {
        const container = document.getElementById('scene-stage-select');
        if (!container) return;

        let worldContainer = document.getElementById('world-map-container');
        if (!worldContainer) {
            container.innerHTML = ''; 
            worldContainer = document.createElement('div');
            worldContainer.id = 'world-map-container';
            worldContainer.appendChild(document.createElement('h1')).textContent = "WORLD MAP";
            container.appendChild(worldContainer);
        } else {
            worldContainer.innerHTML = '';
        }

        const title = document.createElement('h1');
        title.textContent = "WORLD MAP";
        title.className = 'wm-title';
        worldContainer.appendChild(title);

        const townBtn = document.createElement('button');
        townBtn.textContent = "🏰 VILLAGE";
        townBtn.className = "world-node town wm-btn-town";
        townBtn.onclick = () => this.enterVillage();
        worldContainer.appendChild(townBtn);

        const line = document.createElement('div');
        line.className = 'wm-line';
        worldContainer.appendChild(line);

        const stageGrid = document.createElement('div');
        stageGrid.className = 'wm-stage-grid';
        
        const currentChap = this.gameState.progress.chapter;
        const currentStage = this.gameState.progress.stage;

        for (let i = 1; i <= 10; i++) {
            const isCleared = (currentChap > 1) || (i <= currentStage); 
            const isUnlocked = (i <= currentStage + 1); 

            const btn = document.createElement('div');
            btn.className = `world-node stage wm-node-stage ${isCleared ? 'cleared' : (isUnlocked ? 'unlocked' : 'locked')}`;
            
            btn.innerHTML = `
                <div class="wm-stage-lbl">STAGE</div>
                <div class="wm-stage-val">1-${i}</div>
                ${isCleared ? '<div class="wm-stage-check">✔</div>' : ''}
            `;

            if (isUnlocked) {
                btn.onclick = () => this.openBattlePrep(1, i);
            }
            stageGrid.appendChild(btn);
        }
        worldContainer.appendChild(stageGrid);

        const footer = document.createElement('div');
        footer.className = 'wm-footer';
        
        const partyBtn = document.createElement('button');
        partyBtn.className = 'wm-menu-btn';
        partyBtn.textContent = "👥 Party Management";
        partyBtn.onclick = () => this.openPartyManager();

        const heroBtn = document.createElement('button');
        heroBtn.className = 'wm-menu-btn';
        heroBtn.textContent = "🛡️ Character Management ";
        heroBtn.onclick = () => this.heroManager.openUI();

        const skillBtn = document.createElement('button');
        skillBtn.className = 'wm-menu-btn';
        skillBtn.textContent = "⚡ Skill Management";
        skillBtn.onclick = () => this.skillManager.openUI();

        footer.appendChild(partyBtn);
        footer.appendChild(heroBtn);
        footer.appendChild(skillBtn);
        worldContainer.appendChild(footer);
    }

    // =========================================================================
    // [마을 시스템] 
    // =========================================================================
    enterVillage() {
        this.showScene('scene-sub-menu');
        const uiIds = ['sub-menu-gold', 'sub-menu-title', 'btn-sub-close'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = 'none';
        });

        if (this.townSystem) this.townSystem.removeNPC();

        const content = document.querySelector('#scene-sub-menu .sub-menu-content');
        if (!content) return;
        content.innerHTML = ''; 

        const villageLayout = document.createElement('div');
        villageLayout.className = 'village-layout';

        villageLayout.innerHTML = `
            <div class="village-title-area">
                <h2>VILLAGE CENTER</h2>
                <div class="village-desc">평화로운 휴식처이자 모험의 시작점</div>
            </div>
        `;

        const grid = document.createElement('div');
        grid.className = 'village-grid';

        const openWithUI = (fn) => {
            uiIds.forEach(id => {
                const el = document.getElementById(id);
                if(el) el.style.display = ''; 
            });
            fn();
        };

        const places = [
            { name: "Weapon Shop", icon: "⚔️", desc: "무기 구매", action: () => openWithUI(() => this.townSystem.openShop('weapon')) },
            { name: "Armor Shop", icon: "🛡️", desc: "방어구 구매", action: () => openWithUI(() => this.townSystem.openShop('armor')) },
            { name: "Potion & Magic", icon: "⚗️", desc: "물약 및 소모품", action: () => openWithUI(() => this.townSystem.openShop('potion')) },
            { name: "The Inn", icon: "🛏️", desc: "영웅 회복 및 부활", action: () => openWithUI(() => this.townSystem.openInn()) },
            { name: "Party Management", icon: "👥", desc: "동료 편성 및 관리", action: () => this.openPartyManager() },
            { name: "Character Management", icon: "🛡️", desc: "영웅 장비 및 스탯", action: () => this.heroManager.openUI() },
            { name: "Skill Management", icon: "⚡", desc: "영웅 기술 관리", action: () => this.skillManager.openUI() },
            { name: "Sandbox Mode", icon: "🛠️", desc: "자유 훈련 및 실험장", action: () => {
                this.showConfirm("테스트 전장(샌드박스)으로 이동하시겠습니까?\n자유로운 몬스터 배치와 레벨업 조작이 가능합니다.", () => {
                    this.closeSubMenu();
                    const party = this.gameState.heroes.slice(0, 6).map(h => ({ hero: h }));
                    this.startBattle(99, 99, party);
                    setTimeout(() => {
                        if (window.battle && window.battle.sandbox) {
                            window.battle.sandbox.initTestBattlefield();
                        }
                    }, 500);
                });
            }}
        ];

        places.forEach(p => {
            const card = document.createElement('div');
            card.className = 'village-card';
            card.innerHTML = `
                <div class="v-icon">${p.icon}</div>
                <div class="v-name">${p.name}</div>
                <div class="v-desc">${p.desc}</div>
            `;
            card.onclick = p.action;
            grid.appendChild(card);
        });

        villageLayout.appendChild(grid);

        const exitBtn = document.createElement('button');
        exitBtn.className = 'village-back-btn';
        exitBtn.innerHTML = "◀ WORLD MAP";
        exitBtn.onclick = () => this.openWorldMap();
        villageLayout.appendChild(exitBtn);

        content.appendChild(villageLayout);
    }
    // =========================================================================
    // [전투 준비 화면]
    // =========================================================================
    openBattlePrep(chapter, stage) {
        const stageKey = `${chapter}-${stage}`;
        if (!this.gameState.clearedStages) this.gameState.clearedStages = [];
        
        if (stage === 0) return;

        this.showScene('scene-battle-prep');
        this.prepState = {
            chapter: chapter,
            stage: stage,
            party: [], 
            leaderIdx: 0 
        };
        this.renderPrepUI();

        const container = document.getElementById('scene-battle-prep');
        
        const oldSkillBtn = document.getElementById('prep-skill-btn');
        if (oldSkillBtn) oldSkillBtn.remove();

        let prepBtns = document.getElementById('prep-manager-btns');
        if (!prepBtns) {
            prepBtns = document.createElement('div');
            prepBtns.id = 'prep-manager-btns';
            prepBtns.className = 'prep-manager-btns';
            
            const btnHero = document.createElement('button');
            btnHero.innerHTML = "🛡️ Hero";
            btnHero.className = 'prep-menu-btn';
            btnHero.onclick = () => this.heroManager.openUI();
            
            const btnParty = document.createElement('button');
            btnParty.innerHTML = "👥 Party";
            btnParty.className = 'prep-menu-btn';
            btnParty.onclick = () => this.openPartyManager();
            
            const btnSkill = document.createElement('button');
            btnSkill.innerHTML = "⚡ Skill";
            btnSkill.className = 'prep-menu-btn';
            btnSkill.onclick = () => this.skillManager.openUI();
            
            prepBtns.appendChild(btnHero);
            prepBtns.appendChild(btnParty);
            prepBtns.appendChild(btnSkill);
            container.appendChild(prepBtns);
        }
    }

    closePrep() {
        this.openWorldMap();
    }

    syncPrepParty() {
        if (!this.prepState || !this.prepState.party) return;
        
        const activeHeroes = this.gameState.heroes.slice(0, 6); 
        this.prepState.party = this.prepState.party.filter(p => {
            const newIdx = activeHeroes.findIndex(h => h && h.id === p.hero.id);
            if (newIdx !== -1) {
                p.rosterIdx = newIdx;
                p.hero = activeHeroes[newIdx];
                return true;
            }
            return false;
        });

        if (this.prepState.leaderIdx >= this.prepState.party.length) {
            this.prepState.leaderIdx = 0;
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

        // ==========================================
        // 1. 미니맵 렌더링 
        // ==========================================
        const mapWrapper = document.getElementById('prep-minimap');
        if(mapWrapper) {
            mapWrapper.innerHTML = '';

            const innerMap = document.createElement('div');
            innerMap.className = 'prep-inner-map';

            const deployablePositions = this.getStartPositions(chapter, stage);
            const hexList = [];
            const HEX_SIZE_PREP = 22; 
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
            const mapHeight = (maxY - minY) + (HEX_SIZE_PREP * 2);
            
            // 좌표 및 크기 연산은 JS에서 인라인으로 처리 유지
            innerMap.style.width = `${mapWidth}px`;
            innerMap.style.height = `${mapHeight}px`;

            const wrapperW = mapWrapper.parentElement.clientWidth || 600;
            const wrapperH = mapWrapper.parentElement.clientHeight || 400;
            let scale = Math.min(wrapperW / mapWidth, wrapperH / mapHeight) * 0.85;
            if (scale > 1.2) scale = 1.2; 

            innerMap.style.transform = `scale(${scale})`;
            innerMap.style.transformOrigin = 'center center'; 

            const offsetX = -minX + HEX_SIZE_PREP;
            const offsetY = -minY + HEX_SIZE_PREP;

            const hexToPixel = (q, r) => {
                const raw = getRawHexPixel(q, r);
                return { x: raw.x + offsetX, y: raw.y + offsetY };
            };

            hexList.forEach(h => {
                const key = `${h.q},${h.r}`;
                const mapVal = stageData.map ? stageData.map[key] : null;
                let tKey = mapVal ? ((typeof mapVal === 'string') ? mapVal : mapVal.key) : 'GRASS_01';

                const terrainInfo = TERRAIN_TYPES[tKey] || TERRAIN_TYPES['PLAIN'] || TERRAIN_TYPES['GRASS_01'];

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
                        hex.classList.add('zone-locked');
                    }
                    innerMap.appendChild(hex);
                }
            });

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
                            innerMap.appendChild(unit);
                        }
                    }
                });
            }

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
                innerMap.appendChild(unit);
            });
            
            mapWrapper.appendChild(innerMap);
        }
        // ==========================================
        // 2. 우측 패널 (Enemies Info)
        // ==========================================
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
                        card.innerHTML = `
                            <span class="em-icon">${eData.icon}</span>
                            <div class="em-info">
                                <div class="em-name">${eData.name} x${count}</div>
                                <div class="em-weak">약점: ${ELEMENTS[elInfo.weak].icon}</div>
                            </div>
                        `;
                        enemyListEl.appendChild(card);
                    }
                }
            });
        }

        const bestEle = Object.keys(weaknessCounts).sort((a,b) => weaknessCounts[b] - weaknessCounts[a])[0];
        const tipEl = document.getElementById('prep-tip');
        if (tipEl) {
            tipEl.innerHTML = bestEle 
                ? `💡 추천 속성: <b class="tip-highlight">${ELEMENTS[bestEle].name} ${ELEMENTS[bestEle].icon}</b>` 
                : `💡 상성을 고려하여 배치하세요.`;
        }

        // ==========================================
        // 3. 좌측 패널 (Deployed Info)
        // ==========================================
        const deployedListEl = document.getElementById('prep-deployed-list');
        if (deployedListEl) {
            deployedListEl.innerHTML = '';
            party.forEach((pData, idx) => {
                const isLeader = (idx === this.prepState.leaderIdx);
                const div = document.createElement('div');
                div.className = `deployed-card ${isLeader ? 'active-leader' : ''}`;
                
                const portraitSrc = PORTRAIT_DATA[pData.hero.classKey || pData.hero.key];
                const iconHtml = portraitSrc 
                    ? `<img src="${portraitSrc}" class="dep-icon-img" />`
                    : `<span class="dep-icon-fallback">${pData.hero.icon}</span>`;

                div.innerHTML = `<div class="dep-icon-wrap">${iconHtml}</div><div class="dep-name">${pData.hero.name}</div>${isLeader?'<span class="dep-crown">👑</span>':''}`;
                div.onclick = () => { this.prepState.leaderIdx = idx; this.renderPrepUI(); };
                deployedListEl.appendChild(div);
            });
        }

        // ==========================================
        // 4. 하단 패널 (Roster) 
        // ==========================================
        const rosterEl = document.getElementById('prep-roster');
        if (rosterEl) {
            rosterEl.innerHTML = '';
            const activeParty = this.gameState.heroes.slice(0, 6);
            activeParty.forEach((h, originalIdx) => {
                if (!h) return; 
                const isDeployed = this.prepState.party.some(p => p.rosterIdx === originalIdx);
                const hpPct = (h.curHp / h.hp) * 100;
                const mpPct = (h.curMp / h.mp) * 100;
                const isDead = h.curHp <= 0;

                const card = document.createElement('div');
                card.className = `roster-card-h ${isDeployed ? 'deployed' : ''}`;
                if (isDead) {
                    card.classList.add('dead');
                }

                const portraitSrc = PORTRAIT_DATA[h.classKey || h.key];
                const iconHtml = portraitSrc 
                    ? `<img src="${portraitSrc}" class="rost-icon-img" />`
                    : `<div class="rost-icon-fallback">${h.icon}</div>`;

                card.innerHTML = `
                    <div class="rost-icon-wrap">${iconHtml}</div>
                    <div class="rost-name">${h.name}</div>
                    <div class="rost-lv">Lv.${h.level} ${h.classKey}</div>
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
        this.prepState.party = [];
        
        const activeParty = this.gameState.heroes.slice(0, 6);
        
        let deployIdx = 0;
        for (let i = 0; i < activeParty.length; i++) {
            const hero = activeParty[i];
            
            if (hero && hero.curHp > 0 && deployIdx < deployable.length) {
                const [q, r] = deployable[deployIdx].split(',').map(Number);
                this.prepState.party.push({ hero: hero, q, r, rosterIdx: i });
                deployIdx++;
            }
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
        if ((!customParty && this.gameState.heroes.length === 0) || (customParty && customParty.length === 0)) {
            console.warn("⛔ 영웅이 없어 전투를 시작할 수 없습니다.");
            this.showAlert("전투에 내보낼 영웅이 없습니다!");
            return;
        }

        this.showScene('scene-battle');
        
        setTimeout(() => {
            if (window.battle && typeof window.battle.destroy === 'function') window.battle.destroy();
            if (window.renderer && typeof window.renderer.destroy === 'function') window.renderer.destroy();

            const canvas = document.getElementById('gridCanvas');
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            window.grid = new HexGrid(canvas); 
            window.renderer = new GameRenderer(canvas, window.grid); 

            const stageData = STAGE_DATA[chapter]?.[stage];
            if (stageData) {
                if (stageData.map) {
                    Object.entries(stageData.map).forEach(([pos, val]) => {
                        const [q, r] = pos.split(',').map(Number);
                        window.grid.setTerrain(q, r, val); 
                    });
                }

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

    onBattleEnd(victory, isSurrender = false, skipReward = false, customTarget = null) {
        if (victory) {
            if (customTarget) {
                this.proceedToNextStage(false, customTarget); 
            }
            this.openWorldMap();
            return;
        }

        const modal = document.getElementById('battle-result-modal');
        modal.style.display = 'flex';
        const title = document.getElementById('battle-result-title');
        const desc = document.getElementById('battle-result-desc');
        const modalBtns = document.querySelector('.modal-btns');

        title.textContent = "DEFEAT..."; 
        title.className = "result-title-defeat";
        desc.textContent = isSurrender ? "도망쳤습니다..." : "파티가 전멸했습니다...";
        
        modalBtns.innerHTML = `<button id="btn-defeat-back" class="btn-defeat-back">월드맵으로 돌아가기</button>`;
        
        document.getElementById('btn-defeat-back').onclick = () => {
            modal.style.display = 'none';
            this.openWorldMap();
        };

        this.saveGame();
        this.updateResourceDisplay(); 
    }

    proceedToNextStage(onlySave = false, customTarget = null) {
        const prog = this.gameState.progress;
        
        if (customTarget) {
            prog.chapter = customTarget.chapter;
            prog.stage = customTarget.stage;
        } else {
            if (this.prepState.chapter >= prog.chapter && this.prepState.stage >= prog.stage) {
                prog.stage = this.prepState.stage; 
                
                if (prog.stage >= 10 && prog.chapter < 3) {
                    prog.chapter++;
                    prog.stage = 0; 
                }
            }
        }
        
        this.saveGame();
        
        const worldMapContainer = document.getElementById('scene-stage-select');
        if (worldMapContainer && worldMapContainer.classList.contains('active')) {
            this.renderWorldMap();
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
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => {
            localStorage.setItem('hexRpgSave', JSON.stringify(this.gameState)); 
        }, 500);
    }

    openPartyManager() {
        let modal = document.getElementById('modal-party');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-party';
            modal.className = 'modal party-manager-overlay';
            document.body.appendChild(modal);
        }

        if (!this.gameState.heroes) this.gameState.heroes = [];
        while (this.gameState.heroes.length < 6) {
            this.gameState.heroes.push(null);
        }

        if (!modal.querySelector('.party-modal-box')) {
            this.setupPartyModalStructure(modal);
        }

        modal.style.display = 'flex';
        this.renderPartyUI();
    }

    setupPartyModalStructure(modal) {
        modal.innerHTML = '';
        
        const content = document.createElement('div');
        content.className = 'party-modal-box luxury';
        content.innerHTML = `
            <div class="party-sub-header">
                <h2 class="skill-main-title">🚩 PARTY MANAGEMENT</h2>
                
                <div class="party-nav-group">
                    <button id="btn-party-to-hero" class="party-nav-btn to-hero">▶ CHRACTER MANAGEMENT</button>
                    <button id="btn-party-to-skill" class="party-nav-btn to-skill">▶ SKILL SETTINGS</button>
                </div>

                <button class="skill-close-btn" id="btn-party-real-close">✖</button>
            </div>

            <div class="party-roster-scroll">
                <div class="party-section-box">
                    <div class="party-section-header">
                        <div class="party-section-title">DEPLOYMENT LIST 출격 명단</div>
                        <div class="party-count-display"><span id="party-count-val">0</span> / 6</div>
                    </div>
                    <div id="party-slots-container" class="party-slots-container"></div>
                </div>
                <div class="party-section-box expand">
                    <div class="party-section-title with-margin">STANDBY LIST 대기 명단</div>
                    <div id="party-roster-list" class="party-roster-list"></div>
                </div>
            </div>
        `;
        
        modal.appendChild(content);
        
        const handleModalClose = (e) => {
            if(e) { e.preventDefault(); e.stopPropagation(); }
            modal.style.display = 'none';
            if (document.getElementById('scene-battle-prep').classList.contains('active')) {
                this.syncPrepParty();
                this.renderPrepUI();
            }
        };

        modal.querySelector('#btn-party-real-close').onclick = handleModalClose;
        
        modal.querySelector('#btn-party-to-hero').onclick = (e) => {
            handleModalClose(e);
            if(this.heroManager) this.heroManager.openUI();
        };
        
        modal.querySelector('#btn-party-to-skill').onclick = (e) => {
            handleModalClose(e);
            if(this.skillManager) this.skillManager.openUI();
        };
    }

    renderPartyUI() {
        const slotsContainer = document.getElementById('party-slots-container');
        const rosterContainer = document.getElementById('party-roster-list');
        const countDisplay = document.getElementById('party-count-val');

        if (!slotsContainer || !rosterContainer) return;

        slotsContainer.innerHTML = '';
        rosterContainer.innerHTML = '';

        const MAX_SLOTS = 6;
        let currentPartyCount = 0;

        const getHeroInfoHtml = (h) => {
            if (!h) return '';
            
            let jobName = h.job || '견습생';
            let classNameEn = h.classKey;
            let classNameKr = '';
            
            if (typeof JOB_CLASS_DATA !== 'undefined') {
                const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === h.classKey && c.classLevel === (h.classLevel || 1)) 
                           || Object.values(JOB_CLASS_DATA).find(c => c.jobKey === h.classKey);
                
                if (cInfo) {
                    jobName = cInfo.jobName || jobName;
                    classNameEn = cInfo.classNameEn;
                    classNameKr = `(${cInfo.className})`;
                }
            }
            
            return `
                <div class="party-hero-name">${h.name}</div>
                <div class="party-hero-lv">Lv.${h.level} ${jobName}</div>
                <div class="party-hero-class-en">Class ${h.classLevel || 1}. ${classNameEn}</div>
                ${classNameKr ? `<div class="party-hero-class-kr">${classNameKr}</div>` : ''}
            `;
        };

        for (let i = 0; i < MAX_SLOTS; i++) {
            const hero = this.gameState.heroes[i];
            const slot = document.createElement('div');
            
            slot.ondragover = (e) => { e.preventDefault(); slot.classList.add('drag-over'); };
            slot.ondragleave = (e) => { slot.classList.remove('drag-over'); };
            slot.ondrop = (e) => { e.preventDefault(); slot.classList.remove('drag-over'); this.handlePartyDrop(e, i); };

            if (hero) {
                currentPartyCount++;
                slot.className = 'party-slot-card filled';
                slot.draggable = true;
                slot.ondragstart = (e) => this.handlePartyDragStart(e, 'party', i);

                const infoHtml = getHeroInfoHtml(hero);
                
                const portraitSrc = PORTRAIT_DATA[hero.classKey || hero.key];
                const iconHtml = portraitSrc 
                    ? `<img src="${portraitSrc}" class="party-slot-img" />`
                    : `<div class="party-slot-fallback">${hero.icon}</div>`;

                slot.innerHTML = `
                    <div class="slot-icon-area">
                        ${iconHtml}
                    </div>
                    <div class="slot-info-area">
                        ${infoHtml}
                    </div>
                    <div class="remove-overlay">✖ 해제하기</div>
                `;
                
                slot.onclick = (e) => {
                    if (e) { e.preventDefault(); e.stopPropagation(); }
                    this.removeFromParty(i);
                };
            } else {
                slot.className = 'party-slot-card empty';
                slot.innerHTML = `<div class="slot-empty-icon">➕</div><div class="slot-desc">Empty Slot</div>`;
            }
            slotsContainer.appendChild(slot);
        }
        
        if (countDisplay) countDisplay.innerText = currentPartyCount;

        for (let i = MAX_SLOTS; i < this.gameState.heroes.length; i++) {
            const hero = this.gameState.heroes[i];
            if (!hero) continue;

            const card = document.createElement('div');
            card.className = 'roster-mini-card';
            card.draggable = true;
            card.ondragstart = (e) => this.handlePartyDragStart(e, 'roster', i);

            const infoHtml = getHeroInfoHtml(hero);
            
            const portraitSrc = PORTRAIT_DATA[hero.classKey || hero.key];
            const rIconHtml = portraitSrc 
                ? `<img src="${portraitSrc}" class="roster-slot-img" />`
                : `<div class="roster-slot-fallback">${hero.icon || '👤'}</div>`;

            card.innerHTML = `
                <div class="r-icon">
                    ${rIconHtml}
                </div>
                <div class="r-info-area">
                    ${infoHtml}
                </div>
                <div class="r-click-hint">클릭하여 추가</div>
            `;
            
            card.onclick = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.addToParty(i);
            };
            rosterContainer.appendChild(card);
        }
    }

    handlePartyDragStart(e, type, index) {
        e.dataTransfer.setData("type", type);
        e.dataTransfer.setData("index", index);
    }

    handlePartyDrop(e, targetSlotIdx) {
        const type = e.dataTransfer.getData("type");
        const sourceIdx = parseInt(e.dataTransfer.getData("index"));

        if (isNaN(sourceIdx)) return;

        if (type === 'roster') {
            this.addToParty(sourceIdx, targetSlotIdx);
        } else if (type === 'party') {
            if (sourceIdx === targetSlotIdx) return;
            const temp = this.gameState.heroes[targetSlotIdx];
            this.gameState.heroes[targetSlotIdx] = this.gameState.heroes[sourceIdx];
            this.gameState.heroes[sourceIdx] = temp;
            this.renderPartyUI(); 
        }
    }

    removeFromParty(partyIndex) {
        if (!this.gameState.heroes || !this.gameState.heroes[partyIndex]) return;

        const hero = this.gameState.heroes[partyIndex];

        this.gameState.heroes[partyIndex] = null;
        this.gameState.heroes.push(hero);

        const partySlots = this.gameState.heroes.slice(0, 6);
        const rosterSlots = this.gameState.heroes.slice(6).filter(h => h !== null);
        this.gameState.heroes = [...partySlots, ...rosterSlots];
        
        this.saveGame();

        try {
            this.renderPartyUI();
        } catch (e) {
            console.error("UI Update Error:", e);
        }
    }

    addToParty(rosterIndex, targetSlot = -1) {
        const hero = this.gameState.heroes[rosterIndex];
        if (!hero) return;

        if (targetSlot !== -1) {
            const existing = this.gameState.heroes[targetSlot];
            this.gameState.heroes[targetSlot] = hero;
            if (existing) {
                this.gameState.heroes[rosterIndex] = existing; 
            } else {
                this.gameState.heroes[rosterIndex] = null; 
            }
        } else {
            let emptySlot = -1;
            for (let i = 0; i < 6; i++) { 
                if (!this.gameState.heroes[i]) { emptySlot = i; break; }
            }
            if (emptySlot === -1) {
                this.showAlert("파티 슬롯이 꽉 찼습니다. 영웅을 먼저 해제하세요.");
                return;
            }
            this.gameState.heroes[emptySlot] = hero;
            this.gameState.heroes[rosterIndex] = null;
        }

        const party = this.gameState.heroes.slice(0, 6);
        const roster = this.gameState.heroes.slice(6).filter(h => h !== null);
        this.gameState.heroes = [...party, ...roster];

        this.saveGame();
        this.renderPartyUI(); 
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

        let dataLevel = heroData.level; 

        if (typeof JOB_CLASS_DATA !== 'undefined') {
            const jobInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === key && c.classLevel === 1) || Object.values(JOB_CLASS_DATA).find(c => c.jobKey === key);
            if (jobInfo && jobInfo.level !== undefined) {
                dataLevel = jobInfo.level;
            }
        }

        hero.level = dataLevel || 1; 

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
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const currentClassLv = hero.classLevel || 1;
            return currentClassLv >= reqClassLv;
        });
        
        hero.equippedSkills = [null, null, null, null, null, null];
        let aIdx = 0, sIdx = 3, pIdx = 5;

        learnableSkills.forEach(s => {
            const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A'); 
            
            if (part === 'A' && aIdx < 3) { hero.equippedSkills[aIdx++] = s.id; }
            else if (part === 'S' && sIdx < 5) { hero.equippedSkills[sIdx++] = s.id; }
            else if (part === 'P' && pIdx < 6) { hero.equippedSkills[pIdx++] = s.id; }
        });
        
        hero.xp = 0; 
        hero.maxXp = 100; 
        hero.perks = {}; 
        
        hero.classLevel = 8;    
        hero.jpTotal = 999;    
        hero.jpAvailable = 999; 
        
        hero.wp = {
            SWORD: { level: 1, xp: 0 }, BOW: { level: 1, xp: 0 }, STAFF: { level: 1, xp: 0 },
            MACE: { level: 1, xp: 0 }, DAGGER: { level: 1, xp: 0 }, FIST: { level: 1, xp: 0 },
            INST: { level: 1, xp: 0 }, FAN: { level: 1, xp: 0 }   
        };
        hero.utg = 0; 

        hero.sp = {}; 
        if (hero.skills) {
            hero.skills.forEach(s => {
                hero.sp[s.id] = { level: 1, xp: 0 };
            });
        }

        hero.equipment = { 
            head: null, neck: null, body: null, legs: null, ring: null, 
            mainHand: null, offHand: null, 
            pocket1: null, pocket2: null, pocket3: null, pocket4: null 
        };

        ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(stat => {
            hero[stat] = hero[stat] || 10;
        });

        // ⭐ [버그 수정] 영웅 생성 시점부터 신규 HP/MP 공식을 강제 적용하여 자동배치 조건(curHp>0) 통과
        hero.hp = Math.floor(50 + (hero.level * 5) + (hero.vit * 10) + (hero.str * 2));
        hero.mp = Math.floor((hero.baseMp || 0) + (hero.level * 2) + (hero.int * 5) + (hero.vol * 2));
        hero.curHp = hero.hp; 
        hero.curMp = hero.mp;

        this.gameState.heroes.push(hero);
        this.saveGame(); 
        return hero;
    }
} 

window.game = new GameApp();