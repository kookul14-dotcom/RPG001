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
    'agi': "민첩", 'dex': "손재주", 'def': "방어"
};

export const EFFECTS = {
    'NONE':       { icon: '', name: '없음', type: 'system', desc: '효과 없음' },
    'DMG':        { icon: '💥', name: '피해', type: 'instant', desc: '피해를 입힙니다' },
    'HEAL':       { icon: '💚', name: '회복', type: 'instant', desc: '체력을 회복합니다' },
    'PURIFY':     { icon: '✨', name: '정화', type: 'instant', desc: '해로운 효과 제거' },
    'NUCKBACK':   { icon: '🔙', name: '넉백', type: 'instant', desc: '뒤로 밀려납니다' },
    'SHLD':       { icon: '🛡️', name: '보호막', type: 'buff', desc: '피해 흡수' },
    
    // 버프
    'ATK_UP':     { icon: '⚔️', name: '공격UP', type: 'buff', desc: '공격력 증가' },
    'DEF_UP':     { icon: '🛡️', name: '방어UP', type: 'buff', desc: '방어력 증가' },
    'CRIT_UP':    { icon: '🎯', name: '치명타', type: 'buff', desc: '치명타 확률 증가' },
    'INVINCIBLE': { icon: '💎', name: '무적', type: 'buff', desc: '피해 무시' },
    'DRAIN':      { icon: '🧛', name: '흡혈', type: 'buff', desc: '피해량의 일부 회복' },
    
    // 디버프
    'STUN':       { icon: '💫', name: '기절', type: 'debuff', desc: '아무 행동 못함' },
    'FREEZE':     { icon: '❄️', name: '빙결', type: 'debuff', desc: '이동불가, 피격 시 2배 피해 후 해제' },
    'SLEEP':      { icon: '💤', name: '수면', type: 'debuff', desc: '행동 불가, 피격 시 해제' },
    'BURN':       { icon: '🔥', name: '화상', type: 'debuff', desc: '지속 피해, 방어 감소, 주변 전염' },
    'POISON':     { icon: '☠️', name: '맹독', type: 'debuff', desc: '체력 비례 지속 피해' },
    'BLEED':      { icon: '🩸', name: '출혈', type: 'debuff', desc: '이동 시 피해' },
    'SPD_DOWN':   { icon: '🐢', name: '감속', type: 'debuff', desc: '턴 늦게 옴' },
    'SILENCE':    { icon: '😶', name: '침묵', type: 'debuff', desc: '스킬 사용 불가' },
    'ROOT':       { icon: '🕸️', name: '속박', type: 'debuff', desc: '이동 불가' },
    'SHOCK':      { icon: '⚡', name: '감전', type: 'debuff', desc: '쿨타임 멈춤' },
    'TAUNT':      { icon: '🤬', name: '도발', type: 'debuff', desc: '강제 타겟팅' },
    'CONFUSE':    { icon: '😵', name: '혼란', type: 'debuff', desc: '랜덤 이동/공격' },
    
    'ATK_DOWN':   { icon: '📉', name: '공격DOWN', type: 'debuff', desc: '공격력 감소' },
    'DEF_DOWN':   { icon: '💔', name: '방어DOWN', type: 'debuff', desc: '방어력 감소' }
};

