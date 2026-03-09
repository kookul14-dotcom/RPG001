import { TIER_REQ, JOB_CLASS_DATA } from '../../data/index.js';
import { PORTRAIT_DATA } from '../../data/portraits.js';
import * as Formulas from '../../utils/formulas.js';

export class SkillManager {
    constructor(gameApp) {
        this.game = gameApp;
        this.selectedHeroIdx = 0;
    }

    openUI() {
        if (!window.game) return;

        let modal = document.getElementById('skill-ui-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'skill-ui-modal';
            // 기존 인라인 제거 후 고전적 오버레이 클래스 부여
            modal.className = 'modal skill-modal-overlay';
            const container = document.createElement('div');
            container.id = 'skill-ui-container';
            modal.appendChild(container);
            document.body.appendChild(modal);
        }

        const container = document.getElementById('skill-ui-container');
        container.className = 'luxury-modal-container';
        
        // 인라인 <style> 태그 전체 제거 (CSS 파일로 이관됨)
        container.innerHTML = `
            <div class="skill-sub-header">
                <h2 class="skill-main-title">✨ SKILL SETTINGS</h2>
                
                <div class="skill-nav-group">
                    <button id="btn-skill-to-hero" class="skill-nav-btn to-hero">▶ CHRACTER MANAGEMENT</button>
                    <button id="btn-skill-to-party" class="skill-nav-btn to-party">▶ PARTY MANAGEMENT</button>
                </div>

                <button class="skill-close-btn" id="btn-skill-close">✖</button>
            </div>
            
            <div id="skill-ui-content" class="skill-ui-wrapper">
                <div class="manage-container">
                    
                    <div class="manage-col roster-col">
                        <div class="col-header">CHARACTER</div>
                        <div id="skill-manage-list" class="scroll-box"></div>
                    </div>
                    
                    <div class="manage-col equipped-col">
                        <div class="col-header">EQUIPPED SKILLS <span class="max-hint">(Max 6)</span></div>
                        <div id="skill-equipped-panel" class="scroll-box"></div>
                    </div>
                    
                    <div class="manage-col all-skills-col">
                        <div class="col-header">ALL LEARNED SKILLS</div>
                        <div id="skill-all-panel" class="scroll-box"></div>
                    </div>

                </div>
            </div>
        `;

        const closeBtn = document.getElementById('btn-skill-close');
        if(closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        
        const heroBtn = document.getElementById('btn-skill-to-hero');
        if(heroBtn) heroBtn.onclick = () => { 
            modal.style.display = 'none'; 
            if(this.game.heroManager) this.game.heroManager.openUI(); 
        };

        const partyBtn = document.getElementById('btn-skill-to-party');
        if(partyBtn) partyBtn.onclick = () => { 
            modal.style.display = 'none'; 
            if(this.game.openPartyManager) this.game.openPartyManager(); 
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
            this.renderEquippedSkills(hero);
            this.renderAllSkills(hero);
        } else {
            document.getElementById('skill-equipped-panel').innerHTML = '';
            document.getElementById('skill-all-panel').innerHTML = `<div class="empty-state-msg">영웅을 선택하세요</div>`;
        }
    }

    renderHeroList() {
        const listEl = document.getElementById('skill-manage-list');
        if (!listEl) return;
        
        let html = '';
        html += `<div class="roster-divider">⚔️ ACTIVE PARTY</div>`;
        for (let i = 0; i < 6; i++) {
            const h = this.game.gameState.heroes[i];
            if (!h) continue;
            html += this._createHeroListItem(h, i);
        }

        const rosterHeroes = this.game.gameState.heroes.slice(6);
        if (rosterHeroes.length > 0) {
            html += `<div class="roster-divider reserve">🏕️ RESERVE ROSTER</div>`;
            for (let i = 6; i < this.game.gameState.heroes.length; i++) {
                const h = this.game.gameState.heroes[i];
                if (!h) continue;
                html += this._createHeroListItem(h, i);
            }
        }
        listEl.innerHTML = html;
    }

    _getClassString(h) {
        let classStr = `Class ${h.classLevel || 1}: ${h.classKey}`;
        if (typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === h.classKey && c.classLevel === (h.classLevel || 1));
            if (cInfo) classStr = `Class ${cInfo.classLevel}: ${cInfo.classNameEn} (${cInfo.className})`;
        }
        return classStr;
    }

