import { CLASS_DATA, ITEM_DATA } from './data.js';
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

// 2. 보강된 자동 저장 감시 함수 (Deep Reactive Proxy)
function createReactiveObject(target, callback) {
    const handler = {
        get(obj, prop) {
            const value = Reflect.get(obj, prop);
            // 만약 참조한 값이 객체나 배열이라면, 그 내부도 감시하기 위해 다시 Proxy로 감싸서 반환합니다.
            if (typeof value === 'object' && value !== null) {
                return new Proxy(value, handler);
            }
            return value;
        },
        set(obj, prop, value) {
            // 값이 실제로 바뀔 때만 (또는 배열의 push처럼 length 등이 변할 때) 실행
            const result = Reflect.set(obj, prop, value);
            
            // 모든 수정 사항에 대해 콜백(저장) 실행
            callback(); 
            return result;
        },
        deleteProperty(obj, prop) {
            const result = Reflect.deleteProperty(obj, prop);
            callback(); // 삭제 시에도 저장
            return result;
        }
    };
    return new Proxy(target, handler);
}

// 3. GameState 정의 (이제 모든 변화가 실시간으로 로컬스토리지에 반영됩니다)
const GameState = createReactiveObject(rawGameState, () => {
    localStorage.setItem('hexRpgSave', JSON.stringify(rawGameState));
    // 개발 모드에서 저장이 잘 되는지 확인하려면 아래 주석을 해제하세요.
    // console.log("💾 실시간 자동 저장 완료");
});
class GameApp {
    constructor() {
        this.gameState = GameState; 
        this.loadGame();
        this.init();   
    }
    getStatCost(unit, statKey) {
    const val = unit[statKey] || 0;
    if (val >= 40) return 3; // 스탯 40 이상: 3 PT
    if (val >= 20) return 2; // 스탯 20 이상: 2 PT
    return 1;                // 기본: 1 PT
}
allocateManageStat(statKey) {
    const hero = GameState.heroes[this.selectedHeroIdx];
    
    // 포인트가 없거나 영웅 정보가 없으면 중단
    if (!hero) return;

    // 1. 현재 스탯에 따른 정확한 비용 계산
    const cost = this.getStatCost(hero, statKey);
    
    // 2. 포인트 부족 시 차단
    if (hero.statPoints < cost) {
        alert(`포인트가 부족합니다! (필요: ${cost} PT)`);
        return;
    }

    // 3. 스탯 상승 및 포인트 차감
    hero[statKey]++;
    hero.statPoints -= cost;
    
    if (statKey === 'vit') { hero.hp += 10; hero.curHp += 10; }
    else if (statKey === 'int') { hero.mp += 5; hero.curMp += 5; }
    // 3. UI 즉시 갱신
    this.renderManageUI();
    console.log(`📊 ${hero.name}의 ${statKey} 스탯이 상승했습니다. 남은 포인트: ${hero.statPoints}`);
}
    init() {
        // [수정] 시작 영웅: 기사 + 마법사
        if(GameState.heroes.length === 0) {
            this.addHero('KNIGHT');
            this.addHero('MAGE');
        }
        
        // [수정] 초기 상점/선술집 자동 채우기
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

    // ... (중략: showConfirm, showAlert, saveGame, loadGame, resetGame, addHero, showScene, enterTown 등) ...
    // 전체 코드를 드리기 위해 모든 함수 포함

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
    resetGame() {
        this.showConfirm("정말 초기화하시겠습니까? 모든 데이터가 사라집니다.", () => {
            localStorage.removeItem('hexRpgSave');
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
        if (stockItem.sold) return; 
        const item = ITEM_DATA[stockItem.id];
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
        if (GameState.heroes.length >= 6) { this.showAlert("파티가 꽉 찼습니다."); return; }
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

    // [NEW] 스탯 미리보기 로직
    previewStatImpact(statKey) {
    this.clearStatPreview(); // 기존 화살표 모두 지우기
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
                // 미리 만들어둔 공간(.stat-preview-arrow)을 찾아 삼각형 추가
                const arrowSpan = el.querySelector('.stat-preview-arrow');
                if(arrowSpan) arrowSpan.textContent = '▲';
            }
        });
    }}

