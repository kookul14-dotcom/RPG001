// main.js
import { CLASS_DATA, ITEM_DATA, STAGE_DATA, ELEMENTS } from './data.js';
import { HexGrid } from './hex.js';
import { BattleSystem } from './battle.js';

// 1. 실제 데이터가 저장될 원본 객체
let rawGameState = {
    gold: 2000, 
    faith: 0,
    heroes: [], 
    inventory: [], 
    progress: { chapter: 1, stage: 1 },
    recruitPool: [],
    shopStock: [] 
};

// 2. 저장 성능 최적화
const IGNORED_PROPS = new Set([
    'shake', 'bumpX', 'bumpY', 't', 'tx', 'ty', 'isAnimating', 'projectiles', 'textQueue', 'lastTextTime', 'actionGauge'
]);

function createReactiveObject(target, callback) {
    const handler = {
        get(obj, prop) {
            const value = Reflect.get(obj, prop);
            if (typeof value === 'object' && value !== null) {
                return new Proxy(value, handler);
            }
            return value;
        },
        set(obj, prop, value) {
            const result = Reflect.set(obj, prop, value);
            if (IGNORED_PROPS.has(prop)) {
                return result;
            }
            callback(); 
            return result;
        },
        deleteProperty(obj, prop) {
            const result = Reflect.deleteProperty(obj, prop);
            callback(); 
            return result;
        }
    };
    return new Proxy(target, handler);
}

// 3. GameState 정의
const GameState = createReactiveObject(rawGameState, () => {
    localStorage.setItem('hexRpgSave', JSON.stringify(rawGameState));
});

class GameApp {
    constructor() {
        this.gameState = GameState; 
        this.loadGame();
        this.init();   
    }

    getStatCost(unit, statKey) {
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
            this.addHero('KNIGHT');
            this.addHero('MAGE');
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

    saveGame() { localStorage.setItem('hexRpgSave', JSON.stringify(GameState)); }
    
    loadGame() {
        const save = localStorage.getItem('hexRpgSave');
        if (save) {
            try {
                const data = JSON.parse(save);
                for (let key in data) {
                    GameState[key] = data[key];
                }
                console.log("💾 데이터를 불러왔습니다.");
                this.updateTownUI();
            } catch (e) {
                console.error("세이브 로드 실패:", e);
            }
        }
    }

    // ============================================================
    // [수정됨] 전투 준비 (Battle Prep) 관련 로직 시작
    // ============================================================

    openBattlePrep(chapter, stage) {
        this.showScene('scene-battle-prep');
        
        // 파티 상태 초기화
        this.prepState = {
            chapter: chapter,
            stage: stage,
            // party: [{hero:Object, q:Int, r:Int, rosterIdx:Int}, ...]
            // rosterIdx: GameState.heroes 내에서의 인덱스 (중복 비교용)
            party: [], 
            leaderIdx: 0 
        };
        
        this.renderPrepUI();
    }

    // [추가됨] 나가기 버튼 기능
    closePrep() {
        this.showScene('scene-stage-select');
    }

    renderPrepUI() {
        const { chapter, stage, party, leaderIdx } = this.prepState;
        
        document.getElementById('prep-title').textContent = `PREPARE FOR STAGE ${chapter}-${stage}`;
        document.getElementById('prep-count').textContent = `${party.length} / 6`;

        const mapWrapper = document.getElementById('prep-minimap');
        mapWrapper.innerHTML = '';

        // 1. 미니맵 그리드
        const hexToPixel = (q, r) => {
            const size = 20; 
            const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
            const y = size * (3/2 * r);
            return { x: x + 60, y: y + 60 }; 
        };

        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 22; c++) {
                const q = c - (r - (r & 1)) / 2;
                const pos = hexToPixel(q, r);
                const hex = document.createElement('div');
                const isAllyZone = c < 11; 
                hex.className = `hex-tile ${isAllyZone ? 'zone-ally' : 'zone-enemy'}`;
                hex.style.left = pos.x + 'px';
                hex.style.top = pos.y + 'px';
                if (isAllyZone) {
                    hex.ondragover = (e) => { e.preventDefault(); hex.classList.add('drag-valid'); };
                    hex.ondragleave = (e) => { hex.classList.remove('drag-valid'); };
                    hex.ondrop = (e) => { e.preventDefault(); hex.classList.remove('drag-valid'); this.handlePrepDrop(e, q, r); };
                }
                mapWrapper.appendChild(hex);
            }
        }