export const ITEM_DATA = {
    'POTION_S': { name: '하급 물약', type: 'POTION', cost: 50, val: 50, desc: '체력 +50 (패시브)', icon: '🍷', jobs: [] },
    'POTION_M': { name: '중급 물약', type: 'POTION', cost: 150, val: 150, desc: '체력 +150 (패시브)', icon: '🧪', jobs: [] },
    'SWORD_WOOD': { name: '목검', type: 'WEAPON', cost: 100, val: 5, desc: '공격력 +5', icon: '🗡️', jobs: ['KNIGHT', 'BARBARIAN', 'PALADIN', 'ROGUE', 'SLIME', 'GOBLIN', 'ORC'] },
    'SWORD_IRON': { name: '철검', type: 'WEAPON', cost: 500, val: 15, desc: '공격력 +15', icon: '⚔️', jobs: ['KNIGHT', 'BARBARIAN', 'PALADIN'] },
    'DAGGER': { name: '단검', type: 'WEAPON', cost: 400, val: 12, desc: '공격력 +12', icon: '🔪', jobs: ['ROGUE', 'ARCHER'] },
    'STAFF_WOOD': { name: '나무 지팡이', type: 'WEAPON', cost: 100, val: 5, desc: '지능 +5', icon: '🪄', jobs: ['MAGE', 'CLERIC', 'WARLOCK'] },
    'STAFF_RUBY': { name: '루비 지팡이', type: 'WEAPON', cost: 600, val: 20, desc: '지능 +20', icon: '🔥', jobs: ['MAGE', 'WARLOCK'] },
    'BOW_SHORT': { name: '숏보우', type: 'WEAPON', cost: 150, val: 8, desc: '공격력 +8', icon: '🏹', jobs: ['ARCHER', 'ROGUE'] },
    'ARMOR_LEATHER': { name: '가죽 갑옷', type: 'ARMOR', cost: 200, val: 3, desc: '방어력 +3', icon: '👕', jobs: [] },
    'ARMOR_CHAIN': { name: '사슬 갑옷', type: 'ARMOR', cost: 600, val: 8, desc: '방어력 +8', icon: '⛓️', jobs: ['KNIGHT', 'PALADIN', 'BARBARIAN'] },
    'ROBE_SILK': { name: '비단 로브', type: 'ARMOR', cost: 300, val: 4, desc: '방어 +4', icon: '👘', jobs: ['MAGE', 'CLERIC', 'WARLOCK'] },
    'RING_STR': { name: '힘의 반지', type: 'ACC', cost: 400, val: 3, stat:'str', desc: '힘 +3', icon: '💍', jobs: [] },
    'RING_INT': { name: '지능의 반지', type: 'ACC', cost: 400, val: 3, stat:'int', desc: '지능 +3', icon: '🔮', jobs: [] },
    'AMULET_HP': { name: '생명 목걸이', type: 'ACC', cost: 500, val: 50, stat:'hp', desc: '체력 +50', icon: '📿', jobs: [] }
};

export const STAGE_DATA = {
    1: { 
        1: { enemies: ['SLIME', 'SLIME'], rewardGold: 100, firstReward: 'POTION_S', desc: '슬라임 서식지' },
        2: { enemies: ['SLIME', 'SLIME', 'SLIME'], rewardGold: 120, desc: '더 많은 슬라임' },
        3: { enemies: ['GOBLIN', 'SLIME'], rewardGold: 150, firstReward: 'SWORD_WOOD', desc: '고블린 정찰병' },
        4: { enemies: ['GOBLIN', 'GOBLIN'], rewardGold: 180, desc: '고블린 부락' },
        5: { enemies: ['ORC', 'GOBLIN'], rewardGold: 300, firstReward: 'RING_STR', desc: '중간 보스: 오크', boss: true },
        6: { enemies: ['SKELETON', 'SKELETON'], rewardGold: 200, desc: '해골 무덤' },
        7: { enemies: ['SKELETON', 'GOBLIN', 'SLIME'], rewardGold: 220, desc: '혼종 부대' },
        8: { enemies: ['ORC', 'ORC'], rewardGold: 350, firstReward: 'ARMOR_LEATHER', desc: '오크 쌍둥이' },
        9: { enemies: ['GOLEM'], rewardGold: 400, desc: '바위 거인' },
        10: { enemies: ['DRAKE', 'ORC', 'ORC'], rewardGold: 1000, firstReward: 'SWORD_IRON', desc: '챕터 보스: 드레이크', boss: true }
    }
};

