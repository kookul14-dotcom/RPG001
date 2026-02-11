import { ITEM_DATA, ELEMENTS, EFFECTS } from '../data/index.js';

const TIER_LEVELS = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 15 };
const STAT_SLOTS = ['head', 'body', 'legs', 'neck', 'ring', 'mainHand', 'offHand'];

// ==========================================
// 1. Helper Functions (Multiplier & Adder)
// ==========================================

function getMult(unit, passiveType, buffType) {
    let mult = 1.0;
    if (unit.skills) {
        unit.skills.forEach(s => {
            const reqLv = TIER_LEVELS[s.tier] || 0;
            if (s.type === 'PASSIVE' && unit.level >= reqLv) {
                if (s.main && s.main.type === passiveType) mult += (s.main.val - 1.0);
                if (s.sub && s.sub.type === passiveType) mult += (s.sub.val - 1.0);
            }
        });
    }
    if (unit.buffs) {
        unit.buffs.forEach(b => {
            // BUFF_ALL
            if (b.type === 'BUFF_ALL') mult += 0.2; 
            
            if (buffType && b.type === buffType) {
                const val = b.val !== undefined ? b.val : (b.mult !== undefined ? b.mult : 1.0);
                mult += (val - 1.0);
            }
        });
    }
    return Math.max(0.1, mult);
}

function getAdd(unit, passiveType, buffType, debuffType) {
    let val = 0;
    if (unit.skills) {
        unit.skills.forEach(s => {
            const reqLv = TIER_LEVELS[s.tier] || 0;
            if (s.type === 'PASSIVE' && unit.level >= reqLv) { 
                if (s.main && s.main.type === passiveType) val += s.main.val;
                if (s.sub && s.sub.type === passiveType) val += s.sub.val;
            }
        });
    }
    if (unit.buffs) {
        unit.buffs.forEach(b => {
            const v = b.val !== undefined ? b.val : (b.mult !== undefined ? b.mult : 0);
            if (buffType && b.type === buffType) val += v;
            if (debuffType && b.type === debuffType) val -= v;
        });
    }
    return val;
}

// ==========================================
// 2. Base Stats Calculation
// ==========================================

export function getStat(unit, stat, excludeBuffs = false) {
    let val = Number(unit[stat]) || 0;
    
    // 장비 스탯 합산
    if (unit.equipment) {
        STAT_SLOTS.forEach(slot => {
            const itemId = unit.equipment[slot];
            if (itemId && ITEM_DATA[itemId]) {
                const item = ITEM_DATA[itemId];
                
                // 1) 기본 스탯 반영
                if (item.stat === stat) val += Number(item.val);
                if (item.bonus && item.bonus[stat]) val += Number(item.bonus[stat]);

                // 2) [NEW] ClassBonus 반영 (예: "WARRIOR:str:1")
                if (item.classBonus) {
                    const parts = item.classBonus.split(':'); // [Job, Stat, Val]
                    if (parts.length === 3) {
                        const [reqJob, bonusStat, bonusVal] = parts;
                        if (unit.classKey === reqJob && bonusStat === stat) {
                            val += Number(bonusVal);
                        }
                    }
                }
            }
        });
    }

    if (!excludeBuffs && unit.buffs) {
        unit.buffs.forEach(b => { 
            // BUFF_ALL, BUFF_ENCHANT
            if (b.type === 'BUFF_ALL') val *= 1.2; 
            if (b.type === 'BUFF_ENCHANT') val *= 1.1;
            
            // 각 스탯별 전용 버프
            if (stat === 'str' && b.type === 'BUFF_ATK') val *= 1.1; 
            if (stat === 'int' && b.type === 'BUFF_ATK') val *= 1.1; 
            if (stat === 'vit' && b.type === 'BUFF_DEF') val *= 1.1; 
            if (stat === 'agi' && b.type === 'BUFF_SPD') val *= 1.1; 
            if (stat === 'dex' && b.type === 'BUFF_ACC') val *= 1.1; 
            if (stat === 'luk' && b.type === 'BUFF_LUCK') val *= 1.1; 
        });
    }
    
    // PASSIVE_LUCK
    if (stat === 'luk') val += getAdd(unit, 'PASSIVE_LUCK', 'BUFF_LUCK');
    
    return Math.floor(val);
}

