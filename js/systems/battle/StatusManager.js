import { EFFECTS } from '../../data/index.js';

export class StatusManager {
    constructor(battleSystem) {
        this.battle = battleSystem;

        // ==============================================================
        // 1. 상태이상 위계 (Tier) - 숫자가 클수록 상위 위계
        // ==============================================================
        this.TIERS = {
            'STAT_BLIND': 1, 'STAT_POISON': 2, 'STAT_BLEED': 3, 'STAT_GRAVITY': 4,
            'STAT_BIND': 5, 'STAT_SILENCE': 6, 'STAT_CURSE': 7, 'STAT_FEAR': 8,
            'STAT_DEMORALIZED': 9, 'STAT_SLEEP': 10, 'STAT_CONFUSION': 11, 'STAT_STUN': 12,
            'STAT_PARALYSIS': 13, 'STAT_CHARM': 14, 'STAT_BURN': 15, 'STAT_FREEZE': 16,
            'STAT_PETRIFY': 17, 'STAT_DEATH': 18
        };

        // ==============================================================
        // 2. 상태이상 고정 턴수 (스킬 데이터 무시)
        // ==============================================================
        this.BASE_DURATIONS = {
            'STAT_BLIND': 1, 'STAT_POISON': 2, 'STAT_BLEED': 3, 'STAT_GRAVITY': 2,
            'STAT_BIND': 1, 'STAT_SILENCE': 2, 'STAT_CURSE': 2, 'STAT_FEAR': 2,
            'STAT_DEMORALIZED': 2, 'STAT_SLEEP': 3, 'STAT_CONFUSION': 2, 'STAT_STUN': 1,
            'STAT_PARALYSIS': 2, 'STAT_CHARM': 2, 'STAT_BURN': 2, 'STAT_FREEZE': 2,
            'STAT_PETRIFY': 3
        };

        // ==============================================================
        // 3. 단방향 병행 가능 매트릭스 (기존 상태 기준, 새로 들어오는 것을 허용하는가?)
        // ==============================================================
        this.COMPATIBILITY = {
            'STAT_BLIND': ['STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_PARALYSIS', 'STAT_FREEZE'],
            'STAT_POISON': ['STAT_BLIND', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_CHARM'],
            'STAT_BLEED': ['STAT_BLIND', 'STAT_POISON', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_CHARM'],
            'STAT_GRAVITY': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE', 'STAT_CHARM'],
            'STAT_BIND': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE', 'STAT_CHARM'],
            'STAT_SILENCE': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE', 'STAT_CHARM'],
            'STAT_CURSE': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE', 'STAT_CHARM'],
            'STAT_FEAR': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE'],
            'STAT_DEMORALIZED': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE'],
            'STAT_SLEEP': ['STAT_POISON', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_PARALYSIS'],
            'STAT_CONFUSION': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_PARALYSIS', 'STAT_FREEZE'],
            'STAT_STUN': ['STAT_POISON', 'STAT_BLEED', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_PARALYSIS', 'STAT_FREEZE'],
            'STAT_PARALYSIS': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_SLEEP', 'STAT_FREEZE'],
            'STAT_CHARM': ['STAT_BLIND', 'STAT_POISON', 'STAT_BLEED', 'STAT_BURN', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_SLEEP', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_FREEZE'],
            'STAT_BURN': ['STAT_BLIND', 'STAT_POISON', 'STAT_GRAVITY', 'STAT_BIND', 'STAT_SILENCE', 'STAT_CURSE', 'STAT_FEAR', 'STAT_DEMORALIZED', 'STAT_CONFUSION', 'STAT_PARALYSIS'],
            // 기획서: 빙결 상태에서는 발화(상쇄), 석화(덮어씀) 외에 다른 상태이상 병행 불가
            'STAT_FREEZE': [], 
            'STAT_PETRIFY': [],
            'STAT_DEATH': []
        };

        // 4. 아이콘 및 이름 데이터
        this.iconMap = {
            'STAT_POISON': '☠️', 'STATUS_POISON': '☠️', 'POISON': '☠️',
            'STAT_PARALYSIS': '⚡', 'PARALYZE': '⚡', 
            'STAT_STUN': '💫', 'CC_STUN': '💫', 'STUN': '💫',
            'STAT_SLEEP': '💤', 'CC_SLEEP': '💤', 'SLEEP': '💤',
            'STAT_CONFUSION': '🌀', 'CC_CONFUSE': '🌀', 'AGGRO_CONFUSE': '❓',
            'STAT_BLIND': '🕶️', 'BLIND': '🕶️',
            'STAT_FEAR': '😱', 'CC_FEAR': '😱', 
            'STAT_CHARM': '💖', 'CC_CHARM': '💖', 'CC_PUPPET': '💖',
            'STAT_BIND': '🔗', 'CC_ROOT': '🔗', 
            'STAT_DEMORALIZED': '🏳️', 
            'STAT_CURSE': '👻', 'STATUS_CURSE': '👻', 'CURSE': '👻',
            'STAT_SILENCE': '😶', 'MUTE': '😶',
            'STAT_GRAVITY': '⚓', 'DEBUFF_GROUNDED': '⚓',
            'STAT_BURN': '🔥', 'STATUS_BURN': '🔥', 
            'STAT_FREEZE': '🧊', 'CC_FREEZE': '🧊', 
            'STAT_PETRIFY': '🗿', 'STONE': '🗿',
            'STAT_BLEED': '🩸', 'BLEED': '🩸',
            'CON_DEATH': '☠️', 'CC_POLYMORPH': '🐸',
            'AGGRO_TAUNT': '💢', 'DEBUFF_VULNERABLE': '💔',
            'STAT_STEALTH': '🥷', 'STEALTH': '🥷',
            'STAT_TAUNT': '💢', 'AGGRO_TAUNT': '💢', 'TAUNT': '💢', 
            'STAT_KNOCKBACK': '💥', 'KNOCKBACK': '💥', 'CC_KNOCKBACK': '💥',
            'BUFF_SHIELD': '💠', 'DEF_SHIELD': '💠', 'DEF_MANA_SHIELD': '💧',
            'BUFF_IMMUNE': '🛡️', 'DEF_INVINCIBLE': '⭐', 'DEF_PROTECT': '👼',
            'BUFF_REFLECT': '🪞', 'BUFF_COUNTER': '⚔️', 
            'HEAL_REGEN': '💖', 'HEAL_MP': '💙', 
            'BUFF_UNTARGETABLE': '👻', 'BUFF_PHASING': '💨',
            'MOVE_FREE': '🕊️', 'BUFF_DOUBLE_CAST': '⏩', 'BUFF_EXTENSION': '⏳',
            'DEF_STORE_DMG': '🔋', 'ECON_DISCOUNT': '🏷️', 'BUFF_ALL': '🌟', 'BUFF_ENCHANT': '✨',
            'BUFF_SYS_FREECAST': '🆓', 'BUFF_CASTING': '🎶',
            'BUFF_ATK': '🗡️⬆️', 'DEBUFF_ATK': '🗡️⬇️',
            'BUFF_DEF': '🛡️⬆️', 'DEBUFF_DEF': '🛡️⬇️',
            'BUFF_MATK': '🔮⬆️', 'DEBUFF_MATK': '🔮⬇️',
            'BUFF_MDEF': '🪞⬆️', 'DEBUFF_MDEF': '🪞⬇️',
            'BUFF_SPD': '💨⬆️', 'DEBUFF_SPD': '💨⬇️',
            'BUFF_ACC': '🎯⬆️', 'DEBUFF_ACC': '🎯⬇️',
            'BUFF_EVA': '🍃⬆️', 'DEBUFF_EVA': '🍃⬇️',
            'BUFF_CRIT': '💥⬆️', 'DEBUFF_CRIT': '💥⬇️',
            'BUFF_MOVE': '🥾⬆️', 'DEBUFF_MOVE': '🥾⬇️'
        };

        this.korNameMap = {
            'STAT_POISON': '중독', 'STATUS_POISON': '중독', 'POISON': '중독',
            'STAT_PARALYSIS': '마비', 'PARALYZE': '마비', 
            'STAT_STUN': '기절', 'CC_STUN': '기절', 'STUN': '기절',
            'STAT_SLEEP': '수면', 'CC_SLEEP': '수면', 'SLEEP': '수면',
            'STAT_CONFUSION': '혼란', 'CC_CONFUSE': '혼란', 'AGGRO_CONFUSE': '혼란',
            'STAT_BLIND': '실명', 'BLIND': '실명',
            'STAT_FEAR': '공포', 'CC_FEAR': '공포', 
            'STAT_CHARM': '매혹', 'CC_CHARM': '매혹', 'CC_PUPPET': '매혹',
            'STAT_BIND': '포박', 'CC_ROOT': '포박', 
            'STAT_DEMORALIZED': '전의 상실', 
            'STAT_CURSE': '저주', 'STATUS_CURSE': '저주', 'CURSE': '저주',
            'STAT_SILENCE': '침묵', 'MUTE': '침묵',
            'STAT_GRAVITY': '중력', 'DEBUFF_GROUNDED': '추락',
            'STAT_BURN': '발화', 'STATUS_BURN': '발화', 
            'STAT_FREEZE': '빙결', 'CC_FREEZE': '빙결', 
            'STAT_PETRIFY': '석화', 'STONE': '석화',
            'STAT_BLEED': '출혈', 'BLEED': '출혈',
            'CON_DEATH': '즉사', 'STAT_DEATH': '즉사', 'CC_POLYMORPH': '변이',
            'AGGRO_TAUNT': '도발', 'DEBUFF_VULNERABLE': '취약',
            'STAT_STEALTH': '은신', 'STEALTH': '은신',
            'STAT_TAUNT': '도발',
            'STAT_KNOCKBACK': '넉백', 'KNOCKBACK': '넉백', 'CC_KNOCKBACK': '넉백',
            'BUFF_SHIELD': '보호막', 'DEF_SHIELD': '보호막', 'DEF_MANA_SHIELD': '마나 쉴드',
            'BUFF_IMMUNE': '면역', 'DEF_INVINCIBLE': '무적', 'DEF_PROTECT': '보호',
            'BUFF_REFLECT': '반사', 'BUFF_COUNTER': '반격', 
            'HEAL_REGEN': '재생', 'HEAL_MP': '마력 회복', 
            'BUFF_UNTARGETABLE': '지정 불가', 'BUFF_PHASING': '위상 변화',
            'MOVE_FREE': '자유 이동', 'BUFF_DOUBLE_CAST': '이중 시전', 'BUFF_EXTENSION': '연장',
            'DEF_STORE_DMG': '피해 축적', 'ECON_DISCOUNT': '할인', 'BUFF_ALL': '올스탯 상승', 'BUFF_ENCHANT': '인챈트',
            'BUFF_SYS_FREECAST': '주문 기억', 'BUFF_CASTING': '집중'
        };
    }

    normalizeAilment(t) {
        const u = String(t).toUpperCase();
        if (u.includes('BLIND')) return 'STAT_BLIND';
        if (u.includes('POISON')) return 'STAT_POISON';
        if (u.includes('BLEED')) return 'STAT_BLEED';
        if (u.includes('GRAVITY') || u === 'DEBUFF_GROUNDED') return 'STAT_GRAVITY';
        if (u.includes('BIND') || u.includes('ROOT')) return 'STAT_BIND';
        if (u.includes('SILENCE') || u.includes('MUTE')) return 'STAT_SILENCE';
        if (u.includes('CURSE')) return 'STAT_CURSE';
        if (u.includes('FEAR')) return 'STAT_FEAR';
        if (u.includes('DEMORALIZED')) return 'STAT_DEMORALIZED';
        if (u.includes('SLEEP')) return 'STAT_SLEEP';
        if (u.includes('CONFUSE') || u.includes('CONFUSION')) return 'STAT_CONFUSION';
        if (u.includes('STUN')) return 'STAT_STUN';
        if (u.includes('PARALYZE') || u.includes('PARALYSIS')) return 'STAT_PARALYSIS';
        if (u.includes('CHARM') || u.includes('PUPPET')) return 'STAT_CHARM';
        if (u.includes('BURN')) return 'STAT_BURN';
        if (u.includes('FREEZE')) return 'STAT_FREEZE';
        if (u.includes('PETRIFY') || u.includes('STONE')) return 'STAT_PETRIFY';
        if (u.includes('DEATH')) return 'STAT_DEATH';
        if (u === 'BUFF_STAT_WT_RECOV') return 'BUFF_STAT_WT_REGEN';
        return u;
    }
    hasStatus(unit, type) {
        if (!unit || !unit.buffs) return false;
        const targetNorm = this.normalizeAilment(type); // 검사할 타입 정규화
        // 유닛이 가진 버프들도 전부 정규화하여 일치하는지 확인
        return unit.buffs.some(b => this.normalizeAilment(b.type) === targetNorm);
    }

    isIncapacitated(unit) {
    if (!unit || !unit.buffs) return false;
    return unit.buffs.some(b => {
        const norm = this.normalizeAilment(b.type);
        // 기획서 2-10, 12, 13, 16, 17에 근거한 행동 불가 리스트
        return ['STAT_STUN', 'STAT_FREEZE', 'STAT_SLEEP', 'STAT_PETRIFY', 'STAT_PARALYSIS'].includes(norm);
    });
}

    getControlState(unit) {
        if (!unit || !unit.buffs) return 'NORMAL';
        if (this.hasStatus(unit, 'STAT_CONFUSION')) return 'CONFUSION';
        if (this.hasStatus(unit, 'STAT_CHARM')) return 'CHARM';
        if (this.hasStatus(unit, 'STAT_DEMORALIZED')) return 'DEMORALIZED';
        return 'NORMAL';
    }

    isSilenced(unit) { return this.hasStatus(unit, 'STAT_SILENCE'); }
    isCursed(unit) { return this.hasStatus(unit, 'STAT_CURSE'); }
    isBleeding(unit) { return this.hasStatus(unit, 'STAT_BLEED'); }

    applyStatus(target, data, caster) {
        if (!target || target.type === 'OBJECT' || target.isWall || (target.key && target.key.includes('WALL'))) return;

        const battle = this.battle;
        let type = String(data.type).toUpperCase();

        // ⭐ [신규] 살로메 완벽 적용: RANDOM 키워드가 들어오면 타겟마다 즉시 무작위 상태이상으로 덮어씌움!
        // ⭐ [신규] 살로메 완벽 적용: RANDOM 키워드가 들어오면 확률(가중치)에 따라 무작위 상태이상 결정
        if (type.includes('RANDOM') && !type.includes('CHANNELED')) {
            const rand = Math.random() * 100;
            
            // 살로메(무희) 컨셉에 맞춰 누락되었던 '매혹'과 '수면' 추가 및 황금 밸런스 조정
            if (rand < 20) type = 'STAT_BLIND';           // 20% 확률: 실명
            else if (rand < 40) type = 'STAT_POISON';     // 20% 확률: 중독
            else if (rand < 55) type = 'STAT_SILENCE';    // 15% 확률: 침묵
            else if (rand < 70) type = 'STAT_SLEEP';      // 15% 확률: 수면 (신규 추가)
            else if (rand < 80) type = 'STAT_CHARM';      // 10% 확률: 매혹 (신규 추가 - 무희 핵심)
            else if (rand < 90) type = 'STAT_CONFUSION';  // 10% 확률: 혼란
            else if (rand < 96) type = 'STAT_STUN';       // 6% 확률: 기절
            else if (rand < 99) type = 'STAT_PETRIFY';    // 3% 확률: 석화
            else type = 'STAT_DEATH';                     // 1% 확률: 즉사 (대박 터짐)

            data.type = type;         
            data.silentFail = false;  // ⭐ 무음 플래그 해제! (이제 적들이 저항하면 당당하게 "저항!" 이라고 뜹니다)
        }

        const normType = this.normalizeAilment(type);
        const incomingTier = this.TIERS[normType] || 0;
        let info = EFFECTS[type];
        let isDebuff = type.includes('DEBUFF') || type.includes('DOWN') || type.includes('CC_') || ((type.includes('STAT_') || type.includes('STATUS_')) && !type.includes('BUFF'));
        if (type.includes('STEALTH') || type.includes('REGEN')) isDebuff = false;

        let finalIcon = data.icon || this.iconMap[normType] || this.iconMap[type] || (info && info.icon);
        
        // ⭐ [신규] 연주 및 안무(채널링) 중일 때는 무조건 음표 아이콘 출력
        if (type.startsWith('BUFF_CHANNELED') || type.startsWith('DEBUFF_CHANNELED')) {
            finalIcon = '🎶';
        } 
        else if (!finalIcon || finalIcon === '🔺' || finalIcon === '🔻') {
            if (type.includes('ATK') || type.includes('DMG')) finalIcon = isDebuff ? '🗡️⬇️' : '🗡️⬆️';
            else if (type.includes('DEF')) finalIcon = isDebuff ? '🛡️⬇️' : '🛡️⬆️';
            else if (type.includes('MAG') || type.includes('MATK') || type.includes('INT')) finalIcon = isDebuff ? '🔮⬇️' : '🔮⬆️';
            else if (type.includes('RES')) finalIcon = isDebuff ? '🪞⬇️' : '🪞⬆️';
            else if (type.includes('SPD') || type.includes('AGI')) finalIcon = isDebuff ? '💨⬇️' : '💨⬆️';
            else if (type.includes('ACC') || type.includes('HIT')) finalIcon = isDebuff ? '🎯⬇️' : '🎯⬆️';
            else if (type.includes('EVA') || type.includes('DODGE')) finalIcon = isDebuff ? '🍃⬇️' : '🍃⬆️';
            else if (type.includes('CRIT')) finalIcon = isDebuff ? '💥⬇️' : '💥⬆️';
            else if (type.includes('MOVE') || type.includes('MOV') || type.includes('JUMP')) finalIcon = isDebuff ? '🥾⬇️' : '🥾⬆️';
            else if (type.includes('HP')) finalIcon = isDebuff ? '💔' : '💖';
            else if (type.includes('MP')) finalIcon = isDebuff ? '💙⬇️' : '💙';
            else finalIcon = isDebuff ? '🔻' : '🔺';
        }

        let finalName = data.name || (info && info.name) || this.korNameMap[normType] || this.korNameMap[type];
        if (!finalName) {
            if (type === 'BUFF_STAT_ALL_STAT' || type === 'BUFF_ALL' || type === 'BUFF_ALL_STAT') finalName = "올스탯 상승";
            else if (type.startsWith('BUFF_CHANNELED') || type.startsWith('DEBUFF_CHANNELED')) finalName = "연주/집중";
            else finalName = type.replace('STAT_', '').replace('CC_', '').replace('DEBUFF_', '').replace('BUFF_', '').replace('STATUS_', '').replace('PAS_', '');
        }

        // ==============================================================
        // 1. [즉사 판정] (18위계)
        // ==============================================================
        if (normType === 'STAT_DEATH') {
            target.curHp = 0;
            battle.showFloatingText(target, "즉사!", "#8800ff");
            battle.log(`☠️ [즉사] 치명적인 일격! ${target.name}의 숨통이 끊어졌습니다!`, 'log-dmg');
            battle.triggerShakeAnimation(target);
            battle.handleDeath(target, caster);
            return;
        }

        // ==============================================================
        // 2. [CC 기믹 및 위계 룰 엔진] - 순수 상태이상(Tier가 있는 것)에만 적용
        // ==============================================================
        // ⭐ [신규] 골렘 및 무적 유닛을 위한 절대 면역 (디버프 차단)
        if (isDebuff) {
            const hasImmuneBuff = target.buffs.some(b => b.type === 'BUFF_IMMUNE' || b.type === 'DEF_INVINCIBLE');
            const hasImmunePassive = (target.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_IMMUNE_ALL'));
            
            if (hasImmuneBuff || hasImmunePassive) {
                battle.showFloatingText(target, "면역!", "#ffffff");
                battle.log(`🛡️ [절대 면역] ${target.name}에게는 상태이상이 통하지 않습니다!`, 'log-system');
                return;
            }
        }

        // ==============================================================
        // 2. [CC 기믹 및 위계 룰 엔진] - 순수 상태이상(Tier가 있는 것)에만 적용
        // ==============================================================
        if (incomingTier > 0) {
            
            // ⭐ [기획 반영] 불굴: HP 50% 이하일 때 특정 상태이상(발화, 빙결) 제외 전면 면역
            const indomitable = (target.skills || []).find(s => s.type === 'PASSIVE' && s.name === '불굴');
            if (indomitable && (target.curHp / target.hp) <= 0.5 && normType !== 'STAT_BURN' && normType !== 'STAT_FREEZE') {
                battle.showFloatingText(target, "불굴!", "#aaa");
                battle.log(`🛡️ [불굴] ${target.name}이(가) 강인한 의지로 상태이상을 무효화했습니다!`, 'log-system');
                return;
            }

            // ⭐ [기획 반영] 중압: 동일 대상에게 연속 사용 시 매회 확률 반감
            if (normType === 'STAT_BIND' && caster && caster.skills && caster.skills.some(s => s.name === '중압')) {
                if (!caster.heavyPressureTracker) caster.heavyPressureTracker = {};
                const uses = caster.heavyPressureTracker[target.id] || 0;
                data.prob = 100 / Math.pow(2, uses);
                caster.heavyPressureTracker[target.id] = uses + 1;
            }

            // (1) 패시브 내성(불굴의 의지) 체크
            const immunePassive = (target.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'STAT_AILMENT_IMMUNE'));            if (immunePassive) {
                const hpThreshold = parseFloat(immunePassive.effects[0].val) || 20;
                if ((target.curHp / target.hp) * 100 <= hpThreshold) {
                    battle.showFloatingText(target, "불굴의 의지!", "#ffff00");
                    battle.log(`🛡️ ${target.name}이(가) 불굴의 의지로 상태이상을 튕겨냈습니다!`, 'log-system');
                    return;
                }
            }
            
            // ⭐ [신규] 특정 상태이상 한정 저항 패시브 (예: 독 면역, 수면 면역 등)
            const specificResist = (target.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_STAT_RESIST_SPECIFIC'));
            if (specificResist) {
                const resistTarget = specificResist.effects.find(e => e.type === 'PAS_STAT_RESIST_SPECIFIC').target || '';
                if (normType.includes(resistTarget) || type.includes(resistTarget)) {
                    battle.showFloatingText(target, "저항(면역)!", "#ffff00");
                    battle.log(`🛡️ ${target.name}이(가) 패시브 효과로 [${this.korNameMap[normType] || normType}]을(를) 완벽히 방어했습니다!`, 'log-system');
                    return;
                }
            }

            // (2) 빙결(Freeze) 락(Lock) 확인 - 빙결 상태에서는 발화(상쇄), 석화(덮어씀) 외에 무효
            if (target.buffs.some(b => this.normalizeAilment(b.type) === 'STAT_FREEZE')) {
                if (normType !== 'STAT_BURN' && normType !== 'STAT_PETRIFY') {
                    battle.showFloatingText(target, "빙결 중 면역", "#aef");
                    return;
                }
            }

            // (3) 발화 vs 빙결 상쇄 (Melt)
            if (normType === 'STAT_BURN' && target.buffs.some(b => this.normalizeAilment(b.type) === 'STAT_FREEZE')) {
                target.buffs = target.buffs.filter(b => this.normalizeAilment(b.type) !== 'STAT_FREEZE');
                battle.showFloatingText(target, "상쇄됨!", "#aef");
                battle.log(`🔥🧊 상쇄! ${target.name}의 빙결과 발화가 만났습니다.`, 'log-system');
                return;
            }
            if (normType === 'STAT_FREEZE' && target.buffs.some(b => this.normalizeAilment(b.type) === 'STAT_BURN')) {
                target.buffs = target.buffs.filter(b => this.normalizeAilment(b.type) !== 'STAT_BURN');
                battle.showFloatingText(target, "상쇄됨!", "#aef");
                battle.log(`🧊🔥 상쇄! ${target.name}의 빙결과 발화가 만났습니다.`, 'log-system');
                return;
            }

            // (5) 저항력(내성) 누적 룰 - 복수차에서는 매 회 20%씩 성공 확률 감소
            target._ailmentResists = target._ailmentResists || {};
            let timesApplied = target._ailmentResists[normType] || 0;
            // 20%씩 깎이므로 1번 걸렸으면 0.8, 2번 걸렸으면 0.6배가 됨. (최소 20% 보장)
            let reductionMult = Math.max(0.2, 1.0 - (timesApplied * 0.2)); 
            
            // 시전자 패시브에 따른 확률 보정
            let probMult = 1.0;
            if (caster && caster.skills) {
                const probPassive = caster.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF' || e.type === 'PAS_AILMENT'));
                if (probPassive) probMult = parseFloat(probPassive.effects[0].val) || 1.3;
            }

            // 기본 확률 연산 (레벨 및 스탯 차이 반영)
            const atkPower = caster ? caster.level + (caster.dex * 0.5) + (caster.int * 0.5) : 10;
            const defPower = target.level + (target.vit * 0.5) + (target.agi * 0.5);
            let successChance = 75 + (atkPower - defPower);
            
            // 데이터에 확률이 명시되어 있다면 그걸 최우선으로 씀
            if (data.prob !== undefined && !isNaN(data.prob)) successChance = data.prob;
            
            // 내성과 패시브 적용
            successChance = Math.max(10, Math.min(100, successChance)) * probMult * reductionMult;

            if (Math.random() * 100 > successChance) {
                // ⭐ 살로메처럼 data에 silentFail이 true로 넘어오면 출력 없이 조용히 종료
                if (!data.silentFail) {
                    battle.showFloatingText(target, "저항!", "#ffffff");
                    battle.log(`🛡️ [저항] ${target.name}이(가) 상태이상을 튕겨냈습니다!`, 'log-system');
                }
                return;
            }
            // (6) 지속 턴수 확정 (스킬 JSON의 duration을 무시하고, 기획서의 BASE_DURATIONS 강제 적용)
            data.duration = this.BASE_DURATIONS[normType] || 2;
            if (caster && caster.skills && caster.skills.some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_EXTEND_DEBUFF'))) {
                data.duration += 1;
            }

            // (7) 기존에 동일한 상태이상이 있으면: 지속시간을 최대치로 초기화하고 덮어씀 (무효화 안 됨)
            let existingSame = target.buffs.find(b => this.normalizeAilment(b.type) === normType);
            if (existingSame) {
                existingSame.duration = data.duration;
                target._ailmentResists[normType] = timesApplied + 1; // 내성 증가
                battle.showFloatingText(target, `지속시간 갱신`, "#ffaa00");
                return;
            }

            // (8) 위계 및 단방향 병행 규칙 심사
            let currentAilments = target.buffs.filter(b => this.TIERS[this.normalizeAilment(b.type)]);
            let ailmentsToRemove = [];
            let isNullified = false;

            for (let e of currentAilments) {
                let eNorm = this.normalizeAilment(e.type);
                let eTier = this.TIERS[eNorm];
                // 기존 상태이상의 시선에서 '새로운 상태이상(normType)'을 허용하는가?
                let isCompatible = this.COMPATIBILITY[eNorm] && this.COMPATIBILITY[eNorm].includes(normType);

                if (!isCompatible) {
                    // 병행 불가라면 위계(Tier) 비교: 새 것이 상위면 기존 것을 지우고, 하위면 무효화
                    if (incomingTier > eTier) {
                        ailmentsToRemove.push(e); 
                    } else { 
                        isNullified = true; 
                        break; 
                    } 
                }
            }

            if (isNullified) {
                battle.showFloatingText(target, "상태이상 무효", "#aaaaaa");
                battle.log(`🛡️ ${target.name}에게 걸린 상위 상태이상 때문에 새로운 효과가 무시되었습니다.`, 'log-system');
                return;
            }

            // 병행 불가로 덮어씌워진 하위 상태이상 삭제
            target.buffs = target.buffs.filter(b => !ailmentsToRemove.includes(b));
            currentAilments = target.buffs.filter(b => this.TIERS[this.normalizeAilment(b.type)]);

            // (9) 최대 2개 병행 룰 (3개째 진입 시, 오래된 것부터 우선순위 비교하여 밀어내기)
            if (currentAilments.length >= 2) {
                let replaced = false;
                // currentAilments는 배열 순서상 앞쪽이 먼저 걸린(오래된) 것임
                for (let e of currentAilments) {
                    let eNorm = this.normalizeAilment(e.type);
                    if (incomingTier >= this.TIERS[eNorm]) {
                        target.buffs = target.buffs.filter(b => b !== e);
                        replaced = true;
                        break;
                    }
                }
                if (!replaced) {
                    // 기존 2개가 모두 새 것보다 상위라면 무효화
                    battle.showFloatingText(target, "상태이상 초과", "#aaaaaa");
                    return;
                }
            }

            // 모든 검증을 통과했으므로 내성 카운트 증가
            target._ailmentResists[normType] = timesApplied + 1;
        } else {
            // 상태이상이 아닌 일반 버프/너프일 경우 스킬 데이터의 턴 수 유지
            data.duration = parseInt(data.duration, 10);
            if (isNaN(data.duration)) data.duration = 2;
        }

        // ==============================================================
        // 3. [최종 버프/디버프 객체 생성 및 적용]
        // ==============================================================
        const multiplier = (data.val !== undefined) ? parseFloat(data.val) : (data.mult !== undefined ? parseFloat(data.mult) : 1);
        const isSelfCast = caster && battle.currentUnit && (caster.id === target.id) && (target.id === battle.currentUnit.id);
        
            // (4) 석화 진입 시 모든 기존 상태이상 해제 및 오브젝트화
            if (normType === 'STAT_PETRIFY') {
                target.buffs = target.buffs.filter(b => !this.TIERS[this.normalizeAilment(b.type)]);
                target.isWall = true; 
            }

        const buff = { 
            type: type, name: finalName, icon: finalIcon, 
            duration: data.duration, val: multiplier, casterId: caster ? caster.id : null, 
            isNew: isSelfCast, isAura: data.isAura || false
        };

        if (type === 'BUFF_SHIELD' || type === 'DEF_SHIELD') {
            buff.amount = Math.floor((caster.int || 10) * multiplier * 2);
            battle.log(`🛡️ ${target.name} 보호막: ${buff.amount}`, 'log-heal');
        }

        let isAuraUpdate = false; 
        const exist = target.buffs.find(b => b.type === type && b.casterId === (caster ? caster.id : null));
        if (exist) { 
            exist.duration = data.duration; 
            exist.val = multiplier;
            if(buff.amount) exist.amount = buff.amount; 
            exist.isNew = isSelfCast; 
            exist.isAura = data.isAura || exist.isAura; 
            if (exist.isAura) isAuraUpdate = true;
        } else { 
            target.buffs.push(buff); 
        }

        // ⭐ [신규] 기획서 100% 반영: '행동제약계' 상태이상 적중 시 집중/차징/채널링 확정 파괴
        const restrictCCList = [
            'STAT_GRAVITY', 'STAT_SILENCE', 'STAT_DEMORALIZED', 'STAT_SLEEP', 
            'STAT_CONFUSION', 'STAT_STUN', 'STAT_PARALYSIS', 'STAT_CHARM', 
            'STAT_PETRIFY', 'STAT_DEATH', 'STAT_FREEZE' // (빙결도 맥락상 포함)
        ];
        
        const isRestrictingCC = restrictCCList.some(cc => normType.includes(cc));

        if (isRestrictingCC) {
            let isConcentrationBroken = false;

            // 1. 차징(캐스팅) 중인 경우 해제
            if (target.isCharging) {
                target.isCharging = false;
                target.chargingSkill = null;
                target.chargeTurnLimit = 0;
                target.buffs = target.buffs.filter(b => b.type !== 'BUFF_CASTING');
                if (battle.stopCastRipple) battle.stopCastRipple(target);
                isConcentrationBroken = true;
            }

            // 2. 채널링(연주/춤) 중인 경우 해제
            const channelBuff = target.buffs.find(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
            if (channelBuff) {
                target.buffs = target.buffs.filter(b => b !== channelBuff);
                target.isAuraSource = false;
                target.auraEffects = [];
                if (battle.updateAurasForUnit) battle.units.forEach(u => battle.updateAurasForUnit(u));
                if (battle.stopAuraRipple) battle.stopAuraRipple(target);
                isConcentrationBroken = true;
            }

            // 3. UI 알림 출력
            if (isConcentrationBroken) {
                battle.showFloatingText(target, "집중 강제 해제!", "#ff5555");
                battle.log(`😵 제어 불가 상태에 빠져 ${target.name}의 집중이 강제로 해제되었습니다!`, "log-bad");
                if (battle.viewingUnit === target) battle.ui.updateStatusPanel();
            }
        }

        // 채널링 오라 전파
        if (type.startsWith('BUFF_CHANNELED') || type.startsWith('DEBUFF_CHANNELED')) {
            target.isAuraSource = true;
            const auraEffType = type.replace('CHANNELED_', 'STAT_'); 
            if (!target.auraEffects) target.auraEffects = [];
            
            // ⭐ [버그 수정] DNC_19처럼 효과가 2개 이상일 때 덮어씌워지지 않도록 배열에 push 합니다.
            if (!target.auraEffects.some(a => a.type === auraEffType)) {
                target.auraEffects.push({ 
                    type: auraEffType, val: multiplier, area: data.area !== undefined ? parseInt(data.area) : 5, 
                    target: type.startsWith('BUFF') ? 'ALLY_ALL' : 'ENEMY_ALL' 
                });
            }
            if (battle.broadcastAura) battle.broadcastAura(target);
            if (battle.startAuraRipple) battle.startAuraRipple(target);
        }

        if (!isAuraUpdate) {
            let color = type.includes('DEBUFF') || type.includes('STAT_') || type.includes('CC_') ? '#f55' : '#5f5';
            battle.showFloatingText(target, `${buff.name}`, color);
        }

        if (!isDebuff && target.homunculusId && battle.units && !data._isHomunSync) {
            const homun = battle.units.find(u => u.id === target.homunculusId && u.curHp > 0);
            if (homun) {
                const syncData = { ...data, _isHomunSync: true };
                this.applyStatus(homun, syncData, caster);
            }
        }
    }
}