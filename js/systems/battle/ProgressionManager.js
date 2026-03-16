import * as Formulas from '../../utils/formulas.js';
// ⭐ [필수 추가] 직업 데이터와 초상화 데이터를 불러오기 위한 import 추가
import { JOB_CLASS_DATA } from '../../data/index.js';
import { PORTRAIT_DATA } from '../../data/portraits.js';

export class ProgressionManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    async gainActionXp(unit, amount) {
        if (this.battle.isTestMode) return;
        const ACTION_XP_LIMIT = 40; 
        if ((unit.stageActionXp || 0) >= ACTION_XP_LIMIT) {
            if (!unit.hasShownMaxXpMsg) {
                this.battle.showFloatingText(unit, "Max Action XP", "#888"); 
                unit.hasShownMaxXpMsg = true;
            }
            return;
        }
        if (!unit.stageActionXp) unit.stageActionXp = 0;
        let actualGain = amount;
        if (unit.stageActionXp + amount > ACTION_XP_LIMIT) actualGain = ACTION_XP_LIMIT - unit.stageActionXp;

        if (actualGain > 0) {
            unit.stageActionXp += actualGain;
            unit.xp += actualGain;
            await this.checkLevelUp(unit);
            this.battle.gameApp.saveGame();
        }
    }

    async gainVictoryBonus() {
        if (this.battle.isTestMode || this.battle.isPeaceful) return;

        const allies = this.battle.units.filter(u => u.team === 0 && u.curHp > 0);
        if (allies.length === 0) return;

        let victoryXp = 30 + (this.battle.chapter * 5); 
        
        const stageKey = `${this.battle.chapter}-${this.battle.stage}`;
        if (this.battle.gameApp.gameState.clearedStages.includes(stageKey)) {
            victoryXp = Math.floor(victoryXp * 0.5); 
        }

        this.battle.log(`🎉 생존한 아군 전원에게 승전 보너스 ${victoryXp} XP가 지급되었습니다!`, 'log-system');

        for (const u of allies) {
            u.xp += victoryXp;
            this.battle.showFloatingText(u, `승전 +${victoryXp} XP`, '#ffaa00');
            await this.checkLevelUp(u);
        }
    }

    async gainCombatPoints(caster, skill, isHit, target, isKillParam = false) {
        if (this.battle.isTestMode || !caster || caster.team !== 0) return;

        const isKill = isKillParam || (target && target.curHp <= 0);
        const isMiss = !isHit;
        const targetLv = target ? (target.level || 1) : caster.level;
        const casterLv = caster.level || 1;
        
        const isTargetEnemy = target && target.team !== caster.team;
        
        let weaponType = 'FIST';
        if (caster.equipment && caster.equipment.mainHand && this.battle.gameApp.itemData[caster.equipment.mainHand]) {
            weaponType = this.battle.gameApp.itemData[caster.equipment.mainHand].subType || 'FIST';
        }

        if (caster.jpTotal === undefined) caster.jpTotal = 0;
        if (caster.jpAvailable === undefined) caster.jpAvailable = 0;
        if (!caster.wp) caster.wp = {};
        if (!caster.sp) caster.sp = {};

        const levelPenaltyApplied = isTargetEnemy && (casterLv - targetLv >= 5);
        
        if (!isMiss && !levelPenaltyApplied) {
            let expGain = 10; 
            if (isKill && isTargetEnemy) expGain += 3; 
            
            caster.xp += expGain;
            this.battle.showFloatingText(caster, `EXP +${expGain}`, '#ffffff');
        }

        let jpGain = isMiss ? 6 : 20;
        caster.jpTotal += jpGain;
        caster.jpAvailable += jpGain;
        
        if (skill.id === '1000' || skill.atkType === 'PHYS' || skill.type === 'ACTIVE') {
            let wpGain = isMiss ? Math.round(5 * 0.5) : 5; 
            if (!caster.wp[weaponType]) caster.wp[weaponType] = { level: 1, xp: 0 };
            caster.wp[weaponType].xp += wpGain;
        }

        if (skill.id !== '1000' && skill.type !== 'ITEM') {
            let spGain = isMiss ? Math.round(5 * 0.2) : 5; 
            if (!caster.sp[skill.id]) caster.sp[skill.id] = { level: 1, xp: 0 };
            caster.sp[skill.id].xp += spGain;
        }
        
        await this.checkLevelUp(caster);
        
        if (this.battle.gameApp) this.battle.gameApp.saveGame();
    }

    async checkLevelUp(unit) {
        if (!unit || unit.team !== 0) return;

        unit.level = parseInt(unit.level) || 1;
        unit.xp = Number(unit.xp) || 0;

        const oldStats = {
            hp: Number(unit.hp) || 0,
            mp: Number(unit.mp) || 0,
            str: Number(unit.str) || 0,
            int: Number(unit.int) || 0,
            vit: Number(unit.vit) || 0,
            vol: Number(unit.vol) || 0,
            agi: Number(unit.agi) || 0,
            dex: Number(unit.dex) || 0,
            luk: Number(unit.luk) || 0
        };

        let levelUpOccurred = false;
        let oldLevel = unit.level;
        let oldClassLevel = unit.classLevel || 1; // ⭐ [버그 수정] 승급 전 클래스 레벨 백업
        let classUpOccurred = false;
        let wpUpOccurred = false;
        let spUpOccurred = false;
        let statIncreases = null;

        // 1. 유닛 레벨업
        while (unit.level < 60 && unit.xp >= Formulas.EXP_REQ(unit.level)) {
            unit.xp -= Formulas.EXP_REQ(unit.level);
            
            if (Formulas.processLevelUp) {
                statIncreases = Formulas.processLevelUp(unit);
            } else {
                unit.level++;
                unit.hp = Number(unit.hp || 0) + 5; 
                unit.mp = Number(unit.mp || 0) + 2;
                unit.curHp = unit.hp; unit.curMp = unit.mp;
                unit.statPoints = Number(unit.statPoints || 0) + 3;
            }
            
            levelUpOccurred = true;
        }

        // 2. 직업 클래스업
        while (unit.classLevel < 8 && unit.jpTotal >= Formulas.CLASS_JP_REQ[unit.classLevel]) {
            unit.classLevel++;
            classUpOccurred = true;
        }

        // 3. 무기 숙련도 레벨업
        let upgradedWeapons = [];
        for (let wType in unit.wp) {
            let wpData = unit.wp[wType];
            while (wpData.level < 4 && wpData.xp >= Formulas.WEAPON_WP_REQ[wpData.level]) {
                wpData.xp -= Formulas.WEAPON_WP_REQ[wpData.level];
                wpData.level++;
                upgradedWeapons.push(wType);
                wpUpOccurred = true;
            }
        }

        // 4. 스킬 숙련도 레벨업
        let upgradedSkills = [];
        for (let sId in unit.sp) {
            let spData = unit.sp[sId];
            while (spData.level < 4 && spData.xp >= Formulas.SKILL_SP_REQ[spData.level]) {
                spData.xp -= Formulas.SKILL_SP_REQ[spData.level];
                spData.level++;
                upgradedSkills.push(sId);
                spUpOccurred = true;
            }
        }

        // 5. 시각 및 UI 업데이트 연출
        if (levelUpOccurred || classUpOccurred || wpUpOccurred || spUpOccurred) {
            
            if (this.battle.ui) this.battle.ui.updateFloatingControls();
            
            if (this.battle.smoothCenterCameraOnUnit) {
                await this.battle.smoothCenterCameraOnUnit(unit, 400);
            }

            let popupTitle = "";
            let popupDesc = "";
            let needsModal = false;

            if (levelUpOccurred) {
                this.battle.showFloatingText(unit, `LEVEL UP!`, '#ffff00');
                this.battle.log(`🎉 [레벨업] ${unit.name}의 레벨이 ${unit.level}(으)로 상승했습니다!`, 'log-system');
                popupTitle = `LEVEL UP! (Lv.${oldLevel} ➔ Lv.${unit.level})`;
                needsModal = true;
                
                let statRows = '';
                const statNames = [
                    { key: 'str', label: 'STR (힘)' }, { key: 'int', label: 'INT (지능)' },
                    { key: 'vit', label: 'VIT (체력)' }, { key: 'vol', label: 'VOL (의지)' },
                    { key: 'agi', label: 'AGI (민첩)' }, { key: 'dex', label: 'DEX (솜씨)' },
                    { key: 'luk', label: 'LUK (행운)' }, { key: 'hp', label: '최대 체력' },
                    { key: 'mp', label: '최대 마나' }
                ];

                statNames.forEach(s => {
                    const oldVal = oldStats[s.key];
                    const newVal = Number(unit[s.key]) || 0;
                    const diff = newVal - oldVal;

                    if (diff > 0) {
                        statRows += `
                            <div class="lvl-stat-row">
                                <span class="lvl-stat-label">${s.label}</span>
                                <span class="lvl-stat-dots"></span>
                                <span class="lvl-stat-values">
                                    <span class="lvl-old">${oldVal}</span> 
                                    <span class="lvl-diff">(+${diff})</span> 
                                    <span class="lvl-new">${newVal}</span>
                                </span>
                            </div>
                        `;
                    }
                });

                if (statRows === '') statRows = `<div style="text-align:center; color:#8b5a2b; font-size:14px; font-style:italic; padding: 10px 0;">성장한 능력치가 없습니다.</div>`;

                popupDesc = `
                    <div style="width:100%; padding: 5px 10px;">${statRows}</div>
                    <div style="margin-top:15px; color:#1b5e20; font-weight:bold; font-size: 14px; text-align: center;">HP/MP 20% 회복!</div>
                `;
            }
            
            // ⭐ [개선] 클래스업 메세지 로직
            if (classUpOccurred) {
                if (levelUpOccurred) await new Promise(r => setTimeout(r, 400));
                
                let oldNameEn = unit.classKey;
                let oldNameKr = unit.classKey;
                let newNameEn = unit.classKey;
                let newNameKr = unit.classKey;

                if (typeof JOB_CLASS_DATA !== 'undefined') {
                    const oldC = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === unit.classKey && c.classLevel === oldClassLevel);
                    const newC = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === unit.classKey && c.classLevel === unit.classLevel);
                    
                    if (oldC) {
                        oldNameEn = oldC.classNameEn || oldC.className || oldNameEn;
                        oldNameKr = oldC.className || oldNameKr;
                    }
                    if (newC) {
                        newNameEn = newC.classNameEn || newC.className || newNameEn;
                        newNameKr = newC.className || newNameKr;
                    }
                }

                // ⭐ 요청하신 포맷 완성: Class 1 Recruit (신병) ➔ Class 2 Soldier (보병)
                const classUpMsg = `Class ${oldClassLevel} ${oldNameEn} (${oldNameKr}) <br>➔ Class ${unit.classLevel} ${newNameEn} (${newNameKr})`;

                this.battle.showFloatingText(unit, `CLASS UP!`, '#ffaa00');
                this.battle.log(`🌟 [클래스업] ${unit.name}의 직업이 승급했습니다!`, 'log-system');
                
                if (!popupTitle) popupTitle = `CLASS UP!`;
                else popupDesc += `<hr style="border-top: 2px dotted #a1887f; border-bottom: none; margin:15px 0;">`;
                
                popupDesc += `
                    <div style="color:#8b0000; font-weight:bold; font-size:16px; text-align:center; background:rgba(255,215,0,0.3); padding:15px 10px; border-radius:4px; border:2px solid #b8860b; line-height: 1.5;">
                        ${classUpMsg}
                    </div>
                `;
                needsModal = true;
            }
            
            if (wpUpOccurred) {
                if (levelUpOccurred || classUpOccurred) await new Promise(r => setTimeout(r, 400));
                this.battle.showFloatingText(unit, `WEAPON UP!`, '#00ffaa');
                this.battle.log(`⚔️ [무기 숙련] ${unit.name}의 무기 숙련도가 상승했습니다!`, 'log-system');
                
                if (!popupTitle) {
                    popupTitle = `WEAPON UP!`;
                    popupDesc = `<div style="text-align:center; padding: 20px 0; font-size:15px; font-weight:bold; color:#1b5e20;">${unit.name}의 무기를 다루는 솜씨가 한 단계 상승했습니다!</div>`;
                } else {
                    popupDesc += `<hr style="border-top: 2px dotted #a1887f; border-bottom: none; margin:15px 0;"><div style="color:#1b5e20; font-weight:bold; font-size:14px; text-align:center;">무기 숙련도가 함께 상승했습니다!</div>`;
                }
            }
            
            if (spUpOccurred) {
                if (levelUpOccurred || classUpOccurred || wpUpOccurred) await new Promise(r => setTimeout(r, 400));
                this.battle.showFloatingText(unit, `SKILL UP!`, '#ff00aa');
                this.battle.log(`✨ [스킬 강화] ${unit.name}의 특정 스킬 레벨이 상승했습니다!`, 'log-system');
                
                if (!popupTitle) {
                    popupTitle = `SKILL UP!`;
                    popupDesc = `<div style="text-align:center; padding: 20px 0; font-size:15px; font-weight:bold; color:#4a148c;">${unit.name}의 스킬 이해도가 한층 깊어졌습니다!</div>`;
                } else {
                    popupDesc += `<hr style="border-top: 2px dotted #a1887f; border-bottom: none; margin:15px 0;"><div style="color:#4a148c; font-weight:bold; font-size:14px; text-align:center;">스킬 이해도가 함께 상승했습니다!</div>`;
                }
            }

            await new Promise(r => setTimeout(r, 1500));

            if (needsModal) {
                await this.showLevelUpModal(unit, popupTitle, popupDesc);
            }

            if (unit.originalHero) {
                unit.originalHero.level = unit.level;
                unit.originalHero.xp = unit.xp;
                unit.originalHero.classLevel = unit.classLevel;
                unit.originalHero.jpTotal = unit.jpTotal;
                unit.originalHero.jpAvailable = unit.jpAvailable;
                unit.originalHero.wp = JSON.parse(JSON.stringify(unit.wp));
                unit.originalHero.sp = JSON.parse(JSON.stringify(unit.sp));
                unit.originalHero.statPoints = unit.statPoints;
                unit.originalHero.hp = unit.hp;
                unit.originalHero.mp = unit.mp;
                unit.originalHero.curHp = unit.curHp;
                unit.originalHero.curMp = unit.curMp;
                
                ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(s => { unit.originalHero[s] = unit[s]; });
                if (unit.floatStats) unit.originalHero.floatStats = JSON.parse(JSON.stringify(unit.floatStats));
                if (unit.skillIds) unit.originalHero.skillIds = JSON.parse(JSON.stringify(unit.skillIds));
                if (unit.skills) unit.originalHero.skills = JSON.parse(JSON.stringify(unit.skills));
            }

            this.battle.updateStatusPanel(); 
            if (this.battle.gameApp) this.battle.gameApp.saveGame();
        }
    }

    showLevelUpModal(unit, title, descHtml) {
        return new Promise((resolve) => {
            let oldModal = document.getElementById('level-up-modal');
            if (oldModal) oldModal.remove();

            const modal = document.createElement('div');
            modal.id = 'level-up-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 5, 2, 0.8); z-index: 999999;
                display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s ease;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: #e6d5b8;
                background-image: 
                    radial-gradient(circle at 100% 100%, #d4b88a 0%, transparent 50%),
                    radial-gradient(circle at 0% 0%, #f4ebd8 0%, transparent 40%);
                border: 4px solid #2c1a12;
                border-radius: 6px;
                box-shadow: 0 15px 40px rgba(0,0,0,0.8), inset 0 0 30px rgba(120, 80, 40, 0.3);
                padding: 4px;
                min-width: 320px; max-width: 400px;
                transform: scale(0.8); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;

            const innerBorder = document.createElement('div');
            innerBorder.style.cssText = `
                border: 1px solid #5d4037;
                outline: 1px solid #8b5a2b;
                outline-offset: -3px;
                padding: 25px 20px 20px 20px;
                background: rgba(255, 255, 255, 0.1);
                display: flex; flex-direction: column; align-items: center;
            `;

            const portraitSrc = (typeof PORTRAIT_DATA !== 'undefined' && (PORTRAIT_DATA[unit.id] || PORTRAIT_DATA[unit.classKey])) || unit.portrait;
            const portraitHtml = portraitSrc 
                ? `<img src="${portraitSrc}" style="width: 80px; height: 80px; border: 2px solid #3e2723; border-radius: 4px; object-fit: cover; box-shadow: 2px 2px 5px rgba(0,0,0,0.4); margin-bottom: 15px;">` 
                : `<div style="width: 80px; height: 80px; background: #3e2723; border: 2px solid #1a110a; border-radius: 4px; display: flex; justify-content: center; align-items: center; font-size: 40px; box-shadow: 2px 2px 5px rgba(0,0,0,0.4); margin-bottom: 15px;">${unit.icon || '👤'}</div>`;

            innerBorder.innerHTML = `
                <style>
                    .lvl-stat-row { display: flex; align-items: baseline; margin-bottom: 8px; font-family: var(--font-game, sans-serif); font-size: 14px; color: #2c1e16; font-weight: bold; width: 100%; }
                    .lvl-stat-label { width: 110px; text-align: left; }
                    .lvl-stat-dots { flex-grow: 1; border-bottom: 2px dotted #a1887f; margin: 0 10px; opacity: 0.6; }
                    .lvl-stat-values { text-align: right; white-space: nowrap; font-size: 15px; }
                    .lvl-old { color: #5d4037; display: inline-block; width: 25px; text-align: center; }
                    .lvl-diff { color: #2e7d32; display: inline-block; width: 40px; text-align: center; font-weight: 900; }
                    .lvl-new { color: #8b0000; display: inline-block; width: 30px; text-align: center; font-weight: bold; }
                </style>

                <div style="font-family: var(--font-main), 'Times New Roman', serif; color: #8b0000; font-size: 26px; font-weight: bold; text-shadow: 1px 1px 0px #fff, 2px 2px 0px rgba(0,0,0,0.2); margin-bottom: 5px; letter-spacing: 2px; text-align: center;">
                    ${title.includes('CLASS') ? 'CLASS UP' : (title.includes('WEAPON') ? 'WEAPON UP' : (title.includes('SKILL') ? 'SKILL UP' : 'LEVEL UP'))}
                </div>
                
                <div style="color: #4e342e; font-size: 16px; font-weight: bold; border-bottom: 2px solid #8b0000; padding-bottom: 10px; margin-bottom: 20px; width: 100%; text-align: center; font-family: var(--font-main), serif;">
                    ${title.includes('LEVEL') ? title : unit.name}
                </div>
                
                ${portraitHtml}

                ${descHtml}

                <button id="level-up-ok-btn" style="
                    margin-top: 25px; width: 100%; padding: 12px 0;
                    background: linear-gradient(180deg, #4e342e, #3e2723);
                    border: 1px solid #1a110a; border-radius: 4px;
                    color: #ebd9b4; font-family: var(--font-main), serif; font-size: 16px; font-weight: bold;
                    cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2);
                    transition: all 0.1s ease;
                " onmouseover="this.style.background='linear-gradient(180deg, #5d4037, #4e342e)'; this.style.color='#fff';" 
                   onmouseout="this.style.background='linear-gradient(180deg, #4e342e, #3e2723)'; this.style.color='#ebd9b4';" 
                   onmousedown="this.style.transform='translateY(2px)'; this.style.boxShadow='inset 0 2px 4px rgba(0,0,0,0.6)';" 
                   onmouseup="this.style.transform='none'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2)';">
                    확인
                </button>
            `;

            content.appendChild(innerBorder);
            modal.appendChild(content);
            document.body.appendChild(modal);

            setTimeout(() => {
                modal.style.opacity = '1';
                content.style.transform = 'scale(1)';
            }, 50);

            document.getElementById('level-up-ok-btn').onclick = () => {
                modal.style.opacity = '0';
                content.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    modal.remove();
                    resolve();
                }, 300);
            };
        });
    }
}