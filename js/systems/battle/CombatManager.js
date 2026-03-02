import * as Formulas from '../../utils/formulas.js';

export class CombatManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    async performAttack(atk, def, mult, name, isDrain, type, hitCount = 1, options = {}) {
        const battle = this.battle;
        if (!def || def.hp === undefined || def.curHp <= 0) return;
        
        // ⭐ [타겟 패널 버그 수정] 피격 시 무조건 방어자를 우측 타겟 패널에 띄웁니다.
        if (battle.ui && battle.ui.updateRightPanel) {
            battle.ui.updateRightPanel([def]);
        }
        
        const skill = options.skill || {};

        if(name !== "스킬" && name !== "흡수") battle.actions.acted = true;
        
        if (battle.hasStatus(atk, 'STEALTH') || battle.hasStatus(atk, 'STAT_STEALTH')) {
            atk.buffs = atk.buffs.filter(b => b.type !== 'STEALTH' && b.type !== 'STAT_STEALTH');
            battle.showFloatingText(atk, "Revealed", "#ccc");
            if(atk.team === 0) battle.log(`👁️ [은신 해제] ${atk.name}이(가) 공격하여 모습을 드러냈습니다.`, 'log-system');
        }

        const dir = battle.grid.getDirection(atk, def);
        atk.facing = dir;

        if (!type) type = atk.atkType || 'PHYS';
        if (atk.team === 0) battle.gainActionXp(atk, 5);
        
        // ⭐ [수정] 조커의 패 (PAS_PROB_UP) 체크
        const jokerPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP'));
        const jokerMult = jokerPassive ? (parseFloat(jokerPassive.effects.find(e => e.type === 'PAS_PROB_UP').val) || 1.5) : 1.0;

        // ⭐ [수정] 완전 범죄 (PAS_IGNORE_GUARD) 체크
        const perfectCrime = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_IGNORE_GUARD'));
        if (perfectCrime && (!skill || skill.id === '1000' || !skill.id)) {
            const prob = (parseFloat(perfectCrime.effects.find(e => e.type === 'PAS_IGNORE_GUARD').prob) || 40) * jokerMult;
            if (Math.random() * 100 <= prob) {
                options.penetrate = 1.0; 
                options.isPerfectCrime = true;
                battle.showFloatingText(atk, "완전 범죄!", "#800080");
            }
        }

