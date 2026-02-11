import { ITEM_DATA } from '../../data/items.js';
import { CLASS_DATA } from '../../data/units.js';
import { SKILL_DATABASE } from '../../data/skills.js';
import { TIER_REQ } from '../../data/constants.js';
import { TOWN_NPC_DATA } from '../../data/NpcData.js';

export class TownSystem {
    constructor(gameApp) {
        this.game = gameApp;
    }

    // ================================================================
    // 1. 상점 시스템 (분리형)
    // shopType: 'weapon' | 'armor' | 'potion'
    // ================================================================
   
    openShop = (shopType = 'weapon') => {
        // 1. 일일 갱신 체크 (날짜 바뀌었으면 초기화)
        this.checkDailyRefresh();

        // 2. 현재 마을 키 구하기 (예: "1-0", "2-0")
        // BattleSystem이 없으면 기본값 "1-0"
        let villageKey = "1-0";
        if (this.game.battleSystem) {
            villageKey = `${this.game.battleSystem.chapter}-${this.game.battleSystem.stage}`;
        }

        // 3. 해당 마을의 데이터가 없으면 생성 (생성 로직 분리)
        if (!this.game.gameState.dailyShop.villages[villageKey]) {
            this.generateVillageStock(villageKey);
        }

        // 4. 해당 마을의 특정 상점 재고 가져오기
        const stock = this.game.gameState.dailyShop.villages[villageKey][shopType];

        // --- (이하 UI 렌더링은 기존과 동일하지만 데이터를 stock에서 가져옴) ---
        
        let title = "상점";
        if (shopType === 'weapon') title = `⚔️ 무기 상점 [${villageKey}]`;
        else if (shopType === 'armor') title = `🛡️ 방어구점 [${villageKey}]`;
        else if (shopType === 'potion') title = `⚗️ 연금술사의 집 [${villageKey}]`;

        this.showSubMenu(title);
        
        // NPC 패널 (이전 단계에서 만든 기능)
        this.renderNPCPanel(shopType); 

        const content = document.getElementById('sub-menu-content');
        content.innerHTML = `
            <div style="display: flex; gap: 20px; height: 100%; padding: 10px; box-sizing: border-box;">
                <div style="flex: 1.2; display: flex; flex-direction: column; min-width: 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
                        <div style="font-size: 14px; color: gold; font-weight: bold;">🛒 오늘의 상품 (${this.getTodayString()})</div>
                        <div style="font-size: 12px; color: #888;">다음 갱신: 자정</div>
                    </div>
                    <div class="shop-list" id="shop-list" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 15px; overflow-y: auto; padding: 5px;"></div>
                </div>
                
                <div style="flex: 0.8; display: flex; flex-direction: column; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 15px; border: 1px solid #444; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 14px; color: #5f5; font-weight: bold;">💰 내 가방 (판매)</span>
                        <span style="font-size: 13px; color: gold;">${this.game.gameState.gold.toLocaleString()} G</span>
                    </div>
                    <div id="shop-inventory-grid" style="flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 55px; gap: 8px; overflow-y: auto; padding-right: 5px;"></div>
                    <div style="margin-top: 10px; font-size: 11px; color: #888; text-align: center;">* 클릭하여 판매 (원가의 50%)</div>
                </div>
            </div>
        `;
        
        // 5. [중요] 렌더링 함수에 '현재 마을의 재고'를 넘겨줌
        this.renderShopItems(stock, villageKey, shopType); 
        this.renderSellInventory();
    }
    generateVillageStock(villageKey) {
        // 1. 데이터 구조 초기화
        if (!this.game.gameState.dailyShop.villages[villageKey]) {
            this.game.gameState.dailyShop.villages[villageKey] = {
                weapon: [],
                armor: [],
                potion: []
            };
        }

        // 2. 전체 아이템 풀 가져오기
        const allItems = Object.entries(ITEM_DATA);
        
        // 3. 카테고리별 분류
        const pools = {
            weapon: allItems.filter(([k, v]) => v.type === 'WEAPON'),
            armor: allItems.filter(([k, v]) => 
                ['SHIELD', 'BODY', 'ACC', 'HEAD', 'LEGS', 'NECK', 'RING'].includes(v.type)
            ),
            potion: allItems.filter(([k, v]) => v.type === 'CONSUME')
        };

        // 4. 각 카테고리별로 10개씩 랜덤 추출하여 저장
        ['weapon', 'armor', 'potion'].forEach(type => {
            const pool = pools[type];
            if (!pool || pool.length === 0) return;

            for (let i = 0; i < 10; i++) {
                const [key, data] = pool[Math.floor(Math.random() * pool.length)];
                
                // 가격 결정 (데이터에 없으면 랭크 기반)
                let finalPrice = data.price || data.cost || ((data.rank || 1) * 100);

                this.game.gameState.dailyShop.villages[villageKey][type].push({
                    ...data,
                    id: key,
                    uid: Date.now() + `_${villageKey}_${type}_${i}`, // 고유 ID 생성
                    price: finalPrice,
                    sold: false
                });
            }
        });

        console.log(`✅ [${villageKey}] 마을 상점 재고 생성 완료`);
    }

    // [신규] 판매용 인벤토리 렌더링 함수
    renderSellInventory() {
        const container = document.getElementById('shop-inventory-grid');
        if (!container) return;

        const inventory = this.game.gameState.inventory;
        container.innerHTML = '';

        // 20칸 인벤토리 표시
        for (let i = 0; i < 20; i++) {
            const itemId = inventory[i];
            const item = itemId ? (this.game.itemData[itemId] || ITEM_DATA[itemId]) : null;
            
            const slot = document.createElement('div');
            slot.style.cssText = `
                background: ${item ? 'rgba(40, 40, 50, 0.8)' : 'rgba(20, 20, 25, 0.5)'};
                border: 1px solid ${item ? '#556' : '#333'};
                border-radius: 6px; display: flex; align-items: center; justify-content: center;
                cursor: ${item ? 'pointer' : 'default'}; font-size: 24px; transition: 0.2s;
            `;

            if (item) {
                slot.innerHTML = item.icon;
                
                // 기존 툴팁 및 비교 기능 연동
                slot.onmouseenter = (e) => this.showItemTooltip(e, itemId);
                slot.onmouseleave = () => this.hideTooltip();
                slot.onmousemove = (e) => this.moveTooltip(e);
                
                // 클릭 시 판매
                slot.onclick = () => this.sellItem(itemId, i);

                slot.onmouseover = () => { slot.style.borderColor = '#f55'; slot.style.transform = 'scale(1.05)'; };
                slot.onmouseout = () => { slot.style.borderColor = '#556'; slot.style.transform = 'scale(1)'; };
            }

            container.appendChild(slot);
        }
    }

