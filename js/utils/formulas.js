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
    if (effType === reqType) return true;
    
    // ⭐ [도적/무투가 기획 반영] 범용 스탯 증가(PAS_STAT_ALL)가 유틸에 오작동하지 않도록 전투 스탯에만 한정
    const combatStats = ['PASSIVE_DMG', 'PASSIVE_MAG', 'PASSIVE_DEF', 'PASSIVE_RESIST', 'PASSIVE_SPD', 'PASSIVE_ACC', 'PASSIVE_EVA', 'PASSIVE_CRIT', 'PASSIVE_SURVIVE', 'PASSIVE_MANA'];
    if ((effType === 'ALL_STAT' || effType === 'PAS_STAT_ALL') && combatStats.includes(reqType)) return true;

    if (reqType === 'PASSIVE_DMG' && (effType === 'PAS_STAT_ATK' || effType === 'PAS_STAT_ATK_LOWHP')) return true;
    if (reqType === 'PASSIVE_MAG' && (effType === 'PAS_STAT_MATK' || effType === 'PAS_STAT_MATK_LOWHP')) return true;
    if (reqType === 'PASSIVE_DEF' && (effType === 'PAS_STAT_DEF' || effType === 'PAS_STAT_DEF_LOWHP')) return true;
    if (reqType === 'PASSIVE_RESIST' && effType === 'PAS_STAT_RESIST') return true;
    if (reqType === 'PASSIVE_SPD' && effType === 'PAS_STAT_SPD') return true;
    if (reqType === 'PASSIVE_ACC' && effType === 'PAS_STAT_ACC') return true;
    if (reqType === 'PASSIVE_EVA' && effType === 'PAS_STAT_EVA') return true;
    if (reqType === 'PASSIVE_CRIT' && effType === 'PAS_STAT_CRIT') return true;
    if (reqType === 'PASSIVE_MOVE' && effType === 'PAS_STAT_MOVE') return true;
    if (reqType === 'PASSIVE_MANA' && effType === 'PAS_STAT_MAXMP') return true;
    if (reqType === 'PASSIVE_SURVIVE' && effType === 'PAS_STAT_MAXHP') return true;
    if (reqType === 'PASSIVE_HEAL_POWER' && effType === 'PAS_HEAL_RECV_UP') return true;
    if (reqType === 'PASSIVE_STEAL' && effType === 'PAS_STEAL_RATE') return true;
    if (reqType === 'PASSIVE_GOLD' && effType === 'PAS_GOLD_GAIN') return true;
    if (reqType === 'PASSIVE_MASTERY' && effType === 'PAS_STAT_MASTERY') return true;
    if (reqType === 'PASSIVE_COST_RED' && ['MP_COST', 'PAS_MP_COST', 'PAS_MP_COST_RED_CHANT', 'PAS_MP_COST_RED_DANCE', 'PAS_MP_COST_RED_SUP', 'PAS_MP_COST_INC'].includes(effType)) return true;
    if (reqType === 'PASSIVE_JUMP' && effType === 'PAS_STAT_JUMP') return true; 
    
    return false;
}

