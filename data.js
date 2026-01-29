export const ELEMENTS = {
    'FIRE': { name: '화염', icon: '🔥', weak: 'WATER', strong: 'WIND' },
    'WATER': { name: '냉기', icon: '💧', weak: 'EARTH', strong: 'FIRE' },
    'EARTH': { name: '대지', icon: '🪨', weak: 'WIND', strong: 'WATER' },
    'WIND': { name: '바람', icon: '🌪️', weak: 'FIRE', strong: 'EARTH' },
    'LIGHT': { name: '신성', icon: '✨', weak: 'DARK', strong: 'DARK' }, 
    'DARK': { name: '암흑', icon: '💀', weak: 'LIGHT', strong: 'LIGHT' },
    'NONE': { name: '무속성', icon: '⚪', weak: '', strong: '' }
};

export const STAT_NAMES = {
    'str': "힘", 'int': "지능", 'vit': "체력",
    'agi': "민첩", 'dex': "숙련", 'vol': "변동", 'luk': "운", 'def': "방어"
};

export const EFFECTS = {
    'NONE':       { icon: '', name: '없음', type: 'system', desc: '효과 없음' },
    'DMG':        { icon: '💥', name: '피해', type: 'instant', desc: '피해를 입힙니다' },
    'HEAL':       { icon: '💚', name: '회복', type: 'instant', desc: '체력을 회복합니다' },
    'MP_HEAL':    { icon: '💙', name: '마나회복', type: 'instant', desc: 'MP를 회복합니다' },
    'PURIFY':     { icon: '✨', name: '정화', type: 'instant', desc: '해로운 효과 제거' },
    'NUCKBACK':   { icon: '🔙', name: '넉백', type: 'instant', desc: '뒤로 밀려납니다' },
    'SHLD':       { icon: '🛡️', name: '보호막', type: 'buff', desc: '피해 흡수' },
    'cool_down':  { icon: '⌛', name: '쿨초기화', type: 'instant', desc: '스킬 쿨타임 제거' },
    
    // 버프
    'ATK_UP':     { icon: '⚔️', name: '공격UP', type: 'buff', desc: '공격력 증가' },
    'DEF_UP':     { icon: '🛡️', name: '방어UP', type: 'buff', desc: '방어력 증가' },
    'CRIT_UP':    { icon: '🎯', name: '치명타UP', type: 'buff', desc: '치명타 확률 증가' },
    'EVA_UP':     { icon: '💨', name: '회피UP', type: 'buff', desc: '회피율 증가' },
    'SPD_UP':     { icon: '⚡', name: '신속', type: 'buff', desc: '행동 속도 증가' },
    'INVINCIBLE': { icon: '💎', name: '무적', type: 'buff', desc: '피해 무시' },
    'DRAIN':      { icon: '🧛', name: '흡혈', type: 'buff', desc: '피해량의 일부 회복' },
    
    // 디버프
    'STUN':       { icon: '💫', name: '기절', type: 'debuff', desc: '아무 행동 못함' },
    'FREEZE':     { icon: '❄️', name: '빙결', type: 'debuff', desc: '이동불가, 피격 시 2배 피해 후 해제' },
    'SLEEP':      { icon: '💤', name: '수면', type: 'debuff', desc: '행동 불가, 피격 시 해제' },
    'BURN':       { icon: '🔥', name: '화상', type: 'debuff', desc: '지속 피해, 방어 감소' },
    'POISON':     { icon: '☠️', name: '맹독', type: 'debuff', desc: '체력 비례 지속 피해' },
    'BLEED':      { icon: '🩸', name: '출혈', type: 'debuff', desc: '이동 시 피해' },
    'SPD_DOWN':   { icon: '🐢', name: '감속', type: 'debuff', desc: '턴 늦게 옴' },
    'SILENCE':    { icon: '😶', name: '침묵', type: 'debuff', desc: '스킬 사용 불가' },
    'ROOT':       { icon: '🕸️', name: '속박', type: 'debuff', desc: '이동 불가' },
    'SHOCK':      { icon: '⚡', name: '감전', type: 'debuff', desc: '쿨타임 멈춤' },
    'TAUNT':      { icon: '🤬', name: '도발', type: 'debuff', desc: '강제 타겟팅' },
    'CONFUSE':    { icon: '😵', name: '혼란', type: 'debuff', desc: '랜덤 이동/공격' },
    'BLIND':      { icon: '😎', name: '실명', type: 'debuff', desc: '명중률 대폭 감소' },
    'CURSE':      { icon: '👿', name: '저주', type: 'debuff', desc: '받는 피해 증가' },
    
    'ATK_DOWN':   { icon: '📉', name: '공격DOWN', type: 'debuff', desc: '공격력 감소' },
    'DEF_DOWN':   { icon: '💔', name: '방어DOWN', type: 'debuff', desc: '방어력 감소' }
};

