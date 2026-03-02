import { ITEM_DATA, ELEMENTS, EFFECTS } from '../data/index.js';
// =====================================================================
// ⭐ [신규] 4중 성장 시스템 요구 경험치(Threshold) 테이블
// =====================================================================
// 1. 유닛 레벨 (최대 60): 전투 1회(약 10~15번 유효행동, 100~150 EXP)당 1업 기준
export const EXP_REQ = (level) => level * 100; 

// 2. 직업 클래스 (최대 8): 클래스 마스터까지 약 40~50회 전투 소요 기준
export const CLASS_JP_REQ = [0, 200, 600, 1200, 2000, 3000, 4500, 6500]; // 인덱스가 현재 레벨

// 3. 무기 숙련도 (최대 4): 2단계(중반부), 3단계(후반부), 4단계(종결) 진입 시점 기준
export const WEAPON_WP_REQ = [0, 100, 300, 600]; 

// 4. 스킬 레벨 (최대 4): 마스터까지 해당 스킬 50~70회 성공 필요 기준
export const SKILL_SP_REQ = [0, 50, 150, 300]; 
// =====================================================================
// ⭐ [신규] 공식 계산기용 전역 배틀 변수 및 세팅 함수
let activeBattle = null;

export function setBattleSystem(battleInstance) {
    activeBattle = battleInstance;
}

const TIER_LEVELS = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 15 };
const STAT_SLOTS = ['head', 'body', 'legs', 'neck', 'ring', 'mainHand', 'offHand'];

// ==========================================
// 1. Helper Functions (Multiplier & Adder)
// ==========================================

// ⭐ [신규] 엔진의 과거 키워드와 엑셀의 신규 키워드를 완벽 호환시켜주는 브릿지 함수
function isMatchingPassive(effType, reqType) {
    if (!effType) return false;
    if (effType === reqType || effType === 'ALL_STAT' || effType === 'PAS_STAT_ALL') return true;
    if (reqType === 'PASSIVE_DMG' && (effType === 'PAS_STAT_ATK' || effType === 'PAS_STAT_ATK_LOWHP')) return true;
    if (reqType === 'PASSIVE_MAG' && (effType === 'PAS_STAT_MATK' || effType === 'PAS_STAT_MATK_LOWHP')) return true;
    if (reqType === 'PASSIVE_DEF' && (effType === 'PAS_STAT_DEF' || effType === 'PAS_STAT_DEF_LOWHP')) return true;
    if (reqType === 'PASSIVE_RESIST' && effType === 'PAS_STAT_RESIST') return true;
    if (reqType === 'PASSIVE_SPD' && effType === 'PAS_STAT_SPD') return true;
    if (reqType === 'PASSIVE_ACC' && effType === 'PAS_STAT_ACC') return true;
    if (reqType === 'PASSIVE_EVA' && effType === 'PAS_STAT_EVA') return true;
    if (reqType === 'PASSIVE_CRIT' && effType === 'PAS_STAT_CRIT') return true;
    if (reqType === 'PASSIVE_MOVE' && effType === 'PAS_STAT_MOVE') return true;
    if (reqType === 'PASSIVE_MANA' && (effType === 'PAS_STAT_MAXMP' || effType === 'PAS_HEAL_MP_PER')) return true;
    if (reqType === 'PASSIVE_SURVIVE' && effType === 'PAS_STAT_MAXHP') return true;
    if (reqType === 'PASSIVE_HEAL_POWER' && effType === 'PAS_HEAL_RECV_UP') return true;
    if (reqType === 'PASSIVE_STEAL' && effType === 'PAS_STEAL_RATE') return true;
    if (reqType === 'PASSIVE_GOLD' && effType === 'PAS_GOLD_GAIN') return true;
    if (reqType === 'PASSIVE_MASTERY' && effType === 'PAS_STAT_MASTERY') return true;
    if (reqType === 'PASSIVE_COST_RED' && ['MP_COST', 'PAS_MP_COST', 'PAS_MP_COST_RED_CHANT', 'PAS_MP_COST_RED_DANCE', 'PAS_MP_COST_RED_SUP', 'PAS_MP_COST_INC'].includes(effType)) return true;
    
    return false;
}

export function updateUnitCache(unit) {
    unit.cachedModifiers = { mults: {}, adds: {} };
    unit.buffs = unit.buffs || [];
    
    if (unit.skills) {
        // ⭐ [신규] 장착된 스킬만 패시브 연산에 포함 (카테고리 장착 시 하위 스킬도 포함)
        const equippedIds = unit.equippedSkills || [];
        const activeSkills = unit.skills.filter(s => {
            if (!s) return false;
            const catEquipId = s.category ? `CAT_${s.category}` : null;
            return equippedIds.includes(s.id) || (catEquipId && equippedIds.includes(catEquipId));
        });

        activeSkills.forEach(s => {
            // ⭐ [기획 반영] tier 대신 엑셀의 req_class_lv 적용 및 유닛의 classLevel과 비교
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const currentClassLv = unit.classLevel || 1;
            
            if (s && s.type === 'PASSIVE' && currentClassLv >= reqClassLv && s.effects && s.effects.length > 0) {
                const mainEff = s.effects[0];
                const hasSubEffects = s.effects.length > 1;

                // LOWHP 조건 검사 (기존 hp 참조 유지)
                if (mainEff.type.includes('LOWHP')) {
                    const maxHp = unit.hp || 100;
                    if ((unit.curHp / maxHp) > 0.5) return; 
                }

                const processEffect = (eff) => {
                    const val = parseFloat(eff.val);
                    if (isNaN(val)) return;
                    
                    if (!unit.cachedModifiers.mults[eff.type]) unit.cachedModifiers.mults[eff.type] = 1.0;
                    if (!unit.cachedModifiers.adds[eff.type]) unit.cachedModifiers.adds[eff.type] = 0;

                    if (eff.type.startsWith('PAS_STAT_') && !eff.type.includes('LOWHP')) {
                        unit.cachedModifiers.adds[eff.type] += val;
                    } else {
                        unit.cachedModifiers.mults[eff.type] += (val - 1.0);
                    }
                };

                if (mainEff.type.startsWith('PAS_') && hasSubEffects) {
                    if (checkPassiveCondition(unit, mainEff, null)) {
                        for (let i = 1; i < s.effects.length; i++) processEffect(s.effects[i]);
                    }
                } else if (!hasSubEffects) {
                    processEffect(mainEff);
                }
            }
        });
    }
}

