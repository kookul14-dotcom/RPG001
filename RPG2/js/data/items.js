export const ITEM_DATA = {
    // 1/10 스케일 적용: 물약 회복량 및 장비 스탯 압축
    'POTION_S': { name: '하급 물약', type: 'POTION', cost: 50, val: 20, desc: '체력 +20', icon: '🍷', jobs: [] },
    'POTION_M': { name: '중급 물약', type: 'POTION', cost: 150, val: 50, desc: '체력 +50', icon: '🧪', jobs: [] },
    
    // 무기 (공격력 +2 ~ +6 수준)
    'SWORD_WOOD': { name: '목검', type: 'WEAPON', atkType: 'PHYS', cost: 100, val: 2, desc: '물리공격 +2', icon: '🗡️', jobs: ['WARRIOR', 'KNIGHT', 'ROGUE'] },
    'SWORD_IRON': { name: '철검', type: 'WEAPON', atkType: 'PHYS', cost: 500, val: 5, desc: '물리공격 +5', icon: '⚔️', jobs: ['WARRIOR', 'KNIGHT'] },
    'DAGGER': { name: '단검', type: 'WEAPON', atkType: 'PHYS', cost: 400, val: 4, desc: '물리공격 +4', icon: '🔪', jobs: ['ROGUE', 'ARCHER', 'ALCHEMIST'] },
    'BOW_SHORT': { name: '숏보우', type: 'WEAPON', atkType: 'PHYS', cost: 150, val: 3, desc: '물리공격 +3', icon: '🏹', jobs: ['ARCHER', 'ROGUE'] },
    
    'STAFF_WOOD': { name: '나무 지팡이', type: 'WEAPON', atkType: 'MAG', cost: 100, val: 2, desc: '마법공격 +2', icon: '🪄', jobs: ['SORCERER', 'CLERIC', 'BARD'] },
    'STAFF_RUBY': { name: '루비 지팡이', type: 'WEAPON', atkType: 'MAG', cost: 600, val: 6, desc: '마법공격 +6', icon: '🔥', jobs: ['SORCERER', 'WARLOCK'] },
    
    // 방어구 (방어력 +1 ~ +4 수준)
    'ARMOR_LEATHER': { name: '가죽 갑옷', type: 'ARMOR', cost: 200, val: 1, desc: '방어력 +1', icon: '👕', jobs: [] },
    'ARMOR_CHAIN': { name: '사슬 갑옷', type: 'ARMOR', cost: 600, val: 4, desc: '방어력 +4', icon: '⛓️', jobs: ['WARRIOR', 'KNIGHT', 'PALADIN'] },
    'ROBE_SILK': { name: '비단 로브', type: 'ARMOR', cost: 300, val: 2, desc: '방어 +2', icon: '👘', jobs: ['SORCERER', 'CLERIC', 'BARD', 'DANCER'] },
    
    // 장신구 (스탯 +1 ~ +2 수준, 체력 +20 수준)
    'RING_STR': { name: '힘의 반지', type: 'ACC', cost: 400, val: 2, stat:'str', desc: '힘 +2', icon: '💍', jobs: [] },
    'RING_INT': { name: '지능의 반지', type: 'ACC', cost: 400, val: 2, stat:'int', desc: '지능 +2', icon: '🔮', jobs: [] },
    'AMULET_HP': { name: '생명 목걸이', type: 'ACC', cost: 500, val: 20, stat:'hp_max', desc: '최대체력 +20', icon: '📿', jobs: [] }
};