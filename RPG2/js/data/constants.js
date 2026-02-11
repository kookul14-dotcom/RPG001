export const HEX_SIZE = 40;
export const TIER_REQ = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 15 };
export const STAT_NAMES = {
    'str': "힘", 'int': "지능", 'vit': "체력",
    'agi': "민첩", 'dex': "숙련", 'vol': "변동", 'luk': "운",
};

export const ELEMENTS = {
    'FIRE': { name: '화염', icon: '🔥', weak: 'WATER', strong: 'WIND' },
    'WATER': { name: '냉기', icon: '💧', weak: 'EARTH', strong: 'FIRE' },
    'EARTH': { name: '대지', icon: '🪨', weak: 'WIND', strong: 'WATER' },
    'WIND': { name: '바람', icon: '🌪️', weak: 'FIRE', strong: 'EARTH' },
    'LIGHT': { name: '신성', icon: '✨', weak: 'DARK', strong: 'DARK' }, 
    'DARK': { name: '암흑', icon: '💀', weak: 'LIGHT', strong: 'LIGHT' },
    'NONE': { name: '무속성', icon: '⚪', weak: '', strong: '' }
};

export const EFFECTS = {
    // ==========================================
    // 1. 기본 시스템 & 즉발 효과 (Instant)
    // ==========================================
    'NONE':             { icon: '', name: '없음', type: 'system', desc: '효과 없음' },
    'DMG':              { icon: '💥', name: '피해', type: 'instant', desc: '피해를 입힙니다' },
    'DMG_PHYS':         { icon: '⚔️', name: '물리피해', type: 'instant', desc: '물리 속성 데미지' },
    'DMG_MAG':          { icon: '🔮', name: '마법피해', type: 'instant', desc: '마법 속성 데미지' },
    'DMG_HOLY':         { icon: '✨', name: '신성피해', type: 'instant', desc: '신성 속성 데미지' },
    'DMG_AOE':          { icon: '💥', name: '광역피해', type: 'instant', desc: '넓은 범위 공격' },
    'ATK_MULTI':        { icon: '💨', name: '연속공격', type: 'instant', desc: '여러 번 타격' },
    'ATK_AOE':          { icon: '🌊', name: '범위공격', type: 'instant', desc: '다수의 적 타격' },
    'ATK_CHAIN':        { icon: '⚡', name: '체인', type: 'instant', desc: '주변 적에게 전이' },
    'ATK_SUREHIT':      { icon: '🎯', name: '필중', type: 'instant', desc: '회피 불가능' },
    'ATK_PENETRATE':    { icon: '🛡️', name: '관통', type: 'instant', desc: '방어력 무시' },
    'ATK_EXECUTE':      { icon: '💀', name: '처형', type: 'instant', desc: '체력이 낮으면 즉사' },
    'ATK_DEF_SCALE':    { icon: '🏰', name: '방어비례', type: 'instant', desc: '방어력만큼 데미지 추가' },
    'ATK_DIST':         { icon: '📏', name: '원거리', type: 'instant', desc: '거리 비례 데미지' },
    'ATK_MOVE':         { icon: '🏃', name: '돌진공격', type: 'instant', desc: '이동하며 공격' },
    'ATK_JUMP':         { icon: '🦅', name: '도약공격', type: 'instant', desc: '장애물 무시 공격' },
    'ATK_DASH':         { icon: '💨', name: '대시공격', type: 'instant', desc: '관통 이동 공격' },
    'HEAL_HP':          { icon: '💚', name: '회복', type: 'instant', desc: '체력을 회복합니다' },
    'HEAL_MP':          { icon: '💙', name: '마나회복', type: 'instant', desc: 'MP를 회복합니다' },
    'HEAL_FULL':        { icon: '💖', name: '완전회복', type: 'instant', desc: '체력 100% 회복' },
    'HEAL_AOE':         { icon: '⛲', name: '광역치유', type: 'instant', desc: '범위 회복' },
    'CLEANSE':          { icon: '✨', name: '정화', type: 'instant', desc: '해로운 효과 제거' },
    'REVIVE':           { icon: '👼', name: '부활', type: 'instant', desc: '전투 불능 회복' },
    'COOL_DOWN':        { icon: '⌛', name: '쿨초기화', type: 'instant', desc: '스킬 쿨타임 제거' },
    'COST_HP':          { icon: '🩸', name: '혈주', type: 'instant', desc: 'HP 소모' },

    // ==========================================
    // 2. 이동 및 위치 제어 (Move & Position)
    // ==========================================
    'CC_KNUCKBACK':     { icon: '🔙', name: '넉백', type: 'instant', desc: '뒤로 밀려납니다' }, // 기존 유지
    'MOVE_FREE':        { icon: '🕊️', name: '자유이동', type: 'instant', desc: '행동력 소모 없음' },
    'MOVE_BACK':        { icon: '🔙', name: '후퇴', type: 'instant', desc: '뒤로 이동' },
    'MOVE_BEHIND':      { icon: '👻', name: '배후이동', type: 'instant', desc: '적 등 뒤로 이동' },
    'MOVE_SWAP':        { icon: '🔄', name: '위치교환', type: 'instant', desc: '대상과 위치 변경' },
    'MOVE_TELEPORT':    { icon: '🌀', name: '순간이동', type: 'instant', desc: '즉시 이동' },

    // ==========================================
    // 3. 버프 (Buffs - Positive Status)
    // ==========================================
    // 3-1. 능력치 강화
    'BUFF_ATK':         { icon: '⚔️', name: '공격UP', type: 'buff', desc: '공격력 증가' },
    'BUFF_DEF':         { icon: '🛡️', name: '방어UP', type: 'buff', desc: '방어력 증가' },
    'BUFF_CRIT':        { icon: '🎯', name: '치명타UP', type: 'buff', desc: '치명타 확률 증가' },
    'BUFF_CRIT_DMG':    { icon: '💥', name: '치명피해UP', type: 'buff', desc: '치명타 피해량 증가' },
    'BUFF_EVA':         { icon: '💨', name: '회피UP', type: 'buff', desc: '회피율 증가' },
    'BUFF_SPD':         { icon: '⚡', name: '신속', type: 'buff', desc: '행동 속도 증가' },
    'BUFF_ACC':         { icon: '🎯', name: '명중UP', type: 'buff', desc: '명중률 증가' },
    'BUFF_LUCK':        { icon: '🍀', name: '행운UP', type: 'buff', desc: '아이템 드롭/크리율 보정' },
    'BUFF_RESIST':      { icon: '🧿', name: '저항UP', type: 'buff', desc: '상태이상 저항 증가' },
    'BUFF_ALL':         { icon: '🌈', name: '전능', type: 'buff', desc: '모든 능력치 증가' },

    // 3-2. 특수 버프
    'BUFF_SHIELD':      { icon: '🛡️', name: '보호막', type: 'buff', desc: '피해 흡수' },
    'DEF_SHIELD':       { icon: '🛡️', name: '보호막', type: 'buff', desc: '피해 흡수' }, // 중복 허용 (로직 호환성)
    'DEF_MANA_SHIELD':  { icon: '🔵', name: '마나실드', type: 'buff', desc: '마나로 피해 흡수' },
    'BUFF_IMMUNE':      { icon: '🛡️', name: '면역', type: 'buff', desc: '상태이상 무효' },
    'BUFF_REFLECT':     { icon: '🪞', name: '반사', type: 'buff', desc: '피해 반사' },
    'BUFF_COUNTER':     { icon: '🤺', name: '반격', type: 'buff', desc: '피격 시 반격' },
    'BUFF_BLOCK':       { icon: '🧱', name: '방어', type: 'buff', desc: '피해 경감' },
    'BUFF_DOUBLE_CAST': { icon: '👯', name: '이중시전', type: 'buff', desc: '스킬 2회 발동' },
    'DEF_PROTECT':      { icon: '🛡️', name: '보호', type: 'buff', desc: '아군 피해 대신 받음' },
    'DEF_STORE_DMG':    { icon: '🔋', name: '피해저장', type: 'buff', desc: '받은 피해 축적' },
    'DEF_REDUCE':       { icon: '📉', name: '피해경감', type: 'buff', desc: '받는 피해량 감소' },
    'DEF_INVINCIBLE':   { icon: '💎', name: '무적', type: 'buff', desc: '모든 피해 무시' },
    'STEALTH':          { icon: '👻', name: '은신', type: 'buff', desc: '타겟 지정 불가' },
    'DRAIN':            { icon: '🧛', name: '흡혈', type: 'buff', desc: '피해량의 일부 회복' },
    'HEAL_REGEN':       { icon: '🌿', name: '재생', type: 'buff', desc: '턴마다 체력 회복' },
    'BUFF_ENCHANT':     { icon: '✨', name: '인챈트', type: 'buff', desc: '공격 시 추가 효과 부여' },
    'BUFF_EXTENSION':   { icon: '⏳', name: '지속증가', type: 'buff', desc: '버프 지속시간 연장' },
    'BUFF_UNTARGETABLE':{ icon: '🌫️', name: '지정불가', type: 'buff', desc: '타겟팅 되지 않음' },
    'BUFF_PHASING':     { icon: '👻', name: '유체화', type: 'buff', desc: '지형 및 유닛 통과 가능' },

    // ==========================================
    // 4. 디버프 (Debuffs - Negative Status)
    // ==========================================
    // 4-1. 제어 불가 (CC)
    'CC_STUN':          { icon: '💫', name: '기절', type: 'debuff', desc: '아무 행동 못함' },
    'CC_FREEZE':        { icon: '❄️', name: '빙결', type: 'debuff', desc: '이동불가, 피격 시 2배 피해 후 해제' },
    'CC_SLEEP':         { icon: '💤', name: '수면', type: 'debuff', desc: '행동 불가, 피격 시 해제' },
    'CC_SILENCE':       { icon: '😶', name: '침묵', type: 'debuff', desc: '스킬 사용 불가' },
    'CC_ROOT':          { icon: '🕸️', name: '속박', type: 'debuff', desc: '이동 불가' },
    'CC_CONFUSE':       { icon: '😵', name: '혼란', type: 'debuff', desc: '랜덤 이동/공격' },
    'CC_BLIND':         { icon: '😎', name: '실명', type: 'debuff', desc: '명중률 대폭 감소' },
    'CC_POLYMORPH':     { icon: '🐑', name: '변이', type: 'debuff', desc: '동물로 변해 행동 불가' },
    'CC_CHARM':         { icon: '💕', name: '매혹', type: 'debuff', desc: '제어 불가 (아군 공격)' },
    'CC_FEAR':          { icon: '😱', name: '공포', type: 'debuff', desc: '제어 불가 (도주)' },
    'AGGRO_TAUNT':      { icon: '🤬', name: '도발', type: 'debuff', desc: '강제 타겟팅' },
    'AGGRO_CONFUSE':    { icon: '😵', name: '대혼란', type: 'debuff', desc: '피아식별 불가' },
    'SHOCK':            { icon: '⚡', name: '감전', type: 'debuff', desc: '쿨타임 멈춤' },

    // 4-2. 지속 피해 및 능력치 감소
    'STATUS_BURN':      { icon: '🔥', name: '화상', type: 'debuff', desc: '지속 피해, 방어 감소' },
    'STATUS_POISON':    { icon: '☠️', name: '맹독', type: 'debuff', desc: '체력 비례 지속 피해' },
    'STATUS_BLEED':     { icon: '🩸', name: '출혈', type: 'debuff', desc: '이동 시 피해' },
    'STATUS_CURSE':     { icon: '👿', name: '저주', type: 'debuff', desc: '받는 피해 증가' },
    'STATUS_DOT':       { icon: '💀', name: '지속피해', type: 'debuff', desc: '턴마다 피해' },
    'STATUS_RANDOM_DOT':{ icon: '🎲', name: '무작위독', type: 'debuff', desc: '무작위 지속 피해' },
    'DEBUFF_ATK':       { icon: '📉', name: '공격DOWN', type: 'debuff', desc: '공격력 감소' },
    'DEBUFF_DEF':       { icon: '💔', name: '방어DOWN', type: 'debuff', desc: '방어력 감소' },
    'DEBUFF_SPD':       { icon: '🐢', name: '감속', type: 'debuff', desc: '턴 늦게 옴' },
    'DEBUFF_ACC':       { icon: '🕶️', name: '명중DOWN', type: 'debuff', desc: '명중률 감소 (실명)' },
    'DEBUFF_EVA':       { icon: '🎯', name: '회피DOWN', type: 'debuff', desc: '회피율 감소' },
    'DEBUFF_MAG':       { icon: '🔮', name: '마방DOWN', type: 'debuff', desc: '마법 저항력 감소' },
    'DEBUFF_VULNERABLE':{ icon: '💔', name: '취약', type: 'debuff', desc: '받는 피해량 증가' },

    // ==========================================
    // 5. 게이지 조작 (Action Gauge)
    // ==========================================
    'GAUGE_FILL':       { icon: '⏳', name: '가속', type: 'instant', desc: '행동 게이지 증가' },
    'GAUGE_DRAIN':      { icon: '🐢', name: '감속', type: 'instant', desc: '행동 게이지 감소' },
    'GAUGE_SET':        { icon: '⏱️', name: '게이지설정', type: 'instant', desc: '행동 게이지 변경' },
    'GAUGE_MAX':        { icon: '⚡', name: '재행동', type: 'instant', desc: '즉시 턴 획득' },
    'SPECIAL_TIME_STOP':{ icon: '🛑', name: '시간정지', type: 'instant', desc: '모든 유닛 정지' },

    // ==========================================
    // 6. 패시브 (Passives)
    // ==========================================
    'PASSIVE_DMG':      { icon: '⚔️', name: '공격강화', type: 'passive', desc: '주는 피해 증가' },
    'PASSIVE_DEF':      { icon: '🛡️', name: '방어강화', type: 'passive', desc: '받는 피해 감소' },
    'PASSIVE_MAG':      { icon: '🔮', name: '마력강화', type: 'passive', desc: '마법 피해 증가' },
    'PASSIVE_SPD':      { icon: '👟', name: '신속', type: 'passive', desc: '행동 속도 증가' },
    'PASSIVE_CRIT':     { icon: '🎯', name: '치명', type: 'passive', desc: '치명타 확률 증가' },
    'PASSIVE_CRIT_DMG': { icon: '💥', name: '치명피해', type: 'passive', desc: '치명타 위력 증가' },
    'PASSIVE_EVA':      { icon: '🍃', name: '회피', type: 'passive', desc: '회피율 증가' },
    'PASSIVE_EVA_BOOST':{ icon: '🌪️', name: '회피가속', type: 'passive', desc: '회피 시 게이지 회복' },
    'PASSIVE_ACC':      { icon: '👁️', name: '정밀', type: 'passive', desc: '명중률 증가' },
    'PASSIVE_RESIST':   { icon: '🛡️', name: '내성', type: 'passive', desc: '상태이상 저항 증가' },
    'PASSIVE_MANA':     { icon: '💧', name: '마나통', type: 'passive', desc: '최대 마나 증가' },
    'PASSIVE_HEAL_POWER':{ icon: '💚', name: '치유강화', type: 'passive', desc: '회복량 증가' },
    'PASSIVE_LUCK':     { icon: '🍀', name: '행운', type: 'passive', desc: '행운 스탯 증가' },
    'PASSIVE_DIST_BONUS':{ icon: '📏', name: '거리보너스', type: 'passive', desc: '거리에 따른 뎀증' },
    'PASSIVE_SURVIVE':  { icon: '🙏', name: '생존본능', type: 'passive', desc: '치명적 피해 버팀' },
    'PASSIVE_SUREHIT':  { icon: '🎯', name: '필중', type: 'passive', desc: '공격이 빗나가지 않음' },
    'PASSIVE_PENETRATE':{ icon: '🔩', name: '관통', type: 'passive', desc: '방어력 무시' },
    'PASSIVE_COST_RED': { icon: '📉', name: '절약', type: 'passive', desc: '스킬 코스트 감소' },
    'PASSIVE_REUSE':    { icon: '♻️', name: '재사용', type: 'passive', desc: '소모품 미소모 확률' },
    'PASSIVE_REVIVE_SELF':{ icon: '✝️', name: '자가부활', type: 'passive', desc: '사망 시 부활' },
    'PASSIVE_GAUGE':    { icon: '⚡', name: '활력', type: 'passive', desc: '턴 시작 시 게이지 회복' },
    'PASSIVE_GAUGE_SAVE':{ icon: '🔋', name: '기세', type: 'passive', desc: '턴 종료 시 게이지 보존' },
    'PASSIVE_TICK_SAVE':{ icon: '⏳', name: '시간비축', type: 'passive', desc: '대기 시 게이지 보존' },
    'PASSIVE_ITEM_POWER':{ icon: '⚗️', name: '조제숙련', type: 'passive', desc: '아이템 효과 증폭' },
    'PASSIVE_GOLD':     { icon: '💰', name: '수금', type: 'passive', desc: '골드 획득량 증가' },
    'PASSIVE_DROP':     { icon: '📦', name: '수집', type: 'passive', desc: '아이템 드롭률 증가' },

    // ==========================================
    // 7. 유틸리티 & 경제 (Utility & Economy)
    // ==========================================
    'ECON_GOLD':        { icon: '💰', name: '황금', type: 'instant', desc: '골드 획득' },
    'ECON_STEAL':       { icon: '🤏', name: '훔치기', type: 'instant', desc: '적에게서 골드 강탈' },
    'ECON_CREATE':      { icon: '🔨', name: '제작', type: 'instant', desc: '아이템 생성' },
    'ECON_ITEM_GET':    { icon: '🎁', name: '획득', type: 'instant', desc: '아이템 발견' },
    'ECON_TRANSMUTE':   { icon: '⚗️', name: '연성', type: 'instant', desc: '물질 변환 (골드화)' },
    'ECON_DISCOUNT':    { icon: '🏷️', name: '흥정', type: 'passive', desc: '상점가 할인' },
    'ECON_DROP_RATE':   { icon: '📈', name: '드롭률UP', type: 'buff', desc: '아이템 확률 증가' },
    'ECON_DROP_QUAL':   { icon: '✨', name: '감정', type: 'buff', desc: '아이템 품질 증가' },
    'UTIL_SCAN':        { icon: '📡', name: '스캔', type: 'instant', desc: '정보 파악' },
    'UTIL_REVEAL':      { icon: '👁️', name: '발견', type: 'instant', desc: '은신/함정 감지' },
    'UTIL_IDENTIFY':    { icon: '🔍', name: '식별', type: 'instant', desc: '아이템 정보 확인' },
    'UTIL_INTERACT':    { icon: '✋', name: '상호작용', type: 'instant', desc: '장치/상자 조작' },
    'UTIL_CD_RESET':    { icon: '⌛', name: '재장전', type: 'instant', desc: '쿨타임 초기화' },
    'UTIL_LORE':        { icon: '📜', name: '지식', type: 'passive', desc: '정보 획득' },
    'STATUS_RANDOM':    { icon: '🎲', name: '무작위', type: 'instant', desc: '무작위 효과' },

    // ==========================================
    // 8. 소환 및 설치 (Summon & Trap)
    // ==========================================
    'SUMMON_DECOY':     { icon: '🤡', name: '미끼소환', type: 'instant', desc: '어그로용 인형 소환' },
    'SUMMON_WALL':      { icon: '🧱', name: '벽생성', type: 'instant', desc: '장애물 생성' },
    'TRAP_STUN':        { icon: '🕸️', name: '기절덫', type: 'trap', desc: '밟으면 기절' }
};