export const ITEM_DATA = {
    'POTION_S': { name: '하급 물약', type: 'POTION', cost: 50, val: 50, desc: '체력 +50 (패시브)', icon: '🍷', jobs: [] },
    'POTION_M': { name: '중급 물약', type: 'POTION', cost: 150, val: 150, desc: '체력 +150 (패시브)', icon: '🧪', jobs: [] },
    'SWORD_WOOD': { name: '목검', type: 'WEAPON', cost: 100, val: 5, desc: '공격력 +5', icon: '🗡️', jobs: ['WARRIOR', 'KNIGHT', 'ROGUE'] },
    'SWORD_IRON': { name: '철검', type: 'WEAPON', cost: 500, val: 15, desc: '공격력 +15', icon: '⚔️', jobs: ['WARRIOR', 'KNIGHT'] },
    'DAGGER': { name: '단검', type: 'WEAPON', cost: 400, val: 12, desc: '공격력 +12', icon: '🔪', jobs: ['ROGUE', 'ARCHER', 'ALCHEMIST'] },
    'STAFF_WOOD': { name: '나무 지팡이', type: 'WEAPON', cost: 100, val: 5, desc: '지능 +5', icon: '🪄', jobs: ['SORCERER', 'CLERIC', 'BARD'] },
    'STAFF_RUBY': { name: '루비 지팡이', type: 'WEAPON', cost: 600, val: 20, desc: '지능 +20', icon: '🔥', jobs: ['SORCERER', 'WARLOCK'] },
    'BOW_SHORT': { name: '숏보우', type: 'WEAPON', cost: 150, val: 8, desc: '공격력 +8', icon: '🏹', jobs: ['ARCHER', 'ROGUE'] },
    'ARMOR_LEATHER': { name: '가죽 갑옷', type: 'ARMOR', cost: 200, val: 3, desc: '방어력 +3', icon: '👕', jobs: [] },
    'ARMOR_CHAIN': { name: '사슬 갑옷', type: 'ARMOR', cost: 600, val: 8, desc: '방어력 +8', icon: '⛓️', jobs: ['WARRIOR', 'KNIGHT', 'PALADIN'] },
    'ROBE_SILK': { name: '비단 로브', type: 'ARMOR', cost: 300, val: 4, desc: '방어 +4', icon: '👘', jobs: ['SORCERER', 'CLERIC', 'BARD', 'DANCER'] },
    'RING_STR': { name: '힘의 반지', type: 'ACC', cost: 400, val: 3, stat:'str', desc: '힘 +3', icon: '💍', jobs: [] },
    'RING_INT': { name: '지능의 반지', type: 'ACC', cost: 400, val: 3, stat:'int', desc: '지능 +3', icon: '🔮', jobs: [] },
    'AMULET_HP': { name: '생명 목걸이', type: 'ACC', cost: 500, val: 50, stat:'hp', desc: '체력 +50', icon: '📿', jobs: [] }
};

export const STAGE_DATA = {
    1: { 
        1: { enemies: ['RAT*5', 'SLIME*1'], rewardGold: 100, firstReward: 'POTION_S', desc: '쥐 소굴' },
        2: { enemies: ['SPIDER*3', 'SLIME*3', 'GOBLIN'], rewardGold: 120, firstReward: null, desc: '거미의 습격' },
        3: { enemies: ['GOBLIN*2', 'BOAR*3'], rewardGold: 150, firstReward: 'SWORD_WOOD', desc: '고블린 정찰병과 멧돼지' },
        4: { enemies: ['WOLF*3', 'GOBLIN*2', 'KOBOLD*2'], rewardGold: 180, firstReward: null, desc: '코볼트 동굴' },
        5: { enemies: ['KOBOLD*1', 'ORC*1', 'GOBLIN*5'], rewardGold: 300, firstReward: 'RING_STR', desc: '중간 보스: 오크' },
        6: { enemies: ['SKELETON*3'], rewardGold: 200, firstReward: null, desc: '해골 무덤' },
        7: { enemies: ['SKELETON*3', 'ZOMBIE*2'], rewardGold: 220, firstReward: null, desc: '망자의 행진' },
        8: { enemies: ['ORC*2', 'SPIDER*10'], rewardGold: 350, firstReward: 'ARMOR_LEATHER', desc: '오크와 거미' },
        9: { enemies: ['GOLEM*2', 'GARGOYLE*3'], rewardGold: 400, firstReward: null, desc: '바위 거인' },
        10: { enemies: ['DRAKE', 'ORC*5'], rewardGold: 1000, firstReward: 'SWORD_IRON', desc: '챕터 보스: 드레이크' },

    }
};

