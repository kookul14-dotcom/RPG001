import { 
    ITEM_DATA, 
    SKILL_DATABASE, 
    CLASS_DATA, 
    TIER_REQ, 
    EFFECTS, 
    ELEMENTS,
    TERRAIN_TYPES 
} from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';

export class BattleUI {
    constructor(battleSystem, canvas) {
        this.battle = battleSystem;
        this.canvas = canvas;
        
        this.textQueue = [];
        this.lastTextTime = 0;

        this.overlayContainer = document.getElementById('unit-overlays');
        if (!this.overlayContainer) {
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'unit-overlays';
            Object.assign(this.overlayContainer.style, {
                position: 'absolute', top: '0', left: '0', 
                pointerEvents: 'none', width: '100%', height: '100%', zIndex: '100'
            });
            document.body.appendChild(this.overlayContainer);
        }

        this.renderLoop = this.renderLoop.bind(this);
        requestAnimationFrame(this.renderLoop);
    }

    renderLoop() {
        if (this.battle.isBattleEnded) return;
        this.renderUnitOverlays();
        this.processTextQueue();
        requestAnimationFrame(this.renderLoop);
    }

    renderUnitOverlays() {
        if (!this.overlayContainer) return;
        this.overlayContainer.innerHTML = '';
        
        // [설정] 유닛 머리 위 높이 오프셋
        const UNIT_HEIGHT_OFFSET = 20; 
        const UNIT_LEFT_OFFSET = -260;

        // 현재 확대 배율 가져오기
        const currentScale = this.battle.grid ? (this.battle.grid.scale || 1) : 1;

        this.battle.units.forEach(u => {
            if (u.curHp <= 0) return;

            const pos = this.getUnitScreenPos(u);
            // 화면 밖 렌더링 제외
            if (pos.x < -50 || pos.x > window.innerWidth + 50 || pos.y < -50 || pos.y > window.innerHeight + 50) return;
            
            const div = document.createElement('div');
            div.className = 'unit-overlay';
            
            // [위치 고정] 유닛 머리 위 좌표 계산
            const finalX = pos.x + (UNIT_LEFT_OFFSET * currentScale);
            const finalY = pos.y - (UNIT_HEIGHT_OFFSET * currentScale);

            div.style.left = finalX + 'px';
            div.style.top = finalY + 'px'; 
            
            if (u === this.battle.currentUnit) div.style.zIndex = '8000'; 

            // --- 데이터 계산 ---
            const maxHp = u.hp || 1; // 0 나누기 방지
            const curHp = u.curHp || 0;
            
            // [수정] buffs가 없으면 빈 배열로 취급하여 find 에러 방지
            const safeBuffs = u.buffs || []; 
            const shieldBuff = safeBuffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
            const shieldVal = shieldBuff ? shieldBuff.amount : 0;
            
            const totalMax = Math.max(maxHp, curHp + shieldVal);
            const hpPct = (curHp / totalMax) * 100;
            const shieldPct = (shieldVal / totalMax) * 100;
            
            let agPct, agColor;
            // actionGauge가 undefined일 경우 대비
            const ag = u.actionGauge || 0; 
            if (ag >= 0) { 
                agPct = Math.min(100, (ag / this.battle.actionGaugeLimit) * 100); 
                agColor = '#ffd700';
            } else { 
                agPct = Math.min(100, (Math.abs(ag) / 50) * 100); 
                agColor = '#ff3333';
            }

            // [상태 아이콘 중복 제거]
            const uniqueBuffs = [];
            const seenTypes = new Set();
            // [수정] safeBuffs 사용
            if (safeBuffs.length > 0) {
                safeBuffs.forEach(b => {
                    if (!seenTypes.has(b.type)) {
                        seenTypes.add(b.type);
                        uniqueBuffs.push(b);
                    }
                });
            }

            const hasBuffs = uniqueBuffs.length > 0;
            const statusIconsHtml = hasBuffs
                ? uniqueBuffs.slice(0, 5).map(b => `<div class="status-icon-mini">${b.icon || '🔸'}</div>`).join('') 
                : '';
            
            const statusDisplay = hasBuffs ? 'flex' : 'none';

            // [턴 하이라이트]
            let highlight = '';
            if (u === this.battle.currentUnit) {
                highlight = `<div class="turn-highlight-circle"></div>`;
            }
            
            // ▼▼▼ [신규] 발견 알림 느낌표 생성 ▼▼▼
            let discoveryMark = '';
            if (u.isDiscoverySignaling) {
                discoveryMark = `
                    <div style="
                        position: absolute; 
                        top: -55px; left: 50%; 
                        transform: translateX(-50%); 
                        font-size: 28px; 
                        color: #ffdd00; 
                        font-weight: bold; 
                        text-shadow: 0 0 5px #ff0000, 0 0 10px #ff0000;
                        z-index: 9999;
                        pointer-events: none;
                        animation: floatMark 1s infinite ease-in-out;
                    ">!</div>
                    <style>
                        @keyframes floatMark {
                            0%, 100% { transform: translateX(-50%) translateY(0); }
                            50% { transform: translateX(-50%) translateY(-5px); }
                        }
                    </style>
                `;
            }
           let speechBubbleHtml = '';
            if (u.speechText) {
                // 스타일은 CSS(.speech-bubble)에서 처리
                speechBubbleHtml = `<div class="speech-bubble">${u.speechText}</div>`;
            }
            div.innerHTML = `
                ${highlight}
                ${discoveryMark}
                ${speechBubbleHtml} <div class="overlay-anchor-group">
                    <div class="status-row" style="display:${statusDisplay}; gap:1px; margin-bottom:2px; justify-content:center;">
                        ${statusIconsHtml}
                    </div>
                    
                    <div class="bar-group">
                        <div class="hp-row">
                            <div class="hp-fill" style="width:${hpPct}%; background:${u.team===0?'#4f4':'#f44'}"></div>
                            ${shieldVal > 0 ? `<div class="shield-fill" style="width:${shieldPct}%"></div>` : ''}
                        </div>
                        <div class="ag-row">
                            <div class="ag-fill" style="width:${agPct}%; background:${agColor};"></div>
                        </div>
                    </div>
                </div>
                <div class="name-tag">${u.name}</div>
            `;
            
            this.overlayContainer.appendChild(div);
        });

        this.updateFloatingPosition();
    }

