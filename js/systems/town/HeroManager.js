import { ITEM_DATA, STAT_NAMES, TIER_REQ } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';

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

export class HeroManager {
    constructor(gameApp) {
        this.game = gameApp;
        this.selectedHeroIdx = 0;
    }
    // [신규 추가] 드래그 앤 드롭 핸들러
    handleDragStart(e, invIdx) {
        e.dataTransfer.setData("invIdx", invIdx);
    }

    handleDragOver(e) {
        e.preventDefault(); // 드롭 허용
    }

    handleDrop(e, targetSlot) {
        e.preventDefault();
        const invIdx = e.dataTransfer.getData("invIdx");
        if (invIdx !== null && invIdx !== "") {
            // 인벤토리 인덱스(invIdx)의 아이템을 targetSlot에 장착 시도
            this.equipItemToSlot(this.selectedHeroIdx, parseInt(invIdx), targetSlot);
        }
    }

    // [신규 추가] 특정 슬롯에 장착 (쌍수/교체 지원)
    equipItemToSlot(heroIdx, invIdx, targetSlot) {
        const hero = this.game.gameState.heroes[heroIdx];
        const itemId = this.game.gameState.inventory[invIdx];
        const item = this.game.itemData[itemId];
        if (!item) return;

        // 직업 체크
        if (item.jobs && item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
            this.game.showAlert("이 직업은 착용할 수 없습니다.");
            return;
        }

        // 슬롯 적합성 체크 (무기/방패 등)
        if (item.type === 'WEAPON') {
            if (targetSlot !== 'mainHand' && targetSlot !== 'offHand') return; // 무기는 손에만
            if (targetSlot === 'offHand' && item.hands === 2) {
                this.game.showAlert("보조무기 칸에는 한손 무기만 가능합니다.");
                return;
            }
        } else if (item.type === 'SHIELD' && targetSlot !== 'offHand') {
            return;
        } else if (item.type !== 'CONSUME' && item.type !== targetSlot.toUpperCase()) {
            // 방어구 타입 불일치 (예: HEAD에 BODY 장착 시도)
            return;
        }

        // 양손무기 로직: 주무기에 양손무기 장착 시 보조무기 해제
        if (targetSlot === 'mainHand' && item.hands === 2 && hero.equipment.offHand) {
            this.unequipItem(heroIdx, 'offHand');
        }
        // 보조무기 장착 시 주무기가 양손무기면 주무기 해제
        if (targetSlot === 'offHand') {
            const mainItem = hero.equipment.mainHand ? this.game.itemData[hero.equipment.mainHand] : null;
            if (mainItem && mainItem.hands === 2) this.unequipItem(heroIdx, 'mainHand');
        }

        // 교체 로직: 대상 슬롯에 이미 아이템이 있으면 해제
        if (hero.equipment[targetSlot]) this.unequipItem(heroIdx, targetSlot);

        // 장착 실행
        hero.equipment[targetSlot] = itemId;
        this.game.gameState.inventory.splice(invIdx, 1);
        this.game.saveGame();
        this.renderUI();
    }