        // 2. 아군 배치
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

        // 3. 적군 배치
        const stageData = STAGE_DATA[chapter][stage];
        const enemies = stageData.enemies || ['SLIME'];
        const weaknessCounts = {};
        const enemyListEl = document.getElementById('prep-enemy-list');
        enemyListEl.innerHTML = '';

        enemies.forEach((eKey, enemyId) => {
            const eData = CLASS_DATA[eKey];
            if(eData) {
                const elInfo = ELEMENTS[eData.element];
                weaknessCounts[elInfo.weak] = (weaknessCounts[elInfo.weak] || 0) + 1;
                const card = document.createElement('div');
                card.className = 'enemy-card-mini';
                card.innerHTML = `<span style="font-size:20px;">${eData.icon}</span><div><div style="font-weight:bold;color:#f88;font-size:12px;">${eData.name}</div><div style="font-size:10px;color:#888;">약점: ${ELEMENTS[elInfo.weak].icon}</div></div>`;
                enemyListEl.appendChild(card);

                const ENEMY_BASE_COL = 14; 
                const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4];
                const row = 6 + rowOffsets[enemyId % 8];
                const col = ENEMY_BASE_COL + Math.floor(enemyId / 8);
                const q = col - (row - (row & 1)) / 2;
                const r = row;
                const pos = hexToPixel(q, r);
                const unit = document.createElement('div');
                unit.className = 'hex-unit enemy';
                unit.textContent = eData.icon;
                unit.style.left = pos.x + 'px';
                unit.style.top = pos.y + 'px';
                mapWrapper.appendChild(unit);
            }
        });

        // 4. 좌측 리더 목록
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

        // 팁
        const bestEle = Object.keys(weaknessCounts).sort((a,b) => weaknessCounts[b] - weaknessCounts[a])[0];
        document.getElementById('prep-tip').innerHTML = bestEle ? `💡 추천: <b>${ELEMENTS[bestEle].name} ${ELEMENTS[bestEle].icon}</b>` : `💡 상성을 고려하세요.`;

        // --- 5. 하단 패널: 보유 영웅 (비활성화 + HP/MP 바 적용) ---
        const rosterEl = document.getElementById('prep-roster');
        rosterEl.innerHTML = '';
        GameState.heroes.forEach((h, originalIdx) => {
            // [중복 방지 핵심] rosterIdx(인덱스)로 비교하여 정확성 확보
            const isDeployed = party.some(p => p.rosterIdx === originalIdx);
            
            // HP, MP 비율
            const hpPct = (h.curHp / h.hp) * 100;
            const mpPct = (h.curMp / h.mp) * 100;

            const card = document.createElement('div');
            // deployed 클래스가 있으면 CSS(pointer-events: none)에 의해 클릭/드래그 차단됨
            card.className = `roster-card-h ${isDeployed ? 'deployed' : ''}`;
            
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
            
            // 배치 안 된 영웅만 드래그/클릭 이벤트 연결
            if (!isDeployed) {
                card.draggable = true;
                card.ondragstart = (e) => {
                    // 고유값인 rosterIdx를 전달
                    e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'roster', hIdx: originalIdx }));
                };
                card.ondblclick = () => this.autoPlaceHero(h, originalIdx); 
            }
            
            rosterEl.appendChild(card);
        });
    }

    // [드롭 핸들러 수정: 중복 방지 강화]
    handlePrepDrop(e, q, r, targetUnitIdx = -1) {
        try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            const party = this.prepState.party;

            // 1. 로스터에서 드래그 (신규 배치)
            if (data.type === 'roster') {
                const heroIdx = data.hIdx;
                const hero = GameState.heroes[heroIdx];

                // [중복 체크] ID로 비교
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
            // 2. 맵 내 이동 (이동/스왑)
            else if (data.type === 'map') {
                const fromIdx = data.idx;
                const destIdx = party.findIndex(p => p.q === q && p.r === r);
                
                if (destIdx !== -1 && destIdx !== fromIdx) {
                    // Swap
                    const tempQ = party[fromIdx].q;
                    const tempR = party[fromIdx].r;
                    party[fromIdx].q = q;
                    party[fromIdx].r = r;
                    party[destIdx].q = tempQ;
                    party[destIdx].r = tempR;
                } else {
                    // Move
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
        // [중복 체크]
        if (this.prepState.party.some(p => p.rosterIdx === originalIdx)) return;

        const HERO_BASE_COL = 7;
        for(let i=0; i<6; i++) {
            const rowOffsets = [0, 1, -1, 2, -2, 3];
            const row = 6 + rowOffsets[i];
            const col = HERO_BASE_COL + (i % 2);
            const q = col - (row - (row & 1)) / 2;
            const r = row;
            
            if (!this.prepState.party.some(p => p.q === q && p.r === r)) {
                this.prepState.party.push({ hero: hero, q: q, r: r, rosterIdx: originalIdx });
                this.renderPrepUI();
                return;
            }
        }
    }

    autoFormParty() {
        const { chapter, stage } = this.prepState;
        const enemies = STAGE_DATA[chapter][stage].enemies || [];
        const weakMap = {};
        enemies.forEach(e => {
            const eData = CLASS_DATA[e];
            if(eData) weakMap[ELEMENTS[eData.element].weak] = true;
        });

        // 점수 매기기 (원래 인덱스 보존)
        const scoredHeroes = GameState.heroes.map((h, idx) => {
            let score = h.level * 10 + (h.str+h.int+h.def) * 0.5;
            if (weakMap[h.element]) score += 500; 
            return { hero: h, score: score, rosterIdx: idx };
        });
        scoredHeroes.sort((a,b) => b.score - a.score);

        this.prepState.party = [];
        const candidates = scoredHeroes.slice(0, 6);
        const HERO_BASE_COL = 7;
        const rowOffsets = [0, 1, -1, 2, -2, 3];

        candidates.forEach((c, i) => {
            const ROLE_OFFSET = { 'KNIGHT': 1, 'BARBARIAN': 1, 'ARCHER': -1, 'MAGE': -2, 'CLERIC': -2 };
            const offset = ROLE_OFFSET[c.hero.classKey] || 0;
            const row = 6 + rowOffsets[i];
            const col = HERO_BASE_COL + offset;
            const q = col - (row - (row & 1)) / 2;
            const r = row;
            // rosterIdx 포함해서 저장
            this.prepState.party.push({ hero: c.hero, q: q, r: r, rosterIdx: c.rosterIdx });
        });
        
        this.prepState.leaderIdx = 0; 
        this.renderPrepUI();
    }

    confirmBattleStart() {
        const finalParty = this.prepState.party; 
        if (finalParty.length === 0) {
            this.showAlert("최소 1명의 영웅이 필요합니다!");
            return;
        }
        
        // 리더 재정렬: leaderIdx에 해당하는 영웅을 배열 0번으로 보냄
        const leaderIdx = this.prepState.leaderIdx;
        if (leaderIdx > 0 && leaderIdx < finalParty.length) {
            const leader = finalParty.splice(leaderIdx, 1)[0];
            finalParty.unshift(leader);
        }

        this.startBattle(this.prepState.chapter, this.prepState.stage, finalParty);
    }

    startBattle(chapter, stage, customParty = null) {
        this.showScene('scene-battle');
        
        setTimeout(() => {
            const canvas = document.getElementById('gridCanvas');
            
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }

            window.grid = new HexGrid(canvas);
            window.grid.prerenderGrid();

            // customParty 전달 (오류 해결됨)
            window.battle = new BattleSystem(window.grid, this, chapter, stage, customParty);
            
        }, 50);
    }

    // ============================================================
    // 기존 기능 유지
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
        const hero = JSON.parse(JSON.stringify(CLASS_DATA[key]));
        hero.classKey = key; 
        hero.curHp = hero.hp; hero.curMp = hero.mp;
        hero.xp = 0; hero.maxXp = 100; hero.statPoints = 0;
        hero.equipment = { weapon: null, armor: null, acc1: null, acc2: null, potion1: null, potion2: null };
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
        const allKeys = Object.keys(CLASS_DATA).filter(k => !['SLIME','GOBLIN','ORC','SKELETON','DRAKE','LICH','GOLEM','SUCCUBUS'].includes(k));
        const owned = new Set(GameState.heroes.map(h => h.classKey));
        const available = allKeys.filter(k => !owned.has(k));
        
        GameState.recruitPool = [];
        if (available.length > 0) {
            for (let i = available.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [available[i], available[j]] = [available[j], available[i]];
            }
            available.slice(0, 3).forEach(k => {
                const h = JSON.parse(JSON.stringify(CLASS_DATA[k]));
                h.classKey = k; 
                h.hp += Math.floor(Math.random()*20); 
                h.curHp = h.hp; h.curMp = h.mp;
                h.xp = 0; h.maxXp = 100; h.statPoints = 0; 
                h.equipment = { weapon: null, armor: null, acc1: null, acc2: null, potion1: null, potion2: null };
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

    previewStatImpact(statKey) {
        this.clearStatPreview(); 
        const hero = GameState.heroes[this.selectedHeroIdx];
        if(!hero) return;

        const impactMap = {
            'str': hero.atkType === 'PHYS' ? ['c-stat-atk'] : [],
            'int': (hero.atkType === 'MAG' ? ['c-stat-atk'] : []).concat(['c-stat-res']),
            'vit': ['c-stat-ten'],
            'agi': ['c-stat-eva', 'c-stat-ten'],
            'dex': ['c-stat-crit'],
            'def': ['c-stat-def']
        };

        const targets = impactMap[statKey];
        if(targets) {
            targets.forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    const arrowSpan = el.querySelector('.stat-preview-arrow');
                    if(arrowSpan) arrowSpan.textContent = '▲';
                }
            });
        }
    }

    clearStatPreview() {
        document.querySelectorAll('.stat-preview-arrow').forEach(el => {
            el.textContent = ''; 
        });
    }

    renderManageUI() {
        if (GameState.heroes.length === 0) {
            const content = document.getElementById('sub-menu-content');
            content.innerHTML = "<div style='text-align:center; margin-top:50px; color:#666;'>고용된 영웅이 없습니다.</div>";
            return;
        }

        const hero = GameState.heroes[this.selectedHeroIdx];
        const content = document.getElementById('sub-menu-content');

        const heroBios = {
            'KNIGHT': "가문의 보물이라 아끼는 둥근 방패에서 고소한 누룽지 냄새가 납니다.",
            'MAGE': "메테오로 고기를 굽다 식당을 날려 먹은 뒤, 대륙의 모든 주방에서 영구 제명되었습니다.",
            'ARCHER': "전장에서 화살을 회수하려다 적과 눈이 마주칠 때가 가장 괴롭다고 고백했습니다.",
            'CLERIC': "치유는 오직 현금 결제만 가능! 후불 제도에 불만을 갖고 있습니다.",
            'BARBARIAN': "바지는 문명인의 구속구라 주장하지만, 매일 아침 하의 입는 걸 깜빡할 뿐입니다.",
            'ROGUE': "독약병을 깨뜨려 민폐가 일상입니다. 해독제보다 사과문을 더 잘 씁니다.",
            'WARLOCK': "흑마법의 대가. 주말 휴무를 조건으로 악마와 계약했습니다.",
            'PALADIN': "빛의 신을 섬기는 기사. 정수리의 광채가 그 증거입니다."
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
            if(stat === 'atk') { const d = getStatDetail(hero.atkType==='MAG'?'int':'str'); return d.base + d.bonus; }
            if(stat === 'def') { const d = getStatDetail('def'); return d.base + d.bonus; }
            if(stat === 'res') return Math.floor((hero.int || 0) * 0.5);
            if(stat === 'tenacity') return (hero.level || 1) + Math.floor((hero.vit || 0) * 0.5 + (hero.agi || 0) * 0.5);
            if(stat === 'crit') return (Number(hero.dex || 0) * 0.5).toFixed(1) + '%';
            if(stat === 'eva') return (Number(hero.agi || 0) * 0.5).toFixed(1) + '%';
            return '-';
        };

        content.innerHTML = `
            <div class="manage-container">
                <div class="manage-col">
                    <div class="col-header">▼ ROSTER</div>
                    <div class="col-body" id="manage-list"></div>
                </div>

                <div class="manage-col">
                    <div class="col-header">▼ EQUIPMENT</div>
                    <div class="col-body" style="padding:15px; display:flex; flex-direction:column; align-items:center;">
                        <div style="font-size: 70px; margin-bottom:10px;">${hero.icon}</div>
                        <h2 style="color:gold; margin:0; font-family:'Orbitron';">LV.${hero.level} ${hero.name}</h2>
                        
                        <div style="font-size:12px; color:#888; text-align:center; margin-bottom:5px; line-height:1.4; margin:10px 0 10px; padding:10px; background:rgba(0,0,0,0.3); border-radius:4px;">
                            ${heroBios[hero.classKey] || "이 영웅은 비밀이 많습니다."}
                        </div>

                        <div class="equipment-layout" style="margin-top:10px;">
                            <div class="equip-group-title"><span>WEAPON & ARMOR</span></div>
                            ${this.renderSlot(hero, 'weapon', '무기', '🗡️')}
                            ${this.renderSlot(hero, 'armor', '갑옷', '🛡️')}
                            
                            <div class="equip-group-title"><span>ACCESSORIES</span></div>
                            ${this.renderSlot(hero, 'acc1', '장신구 I', '💍')}
                            ${this.renderSlot(hero, 'acc2', '장신구 II', '📿')}
                            
                            <div class="equip-group-title"><span>CONSUMABLES</span></div>
                            ${this.renderSlot(hero, 'potion1', '슬롯 I', '🧪')}
                            ${this.renderSlot(hero, 'potion2', '슬롯 II', '💊')}
                        </div>
                    </div>
                </div>

                <div class="manage-col">
                    <div class="col-header">▼ STATUS & INVENTORY</div>
                    <div class="col-body" style="padding:15px; display:flex; flex-direction:column; gap:15px;">
                        
                        <div class="stat-panel-container">
                            <div class="stat-panel" style="flex:1;">
                                <div class="stat-sub-header">BASIC (PT: ${hero.statPoints})</div>
                                ${['str', 'int', 'vit', 'agi', 'dex', 'def'].map(key => {
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
                                    { id: 'atk', label: '공격력', key: 'atk' },
                                    { id: 'def', label: '방어력', key: 'def' },
                                    { id: 'res', label: '마법저항', key: 'res' },
                                    { id: 'ten', label: '상태저항', key: 'tenacity' },
                                    { id: 'crit', label: '치명타', key: 'crit' },
                                    { id: 'eva', label: '회피율', key: 'eva' }
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

                        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border: 1px solid #333;">
                            <div style="font-size: 11px; color: gold; margin-bottom: 8px; font-family: 'Orbitron'; text-align:center;">INVENTORY</div>
                            <div id="mini-inventory" class="mini-inven-grid"></div>
                        </div>

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

    renderMiniInventory(hero) {
        const invEl = document.getElementById('mini-inventory');
        if (GameState.inventory.length === 0) {
            invEl.innerHTML = "<div style='grid-column:1/-1; text-align:center; color:#555; padding:20px;'>가방이 비었습니다.</div>";
            return;
        }

        let html = '';
        GameState.inventory.forEach((itemId, idx) => {
            const item = ITEM_DATA[itemId];
            const canEquip = hero && ((!item.jobs || item.jobs.length === 0) || item.jobs.includes(hero.classKey));
            const opacity = canEquip ? 1 : 0.4;
            const btnHtml = canEquip 
                ? `<button class="mini-btn" onclick="game.equipItem(${this.selectedHeroIdx}, ${idx})">장착</button>` 
                : `<span style="color:#f55; font-size:9px;">X</span>`;

            html += `
            <div class="mini-item" style="opacity:${opacity}" 
                    onmouseenter="game.showItemTooltip(event, '${itemId}')" onmouseleave="game.hideTooltip()">
                <div style="display:flex; align-items:center; gap:5px;">
                    <span>${item.icon}</span>
                    <span style="color:${item.cost>500?'gold':'#ccc'}">${item.name}</span>
                </div>
                ${btnHtml}
            </div>`;
        });
        invEl.innerHTML = html;
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
window.grid = new HexGrid(canvas);
window.isBattleActive = false;
window.game = new GameApp(); 

function render() {
    if (!window.isBattleActive || !window.battle) { requestAnimationFrame(render); return; }

    const ctx = canvas.getContext('2d');
    const cam = window.battle.camera;
    const battle = window.battle;
    const time = Date.now() * 0.003;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(window.grid.offscreenCanvas, -cam.x, -cam.y);
    
    if (battle.currentUnit && battle.currentUnit.team === 0 && !battle.isProcessingTurn) {
        if (battle.selectedSkill && battle.hoverHex) {
            const skill = battle.selectedSkill;
            const dist = window.grid.getDistance(battle.currentUnit, battle.hoverHex);
            if (dist <= skill.rng) {
                let affectedHexes = [];
                if (skill.main.target === 'LINE') affectedHexes = window.grid.getLine(battle.currentUnit, battle.hoverHex, skill.rng);
                else {
                    const area = skill.main.area || 0;
                    window.grid.hexes.forEach(h => { if (window.grid.getDistance(h, battle.hoverHex) <= area) affectedHexes.push(h); });
                }
                affectedHexes.forEach(h => {
                    const p = window.grid.hexToPixel(h.q, h.r);
                    window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, `rgba(255, 165, 0, 0.5)`, "orange", 2);
                });
            }
        } 
        if (battle.selectedSkill) {
            const range = battle.selectedSkill.rng;
            const center = battle.currentUnit;
            window.grid.hexes.forEach(h => {
                 if (window.grid.getDistance(h, center) <= range) {
                     const p = window.grid.hexToPixel(h.q, h.r);
                     const alpha = 0.2 + Math.sin(time * 2) * 0.1;
                     window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, `rgba(255, 215, 0, ${alpha * 0.5})`, "gold", 1);
                 }
            });
        } else if (!battle.actions.attacked && battle.actions.moved) {
            const range = battle.currentUnit.rng;
            window.grid.hexes.forEach(h => {
                 if (window.grid.getDistance(h, battle.currentUnit) <= range) {
                     const p = window.grid.hexToPixel(h.q, h.r);
                     const alpha = 0.2 + Math.abs(Math.sin(time * 3)) * 0.2;
                     window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, null, `rgba(255, 50, 50, ${alpha + 0.4})`, 2);
                 }
            });
        } else if (!battle.actions.moved && battle.reachableHexes) {
            battle.reachableHexes.forEach(h => {
                const p = window.grid.hexToPixel(h.q, h.r); 
                const alpha = 0.2 + Math.sin(time) * 0.1;
                window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, `rgba(0, 100, 255, ${alpha})`, "rgba(0, 100, 255, 0.5)");
            });
        }
    }
    
    if (battle.hoverHex) {
        const p = window.grid.hexToPixel(battle.hoverHex.q, battle.hoverHex.r);
        window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, "rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.8)");
    }

    battle.units.forEach(u => {
        if (u.curHp > 0) return;
        ctx.filter = 'grayscale(100%) brightness(0.5)'; 
        drawUnit(ctx, u, cam, battle);
        ctx.filter = 'none';
    });
    battle.units.forEach(u => {
        if (u.curHp <= 0) return;
        drawUnit(ctx, u, cam, battle);
    });

    if (battle.projectiles) {
        for (let i = battle.projectiles.length - 1; i >= 0; i--) {
            let p = battle.projectiles[i]; p.t += p.speed;
            const curX = p.x + (p.tx - p.x) * p.t - cam.x; 
            const curY = p.y + (p.ty - p.y) * p.t - cam.y;
            ctx.beginPath(); ctx.arc(curX, curY, 6, 0, Math.PI*2);
            ctx.fillStyle = "#ffffaa"; ctx.fill();
            if (p.t >= 1) battle.projectiles.splice(i, 1);
        }
    }
    requestAnimationFrame(render);
}

function drawUnit(ctx, u, cam, battle) {
    const pos = window.grid.hexToPixel(u.q, u.r); 
    let drawX = pos.x - cam.x;
    let drawY = pos.y - cam.y;

    if (u.shake > 0) {
        drawX += (Math.random() - 0.5) * u.shake; drawY += (Math.random() - 0.5) * u.shake;
        u.shake *= 0.9; if(u.shake < 0.5) u.shake = 0;
    }
    if (u.bumpX || u.bumpY) {
        drawX += u.bumpX; drawY += u.bumpY;
        u.bumpX *= 0.8; u.bumpY *= 0.8;
        if(Math.abs(u.bumpX) < 0.5) u.bumpX = 0; if(Math.abs(u.bumpY) < 0.5) u.bumpY = 0;
    }

    ctx.beginPath(); ctx.arc(drawX, drawY, 25, 0, Math.PI*2);
    ctx.fillStyle = u.team === 0 ? "#335588" : "#883333"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    if (u === battle.currentUnit) { ctx.strokeStyle = "gold"; ctx.lineWidth = 4; ctx.stroke(); }
    
    ctx.fillStyle = "white"; ctx.font = "24px serif"; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(u.icon, drawX, drawY);

    if (u.curHp > 0) {
        const hpPct = u.curHp / u.hp;
        ctx.fillStyle = "#111"; ctx.fillRect(drawX - 20, drawY + 32, 40, 6);
        ctx.fillStyle = u.team === 0 ? "#4f4" : "#f44"; ctx.fillRect(drawX - 20, drawY + 32, 40 * hpPct, 6);
    }
    if (u.buffs && u.buffs.length > 0) {
        ctx.font = "12px sans-serif";
        u.buffs.forEach((b, i) => { ctx.fillText(b.icon, drawX - 20 + (i*15), drawY - 35); });
    }
}
render();