    updateFloatingPosition() {
        const wrapper = document.getElementById('floating-controls');
        const u = this.battle.currentUnit;
        
        if (wrapper && u && this.battle.grid && this.battle.grid.canvas) {
            const screenPos = this.getUnitScreenPos(u); 
            wrapper.style.left = screenPos.x + 'px';
            wrapper.style.top = (screenPos.y - 50) + 'px';
        }
    }

    getUnitScreenPos(unit) {
        let worldX, worldY;
        if (unit.visualPos) { worldX = unit.visualPos.x; worldY = unit.visualPos.y; }
        else {
            const tKey = this.battle.grid.getTerrain(unit.q, unit.r);
            const height = TERRAIN_TYPES[tKey]?.height || 0;
            const p = this.battle.grid.hexToPixel3D(unit.q, unit.r, height);
            worldX = p.x; worldY = p.y;
        }
        
        const cx = worldX - this.battle.camera.x;
        const cy = worldY - this.battle.camera.y;
        const rect = this.canvas.getBoundingClientRect();
        return { x: rect.left + cx, y: rect.top + cy };
    }

    getHexScreenPos(q, r) {
        const tKey = this.battle.grid.getTerrain(q, r);
        const height = TERRAIN_TYPES[tKey]?.height || 0;
        const p = this.battle.grid.hexToPixel3D(q, r, height);
        
        const cx = p.x - this.battle.camera.x;
        const cy = p.y - this.battle.camera.y;
        const rect = this.canvas.getBoundingClientRect();
        return { x: rect.left + cx, y: rect.top + cy };
    }

    updateFloatingControls() {
        const wId = 'floating-controls';
        const oldWrapper = document.getElementById(wId);
        const u = this.battle.currentUnit;
        
        // 1. 유닛이 없거나 내 턴이 아니거나 [평화모드]이면 숨김
        // (this.battle.isPeaceful 조건 추가)
        if (!u || u.team !== 0 || this.battle.isProcessingTurn || this.battle.isPeaceful || !this.battle.grid || !this.battle.grid.canvas) {
            if (oldWrapper) oldWrapper.classList.add('hud-hidden');
            return;
        }

        let wrapper = oldWrapper;
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = wId;
            document.body.appendChild(wrapper);
        }
        
        const selSkill = this.battle.selectedSkill;
        