export function getMult(unit, passiveType, buffType) {    // 캐시가 없으면 1회 생성 (방어 코드)
    if (!unit.cachedModifiers) updateUnitCache(unit);
    let mult = 1.0;
    
    // 1. 고속 캐시 딕셔너리 순회 (스킬 배열 전체를 뒤지지 않음)
    Object.keys(unit.cachedModifiers.mults).forEach(effType => {
        if (isMatchingPassive(effType, passiveType)) {
            mult += (unit.cachedModifiers.mults[effType] - 1.0);
        }
    });

    // 2. 버프는 실시간 변동이 잦으므로 원본 코드 그대로 유지 (안전성 보장)
    if (unit.buffs) {
        unit.buffs.forEach(b => {
            if (b.type === 'BUFF_ALL') mult += 0.2; 
            if (buffType && b.type === buffType) {
                const val = b.val !== undefined ? parseFloat(b.val) : (b.mult !== undefined ? parseFloat(b.mult) : 1.2);
                if (!isNaN(val)) mult += (val - 1.0);
            }
        });
    }
    return Math.max(0.1, mult);
}

export function getAdd(unit, passiveType, buffType, debuffType) {    if (!unit.cachedModifiers) updateUnitCache(unit);
    let val = 0;
    
    // 1. 고속 캐시 딕셔너리 순회
    Object.keys(unit.cachedModifiers.adds).forEach(effType => {
        if (isMatchingPassive(effType, passiveType)) {
            val += unit.cachedModifiers.adds[effType];
        }
    });

    // 2. 버프 처리 원본 유지
    if (unit.buffs) {
        unit.buffs.forEach(b => {
            const v = b.val !== undefined ? parseFloat(b.val) : (b.mult !== undefined ? parseFloat(b.mult) : 0);
            if (!isNaN(v)) {
                if (buffType && b.type === buffType) val += v;
                if (debuffType && b.type === debuffType) val -= v;
            }
        });
    }
    return val;
}

// ==========================================
// 2. Base Stats Calculation
// ==========================================