export function updateUnitCache(unit) {
    unit.cachedModifiers = { mults: {}, adds: {} };
    unit.buffs = unit.buffs || [];
    
    // ⭐ 어떠한 백업본도 쓰지 않고 오직 순수 원본(unit.skills)만 참조합니다.
    if (unit.skills && Array.isArray(unit.skills)) {
        const equippedIds = unit.equippedSkills || [];
        const activeSkills = unit.skills.filter(s => {
            if (!s) return false;
            // 지시하신 대로 오직 "장착된" 패시브만 걸러냅니다.
            const catEquipId = s.category ? `CAT_${s.category}` : null;
            return equippedIds.includes(s.id) || (catEquipId && equippedIds.includes(catEquipId));
        });

        activeSkills.forEach(s => {
            const reqClassLv = parseInt(s.req_class_lv) || 1;
            const currentClassLv = unit.classLevel || 1;
            
            if (s && s.type === 'PASSIVE' && currentClassLv >= reqClassLv && s.effects && s.effects.length > 0) {
                const validEffects = s.effects.filter(e => e && e.type && String(e.type).trim() !== '-');
                if (validEffects.length === 0) return;

                const mainEff = validEffects[0];

                if (mainEff.type.includes('LOWHP')) {
                    const maxHp = unit.hp || 100;
                    if ((unit.curHp / maxHp) > 0.5) return; 
                }

                const processEffect = (eff) => {
                    if (!eff || !eff.type || typeof eff.type !== 'string') return;
                    const val = parseFloat(eff.val);
                    if (isNaN(val)) return;
                    
                    if (!unit.cachedModifiers.mults[eff.type]) unit.cachedModifiers.mults[eff.type] = 1.0;
                    if (!unit.cachedModifiers.adds[eff.type]) unit.cachedModifiers.adds[eff.type] = 0;

                    const isAdditive = ['PAS_STAT_MOVE', 'PAS_STAT_JUMP', 'PAS_STAT_RANGE', 'PAS_STAT_MASTERY', 'PAS_STEAL_RATE', 'PAS_GOLD_GAIN', 'PAS_DROP_RATE'].includes(eff.type) || eff.type.startsWith('PAS_DMG_REDUCE');

                    if (isAdditive && !eff.type.includes('LOWHP')) {
                        unit.cachedModifiers.adds[eff.type] += val;
                    } else {
                        unit.cachedModifiers.mults[eff.type] += (val - 1.0);
                    }
                };

                if (mainEff.type.startsWith('PAS_COND_')) {
                    let conditionMet = true;
                    try {
                        if (typeof checkPassiveCondition === 'function') conditionMet = checkPassiveCondition(unit, mainEff, null);
                    } catch (e) {}
                    if (conditionMet) {
                        for (let i = 1; i < validEffects.length; i++) processEffect(validEffects[i]);
                    }
                } else {
                    validEffects.forEach(eff => processEffect(eff));
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
            // ⭐ [도적 기획 반영] '밤의 가호' (BUFF_STAT_ALL) 추가
            if (b.type === 'BUFF_STAT_ALL_STAT' || b.type === 'BUFF_ALL_STAT' || b.type === 'BUFF_STAT_ALL') val *= bVal;
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
                // ⭐ [음유시인 기획 반영] 생명의 축가 (턴당 HP 회복)
                const hpChant = buffs.find(b => b.type === 'BUFF_CHANNELED_REGEN_HP');
                if (hpChant) val += parseFloat(hpChant.val) || 10;
            }
            break;

        case 'mp_regen':
            val = 3 + (int * 0.5); 
            if(!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_MANA');
                if (buffs.some(b => b.type === 'HEAL_MP')) val += 5;
                // ⭐ [음유시인 기획 반영] 코스모스의 아리아 (턴당 MP 회복)
                const mpChant = buffs.find(b => b.type === 'BUFF_CHANNELED_REGEN_MP');
                if (mpChant) val += parseFloat(mpChant.val) || 10;
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
                    // ⭐ [음유시인 기획 반영] 찬가 (강철의 합창, 왕의 찬가)
                    if (b.type === 'BUFF_CHANNELED_ATK' || b.type === 'BUFF_CHANNELED_ALL_ATK') val *= parseFloat(b.val) || 1.2;
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
                    // ⭐ [음유시인 기획 반영] 찬가 (왕의 찬가 마공 포함)
                    if (b.type === 'BUFF_CHANNELED_ALL_ATK') val *= parseFloat(b.val) || 1.15;
                });
            }
            break;

        case 'def':      
            val = ((vit * 0.5) + (str * 0.2) + getStat(unit, 'def', excludeBuffs));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_DEF', 'BUFF_DEF');
                if (buffs.some(b => b.type === 'DEF_PROTECT')) val *= 1.3;
                buffs.forEach(b => {
                    const bNorm = (activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type;
                    if (b.type === 'BUFF_STAT_DEF') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_DEF') val *= parseFloat(b.val) || 0.8;
                    // ⭐ [음유시인 기획 반영] 찬가 (성벽의 제창)
                    if (b.type === 'BUFF_CHANNELED_DEF') val *= parseFloat(b.val) || 1.2;
                    // ⭐ [무희 기획 반영] 새벽의 기도 (물방/마방 동시 보정)
                    if (b.type === 'BUFF_CHANNELED_ALL_DEF') val *= parseFloat(b.val) || 1.15;
                    // ⭐ 수면 시 방어력 50% 반감 (정규화 적용)
                    if (bNorm === 'STAT_SLEEP') val *= 0.5; 
                });
            }
            break;

        case 'res':      
            val = ((int * 0.5) + (vit * 0.2));
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
                
                // ⭐ [기획 반영] 마법 도금: 방패의 물리 방어력의 50%만큼 MDEF 증가
                const shieldMdefPassive = (unit.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_SHIELD_MDEF'));
                if (shieldMdefPassive && unit.equipment && unit.equipment.offHand) {
                    const shield = ITEM_DATA[unit.equipment.offHand];
                    if (shield && shield.type === 'SHIELD') {
                        val += Math.floor((shield.val || 0) * 0.5);
                    }
                }
                
                buffs.forEach(b => {
                    const bNorm = (activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type;
                    if (b.type === 'BUFF_STAT_MDEF') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_MDEF') val *= parseFloat(b.val) || 0.8;
                    // ⭐ [무희 기획 반영] 새벽의 기도 (물방/마방 동시 보정)
                    if (b.type === 'BUFF_CHANNELED_ALL_DEF') val *= parseFloat(b.val) || 1.15;
                    // ⭐ 수면 시 마법 방어력도 50% 반감 (정규화 적용)
                    if (bNorm === 'STAT_SLEEP') val *= 0.5; 
                });
            }
            break;

        case 'hit_phys': 
        case 'hit_mag':
            val = 90 + (dex * 1.5) + (luk * 0.2);
            if (!excludeBuffs) {
                // ⭐ [버그 원인 3 완벽 해결] 패시브 명중률 보정(1.2배 등)은 덧셈이 아니라 곱셈(getMult)입니다!
                val *= getMult(unit, 'PASSIVE_ACC');
                if (getAdd(unit, 'PASSIVE_SUREHIT') > 0) val += 999; 
                
                // ⭐ 실명 시 명중률 반감 (정규화 적용)
                if (buffs.some(b => ((activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type) === 'STAT_BLIND')) {
                    val *= 0.5;
                }
                
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_ACC') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_ACC') val *= parseFloat(b.val) || 0.8;
                    if (b.type === 'BUFF_CHANNELED_ACC') val *= parseFloat(b.val) || 1.2;
                });
            }
            break;

        case 'crit':     
            val = (luk * 1.0) + (dex * 0.5);
            if (!excludeBuffs) {
                // ⭐ 크리티컬 패시브 곱연산 적용
                val *= getMult(unit, 'PASSIVE_CRIT');
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_CRIT') val *= parseFloat(b.val) || 1.3;
                    if (b.type === 'DEBUFF_STAT_CRIT') val *= parseFloat(b.val) || 0.7;
                    if (b.type === 'BUFF_CHANNELED_CRIT') val *= parseFloat(b.val) || 1.3;
                });
            }
            break;

        case 'eva':      
            val = (agi * 1.5) + (luk * 0.5);
            // ⭐ 기동 불가 상태이상 시 회피율 0 고정 (정규화 적용)
            if (!excludeBuffs && buffs.some(b => {
                const bType = (activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type;
                return ['STAT_SLEEP', 'STAT_STUN', 'STAT_FREEZE', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_PARALYSIS', 'STAT_PETRIFY'].includes(bType);
            })) return 0;
            
            if (!excludeBuffs) {
                // ⭐ 회피율 패시브 곱연산 적용
                val *= getMult(unit, 'PASSIVE_EVA');
                val += getAdd(unit, 'PASSIVE_EVA_BOOST');
                if (buffs.some(b => b.type === 'STEALTH')) val += 50;
                
                // ⭐ 실명 시 회피율 반감 (정규화 적용)
                if (buffs.some(b => ((activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type) === 'STAT_BLIND')) {
                    val *= 0.5;
                }
                
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_EVA') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_EVA') val *= parseFloat(b.val) || 0.8;
                    if (b.type === 'BUFF_CHANNELED_EVA') val *= parseFloat(b.val) || 1.2;
                });
            }
            break;

        case 'tenacity': 
            val = (vit * 1.0) + (luk * 0.5); 
            if(!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
                // ⭐ 버그 수정: BUFF_CHANNELED_RESIST 검색 조건 정상화 (정령들의 춤사위 연동)
                if (buffs.some(b => b.type === 'BUFF_CHANNELED_RESIST')) {
                    const resistBuff = buffs.find(b => b.type === 'BUFF_CHANNELED_RESIST');
                    if (resistBuff) val *= parseFloat(resistBuff.val) || 1.5;
                }
            }
            break;

        case 'hp_max':    
            // ⭐ [기획 반영] VIT/STR이 안 올라도, 레벨당 고정적으로 +10씩 무조건 상승
            val = 50 + (unit.baseHp || 0) + ((unit.level || 1) * 10) + (vit * 10) + (str * 2);
            if(!excludeBuffs) val += getAdd(unit, 'PASSIVE_SURVIVE') * 10;
            break;

        case 'mp_max':    
            // ⭐ [기획 반영] INT/VOL이 안 올라도, 레벨당 고정적으로 +5씩 무조건 상승
            val = (unit.baseMp || 0) + ((unit.level || 1) * 5) + (int * 5) + (vol * 2); 
            // ⭐ [마법사 기획 반영] 마법사의 자질 (최대 MP % 증가) 정상 연동
            if(!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_MANA', 'BUFF_MAXMP');
            }
            break;

        case 'spd':     
            val = 70 + (Number(unit.agi) || 10) + ((Number(unit.int) || 10) * 0.5);
            if (!excludeBuffs) {
                val *= getMult(unit, 'PASSIVE_SPD', 'BUFF_SPD');
                buffs.forEach(b => {
                    if (b.type === 'BUFF_STAT_SPD') val *= parseFloat(b.val) || 1.2;
                    if (b.type === 'DEBUFF_STAT_SPD') val *= parseFloat(b.val) || 0.8;
                    // ⭐ 여기에 추가! (신화의 서장 - 턴 속도 보정)
                    if (b.type === 'BUFF_STAT_WT_REGEN' || b.type === 'BUFF_STAT_WT_RECOV') val *= parseFloat(b.val) || 1.3;
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
                        // ⭐ [무희 기획 반영] 바람의 이야기 (이동력 보정)
                        if (b.type === 'BUFF_CHANNELED_MOVE') val += parseFloat(b.val) || 1;

                        // ⭐ [기획 반영] 개문: 지속시간 중 이동력 +1, 페널티 중 이동력 -1
                        if (b.type === 'BUFF_INNER_GATE') val += 1;
                        if (b.type === 'DEBUFF_INNER_GATE_PENALTY') val -= 1;
                    });
                }
                
                if (buffs.some(b => b.type === 'MOVE_FREE')) val += 2;                
                // ⭐ 중력(Gravity) 페널티 (정규화 적용)
                if (buffs.some(b => ((activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type) === 'STAT_GRAVITY' || b.type === 'DEBUFF_GROUNDED')) val -= 2;
                
                // ⭐ 이동 불가 상태이상들 (정규화 적용)
                if (buffs.some(b => {
                    const bNorm = (activeBattle && activeBattle.statusManager) ? activeBattle.statusManager.normalizeAilment(b.type) : b.type;
                    return ['STAT_PARALYSIS', 'STAT_STUN', 'STAT_SLEEP', 'STAT_BIND', 'STAT_FREEZE', 'STAT_PETRIFY'].includes(bNorm);
                })) {
                    return 0;
                }
            }
            break;
        case 'jump':
            val = unit.jump || 1;
            if (!excludeBuffs) {
                val += getAdd(unit, 'PASSIVE_JUMP', 'BUFF_JUMP'); // ⭐ getSum을 getAdd로 통일 및 오류 방지
                // ⭐ [무희 기획 반영] 바람의 이야기 (점프력 보정)
                if (buffs && buffs.some(b => b.type === 'BUFF_CHANNELED_JUMP')) {
                    val += parseFloat(buffs.find(b => b.type === 'BUFF_CHANNELED_JUMP').val) || 1;
                }
            }
            return val;
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
                
                // ⭐ [신규] 맵 전체 사거리화 (글로벌 레인지) 패시브 적용
                const hasGlobalRange = (unit.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_GLOBAL_RANGE'));
                if (hasGlobalRange) {
                    val = 999; 
                }

                // ⭐ [음유시인 기획 반영] 천상의 공명 (PAS_RANGE_CHANT_EXTEND)
                // 영창 스킬 사용 시 범위 1.5배 (사거리 스탯으로 반환 시 배율 적용)
                const resonance = (unit.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RANGE_CHANT_EXTEND'));
                if (resonance) {
                    const extMult = parseFloat(resonance.effects.find(e => e.type === 'PAS_RANGE_CHANT_EXTEND').val) || 1.5;
                    val = Math.floor(val * extMult);
                }
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
                        // ⭐ [신규 반영] 투혼 등 조건부 패시브(HP 50% 이하 등) 작동을 위해 checkPassiveCondition 판별 추가
                        const mainEff = s.effects[0];
                        if (mainEff && mainEff.type.startsWith('PAS_') && s.effects.length > 1) {
                            if (!checkPassiveCondition(unit, mainEff, null)) return;
                        }

                        s.effects.forEach(e => {
                            // ⭐ [버그 수정] 마나 감소 패시브(PAS_COST_RED)가 행동력(WT)을 감소시키던 오류 해결
                            if (['PAS_WT_REDUCE', 'PAS_WT_REDUCTION_SUP'].includes(e.type)) {                                
                                let v = parseFloat(e.val);
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
                    // ⭐ [신규 반영] 강제 취소 시 부여되는 BUFF_WT_REDUCTION 인식 추가
                    if (['BUFF_FAST', 'BUFF_HASTE', 'STAT_FAST', 'SPEED_UP', 'BUFF_WT_REDUCTION'].includes(b.type)) {
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
// 4. 명중률 계산 공식 (급소 찌르기 등 페널티 적용)
// ==========================================
export function getHitChance(atkUnit, defUnit, type = 'PHYS', options = {}) {
    const isMag = type.includes('MAG') || ['LIGHTNING', 'FIRE', 'ICE', 'WIND', 'EARTH', 'HOLY', 'DARK'].includes(type);
    let hitStat = getDerivedStat(atkUnit, isMag ? 'hit_mag' : 'hit_phys');
    let evaStat = getDerivedStat(defUnit, 'eva');
    
    let skillAcc = 100;
    // ⭐ [도적 기획 반영] 급소 찌르기 등 명중률 페널티/보너스 적용
    if (options.skill && options.skill.effects) {
        const accPen = options.skill.effects.find(e => e.type === 'ATK_ACC_PENALTY');
        if (accPen) skillAcc += parseFloat(accPen.val) || -50;
    }

    // ⭐ [마법사 기획 반영] 영창 집중 (이동하지 않고 제자리에서 마법 시전 시 명중률 20% 보정)
    if (options.skill && isMag && typeof activeBattle !== 'undefined' && activeBattle && !activeBattle.actions.moved) {
        const focusPassive = (atkUnit.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_COND_HOLD'));
        if (focusPassive) {
            const accBonusEff = focusPassive.effects.find(e => e.type === 'PAS_STAT_ACC');
            if (accBonusEff) {
                // val이 1.2로 설정되어 있으므로 20% 환산하여 더함
                skillAcc += (parseFloat(accBonusEff.val) - 1.0) * 100; 
            }
        }
    }

    const grid = typeof activeBattle !== 'undefined' && activeBattle ? activeBattle.grid : null;
    // ⭐ [궁수 기획 반영] 위장 (PAS_RANGE_EVA) : 풀밭, 숲 지형에서 원거리 공격 피격 시 회피율 30% 보정
    const isRangedAttacker = (options.skill && (parseInt(options.skill.rng) > 1 || options.skill.atkType === 'RANGED')) || (!options.skill && getDerivedStat(atkUnit, 'rng') > 1);
    if (isRangedAttacker && grid) {
        const camoPassive = (defUnit.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RANGE_EVA'));
        if (camoPassive) {
            const tData = grid.getTerrainData(defUnit.q, defUnit.r);
            const tKey = String(tData ? tData.key : '').toUpperCase();
            if (tKey.includes('BUSH') || tKey.includes('FOREST') || tKey.includes('GRASS')) {
                const evaMult = parseFloat(camoPassive.effects.find(e => e.type === 'PAS_RANGE_EVA').val) || 1.3;
                evaStat = Math.floor(evaStat * evaMult);
            }
        }
    }

    let rate = hitStat - evaStat + skillAcc + (options.accBonus || 0);

    if (grid) {
        const tData = grid.getTerrainData(defUnit.q, defUnit.r);
        if (tData && tData.key === 'FOREST') rate -= 20; 
        if (tData && tData.key === 'MOUNTAIN') rate -= 30; 
        if (tData && tData.key === 'WATER') rate += 10; 
        
        const dir = grid.getDirection(defUnit, atkUnit);
        const diff = Math.abs(defUnit.facing - dir);
        if (diff === 3) rate += 30; 
        else if (diff === 2 || diff === 4) rate += 15;
    }

    const equippedIds = atkUnit.equippedSkills || [];
    const activeSkills = (atkUnit.skills || []).filter(s => equippedIds.includes(s.id) || (s.category && equippedIds.includes(`CAT_${s.category}`)));

    if (activeSkills.some(s => s.effects && s.effects.some(e => e.type === 'ATK_SNIPE'))) {
        const snipeEff = activeSkills.find(s => s.effects.some(e => e.type === 'ATK_SNIPE')).effects.find(e => e.type === 'ATK_SNIPE');
        const maxRng = options.maxRng || 6;
        const dist = grid ? grid.getDistance(atkUnit, defUnit) : 1;
        const ratio = Math.min(1.0, dist / maxRng);
        rate -= parseFloat(snipeEff.val) * ratio; 
    }

    if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'BUFF_BREATH_REGULATION')) {
        return 100;
    }

    const celestial = defUnit.buffs && defUnit.buffs.find(b => b.type === 'BUFF_CELESTIAL_REVERSAL');
    if (celestial && (type === 'PHYS' || type === 'DMG_PHYS') && grid && grid.getDistance(atkUnit, defUnit) <= 1) {
        const hitDir = grid.getDirection(defUnit, atkUnit);
        const diff = (hitDir - defUnit.facing + 6) % 6;
        let celestialEvaRate = 0.5; 
        if (diff === 1 || diff === 5 || diff === 2 || diff === 4) celestialEvaRate = 0.3; 
        if (diff === 3) celestialEvaRate = 0.2; 
        
        const rawHitChance = 100 - (celestialEvaRate * 100);
        return Math.min(rate, rawHitChance); 
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
            let atkH = grid.getTerrainData(atkUnit.q, atkUnit.r).h || 0;
            const defH = grid.getTerrainData(defUnit.q, defUnit.r).h || 0;
            
            // ⭐ [마법사 기획 반영] 암석 낙하, 유성우 등 (DROP 타입 마법은 시전자보다 4단계 높은 곳에서 떨어짐)
            if (options.skill && (options.skill.castType === 'DROP' || options.skill.cast_type === 'DROP')) {
                atkH += 4; 
            }
            
            const heightDiff = atkH - defH;
            
            if (heightDiff > 0) {
                // ⭐ [궁수 기획 반영] 바람의 권위: 고저차 보너스 효과 30% 보정 (1.3배)
                const highGroundMult = getMult(atkUnit, 'PAS_HIGHGROUND_BONUS');
                const maxBonus = 0.3 * highGroundMult;
                const multBonus = Math.min(maxBonus, heightDiff * 0.05 * highGroundMult);
                baseAtk *= (1.0 + multBonus);
            } else if (heightDiff < 0) {
                // 저지대 페널티 (1단차당 5% 감소, 최대 30% 감소)
                baseAtk *= Math.max(0.7, 1.0 + (heightDiff * 0.05)); 
            }
        }
    if (grid && !isFixed) {
        const terrainMatchPassive = (atkUnit.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DMG_TERRAIN_MATCH'));
        if (terrainMatchPassive) {
            const tData = grid.getTerrainData(atkUnit.q, atkUnit.r);
            const tKey = String(tData ? tData.key : '').toUpperCase();
            
            let isMatched = false;
            let skillElem = atkUnit.element || 'NONE';
            if (dmgType === 'DMG_FIRE') skillElem = 'FIRE';
            else if (dmgType === 'DMG_ICE') skillElem = 'ICE';
            else if (dmgType === 'DMG_LIGHTNING') skillElem = 'LIGHTNING';
            else if (dmgType === 'DMG_HOLY' || dmgType === 'HOLY') skillElem = 'LIGHT';
            else if (dmgType === 'DMG_DARK' || dmgType === 'DARK') skillElem = 'DARK';
            else if (dmgType === 'DMG_EARTH') skillElem = 'EARTH';
            else if (dmgType === 'DMG_WIND') skillElem = 'WIND';

            if (skillElem === 'FIRE' && (tKey.includes('VOLCANO') || tKey.includes('LAVA'))) isMatched = true;
            if (skillElem === 'ICE' && (tKey.includes('ICE') || tKey.includes('SNOW'))) isMatched = true;
            if (skillElem === 'WIND' && (tKey.includes('UPDRAFT') || tKey.includes('SKY'))) isMatched = true;
            if (skillElem === 'EARTH' && (tKey.includes('MOUNTAIN') || tKey.includes('ROCK') || tKey.includes('SAND'))) isMatched = true;
            if ((skillElem === 'WATER' || skillElem === 'ICE') && (tKey.includes('WATER') || tKey.includes('RIVER'))) isMatched = true;
            
            if (isMatched) {
                const bonusMult = parseFloat(terrainMatchPassive.effects.find(e => e.type === 'PAS_DMG_TERRAIN_MATCH').val) || 1.2;
                baseAtk *= bonusMult;
            }
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
        
        // ⭐ [기획 반영] 절대 방어, 최후의 보루 시 방향 페널티 무시
        const isAbsolute = defUnit.buffs && defUnit.buffs.some(b => ['BUFF_ABSOLUTE_GUARD', 'BUFF_LAST_BASTION'].includes(b.type));
        if (isAbsolute || options.forceFrontal) {
            defModifier = 1.0;
            evaModifier = 1.0;
            if (hitContext === "BACKSTAB" || hitContext === "FLANK") hitContext = "NORMAL";
        }
        
        // ⭐ [기획 반영] 방패 막기 (정면/측면 피격 시 30% 확률로 데미지 30% 추가 경감)
        if (hitContext === "NORMAL" || hitContext === "FLANK") {
            const shieldBlock = (defUnit.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_SHIELD_BLOCK'));
            if (shieldBlock && (dmgType === 'PHYS' || dmgType === 'DMG_PHYS')) {
                const prob = parseFloat(shieldBlock.effects.find(e => e.type === 'PAS_SHIELD_BLOCK').prob) || 30;
                if (Math.random() * 100 <= prob) {
                    appliedMult *= 0.7; // 데미지 30% 추가 경감
                    if (typeof activeBattle !== 'undefined' && activeBattle) activeBattle.showFloatingText(defUnit, "방패 막기", "#ddd");
                }
            }
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

         // ⭐ [기획 반영] 방어력 무시 연산 (CombatManager에서 넘겨준 ignoreDefPct 적용)
         if (options && options.ignoreDefPct) {
             defense = Math.max(0, defense * (1 - options.ignoreDefPct));
         }

         // ⭐ [신규] 수면 상태일 경우 방어력 반감 (-50%)으로 뼈아프게 맞음
         if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'STAT_SLEEP')) {
             defense = Math.floor(defense * 0.5);
         }

         let pen = (options.penetrate || 0) + getAdd(atkUnit, 'PASSIVE_PENETRATE');
         if (options.tags && options.tags.includes('ATK_PENETRATE')) pen += 0.3;
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

        // ⭐ [신규] 데미지 경감(Damage Reduction) 처리 로직
        let dmgReducePct = 0;
        
        // 1. 패시브를 통한 데미지 경감 합산
        dmgReducePct += getAdd(defUnit, 'PAS_DMG_REDUCE_ALL');
        if (dmgType === 'PHYS' || dmgType === 'DMG_PHYS') {
            dmgReducePct += getAdd(defUnit, 'PAS_DMG_REDUCE_PHYS');
        } else if (magicTypes.includes(dmgType)) {
            dmgReducePct += getAdd(defUnit, 'PAS_DMG_REDUCE_MAG');
        }

        // 2. 버프를 통한 데미지 경감 합산
        // 2. 버프를 통한 데미지 경감 합산
        if (defUnit.buffs) {
            defUnit.buffs.forEach(b => {
                if (b.type === 'BUFF_DMG_REDUCE_ALL') dmgReducePct += parseFloat(b.val) || 0;
                if (b.type === 'BUFF_DMG_REDUCE_PHYS' && (dmgType === 'PHYS' || dmgType === 'DMG_PHYS')) dmgReducePct += parseFloat(b.val) || 0;
                if (b.type === 'BUFF_DMG_REDUCE_MAG' && magicTypes.includes(dmgType)) dmgReducePct += parseFloat(b.val) || 0;
                if (b.type === 'BUFF_ABSOLUTE_GUARD') dmgReducePct += 0.5; // 절대 방어
                if (b.type === 'BUFF_LAST_BASTION') dmgReducePct += 0.7; // 최후의 보루
                // 방패 반사: 원거리 데미지 70% 경감
                if (b.type === 'BUFF_REFLECT_RANGED' && (dmgType === 'PHYS' || dmgType === 'DMG_PHYS') && grid && grid.getDistance(atkUnit, defUnit) > 1) {
                    dmgReducePct += 0.7;
                }
                // ⭐ [기획 반영] 운기조식: 무방비 상태로 피격 데미지 20% 페널티 상승
                if (b.type === 'BUFF_BREATH_REGULATION') dmgReducePct -= 0.2; 
            });
        }
        
        // ⭐ [기획 반영] 무투가 패시브 방어 (호신강기 및 주작의 홍은)
        if (defUnit.skills) {
            const auraProt = defUnit.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DMG_REDUCE_MP'));
            if (auraProt && (defUnit.curMp / (defUnit.mp || 1)) >= 0.2 && (dmgType === 'PHYS' || dmgType === 'DMG_PHYS')) {
                dmgReducePct += parseFloat(auraProt.effects.find(e => e.type === 'PAS_DMG_REDUCE_MP').val) || 0.2;
            }
            const vermilion = defUnit.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RESIST_FIRE'));
            if (vermilion && (skillElement === 'FIRE' || dmgType === 'DMG_FIRE')) {
                dmgReducePct += 0.3; // 화속성 30% 경감
            }
        }

        // 최대 80% 까지만 경감되도록 상한선(Cap) 설정 (무적 방지)
        dmgReducePct = Math.min(0.80, Math.max(0, dmgReducePct));

        if (dmgReducePct > 0) {
            finalDmg *= (1.0 - dmgReducePct);
        }
    }

    let isCrit = false;
    // ⭐ [도적 기획 반영] 급소 찌르기 확정 크리티컬 (options.forceCrit) 추가
    if (hitContext === "EXECUTE" || options.forceCrit) isCrit = true; 
    
    if (!isFixed) {
        let critRate = getDerivedStat(atkUnit, 'crit');
        if (hitContext === "BACKSTAB") critRate += 30;
        if (defUnit.buffs && defUnit.buffs.some(b => b.type === 'CC_SLEEP')) critRate = 100;
        
        if (isCrit || Math.random() * 100 < critRate) {
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
        originalDmg: Math.floor(rawDmg * appliedMult), // ⭐ 강철의 가시덩굴 반사용 원본 데미지 보존
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
// =====================================================================
// ⭐ [신규] 7단계 스탯 성장 등급 매핑 (Stat Fingerprints)
// =====================================================================
export const CLASS_STAT_TIERS = {
    'WARRIOR':   { str: 'S', vit: 'A', dex: 'B', agi: 'C', vol: 'D', luk: 'E', int: 'F' },
    'KNIGHT':    { vit: 'S', str: 'A', dex: 'B', luk: 'C', vol: 'D', int: 'E', agi: 'F' },
    'MARTIAL ARTIST':      { agi: 'S', str: 'A', dex: 'B', luk: 'C', vol: 'D', vit: 'E', int: 'F' },
    'THIEF':     { luk: 'S', agi: 'A', vol: 'B', dex: 'C', str: 'D', int: 'E', vit: 'F' },
    'ARCHER':    { dex: 'S', str: 'A', agi: 'B', luk: 'C', vit: 'D', int: 'E', vol: 'F' },
    'SORCERER':  { int: 'S', vol: 'A', luk: 'B', dex: 'C', agi: 'D', vit: 'E', str: 'F' },
    'CLERIC':    { int: 'S', vit: 'A', dex: 'B', luk: 'C', agi: 'D', vol: 'E', str: 'F' },
    'BARD':      { vol: 'S', int: 'A', luk: 'B', agi: 'C', vit: 'D', dex: 'E', str: 'F' },
    'DANCER':    { agi: 'S', vol: 'A', luk: 'B', dex: 'C', int: 'D', str: 'E', vit: 'F' },
    'ALCHEMIST': { dex: 'S', int: 'A', vol: 'B', vit: 'C', luk: 'D', agi: 'E', str: 'F' }
};

// 7단계 성장 난수 폭 테이블 (최소합 5.0 / 최대합 7.0 고정)
export const TIER_VALUES = {
    'S': { base: 1.5, rngMax: 0.4 }, // 1.5 ~ 1.9
    'A': { base: 1.1, rngMax: 0.4 }, // 1.1 ~ 1.5
    'B': { base: 0.8, rngMax: 0.3 }, // 0.8 ~ 1.1
    'C': { base: 0.6, rngMax: 0.3 }, // 0.6 ~ 0.9
    'D': { base: 0.5, rngMax: 0.2 }, // 0.5 ~ 0.7
    'E': { base: 0.3, rngMax: 0.2 }, // 0.3 ~ 0.5
    'F': { base: 0.2, rngMax: 0.2 }  // 0.2 ~ 0.4
};

/**
 * ⭐ 유닛 레벨업 처리 함수 (은닉 소수점 누적 시스템)
 * @param {Object} unit - 레벨업 할 유닛 데이터 객체
 * @returns {Object} increases - 화면 UI에 뿌려줄 [정수 상승량] 데이터
 */
export function processLevelUp(unit) {
    const jobKey = unit.classKey || unit.id || 'WARRIOR';
    const tiers = CLASS_STAT_TIERS[jobKey] || CLASS_STAT_TIERS['WARRIOR'];
    
    const safeParse = (val) => {
        let n = parseInt(val);
        return isNaN(n) ? 10 : n; 
    };

    if (!unit.floatStats || isNaN(unit.floatStats.str)) {
        unit.floatStats = {
            str: safeParse(unit.str), int: safeParse(unit.int), vit: safeParse(unit.vit), 
            agi: safeParse(unit.agi), dex: safeParse(unit.dex), vol: safeParse(unit.vol), luk: safeParse(unit.luk)
        };
    }

    const increases = { str: 0, int: 0, vit: 0, agi: 0, dex: 0, vol: 0, luk: 0 };
    const stats = ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'];

    stats.forEach(stat => {
        const tier = tiers[stat] || 'C'; 
        const { base, rngMax } = TIER_VALUES[tier] || TIER_VALUES['C'];
        
        const growth = base + (Math.random() * rngMax);
        
        const oldIntStat = Math.floor(unit.floatStats[stat]);
        unit.floatStats[stat] += growth;
        const newIntStat = Math.floor(unit.floatStats[stat]);
        
        const diff = newIntStat - oldIntStat;
        
        unit[stat] = safeParse(unit[stat]) + diff; 
        increases[stat] = diff;
    });

    // 레벨 1 증가
    unit.level = safeParse(unit.level) + 1;

    // =======================================================================
    // ⭐ [핵심 버그 수정] 하드코딩된 열화판 공식을 버리고, 
    // 패시브와 보너스가 완벽하게 적용되는 엔진 정식 계산기(getDerivedStat)를 직접 호출합니다!
    // =======================================================================
    const newMaxHp = getDerivedStat(unit, 'hp_max');
    const newMaxMp = getDerivedStat(unit, 'mp_max');
    
    // 공식 기준치 동기화
    unit.hp = newMaxHp;
    unit.mp = newMaxMp;

    // 체력/마나는 최대치의 20%만큼만 회복
    const healHp = Math.floor(newMaxHp * 0.20);
    const healMp = Math.floor(newMaxMp * 0.20);
    
    unit.curHp = Math.min(newMaxHp, safeParse(unit.curHp) + healHp);
    unit.curMp = Math.min(newMaxMp, safeParse(unit.curMp) + healMp);

    return increases; 
}