    // [신규] 아이템 판매 로직
    sellItem(itemId, index) {
        const item = this.game.itemData[itemId] || ITEM_DATA[itemId];
        if (!item) return;

        const sellPrice = Math.floor(item.price * 0.5); // 판매가 50%
        
        if (confirm(`[${item.name}]을(를) 정말로 판매하시겠습니까?\n판매 가격: ${sellPrice} G`)) {
            // 1. 골드 지급
            this.game.gameState.gold += sellPrice;
            
            // 2. 인벤토리에서 제거
            this.game.gameState.inventory[index] = null;
            
            // 3. UI 갱신 (현재 열린 상점 타입 유지)
            this.game.updateResourceDisplay();
            
            // 현재 어떤 상점인지 타이틀로 판별하거나 별도 변수 저장 필요
            // 여기서는 간단히 재렌더링만 수행
            const currentTitle = document.querySelector('.sub-menu-title')?.innerText || "";
            let type = 'weapon';
            if (currentTitle.includes('방어구')) type = 'armor';
            else if (currentTitle.includes('연금술')) type = 'potion';
            
            this.openShop(type); // 상점 화면 리프레시
            this.game.showAlert(`${item.name}을(를) 판매하여 ${sellPrice}G를 얻었습니다.`);
            this.game.saveGame();
        }
    }
    // [TownSystem.js 내부 메서드]
    
    renderNPCPanel(npcType) {
        // 1. 현재 스테이지 키 가져오기
        let mapKey = '1-0';
        if (this.game.battleSystem) {
            mapKey = `${this.game.battleSystem.chapter}-${this.game.battleSystem.stage}`;
        }

        // 해당 맵 데이터가 없으면 1-0으로 폴백
        const stageNpcs = TOWN_NPC_DATA[mapKey] || TOWN_NPC_DATA['1-0'];
        const data = stageNpcs[npcType];

        if (!data) return;

        // 기존 패널 제거
        const oldPanel = document.getElementById('town-npc-panel');
        if (oldPanel) oldPanel.remove();

        // 2. 패널 스타일 설정 (기본: 우측 하단)
        const panel = document.createElement('div');
        panel.id = 'town-npc-panel';
        
        // 공통 스타일
        let cssText = `
            position: absolute; 
            display: flex; 
            align-items: flex-end; /* 우측 정렬 느낌 */
            pointer-events: none; 
            z-index: 1000;
            right: 20px; /* 기본 우측 배치 */
        `;

        const isTemple = (npcType === 'temple');

        if (isTemple) {
            // [신전] 우측 상단 배치 (닫기 버튼 피해서 아래로)
            // flex-direction: column-reverse 사용 (얼굴이 위, 말풍선이 아래)
            cssText += `
                top: 80px; 
                bottom: auto;
                flex-direction: column-reverse; 
            `;
        } else {
            // [상점/기타] 우측 하단 배치
            // flex-direction: column 사용 (말풍선이 위, 얼굴이 아래)
            cssText += `
                top: auto;
                bottom: 0;
                flex-direction: column;
            `;
        }
        panel.style.cssText = cssText;

        // 3. 말풍선 생성
        const bubble = document.createElement('div');
        bubble.id = 'npc-bubble';
        
        // 말풍선 꼬리 방향 설정 (신전은 위쪽 꼬리, 나머지는 아래쪽 꼬리)
        let tailHtml = '';
        if (isTemple) {
            // 꼬리가 위를 향함 (얼굴이 위에 있으므로)
            tailHtml = `
                <div style="position:absolute; top:-12px; left:70%; margin-left:-10px; width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-bottom:12px solid #333;"></div>
                <div style="position:absolute; top:-7px; left:70%; margin-left:-9px; width:0; height:0; border-left:9px solid transparent; border-right:9px solid transparent; border-bottom:9px solid #fff;"></div>
            `;
        } else {
            // 꼬리가 아래를 향함 (얼굴이 아래에 있으므로)
            tailHtml = `
                <div style="position:absolute; bottom:-12px; left:70%; margin-left:-10px; width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-top:12px solid #333;"></div>
                <div style="position:absolute; bottom:-7px; left:70%; margin-left:-9px; width:0; height:0; border-left:9px solid transparent; border-right:9px solid transparent; border-top:9px solid #fff;"></div>
            `;
        }

        bubble.style.cssText = `
            background: #fff; color: #000; padding: 15px 20px; border-radius: 15px;
            font-weight: bold; font-size: 15px; 
            margin-bottom: ${isTemple ? '0' : '20px'}; 
            margin-top: ${isTemple ? '20px' : '0'};
            box-shadow: 0 5px 20px rgba(0,0,0,0.6);
            max-width: 300px; position: relative; opacity: 0; transition: opacity 0.3s, transform 0.3s;
            border: 3px solid #333; pointer-events: auto; cursor: pointer;
            transform: translateY(${isTemple ? '-20px' : '20px'}); 
            font-family: 'Noto Sans KR', sans-serif;
            text-align: right; /* 우측 배치라 텍스트도 우측 정렬이 어울림 */
        `;
        
        bubble.innerHTML = `
            <span id="npc-text">${data.greeting}</span>
            ${tailHtml}
        `;
        
        // 4. NPC 포트레이트 생성
        const portrait = document.createElement('div');
        portrait.style.cssText = `
            font-size: 160px; width: 220px; height: 220px; 
            background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)); 
            border-radius: ${isTemple ? '0 0 20px 20px' : '20px 20px 0 0'}; /* 둥근 모서리 방향 반전 */
            border: 5px solid gold; 
            ${isTemple ? 'border-top: none;' : 'border-bottom: none;'}
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
            pointer-events: auto; cursor: pointer; transition: transform 0.2s;
            overflow: hidden; text-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;
        portrait.innerText = data.image; 
        portrait.title = data.name;

        // 클릭 이벤트 및 타이머 로직은 기존과 동일
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

    // [신규] 말풍선 텍스트 표시 및 자동 숨김
    showNPCText(text) {
        const bubble = document.getElementById('npc-bubble');
        const textSpan = document.getElementById('npc-text');
        if (!bubble || !textSpan) return;

        textSpan.innerText = text;
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';

        // 기존 숨김 타이머 제거
        if (this.npcHideTimer) clearTimeout(this.npcHideTimer);

        // 4초 후 숨김
        this.npcHideTimer = setTimeout(() => {
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateY(10px)';
        }, 4000);
    }

    // 하위 호환성
    openBlacksmith() {
        this.openShop('weapon'); 
    }

    // [핵심 수정] items.js의 실제 type(BODY, SHIELD, ACC, CONSUME)에 맞춰 분류
    refreshShopStock() {
        if (!ITEM_DATA) return;

        const allItems = Object.entries(ITEM_DATA);
        
        // 1. 데이터의 실제 Type에 맞춰 필터링
        const pools = {
            // 무기: WEAPON
            weapon: allItems.filter(([k, v]) => v.type === 'WEAPON'),
            
            // 방어구: SHIELD(방패), BODY(갑옷), ACC(장신구)
            armor: allItems.filter(([k, v]) => 
                v.type === 'SHIELD' || v.type === 'BODY' || v.type === 'ACC'
            ),
            
            // 물약: CONSUME(소모품)
            potion: allItems.filter(([k, v]) => v.type === 'CONSUME')
        };

        // 2. 구조 초기화
        this.game.gameState.shopStock = {
            weapon: [],
            armor: [],
            potion: []
        };

        // 3. 각 카테고리별로 10개씩 뽑기
        ['weapon', 'armor', 'potion'].forEach(type => {
            const pool = pools[type];
            if (!pool || pool.length === 0) {
                console.warn(`[Shop] ${type} 타입의 아이템 데이터가 없습니다.`);
                return;
            }

            for(let i = 0; i < 10; i++) {
                // 랜덤 선택
                const [key, data] = pool[Math.floor(Math.random() * pool.length)];
                
                // 가격 계산
                let finalPrice = data.price || data.cost || ((data.rank || 1) * 100);

                // 재고 추가
                this.game.gameState.shopStock[type].push({ 
                    ...data, 
                    id: key,          
                    uid: Date.now() + `_${type}_${i}`, 
                    price: finalPrice, 
                    sold: false
                });
            }
        });

        console.log("✅ 상점 재고 갱신 완료 (각 10개씩 분리됨)");
    }

    renderShopItems(stockList, villageKey, shopType) {
        const list = document.getElementById('shop-list');
        if (!list) return;
        list.innerHTML = '';

        if (!stockList || stockList.length === 0) {
            list.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 20px; color: #888;">
                진열된 상품이 없습니다. (재고 갱신 대기 중)
            </div>`;
            return;
        }