        if (name !== "분신 공격" && hitCount === 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
            const doublePassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLE_HIT'));
            // ⭐ [수정] 그림자 칼날 (PAS_DOUBLE_HIT_SKILL) 추가
            const doubleSkillPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLE_HIT_SKILL'));

            if (doublePassive && (!skill || skill.id === '1000' || !skill.id)) {
                let prob = (parseFloat(doublePassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT').prob) || 20);
                if (Math.random() * 100 <= prob) hitCount = 2;
                if (hitCount === 2) battle.log(`👥 [그림자 분신] 환영이 함께 공격합니다!`, 'log-skill');
            } else if (doubleSkillPassive && skill && skill.name && skill.name.includes('단검 투척')) {
                let prob = (parseFloat(doubleSkillPassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT_SKILL').prob) || 30) * jokerMult;
                if (Math.random() * 100 <= prob) {
                    hitCount = 2;
                    options.globalMult = (options.globalMult || 1.0) * (parseFloat(doubleSkillPassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT_SKILL').val) || 0.7);
                    battle.log(`🗡️ [그림자 칼날] 두 번째 단검이 연달아 날아갑니다!`, 'log-skill');
                }
            }
        }

        let beforeHit = null;
        let rangeBeforeHit = null;
        let anyHit = null; 

        if (!options.isCounter && def.skills && atk !== def) {
            beforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_BEFORE_HIT'));
            rangeBeforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RANGE_BEFORE_HIT'));
            anyHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ANY_HIT')); 
        }

        for (let i = 0; i < hitCount; i++) {
            if (atk.curHp <= 0) break; 
            
            let currentDef = def; 
            let dist = battle.grid.getDistance(atk, currentDef);

            if (!options.isCounter && !options.isCovered) {
                const coverUnit = battle.units.find(u => u.team === currentDef.team && u.curHp > 0 && u !== currentDef && battle.grid.getDistance(u, currentDef) <= 1 && u.skills && u.skills.some(s => s.type === 'PASSIVE' && s.effects.some(e=>e.type === 'PAS_COVER_DMG')));
                if (coverUnit) {
                    const coverEff = coverUnit.skills.find(s=>s.type==='PASSIVE' && s.effects.some(e=>e.type==='PAS_COVER_DMG')).effects.find(e=>e.type==='PAS_COVER_DMG');
                    const prob = parseFloat(coverEff.prob) || 50;
                    if (Math.random() * 100 <= prob) {
                        currentDef = coverUnit;
                        dist = battle.grid.getDistance(atk, currentDef);
                        options.isCovered = true; 
                        battle.showFloatingText(currentDef, "대신 맞음!", "#0ff");
                        battle.log(`🦸‍♂️ [비호] ${currentDef.name}이(가) ${def.name}을(를) 감싸며 대신 공격을 받습니다!`, 'log-skill');
                    }
                }
            }

            if (!options.isCounter && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                const interceptPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'INTERCEPT'));
                if (interceptPassive) {
                    const prob = parseFloat(interceptPassive.effects.find(e=>e.type==='INTERCEPT').prob) || 20;
                    if (Math.random() * 100 <= prob) {
                        battle.createProjectile(atk, currentDef); 
                        await new Promise(r => setTimeout(r, 150));
                        battle.showFloatingText(currentDef, "요격!", "#fff");
                        battle.log(`🏹 [요격] ${currentDef.name}이(가) 날아오는 공격을 맞혀 무효화했습니다!`, 'log-system');
                        continue; 
                    }
                }
            }
            
            if (!options.isCounter && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                const blockPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_CASTER_DETECTED' || e.type === 'SPELL_BLOCK'));
                if (blockPassive) {
                    const pEff = blockPassive.effects.find(e => e.type === 'PAS_CASTER_DETECTED' || e.type === 'SPELL_BLOCK');
                    const prob = parseFloat(pEff.prob) || 30;
                    const reflectMult = parseFloat(pEff.val) || 0;

                    if (Math.random() * 100 <= prob) {
                        battle.showFloatingText(currentDef, "주문 차단!", "#0ff");
                        battle.log(`🛡️ [주문 차단] ${currentDef.name}이(가) 날아오는 마법 수식을 파괴했습니다!`, 'log-system');
                        
                        if (reflectMult > 0) {
                            battle.createProjectile(currentDef, atk);
                            await new Promise(r => setTimeout(r, 150));
                            battle.showFloatingText(atk, "주문 반사!", "#f0f");
                            battle.log(`🪞 [주문 반사] 파괴된 마력이 ${atk.name}에게 역류합니다!`, 'log-dmg');
                            await this.performAttack(currentDef, atk, mult * reflectMult, "반사 마법", false, type, 1, {isCounter: true});
                        }
                        continue; 
                    }
                }
            }
            
            if (!options.isCounter) {
                const triggerOptions = { triggerUnit: atk, isCounter: true };

                if (anyHit) {
                    for (const eff of anyHit.effects) {
                        if (eff.type.startsWith('PAS_')) continue; 
                        await battle.skillProcessor.processEffect(eff, atk, atk, currentDef, triggerOptions, anyHit);
                    }
                }

                if (beforeHit && dist <= 1) {
                    for (const eff of beforeHit.effects) {
                        if (eff.type.startsWith('PAS_')) continue; 
                        await battle.skillProcessor.processEffect(eff, atk, atk, currentDef, triggerOptions, beforeHit);
                    }
                }
                if (rangeBeforeHit && dist > 1) {
                    for (const eff of rangeBeforeHit.effects) {
                        if (eff.type.startsWith('PAS_')) continue; 
                        await battle.skillProcessor.processEffect(eff, atk, atk, currentDef, triggerOptions, rangeBeforeHit);
                    }
                }
            }
            if (dist > 1) battle.createProjectile(atk, currentDef);
            else battle.triggerBumpAnimation(atk, currentDef);

            await new Promise(resolve => setTimeout(async () => {
                if (atk === currentDef) options.sureHit = true;

                // ====================================================================
                // ⭐ [기획 반영 1] 고저차(Elevation) 명중 및 데미지 ±5% (최대 30%) 보정
                // ====================================================================
                const currentOptions = { ...options }; 
                
                if (battle.grid) {
                    const atkH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(atk.q, atk.r) : 0;
                    const defH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(def.q, def.r) : 0;                    const heightDiff = atkH - defH;
                    
                    let heightDmgMod = 1.0;
                    let heightAccMod = 0;
                    
                    if (heightDiff > 0) {
                        // High -> Low (1단차당 5% 증가, 최대 30%)
                        heightDmgMod += Math.min(0.30, heightDiff * 0.05);
                        heightAccMod += Math.min(30, heightDiff * 5);
                    } else if (heightDiff < 0) {
                        // Low -> High (1단차당 5% 감소, 최대 -30%)
                        heightDmgMod += Math.max(-0.30, heightDiff * 0.05); 
                        heightAccMod += Math.max(-30, heightDiff * 5);
                    }

                    currentOptions.globalMult = (currentOptions.globalMult || 1.0) * heightDmgMod;
                    currentOptions.accBonus = (currentOptions.accBonus || 0) + heightAccMod;
                }

                const result = Formulas.calculateDamage(atk, currentDef, mult, type, battle.grid, currentOptions);

                if (atk === currentDef) {
                    result.isCrit = false;
                    result.isWeak = false;
                    result.isResist = false;
                    result.isMiss = false;
                }

                if (result.hitContext === 'BACKSTAB') battle.showFloatingText(currentDef, "배후 공격!", "#f0f");
                if (result.hitContext === 'BLOCK') battle.showFloatingText(currentDef, "막음!", "#aaa");
                if (result.hitContext === 'EXECUTE') battle.showFloatingText(currentDef, "처형!", "#f00");

                if (result.isMiss) {
                    battle.showFloatingText(currentDef, result.text, "#888"); 
                    battle.log(`💨 [빗나감] ${atk.name}의 공격이 ${currentDef.name}에게 빗나갔습니다!`, "log-system");
                    if (battle.progression && battle.progression.gainCombatPoints) {
                        battle.progression.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, false, currentDef, false);
                    } else if (battle.gainCombatPoints) {
                        battle.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, false, currentDef, false);
                    }
                    
                    // ⭐ [버그 수정 4-1] 방어자에게 이번 스킬에서 회피했다는 증표 부착
                    currentDef._missedSkill = true; 
                    
                    resolve({ isHit: false, damage: 0 }); return;
                }

                if (result.isCursed) battle.showFloatingText(currentDef, "Cursed!", "#b0b");

                let dmg = result.damage;
                if (currentOptions.bonusDmg) {
                    dmg += currentOptions.bonusDmg;
                }
                
                if (currentDef.isWall || currentDef.type === 'OBJECT') {
                    const wallType = currentDef.unitName || currentDef.key;
                    
                    if (wallType === 'WALL_FIRE') {
                        if (type === 'DMG_ICE' || type === 'DMG_WIND') {
                            dmg = 9999; 
                            battle.log(`❄️ 바람과 얼음이 화염 장벽을 소멸시켰습니다!`, 'log-system');
                        }
                        if (type === 'DMG_LIGHTNING') dmg = 0; 
                        if (type === 'DMG_FIRE') {
                            dmg = 0; 
                            currentOptions.penetrate = 1.0;
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.3; 
                            battle.log(`🔥 화염 마법이 장벽을 관통하며 위력이 30% 증폭됩니다!`, 'log-skill');
                        }
                    } 
                    else if (wallType === 'WALL_ICE') {
                        if (type === 'DMG_FIRE') {
                            dmg = 9999; 
                            battle.log(`🔥 불꽃이 얼음 장벽을 녹여버렸습니다!`, 'log-system');
                        }
                        if (type === 'DMG_ICE' || type === 'DMG_WIND') dmg = 0; 
                        if (type === 'DMG_LIGHTNING') {
                            dmg = 9999; 
                            currentOptions.penetrate = 1.0; 
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.3; 
                            battle.log(`⚡ 벼락이 얼음 장벽을 분쇄하며 위력이 30% 증폭됩니다!`, 'log-skill');
                        }
                    } 
                    else if (wallType === 'WALL_EARTH') {
                        if (type === 'DMG_WIND') dmg = Math.floor(dmg * 1.3); 
                    }
                }

                if (result.text === "IMMUNE") { 
                    dmg = 0; 
                    battle.showFloatingText(currentDef, "면역!", "#fff"); 
                    battle.log(`🛡️ [면역] ${currentDef.name}은(는) 해당 공격에 면역입니다. (피해 무효)`, "log-system");
                }
                
                if (battle.hasStatus(currentDef, 'CC_FREEZE') || battle.hasStatus(currentDef, 'STAT_FREEZE')) {
                    if (type === 'DMG_LIGHTNING' || type === 'LIGHTNING') {
                        dmg *= 1.5;
                        battle.showFloatingText(currentDef, "초전도!", "#ffeb3b");
                        battle.log(`⚡ [초전도] 얼어붙은 ${currentDef.name}에게 전격이 흐르며 추가 피해!`, "log-dmg");
                    }
                    currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'CC_FREEZE' && b.type !== 'STAT_FREEZE');
                    battle.showFloatingText(currentDef, "쇄빙!", "#aef");
                    battle.log(`🧊 [쇄빙] 피격으로 인해 ${currentDef.name}의 빙결이 해제되었습니다.`, "log-system");
                }
                
                const shield = currentDef.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
                if (shield && dmg > 0) {
                    const absorbed = Math.min(shield.amount, dmg);
                    shield.amount -= absorbed;
                    dmg -= absorbed;
                    battle.showFloatingText(currentDef, `(${absorbed})`, "#00bfff"); 
                    battle.log(`💠 [보호막] ${currentDef.name}의 보호막이 ${absorbed} 피해를 흡수했습니다.`, "log-system");
                    if (shield.amount <= 0) currentDef.buffs = currentDef.buffs.filter(b => b !== shield);
                }

                if (type === 'PHYS' || type === 'DMG_PHYS') {
                    if (currentDef.buffs && currentDef.buffs.some(b => b.type === 'BUFF_IMMUNE_PHYS')) {
                        dmg = 0;
                        battle.showFloatingText(currentDef, "PHYS IMMUNE", "#ccc");
                    }
                    const redBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_RED_DMG_PHYS');
                    if (redBuff && dmg > 0) dmg = Math.floor(dmg * parseFloat(redBuff.val)); 
                }
                const redBuffAll = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_RED_DMG_ALL');
                if (redBuffAll && dmg > 0) {
                    dmg = Math.floor(dmg * parseFloat(redBuffAll.val));
                    battle.showFloatingText(currentDef, "보호받음!", "#00ffff");
                    battle.log(`👼 수호천사가 나타나 피해를 반감시킵니다!`, 'log-system');
                }

                const fixedPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'FIXED_TAKE_DMG'));
                if (fixedPassive && dmg > 0 && type === 'PHYS') { 
                    const prob = parseFloat(fixedPassive.effects.find(e => e.type === 'FIXED_TAKE_DMG').prob) || 15;
                    if (Math.random() * 100 <= prob) {
                        dmg = 1;
                        battle.showFloatingText(currentDef, "금강불괴!", "#fff");
                        battle.log(`💎 [금강불괴] ${currentDef.name}이(가) 피해를 1로 고정시켰습니다!`, "log-system");
                    }
                }
                if (battle.hasStatus(currentDef, 'STAT_PETRIFY')) {
                    battle.showFloatingText(currentDef, "돌덩이!", "#aaaaaa");
                    resolve(); return;
                }

                // ⭐ 상태이상 기상 및 해제 로직 (Formulas.js와 역할 분리 완료)
                if (dmg > 0) {
                    // 1. 수면 해제 (방어력 페널티는 Formulas.js에서 처리하므로 1.5배 증폭 코드 삭제)
                    if (battle.hasStatus(currentDef, 'STAT_SLEEP') || battle.hasStatus(currentDef, 'CC_SLEEP')) {
                        currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'STAT_SLEEP' && b.type !== 'CC_SLEEP');
                        battle.showFloatingText(currentDef, "깨어남!", "#ffffff");
                        battle.log(`🔔 앗따가! 피해를 입고 ${currentDef.name}이(가) 잠에서 깼습니다.`, 'log-system');
                    }
                }

                if (currentDef.curHp - dmg <= 0 && currentDef.curHp > 1) {
                    const survivePassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'EFF_SURVIVE'));
                    const surviveBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_STAT_SURVIVE');
                    
                    if (survivePassive || surviveBuff) {
                        const prob = surviveBuff ? 100 : (parseFloat(survivePassive.effects.find(e => e.type === 'EFF_SURVIVE').prob) || 100);
                        if (Math.random() * 100 <= prob) {
                            dmg = currentDef.curHp - 1; 
                            battle.showFloatingText(currentDef, "불멸!", "#ff0");
                            battle.log(`🌬️ [불멸/마지막 숨결] ${currentDef.name}이(가) 치명상을 버텨냈습니다!`, "log-system");
                        }
                    }
                }
                if (battle.activeTimeStop && battle.activeTimeStop.caster.id !== currentDef.id) {
                    currentDef._delayedDamage = (currentDef._delayedDamage || 0) + dmg;
                    battle.showFloatingText(currentDef, "Time Stopped", "#aaa");
                    battle.log(`⏳ 시간 정지: 피해 누적 중... (${currentDef._delayedDamage})`, 'log-system');
                    dmg = 0; 
                }