// [data.js] CLASS_DATA (아이콘 및 상세 설명 완비)
export const CLASS_DATA = {
    'WARRIOR': { name: '로덴 그레이', element: 'EARTH', level: 1, xp: 0, maxXp: 100, hp: 300, mp: 50, spd: 9, mov: 3, rng: 1, str: 25, int: 5, vit: 20, agi: 10, dex: 10, vol: 15, luk: 10, def: 15, icon: '⚔️', skills: [
        {id:'W1', name:'강타', mp:10, rng:1, cool:0, icon:'🗡️', main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.5, area:0, dmgType:'PHYS'}, sub:null, desc:'대상에게 강력한 힘으로 내려쳐 1.5배의 물리 피해를 입힙니다.'},
        {id:'W2', name:'회전베기', mp:25, rng:1, cool:3, icon:'🌪️', main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'PHYS'}, sub:null, desc:'몸을 회전시켜 주변 1칸 범위 내의 모든 적에게 1.2배의 물리 피해를 줍니다.'},
        {id:'W3', name:'전투의함성', mp:40, rng:0, cool:5, icon:'🦁', main:{type:'ATK_UP', target:'SELF', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'ATK_UP', target:'ALLY_ALL', mult:1.2, area:99, duration:3}, desc:'우렁찬 함성으로 자신의 공격력을 1.5배, 아군 전체를 1.2배 증가시킵니다.'}
    ]},
    'KNIGHT': { name: '세라핀 블랜처', element: 'LIGHT', level: 1, xp: 0, maxXp: 100, hp: 400, mp: 60, spd: 7, mov: 3, rng: 1, str: 20, int: 8, vit: 30, agi: 5, dex: 5, vol: 5, luk: 10, def: 25, icon: '🛡️', skills: [
        {id:'K1', name:'방패치기', mp:15, rng:1, cool:2, icon:'💥', main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'PHYS'}, sub:{type:'STUN', target:'ENEMY_SINGLE', mult:0, area:0, duration:1}, desc:'방패로 강타하여 1.2배 피해를 주고 1턴간 기절시킵니다.'},
        {id:'K2', name:'수호의맹세', mp:30, rng:0, cool:4, icon:'🙏', main:{type:'DEF_UP', target:'SELF', mult:2, area:0, dmgType:'PHYS'}, sub:{type:'TAUNT', target:'AREA_ENEMY', mult:0, area:5, duration:3}, desc:'방어 태세를 갖춰 방어력을 2배 높이고 주변 적들을 도발합니다.'},
        {id:'K3', name:'희생의방패', mp:60, rng:0, cool:8, icon:'🛡️', main:{type:'SHLD', target:'ALLY_ALL', mult:3.0, area:99, dmgType:'PHYS'}, sub:{type:'DEF_UP', target:'ALLY_ALL', mult:1.5, area:99, duration:2}, desc:'모든 아군에게 강력한 보호막을 부여하고 방어력을 증가시킵니다.'}
    ]},
    'MONK': { name: '다렌 라오', element: 'WIND', level: 1, xp: 0, maxXp: 100, hp: 250, mp: 80, spd: 14, mov: 5, rng: 1, str: 22, int: 10, vit: 15, agi: 25, dex: 15, vol: 20, luk: 15, def: 5, icon: '🥋', skills: [
        {id:'Mo1', name:'연타', mp:10, rng:1, cool:0, icon:'👊', main:{type:'DMG', target:'ENEMY_SINGLE', mult:0.8, area:0, dmgType:'PHYS'}, sub:{type:'DMG', target:'ENEMY_SINGLE', mult:0.8, area:0, duration:0}, desc:'눈에 보이지 않는 속도로 2회 연속 공격합니다. (총 1.6배)'},
        {id:'Mo2', name:'명상', mp:20, rng:0, cool:3, icon:'🧘', main:{type:'HEAL', target:'SELF', mult:0.4, area:0, dmgType:'PHYS'}, sub:{type:'PURIFY', target:'SELF', mult:0, area:0, duration:0}, desc:'호흡을 가다듬어 체력을 회복하고 모든 상태이상을 정화합니다.'},
        {id:'Mo3', name:'비연각', mp:40, rng:3, cool:4, icon:'🦶', main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.8, area:0, dmgType:'PHYS'}, sub:{type:'NUCKBACK', target:'ENEMY_SINGLE', mult:0, area:0, duration:0}, desc:'날아차기로 원거리 적에게 1.8배 피해를 입히고 뒤로 밀어냅니다.'}
    ]},
    'ROGUE': { name: '켈 브라이언', element: 'DARK', level: 1, xp: 0, maxXp: 100, hp: 220, mp: 100, spd: 15, mov: 4, rng: 1, str: 20, int: 10, vit: 12, agi: 20, dex: 30, vol: 20, luk: 25, def: 8, icon: '🗡️', skills: [
        {id:'R1', name:'급소찌르기', mp:15, rng:1, cool:0, icon:'🩸', main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.8, area:0, dmgType:'PHYS'}, sub:{type:'CRIT_UP', target:'SELF', mult:1.3, area:0, duration:2}, desc:'약점을 찔러 1.8배 피해를 주고 치명타율을 높입니다.'},
        {id:'R2', name:'독바르기', mp:25, rng:1, cool:3, icon:'☠️', main:{type:'DMG', target:'ENEMY_SINGLE', mult:0.5, area:0, dmgType:'PHYS'}, sub:{type:'POISON', target:'ENEMY_SINGLE', mult:0.3, area:0, duration:4}, desc:'맹독 공격으로 피해를 주고 4턴간 지속 독 데미지를 입힙니다.'},
        {id:'R3', name:'연막탄', mp:50, rng:3, cool:6, icon:'🌫️', main:{type:'BLIND', target:'AREA_ENEMY', mult:0, area:2, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'AREA_ENEMY', mult:0.5, area:2, duration:3}, desc:'연막을 터뜨려 2칸 범위 적들의 시야를 가리고(실명) 느리게 만듭니다.'}
    ]},
    'ARCHER': { name: '르네 실바', element: 'WIND', level: 1, xp: 0, maxXp: 100, hp: 200, mp: 80, spd: 12, mov: 3, rng: 6, str: 24, int: 8, vit: 10, agi: 18, dex: 28, vol: 15, luk: 15, def: 5, icon: '🏹', skills: [
        {id:'A1', name:'정밀사격', mp:15, rng:6, cool:0, icon:'🎯', main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.4, area:0, dmgType:'PHYS'}, sub:{type:'CRIT_UP', target:'SELF', mult:1.2, area:0, duration:1}, desc:'멀리서 정밀 조준하여 1.4배 피해를 입힙니다.'},
        {id:'A2', name:'화살비', mp:35, rng:5, cool:4, icon:'🌧️', main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'PHYS'}, sub:null, desc:'하늘로 화살을 쏘아 1칸 범위 내 적들을 초토화합니다.'},
        {id:'A3', name:'매의눈', mp:50, rng:0, cool:6, icon:'👁️', main:{type:'ATK_UP', target:'SELF', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'rng', target:'SELF', mult:2, area:0, duration:3}, desc:'3턴간 사거리와 공격력을 대폭 증가시킵니다.'}
    ]},
    'SORCERER': { name: '라이언 모드', element: 'FIRE', level: 1, xp: 0, maxXp: 100, hp: 160, mp: 250, spd: 10, mov: 2, rng: 4, str: 5, int: 35, vit: 10, agi: 10, dex: 12, vol: 25, luk: 15, def: 5, icon: '🔮', skills: [
        {id:'S1', name:'화염구', mp:25, rng:5, cool:0, icon:'🔥', main:{type:'DMG', target:'ENEMY_SINGLE', mult:2, area:0, dmgType:'MAG'}, sub:null, desc:'거대한 화염 구체를 날려 2.0배의 화염 피해를 줍니다.'},
        {id:'S2', name:'낙뢰', mp:40, rng:5, cool:3, icon:'⚡', main:{type:'DMG', target:'ENEMY_SINGLE', mult:2.5, area:0, dmgType:'MAG'}, sub:{type:'SHOCK', target:'ENEMY_SINGLE', mult:0, area:0, duration:2}, desc:'벼락을 떨어뜨려 2.5배 피해를 주고 쿨타임을 정지시킵니다.'},
        {id:'S3', name:'눈보라', mp:80, rng:6, cool:8, icon:'❄️', main:{type:'DMG', target:'AREA_ENEMY', mult:1.5, area:2, dmgType:'MAG'}, sub:{type:'SPD_DOWN', target:'AREA_ENEMY', mult:0.5, area:2, duration:3}, desc:'넓은 범위에 눈보라를 소환하여 피해를 주고 얼어붙게(감속) 합니다.'}
    ]},
    'CLERIC': { name: '아벨 라이트', element: 'LIGHT', level: 1, xp: 0, maxXp: 100, hp: 240, mp: 200, spd: 9, mov: 2, rng: 2, str: 10, int: 25, vit: 20, agi: 8, dex: 8, vol: 10, luk: 15, def: 12, icon: '✝️', skills: [
        {id:'C1', name:'치유의빛', mp:20, rng:3, cool:0, icon:'✨', main:{type:'HEAL', target:'ALLY_SINGLE', mult:2, area:0, dmgType:'MAG'}, sub:null, desc:'신성한 빛으로 아군 하나의 체력을 대폭 회복시킵니다.'},
        {id:'C2', name:'정화', mp:30, rng:3, cool:2, icon:'🌿', main:{type:'PURIFY', target:'ALLY_SINGLE', mult:0, area:0, dmgType:'MAG'}, sub:{type:'HEAL', target:'ALLY_SINGLE', mult:1, area:0, duration:0}, desc:'아군의 해로운 효과를 제거하고 체력을 약간 회복합니다.'},
        {id:'C3', name:'성역', mp:100, rng:0, cool:10, icon:'🏛️', main:{type:'HEAL', target:'ALLY_ALL', mult:1.5, area:99, dmgType:'MAG'}, sub:{type:'DEF_UP', target:'ALLY_ALL', mult:1.3, area:99, duration:2}, desc:'모든 아군을 축복하여 체력을 회복시키고 방어력을 높입니다.'}
    ]},
    'BARD': { name: '피오나 델린', element: 'WIND', level: 1, xp: 0, maxXp: 100, hp: 220, mp: 180, spd: 11, mov: 3, rng: 3, str: 8, int: 22, vit: 18, agi: 12, dex: 15, vol: 10, luk: 20, def: 8, icon: '🎻', skills: [
        {id:'Ba1', name:'불협화음', mp:20, rng:3, cool:0, icon:'💢', main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'MAG'}, sub:{type:'CONFUSE', target:'ENEMY_SINGLE', mult:0, area:0, duration:1}, desc:'듣기 싫은 소리를 연주하여 적을 혼란 상태에 빠뜨립니다.'},
        {id:'Ba2', name:'용기의노래', mp:40, rng:0, cool:4, icon:'🎺', main:{type:'ATK_UP', target:'ALLY_ALL', mult:1.3, area:99, dmgType:'MAG'}, sub:null, desc:'웅장한 연주로 모든 아군의 사기를 높여 공격력을 증가시킵니다.'},
        {id:'Ba3', name:'평온의연주', mp:60, rng:0, cool:6, icon:'🎼', main:{type:'HEAL', target:'ALLY_ALL', mult:0, area:99, dmgType:'MAG'}, sub:{type:'PURIFY', target:'ALLY_ALL', mult:0, area:99, duration:0}, desc:'마음을 진정시키는 연주로 모든 아군의 상태이상을 치료합니다.'}
    ]},
    'DANCER': { name: '아리사 벨로닉', element: 'FIRE', level: 1, xp: 0, maxXp: 100, hp: 200, mp: 150, spd: 16, mov: 4, rng: 1, str: 10, int: 15, vit: 15, agi: 30, dex: 10, vol: 20, luk: 20, def: 8, icon: '💃', skills: [
        {id:'Da1', name:'매혹의춤', mp:25, rng:2, cool:3, icon:'💋', main:{type:'DMG', target:'ENEMY_SINGLE', mult:0.5, area:0, dmgType:'PHYS'}, sub:{type:'SLEEP', target:'ENEMY_SINGLE', mult:0, area:0, duration:2}, desc:'아름다운 춤사위로 적을 홀려 깊은 잠에 빠뜨립니다.'},
        {id:'Da2', name:'격정의춤', mp:40, rng:0, cool:5, icon:'🔥', main:{type:'SPD_UP', target:'ALLY_ALL', mult:1.3, area:99, dmgType:'PHYS'}, sub:{type:'EVA_UP', target:'ALLY_ALL', mult:1.3, area:99, duration:3}, desc:'빠른 템포의 춤으로 아군 전체의 속도와 회피율을 높입니다.'},
        {id:'Da3', name:'앙코르', mp:80, rng:2, cool:8, icon:'👏', main:{type:'MP_HEAL', target:'ALLY_SINGLE', mult:0, area:0, dmgType:'PHYS'}, sub:{type:'cool_down', target:'ALLY_SINGLE', mult:3, area:0, duration:0}, desc:'아군 하나를 격려하여 스킬 쿨타임을 3턴 감소시킵니다.'}
    ]},
    'ALCHEMIST': { name: '라스 하딘', element: 'WATER', level: 1, xp: 0, maxXp: 100, hp: 220, mp: 180, spd: 12, mov: 3, rng: 4, str: 10, int: 25, vit: 15, agi: 15, dex: 25, vol: 15, luk: 15, def: 10, icon: '⚗️', skills: [
        {id:'Al1', name:'포션투척', mp:15, rng:4, cool:0, icon:'🧪', main:{type:'HEAL', target:'ALLY_SINGLE', mult:1.5, area:0, dmgType:'MAG'}, sub:null, desc:'멀리 있는 아군에게 회복 포션을 던져 체력을 회복시킵니다.'},
        {id:'Al2', name:'산성폭탄', mp:30, rng:4, cool:3, icon:'🤢', main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'MAG'}, sub:{type:'DEF_DOWN', target:'AREA_ENEMY', mult:0.7, area:1, duration:3}, desc:'부식성 액체를 던져 범위 내 적들의 방어력을 깎습니다.'},
        {id:'Al3', name:'황금연성', mp:100, rng:4, cool:10, icon:'💰', main:{type:'DMG', target:'ENEMY_SINGLE', mult:3, area:0, dmgType:'MAG'}, sub:{type:'STUN', target:'ENEMY_SINGLE', mult:0, area:0, duration:2}, desc:'적을 황금 동상으로 만들어버리는 궁극의 연금술입니다. (기절)'}
    ]},

    // --- 몬스터 (30종) ---
    'RAT': { name: '거대쥐', element: 'EARTH', level: 1, xp: 0, maxXp: 9999, hp: 150, mp: 0, spd: 6, mov: 3, rng: 1, str: 15, int: 0, vit: 10, agi: 10, dex: 5, vol: 5, luk: 5, def: 5, icon: '🐀', skills: [
        {id:'R1', name:'물어뜯기', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1, area:0, dmgType:'PHYS'}, sub:{type:'POISON', target:'ENEMY_SINGLE', mult:0.1, area:0, duration:3}}
    ]},
    'SLIME': { name: '슬라임', element: 'WATER', level: 1, xp: 0, maxXp: 9999, hp: 200, mp: 50, spd: 5, mov: 2, rng: 1, str: 18, int: 0, vit: 20, agi: 5, dex: 5, vol: 5, luk: 5, def: 10, icon: '🟢', skills: [
        {id:'S1', name:'점액발사', mp:0, rng:2, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1, area:0, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'ENEMY_SINGLE', mult:0.5, area:0, duration:2}}
    ]},
    'BAT': { name: '흡혈박쥐', element: 'WIND', level: 2, xp: 0, maxXp: 9999, hp: 180, mp: 0, spd: 12, mov: 4, rng: 1, str: 20, int: 0, vit: 10, agi: 25, dex: 15, vol: 5, luk: 10, def: 5, icon: '🦇', skills: [
        {id:'B1', name:'초음파', mp:10, rng:2, cool:3, main:{type:'DMG', target:'ENEMY_SINGLE', mult:0.8, area:0, dmgType:'PHYS'}, sub:{type:'CONFUSE', target:'ENEMY_SINGLE', mult:0, area:0, duration:1}}
    ]},
    'KOBOLD': { name: '코볼트', element: 'FIRE', level: 2, xp: 0, maxXp: 9999, hp: 220, mp: 20, spd: 9, mov: 3, rng: 1, str: 22, int: 5, vit: 15, agi: 15, dex: 12, vol: 5, luk: 10, def: 8, icon: '🐕', skills: [
        {id:'K1', name:'기습', mp:10, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.1, area:0, duration:2}}
    ]},
    'GOBLIN': { name: '고블린', element: 'WIND', level: 3, xp: 0, maxXp: 9999, hp: 250, mp: 30, spd: 11, mov: 3, rng: 1, str: 25, int: 0, vit: 18, agi: 20, dex: 20, vol: 10, luk: 10, def: 10, icon: '👺', skills: [
        {id:'G1', name:'단검투척', mp:10, rng:3, cool:2, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.1, area:0, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.2, area:0, duration:3}}
    ]},
    'SPIDER': { name: '독거미', element: 'DARK', level: 3, xp: 0, maxXp: 9999, hp: 280, mp: 50, spd: 8, mov: 3, rng: 2, str: 28, int: 10, vit: 20, agi: 15, dex: 15, vol: 5, luk: 10, def: 12, icon: '🕷️', skills: [
        {id:'Sp1', name:'독침', mp:15, rng:2, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1, area:0, dmgType:'PHYS'}, sub:{type:'POISON', target:'ENEMY_SINGLE', mult:0.2, area:0, duration:4}}
    ]},
    'WOLF': { name: '늑대', element: 'WIND', level: 4, xp: 0, maxXp: 9999, hp: 350, mp: 0, spd: 14, mov: 4, rng: 1, str: 35, int: 0, vit: 25, agi: 20, dex: 15, vol: 10, luk: 10, def: 15, icon: '🐺', skills: [
        {id:'Wo1', name:'물기', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.3, area:0, duration:3}},
        {id:'Wo2', name:'하울링', mp:20, rng:0, cool:5, main:{type:'ATK_UP', target:'ALLY_ALL', mult:1.2, area:0, dmgType:'PHYS'}, sub:null}
    ]},
    'BOAR': { name: '멧돼지', element: 'EARTH', level: 4, xp: 0, maxXp: 9999, hp: 500, mp: 0, spd: 7, mov: 5, rng: 1, str: 40, int: 0, vit: 40, agi: 5, dex: 5, vol: 15, luk: 5, def: 20, icon: '🐗', skills: [
        {id:'Bo1', name:'돌진', mp:10, rng:1, cool:2, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'NUCKBACK', target:'ENEMY_SINGLE', mult:0, area:0, duration:0}},
        {id:'Bo2', name:'분노', mp:30, rng:0, cool:10, main:{type:'ATK_UP', target:'SELF', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'DEF_DOWN', target:'SELF', mult:0.7, area:0, duration:3}}
    ]},
    'SKELETON': { name: '스켈레톤', element: 'DARK', level: 5, xp: 0, maxXp: 9999, hp: 400, mp: 0, spd: 10, mov: 3, rng: 3, str: 38, int: 0, vit: 20, agi: 15, dex: 20, vol: 5, luk: 5, def: 18, icon: '☠️', skills: [
        {id:'Sk1', name:'뼈던지기', mp:0, rng:3, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1, area:0, dmgType:'PHYS'}, sub:null},
        {id:'Sk2', name:'공포', mp:20, rng:3, cool:5, main:{type:'NONE', target:'ENEMY_SINGLE', mult:0, area:0, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'ENEMY_SINGLE', mult:0.5, area:0, duration:3}}
    ]},
    'ZOMBIE': { name: '좀비', element: 'DARK', level: 5, xp: 0, maxXp: 9999, hp: 600, mp: 0, spd: 4, mov: 2, rng: 1, str: 45, int: 0, vit: 60, agi: 2, dex: 5, vol: 5, luk: 0, def: 5, icon: '🧟', skills: [
        {id:'Z1', name:'손톱', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.3, area:0, dmgType:'PHYS'}, sub:{type:'POISON', target:'ENEMY_SINGLE', mult:0.2, area:0, duration:3}},
        {id:'Z2', name:'재생', mp:0, rng:0, cool:5, main:{type:'HEAL', target:'SELF', mult:0.3, area:0, dmgType:'PHYS'}, sub:null}
    ]},
    'ORC': { name: '오크', element: 'EARTH', level: 6, xp: 0, maxXp: 9999, hp: 700, mp: 20, spd: 8, mov: 3, rng: 1, str: 55, int: 0, vit: 50, agi: 8, dex: 10, vol: 15, luk: 10, def: 30, icon: '👹', skills: [
        {id:'O1', name:'강타', mp:20, rng:1, cool:2, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.6, area:0, dmgType:'PHYS'}, sub:{type:'STUN', target:'ENEMY_SINGLE', mult:0, area:0, duration:1}},
        {id:'O2', name:'위압', mp:15, rng:0, cool:5, main:{type:'NONE', target:'AREA_ENEMY', mult:0, area:1, dmgType:'PHYS'}, sub:{type:'ATK_DOWN', target:'AREA_ENEMY', mult:0.8, area:1, duration:3}}
    ]},
    'BANDIT': { name: '도적', element: 'WIND', level: 6, xp: 0, maxXp: 9999, hp: 450, mp: 50, spd: 15, mov: 4, rng: 1, str: 40, int: 10, vit: 30, agi: 35, dex: 40, vol: 10, luk: 20, def: 15, icon: '🥷', skills: [
        {id:'Ban1', name:'암습', mp:20, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.8, area:0, dmgType:'PHYS'}, sub:{type:'CRIT_UP', target:'SELF', mult:1.5, area:0, duration:2}},
        {id:'Ban2', name:'연막탄', mp:30, rng:3, cool:5, main:{type:'DMG', target:'AREA_ENEMY', mult:0.5, area:1, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'AREA_ENEMY', mult:0.7, area:1, duration:2}}
    ]},
    'BEAR': { name: '불곰', element: 'EARTH', level: 7, xp: 0, maxXp: 9999, hp: 900, mp: 0, spd: 6, mov: 3, rng: 1, str: 70, int: 0, vit: 80, agi: 5, dex: 10, vol: 20, luk: 10, def: 40, icon: '🐻', skills: [
        {id:'Bea1', name:'앞발치기', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.4, area:0, dmgType:'PHYS'}, sub:{type:'NUCKBACK', target:'ENEMY_SINGLE', mult:0, area:0, duration:0}},
        {id:'Bea2', name:'포효', mp:40, rng:0, cool:6, main:{type:'STUN', target:'AREA_ENEMY', mult:0, area:1, dmgType:'PHYS'}, sub:null}
    ]},
    'HARPY': { name: '하피', element: 'WIND', level: 7, xp: 0, maxXp: 9999, hp: 500, mp: 200, spd: 16, mov: 5, rng: 3, str: 30, int: 50, vit: 25, agi: 30, dex: 20, vol: 15, luk: 15, def: 15, icon: '🦅', skills: [
        {id:'H1', name:'깃털날리기', mp:20, rng:3, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'MAG'}, sub:null},
        {id:'H2', name:'유혹의노래', mp:50, rng:4, cool:6, main:{type:'SLEEP', target:'ENEMY_SINGLE', mult:0, area:0, dmgType:'MAG'}, sub:{type:'DEF_DOWN', target:'ENEMY_SINGLE', mult:0.7, area:0, duration:2}}
    ]},
    'GARGOYLE': { name: '가고일', element: 'EARTH', level: 8, xp: 0, maxXp: 9999, hp: 1000, mp: 0, spd: 5, mov: 3, rng: 1, str: 65, int: 0, vit: 100, agi: 5, dex: 5, vol: 10, luk: 5, def: 80, icon: '🦇', skills: [
        {id:'Ga1', name:'석화피부', mp:50, rng:0, cool:8, main:{type:'DEF_UP', target:'SELF', mult:2, area:0, dmgType:'PHYS'}, sub:null},
        {id:'Ga2', name:'낙하공격', mp:30, rng:1, cool:3, main:{type:'DMG', target:'ENEMY_SINGLE', mult:2, area:0, dmgType:'PHYS'}, sub:{type:'STUN', target:'ENEMY_SINGLE', mult:0, area:0, duration:1}}
    ]},
    'GHOST': { name: '유령', element: 'DARK', level: 8, xp: 0, maxXp: 9999, hp: 400, mp: 300, spd: 12, mov: 4, rng: 1, str: 10, int: 70, vit: 20, agi: 40, dex: 10, vol: 5, luk: 30, def: 10, icon: '👻', skills: [
        {id:'Gh1', name:'영혼공격', mp:20, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.3, area:0, dmgType:'MAG'}, sub:{type:'MP_DRAIN', target:'ENEMY_SINGLE', mult:0.2, area:0, duration:0}},
        {id:'Gh2', name:'투명화', mp:40, rng:0, cool:6, main:{type:'EVA_UP', target:'SELF', mult:0, area:0, dmgType:'MAG'}, sub:{type:'INVINCIBLE', target:'SELF', mult:0, area:0, duration:1}}
    ]},
    'WEREWOLF': { name: '늑대인간', element: 'WIND', level: 9, xp: 0, maxXp: 9999, hp: 1100, mp: 50, spd: 18, mov: 5, rng: 1, str: 80, int: 10, vit: 70, agi: 40, dex: 30, vol: 25, luk: 20, def: 30, icon: '🐺', skills: [
        {id:'We1', name:'광란', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.3, area:0, duration:3}},
        {id:'We2', name:'피의갈망', mp:40, rng:1, cool:4, main:{type:'DRAIN', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'PHYS'}, sub:{type:'ATK_UP', target:'SELF', mult:1.3, area:0, duration:3}}
    ]},
    'SUCCUBUS': { name: '서큐버스', element: 'DARK', level: 9, xp: 0, maxXp: 9999, hp: 700, mp: 400, spd: 14, mov: 4, rng: 2, str: 30, int: 80, vit: 40, agi: 30, dex: 25, vol: 15, luk: 30, def: 20, icon: '😈', skills: [
        {id:'Su1', name:'채찍질', mp:20, rng:2, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, area:0, dmgType:'MAG'}, sub:null},
        {id:'Su2', name:'매혹의키스', mp:60, rng:1, cool:5, main:{type:'SLEEP', target:'ENEMY_SINGLE', mult:0, area:0, dmgType:'MAG'}, sub:{type:'DRAIN', target:'SELF', mult:1.5, area:0, duration:0}}
    ]},
    'GOLEM': { name: '골렘', element: 'EARTH', level: 10, xp: 0, maxXp: 9999, hp: 2500, mp: 0, spd: 4, mov: 2, rng: 1, str: 100, int: 0, vit: 150, agi: 2, dex: 0, vol: 20, luk: 5, def: 120, icon: '🗿', skills: [
        {id:'Go1', name:'바위던지기', mp:0, rng:3, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.5, area:0, dmgType:'PHYS'}, sub:null},
        {id:'Go2', name:'지진', mp:50, rng:0, cool:6, main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'AREA_ENEMY', mult:0.5, area:1, duration:3}},
        {id:'Go3', name:'대지방벽', mp:80, rng:0, cool:10, main:{type:'SHLD', target:'SELF', mult:0, area:0, dmgType:'PHYS'}, sub:{type:'DEF_UP', target:'SELF', mult:2, area:0, duration:3}}
    ]},
    'TROLL': { name: '트롤', element: 'WATER', level: 10, xp: 0, maxXp: 9999, hp: 3000, mp: 50, spd: 7, mov: 3, rng: 1, str: 90, int: 10, vit: 180, agi: 10, dex: 10, vol: 30, luk: 10, def: 40, icon: '👺', skills: [
        {id:'Tr1', name:'몽둥이찜질', mp:20, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.4, area:0, dmgType:'PHYS'}, sub:{type:'STUN', target:'ENEMY_SINGLE', mult:0, area:0, duration:1}},
        {id:'Tr2', name:'재생력', mp:60, rng:0, cool:8, main:{type:'HEAL', target:'SELF', mult:0.4, area:0, dmgType:'PHYS'}, sub:{type:'PURIFY', target:'SELF', mult:0, area:0, duration:0}},
        {id:'Tr3', name:'산성토사물', mp:80, rng:2, cool:5, main:{type:'DMG', target:'LINE', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'DEF_DOWN', target:'LINE', mult:0.5, area:0, duration:3}}
    ]},
    'MINOTAUR': { name: '미노타우루스', element: 'FIRE', level: 11, xp: 0, maxXp: 9999, hp: 2800, mp: 100, spd: 12, mov: 4, rng: 1, str: 110, int: 10, vit: 120, agi: 20, dex: 20, vol: 20, luk: 10, def: 50, icon: '🐂', skills: [
        {id:'Mi1', name:'도끼휘두르기', mp:0, rng:1, cool:0, main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'PHYS'}, sub:null},
        {id:'Mi2', name:'격분', mp:40, rng:0, cool:5, main:{type:'ATK_UP', target:'SELF', mult:1.5, area:0, dmgType:'PHYS'}, sub:{type:'SPD_UP', target:'SELF', mult:1.3, area:0, duration:3}},
        {id:'Mi3', name:'대지분쇄', mp:100, rng:0, cool:8, main:{type:'DMG', target:'AREA_ENEMY', mult:2, area:2, dmgType:'PHYS'}, sub:{type:'STUN', target:'AREA_ENEMY', mult:0, area:2, duration:1}}
    ]},
    'DULLAHAN': { name: '듀라한', element: 'DARK', level: 12, xp: 0, maxXp: 9999, hp: 2200, mp: 200, spd: 14, mov: 5, rng: 2, str: 120, int: 30, vit: 100, agi: 30, dex: 30, vol: 10, luk: 5, def: 70, icon: '🎃', skills: [
        {id:'Du1', name:'죽음의일격', mp:30, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:2, area:0, dmgType:'PHYS'}, sub:null},
        {id:'Du2', name:'공포의비명', mp:60, rng:0, cool:6, main:{type:'DMG', target:'AREA_ENEMY', mult:0.5, area:2, dmgType:'PHYS'}, sub:{type:'ATK_DOWN', target:'AREA_ENEMY', mult:0.7, area:2, duration:3}},
        {id:'Du3', name:'참수', mp:120, rng:1, cool:10, main:{type:'DMG', target:'ENEMY_SINGLE', mult:3, area:0, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.5, area:0, duration:5}}
    ]},
    'TREANT': { name: '트리언트', element: 'EARTH', level: 13, xp: 0, maxXp: 9999, hp: 4000, mp: 300, spd: 5, mov: 2, rng: 2, str: 130, int: 50, vit: 200, agi: 5, dex: 10, vol: 15, luk: 20, def: 90, icon: '🌳', skills: [
        {id:'Tre1', name:'가지치기', mp:0, rng:2, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.3, area:0, dmgType:'PHYS'}, sub:null},
        {id:'Tre2', name:'뿌리묶기', mp:50, rng:4, cool:5, main:{type:'DMG', target:'ENEMY_SINGLE', mult:0.8, area:0, dmgType:'PHYS'}, sub:{type:'ROOT', target:'ENEMY_SINGLE', mult:0, area:0, duration:3}},
        {id:'Tre3', name:'자연의분노', mp:150, rng:0, cool:10, main:{type:'DMG', target:'AREA_ENEMY', mult:1.5, area:99, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'AREA_ENEMY', mult:0.5, area:99, duration:3}}
    ]},
    'VAMPIRE': { name: '뱀파이어', element: 'DARK', level: 14, xp: 0, maxXp: 9999, hp: 1800, mp: 500, spd: 16, mov: 5, rng: 2, str: 80, int: 120, vit: 80, agi: 50, dex: 40, vol: 20, luk: 30, def: 40, icon: '🧛', skills: [
        {id:'Va1', name:'흡혈', mp:40, rng:2, cool:0, main:{type:'DRAIN', target:'ENEMY_SINGLE', mult:1.5, area:0, dmgType:'MAG'}, sub:null},
        {id:'Va2', name:'박쥐떼', mp:80, rng:4, cool:5, main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'MAG'}, sub:{type:'BLEED', target:'AREA_ENEMY', mult:0.2, area:1, duration:3}},
        {id:'Va3', name:'피의축제', mp:200, rng:0, cool:10, main:{type:'DMG', target:'AREA_ENEMY', mult:2.5, area:99, dmgType:'MAG'}, sub:{type:'DRAIN', target:'SELF', mult:1, area:0, duration:0}}
    ]},
    'DRAKE': { name: '드레이크', element: 'FIRE', level: 15, xp: 0, maxXp: 9999, hp: 5000, mp: 600, spd: 15, mov: 4, rng: 3, str: 150, int: 100, vit: 200, agi: 30, dex: 30, vol: 30, luk: 20, def: 80, icon: '🐉', skills: [
        {id:'Dr1', name:'화염숨결', mp:50, rng:4, cool:3, main:{type:'DMG', target:'LINE', mult:1.8, area:0, dmgType:'MAG'}, sub:{type:'BURN', target:'LINE', mult:0.3, area:0, duration:3}},
        {id:'Dr2', name:'날개치기', mp:80, rng:0, cool:5, main:{type:'DMG', target:'AREA_ENEMY', mult:1.2, area:1, dmgType:'MAG'}, sub:{type:'NUCKBACK', target:'AREA_ENEMY', mult:0, area:1, duration:0}},
        {id:'Dr3', name:'인페르노', mp:250, rng:6, cool:12, main:{type:'DMG', target:'AREA_ENEMY', mult:2.5, area:2, dmgType:'MAG'}, sub:{type:'BURN', target:'AREA_ENEMY', mult:0.5, area:2, duration:5}}
    ]},
    'LICH': { name: '리치', element: 'DARK', level: 16, xp: 0, maxXp: 9999, hp: 2500, mp: 999, spd: 13, mov: 3, rng: 5, str: 50, int: 200, vit: 100, agi: 40, dex: 50, vol: 30, luk: 40, def: 50, icon: '💀', skills: [
        {id:'Li1', name:'어둠의구체', mp:40, rng:5, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:2, area:0, dmgType:'MAG'}, sub:null},
        {id:'Li2', name:'죽음의손길', mp:100, rng:4, cool:5, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.5, area:0, dmgType:'MAG'}, sub:{type:'SILENCE', target:'ENEMY_SINGLE', mult:0, area:0, duration:3}},
        {id:'Li3', name:'아마겟돈', mp:300, rng:0, cool:15, main:{type:'DMG', target:'AREA_ENEMY', mult:3, area:99, dmgType:'MAG'}, sub:{type:'CURSE', target:'AREA_ENEMY', mult:0, area:99, duration:99}}
    ]},
    'KRAKEN': { name: '크라켄', element: 'WATER', level: 17, xp: 0, maxXp: 9999, hp: 6000, mp: 400, spd: 8, mov: 3, rng: 2, str: 180, int: 80, vit: 300, agi: 10, dex: 20, vol: 25, luk: 10, def: 100, icon: '🦑', skills: [
        {id:'Kr1', name:'촉수강타', mp:0, rng:2, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.6, area:0, dmgType:'PHYS'}, sub:null},
        {id:'Kr2', name:'먹물뿜기', mp:80, rng:4, cool:6, main:{type:'DMG', target:'AREA_ENEMY', mult:1, area:2, dmgType:'PHYS'}, sub:{type:'BLIND', target:'AREA_ENEMY', mult:0, area:2, duration:3}},
        {id:'Kr3', name:'대해일', mp:250, rng:0, cool:12, main:{type:'DMG', target:'AREA_ENEMY', mult:2.5, area:99, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'AREA_ENEMY', mult:0.2, area:99, duration:5}}
    ]},
    'PHOENIX': { name: '피닉스', element: 'FIRE', level: 18, xp: 0, maxXp: 9999, hp: 4000, mp: 800, spd: 20, mov: 6, rng: 4, str: 100, int: 180, vit: 150, agi: 60, dex: 50, vol: 40, luk: 50, def: 60, icon: '🦅', skills: [
        {id:'Ph1', name:'불꽃깃털', mp:50, rng:5, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:2.2, area:0, dmgType:'MAG'}, sub:{type:'BURN', target:'ENEMY_SINGLE', mult:0.2, area:0, duration:3}},
        {id:'Ph2', name:'화염폭풍', mp:120, rng:0, cool:6, main:{type:'DMG', target:'AREA_ENEMY', mult:1.8, area:2, dmgType:'MAG'}, sub:{type:'BURN', target:'AREA_ENEMY', mult:0.3, area:2, duration:3}},
        {id:'Ph3', name:'부활의불꽃', mp:300, rng:0, cool:20, main:{type:'HEAL', target:'SELF', mult:1, area:0, dmgType:'MAG'}, sub:{type:'PURIFY', target:'SELF', mult:0, area:0, duration:0}}
    ]},
    'BEHEMOTH': { name: '베히모스', element: 'EARTH', level: 19, xp: 0, maxXp: 9999, hp: 10000, mp: 200, spd: 6, mov: 3, rng: 1, str: 250, int: 50, vit: 500, agi: 10, dex: 10, vol: 30, luk: 10, def: 200, icon: '🦏', skills: [
        {id:'Be1', name:'뿔받기', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:2, area:0, dmgType:'PHYS'}, sub:{type:'NUCKBACK', target:'ENEMY_SINGLE', mult:0, area:0, duration:0}},
        {id:'Be2', name:'대지진', mp:150, rng:0, cool:8, main:{type:'DMG', target:'AREA_ENEMY', mult:1.5, area:99, dmgType:'PHYS'}, sub:{type:'STUN', target:'AREA_ENEMY', mult:0, area:99, duration:1}},
        {id:'Be3', name:'격분', mp:200, rng:0, cool:12, main:{type:'ATK_UP', target:'SELF', mult:3, area:0, dmgType:'PHYS'}, sub:{type:'DEF_DOWN', target:'SELF', mult:0.5, area:0, duration:5}}
    ]},
    'DRAGON': { name: '드래곤', element: 'LIGHT', level: 20, xp: 0, maxXp: 9999, hp: 15000, mp: 1000, spd: 15, mov: 5, rng: 4, str: 200, int: 200, vit: 400, agi: 50, dex: 50, vol: 50, luk: 50, def: 150, icon: '🐲', skills: [
        {id:'Drg1', name:'용의발톱', mp:0, rng:2, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:2, area:0, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.2, area:0, duration:3}},
        {id:'Drg2', name:'드래곤브레스', mp:150, rng:6, cool:5, main:{type:'DMG', target:'LINE', mult:2.5, area:0, dmgType:'MAG'}, sub:{type:'BURN', target:'LINE', mult:0.5, area:0, duration:3}},
        {id:'Drg3', name:'천지창조', mp:500, rng:0, cool:15, main:{type:'DMG', target:'AREA_ENEMY', mult:4, area:99, dmgType:'MAG'}, sub:{type:'STUN', target:'AREA_ENEMY', mult:0, area:99, duration:2}}
    ]}
};

export const HEX_SIZE = 40;
