import { ITEM_DATA, ELEMENTS, EFFECTS } from '../data/index.js';

// 상단에 티어별 요구 레벨 정의 추가 (또는 데이터에서 가져오기)
const TIER_LEVELS = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 15 };

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
    if (unit.buffs && buffType) {
        unit.buffs.forEach(b => {
            const val = b.val !== undefined ? b.val : (b.mult !== undefined ? b.mult : 1.0);
            if (b.type === buffType) mult += (val - 1.0);
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

export function getStat(unit, stat, excludeBuffs = false) {
    let val = Number(unit[stat]) || 0;
    if (unit.equipment) {
        Object.values(unit.equipment).forEach(itemId => {
            const item = ITEM_DATA[itemId];
            if (item && item.stat === stat) val += Number(item.val);
        });
    }
    if (!excludeBuffs && unit.buffs) {
        unit.buffs.forEach(b => { if (b.type === 'BUFF_ALL') val *= 1.2; });
    }
    if (stat === 'luk') val += getAdd(unit, 'PASSIVE_LUCK', 'BUFF_LUCK');
    return Math.floor(val);
}

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
            if(!excludeBuffs) val *= getMult(unit, 'PASSIVE_HEAL_POWER');
            break;

        case 'mp_regen':
            val = 3 + (int * 0.5); 
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
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_DEF', 'BUFF_DEF');
            break;
        case 'res':      
            val = ((int * 0.5) + (vit * 0.2));
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
            break;
        case 'hit_phys': 
        case 'hit_mag':
            val = 90 + (dex * 1.5) + (luk * 0.2);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_ACC', 'BUFF_ACC', 'DEBUFF_ACC');
            break;
        case 'crit':     
            val = (luk * 1.0) + (dex * 0.5);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_CRIT', 'BUFF_CRIT');
            break;
        case 'eva':      
            val = (agi * 1.5) + (luk * 0.5);
            if (!excludeBuffs) val += getAdd(unit, 'PASSIVE_EVA', 'BUFF_EVA', 'DEBUFF_EVA');
            break;
        case 'tenacity': 
            val = (vit * 1.0) + (luk * 0.5); 
            if(!excludeBuffs) val += getAdd(unit, 'PASSIVE_RESIST', 'BUFF_RESIST');
            break;
        case 'hp_max':   
            val = 50 + (unit.baseHp || 0) + (vit * 10) + (str * 2); 
            break;
        case 'mp_max':   
            val = (unit.baseMp || 0) + (int * 5); 
            if(!excludeBuffs) val += getAdd(unit, 'PASSIVE_MANA'); 
            break;
        case 'spd':      
            val = 70 + (Number(unit.agi) || 10) + ((Number(unit.int) || 10) * 0.5);
            if (!excludeBuffs) val *= getMult(unit, 'PASSIVE_SPD', 'BUFF_SPD');
            break;
        case 'mov': val = (unit.baseMov || 3); break; 
        case 'rng': val = getStat(unit, 'rng', excludeBuffs); break;
        case 'cost_red': 
            val = getMult(unit, 'PASSIVE_COST_RED'); 
            if (val < 0.1) val = 0.1;
            break;
    }
    
    // [수정 완료] 아래 부분 키워드 매칭 완료
    if (!excludeBuffs && unit.buffs) {
        unit.buffs.forEach(b => {
             if (b.type === 'DEBUFF_ATK' && type.startsWith('atk')) val *= 0.7;
             if (b.type === 'DEBUFF_DEF' && type === 'def') val *= 0.7;
             if (b.type === 'DEBUFF_SPD' && type === 'spd') val *= 0.7;
             if (b.type === 'DEBUFF_MAG' && type === 'res') val *= 0.7;
             
             if (b.type === 'DEBUFF_ACC' && type.startsWith('hit')) val -= 20;
             if (b.type === 'CC_BLIND' && type.startsWith('hit')) val -= 50; // BLIND -> CC_BLIND
             
             if (b.type === 'CC_ROOT' && type === 'mov') val = 0;   // ROOT -> CC_ROOT
             if (b.type === 'CC_FREEZE' && type === 'mov') val = 0; // FREEZE -> CC_FREEZE
             
             if (b.type === 'STATUS_BURN' && type === 'def') val *= 0.8; // BURN -> STATUS_BURN
        });
    }

    if (type.startsWith('atk')) {
        const weaponType = type === 'atk_phys' ? 'PHYS' : 'MAG';
        ['weapon', 'acc1', 'acc2'].forEach(slot => {
            const itemId = unit.equipment?.[slot];
            if(itemId && ITEM_DATA[itemId] && ITEM_DATA[itemId].type === 'WEAPON') {
                if (ITEM_DATA[itemId].atkType === weaponType) val += ITEM_DATA[itemId].val;
            }
        });
    }

    if (['crit', 'eva', 'hit_phys', 'hit_mag', 'tenacity'].includes(type)) return Math.max(0, val);
    if (type === 'cost_red') return val;
    return Math.floor(Math.max(0, val));
}

export function calculateDamage(atkUnit, defUnit, skillMult, dmgType, grid, options = {}) {
    if (!dmgType) dmgType = atkUnit.atkType || 'PHYS'; 

    // [수정 완료] 무적 체크 (DEF_INVINCIBLE로 통일)
    if (defUnit.buffs) {
        if (defUnit.buffs.some(b => b.type === 'DEF_INVINCIBLE')) {
            return { damage: 0, isMiss: false, text: "IMMUNE", hitContext: "NORMAL" };
        }
    }

    let baseAtk = 0;
    let hitRate = 0;
    
    const isMagic = ['MAG', 'HOLY', 'DARK'].includes(dmgType);
    
    if (isMagic) {
        baseAtk = getDerivedStat(atkUnit, 'atk_mag');
        hitRate = getDerivedStat(atkUnit, 'hit_mag');
    } else {
        baseAtk = getDerivedStat(atkUnit, 'atk_phys');
        hitRate = getDerivedStat(atkUnit, 'hit_phys');
    }

    if (options.defScaleBonus) {
        const defVal = getDerivedStat(atkUnit, 'def');
        baseAtk += defVal * options.defScaleBonus;
    }
    if (options.flatBonus) {
        baseAtk += options.flatBonus;
    }

    if (grid) {
        const dist = grid.getDistance(atkUnit, defUnit);
        const distBonus = getMult(atkUnit, 'PASSIVE_DIST_BONUS'); 
        if (distBonus > 1.0) {
            const bonusPerTile = distBonus - 1.0;
            baseAtk *= (1 + (dist * bonusPerTile));
        }
    }

    if (options.execute) {
        const hpPct = defUnit.curHp / defUnit.hp;
        if (hpPct <= options.execute && defUnit.team === 1) {
            return { damage: defUnit.curHp, isCrit: true, text: "EXECUTE!", hitContext: "EXECUTE" };
        }
    }

    const vol = getStat(atkUnit, 'vol');
    const minMult = 0.9; 
    const maxMult = 1.0 + (vol * 0.05);
    let rawDmg = Math.random() * (baseAtk * maxMult - baseAtk * minMult) + baseAtk * minMult;

    let defModifier = 1.0;
    let evaModifier = 1.0;
    let hitContext = "NORMAL";

    if (grid) {
        const hitDir = grid.getDirection(defUnit, atkUnit);
        const facing = defUnit.facing || 0;
        const diff = (hitDir - facing + 6) % 6;

        switch (diff) {
            case 3: defModifier = 0.0; evaModifier = 0.0; hitContext = "BACKSTAB"; break;
            case 2: case 4: defModifier = 0.5; evaModifier = 0.5; hitContext = "FLANK"; break;
            case 1: case 5: defModifier = 0.8; hitContext = "FLANK"; break;
        }
    }

    const hasSureHit = options.sureHit || (getAdd(atkUnit, 'PASSIVE_SUREHIT') > 0);
    
    if (!hasSureHit && hitContext !== "BACKSTAB") {
        const evaRate = getDerivedStat(defUnit, 'eva') * evaModifier;
        const finalHitChance = hitRate - evaRate;
        if (Math.random() * 100 > finalHitChance) {
            return { damage: 0, isMiss: true, text: "MISS", hitContext };
        }
    }

    let defense = isMagic ? getDerivedStat(defUnit, 'res') : getDerivedStat(defUnit, 'def');
    defense *= defModifier;

    if (defUnit.buffs) {
        defUnit.buffs.forEach(b => {
            if (b.type === 'DEF_REDUCE') defense *= (1.0 - (b.val || 0.2));
        });
    }

    let pen = (options.penetrate || 0) + getAdd(atkUnit, 'PASSIVE_PENETRATE'); 
    if (pen > 0) defense *= (1 - Math.min(1, pen));

    let finalDmg = rawDmg * skillMult;
    
    finalDmg = finalDmg * (100 / (100 + Math.max(0, defense)));

    let eleMult = 1.0;
    let isWeak = false;
    let isResist = false;
    const atkEle = ELEMENTS[atkUnit.element || 'NONE'];
    if (atkEle.strong === defUnit.element) { eleMult = 1.3; isWeak = true; }
    else if (atkEle.weak === defUnit.element) { eleMult = 0.8; isResist = true; }
    finalDmg *= eleMult;

    let critRate = getDerivedStat(atkUnit, 'crit');
    if (hitContext === "BACKSTAB") critRate += 30;
    
    let isCrit = false;
    if (Math.random() * 100 < critRate) {
        let critDmgMult = 1.5 * getMult(atkUnit, 'PASSIVE_CRIT_DMG', 'BUFF_CRIT_DMG');
        finalDmg *= critDmgMult;
        isCrit = true;
    }

    let blockVal = getAdd(defUnit, 'PASSIVE_BLOCK', 'BUFF_BLOCK');
    if (blockVal > 0) {
        finalDmg *= (1.0 - Math.min(0.9, blockVal));
        hitContext = "BLOCK";
    }

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

    if (defUnit.buffs) {
        // [수정 완료] CURSE -> STATUS_CURSE
        if (defUnit.buffs.some(b => b.type === 'STATUS_CURSE')) finalDmg *= 1.2;
        if (defUnit.buffs.some(b => b.type === 'DEBUFF_VULNERABLE')) finalDmg *= 1.5;
    }

    return {
        damage: Math.max(1, Math.floor(finalDmg)),
        manaDmg: Math.floor(manaShieldDmg), 
        isCrit, isWeak, isResist, isCursed: false, isMiss: false, hitContext
    };
}