        stockList.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = 'shop-item'; 
            
            // 스타일 적용
            el.style.cssText = `
                background-color: #1f1f1f;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 15px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                min-height: 280px; /* 여기를 280px 이상으로 수정 */
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                position: relative;
                transition: transform 0.2s;
            `;

            // 매진 여부 확인
            if (item.sold) {
                el.style.opacity = '0.5';
                el.innerHTML = `
                    <div style="font-size: 40px; margin-bottom: 10px; filter: grayscale(100%);">${item.icon || '📦'}</div>
                    <div style="font-weight: bold; color: #777; margin-bottom: 5px; text-align: center;">${item.name}</div>
                    <div style="color: #555; font-size: 12px; margin-bottom: 10px;">${item.grade || 'COMMON'}</div>
                    <div style="color: #f55; font-weight: bold; margin-bottom: 15px;">SOLD OUT</div>
                    <button disabled style="width: 100%; padding: 8px; border-radius: 4px; border: none; background: #333; color: #555; cursor: not-allowed;">매진</button>
                `;
            } else {
                el.innerHTML = `
                    <div style="font-size: 40px; margin-bottom: 15px;">${item.icon || '📦'}</div>
                    <div style="font-weight: bold; color: #eee; margin-bottom: 5px; text-align: center; height: 40px; display: flex; align-items: center;">${item.name}</div>
                    
                    <div style="color: #888; font-size: 13px; margin-bottom: 10px;">${item.grade || 'COMMON'} | ${item.subType || item.type}</div>
                    
                    <div style="color: #ffda44; font-weight: bold; margin-bottom: 15px; font-size: 14px;">
                        💰 ${item.price} G
                    </div>
                    
                    <button class="buy-btn" style="
                        width: 100%; padding: 10px; border-radius: 4px; border: none;
                        background: #3a5a40; color: #fff; cursor: pointer; font-weight: bold;
                        transition: background 0.2s;
                    ">구매</button>
                `;
                
                // 버튼 이벤트
                const btn = el.querySelector('.buy-btn');
                btn.onmouseover = () => btn.style.background = '#4a7a50';
                btn.onmouseout = () => btn.style.background = '#3a5a40';
                
                // [중요] 일일 상점 구매 메서드 호출 (villageKey, idx 전달)
                btn.onclick = () => this.buyDailyItem(villageKey, shopType, idx);
            }

            // 툴팁 이벤트
            el.onmouseenter = (e) => this.showItemTooltip(e, item.id);
            el.onmouseleave = () => this.hideTooltip();
            