export const CLASS_DATA = {
    'KNIGHT': { name: '발레리우스', atkType: 'PHYS', element: 'EARTH', level: 1, xp: 200, maxXp: 100, hp: 300, mp: 50, spd: 9, mov: 3, rng: 1, str: 20, int: 5, vit: 20, agi: 8, def: 15, dex: 10, icon: '🛡️', skills: [{ id: 'K1', name: '강타', mp: 15, rng: 1, cool: 0, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 1.6, dmgType: 'PHYS' }, desc: '[물리] 힘 기반 160% 피해', icon:'🗡️' },{ id: 'K2', name: '방패밀치기', mp: 20, rng: 1, cool: 3, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 1.2, dmgType: 'PHYS' }, sub: { type: 'STUN', target: 'ENEMY_SINGLE', duration: 1 }, desc: '[물리] 피해 + 기절', icon:'🛑' },{ id: 'K6', name: '철벽', mp: 50, rng: 0, cool: 5, main: { type: 'DEF_UP', target: 'SELF', mult: 2, duration: 2 }, sub: { type: 'TAUNT', target: 'AREA_ENEMY', area: 5, duration: 3 }, desc: '방어 2배 + 광역 도발', icon:'🏰' }]},
    'MAGE': { name: '탈릭', atkType: 'MAG', element: 'FIRE', level: 1, xp: 0, maxXp: 100, hp: 150, mp: 200, spd: 11, mov: 2, rng: 4, str: 5, int: 30, vit: 8, agi: 10, def: 5, dex: 12, icon: '🧙‍♂️', skills: [{ id: 'M1', name: '화염구', mp: 30, rng: 5, cool: 0, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 2.2, dmgType: 'MAG' }, desc: '[마법] 지능 기반 220% 화염', icon:'🔥' },{ id: 'M2', name: '눈보라', mp: 50, rng: 5, cool: 4, main: { type: 'DMG', target: 'AREA_ENEMY', mult: 1.4, area: 1, dmgType: 'MAG' }, sub: { type: 'SPD_DOWN', target: 'AREA_ENEMY', mult: 0.5, area: 1, duration: 2 }, desc: '[마법] 광역 빙결 피해 + 감속', icon:'❄️' },{ id: 'M6', name: '메테오', mp: 180, rng: 7, cool: 8, main: { type: 'DMG', target: 'AREA_ENEMY', mult: 3.0, area: 2, dmgType: 'MAG' }, sub: { type: 'BURN', target: 'AREA_ENEMY', mult: 0.2, area: 2, duration: 3 }, desc: '[마법] 초광역 화염 + 화상', icon:'☄️' }]},
    'ARCHER': { name: '카엘렌', atkType: 'PHYS', element: 'WIND', level: 1, xp: 0, maxXp: 100, hp: 180, mp: 80, spd: 13, mov: 3, rng: 6, str: 22, int: 8, vit: 10, agi: 20, def: 8, dex: 25, icon: '🏹', skills: [{ id: 'A1', name: '조준사격', mp: 20, rng: 7, cool: 0, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 2.5, dmgType: 'PHYS' }, desc: '[물리] 장거리 저격', icon:'🎯' },{ id: 'A2', name: '화살비', mp: 35, rng: 5, cool: 3, main: { type: 'DMG', target: 'AREA_ENEMY', mult: 1.2, area: 1, dmgType: 'PHYS' }, desc: '[물리] 범위 화살 공격', icon:'🌦️' },{ id: 'A6', name: '바람의춤', mp: 60, rng: 10, cool: 5, main: { type: 'DMG', target: 'LINE', mult: 1.8, dmgType: 'PHYS' }, sub: { type: 'BLEED', target: 'LINE', mult: 0.2, duration: 3 }, desc: '[물리] 직선 관통 + 출혈', icon:'🌪️' }]},
    'CLERIC': { name: '베네딕트', atkType: 'MAG', element: 'LIGHT', level: 1, xp: 0, maxXp: 100, hp: 200, mp: 180, spd: 10, mov: 2, rng: 3, str: 8, int: 22, vit: 15, agi: 8, def: 10, dex: 8, icon: '✝️', skills: [{ id: 'C1', name: '치유', mp: 30, rng: 3, cool: 0, main: { type: 'HEAL', target: 'ALLY_SINGLE', mult: 2.5, dmgType: 'MAG' }, desc: '[마법] 아군 단일 회복', icon:'💚' },{ id: 'C2', name: '성스러운빛', mp: 25, rng: 3, cool: 2, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 1.5, dmgType: 'MAG' }, desc: '[마법] 신성 피해', icon:'✨' },{ id: 'C6', name: '구원', mp: 150, rng: 0, cool: 8, main: { type: 'HEAL', target: 'ALLY_ALL', mult: 2.0, area: 99, dmgType: 'MAG' }, sub: { type: 'PURIFY', target: 'ALLY_ALL', area: 99 }, desc: '전체 회복 + 정화', icon:'🙌' }]},
    'BARBARIAN': { name: '볼가드', atkType: 'PHYS', element: 'EARTH', level: 1, xp: 0, maxXp: 100, hp: 400, mp: 30, spd: 10, mov: 4, rng: 1, str: 28, int: 2, vit: 25, agi: 12, def: 10, dex: 15, icon: '🪓', skills: [{ id: 'B1', name: '회전베기', mp: 20, rng: 1, cool: 0, main: { type: 'DMG', target: 'AREA_ENEMY', mult: 1.5, area: 1, dmgType: 'PHYS' }, desc: '[물리] 주변 광역 공격', icon:'🌀' },{ id: 'B2', name: '전투함성', mp: 25, rng: 0, cool: 3, main: { type: 'ATK_UP', target: 'ALLY_ALL', mult: 1.3, area: 2, duration: 2 }, desc: '아군 공격력 증가', icon:'📢' },{ id: 'B6', name: '광전사', mp: 40, rng: 0, cool: 6, main: { type: 'ATK_UP', target: 'SELF', mult: 2.0, duration: 3 }, sub: { type: 'DEF_DOWN', target: 'SELF', mult: 0.5, duration: 3 }, desc: '공격 2배, 방어 반감', icon:'👹' }]},
    'ROGUE': { name: '모르간', atkType: 'PHYS', element: 'WIND', level: 1, xp: 0, maxXp: 100, hp: 200, mp: 100, spd: 16, mov: 5, rng: 1, str: 20, int: 8, vit: 12, agi: 25, def: 8, dex: 30, icon: '🗡️', skills: [{ id: 'R1', name: '기습', mp: 20, rng: 1, cool: 0, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 2.0, dmgType: 'PHYS' }, sub: { type: 'CRIT_UP', target: 'SELF', mult: 1.5, duration: 2 }, desc: '[물리] 높은 피해 + 치명타', icon:'⚡' },{ id: 'R2', name: '독바르기', mp: 30, rng: 1, cool: 2, main: { type: 'POISON', target: 'ENEMY_SINGLE', mult: 0.3, duration: 5 }, desc: '강력한 맹독 부여', icon:'🧪' },{ id: 'R6', name: '그림자춤', mp: 70, rng: 6, cool: 6, main: { type: 'POISON', target: 'AREA_ENEMY', mult: 0.3, area: 3, duration: 5 }, desc: '광역 중독', icon:'🎭' }]},
    'WARLOCK': { name: '말라코르', atkType: 'MAG', element: 'DARK', level: 1, xp: 0, maxXp: 100, hp: 180, mp: 220, spd: 10, mov: 2, rng: 4, str: 5, int: 28, vit: 10, agi: 9, def: 6, dex: 10, icon: '💀', skills: [{ id: 'W1', name: '어둠화살', mp: 20, rng: 5, cool: 1, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 1.3, dmgType: 'MAG' }, sub: { type: 'SILENCE', target: 'ENEMY_SINGLE', duration: 2 }, desc: '[마법] 피해 + 침묵', icon:'🌘' },{ id: 'W2', name: '영혼흡수', mp: 40, rng: 4, cool: 2, main: { type: 'DRAIN', target: 'ENEMY_SINGLE', mult: 1.5, dmgType: 'MAG' }, desc: '[마법] 적 체력 흡수', icon:'🧛' },{ id: 'W6', name: '영혼수확', mp: 130, rng: 1, cool: 5, main: { type: 'DMG', target: 'AREA_ENEMY', mult: 1.5, area: 99, dmgType: 'MAG' }, sub: { type: 'HEAL', target: 'ALLY_ALL', mult: 0.5, area: 99, dmgType: 'MAG' }, desc: '[마법] 적 전체 피해, 아군 전체 힐', icon:'🕸️' }]},
    'PALADIN': { name: '레오데간', atkType: 'PHYS', element: 'LIGHT', level: 1, xp: 0, maxXp: 100, hp: 350, mp: 120, spd: 8, mov: 3, rng: 1, str: 18, int: 15, vit: 25, agi: 6, def: 20, dex: 8, icon: '⚜️', skills: [{ id: 'P1', name: '신성강타', mp: 25, rng: 1, cool: 0, main: { type: 'DMG', target: 'ENEMY_SINGLE', mult: 1.8, dmgType: 'PHYS' }, desc: '[물리] 신성 피해', icon:'🔨' },{ id: 'P2', name: '축복', mp: 30, rng: 3, cool: 2, main: { type: 'DEF_UP', target: 'ALLY_SINGLE', mult: 1.5, duration: 2 }, desc: '방어력 증가', icon:'🙏' },{ id: 'P6', name: '신의결계', mp: 100, rng: 0, cool: 10, main: { type: 'INVINCIBLE', target: 'ALLY_ALL', area: 99, duration: 2 }, desc: '아군 전체 무적', icon:'🛡️' }]},

    // 몬스터
    // [수정] 슬라임 HP 300으로 감소
    'SLIME': { name: '슬라임', atkType: 'PHYS', element: 'WATER', level: 1, xp: 0, maxXp: 0, hp: 300, mp: 50, spd: 5, mov: 2, rng: 1, str: 15, int: 0, vit: 40, agi: 2, def: 10, dex: 0, icon: '🟢', skills: [{id:'m1', name:'점액', mp:0, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1, dmgType:'PHYS'}, sub:{type:'SPD_DOWN', target:'ENEMY_SINGLE', mult:0.5, duration:2}}]},
    'GOBLIN': { name: '고블린', atkType: 'PHYS', element: 'WIND', level: 1, xp: 0, maxXp: 0, hp: 180, mp: 30, spd: 14, mov: 4, rng: 1, str: 20, int: 0, vit: 10, agi: 20, def: 5, dex: 15, icon: '👺', skills: [{id:'m2', name:'베기', mp:10, rng:1, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.2, dmgType:'PHYS'}, sub:{type:'BLEED', target:'ENEMY_SINGLE', mult:0.2, duration:3}}]},
    'ORC': { name: '오크', atkType: 'PHYS', element: 'EARTH', level: 2, xp: 0, maxXp: 0, hp: 500, mp: 20, spd: 7, mov: 3, rng: 1, str: 35, int: 0, vit: 30, agi: 5, def: 25, dex: 5, icon: '👹', skills: [{id:'m3', name:'강타', mp:20, rng:1, cool:3, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.8, dmgType:'PHYS'}, sub:{type:'STUN', target:'ENEMY_SINGLE', duration:1}}]},
    'SKELETON': { name: '스켈레톤', atkType: 'PHYS', element: 'DARK', level: 1, xp: 0, maxXp: 0, hp: 150, mp: 0, spd: 12, mov: 3, rng: 3, str: 25, int: 0, vit: 5, agi: 15, def: 5, dex: 10, icon: '☠️', skills: [{id:'m4', name:'뼈던지기', mp:0, rng:3, cool:0, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1, dmgType:'PHYS'}}]},
    'DRAKE': { name: '드레이크', atkType: 'MAG', element: 'FIRE', level: 5, xp: 0, maxXp: 0, hp: 800, mp: 200, spd: 9, mov: 3, rng: 3, str: 45, int: 30, vit: 50, agi: 8, def: 30, dex: 10, icon: '🐉', skills: [{id:'m5', name:'브레스', mp:50, rng:5, cool:4, main:{type:'DMG', target:'LINE', mult:1.5, dmgType:'MAG'}, sub:{type:'BURN', target:'LINE', mult:0.2, duration:3}}]},
    'LICH': { name: '리치', atkType: 'MAG', element: 'DARK', level: 5, xp: 0, maxXp: 0, hp: 350, mp: 500, spd: 10, mov: 2, rng: 4, str: 10, int: 50, vit: 20, agi: 10, def: 10, dex: 5, icon: '💀', skills: [{id:'m6', name:'죽음', mp:40, rng:5, cool:2, main:{type:'DMG', target:'ENEMY_SINGLE', mult:1.5, dmgType:'MAG'}, sub:{type:'SILENCE', target:'ENEMY_SINGLE', duration:2}}]},
    'GOLEM': { name: '골렘', atkType: 'PHYS', element: 'EARTH', level: 4, xp: 0, maxXp: 0, hp: 1000, mp: 0, spd: 4, mov: 2, rng: 1, str: 40, int: 0, vit: 60, agi: 1, def: 80, dex: 0, icon: '🗿', skills: [{id:'m7', name:'쿵', mp:0, rng:0, cool:5, main:{type:'STUN', target:'AREA_ENEMY', area:1, duration:1}}]},
    'SUCCUBUS': { name: '서큐버스', atkType: 'MAG', element: 'DARK', level: 3, xp: 0, maxXp: 0, hp: 300, mp: 200, spd: 13, mov: 4, rng: 2, str: 20, int: 40, vit: 15, agi: 25, def: 10, dex: 20, icon: '😈', skills: [{id:'m8', name:'유혹', mp:40, rng:4, cool:4, main:{type:'SLEEP', target:'ENEMY_SINGLE', duration:2}, sub:{type:'DRAIN', target:'SELF', mult:1.0, dmgType:'MAG'}}]}
};

export const HEX_SIZE = 40;