export function getStat(unit, stat, excludeBuffs = false) {
    unit.buffs = unit.buffs || [];
    let val = Number(unit[stat]) || 0;
    
    if (unit.equipment) {
        STAT_SLOTS.forEach(slot => {
            const itemId = unit.equipment[slot];
            if (itemId && ITEM_DATA[itemId]) {
                const item = ITEM_DATA[itemId];
   
                if (item.stat === stat) val += Number(item.val);
                if (item.bonus && item.bonus[stat]) val += Number(item.bonus[stat]);

                if (item.classBonus) {
                    const parts = item.classBonus.split(':');
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
            const bVal = b.val !== undefined ? parseFloat(b.val) : 1.2;
            const dVal = b.val !== undefined ? parseFloat(b.val) : 0.8;
            if (b.type === 'BUFF_STAT_ALL_STAT' || b.type === 'BUFF_ALL_STAT') val *= bVal;
            if (b.type === 'BUFF_ALL') val *= 1.2; 
            if (b.type === 'DEBUFF_ALL') val *= 0.8;
            if (b.type === 'BUFF_ENCHANT') val *= 1.1;
            if (b.type === 'BUFF_CHANNELED_ALL_STAT') val *= parseFloat(b.val) || 1.15;
            if (stat === 'str' && b.type === 'BUFF_ATK') val *= bVal; 
            if (stat === 'str' && b.type === 'DEBUFF_ATK') val *= dVal;
            if (stat === 'int' && b.type === 'BUFF_ATK') val *= bVal; 
            if (stat === 'int' && b.type === 'DEBUFF_ATK') val *= dVal;
            if (stat === 'vit' && b.type === 'BUFF_DEF') val *= bVal; 
            if (stat === 'vit' && b.type === 'DEBUFF_DEF') val *= dVal;
            if (stat === 'agi' && b.type === 'BUFF_SPD') val *= bVal; 
            if (stat === 'agi' && b.type === 'DEBUFF_SPD') val *= dVal;
            if (stat === 'dex' && b.type === 'BUFF_ACC') val *= bVal; 
            if (stat === 'dex' && b.type === 'DEBUFF_ACC') val *= dVal;
            if (stat === 'luk' && b.type === 'BUFF_LUCK') val *= bVal; 
            if (stat === 'luk' && b.type === 'DEBUFF_LUCK') val *= dVal;
        });
    }
    
    // [수정됨] 무한 루프에 빠지지 않도록 excludeBuffs가 아닐 때만 패시브 연산(getAdd) 호출
    if (stat === 'luk' && !excludeBuffs) {
        val += getAdd(unit, 'PASSIVE_LUCK', 'BUFF_LUCK');
    }
    
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
    const buffs = unit.buffs || [];

    switch (type) {
        case 'hp_regen':
            val = 5 + (vit * 0.2); 
            if(!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_HEAL_POWER');
                if (buffs.some(b => b.type === 'HEAL_REGEN')) val *= 2.0;
            }
            break;

        case 'mp_regen':
            val = 3 + (int * 0.5); 
            if(!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_MANA');
                if (buffs.some(b => b.type === 'HEAL_MP')) val += 5;
            }
            break;

        case 'atk_phys': 
            val = (str + (dex * 0.5));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_DMG', 'BUFF_ATK');
                // ⭐ 기획서 버프/디버프 연동
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_ATK') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_ATK') val *= parseFloat(b.val) || 0.8;
                    if (b.type === 'BUFF_STAT_ALL_ATK') val *= parseFloat(b.val) || 1.15;
                });
            }
            break;

        case 'atk_mag':  
            val = (int + (dex * 0.5));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_MAG', 'BUFF_ATK');
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_MATK') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_MATK') val *= parseFloat(b.val) || 0.8;
                    if (b.type === 'BUFF_STAT_ALL_ATK') val *= parseFloat(b.val) || 1.15;
                });
            }
            break;

        case 'def':      
            val = ((vit * 0.5) + (str * 0.2) + getStat(unit, 'def', excludeBuffs));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_DEF', 'BUFF_DEF');
                if (buffs.some(b => b.type === 'DEF_PROTECT')) val *= 1.3;
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_DEF') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_DEF') val *= parseFloat(b.val) || 0.8;
                    // ⭐ 수면 시 방어력 50% 반감
                    if (b.type === 'STAT_SLEEP' || b.type === 'CC_SLEEP') val *= 0.5; 
                });
            }
            break;

        case 'res':      
            val = ((int * 0.5) + (vit * 0.2));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_MDEF') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_MDEF') val *= parseFloat(b.val) || 0.8;
                    // ⭐ 수면 시 마법 방어력도 50% 반감
                    if (b.type === 'STAT_SLEEP' || b.type === 'CC_SLEEP') val *= 0.5; 
                });
            }
            break;

        case 'hit_phys': 
        case 'hit_mag':
            val = 90 + (dex * 1.5) + (luk * 0.2);
            if (!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_ACC', 'BUFF_ACC', 'DEBUFF_ACC');
                if (getAdd(unit, 'PASSIVE_SUREHIT') > 0) val += 999; 
                if (buffs.some(b => b.type === 'STAT_BLIND')) val *= 0.5;
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_ACC') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_ACC') val *= parseFloat(b.val) || 0.8;
                });
            }
            break;

        case 'crit':     
            val = (luk * 1.0) + (dex * 0.5);
            if (!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_CRIT', 'BUFF_CRIT');
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_CRIT') val *= parseFloat(b.val) || 1.3;
                    if (b.type === 'DEBUFF_STAT_CRIT') val *= parseFloat(b.val) || 0.7;
                });
            }
            break;

        case 'eva':      
            val = (agi * 1.5) + (luk * 0.5);
            // ⭐ [수정] this.battle 대신 activeBattle 사용
            if (!excludeBuffs && buffs.some(b => {
                const bType = (activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type;
                return ['STAT_SLEEP', 'CC_SLEEP', 'STAT_STUN', 'STAT_FREEZE', 'STAT_GRAVITY'].includes(bType);
            })) return 0;
            
            if (!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_EVA', 'BUFF_EVA', 'DEBUFF_EVA');
                val += getAdd(unit, 'PASSIVE_EVA_BOOST');
                if (buffs.some(b => b.type === 'STEALTH')) val += 50;
                if (buffs.some(b => b.type === 'STAT_BLIND')) val *= 0.5;
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_EVA') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_EVA') val *= parseFloat(b.val) || 0.8;
                });
            }
            break;

        case 'tenacity': 
            val = (vit * 1.0) + (luk * 0.5); 
            if(!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
                // ⭐ 여기에 추가! (정령들의 춤사위 - 상태이상 저항력 보정)
                if (buffs.some(b => b.type === 'BUFF_STAT_RESIST')) {
                    const resistBuff = buffs.find(b => b.type === 'BUFF_CHANNELED_RESIST');
                    val *= parseFloat(resistBuff.val) || 1.5;
                }
            }
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
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_SPD', 'BUFF_SPD');
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_SPD') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_SPD') val *= parseFloat(b.val) || 0.8;
                    // ⭐ 여기에 추가! (신화의 서장 - 턴 속도 보정)
                    if (b.type === 'BUFF_STAT_WT_REGEN') val *= parseFloat(b.val) || 1.3;
                });
            }
            break;

        case 'mov': 
            val = (unit.baseMov || unit.mov || 3);
            if (!excludeBuffs) {
                val += getAdd(unit, 'PAS_STAT_MOVE'); 
                
                if (buffs) {
                    buffs.forEach(b => {
                        if (b.type === 'BUFF_STAT_MOVE' || b.type === 'DEBUFF_STAT_MOVE') {
                            val += parseFloat(b.val) || 0;
                        }
                        if (b.type === 'BUFF_STAT_MOVE_JUMP') {
                            val += parseFloat(b.val) || 1;
                        }
                    });
                }
                
                if (buffs.some(b => b.type === 'MOVE_FREE')) val += 2;
                if (buffs.some(b => b.type === 'STAT_GRAVITY' || b.type === 'DEBUFF_GROUNDED')) val -= 2;
                
                if (buffs.some(b => ['STAT_PARALYSIS', 'STAT_STUN', 'STAT_SLEEP', 'STAT_BIND', 'STAT_FREEZE', 'STAT_PETRIFY', 'CC_ROOT'].includes(b.type))) {
                    return 0;
                }
            }
            break;

        case 'rng':
            val = unit.rng || 1; 
            if (unit.equipment && unit.equipment.mainHand) {
                const weaponId = unit.equipment.mainHand;
                if (ITEM_DATA[weaponId] && ITEM_DATA[weaponId].rng) {
                    val = ITEM_DATA[weaponId].rng; 
                }
            }
            if (!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_DIST_BONUS') > 0 ? 1 : 0;
                val += getAdd(unit, 'PAS_STAT_RANGE'); // 기획서 키워드
            }
            break;

        case 'cost_red': 
            val = 1.0;
            if (unit.skills) {
                // ⭐ 장착된 스킬 안에서만 마나 감소 패시브 탐색
                const equippedIds = unit.equippedSkills || [];
                const activeSkills = unit.skills.filter(s => equippedIds.includes(s.id) || (s.category && equippedIds.includes(`CAT_${s.category}`)));
                
                activeSkills.forEach(s => {
                    if (s && s.type === 'PASSIVE' && s.effects) {
                        s.effects.forEach(e => {
                            if (['PASSIVE_COST_RED', 'PAS_COST_RED', 'PAS_WT_REDUCE', 'MP_COST'].includes(e.type)) {                                let v = parseFloat(e.val);
                                if (isNaN(v)) v = 0.8; 
                                else if (v >= 1) v = 1.0 - (v / 100); 
                                val *= v;
                            }
                        });
                    }
                });
            }
            
            if (!excludeBuffs && buffs) {
                buffs.forEach(b => {
                    if (['BUFF_FAST', 'BUFF_HASTE', 'STAT_FAST', 'SPEED_UP'].includes(b.type)) {
                        let v = parseFloat(b.val);
                        if (isNaN(v) || v === 1) v = 0.7; 
                        else if (v >= 1) v = 1.0 - (v / 100);
                        val *= v;
                    }
                });
            }
            
            if (val < 0.1) val = 0.1; 
            break;
            
        case 'crit_dmg':
             val = 1.5; 
             if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_CRIT_DMG', 'BUFF_CRIT_DMG');
             break;
             
        case 'gold_bonus':
             val = 1.0 + (luk * 0.01);
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_GOLD', 'ECON_GOLD');
            break;
            
        case 'drop_rate':
            val = 1.0 + (luk * 0.02);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_DROP', 'ECON_DROP_RATE');
            break;
            
        case 'shop_discount':
            val = 0;
            if (!excludeBuffs) {
                 if (buffs.some(b => b.type === 'ECON_DISCOUNT')) val = 0.2; 
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
             if (!excludeBuffs && buffs && buffs.some(b => b.type === 'BUFF_EXTENSION')) val = 1.5;
             break;
    }
    
    if (unit.equipment) {
        STAT_SLOTS.forEach(slot => {
            const itemId = unit.equipment[slot];
            if (itemId && ITEM_DATA[itemId] && ITEM_DATA[itemId].classBonus) {
                const parts = ITEM_DATA[itemId].classBonus.split(':');
                if (parts.length === 3) {
                    const [reqJob, bonusStat, bonusVal] = parts;
                    if (unit.classKey === reqJob && bonusStat === type) {
                        val += Number(bonusVal);
                    }
                }
            }
        });
    }
    
    if (!excludeBuffs && buffs) {
        buffs.forEach(b => {
             if ((b.type === 'CC_ROOT' || b.type === 'CC_FREEZE' || b.type === 'CC_STUN' || b.type === 'CC_SLEEP') && type === 'mov') val = 0; 
        });
    }

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

    // ⭐ [신규] 공포(Fear) 페널티: 고정 유틸 수치를 제외한 모든 전투력(공/방/명/회 등) 30% 감소
    if (!excludeBuffs && buffs && buffs.some(b => b.type === 'STAT_FEAR' || b.type === 'CC_FEAR')) { // CC_FEAR 도 추가하여 확실히 잡음
        const ignoreList = ['mov', 'rng', 'hp_max', 'mp_max', 'jump', 'cost_red', 'gold_bonus', 'drop_rate', 'shop_discount', 'reuse_chance', 'gauge_save', 'tick_save', 'buff_duration_mult'];
        if (!ignoreList.includes(type)) {
            val *= 0.7; // 기획서 2-8: 모든 능력치 30% 감소
        }
    }

    if (['crit', 'eva', 'hit_phys', 'hit_mag', 'tenacity'].includes(type)) return Math.max(0, Math.floor(val));
    if (['cost_red', 'gold_bonus', 'drop_rate', 'shop_discount', 'reuse_chance', 'gauge_save', 'tick_save', 'buff_duration_mult'].includes(type)) return val;
    return Math.floor(Math.max(0, val));
}

