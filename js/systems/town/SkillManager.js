import { JOB_CLASS_DATA, SKILL_DATABASE, ELEMENTS } from '../../data/index.js';
import { STANDING_DATA } from '../../data/standing.js'; 

export class SkillManager {
    constructor(gameApp) {
        this.game = gameApp;
        this.selectedHeroIdx = 0;
        this.selectedSkillId = null; 
        this.expandedCategories = {};
        this.currentSkillFilter = 'A'; // 기본은 ACTION 탭
    }

    _getClassString(h) {
        let jobKeyStr = h.classKey || h.key || 'Unknown';
        if (typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === h.classKey || c.key === h.key);
            if (cInfo && cInfo.jobKey) jobKeyStr = cInfo.jobKey;
        }
        const formattedJobName = jobKeyStr.split(/[_ ]+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        return `${formattedJobName} (Class ${h.classLevel || 1})`;
    }

    getSkillCategory(skill) {
        if (!skill) return 'ACTION';
        const partStr = String(skill.part || '').toUpperCase().trim();
        if (partStr === 'A') return 'ACTION';
        if (partStr === 'S') return 'SUPPORT';
        if (partStr === 'P' || skill.type === 'PASSIVE') return 'AUTO';
        return 'ACTION'; 
    }

    // 스킬 구매 JP 자동 계산
    _getLearnJp(skill) {
        if (!skill) return 0;
        if (skill.learn_jp !== undefined && skill.learn_jp !== null && skill.learn_jp !== "") {
            return parseInt(skill.learn_jp);
        }
        const reqLv = parseInt(skill.req_class_lv) || 1;
        return reqLv * 100;
    }

    // ⭐ [신규 추가] 해당 영웅이 지금 당장 배울 수 있는 스킬이 하나라도 있는지 검사
    hasLearnableSkills(hero) {
        if (!hero || typeof SKILL_DATABASE === 'undefined') return false;
        
        let heroJobName = hero.job;
        if (!heroJobName && typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === hero.classKey);
            if (cInfo) heroJobName = cInfo.jobName;
        }

        const allJobSkills = Object.values(SKILL_DATABASE).filter(s => s && s.job === heroJobName);
        const currentClassLv = hero.classLevel || 1;
        const currentJp = hero.jpAvailable || 0;

