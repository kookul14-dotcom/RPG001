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
        
        // ⭐ 레이아웃 제어(width 등)만 인라인 유지, 디자인/테마 속성은 클래스로 완전히 이관
        content.innerHTML = `
            <div class="shop-container" style="display:flex; gap:15px; width: calc(100% - 260px); height: 100%; box-sizing: border-box;">
                <div class="shop-section-buy" style="flex: 1.8; min-width: 0; display:flex; flex-direction:column;">
                    <div class="shop-header-row">
                        <div class="shop-header-title">
                            <span>🛒 TODAY'S STOCK</span>
                            <span class="shop-date-hint">(${this.getTodayString()})</span>
                        </div>
                        <div class="shop-refresh-group">
                            <button id="btn-refresh-shop" class="shop-refresh-btn">
                                🔄 상품 갱신 (${currentRefreshCost} G)
                            </button>
                            <div class="daily-reset-hint">Daily Reset</div>
                        </div>
                    </div>
                    <div id="shop-list" class="shop-list-grid"></div>
                </div>

                <div class="shop-section-sell">
                    <div class="shop-header-row sell-header">
                        <div class="shop-header-title ts-txt-success">
                            <span>💰 MY BAG</span>
                        </div>
                        <div class="shop-gold-display">
                            ${this.game.gameState.gold.toLocaleString()} G
                        </div>
                    </div>
                    <div id="shop-inventory-grid" class="sell-grid"></div>
                    <div class="sell-tip-box">
                        <div class="tip-title">💡 Tip</div>
                        아이템을 클릭하면 <span class="ts-txt-danger">판매(50%)</span>합니다.
                    </div>
                </div>
            </div>
        `;
        
        const refreshBtn = document.getElementById('btn-refresh-shop');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshShopStock(villageKey, shopType, currentRefreshCost);
        }

        this.renderShopItems(stock, villageKey, shopType); 
        this.renderSellInventory();
    }

    // ================================================================
    // ⭐ 수동 새로고침 실행 함수
    // ================================================================
    refreshShopStock(villageKey, shopType, cost) {
        if (this.game.gameState.gold < cost) {
            this.game.showAlert(`골드가 부족합니다! (필요: ${cost} G)`);
            return;
        }

        if (confirm(`${cost} G를 소모하여 마을의 상점 물품들을 새롭게 갱신하시겠습니까?\n(다음 갱신 비용은 증가합니다)`)) {
            this.game.gameState.gold -= cost;
            this.game.gameState.dailyShop.refreshCount = (this.game.gameState.dailyShop.refreshCount || 0) + 1;
            
            delete this.game.gameState.dailyShop.villages[villageKey];
            
            this.game.updateResourceDisplay();
            this.game.saveGame();
            this.openShop(shopType);
        }
    }

    generateVillageStock(villageKey) {
        if (!this.game.gameState.dailyShop.villages[villageKey]) {
            this.game.gameState.dailyShop.villages[villageKey] = { weapon: [], armor: [], potion: [] };
        }

        const allItems = Object.entries(ITEM_DATA).filter(([k, v]) => (v.shopWeight || 0) > 0);
        
        const pools = {
            weapon: allItems.filter(([k, v]) => v.type === 'WEAPON'),
            armor: allItems.filter(([k, v]) => ['SHIELD', 'BODY', 'ACC', 'HEAD', 'LEGS', 'NECK', 'RING'].includes(v.type)),
            potion: allItems.filter(([k, v]) => ['CONSUME', 'ITEM', 'MATERIAL'].includes(v.type))
        };

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
            
            // ⭐ [버그 수정] 영문으로 출력되는 상점 타이틀(ARMORY, ALCHEMY)을 정상적으로 인식하도록 조건문 보완
            const currentTitle = document.getElementById('sub-menu-title')?.innerText || document.querySelector('.sub-menu-title')?.innerText || "";
            let type = 'weapon';
            
            if (currentTitle.includes('ARMORY') || currentTitle.includes('방어구')) {
                type = 'armor';
            } else if (currentTitle.includes('ALCHEMY') || currentTitle.includes('연금술')) {
                type = 'potion';
            }
            
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
            list.innerHTML = `<div class="empty-stock-msg">재고가 없습니다.</div>`;
            return;
        }

        stockList.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = `shop-item-card ${item.sold ? 'sold-out' : ''}`;
            
            const priceDisplay = item.price.toLocaleString();
            
            let statInfo = "";
            if (item.val) {
                if (item.type === 'WEAPON') statInfo = `<span class="ts-txt-atk">Atk ${item.val}</span>`;
                else if (['BODY','SHIELD','HEAD'].includes(item.type)) statInfo = `<span class="ts-txt-def">Def ${item.val}</span>`;
            }

            el.innerHTML = `
                <div class="sic-top">
                    <div class="sic-icon">${item.icon || '📦'}</div>
                    <div class="sic-info">
                        <div class="sic-name">${item.name}</div>
                    </div>
                </div>
                <div class="sic-stat">
                    ${statInfo}
                    ${item.sold ? '<span class="ts-txt-sold">SOLD</span>' : ''}
                </div>
                
                <div class="sic-desc" style="font-size:13px; color:#ffffff; margin: 4px 0;">
                    ${item.desc || '설명 없음'}
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
    // 2. 선술집 (Tavern)
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
        container.style.width = 'calc(100% - 260px)';
        container.style.boxSizing = 'border-box';

        const currentRenown = this.game.gameState.renown || 0;
        
        const header = document.createElement('div');
        header.className = 'tavern-header';
        header.innerHTML = `
            <h2>🍻 영웅 모집</h2>
            <div class="tavern-renown">🎖️ 명성: <span>${currentRenown}</span></div>
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
                'WARRIOR': '#8b0000', 'KNIGHT': '#2c3e50', 'MARTIAL ARTIST': '#b8860b', 'ROGUE': '#2d1e17', 'THIEF': '#2d1e17', 
                'ARCHER': '#2e7d32', 'SORCERER': '#4a148c', 'CLERIC': '#c5a059', 'BARD': '#880e4f', 
                'DANCER': '#c2185b', 'ALCHEMIST': '#006064'
            };
            const accentColor = jobColors[entry.key] || '#5d4037'; 

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
                        <div class="cost-tag">
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
                        'WARRIOR': { mainHand: 'W_SW_004', offHand: 'W_SW_004', body: 'A_HV_004' }, 
                        'KNIGHT':   { mainHand: 'W_SW_007', offHand: 'S_SH_004', body: 'A_HV_005' }, 
                        'ARCHER':   { mainHand: 'W_BW_004', body: 'A_LT_004' }, 
                        'ROGUE':    { mainHand: 'W_EX_005', body: 'A_LT_005' }, 
                        'THIEF':    { mainHand: 'W_EX_005', body: 'A_LT_005' }, 
                        'SORCERER': { mainHand: 'W_MG_004', body: 'A_RB_004' }, 
                        'CLERIC':   { mainHand: 'W_BL_004', body: 'A_RB_005' }, 
                        'ALCHEMIST':{ mainHand: 'W_MG_007', body: 'A_RB_004' },                
                        'MARTIAL ARTIST':     { mainHand: 'W_FS_004', body: 'A_LT_004' }, 
                        'BARD':     { mainHand: 'W_MG_006', body: 'A_LT_004' }, 
                        'DANCER':   { mainHand: 'W_EX_005', body: 'A_LT_006' }, 
                        'COMMANDER':{ mainHand: 'W_SW_007', body: 'A_HV_005' }
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
            'WARRIOR', 'KNIGHT', 'MARTIAL ARTIST', 'THIEF', 'ROGUE', 
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
    // 3. 여관 (Inn)
    // ================================================================
    openInn() {
        this.showSubMenu("🛏️ Inn 여관");
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
            healAllBtn = `<button class="inn-heal-all-btn" onclick="window.game.townSystem.treatAllHeroes(${totalCost})">전체 회복 및 부활 (${totalCost} G)</button>`;
        } else {
            healAllBtn = `<div class="inn-heal-all-msg">모든 파티원이 건강합니다!</div>`;
        }

        let html = `
            <div class="inn-container" style="display:flex; flex-direction:column; height:100%; padding:20px; width: calc(100% - 260px); box-sizing: border-box;">
                <div class="inn-header-box">
                    <h2 class="inn-title">🛏️ THE INN</h2>
                    <div class="inn-desc">"다친 동료들을 치료하거나, 쓰러진 자를 일으켜 세우세요."</div>
                    <div class="inn-gold-display">보유 골드: ${this.game.gameState.gold.toLocaleString()} G</div>
                    ${healAllBtn}
                </div>
                <div class="inn-hero-grid">
        `;

        this.game.gameState.heroes.forEach((h, idx) => {
            if (!h) return;
            const isDead = h.curHp <= 0;
            const isInjured = !isDead && (h.curHp < h.hp || h.curMp < h.mp);

            let statusText, actionBtn, cardClass;

            if (isDead) {
                statusText = `<span class="ts-txt-danger">☠️ 사망 (DEAD)</span>`;
                actionBtn = `<button class="inn-btn revive" onclick="window.game.townSystem.treatHero(${idx}, 50)">부활 (50 G)</button>`;
                cardClass = "dead";
            } else if (isInjured) {
                statusText = `<span class="ts-txt-injured">🩹 부상 (INJURED)</span>`;
                actionBtn = `<button class="inn-btn heal" onclick="window.game.townSystem.treatHero(${idx}, 20)">치유 (20 G)</button>`;
                cardClass = "injured";
            } else {
                statusText = `<span class="ts-txt-success">✨ 건강함 (HEALTHY)</span>`;
                actionBtn = `<button class="inn-btn" disabled>완치됨</button>`;
                cardClass = "healthy";
            }

            const hpPct = Math.max(0, (h.curHp / h.hp) * 100);
            const mpPct = Math.max(0, (h.curMp / h.mp) * 100);

            html += `
                <div class="inn-hero-card ${cardClass}">
                    <div class="inn-hero-row">
                        <div class="inn-hero-icon">${h.icon}</div>
                        <div class="inn-hero-info">
                            <div class="inn-hero-name-row">
                                <span>${h.name}</span>
                                <span class="inn-hero-lv">Lv.${h.level}</span>
                            </div>
                            <div class="inn-hero-status-row">${h.classKey} | ${statusText}</div>
                            
                            <div class="inn-bar-label ts-txt-hp"><span>HP</span><span>${Math.floor(h.curHp)} / ${h.hp}</span></div>
                            <div class="bar-container"><div class="hp-fill bar-fill" style="width:${hpPct}%;"></div></div>
                            
                            <div class="inn-bar-label ts-txt-mp"><span>MP</span><span>${Math.floor(h.curMp)} / ${h.mp}</span></div>
                            <div class="bar-container"><div class="mp-fill bar-fill" style="width:${mpPct}%;"></div></div>
                        </div>
                    </div>
                    <div class="inn-btn-wrapper">
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
            content.innerHTML = `<div class="portal-empty-msg">이동할 수 있는 지역이 없습니다.<br>(스테이지를 먼저 클리어하세요)</div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'portal-grid';

        validStages.sort((a, b) => {
            const [c1, s1] = a.split('-').map(Number);
            const [c2, s2] = b.split('-').map(Number);
            return c1 - c2 || s1 - s2;
        });

        validStages.forEach(stageKey => {
            const btn = document.createElement('button');
            btn.className = 'stage-btn ts-portal-btn';
            
            btn.innerHTML = `
                <div class="portal-icon">🗺️</div>
                <div class="portal-text">STAGE ${stageKey}</div>
            `;

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
            overlay.className = 'destiny-overlay';

            const container = document.createElement('div');
            container.className = 'destiny-container';

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = "✖";
            closeBtn.className = 'destiny-close-btn';
            closeBtn.onclick = () => {
                document.body.removeChild(overlay);
                resolve(false); 
            };
            container.appendChild(closeBtn);

            const header = document.createElement('div');
            header.className = 'destiny-header';
            header.innerHTML = `
                <h1 class="destiny-title">운명의 선택 (Destiny Selection)</h1>
                <p class="destiny-desc">모험을 시작하기 위해 <strong>3개의 기술</strong>을 무료로 전수받으십시오.</p>
            `;
            container.appendChild(header);

            const gridWrapper = document.createElement('div');
            gridWrapper.className = 'destiny-grid-wrapper';
            
            const grid = document.createElement('div');
            grid.className = 'destiny-grid';
            
            const selectedIds = new Set();
            const footer = document.createElement('div');
            footer.className = 'destiny-footer';
            
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'destiny-confirm-btn';
            confirmBtn.innerText = "선택 완료 (0/3)";
            confirmBtn.disabled = true;

            tier1Skills.forEach(skill => {
                const card = document.createElement('div');
                card.className = 'destiny-skill-card';

                const weaponReq = (skill.reqWeapon && skill.reqWeapon.length > 0) ? skill.reqWeapon.join(', ') : '제한 없음';

                card.innerHTML = `
                    <div class="destiny-card-icon">${skill.icon || '✨'}</div>
                    <div class="destiny-card-name">${skill.name}</div>
                    <div class="destiny-card-desc">${skill.desc}</div>
                    
                    <div class="destiny-card-req">
                        ⚔️ ${weaponReq}
                    </div>
                    <div class="check-mark">✔</div>
                `;

                card.onclick = () => {
                    if (selectedIds.has(skill.id)) {
                        selectedIds.delete(skill.id);
                        card.classList.remove('selected');
                    } else {
                        if (selectedIds.size >= 3) return alert("최대 3개까지만 선택할 수 있습니다.");
                        selectedIds.add(skill.id);
                        card.classList.add('selected');
                    }
                    
                    confirmBtn.innerText = `선택 완료 (${selectedIds.size}/3)`;
                    if (selectedIds.size === 3) {
                        confirmBtn.disabled = false;
                        confirmBtn.classList.add('active');
                    } else {
                        confirmBtn.disabled = true;
                        confirmBtn.classList.remove('active');
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
        panel.className = 'ts-npc-panel';

        const bubble = document.createElement('div');
        bubble.id = 'npc-bubble';
        bubble.className = 'ts-npc-bubble';
        
        const tailHtml = `
            <div class="npc-bubble-tail-bg"></div>
            <div class="npc-bubble-tail-fg"></div>
        `;

        bubble.innerHTML = `<span id="npc-text">${data.greeting}</span>${tailHtml}`;
        
        const portrait = document.createElement('div');
        portrait.className = 'ts-npc-portrait';
        portrait.title = data.name;

        if (data.portrait) {
            portrait.innerHTML = `<img src="${data.portrait}" class="npc-portrait-img" draggable="false" />`;
        } else {
            portrait.classList.add('fallback');
            portrait.innerHTML = `<div class="npc-portrait-fallback">${data.image}</div>`;
        }

        const talkAction = () => {
            const randomMsg = data.talks[Math.floor(Math.random() * data.talks.length)];
            this.showNPCText(randomMsg);
            portrait.classList.add('active');
            setTimeout(() => portrait.classList.remove('active'), 150);
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
        bubble.classList.add('visible');

        if (this.npcHideTimer) clearTimeout(this.npcHideTimer);
        this.npcHideTimer = setTimeout(() => {
            bubble.classList.remove('visible');
        }, 4000);
    }

    // ================================================================
    // ⭐ 상점/인벤토리 아이템 툴팁 표시 (스마트 파티원 비교 기능 탑재)
    // ================================================================
    showItemTooltip(e, itemId) {
        if (!itemId) return;

        const baseData = ITEM_DATA[itemId] || {};
        const itemInstance = (this.game.itemData && this.game.itemData[itemId]) || {};
        const item = { ...baseData, ...itemInstance };
        
        if (!item.name) return;

        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            const parsedGrade = (item.grade || 'COMMON').split('.').pop().toLowerCase();
            const gradeClass = `grade-${parsedGrade}`; 

            let typeText = item.subType || item.type || "";
            if (item.type === 'WEAPON') {
                const hands = item.hands || 1;
                if (hands === 2 || hands === "2H") typeText += ` <span class="tt-txt-2h">(2H)</span>`;
                else typeText += ` <span class="tt-txt-1h">(1H)</span>`;
            }

            let statHtml = "";
            if (item.type === 'WEAPON') {
                statHtml += `<div class="tt-stat-atk">⚔️ 공격력: ${item.val}</div>`;
            } else if (['BODY', 'HEAD', 'SHIELD', 'LEGS'].includes(item.type)) {
                statHtml += `<div class="tt-stat-def">🛡️ 방어력: ${item.val}</div>`;
            }

            // 소비 아이템 내부 시스템 변수 숨김 처리
            if (item.stat && item.stat !== '-' && !['WEAPON', 'BODY', 'SHIELD', 'CONSUME', 'MATERIAL'].includes(item.type)) {
                statHtml += `<div class="tt-stat-special">✨ ${item.stat.toUpperCase()} +${item.val}</div>`;
            }

            let skillHtml = "";
            if (item.skill && item.skill !== '-' && item.skill !== 'NONE') {
                skillHtml = `<div class="tt-skill-info" style="margin-top: 4px; color: #d8b4e2;">🔮 부가 효과: ${item.skill}</div>`;
            }

            // ====================================================================
            // ⭐ [스마트 툴팁] 파티원 장착 가능 여부 및 스탯 비교 계산기
            // ====================================================================
            const JOB_NAMES_KO = {
                'WARRIOR': '전사', 'KNIGHT': '기사', 'MARTIAL ARTIST': '무투가', 'THIEF': '도적', 'ROGUE': '도적',
                'ARCHER': '궁수', 'SORCERER': '마법사', 'CLERIC': '성직자', 'BARD': '음유시인', 
                'DANCER': '무희', 'ALCHEMIST': '연금술사', 'COMMANDER': '지휘관'
            };

            let comparisonHtml = `
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <div style="font-weight:bold; color:#ffd700; font-size:12px; margin-bottom:8px;">[파티원 장착 비교]</div>
            `;

            let equipableCount = 0;
            const party = this.game.gameState.heroes || [];

            if (['WEAPON', 'SHIELD', 'HEAD', 'BODY', 'LEGS', 'ACC'].includes(item.type)) {
                party.forEach(hero => {
                    if (!hero) return;

                    // HeroManager의 완벽한 장착 판별 로직 호출
                    const canEquip = this.game.heroManager ? this.game.heroManager.canEquipItem(hero, item) : false;

                    if (canEquip) {
                        equipableCount++;
                        
                        // 1. 비교할 슬롯 찾기
                        let slot = null;
                        if (item.type === 'WEAPON') slot = 'mainHand';
                        else if (item.type === 'SHIELD') slot = 'offHand';
                        else if (item.type === 'ACC') slot = 'ring'; // ACC는 기본적으로 반지 슬롯과 비교
                        else slot = item.type.toLowerCase();

                        // 2. 현재 착용 중인 장비 수치 가져오기
                        let currentVal = 0;
                        if (slot && hero.equipment && hero.equipment[slot]) {
                            const eqData = hero.equipment[slot];
                            const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
                            const eqItem = this.game.itemData[eqId] || ITEM_DATA[eqId];
                            if (eqItem) currentVal = eqItem.val || 0;
                        }

                        // 악세사리의 경우, 목걸이가 비어있으면 0으로 취급 (더 높은 이득을 보여줌)
                        if (item.type === 'ACC' && hero.equipment && !hero.equipment.neck) {
                            currentVal = 0;
                        }

                        // 3. 증감 수치 계산
                        const diff = (item.val || 0) - currentVal;
                        let diffText = "";
                        let diffColor = "#aaaaaa";

                        if (diff > 0) { diffText = `+${diff}`; diffColor = "#aed581"; } // 초록색 🔼
                        else if (diff < 0) { diffText = `${diff}`; diffColor = "#ff8a65"; } // 빨간색 🔽
                        else { diffText = "변화 없음"; diffColor = "#aaaaaa"; } // 회색 ➖

                        // 4. 스탯 이름(라벨) 한글화
                        let statLabel = "능력치";
                        if (item.type === 'WEAPON') statLabel = '공격력';
                        else if (['HEAD', 'BODY', 'LEGS', 'SHIELD'].includes(item.type)) statLabel = '방어력';
                        else if (item.type === 'ACC' && item.stat) {
                            const statMap = { 'str':'근력', 'int':'지능', 'vit':'체력', 'agi':'민첩', 'dex':'솜씨', 'luk':'행운', 'hp_max':'최대HP', 'mp_max':'최대MP', 'atk_phys':'물공', 'atk_mag':'마공', 'def':'방어', 'res':'마방', 'eva':'회피', 'hit_phys':'명중', 'spd':'속도', 'mov':'이동력', 'all_stat':'올스탯' };
                            statLabel = statMap[item.stat] || item.stat.toUpperCase();
                        }

                        const jobName = JOB_NAMES_KO[hero.classKey || hero.job] || hero.classKey;

                        comparisonHtml += `
                            <div style="font-size:12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#ebd9b4;">${hero.name} <span style="color:#888; font-size:10px;">(${jobName})</span></span>
                                <span style="color:${diffColor}; font-weight:bold;">${statLabel} ${diffText}</span>
                            </div>
                        `;
                    }
                });
            }

            if (equipableCount === 0) {
                if (['WEAPON', 'SHIELD', 'HEAD', 'BODY', 'LEGS', 'ACC'].includes(item.type)) {
                    comparisonHtml += `<div style="font-size:12px; color:#ff8a65; text-align:center; padding:4px 0;">❌ 장착 가능한 파티원이 없습니다.</div>`;
                } else {
                    comparisonHtml += `<div style="font-size:12px; color:#aed581; text-align:center; padding:4px 0;">소비/재료 아이템입니다.</div>`;
                }
            }

            comparisonHtml += `</div>`;
            // ====================================================================

            tooltip.style.display = 'block';
            tooltip.innerHTML = `
                <div class="tt-container">
                    <div class="tt-header">
                        <span class="${gradeClass}">${item.name}</span>
                        <span class="tt-type-lbl">${typeText}</span>
                    </div>
                    
                    <div class="tt-grade-lbl">${item.grade}</div>
                    
                    ${statHtml ? `<div class="tt-stats-box">${statHtml}</div>` : ''}

                    <div class="tt-desc-box" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #555; color: #e0e0e0; font-size: 12px; line-height: 1.4;">
                        ${item.desc || '설명 없음'}
                    </div>
                    
                    ${skillHtml}
                    ${comparisonHtml}

                    <div class="tt-price-box" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                        💰 가격: ${item.price || item.cost} G
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
            const padding = 15; // 마우스 커서와의 기본 간격
            let left = e.clientX + padding;
            let top = e.clientY + padding;

            // ⭐ 툴팁 안의 내용물 길이에 맞춰진 실제 렌더링 사이즈를 실시간으로 가져옴
            const ttWidth = tooltip.offsetWidth;
            const ttHeight = tooltip.offsetHeight;

            // 1. 우측 화면 밖으로 나갈 경우 -> 마우스 커서의 왼쪽으로 툴팁을 뒤집음
            if (left + ttWidth > window.innerWidth) {
                left = e.clientX - ttWidth - padding;
                // 만약 왼쪽으로 넘겼는데도 화면 왼쪽 밖으로 나간다면 화면 맨 좌측에 고정
                if (left < 0) left = padding; 
            }

            // 2. 하단 화면 밖으로 나갈 경우 -> 마우스 커서의 위쪽으로 툴팁을 껑충 올림
            if (top + ttHeight > window.innerHeight) {
                top = e.clientY - ttHeight - padding;
                // 만약 위로 넘겼는데도 화면 천장을 뚫는다면 화면 맨 위쪽에 고정
                if (top < 0) top = padding;
            }

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
            this.game.gameState.dailyShop = { lastDate: today, villages: {}, refreshCount: 0 };
            this.game.saveGame();
            this.game.showAlert("🌅 새로운 하루가 밝았습니다.\n상점 물품이 갱신되었습니다!");
        }
    }
}