// ==========================================
// 3. Derived Stats Calculation (All Types Covered)
// ==========================================

export function getDerivedStat(unit, type, excludeBuffs = false) {
    
    const str = getStat(unit, 'str', excludeBuffs);
    const int = getStat(unit, 'int', excludeBuffs);
    const vit = getStat(unit, 'vit', excludeBuffs);
    const agi = getStat(unit, 'agi', excludeBuffs);
    const dex = getStat(unit, 'dex', excludeBuffs);
    const vol = getStat(unit, 'vol', excludeBuffs);
    const luk = getStat(unit, 'luk', excludeBuffs);

    let val = 0;

    switch (type) {
        case 'hp_regen':
            val = 5 + (vit * 0.2); 
            if(!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_HEAL_POWER');
                if (unit.buffs && unit.buffs.some(b => b.type === 'HEAL_REGEN')) val *= 2.0;
            }
            break;

        case 'mp_regen':
            val = 3 + (int * 0.5); 
            if(!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_MANA');
                if (unit.buffs && unit.buffs.some(b => b.type === 'HEAL_MP')) val += 5;
            }
            break;

        case 'atk_phys': 
            val = (str + (dex * 0.5));
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_DMG', 'BUFF_ATK');
            break;

        case 'atk_mag':  
            val = (int + (dex * 0.5));
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_MAG', 'BUFF_ATK');
            break;

        case 'def':      
            val = ((vit * 0.5) + (str * 0.2) + getStat(unit, 'def', excludeBuffs));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_DEF', 'BUFF_DEF');
                if (unit.buffs && unit.buffs.some(b => b.type === 'DEF_PROTECT')) val *= 1.3;
            }
            break;

        case 'res':      
            val = ((int * 0.5) + (vit * 0.2));
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
            break;

        case 'hit_phys': 
        case 'hit_mag':
            val = 90 + (dex * 1.5) + (luk * 0.2);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_ACC', 'BUFF_ACC', 'DEBUFF_ACC');
            if (!excludeBuffs && getAdd(unit, 'PASSIVE_SUREHIT') > 0) val += 999; 
            break;

        case 'crit':     
            val = (luk * 1.0) + (dex * 0.5);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_CRIT', 'BUFF_CRIT');
            break;

        case 'eva':      
            val = (agi * 1.5) + (luk * 0.5);
            if (!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_EVA', 'BUFF_EVA', 'DEBUFF_EVA');
                val += getAdd(unit, 'PASSIVE_EVA_BOOST');
                if (unit.buffs && unit.buffs.some(b => b.type === 'STEALTH')) val += 50;
            }
            break;

        case 'tenacity': // 상태이상 저항력
            val = (vit * 1.0) + (luk * 0.5); 
            if(!excludeBuffs) val += getAdd(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
            break;

        case 'hp_max':    
            val = 50 + (unit.baseHp || 0) + (vit * 10) + (str * 2);
            if(!excludeBuffs) val += getAdd(unit, 'PASSIVE_SURVIVE') * 10;
            break;

        case 'mp_max':    
            val = (unit.baseMp || 0) + (int * 5) + (vol * 2); 
            if(!excludeBuffs) val += getAdd(unit, 'PASSIVE_MANA'); 
            break;

        case 'spd':      
            val = 70 + (Number(unit.agi) || 10) + ((Number(unit.int) || 10) * 0.5);
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_SPD', 'BUFF_SPD');
            break;

        case 'mov': 
            val = (unit.baseMov || 3);
            if (!excludeBuffs && unit.buffs && unit.buffs.some(b => b.type === 'MOVE_FREE')) val += 2;
            
            // 이동 불가 상태이상
            if (!excludeBuffs && unit.buffs) {
                const isRooted = unit.buffs.some(b => ['CC_ROOT', 'CC_FREEZE', 'CC_STUN', 'CC_SLEEP'].includes(b.type));
                if (isRooted) return 0;
            }
            break;

        case 'rng':
    // 1. 기본값 (맨손)
    val = 1;

    // 2. 무기 사거리 적용 (Main Hand에 장착된 무기의 rng 값을 우선 사용)
    if (unit.equipment && unit.equipment.mainHand) {
        const weaponId = unit.equipment.mainHand;
        if (ITEM_DATA[weaponId] && ITEM_DATA[weaponId].rng) {
            val = ITEM_DATA[weaponId].rng;
        }
    }

    // 3. 보너스 적용 (패시브 등)
    if (!excludeBuffs) {
        val += getAdd(unit, 'PASSIVE_DIST_BONUS') > 0 ? 1 : 0;
    }
    break;

        case 'cost_red': 
            val = getMult(unit, 'PASSIVE_COST_RED'); 
            if (val < 0.1) val = 0.1;
            break;
            
        case 'crit_dmg':
             val = 1.5; // 기본 치명타 배율
             if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_CRIT_DMG', 'BUFF_CRIT_DMG');
             break;
             
        case 'gold_bonus':
            val = 1.0 + (luk * 0.01);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_GOLD', 'ECON_GOLD');
            break;
            
        case 'drop_rate':
            val = 1.0 + (luk * 0.02);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_DROP', 'ECON_DROP_RATE');
            break;
            
        case 'shop_discount':
            val = 0;
            if (!excludeBuffs) {
                 if (unit.buffs && unit.buffs.some(b => b.type === 'ECON_DISCOUNT')) val = 0.2; 
            }
            break;
            
        case 'reuse_chance':
            val = 0;
            if (!excludeBuffs) val = getAdd(unit, 'PASSIVE_REUSE');
            break;
            
        case 'gauge_save':
            val = 0;
            if (!excludeBuffs) val = getAdd(unit, 'PASSIVE_GAUGE_SAVE');
            break;
            
        case 'tick_save':
            val = 0;
            if (!excludeBuffs) val = getAdd(unit, 'PASSIVE_TICK_SAVE');
            break;
            
        case 'buff_duration_mult':
             val = 1.0;
             if (!excludeBuffs && unit.buffs && unit.buffs.some(b => b.type === 'BUFF_EXTENSION')) val = 1.5;
             break;
    }
    
    // [NEW] ClassBonus 반영 (파생 스탯용)
    // getStat에서 처리되지 않는 파생 스탯(hp_max, crit 등)에 대한 보너스를 여기서 합산
    if (unit.equipment) {
        STAT_SLOTS.forEach(slot => {
            const itemId = unit.equipment[slot];
            if (itemId && ITEM_DATA[itemId] && ITEM_DATA[itemId].classBonus) {
                const parts = ITEM_DATA[itemId].classBonus.split(':'); // [Job, Stat, Val]
                if (parts.length === 3) {
                    const [reqJob, bonusStat, bonusVal] = parts;
                    // 현재 계산중인 type과 보너스 대상 stat이 일치하면 합산
                    if (unit.classKey === reqJob && bonusStat === type) {
                        val += Number(bonusVal);
                    }
                }
            }
        });
    }
    
    // 디버프 효과 적용
    if (!excludeBuffs && unit.buffs) {
        unit.buffs.forEach(b => {
             
             if ((b.type === 'CC_ROOT' || b.type === 'CC_FREEZE' || b.type === 'CC_STUN' || b.type === 'CC_SLEEP') && type === 'mov') val = 0; 
             
        });
    }

    // 장비 공격력/방어력 합산 로직
    if (type.startsWith('atk')) {
        const weaponType = (type === 'atk_phys') ? 'PHYS' : 'MAG';
        ['mainHand', 'offHand'].forEach(slot => {
            const itemId = unit.equipment?.[slot];
            if(itemId && ITEM_DATA[itemId]) {
                const item = ITEM_DATA[itemId];
                if ((item.type === 'WEAPON' || item.type === 'SHIELD') && item.atkType === weaponType) {
                    val += (item.val || 0);
                }
            }
        });
        if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_ITEM_POWER');
    }

    if (type === 'def') {
        STAT_SLOTS.forEach(slot => {
            const itemId = unit.equipment?.[slot];
            if(itemId && ITEM_DATA[itemId]) {
                const item = ITEM_DATA[itemId];
                if (['BODY', 'HEAD', 'LEGS', 'SHIELD'].includes(item.type)) {
                    val += (item.val || 0);
                }
            }
        });
    }

    if (['crit', 'eva', 'hit_phys', 'hit_mag', 'tenacity'].includes(type)) return Math.max(0, val);
    if (['cost_red', 'gold_bonus', 'drop_rate', 'shop_discount', 'reuse_chance', 'gauge_save', 'tick_save', 'buff_duration_mult'].includes(type)) return val;
    return Math.floor(Math.max(0, val));
}

