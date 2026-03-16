import { ITEM_DATA, STAT_NAMES, CLASS_DATA, SKILL_DATABASE } from '../../data/index.js'; 
import { PORTRAIT_DATA } from '../../data/portraits.js';
import { STANDING_DATA } from '../../data/standing.js'; 
import * as Formulas from '../../utils/formulas.js';

export class HeroManager {
    constructor(gameApp) {
        this.game = gameApp;
        this.selectedHeroIdx = 0;
        this.expandedSlotIdx = null; 
        this.expandedCatGridIdx = null; 
        
        // 바탕 클릭 시 드롭다운(오버레이) 자동 닫기 기능
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('hero-ui-modal');
            if (modal && modal.style.display === 'flex') {
                let needRender = false;
                
                // 장착 슬롯 드롭다운 밖을 클릭했을 경우 닫기
                if (this.expandedSlotIdx !== null && !e.target.closest('.slot-dropdown-wrapper')) {
                    this.expandedSlotIdx = null;
                    needRender = true;
                }
                
                // 범주 스킬 확장 그리드 밖을 클릭했을 경우 닫기
                if (this.expandedCatGridIdx !== null && !e.target.closest('.cat-grid-wrapper')) {
                    this.expandedCatGridIdx = null;
                    needRender = true;
                }

                if (needRender) this.renderUI();
            }
        });
    }

    _getClassString(h) {
        let jobKeyStr = h.classKey || h.key || 'Unknown';
        
        // ⭐ CLASS_DATA로 변경하고, 내부 순회 대신 다이렉트로 키값을 찾습니다.
        if (typeof CLASS_DATA !== 'undefined') {
            const cInfo = CLASS_DATA[h.classKey] || CLASS_DATA[h.key];
            // 데이터에 직업명(jobName)이 따로 없으므로, 키값 자체(KNIGHT)를 그대로 씁니다.
            if (cInfo) jobKeyStr = h.classKey || h.key; 
        }
        
        const formattedJobName = jobKeyStr.split(/[_ ]+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        return `${formattedJobName} (Class ${h.classLevel || 1})`;
    }

    getMaxPockets(hero) {
        if (!hero) return 4;
        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');
        if (isAlchemist) {
            let hasExpanded = false;
            if (hero.skills) {
                const equippedIds = hero.equippedSkills || [];
                const activeSkills = hero.skills.filter(s => equippedIds.includes(s.id) || (s.category && equippedIds.includes(`CAT_${s.category}`)));
                hasExpanded = activeSkills.some(s => s.name === 'Expanded Pocket' || s.name === '확장 포켓' || (s.effects && s.effects.some(e => e.type === 'EXPANDED_POCKET')));
            }
            return hasExpanded ? 8 : 6;
        }
        return 4; 
    }

    showSkillTooltip(e, skillId, isLearned = true) {
        if (!skillId) return;
        const hero = this.game.gameState.heroes[this.selectedHeroIdx];
        
        let name = '';
        let descHtml = '';
        
        if (skillId.startsWith('CAT_')) {
            const catName = skillId.replace('CAT_', '');
            name = `[세트] ${catName}`;
            
            const learnedInCat = (hero.skills || []).filter(s => s.category === catName);
            
            if (learnedInCat.length > 0) {
                descHtml = `<div style="margin-bottom:10px; color:#d4bc96; font-size:12px; font-weight:bold;">이 범주를 장착하면 아래 스킬들을 사용할 수 있습니다.</div>`;
                descHtml += `<div style="display:flex; flex-direction:column; gap:5px;">`;
                learnedInCat.forEach(s => {
                    const spData = (hero.sp && hero.sp[s.id]) ? hero.sp[s.id].level : 1;
                    descHtml += `
                        <div style="font-size:13px; display:flex; align-items:center; margin-bottom: 2px;">
                            <span style="margin-right:6px; font-size:12px; color:#55ff55;">✔️</span> 
                            <span style="color:#ffd700; font-weight:bold;">${s.name}</span> 
                            <span style="color:#aaaaaa; font-size:11px; margin-left:6px;">(Lv.${spData})</span>
                        </div>
                    `;
                });
                descHtml += `</div>`;
            } else {
                descHtml = `<div style="color:#aaa; font-size:13px;">이 범주에서 습득한 스킬이 아직 없습니다.</div>`;
            }
        } else {
            let skill = (hero.skills || []).find(s => s.id === skillId);
            if (!skill && typeof SKILL_DATABASE !== 'undefined') {
                skill = SKILL_DATABASE[skillId]; 
            }
            if (!skill) return;
            
            name = skill.name;
            descHtml = `<div style="color:#ebd9b4; font-size:13px; line-height:1.5;">${skill.desc || '설명이 없습니다.'}</div>`;
            
            if (!isLearned) {
                descHtml += `<div style="color:#ff5555; font-size:12px; margin-top:8px; font-weight:bold;">[미습득 스킬]</div>`;
            }
        }

        let tooltip = document.getElementById('global-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'global-tooltip';
            document.body.appendChild(tooltip);
        }
        
        tooltip.style.cssText = 'position:fixed; z-index:9999999 !important; background:rgba(28,20,13,0.98); border:2px solid #b8860b; padding:15px; border-radius:2px; max-width:320px; pointer-events:none; box-shadow:4px 6px 15px rgba(0,0,0,0.8); display:block; font-family:var(--font-main);';
        
        tooltip.innerHTML = `
            <div style="font-weight:bold; color:#ffd700; font-size:16px; margin-bottom:8px; border-bottom:1px solid #5d4037; padding-bottom:4px; font-family:var(--font-game);">
                ${name}
            </div>
            ${descHtml}
        `;
        this.moveSkillTooltip(e);
    }

    moveSkillTooltip(e) {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip && tooltip.style.display === 'block') {
            let x = e.clientX + 15;
            let y = e.clientY + 15;
            if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - 10;
            if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - 10;
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
    }

    hideSkillTooltip() {
        const tooltip = document.getElementById('global-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    showItemTooltipProxy(e, itemId) {
        if (window.game && window.game.townSystem) {
            window.game.townSystem.showItemTooltip(e, itemId);
            const tt = document.getElementById('global-tooltip');
            if (tt) tt.style.setProperty('z-index', '9999999', 'important');
        }
    }
    hideItemTooltipProxy() {
        if (window.game && window.game.townSystem) window.game.townSystem.hideTooltip();
    }
    moveItemTooltipProxy(e) {
        if (window.game && window.game.townSystem && window.game.townSystem.moveTooltip) window.game.townSystem.moveTooltip(e);
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

    // ⭐ [신규] 영웅이 특정 아이템을 장착할 수 있는지 판별하는 통합 함수
    canEquipItem(hero, item, targetSlot = null) {
        if (!item || !hero) return false;
        
        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        // 1. 연금술사 예외 처리 (무기/방패 불가, 특수 재료 포켓 허용)
        if (isAlchemist) {
            if (item.type === 'WEAPON' || item.type === 'SHIELD') return false;
            if (targetSlot && targetSlot.startsWith('pocket') && item.id.startsWith('MAT_')) return true;
        }

        // ⭐ [핵심 수정] 세이브 데이터 대신 무조건 최신 CLASS_DATA를 읽어오도록 강제!
        let heroWeapons = hero.EquipableWeapons;
        let heroArmor = hero.armorClass;
        
        if (typeof CLASS_DATA !== 'undefined') {
            // KNIGHT, WARRIOR 등 키값으로 바로 꽂아버립니다.
            const cInfo = CLASS_DATA[hero.classKey] || CLASS_DATA[hero.key]; 
            if (cInfo) {
                heroWeapons = cInfo.EquipableWeapons || heroWeapons;
                heroArmor = cInfo.armorClass || heroArmor;
            } else {
                console.warn("[Debug] CLASS_DATA에서 영웅을 찾을 수 없습니다:", hero.classKey);
            }
        }

        // 2. 무기 및 방패 (WEAPON, SHIELD) 장착 룰 판별
        if (item.type === 'WEAPON' || item.type === 'SHIELD') {
            if (!heroWeapons || heroWeapons === "NONE") return false;
            
            const equipableSubTypes = heroWeapons.split(',').map(s => s.trim().toUpperCase());
            if (!equipableSubTypes.includes(String(item.subType).toUpperCase())) {
                return false;
            }
            return true;
        }

        // 3. 방어구(HEAD, BODY, LEGS) 판별 (ArmorClass 룰 적용)
        if (['HEAD', 'BODY', 'LEGS'].includes(item.type)) {
            if (heroArmor && item.subType) {
                if (String(heroArmor).toUpperCase() !== String(item.subType).toUpperCase()) {
                    return false; // 갑옷 클래스가 다르면 장착 불가
                }
            }
        }

        // 4. 장신구(ACC) 및 기타 아이템 판별 (기존 Jobs 호환성 유지)
        if (item.jobs && item.jobs.length > 0) {
            if (!item.jobs.includes(hero.classKey) && !item.jobs.includes('ALL')) return false;
        }
        
        return true;
    }

    equipItemToSlot(heroIdx, invIdx, targetSlot) {
        const hero = this.game.gameState.heroes[heroIdx];
        const invData = this.game.gameState.inventory[invIdx];
        const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
        const invCount = typeof invData === 'object' && invData !== null ? (invData.count || 1) : 1;
        
        const item = this.game.itemData[itemId];
        if (!item) return;

        // ⭐ 장착 가능 여부 통합 검사
        if (!this.canEquipItem(hero, item, targetSlot)) {
            this.game.showAlert("이 직업은 착용할 수 없는 장비입니다."); 
            return;
        }

        const isAlchemist = (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사');

        // ⭐ 슬롯 매칭 검사 (쌍수 원천 차단)
        if (item.type === 'WEAPON') {
            if (targetSlot !== 'mainHand') {
                this.game.showAlert("무기는 주무기(RIGHT HAND) 칸에만 장착할 수 있습니다. (쌍수 불가)"); 
                return;
            }
        } else if (item.type === 'SHIELD') {
            if (targetSlot !== 'offHand') {
                this.game.showAlert("방패는 보조무기(LEFT HAND) 칸에만 장착할 수 있습니다."); 
                return;
            }
        } else if (item.type !== 'CONSUME' && item.type !== targetSlot.toUpperCase()) {            if (!(item.type === 'ACC' && (targetSlot === 'ring' || targetSlot === 'neck'))) {
                if (!(isAlchemist && targetSlot.startsWith('pocket') && typeof itemId === 'string' && itemId.startsWith('MAT_'))) return;
            }
        }

        // 포켓 아이템 중첩 및 제한 처리
        if (targetSlot.startsWith('pocket')) {
            const pNum = parseInt(targetSlot.replace('pocket', ''));
            if (pNum > this.getMaxPockets(hero)) {
                this.game.showAlert("해당 포켓 슬롯은 잠겨 있습니다."); return;
            }
            const eqData = hero.equipment[targetSlot];
            const eqId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            const eqCount = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : (eqData ? 1 : 0);

            if (isAlchemist && item.type === 'CONSUME' && eqId === itemId && eqCount < 3) {
                const spaceLeft = 3 - eqCount;
                const transferCount = Math.min(spaceLeft, invCount);
                hero.equipment[targetSlot] = { id: itemId, count: eqCount + transferCount };
                if (invCount > transferCount) this.game.gameState.inventory[invIdx] = { id: itemId, count: invCount - transferCount };
                else this.game.gameState.inventory.splice(invIdx, 1);
                this.game.saveGame(); this.renderUI(); return;
            }
        }

        // ⭐ 양손(2H) / 방패 / 겸용(1H&2H) 상호 배타성 해제 로직
        // 1. mainHand에 2H 무기를 낄 때 -> offHand(방패/보조무기)를 벗김
        if (targetSlot === 'mainHand' && item.hands === '2H' && hero.equipment.offHand) {
            this.unequipItem(heroIdx, 'offHand');
        }
        // 2. offHand에 무언가(방패 등)를 낄 때 -> mainHand에 2H 무기가 있다면 벗김
        if (targetSlot === 'offHand') {
            const mainData = hero.equipment.mainHand;
            const mainItemId = typeof mainData === 'object' && mainData !== null ? mainData.id : mainData;
            const mainItem = mainItemId ? this.game.itemData[mainItemId] : null;
            if (mainItem && mainItem.hands === '2H') {
                this.unequipItem(heroIdx, 'mainHand');
            }
        }

        if (hero.equipment[targetSlot]) this.unequipItem(heroIdx, targetSlot);

        hero.equipment[targetSlot] = invData; 
        this.game.gameState.inventory.splice(invIdx, 1);
        this.game.saveGame();
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
        if (emptyIdx !== -1) this.game.gameState.inventory[emptyIdx] = eqData;
        else this.game.gameState.inventory.push(eqData);
        
        hero.equipment[slotKey] = null;
        this.hideItemTooltipProxy();
        this.game.saveGame();
        this.renderUI();
    }
    
    equipItem(heroIdx, invIdx) {
        const hero = this.game.gameState.heroes[heroIdx];
        const invData = this.game.gameState.inventory[invIdx];
        const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
        
        const item = this.game.itemData[itemId];
        if (!item) return;

        // ⭐ 장착 가능 여부 통합 검사
        if (!this.canEquipItem(hero, item)) {
            this.game.showAlert("이 직업은 착용할 수 없는 장비입니다.");
            return;
        }

        let targetSlot = null;
        let itemsToUnequip = [];

        if (item.type === 'WEAPON') {
            targetSlot = 'mainHand'; 
            
            // 양손(2H) 무기 장착 시 보조무기(방패) 강제 해제
            if (item.hands === '2H' && hero.equipment.offHand) {
                itemsToUnequip.push('offHand'); 
            }
        } else if (item.type === 'SHIELD') {
            targetSlot = 'offHand'; 
            
            // 방패 장착 시 주무기가 양손(2H) 무기라면 주무기 강제 해제
            if (hero.equipment.mainHand) { 
                const mData = hero.equipment.mainHand;
                const mId = typeof mData === 'object' && mData !== null ? mData.id : mData;
                const mainItem = this.game.itemData[mId]; 
                if (mainItem && mainItem.hands === '2H') {
                    itemsToUnequip.push('mainHand'); 
                }
            }
        } else if (item.type === 'HEAD') targetSlot = 'head';
        else if (item.type === 'BODY') targetSlot = 'body';
        else if (item.type === 'LEGS') targetSlot = 'legs';
        else if (item.type === 'NECK') targetSlot = 'neck';
        else if (item.type === 'ACC') {
            // 💡 [수정] subType이 무조건 'ACC'이므로 빈 슬롯(ring -> neck)을 찾아 장착하도록 자동화
            if (!hero.equipment.ring) targetSlot = 'ring';
            else if (!hero.equipment.neck) targetSlot = 'neck';
            else targetSlot = 'ring'; // 둘 다 꽉 찼으면 첫 번째 악세사리 슬롯(ring) 교체
        } else if (item.type === 'CONSUME') {
            const maxP = this.getMaxPockets(hero);
            for (let i = 1; i <= maxP; i++) { 
                if (!hero.equipment[`pocket${i}`]) { targetSlot = `pocket${i}`; break; } 
            }
            if (!targetSlot) { this.game.showAlert("포켓 슬롯이 가득 찼습니다."); return; }
        } else {
            return;
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
        this.hideItemTooltipProxy();
        this.game.saveGame();
        this.renderUI();
    }

    openUI() {
        if (!window.game) return;

        let modal = document.getElementById('hero-ui-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'hero-ui-modal';
            document.body.appendChild(modal);
        }
        
        modal.style.cssText = `
            position: fixed !important; 
            top: 0 !important; left: 0 !important; 
            width: 100vw !important; height: 100vh !important; 
            background-color: #ebd9b4 !important; 
            background-image: url('data:image/svg+xml;utf8,<svg opacity="0.15" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.5"/></filter><rect width="100" height="100" filter="url(%23n)"/></svg>') !important;
            z-index: 100000 !important; 
            display: flex !important; 
            flex-direction: column !important;
            align-items: stretch !important; 
            justify-content: flex-start !important; 
            margin: 0 !important; padding: 0 !important;
        `;

        modal.innerHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; height: 80px; border-bottom: 4px double #5d4037; flex-shrink: 0; background: #d4bc96; box-sizing: border-box;">
                <h2 style="margin:0; font-family:'Cinzel', serif; font-size:36px; color:#3e2723; letter-spacing:4px; font-weight:bold; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);">CHARACTER MANAGEMENT</h2>
                <div style="display:flex; gap:15px;">
                    <button id="btn-hero-to-party" style="background:#f4ebd8; color:#3e2723; border:2px solid #5d4037; padding:10px 20px; font-family:'Cinzel', serif; font-size:14px; font-weight:bold; cursor:pointer; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); transition: 0.2s;" onmouseover="this.style.background='#fff'; this.style.borderColor='#8b0000'; this.style.color='#8b0000';" onmouseout="this.style.background='#f4ebd8'; this.style.borderColor='#5d4037'; this.style.color='#3e2723';">▶ PARTY</button>
                    <button id="btn-hero-to-skill" style="background:#f4ebd8; color:#3e2723; border:2px solid #5d4037; padding:10px 20px; font-family:'Cinzel', serif; font-size:14px; font-weight:bold; cursor:pointer; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); transition: 0.2s;" onmouseover="this.style.background='#fff'; this.style.borderColor='#8b0000'; this.style.color='#8b0000';" onmouseout="this.style.background='#f4ebd8'; this.style.borderColor='#5d4037'; this.style.color='#3e2723';">▶ SKILL</button>
                    <button id="btn-hero-close" style="background:#3e2723; color:#ebd9b4; border:2px solid #1a110a; padding:10px 40px; font-family:'Cinzel', serif; font-size:16px; font-weight:bold; cursor:pointer; box-shadow: 2px 4px 6px rgba(0,0,0,0.4); transition: background 0.2s;" onmouseover="this.style.background='#8b0000'" onmouseout="this.style.background='#3e2723'">BACK</button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 20px; flex: 1; overflow: hidden; height: calc(100vh - 80px); box-sizing: border-box; background: transparent;">
                
                <div style="display: flex; flex-direction: column; overflow: hidden; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                    <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">CHARACTER</div>
                    <div id="manage-list" style="flex:1; overflow-y:auto; padding:15px 10px; display:flex; flex-direction:column; gap:10px;"></div>
                </div>
                
                <div style="display: flex; flex-direction: column; overflow-y: auto; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                    <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">STATUS</div>
                    <div id="manage-stats" style="flex:1; display:flex; flex-direction:column; padding:20px;"></div>
                </div>

                <div style="display: flex; flex-direction: column; overflow: hidden; gap: 20px;">
                    <div style="background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; display:flex; flex-direction:column; box-shadow: inset 0 0 10px rgba(93,64,55,0.1); flex-shrink:0;">
                        <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">EQUIPMENT</div>
                        <div id="manage-equip" style="padding: 15px;"></div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; display:flex; flex-direction:column; flex:1; overflow:hidden; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                        <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">INVENTORY</div>
                        <div id="manage-inventory" style="flex:1; overflow:hidden; padding:15px; display:flex; flex-direction:column;"></div>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; overflow-y: auto; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                    <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">ACTION & SUPPORT SKILL</div>
                    <div id="manage-skills" style="flex:1; display:flex; flex-direction:column; padding:20px;"></div>
                </div>
            </div>
        `;

        const closeBtn = document.getElementById('btn-hero-close');
        if(closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        
        const toPartyBtn = document.getElementById('btn-hero-to-party');
        if(toPartyBtn) toPartyBtn.onclick = () => { modal.style.display = 'none'; if(this.game.partyManager) this.game.partyManager.openUI(); };
        
        const toSkillBtn = document.getElementById('btn-hero-to-skill');
        if(toSkillBtn) toSkillBtn.onclick = () => { modal.style.display = 'none'; if(this.game.skillManager) this.game.skillManager.openUI(); };
        
        modal.style.display = 'flex';
        this.expandedSlotIdx = null; 
        this.expandedCatGridIdx = null; 
        this.renderUI();
    }

    renderUI() {
        this.renderHeroList();
        const hero = (this.selectedHeroIdx !== null && this.selectedHeroIdx !== undefined) 
            ? this.game.gameState.heroes[this.selectedHeroIdx] 
            : null;

        if (hero) {
            if (!hero.equippedSkills || hero.equippedSkills.length !== 6) {
                hero.equippedSkills = [null, null, null, null, null, null];
            }
            this.renderStatsPanel(hero);
            this.renderEquipmentPanel(hero);
            this.renderSkillsPanel(hero);
        } else {
            document.getElementById('manage-stats').innerHTML = '<div style="text-align:center; padding:50px; color:#888; font-weight:bold;">캐릭터를 선택하세요.</div>';
            document.getElementById('manage-equip').innerHTML = '';
            document.getElementById('manage-skills').innerHTML = '';
        }
        this.renderInventoryPanel(hero); 
    }

    hasEquippableSkills(hero) {
        const eq = hero.equippedSkills || [null, null, null, null, null, null];
        
        const availAction = this.getAvailableSkills(hero, 'ACTION').length > 0;
        const availSupport = this.getAvailableSkills(hero, 'SUPPORT').length > 0;
        const availAuto = this.getAvailableSkills(hero, 'AUTO').length > 0;

        const hasEmptyAction = !eq[0] || !eq[1] || !eq[2];
        const hasEmptySupport = !eq[3] || !eq[4];
        const hasEmptyAuto = !eq[5];

        return (hasEmptyAction && availAction) || 
               (hasEmptySupport && availSupport) || 
               (hasEmptyAuto && availAuto);
    }

    renderHeroList() {
        const listEl = document.getElementById('manage-list');
        if (!listEl) return;
        
        listEl.innerHTML = '';
        
        for (let i = 0; i < this.game.gameState.heroes.length; i++) {
            const h = this.game.gameState.heroes[i];
            if (!h) continue;
            
            const isSelected = (i === this.selectedHeroIdx);
            
            const standingSrc = STANDING_DATA[h.classKey || h.key];
            const iconHtml = standingSrc 
                ? `<div style="width:100%; height:100%; background-image:url('${standingSrc}'); background-size:600% 100%; background-position: 40% center; background-repeat:no-repeat; background-color:transparent;"></div>` 
                : `<div style="font-size:26px; display:flex; align-items:center; justify-content:center; height:100%; background:transparent;">${h.icon}</div>`;
            
            const classString = this._getClassString(h);
            const bgStyle = isSelected ? 'background: #fff; border-color: #8b0000; box-shadow: inset 4px 0 0 #8b0000;' : 'background: #f4ebd8; border-color: #d4bc96;';
            const nameColor = isSelected ? 'color: #8b0000;' : 'color: #3e2723;';

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `display:flex; align-items:center; padding:8px 10px; border:2px solid; ${bgStyle} cursor:pointer; transition:0.2s; position:relative;`;
            itemDiv.onclick = () => this.changeSelectedHero(i);
            itemDiv.onmouseover = () => { if(!isSelected) itemDiv.style.borderColor = '#8b0000'; };
            itemDiv.onmouseout = () => { if(!isSelected) itemDiv.style.borderColor = '#d4bc96'; };

            let dotHtml = '';
            if (this.hasEquippableSkills(h)) {
                dotHtml = `<div style="position:absolute; top:-5px; left:-5px; width:14px; height:14px; background:#e53935; border-radius:50%; border:2px solid #fff; box-shadow:1px 1px 3px rgba(0,0,0,0.5); z-index:5;"></div>`;
            }

            itemDiv.innerHTML = `
                ${dotHtml}
                <div style="width:56px; height:56px; border:none; margin-right:15px; background:transparent; overflow:hidden; flex-shrink:0;">
                    ${iconHtml}
                </div>
                <div style="flex:1; line-height:1.4; overflow:hidden;">
                    <div style="font-weight:bold; font-size:16px; ${nameColor} white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${h.name}</div>
                    <div style="font-size:12px; font-weight:bold; color:#555;">Lv.${h.level}</div>
                    <div style="font-size:11px; color:#5d4037; font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${classString}</div>
                </div>
            `;
            listEl.appendChild(itemDiv);
        }
    }

    renderStatsPanel(hero) {
        const container = document.getElementById('manage-stats');
        if (!container) return;

        const portraitSrc = PORTRAIT_DATA[hero.classKey || hero.key] || STANDING_DATA[hero.classKey || hero.key];
        const iconHtml = portraitSrc 
            ? `<img src="${portraitSrc}" style="width:100%; height:auto; max-height:220px; object-fit:contain; object-position:center; border:none; background:transparent; margin-bottom:15px; box-shadow:none;" />` 
            : `<div style="width:100%; height:220px; border:none; display:flex; align-items:center; justify-content:center; font-size:80px; background:transparent; margin-bottom:15px;">${hero.icon}</div>`;

        const expReq = Formulas.EXP_REQ(hero.level) || 100;
        const basicStats = [
            { lbl: 'STR', val: this.getStatDetail(hero, 'str').base + this.getStatDetail(hero, 'str').bonus },
            { lbl: 'INT', val: this.getStatDetail(hero, 'int').base + this.getStatDetail(hero, 'int').bonus },
            { lbl: 'VIT', val: this.getStatDetail(hero, 'vit').base + this.getStatDetail(hero, 'vit').bonus },
            { lbl: 'AGI', val: this.getStatDetail(hero, 'agi').base + this.getStatDetail(hero, 'agi').bonus },
            { lbl: 'DEX', val: this.getStatDetail(hero, 'dex').base + this.getStatDetail(hero, 'dex').bonus },
            { lbl: 'VOL', val: this.getStatDetail(hero, 'vol').base + this.getStatDetail(hero, 'vol').bonus },
            { lbl: 'LUC', val: this.getStatDetail(hero, 'luk').base + this.getStatDetail(hero, 'luk').bonus },
            { lbl: 'EXP', val: `${Math.floor(hero.xp || 0)}/${expReq}` }
        ];

        const combatStats = [
            { lbl: 'HP', val: hero.hp }, { lbl: 'MP', val: hero.mp },
            { lbl: 'ATK', val: Formulas.getDerivedStat(hero, 'atk_phys', true) }, { lbl: 'MATK', val: Formulas.getDerivedStat(hero, 'atk_mag', true) },
            { lbl: 'DEF', val: Formulas.getDerivedStat(hero, 'def', true) }, { lbl: 'MRES', val: Formulas.getDerivedStat(hero, 'res', true) },
            { lbl: 'HIT', val: Formulas.getDerivedStat(hero, 'hit_phys', true) }, { lbl: 'SPD', val: Formulas.getDerivedStat(hero, 'spd', true) },
            { lbl: 'EVA', val: Formulas.getDerivedStat(hero, 'eva', true) }, { lbl: 'MOV', val: Formulas.getDerivedStat(hero, 'mov', true) }
        ];

        const rowStyle = "display:flex; justify-content:space-between; border-bottom:1px dotted rgba(93,64,55,0.4); padding:3px 0; font-size:13px; font-weight:bold;";

        container.innerHTML = `
            ${iconHtml}
            <div style="margin-bottom: 12px; flex-shrink:0;">
                <div style="font-size:24px; font-weight:bold; color:#3e2723; font-family:var(--font-main);">${hero.name}</div>
                <div style="font-size:13px; color:#5d4037; font-weight:bold; margin-top:2px;">${this._getClassString(hero)} (Lv.${hero.level})</div>
            </div>
            
            <div style="font-family:'Cinzel',serif; font-size:15px; font-weight:bold; color:#8b0000; border-bottom:2px solid #8b0000; margin-bottom:8px; padding-bottom:3px;">BASIC STATUS</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:3px 20px; font-family:'Cinzel',serif; color:#3e2723; margin-bottom:15px;">
                ${basicStats.map(s => `<div style="${rowStyle}"><span>${s.lbl}</span><span style="color:#8b0000;">${s.val}</span></div>`).join('')}
            </div>

            <div style="font-family:'Cinzel',serif; font-size:15px; font-weight:bold; color:#8b0000; border-bottom:2px solid #8b0000; margin-bottom:8px; padding-bottom:3px;">COMBAT STATUS</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:3px 20px; font-family:'Cinzel',serif; color:#3e2723; margin-bottom:15px;">
                ${combatStats.map(s => `<div style="${rowStyle}"><span>${s.lbl}</span><span style="color:#8b0000;">${s.val}</span></div>`).join('')}
            </div>
        `;
    }

    renderEquipmentPanel(hero) {
        const container = document.getElementById('manage-equip');
        if (!container) return;
        container.innerHTML = '';
        
        const slots = [
            { key: 'head', label: 'HEAD' }, { key: 'body', label: 'BODY' }, 
            { key: 'mainHand', label: 'RIGHT HAND' }, { key: 'offHand', label: 'LEFT HAND' },
            { key: 'ring', label: 'ACCESSORY 1' }, { key: 'neck', label: 'ACCESSORY 2' }
        ];

        const equipGrid = document.createElement('div');
        equipGrid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap: 8px;';
        
        slots.forEach(slot => {
            const eqData = hero.equipment[slot.key];
            const itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            const item = itemId ? this.game.itemData[itemId] : null;
            const isFilled = !!item;
            
            const slotDiv = document.createElement('div');
            const bgStyle = isFilled ? 'background:#f4ebd8; border-color:#5d4037; color:#3e2723;' : 'background:rgba(255,255,255,0.4); border-color:#d4bc96; color:rgba(93,64,55,0.5);';
            slotDiv.style.cssText = `height:48px; border:2px solid; ${bgStyle} display:flex; align-items:center; justify-content:center; cursor:pointer; font-family:'Cinzel',serif; font-size:12px; font-weight:bold; box-shadow:1px 1px 3px rgba(0,0,0,0.1); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; padding:0 5px;`;
            
            slotDiv.innerHTML = isFilled ? `<span style="font-size:20px; margin-right:6px;">${item.icon}</span> <span style="overflow:hidden; text-overflow:ellipsis;">${item.name}</span>` : slot.label;
            
            if (isFilled) {
                slotDiv.onclick = () => this.unequipItem(this.selectedHeroIdx, slot.key);
                slotDiv.onmouseenter = (e) => this.showItemTooltipProxy(e, itemId);
                slotDiv.onmouseleave = () => this.hideItemTooltipProxy();
                slotDiv.onmousemove = (e) => this.moveItemTooltipProxy(e);
            }
            
            slotDiv.ondragover = (e) => { e.preventDefault(); };
            slotDiv.ondrop = (e) => this.handleDrop(e, slot.key);

            equipGrid.appendChild(slotDiv);
        });
        container.appendChild(equipGrid);

        const maxPockets = this.getMaxPockets(hero);
        const pocketGrid = document.createElement('div');
        pocketGrid.style.cssText = 'display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-top:12px;';

        for (let i = 1; i <= 8; i++) {
            const slotKey = `pocket${i}`;
            const isLocked = i > maxPockets;
            const eqData = hero.equipment[slotKey];
            const itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            const count = typeof eqData === 'object' && eqData !== null ? (eqData.count || 1) : 1;
            const item = itemId ? this.game.itemData[itemId] : null;
            const isFilled = !!item;
            
            const pDiv = document.createElement('div');
            const bgStyle = isFilled ? 'background:#f4ebd8; border-color:#5d4037; color:#3e2723; font-size:26px;' : 'background:rgba(255,255,255,0.4); border-color:#d4bc96; color:rgba(93,64,55,0.5); font-size:11px;';
            pDiv.style.cssText = `aspect-ratio:1/1; border:2px solid; ${bgStyle} display:flex; align-items:center; justify-content:center; font-family:'Cinzel',serif; font-weight:bold; cursor:${isLocked?'not-allowed':'pointer'}; position:relative; opacity:${isLocked?0.3:1};`;

            pDiv.innerHTML = isLocked ? '🔒' : (isFilled ? `${item.icon}<div style="position:absolute; bottom:-5px; right:-5px; background:#8b0000; color:#fff; font-size:10px; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Cinzel',serif;">${count}</div>` : 'ITEM');

            if (!isLocked && isFilled) {
                pDiv.onclick = () => this.unequipItem(this.selectedHeroIdx, slotKey);
                pDiv.onmouseenter = (e) => this.showItemTooltipProxy(e, itemId);
                pDiv.onmouseleave = () => this.hideItemTooltipProxy();
                pDiv.onmousemove = (e) => this.moveItemTooltipProxy(e);
            }
            if (!isLocked) {
                pDiv.ondragover = (e) => { e.preventDefault(); };
                pDiv.ondrop = (e) => this.handleDrop(e, slotKey);
            }
            pocketGrid.appendChild(pDiv);
        }
        container.appendChild(pocketGrid);
    }

    renderInventoryPanel(hero) {
        const container = document.getElementById('manage-inventory');
        if (!container) return;
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: repeat(5, 1fr); gap:6px; align-content:start;';
        
        const inventory = this.game.gameState.inventory; 
        for(let i=0; i<20; i++) {
            const invData = inventory[i];
            const itemId = typeof invData === 'object' && invData !== null ? invData.id : invData;
            const count = typeof invData === 'object' && invData !== null ? (invData.count || 1) : 1;
            const item = itemId ? this.game.itemData[itemId] : null;
            
            let canEquip = false;
            if (hero && item) {
                canEquip = this.canEquipItem(hero, item);
            }

            const isFilled = !!item;
            const bgStyle = isFilled ? 'background:#f4ebd8; border-color:#5d4037; cursor:pointer;' : 'background:rgba(255,255,255,0.4); border:2px dashed #d4bc96; cursor:default;';
            const extraStyle = (isFilled && !canEquip) ? 'opacity:0.5; filter:sepia(50%);' : '';
            const badgeHtml = (isFilled && count > 1) ? `<div style="position:absolute; bottom:-4px; right:-4px; background:#8b0000; color:#fff; font-size:9px; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Cinzel',serif; font-weight:bold;">${count}</div>` : '';
            
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `aspect-ratio:1/1; border:2px solid; ${bgStyle} ${extraStyle} display:flex; align-items:center; justify-content:center; font-size:26px; position:relative; box-shadow:1px 1px 2px rgba(0,0,0,0.1);`;
            itemDiv.innerHTML = isFilled ? item.icon + badgeHtml : '';

            if (isFilled) {
                itemDiv.setAttribute('draggable', 'true');
                itemDiv.ondragstart = (e) => this.handleDragStart(e, i);
                
                itemDiv.onclick = () => {
                    if (this.selectedHeroIdx !== null) this.equipItem(this.selectedHeroIdx, i);
                    else this.game.showAlert('장착할 영웅을 먼저 선택해주세요.');
                };
                itemDiv.onmouseenter = (e) => this.showItemTooltipProxy(e, itemId);
                itemDiv.onmouseleave = () => this.hideItemTooltipProxy();
                itemDiv.onmousemove = (e) => this.moveItemTooltipProxy(e);
            }
            grid.appendChild(itemDiv);
        }
        container.appendChild(grid);
    }

    getSkillCategory(skill) {
        if (!skill) return 'ACTION';
        const partStr = String(skill.part || '').toUpperCase().trim();
        if (partStr === 'A') return 'ACTION';
        if (partStr === 'S') return 'SUPPORT';
        if (partStr === 'P' || skill.type === 'PASSIVE') return 'AUTO';
        return 'ACTION'; 
    }

    getAvailableSkills(hero, category) {
        let available = [];
        if (category === 'ACTION') {
            const categories = new Set();
            (hero.skills || []).forEach(s => {
                if (s.category && s.category !== 'GENERAL' && s.category !== '-' && s.category.trim() !== '') {
                    categories.add(s.category);
                }
            });
            categories.forEach(cat => {
                const catId = `CAT_${cat}`;
                if (!(hero.equippedSkills || []).includes(catId)) {
                    available.push({ id: catId, name: `[세트] ${cat}`, icon: '📂', isCat: true });
                }
            });
            
            (hero.skills || []).forEach(s => {
                if (this.getSkillCategory(s) === category && !(hero.equippedSkills || []).includes(s.id) && s.id !== '1000') {
                    if (!s.category || s.category === 'GENERAL' || s.category === '-' || s.category.trim() === '') {
                        available.push(s);
                    }
                }
            });
        } else {
            (hero.skills || []).forEach(s => {
                if (this.getSkillCategory(s) === category && !(hero.equippedSkills || []).includes(s.id) && s.id !== '1000') {
                    available.push(s);
                }
            });
        }
        return available;
    }

    renderSkillsPanel(hero) {
        const container = document.getElementById('manage-skills');
        if (!container) return;
        container.innerHTML = '';

        const slotConfig = [
            { idx: 0, cat: 'ACTION' }, { idx: 1, cat: 'ACTION' }, { idx: 2, cat: 'ACTION' },
            { idx: 3, cat: 'SUPPORT' }, { idx: 4, cat: 'SUPPORT' },
            { idx: 5, cat: 'AUTO' }
        ];

        const availMap = {
            'ACTION': this.getAvailableSkills(hero, 'ACTION'),
            'SUPPORT': this.getAvailableSkills(hero, 'SUPPORT'),
            'AUTO': this.getAvailableSkills(hero, 'AUTO')
        };

        const mainWrap = document.createElement('div');
        mainWrap.style.cssText = 'display:flex; flex-direction:column; gap: 15px; padding-bottom: 20px;';

        ['ACTION', 'SUPPORT', 'AUTO'].forEach((catName) => {
            const catDiv = document.createElement('div');
            catDiv.style.flexShrink = '0';
            catDiv.innerHTML = `<div style="font-family:'Cinzel',serif; font-size:15px; font-weight:bold; color:#8b0000; border-bottom:2px solid #8b0000; margin-bottom:10px; padding-bottom:4px;">${catName} SKILLS</div>`;
            
            const slotsForThisCat = slotConfig.filter(c => c.cat === catName);
            
            slotsForThisCat.forEach(slot => {
                const skillId = hero.equippedSkills[slot.idx];
                
                const blockWrap = document.createElement('div');
                blockWrap.style.cssText = 'margin-bottom:8px; position:relative;';

                const blockDiv = document.createElement('div');
                
                if (skillId) {
                    blockDiv.style.cssText = 'background:#fff; border:2px solid #5d4037; height:46px; display:flex; align-items:center; justify-content:space-between; padding:0 15px; cursor:pointer; box-shadow:1px 1px 3px rgba(0,0,0,0.1);';
                    
                    let leftHtml = '';
                    if (skillId.startsWith('CAT_')) {
                        const cName = skillId.replace('CAT_', '');
                        leftHtml = `<div style="display:flex; align-items:center;"><span style="font-size:22px; margin-right:12px;">📂</span><span style="font-weight:bold; color:#3e2723; font-size:14px;">[세트] ${cName}</span></div>`;
                        blockWrap.className = 'cat-grid-wrapper';
                    } else {
                        const skillData = hero.skills.find(s => s.id === skillId);
                        if (skillData) {
                            leftHtml = `<div style="display:flex; align-items:center;"><span style="font-size:22px; margin-right:12px; filter:drop-shadow(1px 1px 1px rgba(0,0,0,0.3));">${skillData.icon || '✨'}</span><span style="font-weight:bold; color:#3e2723; font-size:14px;">${skillData.name}</span></div>`;
                        }
                    }
                    
                    blockDiv.innerHTML = `${leftHtml}<div style="color:#8b0000; font-weight:bold; font-size:16px;">✖</div>`;
                    blockDiv.onclick = (e) => { 
                        e.stopPropagation();
                        this.unequipSkill(slot.idx); 
                        this.expandedSlotIdx = null; 
                        this.expandedCatGridIdx = null; 
                        this.renderUI(); 
                    };
                    blockDiv.onmouseenter = (e) => this.showSkillTooltip(e, skillId, true);
                    blockDiv.onmousemove = (e) => this.moveSkillTooltip(e);
                    blockDiv.onmouseleave = () => this.hideSkillTooltip();

                    blockWrap.appendChild(blockDiv);

                    if (skillId.startsWith('CAT_')) {
                        const catNameStr = skillId.replace('CAT_', '');
                        const allSkillsInCat = Object.values(SKILL_DATABASE || {}).filter(s => s.category === catNameStr);
                        const learnedIds = (hero.skills || []).map(s => s.id);

                        if (allSkillsInCat.length > 0) {
                            const showToggle = allSkillsInCat.length > 5;
                            const isGridExpanded = (this.expandedCatGridIdx === slot.idx);

                            const gridDiv = document.createElement('div');
                            gridDiv.style.cssText = 'display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; background:rgba(93,64,55,0.1); padding:10px; border:2px dashed #d4bc96; border-top:none;';
                            
                            let renderList = showToggle ? allSkillsInCat.slice(0, 4) : allSkillsInCat;
                            
                            renderList.forEach(s => {
                                const isLearned = learnedIds.includes(s.id);
                                const sIcon = document.createElement('div');
                                const sStyle = isLearned ? 'cursor:pointer; border:1px solid #5d4037; background:#ebd9b4;' : 'filter:grayscale(100%) opacity(0.4); border:1px solid transparent; background:rgba(0,0,0,0.05);';
                                sIcon.style.cssText = `aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:1px 1px 2px rgba(0,0,0,0.1); ${sStyle}`;
                                sIcon.innerHTML = s.icon || '✨';
                                
                                sIcon.onmouseenter = (e) => this.showSkillTooltip(e, s.id, isLearned);
                                sIcon.onmousemove = (e) => this.moveSkillTooltip(e);
                                sIcon.onmouseleave = () => this.hideSkillTooltip();

                                gridDiv.appendChild(sIcon);
                            });

                            if (showToggle) {
                                const toggleBtn = document.createElement('div');
                                toggleBtn.style.cssText = 'aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:12px; font-weight:bold; cursor:pointer; border:1px dashed #5d4037; background:rgba(255,255,255,0.6); color:#5d4037; box-shadow:1px 1px 2px rgba(0,0,0,0.1); transition:0.2s; line-height:1.2;';
                                toggleBtn.innerHTML = `<span style="font-size:14px;">▼</span><span>+${allSkillsInCat.length - 4}</span>`;
                                toggleBtn.onmouseover = () => toggleBtn.style.background = '#fff';
                                toggleBtn.onmouseout = () => toggleBtn.style.background = 'rgba(255,255,255,0.6)';
                                
                                toggleBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    this.expandedCatGridIdx = isGridExpanded ? null : slot.idx;
                                    this.renderUI();
                                };
                                gridDiv.appendChild(toggleBtn);
                            }
                            blockWrap.appendChild(gridDiv);

                            if (isGridExpanded && showToggle) {
                                const overlayGrid = document.createElement('div');
                                overlayGrid.style.cssText = 'position:absolute; top:46px; left:0; width:100%; z-index:105; background:#ebd9b4; padding:10px; border:2px solid #5d4037; border-top:none; box-shadow:0 8px 20px rgba(0,0,0,0.6); display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; box-sizing:border-box;';
                                
                                allSkillsInCat.forEach(s => {
                                    const isLearned = learnedIds.includes(s.id);
                                    const sIcon = document.createElement('div');
                                    const sStyle = isLearned ? 'cursor:pointer; border:1px solid #5d4037; background:#fff;' : 'filter:grayscale(100%) opacity(0.4); border:1px solid transparent; background:rgba(0,0,0,0.05);';
                                    sIcon.style.cssText = `aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:1px 1px 2px rgba(0,0,0,0.1); ${sStyle}`;
                                    sIcon.innerHTML = s.icon || '✨';
                                    
                                    sIcon.onmouseenter = (e) => this.showSkillTooltip(e, s.id, isLearned);
                                    sIcon.onmousemove = (e) => this.moveSkillTooltip(e);
                                    sIcon.onmouseleave = () => this.hideSkillTooltip();

                                    overlayGrid.appendChild(sIcon);
                                });
                                
                                const closeBtn = document.createElement('div');
                                closeBtn.style.cssText = 'aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:12px; font-weight:bold; cursor:pointer; border:1px dashed #5d4037; background:#fff; color:#8b0000; box-shadow:1px 1px 2px rgba(0,0,0,0.1); transition:0.2s; line-height:1.2;';
                                closeBtn.innerHTML = '<span style="font-size:14px;">▲</span><span>접기</span>';
                                closeBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    this.expandedCatGridIdx = null;
                                    this.renderUI();
                                };
                                overlayGrid.appendChild(closeBtn);
                                
                                blockWrap.appendChild(overlayGrid);
                            }
                        }
                    }
                } else {
                    blockWrap.className = 'slot-dropdown-wrapper'; 
                    const isExpanded = (this.expandedSlotIdx === slot.idx);
                    
                    blockDiv.style.cssText = 'background:rgba(255,255,255,0.4); border:2px dashed #d4bc96; height:46px; display:flex; align-items:center; justify-content:space-between; padding:0 15px; cursor:pointer; color:rgba(93,64,55,0.6); font-size:12px; font-weight:bold; position:relative;';
                    
                    let dotHtml = '';
                    if (availMap[catName] && availMap[catName].length > 0) {
                        dotHtml = `<div style="position:absolute; top:-5px; left:-5px; width:14px; height:14px; background:#e53935; border-radius:50%; border:2px solid #fff; box-shadow:1px 1px 3px rgba(0,0,0,0.5); z-index:5;"></div>`;
                    }

                    blockDiv.innerHTML = `${dotHtml}<span>+ CLICK TO EQUIP</span><span style="font-size:14px; color:#5d4037;">${isExpanded ? '▲' : '▼'}</span>`;
                    blockDiv.onclick = (e) => {
                        e.stopPropagation();
                        this.expandedSlotIdx = isExpanded ? null : slot.idx;
                        this.renderUI();
                    };
                    blockWrap.appendChild(blockDiv);

                    if (isExpanded) {
                        const accordionDiv = document.createElement('div');
                        accordionDiv.style.cssText = 'position:absolute; top:46px; left:0; width:100%; z-index:110; background:#ebd9b4; border:2px solid #5d4037; border-top:none; display:flex; flex-direction:column; max-height:220px; overflow-y:auto; box-shadow:0 8px 16px rgba(0,0,0,0.6); box-sizing:border-box;';
                        
                        let available = availMap[catName];

                        if (available.length === 0) {
                            accordionDiv.innerHTML = `<div style="padding:15px; text-align:center; color:#5d4037; font-size:12px;">장착할 항목이 없습니다.</div>`;
                        } else {
                            available.forEach(s => {
                                const itemDiv = document.createElement('div');
                                itemDiv.style.cssText = 'display:flex; align-items:center; padding:10px 15px; border-bottom:1px dotted #5d4037; cursor:pointer; transition:background 0.2s;';
                                itemDiv.onmouseover = () => { itemDiv.style.background = '#fff'; itemDiv.style.borderLeft = '4px solid #8b0000'; itemDiv.style.paddingLeft = '11px'; };
                                itemDiv.onmouseout = () => { itemDiv.style.background = 'transparent'; itemDiv.style.borderLeft = 'none'; itemDiv.style.paddingLeft = '15px'; };
                                
                                itemDiv.innerHTML = `
                                    <div style="font-size:20px; margin-right:10px;">${s.icon || '✨'}</div>
                                    <div style="font-size:13px; font-weight:bold; color:#3e2723;">${s.name}</div>
                                `;
                                
                                itemDiv.onclick = (e) => { 
                                    e.stopPropagation();
                                    this.equipSkillSlot(s.id, slot.idx); 
                                    this.expandedSlotIdx = null; 
                                };
                                itemDiv.onmouseenter = (e) => this.showSkillTooltip(e, s.id, true);
                                itemDiv.onmousemove = (e) => this.moveSkillTooltip(e);
                                itemDiv.onmouseleave = () => this.hideSkillTooltip();

                                accordionDiv.appendChild(itemDiv);
                            });
                        }
                        blockWrap.appendChild(accordionDiv);
                    }
                }
                catDiv.appendChild(blockWrap);
            });
            mainWrap.appendChild(catDiv);
        });
        
        container.appendChild(mainWrap);
    }

    equipSkillSlot(skillId, slotIdx) {
        const hero = this.game.gameState.heroes[this.selectedHeroIdx];
        if (!hero.equippedSkills) hero.equippedSkills = [null,null,null,null,null,null];
        
        hero.equippedSkills[slotIdx] = skillId;
        this.hideSkillTooltip(); 
        this.game.saveGame();
        this.renderUI();
    }

    unequipSkill(slotIdx) {
        const hero = this.game.gameState.heroes[this.selectedHeroIdx];
        if (hero.equippedSkills) {
            hero.equippedSkills[slotIdx] = null;
            this.hideSkillTooltip(); 
            this.game.saveGame();
            this.renderUI();
        }
    }

    changeSelectedHero(idx) {
        this.selectedHeroIdx = idx;
        this.expandedSlotIdx = null; 
        this.expandedCatGridIdx = null; 
        this.renderUI();
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