        return allJobSkills.some(s => {
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const isLearned = hero.skillIds && hero.skillIds.includes(String(s.id));
            const learnJp = this._getLearnJp(s);
            // 안 배웠고, 클래스 렙도 되고, 돈(JP)도 있으면 배울 수 있음!
            return !isLearned && currentClassLv >= reqClassLv && currentJp >= learnJp;
        });
    }

    openUI() {
        if (!window.game) return;

        let modal = document.getElementById('skill-ui-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'skill-ui-modal';
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
                <h2 style="margin:0; font-family:'Cinzel', serif; font-size:36px; color:#3e2723; letter-spacing:4px; font-weight:bold; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);">TRAINING GROUND</h2>
                <div style="display:flex; gap:15px;">
                    <button id="btn-skill-to-hero" style="background:#f4ebd8; color:#3e2723; border:2px solid #5d4037; padding:10px 20px; font-family:'Cinzel', serif; font-size:14px; font-weight:bold; cursor:pointer; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); transition: 0.2s;" onmouseover="this.style.background='#fff'; this.style.borderColor='#8b0000'; this.style.color='#8b0000';" onmouseout="this.style.background='#f4ebd8'; this.style.borderColor='#5d4037'; this.style.color='#3e2723';">▶ CHARACTER</button>
                    <button id="btn-skill-to-party" style="background:#f4ebd8; color:#3e2723; border:2px solid #5d4037; padding:10px 20px; font-family:'Cinzel', serif; font-size:14px; font-weight:bold; cursor:pointer; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); transition: 0.2s;" onmouseover="this.style.background='#fff'; this.style.borderColor='#8b0000'; this.style.color='#8b0000';" onmouseout="this.style.background='#f4ebd8'; this.style.borderColor='#5d4037'; this.style.color='#3e2723';">▶ PARTY</button>
                    <button id="btn-skill-close" style="background:#3e2723; color:#ebd9b4; border:2px solid #1a110a; padding:10px 40px; font-family:'Cinzel', serif; font-size:16px; font-weight:bold; cursor:pointer; box-shadow: 2px 4px 6px rgba(0,0,0,0.4); transition: background 0.2s;" onmouseover="this.style.background='#8b0000'" onmouseout="this.style.background='#3e2723'">BACK</button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 280px minmax(350px, 1fr) minmax(350px, 1fr); gap: 25px; padding: 25px 40px; flex: 1; overflow: hidden; height: calc(100vh - 80px); box-sizing: border-box; background: transparent;">
                
                <div style="display: flex; flex-direction: column; overflow: hidden; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                    <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">CHARACTER</div>
                    <div id="skill-jp-header" style="background:#3e2723; color:#ffd700; padding:10px; text-align:center; font-weight:bold; font-size:16px; font-family:var(--font-main); border-bottom:2px solid #1a110a;"></div>
                    <div id="skill-manage-list" style="flex:1; overflow-y:auto; padding:15px 10px; display:flex; flex-direction:column; gap:10px;"></div>
                </div>
                
                <div style="display: flex; flex-direction: column; overflow: hidden; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                    <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">SKILL CATALOG</div>
                    <div id="skill-catalog-panel" style="flex:1; overflow-y:auto; padding:20px;"></div>
                </div>

                <div style="display: flex; flex-direction: column; overflow: hidden; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1);">
                    <div style="font-family:'Cinzel',serif; font-size:18px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px; text-align:center; letter-spacing:2px; flex-shrink:0;">DETAILS & LEARN</div>
                    <div id="skill-detail-panel" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column;"></div>
                </div>
            </div>
        `;

        const closeBtn = document.getElementById('btn-skill-close');
        if(closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        
        const toHeroBtn = document.getElementById('btn-skill-to-hero');
        if(toHeroBtn) toHeroBtn.onclick = () => { modal.style.display = 'none'; if(this.game.heroManager) this.game.heroManager.openUI(); };
        
        const toPartyBtn = document.getElementById('btn-skill-to-party');
        if(toPartyBtn) toPartyBtn.onclick = () => { modal.style.display = 'none'; if(this.game.partyManager) this.game.partyManager.openUI(); };
        
        modal.style.display = 'flex';
        this.selectedSkillId = null; 
        this.renderUI();
    }

    renderUI() {
        const hero = (this.selectedHeroIdx !== null && this.selectedHeroIdx !== undefined) 
            ? this.game.gameState.heroes[this.selectedHeroIdx] 
            : null;

        this.renderHeroList(hero);
        
        if (hero) {
            this.renderSkillCatalog(hero);
            this.renderSkillDetails(hero);
        } else {
            document.getElementById('skill-catalog-panel').innerHTML = `<div style="text-align:center; padding:50px; color:#5d4037; font-weight:bold;">영웅을 선택하세요</div>`;
            document.getElementById('skill-detail-panel').innerHTML = '';
        }
    }

    renderHeroList(hero) {
        const listEl = document.getElementById('skill-manage-list');
        const jpHeader = document.getElementById('skill-jp-header');
        if (!listEl) return;

        if (hero && jpHeader) {
            jpHeader.innerHTML = `보유 JP : 💎 ${hero.jpAvailable || 0} / ${hero.jpTotal || 0}`;
        }
        
        listEl.innerHTML = '';
        
        for (let i = 0; i < this.game.gameState.heroes.length; i++) {
            const h = this.game.gameState.heroes[i];
            if (!h) continue;
            
            const isSelected = (i === this.selectedHeroIdx);
            
            // ⭐ 캐릭터 매니저와 동일하게 스탠딩 이미지 (3번째 프레임) 사용!
            const standingSrc = STANDING_DATA[h.classKey || h.key];
            const iconHtml = standingSrc 
                ? `<div style="width:100%; height:100%; background-image:url('${standingSrc}'); background-size:600% 100%; background-position: 40% center; background-repeat:no-repeat; background-color:transparent;"></div>` 
                : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:26px; background:transparent;">${h.icon}</div>`;
            
            const classString = this._getClassString(h);
            const bgStyle = isSelected ? 'background: #fff; border-color: #8b0000; box-shadow: inset 4px 0 0 #8b0000;' : 'background: #f4ebd8; border-color: #d4bc96;';
            const nameColor = isSelected ? 'color: #8b0000;' : 'color: #3e2723;';

            // ⭐ [추가] 배울 수 있는 스킬이 있다면 캐릭터 아이콘 우측 상단에 빨간 점 추가
            const hasRedDot = this.hasLearnableSkills(h);
            const redDotHtml = hasRedDot 
                ? `<div style="position:absolute; top:-4px; right:-4px; width:14px; height:14px; background:#ff1111; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px rgba(255,0,0,0.5); z-index:10;"></div>` 
                : '';

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `display:flex; align-items:center; padding:8px 10px; border:2px solid; ${bgStyle} cursor:pointer; transition:0.2s;`;
            itemDiv.onclick = () => this.changeSelectedHero(i);
            itemDiv.onmouseover = () => { if(!isSelected) itemDiv.style.borderColor = '#8b0000'; };
            itemDiv.onmouseout = () => { if(!isSelected) itemDiv.style.borderColor = '#d4bc96'; };

            itemDiv.innerHTML = `
                <div style="position:relative; width:56px; height:56px; margin-right:15px; flex-shrink:0;">
                    <div style="width:100%; height:100%; border:none; background:transparent; overflow:hidden; border-radius:4px;">
                        ${iconHtml}
                    </div>
                    ${redDotHtml}
                </div>
                <div style="flex:1; line-height:1.4; overflow:hidden;">
                    <div style="font-weight:bold; font-size:15px; ${nameColor} white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${h.name}</div>
                    <div style="font-size:12px; font-weight:bold; color:#555;">Lv.${h.level} &nbsp;💎 ${h.jpAvailable || 0}</div>
                    <div style="font-size:11px; color:#5d4037; font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${classString}</div>
                </div>
            `;
            listEl.appendChild(itemDiv);
        }
    }

    changeSelectedHero(idx) {
        this.selectedHeroIdx = idx;
        this.selectedSkillId = null; 
        this.renderUI();
    }

    setSkillFilter(filterType) {
        this.currentSkillFilter = filterType;
        this.selectedSkillId = null; 
        this.renderUI();
    }

    toggleCategory(catName) {
        this.expandedCategories[catName] = !this.expandedCategories[catName];
        this.renderUI();
    }

    renderSkillCatalog(hero) {
        const container = document.getElementById('skill-catalog-panel');
        if (!container) return;

        const currentFilter = this.currentSkillFilter || 'A';

        // 1. 탭 버튼을 그리기 전에 모든 스킬 데이터를 먼저 수집합니다. (빨간 점 계산용)
        let heroJobName = hero.job;
        if (!heroJobName && typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === hero.classKey);
            if (cInfo) heroJobName = cInfo.jobName;
        }

        let allJobSkills = [];
        if (typeof SKILL_DATABASE !== 'undefined') {
            allJobSkills = Object.values(SKILL_DATABASE).filter(s => s && s.job === heroJobName);
        }

        const currentClassLv = hero.classLevel || 1;
        const currentJp = hero.jpAvailable || 0;

        // ⭐ 특정 탭(A, S, P) 내부에 배울 수 있는 스킬이 존재하는지 검사하는 내부 함수
        const checkLearnableForFilter = (filterKey) => {
            return allJobSkills.some(s => {
                // 카테고리 분류 (기존 오타 보정: PASSIVE는 P로)
                let part = String(s.part || '').toUpperCase().trim();
                if (part !== 'A' && part !== 'S' && part !== 'P') {
                    part = (s.type === 'PASSIVE') ? 'P' : 'A';
                }
                
                if (part !== filterKey) return false;

                const reqClassLv = parseInt(s.req_class_lv) || 1;
                const isLearned = hero.skillIds && hero.skillIds.includes(String(s.id));
                const learnJp = this._getLearnJp(s); 
                return !isLearned && currentClassLv >= reqClassLv && currentJp >= learnJp;
            });
        };

        // 2. 필터 버튼 렌더링 (⭐ 버튼 우측 상단에 빨간 점 추가)
        let html = `
            <div style="display:flex; gap:10px; margin-bottom:20px; position:sticky; top:0; background:rgba(235, 217, 180, 0.95); padding-bottom:15px; border-bottom:2px dotted #5d4037; z-index:10;">
                ${['A', 'S', 'P'].map(f => {
                    const hasDot = checkLearnableForFilter(f);
                    const dotHtml = hasDot 
                        ? `<div style="position:absolute; top:-4px; right:-4px; width:12px; height:12px; background:#ff1111; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px rgba(255,0,0,0.8); z-index:10;"></div>`
                        : '';
                    const title = f === 'A' ? 'ACTION' : (f === 'S' ? 'SUPPORT' : 'AUTO');
                    
                    return `
                    <button onclick="window.game.skillManager.setSkillFilter('${f}')" 
                            style="position:relative; flex:1; padding:10px 0; font-weight:bold; font-family:'Cinzel',serif; cursor:pointer; transition:0.2s; border:2px solid #5d4037; 
                            background:${currentFilter === f ? '#3e2723' : '#f4ebd8'}; color:${currentFilter === f ? '#ebd9b4' : '#3e2723'}; font-size:14px;">
                        ${title}
                        ${dotHtml}
                    </button>
                    `;
                }).join('')}
            </div>
            <div style="display:flex; flex-direction:column; gap:15px;">
        `;

        const groups = { GENERAL: [] };
        let visibleCount = 0; 

        // 3. 현재 탭(currentFilter)에 맞는 스킬만 화면에 표시하기 위해 그룹화
        allJobSkills.forEach(s => {
            if (!s) return;
            
            let part = String(s.part || '').toUpperCase().trim();
            if (part !== 'A' && part !== 'S' && part !== 'P') {
                part = (s.type === 'PASSIVE') ? 'P' : 'A';
            }

            if (part !== currentFilter) return; 

            const cat = (s.category && String(s.category).trim() !== '' && String(s.category).trim() !== '-') ? String(s.category).trim() : 'GENERAL';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
            visibleCount++;
        });

        if (visibleCount === 0) {
            container.innerHTML = html + `<div style="text-align:center; padding:40px; color:#5d4037; font-weight:bold;">해당 분류에 속한 스킬이 없습니다.</div></div>`;
            return;
        }

        const renderCard = (s) => {
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const isLocked = currentClassLv < reqClassLv;
            const isLearned = hero.skillIds && hero.skillIds.includes(String(s.id));
            const isSelected = (this.selectedSkillId === s.id);
            const learnJp = this._getLearnJp(s); 
            
            // 스킬 개별 카드 빨간 점 로직
            const canAfford = currentJp >= learnJp;
            const isLearnable = !isLocked && !isLearned && canAfford;
            const skillRedDotHtml = isLearnable 
                ? `<div style="position:absolute; top:-4px; left:-4px; width:14px; height:14px; background:#ff1111; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px rgba(255,0,0,0.8); z-index:10;"></div>` 
                : '';

            let stateStyle = '';
            let rightHtml = '';

            // 우측 상태/비용 표시
            if (isLocked) {
                stateStyle = 'background:rgba(93,64,55,0.1); border:2px dashed #5d4037; filter:grayscale(100%); opacity:0.7;';
                rightHtml = `
                    <div style="text-align:right;">
                        <div style="color:#b8860b; font-weight:bold; font-size:12px;">💎 ${learnJp} JP</div>
                        <div style="color:#8b0000; font-weight:bold; font-size:12px; margin-top:2px;">🔒 Class ${reqClassLv}</div>
                    </div>
                `;
            } else if (isLearned) {
                stateStyle = 'background:#d7ccc8; border:2px solid #5d4037; opacity:0.8;';
                rightHtml = `<span style="color:#2e7d32; font-weight:bold; font-size:13px;">✔ 습득완료</span>`;
            } else {
                stateStyle = 'background:#fff; border:2px solid #b8860b; box-shadow: 0 2px 4px rgba(184,134,11,0.2);';
                rightHtml = `<span style="color:#b8860b; font-weight:bold; font-size:14px;">💎 ${learnJp} JP</span>`;
            }

            if (isSelected) {
                stateStyle += ' border-color:#8b0000; box-shadow: 0 0 8px rgba(139,0,0,0.5); transform:scale(1.02); z-index:2;';
            }

            let combatCostHtml = '';
            if (this.getSkillCategory(s) === 'ACTION') {
                combatCostHtml = `<span style="color:#0d47a1; margin-left:8px; font-weight:bold;">MP ${s.mp||0}</span> <span style="color:#8b0000; margin-left:4px; font-weight:bold;">WT ${s.cost||0}</span>`;
            }

            return `
                <div style="position:relative; ${stateStyle} display:flex; align-items:center; padding:12px 15px; margin-bottom:8px; cursor:pointer; transition:0.2s;"
                     onclick="window.game.skillManager.selectSkill('${s.id}')">
                    ${skillRedDotHtml}
                    <div style="font-size:28px; margin-right:15px; text-shadow:1px 1px 2px rgba(0,0,0,0.3);">${s.icon || '✨'}</div>
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:15px; color:#3e2723;">${s.name}</div>
                        <div style="font-size:11px; color:#555; margin-top:4px;">
                            <span style="border:1px solid #888; padding:1px 4px; border-radius:2px;">${this.getSkillCategory(s)}</span>
                            ${combatCostHtml}
                        </div>
                    </div>
                    <div>${rightHtml}</div>
                </div>
            `;
        };

        if (groups.GENERAL && groups.GENERAL.length > 0) {
            groups.GENERAL.forEach(s => { html += renderCard(s); });
        }

        Object.keys(groups).forEach(cat => {
            if (cat === 'GENERAL') return;
            const subSkills = groups[cat];
            const isExpanded = this.expandedCategories[cat] !== false; 
            
            const learnedCount = subSkills.filter(s => hero.skillIds && hero.skillIds.includes(String(s.id))).length;

            html += `
                <div style="border: 2px solid #5d4037; background: #f4ebd8; margin-bottom: 12px; box-shadow:1px 1px 3px rgba(0,0,0,0.1);">
                    <div style="display:flex; align-items:center; padding:12px 15px; background: #3e2723; cursor:pointer; color: #ebd9b4;" onclick="window.game.skillManager.toggleCategory('${cat}')">
                        <div style="font-size:14px; margin-right:10px; width:20px; text-align:center;">${isExpanded ? '▼' : '▶'}</div>
                        <div style="font-weight:bold; font-size:15px; flex:1;">
                            📂 [세트] ${cat} <span style="font-size:12px; color:#aaa; font-weight:normal; margin-left:8px;">(습득 ${learnedCount}/${subSkills.length})</span>
                        </div>
                    </div>
                    <div style="display:${isExpanded ? 'block' : 'none'}; padding:10px; background:rgba(255,255,255,0.3);">
                        ${subSkills.map(s => renderCard(s)).join('')}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    }

    selectSkill(skillId) {
        this.selectedSkillId = skillId;
        this.renderUI();
    }

    renderSkillDetails(hero) {
        const container = document.getElementById('skill-detail-panel');
        if (!container) return;

        if (!this.selectedSkillId) {
            container.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#888; font-weight:bold; text-align:center;">
                <div style="font-size:50px; margin-bottom:20px; opacity:0.3;">📜</div>
                <div>목록에서 스킬을 선택하면<br>상세 정보가 표시됩니다.</div>
            </div>`;
            return;
        }

        const skill = SKILL_DATABASE[this.selectedSkillId];
        if (!skill) return;

        const reqClassLv = parseInt(skill.req_class_lv) || 1;
        const isLocked = (hero.classLevel || 1) < reqClassLv;
        const isLearned = hero.skillIds && hero.skillIds.includes(String(skill.id));
        const learnJp = this._getLearnJp(skill); 
        const currentJp = hero.jpAvailable || 0;
        const canAfford = currentJp >= learnJp;

        const catStr = this.getSkillCategory(skill);
        const partColor = catStr === 'ACTION' ? '#8b0000' : (catStr === 'SUPPORT' ? '#0d47a1' : '#f57f17');

        let specsHtml = '';
        if (catStr === 'ACTION') {
            specsHtml += `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:rgba(255,255,255,0.4); padding:15px; border:1px dashed #d4bc96; margin-bottom:20px;">
                    <div style="font-size:13px;"><b style="color:#5d4037;">소모 MP:</b> <span style="color:#0d47a1; font-weight:bold;">${skill.mp || 0}</span></div>
                    <div style="font-size:13px;"><b style="color:#5d4037;">대기 시간(WT):</b> <span style="color:#8b0000; font-weight:bold;">${skill.cost || 0}</span></div>
                    <div style="font-size:13px;"><b style="color:#5d4037;">기본 위력:</b> <span style="color:#3e2723; font-weight:bold;">${skill.power ? (skill.power * 100) + '%' : '없음'}</span></div>
                    <div style="font-size:13px;"><b style="color:#5d4037;">사거리:</b> <span style="color:#3e2723; font-weight:bold;">${skill.rng || 1} 칸</span></div>
                </div>
            `;
        }

        let effectsHtml = `<div style="font-size:14px; color:#3e2723; line-height:1.6; margin-bottom:20px; padding:15px; background:#fff; border-left:4px solid ${partColor}; box-shadow:1px 1px 3px rgba(0,0,0,0.1);">${skill.desc}</div>`;

        let btnHtml = '';
        if (isLocked) {
            btnHtml = `
                <div style="margin-top:auto; background:rgba(93,64,55,0.1); border:2px dashed #5d4037; padding:20px; text-align:center;">
                    <div style="color:#8b0000; font-weight:bold; font-size:16px; margin-bottom:5px;">🔒 접근 불가</div>
                    <div style="color:#555; font-size:13px;">이 스킬을 배우려면 먼저 [클래스 레벨 ${reqClassLv}] 에 도달해야 합니다.</div>
                </div>
            `;
        } else if (isLearned) {
            btnHtml = `
                <div style="margin-top:auto; background:#e8f5e9; border:2px solid #2e7d32; padding:20px; text-align:center;">
                    <div style="color:#2e7d32; font-weight:bold; font-size:18px;">✔️ 습득 완료</div>
                    <div style="color:#555; font-size:13px; margin-top:5px;">장착은 캐릭터 관리(CHARACTER) 창에서 가능합니다.</div>
                </div>
            `;
        } else if (!canAfford) {
            btnHtml = `
                <div style="margin-top:auto; background:#fff; border:2px solid #8b0000; padding:20px; text-align:center;">
                    <button disabled style="width:100%; background:#ccc; color:#666; border:none; padding:15px; font-weight:bold; font-size:16px; cursor:not-allowed;">💎 ${learnJp} JP 로 습득</button>
                    <div style="color:#8b0000; font-weight:bold; font-size:13px; margin-top:10px;">가용 JP가 부족합니다. (현재: ${currentJp} JP)</div>
                </div>
            `;
        } else {
            btnHtml = `
                <div style="margin-top:auto; background:#fff; border:2px solid #b8860b; padding:20px; text-align:center; box-shadow:0 -4px 10px rgba(0,0,0,0.05);">
                    <div style="color:#3e2723; font-weight:bold; font-size:14px; margin-bottom:10px;">필요 비용: 💎 <span style="color:#b8860b; font-size:16px;">${learnJp} JP</span></div>
                    <button onclick="window.game.skillManager.learnSkill(${this.selectedHeroIdx}, '${skill.id}')" 
                            style="width:100%; background:#b8860b; color:#fff; border:2px solid #5d4037; padding:15px; font-weight:bold; font-size:18px; cursor:pointer; transition:0.2s; box-shadow:2px 2px 0px #5d4037;"
                            onmouseover="this.style.background='#d4af37'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='#b8860b'; this.style.transform='translateY(0)';">
                        스킬 습득하기
                    </button>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="display:flex; align-items:center; margin-bottom:20px; border-bottom:2px solid #5d4037; padding-bottom:20px;">
                <div style="font-size:50px; margin-right:20px; filter:drop-shadow(2px 4px 6px rgba(0,0,0,0.3));">${skill.icon || '✨'}</div>
                <div>
                    <div style="font-size:24px; font-weight:bold; color:#3e2723; font-family:var(--font-main);">${skill.name}</div>
                    <div style="font-size:13px; font-weight:bold; color:${partColor}; margin-top:5px; border:1px solid ${partColor}; display:inline-block; padding:2px 6px;">${catStr} SKILL</div>
                </div>
            </div>
            
            ${specsHtml}
            ${effectsHtml}
            ${btnHtml}
        `;
    }

    learnSkill(heroIdx, skillId) {
        const hero = this.game.gameState.heroes[heroIdx];
        if (!hero) return;

        const skillData = SKILL_DATABASE[skillId];
        if (!skillData) return;

        const reqClassLv = parseInt(skillData.req_class_lv) || 1;
        if ((hero.classLevel || 1) < reqClassLv) {
            this.game.showAlert(`클래스 ${reqClassLv}레벨에 해금됩니다.`);
            return;
        }

        if (hero.skillIds && hero.skillIds.includes(String(skillId))) {
            this.game.showAlert("이미 습득한 스킬입니다.");
            return;
        }

        const reqJp = this._getLearnJp(skillData);
        const currentJp = hero.jpAvailable || 0;

        if (currentJp < reqJp) {
            this.game.showAlert(`JP가 부족합니다! (필요: ${reqJp} / 보유: ${currentJp})`);
            return;
        }

        hero.jpAvailable -= reqJp;
        if (!hero.skillIds) hero.skillIds = [];
        hero.skillIds.push(String(skillId));
        if (!hero.skills) hero.skills = [];
        hero.skills.push(JSON.parse(JSON.stringify({ ...skillData, id: String(skillId) })));
        if (!hero.sp) hero.sp = {};
        hero.sp[String(skillId)] = { level: 1, xp: 0 };

        this.game.saveGame();
        
        const detailPanel = document.getElementById('skill-detail-panel');
        if(detailPanel) {
            detailPanel.style.transition = '0.3s';
            detailPanel.style.backgroundColor = '#e8f5e9';
            setTimeout(() => { detailPanel.style.backgroundColor = 'transparent'; }, 300);
        }

        this.renderUI();
    }
}