import { ITEM_DATA, STAT_NAMES, JOB_CLASS_DATA } from '../../data/index.js';
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

    _getClassString(h) {
        let classStr = `Class ${h.classLevel || 1}: ${h.classKey}`;
        if (typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === h.classKey && c.classLevel === (h.classLevel || 1));
            if (cInfo) classStr = `Class ${cInfo.classLevel}: ${cInfo.classNameEn} (${cInfo.className})`;
        }
        return classStr;
    }

    // ⭐ [신규] 연금술사 클래스 최대 포켓 개수 반환기
    getMaxPockets(hero) {
        if (!hero) return 4;
        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');
        if (isAlchemist) {
            let hasExpanded = false;
            if (hero.skills) {
                // ⭐ 보유 스킬 전체가 아닌 장착한 스킬 중에서 확장 포켓 패시브 탐색
                const equippedIds = hero.equippedSkills || [];
                const activeSkills = hero.skills.filter(s => equippedIds.includes(s.id) || (s.category && equippedIds.includes(`CAT_${s.category}`)));
                
                hasExpanded = activeSkills.some(s => 
                    s.name === 'Expanded Pocket' || 
                    s.name === '확장 포켓' || 
                    (s.effects && s.effects.some(e => e.type === 'EXPANDED_POCKET'))
                );
            }
            return hasExpanded ? 8 : 6;
        }
        return 4; 
    }

    handleDragStart(e, invIdx) { e.dataTransfer.setData("invIdx", invIdx); }
    handleDragOver(e) { e.preventDefault(); }
    handleDrop(e, targetSlot) {
        e.preventDefault();
        const invIdx = e.dataTransfer.getData("invIdx");
        if (invIdx !== null && invIdx !== "") {
            this.equipItemToSlot(this.selectedHeroIdx, parseInt(invIdx), targetSlot);
        }
    }

    equipItemToSlot(heroIdx, invIdx, targetSlot) {
        const hero = this.game.gameState.heroes[heroIdx];
        
        // ⭐ [신규] 오브젝트(중첩)와 텍스트(구버전) 하위 호환 추출
        const invData = this.game.gameState.inventory[invIdx];
        const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
        const invCount = typeof invData === 'object' && invData !== null ? (invData.count || 1) : 1;
        
        const item = this.game.itemData[itemId];
        if (!item) return;

        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        if (item.jobs && item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
            this.game.showAlert("이 직업은 착용할 수 없습니다."); return;
        }

        // ⭐ [신규] 연금술사 무기 장착 불가 룰
        if (isAlchemist && (targetSlot === 'mainHand' || targetSlot === 'offHand')) {
            this.game.showAlert("연금술사는 무기와 방패를 장착할 수 없습니다. (연금술 가방 전용)");
            return;
        }

        if (item.type === 'WEAPON') {
            if (targetSlot !== 'mainHand' && targetSlot !== 'offHand') return;
            if (targetSlot === 'offHand' && item.hands === 2) {
                this.game.showAlert("보조무기 칸에는 한손 무기만 가능합니다."); return;
            }
        } else if (item.type === 'SHIELD' && targetSlot !== 'offHand') {
            return;
        } else if (item.type !== 'CONSUME' && item.type !== targetSlot.toUpperCase()) {
            if (!(item.type === 'ACC' && (targetSlot === 'ring' || targetSlot === 'neck'))) {
                // ⭐ 연금술사의 경우 MAT_ 재료 아이템도 포켓에 허용
                if (!(isAlchemist && targetSlot.startsWith('pocket') && typeof itemId === 'string' && itemId.startsWith('MAT_'))) {
                    return;
                }
            }
        }

        // ⭐ [신규] 포켓 슬롯 통제 및 중첩(Stacking) 로직
        if (targetSlot.startsWith('pocket')) {
            const pNum = parseInt(targetSlot.replace('pocket', ''));
            if (pNum > this.getMaxPockets(hero)) {
                this.game.showAlert("해당 포켓 슬롯은 잠겨 있습니다."); return;
            }
            
            const eqData = hero.equipment[targetSlot];
            const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            const eqCount = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : (eqData ? 1 : 0);

            // 동일 아이템 중첩 시도 (연금술사 전용, 최대 3개)
            if (isAlchemist && (item.type === 'CONSUME' || (typeof itemId === 'string' && itemId.startsWith('MAT_'))) && eqId === itemId && eqCount < 3) {
                const spaceLeft = 3 - eqCount;
                const transferCount = Math.min(spaceLeft, invCount);
                
                hero.equipment[targetSlot] = { id: itemId, count: eqCount + transferCount };
                
                if (invCount > transferCount) {
                    this.game.gameState.inventory[invIdx] = { id: itemId, count: invCount - transferCount };
                } else {
                    this.game.gameState.inventory.splice(invIdx, 1);
                }
                this.game.saveGame();
                this.renderUI();
                return;
            }
        }

        if (targetSlot === 'mainHand' && item.hands === 2 && hero.equipment.offHand) {
            this.unequipItem(heroIdx, 'offHand');
        }
        if (targetSlot === 'offHand') {
            const mainData = hero.equipment.mainHand;
            const mainItemId = typeof mainData === 'object' && mainData !== null ? mainData.id : mainData;
            const mainItem = mainItemId ? this.game.itemData[mainItemId] : null;
            if (mainItem && mainItem.hands === 2) this.unequipItem(heroIdx, 'mainHand');
        }

        if (hero.equipment[targetSlot]) this.unequipItem(heroIdx, targetSlot);

        // 오브젝트 자체(중첩 카운트 포함)를 슬롯에 장착
        hero.equipment[targetSlot] = invData; 
        this.game.gameState.inventory.splice(invIdx, 1);
        this.game.saveGame();
        this.renderUI();
    }

    openUI() {
        if (!window.game) return;

        const modal = document.getElementById('hero-ui-modal');
        const container = document.querySelector('.hero-ui-container');
        
        if (container) {
            container.classList.add('luxury-modal-container');
            container.style.cssText = '';

            container.innerHTML = `
    <style>
        .scroll-box::-webkit-scrollbar { width: 8px; }
        .scroll-box::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; margin: 4px; }
        .scroll-box::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; border: 1px solid #222; }
        .scroll-box::-webkit-scrollbar-thumb:hover { background: #c5a059; }

        .manage-col { flex: 1; display: flex; flex-direction: column; border: 1px solid #333; background: linear-gradient(180deg, #15151a, #0a0a0c); border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); min-height: 0; }
        
        .scroll-box { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 15px; min-height: 0; display: flex; flex-direction: column; }
        
        .col-header { padding: 12px; background: linear-gradient(90deg, #1a1a1a, #080808); font-weight: bold; border-bottom: 1px solid #444; flex-shrink: 0; text-align: center; font-family: 'Orbitron', sans-serif; color: var(--gold); font-size: 14px; letter-spacing: 2px; }

        .paper-doll-container { position: relative; width: 100%; height: 380px; flex-shrink: 0; background: radial-gradient(circle at center, #1a1a24 0%, #050508 80%); border-radius: 8px; margin-bottom: 15px; margin-top: 5px; box-sizing: border-box; border: 1px solid #222; }
        
        .doll-slot { position: absolute; width: 44px; height: 44px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 10; }
        .doll-slot.empty { background: rgba(0,0,0,0.6); border: 1px dashed #333; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); opacity: 0.5; }
        .doll-slot.empty:hover { opacity: 1; border-color: #666; background: rgba(20,20,30,0.8); }
        .doll-slot.empty .slot-icon { opacity: 0.2; filter: grayscale(100%); }
        .doll-slot.filled { border: 1px solid #c5a059; background: linear-gradient(135deg, #1a1a2a, #0d0d15); box-shadow: 0 4px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1); opacity: 1; }
        .doll-slot.filled:hover { border-color: #fff; box-shadow: 0 0 15px rgba(197, 160, 89, 0.4); filter: brightness(1.2); z-index: 20; }
        
        .slot-icon { font-size: 22px; margin-bottom: -2px; pointer-events: none; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.8)); }
        .slot-label { font-size: 9px; color: #777; font-weight:bold; text-transform: uppercase; pointer-events: none; margin-top: 2px; font-family:'Orbitron'; text-shadow: 1px 1px 0 #000; }
        .filled .slot-label { color: #c5a059; }

        .slot-head { top: 20px;  left: 50%; transform: translateX(-50%); }
        .slot-neck { top: 75px;  left: 50%; transform: translateX(-50%); width: 36px; height: 36px; }
        .slot-body { top: 125px; left: 50%; transform: translateX(-50%); width: 50px; height: 70px; }
        .slot-legs { top: 210px; left: 50%; transform: translateX(-50%); }
        .slot-main { top: 130px; left: 50%; transform: translateX(-160%); width: 50px; height: 50px; } 
        .slot-off  { top: 130px; left: 50%; transform: translateX(60%);  width: 50px; height: 50px; }
        .slot-ring { top: 215px; left: 50%; transform: translateX(70%); width: 36px; height: 36px; }

        .pocket-container { position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 8px; background: rgba(0,0,0,0.5); border-radius: 8px; border: 1px solid #111; }
        .pocket-container .slot-pocket { position: relative !important; top: auto !important; left: auto !important; transform: none !important; width: 40px !important; height: 40px !important; margin: 0 !important; }

        .stat-section { background: #111; border: 1px solid #222; border-radius: 6px; padding: 12px; margin-bottom: 12px; flex-shrink: 0; width: 100%; box-sizing: border-box; }
        .stat-section-title { font-family: 'Orbitron'; font-size: 11px; color: #888; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center; }
        .pt-badge { background: #321; color: #f88; padding: 2px 6px; border-radius: 4px; border: 1px solid #522; font-size: 10px; }
        .pt-badge.has-pt { background: #443300; color: gold; border-color: gold; }
        .stat-grid-modern { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; width: 100%; }
        .stat-row-modern { display: flex; justify-content: space-between; align-items: center; background: #15151a; padding: 4px 8px; border-radius: 4px; border: 1px solid #222; min-width:0; }
        .stat-name { font-size: 11px; color: #aaa; font-weight: bold; flex-shrink:0; width: 45px; }
        .stat-val-area { flex: 1; text-align: right; font-family: 'Orbitron'; font-size: 13px; color: #eee; min-width:0; }
        .stat-bonus { color: #5f5; font-size: 11px; margin-left: 2px; }
        .stat-add-btn { background: #252525; border: 1px solid #886600; color: gold; width: 18px; height: 18px; line-height: 16px; margin-left: 8px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink:0; }
        .stat-add-btn:hover { background: #443300; border-color: #ffd700; filter: brightness(1.2); box-shadow: 0 0 8px rgba(255, 215, 0, 0.5); }
        .stat-add-btn:active { filter: brightness(0.8); }

        .sleek-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 11px; }
        .sleek-bar-label { width: 25px; font-weight: bold; color: #888; font-family: 'Orbitron'; flex-shrink:0; }
        .sleek-bar-bg { flex: 1; height: 6px; background: #000; border: 1px solid #333; border-radius: 3px; position: relative; overflow: hidden; }
        .sleek-bar-fill { height: 100%; }
        .sleek-bar-text { width: 70px; text-align: right; color: #ccc; font-family: 'Orbitron'; font-size: 10px; flex-shrink:0; }
    </style>
                <div class="sub-header" style="justify-content: space-between; padding: 0 30px; flex-shrink: 0; background: rgba(0,0,0,0.6); border-bottom: 1px solid #333; align-items:center; display:flex;">
                    <h2 style="margin:0; color:var(--gold); font-family:'Orbitron'; letter-spacing:2px; font-size:20px;">🛡️ HERO & EQUIP</h2>
                    
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button id="btn-hero-to-party" style="background: rgba(0,0,0,0.5); color: #8af; border: 1px solid #468; padding: 6px 20px; border-radius: 30px; cursor: pointer; font-family: 'Orbitron'; font-size:11px; transition: 0.3s;" onmouseover="this.style.background='rgba(68,136,204,0.2)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">▶ PARTY MENU</button>
                        <button id="btn-hero-to-skill" style="background: rgba(0,0,0,0.5); color: #f8a; border: 1px solid #846; padding: 6px 20px; border-radius: 30px; cursor: pointer; font-family: 'Orbitron'; font-size:11px; transition: 0.3s;" onmouseover="this.style.background='rgba(204,68,136,0.2)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">▶ SKILL MENU</button>
                    </div>

                    <button class="close-btn" id="btn-hero-close" style="background:transparent; color:#888; border:none; font-size:18px; cursor:pointer;">✖</button>
                </div>
                
                <div id="hero-ui-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                    <div class="manage-container" style="flex: 1; min-height: 0; display: flex; padding: 15px; gap: 15px; box-sizing: border-box; overflow-x:hidden;">
                        
                        <div class="manage-col" style="flex:0.9;">
                            <div class="col-header">ROSTER</div>
                            <div id="manage-list" class="scroll-box"></div>
                        </div>
                        
                        <div class="manage-col" style="flex:1.2; position:relative;">
                            <div class="col-header">HERO STATS</div>
                            <div id="manage-stats" class="scroll-box" style="padding-bottom: 60px;"></div>
                            <div style="position:absolute; bottom:15px; left:15px; right:15px; display:flex;">
                                <button style="width:100%; padding:10px; background:rgba(255,0,0,0.1); color:#f55; border:1px solid #422; border-radius:6px; cursor:pointer; font-family:'Orbitron'; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#422'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,0,0,0.1)'; this.style.color='#f55';" onclick="window.game.heroManager.dismissHero(window.game.heroManager.selectedHeroIdx)">RELEASE HERO</button>
                            </div>
                        </div>

                        <div class="manage-col" style="flex:1.1;">
                            <div class="col-header">EQUIPMENT</div>
                            <div id="manage-visual" class="scroll-box" style="align-items:center;"></div>
                        </div>
                        
                        <div class="manage-col" style="flex:1.0;">
                            <div class="col-header">INVENTORY</div>
                            <div id="manage-inventory" class="scroll-box"></div>
                        </div>
                        
                    </div>
                </div>
            `;
        }

        const closeBtn = document.getElementById('btn-hero-close');
        if(closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        
        const partyBtn = document.getElementById('btn-hero-to-party');
        if(partyBtn) partyBtn.onclick = () => { 
            modal.style.display = 'none'; 
            if(this.game.openPartyManager) this.game.openPartyManager(); 
        };
        
        const skillBtn = document.getElementById('btn-hero-to-skill');
        if(skillBtn) skillBtn.onclick = () => { 
            modal.style.display = 'none'; 
            if(this.game.skillManager) this.game.skillManager.openUI(); 
        };
        
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
            document.getElementById('manage-stats').innerHTML = '<div style="color:#666; text-align:center; padding:50px;">Select a Hero</div>';
        }
        this.renderInventoryPanel(hero); 
    }

    renderHeroList() {
        const listEl = document.getElementById('manage-list');
        if (!listEl) return;
        
        let html = '';
        html += `<div style="font-size:12px; color:var(--gold); margin:10px 0 8px 5px; font-family:'Orbitron'; font-weight:bold; letter-spacing:1px;">⚔️ ACTIVE PARTY</div>`;
        for (let i = 0; i < 6; i++) {
            const h = this.game.gameState.heroes[i];
            if (!h) continue;
            html += this._createHeroListItem(h, i);
        }

        const rosterHeroes = this.game.gameState.heroes.slice(6);
        if (rosterHeroes.length > 0) {
            html += `<div style="font-size:12px; color:#888; margin:20px 0 8px 5px; font-family:'Orbitron'; font-weight:bold; letter-spacing:1px;">🏕️ RESERVE ROSTER</div>`;
            for (let i = 6; i < this.game.gameState.heroes.length; i++) {
                const h = this.game.gameState.heroes[i];
                if (!h) continue;
                html += this._createHeroListItem(h, i);
            }
        }
        listEl.innerHTML = html;
    }

    _createHeroListItem(h, idx) {
        const isSelected = (idx === this.selectedHeroIdx);
        const classStr = this._getClassString(h);

        return `
            <div class="hero-list-item ${isSelected ? 'selected' : ''}" 
                 style="background: ${isSelected ? 'linear-gradient(90deg, #2a2a35, #111)' : '#151515'}; border: 1px solid ${isSelected ? '#c5a059' : '#333'}; display:flex; align-items:center; gap:10px; padding:10px; margin-bottom:8px; border-radius:8px; cursor:pointer; transition: 0.2s; box-shadow: ${isSelected ? '0 0 10px rgba(197,160,89,0.3)' : 'none'};" 
                 onclick="window.game.heroManager.changeSelectedHero(${idx})">
                <div class="list-icon" style="background:#000; border:1px solid ${isSelected ? '#c5a059' : '#444'}; font-size:24px; min-width:42px; height:42px; display:flex; align-items:center; justify-content:center; border-radius:6px; box-shadow:inset 0 0 5px rgba(0,0,0,0.8);">${h.icon}</div>
                
                <div class="list-info" style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center;">
                    <div style="margin:0; font-size:14px; font-weight:bold; color:${isSelected ? '#fff' : '#ccc'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${h.name} <span style="font-size:10px; color:#888; font-weight:normal;">Lv.${h.level}</span>
                    </div>
                    <div style="font-size:9px; color:#0cf; margin-top:3px; font-family:'Orbitron'; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${classStr}</div>
                </div>
                
                <div style="width:15px; text-align:right; color:var(--gold); font-size:14px; font-weight:bold; flex-shrink:0;">
                    ${isSelected ? '◀' : ''}
                </div>
            </div>
        `;
    }

    renderEquipmentPanel(hero) {
        const container = document.getElementById('manage-visual');
        if (!container) return;

        const classStr = this._getClassString(hero);
        const jp = hero.jpAvailable || 0;
        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        let html = `
            <div style="font-size: 48px; margin-bottom:5px; filter:drop-shadow(0 5px 10px rgba(0,0,0,0.8)); text-align:center;">${hero.icon}</div>
            <h2 style="color:#fff; margin:0; font-family:'Orbitron'; font-size:18px; letter-spacing:1px; text-align:center;">
                <span style="font-size:14px; color:#aaa; margin-right:5px;">LV.${hero.level}</span><span style="color:var(--gold);">${hero.name}</span>
            </h2>
            
            <div style="text-align:center; margin-top:8px; margin-bottom:15px; display:flex; flex-direction:column; align-items:center; gap:6px;">
                <div style="color:#0cf; font-size:12px; font-weight:bold; font-family:'Orbitron'; background:rgba(0,150,255,0.1); padding:4px 12px; border-radius:4px; border:1px solid rgba(0,200,255,0.3);">
                    ${classStr}
                </div>
                <div style="display:inline-block; background:rgba(0,0,0,0.8); padding:4px 12px; border-radius:12px; border:1px solid #443300; color:#ffd700; font-size:11px; font-weight:bold; box-shadow:inset 0 0 5px rgba(255,215,0,0.2);">
                    💎 가용 JP : ${jp}
                </div>
            </div>
            
            <div class="paper-doll-container">
        `;
        html += this.renderDollSlot(hero, 'head', 'HEAD', 'slot-head', '🧢');
        html += this.renderDollSlot(hero, 'neck', 'NECK', 'slot-neck', '📿');
        html += this.renderDollSlot(hero, 'body', 'BODY', 'slot-body', '👕');
        
        // ⭐ [신규] 연금술사 전용 연금술 가방 UI 적용
        if (isAlchemist) {
            html += `<div class="doll-slot slot-main filled" style="top: 130px; left: 50%; transform: translateX(-160%); width: 50px; height: 50px; cursor:default; border-color:#ba68c8; box-shadow:0 0 10px rgba(186,104,200,0.5);">
                        <div class="slot-icon" style="filter:none; font-size:26px;">🧳</div>
                        <div class="slot-label" style="color:#ba68c8;">A.BAG</div>
                     </div>`;
            html += `<div class="doll-slot slot-off empty" style="top: 130px; left: 50%; transform: translateX(60%); width: 50px; height: 50px; cursor:not-allowed;"><div class="slot-icon" style="color:#f55;">🚫</div><div class="slot-label">LOCKED</div></div>`;
        } else {
            const mainData = hero.equipment.mainHand;
            const mainId = typeof mainData === 'object' && mainData !== null ? mainData.id : mainData;
            const mainItem = mainId ? this.game.itemData[mainId] : null;
            const isTwoHanded = mainItem && mainItem.hands === 2;

            html += this.renderDollSlot(hero, 'mainHand', 'MAIN', 'slot-main', '🗡️');
            
            if (isTwoHanded) {
                html += `<div class="doll-slot slot-off empty" style="top: 130px; left: 50%; transform: translateX(60%); width: 50px; height: 50px; cursor:not-allowed;"><div class="slot-icon" style="color:#f55;">🚫</div><div class="slot-label">2H</div></div>`;
            } else {
                html += this.renderDollSlot(hero, 'offHand', 'SUB', 'slot-off', '🛡️');
            }
        }

        html += this.renderDollSlot(hero, 'legs', 'LEGS', 'slot-legs', '👢');
        html += this.renderDollSlot(hero, 'ring', 'RING', 'slot-ring', '💍');

        // ⭐ [신규] 동적 포켓 슬롯 UI 렌더링 (최대 8칸 대응, 미해금 슬롯은 자물쇠 표시)
        const maxPockets = this.getMaxPockets(hero);
        html += `<div class="pocket-container">`;
        for (let i = 1; i <= 8; i++) {
            if (i <= maxPockets) {
                html += this.renderDollSlot(hero, `pocket${i}`, `P${i}`, 'slot-pocket', '🎒');
            } else {
                html += `<div class="doll-slot slot-pocket empty" style="position:relative !important; width:40px !important; height:40px !important; margin:0 !important; cursor:not-allowed; opacity:0.2;">
                            <div class="slot-icon" style="color:#555;">🔒</div>
                         </div>`;
            }
        }
        html += `</div></div>`; 

        container.innerHTML = html;
    }

    renderDollSlot(hero, slotKey, label, cssClass, placeholderIcon) {
        // ⭐ [신규] 중첩 아이템 오브젝트 추출
        const eqData = hero.equipment[slotKey];
        const itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
        const count = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : 1;
        
        const item = itemId ? this.game.itemData[itemId] : null; 
        const isFilled = !!item;
        
        const tooltipEvent = isFilled 
            ? `onmouseenter="if(window.game) window.game.townSystem.showItemTooltip(event, '${itemId}')" 
               onmouseleave="if(window.game) window.game.townSystem.hideTooltip()" 
               onmousemove="if(window.game) window.game.townSystem.moveTooltip(event)"` 
            : '';
        const clickEvent = isFilled 
            ? `onclick="if(window.game) window.game.heroManager.unequipItem(${this.selectedHeroIdx}, '${slotKey}')"` 
            : '';

        // ⭐ [신규] 중첩 배지 (Badge) 표시
        const badgeHtml = count > 1 ? `<div style="position:absolute; bottom:-4px; right:-4px; background:#f00; color:#fff; font-size:10px; font-weight:bold; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border:1px solid #fff; z-index:30; pointer-events:none;">${count}</div>` : '';

        return `
            <div class="doll-slot ${cssClass} ${isFilled ? 'filled' : 'empty'}" 
                 ${tooltipEvent} ${clickEvent}
                 ondragover="if(window.game) window.game.heroManager.handleDragOver(event)"
                 ondrop="if(window.game) window.game.heroManager.handleDrop(event, '${slotKey}')">
                <div class="slot-icon">${item ? item.icon : placeholderIcon}</div>
                <div class="slot-label">${label}</div>
                ${badgeHtml}
            </div>
        `;
    }

    renderInventoryPanel(hero) {
        const container = document.getElementById('manage-inventory');
        if (!container) return;

        container.innerHTML = ``;
        const gridEl = document.createElement('div');
        gridEl.style.cssText = `display:grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap:6px;`;
        container.appendChild(gridEl);
        
        const inventory = this.game.gameState.inventory; 

        for(let i=0; i<20; i++) {
            // ⭐ [신규] 중첩 오브젝트 지원 추출
            const invData = inventory[i];
            const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
            const count = typeof invData === 'object' && invData !== null ? (invData.count || 1) : 1;
            
            const item = itemId ? this.game.itemData[itemId] : null;
            
            let canEquip = false;
            if (hero && item) {
                const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');
                canEquip = (!item.jobs || item.jobs.length === 0) || item.jobs.includes(hero.classKey);
                if (isAlchemist && typeof itemId === 'string' && itemId.startsWith('MAT_')) canEquip = true;
            }

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                aspect-ratio: 1/1; background: ${item ? 'linear-gradient(135deg, #222, #111)' : 'rgba(0,0,0,0.3)'}; border: 1px solid ${item ? (canEquip ? '#555' : '#422') : '#222'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: ${item ? 'grab' : 'default'}; opacity: ${item ? (canEquip ? 1 : 0.4) : 1}; position: relative; transition: 0.2s; box-sizing:border-box; ${item && !canEquip ? 'border-style:dashed;' : ''}
            `;

            if (item) {
                // ⭐ [신규] 중첩 배지 렌더링
                const badgeHtml = count > 1 ? `<div style="position:absolute; bottom:2px; right:2px; background:#f00; color:#fff; font-size:10px; font-weight:bold; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border:1px solid #fff; z-index:10; pointer-events:none;">${count}</div>` : '';
                
                itemDiv.innerHTML = `<div style="font-size:24px; pointer-events:none; filter:drop-shadow(0 2px 2px black);">${item.icon}</div>${badgeHtml}`;
                itemDiv.setAttribute('draggable', true);
                itemDiv.ondragstart = (e) => { if(window.game) window.game.heroManager.handleDragStart(e, i); };
                itemDiv.onmouseenter = (e) => { if(window.game) window.game.townSystem.showItemTooltip(e, itemId); }; // 툴팁엔 string id 전달
                itemDiv.onmouseleave = () => { if(window.game) window.game.townSystem.hideTooltip(); };
                itemDiv.onmousemove = (e) => { if(window.game) window.game.townSystem.moveTooltip(e); };

                itemDiv.onclick = () => {
                    if (this.selectedHeroIdx !== null) this.equipItem(this.selectedHeroIdx, i);
                    else alert("장착할 영웅을 먼저 선택해주세요.");
                };
                itemDiv.onmouseover = () => { itemDiv.style.borderColor = '#c5a059'; itemDiv.style.filter = 'brightness(1.2)'; };
                itemDiv.onmouseout = () => { itemDiv.style.borderColor = canEquip ? '#555' : '#422'; itemDiv.style.filter = 'none'; };
            }
            gridEl.appendChild(itemDiv);
        }
    }

    renderStatsPanel(hero) {
        const container = document.getElementById('manage-stats');

        const hpPct = (hero.curHp / hero.hp) * 100;
        const mpPct = (hero.curMp / hero.mp) * 100;
        const expReq = Formulas.EXP_REQ(hero.level) || 100;
        const xpPct = Math.min(100, ((hero.xp || 0) / expReq) * 100);

        const barsHtml = `
            <div class="stat-section">
                <div class="sleek-bar-row">
                    <span class="sleek-bar-label" style="color:#f55;">HP</span>
                    <div class="sleek-bar-bg"><div class="sleek-bar-fill" style="width:${hpPct}%; background:linear-gradient(90deg, #a00, #f44);"></div></div>
                    <span class="sleek-bar-text">${Math.floor(hero.curHp)} / ${hero.hp}</span>
                </div>
                <div class="sleek-bar-row">
                    <span class="sleek-bar-label" style="color:#0cf;">MP</span>
                    <div class="sleek-bar-bg"><div class="sleek-bar-fill" style="width:${mpPct}%; background:linear-gradient(90deg, #05a, #0cf);"></div></div>
                    <span class="sleek-bar-text">${Math.floor(hero.curMp)} / ${hero.mp}</span>
                </div>
                <div class="sleek-bar-row">
                    <span class="sleek-bar-label" style="color:#aaa;">XP</span>
                    <div class="sleek-bar-bg"><div class="sleek-bar-fill" style="width:${xpPct}%; background:linear-gradient(90deg, #444, #aaa);"></div></div>
                    <span class="sleek-bar-text">${Math.floor(hero.xp || 0)} / ${expReq}</span>
                </div>
            </div>`;

        const statsHtml = `
            <div class="stat-section">
                <div class="stat-section-title">
                    <span>BASIC STATS</span>
                    <span class="pt-badge ${hero.statPoints > 0 ? 'has-pt' : ''}">PT: ${hero.statPoints}</span>
                </div>
                <div class="stat-grid-modern">
                    ${['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].map(key => {
                        const d = this.getStatDetail(hero, key);
                        return `
                        <div class="stat-row-modern" onmouseenter="if(window.game) window.game.heroManager.previewStatImpact('${key}')" onmouseleave="if(window.game) window.game.heroManager.clearStatPreview()">
                            <span class="stat-name">${key.toUpperCase()}</span>
                            <div class="stat-val-area">
                                ${d.base}${d.bonus > 0 ? `<span class="stat-bonus">+${d.bonus}</span>` : ''}
                            </div>
                            ${hero.statPoints > 0 ? `<div class="stat-add-btn" onclick="window.game.heroManager.allocateManageStat('${key}')">+</div>` : '<div style="width:26px; flex-shrink:0;"></div>'}
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="stat-section" style="margin-bottom:0;">
                <div class="stat-section-title">COMBAT POWER</div>
                <div class="stat-grid-modern">
                    ${[
                        { id: 'atk_phys', label: 'ATK(P)', key: 'atk_phys', color: '#f88' },
                        { id: 'atk_mag',  label: 'ATK(M)', key: 'atk_mag',  color: '#8af' },
                        { id: 'def',      label: 'DEF',    key: 'def',      color: '#aaa' },
                        { id: 'res',      label: 'RES',    key: 'res',      color: '#a8f' },
                        { id: 'hit_phys', label: 'HIT',    key: 'hit_phys', color: '#fd8' },
                        { id: 'crit',     label: 'CRIT',   key: 'crit',     color: '#fa5' },
                        { id: 'eva',      label: 'EVA',    key: 'eva',      color: '#8f8' },
                        { id: 'spd',      label: 'SPD',    key: 'spd',      color: '#5fd' }
                    ].map(stat => `
                        <div class="stat-row-modern" id="c-stat-${stat.id}" style="background:rgba(0,0,0,0.3); border-color:#1a1a1a;">
                            <span class="stat-name" style="color:${stat.color};">${stat.label}</span>
                            <span class="stat-preview-arrow" style="width:20px; text-align:center; color:#0f0; font-size:10px; flex-shrink:0;"></span> 
                            <div class="stat-val-area">${Formulas.getDerivedStat(hero, stat.key, true)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        let wpHtml = `<div class="stat-section" style="margin-top:12px; margin-bottom:0;">
            <div class="stat-section-title" style="color:#0f0;">WEAPON PROFICIENCY</div>
            <div style="display:flex; flex-direction:column; gap:8px;">`;
        
        const wpMap = { SWORD:'검', BOW:'활', STAFF:'지팡이', MACE:'둔기', DAGGER:'단검', FIST:'격투', INST:'악기', FAN:'부채', SHIELD:'방패' };
        let hasWp = false;
        
        if (hero.wp) {
            for (let wType in hero.wp) {
                let wpData = hero.wp[wType];
                if (wpData.xp > 0 || wpData.level > 1) {
                    hasWp = true;
                    const wName = wpMap[wType] || wType;
                    const wpReq = Formulas.WEAPON_WP_REQ[wpData.level] || 1;
                    const wpPct = Math.min(100, (wpData.xp / wpReq) * 100);
                    const isWpMax = wpData.level >= 4;
                    const text = isWpMax ? 'MAX' : `${Math.floor(wpData.xp)} / ${wpReq}`;
                    
                    wpHtml += `
                        <div class="sleek-bar-row" style="margin-bottom:0;">
                            <span class="sleek-bar-label" style="color:#ccc; font-size:10px; width:45px; font-family:'Noto Sans KR';">${wName}</span>
                            <span style="color:#fff; font-size:10px; font-weight:bold; margin-right:5px; width:25px;">Lv.${wpData.level}</span>
                            <div class="sleek-bar-bg" style="flex:1; height:4px;"><div class="sleek-bar-fill" style="width:${isWpMax?100:wpPct}%; background:linear-gradient(90deg, #050, #0f0);"></div></div>
                            <span class="sleek-bar-text" style="width:45px; font-size:9px;">${text}</span>
                        </div>
                    `;
                }
            }
        }
        if (!hasWp) {
            wpHtml += `<div style="text-align:center; color:#666; font-size:11px; padding:10px 0;">무기 숙련도 기록 없음</div>`;
        }
        wpHtml += `</div></div>`;

        container.innerHTML = barsHtml + statsHtml + wpHtml;
    }

    changeSelectedHero(idx) {
        this.selectedHeroIdx = idx;
        this.renderUI();
    }

    unequipItem(heroIdx, slotKey) {
        const hero = this.game.gameState.heroes[heroIdx];
        const eqData = hero.equipment[slotKey];
        if (!eqData) return;

        const usedSlots = this.game.gameState.inventory.filter(data => data !== null).length;
        if (usedSlots >= 20) {
            this.game.showAlert("인벤토리가 가득 찼습니다!"); return;
        }

        const emptyIdx = this.game.gameState.inventory.findIndex(data => data === null);
        if (emptyIdx !== -1) {
            this.game.gameState.inventory[emptyIdx] = eqData;
        } else {
            this.game.gameState.inventory.push(eqData);
        }
        
        hero.equipment[slotKey] = null;
        this.game.saveGame();
        this.renderUI();
    }
    
    equipItem(heroIdx, invIdx) {
        const hero = this.game.gameState.heroes[heroIdx];
        
        // ⭐ [신규] 오브젝트(중첩)와 텍스트(구버전) 하위 호환 추출
        const invData = this.game.gameState.inventory[invIdx];
        const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
        const invCount = typeof invData === 'object' && invData !== null ? (invData.count || 1) : 1;
        
        const item = this.game.itemData[itemId];
        if (!item) return;

        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        if (item.jobs && item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
            this.game.showAlert("이 직업은 착용할 수 없습니다."); return;
        }

        let targetSlot = null;
        let itemsToUnequip = [];

        if (item.type === 'WEAPON') {
            if (isAlchemist) { this.game.showAlert("연금술사는 무기를 장착할 수 없습니다."); return; }
            targetSlot = 'mainHand'; 
            if (item.hands === 2 && hero.equipment.offHand) itemsToUnequip.push('offHand'); 
        } else if (item.type === 'SHIELD') {
            if (isAlchemist) { this.game.showAlert("연금술사는 방패를 장착할 수 없습니다."); return; }
            targetSlot = 'offHand'; 
            if (hero.equipment.mainHand) { 
                const mData = hero.equipment.mainHand;
                const mId = typeof mData === 'object' && mData !== null ? mData.id : mData;
                const mainItem = this.game.itemData[mId]; 
                if (mainItem && mainItem.hands === 2) itemsToUnequip.push('mainHand'); 
            }
        } else if (item.type === 'HEAD') targetSlot = 'head';
        else if (item.type === 'BODY') targetSlot = 'body';
        else if (item.type === 'LEGS') targetSlot = 'legs';
        else if (item.type === 'NECK') targetSlot = 'neck';
        else if (item.type === 'ACC') {
            if (item.subType === 'RING') targetSlot = 'ring'; else if (item.subType === 'NECK') targetSlot = 'neck'; 
        } else if (item.type === 'CONSUME' || (isAlchemist && typeof itemId === 'string' && itemId.startsWith('MAT_'))) {
            const maxP = this.getMaxPockets(hero);
            
            // ⭐ [신규] 연금술사 전용 - 빈칸보다 기존 중첩 가능한 포켓을 먼저 탐색
            if (isAlchemist) {
                for (let i = 1; i <= maxP; i++) {
                    const eqData = hero.equipment[`pocket${i}`];
                    const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
                    const eqCount = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : (eqData ? 1 : 0);
                    if (eqId === itemId && eqCount < 3) {
                        targetSlot = `pocket${i}`;
                        break;
                    }
                }
            }
            
            // 빈 슬롯 찾기
            if (!targetSlot) {
                for (let i = 1; i <= maxP; i++) { 
                    if (!hero.equipment[`pocket${i}`]) { targetSlot = `pocket${i}`; break; } 
                }
            }
            
            if (!targetSlot) {
                this.game.showAlert("포켓 슬롯이 가득 찼습니다."); return;
            }
        } else {
            console.error("Unknown Type"); return;
        }

        // ⭐ [신규] 소비 아이템 자동 장착 시 중첩 로직 직접 실행
        if (targetSlot.startsWith('pocket') && isAlchemist && (item.type === 'CONSUME' || (typeof itemId === 'string' && itemId.startsWith('MAT_')))) {
            const eqData = hero.equipment[targetSlot];
            const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            const eqCount = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : (eqData ? 1 : 0);
            
            if (eqId === itemId && eqCount < 3) {
                const spaceLeft = 3 - eqCount;
                const transferCount = Math.min(spaceLeft, invCount);
                hero.equipment[targetSlot] = { id: itemId, count: eqCount + transferCount };
                
                if (invCount > transferCount) {
                    this.game.gameState.inventory[invIdx] = { id: itemId, count: invCount - transferCount };
                } else {
                    this.game.gameState.inventory.splice(invIdx, 1);
                }
                this.game.saveGame();
                this.renderUI();
                return;
            }
        }

        if (hero.equipment[targetSlot]) itemsToUnequip.push(targetSlot);

        itemsToUnequip.forEach(slot => {
            if (hero.equipment[slot]) {
                this.game.gameState.inventory.push(hero.equipment[slot]);
                hero.equipment[slot] = null;
            }
        });

        // 오브젝트 자체(중첩 카운트 포함) 장착
        hero.equipment[targetSlot] = invData;
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
        
        Object.values(hero.equipment).forEach(eqData => {
            // ⭐ [신규] 중첩 오브젝트 지원 추출
            const itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            
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
            this.game.showAlert(`포인트가 부족합니다! (필요: ${cost} PT)`); return;
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

    clearStatPreview() {
        document.querySelectorAll('.stat-preview-arrow').forEach(el => {
            el.textContent = ''; 
        });
    }
}