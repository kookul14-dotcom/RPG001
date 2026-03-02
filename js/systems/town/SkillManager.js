import { TIER_REQ, JOB_CLASS_DATA } from '../../data/index.js';
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
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100; display:none; align-items:center; justify-content:center;';
            const container = document.createElement('div');
            container.id = 'skill-ui-container';
            modal.appendChild(container);
            document.body.appendChild(modal);
        }

        const container = document.getElementById('skill-ui-container');
        container.classList.add('luxury-modal-container');
        container.style.cssText = '';

        container.innerHTML = `
    <style>
        .scroll-box::-webkit-scrollbar { width: 8px; }
        .scroll-box::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; margin: 4px; }
        .scroll-box::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; border: 1px solid #222; }
        .scroll-box::-webkit-scrollbar-thumb:hover { background: #c5a059; }

        .manage-col { flex: 1; display: flex; flex-direction: column; border: 1px solid #333; background: linear-gradient(180deg, #15151a, #0a0a0c); border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); min-height: 0; }
        
        /* ⭐ 가로 스크롤 원천 차단 */
        .scroll-box { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 15px; min-height: 0; }
        
        .col-header { padding: 12px; background: linear-gradient(90deg, #1a1a1a, #080808); font-weight: bold; border-bottom: 1px solid #444; flex-shrink: 0; text-align: center; font-family: 'Orbitron', sans-serif; color: var(--gold); font-size: 14px; letter-spacing: 2px; }

        .skill-list-modern { display: flex; flex-direction: column; gap: 8px; }
        .skill-card-modern { display: flex; align-items: center; background: #151518; border: 1px solid #333; border-radius: 6px; padding: 10px; cursor: pointer; transition: 0.2s; }
        .skill-card-modern:hover { border-color: #555; background: #1a1a20; transform: translateY(-2px); }
        .skill-card-modern.equipped { border-color: #4a8; background: rgba(0, 50, 20, 0.2); opacity: 0.8; }
        .skill-card-modern.locked { border-style: dashed; opacity: 0.5; filter: grayscale(100%); cursor: not-allowed; }
        
        .sc-icon { font-size: 30px; width: 44px; height: 44px; background: #0a0a0a; border: 1px solid #222; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); flex-shrink:0; }
        .sc-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
        .sc-name { font-size: 14px; font-weight: bold; color: #eee; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sc-desc { font-size: 11px; color: #777; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space:normal; }
        .sc-cost { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 50px; font-size: 11px; font-family: 'Orbitron'; flex-shrink:0; }
        .sc-mp { color: #0cf; } .sc-wt { color: #f88; }
        
        .equipped-slot { height: 70px; background: rgba(0,0,0,0.3); border: 2px dashed #444; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #555; font-weight: bold; margin-bottom: 10px; font-size: 12px; letter-spacing: 1px; }
        
    </style>
            <div class="sub-header" style="justify-content: space-between; padding: 0 30px; flex-shrink: 0; background: rgba(0,0,0,0.6); border-bottom: 1px solid #333; align-items:center; display:flex;">
                <h2 style="margin:0; color:#f8a; font-family:'Orbitron'; letter-spacing:2px; font-size:20px;">✨ SKILL SETTINGS</h2>
                
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="btn-skill-to-hero" style="background: rgba(0,0,0,0.5); color: var(--gold); border: 1px solid #c5a059; padding: 6px 20px; border-radius: 30px; cursor: pointer; font-family: 'Orbitron'; font-size:11px; transition: 0.3s;" onmouseover="this.style.background='rgba(197,160,89,0.2)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">▶ HERO MENU</button>
                    <button id="btn-skill-to-party" style="background: rgba(0,0,0,0.5); color: #8af; border: 1px solid #468; padding: 6px 20px; border-radius: 30px; cursor: pointer; font-family: 'Orbitron'; font-size:11px; transition: 0.3s;" onmouseover="this.style.background='rgba(68,136,204,0.2)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">▶ PARTY MENU</button>
                </div>

                <button class="close-btn" id="btn-skill-close" style="background:transparent; color:#888; border:none; font-size:18px; cursor:pointer;">✖</button>
            </div>
            
            <div id="skill-ui-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                <div class="manage-container" style="flex: 1; min-height: 0; display: flex; padding: 15px; gap: 15px; box-sizing: border-box;">
                    
                    <div class="manage-col" style="flex:0.8;">
                        <div class="col-header">ROSTER</div>
                        <div id="skill-manage-list" class="scroll-box"></div>
                    </div>
                    
                    <div class="manage-col" style="flex:1.2;">
                        <div class="col-header">EQUIPPED SKILLS <span style="font-size:10px; color:#888; font-weight:normal;">(Max 6)</span></div>
                        <div id="skill-equipped-panel" class="scroll-box"></div>
                    </div>
                    
                    <div class="manage-col" style="flex:1.6;">
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

        // ⭐ 정상적으로 파티 매니저 호출
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
            document.getElementById('skill-all-panel').innerHTML = '<div style="color:#666; text-align:center; padding:50px;">영웅을 선택하세요</div>';
        }
    }

    renderHeroList() {
        const listEl = document.getElementById('skill-manage-list');
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

        return `
            <div class="hero-list-item ${isSelected ? 'selected' : ''}" 
                 style="background: ${isSelected ? 'linear-gradient(90deg, #2a2a35, #111)' : '#151515'}; border: 1px solid ${isSelected ? '#c5a059' : '#333'}; display:flex; align-items:center; gap:10px; padding:10px; margin-bottom:8px; border-radius:8px; cursor:pointer; transition: 0.2s; box-shadow: ${isSelected ? '0 0 10px rgba(197,160,89,0.3)' : 'none'};" 
                 onclick="window.game.skillManager.changeSelectedHero(${idx})">
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

    // ⭐ [신규 추가] 카테고리 폴더 접기/펴기 상태 관리
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

        // ⭐ 슬롯별 라벨 및 색상 정의
        const slotLabels = ['[A] ACTION 1', '[A] ACTION 2', '[A] ACTION 3', '[S] SUPPORT 1', '[S] SUPPORT 2', '[P] AUTO'];
        const slotColors = ['#f88', '#f88', '#f88', '#8af', '#8af', '#fa5'];

        for (let i = 0; i < 6; i++) {
            const skillId = equippedIds[i];
            if (skillId) {
                // ... (카테고리 및 일반 스킬 렌더링 코드는 기존과 완벽히 동일, 단 카드 상단에 파트 라벨 살짝 추가) ...
                if (skillId.startsWith('CAT_')) {
                    const catName = skillId.replace('CAT_', '');
                    const subSkills = hero.skills.filter(sk => sk.category === catName);
                    // UI 카드 렌더링
                    html += `
                        <div class="skill-card-modern" style="border-color:${slotColors[i]}; background:linear-gradient(90deg, #2a2010, #111); margin-bottom:10px;" onclick="window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${skillId}')">
                            <div class="sc-icon" style="border-color:${slotColors[i]}; color:gold;">📂</div>
                            <div class="sc-info">
                                <div class="sc-name">[세트] ${catName} <span style="background:#422; color:#f88; padding:2px 6px; border-radius:4px; font-size:9px; margin-left:10px; border:1px solid #f55;">UN-EQUIP</span></div>
                            </div>
                            <div class="sc-cost"><span style="color:${slotColors[i]}; font-weight:bold; font-size:10px;">${slotLabels[i].split(' ')[0]}</span></div>
                        </div>
                    `;
                } else {
                    const s = hero.skills.find(sk => String(sk.id) === String(skillId));
                    if (s) {
                        const finalCost = Math.floor((s.cost || 50) * Math.max(heroCostRed, 0.1));
                        
                        // ⭐ [기획 반영] 스킬 파트 판별 및 노랗고 큰 텍스트 포맷 통일
                        const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
                        const partLabel = part === 'A' ? 'ACTION' : (part === 'S' ? 'SUPPORT' : 'AUTO');
                        
                        let costHtml = `<div style="color:gold; font-weight:bold; font-size:13px; font-family:'Orbitron'; margin-bottom:4px; text-shadow:1px 1px 2px #000; letter-spacing:1px;">[${partLabel}]</div>`;
                        
                        // 액션(A) 스킬에만 MP와 WT 기재
                        if (part === 'A') {
                            costHtml += `<span class="sc-mp">${s.mp || 0} MP</span><span class="sc-wt">${finalCost} WT</span>`;
                        }
                        
                        html += `
                            <div class="skill-card-modern" style="border-color:${slotColors[i]}; background:linear-gradient(90deg, #152515, #111); margin-bottom:10px;" onclick="window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${s.id}')" onmouseenter="window.game.skillManager.showSkillTooltip(event, ${this.selectedHeroIdx}, '${s.id}')" onmouseleave="window.game.townSystem.hideTooltip()">
                                <div class="sc-icon">${s.icon || '✨'}</div>
                                <div class="sc-info">
                                    <div class="sc-name">${s.name} <span style="background:#422; color:#f88; padding:2px 6px; border-radius:4px; font-size:9px; margin-left:10px; border:1px solid #f55;">UN-EQUIP</span></div>
                                    <div class="sc-desc">${s.desc || ''}</div>
                                </div>
                                <div class="sc-cost" style="align-items:flex-end;">
                                    ${costHtml}
                                </div>
                            </div>
                        `;
                    }
                }
            } else {
                // 비어있는 슬롯 렌더링
                html += `<div class="equipped-slot" style="border-color:${slotColors[i]}; color:${slotColors[i]}; opacity:0.6;">EMPTY : ${slotLabels[i]}</div>`;
            }
        }
        container.innerHTML = html;
    }

    renderAllSkills(hero) {
        const container = document.getElementById('skill-all-panel');
        if (!container) return;

        if (!hero.skills || hero.skills.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:50px; color:#666;">습득한 스킬이 없습니다.</div>`;
            return;
        }

        if (!this.expandedCategories) this.expandedCategories = {};
        
        // ⭐ [신규] 현재 선택된 필터 상태 (기본값: ALL)
        const currentFilter = this.currentSkillFilter || 'ALL';

        // ⭐ 1. 상단 고정(Sticky) 필터 버튼 UI 렌더링
        let html = `
            <div style="display:flex; gap:6px; margin-bottom:15px; padding-bottom:12px; border-bottom:1px solid #333; position:sticky; top:0; background:linear-gradient(180deg, #15151a 80%, transparent); z-index:10;">
                <button onclick="window.game.skillManager.setSkillFilter('ALL')" style="flex:1; padding:6px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; font-family:'Orbitron'; transition:0.2s; background:${currentFilter === 'ALL' ? '#444' : '#1a1a1a'}; color:${currentFilter === 'ALL' ? '#fff' : '#666'}; border:1px solid ${currentFilter === 'ALL' ? '#777' : '#333'}; box-shadow:${currentFilter === 'ALL' ? 'inset 0 0 5px rgba(255,255,255,0.2)' : 'none'};">ALL</button>
                <button onclick="window.game.skillManager.setSkillFilter('A')" style="flex:1; padding:6px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; font-family:'Orbitron'; transition:0.2s; background:${currentFilter === 'A' ? '#422' : '#1a1a1a'}; color:${currentFilter === 'A' ? '#f88' : '#666'}; border:1px solid ${currentFilter === 'A' ? '#f55' : '#333'}; box-shadow:${currentFilter === 'A' ? 'inset 0 0 5px rgba(255,0,0,0.3)' : 'none'};">ACTION</button>
                <button onclick="window.game.skillManager.setSkillFilter('S')" style="flex:1; padding:6px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; font-family:'Orbitron'; transition:0.2s; background:${currentFilter === 'S' ? '#234' : '#1a1a1a'}; color:${currentFilter === 'S' ? '#8af' : '#666'}; border:1px solid ${currentFilter === 'S' ? '#48f' : '#333'}; box-shadow:${currentFilter === 'S' ? 'inset 0 0 5px rgba(0,100,255,0.3)' : 'none'};">SUPPORT</button>
                <button onclick="window.game.skillManager.setSkillFilter('P')" style="flex:1; padding:6px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; font-family:'Orbitron'; transition:0.2s; background:${currentFilter === 'P' ? '#431' : '#1a1a1a'}; color:${currentFilter === 'P' ? '#fa5' : '#666'}; border:1px solid ${currentFilter === 'P' ? '#f80' : '#333'}; box-shadow:${currentFilter === 'P' ? 'inset 0 0 5px rgba(255,150,0,0.3)' : 'none'};">AUTO</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
        `;

        // ⭐ 2. 필터링된 스킬 데이터 그룹화
        const groups = { GENERAL: [] };
        let visibleCount = 0; 

        hero.skills.forEach(s => {
            if (!s) return;
            
            // 파트 판별 (하위 호환)
            const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
            
            // ⭐ [필터 작동] 선택된 필터에 맞지 않으면 화면에 그리지 않고 패스
            if (currentFilter !== 'ALL' && part !== currentFilter) return;

            const cat = (s.category && String(s.category).trim() !== '' && String(s.category).trim() !== '-') ? String(s.category).trim() : 'GENERAL';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
            visibleCount++;
        });

        if (visibleCount === 0) {
            html += `<div style="text-align:center; padding:30px; color:#666; font-size:12px;">조건에 맞는 스킬이 없습니다.</div></div>`;
            container.innerHTML = html;
            return;
        }

        const equippedIds = hero.equippedSkills || [];
        let heroCostRed = Formulas.getDerivedStat(hero, 'cost_red') || 1.0;
        if (heroCostRed <= 0) heroCostRed = 1.0;

        // 공통 렌더링 내부 함수 (가지치기 UI 및 개별 SP 적용)
        const renderCard = (s, isSub = false, isLast = false, isFirstSub = false) => {
            // ⭐ [기획 반영] tier 기반 레벨 검사 제거, req_class_lv 기반 클래스 레벨 검사 도입
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const currentClassLv = hero.classLevel || 1;
            const isLocked = currentClassLv < reqClassLv;

            // SP (스킬 숙련도 레벨) 바 계산
            let spInfoHtml = "";
            if (s.type !== 'PASSIVE') {
                const spData = (hero.sp && hero.sp[s.id]) ? hero.sp[s.id] : { level: 1, xp: 0 };
                const spReq = Formulas.SKILL_SP_REQ[spData.level] || 1;
                const isSpMax = spData.level >= 4;
                const spPct = isSpMax ? 100 : Math.min(100, (spData.xp / spReq) * 100);
                
                spInfoHtml = `
                <div style="margin-top:6px;">
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#f0f; font-weight:bold; margin-bottom:2px;">
                        <span>Lv.${spData.level}</span>
                        <span>${isSpMax ? 'MAX' : `${Math.floor(spData.xp)} / ${spReq}`}</span>
                    </div>
                    <div style="height:4px; background:#222; border-radius:2px; overflow:hidden;">
                        <div style="height:100%; width:${spPct}%; background:linear-gradient(90deg, #808, #f0f); box-shadow: 0 0 5px rgba(255,0,255,0.5);"></div>
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
            let statusBadge = isEquipped ? `<span style="color:#8f8; font-size:10px; margin-left:5px; flex-shrink:0;">[ 장착됨 ]</span>` : '';
            
            let onClick = "";
            if (!isSub) {
                onClick = isEquipped ? `onclick="window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${s.id}')"` : `onclick="window.game.skillManager.equipSkill(${this.selectedHeroIdx}, '${s.id}')"`;
                if (isLocked) onClick = `onclick="window.game.showAlert('클래스 ${reqClassLv}레벨에 해금됩니다.')"`;
                else if (!weaponMatch) onClick = `onclick="window.game.showAlert('장비가 일치하지 않습니다.')"`;
            } else {
                onClick = `onclick="window.game.showAlert('상위 카테고리 세트를 장착하면 전투 시 자동으로 활성화됩니다.')"`;
            }

            const finalCost = Math.floor((s.cost || 50) * Math.max(heroCostRed, 0.1));
            
            // ⭐ [수정됨] 스킬 파트 판별 및 노랗고 큰 텍스트 포맷 통일
            const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
            const partLabel = part === 'A' ? 'ACTION' : (part === 'S' ? 'SUPPORT' : 'AUTO');
            
            let costHtml = `<div style="color:gold; font-weight:bold; font-size:13px; font-family:'Orbitron'; margin-bottom:4px; text-shadow:1px 1px 2px #000; letter-spacing:1px;">[${partLabel}]</div>`;
            
            // 액션(A) 스킬에만 MP와 WT 기재
            if (part === 'A') {
                costHtml += `<span class="sc-mp">${s.mp || 0} MP</span><span class="sc-wt">${finalCost} WT</span>`;
            }

            let branchHtml = '';
            if (isSub) {
                let vLineBottom = isLast ? '50%' : '-10px';
                let vLineTop = isFirstSub ? '-10px' : '-10px'; 
                
                branchHtml = `
                    <div style="width: 30px; position:relative; flex-shrink:0;">
                        <div style="position:absolute; top:${vLineTop}; bottom:${vLineBottom}; left:15px; border-left:2px solid #555;"></div>
                        <div style="position:absolute; top:50%; left:15px; width:15px; border-top:2px solid #555;"></div>
                    </div>
                `;
            }

            return `
                <div style="display:flex; align-items:stretch; position:relative; margin-bottom:${isLast ? '0' : '10px'};">
                    ${branchHtml}
                    <div class="skill-card-modern ${stateClass}" style="${isSub ? 'flex:1; padding:8px; min-height:60px; margin:0;' : 'width:100%;'} ${isLocked ? 'opacity:0.5; border-style:dashed;' : ''}" ${onClick} onmouseenter="window.game.skillManager.showSkillTooltip(event, ${this.selectedHeroIdx}, '${s.id}')" onmouseleave="window.game.townSystem.hideTooltip()">
                        <div class="sc-icon" style="${isSub ? 'width:36px; height:36px; font-size:20px; margin-right:8px;' : ''}">${s.icon || '✨'}</div>
                        <div class="sc-info">
                            <div class="sc-name">${s.name} ${statusBadge} ${isLocked ? `<span style="background:#422; color:#f88; padding:2px 4px; border-radius:3px; font-size:9px; margin-left:5px;">클래스 ${reqClassLv} 필요</span>` : ''}</div>
                            <div class="sc-desc" style="${isSub ? 'font-size:10px;' : ''}">${s.desc || ''}</div>
                            ${spInfoHtml}
                        </div>
                        <div class="sc-cost" style="align-items:flex-end;">${costHtml}</div>
                    </div>
                </div>
            `;
        };

        // 3. 일반(단독) 스킬 렌더링
        if (groups.GENERAL && groups.GENERAL.length > 0) {
            groups.GENERAL.forEach(s => {
                html += renderCard(s, false, false, false);
            });
        }

        // 4. 카테고리 묶음 폴더(트리) 렌더링
        Object.keys(groups).forEach(cat => {
            if (cat === 'GENERAL') return;
            const subSkills = groups[cat];
            const catId = `CAT_${cat}`;
            const isEquipped = equippedIds.includes(catId);
            const isExpanded = this.expandedCategories[cat];
            
            const btnHtml = isEquipped 
                ? `<button onclick="event.stopPropagation(); window.game.skillManager.unequipSkill(${this.selectedHeroIdx}, '${catId}')" style="background:#422; color:#f88; border:1px solid #f55; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.5);">장착 해제</button>`
                : `<button onclick="event.stopPropagation(); window.game.skillManager.equipSkill(${this.selectedHeroIdx}, '${catId}')" style="background:#263; color:#afa; border:1px solid #5f5; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.5);">세트 장착</button>`;

            html += `
                <div style="background:#151515; border:1px solid ${isEquipped ? '#c5a059' : '#444'}; border-radius:8px; margin-bottom:5px; ${isEquipped ? 'box-shadow: 0 0 10px rgba(197,160,89,0.3);' : ''}">
                    <div style="display:flex; align-items:center; padding:12px 15px; background:linear-gradient(90deg, #252528, #111); cursor:pointer; border-radius:8px ${isExpanded ? '8px 0 0' : '8px'};" onclick="window.game.skillManager.toggleCategory('${cat}')">
                        <div style="width:20px; font-size:12px; color:gold; transition:0.2s;">${isExpanded ? '▼' : '▶'}</div>
                        <div style="flex:1; font-weight:bold; color:gold; font-size:14px; display:flex; align-items:center;">
                            <span style="font-size:18px; margin-right:8px;">📂</span> [ ${cat} ] 
                            <span style="font-size:11px; color:#aaa; font-weight:normal; margin-left:8px; background:#000; padding:2px 6px; border-radius:10px;">스킬 ${subSkills.length}종</span>
                        </div>
                        ${btnHtml}
                    </div>
                    <div style="display:${isExpanded ? 'flex' : 'none'}; flex-direction:column; padding:10px 15px 10px 5px; background:rgba(0,0,0,0.4); border-top:1px solid #333; border-radius:0 0 8px 8px; position:relative;">
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
        
        // ⭐ [신규] 배열을 항상 길이 6 고정 포맷으로 초기화 (구버전 호환)
        if (!hero.equippedSkills || hero.equippedSkills.length !== 6) {
            hero.equippedSkills = [null, null, null, null, null, null];
        }
        if (hero.equippedSkills.includes(skillId)) return;

        let part = 'A'; // 기본값
        if (skillId.startsWith('CAT_')) {
            part = 'A'; // 카테고리 묶음은 액션(A) 스킬로 취급
        } else {
            const skill = hero.skills.find(s => String(s.id) === String(skillId));
            if (!skill) return;

            // ⭐ [기획 반영] 클래스 레벨 요구치 확인
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
            // 기획안 호환 (엑셀의 part 값이 없으면 기존 type 바탕으로 유추)
            part = skill.part || (skill.type === 'PASSIVE' ? 'S' : 'A');
        }

        // ⭐ 파트에 따라 비어있는 전용 슬롯 탐색 (A: 0~2, S: 3~4, P: 5)
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
            // ⭐ splice로 배열 길이를 줄이는 대신 해당 자리를 비움(null)
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
            reqInfoHtml = `<div style="color:#aaa; font-size:10px; margin-top:4px; border-top:1px solid #444; padding-top:2px;">
                ⚔️ 필요 장비: <span style="color:#fff;">${s.reqWeapon.join(', ')}</span>
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
                    <div style='margin-top:2px; padding-top:2px; color:#ff6666; font-weight:bold;'>
                        ⛔ 사용 불가 (현재: ${weapon ? weapon.name : '맨손'})
                    </div>
                `;
            }
        }

        // ⭐ [수정됨] 툴팁에도 동일한 파트 포맷 적용
        const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
        const partLabel = part === 'A' ? 'ACTION' : (part === 'S' ? 'SUPPORT' : 'AUTO');
        
        let costHtml = `<span style='color:gold; font-weight:bold;'>[ ${partLabel} ]</span>`;
        
        if (part === 'A') {
            costHtml = `
                <span style='color:#0cf;'>MP ${s.mp || 0}</span>
                <span style='color:#f88;'>WT ${finalCost}</span>
            `;
        }

        const html = `
            <div style='color:gold; font-weight:bold; font-size:14px; margin-bottom:4px;'>${s.name}</div>
            <div style='font-size:12px; color:#ddd; margin-bottom:8px; line-height:1.4;'>${s.desc}</div>
            <div style='display:flex; gap:10px; font-size:11px; border-top:1px solid #555; padding-top:4px;'>
                ${costHtml}
                <span style='color:#aaa;'>Class Lv.${s.req_class_lv || 1}</span>
            </div>
            ${reqInfoHtml}
            ${warningHtml} 
        `;
        
        if(this.game.townSystem) this.game.townSystem.showTooltip(e, html);
    }
}