    _createHeroListItem(h, idx) {
        const isSelected = (idx === this.selectedHeroIdx);
        const classStr = this._getClassString(h);

        const portraitSrc = PORTRAIT_DATA[h.classKey || h.key];
        const iconHtml = portraitSrc 
            ? `<img src="${portraitSrc}" class="list-icon-img" />`
            : h.icon;

        return `
            <div class="hero-list-item ${isSelected ? 'selected' : ''}" onclick="window.game.skillManager.changeSelectedHero(${idx})">
                <div class="list-icon">${iconHtml}</div>
                
                <div class="list-info">
                    <div class="list-hero-name">
                        ${h.name} <span class="list-hero-lv">Lv.${h.level}</span>
                    </div>
                    <div class="list-hero-class">${classStr}</div>
                </div>
                
                <div class="list-indicator">
                    ${isSelected ? '◀' : ''}
                </div>
            </div>
        `;
    }

    toggleCategory(catName) {
        if (!this.expandedCategories) this.expandedCategories = {};
        this.expandedCategories[catName] = !this.expandedCategories[catName];
        this.renderUI();
    }

    setSkillFilter(filterType) {
        this.currentSkillFilter = filterType;
        this.renderUI();
    }

    renderEquippedSkills(hero) {
        const container = document.getElementById('skill-equipped-panel');
        if (!container) return;

        let html = '';
        if (!hero.equippedSkills || hero.equippedSkills.length !== 6) {
            hero.equippedSkills = [null, null, null, null, null, null];
        }
        
        const equippedIds = hero.equippedSkills;
        let heroCostRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
        if (heroCostRed <= 0) heroCostRed = 1.0;

        // CSS 클래스로 매핑
        const slotLabels = ['[A] ACTION 1', '[A] ACTION 2', '[A] ACTION 3', '[S] SUPPORT 1', '[S] SUPPORT 2', '[P] AUTO'];
        const slotClasses = ['slot-action', 'slot-action', 'slot-action', 'slot-support', 'slot-support', 'slot-auto'];

        for (let i = 0; i < 6; i++) {
            const skillId = equippedIds[i];
            const slotClass = slotClasses[i];

            if (skillId) {
                if (skillId.startsWith('CAT_')) {
                    const catName = skillId.replace('CAT_', '');
                    html += `
                        <div class="ts-skill-card ${slotClass}" onclick="window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${skillId}')">
                            <div class="sc-icon">📂</div>
                            <div class="sc-info">
                                <div class="sc-name">[세트] ${catName} <span class="badge-unequip">UN-EQUIP</span></div>
                            </div>
                            <div class="sc-cost"><span class="slot-type-lbl">${slotLabels[i].split(' ')[0]}</span></div>
                        </div>
                    `;
                } else {
                    const s = hero.skills.find(sk => String(sk.id) === String(skillId));
                    if (s) {
                        const finalCost = Math.floor((s.cost || 50) * Math.max(heroCostRed, 0.1));
                        const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
                        const partLabel = part === 'A' ? 'ACTION' : (part === 'S' ? 'SUPPORT' : 'AUTO');
                        
                        let costHtml = `<div class="sc-part-label">[${partLabel}]</div>`;
                        
                        if (part === 'A') {
                            costHtml += `<span class="sc-mp">${s.mp || 0} MP</span><span class="sc-wt">${finalCost} WT</span>`;
                        }
                        
                        html += `
                            <div class="ts-skill-card ${slotClass}" onclick="window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${s.id}')" onmouseenter="window.game.skillManager.showSkillTooltip(event, ${this.selectedHeroIdx}, '${s.id}')" onmouseleave="window.game.townSystem.hideTooltip()">
                                <div class="sc-icon">${s.icon || '✨'}</div>
                                <div class="sc-info">
                                    <div class="sc-name">${s.name} <span class="badge-unequip">UN-EQUIP</span></div>
                                    <div class="sc-desc">${s.desc || ''}</div>
                                </div>
                                <div class="sc-cost">
                                    ${costHtml}
                                </div>
                            </div>
                        `;
                    } else {
                        // ⭐ [버그 수정] 세이브 과정에서 참조가 어긋나 스킬을 못 찾더라도 UI가 증발하지 않도록 안전망 추가
                        hero.equippedSkills[i] = null;
                        html += `<div class="equipped-slot ${slotClass}">EMPTY : ${slotLabels[i]}</div>`;
                    }
                }
            } else {
                html += `<div class="equipped-slot ${slotClass}">EMPTY : ${slotLabels[i]}</div>`;
            }
        }
        container.innerHTML = html;
    }