    clearStatPreview() {
    // 모든 화살표 공간의 텍스트를 비웁니다.
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

    // 영웅별 바이오 데이터 (데이터 유지)
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

    // 1. 내부 계산용 함수 정의 (Stat 표시 로직)
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

    const hpPct = (hero.curHp / hero.hp) * 100;
    const mpPct = (hero.curMp / hero.mp) * 100;
    const xpPct = (hero.xp / hero.maxXp) * 100;

    // 2. 전체 레이아웃 (그리드 비율 조정: 명단 20%, 캐릭터 40%, 스탯 40%)
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
                    <div class="equipment-layout" style="margin-top:20px;">
                        ${this.renderSlot(hero, 'weapon', '무기', '🗡️')}
                        ${this.renderSlot(hero, 'armor', '갑옷', '🛡️')}
                        ${this.renderSlot(hero, 'acc1', '장신구 I', '💍')}
                        ${this.renderSlot(hero, 'acc2', '장신구 II', '📿')}
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

// 명단 렌더링 함수
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

// 그리드 인벤토리 렌더링 함수
renderGridInventory(hero) {
        const invEl = document.getElementById('mini-inventory');
        let html = '';
        for (let i = 0; i < 20; i++) {
            const itemId = GameState.inventory[i];
            if (itemId) {
                const item = ITEM_DATA[itemId];
                const canEquip = item.jobs.length === 0 || item.jobs.includes(hero.classKey);
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
            const canEquip = hero && (item.jobs.length === 0 || item.jobs.includes(hero.classKey));
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

        if (item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
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
        let jobsStr = item.jobs.length === 0 ? "모든 직업" : item.jobs.join(', ');
        
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
            const x = e.clientX + 15;
            const y = e.clientY + 15;
            tooltip.style.left = Math.min(x, window.innerWidth - 240) + 'px';
            tooltip.style.top = Math.min(y, window.innerHeight - 150) + 'px';
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
        // 영웅 관리창의 리스트 아이템 스타일 적용
        btn.className = `hero-list-item ${isLocked ? 'locked' : ''} ${isCleared ? 'selected' : ''}`;
        btn.style.flexDirection = "column";
        btn.style.justifyContent = "center";
        btn.style.height = "100px";

        btn.innerHTML = `
            <h3 style="font-family: var(--font-game); margin: 0; color: ${isLocked ? '#444' : 'var(--gold)'};">STAGE ${chapter}-${i}</h3>
            <span style="font-size: 11px; color: #888;">${isCleared ? '✓ COMPLETED' : (isLocked ? '🔒 LOCKED' : 'READY TO BATTLE')}</span>
        `;
        if(!isLocked) btn.onclick = () => this.startBattle(chapter, i);
        list.appendChild(btn);
    }
}
    startBattle(chapter, stage) {
        this.showScene('scene-battle');
        window.battle = new BattleSystem(window.grid, this, chapter, stage);
    }
    
    onBattleEnd(victory, isSurrender = false) {
        const modal = document.getElementById('battle-result-modal');
        modal.style.display = 'flex';
        const title = document.getElementById('battle-result-title');
        const desc = document.getElementById('battle-result-desc');
        const modalBtns = document.querySelector('.modal-btns');

        if (victory) {
            title.textContent = "VICTORY!"; 
            title.style.color = "gold";

            // 1. 현재 전투 중인 스테이지 정보를 숫자로 정확히 가져옵니다.
            const currentChapter = Number(window.battle?.chapter) || 1;
            const currentStage = Number(window.battle?.stage) || 1;
            const prog = GameState.progress;

            // 2. [중요] 반복 클리어 여부를 "진행도를 올리기 전"에 먼저 판정합니다.
            const isRepeat = (currentChapter < prog.chapter) || 
                             (currentChapter === prog.chapter && currentStage < prog.stage);

            // 3. 보상 계산
            let baseReward = 100 * currentChapter;
            let reward = isRepeat ? Math.floor(baseReward * 0.1) : baseReward;

            // 4. 골드 지급
            const currentGold = Number(GameState.gold) || 0;
            GameState.gold = currentGold + (Number(reward) || 0);

            // 5. 메시지 출력
            desc.textContent = isRepeat 
                ? `이미 클리어한 스테이지입니다. 보상: ${reward} 골드 (1/10 적용)` 
                : `보상: ${reward} 골드 획득!`;

            // 6. 보상 처리가 끝난 후 "최초 클리어"인 경우에만 진행도를 올립니다.
            if (!isRepeat) {
                if (prog.stage < 10) {
                    prog.stage++;
                } else if (prog.chapter < 3) {
                    prog.chapter++;
                    prog.stage = 1;
                }
                // 진행도 변경 시 Proxy에 의해 자동 저장됩니다.
            }

            // 7. 기타 상태 초기화 및 상점 갱신
            if (window.battle) {
                window.battle.isAutoBattle = false;
            }
            this.refreshShopStock(); 
            this.refreshTavern(false);
            
            modalBtns.innerHTML = `
                <button id="btn-next-stage">다음 스테이지</button>
                <button id="btn-return-town-res">마을로 돌아가기</button>
            `;
            document.getElementById('btn-next-stage').onclick = () => {
                modal.style.display='none';
                this.startBattle(prog.chapter, prog.stage);
            };
            document.getElementById('btn-return-town-res').onclick = () => this.enterTown();

        } else {
            title.textContent = "DEFEAT..."; title.style.color = "#f44";
            if (isSurrender) {
                desc.textContent = "전장에서 도망쳤습니다... (보상 없음)";
            } else {
                const consolation = Math.floor(100 * GameState.progress.chapter * 0.2);
                GameState.gold += consolation;
                desc.textContent = `패배했습니다... (위로금 ${consolation} G)`;
            }
            modalBtns.innerHTML = `<button id="btn-return-town-fail">마을로 돌아가기</button>`;
            document.getElementById('btn-return-town-fail').onclick = () => this.enterTown();
        }
    }

    openInn() {
        this.showScene('scene-sub-menu');
        document.getElementById('sub-menu-title').textContent = "여관";
        const content = document.getElementById('sub-menu-content');
        content.innerHTML = '';
        GameState.heroes.forEach(h => {
            const missing = h.hp - h.curHp;
            const cost = missing * 2;
            const card = document.createElement('div');
            card.className = 'hero-card';
            card.innerHTML = `<div class="card-header"><div class="card-icon">${h.icon}</div><div>${h.name} HP:${Math.floor(h.curHp)}/${h.hp}</div></div>
            <button class="hire-btn" onclick="game.healHero('${h.name}', ${cost})" ${missing<=0?'disabled':''}>${missing<=0?'완전회복':'치료 '+cost+'G'}</button>`;
            content.appendChild(card);
        });
    }
    healHero(name, cost) {
        const h = GameState.heroes.find(x => x.name === name);
        if(h && GameState.gold >= cost) {
            GameState.gold -= cost;
            h.curHp = h.hp;
            this.updateSubMenuGold();
            this.openInn();
            this.saveGame();
        } else { this.showAlert("골드 부족"); }
    }
    openSanctuary() { this.showPlaceholder("성소", "준비중"); }
    showPlaceholder(t, m) { this.showScene('scene-sub-menu'); document.getElementById('sub-menu-title').textContent=t; document.getElementById('sub-menu-content').innerHTML=`<div style="padding:50px; text-align:center;">${m}</div>`; }
}

const canvas = document.getElementById('gridCanvas');
window.grid = new HexGrid(canvas);
window.isBattleActive = false;
window.game = new GameApp(); 

function render() {
    if (!window.isBattleActive) { requestAnimationFrame(render); return; }
    if (!window.battle) { requestAnimationFrame(render); return; }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cam = window.battle.camera;
    const battle = window.battle;
    const time = Date.now() * 0.003;

    ctx.drawImage(window.grid.offscreenCanvas, -cam.x, -cam.y);
    
    // [NEW] 스킬 범위 오버레이 (주황색 육각형)
    if (battle.currentUnit && battle.currentUnit.team === 0 && !battle.isProcessingTurn) {
        // 1. 선택된 스킬 범위
        if (battle.selectedSkill && battle.hoverHex) {
            const skill = battle.selectedSkill;
            const dist = window.grid.getDistance(battle.currentUnit, battle.hoverHex);
            
            // 사거리 내에 있을 때만 범위 표시
            if (dist <= skill.rng) {
                let affectedHexes = [];
                // 직선형(LINE)과 원형(AREA) 구분
                if (skill.main.target === 'LINE') {
                    // 시전자 ~ 마우스 위치까지 직선 경로
                    affectedHexes = window.grid.getLine(battle.currentUnit, battle.hoverHex, skill.rng);
                } else {
                    // 마우스 위치 중심 원형 범위 (기본 0, area가 있으면 그만큼)
                    const area = skill.main.area || 0;
                    window.grid.hexes.forEach(h => {
                        if (window.grid.getDistance(h, battle.hoverHex) <= area) {
                            affectedHexes.push(h);
                        }
                    });
                }

                // 주황색으로 그리기
                affectedHexes.forEach(h => {
                    const p = window.grid.hexToPixel(h.q, h.r);
                    window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, `rgba(255, 165, 0, 0.5)`, "orange", 2);
                });
            }
        } 
        
        // 2. 이동 가능 범위 / 공격 사거리 표시 (기존 로직)
        if (battle.selectedSkill) {
            const range = battle.selectedSkill.rng;
            const center = battle.currentUnit;
            window.grid.hexes.forEach(h => {
                 const dist = window.grid.getDistance(h, center);
                 if (dist <= range) {
                     const p = window.grid.hexToPixel(h.q, h.r);
                     const alpha = 0.2 + Math.sin(time * 2) * 0.1;
                     // 스킬 선택 시 사거리 표시는 노란색
                     window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, `rgba(255, 215, 0, ${alpha * 0.5})`, "gold", 1);
                 }
            });
        } else if (!battle.actions.attacked && battle.actions.moved) {
            const range = battle.currentUnit.rng;
            window.grid.hexes.forEach(h => {
                 const dist = window.grid.getDistance(h, battle.currentUnit);
                 if (dist <= range && dist > 0) {
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
    
    // 호버 (기본 하이라이트)
    if (battle.hoverHex) {
        const p = window.grid.hexToPixel(battle.hoverHex.q, battle.hoverHex.r);
        window.grid.drawHex(ctx, p.x - cam.x, p.y - cam.y, "rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.8)");
    }

    // 유닛 그리기 (사망 시 회색조 처리)
    battle.units.forEach(u => {
        // [NEW] 사망 유닛 그리기 (회색조)
        if (u.curHp <= 0) {
            ctx.filter = 'grayscale(100%) brightness(0.5)';
        }

        const pos = window.grid.hexToPixel(u.q, u.r); 
        let drawX = pos.x - cam.x;
        let drawY = pos.y - cam.y;

        if (u.shake > 0) {
            drawX += (Math.random() - 0.5) * u.shake;
            drawY += (Math.random() - 0.5) * u.shake;
            u.shake *= 0.9;
            if(u.shake < 0.5) u.shake = 0;
        }
        if (u.bumpX || u.bumpY) {
            drawX += u.bumpX; drawY += u.bumpY;
            u.bumpX *= 0.8; u.bumpY *= 0.8;
            if(Math.abs(u.bumpX) < 0.5) u.bumpX = 0;
            if(Math.abs(u.bumpY) < 0.5) u.bumpY = 0;
        }

        if (drawX < -50 || drawX > canvas.width + 50 || drawY < -50 || drawY > canvas.height + 50) {
            ctx.filter = 'none'; 
            return;
        }

        ctx.beginPath(); ctx.arc(drawX, drawY, 25, 0, Math.PI*2);
        ctx.fillStyle = u.team === 0 ? "#335588" : "#883333"; 
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
        if (u === battle.currentUnit) { ctx.strokeStyle = "gold"; ctx.lineWidth = 4; ctx.stroke(); }
        
        ctx.fillStyle = "white"; ctx.font = "24px serif"; 
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(u.icon, drawX, drawY);

        const hpPct = u.curHp / u.hp;
        ctx.fillStyle = "#111"; ctx.fillRect(drawX - 20, drawY + 32, 40, 6);
        ctx.fillStyle = u.team === 0 ? "#4f4" : "#f44"; 
        ctx.fillRect(drawX - 20, drawY + 32, 40 * hpPct, 6);
        
        if (u.buffs && u.buffs.length > 0) {
            ctx.font = "12px sans-serif";
            u.buffs.forEach((b, i) => {
                ctx.fillText(b.icon, drawX - 20 + (i*15), drawY - 35);
            });
        }

        // [중요] 필터 초기화
        ctx.filter = 'none';
    });
    
    if (battle.projectiles) {
        for (let i = battle.projectiles.length - 1; i >= 0; i--) {
            let p = battle.projectiles[i]; 
            p.t += p.speed;
            const curX = p.x + (p.tx - p.x) * p.t - cam.x; 
            const curY = p.y + (p.ty - p.y) * p.t - cam.y;
            ctx.beginPath(); ctx.arc(curX, curY, 6, 0, Math.PI*2);
            ctx.fillStyle = "#ffffaa"; ctx.fill();
            if (p.t >= 1) battle.projectiles.splice(i, 1);
        }
    }
    requestAnimationFrame(render);
}
render();