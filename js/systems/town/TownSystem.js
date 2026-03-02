import { ITEM_DATA } from '../../data/items.js';
import { CLASS_DATA } from '../../data/units.js';
import { SKILL_DATABASE } from '../../data/skills.js';
import { TOWN_NPC_DATA } from '../../data/NpcData.js';

export class TownSystem {
    constructor(gameApp) {
        this.game = gameApp;
    }

    // ================================================================
    // 1. 상점 시스템 (분리형)
    // ================================================================
    openShop = (shopType = 'weapon') => {
        this.checkDailyRefresh();

        const chapter = this.game.gameState.chapter || 1;
        const stage = this.game.gameState.stage || 0;
        const villageKey = `${chapter}-${stage}`;

        if (!this.game.gameState.dailyShop.villages[villageKey]) {
            this.generateVillageStock(villageKey);
        }

        const stock = this.game.gameState.dailyShop.villages[villageKey][shopType];
        
        // ⭐ [신규] 현재 새로고침 횟수에 따른 비용 계산 (기본 100G -> 200G -> 300G ...)
        const refreshCount = this.game.gameState.dailyShop.refreshCount || 0;
        const currentRefreshCost = 100 * (refreshCount + 1); 

        let title = "SHOP";
        let icon = "🛒";
        if (shopType === 'weapon') { title = "WEAPON SMITH"; icon = "⚔️"; }
        else if (shopType === 'armor') { title = "ARMORY"; icon = "🛡️"; }
        else if (shopType === 'potion') { title = "ALCHEMY LAB"; icon = "⚗️"; }

        this.showSubMenu(`${icon} ${title}`);
        this.renderNPCPanel(shopType); 

        const content = document.getElementById('sub-menu-content');
        
        content.innerHTML = `
            <div class="shop-container">
                <div class="shop-section-buy">
                    <div class="shop-header-row">
                        <div class="shop-header-title">
                            <span>🛒 TODAY'S STOCK</span>
                            <span style="font-size:11px; color:#666; font-weight:normal;">(${this.getTodayString()})</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button id="btn-refresh-shop" style="background:#2d1717; color:#ffca28; border:1px solid #8d6e63; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#4e342e'" onmouseout="this.style.background='#2d1717'">
                                🔄 상품 갱신 (${currentRefreshCost} G)
                            </button>
                            <div style="font-size:12px; color:#888;">Daily Reset</div>
                        </div>
                    </div>
                    <div id="shop-list" class="shop-list-grid">
                        </div>
                </div>

                <div class="shop-section-sell">
                    <div class="shop-header-row" style="background:rgba(0,0,0,0.3);">
                        <div class="shop-header-title" style="color:#5f5;">
                            <span>💰 MY BAG</span>
                        </div>
                        <div style="color:gold; font-weight:bold;">
                            ${this.game.gameState.gold.toLocaleString()} G
                        </div>
                    </div>
                    <div id="shop-inventory-grid" class="sell-grid">
                        </div>
                    <div style="margin-top:auto; padding:15px; text-align:center; color:#666; font-size:11px; border-top:1px solid #333;">
                        <div style="margin-bottom:5px;">💡 Tip</div>
                        아이템을 클릭하면 <span style="color:#f55;">판매(50%)</span>합니다.
                    </div>
                </div>
            </div>
        `;
        
        // ⭐ [신규] 버튼 이벤트 연결
        const refreshBtn = document.getElementById('btn-refresh-shop');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshShopStock(villageKey, shopType, currentRefreshCost);
        }