// ==========================================
// 4. Damage Calculation (Full Logic with All Types)
// ==========================================

export function calculateDamage(atkUnit, defUnit, skillMult, dmgType, grid, options = {}) {
    // 1. 공격 타입 결정
    if (!dmgType) dmgType = atkUnit.atkType || 'PHYS'; 
    
    // 연타/체인 패널티
    if (options.tags && (options.tags.includes('ATK_MULTI') || options.tags.includes('ATK_CHAIN'))) {
        skillMult *= 0.9; 
    }

    // 무적 상태 확인 (최우선)
    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => 
            b.type === 'DEF_INVINCIBLE' || 
            b.type === 'BUFF_IMMUNE' || 
            b.type === 'BUFF_PHASING' || 
            b.type === 'BUFF_UNTARGETABLE'
        )) {
            return { damage: 0, isMiss: false, text: "IMMUNE", hitContext: "NORMAL" };
        }
    }

    // =========================================================
    // 2. 기초 공격력(Base Power) 계산 [수정된 부분]
    // =========================================================
    let baseAtk = 0;
    let hitRate = 100;
    let isFixed = false; // 고정 데미지 여부
    let appliedMult = skillMult;

    switch (dmgType) {
        // [A] 고정 피해 (아이템 등) -> 스탯 무시, 값 그대로
        case 'DMG_FIXED':
            baseAtk = skillMult; // 엑셀의 Val(50)이 곧 공격력
            appliedMult = 1.0;   // 배율 중복 적용 방지
            hitRate = 999;       // 필중
            isFixed = true;
            break;

        // [B] 처형 (즉사기)
        case 'ATK_EXECUTE':
            const threshold = (defUnit.hp || 100) * skillMult; // 예: HP의 20%
            if (defUnit.curHp <= threshold) {
                baseAtk = defUnit.curHp; // 남은 체력만큼 데미지
                appliedMult = 1.0;
                hitRate = 999;
                isFixed = true;
            } else {
                return { damage: 0, isMiss: false, text: "RESIST", hitContext: "NORMAL" };
            }
            break;

        // [C] 마법 공격 (INT 비례)
        case 'MAG':
        case 'DMG_MAG':
        case 'HOLY':
        case 'DMG_HOLY':
        case 'DARK':
        case 'DMG_DARK':
            baseAtk = getDerivedStat(atkUnit, 'atk_mag');
            hitRate = getDerivedStat(atkUnit, 'hit_mag');
            break;

        // [D] 물리 공격 (STR 비례) - 기본값
        case 'PHYS':
        case 'DMG_PHYS':
        default:
            baseAtk = getDerivedStat(atkUnit, 'atk_phys');
            hitRate = getDerivedStat(atkUnit, 'hit_phys');
            break;
    }
    
    // 방어 비례 데미지 등 추가 옵션 (고정 피해 아닐 때만)
    if (!isFixed) {
        if (options.defScaleBonus || (options.tags && options.tags.includes('ATK_DEF_SCALE'))) {
            const defVal = getDerivedStat(atkUnit, 'def');
            const scale = options.defScaleBonus || 1.0; 
            baseAtk += defVal * scale;
        }
        if (options.tags && options.tags.includes('COST_HP')) {
            baseAtk *= 1.2;
        }
    }
    
    if (options.flatBonus) baseAtk += options.flatBonus;

    // 3. 거리 보너스 (고정 피해 제외)
    if (grid && !isFixed) {
        const dist = grid.getDistance(atkUnit, defUnit);
        const distBonus = getMult(atkUnit, 'PASSIVE_DIST_BONUS'); 
        if (distBonus > 1.0) {
            const bonusPerTile = distBonus - 1.0;
            baseAtk *= (1 + (dist * bonusPerTile));
        }
        if (options.tags && options.tags.includes('ATK_DIST') && dist > 1) {
            baseAtk *= 1.1; 
        }
        if (options.tags && (options.tags.includes('ATK_MOVE') || options.tags.includes('ATK_JUMP') || options.tags.includes('ATK_DASH'))) {
            baseAtk *= 1.1; 
        }
    }

    // 4. 난수 보정 (VOL) - 고정 피해 제외
    let rawDmg = baseAtk;
    if (!isFixed) {
        const vol = getStat(atkUnit, 'vol');
        const minMult = 0.9; 
        const maxMult = 1.0 + (vol * 0.05);
        rawDmg = Math.random() * (baseAtk * maxMult - baseAtk * minMult) + baseAtk * minMult;
    }

    // 5. 방향 및 CC 상태 보정
    let defModifier = 1.0;
    let evaModifier = 1.0;
    let hitContext = "NORMAL";
    
    if (dmgType === 'ATK_EXECUTE') hitContext = "EXECUTE";

    if (grid && !isFixed) {
        const hitDir = grid.getDirection(defUnit, atkUnit);
        const facing = defUnit.facing || 0;
        const diff = (hitDir - facing + 6) % 6;

        switch (diff) {
            case 3: defModifier = 0.0; evaModifier = 0.0; hitContext = "BACKSTAB"; break;
            case 2: case 4: defModifier = 0.5; evaModifier = 0.5; hitContext = "FLANK"; break;
            case 1: case 5: defModifier = 0.8; hitContext = "FLANK"; break;
        }
    }

    // CC 상태이상
    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => ['CC_SLEEP', 'CC_STUN', 'CC_FREEZE', 'CC_ROOT', 'CC_CHARM', 'CC_FEAR', 'CC_POLYMORPH'].includes(b.type))) {
            evaModifier = 0; 
            defModifier *= 0.5; 
            if (hitContext === "NORMAL") hitContext = "CC_HIT";
            
            if (!isFixed && defUnit.buffs.some(b => b.type === 'CC_FEAR')) rawDmg *= 1.2;
        }
    }

    // 6. 명중/회피 판정 (고정 피해는 필중)
    const hasSureHit = options.sureHit || (getAdd(atkUnit, 'PASSIVE_SUREHIT') > 0) || (options.tags && options.tags.includes('ATK_SUREHIT'));
    
    if (!isFixed && !hasSureHit && hitContext !== "BACKSTAB" && hitContext !== "CC_HIT") {
        const evaRate = getDerivedStat(defUnit, 'eva') * evaModifier;
        const finalHitChance = hitRate - evaRate;
        if (Math.random() * 100 > finalHitChance) {
            return { damage: 0, isMiss: true, text: "MISS", hitContext };
        }
    }

    // 7. 방어력 적용 [수정됨]
    let defense = 0;
    
    if (!isFixed) {
        const isMagic = ['MAG', 'HOLY', 'DARK', 'DMG_MAG', 'DMG_HOLY', 'DMG_DARK'].includes(dmgType);
        defense = isMagic ? getDerivedStat(defUnit, 'res') : getDerivedStat(defUnit, 'def');
        defense *= defModifier;

        // 관통
        let pen = (options.penetrate || 0) + getAdd(atkUnit, 'PASSIVE_PENETRATE'); 
        if (options.tags && options.tags.includes('ATK_PENETRATE')) pen += 0.3;
        if (pen > 0) defense *= (1 - Math.min(1, pen));
    }

    // 8. 최종 데미지 공식
    let finalDmg = rawDmg * appliedMult;
    
    // 고정 피해가 아닐 때만 방어력 연산 수행
    if (!isFixed) {
        finalDmg = finalDmg * (100 / (100 + Math.max(0, defense)));
    }

    // 9. 속성 상성 (고정 피해는 제외)
    let eleMult = 1.0;
    let isWeak = false;
    let isResist = false;
    
    if (!isFixed) {
        const atkEle = ELEMENTS[atkUnit.element || 'NONE'];
        if (atkEle.strong === defUnit.element) { eleMult = 1.3; isWeak = true; }
        else if (atkEle.weak === defUnit.element) { eleMult = 0.8; isResist = true; }
        
        if (dmgType === 'HOLY' && (defUnit.element === 'DARK' || defUnit.race === 'UNDEAD')) {
            eleMult *= 1.5; isWeak = true;
        }
        finalDmg *= eleMult;
    }

    // 10. 치명타 판정
    let isCrit = false;
    if (hitContext === "EXECUTE") isCrit = true;
    
    if (!isFixed) {
        let critRate = getDerivedStat(atkUnit, 'crit');
        if (hitContext === "BACKSTAB") critRate += 30;
        if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'CC_SLEEP')) critRate = 100;
        
        if (Math.random() * 100 < critRate) {
            let critDmgMult = getDerivedStat(atkUnit, 'crit_dmg');
            finalDmg *= critDmgMult;
            isCrit = true;
        }
    }

    // 11. 방어 기제 (블락 등) - 고정 피해도 막을 수는 있음 (기획에 따라 변경 가능)
    let blockVal = getAdd(defUnit, 'PASSIVE_BLOCK', 'BUFF_BLOCK');
    if (!isFixed && blockVal > 0 && Math.random() < 0.3) { 
        finalDmg *= (1.0 - Math.min(0.9, blockVal));
        hitContext = "BLOCK";
    }

    if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'DEF_STORE_DMG')) {
        finalDmg *= 0.5; 
    }
    
    // 마나 실드
    let manaShieldDmg = 0;
    if (defUnit.buffs) {
        const msBuff = defUnit.buffs.find(b => b.type === 'DEF_MANA_SHIELD');
        if (msBuff && defUnit.curMp > 0) {
            const ratio = msBuff.val || 0.5; 
            const absorb = Math.floor(finalDmg * ratio);
            if (defUnit.curMp >= absorb) {
                manaShieldDmg = absorb;
                finalDmg -= absorb;
            } else {
                manaShieldDmg = defUnit.curMp;
                finalDmg -= defUnit.curMp;
            }
        }
    }

    // 12. 최종 증폭
    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => b.type === 'STATUS_CURSE')) finalDmg *= 1.2;
        if (defUnit.buffs.some(b => b.type === 'DEBUFF_VULNERABLE')) finalDmg *= 1.5;
        if (defUnit.buffs.some(b => b.type === 'CC_FEAR') && !isFixed) finalDmg *= 1.2;
    }
    
    if (hitContext === "BACKSTAB" && options.backstabMult) {
        finalDmg *= options.backstabMult;
    }

    // 반사 (고정 피해는 반사 안 함)
    let reflectDmg = 0;
    if (defUnit.buffs && !isFixed) {
        const reflectBuff = defUnit.buffs.find(b => b.type === 'BUFF_REFLECT' || b.type === 'BUFF_COUNTER');
        if (reflectBuff && (!grid || grid.getDistance(atkUnit, defUnit) <= 1)) {
            reflectDmg = finalDmg * (reflectBuff.val || 0.3);
        }
    }

    return {
        damage: Math.max(1, Math.floor(finalDmg)),
        manaDmg: Math.floor(manaShieldDmg), 
        reflectDmg: Math.floor(reflectDmg),
        isCrit, isWeak, isResist, isCursed: false, isMiss: false, hitContext
    };
}