// ==========================================
// 4. 명중률 계산 공식
// ==========================================
export function calculateHitRate(atkUnit, defUnit, skillAcc = 100, grid = null) {
    let hitStat = getDerivedStat(atkUnit, atkUnit.atkType === 'MAG' ? 'hit_mag' : 'hit_phys');
    let evaStat = getDerivedStat(defUnit, 'eva');
    let rate = hitStat - evaStat + skillAcc;

    if (grid) {
        const tData = grid.getTerrainData(defUnit.q, defUnit.r);
        if (tData && tData.key === 'FOREST') rate -= 20; 
        if (tData && tData.key === 'MOUNTAIN') rate -= 30; 
        if (tData && tData.key === 'WATER') rate += 10; 
    }

    const dir = grid ? grid.getDirection(defUnit, atkUnit) : 0;
    const diff = Math.abs(defUnit.facing - dir);
    if (diff === 3) rate += 30; 
    else if (diff === 2 || diff === 4) rate += 15;

    // ⭐ 장착된 스킬 안에서만 ATK_SNIPE 패시브 발동
    const equippedIds = atkUnit.equippedSkills || [];
    const activeSkills = (atkUnit.skills || []).filter(s => equippedIds.includes(s.id) || (s.category && equippedIds.includes(`CAT_${s.category}`)));

    if (activeSkills.some(s => s.effects && s.effects.some(e => e.type === 'ATK_SNIPE'))) {
        const snipeEff = activeSkills.find(s => s.effects.some(e => e.type === 'ATK_SNIPE')).effects.find(e => e.type === 'ATK_SNIPE');
        const maxRng = 6;
        const dist = grid ? grid.getDistance(atkUnit, defUnit) : 1;
        const ratio = Math.min(1.0, dist / maxRng);
        rate -= parseFloat(snipeEff.val) * ratio; // 거리가 멀수록 페널티 커짐
    }

    return Math.max(5, Math.min(100, rate));
}