                currentDef.curHp = Math.max(0, currentDef.curHp - dmg);
                
                // ⭐ [UTG 기획 반영] 데미지를 주거나 입을 때 필살기 게이지 충전
                if (dmg > 0) {
                    atk.utg = Math.min(100, (atk.utg || 0) + 10); // 타격 시 10 충전
                    currentDef.utg = Math.min(100, (currentDef.utg || 0) + 15); // 피격 시 15 충전
                }

                // ⭐ [성장 기획 반영] 적 처치 여부(isKill)를 정확히 판별하여 계산기로 넘김
                const isKill = (currentDef.curHp <= 0);
                if (battle.progression && battle.progression.gainCombatPoints) {
                    battle.progression.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                } else if (battle.gainCombatPoints) {
                    battle.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                }
                
                // 1. 즉발형 연주/춤 (채널링 유지) 취소 판정
                const channelBuff = currentDef.buffs.find(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
                if (channelBuff && dmg > 0 && result.hitContext !== "CC_HIT") {
                    let cancelChance = 100; // ⭐ 기본 취소 확률 100%
                    
                    // 무희(즉흥무), 음유시인(애드리브) 패시브 확인
                    const maintainPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MAINTAIN_CHANT' || e.type === 'PAS_MAINTAIN_DANCE'));
                    if (maintainPassive) {
                        const prob = parseFloat(maintainPassive.effects[0].prob) || 30; 
                        cancelChance -= prob; // ⭐ 취소 확률을 70%로 낮춤 (30% 확률로 스킬 유지)
                    }
                    
                    if (Math.random() * 100 < cancelChance) {
                        currentDef.buffs = currentDef.buffs.filter(b => b !== channelBuff);
                        currentDef.isAuraSource = false;
                        currentDef.auraEffects = [];
                        if (battle.updateAurasForUnit) {
                            battle.units.forEach(u => battle.updateAurasForUnit(u));
                        }
                        if (battle.stopAuraRipple) battle.stopAuraRipple(currentDef);
                        
                        battle.showFloatingText(currentDef, "연주/춤 중단됨!", "#ff5555");
                        battle.log(`💢 공격을 받아 ${currentDef.name}의 지속 스킬이 강제로 끊겼습니다!`, "log-bad");
                        
                        const daCapo = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                        if (daCapo) {
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * 0.3);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                            battle.log(`🔁 [다 카포] 스킬이 취소되어 ${currentDef.name}의 다음 턴이 빠르게 돌아옵니다.`, "log-skill");
                        }
                    } else {
                        // 30% 확률에 당첨되어 스킬이 유지된 경우
                        battle.showFloatingText(currentDef, "집중 유지!", "#55ff55");
                        battle.log(`✨ ${currentDef.name}이(가) 피격에도 불구하고 스킬을 유지해냅니다!`, "log-skill");
                    }
                }