// ==========================================
// 5. Healing & Recovery Calculation
// ==========================================

export function calculateHeal(caster, target, skill) {
    let amount = 0;
    const type = skill.main?.type || 'HEAL_HP';
    const val = skill.main?.val || 0;

    const maxHp = getDerivedStat(target, 'hp_max');
    const healPower = getMult(caster, 'PASSIVE_HEAL_POWER');

    switch (type) {
        case 'HEAL_FULL':
        case 'REVIVE': 
        case 'PASSIVE_REVIVE_SELF':
            amount = maxHp * (val || 1.0);
            break;
        case 'HEAL_PERCENT':
            amount = maxHp * val;
            break;
        case 'HEAL_HP':
        case 'HEAL_AOE':
        case 'HEAL_REGEN':
            const int = getStat(caster, 'int');
            
            // [수정] 포션 투척 스킬(10003) 전용 공식
            // 공식: (아이템기본값 + (INT * 0.5)) * 1.1
            if (skill.id === '10003') { 
                const skillMult = 1.1; 
                // SkillProcessor에서 val에 아이템 기본값을 넣어주었습니다.
                amount = (val + (int * 0.5)) * skillMult * healPower;
            } 
            else {
                // 기존 일반 힐 공식
                amount = (val + int * 2) * healPower;
            }
            break;
        case 'HEAL_MP':
            return { hp: 0, mp: val * healPower };
        case 'CLEANSE':
            return { hp: 0, mp: 0, cleanse: true };
        default:
            amount = val;
    }

    return { hp: Math.floor(amount), mp: 0 };
}