    renderAllSkills(hero) {
        const container = document.getElementById('skill-all-panel');
        if (!container) return;

        if (!hero.skills || hero.skills.length === 0) {
            container.innerHTML = `<div class="empty-state-msg">습득한 스킬이 없습니다.</div>`;
            return;
        }

        if (!this.expandedCategories) this.expandedCategories = {};
        
        const currentFilter = this.currentSkillFilter || 'ALL';

        // 1. 상단 고정 필터
        let html = `
            <div class="skill-filter-bar">
                <button onclick="window.game.skillManager.setSkillFilter('ALL')" class="skill-filter-btn btn-all ${currentFilter === 'ALL' ? 'active' : ''}">ALL</button>
                <button onclick="window.game.skillManager.setSkillFilter('A')" class="skill-filter-btn btn-action ${currentFilter === 'A' ? 'active' : ''}">ACTION</button>
                <button onclick="window.game.skillManager.setSkillFilter('S')" class="skill-filter-btn btn-support ${currentFilter === 'S' ? 'active' : ''}">SUPPORT</button>
                <button onclick="window.game.skillManager.setSkillFilter('P')" class="skill-filter-btn btn-auto ${currentFilter === 'P' ? 'active' : ''}">AUTO</button>
            </div>
            <div class="skill-list-container">
        `;

        const groups = { GENERAL: [] };
        let visibleCount = 0; 

        hero.skills.forEach(s => {
            if (!s) return;
            const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
            if (currentFilter !== 'ALL' && part !== currentFilter) return;

            const cat = (s.category && String(s.category).trim() !== '' && String(s.category).trim() !== '-') ? String(s.category).trim() : 'GENERAL';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
            visibleCount++;
        });

        if (visibleCount === 0) {
            html += `<div class="empty-state-msg">조건에 맞는 스킬이 없습니다.</div></div>`;
            container.innerHTML = html;
            return;
        }

        const equippedIds = hero.equippedSkills || [];
        let heroCostRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
        if (heroCostRed <= 0) heroCostRed = 1.0;

        const renderCard = (s, isSub = false, isLast = false, isFirstSub = false) => {
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const currentClassLv = hero.classLevel || 1;
            const isLocked = currentClassLv < reqClassLv;

            let spInfoHtml = "";
            if (s.type !== 'PASSIVE') {
                const spData = (hero.sp && hero.sp[s.id]) ? hero.sp[s.id] : { level: 1, xp: 0 };
                const spReq = Formulas.SKILL_SP_REQ[spData.level] || 1;
                const isSpMax = spData.level >= 4;
                const spPct = isSpMax ? 100 : Math.min(100, (spData.xp / spReq) * 100);
                
                spInfoHtml = `
                <div class="sc-sp-bar-container">
                    <div class="sc-sp-label">
                        <span>Lv.${spData.level}</span>
                        <span>${isSpMax ? 'MAX' : `${Math.floor(spData.xp)} / ${spReq}`}</span>
                    </div>
                    <div class="sc-sp-track">
                        <div class="sc-sp-fill" style="width:${spPct}%;"></div>
                    </div>
                </div>`;
            }

            let weaponMatch = true;
            if (s.reqWeapon && s.reqWeapon.length > 0) {
                const weapon = hero.equipment.mainHand ? this.game.itemData[hero.equipment.mainHand] : null;
                const shield = hero.equipment.offHand ? this.game.itemData[hero.equipment.offHand] : null;
                const mainType = weapon ? weapon.subType : 'FIST';
                const subType = shield ? shield.subType : 'NONE';
                if (!s.reqWeapon.includes(mainType) && !s.reqWeapon.includes(subType)) weaponMatch = false;
            }

            const catEquipId = s.category ? `CAT_${s.category}` : null;
            const isEquipped = equippedIds.includes(s.id) || (catEquipId && equippedIds.includes(catEquipId));
            
            let stateClass = isEquipped ? 'equipped' : '';
            if (isLocked) stateClass += ' locked';

            let statusBadge = isEquipped ? `<span class="badge-equipped">[ 장착됨 ]</span>` : '';
            
            let onClick = "";
            if (!isSub) {
                onClick = isEquipped ? `onclick="window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${s.id}')"` : `onclick="window.game.skillManager.equipSkill(${this.selectedHeroIdx}, '${s.id}')"`;
                if (isLocked) onClick = `onclick="window.game.showAlert('클래스 ${reqClassLv}레벨에 해금됩니다.')"`;
                else if (!weaponMatch) onClick = `onclick="window.game.showAlert('장비가 일치하지 않습니다.')"`;
            } else {
                onClick = `onclick="window.game.showAlert('상위 카테고리 세트를 장착하면 전투 시 자동으로 활성화됩니다.')"`;
            }

            const finalCost = Math.floor((s.cost || 50) * Math.max(heroCostRed, 0.1));
            
            const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
            const partLabel = part === 'A' ? 'ACTION' : (part === 'S' ? 'SUPPORT' : 'AUTO');
            
            let costHtml = `<div class="sc-part-label">[${partLabel}]</div>`;
            if (part === 'A') {
                costHtml += `<span class="sc-mp">${s.mp || 0} MP</span><span class="sc-wt">${finalCost} WT</span>`;
            }

            let branchHtml = '';
            if (isSub) {
                let vLineBottom = isLast ? '50%' : '-10px';
                let vLineTop = isFirstSub ? '-10px' : '-10px'; 
                
                branchHtml = `
                    <div class="branch-ui-box">
                        <div class="branch-vline" style="top:${vLineTop}; bottom:${vLineBottom};"></div>
                        <div class="branch-hline"></div>
                    </div>
                `;
            }

            return `
                <div class="skill-card-row ${isLast ? 'last-row' : ''}">
                    ${branchHtml}
                    <div class="ts-skill-card ${stateClass} ${isSub ? 'sub-card' : ''}" ${onClick} onmouseenter="window.game.skillManager.showSkillTooltip(event, ${this.selectedHeroIdx}, '${s.id}')" onmouseleave="window.game.townSystem.hideTooltip()">
                        <div class="sc-icon">${s.icon || '✨'}</div>
                        <div class="sc-info">
                            <div class="sc-name">${s.name} ${statusBadge} ${isLocked ? `<span class="badge-locked">클래스 ${reqClassLv} 필요</span>` : ''}</div>
                            <div class="sc-desc">${s.desc || ''}</div>
                            ${spInfoHtml}
                        </div>
                        <div class="sc-cost">${costHtml}</div>
                    </div>
                </div>
            `;
        };

        if (groups.GENERAL && groups.GENERAL.length > 0) {
            groups.GENERAL.forEach(s => {
                html += renderCard(s, false, false, false);
            });
        }

        Object.keys(groups).forEach(cat => {
            if (cat === 'GENERAL') return;
            const subSkills = groups[cat];
            const catId = `CAT_${cat}`;
            const isEquipped = equippedIds.includes(catId);
            const isExpanded = this.expandedCategories[cat];
            
            const btnHtml = isEquipped 
                ? `<button class="cat-action-btn unequip" onclick="event.stopPropagation(); window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${catId}')">장착 해제</button>`
                : `<button class="cat-action-btn equip" onclick="event.stopPropagation(); window.game.skillManager.equipSkill(${this.selectedHeroIdx}, '${catId}')">세트 장착</button>`;

            html += `
                <div class="skill-category-folder ${isEquipped ? 'equipped' : ''}">
                    <div class="cat-header ${isExpanded ? 'expanded' : ''}" onclick="window.game.skillManager.toggleCategory('${cat}')">
                        <div class="cat-arrow">${isExpanded ? '▼' : '▶'}</div>
                        <div class="cat-title">
                            <span class="cat-folder-icon">📂</span> [ ${cat} ] 
                            <span class="cat-count-badge">스킬 ${subSkills.length}종</span>
                        </div>
                        ${btnHtml}
                    </div>
                    <div class="cat-content" style="display:${isExpanded ? 'flex' : 'none'};">
                        ${subSkills.map((s, idx) => renderCard(s, true, idx === subSkills.length - 1, idx === 0)).join('')}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    }

    equipSkill(heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        
        if (!hero.equippedSkills || hero.equippedSkills.length !== 6) {
            hero.equippedSkills = [null, null, null, null, null, null];
        }
        if (hero.equippedSkills.includes(skillId)) return;

        let part = 'A';
        if (skillId.startsWith('CAT_')) {
            part = 'A'; 
        } else {
            const skill = hero.skills.find(s => String(s.id) === String(skillId));
            if (!skill) return;

            const reqClassLv = parseInt(skill.req_class_lv) || 1;
            const currentClassLv = hero.classLevel || 1;
            if (currentClassLv < reqClassLv) {
                this.game.showAlert(`클래스 레벨이 부족합니다.\n(필요 클래스: ${reqClassLv})`); return;
            }

            if (skill.reqWeapon && skill.reqWeapon.length > 0) {
                const weapon = hero.equipment.mainHand ? this.game.itemData[hero.equipment.mainHand] : null;
                const shield = hero.equipment.offHand ? this.game.itemData[hero.equipment.offHand] : null;
                const mainType = weapon ? weapon.subType : 'FIST';
                const subType = shield ? shield.subType : 'NONE';
                
                if (!skill.reqWeapon.includes(mainType) && !skill.reqWeapon.includes(subType)) {
                    this.game.showAlert(`사용할 수 없는 무기입니다.\n필요: ${skill.reqWeapon.join(', ')}`); return;
                }
            }
            part = skill.part || (skill.type === 'PASSIVE' ? 'S' : 'A');
        }

        let targetIdx = -1;
        if (part === 'A') {
            for (let i = 0; i < 3; i++) { if (!hero.equippedSkills[i]) { targetIdx = i; break; } }
            if (targetIdx === -1) { this.game.showAlert("[A] 액션 스킬 슬롯(3칸)이 모두 찼습니다."); return; }
        } else if (part === 'S') {
            for (let i = 3; i < 5; i++) { if (!hero.equippedSkills[i]) { targetIdx = i; break; } }
            if (targetIdx === -1) { this.game.showAlert("[S] 서포트 스킬 슬롯(2칸)이 모두 찼습니다."); return; }
        } else if (part === 'P') {
            if (!hero.equippedSkills[5]) targetIdx = 5;
            if (targetIdx === -1) { this.game.showAlert("[P] 오토 스킬 슬롯(1칸)이 찼습니다."); return; }
        }

        hero.equippedSkills[targetIdx] = skillId;
        this.game.saveGame(); 
        this.renderUI(); 
    }

    unequipSkill(heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        if (!hero.equippedSkills) return;

        const idx = hero.equippedSkills.indexOf(skillId);
        if (idx > -1) {
            hero.equippedSkills[idx] = null;
            this.game.saveGame();
            this.renderUI();
        }
    }

    changeSelectedHero(idx) {
        this.selectedHeroIdx = idx;
        this.renderUI();
    }

    showSkillTooltip(e, heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        if (!hero) return;
        const s = hero.skills.find(sk => String(sk.id) === String(skillId));
        if (!s) return;

        let costRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
        if(costRed <= 0) costRed = 1.0;
        const finalCost = Math.floor((s.cost || 50) * costRed);

        let reqInfoHtml = "";
        if (s.reqWeapon && s.reqWeapon.length > 0) {
            reqInfoHtml = `<div class="tt-req-weapon-box">
                ⚔️ 필요 장비: <span>${s.reqWeapon.join(', ')}</span>
            </div>`;
        }

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
                    <div class="tt-warning-msg">
                        ⛔ 사용 불가 (현재: ${weapon ? weapon.name : '맨손'})
                    </div>
                `;
            }
        }

        const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
        const partLabel = part === 'A' ? 'ACTION' : (part === 'S' ? 'SUPPORT' : 'AUTO');
        
        let costHtml = `<span class="tt-part-tag">[ ${partLabel} ]</span>`;
        
        if (part === 'A') {
            costHtml = `
                <span class="tt-txt-mp">MP ${s.mp || 0}</span>
                <span class="tt-txt-wt">WT ${finalCost}</span>
            `;
        }

        const html = `
            <div class="tt-skill-name">${s.name}</div>
            <div class="tt-skill-desc">${s.desc}</div>
            <div class="tt-skill-cost-row">
                ${costHtml}
                <span class="tt-class-lv">Class Lv.${s.req_class_lv || 1}</span>
            </div>
            ${reqInfoHtml}
            ${warningHtml} 
        `;
        
        if(this.game.townSystem) this.game.townSystem.showTooltip(e, html);
    }
}