    // UI 열기 (CSS 포함)
    openUI() {
        // [안전장치] window.game 연결 확인
        if (!window.game) {
            console.error("⛔ [HeroManager] 치명적 오류: window.game이 정의되지 않았습니다. main.js의 constructor에 'window.game = this;'를 추가해주세요.");
            alert("시스템 오류: window.game 참조 실패 (콘솔 확인 필요)");
            return;
        }

        const modal = document.getElementById('hero-ui-modal');
        const container = document.querySelector('.hero-ui-container');
        
        if (container) {
            container.innerHTML = `
    <style>
        /* 스크롤바 커스텀 */
        .scroll-box::-webkit-scrollbar { width: 6px; }
        .scroll-box::-webkit-scrollbar-track { background: #0d0d0d; }
        .scroll-box::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .scroll-box::-webkit-scrollbar-thumb:hover { background: #666; }
        
        .manage-col {
            flex: 1; display: flex; flex-direction: column; 
            border: 1px solid #333; background: #1a1a1a; min-height: 0;
        }
        .col-header {
            padding: 10px; background: #222; font-weight: bold; 
            border-bottom: 1px solid #444; flex-shrink: 0; text-align: center;
            font-family: 'Orbitron', sans-serif; color: #ddd; font-size: 14px;
        }

        /* [장비창 컨테이너 - 높이 확보] */
        .paper-doll-container {
            position: relative; width: 100%; height: 380px; 
            background: radial-gradient(circle at center, #2a2a2a 0%, #111 70%);
            border-radius: 10px; margin-bottom: 10px; margin-top: 10px;
            box-sizing: border-box; border: 1px solid #333;
        }

        /* 공통 슬롯 스타일 */
        .doll-slot {
            position: absolute; width: 44px; height: 44px;
            background: rgba(0,0,0,0.6); border: 1px solid #555; border-radius: 6px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.2s;
            z-index: 10;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .doll-slot:hover { border-color: gold; background: rgba(255,215,0,0.15); transform: scale(1.05); }
        .doll-slot.filled { border-color: #6688cc; background: #222233; }
        
        .slot-icon { font-size: 22px; margin-bottom: -2px; pointer-events: none; }
        .slot-label { font-size: 9px; color: #777; font-weight:bold; text-transform: uppercase; pointer-events: none; margin-top: 2px; }

        /* [착용 장비 좌표 - 중앙 정렬 최적화] */
        /* 중앙 축 (머리, 목, 몸, 다리) */
        .slot-head { top: 20px;  left: 50%; transform: translateX(-50%); }
        .slot-neck { top: 75px;  left: 50%; transform: translateX(-50%); width: 36px; height: 36px; }
        .slot-body { top: 125px; left: 50%; transform: translateX(-50%); width: 50px; height: 70px; } /* 몸통은 조금 길게 */
        .slot-legs { top: 210px; left: 50%; transform: translateX(-50%); }

        /* 좌우 무기 (몸통 기준 좌우 배치) */
        .slot-main { top: 130px; left: 50%; transform: translateX(-160%); width: 50px; height: 50px; border-color: #844; } 
        .slot-off  { top: 130px; left: 50%; transform: translateX(60%);  width: 50px; height: 50px; border-color: #448; }

        /* 장신구 (다리 옆) */
        .slot-ring { top: 215px; left: 50%; transform: translateX(70%); width: 36px; height: 36px; }

        /* [주머니 영역 - 하단 그리드 배치] */
        .pocket-container {
            position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%);
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
            padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px dashed #444;
        }
        
        /* 주머니 슬롯은 절대 좌표를 해제하고 그리드 흐름을 따름 */
        .slot-pocket {
            position: relative !important; 
            top: auto !important; left: auto !important; transform: none !important;
            width: 40px !important; height: 40px !important;
            border-style: dashed; border-color: #666;
        }
    </style>

                <div class="sub-header" style="justify-content: space-between; padding: 0 20px; flex-shrink: 0;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <h2 style="margin:0; color:gold; font-family:'Orbitron';">HERO MANAGEMENT</h2>
                        <button id="btn-hero-to-party" style="
                            background: #223344; color: #add; border: 1px solid #468; 
                            padding: 5px 15px; border-radius: 4px; cursor: pointer; font-family: 'Orbitron'; font-size:12px;
                        ">🚩 To Party</button>
                    </div>
                    <button class="close-btn" id="btn-hero-close">CLOSE</button>
                </div>
                
                <div id="hero-ui-content" style="flex:1; overflow:hidden; background:#111; position:relative; display:flex; flex-direction:column;">
                    <div class="manage-container" style="display:flex; height:100%; padding:10px; gap:10px; box-sizing:border-box;">
                        
                        <div class="manage-col" style="flex:0.8;">
                            <div class="col-header">HERO LIST</div>
                            <div id="manage-list" class="scroll-box" style="flex:1; overflow-y:auto; padding:10px;"></div>
                        </div>

                        <div class="manage-col" style="flex:1.2;">
                            <div class="col-header">EQUIPMENT</div>
                            <div id="manage-visual" class="scroll-box" style="flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; align-items:center;"></div>
                        </div>

                        <div class="manage-col">
                            <div class="col-header">INVENTORY</div>
                            <div id="manage-inventory" class="scroll-box" style="flex:1; overflow-y:auto; padding:10px;"></div>
                        </div>

                        <div class="manage-col" style="flex:1.2;">
                            <div class="col-header">STATUS & SKILL</div>
                            <div id="manage-stats" class="scroll-box" style="flex:1; overflow-y:auto; padding:10px;"></div>
                        </div>

                    </div>
                </div>
            `;
        }

        // 버튼 이벤트 연결
        const closeBtn = document.getElementById('btn-hero-close');
        if(closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        
        const partyBtn = document.getElementById('btn-hero-to-party');
        if(partyBtn) partyBtn.onclick = () => { modal.style.display = 'none'; this.game.openPartyManager(); };
        
        modal.style.display = 'flex';
        this.renderUI();
    }

    renderUI() {
        this.renderHeroList();
        const hero = (this.selectedHeroIdx !== null && this.selectedHeroIdx !== undefined) 
            ? this.game.gameState.heroes[this.selectedHeroIdx] 
            : null;

        if (hero) {
            this.renderEquipmentPanel(hero);
            this.renderStatsPanel(hero);
        } else {
            document.getElementById('manage-visual').innerHTML = '';
            document.getElementById('manage-stats').innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Select a Hero</div>';
        }
        this.renderInventoryPanel(hero); 
    }

    renderHeroList() {
        const listEl = document.getElementById('manage-list');
        if (!listEl) return;
        
        listEl.innerHTML = this.game.gameState.heroes.map((h, idx) => `
            <div class="hero-list-item ${idx === this.selectedHeroIdx ? 'selected' : ''}" onclick="window.game.heroManager.changeSelectedHero(${idx})">
                <div class="list-icon">${h.icon}</div>
                <div class="list-info">
                    <h4>${h.name}</h4>
                    <span>Lv.${h.level} ${h.classKey}</span>
                </div>
            </div>
        `).join('');
    }

    renderEquipmentPanel(hero) {
        const container = document.getElementById('manage-visual');
        if (!container) return;

        const heroBios = {
            'WARRIOR': "수많은 전장을 지나며 이름보다 흉터가 먼저 알려졌다.",
            'KNIGHT': "방패를 들어 올릴 때마다 작은 한숨을 쉽니다.",
            'MONK': "평화를 설파하며 주먹으로 싸움을 끝냅니다.",
            'ROGUE': "독약병을 깨뜨려 민폐가 일상입니다.",
            'ARCHER': "전장에서 화살을 줍다 적과 눈이 마주칠 때가 가장 괴롭다.",
            'SORCERER': "메테오로 식당을 날려 먹은 뒤 영구 제명되었습니다.",
            'CLERIC': "치유는 오직 현금 결제만 가능합니다.",
            'BARD': "박수 소리가 없으면 조금 토라지는 예술가.",
            'DANCER': "춤은 아름답지만, 작별 인사는 늘 빠릅니다.",
            'ALCHEMIST': "세 번의 폭발 뒤 남는 건 성취 혹은 재."
        };

        let html = `
            <div style="font-size: 40px; margin-bottom:5px;">${hero.icon}</div>
            <h2 style="color:gold; margin:0; font-family:'Orbitron'; font-size:18px;">LV.${hero.level} ${hero.name}</h2>
            <div class="hero-bio-box" style="color:#888; font-size:11px; margin-bottom:10px;">${heroBios[hero.classKey] || "이 영웅은 비밀이 많습니다."}</div>
            
            <div class="paper-doll-container">
        `;

        // 1. 착용 장비 (Humanoid Layout)
        html += this.renderDollSlot(hero, 'head', 'HEAD', 'slot-head', '🧢');
        html += this.renderDollSlot(hero, 'neck', 'NECK', 'slot-neck', '📿');
        html += this.renderDollSlot(hero, 'body', 'BODY', 'slot-body', '👕');
        
        const mainItem = hero.equipment.mainHand ? this.game.itemData[hero.equipment.mainHand] : null;
        const isTwoHanded = mainItem && mainItem.hands === 2;

        html += this.renderDollSlot(hero, 'mainHand', 'MAIN', 'slot-main', '🗡️');
        
        if (isTwoHanded) {
            html += `
                <div class="doll-slot slot-off ghost" style="opacity:0.5; border-style:dashed; top: 130px; left: 50%; transform: translateX(60%); width: 50px; height: 50px;">
                    <div class="slot-icon">🚫</div><div class="slot-label">2H</div>
                </div>
            `;
        } else {
            html += this.renderDollSlot(hero, 'offHand', 'SUB', 'slot-off', '🛡️');
        }

        html += this.renderDollSlot(hero, 'legs', 'LEGS', 'slot-legs', '👢');
        html += this.renderDollSlot(hero, 'ring', 'RING', 'slot-ring', '💍');

        // 2. 주머니 8칸 (4x2 그리드 배치)
        // grid 레이아웃을 사용하여 4개씩 2줄로 자동 정렬합니다.
        html += `<div class="pocket-grid" style="position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px dashed #444;">`;
        
        for (let i = 1; i <= 8; i++) {
            // 'slot-pocket' 클래스를 주어 스타일을 제어합니다.
            html += this.renderDollSlot(hero, `pocket${i}`, `P${i}`, 'slot-pocket', '🎒');
        }
        
        html += `</div>`; // pocket-grid 닫기
        html += `</div>`; // paper-doll-container 닫기

        container.innerHTML = html;
        
        // [스타일 보정] 동적으로 생성된 주머니 슬롯의 스타일 강제 적용
        // renderDollSlot이 기본적으로 absolute 포지션을 가지므로, 그리드 내부에서는 relative로 풀어줍니다.
        const styleFix = document.createElement('style');
        styleFix.innerHTML = `
            .pocket-grid .slot-pocket {
                position: relative !important; 
                top: auto !important; left: auto !important; transform: none !important;
                width: 40px !important; height: 40px !important;
                margin: 0 !important;
                border-style: dashed;
                border-color: #666;
            }
            .pocket-grid .slot-pocket.filled {
                border-style: solid;
                border-color: #6688cc;
            }
        `;
        container.appendChild(styleFix);
    }

    renderDollSlot(hero, slotKey, label, cssClass, placeholderIcon) {
        const itemId = hero.equipment[slotKey];
        const item = itemId ? this.game.itemData[itemId] : null; 
        const isFilled = !!item;
        
        // 1. 툴팁 이벤트 (window.game 사용)
        const tooltipEvent = isFilled 
            ? `onmouseenter="if(window.game) window.game.townSystem.showItemTooltip(event, '${itemId}')" 
               onmouseleave="if(window.game) window.game.townSystem.hideTooltip()" 
               onmousemove="if(window.game) window.game.townSystem.moveTooltip(event)"` 
            : '';
        
        // 2. 클릭 해제 이벤트
        const clickEvent = isFilled 
            ? `onclick="if(window.game) window.game.heroManager.unequipItem(${this.selectedHeroIdx}, '${slotKey}')"` 
            : '';

        // 3. ★ 드래그 앤 드롭 이벤트 추가 (ondragover, ondrop)
        return `
            <div class="doll-slot ${cssClass} ${isFilled ? 'filled' : ''}" 
                 ${tooltipEvent} ${clickEvent}
                 ondragover="if(window.game) window.game.heroManager.handleDragOver(event)"
                 ondrop="if(window.game) window.game.heroManager.handleDrop(event, '${slotKey}')">
                <div class="slot-icon">${item ? item.icon : placeholderIcon}</div>
                <div class="slot-label">${label}</div>
            </div>
        `;
    }

    renderInventoryPanel(hero) {
        const container = document.getElementById('manage-inventory');
        if (!container) return;

        // 초기화 및 그리드 생성
        container.innerHTML = ``;
        const gridEl = document.createElement('div');
        gridEl.id = 'inventory-grid';
        gridEl.className = 'mini-inven-grid';
        gridEl.style.cssText = `display:grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap:5px;`;
        container.appendChild(gridEl);
        
        const inventory = this.game.gameState.inventory; 

        for(let i=0; i<20; i++) {
            const itemId = inventory[i];
            const item = itemId ? this.game.itemData[itemId] : null;
            
            let canEquip = false;
            if (hero && item) {
                canEquip = (!item.jobs || item.jobs.length === 0) || item.jobs.includes(hero.classKey);
            }

            const itemDiv = document.createElement('div');
            itemDiv.className = 'mini-item';
            itemDiv.style.cssText = `
                width: 40px; height: 40px; 
                background: ${item ? '#222' : '#111'}; 
                border: 1px solid ${item ? (canEquip ? '#664' : '#422') : '#333'};
                display: flex; align-items: center; justify-content: center;
                cursor: ${item ? 'grab' : 'default'}; 
                opacity: ${item ? (canEquip ? 1 : 0.5) : 1};
                position: relative;
            `;

            if (item) {
                itemDiv.innerHTML = `<div style="font-size:20px; pointer-events:none;">${item.icon}</div>`;
                
                // ★ 드래그 시작 이벤트 연결
                itemDiv.setAttribute('draggable', true);
                itemDiv.ondragstart = (e) => {
                    if(window.game) window.game.heroManager.handleDragStart(e, i);
                };

                // ★ 툴팁 이벤트 직접 연결 (안전함)
                itemDiv.onmouseenter = (e) => { if(window.game) window.game.townSystem.showItemTooltip(e, itemId); };
                itemDiv.onmouseleave = () => { if(window.game) window.game.townSystem.hideTooltip(); };
                itemDiv.onmousemove = (e) => { if(window.game) window.game.townSystem.moveTooltip(e); };

                // 클릭 장착 (기본)
                itemDiv.onclick = () => {
                    if (this.selectedHeroIdx !== null) {
                        this.equipItem(this.selectedHeroIdx, i);
                    } else {
                        alert("장착할 영웅을 먼저 선택해주세요.");
                    }
                };
            }
            gridEl.appendChild(itemDiv);
        }
    }

    renderStatsPanel(hero) {
        const container = document.getElementById('manage-stats');
        container.className = "col-body hero-stats-panel";

        const hpPct = (hero.curHp / hero.hp) * 100;
        const mpPct = (hero.curMp / hero.mp) * 100;
        const xpPct = (hero.xp / hero.maxXp) * 100;

        const barsHtml = `
            <div class="manage-bar-group">
                <div class="manage-bar-row"><span style="width:20px; font-weight:bold; color:#f55;">HP</span><div class="m-bar-bg"><div class="bar-fill hp-fill" style="width:${hpPct}%"></div></div><span style="width:60px; text-align:right;">${Math.floor(hero.curHp)}/${hero.hp}</span></div>
                <div class="manage-bar-row"><span style="width:20px; font-weight:bold; color:#0cf;">MP</span><div class="m-bar-bg"><div class="bar-fill mp-fill" style="width:${mpPct}%"></div></div><span style="width:60px; text-align:right;">${Math.floor(hero.curMp)}/${hero.mp}</span></div>
                <div class="manage-bar-row"><span style="width:20px; font-weight:bold; color:#aaa;">XP</span><div class="m-bar-bg"><div class="bar-fill xp-fill" style="width:${xpPct}%"></div></div><span style="width:60px; text-align:right;">${Math.floor(hero.xp)}/${hero.maxXp}</span></div>
            </div>`;

        const statsHtml = `
            <div class="stat-panel-container" style="margin-bottom: 15px;">
                <div class="stat-panel" style="flex:1;">
                    <div class="stat-sub-header">BASIC (PT: ${hero.statPoints})</div>
                    ${['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].map(key => {
                        const d = this.getStatDetail(hero, key);
                        return `
                        <div class="stat-box" onmouseenter="if(window.game) window.game.heroManager.previewStatImpact('${key}')" onmouseleave="if(window.game) window.game.heroManager.clearStatPreview()">
                            <span class="stat-key">${key.toUpperCase()}</span>
                            <div class="stat-value-group">
                                <span class="stat-value-num" style="font-family:var(--font-game); font-size:14px; color:#eee;">
                                    ${d.base}${d.bonus > 0 ? `<span class="stat-bonus" style="color:#5f5; font-size:11px; margin-left:4px;">(+${d.bonus})</span>` : ''}
                                </span>
                                <div style="width: 16px; display: flex; justify-content: center; flex-shrink: 0;"> 
                                    ${hero.statPoints > 0 ? `<button class="stat-up-btn" onclick="window.game.heroManager.allocateManageStat('${key}')">+</button>` : ''}
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
                        { id: 'crit', label: '치명타', key: 'crit' },
                        { id: 'eva', label: '회피율', key: 'eva' },
                        { id: 'spd', label: '행동속도', key: 'spd' }
                    ].map(stat => `
                        <div class="stat-box" id="c-stat-${stat.id}">
                            <div class="stat-label-group" style="display:flex; align-items:center; gap:10px; flex:1;">
                                <span class="stat-key" style="font-family:var(--font-main); font-size:11px; color:#aaa;">${stat.label}</span>
                                <span class="stat-preview-arrow" style="display:inline-block; width:20px; color:#0f0; font-weight:bold; text-align:center; font-size:14px;"></span> 
                            </div>
                            <span class="stat-value-num" style="font-family:var(--font-game); font-size:14px; color:#eee; text-align:right; min-width:45px;">
                                ${Formulas.getDerivedStat(hero, stat.key, true)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        // 3. Battle Loadout
        let pocketSlotsHtml = '';
        for (let i = 1; i <= 4; i++) {
            const itemId = hero.equipment[`pocket${i}`];
            const item = itemId ? this.game.itemData[itemId] : null;
            if (item) {
                pocketSlotsHtml += `
                    <div class="mini-item" style="border-color:#888; background:#1a1a1a; cursor:help; width:44px; height:44px;" 
                        onmouseenter="if(window.game) window.game.townSystem.showItemTooltip(event, '${itemId}')"
                        onmouseleave="if(window.game) window.game.townSystem.hideTooltip()"
                        onmousemove="if(window.game) window.game.townSystem.moveTooltip(event)">
                        <span class="item-icon" style="font-size:20px;">${item.icon}</span>
                    </div>`;
            } else {
                pocketSlotsHtml += `<div class="mini-item empty" style="border:1px dashed #333; opacity:0.2; width:44px; height:44px;"></div>`;
            }
        }

        const basicId = hero.equippedBasic || '1000';
        let basicSkill = { name: '기본 공격', icon: '⚔️', desc: '기본 물리 공격' };

        const equippedIds = hero.equippedSkills || [];
        let skillSlotsHtml = '';
        
        for (let i = 0; i < 6; i++) {
            const sId = equippedIds[i];
            const skill = sId ? (hero.skills.find(s => s.id === sId)) : null;
            
            let costText = "";
            let borderColor = "gold";  
            let bgStyle = "#222";      
            let warningText = "";
            let iconOpacity = 1;
            let overlayHtml = "";

            if (skill) {
                if (skill.reqWeapon && skill.reqWeapon.length > 0) {
                    const weapon = hero.equipment.mainHand ? this.game.itemData[hero.equipment.mainHand] : null;
                    const shield = hero.equipment.offHand ? this.game.itemData[hero.equipment.offHand] : null;
                    const mainType = weapon ? weapon.subType : 'FIST';
                    const subType = shield ? shield.subType : 'NONE';

                    const isMatch = skill.reqWeapon.includes(mainType) || skill.reqWeapon.includes(subType);
                    
                    if (!isMatch) {
                        borderColor = "#ff4444";  
                        bgStyle = "#3a1a1a";      
                        warningText = `\n⛔ 사용 불가: ${skill.reqWeapon.join(', ')} 필요`;
                        iconOpacity = 0.5;        
                        overlayHtml = `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:24px; color:red; font-weight:bold; text-shadow:0 0 3px black;">❌</div>`;
                    }
                }

