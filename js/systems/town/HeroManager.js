import { ITEM_DATA, STAT_NAMES, JOB_CLASS_DATA } from '../../data/index.js';
import { PORTRAIT_DATA } from '../../data/portraits.js';
import * as Formulas from '../../utils/formulas.js';

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

    getMaxPockets(hero) {
        if (!hero) return 4;
        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');
        if (isAlchemist) {
            let hasExpanded = false;
            if (hero.skills) {
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
        
        const invData = this.game.gameState.inventory[invIdx];
        const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
        const invCount = typeof invData === 'object' && invData !== null ? (invData.count || 1) : 1;
        
        const item = this.game.itemData[itemId];
        if (!item) return;

        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        if (item.jobs && item.jobs.length > 0 && !item.jobs.includes(hero.classKey)) {
            this.game.showAlert("이 직업은 착용할 수 없습니다."); return;
        }

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
                if (!(isAlchemist && targetSlot.startsWith('pocket') && typeof itemId === 'string' && itemId.startsWith('MAT_'))) {
                    return;
                }
            }
        }

        if (targetSlot.startsWith('pocket')) {
            const pNum = parseInt(targetSlot.replace('pocket', ''));
            if (pNum > this.getMaxPockets(hero)) {
                this.game.showAlert("해당 포켓 슬롯은 잠겨 있습니다."); return;
            }
            
            const eqData = hero.equipment[targetSlot];
            const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            const eqCount = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : (eqData ? 1 : 0);

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

        hero.equipment[targetSlot] = invData; 
        this.game.gameState.inventory.splice(invIdx, 1);
        this.game.saveGame();
        this.renderUI();
    }

    openUI() {
        if (!window.game) return;

        let modal = document.getElementById('hero-ui-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'hero-ui-modal';
            modal.className = 'modal hm-modal-overlay';
            const container = document.createElement('div');
            container.className = 'hero-ui-container';
            modal.appendChild(container);
            document.body.appendChild(modal);
        }

        const container = modal.querySelector('.hero-ui-container');
        if (container) {
            container.className = 'hero-ui-container luxury-modal-container';
            
            container.innerHTML = `
                <div class="hm-sub-header">
                    <h2 class="hm-main-title">🛡️ CHARACTER & EQUIPMENT</h2>
                    
                    <div class="hm-nav-group">
                        <button id="btn-hero-to-party" class="hm-nav-btn to-party">▶ PARTY MANAGEMENT</button>
                        <button id="btn-hero-to-skill" class="hm-nav-btn to-skill">▶ SKILL SETTINGS</button>
                    </div>

                    <button class="hm-close-btn" id="btn-hero-close">✖</button>
                </div>
                
                <div id="hero-ui-content" class="hm-ui-wrapper">
                    <div class="manage-container">
                        
                        <div class="manage-col hm-col-roster">
                            <div class="hm-col-header">CHARACTER</div>
                            <div id="manage-list" class="hm-scroll-box"></div>
                        </div>
                        
                        <div class="manage-col hm-col-stats">
                            <div class="hm-col-header">STATUS</div>
                            <div id="manage-stats" class="hm-scroll-box hm-stats-pad"></div>
                            <div class="hm-release-wrap">
                                <button class="hm-release-btn" onclick="window.game.heroManager.dismissHero(window.game.heroManager.selectedHeroIdx)">RELEASE HERO</button>
                            </div>
                        </div>

                        <div class="manage-col hm-col-equip">
                            <div class="hm-col-header">EQUIPMENT</div>
                            <div id="manage-visual" class="hm-scroll-box hm-center-box"></div>
                        </div>
                        
                        <div class="manage-col hm-col-inv">
                            <div class="hm-col-header">INVENTORY</div>
                            <div id="manage-inventory" class="hm-scroll-box"></div>
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
            document.getElementById('manage-stats').innerHTML = '<div class="hm-empty-msg">Select a Hero</div>';
        }
        this.renderInventoryPanel(hero); 
    }

    renderHeroList() {
        const listEl = document.getElementById('manage-list');
        if (!listEl) return;
        
        let html = '';
        html += `<div class="hm-list-divider">⚔️ ACTIVE PARTY</div>`;
        for (let i = 0; i < 6; i++) {
            const h = this.game.gameState.heroes[i];
            if (!h) continue;
            html += this._createHeroListItem(h, i);
        }

        const rosterHeroes = this.game.gameState.heroes.slice(6);
        if (rosterHeroes.length > 0) {
            html += `<div class="hm-list-divider reserve">🏕️ RESERVE ROSTER</div>`;
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

        const portraitSrc = PORTRAIT_DATA[h.classKey || h.key];
        const iconHtml = portraitSrc 
            ? `<img src="${portraitSrc}" class="hm-list-img" />`
            : h.icon;

        return `
            <div class="hm-list-item ${isSelected ? 'selected' : ''}" onclick="window.game.heroManager.changeSelectedHero(${idx})">
                <div class="hm-list-icon">${iconHtml}</div>
                <div class="hm-list-info">
                    <div class="hm-list-name">${h.name} <span class="hm-list-lv">Lv.${h.level}</span></div>
                    <div class="hm-list-class">${classStr}</div>
                </div>
                <div class="hm-list-arrow">${isSelected ? '◀' : ''}</div>
            </div>
        `;
    }

    renderEquipmentPanel(hero) {
        const container = document.getElementById('manage-visual');
        if (!container) return;

        const jp = hero.jpAvailable || 0;
        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        let jobName = hero.job || '견습생';
        let classNameEn = hero.classKey;
        let classNameKr = '';
        
        if (typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === hero.classKey && c.classLevel === (hero.classLevel || 1)) 
                       || Object.values(JOB_CLASS_DATA).find(c => c.jobKey === hero.classKey);
            if (cInfo) {
                jobName = cInfo.jobName || jobName;
                classNameEn = cInfo.classNameEn;
                classNameKr = `(${cInfo.className})`;
            }
        }

        const portraitSrc = PORTRAIT_DATA[hero.classKey || hero.key];
        const iconHtml = portraitSrc 
            ? `<img src="${portraitSrc}" class="hm-equip-img" />`
            : `<div class="hm-equip-fallback">${hero.icon}</div>`;

        let html = `
            <div class="hm-equip-portrait-wrap">${iconHtml}</div>
            
            <div class="hm-equip-name">${hero.name}</div>
            <div class="hm-equip-lv">Lv.${hero.level} ${jobName}</div>
            <div class="hm-equip-class-en">Class ${hero.classLevel || 1}: ${classNameEn}</div>
            ${classNameKr ? `<div class="hm-equip-class-kr">${classNameKr}</div>` : ''}
            
            <div class="hm-equip-jp-wrap">
                <div class="hm-equip-jp">💎 가용 JP : ${jp}</div>
            </div>
            
            <div class="hm-paper-doll">
        `;
        html += this.renderDollSlot(hero, 'head', 'HEAD', 'slot-head', '🧢');
        html += this.renderDollSlot(hero, 'neck', 'NECK', 'slot-neck', '📿');
        html += this.renderDollSlot(hero, 'body', 'BODY', 'slot-body', '👕');
        
        if (isAlchemist) {
            html += `<div class="hm-doll-slot slot-main filled alchemist-bag">
                        <div class="hm-slot-icon">🧳</div>
                        <div class="hm-slot-label">A.BAG</div>
                     </div>`;
            html += `<div class="hm-doll-slot slot-off empty locked">
                        <div class="hm-slot-icon">🚫</div>
                        <div class="hm-slot-label">LOCKED</div>
                     </div>`;
        } else {
            const mainData = hero.equipment.mainHand;
            const mainId = typeof mainData === 'object' && mainData !== null ? mainData.id : mainData;
            const mainItem = mainId ? this.game.itemData[mainId] : null;
            const isTwoHanded = mainItem && mainItem.hands === 2;

            html += this.renderDollSlot(hero, 'mainHand', 'MAIN', 'slot-main', '🗡️');
            
            if (isTwoHanded) {
                html += `<div class="hm-doll-slot slot-off empty locked">
                            <div class="hm-slot-icon">🚫</div>
                            <div class="hm-slot-label">2H</div>
                         </div>`;
            } else {
                html += this.renderDollSlot(hero, 'offHand', 'SUB', 'slot-off', '🛡️');
            }
        }

        html += this.renderDollSlot(hero, 'legs', 'LEGS', 'slot-legs', '👢');
        html += this.renderDollSlot(hero, 'ring', 'RING', 'slot-ring', '💍');

        const maxPockets = this.getMaxPockets(hero);
        html += `<div class="hm-pocket-container">`;
        for (let i = 1; i <= 8; i++) {
            if (i <= maxPockets) {
                html += this.renderDollSlot(hero, `pocket${i}`, `P${i}`, 'slot-pocket', '🎒');
            } else {
                html += `<div class="hm-doll-slot slot-pocket empty locked-pocket">
                            <div class="hm-slot-icon">🔒</div>
                         </div>`;
            }
        }
        html += `</div></div>`; 

        container.innerHTML = html;
    }

    renderDollSlot(hero, slotKey, label, cssClass, placeholderIcon) {
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

        const badgeHtml = count > 1 ? `<div class="hm-stack-badge">${count}</div>` : '';

        return `
            <div class="hm-doll-slot ${cssClass} ${isFilled ? 'filled' : 'empty'}" 
                 ${tooltipEvent} ${clickEvent}
                 ondragover="if(window.game) window.game.heroManager.handleDragOver(event)"
                 ondrop="if(window.game) window.game.heroManager.handleDrop(event, '${slotKey}')">
                <div class="hm-slot-icon">${item ? item.icon : placeholderIcon}</div>
                <div class="hm-slot-label">${label}</div>
                ${badgeHtml}
            </div>
        `;
    }

    renderInventoryPanel(hero) {
        const container = document.getElementById('manage-inventory');
        if (!container) return;

        container.innerHTML = ``;
        const gridEl = document.createElement('div');
        gridEl.className = 'hm-inventory-grid';
        container.appendChild(gridEl);
        
        const inventory = this.game.gameState.inventory; 

        for(let i=0; i<20; i++) {
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
            itemDiv.className = `hm-inv-slot ${item ? 'has-item' : 'empty-slot'} ${item && !canEquip ? 'cannot-equip' : ''}`;

            if (item) {
                const badgeHtml = count > 1 ? `<div class="hm-stack-badge">${count}</div>` : '';
                
                itemDiv.innerHTML = `<div class="hm-inv-icon">${item.icon}</div>${badgeHtml}`;
                itemDiv.setAttribute('draggable', true);
                itemDiv.ondragstart = (e) => { if(window.game) window.game.heroManager.handleDragStart(e, i); };
                itemDiv.onmouseenter = (e) => { if(window.game) window.game.townSystem.showItemTooltip(e, itemId); }; 
                itemDiv.onmouseleave = () => { if(window.game) window.game.townSystem.hideTooltip(); };
                itemDiv.onmousemove = (e) => { if(window.game) window.game.townSystem.moveTooltip(e); };

                itemDiv.onclick = () => {
                    if (this.selectedHeroIdx !== null) this.equipItem(this.selectedHeroIdx, i);
                    else alert("장착할 영웅을 먼저 선택해주세요.");
                };
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
            <div class="hm-stat-section">
                <div class="hm-bar-row">
                    <span class="hm-bar-label lbl-hp">HP</span>
                    <div class="hm-bar-bg"><div class="hm-bar-fill fill-hp" style="width:${hpPct}%;"></div></div>
                    <span class="hm-bar-text">${Math.floor(hero.curHp)} / ${hero.hp}</span>
                </div>
                <div class="hm-bar-row">
                    <span class="hm-bar-label lbl-mp">MP</span>
                    <div class="hm-bar-bg"><div class="hm-bar-fill fill-mp" style="width:${mpPct}%;"></div></div>
                    <span class="hm-bar-text">${Math.floor(hero.curMp)} / ${hero.mp}</span>
                </div>
                <div class="hm-bar-row">
                    <span class="hm-bar-label lbl-xp">XP</span>
                    <div class="hm-bar-bg"><div class="hm-bar-fill fill-xp" style="width:${xpPct}%;"></div></div>
                    <span class="hm-bar-text">${Math.floor(hero.xp || 0)} / ${expReq}</span>
                </div>
            </div>`;

        const statsHtml = `
            <div class="hm-stat-section">
                <div class="hm-stat-title">
                    <span>BASIC STATS</span>
                </div>
                <div class="hm-stat-grid">
                    ${['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].map(key => {
                        const d = this.getStatDetail(hero, key);
                        return `
                        <div class="hm-stat-row">
                            <span class="hm-stat-name">${key.toUpperCase()}</span>
                            <div class="hm-stat-val">
                                ${d.base}${d.bonus > 0 ? `<span class="hm-stat-bonus">+${d.bonus}</span>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="hm-stat-section no-margin">
                <div class="hm-stat-title">COMBAT POWER</div>
                <div class="hm-stat-grid combat-grid">
                    ${[
                        { id: 'atk_phys', label: 'ATK(P)', key: 'atk_phys', cls: 'c-atk' },
                        { id: 'atk_mag',  label: 'ATK(M)', key: 'atk_mag',  cls: 'c-mag' },
                        { id: 'def',      label: 'DEF',    key: 'def',      cls: 'c-def' },
                        { id: 'res',      label: 'RES',    key: 'res',      cls: 'c-res' },
                        { id: 'hit_phys', label: 'HIT',    key: 'hit_phys', cls: 'c-hit' },
                        { id: 'crit',     label: 'CRIT',   key: 'crit',     cls: 'c-crit' },
                        { id: 'eva',      label: 'EVA',    key: 'eva',      cls: 'c-eva' },
                        { id: 'spd',      label: 'SPD',    key: 'spd',      cls: 'c-spd' }
                    ].map(stat => `
                        <div class="hm-stat-row combat-row" id="c-stat-${stat.id}">
                            <span class="hm-stat-name ${stat.cls}">${stat.label}</span>
                            <div class="hm-stat-val">${Formulas.getDerivedStat(hero, stat.key, true)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        let wpHtml = `<div class="hm-stat-section wp-section">
            <div class="hm-stat-title wp-title">WEAPON PROFICIENCY</div>
            <div class="hm-wp-list">`;
        
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
                        <div class="hm-wp-row">
                            <span class="hm-wp-name">${wName}</span>
                            <span class="hm-wp-lv">Lv.${wpData.level}</span>
                            <div class="hm-bar-bg wp-bg"><div class="hm-bar-fill wp-fill" style="width:${isWpMax?100:wpPct}%;"></div></div>
                            <span class="hm-wp-text">${text}</span>
                        </div>
                    `;
                }
            }
        }
        if (!hasWp) {
            wpHtml += `<div class="hm-wp-empty">무기 숙련도 기록 없음</div>`;
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
}