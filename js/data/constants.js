export const HEX_SIZE = 40;

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
    'GRASS_01': { name: '푸른 잔디', type: 'floor', height: 0, cost: 1, color: '#4caf50', sideColor: '#2e7d32', desc: '평범한 땅' },
    'DIRT_PATH': { name: '흙길', type: 'floor', height: 0, cost: 1, color: '#8d6e63', sideColor: '#5d4037', desc: '잘 닦인 길' },
    'RIVER_01': { name: '강물', type: 'floor', height: -5, cost: 99, color: '#29b6f6', sideColor: '#0288d1', desc: '깊은 물' },
    'TREE_OAK': { name: '참나무', type: 'wall', height: 40, cost: 99, color: '#2e7d32', sideColor: '#1b5e20', desc: '시야 차단' },
    'WALL_STONE': { name: '돌담', type: 'wall', height: 30, cost: 99, color: '#757575', sideColor: '#424242', desc: '단단한 벽' },
    'BUSH_01': { name: '수풀', type: 'obstacle', height: 5, cost: 2, color: '#33691e', sideColor: '#1b5e20', desc: '회피율 증가' },
    'HILL_GRASS': { name: '언덕', type: 'floor', height: 20, cost: 2, color: '#66bb6a', sideColor: '#388e3c', desc: '명중률 보너스' },
    'SAND_01': { name: '모래', type: 'floor', height: 0, cost: 1, color: '#fdd835', sideColor: '#fbc02d', desc: '사막' },
    'SNOW_DEEP': { name: '깊은 눈', type: 'floor', height: 5, cost: 2, color: '#e1f5fe', sideColor: '#b3e5fc', desc: '이동 비용 증가' },
    'LAVA_STREAM': { name: '용암', type: 'floor', height: -5, cost: 99, color: '#ff3d00', sideColor: '#bf360c', desc: '화상 피해' },
    'DUNGEON_WALL': { name: '던전 벽', type: 'wall', height: 60, cost: 99, color: '#3e2723', sideColor: '#251510', desc: '매우 높은 벽' }
};