// ==========================================
// 6. DoT / Status Damage Calculation
// ==========================================

export function calculateDotDamage(unit, statusType, val) {
    const maxHp = unit.hp;
    let dmg = 0;

    switch (statusType) {
        case 'STATUS_BURN':
            dmg = Math.max(1, Math.floor(val * 10) || 10);
            break;
        case 'STATUS_POISON':
            dmg = Math.max(1, Math.floor(maxHp * 0.05));
            break;
        case 'STATUS_BLEED':
            dmg = Math.max(1, Math.floor(unit.curHp * 0.05));
            break;
        case 'STATUS_DOT':
        case 'STATUS_RANDOM_DOT':
            dmg = val;
            break;
        case 'STATUS_CURSE':
            dmg = Math.floor(maxHp * 0.03);
            break;
    }
    return Math.floor(dmg);
}

// ==========================================
// 7. Utility / Effect Power Calculation
// ==========================================

export function calculateEffectPower(caster, type, baseVal) {
    let power = baseVal || 0;

    switch (type) {
        case 'ATK_JUMP':
        case 'ATK_DASH':
        case 'ATK_MOVE':
        case 'MOVE_TELEPORT':
        case 'MOVE_BEHIND':
        case 'MOVE_BACK':
        case 'MOVE_SWAP':
            power = getDerivedStat(caster, 'mov') + (baseVal || 0);
            break;
            
        case 'SUMMON_DECOY':
        case 'SUMMON_WALL':
            power = getDerivedStat(caster, 'hp_max') * (baseVal || 0.5);
            break;
            
        case 'ECON_GOLD':
        case 'ECON_STEAL':
            const luk = getStat(caster, 'luk');
            const bonus = getDerivedStat(caster, 'gold_bonus');
            power = ((baseVal || 10) + luk) * bonus;
            break;
        case 'ECON_CREATE':
        case 'ECON_TRANSMUTE':
        case 'ECON_ITEM_GET':
            power = getDerivedStat(caster, 'luk') * 0.5 + (baseVal || 10);
            break;

        case 'GAUGE_FILL':
        case 'GAUGE_DRAIN':
        case 'GAUGE_SET':
             power = baseVal;
             if (type === 'GAUGE_FILL') {
                 const gaugeBonus = getAdd(caster, 'PASSIVE_GAUGE');
                 power += gaugeBonus;
             }
             break;
             
        case 'TRAP_STUN':
             const dex = getStat(caster, 'dex');
             power = (baseVal || 20) + dex * 2;
             break;
             
        case 'AGGRO_TAUNT':
        case 'AGGRO_CONFUSE':
             power = (baseVal || 100) + getStat(caster, 'vol');
             break;
             
        case 'UTIL_INTERACT':
        case 'UTIL_REVEAL':
        case 'UTIL_IDENTIFY':
        case 'UTIL_SCAN':
        case 'UTIL_LORE':
        case 'UTIL_CD_RESET':
             power = (baseVal || 50) + getStat(caster, 'int') + getStat(caster, 'luk');
             break;
             
        case 'SPECIAL_TIME_STOP':
             power = baseVal || 1; 
             break;
        case 'CC_KNOCKBACK':
             power = baseVal || 1; 
             break;
    }
    
    return Math.floor(power);
}