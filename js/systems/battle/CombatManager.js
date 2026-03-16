import * as Formulas from '../../utils/formulas.js';

export class CombatManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    async performAttack(atk, def, mult, name, isDrain, type, hitCount = 1, options = {}) {
        const battle = this.battle;
        
        // ⭐ [1번 버그 근본 해결] 공격자나 방어자 객체가 파괴되었거나 유효하지 않으면 즉시 중단 (에러 방지)
        if (!def || def.hp === undefined || def.curHp <= 0) return;
        if (!atk || !atk.id) return; // 환경 피해나 주체가 없는 공격일 경우 패시브 연산 생략
        
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
        
        // 일반 공격 판정 여부 통합 확인 (기본 공격, 연격, 연타 등)
        const isBasicAtk = (!skill || skill.id === '1000' || !skill.id || (skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => skill.name.includes(n))));

        // [도적 기획 반영] 조커의 패 (PAS_PROB_UP_THIEF) - 도적 전용 확률 +30% 보정
        const jokerPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP_THIEF' || e.type === 'PAS_PROB_UP'));
        const jokerBonus = jokerPassive ? 30 : 0;

        // [도적 기획 반영] 완전 범죄 (PAS_IGNORE_GUARD) - 20% 확률로 방어/반격 무시
        const perfectCrime = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_IGNORE_GUARD'));
        if (perfectCrime && isBasicAtk && !options.isCounter && !options.isPierceHit) {
            const prob = (parseFloat(perfectCrime.effects.find(e => e.type === 'PAS_IGNORE_GUARD').prob) || 20) + jokerBonus;
            if (Math.random() * 100 <= prob) {
                options.penetrate = 1.0; 
                options.isPerfectCrime = true;
                battle.showFloatingText(atk, "완전 범죄!", "#800080");
            }
        }

        if (name !== "분신 공격" && hitCount === 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
            const doublePassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLE_HIT'));
            const doubleSkillPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLE_HIT_SKILL'));

            if (doublePassive && isBasicAtk) {
                let prob = (parseFloat(doublePassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT').prob) || 20);
                if (Math.random() * 100 <= prob) hitCount = 2;
                if (hitCount === 2) battle.log(`👥 [그림자 분신] 환영이 함께 공격합니다!`, 'log-skill');
            } else if (doubleSkillPassive && skill && skill.name && skill.name.includes('단검 투척')) {
                // [도적 기획 반영] 그림자 칼날 (단검 투척 연사 + 조커의 패 보정)
                let prob = (parseFloat(doubleSkillPassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT_SKILL').prob) || 30) + jokerBonus;
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

        if (!options.isCounter && !options.isPierceHit && def.skills && atk !== def) {
            beforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_BEFORE_HIT'));
            rangeBeforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RANGE_BEFORE_HIT'));
            anyHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ANY_HIT')); 
        }

        // [무투가 기획 반영] 선견: 일반 공격 피격 전 30% 확률로 선제 타격
        const isBasicAtkCheck = (!skill || skill.id === '1000' || !skill.id || (skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => skill.name.includes(n))));
        const distToDef = battle.grid.getDistance(atk, def);
        if (!options.isCounter && !options.isPreemptive && !options.isPierceHit && distToDef <= 1 && isBasicAtkCheck && (type === 'PHYS' || type === 'DMG_PHYS')) {
            const preemptive = (def.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PREEMPTIVE_STRIKE'));
            if (preemptive) {
                const prob = parseFloat(preemptive.effects.find(e => e.type === 'PAS_PREEMPTIVE_STRIKE').prob) || 30;
                if (Math.random() * 100 <= prob) {
                    battle.showFloatingText(def, "선견!", "#ffcc00");
                    battle.log(`👁️ [선견] ${def.name}이(가) 적의 움직임을 읽고 선제 공격을 날립니다!`, 'log-skill');
                    await this.performAttack(def, atk, 1.0, "선제 공격", false, def.atkType || 'PHYS', 1, { isCounter: true, isPreemptive: true, skill: { id: '1000' } });
                    if (def.curHp <= 0 || atk.curHp <= 0) return; // 선제 공격으로 누군가 죽으면 메인 공격 취소
                }
            }
        }

        let firstHitLanded = false; // [무투가] 연타 스킬 연속 명중용 추적 변수

        for (let i = 0; i < hitCount; i++) {
            if (atk.curHp <= 0) break; 
            
            let currentDef = def; 
            let dist = battle.grid.getDistance(atk, currentDef);

            if (!options.isCounter && !options.isCovered && !options.isPierceHit) {
                // 1. 희생 (BUFF_SACRIFICE) 최우선 적용
                const sacrificeUnit = battle.units.find(u => 
                    u.team === currentDef.team && u.curHp > 0 && u !== currentDef && 
                    u.buffs.some(b => b.type === 'BUFF_SACRIFICE') && 
                    battle.grid.getDistance(u, currentDef) <= 1
                );

                if (sacrificeUnit) {
                    currentDef = sacrificeUnit;
                    dist = battle.grid.getDistance(atk, currentDef);
                    options.isCovered = true;
                    options.forceFrontal = true;
                    options.sureHit = true;     
                    battle.showFloatingText(currentDef, "희생!", "#ffaa00");
                    battle.log(`❤️‍🩹 [희생] ${currentDef.name}이(가) ${def.name}의 피해를 온몸으로 대신 받습니다!`, 'log-skill');
                } else {
                    // 2. 일반 비호 및 조건부 비호
                    const coverUnit = battle.units.find(u => u.team === currentDef.team && u.curHp > 0 && u !== currentDef && battle.grid.getDistance(u, currentDef) <= 1 && u.skills && u.skills.some(s => s.type === 'PASSIVE' && s.effects.some(e=>e.type === 'PAS_COVER_DMG' || e.type === 'PAS_COVER_DMG_COND')));
                    if (coverUnit) {
                        const coverEff = coverUnit.skills.find(s=>s.type==='PASSIVE' && s.effects.some(e=>e.type.startsWith('PAS_COVER'))).effects.find(e=>e.type.startsWith('PAS_COVER'));
                        
                        let canCover = true;
                        if (coverEff.type === 'PAS_COVER_DMG_COND' && coverUnit.curHp <= coverUnit.hp * 0.3) canCover = false;
                        
                        if (canCover) {
                            const prob = parseFloat(coverEff.prob) || 50;
                            if (Math.random() * 100 <= prob) {
                                currentDef = coverUnit;
                                dist = battle.grid.getDistance(atk, currentDef);
                                options.isCovered = true; 
                                options.forceFrontal = true;
                                options.sureHit = true;     
                                battle.showFloatingText(currentDef, "비호!", "#0ff");
                                battle.log(`🦸‍♂️ [비호] ${currentDef.name}이(가) ${def.name}을(를) 감싸며 대신 공격을 받습니다!`, 'log-skill');
                            }
                        }
                    }
                }
            }

            const isLoopBasicAtk = (!options.skill || options.skill.id === '1000' || !options.skill.id || (options.skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => options.skill.name.includes(n))));
            
            // 패링(Parry): 근접 물리 '일반 공격' 피격 시 확률적 무효화
            if (!options.isCounter && !options.isPierceHit && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && isLoopBasicAtk) {
                const parryPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PARRY'));
                if (parryPassive) {
                    const prob = parseFloat(parryPassive.effects.find(e => e.type === 'PAS_PARRY').prob) || 20;
                    if (Math.random() * 100 <= prob) {
                        battle.showFloatingText(currentDef, "패링!", "#ffffff");
                        battle.log(`⚔️ [패링] ${currentDef.name}이(가) 적의 근접 일반공격을 완벽히 튕겨냈습니다!`, 'log-system');
                        continue; 
                    }
                }
            }

            if (!options.isCounter && !options.isPierceHit && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS')) { 
                const interceptPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'INTERCEPT'));
                const hitDirForIntercept = battle.grid ? battle.grid.getDirection(currentDef, atk) : 0;
                const diffForIntercept = Math.abs(currentDef.facing - hitDirForIntercept);
                const isBackstabForIntercept = (diffForIntercept === 3);

                if (interceptPassive && !isBackstabForIntercept) {
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
            
            if (!options.isCounter && !options.isPierceHit && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                const blockIntPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'SPELL_BLOCK_INT'));
                if (blockIntPassive) {
                    const myInt = Formulas.getStat(currentDef, 'int');
                    const atkInt = Formulas.getStat(atk, 'int');
                    const intDiff = Math.max(0, myInt - atkInt);
                    const baseProb = parseFloat(blockIntPassive.effects.find(e => e.type === 'SPELL_BLOCK_INT').prob) || 30;
                    const prob = Math.min(80, baseProb + (intDiff * 1.5));
                    
                    if (Math.random() * 100 <= prob) {
                        battle.showFloatingText(currentDef, "주문 역산!", "#0ff");
                        battle.log(`🛡️ [주문 차단] ${currentDef.name}이(가) 지능의 격차를 이용해 마법 수식을 완벽히 역산하여 무효화했습니다!`, 'log-system');
                        continue; 
                    }
                }

                const blockPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_CASTER_DETECTED' || e.type === 'SPELL_BLOCK' || e.type === 'PAS_SPELL_REFLECTION'));
                if (blockPassive) {
                    const pEff = blockPassive.effects.find(e => e.type === 'PAS_CASTER_DETECTED' || e.type === 'SPELL_BLOCK' || e.type === 'PAS_SPELL_REFLECTION');
                    const prob = parseFloat(pEff.prob) || 25;
                    const isReflection = pEff.type === 'PAS_SPELL_REFLECTION';
                    const reflectMult = isReflection ? (parseFloat(pEff.val) || 1.0) : (parseFloat(pEff.val) || 0);

                    if (Math.random() * 100 <= prob) {
                        if (isReflection) {
                            battle.showFloatingText(currentDef, "주문 반사!", "#f0f");
                            battle.log(`🪞 [주문 반사] ${currentDef.name}이(가) 날아오는 공격 마법을 거울처럼 튕겨냅니다!`, 'log-skill');
                        } else {
                            battle.showFloatingText(currentDef, "주문 차단!", "#0ff");
                            battle.log(`🛡️ [주문 차단] ${currentDef.name}이(가) 날아오는 마법 수식을 파괴했습니다!`, 'log-system');
                        }
                        
                        if (reflectMult > 0) {
                            battle.createProjectile(currentDef, atk);
                            await new Promise(r => setTimeout(r, 150));
                            if (!isReflection) battle.showFloatingText(atk, "주문 반사!", "#f0f");
                            await this.performAttack(currentDef, atk, mult * reflectMult, isReflection ? "반사 마법" : "반사 마법", false, type, 1, {isCounter: true});
                        }
                        continue; 
                    }
                }
            }
            
            if (!options.isCounter && !options.isPierceHit) {
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

                const currentOptions = { ...options }; 

                // ====================================================================
                // ⭐ [무기 특수 룰 통합 적용부]
                // ====================================================================
                let weaponType = 'BARE_HANDS';
                let isOffHandEmpty = !atk.equipment || !atk.equipment.offHand;
                
                if (atk.equipment && atk.equipment.mainHand && battle.gameApp && battle.gameApp.itemData) {
                    const wepItem = battle.gameApp.itemData[atk.equipment.mainHand];
                    if (wepItem && wepItem.subType) weaponType = String(wepItem.subType).toUpperCase();
                }

                // 1. 겸용 무기(1H&2H) 양손 장착 시 공격력 30% 보정
                const versatileWeapons = ['BASTARD_SWORD', 'KATANA', 'BATTLE_AXE', 'WAR_HAMMER', 'SHORT_SPEAR'];
                if (versatileWeapons.includes(weaponType) && isOffHandEmpty) {
                    currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.3;
                }

                // 2. 몰(Maul) 보정: 일반 공격 시 명중률 -20%, 크리티컬 확률 +20%
                if (weaponType === 'MAUL' && isLoopBasicAtk) {
                    currentOptions.accBonus = (currentOptions.accBonus || 0) - 20;
                    currentOptions.critBonus = (currentOptions.critBonus || 0) + 20;
                }

                // 3. 맨손(Bare Hands) 무투가 기공/사신연무 데미지 30% 증폭
                if (weaponType === 'BARE_HANDS' && currentOptions.skill) {
                    const fistBonusSkills = ['격공장', '진뇌장', '권강', '현무진파', '주작선무', '청룡승천', '백호연환'];
                    if (fistBonusSkills.includes(currentOptions.skill.name)) {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.3;
                    }
                }

                // 4. 무희 야간 안무 상태이상 디버프 페널티 (-20%)
                if (currentOptions.skill && currentOptions.skill.category && currentOptions.skill.category.includes('DANCE')) {
                    if (battle.isNight && battle.isNight()) {
                        currentOptions.buffChanceBonus = (currentOptions.buffChanceBonus || 0) - 20;
                    }
                }

                // 5. 봉(Quarterstaff) 및 채찍(Whip) 동시 타격 페널티 (options.targetCount 연동)
                if (currentOptions.targetCount > 1) {
                    if (weaponType === 'QUARTERSTAFF') {
                        if (currentOptions.targetCount === 2) {
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 0.85;
                            currentOptions.accBonus = (currentOptions.accBonus || 0) - 15;
                        } else if (currentOptions.targetCount >= 3) {
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 0.75;
                            currentOptions.accBonus = (currentOptions.accBonus || 0) - 25;
                        }
                    } else if (weaponType === 'WHIP' && currentOptions.targetCount === 2) {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 0.80;
                        currentOptions.accBonus = (currentOptions.accBonus || 0) - 10;
                    }
                }

                // ====================================================================

                // [음유시인/무희 기획 통합 반영] 아파시오나토 & 절대음감 & 절대균형 & 메아리 & 잔상
                if (currentOptions.skill) {
                    let buffChanceBonus = currentOptions.buffChanceBonus || 0;
                    let buffPowerBonus = currentOptions.buffPowerBonus || 0;
                    let durationBonus = currentOptions.debuffDurationBonus || 0;

                    const appassionato = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_COND_HP'));
                    if (appassionato) {
                        const reqHpRatio = parseFloat(appassionato.effects.find(e => e.type === 'PAS_COND_HP').val) || 0.5;
                        if ((atk.curHp / (atk.hp || 100)) <= reqHpRatio) {
                            buffChanceBonus += 20;
                            buffPowerBonus += 0.2;
                        }
                    }

                    const absolutePitch = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_RQ'));
                    if (absolutePitch && currentOptions.skill.category && currentOptions.skill.category.includes('RQ')) {
                        buffChanceBonus += 30;
                    }
                    const perfectBalance = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_DM'));
                    if (perfectBalance && currentOptions.skill.category && currentOptions.skill.category.includes('DM')) {
                        buffChanceBonus += 30;
                    }

                    const echoSound = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_EXTEND_DEBUFF'));
                    if (echoSound && currentOptions.skill.category && (currentOptions.skill.category.includes('RQ') || currentOptions.skill.category.includes('DR') || currentOptions.skill.category.includes('DM'))) {
                        durationBonus = 1;
                    }

                    currentOptions.buffChanceBonus = buffChanceBonus;
                    currentOptions.buffPowerBonus = buffPowerBonus;
                    currentOptions.debuffDurationBonus = durationBonus;
                }

                // [마법사] 술식 조정
                if (atk.team === currentDef.team && atk !== currentDef && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                    const safeAllyPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AOE_SAFE_ALLY'));                    
                    if (safeAllyPassive && skill && skill.area && skill.area !== 0 && skill.area !== 'SINGLE') {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 0.5;
                        currentOptions.isSafeAlly = true; 
                        battle.showFloatingText(currentDef, "술식 보호", "#00ff00");
                    }
                }

                // [무투가] 청룡승천
                if (skill && skill.name === '청룡승천' && battle.isFlying && battle.isFlying(currentDef)) {
                    currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.5;
                }

                // [무투가] 발경, 권강 방어력 무시
                if (skill && skill.name === '발경') currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + 0.5;
                if (skill && skill.name === '권강') currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + 1.0;

                // [무투가] 연타, 백호연환 두 번째 타격부터 100% 명중
                if (i > 0 && firstHitLanded && skill && (skill.name === '연타' || skill.name === '백호연환')) {
                    currentOptions.sureHit = true;
                }

                // 일반 공격(기본 공격, 연격 등) 전용 데미지 보정
                if (isLoopBasicAtk) {
                    if (i === 0) {
                        const anatomical = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_IGNORE_DEF'));
                        if (anatomical && Math.random() * 100 <= (parseFloat(anatomical.effects[0].prob) || 30)) {
                            currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + parseFloat(anatomical.effects[0].val || 0.15);
                            battle.showFloatingText(atk, "혈도 타격", "#ffaa00");
                        }
                    }
                    if (i === 0) {
                        const basicUpPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_ATK_UP'));
                        if (basicUpPassive) {
                            const val = parseFloat(basicUpPassive.effects.find(e => e.type === 'PAS_BASIC_ATK_UP').val) || 1.2;
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * val;
                        }
                    }

                    const basicDefUp = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_DEF_UP'));
                    if (basicDefUp) {
                        const val = parseFloat(basicDefUp.effects.find(e => e.type === 'PAS_BASIC_DEF_UP').val) || 1.2;
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) / val;
                    }

                    const nextBasicBuff = atk.buffs.find(b => b.type === 'BUFF_NEXT_BASIC_ATK' || b.type === 'BUFF_NEXT_PHYS_ATK');
                    if (nextBasicBuff) {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * parseFloat(nextBasicBuff.val || 1.3);
                        atk.buffs = atk.buffs.filter(b => b !== nextBasicBuff); 
                        battle.log(`💢 [힘의 방출] ${atk.name}의 일격에 실린 힘이 터져나옵니다!`, 'log-skill');
                    }
                }
                
                // ⭐ [고저차 보정]
                if (battle.grid) {
                    const atkH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(atk.q, atk.r) : 0;                    
                    const defH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(def.q, def.r) : 0;                    
                    const heightDiff = atkH - defH;
                    
                    let heightDmgMod = 1.0;
                    let heightAccMod = 0;
                    
                    if (heightDiff > 0) {
                        heightDmgMod += Math.min(0.30, heightDiff * 0.05);
                        heightAccMod += Math.min(30, heightDiff * 5);
                    } else if (heightDiff < 0) {
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
                    
                    currentDef._missedSkill = true; 

                    // [무투가] 천지역전세 (회피 성공 시 반격)
                    const celestial = currentDef.buffs.find(b => b.type === 'BUFF_CELESTIAL_REVERSAL');
                    if (celestial && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && !options.isCounter && !options.isPierceHit) {
                        battle.showFloatingText(currentDef, "역전세!", "#00ffff");
                        battle.log(`☯️ [천지역전세] ${currentDef.name}이(가) 공격을 흘려내고 즉시 반격합니다!`, 'log-skill');
                        await this.performAttack(currentDef, atk, 0.7, "역전세 반격", false, currentDef.atkType || 'PHYS', 1, { isCounter: true, skill: { id: '1000' } });
                    }
                    
                    resolve({ isHit: false, damage: 0 }); return;
                }

                firstHitLanded = true; // 명중 성공 기록

                if (result.isCursed) battle.showFloatingText(currentDef, "Cursed!", "#b0b");
                let dmg = result.damage;
                if (currentOptions.bonusDmg) {
                    dmg += currentOptions.bonusDmg;
                }
                
                // [성직자] 언데드 타격 보정
                if (currentDef.race === 'UNDEAD' && ['HOLY', 'DMG_HOLY'].includes(type)) {
                    battle.showFloatingText(currentDef, "언데드 추뎀!", "#ffff00");
                }

                // [성직자] 구마술 즉사
                if (skill && skill.name === '구마술' && currentDef.race === 'UNDEAD' && (currentDef.curHp - dmg) <= 0) {
                    currentDef.isFullyDead = true; 
                    battle.log(`✝️ [구마술] 불경한 자가 빛에 타들어가며 전장에서 영구히 소멸합니다!`, "log-skill");
                }
                
                // 벽/지형 오브젝트 상호작용
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
                
                // 빙결 시 번개 추뎀 (초전도)
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
                
                // 보호막 차감 처리
                const shield = currentDef.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
                if (shield && dmg > 0) {
                    const absorbed = Math.min(shield.amount, dmg);
                    shield.amount -= absorbed;
                    dmg -= absorbed;
                    battle.showFloatingText(currentDef, `(${absorbed})`, "#00bfff"); 
                    battle.log(`💠 [보호막] ${currentDef.name}의 보호막이 ${absorbed} 피해를 흡수했습니다.`, "log-system");
                    
                    if (shield.amount <= 0 || shield.name === '신의 자비') {
                        currentDef.buffs = currentDef.buffs.filter(b => b !== shield);
                        if (shield.name === '신의 자비') battle.log(`✨ [신의 자비] 신성한 보호막이 피해를 흡수하고 소멸했습니다.`, "log-skill");
                    }
                }

                if (type === 'PHYS' || type === 'DMG_PHYS') {
                    if (currentDef.buffs && currentDef.buffs.some(b => b.type === 'BUFF_IMMUNE_PHYS')) {
                        dmg = 0;
                        battle.showFloatingText(currentDef, "PHYS IMMUNE", "#ccc");
                    }
                    const redBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_RED_DMG_PHYS');
                    if (redBuff && dmg > 0) dmg = Math.floor(dmg * parseFloat(redBuff.val)); 
                }
                
                let hasRedBuffAll = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_RED_DMG_ALL');
                let redBuffVal = hasRedBuffAll ? parseFloat(hasRedBuffAll.val) : 1.0;

                // [성직자] 수호천사
                if (!hasRedBuffAll && currentDef.skills) {
                    const guardianAngel = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ANY_HIT') && s.name === '수호천사');
                    if (guardianAngel) {
                        const prob = parseFloat(guardianAngel.effects[0].prob) || 30;
                        if (Math.random() * 100 <= prob) {
                            hasRedBuffAll = true;
                            redBuffVal = parseFloat(guardianAngel.effects[1]?.val) || 0.5;
                        }
                    }
                }

                if (hasRedBuffAll && dmg > 0) {
                    dmg = Math.floor(dmg * redBuffVal);
                    battle.showFloatingText(currentDef, "수호천사!", "#00ffff");
                    battle.log(`👼 [수호천사] 기적처럼 수호천사가 강림하여 피해를 반감시킵니다!`, 'log-skill');
                }

                // [패시브] 금강불괴 고정피해
                const fixedPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'FIXED_TAKE_DMG' || e.type === 'DMG_TAKE_FIXED'));                if (fixedPassive && dmg > 0 && type === 'PHYS') { 
                    const pEff = fixedPassive.effects.find(e => e.type === 'FIXED_TAKE_DMG' || e.type === 'DMG_TAKE_FIXED');
                    const prob = parseFloat(pEff.prob) || 15;
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

                // 상태이상 기상
                if (dmg > 0) {
                    if (battle.hasStatus(currentDef, 'STAT_SLEEP') || battle.hasStatus(currentDef, 'CC_SLEEP')) {
                        currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'STAT_SLEEP' && b.type !== 'CC_SLEEP');
                        battle.showFloatingText(currentDef, "깨어남!", "#ffffff");
                        battle.log(`🔔 앗따가! 피해를 입고 ${currentDef.name}이(가) 잠에서 깼습니다.`, 'log-system');
                    }
                }

                // [마법사] 마력방패 & 버티기
                if (currentDef.curHp - dmg <= 0 && currentDef.curHp > 1) {
                    const survivePassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'EFF_SURVIVE' || e.type === 'PAS_MANA_SHIELD_SURVIVE'));
                    const surviveBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_STAT_SURVIVE');
                    
                    if (survivePassive || surviveBuff) {
                        const manaShieldEff = survivePassive ? survivePassive.effects.find(e => e.type === 'PAS_MANA_SHIELD_SURVIVE') : null;
                        
                        if (manaShieldEff) {
                            if (!currentDef._manaShieldSurviveUsed) {
                                const excessDmg = dmg - (currentDef.curHp - 1);
                                if (currentDef.curMp >= excessDmg) {
                                    currentDef.curMp -= excessDmg;
                                    dmg = currentDef.curHp - 1;
                                    currentDef._manaShieldSurviveUsed = true;
                                    battle.showFloatingText(currentDef, `마력 방패 (-${Math.floor(excessDmg)}MP)`, "#00aaff");
                                    battle.log(`🛡️ [마력 방패] ${currentDef.name}이(가) 마나를 방패 삼아 치명상을 버텨냈습니다!`, "log-skill");
                                }
                            }
                        } else {
                            const prob = surviveBuff ? 100 : (parseFloat(survivePassive.effects.find(e => e.type === 'EFF_SURVIVE').prob) || 100);
                            if (Math.random() * 100 <= prob) {
                                dmg = currentDef.curHp - 1; 
                                battle.showFloatingText(currentDef, "불멸!", "#ff0");
                                battle.log(`🌬️ [불멸/마지막 숨결] ${currentDef.name}이(가) 치명상을 버텨냈습니다!`, "log-system");
                            }
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
                
                // [앙상블] 리버스 (사망 직후 부활)
                if (currentDef.curHp <= 0) {
                    const rebirthBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_REBIRTH');
                    if (rebirthBuff) {
                        currentDef.curHp = currentDef.hp; // 100% 부활
                        currentDef.buffs = currentDef.buffs.filter(b => b !== rebirthBuff);
                        battle.showFloatingText(currentDef, "재생 발동!", "#00ffff");
                        battle.log(`👼 [재생] 치명상을 입었으나 영광의 빛이 ${currentDef.name}을(를) 완벽한 상태로 부활시켰습니다!`, 'log-heal');
                        battle.triggerShakeAnimation(currentDef);
                        if (battle.ui && battle.ui.renderUnitOverlays) battle.ui.renderUnitOverlays();
                    }
                }

                // [연금술사] 호문클루스 본체 데미지 전이
                if (currentDef.key === 'HOMUNCULUS' && currentDef.ownerId && dmg > 0) {
                    const owner = battle.units.find(u => u.id === currentDef.ownerId && u.curHp > 0);
                    if (owner) {
                        const transferDmg = Math.max(1, Math.floor(dmg * 0.2));
                        owner.curHp = Math.max(0, owner.curHp - transferDmg);
                        battle.showFloatingText(owner, `링크 피해 -${transferDmg}`, "#ff00ff");
                        battle.log(`🔗 [의지 링크] 호문클루스가 받은 피해의 일부(${transferDmg})가 본체인 ${owner.name}에게 전이됩니다!`, 'log-dmg');
                        battle.triggerShakeAnimation(owner);
                        if (owner.curHp <= 0) {
                            if (battle.handleDeath) battle.handleDeath(owner, atk);
                        }
                    }
                }

                // [무투가] 권강 스플래시 데미지
                if (skill && skill.name === '권강' && dmg > 0) {
                    const splashDmg = Math.floor(dmg * 0.3);
                    if (splashDmg > 0) {
                        const neighbors = battle.grid.getNeighbors(currentDef);
                        Object.values(neighbors).forEach(hex => {
                            const splashTarget = battle.getUnitAt(hex.q, hex.r);
                            if (splashTarget && splashTarget.team !== atk.team && splashTarget !== currentDef && splashTarget.curHp > 0) {
                                splashTarget.curHp = Math.max(0, splashTarget.curHp - splashDmg);
                                battle.showFloatingText(splashTarget, `파음 -${splashDmg}`, "#ff5500");
                            }
                        });
                    }
                }
                
                // 오토 포션 및 긴급 처치
                if (currentDef.curHp > 0 && currentDef.curHp <= currentDef.hp * 0.3) {                   
                    // 1. 자기 자신 자동 물약 (PAS_AUTO_POTION)
                    const autoPotionPassive = getActivePassives(currentDef).find(s => s.effects && s.effects.some(e => e.type === 'PAS_AUTO_POTION'));
                    if (autoPotionPassive && currentDef.equipment && !currentDef._autoPotionUsed) {
                        for (let i = 1; i <= 8; i++) {
                            const pocketKey = `pocket${i}`;
                            const itemData = currentDef.equipment[pocketKey];
                            const itemId = typeof itemData === 'object' && itemData !== null ? itemData.id : itemData;
                            
                            if (itemId && String(itemId).includes('POTION') && battle.gameApp && battle.gameApp.itemData[itemId]) {
                                const healVal = battle.gameApp.itemData[itemId].val || 30;
                                
                                if (typeof itemData === 'object') {
                                    itemData.count--;
                                    if (itemData.count <= 0) currentDef.equipment[pocketKey] = null;
                                } else {
                                    currentDef.equipment[pocketKey] = null;
                                }
                                
                                currentDef._autoPotionUsed = true;
                                currentDef.curHp = Math.min(currentDef.hp, currentDef.curHp + healVal);
                                battle.showFloatingText(currentDef, `자동 회복 +${healVal}`, "#55ff55");
                                battle.log(`💊 [자동 물약] ${currentDef.name}이(가) 빈사 상태에서 자동으로 포션을 마셨습니다!`, 'log-heal');
                                break; 
                            }
                        }
                    }

                    // 2. [연금술사] 아군의 긴급 처치 (PAS_EMERGENCY_POTION) 투척 지원
                    if (currentDef.curHp <= currentDef.hp * 0.3) {
                        const rescuer = battle.units.find(u => 
                            u.team === currentDef.team && 
                            u.curHp > 0 && 
                            u.id !== currentDef.id && 
                            !u._emergencyPotionUsed &&
                            getActivePassives(u).some(s => s.effects && s.effects.some(e => e.type === 'PAS_EMERGENCY_POTION'))
                        );

                        if (rescuer && rescuer.equipment) {
                            let throwRng = 3;
                            const strongArm = getActivePassives(rescuer).some(s => s.effects && s.effects.some(e => e.type === 'PAS_THROW_RANGE'));
                            if (strongArm) throwRng += 1;

                            const dist = battle.grid.getDistance(rescuer, currentDef);
                            if (dist <= throwRng) {
                                for (let i = 1; i <= 8; i++) {
                                    const pocketKey = `pocket${i}`;
                                    const itemData = rescuer.equipment[pocketKey];
                                    const itemId = typeof itemData === 'object' && itemData !== null ? itemData.id : itemData;
                                    
                                    if (itemId && String(itemId).includes('POTION') && battle.gameApp && battle.gameApp.itemData[itemId]) {
                                        let healVal = battle.gameApp.itemData[itemId].val || 30;
                                        
                                        if (typeof itemData === 'object') {
                                            itemData.count--;
                                            if (itemData.count <= 0) rescuer.equipment[pocketKey] = null;
                                        } else {
                                            rescuer.equipment[pocketKey] = null;
                                        }
                                        
                                        rescuer._emergencyPotionUsed = true;

                                        const hasPharma = getActivePassives(rescuer).some(s => s.effects && s.effects.some(e => e.type === 'PAS_PHARMA'));
                                        const denseExtBuff = rescuer.buffs && rescuer.buffs.find(b => b.type === 'BUFF_DENSE_EXTRACTION');
                                        
                                        if (denseExtBuff) {
                                            healVal = Math.floor(healVal * 2.0);
                                            rescuer.buffs = rescuer.buffs.filter(b => b !== denseExtBuff);
                                            battle.log(`⚗️ [고밀도 추출] 투척된 포션의 효과가 2배로 증폭됩니다!`, 'log-skill');
                                        } else if (hasPharma) {
                                            healVal = Math.floor(healVal * 1.2);
                                        }
                                        
                                        battle.createProjectile(rescuer, currentDef);
                                        
                                        currentDef.curHp = Math.min(currentDef.hp, currentDef.curHp + healVal);
                                        battle.showFloatingText(currentDef, `긴급 투척 +${healVal}`, "#55ff55");
                                        battle.log(`🚑 [긴급 처치] ${rescuer.name}이(가) 빈사 상태인 ${currentDef.name}에게 포션을 던졌습니다!`, 'log-heal');
                                        break; 
                                    }
                                }
                            }
                        }
                    }
                }

                if (dmg > 0) {
                    atk.utg = Math.min(100, (atk.utg || 0) + 10); 
                    currentDef.utg = Math.min(100, (currentDef.utg || 0) + 15);
                }

                // 어뷰징 방지 및 경험치 지급
                const isKill = (currentDef.curHp <= 0);
                const isFriendlyFire = (atk.team === currentDef.team);
                const isCC = battle.hasStatus(atk, 'STAT_CONFUSION') || battle.hasStatus(atk, 'CC_CHARM') || battle.hasStatus(atk, 'CC_PUPPET');
                
                if (!isFriendlyFire || isCC) {
                    if (battle.progression && battle.progression.gainCombatPoints) {
                        battle.progression.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                    } else if (battle.gainCombatPoints) {
                        battle.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                    }
                }
                
                // 채널링 및 캐스팅 취소 연산
                const channelBuff = currentDef.buffs.find(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
                if (channelBuff && dmg > 0 && result.hitContext !== "CC_HIT") {
                    let cancelChance = 100;
                    
                    const maintainPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MAINTAIN_CHANT' || e.type === 'PAS_MAINTAIN_DANCE'));
                    if (maintainPassive) {
                        const prob = parseFloat(maintainPassive.effects[0].prob) || 30; 
                        cancelChance -= prob;
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
                            const wtReturn = parseFloat(daCapo.effects.find(e => e.type === 'BUFF_WT_REDUCTION')?.val) || 0.5; 
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * wtReturn);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                            battle.log(`🔁 [다 카포] 스킬이 취소되어 ${currentDef.name}의 다음 턴이 빠르게 돌아옵니다.`, "log-skill");
                        }
                    } else {
                        battle.showFloatingText(currentDef, "집중 유지!", "#55ff55");
                        battle.log(`✨ ${currentDef.name}이(가) 피격에도 불구하고 스킬을 유지해냅니다!`, "log-skill");
                    }
                }

                if (currentDef.isCharging && dmg > 0 && result.hitContext !== "CC_HIT") {
                    let cancelChance = 100;
                    
                    const maintainPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MAINTAIN_CHANT' || e.type === 'PAS_MAINTAIN_DANCE'));
                    if (maintainPassive) {
                        const prob = parseFloat(maintainPassive.effects[0].prob) || 30; 
                        cancelChance -= prob;
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
                            const wtReturn = parseFloat(daCapo.effects.find(e => e.type === 'BUFF_WT_REDUCTION')?.val) || 0.5;
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * wtReturn);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                            battle.log(`🔁 [다 카포] 스킬이 취소되어 ${currentDef.name}의 다음 턴이 빠르게 돌아옵니다.`, "log-skill");
                        }
                    } else {
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
                
                let canPassiveReflect = false;
                if (reflectPassive) {
                    const mainEff = reflectPassive.effects[0];
                    if (!mainEff.type.startsWith('PAS_') || mainEff.type === 'PAS_REFLECT_DMG' || Formulas.checkPassiveCondition(currentDef, mainEff, battle)) {
                        canPassiveReflect = true;
                    }
                }

                const isFleshForBone = reflectPassive && reflectPassive.name === '육참골단';
                if (isFleshForBone && (!isLoopBasicAtk || type !== 'PHYS')) {
                    canPassiveReflect = false;
                }

                const thornsPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_REFLECT_THORNS'));
                const isGuarding = currentDef.buffs.some(b => ['BUFF_DMG_REDUCE_PHYS', 'BUFF_ABSOLUTE_GUARD', 'BUFF_LAST_BASTION'].includes(b.type));
                
                if (thornsPassive && isGuarding && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && currentDef.curHp > 0) {
                    const prob = parseFloat(thornsPassive.effects.find(e => e.type === 'PAS_REFLECT_THORNS').prob) || 50;
                    if (Math.random() * 100 <= prob) {
                        const thornsDmg = Math.floor((result.originalDmg || dmg) * 0.2);
                        if (thornsDmg > 0) {
                            atk.curHp = Math.max(0, atk.curHp - thornsDmg);
                            battle.showFloatingText(atk, `Thorns -${thornsDmg}`, '#228b22');
                            battle.log(`🌿 [강철의 가시덩굴] ${currentDef.name}의 방어를 때린 댓가로 ${atk.name}에게 ${thornsDmg} 데미지!`, 'log-dmg');
                        }
                    }
                }
                
                const rangedReflect = currentDef.buffs.find(b => b.type === 'BUFF_REFLECT_RANGED');
                if (rangedReflect && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS') && dmg > 0 && currentDef.curHp > 0 && !currentOptions.isReflected && !currentOptions.isPierceHit) {
                    if (Math.random() * 100 <= 30) {
                        const refDmg = Math.floor((result.originalDmg || dmg) * 0.5);
                        if (refDmg > 0) {
                            battle.createProjectile(currentDef, atk);
                            await new Promise(r => setTimeout(r, 150));
                            atk.curHp = Math.max(0, atk.curHp - refDmg);
                            battle.showFloatingText(atk, `Reflect -${refDmg}`, '#f0f');
                            battle.log(`🪞 [방패 반사] ${currentDef.name}이(가) 원거리 공격을 튕겨내어 ${atk.name}에게 ${refDmg} 피해를 줍니다!`, 'log-dmg');
                        }
                    }
                }

                if ((reflectBuff || canPassiveReflect) && !currentOptions.isReflected && !currentOptions.isPierceHit && dmg > 0 && dist <= 1 && atk !== currentDef && currentDef.curHp > 0) { 
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

                if (!currentOptions.isCounter && !currentOptions.isPierceHit && currentDef.curHp > 0 && currentDef.skills && atk !== currentDef) {
                    const targetJoker = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP_THIEF' || e.type === 'PAS_PROB_UP'));
                    const targetJokerBonus = targetJoker ? 30 : 0;

                    const vanishing = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AFTER_HIT_STEALTH'));
                    const isHitByBasicDef = (!currentOptions.skill || currentOptions.skill.id === '1000' || !currentOptions.skill.id || (currentOptions.skill.name && currentOptions.skill.name.includes('연격')));
                    
                    if (vanishing && isHitByBasicDef && (type === 'PHYS' || type === 'DMG_PHYS')) {
                        const prob = (parseFloat(vanishing.effects.find(e => e.type === 'PAS_AFTER_HIT_STEALTH').prob) || 25) + targetJokerBonus;
                        if (Math.random() * 100 <= prob) {
                            battle.log(`👻 [소멸] ${currentDef.name}이(가) 피격의 반동을 이용해 그림자 속으로 사라집니다!`, 'log-skill');
                            battle.skillProcessor.applyStatus(currentDef, { type: 'BUFF_STEALTH', duration: 1, val: 0 }, currentDef);
                        }
                    }

                    const quickHands = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_QUICK_HANDS'));
                    if (quickHands && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                        const prob = (parseFloat(quickHands.effects.find(e => e.type === 'PAS_QUICK_HANDS').prob) || 30) + targetJokerBonus;
                        if (Math.random() * 100 <= prob) {
                            battle.log(`⚡ [빠른 손] ${currentDef.name}이(가) 공격을 받아치며 손을 뻗습니다!`, 'log-skill');
                            const stealTypes = ['SYS_STEAL', 'SYS_STEAL_ITEM', 'SYS_STEAL_ACC', 'SYS_STEAL_HELMET', 'SYS_STEAL_SHIELD', 'SYS_STEAL_ARMOR', 'SYS_STEAL_WEAPON'];
                            const randSteal = stealTypes[Math.floor(Math.random() * stealTypes.length)];
                            battle.skillProcessor.processEffect({ type: randSteal, prob: 100 }, atk, atk, currentDef, {triggerUnit: atk}, quickHands);
                        }
                    }

                    const afterHit = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AFTER_HIT'));
                    if (afterHit) {
                        const prob = parseFloat(afterHit.effects[0].prob) || 100;
                        if (Math.random() * 100 <= prob && afterHit.effects.length > 1) {
                            const triggerEff = afterHit.effects.find(e => !e.type.startsWith('PAS_'));
                            if (triggerEff) battle.skillProcessor.processEffect(triggerEff, atk, atk, currentDef, {triggerUnit: atk}, afterHit);
                        }
                    }
                }

                if (currentDef.curHp <= 0) {
                    if (currentDef === battle.currentUnit) {
                        battle.actions.moved = true;
                        battle.actions.acted = true;
                        if (battle.ui) battle.ui.updateFloatingControls();
                    }

                    if (currentDef.homunculusId) {
                        const homun = battle.units.find(u => u.id === currentDef.homunculusId && u.curHp > 0);
                        if (homun) {
                            homun.curHp = 0;
                            battle.log(`👻 시전자가 쓰러지며 호문클루스도 함께 소멸합니다.`, 'log-system');
                            battle.showFloatingText(homun, "소멸!", "#888");
                            battle.triggerShakeAnimation(homun);
                            if (battle.handleDeath) battle.handleDeath(homun, atk);
                        }
                    }

                    if (currentDef.key === 'HOMUNCULUS' && currentDef.ownerId) {
                        const owner = battle.units.find(u => u.id === currentDef.ownerId && u.curHp > 0);
                        if (owner) {
                            if (!battle.hasStatus(owner, 'CC_STUN')) {
                                battle.log(`💫 호문클루스가 파괴된 정신적 충격으로 본체가 기절(Stun)합니다!`, 'log-cc');
                                if (battle.skillProcessor && battle.skillProcessor.applyStatus) {
                                    battle.skillProcessor.applyStatus(owner, {type: 'CC_STUN', duration: 1, val: 1}, atk);
                                }
                            }
                        }
                    }

                    const onDeathPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ONDEATH'));
                    if (onDeathPassive) {
                        battle.log(`♾️ [시작과 끝] ${currentDef.name}의 희생이 빛이 되어 아군을 감쌉니다!`, 'log-skill');
                        const healEff = onDeathPassive.effects.find(e => e.type.startsWith('HEAL'));                        
                        if (healEff) {
                            const allies = battle.units.filter(u => u.team === currentDef.team && u.curHp > 0 && u.id !== currentDef.id);
                            allies.forEach(ally => {
                                const missingHp = Math.max(0, Formulas.getDerivedStat(ally, 'hp_max') - ally.curHp);
                                const healAmount = Math.floor(missingHp * (parseFloat(healEff.val) || 0.5));
                                if (healAmount > 0) {
                                    ally.curHp += healAmount;
                                    battle.showFloatingText(ally, `+${healAmount}`, "#55ff55");
                                }
                            });
                        }
                    }
                    
                    battle.handleDeath(currentDef, atk);
                }

                // ====================================================================
                // ⭐ [기획 반영] 창(Spear/Lance/Whip)의 직렬 관통 및 명중/데미지 페널티 로직
                // ====================================================================
                if (!currentOptions.isCounter && !currentOptions.isPierceHit && hitCount === 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                    if (weaponType === 'LONG_SPEAR' || weaponType === 'LANCE' || weaponType === 'WHIP') {
                        const pushDir = battle.grid.getDirection(atk, currentDef);
                        const backHex = battle.grid.getNeighborInDir(currentDef, pushDir);
                        if (backHex) {
                            const backTarget = battle.getUnitAt(backHex.q, backHex.r);
                            if (backTarget && backTarget.curHp > 0 && backTarget.team !== atk.team) {
                                battle.log(`🗡️ [관통] 무기가 ${currentDef.name}을(를) 뚫고 뒤의 ${backTarget.name}까지 타격합니다!`, 'log-skill');
                                
                                // 관통 데미지는 -20%, 명중률 -10% 보정
                                const pierceOptions = { 
                                    ...currentOptions, 
                                    isPierceHit: true, // ⭐ 이 옵션을 통해 무한 루프 방지
                                    globalMult: (currentOptions.globalMult || 1.0) * 0.8,
                                    accBonus: (currentOptions.accBonus || 0) - 10
                                };
                                
                                setTimeout(async () => {
                                    await this.performAttack(atk, backTarget, mult, "관통", isDrain, type, 1, pierceOptions);
                                }, 200); 
                            }
                        }
                    }
                }

                resolve({ isHit: true, damage: dmg });
            }, dist > 1 ? 150 : 100));

            if (i < hitCount - 1) await new Promise(r => setTimeout(r, 200));
        }

        const endDist = battle.grid.getDistance(atk, def); 
        const counterBuff = def.buffs.find(b => b.type === 'BUFF_COUNTER');
        const counterPassive = (def.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_COUNTER'));
        
        let ignoreCounter = false;
        if (options.isPerfectCrime) {
            ignoreCounter = true;
            battle.log(`🎩 [완전 범죄] ${atk.name}의 치밀한 공격에 ${def.name}은(는) 반격할 틈을 찾지 못합니다!`, 'log-skill');
        }
        if (skill && skill.effects && skill.effects.some(e => e.type === 'PAS_DISABLE_COUNTER')) {
            ignoreCounter = true;
            battle.log(`🏃 [치고 빠지기] ${atk.name}이(가) 재빠르게 거리를 벌려 반격을 허용하지 않습니다!`, 'log-skill');
        }

        if (!ignoreCounter && (counterBuff || counterPassive) && def.curHp > 0 && endDist <= Formulas.getDerivedStat(def, 'rng') && !options.isCounter && !options.isPierceHit && atk !== def) {
            if (!(battle.activeTimeStop && battle.activeTimeStop.caster.id === atk.id)) {
                let prob = 100;
                let triggerCounter = true;
                
                if (counterPassive) {
                    const cEff = counterPassive.effects.find(e => e.type.startsWith('PAS_COUNTER'));
                    prob = parseFloat(cEff.prob) || 30; 
                    
                    if ((cEff.type === 'PAS_COUNTER_RANGED' || cEff.type === 'PAS_COUNTER_RANGED_BASIC') && dist <= 1) triggerCounter = false;
                    if ((cEff.type === 'PAS_COUNTER_BASIC' || cEff.type === 'PAS_COUNTER_RANGED_BASIC') && !isBasicAtk) triggerCounter = false;
                }
                
                if (triggerCounter && Math.random() * 100 <= prob) {
                    battle.showFloatingText(def, "반격!", "#ffaa00");
                    battle.log(`⚔️ [반격 발동] ${def.name}이(가) 공격을 튕겨내고 받아칩니다!`, 'log-skill');
                    if (battle.smoothCenterCameraOnUnit) await battle.smoothCenterCameraOnUnit(def, 200);
                    await new Promise(r => setTimeout(r, 600));
                    
                    await this.performAttack(def, atk, 1.0, "반격", false, def.atkType || 'PHYS', 1, { isCounter: true, skill: { id: '1000' } }); 
                }
            }
        }

        if (!options.isCounter && !options.isPierceHit && def.team === atk.team && def !== atk && def.curHp > 0) {
            const allies = battle.units.filter(u => u.team === def.team && u.curHp > 0 && u !== def);
            for (const ally of allies) {
                const coverPassive = (ally.skills || []).find(s => 
                    (ally.equippedSkills || []).includes(s.id) &&
                    (s.part === 'S' || s.part === 'P' || s.type === 'PASSIVE') && 
                    s.effects && s.effects.some(e => e.type === 'PAS_ALLY_HIT' || e.type === 'PAS_ALLY_HIT_BASIC')
                );                
                
                if (coverPassive && battle.grid.getDistance(ally, atk) <= Formulas.getDerivedStat(ally, 'rng')) {
                    const cEff = coverPassive.effects.find(e => e.type.startsWith('PAS_ALLY_HIT'));
                    if (cEff.type === 'PAS_ALLY_HIT_BASIC' && !isBasicAtk) continue;
                    if (cEff.type === 'PAS_ALLY_HIT_BASIC' && ally._coverShotUsed) continue;

                    const prob = parseFloat(cEff.prob) || 40;
                    if (Math.random() * 100 <= prob) {
                        ally._coverShotUsed = true; 
                        
                        battle.showFloatingText(ally, "엄호 사격!", "#ffaa00");
                        battle.log(`🛡️ [엄호 사격] ${ally.name}이(가) 공격받은 아군을 지원합니다!`, 'log-skill');
                        if (battle.smoothCenterCameraOnUnit) await battle.smoothCenterCameraOnUnit(ally, 200);
                        await new Promise(r => setTimeout(r, 600));
                        
                        await this.performAttack(ally, atk, 1.0, "엄호", false, ally.atkType || 'RANGED', 1, { isCounter: true, skill: { id: '1000' } }); 
                        break; 
                    }
                }
            }
        }
    }
}