                // 2. 대기형 마법/춤 (차징/캐스팅) 취소 판정
                if (currentDef.isCharging && dmg > 0 && result.hitContext !== "CC_HIT") {
                    let cancelChance = 100; // ⭐ 기본 취소 확률 100%
                    
                    // 무희(즉흥무), 음유시인(애드리브) 패시브 확인
                    const maintainPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MAINTAIN_CHANT' || e.type === 'PAS_MAINTAIN_DANCE'));
                    if (maintainPassive) {
                        const prob = parseFloat(maintainPassive.effects[0].prob) || 30; 
                        cancelChance -= prob; // ⭐ 취소 확률을 70%로 낮춤 (30% 확률로 스킬 유지)
                    }
                    
                    if (Math.random() * 100 < cancelChance) {
                        currentDef.isCharging = false;
                        currentDef.chargingSkill = null;
                        currentDef.chargeTurnLimit = 0;
                        currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'BUFF_CASTING');
                        
                        if (battle.stopCastRipple) battle.stopCastRipple(currentDef);

                        battle.showFloatingText(currentDef, "캐스팅 차단됨!", "#ff5555");
                        battle.log(`💢 공격을 받아 ${currentDef.name}의 캐스팅(집중)이 산산조각 났습니다!`, "log-bad");
                        
                        const daCapo = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                        if (daCapo) {
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * 0.3);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                        }
                    } else {
                        // 30% 확률에 당첨되어 캐스팅이 유지된 경우
                        battle.showFloatingText(currentDef, "집중 유지!", "#55ff55");
                        battle.log(`✨ ${currentDef.name}이(가) 피격에도 불구하고 캐스팅을 유지해냅니다!`, "log-skill");
                    }
                }
                
                let dmgColor = '#ffffff'; 
                if (result.isCrit) dmgColor = '#ff0000';
                else if (result.isWeak) dmgColor = '#ffd700'; 
                else if (result.isResist) dmgColor = '#aaaaaa'; 

                if (dmg > 0) {
                    battle.showFloatingText(currentDef, `-${dmg}`, dmgColor);
                    battle.log(`⚔️ [타격] ${atk.name} ➡️ ${currentDef.name} : ${dmg} 피해${result.isCrit ? ' (치명타!)' : ''}${result.isWeak ? ' (약점 찌름)' : ''}`, 'log-dmg');
                } else if (result.text !== "IMMUNE") {
                    battle.showFloatingText(currentDef, "0", "#aaa");
                    battle.log(`🛡️ [방어됨] ${atk.name} ➡️ ${currentDef.name} : 방어력에 막혀 피해를 주지 못했습니다.`, 'log-system');
                }

                if (currentOptions.instantDeath !== undefined && currentDef.curHp > 0) {
                    if (Math.random() * 100 <= currentOptions.instantDeath) {
                        currentDef.curHp = 0; 
                        battle.showFloatingText(currentDef, "즉사!", "#8800ff");
                        battle.log(`☠️ [즉사] ${atk.name}의 치명적인 일격! ${currentDef.name} 즉사!`, 'log-dmg');
                        battle.triggerShakeAnimation(currentDef);
                    } else {
                        battle.log(`💢 [즉사 실패] ${currentDef.name}이(가) 급소를 아슬아슬하게 피했습니다.`, 'log-system');
                    }
                }
                
                battle.triggerShakeAnimation(currentDef);

                if (isDrain && dmg > 0) {
                    let heal = Math.floor(dmg * 0.5); 
                    atk.curHp = Math.min(atk.hp, atk.curHp + heal);
                    battle.showFloatingText(atk, `+${heal}`, '#5f5');
                    battle.log(`🧛 [흡혈] ${atk.name}이(가) ${heal} HP를 흡수했습니다.`, 'log-heal');
                }

                const reflectBuff = currentDef.buffs.find(b => b.type === 'BUFF_REFLECT' || b.type === 'BUFF_COUNTER');
                const reflectPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_REFLECT_DMG'));
                
                if ((reflectBuff || reflectPassive) && !currentOptions.isReflected && dmg > 0 && dist <= 1 && atk !== currentDef) { 
                    let prob = 100;
                    let reflectRatio = 0.5;
                    let isPassiveReflect = false; 
                    
                    if (reflectPassive) {
                        const rEff = reflectPassive.effects.find(e => e.type === 'PAS_REFLECT_DMG');
                        prob = parseFloat(rEff.prob) || 30; 
                        reflectRatio = parseFloat(rEff.val) || 1.5;
                        isPassiveReflect = true;
                    } else if (reflectBuff) {
                        reflectRatio = parseFloat(reflectBuff.val) || 0.5;
                    }

                    if (Math.random() * 100 <= prob) {
                        const reflectDmg = Math.floor(dmg * reflectRatio); 
                        
                        if (isPassiveReflect && reflectRatio < 1.0) {
                            dmg = Math.floor(dmg * (1.0 - reflectRatio)); 
                            battle.showFloatingText(currentDef, "피해 감소됨!", "#aaa");
                        }

                        if (reflectDmg > 0) {
                            atk.curHp = Math.max(0, atk.curHp - reflectDmg);
                            battle.showFloatingText(atk, `Reflect -${reflectDmg}`, '#f0f');
                            const reflectName = isPassiveReflect ? reflectPassive.name : "피해 반사";
                            battle.log(`🪞 [반사] ${currentDef.name}의 [${reflectName}]! ${atk.name}에게 ${reflectDmg} 데미지 반환!`, 'log-dmg');
                        }
                    }
                }

                if (!currentOptions.isCounter && currentDef.curHp > 0 && currentDef.skills && atk !== currentDef) {
                    // ⭐ [수정] 조커의 패 배율 다시 확인
                    const targetJoker = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP'));
                    const targetJokerMult = targetJoker ? (parseFloat(targetJoker.effects.find(e => e.type === 'PAS_PROB_UP').val) || 1.5) : 1.0;

                    const afterHit = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AFTER_HIT'));
                    if (afterHit) {
                        const prob = (parseFloat(afterHit.effects[0].prob) || 100) * targetJokerMult;
                        if (Math.random() * 100 <= prob && afterHit.effects.length > 1) {
                            battle.log(`💨 [소멸/환영 탈출] ${currentDef.name}의 패시브 발동!`, 'log-skill');
                            const triggerEff = afterHit.effects.find(e => !e.type.startsWith('PAS_'));
                            if (triggerEff) battle.skillProcessor.processEffect(triggerEff, atk, atk, currentDef, {triggerUnit: atk}, afterHit);
                        }
                    }

                    // ⭐ [수정] 빠른 손 (Quick Hands: 근접 물리 피격 시 훔치기 발동)
                    const quickHands = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_DMGRED_MELEE_PHYS'));
                    if (quickHands && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                        const eff = quickHands.effects.find(e => e.type !== 'PAS_DMGRED_MELEE_PHYS');
                        const prob = (parseFloat(eff ? eff.prob : 30) || 30) * targetJokerMult;
                        if (Math.random() * 100 <= prob && eff) {
                            battle.log(`⚡ [빠른 손] ${currentDef.name}이(가) 공격을 받아치며 손을 뻗습니다!`, 'log-skill');
                            battle.skillProcessor.processEffect(eff, atk, atk, currentDef, {triggerUnit: atk}, quickHands);
                        }
                    }
                }

                if (currentDef.curHp <= 0) battle.handleDeath(currentDef, atk);
                
                // ====================================================================
                // ⭐ [기획 반영 2] 창(Spear/Lance)의 직선 관통 및 -50% 뎀감 로직
                // ====================================================================
                if (!currentOptions.isCounter && !currentOptions.isPierceHit && hitCount === 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                    let weaponType = 'SWORD';
                    if (atk.equipment && atk.equipment.mainHand && battle.gameApp.itemData[atk.equipment.mainHand]) {
                        weaponType = battle.gameApp.itemData[atk.equipment.mainHand].subType || 'SWORD';
                    }

                    if (weaponType === 'SPEAR' || weaponType === 'LANCE') {
                        // 피격당한 적의 바로 등 뒤 헥스를 찌름 (할버드는 제외됨!)
                        const pushDir = battle.grid.getDirection(atk, currentDef);
                        const backHex = battle.grid.getNeighborInDir(currentDef, pushDir);
                        if (backHex) {
                            const backTarget = battle.getUnitAt(backHex.q, backHex.r);
                            if (backTarget && backTarget.curHp > 0 && backTarget.team !== atk.team) {
                                battle.log(`🗡️ [관통] 창날이 ${currentDef.name}을(를) 뚫고 뒤의 ${backTarget.name}까지 찌릅니다!`, 'log-skill');
                                
                                // 관통 데미지는 -50% 보정 (globalMult 활용)
                                const pierceOptions = { ...currentOptions, isPierceHit: true, globalMult: (currentOptions.globalMult || 1.0) * 0.5 };
                                
                                // 비동기 타이밍 조절을 통한 자연스러운 2차 타격 연출
                                setTimeout(async () => {
                                    await this.performAttack(atk, backTarget, mult, "관통", isDrain, type, 1, pierceOptions);
                                }, 200); 
                            }
                        }
                    }
                }

                // ⭐ [수정] 명중했다는 결과값과 데미지를 명시적으로 리턴
                resolve({ isHit: true, damage: dmg });
            }, dist > 1 ? 150 : 100));

            if (i < hitCount - 1) await new Promise(r => setTimeout(r, 200));
        }

        const dist = battle.grid.getDistance(atk, def);
        const counterBuff = def.buffs.find(b => b.type === 'BUFF_COUNTER');
        const counterPassive = (def.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_COUNTER'));
        
        // ⭐ [수정] 완전 범죄 (PAS_DISABLE_COUNTER)로 반격 무시
        let ignoreCounter = false;
        if (options.isPerfectCrime) {
            ignoreCounter = true;
            battle.log(`🎩 [완전 범죄] ${atk.name}의 치밀한 공격에 ${def.name}은(는) 반격할 틈을 찾지 못합니다!`, 'log-skill');
        }

        if (!ignoreCounter && (counterBuff || counterPassive) && def.curHp > 0 && dist <= Formulas.getDerivedStat(def, 'rng') && !options.isCounter && atk !== def) {
            // ⭐ 신규: 시간이 멈춘 상태에서는 적들이 반격을 시도하지 않음
            if (!(battle.activeTimeStop && battle.activeTimeStop.caster.id === atk.id)) {
                let prob = 100;
                if (counterPassive) {
                    const cEff = counterPassive.effects.find(e => e.type === 'PAS_COUNTER');
                    prob = parseFloat(cEff.prob) || 30; 
                    if (cEff.type === 'PAS_COUNTER_RANGED' && dist <= 1) prob = 0;
                }
                if (Math.random() * 100 <= prob) {
                    battle.log(`⚔️ [반격 발동] ${def.name}이(가) 공격을 받아칩니다!`, 'log-skill');
                    await new Promise(r => setTimeout(r, 300));
                    await this.performAttack(def, atk, 1.0, "반격", false, def.atkType || 'PHYS', 1, { isCounter: true });
                }
            }
        }

        if (!options.isCounter && def.team === atk.team && def !== atk && def.curHp > 0) {
            const allies = battle.units.filter(u => u.team === def.team && u.curHp > 0 && u !== def);
            for (const ally of allies) {
                // ⭐ [기획 반영] 해당 패시브가 장착 슬롯(equippedSkills)에 존재하는지 반드시 확인
                const coverPassive = (ally.skills || []).find(s => 
                    (ally.equippedSkills || []).includes(s.id) &&
                    (s.part === 'S' || s.part === 'P' || s.type === 'PASSIVE') && 
                    s.effects && s.effects.some(e => e.type === 'PAS_ALLY_HIT')
                );                if (coverPassive && battle.grid.getDistance(ally, atk) <= Formulas.getDerivedStat(ally, 'rng')) {
                    const prob = parseFloat(coverPassive.effects.find(e => e.type === 'PAS_ALLY_HIT').prob) || 40;
                    if (Math.random() * 100 <= prob) {
                        battle.log(`🛡️ [엄호 사격] ${ally.name}이(가) 공격받은 아군을 지원합니다!`, 'log-skill');
                        await new Promise(r => setTimeout(r, 200));
                        await this.performAttack(ally, atk, 1.0, "엄호", false, ally.atkType || 'RANGED', 1, { isCounter: true });
                        break; 
                    }
                }
            }
        }
    }
}