        this.renderShopItems(stock, villageKey, shopType); 
        this.renderSellInventory();
    }
    // ================================================================
    // ⭐ [신규] 수동 새로고침 실행 함수
    // ================================================================
    refreshShopStock(villageKey, shopType, cost) {
        if (this.game.gameState.gold < cost) {
            this.game.showAlert(`골드가 부족합니다! (필요: ${cost} G)`);
            return;
        }

        if (confirm(`${cost} G를 소모하여 마을의 상점 물품들을 새롭게 갱신하시겠습니까?\n(다음 갱신 비용은 증가합니다)`)) {
            // 골드 차감 및 카운트 증가
            this.game.gameState.gold -= cost;
            this.game.gameState.dailyShop.refreshCount = (this.game.gameState.dailyShop.refreshCount || 0) + 1;
            
            // 현재 마을의 상점 데이터를 날려버려서 다음 openShop 호출 시 새로 생성(generateVillageStock)하게 만듦
            delete this.game.gameState.dailyShop.villages[villageKey];
            
            this.game.updateResourceDisplay();
            this.game.saveGame();
            
            // 상점 UI 리로드
            this.openShop(shopType);
        }
    }

    generateVillageStock(villageKey) {
        if (!this.game.gameState.dailyShop.villages[villageKey]) {
            this.game.gameState.dailyShop.villages[villageKey] = { weapon: [], armor: [], potion: [] };
        }

        // ⭐ 가중치가 0인 아이템은 상점에서 제외
        const allItems = Object.entries(ITEM_DATA).filter(([k, v]) => (v.shopWeight || 0) > 0);
        
        const pools = {
            weapon: allItems.filter(([k, v]) => v.type === 'WEAPON'),
            armor: allItems.filter(([k, v]) => ['SHIELD', 'BODY', 'ACC', 'HEAD', 'LEGS', 'NECK', 'RING'].includes(v.type)),
            // ⭐ ITEM, CONSUME, MATERIAL 타입 모두 포션 상점에 등장하도록 처리
            potion: allItems.filter(([k, v]) => ['CONSUME', 'ITEM', 'MATERIAL'].includes(v.type))
        };

        // ⭐ 가중치(shopWeight) 기반 랜덤 뽑기 함수
        const getRandomItemByWeight = (pool) => {
            const totalWeight = pool.reduce((sum, [k, v]) => sum + (v.shopWeight || 10), 0);
            let randomNum = Math.random() * totalWeight;
            for (const [key, data] of pool) {
                randomNum -= (data.shopWeight || 10);
                if (randomNum <= 0) return [key, data];
            }
            return pool[pool.length - 1]; 
        };

        ['weapon', 'armor', 'potion'].forEach(type => {
            const pool = pools[type];
            if (!pool || pool.length === 0) return;

            // ⭐ [수정] 등장 아이템 개수를 10개에서 16개로 증가
            for (let i = 0; i < 16; i++) {
                const [key, data] = getRandomItemByWeight(pool);
                let finalPrice = data.price || data.cost || ((data.rank || 1) * 100);

                this.game.gameState.dailyShop.villages[villageKey][type].push({
                    ...data, id: key, uid: Date.now() + `_${villageKey}_${type}_${i}`, 
                    price: finalPrice, sold: false
                });
            }
        });

        console.log(`✅ [${villageKey}] 마을 상점 재고 생성 완료 (16개)`);
    }

    renderSellInventory() {
        const container = document.getElementById('shop-inventory-grid');
        if (!container) return;

        const inventory = this.game.gameState.inventory;
        container.innerHTML = '';

        for (let i = 0; i < 20; i++) {
            const itemId = inventory[i];
            const item = itemId ? (this.game.itemData[itemId] || ITEM_DATA[itemId]) : null;
            
            const slot = document.createElement('div');
            slot.className = `sell-slot ${item ? 'has-item' : ''}`;

            if (item) {
                const sellPrice = Math.floor(item.price * 0.5);
                slot.innerHTML = `
                    ${item.icon}
                    <div class="sell-price-hint">${sellPrice}G</div>
                `;
                
                slot.onmouseenter = (e) => this.showItemTooltip(e, itemId);
                slot.onmouseleave = () => this.hideTooltip();
                slot.onmousemove = (e) => this.moveTooltip(e);
                slot.onclick = () => this.sellItem(itemId, i);
            }

            container.appendChild(slot);
        }
    }

    sellItem(itemId, index) {
        const item = this.game.itemData[itemId] || ITEM_DATA[itemId];
        if (!item) return;

        const sellPrice = Math.floor(item.price * 0.5); 
        
        if (confirm(`[${item.name}]을(를) 정말로 판매하시겠습니까?\n판매 가격: ${sellPrice} G`)) {
            this.game.gameState.gold += sellPrice;
            this.game.gameState.inventory[index] = null;
            this.game.updateResourceDisplay();
            
            const currentTitle = document.querySelector('.sub-menu-title')?.innerText || "";
            let type = 'weapon';
            if (currentTitle.includes('방어구')) type = 'armor';
            else if (currentTitle.includes('연금술')) type = 'potion';
            
            this.openShop(type); 
            this.game.showAlert(`${item.name}을(를) 판매하여 ${sellPrice}G를 얻었습니다.`);
            this.game.saveGame();
        }
    }

    renderShopItems(stockList, villageKey, shopType) {
        const list = document.getElementById('shop-list');
        if (!list) return;
        list.innerHTML = '';

        if (!stockList || stockList.length === 0) {
            list.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 50px; color: #666;">재고가 없습니다.</div>`;
            return;
        }

        stockList.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = `shop-item-card ${item.sold ? 'sold-out' : ''}`;
            
            const typeLabel = item.subType || item.type;
            const priceDisplay = item.price.toLocaleString();
            
            let statInfo = "";
            if (item.val) {
                if (item.type === 'WEAPON') statInfo = `<span style="color:#f88;">Atk ${item.val}</span>`;
                else if (['BODY','SHIELD','HEAD'].includes(item.type)) statInfo = `<span style="color:#8af;">Def ${item.val}</span>`;
            }

            el.innerHTML = `
                <div class="sic-top">
                    <div class="sic-icon">${item.icon || '📦'}</div>
                    <div class="sic-info">
                        <div class="sic-name">${item.name}</div>
                        <div class="sic-type">${item.grade} | ${typeLabel}</div>
                    </div>
                </div>
                <div class="sic-stat">
                    ${statInfo}
                    ${item.sold ? '<span style="color:#f55; font-weight:bold;">SOLD</span>' : ''}
                </div>
                <div class="sic-price">
                    <span class="price-tag">${priceDisplay} G</span>
                    ${!item.sold ? '<button class="sic-btn">BUY</button>' : ''}
                </div>
            `;

            if (!item.sold) {
                const btn = el.querySelector('.sic-btn');
                btn.onclick = (e) => {
                    e.stopPropagation(); 
                    this.buyDailyItem(villageKey, shopType, idx);
                };
            }

            el.onmouseenter = (e) => this.showItemTooltip(e, item.id);
            el.onmouseleave = () => this.hideTooltip();
            list.appendChild(el);
        });
    }

    buyDailyItem(villageKey, shopType, idx) {
        if (!this.game.gameState.dailyShop || 
            !this.game.gameState.dailyShop.villages[villageKey] ||
            !this.game.gameState.dailyShop.villages[villageKey][shopType]) {
            return alert("상점 데이터 오류입니다.");
        }

        const stock = this.game.gameState.dailyShop.villages[villageKey][shopType];
        const item = stock[idx];

        if (!item || item.sold) return alert("이미 판매된 아이템입니다.");

        if (!this.game.gameState.inventory) this.game.gameState.inventory = Array(20).fill(null);
        const inventory = this.game.gameState.inventory;
        
        let emptyIdx = inventory.findIndex(slot => slot === null || slot === undefined);
        if (emptyIdx === -1 && inventory.length < 20) emptyIdx = inventory.length;

        if (emptyIdx === -1 || emptyIdx >= 20) return alert("인벤토리가 가득 찼습니다! (최대 20칸)");
        if (this.game.gameState.gold < item.price) return alert("골드가 부족합니다.");

        this.game.gameState.gold -= item.price;
        this.game.gameState.inventory[emptyIdx] = item.id; 
        item.sold = true; 

        this.game.updateResourceDisplay();
        this.game.saveGame();
        
        this.renderShopItems(stock, villageKey, shopType);
        this.renderSellInventory(); 
    }

    // ================================================================
    // 2. 선술집 (Tavern) - 보존됨
    // ================================================================
    openTavern() {
        this.showSubMenu("🍺 선술집 (Tavern)"); 
        this.renderNPCPanel('tavern');
        const content = document.getElementById('sub-menu-content');
        content.style.background = '';
        content.className = 'sub-menu-content tavern-theme'; 
        content.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'tavern-container';

        const currentRenown = this.game.gameState.renown || 0;
        
        const header = document.createElement('div');
        header.className = 'tavern-header';
        header.innerHTML = `
            <h2>🍻 영웅 모집</h2>
            <div class="gold-status" style="color:#ff9955;">🎖️ 명성: <span>${currentRenown}</span></div>
            <p class="desc">당신의 명성을 듣고 찾아온 영웅들입니다.</p>
        `;
        container.appendChild(header);

        const list = document.createElement('div');
        list.className = 'tavern-grid'; 

        let pool = this.game.gameState.recruitPool;
        const ownedJobs = this.game.gameState.heroes.map(h => h.classKey);
        
        if (!pool || pool.length === 0 || pool.some(h => !h.sold && (!h.key || ownedJobs.includes(h.key)))) {
            this.refreshTavern();
            pool = this.game.gameState.recruitPool;
        }

        pool.forEach((entry) => {
            const hero = entry.data; 
            const isSold = entry.sold === true;
            const cost = hero.costRenown || 100;

            const card = document.createElement('div');
            card.className = `recruit-card ${isSold ? 'sold-out' : ''}`;

            const jobColors = { 
                'WARRIOR': '#c44', 'KNIGHT': '#48c', 'MONK': '#da4', 'ROGUE': '#444', 
                'ARCHER': '#4c4', 'SORCERER': '#a4e', 'CLERIC': '#ee4', 'BARD': '#e8a', 
                'DANCER': '#e48', 'ALCHEMIST': '#4ca'
            };
            const accentColor = jobColors[entry.key] || '#888';

            card.innerHTML = `
                <div class="card-inner" style="border-top: 4px solid ${accentColor}">
                    <div class="card-top">
                        <div class="job-badge" style="background:${accentColor}">${entry.key}</div>
                        <div class="hero-icon">${hero.icon || '👤'}</div>
                    </div>
                    <div class="card-mid">
                        <div class="hero-name">${hero.name}</div>
                        <div class="hero-role">Lv.${hero.level || 1} ${entry.key}</div>
                        <div class="hero-stats">
                            <span>HP ${hero.hp}</span>
                            <span>MP ${hero.mp}</span>
                        </div>
                    </div>
                    <div class="card-btm">
                        <div class="cost-tag" style="background:#d35400;">
                            ${isSold ? 'HIRED' : `🎖️ ${cost}`}
                        </div>
                        <div class="tap-hint">${isSold ? '' : 'CLICK TO RECRUIT'}</div>
                    </div>
                </div>
                <div class="sold-stamp">HIRED</div>
            `;

            if (!isSold) {
                card.onclick = () => {
                    if ((this.game.gameState.renown || 0) < cost) {
                        alert(`명성이 부족합니다!\n(보유: ${this.game.gameState.renown || 0} / 필요: ${cost})`);
                        return;
                    }

                    if (!confirm(`[${hero.name}] 영웅을 영입하시겠습니까?\n(소모: 명성 ${cost})`)) {
                        return;
                    }

                    this.game.gameState.renown -= cost;

                    const newHero = JSON.parse(JSON.stringify(hero));
                    newHero.id = `${entry.key}_${Date.now()}`;
                    newHero.classKey = entry.key; 
                    
                    if (newHero.skillIds) {
                        newHero.skills = newHero.skillIds.map(id => {
                            const s = SKILL_DATABASE[id];
                            if (!s) return null;
                            return JSON.parse(JSON.stringify({ ...s, id: id }));
                        }).filter(s => s !== null);
                    } else {
                        newHero.skills = [];
                    }

                    newHero.xp = 0; 
                    newHero.maxXp = 100;
                    newHero.level = newHero.level || 1;
                    newHero.curHp = newHero.hp; 
                    newHero.curMp = newHero.mp;
                    newHero.statPoints = 0;
                    
                    newHero.equipment = { head: null, neck: null, body: null, legs: null, ring: null, mainHand: null, offHand: null, pocket1: null, pocket2: null, pocket3: null, pocket4: null };
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

                    const loadout = INITIAL_LOADOUT[newHero.classKey];
                    if (loadout) {
                        if (loadout.mainHand) newHero.equipment.mainHand = loadout.mainHand;
                        if (loadout.offHand)  newHero.equipment.offHand  = loadout.offHand;
                        if (loadout.body)     newHero.equipment.body     = loadout.body;
                    }
                    newHero.equippedSkills = []; 

                    this.game.gameState.heroes.push(newHero);
                    entry.sold = true;

                    this.game.updateResourceDisplay();
                    this.game.saveGame();
                    
                    alert(`${newHero.name} 님이 합류했습니다!`);
                    this.openTavern(); 
                };
            }

            list.appendChild(card);
        });

        container.appendChild(list);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-close-floating';
        closeBtn.innerText = '✖';
        closeBtn.onclick = () => this.game.closeSubMenu();
        container.appendChild(closeBtn);
        content.appendChild(container);
    }

    refreshTavern() {
        if (typeof CLASS_DATA === 'undefined') return;

        const HERO_CLASSES = [
            'WARRIOR', 'KNIGHT', 'MONK', 'ROGUE', 
            'ARCHER', 'SORCERER', 'CLERIC', 'BARD', 
            'DANCER', 'ALCHEMIST'
        ];

        const ownedJobs = this.game.gameState.heroes.map(h => h.classKey || h.job);

        const availableKeys = HERO_CLASSES.filter(k => 
            CLASS_DATA[k] && !ownedJobs.includes(k)
        );
        
        this.game.gameState.recruitPool = [];
        
        const pickCount = Math.min(3, availableKeys.length);

        if (pickCount > 0) {
            const shuffled = [...availableKeys].sort(() => 0.5 - Math.random());
            for (let i = 0; i < pickCount; i++) {
                const key = shuffled[i];
                const heroData = JSON.parse(JSON.stringify(CLASS_DATA[key]));
                heroData.cost = 500; 
                this.game.gameState.recruitPool.push({ key, data: heroData, sold: false });
            }
        }
    }

    // ================================================================
    // 3. 여관 (Inn) - 개별 치료 및 부활 시스템
    // ================================================================
    openInn() {
        this.showSubMenu("🛏️ 여관 (Inn)");
        this.renderNPCPanel('inn');
        const content = document.getElementById('sub-menu-content');
        
        this.renderInnUI(content);
    }

    renderInnUI(content) {
        let totalCost = 0;

        this.game.gameState.heroes.forEach(h => {
            if (!h) return;
            if (h.curHp <= 0) totalCost += 50; 
            else if (h.curHp < h.hp || h.curMp < h.mp) totalCost += 20; 
        });

        let healAllBtn = '';
        if (totalCost > 0) {
            healAllBtn = `<button onclick="window.game.townSystem.treatAllHeroes(${totalCost})" style="margin-top:10px; padding:10px 20px; background:linear-gradient(135deg, #2a8a4b, #1a5a2b); border:1px solid #5f5; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer; font-size:14px; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">전체 회복 및 부활 (${totalCost} G)</button>`;
        } else {
            healAllBtn = `<div style="margin-top:10px; padding:10px; color:#5f5; font-weight:bold;">모든 파티원이 건강합니다!</div>`;
        }

        let html = `
            <div class="inn-container" style="display:flex; flex-direction:column; height:100%; padding:20px;">
                <div style="text-align:center; margin-bottom:15px; background:rgba(0,0,0,0.5); padding:20px; border-radius:10px; border:1px solid #444;">
                    <h2 style="color:gold; font-family:'Orbitron'; margin:0 0 10px 0;">🛏️ THE INN</h2>
                    <div style="color:#aaa; font-size:13px; margin-bottom:10px;">"다친 동료들을 치료하거나, 쓰러진 자를 일으켜 세우세요."</div>
                    <div style="font-weight:bold; color:#ffd700; font-size:16px;">보유 골드: ${this.game.gameState.gold.toLocaleString()} G</div>
                    ${healAllBtn}
                </div>
                <div class="inn-hero-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:15px; overflow-y:auto; flex:1; padding-right:5px; scrollbar-width:thin;">
        `;

        this.game.gameState.heroes.forEach((h, idx) => {
            if (!h) return;
            const isDead = h.curHp <= 0;
            const isInjured = !isDead && (h.curHp < h.hp || h.curMp < h.mp);

            let statusText, actionBtn, cardStyle;

            if (isDead) {
                statusText = `<span style="color:#f55; font-weight:bold;">☠️ 사망 (DEAD)</span>`;
                actionBtn = `<button class="inn-btn revive" onclick="window.game.townSystem.treatHero(${idx}, 50)" style="background:#622; color:#f88; border:1px solid #f55; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold; width:100%; transition:0.2s;" onmouseover="this.style.background='#833'" onmouseout="this.style.background='#622'">부활 (50 G)</button>`;
                cardStyle = "filter: grayscale(50%); border-color: #f55; background: #2a1010;";
            } else if (isInjured) {
                statusText = `<span style="color:#fa5; font-weight:bold;">🩹 부상 (INJURED)</span>`;
                actionBtn = `<button class="inn-btn heal" onclick="window.game.townSystem.treatHero(${idx}, 20)" style="background:#262; color:#8f8; border:1px solid #5f5; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold; width:100%; transition:0.2s;" onmouseover="this.style.background='#383'" onmouseout="this.style.background='#262'">치유 (20 G)</button>`;
                cardStyle = "border-color: #fa5; background: #1a2a1a;";
            } else {
                statusText = `<span style="color:#5f5; font-weight:bold;">✨ 건강함 (HEALTHY)</span>`;
                actionBtn = `<button disabled style="background:#333; color:#666; border:1px solid #444; padding:10px; border-radius:4px; width:100%; cursor:not-allowed;">완치됨</button>`;
                cardStyle = "border-color: #444; background: #1a1a20;";
            }

            const hpPct = Math.max(0, (h.curHp / h.hp) * 100);
            const mpPct = Math.max(0, (h.curMp / h.mp) * 100);

            html += `
                <div class="inn-hero-card" style="border:2px solid transparent; ${cardStyle} border-radius:8px; padding:15px; display:flex; flex-direction:column; gap:12px; box-shadow:0 4px 6px rgba(0,0,0,0.5);">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="font-size:40px; width:64px; height:64px; background:#000; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 0 10px rgba(0,0,0,0.8);">${h.icon}</div>
                        <div style="flex:1;">
                            <div style="font-size:16px; font-weight:bold; color:#fff; display:flex; justify-content:space-between;">
                                <span>${h.name}</span>
                                <span style="font-size:11px; color:#aaa;">Lv.${h.level}</span>
                            </div>
                            <div style="font-size:11px; color:#888; margin-bottom:8px;">${h.classKey} | ${statusText}</div>
                            
                            <div style="font-size:10px; color:#f55; display:flex; justify-content:space-between; margin-bottom:2px;"><span>HP</span><span>${Math.floor(h.curHp)} / ${h.hp}</span></div>
                            <div style="width:100%; height:6px; background:#311; margin-bottom:6px; border-radius:3px; overflow:hidden;"><div style="width:${hpPct}%; height:100%; background:#f44; transition:width 0.3s;"></div></div>
                            
                            <div style="font-size:10px; color:#0cf; display:flex; justify-content:space-between; margin-bottom:2px;"><span>MP</span><span>${Math.floor(h.curMp)} / ${h.mp}</span></div>
                            <div style="width:100%; height:6px; background:#123; border-radius:3px; overflow:hidden;"><div style="width:${mpPct}%; height:100%; background:#0cf; transition:width 0.3s;"></div></div>
                        </div>
                    </div>
                    <div style="margin-top:auto;">
                        ${actionBtn}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        content.innerHTML = html;
    }

    treatHero(idx, cost) {
        const h = this.game.gameState.heroes[idx];
        if (!h) return;

        if (this.game.gameState.gold < cost) {
            this.game.showAlert("골드가 부족합니다!");
            return;
        }

        this.game.gameState.gold -= cost;
        h.curHp = h.hp;
        h.curMp = h.mp;
        h.buffs = []; 

        this.game.updateResourceDisplay();
        this.game.saveGame();

        const content = document.getElementById('sub-menu-content');
        if (content) this.renderInnUI(content);
    }

    treatAllHeroes(totalCost) {
        if (this.game.gameState.gold < totalCost) {
            this.game.showAlert("골드가 부족합니다!");
            return;
        }

        this.game.gameState.gold -= totalCost;
        this.game.gameState.heroes.forEach(h => {
            if (h && (h.curHp < h.hp || h.curMp < h.mp || h.curHp <= 0)) {
                h.curHp = h.hp;
                h.curMp = h.mp;
                h.buffs = [];
            }
        });

        this.game.updateResourceDisplay();
        this.game.saveGame();

        const content = document.getElementById('sub-menu-content');
        if (content) this.renderInnUI(content);
    }

    // ================================================================
    // 4. 차원 포탈 (Portal)
    // ================================================================
    openPortal() {
        this.showSubMenu("🌀 차원 포탈 (Portal)");
        const content = document.getElementById('sub-menu-content');
        content.innerHTML = '';

        const cleared = this.game.gameState.clearedStages || [];
        const validStages = cleared.filter(key => /^\d+-\d+$/.test(key));

        if (validStages.length === 0) {
            content.innerHTML = `<div style="text-align:center; padding:50px; color:#888;">이동할 수 있는 지역이 없습니다.<br>(스테이지를 먼저 클리어하세요)</div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 20px;`;

        validStages.sort((a, b) => {
            const [c1, s1] = a.split('-').map(Number);
            const [c2, s2] = b.split('-').map(Number);
            return c1 - c2 || s1 - s2;
        });

        validStages.forEach(stageKey => {
            const btn = document.createElement('button');
            btn.className = 'stage-btn';
            btn.style.cssText = `
                background: linear-gradient(135deg, #2b5876, #4e4376);
                border: 1px solid #66a; border-radius: 8px;
                color: #fff; padding: 15px; cursor: pointer;
                display: flex; flex-direction: column; align-items: center; gap: 5px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: transform 0.1s;
            `;
            
            btn.innerHTML = `
                <div style="font-size: 20px;">🗺️</div>
                <div style="font-weight: bold; font-size: 14px;">STAGE ${stageKey}</div>
            `;

            btn.onmouseover = () => { btn.style.transform = 'translateY(-2px)'; btn.style.background = 'linear-gradient(135deg, #3b6886, #5e5386)'; };
            btn.onmouseout = () => { btn.style.transform = 'none'; btn.style.background = 'linear-gradient(135deg, #2b5876, #4e4376)'; };

            btn.onclick = () => {
                if (confirm(`[STAGE ${stageKey}] 지역으로 이동하시겠습니까?`)) {
                    const [c, s] = stageKey.split('-').map(Number);
                    this.game.closeSubMenu(); 
                    
                    const party = this.game.gameState.heroes.slice(0, 6).map(h => ({ hero: h }));
                    this.game.startBattle(c, s, party);
                }
            };
            grid.appendChild(btn);
        });

        content.appendChild(grid);
    }

    // ================================================================
    // 5. 초기 무료 스킬 선택 
    // ================================================================
    startInitialSkillSelection(isCommanderEvent = false) {
        return new Promise((resolve) => {
            if (!isCommanderEvent && this.game.gameState.flags && this.game.gameState.flags.starterSkillsSelected) {
                resolve();
                return;
            }

            const allSkills = Object.entries(SKILL_DATABASE).map(([key, skill]) => {
                const s = { ...skill };
                if (s.id === undefined || s.id === null) s.id = key;
                return s;
            });

            const tier1Skills = allSkills.filter(s => {
                const numId = Number(s.id);
                const isBasicAttack = (numId % 1000 === 0 && numId <= 11000);
                return s.tier === 1 && s.type === 'ACTIVE' && !String(s.id).startsWith('M') && !isBasicAttack;
            });

            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.92)', zIndex: '9999',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Cinzel', serif"
            });

            const container = document.createElement('div');
            Object.assign(container.style, {
                width: '85%', height: '85%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)', 
                border: '2px solid #c5a059', borderRadius: '15px', 
                boxShadow: '0 0 20px rgba(197, 160, 89, 0.3)',
                position: 'relative'
            });

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = "✖";
            Object.assign(closeBtn.style, {
                position: 'absolute', top: '15px', right: '15px',
                background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', zIndex: '10'
            });
            closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
            closeBtn.onmouseout = () => closeBtn.style.color = '#888';
            closeBtn.onclick = () => {
                document.body.removeChild(overlay);
                resolve(false); 
            };
            container.appendChild(closeBtn);

            const header = document.createElement('div');
            header.style.cssText = "padding:20px; text-align:center; border-bottom:1px solid #445; background:rgba(0,0,0,0.2); flex-shrink:0;";
            header.innerHTML = `
                <h1 style="color:#c5a059; margin:0 0 10px 0; text-shadow:0 0 10px rgba(197,160,89,0.5);">운명의 선택 (Destiny Selection)</h1>
                <p style="color:#aaa; margin:0;">모험을 시작하기 위해 <strong>3개의 기술</strong>을 무료로 전수받으십시오.</p>
            `;
            container.appendChild(header);

            const gridWrapper = document.createElement('div');
            gridWrapper.style.cssText = "flex:1; overflow-y:auto; padding:20px;";
            
            const grid = document.createElement('div');
            grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px;";
            
            const selectedIds = new Set();
            const footer = document.createElement('div');
            footer.style.cssText = "padding:20px; text-align:center; border-top:1px solid #445; background:rgba(0,0,0,0.2); flex-shrink:0;";
            
            const confirmBtn = document.createElement('button');
            confirmBtn.style.cssText = "padding: 12px 40px; font-size: 18px; font-weight: bold; border-radius: 30px; border: none; background: #444; color: #888; cursor: not-allowed; transition: all 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.3);";
            confirmBtn.innerText = "선택 완료 (0/3)";
            confirmBtn.disabled = true;

            tier1Skills.forEach(skill => {
                const card = document.createElement('div');
                card.style.cssText = "background: #252535; border: 1px solid #445; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s; position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; min-height: 180px;";

                const weaponReq = (skill.reqWeapon && skill.reqWeapon.length > 0) ? skill.reqWeapon.join(', ') : '제한 없음';

                card.innerHTML = `
                    <div style="font-size:36px; margin-bottom:10px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">${skill.icon || '✨'}</div>
                    <div style="font-weight:bold; color:#eee; font-size:15px; margin-bottom:5px;">${skill.name}</div>
                    <div style="font-size:12px; color:#889; line-height:1.3; margin-bottom:auto;">${skill.desc}</div>
                    
                    <div style="font-size:11px; color:#aaa; margin-top:10px; width:100%; border-top:1px dashed #445; padding-top:5px;">
                        ⚔️ ${weaponReq}
                    </div>
                    <div class="check-mark" style="position:absolute; top:10px; right:10px; color:#c5a059; font-size:20px; display:none;">✔</div>
                `;

                card.onclick = () => {
                    if (selectedIds.has(skill.id)) {
                        selectedIds.delete(skill.id);
                        card.style.borderColor = '#445';
                        card.style.background = '#252535';
                        card.style.transform = 'scale(1)';
                        card.querySelector('.check-mark').style.display = 'none';
                    } else {
                        if (selectedIds.size >= 3) return alert("최대 3개까지만 선택할 수 있습니다.");
                        selectedIds.add(skill.id);
                        card.style.borderColor = '#c5a059';
                        card.style.background = '#353545';
                        card.style.transform = 'scale(1.05)';
                        card.style.boxShadow = '0 0 15px rgba(197,160,89,0.2)';
                        card.querySelector('.check-mark').style.display = 'block';
                    }
                    
                    confirmBtn.innerText = `선택 완료 (${selectedIds.size}/3)`;
                    if (selectedIds.size === 3) {
                        confirmBtn.disabled = false;
                        confirmBtn.style.background = 'linear-gradient(to right, #c5a059, #e5c079)';
                        confirmBtn.style.color = '#111';
                        confirmBtn.style.cursor = 'pointer';
                        confirmBtn.style.transform = 'scale(1.1)';
                    } else {
                        confirmBtn.disabled = true;
                        confirmBtn.style.background = '#444';
                        confirmBtn.style.color = '#888';
                        confirmBtn.style.cursor = 'not-allowed';
                        confirmBtn.style.transform = 'scale(1)';
                    }
                };
                grid.appendChild(card);
            });

            confirmBtn.onclick = () => {
                const player = this.game.gameState.heroes ? this.game.gameState.heroes[0] : null;
                
                if (player) {
                    if (!player.skills) player.skills = [];

                    const newSkills = Array.from(selectedIds).map(id => {
                        let skill = SKILL_DATABASE[id];
                        if(!skill.id) skill = { ...skill, id: id };
                        return JSON.parse(JSON.stringify(skill));
                    });
                    
                    const existingIds = new Set(player.skills.map(s => String(s.id)));
                    const uniqueNewSkills = newSkills.filter(s => !existingIds.has(String(s.id)));

                    if (uniqueNewSkills.length > 0) {
                        player.skills = [...player.skills, ...uniqueNewSkills];
                        
                        if (!player.equippedSkills) player.equippedSkills = [];
                        uniqueNewSkills.slice(0, 6).forEach(s => {
                            if (player.equippedSkills.length < 6) {
                                player.equippedSkills.push(s.id);
                            }
                        });
                    }

                    if (!this.game.gameState.flags) this.game.gameState.flags = {};
                    
                    if (isCommanderEvent) {
                        this.game.gameState.flags.commanderSkillsSelected = true;
                    } else {
                        this.game.gameState.flags.starterSkillsSelected = true;
                    }
                    
                    this.game.saveGame();
                }
                
                document.body.removeChild(overlay);
                resolve(true);
            };

            gridWrapper.appendChild(grid);
            container.appendChild(gridWrapper);
            footer.appendChild(confirmBtn);
            container.appendChild(footer);
            overlay.appendChild(container);
            document.body.appendChild(overlay);
        });
    }

    // ================================================================
    // 6. 공통 유틸리티
    // ================================================================
    showSubMenu(title) {
        const scene = document.getElementById('scene-sub-menu');
        const battle = document.getElementById('scene-battle');
        
        const titleEl = document.getElementById('sub-menu-title');
        if (titleEl) titleEl.innerText = title;

        document.getElementById('sub-menu-content').innerHTML = ''; 
        
        if(battle) battle.classList.remove('active');
        if(scene) scene.classList.add('active');
        
        this.game.updateResourceDisplay();

        const backBtn = document.getElementById('btn-sub-close');
        if (backBtn) {
            backBtn.style.display = 'block'; 
            backBtn.onclick = () => {
                this.removeNPC(); 
                this.game.closeSubMenu();
            };
        }
    }

    removeNPC() {
        const panel = document.getElementById('town-npc-panel');
        if (panel) panel.remove();

        if (this.npcTalkTimer) {
            clearInterval(this.npcTalkTimer);
            this.npcTalkTimer = null;
        }
        if (this.npcHideTimer) {
            clearTimeout(this.npcHideTimer);
            this.npcHideTimer = null;
        }
    }

    enterTown() {
        if (this.npcTalkTimer) {
            clearInterval(this.npcTalkTimer);
            this.npcTalkTimer = null;
        }
        if (this.npcHideTimer) {
            clearTimeout(this.npcHideTimer);
            this.npcHideTimer = null;
        }

        this.game.closeSubMenu();
    }

    renderNPCPanel(npcType) {
        const chapter = this.game.gameState.chapter || 1;
        const stage = this.game.gameState.stage || 0;
        const mapKey = `${chapter}-${stage}`;

        const stageNpcs = TOWN_NPC_DATA[mapKey] || TOWN_NPC_DATA['1-0'];
        if (!stageNpcs || !stageNpcs[npcType]) return;
        
        const data = stageNpcs[npcType];

        const oldPanel = document.getElementById('town-npc-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'town-npc-panel';
        panel.style.cssText = `position: absolute; display: flex; align-items: flex-end; pointer-events: none; z-index: 1000; right: 20px; top: auto; bottom: 0; flex-direction: column;`;

        const bubble = document.createElement('div');
        bubble.id = 'npc-bubble';
        
        const tailHtml = `
            <div style="position:absolute; bottom:-12px; left:70%; margin-left:-10px; width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-top:12px solid #333;"></div>
            <div style="position:absolute; bottom:-7px; left:70%; margin-left:-9px; width:0; height:0; border-left:9px solid transparent; border-right:9px solid transparent; border-top:9px solid #fff;"></div>
        `;

        bubble.style.cssText = `
            background: #fff; color: #000; padding: 15px 20px; border-radius: 15px; font-weight: bold; font-size: 15px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.6); max-width: 300px; position: relative; opacity: 0; transition: opacity 0.3s, transform 0.3s; border: 3px solid #333; pointer-events: auto; cursor: pointer; transform: translateY(20px); font-family: 'Noto Sans KR', sans-serif; text-align: right;
        `;
        bubble.innerHTML = `<span id="npc-text">${data.greeting}</span>${tailHtml}`;
        
        const portrait = document.createElement('div');
        portrait.style.cssText = `
            font-size: 160px; width: 220px; height: 220px; background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)); border-radius: 20px 20px 0 0; border: 5px solid gold; border-bottom: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5); pointer-events: auto; cursor: pointer; transition: transform 0.2s; overflow: hidden; text-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;
        portrait.innerText = data.image; 
        portrait.title = data.name;

        const talkAction = () => {
            const randomMsg = data.talks[Math.floor(Math.random() * data.talks.length)];
            this.showNPCText(randomMsg);
            portrait.style.transform = 'scale(1.05)';
            setTimeout(() => portrait.style.transform = 'scale(1)', 150);
        };

        portrait.onclick = talkAction;
        bubble.onclick = talkAction;

        panel.appendChild(bubble);
        panel.appendChild(portrait);

        const scene = document.getElementById('scene-sub-menu');
        if (scene) scene.appendChild(panel);

        setTimeout(() => this.showNPCText(data.greeting), 300);

        if (this.npcTalkTimer) clearInterval(this.npcTalkTimer);
        this.npcTalkTimer = setInterval(() => {
            if (Math.random() < 0.4) {
                const randomMsg = data.talks[Math.floor(Math.random() * data.talks.length)];
                this.showNPCText(randomMsg);
            }
        }, 8000);
    }

    showNPCText(text) {
        const bubble = document.getElementById('npc-bubble');
        const textSpan = document.getElementById('npc-text');
        if (!bubble || !textSpan) return;

        textSpan.innerText = text;
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';

        if (this.npcHideTimer) clearTimeout(this.npcHideTimer);
        this.npcHideTimer = setTimeout(() => {
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateY(10px)';
        }, 4000);
    }

    showItemTooltip(e, itemId) {
        if (!itemId) return;

        const baseData = ITEM_DATA[itemId] || {};
        const itemInstance = (this.game.itemData && this.game.itemData[itemId]) || {};
        const item = { ...baseData, ...itemInstance };
        
        if (!item.name) return;

        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            const gradeColors = {
                'COMMON': '#a0a0a0', 'UNCOMMON': '#55ff55',
                'RARE': '#0088ff', 'EPIC': '#a335ee', 'LEGENDARY': '#ff8000'
            };
            const nameColor = gradeColors[item.grade] || '#fff';

            let diffHtml = ""; 
            
            if (this.game.heroManager && 
                this.game.heroManager.selectedHeroIdx !== null && 
                this.game.gameState.heroes) {
                
                const hero = this.game.gameState.heroes[this.game.heroManager.selectedHeroIdx];
                if (hero) {
                    let slot = null;
                    if (item.type === 'WEAPON') slot = 'mainHand';
                    else if (item.type === 'SHIELD') slot = 'offHand';
                    else if (['HEAD', 'BODY', 'LEGS', 'NECK', 'RING'].includes(item.type)) slot = item.type.toLowerCase();
                    
                    let equippedId = null;
                    if (slot && hero.equipment) equippedId = hero.equipment[slot];

                    if (equippedId) {
                        const equippedItem = this.game.itemData[equippedId] || ITEM_DATA[equippedId];
                        if (equippedItem) {
                            const diff = (item.val || 0) - (equippedItem.val || 0);
                            if (diff > 0) diffHtml = ` <span style="color:#55ff55; font-size:11px;">(▲${diff})</span>`;
                            else if (diff < 0) diffHtml = ` <span style="color:#ff5555; font-size:11px;">(▼${Math.abs(diff)})</span>`;
                        }
                    } else if (slot) {
                        diffHtml = ` <span style="color:#55ff55; font-size:11px;">(NEW)</span>`;
                    }
                }
            }

            let typeText = item.subType || item.type || "";
            if (item.type === 'WEAPON') {
                const hands = item.hands || 1;
                if (hands === 2) typeText += " <span style='color:#ff8888; font-weight:bold;'>(2H)</span>";
                else typeText += " <span style='color:#88aaff;'>(1H)</span>";
            }

            let statHtml = "";
            if (item.type === 'WEAPON') {
                statHtml += `<div style="color:#ff8888;">⚔️ 공격력: ${item.val}${diffHtml}</div>`;
            } else if (['BODY', 'HEAD', 'SHIELD', 'LEGS'].includes(item.type)) {
                statHtml += `<div style="color:#88aaff;">🛡️ 방어력: ${item.val}${diffHtml}</div>`;
            }

            if (item.stat && item.type !== 'WEAPON' && item.type !== 'BODY' && item.type !== 'SHIELD') {
                statHtml += `<div style="color:#ffff00;">✨ ${item.stat.toUpperCase()} +${item.val}</div>`;
            }

            let skillHtml = "";
            if (item.skill) {
                skillHtml = `<div style="margin-top:6px; padding-top:4px; border-top:1px dashed #555; color:#00ccff;">🔮 효과: ${item.skill}</div>`;
            }

            let jobHtml = "";
            if (item.jobs && item.jobs.length > 0) {
                jobHtml = `<div style="color:#aaa; font-size:10px; margin-top:2px;">가능 직업: ${item.jobs.join(', ')}</div>`;
            }

            tooltip.style.display = 'block';
            tooltip.innerHTML = `
                <div style="min-width: 180px;">
                    <div style="font-weight:bold; color:${nameColor}; font-size:15px; margin-bottom:4px; display:flex; justify-content:space-between;">
                        <span>${item.name}</span>
                        <span style="font-size:12px; opacity:0.8;">${typeText}</span>
                    </div>
                    
                    <div style="font-size:11px; color:#aaa; margin-bottom:8px;">${item.grade}</div>
                    
                    <div style="font-size:13px; font-weight:bold; margin-bottom:8px;">
                        ${statHtml}
                    </div>

                    <div style="font-size:12px; color:#ddd; line-height:1.4; margin-bottom:6px;">
                        ${item.desc || '설명 없음'}
                    </div>
                    
                    ${skillHtml}
                    ${jobHtml}

                    <div style="font-size:11px; color:#ffd700; text-align:right; margin-top:8px; border-top:1px solid #444; padding-top:4px;">
                        💰 가격: ${item.price} G
                    </div>
                </div>
            `;
            
            this.moveTooltip(e);
        }
    }

    hideTooltip() {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    moveTooltip(e) {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip && tooltip.style.display === 'block') {
            let left = e.clientX + 15;
            let top = e.clientY + 15;

            if (left + 200 > window.innerWidth) left = window.innerWidth - 210;
            if (top + 100 > window.innerHeight) top = window.innerHeight - 110;

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }
    }

    showTooltip(e, htmlContent) {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.innerHTML = htmlContent;
            this.moveTooltip(e);
        }
    }

    getTodayString() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    checkDailyRefresh() {
        if (!this.game.gameState.dailyShop) {
            this.game.gameState.dailyShop = { lastDate: this.getTodayString(), villages: {}, refreshCount: 0 };
            return;
        }

        const savedDate = this.game.gameState.dailyShop.lastDate;
        const today = this.getTodayString();

        if (savedDate !== today) {
            console.log(`📅 날짜 변경 감지 (${savedDate} -> ${today}). 모든 상점 재고를 초기화합니다.`);
            // ⭐ [수정] 날짜가 바뀌면 refreshCount(수동 새로고침 횟수)도 0으로 초기화
            this.game.gameState.dailyShop = { lastDate: today, villages: {}, refreshCount: 0 };
            this.game.saveGame();
            this.game.showAlert("🌅 새로운 하루가 밝았습니다.\n상점 물품이 갱신되었습니다!");
        }
    }
}