export const TERRAIN_TYPES = {
    // [SPECIAL MARKER]
    'DEPLOY_ZONE': { name: '🚩 영웅 배치', type: 'floor', cost: 1, color: 'rgba(0, 100, 255, 0.3)', sideColor: 'transparent' },

    // [NATURE]
    'GRASS_01':   { name: '풀밭 A', type: 'floor', cost: 1, color: '#4caf50', sideColor: '#2e7d32' },
    'GRASS_02':   { name: '풀밭 B', type: 'floor', cost: 1, color: '#388e3c', sideColor: '#1b5e20' },
    'GRASS_03':   { name: '건조한 풀', type: 'floor', cost: 1, color: '#8bc34a', sideColor: '#558b2f' },
    'FLOWER_01':  { name: '꽃밭',   type: 'floor', cost: 1, color: '#a5d6a7', sideColor: '#66bb6a' },
    'FOREST_01':  { name: '숲 바닥', type: 'floor', cost: 2, color: '#1b5e20', sideColor: '#0d3b10' },
    'BUSH_01':    { name: '덤불',    type: 'floor', cost: 2, color: '#558b2f', sideColor: '#33691e' },

    // [GROUND]
    'DIRT_01':    { name: '흙길 A', type: 'floor', cost: 1, color: '#795548', sideColor: '#4e342e' },
    'DIRT_02':    { name: '흙길 B', type: 'floor', cost: 1, color: '#5d4037', sideColor: '#3e2723' },
    'DIRT_MUD':   { name: '진흙',   type: 'floor', cost: 2, color: '#3e2723', sideColor: '#261815' },
    'SAND_01':    { name: '모래 A', type: 'floor', cost: 2, color: '#fdd835', sideColor: '#f9a825' },
    'SAND_02':    { name: '고운 모래', type: 'floor', cost: 2, color: '#fff59d', sideColor: '#fbc02d' },
    'GRAVEL':     { name: '자갈',   type: 'floor', cost: 1, color: '#9e9e9e', sideColor: '#616161' },
    'PAVED':      { name: '포장도로', type: 'floor', cost: 1, color: '#90a4ae', sideColor: '#546e7a' },
    'WASTELAND':  { name: '황무지', type: 'floor', cost: 1, color: '#8d6e63', sideColor: '#5d4037' },

    // [STONE & MOUNTAIN]
    'STONE_01':   { name: '암석',   type: 'floor', cost: 1, color: '#757575', sideColor: '#424242' },
    'ROCK_DARK':  { name: '검은 바위', type: 'floor', cost: 1, color: '#424242', sideColor: '#212121' },
    'MT_BASE':    { name: '산기슭', type: 'floor', cost: 2, color: '#6d4c41', sideColor: '#3e2723' },
    'CLIFF_01':   { name: '절벽',   type: 'wall', cost: 99, color: '#8d6e63', sideColor: '#5d4037' },
    'CAVE_FLR':   { name: '동굴바닥', type: 'floor', cost: 1, color: '#424242', sideColor: '#212121' },

    // [WATER & ICE]
    'WATER_S':    { name: '얕은 물', type: 'floor', cost: 3, color: '#4fc3f7', sideColor: '#0288d1' },
    'WATER_D':    { name: '깊은 물', type: 'floor', cost: 99, color: '#0288d1', sideColor: '#01579b' },
    'SWAMP':      { name: '늪지대', type: 'floor', cost: 3, color: '#558b2f', sideColor: '#33691e' },
    'ICE_01':     { name: '빙판',   type: 'floor', cost: 1, color: '#b3e5fc', sideColor: '#81d4fa' },
    'SNOW_01':    { name: '눈밭',   type: 'floor', cost: 2, color: '#e1f5fe', sideColor: '#b3e5fc' },

    // [FIRE & SPECIAL]
    'LAVA_01':    { name: '용암',   type: 'floor', cost: 99, color: '#ff5722', sideColor: '#bf360c' },
    'LAVA_HOT':   { name: '마그마', type: 'floor', cost: 99, color: '#ffccbc', sideColor: '#ff5722' },
    'POISON_L':   { name: '독지대', type: 'floor', cost: 2, color: '#9c27b0', sideColor: '#4a148c' },
    'CRYSTAL':    { name: '수정바닥', type: 'floor', cost: 1, color: '#e040fb', sideColor: '#7b1fa2' },
    'SPACE':      { name: '우주',   type: 'floor', cost: 99, color: '#311b92', sideColor: '#000000' },

    // [ARTIFICIAL]
    'WOOD_DK':    { name: '나무데크', type: 'floor', cost: 1, color: '#d7ccc8', sideColor: '#8d6e63' },
    'BRIDGE':     { name: '다리',   type: 'floor', cost: 1, color: '#ffecb3', sideColor: '#ff6f00' },
    'BRICK_R':    { name: '붉은 벽돌', type: 'floor', cost: 1, color: '#d84315', sideColor: '#bf360c' },
    'BRICK_G':    { name: '회색 벽돌', type: 'floor', cost: 1, color: '#cfd8dc', sideColor: '#78909c' },
    'TILE_CHK':   { name: '체크타일', type: 'floor', cost: 1, color: '#eceff1', sideColor: '#546e7a' },
    
    // [OBSTACLE PRESETS]
    'WALL_BIG':   { name: '거대 벽', type: 'wall', cost: 99, color: '#3e2723', sideColor: '#1b0000' },
    'TREE_OAK':   { name: '참나무', type: 'wall', cost: 99, color: '#2e7d32', sideColor: '#1b5e20' }
};
export const BUILDING_TYPES = {
    // 1. 필수 마커 (입/출구)
    'START_POINT': { name: '입구 (START)', icon: '🏁', color: '#448aff', type: 'system' },
    'EXIT_POINT':  { name: '출구 (EXIT)',  icon: '🚪', color: '#ff5252', type: 'system' },

    // 2. 상점 및 편의시설 (마을 기능)
    'SHOP_WEAPON': { name: '무기 상점',   icon: '⚔️', color: '#ffb74d', type: 'shop', shopType: 'weapon' },
    'SHOP_ARMOR':  { name: '방어구점',    icon: '🛡️', color: '#a1887f', type: 'shop', shopType: 'armor' },
    'SHOP_POTION': { name: '연금술사',    icon: '🧪', color: '#ba68c8', type: 'shop', shopType: 'potion' },
    'SHOP_MAGIC':  { name: '마법 상점',   icon: '🔮', color: '#9575cd', type: 'shop', shopType: 'magic' },
    'INN':         { name: '여관',        icon: '🏨', color: '#f06292', type: 'facility', action: 'rest' },
    'BLACKSMITH':  { name: '대장간',      icon: '🔨', color: '#ef5350', type: 'facility', action: 'upgrade' },
    'TAVERN':      { name: '선술집',      icon: '🍺', color: '#ffca28', type: 'facility', action: 'recruit' },
    'BANK':        { name: '은행',        icon: '💰', color: '#ffd700', type: 'facility', action: 'bank' },
    'TEMPLE':      { name: '신전',        icon: '🏛️', color: '#fff9c4', type: 'facility', action: 'skill' },
    'CHURCH':      { name: '교회',        icon: '⛪', color: '#81d4fa', type: 'facility', action: 'pray' },

    // 3. 랜드마크 및 장식
    'CASTLE':      { name: '성',          icon: '🏰', color: '#b0bec5', type: 'deco' },
    'TOWER':       { name: '탑',          icon: '🗼', color: '#78909c', type: 'deco' },
    'RUINS':       { name: '폐허',        icon: '🏚️', color: '#8d6e63', type: 'deco' },
    'TENT':        { name: '텐트',        icon: '⛺', color: '#8bc34a', type: 'deco' },
    'WELL':        { name: '우물',        icon: '🕳️', color: '#039be5', type: 'deco' },
    'FOUNTAIN':    { name: '분수대',      icon: '⛲', color: '#29b6f6', type: 'deco' },
    'SIGNPOST':    { name: '이정표',      icon: '🪧', color: '#d7ccc8', type: 'deco' },
    'GRAVE':       { name: '무덤',        icon: '🪦', color: '#bdbdbd', type: 'deco' },
    'PORTAL':      { name: '포탈',        icon: '🌀', color: '#e040fb', type: 'teleport' },

    // =========================================================
    // [NEW] 4. 랜덤 보물상자 (에디터 브러쉬와 이름이 같아야 함)
    // type: 'chest'로 설정해야 BattleSystem에서 상자로 인식합니다.
    // text: 확률표(META_LOOT_TABLES)의 키값과 일치해야 합니다.
    // =========================================================
    
    // [기본]
    'CHEST':           { name: '보물상자',       icon: '📦', color: '#ffcc80', type: 'chest' }, // 직접 입력용

    // [스테이지별]
    'BOX_STAGE_1':     { name: '초반 보급상자',  icon: '📦', color: '#8d6e63', type: 'chest', text: 'BOX_STAGE_1' },
    'BOX_STAGE_2':     { name: '중반 탐험상자',  icon: '🎁', color: '#26a69a', type: 'chest', text: 'BOX_STAGE_2' },
    'BOX_STAGE_3':     { name: '후반 황금상자',  icon: '👑', color: '#ffd700', type: 'chest', text: 'BOX_STAGE_3' },

    // [특수 목적]
    'BOX_SUPPLY':      { name: '보급품 상자',    icon: '🎒', color: '#81c784', type: 'chest', text: 'BOX_SUPPLY' },
    'BOX_EQUIP_ONLY':  { name: '무기고 상자',    icon: '⚔️', color: '#b0bec5', type: 'chest', text: 'BOX_EQUIP_ONLY' },
    'BOX_GAMBLE':      { name: '도박 상자',      icon: '🎲', color: '#ff5252', type: 'chest', text: 'BOX_GAMBLE' },

    // [보스 보상]
    'BOX_BOSS_MID':    { name: '중간보스 보상',  icon: '👹', color: '#7e57c2', type: 'chest', text: 'BOX_BOSS_MID' },
    'BOX_BOSS_FINAL':  { name: '전설의 보물',    icon: '🐲', color: '#c62828', type: 'chest', text: 'BOX_BOSS_FINAL' },

    // =========================================================
    // [NEW] 5. 숨겨진 요소 (자동 변환용)
    // type: 'hidden'은 BattleSystem에서 자동으로 hiddenObj로 변환됩니다.
    // =========================================================
    
    // [기본]
    'HIDDEN_ITEM':    { name: '숨겨진 아이템', icon: '❓', color: 'rgba(255, 255, 255, 0.5)', type: 'hidden' }, 
    'HIDDEN_CAVE':    { name: '비밀 동굴',     icon: '🕳️', color: 'rgba(100, 100, 255, 0.5)', type: 'hidden' },
    'HIDDEN_TRAP':    { name: '숨겨진 함정',   icon: '💥', color: 'rgba(255, 50, 50, 0.5)',   type: 'hidden' },

    // [프리셋]
    'HIDDEN_STAGE_1': { name: '숨겨진 보급(초반)', icon: '✨', color: 'rgba(255, 215, 0, 0.5)',   type: 'hidden', text: 'BOX_STAGE_1' },
    'HIDDEN_STAGE_2': { name: '숨겨진 보물(중반)', icon: '💎', color: 'rgba(0, 255, 255, 0.5)',   type: 'hidden', text: 'BOX_STAGE_2' },
    'HIDDEN_STAGE_3': { name: '숨겨진 유산(후반)', icon: '👑', color: 'rgba(255, 100, 255, 0.5)', type: 'hidden', text: 'BOX_STAGE_3' },
    
    'HIDDEN_SUPPLY':  { name: '매몰된 물자',       icon: '🏺', color: 'rgba(100, 200, 100, 0.5)', type: 'hidden', text: 'BOX_SUPPLY' },
    'HIDDEN_EQUIP':   { name: '전사의 무덤',       icon: '⚔️', color: 'rgba(200, 200, 200, 0.5)', type: 'hidden', text: 'BOX_EQUIP_ONLY' },
    'HIDDEN_GAMBLE':  { name: '도박꾼의 비상금',   icon: '🎲', color: 'rgba(255, 100, 100, 0.5)', type: 'hidden', text: 'BOX_GAMBLE' }
};