// ==========================================
// 5. 데미지 계산 (물리, 마법, 고정 피해 통합)
// ==========================================
export function calculateDamage(atkUnit, defUnit, skillMult = 1.0, dmgType = 'PHYS', grid = null, options = {}) {
    if (!dmgType) dmgType = atkUnit.atkType || 'PHYS'; 
    
    if (options.tags && (options.tags.includes('ATK_MULTI') || options.tags.includes('ATK_CHAIN'))) {
        skillMult *= 0.9; 
    }

    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => 
            b.type === 'DEF_INVINCIBLE' || 
            b.type === 'BUFF_PHASING' || 
            b.type === 'BUFF_UNTARGETABLE'|| 
            b.type === 'STAT_PETRIFY'
        )) {
            return { damage: 0, isMiss: false, text: "IMMUNE", hitContext: "NORMAL" };
        }
    }

    let baseAtk = 0;
    let hitRate = 100;
    let isFixed = false; 
    let appliedMult = skillMult;

    // ⭐ [신규] 모든 종류의 마법 데미지를 묶어주는 배열
    const magicTypes = ['MAG', 'DMG_MAG', 'HOLY', 'DMG_HOLY', 'DARK', 'DMG_DARK', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_WIND', 'DMG_EARTH', 'DMG_NEUTRAL'];

    if (magicTypes.includes(dmgType)) {
        baseAtk = getDerivedStat(atkUnit, 'atk_mag'); 
        hitRate = getDerivedStat(atkUnit, 'hit_mag');
    } 
    else if (dmgType === 'DMG_FIXED') {
        baseAtk = skillMult; appliedMult = 1.0; hitRate = 999; isFixed = true;
    }
    else if (dmgType === 'ATK_EXECUTE') {
        const threshold = (defUnit.hp || 100) * skillMult; 
        if (defUnit.curHp <= threshold) {
            baseAtk = defUnit.curHp; appliedMult = 1.0; hitRate = 999; isFixed = true;
        } else return { damage: 0, isMiss: false, text: "RESIST", hitContext: "NORMAL" };
    }
    else if (dmgType === 'DMG_TRUE_BYMP') {
        baseAtk = atkUnit.curMp; atkUnit.curMp = 0; appliedMult = 1.0; hitRate = 999; isFixed = true;
    }
    else { // PHYS (물리)
        baseAtk = getDerivedStat(atkUnit, 'atk_phys'); 
        hitRate = getDerivedStat(atkUnit, 'hit_phys'); 
    }
    
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

    if (grid && !isFixed) {
        const dist = grid.getDistance(atkUnit, defUnit);
        
        // ⭐ [신규] ATK_SNIPE: 거리에 비례하여 데미지 증가 (최대 사거리일 때 val% 만큼 증가)
        if (options.snipe) {
            const maxRng = options.maxRng || 6;
            const ratio = Math.min(1.0, dist / maxRng); 
            const maxBonus = parseFloat(options.snipe) / 100; // 50 -> 0.5
            baseAtk *= (1.0 + (maxBonus * ratio)); 
        }

        const distBonus = getMult(atkUnit, 'PASSIVE_DIST_BONUS'); 
        if (distBonus > 1.0) {
            const bonusPerTile = distBonus - 1.0;
            baseAtk *= (1 + (dist * bonusPerTile));
        }
        if (options.tags && options.tags.includes('ATK_DIST') && dist > 1) baseAtk *= 1.1; 
        if (options.tags && (options.tags.includes('ATK_MOVE') || options.tags.includes('ATK_JUMP') || options.tags.includes('ATK_DASH'))) baseAtk *= 1.1; 
    }
    // ⭐ [신규] 고저차 기반 지형 데미지 (Height Bonus)
        if (typeof activeBattle !== 'undefined' && activeBattle !== null) {
            const atkH = grid.getTerrainData(atkUnit.q, atkUnit.r).h || 0;
            const defH = grid.getTerrainData(defUnit.q, defUnit.r).h || 0;
            const heightDiff = atkH - defH;
            
            if (heightDiff > 0) {
                // 패시브 확인 (창공의 권위: 고저차 보너스 2배)
                const hasHighGroundBonus = getAdd(atkUnit, 'PAS_HIGHGROUND_BONUS') > 0;
                const maxBonus = hasHighGroundBonus ? 0.6 : 0.3; // 최대 30% (패시브 시 60%)
                const multBonus = Math.min(maxBonus, heightDiff * (hasHighGroundBonus ? 0.2 : 0.1));
                baseAtk *= (1.0 + multBonus);
            } else if (heightDiff < 0) {
                // 저지대 페널티 (1단차당 5% 감소, 최대 30% 감소)
                baseAtk *= Math.max(0.7, 1.0 + (heightDiff * 0.05)); 
            }
        }
    // ⭐ [신규] 비행 대상 패시브 데미지 증폭 (조류 사냥)
    if (grid && !isFixed) {
        // BattleSystem이 연결되어 있다면 isFlying으로 판단
        const isTargetFlying = typeof activeBattle !== 'undefined' && activeBattle !== null ? activeBattle.isFlying(defUnit) : false;
        
        if (isTargetFlying) {
            const antiAirMult = getMult(atkUnit, 'PAS_DMG_VS_FLY');
            if (antiAirMult > 1.0) {
                baseAtk *= antiAirMult;
            }
        }
    }

    // ⭐ [신규] SYS_DMG_REDUCTION: 타격 횟수(chainIndex)에 비례해 관통/체인 데미지 감쇄
    if (options.dmgReduction && options.chainIndex > 0) {
        // 예: -0.1 (10%씩 감소) -> 타격 순서(chainIndex)만큼 거듭제곱
        const reductionMult = 1.0 - Math.abs(parseFloat(options.dmgReduction));
        baseAtk *= Math.pow(reductionMult, options.chainIndex);
    }
    

    let rawDmg = baseAtk;
    if (!isFixed) {
        const vol = getStat(atkUnit, 'vol');
        const minMult = 0.9; 
        const maxMult = 1.0 + (vol * 0.05);
        rawDmg = Math.random() * (baseAtk * maxMult - baseAtk * minMult) + baseAtk * minMult;
    }

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

    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => ['CC_SLEEP', 'CC_STUN', 'CC_FREEZE', 'CC_ROOT', 'CC_CHARM', 'CC_FEAR', 'CC_POLYMORPH'].includes(b.type))) {
            evaModifier = 0; 
            if (hitContext === "NORMAL") hitContext = "CC_HIT";
        }
    }

    const hasSureHit = options.sureHit || (getAdd(atkUnit, 'PASSIVE_SUREHIT') > 0) || (options.tags && options.tags.includes('ATK_SUREHIT'));
    
    if (!isFixed && !hasSureHit && hitContext !== "BACKSTAB" && hitContext !== "CC_HIT") {
        const evaRate = getDerivedStat(defUnit, 'eva') * evaModifier;
        const finalHitChance = hitRate - evaRate;
        if (Math.random() * 100 > finalHitChance) {
            return { damage: 0, isMiss: true, text: "MISS", hitContext };
        }
    }

    let defense = 0;
    
    if (!isFixed) {
         // ⭐ 1. 모든 신규 마법 데미지도 방어력(def) 대신 저항력(res)으로 데미지를 깎음
         const isMagic = ['MAG', 'DMG_MAG', 'HOLY', 'DMG_HOLY', 'DARK', 'DMG_DARK', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_WIND', 'DMG_EARTH', 'DMG_NEUTRAL'].includes(dmgType);
         defense = isMagic ? getDerivedStat(defUnit, 'res') : getDerivedStat(defUnit, 'def');
         defense *= defModifier;

         // ⭐ [신규] 수면 상태일 경우 방어력 반감 (-50%)으로 뼈아프게 맞음
         if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'STAT_SLEEP')) {
             defense = Math.floor(defense * 0.5);
         }

         let pen = (options.penetrate || 0) + getAdd(atkUnit, 'PASSIVE_PENETRATE');        if (options.tags && options.tags.includes('ATK_PENETRATE')) pen += 0.3;
        if (pen > 0) defense *= (1 - Math.min(1, pen));
    }

    let finalDmg = rawDmg * appliedMult;
    
    if (!isFixed) {
        finalDmg = finalDmg * (100 / (100 + Math.max(0, defense)));
    }

    let eleMult = 1.0;
    let isWeak = false;
    let isResist = false;
    
    if (!isFixed) {
        // ⭐ [에러 수정 및 기획 반영] 스킬 타입에 따른 고유 공격 속성 판별 (장착 스킬만 검사하여 에러 방지)
        let skillElement = atkUnit.element || 'NONE';
        
        const equippedIds = atkUnit.equippedSkills || [];
        const activeSkills = (atkUnit.skills || []).filter(s => equippedIds.includes(s.id) || (s.category && equippedIds.includes(`CAT_${s.category}`)));
        
        const changeElemPassive = activeSkills.find(s => s.effects && s.effects.some(e => e.type === 'PAS_CHANGE_ELEM'));
        
        if (changeElemPassive) {
            const currentMonth = new Date().getMonth() + 1; // 1~12월
            const monthElemMap = {
                1: 'ICE', 2: 'ICE', 3: 'WIND', 4: 'WIND', 
                5: 'EARTH', 6: 'EARTH', 7: 'FIRE', 8: 'FIRE', 
                9: 'LIGHTNING', 10: 'LIGHTNING', 11: 'DARK', 12: 'LIGHT'
            };
            skillElement = monthElemMap[currentMonth] || 'NONE';
        }
        
        if (dmgType === 'DMG_FIRE') skillElement = 'FIRE';
        else if (dmgType === 'DMG_ICE') skillElement = 'ICE';
        else if (dmgType === 'DMG_LIGHTNING') skillElement = 'LIGHTNING';
        else if (dmgType === 'DMG_HOLY' || dmgType === 'HOLY') skillElement = 'LIGHT';
        else if (dmgType === 'DMG_DARK' || dmgType === 'DARK') skillElement = 'DARK';
        else if (dmgType === 'DMG_EARTH') skillElement = 'EARTH';
        else if (dmgType === 'DMG_WIND') skillElement = 'WIND';
        else if (dmgType === 'DMG_NEUTRAL') skillElement = 'NONE'; // 무속성

        const atkEle = ELEMENTS[skillElement];
        if (atkEle && atkEle.strong === defUnit.element) { eleMult = 1.3; isWeak = true; }
        else if (atkEle && atkEle.weak === defUnit.element) { eleMult = 0.8; isResist = true; }
        
        const weaknessPassive = activeSkills.find(s => s.effects && s.effects.some(e => e.type === 'PAS_DMG_WEAKNESS'));
        if (weaknessPassive) {
            const weakBonus = parseFloat(weaknessPassive.effects.find(e => e.type === 'PAS_DMG_WEAKNESS').val) || 1.3;
            eleMult *= weakBonus; 
        }
        
        // 언데드는 신성 속성에 무조건 1.5배 약점
        if (skillElement === 'LIGHT' && (defUnit.element === 'DARK' || defUnit.race === 'UNDEAD')) {
            eleMult = Math.max(eleMult, 1.5); 
            isWeak = true;
        }
        
        finalDmg *= eleMult;
    }

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

    let blockVal = getAdd(defUnit, 'PASSIVE_BLOCK', 'BUFF_BLOCK');
    if (!isFixed && blockVal > 0 && Math.random() < 0.3) { 
        finalDmg *= (1.0 - Math.min(0.9, blockVal));
        hitContext = "BLOCK";
    }

    if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'DEF_STORE_DMG')) {
        finalDmg *= 0.5; 
    }
    
    let manaShieldDmg = 0;
    if (defUnit.buffs) {
        const msBuff = defUnit.buffs.find(b => b.type === 'DEF_MANA_SHIELD');
        if (msBuff && defUnit.curMp > 0) {
            const ratio = msBuff.val !== undefined ? parseFloat(msBuff.val) : 0.5; 
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

    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => b.type === 'STATUS_CURSE')) finalDmg *= 1.2;
        if (defUnit.buffs.some(b => b.type === 'DEBUFF_VULNERABLE')) finalDmg *= 1.5;
        if (defUnit.buffs.some(b => b.type === 'CC_FEAR') && !isFixed) finalDmg *= 1.2;
    }
    
    if (hitContext === "BACKSTAB" && options.backstabMult) {
        finalDmg *= parseFloat(options.backstabMult);
    }

    let reflectDmg = 0;
    if (!isFixed) {
        let reflectPct = getAdd(defUnit, 'PASSIVE_REFLECT');
        if (defUnit.buffs) {
            const reflectBuff = defUnit.buffs.find(b => b.type === 'BUFF_REFLECT' || b.type === 'BUFF_COUNTER');
            if (reflectBuff) {
                reflectPct += (reflectBuff.val !== undefined ? parseFloat(reflectBuff.val) : 0.3);
            }
        }
        if (reflectPct > 0 && (!grid || grid.getDistance(atkUnit, defUnit) <= 1)) {
            reflectDmg = finalDmg * reflectPct;
        }
    }

    return {
        damage: Math.max(isFixed ? 1 : 0, Math.floor(finalDmg)),
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
    const eff = skill.main || skill; 
    const type = String(eff.type || '').toUpperCase();
    const val = parseFloat(eff.val) || 0;

    const maxHp = getDerivedStat(target, 'hp_max');
    const matk = getDerivedStat(caster, 'atk_mag'); // 시전자의 MATK
    const healPower = getMult(caster, 'PASSIVE_HEAL_POWER');
    const recvPower = getMult(target, 'PAS_HEAL_RECV_UP');

    // 1. 퍼센트 힐 (예: HEAL_HP_PER, val: 0.2 = 최대 체력의 20%)
    if (type.includes('HP_PER') || type.includes('PERCENT')) {
        amount = maxHp * val; 
    } 
    // 2. 100% 완전 회복 (예: HEAL_FULL, REVIVE)
    else if (type.includes('FULL') || type.includes('REVIVE')) {
        amount = maxHp * (val || 1.0);
    }
    // 3. 아이템 사용 시 (포션 등은 MATK 영향을 받지 않고 고정 수치 회복)
    else if (skill.type === 'ITEM' || type === 'HEAL_FIXED') {
        amount = val;
    }
    // 4. MP 회복
    else if (type.includes('MP_PER')) {
        const maxMp = getDerivedStat(target, 'mp_max');
        return { hp: 0, mp: Math.floor(maxMp * val * healPower) };
    }
    else if (type.includes('HEAL_MP')) {
        return { hp: 0, mp: Math.floor(val * healPower) };
    }
    // ⭐ 5. 일반 스킬 치유 (HEAL_HP) -> 시전자 MATK * val (예: val 1.5 = MATK 150%)
    else if (type.includes('HEAL_HP') || type.includes('HEAL_AOE')) {
        amount = matk * val;
    } 
    else {
        amount = val;
    }

     // ⭐ [신규] 출혈 상태일 경우 최종 힐량 50% 반감
    let finalHpHeal = Math.floor(amount * healPower * recvPower);

    // ⭐ 기획서 반영: 호문클루스는 힐 마법을 받지 못하며, 오직 포션(아이템)으로만 회복
    if (target.key === 'HOMUNCULUS' && skill.type !== 'ITEM') {
        finalHpHeal = 0;
    }

    if (target.buffs && target.buffs.some(b => b.type === 'STAT_BLEED')) {
        finalHpHeal = Math.floor(finalHpHeal * 0.5);
    }

    return { hp: finalHpHeal, mp: 0 };
}
// ==========================================
// 6. DoT / Status Damage Calculation
// ==========================================

