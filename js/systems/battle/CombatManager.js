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
        
        // ⭐ [신규 반영] 일반 공격 판정 여부 통합 확인 (기본 공격, 연격, 연타 등)
        const isBasicAtk = (!skill || skill.id === '1000' || !skill.id || (skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => skill.name.includes(n))));

        // ⭐ [도적 기획 반영] 조커의 패 (PAS_PROB_UP_THIEF) - 도적 전용 확률 +30% 보정
        const jokerPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP_THIEF' || e.type === 'PAS_PROB_UP'));
        const jokerBonus = jokerPassive ? 30 : 0;

        // ⭐ [도적 기획 반영] 완전 범죄 (PAS_IGNORE_GUARD) - 20% 확률로 방어/반격 무시
        const perfectCrime = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_IGNORE_GUARD'));
        if (perfectCrime && isBasicAtk && !options.isCounter) {
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
                // ⭐ [도적 기획 반영] 그림자 칼날 (단검 투척 연사 + 조커의 패 보정)
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

        if (!options.isCounter && def.skills && atk !== def) {
            beforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_BEFORE_HIT'));
            rangeBeforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RANGE_BEFORE_HIT'));
            anyHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ANY_HIT')); 
        }

        // ⭐ [무투가 기획 반영] 선견: 일반 공격 피격 전 30% 확률로 선제 타격
        const isBasicAtkCheck = (!skill || skill.id === '1000' || !skill.id || (skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => skill.name.includes(n))));
        const distToDef = battle.grid.getDistance(atk, def);
        if (!options.isCounter && !options.isPreemptive && distToDef <= 1 && isBasicAtkCheck && (type === 'PHYS' || type === 'DMG_PHYS')) {
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

        let firstHitLanded = false; // ⭐ [무투가] 연타 스킬 연속 명중용 추적 변수

        for (let i = 0; i < hitCount; i++) {
            if (atk.curHp <= 0) break; 
            
            let currentDef = def; 
            let dist = battle.grid.getDistance(atk, currentDef);

            if (!options.isCounter && !options.isCovered) {
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
                    options.forceFrontal = true; // 강제 정면 공격 판정
                    options.sureHit = true;      // 회피 불가
                    battle.showFloatingText(currentDef, "희생!", "#ffaa00");
                    battle.log(`❤️‍🩹 [희생] ${currentDef.name}이(가) ${def.name}의 피해를 온몸으로 대신 받습니다!`, 'log-skill');
                } else {
                    // 2. 일반 비호 및 조건부 비호 (PAS_COVER_DMG_COND - HP 30% 조건 추가)
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
                                options.forceFrontal = true; // 강제 정면 공격 판정
                                options.sureHit = true;      // 회피 불가
                                battle.showFloatingText(currentDef, "비호!", "#0ff");
                                battle.log(`🦸‍♂️ [비호] ${currentDef.name}이(가) ${def.name}을(를) 감싸며 대신 공격을 받습니다!`, 'log-skill');
                            }
                        }
                    }
                }
            }

            // ⭐ [신규 반영] 일반 공격 판정 여부 확인 (기본 공격이거나 '연격' 스킬인 경우)
            const isBasicAtk = (!options.skill || options.skill.id === '1000' || !options.skill.id || (options.skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => options.skill.name.includes(n))));
            // ⭐ [신규 반영] 패링(Parry): 근접 물리 '일반 공격' 피격 시 확률적 무효화
            if (!options.isCounter && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && isBasicAtk) {
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

            if (!options.isCounter && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS')) { 
                const interceptPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'INTERCEPT'));
                // ⭐ [궁수 기획 반영] 요격(Interception) - 배후 공격에는 발동하지 않음
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
            
            if (!options.isCounter && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                // ⭐ [마법사 기획 반영] 주문 차단 (INT 차이에 기반한 확률 보정)
                const blockIntPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'SPELL_BLOCK_INT'));
                if (blockIntPassive) {
                    const myInt = Formulas.getStat(currentDef, 'int');
                    const atkInt = Formulas.getStat(atk, 'int');
                    const intDiff = Math.max(0, myInt - atkInt);
                    const baseProb = parseFloat(blockIntPassive.effects.find(e => e.type === 'SPELL_BLOCK_INT').prob) || 30;
                    const prob = Math.min(80, baseProb + (intDiff * 1.5)); // 차이당 확률 증가 (최대 80%)
                    
                    if (Math.random() * 100 <= prob) {
                        battle.showFloatingText(currentDef, "주문 역산!", "#0ff");
                        battle.log(`🛡️ [주문 차단] ${currentDef.name}이(가) 지능의 격차를 이용해 마법 수식을 완벽히 역산하여 무효화했습니다!`, 'log-system');
                        continue; 
                    }
                }

                // ⭐ [마법사 기획 반영] 주문 반사 및 기존 주문 차단
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

                // ⭐ [음유시인/무희 기획 통합 반영] 아파시오나토 & 절대음감 & 절대균형 & 메아리 & 잔상
                if (currentOptions.skill) {
                    let buffChanceBonus = currentOptions.buffChanceBonus || 0;
                    let buffPowerBonus = currentOptions.buffPowerBonus || 0;
                    let durationBonus = currentOptions.debuffDurationBonus || 0;

                    // 1. 아파시오나토 & 콘 푸오코 (HP 50% 이하 시 안무/영창 스킬 디버프 확률/보정치 +20%)
                    const appassionato = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_COND_HP'));
                    if (appassionato) {
                        const reqHpRatio = parseFloat(appassionato.effects.find(e => e.type === 'PAS_COND_HP').val) || 0.5;
                        if ((atk.curHp / (atk.hp || 100)) <= reqHpRatio) {
                            buffChanceBonus += 20;
                            buffPowerBonus += 0.2;
                        }
                    }

                    // 2. 절대음감 (진혼곡(RQ) 확률 +30%) & 절대균형 (사무(DM) 확률 +30%)
                    const absolutePitch = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_RQ'));
                    if (absolutePitch && currentOptions.skill.category && currentOptions.skill.category.includes('RQ')) {
                        buffChanceBonus += 30;
                    }
                    const perfectBalance = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_DM'));
                    if (perfectBalance && currentOptions.skill.category && currentOptions.skill.category.includes('DM')) {
                        buffChanceBonus += 30;
                    }

                    // 3. 메아리 (RQ, DR 지속 +1턴) & 잔상 (DM 지속 +1턴)
                    const echoSound = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_EXTEND_DEBUFF'));
                    if (echoSound && currentOptions.skill.category && (currentOptions.skill.category.includes('RQ') || currentOptions.skill.category.includes('DR') || currentOptions.skill.category.includes('DM'))) {
                        durationBonus = 1;
                    }

                    currentOptions.buffChanceBonus = buffChanceBonus;
                    currentOptions.buffPowerBonus = buffPowerBonus;
                    currentOptions.debuffDurationBonus = durationBonus;
                }

                // ⭐ [마법사 기획 반영] 술식 조정: 아군에게 광역 마법 피해 50% 경감
                if (atk.team === currentDef.team && atk !== currentDef && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                    const safeAllyPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AOE_SAFE_ALLY'));                    // 광역기 판별: skill.area가 존재하고 0이나 'SINGLE'이 아닐 경우
                    if (safeAllyPassive && skill && skill.area && skill.area !== 0 && skill.area !== 'SINGLE') {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 0.5;
                        currentOptions.isSafeAlly = true; // 상태이상 면역 플래그용
                        battle.showFloatingText(currentDef, "술식 보호", "#00ff00");
                    }
                }

                // ⭐ [무투가 기획 반영] 청룡승천 (비행 유닛 데미지 50% 추가)
                if (skill && skill.name === '청룡승천' && battle.isFlying && battle.isFlying(currentDef)) {
                    currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.5;
                }

                // ⭐ [무투가 기획 반영] 발경(50%), 권강(100%) 방어력 무시
                if (skill && skill.name === '발경') currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + 0.5;
                if (skill && skill.name === '권강') currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + 1.0;

                // ⭐ [무투가 기획 반영] 연타, 백호연환: 첫 타격 명중 시 이후 타격 100% 명중
                if (i > 0 && firstHitLanded && skill && (skill.name === '연타' || skill.name === '백호연환')) {
                    currentOptions.sureHit = true;
                }

                // ⭐ [신규 반영] 일반 공격(기본 공격, 연격 등) 전용 데미지 보정
                if (isBasicAtk) {
                    // 무투가 '인체 숙달': 일반 공격 시 확률적으로 방어력 15% 무시
                    if (i === 0) {
                        const anatomical = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_IGNORE_DEF'));
                        if (anatomical && Math.random() * 100 <= (parseFloat(anatomical.effects[0].prob) || 30)) {
                            currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + parseFloat(anatomical.effects[0].val || 0.15);
                            battle.showFloatingText(atk, "혈도 타격", "#ffaa00");
                        }
                    }
                    // 1. 패시브 (결투자의 혼, 무적자) - 연격의 경우 첫회(i === 0)만 적용
                    if (i === 0) {
                        const basicUpPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_ATK_UP'));
                        if (basicUpPassive) {
                            const val = parseFloat(basicUpPassive.effects.find(e => e.type === 'PAS_BASIC_ATK_UP').val) || 1.2;
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * val;
                        }
                    }

                    // 2. 방어측 패시브 (무적자 방어)
                    const basicDefUp = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_DEF_UP'));
                    if (basicDefUp) {
                        const val = parseFloat(basicDefUp.effects.find(e => e.type === 'PAS_BASIC_DEF_UP').val) || 1.2;
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) / val;
                    }

                    // 3. 일회성 버프 (집중, 전투 함성) 소모
                    const nextBasicBuff = atk.buffs.find(b => b.type === 'BUFF_NEXT_BASIC_ATK' || b.type === 'BUFF_NEXT_PHYS_ATK');
                    if (nextBasicBuff) {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * parseFloat(nextBasicBuff.val || 1.3);
                        atk.buffs = atk.buffs.filter(b => b !== nextBasicBuff); // 타격 시 1회 소모
                        battle.log(`💢 [힘의 방출] ${atk.name}의 일격에 실린 힘이 터져나옵니다!`, 'log-skill');
                    }
                }
                
                if (battle.grid) {
                    const atkH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(atk.q, atk.r) : 0;                    const defH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(def.q, def.r) : 0;                    const heightDiff = atkH - defH;
                    
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
                    
                    currentDef._missedSkill = true; 

                    // ⭐ [무투가 기획 반영] 천지역전세 (회피 성공 시 100% 확률로 무조건 반격)
                    const celestial = currentDef.buffs.find(b => b.type === 'BUFF_CELESTIAL_REVERSAL');
                    if (celestial && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && !options.isCounter) {
                        battle.showFloatingText(currentDef, "역전세!", "#00ffff");
                        battle.log(`☯️ [천지역전세] ${currentDef.name}이(가) 공격을 흘려내고 즉시 반격합니다!`, 'log-skill');
                        await this.performAttack(currentDef, atk, 0.7, "역전세 반격", false, currentDef.atkType || 'PHYS', 1, { isCounter: true, skill: { id: '1000' } });
                    }
                    
                    resolve({ isHit: false, damage: 0 }); return;
                }

                firstHitLanded = true; // ⭐ 명중 성공 기록 (연타 필중용)

                if (result.isCursed) battle.showFloatingText(currentDef, "Cursed!", "#b0b");
                let dmg = result.damage;
                if (currentOptions.bonusDmg) {
                    dmg += currentOptions.bonusDmg;
                }
                
                // ⭐ [성직자 기획 반영] 언데드 타격 시 데미지 증폭 (구마술/신성 탄환/빛의 기둥)
                if (currentDef.race === 'UNDEAD' && ['HOLY', 'DMG_HOLY'].includes(type)) {
                    // 속성 상성(formulas.js)에서 1.5배가 되었지만, 스킬 설명에 명시된 "언데드에게 50% 추가 보정"을 확실히 박기 위해 1.5배 중첩 방지 등 필요시 여기서 조정.
                    // 현재 formulas.js에서 빛 속성->언데드 무조건 1.5배로 처리 중이므로, 이 부분은 데미지 이펙트만 강조합니다.
                    battle.showFloatingText(currentDef, "언데드 추뎀!", "#ffff00");
                }

                // ⭐ [성직자 기획 반영] 구마술 맞고 체력 0이 된 언데드는 완전 소멸(isFullyDead)
                if (skill && skill.name === '구마술' && currentDef.race === 'UNDEAD' && (currentDef.curHp - dmg) <= 0) {
                    currentDef.isFullyDead = true; 
                    battle.log(`✝️ [구마술] 불경한 자가 빛에 타들어가며 전장에서 영구히 소멸합니다!`, "log-skill");
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
                    
                    // ⭐ [성직자 기획 반영] 신의 자비: 피격 시 남은 흡수량과 무관하게 1회 방어 후 자동 소멸
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

                // ⭐ [성직자 기획 반영] 수호천사 패시브 (피격 시 즉시 30% 확률로 데미지 50% 경감)
                if (!hasRedBuffAll && currentDef.skills) {
                    const guardianAngel = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ANY_HIT') && s.name === '수호천사');
                    if (guardianAngel) {
                        const prob = parseFloat(guardianAngel.effects[0].prob) || 30;
                        if (Math.random() * 100 <= prob) {
                            hasRedBuffAll = true;
                            redBuffVal = parseFloat(guardianAngel.effects[1]?.val) || 0.5; // 50% 반감
                        }
                    }
                }

                if (hasRedBuffAll && dmg > 0) {
                    dmg = Math.floor(dmg * redBuffVal);
                    battle.showFloatingText(currentDef, "수호천사!", "#00ffff");
                    battle.log(`👼 [수호천사] 기적처럼 수호천사가 강림하여 피해를 반감시킵니다!`, 'log-skill');
                }

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
                    const survivePassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'EFF_SURVIVE' || e.type === 'PAS_MANA_SHIELD_SURVIVE'));
                    const surviveBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_STAT_SURVIVE');
                    
                    if (survivePassive || surviveBuff) {
                        // ⭐ [마법사 기획 반영] 마력 방패 (치명상 입을 시 HP 1로 생존하고 잉여 데미지를 MP로 소모)
                        const manaShieldEff = survivePassive ? survivePassive.effects.find(e => e.type === 'PAS_MANA_SHIELD_SURVIVE') : null;
                        
                        if (manaShieldEff) {
                            if (!currentDef._manaShieldSurviveUsed) {
                                const excessDmg = dmg - (currentDef.curHp - 1);
                                if (currentDef.curMp >= excessDmg) {
                                    currentDef.curMp -= excessDmg;
                                    dmg = currentDef.curHp - 1; // HP는 1만 남도록 데미지 축소
                                    currentDef._manaShieldSurviveUsed = true; // 턴 당 1회 제한 (TurnManager에서 해제 필요)
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

                // ⭐ [무투가 기획 반영] 권강: 타격한 적과 인접한 적들에게 데미지의 30% 전달
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
                
                if (currentDef.curHp > 0 && currentDef.curHp < currentDef.hp * 0.3) {                    const autoPotionPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_AUTO_POTION' || e.type === 'PAS_EMERGENCY_POTION'));
                    if (autoPotionPassive && currentDef.equipment) {
                        for (let i = 1; i <= 8; i++) {
                            const pocketKey = `pocket${i}`;
                            const itemData = currentDef.equipment[pocketKey];
                            const itemId = typeof itemData === 'object' ? itemData.id : itemData;
                            
                            if (itemId && String(itemId).includes('POTION') && battle.gameApp && battle.gameApp.itemData[itemId]) {
                                const healVal = battle.gameApp.itemData[itemId].val || 30;
                                
                                if (typeof itemData === 'object') {
                                    itemData.count--;
                                    if (itemData.count <= 0) currentDef.equipment[pocketKey] = null;
                                } else {
                                    currentDef.equipment[pocketKey] = null;
                                }
                                
                                currentDef.curHp = Math.min(currentDef.hp, currentDef.curHp + healVal);
                                battle.showFloatingText(currentDef, `자동 회복 +${healVal}`, "#55ff55");
                                battle.log(`🧪 [비상 약품] ${currentDef.name}이(가) 빈사 상태에서 자동으로 포션을 마셨습니다!`, 'log-heal');
                                break; 
                            }
                        }
                    }
                }

                // ⭐ [UTG 기획 반영] 데미지를 주거나 입을 때 필살기 게이지 충전
                if (dmg > 0) {
                    atk.utg = Math.min(100, (atk.utg || 0) + 10); // 타격 시 10 충전
                    currentDef.utg = Math.min(100, (currentDef.utg || 0) + 15); // 피격 시 15 충전
                }

                // ⭐ [5번 기획 반영] 경험치 어뷰징 방지 및 혼란 위로상
                const isKill = (currentDef.curHp <= 0);
                const isFriendlyFire = (atk.team === currentDef.team);
                const isCC = battle.hasStatus(atk, 'STAT_CONFUSION') || battle.hasStatus(atk, 'CC_CHARM') || battle.hasStatus(atk, 'CC_PUPPET');
                
                // 제정신으로 아군을 때렸다면 경험치 압수. 혼란 상태이거나 적을 때렸다면 경험치 지급.
                if (!isFriendlyFire || isCC) {
                    if (battle.progression && battle.progression.gainCombatPoints) {
                        battle.progression.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                    } else if (battle.gainCombatPoints) {
                        battle.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                    }
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
                        
                        // ⭐ [음유시인 기획 반영] 다 카포 (PAS_ON_CANCEL) - 취소 시 WT 50% 반환
                        const daCapo = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                        if (daCapo) {
                            const wtReturn = parseFloat(daCapo.effects.find(e => e.type === 'BUFF_WT_REDUCTION')?.val) || 0.5; // 기본 50%
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * wtReturn);
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
                        
                        // ⭐ [음유시인 기획 반영] 다 카포 (PAS_ON_CANCEL) - 취소 시 WT 50% 반환
                        const daCapo = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                        if (daCapo) {
                            const wtReturn = parseFloat(daCapo.effects.find(e => e.type === 'BUFF_WT_REDUCTION')?.val) || 0.5; // 기본 50%
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * wtReturn);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                            battle.log(`🔁 [다 카포] 스킬이 취소되어 ${currentDef.name}의 다음 턴이 빠르게 돌아옵니다.`, "log-skill");
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
                
                // ⭐ [근본 해결] 육참골단 등 HP 조건부 반사 및 근접 일반 공격 제한 판별
                let canPassiveReflect = false;
                if (reflectPassive) {
                    const mainEff = reflectPassive.effects[0];
                    if (!mainEff.type.startsWith('PAS_') || mainEff.type === 'PAS_REFLECT_DMG' || Formulas.checkPassiveCondition(currentDef, mainEff, battle)) {
                        canPassiveReflect = true;
                    }
                }

                // 기획 의도: "전투불능에 이르는 피격 시 발동 안함" 
                // 및 "근접 물리 일반공격에만 발동"
                const isFleshForBone = reflectPassive && reflectPassive.name === '육참골단';
                if (isFleshForBone && (!isBasicAtk || type !== 'PHYS')) {
                    canPassiveReflect = false;
                }

                // ⭐ [기획 반영] 강철의 가시덩굴 (방어, 절대방어, 최후의 보루 중 근접 피격 시 20% 원본 뎀 반사)
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
                
                // ⭐ [기획 반영] 방패 반사 (BUFF_REFLECT_RANGED) - 원거리 공격 반사
                const rangedReflect = currentDef.buffs.find(b => b.type === 'BUFF_REFLECT_RANGED');
                if (rangedReflect && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS') && dmg > 0 && currentDef.curHp > 0 && !currentOptions.isReflected) {
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

                if ((reflectBuff || canPassiveReflect) && !currentOptions.isReflected && dmg > 0 && dist <= 1 && atk !== currentDef && currentDef.curHp > 0) { 
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
                    // ⭐ [도적 기획 반영] 방어자의 조커의 패 확률 보정 확인
                    const targetJoker = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP_THIEF' || e.type === 'PAS_PROB_UP'));
                    const targetJokerBonus = targetJoker ? 30 : 0;

                    // ⭐ [도적 기획 반영] 소멸 (Vanishing: 일반공격 피격 시 은신)
                    const vanishing = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AFTER_HIT_STEALTH'));
                    const isHitByBasicDef = (!currentOptions.skill || currentOptions.skill.id === '1000' || !currentOptions.skill.id || (currentOptions.skill.name && currentOptions.skill.name.includes('연격')));
                    
                    if (vanishing && isHitByBasicDef && (type === 'PHYS' || type === 'DMG_PHYS')) {
                        const prob = (parseFloat(vanishing.effects.find(e => e.type === 'PAS_AFTER_HIT_STEALTH').prob) || 25) + targetJokerBonus;
                        if (Math.random() * 100 <= prob) {
                            battle.log(`👻 [소멸] ${currentDef.name}이(가) 피격의 반동을 이용해 그림자 속으로 사라집니다!`, 'log-skill');
                            battle.skillProcessor.applyStatus(currentDef, { type: 'BUFF_STEALTH', duration: 1, val: 0 }, currentDef);
                        }
                    }

                    // ⭐ [도적 기획 반영] 빠른 손 (Quick Hands: 근접 물리 피격 시 랜덤 훔치기)
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

                    // 기타 PAS_AFTER_HIT 유지
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
                    // ⭐ [버그 수정] 자신의 턴에 반격 등으로 사망 시 이동/조작 완전 차단
                    if (currentDef === battle.currentUnit) {
                        battle.actions.moved = true;
                        battle.actions.acted = true;
                        if (battle.ui) battle.ui.updateFloatingControls();
                    }

                    // ⭐ [성직자 기획 반영] 시작과 끝 (PAS_ONDEATH): 사망 시 남은 아군 체력 회복
                    const onDeathPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ONDEATH'));
                    if (onDeathPassive) {
                        battle.log(`♾️ [시작과 끝] ${currentDef.name}의 희생이 빛이 되어 아군을 감쌉니다!`, 'log-skill');
                        const healEff = onDeathPassive.effects.find(e => e.type.startsWith('HEAL'));                        
                        if (healEff) {
                            const allies = battle.units.filter(u => u.team === currentDef.team && u.curHp > 0 && u.id !== currentDef.id);
                            allies.forEach(ally => {
                                // 잃은 체력의 50% 회복
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

        const endDist = battle.grid.getDistance(atk, def); // 거리가 바뀌었을 수 있으므로 갱신
        const counterBuff = def.buffs.find(b => b.type === 'BUFF_COUNTER');
        const counterPassive = (def.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_COUNTER'));
        
        // ⭐ [도적 기획 반영] 치고 빠지기 & 완전 범죄 (반격 무시)
        let ignoreCounter = false;
        if (options.isPerfectCrime) {
            ignoreCounter = true;
            battle.log(`🎩 [완전 범죄] ${atk.name}의 치밀한 공격에 ${def.name}은(는) 반격할 틈을 찾지 못합니다!`, 'log-skill');
        }
        if (skill && skill.effects && skill.effects.some(e => e.type === 'PAS_DISABLE_COUNTER')) {
            ignoreCounter = true;
            battle.log(`🏃 [치고 빠지기] ${atk.name}이(가) 재빠르게 거리를 벌려 반격을 허용하지 않습니다!`, 'log-skill');
        }

        if (!ignoreCounter && (counterBuff || counterPassive) && def.curHp > 0 && endDist <= Formulas.getDerivedStat(def, 'rng') && !options.isCounter && atk !== def) {
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
                    // ⭐ [3번 피드백 추가] 반격 텍스트 노출 및 카메라 집중 딜레이
                    battle.showFloatingText(def, "반격!", "#ffaa00");
                    battle.log(`⚔️ [반격 발동] ${def.name}이(가) 공격을 튕겨내고 받아칩니다!`, 'log-skill');
                    if (battle.smoothCenterCameraOnUnit) await battle.smoothCenterCameraOnUnit(def, 200);
                    await new Promise(r => setTimeout(r, 600)); // 0.6초간 여운
                    
                    await this.performAttack(def, atk, 1.0, "반격", false, def.atkType || 'PHYS', 1, { isCounter: true, skill: { id: '1000' } }); 
                }
            }
        }

        // 엄호 사격 시각적 피드백
        if (!options.isCounter && def.team === atk.team && def !== atk && def.curHp > 0) {
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
                        
                        // ⭐ [3번 피드백 추가] 엄호 텍스트 및 딜레이
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