                let costRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
                if(costRed <= 0) costRed = 1.0;
                const finalCost = Math.floor((skill.cost || 50) * costRed);
                costText = `MP: ${skill.mp} / Cost: ${finalCost}`;

                skillSlotsHtml += `
                    <div class="mini-item" style="border-color:${borderColor}; background:${bgStyle}; cursor:pointer; width:100%; height:44px; position:relative;"
                         onclick="window.game.heroManager.unequipSkill(${this.selectedHeroIdx}, '${sId}')"
                         onmouseenter="window.game.heroManager.showSkillTooltip(event, ${this.selectedHeroIdx}, '${sId}')"
                         onmouseleave="window.game.townSystem.hideTooltip()"
                         onmousemove="window.game.townSystem.moveTooltip(event)">
                        <span class="item-icon" style="font-size:20px; opacity:${iconOpacity};">${skill.icon}</span>
                        ${overlayHtml}
                    </div>`;
            } else {
                skillSlotsHtml += `<div class="mini-item empty" style="border:1px dashed #444; opacity:0.3; width:100%; height:44px;"></div>`;
            }
        }

        const loadoutHtml = `
            <div class="equip-group-title" style="margin-top:0px; color:#eba; display:flex; justify-content:space-between; align-items:flex-end;">
                <span>BATTLE LOADOUT</span>
                <span style="font-size:9px; color:#666;">Basic + Pockets | Skills(6)</span>
            </div>
            
            <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; margin-bottom:10px; border:1px solid #333;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
                    <div class="mini-item" style="border:2px solid #aaa; background:#333; cursor:help; width:44px; height:44px; flex-shrink:0;" 
                        title="[기본 공격] ${basicSkill.name}\n(자동 장착됨)">
                        <span class="item-icon" style="font-size:24px;">${basicSkill.icon}</span>
                    </div>
                    <div style="width:1px; height:30px; background:#444;"></div>
                    <div style="display:flex; gap:4px;">${pocketSlotsHtml}</div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:4px; width:100%;">
                    ${skillSlotsHtml}
                </div>
            </div>
        `;

        // 4. 보유 스킬 목록 (2열 그리드)
        let skillListHtml = `<div class="equip-group-title" style="margin-top:10px;"><span>LEARNED SKILLS</span></div>`;
        skillListHtml += `<div class="skill-list-container" style="display:grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 15px;">`;
        
        if (Array.isArray(hero.skills) && hero.skills.length > 0) {
            hero.skills.forEach(s => {
                if (!s) return;

                const isEquipped = equippedIds.includes(s.id);
                const reqLv = TIER_REQ[s.tier] || 1; 
                const isLocked = hero.level < reqLv;

                let weaponMatch = true;
                if (s.reqWeapon && s.reqWeapon.length > 0) {
                    const weapon = hero.equipment.mainHand ? this.game.itemData[hero.equipment.mainHand] : null;
                    const shield = hero.equipment.offHand ? this.game.itemData[hero.equipment.offHand] : null;
                    const mainType = weapon ? weapon.subType : 'FIST';
                    const subType = shield ? shield.subType : 'NONE';
                    
                    if (!s.reqWeapon.includes(mainType) && !s.reqWeapon.includes(subType)) {
                        weaponMatch = false;
                    }
                }

                let opacity = 1;
                let cursor = 'pointer';
                let bgStyle = '#1a1a1a';
                let onClick = '';
                let statusText = '';
                let nameColor = 'gold';
                let borderColor = '#333';

                // 툴팁 이벤트
                const tooltipEvents = `
                    onmouseenter="window.game.heroManager.showSkillTooltip(event, ${this.selectedHeroIdx}, '${s.id}')" 
                    onmouseleave="window.game.townSystem.hideTooltip()" 
                    onmousemove="window.game.townSystem.moveTooltip(event)"
                `;

                if (isEquipped) {
                    opacity = 0.3;
                    cursor = 'default';
                    statusText = '<span style="color:#0f0; font-size:9px;">[E]</span>';
                } else if (isLocked) {
                    opacity = 0.5;
                    cursor = 'not-allowed';
                    bgStyle = '#2d1b1b'; 
                    nameColor = '#888';  
                    onClick = `onclick="window.game.showAlert('Lv.${reqLv}에 해금됩니다.')"`;
                    statusText = `<span style="color:#f55; font-size:9px;">(Lv.${reqLv})</span>`;
                } else if (!weaponMatch) { 
                    opacity = 0.7;
                    bgStyle = '#3a1a1a'; 
                    borderColor = '#ff4444';
                    nameColor = '#ff8888';
                    statusText = '<span style="color:#f55; font-size:9px;">⛔ 무기제한</span>';
                    onClick = `onclick="window.game.heroManager.equipSkill(${this.selectedHeroIdx}, '${s.id}')"`;
                } else {
                    onClick = `onclick="window.game.heroManager.equipSkill(${this.selectedHeroIdx}, '${s.id}')"`;
                }
                
                let costRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
                if(costRed <= 0) costRed = 1.0;
                const finalCost = Math.floor((s.cost || 50) * costRed);

                skillListHtml += `
                    <div class="skill-list-item" style="opacity:${opacity}; cursor:${cursor}; display:flex; align-items:center; gap:8px; padding:0 8px; background:${bgStyle}; border:1px solid ${borderColor}; border-radius:4px; height:60px; box-sizing:border-box;" ${onClick} ${tooltipEvents}>
                        <div style="font-size:24px; min-width:30px; text-align:center; align-self:center;">${s.icon || '❓'}</div>
                        <div style="flex:1; overflow:hidden; display:flex; flex-direction:column; justify-content:center; height:100%;">
                            <div style="color:${nameColor}; font-size:12px; font-weight:bold; margin-bottom:2px;">${s.name} ${statusText}</div>
                            <div style="color:#888; font-size:10px; white-space:normal; word-break:keep-all; line-height:1.25; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${s.desc || ''}</div>
                        </div>
                        <div style="text-align:right; font-size:10px; color:#888; min-width:45px; align-self:center; display:flex; flex-direction:column; gap:2px;">
                            <div style="color:#0cf;">MP ${s.mp}</div>
                            <div style="color:#f88;">Cost ${finalCost}</div>
                        </div>
                    </div>`;
            });
        } else {
            skillListHtml += `<div style="grid-column: span 2; color:#666; font-size:11px; text-align:center; padding:10px;">습득한 스킬이 없습니다.</div>`;
        }
        skillListHtml += `</div>`;

        container.innerHTML = `
            ${barsHtml}
            ${statsHtml}
            ${loadoutHtml}
            ${skillListHtml}
            <button class="dismiss-btn" style="margin-top: auto; width:100%; padding:10px; background:#422; color:#f88; border:1px solid #622;" onclick="window.game.heroManager.dismissHero(${this.selectedHeroIdx})">영웅 방출 (Release)</button>
        `;
    }

    // [수정된 부분] 티어(레벨) 체크 로직 및 문자열 ID 변환 추가
    equipSkill(heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        if (!hero.equippedSkills) hero.equippedSkills = [];

        // ID를 문자열로 변환하여 비교
        const skill = hero.skills.find(s => String(s.id) === String(skillId));
        
        if (!skill) {
            console.error("스킬을 찾을 수 없습니다:", skillId);
            return;
        }

        const reqLv = TIER_REQ[skill.tier] || 1;
        if (hero.level < reqLv) {
            this.game.showAlert(`레벨이 부족합니다.\n(필요 레벨: ${reqLv})`);
            return;
        }

        if (skill.reqWeapon && skill.reqWeapon.length > 0) {
            const weaponId = hero.equipment.mainHand;
            const offHandId = hero.equipment.offHand;
            const weapon = weaponId ? this.game.itemData[weaponId] : null;
            const shield = offHandId ? this.game.itemData[offHandId] : null;
            
            const mainType = weapon ? weapon.subType : 'FIST';
            const subType = shield ? shield.subType : 'NONE';

            const isMatch = skill.reqWeapon.includes(mainType) || skill.reqWeapon.includes(subType);

            if (!isMatch) {
                this.game.showAlert(`사용할 수 없는 무기입니다.\n필요: ${skill.reqWeapon.join(', ')}`);
                return;
            }
        }

        if (hero.equippedSkills.length >= 6) {
            this.game.showAlert("스킬은 최대 6개까지만 장착할 수 있습니다.");
            return;
        }
        
        if (hero.equippedSkills.some(id => String(id) === String(skillId))) return;

        hero.equippedSkills.push(skill.id);
        this.game.saveGame();
        this.renderUI();
    }

    unequipSkill(heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        if (!hero.equippedSkills) return;

        const idx = hero.equippedSkills.indexOf(skillId);
        if (idx > -1) {
            hero.equippedSkills.splice(idx, 1);
            this.game.saveGame();
            this.renderUI();
        }
    }

    changeSelectedHero(idx) {
        this.selectedHeroIdx = idx;
        this.renderUI();
    }

    unequipItem(heroIdx, slotKey) {
        const hero = this.game.gameState.heroes[heroIdx];
        
        const usedSlots = this.game.gameState.inventory.filter(id => id !== null).length;
        if (usedSlots >= 20) {
            this.game.showAlert("인벤토리가 가득 찼습니다!");
            return;
        }

        if (hero.equipment[slotKey]) {
            const emptyIdx = this.game.gameState.inventory.findIndex(id => id === null);
            if (emptyIdx !== -1) {
                this.game.gameState.inventory[emptyIdx] = hero.equipment[slotKey];
            } else {
                this.game.gameState.inventory.push(hero.equipment[slotKey]);
            }
            
            hero.equipment[slotKey] = null;
            this.game.saveGame();
            this.renderUI();
        }
    }
    
    equipItem(heroIdx, invIdx) {
       const hero = this.game.gameState.heroes[heroIdx];
       const itemId = this.game.gameState.inventory[invIdx];
       const item = this.game.itemData[itemId];

       if (!item) return;
       if (item.jobs && item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
           this.game.showAlert("이 직업은 착용할 수 없습니다.");
           return;
       }

       let targetSlot = null;
       let itemsToUnequip = [];

       switch (item.type) {
           case 'WEAPON':
               targetSlot = 'mainHand';
               if (item.hands === 2 && hero.equipment.offHand) itemsToUnequip.push('offHand');
               break;
           case 'SHIELD':
               targetSlot = 'offHand';
               if (hero.equipment.mainHand) {
                   const mainItem = this.game.itemData[hero.equipment.mainHand];
                   if (mainItem && mainItem.hands === 2) itemsToUnequip.push('mainHand');
               }
               break;
           case 'HEAD': targetSlot = 'head'; break;
           case 'BODY': targetSlot = 'body'; break;
           case 'LEGS': targetSlot = 'legs'; break;
           case 'NECK': targetSlot = 'neck'; break;
           case 'ACC': 
               if (item.subType === 'RING') targetSlot = 'ring';
               else if (item.subType === 'NECK') targetSlot = 'neck';
               break;
           case 'CONSUME':
                // 빈 슬롯 찾기 (1~8)
                for (let i = 1; i <= 8; i++) {
                    if (!hero.equipment[`pocket${i}`]) {
                        targetSlot = `pocket${i}`;
                        break;
                    }
                }
                // 꽉 찼으면 1번에 덮어쓰기 (기본값)
                if (!targetSlot) targetSlot = 'pocket1';
                break;
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

            default: console.error("Unknown Type"); return;
        }

       if (hero.equipment[targetSlot]) itemsToUnequip.push(targetSlot);

       itemsToUnequip.forEach(slot => {
           if (hero.equipment[slot]) {
               this.game.gameState.inventory.push(hero.equipment[slot]);
               hero.equipment[slot] = null;
           }
       });

       hero.equipment[targetSlot] = itemId;
       this.game.gameState.inventory.splice(invIdx, 1);
       this.game.saveGame();
       this.renderUI();
    }

    dismissHero(idx) {
        const h = this.game.gameState.heroes[idx];
        Object.keys(h.equipment).forEach(slot => {
            if(h.equipment[slot]) this.game.gameState.inventory.push(h.equipment[slot]);
        });
        this.game.showConfirm(`${h.name} 영웅을 떠나보내시겠습니까?`, () => {
            this.game.gameState.heroes.splice(idx, 1);
            this.selectedHeroIdx = 0;
            this.renderUI();
            this.game.saveGame();
        });
    }

    getStatDetail(hero, key) {
        const base = Number(hero[key]) || 0;
        let bonus = 0;
        Object.values(hero.equipment).forEach(itemId => {
            if (itemId && this.game.itemData[itemId]) {
                const item = this.game.itemData[itemId];
                if (item.type === 'WEAPON' && ((hero.atkType === 'PHYS' && key === 'str') || (hero.atkType === 'MAG' && key === 'int'))) bonus += item.val;
                if (item.type === 'ARMOR' && key === 'def') bonus += item.val;
                if (item.stat === key) bonus += item.val;
            }
        });
        return { base, bonus };
    }

    allocateManageStat(statKey) {
        const hero = this.game.gameState.heroes[this.selectedHeroIdx];
        const cost = (hero[statKey] >= 40) ? 3 : (hero[statKey] >= 20 ? 2 : 1);
        
        if (hero.statPoints < cost) {
            this.game.showAlert(`포인트가 부족합니다! (필요: ${cost} PT)`);
            return;
        }

        hero[statKey]++;
        hero.statPoints -= cost;
        
        if (statKey === 'vit') { hero.hp += 10; hero.curHp += 10; }
        else if (statKey === 'int') { hero.mp += 5; hero.curMp += 5; }
        
        this.renderUI();
    }

    previewStatImpact(statKey) {
        this.clearStatPreview(); 
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

    showTooltip(e, html) {
        if(this.game.townSystem) this.game.townSystem.showTooltip(e, html);
    }

    hideTooltip() {
        if(this.game.townSystem) this.game.townSystem.hideTooltip();
    }

    moveTooltip(e) {
    const tooltip = document.getElementById('global-tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        // 커서에서 오른쪽 아래로 25px씩 확실히 떨어뜨림
        // 만약 커서 이미지가 크다면 이 값을 더 키워야 합니다.
        const gap = 25; 
        let left = e.clientX + gap;
        let top = e.clientY + gap;

        // 화면 오른쪽 끝 처리
        if (left + tooltip.offsetWidth > window.innerWidth) {
            left = e.clientX - tooltip.offsetWidth - gap;
        }
        // 화면 아래쪽 끝 처리
        if (top + tooltip.offsetHeight > window.innerHeight) {
            top = e.clientY - tooltip.offsetHeight - gap;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }
}

    showSkillTooltip(e, heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        if (!hero) return;
        const s = hero.skills.find(sk => sk.id === skillId);
        if (!s) return;

        let costRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
        if(costRed <= 0) costRed = 1.0;
        const finalCost = Math.floor((s.cost || 50) * costRed);

        // 1. 필요 무기 정보 생성
        let reqInfoHtml = "";
        if (s.reqWeapon && s.reqWeapon.length > 0) {
            reqInfoHtml = `<div style="color:#aaa; font-size:10px; margin-top:4px; border-top:1px solid #444; padding-top:2px;">
                ⚔️ 필요 장비: <span style="color:#fff;">${s.reqWeapon.join(', ')}</span>
            </div>`;
        }

        // 2. 경고 메시지 생성
        let warningHtml = "";
        if (s.reqWeapon && s.reqWeapon.length > 0) {
            const weaponId = hero.equipment.mainHand;
            const offHandId = hero.equipment.offHand;
            const weapon = weaponId ? this.game.itemData[weaponId] : null;
            const shield = offHandId ? this.game.itemData[offHandId] : null;
            
            const mainType = weapon ? weapon.subType : 'FIST';
            const subType = shield ? shield.subType : 'NONE';

            const isMatch = s.reqWeapon.includes(mainType) || s.reqWeapon.includes(subType);

            if (!isMatch) {
                warningHtml = `
                    <div style='margin-top:2px; padding-top:2px; color:#ff6666; font-weight:bold;'>
                        ⛔ 사용 불가 (현재: ${weapon ? weapon.name : '맨손'})
                    </div>
                `;
            }
        }

        // 3. 최종 HTML 조립 (reqInfoHtml, warningHtml 포함)
        const html = `
            <div style='color:gold; font-weight:bold; font-size:14px; margin-bottom:4px;'>${s.name}</div>
            <div style='font-size:12px; color:#ddd; margin-bottom:8px; line-height:1.4;'>${s.desc}</div>
            <div style='display:flex; gap:10px; font-size:11px; border-top:1px solid #555; padding-top:4px;'>
                <span style='color:#0cf;'>MP ${s.mp}</span>
                <span style='color:#f88;'>Cost ${finalCost}</span>
                <span style='color:#aaa;'>Tier ${s.tier || 1}</span>
            </div>
            ${reqInfoHtml}
            ${warningHtml} 
        `;
        
        if(this.game.townSystem) this.game.townSystem.showTooltip(e, html);
    }

    clearStatPreview() {
        document.querySelectorAll('.stat-preview-arrow').forEach(el => {
            el.textContent = ''; 
        });
    }
}