            list.appendChild(el);
        });
    }
    buyDailyItem(villageKey, shopType, idx) {
        // 1. 데이터 검증 (마을별 재고 확인)
        if (!this.game.gameState.dailyShop || 
            !this.game.gameState.dailyShop.villages[villageKey] ||
            !this.game.gameState.dailyShop.villages[villageKey][shopType]) {
            return alert("상점 데이터 오류입니다.");
        }

        const stock = this.game.gameState.dailyShop.villages[villageKey][shopType];
        const item = stock[idx];

        if (!item || item.sold) {
            return alert("이미 판매된 아이템입니다.");
        }

        // 2. 인벤토리 공간 확인
        if (!this.game.gameState.inventory) {
            this.game.gameState.inventory = Array(20).fill(null);
        }
        const inventory = this.game.gameState.inventory;
        
        // 빈 슬롯 찾기
        let emptyIdx = inventory.findIndex(slot => slot === null || slot === undefined);
        
        // 배열 길이가 20 미만이면 끝에 추가 가능
        if (emptyIdx === -1 && inventory.length < 20) {
            emptyIdx = inventory.length;
        }

        if (emptyIdx === -1 || emptyIdx >= 20) {
            return alert("인벤토리가 가득 찼습니다! (최대 20칸)");
        }

        // 3. 골드 확인
        if (this.game.gameState.gold < item.price) {
            return alert("골드가 부족합니다.");
        }

        // 4. 거래 실행
        this.game.gameState.gold -= item.price;
        this.game.gameState.inventory[emptyIdx] = item.id; // 아이템 ID 저장
        item.sold = true; // 해당 마을 재고 '매진' 처리

        // 5. 저장 및 UI 갱신
        this.game.updateResourceDisplay();
        this.game.saveGame();
        
        // 화면 갱신 (매진 표시 업데이트)
        this.renderShopItems(stock, villageKey, shopType);
        
        // 내 골드가 줄었으므로 판매 탭 UI도 갱신
        this.renderSellInventory(); 

        // (선택) 구매 성공 알림
        // alert(`[${item.name}] 구매 완료!`); 
    }

    // ================================================================
    // 2. 선술집 (Tavern) - 영웅 모집 (스킬 데이터 생성 로직 추가)
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

        // 명성 표시 및 비용 계산
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
                    
                    // [핵심 수정] 스킬 데이터 채우기 (Hydration)
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
    // 3. 여관 (Inn)
    // ================================================================
    openInn() {
        this.showSubMenu("🛏️ 여관 (Inn)");
        this.renderNPCPanel('inn');
        const content = document.getElementById('sub-menu-content');
        
        content.innerHTML = `
            <div class="inn-view" style="text-align:center; padding:20px;">
                <div class="inn-icon-large" style="font-size:3em; margin-bottom:10px;">🔥</div>
                <div class="inn-text" style="color:#ccc; margin-bottom:20px; line-height:1.5;">
                    "따뜻한 불과 푹신한 침대가 준비되어 있습니다.<br>
                    하룻밤 묵어가시면 모든 피로가 풀릴 겁니다."
                </div>
                <button id="btn-rest" class="rest-btn" style="padding:10px 20px; font-size:1.1em; cursor:pointer;">휴식하기 (50 G)</button>
            </div>
        `;

        document.getElementById('btn-rest').onclick = () => {
            if (this.game.gameState.gold >= 50) {
                this.game.gameState.gold -= 50;
                this.game.gameState.heroes.forEach(h => {
                    h.curHp = h.hp;
                    h.curMp = h.mp;
                });
                this.game.updateResourceDisplay();
                alert("체력과 마나가 모두 회복되었습니다!");
            } else {
                alert("골드가 부족합니다.");
            }
        };
    }

    // [TownSystem.js] 내부에 추가

    openPortal() {
        // 1. UI 열기
        this.showSubMenu("🌀 차원 포탈 (Portal)");
        const content = document.getElementById('sub-menu-content');
        content.innerHTML = '';

        // 2. 클리어한 스테이지 목록 가져오기
        const cleared = this.game.gameState.clearedStages || [];
        
        // "1-1" 같은 정규 스테이지만 필터링 (동굴 등 제외)
        // 로직: 하이픈(-)이 있고, 앞뒤가 숫자인 것만 추출
        const validStages = cleared.filter(key => /^\d+-\d+$/.test(key));

        if (validStages.length === 0) {
            content.innerHTML = `<div style="text-align:center; padding:50px; color:#888;">이동할 수 있는 지역이 없습니다.<br>(스테이지를 먼저 클리어하세요)</div>`;
            return;
        }

        // 3. 스테이지 목록 그리드 생성
        const grid = document.createElement('div');
        grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 20px;`;

        // 정렬 (1-1, 1-2, 1-3... 순서대로)
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
                    this.game.closeSubMenu(); // 메뉴 닫기
                    
                    // 전투 시작 (이동)
                    // 파티 정보가 없으면 현재 영웅들로 구성
                    const party = this.game.gameState.heroes.slice(0, 6).map(h => ({ hero: h }));
                    this.game.startBattle(c, s, party);
                }
            };
            grid.appendChild(btn);
        });

        content.appendChild(grid);
    }

    // =========================================================================
    // 🏛️ 4. 신전 (Temple) - 스킬 습득 (티어/무기 필터링 강화판)
    // =========================================================================
    async openTemple() {
        const player = this.game.gameState.heroes ? this.game.gameState.heroes[0] : null;
        if (!player) return console.error("❌ 플레이어 데이터 없음");
        
        // =========================================================
        // [수정됨] 1. 티어 해금 로직 (TIER_REQ 기준)
        // =========================================================
        // 챕터 기준 계산식을 삭제하고, 사령관 레벨과 TIER_REQ를 비교합니다.
        const playerLv = player.level || 1;
        let unlockedTier = 1;

        // TIER_REQ가 import 되어 있어야 합니다. (예: { 1: 1, 2: 4, 3: 7, 4: 10, 5: 15 })
        for (let tier = 1; tier <= 5; tier++) {
            if (TIER_REQ[tier] && playerLv >= TIER_REQ[tier]) {
                unlockedTier = tier;
            }
        }
        
        // 실시간으로 계산된 티어를 gameState에도 동기화 (저장)
        this.game.gameState.templeTier = unlockedTier;
        
        // 2. 필터 상태 초기화 ('job' 제거됨)
        if (!this.templeFilters) {
            this.templeFilters = { tier: 'all', weapon: 'all' };
        }

        const skillPrices = { 1: 1, 2: 3, 3: 5, 4: 8, 5: 15 };

        this.showSubMenu("🏛️ 지식의 신전 (Temple)");
        this.renderNPCPanel('temple');
        const content = document.getElementById('sub-menu-content');
        
        content.style.background = "linear-gradient(135deg, #1a0b2e, #16213e, #000)";
        content.innerHTML = '';

        // --- 1. 상단 헤더 영역 ---
        const header = document.createElement('div');
        header.style.cssText = `
            width: 100%; padding: 20px; text-align: center; 
            border-bottom: 1px solid rgba(255, 215, 0, 0.3); 
            background: rgba(0, 0, 0, 0.5);
            box-shadow: 0 4px 20px rgba(0,0,0,0.7);
            flex-shrink: 0; z-index: 10;
        `;
        header.innerHTML = `
            <div style="font-family: serif; color: #ccf; font-size: 16px; margin-bottom: 15px; font-style: italic; text-shadow: 0 0 8px #a0f;">"고대의 지혜가 담긴 비석들이 영웅을 기다립니다."</div>
            <div style="display:flex; justify-content:center; gap:20px; align-items:center; margin-bottom: 15px;">
                <div style="background: rgba(50, 50, 60, 0.8); padding: 8px 20px; border-radius: 30px; border: 1px solid #666; display:flex; align-items:center; gap:10px;">
                    <span style="color:#aaa; font-size:12px;">개방 등급</span><strong style="color:#fff; font-size:16px;">Tier ${unlockedTier}</strong>
                </div>
                <div style="background: rgba(30, 60, 100, 0.8); padding: 8px 20px; border-radius: 30px; border: 1px solid #48a; display:flex; align-items:center; gap:10px;">
                    <span style="color:#4ef; font-size:12px;">고대 주화</span><strong style="color:#fff; font-size:18px;">🧿 ${this.game.gameState.ancientCoin || 0}</strong>
                </div>
            </div>
            
            <button id="btn-reset-skills" style="background:#422; border:1px solid #f55; color:#fcc; padding:8px 15px; border-radius:6px; cursor:pointer; margin-bottom:15px; font-size:12px;">
                🔄 기술 초기화 (100% 환급)
            </button>
            <div style="display:flex; justify-content:center; gap:10px;">
                <select id="temple-filter-tier" onchange="window.game.townSystem.updateTempleFilter('tier', this.value)" style="background:#222; color:#eee; border:1px solid #555; padding:5px; border-radius:4px;">
                    <option value="all">Tier: ALL</option>
                    ${Array.from({length: unlockedTier}, (_, i) => `<option value="${i+1}">Tier ${i+1}</option>`).join('')}
                </select>
                <select id="temple-filter-weapon" onchange="window.game.townSystem.updateTempleFilter('weapon', this.value)" style="background:#222; color:#eee; border:1px solid #555; padding:5px; border-radius:4px;">
    <option value="all">Weapon: ALL</option>
    <option value="NONE">무기 제한 없음</option> 
    <option value="SWORD">Sword (검)</option>
    <option value="AXE">Axe (도끼)</option>
    <option value="DAGGER">Dagger (단검)</option>
    <option value="BOW">Bow (활)</option>
    <option value="STAFF">Staff (지팡이)</option>
    <option value="MACE">Mace (둔기)</option>
    <option value="SPEAR">Spear (창)</option>
    <option value="FIST">Fist (너클/건틀릿)</option>
    <option value="INSTRUMENT">Instrument (악기)</option>
    <option value="FAN">Fan (부채)</option>
    <option value="SHIELD">Shield (방패)</option>
    <option value="GUN">Gun (총)</option>
</select>
            </div>
        `;
        content.appendChild(header);

        // ▼▼▼ [추가된 부분] 버튼 이벤트 연결 ▼▼▼
        document.getElementById('btn-reset-skills').onclick = () => this.resetTempleSkills();
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        // 필터 값 UI 복구
        setTimeout(() => {
            const ft = document.getElementById('temple-filter-tier');
            const fw = document.getElementById('temple-filter-weapon');
            if(ft) ft.value = this.templeFilters.tier;
            if(fw) fw.value = this.templeFilters.weapon;
        }, 0);

        // --- 2. 스킬 리스트 컨테이너 ---
        const listContainer = document.createElement('div');
        listContainer.style.cssText = `
            flex: 1; width: 100%; 
            overflow-y: auto; 
            padding: 30px; box-sizing: border-box;
            display: flex; justify-content: center;
            height: calc(100% - 140px);
        `;

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); 
            gap: 20px; 
            width: 100%; max-width: 1200px;
            padding-bottom: 20px;
        `;

        // [데이터 처리]
        const allSkills = Object.entries(SKILL_DATABASE).map(([key, skill]) => {
            const s = { ...skill };
            if (s.id === undefined || s.id === null) s.id = key;
            return s;
        });

        const availableSkills = allSkills.filter(s => {
            const sid = String(s.id);
            const numId = Number(sid);
            const isBasicAttack = (numId % 1000 === 0 && numId <= 11000);
            
            // 1. 기본 조건 (액티브 스킬, 몬스터 스킬 제외)
            if (s.type !== 'ACTIVE' || sid.startsWith('M') || isBasicAttack) return false;

            // 2. [수정] 티어 검사: 알파벳이 포함된 티어(a, b, c 등) 제외하고 순수 숫자만 허용
            // 정규식: 숫자로만 구성되어야 함 (/^\d+$/)
            if (!/^\d+$/.test(String(s.tier))) return false; 

            // 3. 해금 티어 체크
            if ((s.tier || 1) > unlockedTier) return false;

            // [필터링 적용]
            // A. 티어 필터
            if (this.templeFilters.tier !== 'all' && s.tier != this.templeFilters.tier) return false;
            
            // B. 무기 필터 (수정됨)
            if (this.templeFilters.weapon !== 'all') {
                if (this.templeFilters.weapon === 'NONE') {
                    // "무기 제한 없음" 선택 시: reqWeapon이 없거나 비어있는 스킬만 표시
                    if (s.reqWeapon && s.reqWeapon.length > 0) return false;
                } else {
                    // 특정 무기 선택 시: 해당 무기가 reqWeapon에 포함되어야 함
                    if (!s.reqWeapon || !s.reqWeapon.includes(this.templeFilters.weapon)) return false;
                }
            }

            return true;
        }).sort((a,b) => (a.tier || 1) - (b.tier || 1) || String(a.id).localeCompare(String(b.id)));

        if (availableSkills.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#667; padding:50px; font-size:18px;">
                조건에 맞는 기술이 없습니다.
            </div>`;
        }

        // --- 3. 카드 렌더링 ---
        availableSkills.forEach(skill => {
            const hasSkill = player.skills && player.skills.some(s => String(s.id) === String(skill.id));
            const price = skillPrices[skill.tier] || 99;
            const currentCoin = this.game.gameState.ancientCoin || 0;
            const canAfford = currentCoin >= price;
            
            const card = document.createElement('div');
            
            card.style.cssText = `
                background: linear-gradient(160deg, #2b2b35 0%, #1a1a20 100%);
                border: 1px solid ${hasSkill ? '#4a8' : '#445'};
                border-top: 3px solid ${hasSkill ? '#4f8' : '#777'};
                border-radius: 10px; padding: 15px;
                display: flex; flex-direction: column; justify-content: space-between;
                position: relative; box-shadow: 0 8px 15px rgba(0,0,0,0.4);
                transition: transform 0.2s, box-shadow 0.2s;
                opacity: ${hasSkill ? 0.6 : 1}; 
                min-height: 240px; 
            `;

            if (!hasSkill) {
                card.onmouseover = () => { 
                    card.style.transform = 'translateY(-5px)'; 
                    card.style.boxShadow = '0 12px 25px rgba(0,0,0,0.6)';
                    card.style.borderColor = '#ffd700'; card.style.borderTopColor = '#ffd700';
                    this.showSkillTooltip(null, skill.id);
                };
                card.onmouseout = () => { 
                    card.style.transform = 'none'; 
                    card.style.boxShadow = '0 8px 15px rgba(0,0,0,0.4)';
                    card.style.borderColor = '#445'; card.style.borderTopColor = '#777';
                    this.hideTooltip();
                };
                card.onmousemove = (e) => this.moveTooltip(e);
            }

            const tierColor = skill.tier >= 3 ? '#ffd700' : (skill.tier === 2 ? '#bbf' : '#cd7f32');
            
            let actionHtml;
            if (hasSkill) {
                actionHtml = `
                    <div style="margin-top:auto; padding:10px; text-align:center; color:#4f8; font-weight:bold; background:rgba(0,100,50,0.2); border-radius:6px; border:1px solid #4f8; cursor: default; pointer-events: none;">✔ 습득 완료</div>
                `;
            } else {
                const btnBg = canAfford ? 'linear-gradient(to right, #36d1dc, #5b86e5)' : '#333';
                const btnColor = canAfford ? '#fff' : '#666';
                const cursor = canAfford ? 'pointer' : 'not-allowed';
                actionHtml = `
                    <button class="temple-buy-btn" style="margin-top:auto; width:100%; padding:10px; border:none; border-radius:6px; background: ${btnBg}; color: ${btnColor}; font-weight:bold; cursor: ${cursor}; font-family: inherit; font-size:14px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: filter 0.2s;">🧿 ${price} 구매</button>
                `;
            }

            card.innerHTML = `
                <div style="margin-bottom:15px; pointer-events: none;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                        <div style="font-size:36px; width:54px; height:54px; background:#111; border-radius:8px; border:1px solid #333; display:flex; align-items:center; justify-content:center; box-shadow: inset 0 0 10px #000;">${skill.icon || '📜'}</div>
                        <span style="font-size:11px; color:${tierColor}; border:1px solid ${tierColor}; padding:2px 8px; border-radius:12px; font-weight:bold; letter-spacing:1px;">TIER ${skill.tier}</span>
                    </div>
                    <div style="font-size:16px; font-weight:bold; color:#eee; margin-bottom:6px;">${skill.name}</div>
                    <div style="font-size:12px; color:#99a; line-height:1.4; height:36px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${skill.desc || '상세 설명이 없습니다.'}</div>
                </div>
                <div style="font-size:11px; color:#5de; margin-bottom:15px; display:flex; gap:12px; border-top:1px solid #333; padding-top:10px;">
                    <span>💧 MP: ${skill.mp}</span>
                    <span>⚡ Cost: ${skill.cost}</span>
                </div>
                ${actionHtml}
            `;

            const btn = card.querySelector('.temple-buy-btn');
            if (btn && !hasSkill) {
                if (canAfford) {
                    btn.onmouseover = () => btn.style.filter = 'brightness(1.2)';
                    btn.onmouseout = () => btn.style.filter = 'none';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        if (confirm(`[${skill.name}] 기술을 전수받으시겠습니까?\n(소모: 고대 주화 ${price}개)`)) {
                            this.game.gameState.ancientCoin -= price;
                            if (!player.skills) player.skills = [];
                            
                            const newSkill = JSON.parse(JSON.stringify(skill));
                            newSkill.isPurchased = true; // [중요] 초기화 시 구분을 위한 플래그 추가
                            
                            player.skills.push(newSkill);
                            this.game.updateResourceDisplay();
                            this.openTemple();
                        }
                    };
                } else {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        alert(`고대 주화가 부족합니다.\n(보유: ${currentCoin} / 필요: ${price})`);
                    };
                }
            }
            grid.appendChild(card);
        });

        listContainer.appendChild(grid);
        content.appendChild(listContainer);
    }

    // 필터 업데이트 헬퍼 함수
    updateTempleFilter(type, value) {
        if (!this.templeFilters) this.templeFilters = {};
        this.templeFilters[type] = value;
        this.openTemple();
    }
    // [신규] 스킬 초기화 로직 (100% 환급)
    resetTempleSkills() {
        const hero = this.game.gameState.heroes[0]; // 주인공 대상
        if (!hero) return;

        // 1. 기본 직업 스킬 가져오기 (초기화 제외 대상)
        const baseSkillIds = CLASS_DATA[hero.classKey]?.skillIds || [];
        
        // 2. 환급 대상 스킬 찾기 (기본 스킬이 아니거나, 구매된 스킬)
        const purchasedSkills = hero.skills.filter(s => s.isPurchased || !baseSkillIds.includes(s.id));
        
        if (purchasedSkills.length === 0) {
            alert("초기화할 스킬이 없습니다.");
            return;
        }

        // 3. 환급액 계산
        const skillPrices = { 1: 1, 2: 3, 3: 5, 4: 8, 5: 15 };
        let refundAmount = 0;
        
        purchasedSkills.forEach(s => {
            const tier = s.tier || 1;
            refundAmount += (skillPrices[tier] || 1);
        });

        if (!confirm(`배운 스킬 ${purchasedSkills.length}개를 모두 잊고\n주화 ${refundAmount}개를 돌려받으시겠습니까?\n(100% 환급)`)) {
            return;
        }

        // 4. 스킬 삭제 (기본 스킬만 남김)
        hero.skills = hero.skills.filter(s => baseSkillIds.includes(s.id));
        
        // 5. 장착 슬롯에서도 해제
        if (hero.equippedSkills) {
            hero.equippedSkills = hero.equippedSkills.filter(sid => baseSkillIds.includes(sid));
        }

        // 6. 주화 환급
        this.game.gameState.ancientCoin = (this.game.gameState.ancientCoin || 0) + refundAmount;

        // 7. 저장 및 갱신
        this.game.saveGame();
        this.game.updateResourceDisplay();
        this.openTemple(); // 화면 갱신
        alert(`초기화 완료! 주화 +${refundAmount} 획득`);
    }

    // 스킬 툴팁 표시 함수
    showSkillTooltip(e, skillId) {
        if (!skillId) return;
        const skill = SKILL_DATABASE[skillId]; 
        if (!skill) return;

        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            const cost = skill.cost || 0;
            const mp = skill.mp || 0;

            let reqInfoHtml = "";
            if (skill.reqWeapon && skill.reqWeapon.length > 0) {
                reqInfoHtml = `<div style="color:#aaa; font-size:10px; margin-top:4px; border-top:1px solid #444; padding-top:2px;">
                    ⚔️ 필요 장비: <span style="color:#fff;">${skill.reqWeapon.join(', ')}</span>
                </div>`;
            }

            tooltip.style.display = 'block';
            tooltip.innerHTML = `
                <div style="min-width: 180px;">
                    <div style="font-weight:bold; color:gold; font-size:14px; margin-bottom:4px;">${skill.name}</div>
                    <div style="font-size:12px; color:#ddd; line-height:1.4; margin-bottom:8px;">${skill.desc}</div>
                    <div style="display:flex; gap:10px; font-size:11px; border-top:1px solid #555; padding-top:4px;">
                        <span style="color:#0cf;">MP ${mp}</span>
                        <span style="color:#f88;">Cost ${cost}</span>
                        <span style="color:#aaa;">Tier ${skill.tier || 1}</span>
                    </div>
                    ${reqInfoHtml}
                </div>
            `;
            if (e) this.moveTooltip(e);
        }
    }
    // ================================================================
    // 🎁 [수정] 초기 무료 스킬 선택 (기존 스킬 유지 + 추가)
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

            // UI 생성
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
                position: 'relative' // 닫기 버튼 배치를 위해
            });

            // [수정] 닫기(뒤로가기) 버튼 추가
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
                // 선택 안 하고 그냥 닫음 (resolve 호출 안함 or null 호출) -> 여기서는 그냥 창 닫고 종료
                // 만약 이 함수를 await 중이라면 resolve()를 해줘야 흐름이 안 끊김
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

                // [수정] 무기 정보 표시 및 상세 설명 포함
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
    // 공통 유틸리티
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

        const closeBtn = document.getElementById('btn-sub-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                // [추가] 타이머 정리
                if (this.npcTalkTimer) clearInterval(this.npcTalkTimer);
                this.game.closeSubMenu();
            };
        }
    }

    enterTown() {
        // [추가] NPC 타이머 정리
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

    // [TownSystem.js] showItemTooltip 함수 (장비 비교 기능 추가됨)
    showItemTooltip(e, itemId) {
        if (!itemId) return;

        // 1. 아이템 데이터 가져오기
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

            // ------------------------------------------------------------
            // [신규] 장비 비교 로직
            // ------------------------------------------------------------
            let diffHtml = ""; // 메인 스탯(공격력/방어력) 비교 결과
            let subDiffHtml = ""; // 서브 스탯(힘, 민첩 등) 비교 결과
            
            // 현재 선택된 영웅 가져오기 (HeroManager가 있을 때만)
            if (this.game.heroManager && 
                this.game.heroManager.selectedHeroIdx !== null && 
                this.game.gameState.heroes) {
                
                const hero = this.game.gameState.heroes[this.game.heroManager.selectedHeroIdx];
                if (hero) {
                    // 비교할 슬롯 찾기
                    let slot = null;
                    if (item.type === 'WEAPON') slot = 'mainHand';
                    else if (item.type === 'SHIELD') slot = 'offHand';
                    else if (['HEAD', 'BODY', 'LEGS', 'NECK', 'RING'].includes(item.type)) slot = item.type.toLowerCase(); // 대소문자 주의 (보통 소문자로 저장됨)
                    
                    // 해당 슬롯에 착용 중인 아이템이 있는지 확인 (body, head 등)
                    // 데이터 키가 대문자일 수도 있으므로 변환 (게임 데이터 구조에 따라 body, head 등 확인)
                    let equippedId = null;
                    if (slot === 'head') equippedId = hero.equipment.head;
                    else if (slot === 'body') equippedId = hero.equipment.body;
                    else if (slot === 'legs') equippedId = hero.equipment.legs;
                    else if (slot === 'neck') equippedId = hero.equipment.neck;
                    else if (slot === 'ring') equippedId = hero.equipment.ring;
                    else if (slot) equippedId = hero.equipment[slot];

                    if (equippedId) {
                        const equippedItem = this.game.itemData[equippedId] || ITEM_DATA[equippedId];
                        if (equippedItem) {
                            // 1. 메인 수치(Val) 비교
                            const diff = (item.val || 0) - (equippedItem.val || 0);
                            if (diff > 0) diffHtml = ` <span style="color:#55ff55; font-size:11px;">(▲${diff})</span>`;
                            else if (diff < 0) diffHtml = ` <span style="color:#ff5555; font-size:11px;">(▼${Math.abs(diff)})</span>`;
                            
                            // 2. 서브 스탯 비교 (예: item.stat이 'str'일 때)
                            if (item.stat) {
                                // 착용 장비도 같은 스탯을 올려주는가?
                                if (equippedItem.stat === item.stat) {
                                    const sDiff = (item.val || 0) - (equippedItem.val || 0); // 보통 스탯 아이템은 val에 수치가 들어감 (구조에 따라 다름)
                                    // 만약 item.statVal 같은 별도 필드를 쓴다면 그것으로 교체
                                    // 여기서는 "추가 스탯"이 메인 val과 별개라고 가정하고, 데이터 구조상 혼용되는 경우를 대비해
                                    // "같은 종류의 스탯일 때만 비교"합니다.
                                }
                            }
                        }
                    } else if (slot) {
                        // 착용 장비가 없음 -> 무조건 이득
                        diffHtml = ` <span style="color:#55ff55; font-size:11px;">(NEW)</span>`;
                    }
                }
            }
            // ------------------------------------------------------------

            // [무기 타입 및 1H/2H 표시]
            let typeText = item.subType || item.type || "";
            if (item.type === 'WEAPON') {
                const hands = item.hands || 1;
                if (hands === 2) typeText += " <span style='color:#ff8888; font-weight:bold;'>(2H)</span>";
                else typeText += " <span style='color:#88aaff;'>(1H)</span>";
            }

            // [메인 스탯 표시 HTML 생성]
            let statHtml = "";
            if (item.type === 'WEAPON') {
                statHtml += `<div style="color:#ff8888;">⚔️ 공격력: ${item.val}${diffHtml}</div>`;
            } else if (['BODY', 'HEAD', 'SHIELD', 'LEGS'].includes(item.type)) {
                statHtml += `<div style="color:#88aaff;">🛡️ 방어력: ${item.val}${diffHtml}</div>`;
            }

            // [추가 스탯 표시]
            if (item.stat && item.type !== 'WEAPON' && item.type !== 'BODY' && item.type !== 'SHIELD') {
                statHtml += `<div style="color:#ffff00;">✨ ${item.stat.toUpperCase()} +${item.val}</div>`;
            } else if (item.stat) {
                 // 무기나 방어구에 붙은 추가 스탯 (ClassBonus 등)
                 // 단순하게 표시 (비교는 복잡해질 수 있어 생략하거나 별도 처리)
                 // statHtml += `<div style="color:#ffff00; font-size:11px;">+ ${item.stat.toUpperCase()}</div>`;
            }

            // [스킬 및 직업]
            let skillHtml = "";
            if (item.skill) {
                skillHtml = `<div style="margin-top:6px; padding-top:4px; border-top:1px dashed #555; color:#00ccff;">🔮 효과: ${item.skill}</div>`;
            }

            let jobHtml = "";
            if (item.jobs && item.jobs.length > 0) {
                jobHtml = `<div style="color:#aaa; font-size:10px; margin-top:2px;">가능 직업: ${item.jobs.join(', ')}</div>`;
            }

            // [최종 렌더링]
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
    // [TownSystem.js] 내부에 추가 (HeroManager 연동용 범용 툴팁)
    showTooltip(e, htmlContent) {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.innerHTML = htmlContent;
            this.moveTooltip(e);
        }
    }

    hideTooltip() {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    moveTooltip(e) {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) {
            // 마우스 오른쪽 아래에 위치
            const x = e.clientX + 15;
            const y = e.clientY + 15;
            
            // 화면 밖으로 나가는 것 방지 (선택사항)
            // if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - 10;
            // if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - 10;

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }
    }

    // 오늘 날짜 문자열 반환 (예: "2026-02-11")
    getTodayString() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    // 일일 초기화 체크 (상점 열 때마다 호출)
    checkDailyRefresh() {
        // 데이터 구조가 없으면 초기화
        if (!this.game.gameState.dailyShop) {
            this.game.gameState.dailyShop = {
                lastDate: this.getTodayString(),
                villages: {} // 마을별 데이터 { "1-0": {...}, "2-0": {...} }
            };
            return;
        }

        const savedDate = this.game.gameState.dailyShop.lastDate;
        const today = this.getTodayString();

        // 날짜가 바뀌었으면 모든 마을 재고 날리기
        if (savedDate !== today) {
            console.log(`📅 날짜 변경 감지 (${savedDate} -> ${today}). 모든 상점 재고를 초기화합니다.`);
            this.game.gameState.dailyShop = {
                lastDate: today,
                villages: {} 
            };
            this.game.saveGame();
            
            // (선택) 알림 띄우기
            this.game.showAlert("🌅 새로운 하루가 밝았습니다.\n상점 물품이 갱신되었습니다!");
        }
    }
}