        // 타겟팅이 불필요한 스킬 확인
        const isSelfCast = selSkill && ['SELF', 'AREA_SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'AREA_ALL'].includes(selSkill.target);

        // 숨김 조건 체크
        if (window.isHudHidden || (selSkill && !isSelfCast)) {
            wrapper.classList.add('hud-hidden');
            return; 
        } else {
            wrapper.classList.remove('hud-hidden');
        }

        const containerStyle = `
            display: flex; 
            flex-direction: row; 
            align-items: center; 
            gap: 4px; 
            background: rgba(20, 20, 20, 0.9); 
            padding: 5px; 
            border-radius: 8px; 
            border: 1px solid #555;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            white-space: nowrap;
            pointer-events: auto;
        `;

        const btnStyle = `
            width: 36px; height: 36px; 
            display: flex; align-items: center; justify-content: center;
            border: 1px solid #444; border-radius: 4px; 
            background: #25252a; cursor: pointer; 
            font-size: 20px; position: relative;
            transition: all 0.1s;
        `;

        const sepStyle = `width:1px; height:24px; background:#555; margin:0 2px;`;

        let htmlContent = '';

        // [자가 시전 스킬 선택 상태] -> [시전] / [취소] 버튼 표시
        if (isSelfCast) {
             htmlContent = `
                <div style="display:flex; flex-direction:column; align-items:center; margin-right:8px;">
                    <div style="font-size:20px;">${selSkill.icon || '✨'}</div>
                    <div style="font-size:10px; color:gold; font-weight:bold;">${selSkill.name}</div>
                </div>
                
                <div class="float-btn" style="${btnStyle} border-color:#484; background:#262; color:#afa; font-weight:bold; font-size:12px;"
                     onclick="window.battle.confirmSkillSelf()"
                     onmouseenter="window.battle.ui.showTooltip(event, '스킬 시전')"
                     onmouseleave="window.battle.ui.hideTooltip()">
                    시전
                </div>
                
                <div class="float-btn" style="${btnStyle} border-color:#844; background:#622; color:#faa; font-weight:bold; font-size:12px;"
                     onclick="window.battle.selectedSkill=null; window.battle.updateFloatingControls(); window.battle.updateCursor(); window.battle.updateStatusPanel();"
                     onmouseenter="window.battle.ui.showTooltip(event, '취소')"
                     onmouseleave="window.battle.ui.hideTooltip()">
                    취소
                </div>
            `;
        } 
        else {
            // [일반 상태] -> 스킬 목록 표시

            // --- [A] 기본 공격 ---
            const basicId = u.equippedBasic || '1000';
            let basicSkill = u.skills.find(s => s.id === basicId);
            if(!basicSkill && SKILL_DATABASE[basicId]) {
                basicSkill = { ...SKILL_DATABASE[basicId], id: basicId };
            }
            
            if (basicSkill) {
                const isSel = (this.battle.selectedSkill && this.battle.selectedSkill.id === basicSkill.id);
                const bStyle = isSel ? 'border-color: gold; background: #443300; box-shadow: 0 0 5px gold;' : '';
                
                htmlContent += `
                    <div class="float-btn" style="${btnStyle} ${bStyle}" 
                         onmousedown="event.stopPropagation()"
                         onclick="window.battle.selectSkillFromFloat('basic')"
                         onmouseenter="window.battle.ui.showTooltip(event, '<div style=\\'color:gold\\'>${basicSkill.name}</div><div>${basicSkill.desc}</div>')"
                         onmouseleave="window.battle.ui.hideTooltip()">
                        ${basicSkill.icon || '⚔️'}
                    </div>
                    <div style="${sepStyle}"></div>
                `;
            }

            // --- [B] 스킬 목록 ---
            if (u.equippedSkills && u.equippedSkills.length > 0) {
                let hasSkill = false;
                u.equippedSkills.forEach(sId => {
                    const s = u.skills.find(sk => sk.id === sId);
                    if (s) {
                        hasSkill = true;
                        const isSel = (this.battle.selectedSkill && this.battle.selectedSkill.id === s.id);
                        const isLocked = (u.level < (TIER_REQ[s.tier] || 1));
                        const isManaLack = u.curMp < s.mp;
                        
                        let addStyle = '';
                        if (isSel) addStyle = 'border-color: gold; background: #443300; box-shadow: 0 0 5px gold;';
                        else if (isLocked) addStyle = 'opacity: 0.3; pointer-events: none; filter: grayscale(100%);';
                        else if (isManaLack) addStyle = 'opacity: 0.6; background: #311; border-color: #522; color: #f55;';

                        let costRed = Formulas.getDerivedStat(u, 'cost_red') || 1.0;
                        const finalCost = Math.floor((s.cost || 50) * costRed);
                        
                        const tooltip = `
                            <div style='font-weight:bold;color:gold'>${s.name}</div>
                            <div style='font-size:10px;color:#ccc'>${s.desc || ''}</div>
                            <div style='font-size:10px;margin-top:2px;'>
                                <span style='color:#0cf'>${s.mp} MP</span> 
                                <span style='color:#f88'>${finalCost} Cost</span>
                            </div>
                        `;

                        htmlContent += `
                            <div class="float-btn" style="${btnStyle} ${addStyle}" 
                                 onmousedown="event.stopPropagation()"
                                 onclick="window.battle.selectSkillFromFloat('${s.id}')"
                                 onmouseenter="window.battle.ui.showTooltip(event, \`${tooltip}\`)"
                                 onmouseleave="window.battle.ui.hideTooltip()">
                                ${s.icon || '✨'}
                            </div>
                        `;
                    }
                });
                if(hasSkill) {
                    htmlContent += `<div style="${sepStyle}"></div>`;
                }
            }

            let hasItem = false;
            // 4개씩 2줄로 표시하기 위해 그리드 사용
            htmlContent += `<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:2px; margin: 0 4px;">`; 
            
            for (let i = 1; i <= 8; i++) {
                const itemId = u.equipment[`pocket${i}`];
                if (itemId) {
                    const item = this.battle.gameApp.itemData[itemId];
                    if (item) {
                        hasItem = true;
                        htmlContent += `
                            <div class="float-btn" style="${btnStyle} width:32px; height:32px; font-size:16px; border-color:#66a;" 
                                 onmousedown="event.stopPropagation()"
                                 onclick="window.battle.useItem(${i-1})"
                                 onmouseenter="window.battle.ui.showTooltip(event, '<div style=\\'color:#aaf\\'>${item.name}</div><div>${item.desc}</div>')"
                                 onmouseleave="window.battle.ui.hideTooltip()">
                                ${item.icon || '💊'}
                            </div>
                        `;
                    }
                }
            }
            htmlContent += `</div>`; 

            if(hasItem) {
                htmlContent += `<div style="${sepStyle}"></div>`;
            }

            // --- [D] 턴 종료 ---
            htmlContent += `
                <div class="float-btn" style="${btnStyle} background:linear-gradient(135deg, #722, #511); border-color:#944;" 
                     onmousedown="event.stopPropagation()"
                     onclick="window.battle.onTurnEndClick()"
                     onmouseenter="window.battle.ui.showTooltip(event, '턴 종료 (Space)')"
                     onmouseleave="window.battle.ui.hideTooltip()">
                    🛑
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div style="${containerStyle}">
                <div class="hud-guide-text" style="top:-18px; right:0;">H: 숨기기</div>
                ${htmlContent}
            </div>
        `;
        
        this.updateFloatingPosition();
    }

    updateStatusPanel() {
        const p = document.getElementById('bottom-panel');
        if (!this.battle.viewingUnit) {
            p.innerHTML = '<div style="margin:auto;color:#666;font-size:12px;">유닛을 선택하세요</div>';
            return;
        }

        const u = this.battle.viewingUnit;
        const isMy = (this.battle.currentUnit === u && u.team === 0 && !this.battle.isProcessingTurn);
        const canAct = (isMy && !this.battle.actions.acted);
        const canEndTurn = (isMy);

        const checkSkillLock = (skill) => {
            const reqLv = TIER_REQ[skill.tier] || 1;
            return u.level < reqLv;
        };

        const createRow = (key, label, val, isBase, idPrefix = 'val') => {
            let btnHtml = '';
            // [수정됨] onclick 경로 수정: window.battle.allocateStat -> window.battle.ui.allocateStat
            if (isBase && u.team === 0 && u.statPoints > 0) {
                btnHtml = `<button class="stat-up-btn" onclick="window.battle.ui.allocateStat('${key}')" onmouseenter="window.battle.ui.handleStatHover(event, '${key}', true)" onmouseleave="window.battle.ui.hideTooltip()">+</button>`;
            }

            let valClass = 'val-normal';
            let displayVal = Math.floor(Number(val));
            if (key === 'crit' || key === 'eva') displayVal = parseFloat(val).toFixed(1) + '%';
            
            if (!isBase) {
                const baseVal = Formulas.getDerivedStat(u, key, true);
                if (val > baseVal) valClass = 'val-buff';
                else if (val < baseVal) valClass = 'val-debuff';
            }

            let previewHtml = '';
            if (!isBase) {
                if (key === 'atk_phys' || key === 'atk_mag') {
                    previewHtml = `<span id="prev-atk" style="color:#0f0; font-size:10px; margin-left:3px;"></span>`;
                } else if (['def', 'res', 'crit', 'eva', 'spd'].includes(key)) {
                    previewHtml = `<span id="prev-${key}" style="color:#0f0; font-size:10px; margin-left:3px;"></span>`;
                }
            }

            return `<div class="stat-row"><span class="stat-label">${label}</span><div class="stat-val-box"><span id="${idPrefix}-${key}" class="stat-val ${valClass}">${displayVal}</span>${previewHtml}${btnHtml}</div></div>`;
        };

        const hpP = (u.curHp / u.hp) * 100;
        const mpP = (u.curMp / u.mp) * 100;
        let agP, agC;
        if (u.actionGauge >= 0) { agP = Math.min(100, (u.actionGauge / this.battle.actionGaugeLimit) * 100); agC = '#ffd700'; } 
        else { agP = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); agC = '#ff4444'; }

        // [Col 1] 프로필
        const colProfile = `
        <div class="bp-col col-profile">
            <div class="portrait-lg">${u.icon}</div>
            <div class="basic-name">${u.name}</div>
            <div class="basic-lv">Lv.${u.level} ${u.team === 0 ? '(Hero)' : '(Enemy)'}</div>
            <div style="font-size:11px; width:100%; margin-top:5px; display:flex; flex-direction:column; gap:3px;">
                <div class="bar-container" style="height:14px;" title="HP"><div class="bar-fill hp-fill" style="width:${hpP}%"></div><div class="bar-text">HP ${Math.floor(u.curHp)}/${u.hp}</div></div>
                <div class="bar-container" style="height:14px;" title="MP"><div class="bar-fill mp-fill" style="width:${mpP}%"></div><div class="bar-text">MP ${Math.floor(u.curMp)}/${u.mp}</div></div>
                <div class="bar-container" style="height:10px; background:#220;" title="Action Gauge"><div class="bar-fill" style="width:${agP}%; background:${agC};"></div><div class="bar-text" style="font-size:9px;">ACT ${Math.floor(u.actionGauge)}</div></div>
            </div>
        </div>`;

        // [Col 2] 기초 스탯
        const colBase = `
        <div class="bp-col col-base"><div class="bp-header">BASIC STATS</div>
            ${createRow('str', '힘', Formulas.getStat(u, 'str'), true)}${createRow('int', '지능', Formulas.getStat(u, 'int'), true)}
            ${createRow('vit', '체력', Formulas.getStat(u, 'vit'), true)}${createRow('agi', '민첩', Formulas.getStat(u, 'agi'), true)}
            ${createRow('dex', '숙련', Formulas.getStat(u, 'dex'), true)}${createRow('vol', '변동', Formulas.getStat(u, 'vol'), true)}
            ${createRow('luk', '운', Formulas.getStat(u, 'luk'), true)}
            ${u.statPoints > 0 ? `<div style="text-align:center;color:gold;font-size:11px;margin-top:5px;">PT: ${u.statPoints}</div>` : ''}
        </div>`;

        // [Col 3] 전투 스탯
        const colCombat = `
        <div class="bp-col col-combat"><div class="bp-header">COMBAT</div>
            ${createRow('atk_phys', '물공', Formulas.getDerivedStat(u, 'atk_phys'), false)}${createRow('atk_mag', '마공', Formulas.getDerivedStat(u, 'atk_mag'), false)}
            ${createRow('def', '방어', Formulas.getDerivedStat(u, 'def'), false)}${createRow('res', '저항', Formulas.getDerivedStat(u, 'res'), false)}
            ${createRow('hit_phys', '명중', Formulas.getDerivedStat(u, 'hit_phys'), false)}${createRow('crit', '치명', Formulas.getDerivedStat(u, 'crit'), false)}
            ${createRow('eva', '회피', Formulas.getDerivedStat(u, 'eva'), false)}${createRow('spd', '속도', Formulas.getDerivedStat(u, 'spd'), false)}
        </div>`;

        // [Col 4] 전장 ACTIONS
        let displaySkills = this._getDisplaySkills(u);
        let basicSkill = null;

        if (u.team === 0) {
            const basicId = u.equippedBasic || '1000';
            basicSkill = u.skills.find(s => s.id === basicId) || SKILL_DATABASE[basicId] || { name: '기본 공격', icon: '⚔️', desc: '기본 물리 공격', cost: 50, mp: 0 };
        }

        let topRowHtml = '';
        if (u.team === 0 && basicSkill) {
            const isActive = (this.battle.selectedSkill && this.battle.selectedSkill.id === basicSkill.id) ? 'active' : '';
            const isMyTurn = (u === this.battle.currentUnit && u.team === 0 && !this.battle.isProcessingTurn && !this.battle.actions.acted);
            const style = isMyTurn ? 'cursor:pointer;' : 'opacity:0.5; cursor:default;';
            const clickAction = isMyTurn ? `onclick="window.battle.selectSkillFromFloat('basic')"` : '';

            // 기본 공격 버튼
            topRowHtml += `
                <div class="skill-btn ${isActive}" style="width:40px; height:40px; border-color:#aaa; ${style} flex-shrink:0;" 
                     ${clickAction}
                     title="[기본공격]\n${basicSkill.desc}">
                    <div class="skill-icon" style="font-size:20px;">${basicSkill.icon}</div>
                </div>
                <div style="width:1px; background:#444; margin:0 5px;"></div>
            `;

            topRowHtml += `<div style="display:flex; flex-wrap:wrap; gap:2px; width:170px;">`; // 줄바꿈 허용 컨테이너

            for (let i = 1; i <= 8; i++) {
                const itemId = u.equipment[`pocket${i}`];
                let item = itemId ? this.battle.gameApp.itemData[itemId] : null;
                
                if (item) {
                    const isConfirming = (this.battle.confirmingItemSlot === (i-1));
                    let popupHtml = isConfirming ? `<div class="item-confirm-popup" onclick="event.stopPropagation()"><div class="confirm-mini-btn ok" onclick="window.battle.executeItem(${i-1})">V</div><div class="confirm-mini-btn no" onclick="window.battle.cancelItem()">X</div></div>` : '';
                    
                    // 크기를 약간 줄임 (40px -> 36px) 공간 확보
                    topRowHtml += `<div class="potion-slot filled ${isConfirming ? 'confirming' : ''}" style="width:36px; height:36px;" onclick="window.battle.requestItemUse(${i-1})" title="${item.name}\n${item.desc}">${item.icon}${popupHtml}</div>`;
                } else {
                    topRowHtml += `<div class="potion-slot empty" style="width:36px; height:36px;"></div>`;
                }
            }
            topRowHtml += `</div>`;
        }

        // 하단: 스킬 목록 (Flex - 일자 배치)
        let skillListHtml = '';
        if (displaySkills.length > 0) {
            displaySkills.forEach(baseS => {
                const req = TIER_REQ[baseS.tier] || 0;
                const lock = req > u.level;
                const passive = baseS.type === 'PASSIVE';
                const s = this.battle.skillProcessor.applyPerks(baseS, u);
                const manaLack = u.curMp < s.mp;
                // ▼▼▼ [신규] 무기 요구사항 체크 로직 ▼▼▼
                let weaponMatch = true;
                let currentWeaponName = "맨손";
                
                if (s.reqWeapon && s.reqWeapon.length > 0) {
                    const weaponId = u.equipment ? u.equipment.mainHand : null;
                    const weapon = weaponId ? this.battle.gameApp.itemData[weaponId] : null;
                    const currentType = weapon ? weapon.subType : 'FIST'; // 무기 없으면 FIST(맨손) 처리
                    
                    if (weapon) currentWeaponName = weapon.name;

                    // 주무기가 요구사항에 없으면 불일치 (보조무기/방패가 필요한 경우 로직 추가 가능)
                    if (!s.reqWeapon.includes(currentType)) {
                        // 예외: 방패 스킬인데 보조무기에 방패가 있는 경우
                        const offHandId = u.equipment ? u.equipment.offHand : null;
                        const offHand = offHandId ? this.battle.gameApp.itemData[offHandId] : null;
                        if (s.reqWeapon.includes('SHIELD') && offHand && offHand.subType === 'SHIELD') {
                            weaponMatch = true;
                        } else {
                            weaponMatch = false;
                        }
                    }
                }
                let cls = `skill-btn ${this.battle.selectedSkill?.id === s.id ? 'active' : ''}`;
                
                if (lock || passive || !canAct || !weaponMatch) cls += ' disabled';
                if (lock) cls += ' locked';
                if (!weaponMatch) cls += ' weapon-mismatch'; // ★ 스타일 적용
                if (manaLack && !lock && !passive && weaponMatch) cls += ' mana-lack';
                
                let costRed = Formulas.getDerivedStat(u, 'cost_red') || 1.0;
                const finalCost = Math.floor((s.cost || 50) * costRed);
                
                
                let reqInfo = "";
                if (s.reqWeapon && s.reqWeapon.length > 0) {
                    reqInfo = `<div style='color:#aaa; font-size:10px; margin-top:3px; border-top:1px dashed #555; padding-top:2px;'>⚔️ 필요: ${s.reqWeapon.join(', ')}</div>`;
                }

                let warningMsg = "";
                if (!weaponMatch) {
                    warningMsg = `<div style='color:#ff5555; font-size:10px; font-weight:bold;'>⛔ 장비 불일치</div>`;
                }

                const tooltip = `
                    <div style='font-weight:bold;color:gold'>${s.name}</div>
                    <div style='font-size:10px;color:#ccc'>${s.desc || ''}</div>
                    <div style='font-size:10px;margin-top:2px;'>
                        <span style='color:#0cf'>${s.mp} MP</span> 
                        <span style='color:#f88'>${finalCost} Cost</span>
                    </div>
                    ${reqInfo}
                    ${warningMsg}
                `;

                // [수정] onclick에 무기 불일치 시 경고창 띄우기 & X 오버레이 추가
                skillListHtml += `
                    <div class="${cls}" data-skill-id="${s.id}" 
                         style="width:50px; height:50px; margin:2px; position:relative;"
                         title=""
                         onmouseenter="window.battle.ui.showTooltip(event, \`${tooltip}\`)"
                         onmouseleave="window.battle.ui.hideTooltip()"
                         onclick="${!weaponMatch ? `window.battle.gameApp.showAlert('사용 불가: ${s.reqWeapon.join(', ')} 필요')` : ''}">
                        <div class="skill-icon" style="font-size:20px;">${s.icon || '⚔️'}</div>
                        <div class="skill-name" style="font-size:9px;">${s.name}</div>
                        ${!lock ? `<div class="skill-cost" style="font-size:8px;">${s.mp}MP</div>` : ''}
                        ${!lock && !passive && weaponMatch ? `<div class="cooldown-overlay" style="background:rgba(0,0,0,0.6);font-size:10px;">⌛${finalCost}</div>` : ''}
                        ${!weaponMatch ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#f00; font-size:24px; font-weight:bold; text-shadow:0 0 5px black; z-index:10;">❌</div>` : ''}
                    </div>`;
            });
        } else {
            skillListHtml = '<div style="color:#666; font-size:11px; margin:auto;">스킬 없음</div>';
        }

        const colSkills = `
        <div class="bp-col col-skills">
            <div class="bp-header">ACTIONS</div>
            <div style="display:flex; height:50px; align-items:center; justify-content:center; border-bottom:1px solid #333; margin-bottom:5px;">
                ${topRowHtml}
            </div>
            <div class="skill-grid-container" style="display:flex; flex-wrap:wrap; align-content:flex-start; gap:2px; padding:5px; overflow-y:auto;" id="battle-skill-list">
                ${skillListHtml}
            </div>
            <div class="skill-footer" style="justify-content:center;">
                <button id="btn-turn-end" class="turn-btn" style="width:100%;">턴 종료 (Space)</button>
            </div>
        </div>`;

        // [Col 5] 상태이상 & 패시브
        const allStatus = [...(u.conditions || []), ...(u.buffs || [])];
        const statusHtml = allStatus.map(b => `<div class="status-detail-item"><div class="status-icon-box">${b.icon || '✨'}</div><div class="status-info-box"><div class="st-name">${b.name}</div></div></div>`).join('') || '<div style="color:#666;font-size:11px;text-align:center;">상태이상 없음</div>';
        const passiveHtml = (u.skills || []).filter(s => s.type === 'PASSIVE' && !checkSkillLock(s)).map(s => `<div class="status-detail-item passive"><div class="status-icon-box">${s.icon || '🔸'}</div><div class="status-info-box"><div class="st-name">${s.name}</div></div></div>`).join('') || '<div style="color:#666;font-size:11px;text-align:center;">패시브 없음</div>';
        const colStatus = `<div class="bp-col col-status"><div class="bp-header">STATUS</div><div class="status-list">${statusHtml}</div><div class="bp-header" style="margin-top:5px;">PASSIVE</div><div class="status-list">${passiveHtml}</div></div>`;

        p.innerHTML = colProfile + colBase + colCombat + colSkills + colStatus;

        if (canAct) {
            const skillBtns = p.querySelectorAll('.skill-btn');
            skillBtns.forEach(btn => {
                if (btn.classList.contains('locked') || btn.classList.contains('disabled')) return;
                btn.onclick = () => {
                    const sId = btn.dataset.skillId;
                    if(sId) this.battle.selectSkillFromFloat(sId);
                };
            });
        }

        if (canEndTurn) {
            setTimeout(() => {
                const endBtn = document.getElementById('btn-turn-end');
                if (endBtn) {
                    endBtn.onclick = (e) => {
                        e.stopPropagation(); 
                        if(window.battle) window.battle.onTurnEndClick();
                    };
                }
            }, 50);
        }

        const logF = document.getElementById('log-footer'); 
        if(logF) { 
            logF.innerHTML = `<button id="btn-surrender" style="width:100%; background:#422; color:#f88; border:1px solid #633; padding:5px; cursor:pointer;">🏳️ 항복하기</button>`; 
            document.getElementById('btn-surrender').onclick = () => { 
                this.battle.gameApp.showConfirm("정말 항복하시겠습니까? (패배 처리)", () => { 
                    this.battle.endBattleSequence(false, true);
                }); 
            }; 
        }
    }

    _getDisplaySkills(u) {
        let displaySkills = [];
        if (u.team === 0) {
            if (u.equippedSkills && u.equippedSkills.length > 0) {
                u.equippedSkills.forEach(sId => {
                    const learnedSkill = u.skills.find(s => s.id === sId);
                    if (learnedSkill) displaySkills.push(learnedSkill);
                });
            }
        } else {
            if (u.skills) displaySkills = u.skills;
        }
        return displaySkills;
    }

    renderUI() {
        this.updateStatusPanel();
    }

    renderPartyList() {
        const listContainer = document.getElementById('party-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        const heroes = this.battle.units.filter(u => u.team === 0);
        
        heroes.forEach(u => {
            const div = document.createElement('div');
            // 조종 중인 캐릭터(active-turn)와 정보 조회 중인 캐릭터(viewing) 하이라이트 처리
            div.className = `party-unit ${u === this.battle.currentUnit ? 'active-turn' : ''} ${u === this.battle.viewingUnit ? 'viewing' : ''}`;
            
            const hpPct = (u.curHp / u.hp) * 100;
            const mpPct = (u.curMp / u.mp) * 100;
            let agPct, agColor;
            
            if (u.actionGauge >= 0) { 
                agPct = Math.min(100, (u.actionGauge / this.battle.actionGaugeLimit) * 100); 
                agColor = '#ffd700';
            } else { 
                agPct = Math.min(100, (Math.abs(u.actionGauge) / 50) * 100); 
                agColor = '#ff3333';
            }
            
            const statusIcons = u.buffs.filter(b => b.type !== 'PASSIVE_BUFF').map(b => b.icon).join(' ');
            
            div.innerHTML = `<div style="display:flex; align-items:center; width:100%; gap:10px; padding:8px;"><div style="font-size:24px;">${u.icon}</div><div style="flex:1;"><div style="display:flex; justify-content:space-between; font-size:11px;"><b>${u.name}</b> <span>Lv.${u.level}</span></div><div class="bar-container" style="height:5px; margin:2px 0;"><div class="bar-fill hp-fill" style="width:${hpPct}%"></div></div><div class="bar-container" style="height:3px;"><div class="bar-fill mp-fill" style="width:${mpPct}%"></div></div><div class="bar-container" style="height:3px; margin-top:1px; background:#220;"><div class="bar-fill" style="width:${agPct}%; background:${agColor};"></div></div><div style="font-size:10px; margin-top:2px;">${statusIcons}</div></div></div>`;
            
            // [클릭 이벤트 수정됨]
            div.onclick = () => { 
                // 1. 하단 상태창 갱신 (기본)
                this.battle.viewingUnit = u; 
                this.updateStatusPanel(); 
                
                // 2. [추가] 평화 모드일 경우 조종 캐릭터 변경
                if (this.battle.isPeaceful && u.curHp > 0) {
                    this.battle.currentUnit = u;          // 조종 권한 변경
                    this.battle.centerCameraOnUnit(u);    // 카메라 이동
                    this.battle.updateFloatingControls(); // 스킬/이동바 갱신
                }

                // 3. 리스트 하이라이트 갱신
                this.renderPartyList(); 
            };
            
            listContainer.appendChild(div);
        });
        
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        footer.innerHTML = `<button id="btn-auto-toggle" class="auto-btn-sidebar ${this.battle.isAutoBattle ? 'active' : ''}">${this.battle.isAutoBattle ? '🤖 AUTO ON' : '⚔️ AUTO OFF'}</button>`;
        
        footer.querySelector('button').onclick = () => { 
            this.battle.isAutoBattle = !this.battle.isAutoBattle; 
            this.renderPartyList(); 
            if(this.battle.isAutoBattle && this.battle.currentUnit.team === 0 && !this.battle.isProcessingTurn) { 
                this.battle.runAllyAutoAI(); 
            } 
        };
        
        listContainer.appendChild(footer);
    }

    log(msg, type) {
        const box = document.getElementById('log-content');
        if(box) {
            box.innerHTML += `<div class="log-entry ${type}">${msg}</div>`;
            document.getElementById('log-box').scrollTop = 9999;
        }
    }

    showFloatingText(u, txt, col) {
        this.textQueue.push({u, txt, col});
    }

    processTextQueue() { 
        if(this.textQueue.length > 0){ 
            const now = Date.now(); 
            if(!this.lastTextTime || now - this.lastTextTime > 200){ 
                const {u, txt, col} = this.textQueue.shift(); 
                const pos = u.visualPos ? this.getUnitScreenPos(u) : this.getHexScreenPos(u.q, u.r); 
                
                const el = document.createElement('div'); 
                el.className = 'floating-text'; 
                el.textContent = txt; 
                el.style.color = col; 
                Object.assign(el.style, {
                    position:'fixed', left:pos.x+'px', top:(pos.y-20)+'px',
                    pointerEvents:'none', zIndex:'10000', transition:'all 3s',
                    fontSize:'16px', fontWeight:'bold', textShadow:'1px 1px 2px #000'
                }); 
                document.body.appendChild(el); 
                setTimeout(()=>{ el.style.top = (pos.y-100)+'px'; el.style.opacity = '0'; }, 50); 
                setTimeout(()=>el.remove(), 3000); 
                this.lastTextTime = now; 
            } 
        } 
    }

    showUnitTooltip(e, u) {
        if (!u) return; // 유닛 없으면 중단

        const ele = ELEMENTS[u.element || 'NONE'] ? ELEMENTS[u.element || 'NONE'].name : '무속성';
        
        // [수정] buffs, skills 안전하게 접근 (Optional Chaining 및 Default Value)
        const safeBuffs = u.buffs || [];
        const statusText = safeBuffs.map(b => `${b.icon || ''} ${b.name}`).join('  ') || '상태이상 없음';
        
        let eleInfo = "";
        if (this.battle.currentUnit && this.battle.currentUnit.team === 0 && u.team !== 0) {
            const myEle = this.battle.currentUnit.element || 'NONE';
            const targetEle = u.element || 'NONE';
            if (ELEMENTS[myEle] && ELEMENTS[myEle].strong === targetEle) eleInfo = `<br><span style="color:#fc0;">[Weak!]</span>`;
            else if (ELEMENTS[myEle] && ELEMENTS[myEle].weak === targetEle) eleInfo = `<br><span style="color:#aaa;">[Resist]</span>`;
        }
        
        // [수정] 숫자값들 Math.floor 처리 및 안전장치
        const html = `
            <div style='color:${u.team===0?"#48f":(u.team===2?"#aaa":"#f44")}; font-weight:bold; font-size:16px'>
                ${u.name} <span style='font-size:12px; color:#aaa;'>Lv.${u.level || 1}</span>
            </div>
            <div style='font-size:12px'>속성: ${ele} ${eleInfo}</div>
            <hr style='margin:5px 0; border-color:#555'>
            <div>HP: <span style='color:#f55'>${Math.floor(u.curHp || 0)}</span> / ${u.hp || 1}</div>
            <div>MP: <span style='color:#0cf'>${Math.floor(u.curMp || 0)}</span> / ${u.mp || 1}</div>
            <div style='margin-top:5px; color:#ccc; font-size:11px; white-space: pre-wrap;'>${statusText}</div>
        `;
        this.showTooltip(e, html);
    }

    showTooltip(e, html) { 
        const t = document.getElementById('global-tooltip'); 
        if(t) { 
            t.style.display='block'; t.innerHTML=html; 
            let left = e.clientX + 15; let top = e.clientY + 15; 
            if (left + 250 > window.innerWidth) left = window.innerWidth - 260; 
            if (top + 150 > window.innerHeight) top = window.innerHeight - 160; 
            t.style.left = left + 'px'; t.style.top = top + 'px'; 
        } 
    }
    hideTooltip() { document.getElementById('global-tooltip').style.display='none'; }

    updateCursor() { 
        const v = document.getElementById('viewport'); 
        if(this.battle.selectedSkill) v.className = 'cursor-skill'; 
        else if(this.battle.hoverHex && this.battle.getUnitAt(this.battle.hoverHex.q, this.battle.hoverHex.r)?.team === 1) v.className = 'cursor-attack'; 
        else v.className = ''; 
    }

    handleStatHover(e, k, p) { 
        if (p && this.battle.viewingUnit && this.battle.viewingUnit.statPoints > 0) this.updateStatPreviewValues(this.battle.viewingUnit, k); 
    }
    
    updateStatPreviewValues(u, k) { 
        const cur = JSON.parse(JSON.stringify(u)); 
        const nxt = JSON.parse(JSON.stringify(u)); 
        nxt[k]++; 
        if(k==='vit') nxt.hp+=5; 
        if(k==='int') nxt.mp+=5; 
        const setP = (id, ck) => { 
            const v1 = Formulas.getDerivedStat(cur, ck); 
            const v2 = Formulas.getDerivedStat(nxt, ck); 
            const el = document.getElementById(id); 
            if(el) el.textContent = (v2 > v1) ? '▲' : ''; 
        }; 
        const atkKey = u.atkType === 'MAG' ? 'atk_mag' : 'atk_phys'; 
        setP('prev-atk', atkKey); setP('prev-def', 'def'); setP('prev-res', 'res'); setP('prev-crit', 'crit'); setP('prev-eva', 'eva'); setP('prev-spd', 'spd'); 
    }
    
    allocateStat(k){ 
        const u=this.battle.viewingUnit; 
        if(!u||u.team!==0) return; 
        if(u.statPoints<1) return; 
        u[k]++; u.statPoints--; 
        if(k==='vit'){u.hp+=5;u.curHp+=5;} 
        if(k==='int'){u.mp+=5;u.curMp+=5;} 
        this.updateStatusPanel(); 
        this.showFloatingText(u,"UP!","#ff0"); 
        this.battle.gameApp.saveGame(); 
    }
    updateSidebarMode(isPeaceful) {
        const btnHero = document.getElementById('btn-open-hero');
        const btnParty = document.getElementById('btn-open-party');
        
        // 평화 모드면 활성(false), 전투 모드면 비활성(true)
        const isDisabled = !isPeaceful;
        const opacity = isDisabled ? '0.3' : '1';
        const cursor = isDisabled ? 'not-allowed' : 'pointer';

        if (btnHero) {
            btnHero.disabled = isDisabled;
            btnHero.style.opacity = opacity;
            btnHero.style.cursor = cursor;
        }
        if (btnParty) {
            btnParty.disabled = isDisabled;
            btnParty.style.opacity = opacity;
            btnParty.style.cursor = cursor;
        }
    }
}