export function calculateDotDamage(unit, statusType, val) {
    const maxHp = getDerivedStat(unit, 'hp_max');
    let dmg = 0;
    const power = parseFloat(val) || 1;
    if (statusType.includes('POISON') || statusType.includes('BLEED')) {
        dmg = Math.max(1, Math.floor(maxHp * 0.05));
    } else if (statusType.includes('BURN')) {
        dmg = Math.max(1, Math.floor(power * 10) || 10); // 화상은 고정/계수 데미지
    } else if (statusType.includes('CURSE')) {
        dmg = Math.floor(maxHp * 0.03 * power);
    } else {
        dmg = power;
    }
    return Math.floor(dmg);
}

// ==========================================
// 7. Utility / Effect Power Calculation
// ==========================================

export function calculateEffectPower(caster, type, baseVal) {
    let power = parseFloat(baseVal) || 0;

    switch (type) {
        case 'ATK_JUMP':
        case 'ATK_DASH':
        case 'ATK_MOVE':
        case 'MOVE_TELEPORT':
        case 'MOVE_BEHIND':
        case 'MOVE_BACK':
        case 'MOVE_SWAP':
            power = getDerivedStat(caster, 'mov') + power;
            break;
            
        case 'SUMMON_DECOY':
        case 'SUMMON_WALL':
            power = getDerivedStat(caster, 'hp_max') * (power || 0.5);
            break;
            
        case 'ECON_GOLD':
        case 'ECON_STEAL':
            const luk = getStat(caster, 'luk');
            const bonus = getDerivedStat(caster, 'gold_bonus');
            power = ((power || 10) + luk) * bonus;
            break;
            
        case 'ECON_CREATE':
        case 'ECON_TRANSMUTE':
        case 'ECON_ITEM_GET':
            power = getDerivedStat(caster, 'luk') * 0.5 + (power || 10);
            break;

        case 'GAUGE_FILL':
        case 'GAUGE_DRAIN':
        case 'GAUGE_SET':
             if (type === 'GAUGE_FILL') {
                 const gaugeBonus = getAdd(caster, 'PASSIVE_GAUGE');
                 power += gaugeBonus;
             }
             break;
             
        case 'TRAP_STUN':
             const dex = getStat(caster, 'dex');
             power = (power || 20) + dex * 2;
             break;
             
        case 'AGGRO_TAUNT':
        case 'AGGRO_CONFUSE':
             power = (power || 100) + getStat(caster, 'vol');
             break;
             
        case 'UTIL_INTERACT':
        case 'UTIL_REVEAL':
        case 'UTIL_IDENTIFY':
        case 'UTIL_SCAN':
        case 'UTIL_LORE':
        case 'UTIL_CD_RESET':
             power = (power || 50) + getStat(caster, 'int') + getStat(caster, 'luk');
             break;
             
        case 'SPECIAL_TIME_STOP':
             power = power || 1; 
             break;
             
        case 'CC_KNOCKBACK':
             power = power || 1; 
             break;
    }
    
    
    return Math.floor(power);
}
// ⭐ 유니버설 패시브 조건 판별기
export function checkPassiveCondition(unit, mainEffect, battle) {
    const b = battle || activeBattle; 
    if (!mainEffect || (!mainEffect.type.startsWith('PAS_') && !mainEffect.type.toUpperCase().startsWith('SYS_'))) return true;
    
    const cType = String(mainEffect.type).toUpperCase();
    const cVal = parseFloat(mainEffect.val) || 0;

    // 🟢 1. 상태형 조건 (스탯에 상시 영향을 주는 조건들)
    if (cType === 'PAS_COND_HP') {
        // ⭐ [근본 해결 - 조건 판별기] 무거운 스탯 재계산을 없애고 기존 hp 참조
        const maxHp = unit.hp || 100;
        return (unit.curHp / maxHp) <= cVal;
    }
    
    if (cType === 'PAS_ATNIGHT') return b && b.isNight === true; 
    if (cType === 'PAS_COND_HOLD') return b && !b.actions.moved; 
    if (cType === 'PAS_ONBUSH') {
        if (!b || !b.grid) return false; 
        const terrain = b.grid.getTerrain(unit.q, unit.r);
        return terrain && (terrain.includes('BUSH') || terrain.includes('FOREST')); 
    }

    // 🔴 2. 이벤트형 트리거
    const eventTriggers = ['PAS_ONDEATH', 'PAS_ONKILL', 'PAS_BEFORE_HIT', 'PAS_AFTER_HIT', 'PAS_TURNEND', 'PAS_RANGE_BEFORE_HIT', 'PAS_RANGE_AFTER_HIT', 'PAS_ALLY_HIT'];
    if (eventTriggers.includes(cType)) return false; 

    return true; 
}