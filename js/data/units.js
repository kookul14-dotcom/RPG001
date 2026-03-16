import { SKILL_DATABASE } from './skills.js';

export const CLASS_DATA = {
    // ============================================================
    // HEROES 
    // ============================================================
    
"WARRIOR": { name: "로덴 그레이", EquipableWeapons: "SHORT_SWORD, ARMING_SWORD, RAPIER, BASTARD_SWORD, GREAT_SWORD, HWANDO, KATANA, DADAO, HAND_AXE, BATTLE_AXE, GREAT_AXE, MACE, MORNING_STAR, FLAIL, WAR_HAMMER, MAUL, SHORT_SPEAR, HALBERD, GLAIVE, GUAN_DAO", race: "HUMAN", armorClass: "HEAVY", atkType: "MELEE", level: 1, baseHp: 0, baseMp: 0, str: 13, int: 4, vit: 10, agi: 5, dex: 8, vol: 6, luk: 4, mov: 4, rng: 1, jump: 2, icon: "⚔️", skillIds: ['WAR_01','WAR_02','WAR_03','WAR_04','WAR_05','WAR_06','WAR_07','WAR_08','WAR_09','WAR_10','WAR_11','WAR_12','WAR_13','WAR_14','WAR_15','WAR_16','WAR_17','WAR_18','WAR_19','WAR_20','WAR_21','WAR_22','WAR_23','WAR_24','WAR_25','WAR_26','WAR_27','WAR_28'], drops: [] },
"KNIGHT": { name: "세라핀 발레리우스", EquipableWeapons: "SHORT_SWORD, ARMING_SWORD, RAPIER, BASTARD_SWORD, MACE, MORNING_STAR, FLAIL, WAR_HAMMER, MAUL, SHORT_SPEAR, LONG_SPEAR, LANCE, HALBERD, GLAIVE, GUAN_DAO, SHIELD", race: "HUMAN", armorClass: "HEAVY", atkType: "MELEE", level: 1, baseHp: 0, baseMp: 0, str: 10, int: 4, vit: 14, agi: 4, dex: 6, vol: 5, luk: 7, mov: 4, rng: 1, jump: 2, icon: "🛡️", skillIds: ['KNT_01','KNT_02','KNT_03','KNT_04','KNT_05','KNT_06','KNT_07','KNT_08','KNT_09','KNT_10','KNT_11','KNT_12','KNT_13','KNT_14','KNT_15','KNT_16','KNT_17','KNT_18','KNT_19','KNT_20','KNT_21','KNT_22','KNT_23','KNT_24','KNT_25','KNT_26','KNT_27','KNT_28'], drops: [] },
"MARTIAL ARTIST": { name: "다렌 아이언하트", EquipableWeapons: "KNUCKLE, CESTUS, TONFA, NUNCHAKU, QUARTERSTAFF, CLAWS", race: "HUMAN", armorClass: "LIGHT", atkType: "MELEE", level: 1, baseHp: 0, baseMp: 0, str: 12, int: 4, vit: 7, agi: 11, dex: 7, vol: 5, luk: 4, mov: 4, rng: 1, jump: 3, icon: "🥋", skillIds: ['MAR_01','MAR_02','MAR_03','MAR_04','MAR_05','MAR_06','MAR_07','MAR_08','MAR_09','MAR_10','MAR_11','MAR_12','MAR_13','MAR_14','MAR_15','MAR_16','MAR_17','MAR_18','MAR_19','MAR_20','MAR_21','MAR_22','MAR_23','MAR_24','MAR_25','MAR_26','MAR_27','MAR_28','MAR_29','MAR_30','MAR_31','MAR_32','MAR_33','MAR_34'], drops: [] },
"THIEF": { name: "켈 비셔스", EquipableWeapons: "DAGGER, CLAWS, RAPIER, SHORT_SWORD, HWANDO, HAND_AXE", race: "HUMAN", armorClass: "LIGHT", atkType: "MELEE", level: 1, baseHp: 0, baseMp: 0, str: 9, int: 4, vit: 5, agi: 13, dex: 10, vol: 4, luk: 5, mov: 5, rng: 1, jump: 3, icon: "🗡️", skillIds: ['THF_01','THF_02','THF_03','THF_04','THF_05','THF_06','THF_07','THF_08','THF_09','THF_10','THF_11','THF_12','THF_13','THF_14','THF_15','THF_16','THF_17','THF_18','THF_19','THF_20','THF_21','THF_22','THF_23','THF_24','THF_25','THF_26','THF_27','THF_28','THF_29','THF_30','THF_31','THF_32','THF_33','THF_34','THF_35'], drops: [] },
"ARCHER": { name: "르네 실버윈드", EquipableWeapons: "SHORT_BOW, COMPOSITE_BOW, LONG_BOW, CROSSBOW", race: "HUMAN", armorClass: "LIGHT", atkType: "RANGED", level: 1, baseHp: 0, baseMp: 0, str: 9, int: 4, vit: 6, agi: 9, dex: 13, vol: 4, luk: 5, mov: 4, rng: 5, jump: 2, icon: "🏹", skillIds: ['ARC_01','ARC_02','ARC_03','ARC_04','ARC_05','ARC_06','ARC_07','ARC_08','ARC_09','ARC_10','ARC_11','ARC_12','ARC_13','ARC_14','ARC_15','ARC_16','ARC_17','ARC_18','ARC_19','ARC_20','ARC_21','ARC_22','ARC_23','ARC_24','ARC_25','ARC_26','ARC_27','ARC_28'], drops: [] },
"SORCERER": { name: "라이언 블레이즈", EquipableWeapons: "WAND, ROD, GREAT_STAFF, GRIMOIRE", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC", level: 1, baseHp: 0, baseMp: 0, str: 4, int: 15, vit: 5, agi: 5, dex: 5, vol: 11, luk: 5, mov: 3, rng: 4, jump: 1, icon: "🔮", skillIds: ['SOR_01','SOR_02','SOR_03','SOR_04','SOR_05','SOR_06','SOR_07','SOR_08','SOR_09','SOR_10','SOR_11','SOR_12','SOR_13','SOR_14','SOR_15','SOR_16','SOR_17','SOR_18','SOR_19','SOR_20','SOR_21','SOR_22','SOR_23','SOR_24','SOR_25','SOR_26','SOR_27','SOR_28','SOR_29','SOR_30','SOR_31','SOR_32','SOR_33','SOR_34','SOR_35','SOR_36'], drops: [] },
"CLERIC": { name: "아벨 베네딕트", EquipableWeapons: "WAND, ROD, MACE, MORNING_STAR, FLAIL, WAR_HAMMER, MAUL, GRIMOIRE", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC", level: 1, baseHp: 0, baseMp: 0, str: 4, int: 13, vit: 8, agi: 5, dex: 5, vol: 9, luk: 6, mov: 3, rng: 3, jump: 2, icon: "✝️", skillIds: ['CLR_01','CLR_02','CLR_03','CLR_04','CLR_05','CLR_06','CLR_07','CLR_08','CLR_09','CLR_10','CLR_11','CLR_12','CLR_13','CLR_14','CLR_15','CLR_16','CLR_17','CLR_18','CLR_19','CLR_20','CLR_21','CLR_22','CLR_23','CLR_24','CLR_25','CLR_26','CLR_27','CLR_28'], drops: [] },
"BARD": { name: "피오나 멜로디아", EquipableWeapons: "INSTRUMENT, DAGGER, RAPIER", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC", level: 1, baseHp: 0, baseMp: 0, str: 4, int: 9, vit: 6, agi: 7, dex: 7, vol: 9, luk: 8, mov: 4, rng: 4, jump: 2, icon: "🎻", skillIds: ['BRD_01','BRD_02','BRD_03','BRD_04','BRD_05','BRD_06','BRD_07','BRD_08','BRD_09','BRD_10','BRD_11','BRD_12','BRD_13','BRD_14','BRD_15','BRD_16','BRD_17','BRD_18','BRD_19','BRD_20','BRD_21','BRD_22','BRD_23','BRD_24','BRD_25','BRD_26','BRD_27','BRD_28','BRD_29','BRD_30','BRD_31'], drops: [] },
"DANCER": { name: "아리사 드 룬", EquipableWeapons: "FAN, WHIP, DAGGER, CLAWS, NUNCHAKU", race: "HUMAN", armorClass: "LIGHT", atkType: "MELEE", level: 1, baseHp: 0, baseMp: 0, str: 7, int: 8, vit: 3, agi: 12, dex: 9, vol: 5, luk: 6, mov: 4, rng: 1, jump: 3, icon: "💃", skillIds: ['DNC_01','DNC_02','DNC_03','DNC_04','DNC_05','DNC_06','DNC_07','DNC_08','DNC_09','DNC_10','DNC_11','DNC_12','DNC_13','DNC_14','DNC_15','DNC_16','DNC_17','DNC_18','DNC_19','DNC_20','DNC_21','DNC_22','DNC_23','DNC_24','DNC_25','DNC_26','DNC_27','DNC_28','DNC_29','DNC_30','DNC_31'], drops: [] },
"ALCHEMIST": { name: "라스 폰 슈타인", EquipableWeapons: "NONE", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC", level: 1, baseHp: 0, baseMp: 0, str: 4, int: 11, vit: 7, agi: 5, dex: 11, vol: 6, luk: 6, mov: 3, rng: 3, jump: 2, icon: "⚗️", skillIds: ['ALC_01','ALC_02','ALC_03','ALC_04','ALC_05','ALC_06','ALC_07','ALC_08','ALC_09','ALC_10','ALC_11','ALC_12','ALC_13','ALC_14','ALC_15','ALC_16','ALC_17','ALC_18','ALC_19','ALC_20','ALC_21','ALC_22','ALC_23','ALC_24','ALC_25','ALC_26','ALC_27','ALC_28','ALC_29','ALC_30','ALC_31','ALC_32','ALC_33','ALC_34','ALC_35','ALC_37','ALC_38','ALC_39','ALC_40','ALC_41','ALC_42','ALC_43','ALC_44','ALC_45','ALC_46','ALC_47','ALC_48','ALC_49','ALC_50','ALC_51','ALC_52','ALC_53','ALC_54','ALC_55','ALC_56','ALC_57','ALC_58','ALC_59','ALC_60','ALC_61','ALC_62','ALC_63','ALC_64','ALC_65','ALC_66'], drops: [] },

// =======================================================
    // ⚔️ 1. 전사 (WARRIOR)
    // =======================================================
    "E_WARRIOR": {
        icon: "🪓", race: "HUMAN", armorClass: "HEAVY", atkType: "MELEE",
        mov: 4, rng: 1, jump: 2,
        EquipableWeapons: "SHORT_SWORD, ARMING_SWORD, RAPIER, BASTARD_SWORD, GREAT_SWORD, HWANDO, KATANA, DADAO, HAND_AXE, BATTLE_AXE, GREAT_AXE, MACE, MORNING_STAR, FLAIL, WAR_HAMMER, MAUL, SHORT_SPEAR, HALBERD, GLAIVE, GUAN_DAO",
        drops: [],
        tierNames: {
            1: "하급 약탈병", 5: "용병단 보병", 10: "정규군 보병", 20: "베테랑 기사", 
            30: "정예 근위병", 50: "왕실 수호총장", 70: "파멸의 검신"
        },
        baseStats: { str: 16, int: 2, vit: 10, agi: 5, dex: 8, vol: 6, luk: 3 },
        growth: { str: 8.36, int: 1.04, vit: 5.23, agi: 2.62, dex: 4.19, vol: 3.14, luk: 1.57 },
        skillPool: [
            { id: 'WAR_04', unlockLv: 1 }, { id: 'WAR_01', unlockLv: 1 }, { id: 'WAR_03', unlockLv: 1 },
            { id: 'WAR_02', unlockLv: 5 }, { id: 'WAR_11', unlockLv: 10 }, { id: 'WAR_08', unlockLv: 20 },
            { id: 'WAR_26', unlockLv: 30 }, { id: 'WAR_21', unlockLv: 50 }, { id: 'WAR_25', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 🛡️ 2. 기사 (KNIGHT)
    // =======================================================
    "E_KNIGHT": {
        icon: "🛡️", race: "HUMAN", armorClass: "HEAVY", atkType: "MELEE",
        mov: 3, rng: 1, jump: 2,
        EquipableWeapons: "SHORT_SWORD, ARMING_SWORD, RAPIER, BASTARD_SWORD, MACE, MORNING_STAR, FLAIL, WAR_HAMMER, MAUL, SHORT_SPEAR, LONG_SPEAR, LANCE, HALBERD, GLAIVE, GUAN_DAO, SHIELD",
        drops: [],
        tierNames: {
            1: "반란군 방패병", 5: "용병단 중갑병", 10: "철갑 기사", 20: "성벽 수호자", 
            30: "철옹성 백작", 50: "신성 기사단장", 70: "영겁의 수호자"
        },
        baseStats: { str: 11, int: 3, vit: 16, agi: 3, dex: 6, vol: 5, luk: 6 },
        growth: { str: 5.75, int: 1.57, vit: 8.36, agi: 1.57, dex: 3.14, vol: 2.62, luk: 3.14 },
        skillPool: [
            { id: 'KNT_04', unlockLv: 1 }, { id: 'KNT_01', unlockLv: 1 }, { id: 'KNT_06', unlockLv: 1 },
            { id: 'KNT_07', unlockLv: 5 }, { id: 'KNT_08', unlockLv: 10 }, { id: 'KNT_19', unlockLv: 20 },
            { id: 'KNT_12', unlockLv: 30 }, { id: 'KNT_21', unlockLv: 50 }, { id: 'KNT_25', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 🥊 3. 무투가 (MARTIAL_ARTIST)
    // =======================================================
    "E_MARTIAL_ARTIST": {
        icon: "🥋", race: "HUMAN", armorClass: "LIGHT", atkType: "MELEE",
        mov: 4, rng: 1, jump: 3,
        EquipableWeapons: "KNUCKLE, CESTUS, TONFA, NUNCHAKU, QUARTERSTAFF, CLAWS",
        drops: [],
        tierNames: {
            1: "뒷골목 싸움꾼", 5: "무투파 용병", 10: "권법 사범", 20: "마스터 투사", 
            30: "극의의 수도승", 50: "투신 아수라", 70: "무극의 달인"
        },
        baseStats: { str: 13, int: 2, vit: 7, agi: 12, dex: 8, vol: 5, luk: 3 },
        growth: { str: 6.80, int: 1.04, vit: 3.67, agi: 6.28, dex: 4.19, vol: 2.62, luk: 1.57 },
        skillPool: [
            { id: 'MNK_04', unlockLv: 1 }, { id: 'MNK_10', unlockLv: 1 }, { id: 'MNK_01', unlockLv: 1 },
            { id: 'MNK_02', unlockLv: 5 }, { id: 'MNK_09', unlockLv: 10 }, { id: 'MNK_08', unlockLv: 20 },
            { id: 'MNK_25', unlockLv: 30 }, { id: 'MNK_11', unlockLv: 50 }, { id: 'MNK_26', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 🗡️ 4. 도적 (THIEF)
    // =======================================================
    "E_THIEF": {
        icon: "🗡️", race: "HUMAN", armorClass: "LIGHT", atkType: "MELEE",
        mov: 5, rng: 1, jump: 3,
        EquipableWeapons: "DAGGER, CLAWS, RAPIER, SHORT_SWORD, HWANDO, HAND_AXE",
        drops: [],
        tierNames: {
            1: "길거리 소매치기", 5: "용병단 암살자", 10: "왕실 첩보원", 20: "그림자 암살자", 
            30: "전설의 도적", 50: "밤의 지배자", 70: "공허의 살수"
        },
        baseStats: { str: 10, int: 2, vit: 5, agi: 14, dex: 11, vol: 3, luk: 5 },
        growth: { str: 5.23, int: 1.04, vit: 2.62, agi: 7.32, dex: 5.75, vol: 1.57, luk: 2.62 },
        skillPool: [
            { id: 'THF_04', unlockLv: 1 }, { id: 'THF_01', unlockLv: 1 }, { id: 'THF_08', unlockLv: 1 },
            { id: 'THF_10', unlockLv: 5 }, { id: 'THF_11', unlockLv: 10 }, { id: 'THF_21', unlockLv: 20 },
            { id: 'THF_13', unlockLv: 30 }, { id: 'THF_14', unlockLv: 50 }, { id: 'THF_27', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 🏹 5. 궁수 (ARCHER)
    // =======================================================
    "E_ARCHER": {
        icon: "🏹", race: "HUMAN", armorClass: "LIGHT", atkType: "RANGED",
        mov: 4, rng: 5, jump: 2,
        EquipableWeapons: "SHORT_BOW, COMPOSITE_BOW, LONG_BOW, CROSSBOW",
        drops: [],
        tierNames: {
            1: "밀렵꾼 궁수", 5: "전문 저격병", 10: "정예 궁병", 20: "바람의 저격수", 
            30: "대륙의 명궁", 50: "신궁 에테르", 70: "차원 저격수"
        },
        baseStats: { str: 10, int: 2, vit: 5, agi: 9, dex: 15, vol: 4, luk: 5 },
        growth: { str: 5.23, int: 1.04, vit: 2.62, agi: 4.71, dex: 7.84, vol: 2.09, luk: 2.62 },
        skillPool: [
            { id: 'ARC_01', unlockLv: 1 }, { id: 'ARC_05', unlockLv: 1 }, { id: 'ARC_04', unlockLv: 1 },
            { id: 'ARC_08', unlockLv: 5 }, { id: 'ARC_15', unlockLv: 10 }, { id: 'ARC_10', unlockLv: 20 },
            { id: 'ARC_21', unlockLv: 30 }, { id: 'ARC_22', unlockLv: 50 }, { id: 'ARC_25', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 🔮 6. 마법사 (SORCERER)
    // =======================================================
    "E_SORCERER": {
        icon: "🔮", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC",
        mov: 3, rng: 4, jump: 1,
        EquipableWeapons: "WAND, ROD, GREAT_STAFF, GRIMOIRE",
        drops: [],
        tierNames: {
            1: "파문당한 마술사", 5: "원소 마도사", 10: "왕실 마법사", 20: "대마도사 후보", 
            30: "공허의 마법사", 50: "금기 마법사", 70: "우주 마도사"
        },
        baseStats: { str: 2, int: 18, vit: 4, agi: 5, dex: 5, vol: 12, luk: 4 },
        growth: { str: 1.04, int: 9.42, vit: 2.09, agi: 2.62, dex: 2.62, vol: 6.28, luk: 2.09 },
        skillPool: [
            { id: 'SOR_01', unlockLv: 1 }, { id: 'SOR_08', unlockLv: 1 }, { id: 'SOR_13', unlockLv: 1 },
            { id: 'SOR_14', unlockLv: 5 }, { id: 'SOR_04', unlockLv: 10 }, { id: 'SOR_10', unlockLv: 20 },
            { id: 'SOR_24', unlockLv: 30 }, { id: 'SOR_30', unlockLv: 50 }, { id: 'SOR_40', unlockLv: 70 }
        ]
    },

    // =======================================================
    // ✝️ 7. 성직자 (CLERIC)
    // =======================================================
    "E_CLERIC": {
        icon: "✝️", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC",
        mov: 3, rng: 3, jump: 2,
        EquipableWeapons: "WAND, ROD, MACE, MORNING_STAR, FLAIL, WAR_HAMMER, MAUL, GRIMOIRE",
        drops: [],
        tierNames: {
            1: "타락한 수사", 5: "전투 치유사", 10: "주교 보좌관", 20: "성당 기사", 
            30: "고위 대주교", 50: "신성 황제", 70: "절대 성자"
        },
        baseStats: { str: 3, int: 15, vit: 7, agi: 4, dex: 5, vol: 10, luk: 6 },
        growth: { str: 1.57, int: 7.84, vit: 3.67, agi: 2.09, dex: 2.62, vol: 5.23, luk: 3.14 },
        skillPool: [
            { id: 'CLR_01', unlockLv: 1 }, { id: 'CLR_09', unlockLv: 1 }, { id: 'CLR_03', unlockLv: 1 },
            { id: 'CLR_04', unlockLv: 5 }, { id: 'CLR_11', unlockLv: 10 }, { id: 'CLR_05', unlockLv: 20 },
            { id: 'CLR_16', unlockLv: 30 }, { id: 'CLR_19', unlockLv: 50 }, { id: 'CLR_28', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 🎻 8. 음유시인 (BARD)
    // =======================================================
    "E_BARD": {
        icon: "🎻", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC",
        mov: 4, rng: 4, jump: 2,
        EquipableWeapons: "INSTRUMENT, DAGGER, RAPIER",
        drops: [],
        tierNames: {
            1: "방랑 악사", 5: "전장 선동가", 10: "군단 악장", 20: "매혹의 시인", 
            30: "영혼의 지휘자", 50: "신의 연주자", 70: "천상의 악성"
        },
        baseStats: { str: 3, int: 10, vit: 6, agi: 7, dex: 7, vol: 10, luk: 7 },
        growth: { str: 1.57, int: 5.22, vit: 3.14, agi: 3.67, dex: 3.67, vol: 5.23, luk: 3.67 },
        skillPool: [
            { id: 'BRD_01', unlockLv: 1 }, { id: 'BRD_02', unlockLv: 1 }, { id: 'BRD_03', unlockLv: 1 },
            { id: 'BRD_04', unlockLv: 5 }, { id: 'BRD_08', unlockLv: 10 }, { id: 'BRD_12', unlockLv: 20 },
            { id: 'BRD_15', unlockLv: 30 }, { id: 'BRD_22', unlockLv: 50 }, { id: 'BRD_18', unlockLv: 70 }
        ]
    },

    // =======================================================
    // 💃 9. 무희 (DANCER)
    // =======================================================
    "E_DANCER": {
        icon: "💃", race: "HUMAN", armorClass: "LIGHT", atkType: "MELEE",
        mov: 4, rng: 1, jump: 3,
        EquipableWeapons: "FAN, WHIP, DAGGER, CLAWS, NUNCHAKU",
        drops: [],
        tierNames: {
            1: "유흥가 무희", 5: "칼날 무희", 10: "전장의 무희", 20: "환상무희", 
            30: "죽음의 무희", 50: "나락의 무희", 70: "진동의 무희"
        },
        baseStats: { str: 8, int: 3, vit: 5, agi: 13, dex: 9, vol: 5, luk: 7 },
        growth: { str: 4.19, int: 1.57, vit: 2.62, agi: 6.78, dex: 4.71, vol: 2.62, luk: 3.67 },
        skillPool: [
            { id: 'DNC_01', unlockLv: 1 }, { id: 'DNC_03', unlockLv: 1 }, { id: 'DNC_02', unlockLv: 1 },
            { id: 'DNC_04', unlockLv: 5 }, { id: 'DNC_08', unlockLv: 10 }, { id: 'DNC_15', unlockLv: 20 },
            { id: 'DNC_16', unlockLv: 30 }, { id: 'DNC_18', unlockLv: 50 }, { id: 'DNC_26', unlockLv: 70 }
        ]
    },

    // =======================================================
    // ⚗️ 10. 연금술사 (ALCHEMIST)
    // =======================================================
    "E_ALCHEMIST": {
        icon: "⚗️", race: "HUMAN", armorClass: "ROBE", atkType: "MAGIC",
        mov: 3, rng: 3, jump: 2,
        EquipableWeapons: "NONE", // 연금술사는 폭탄과 시약 병을 쓰므로 무기가 없습니다.
        drops: [],
        tierNames: {
            1: "불법 연금술사", 5: "독극물 제조가", 10: "군 공병대장", 20: "플라스크 현자", 
            30: "연금술 마스터", 50: "호문쿨루스 제조가", 70: "신의 연금술사"
        },
        baseStats: { str: 3, int: 12, vit: 7, agi: 5, dex: 12, vol: 6, luk: 5 },
        growth: { str: 1.57, int: 6.26, vit: 3.67, agi: 2.62, dex: 6.28, vol: 3.14, luk: 2.62 },
        skillPool: [
            { id: 'ALC_02', unlockLv: 1 }, { id: 'ALC_08', unlockLv: 1 }, { id: 'ALC_05', unlockLv: 1 },
            { id: 'ALC_27', unlockLv: 5 }, { id: 'ALC_14', unlockLv: 10 }, { id: 'ALC_28', unlockLv: 20 },
            { id: 'ALC_51', unlockLv: 30 }, { id: 'ALC_36', unlockLv: 50 }, { id: 'ALC_59', unlockLv: 70 }
        ]
    },



    // ============================================================
    // MONSTERS
    // ============================================================
"RAT": { name: "거대쥐", element: "EARTH", race: "BEAST", armorClass: "LIGHT", atkType: "MELEE", level: 1, hp: 50, mp: 0, str: 16, int: 2, vit: 5, agi: 6, dex: 3, vol: 2, luk: 2, def: 0, spd: 80, mov: 3, rng: 1, icon: "🐀", skillIds: ["M001"], drops: [{id:"WP_DG_01", rate:0.1}, {id:"WP_SW_01", rate:0.1}, {id:"AR_LT_01", rate:0.1}, {id:"CS_35", rate:0.1}, {id:"CS_01", rate:0.05}] },
"SLIME": { name: "슬라임", element: "WATER", race: "CONSTRUCT", armorClass: "LIGHT", atkType: "MELEE", level: 1, hp: 80, mp: 10, str: 18, int: 2, vit: 10, agi: 2, dex: 2, vol: 2, luk: 2, def: 2, spd: 74, mov: 2, rng: 1, icon: "🟢", skillIds: ["M002"], drops: [{id:"WP_ST_01", rate:0.1}, {id:"WP_BW_01", rate:0.1}, {id:"AR_LT_01", rate:0.1}, {id:"CS_29", rate:0.1}, {id:"CS_01", rate:0.05}] },
"BAT": { name: "흡혈박쥐", element: "WIND", race: "BEAST", armorClass: "LIGHT", atkType: "MELEE", level: 2, hp: 60, mp: 0, str: 20, int: 2, vit: 3, agi: 12, dex: 8, vol: 2, luk: 5, def: 0, spd: 88, mov: 4, rng: 1, icon: "🦇", skillIds: ["M003"], drops: [{id:"WP_SP_01", rate:0.1}, {id:"WP_AX_01", rate:0.1}, {id:"SH_01", rate:0.1}, {id:"CS_31", rate:0.1}, {id:"CS_01", rate:0.05}] },
"KOBOLD": { name: "코볼트", element: "FIRE", race: "HUMANOID", armorClass: "LIGHT", atkType: "MELEE", level: 2, hp: 90, mp: 20, str: 24, int: 4, vit: 8, agi: 10, dex: 8, vol: 3, luk: 5, def: 3, spd: 85, mov: 3, rng: 1, icon: "🐕", skillIds: ["M004"], drops: [{id:"WP_SW_01", rate:0.08}, {id:"WP_ST_01", rate:0.08}, {id:"AR_LT_02", rate:0.08}, {id:"SH_01", rate:0.08}, {id:"CS_21", rate:0.08}, {id:"AC_RG_01", rate:0.05}] },
"GOBLIN": { name: "고블린", element: "WIND", race: "HUMANOID", armorClass: "LIGHT", atkType: "MELEE", level: 3, hp: 100, mp: 10, str: 24, int: 4, vit: 8, agi: 12, dex: 10, vol: 5, luk: 5, def: 2, spd: 84, mov: 3, rng: 1, icon: "👺", skillIds: ["M005"], drops: [{id:"WP_DG_01", rate:0.08}, {id:"WP_SP_01", rate:0.08}, {id:"AR_LT_02", rate:0.08}, {id:"SH_02", rate:0.08}, {id:"CS_27", rate:0.08}, {id:"AC_RG_02", rate:0.05}] },
"SPIDER": { name: "독거미", element: "DARK", race: "BEAST", armorClass: "LIGHT", atkType: "RANGED", level: 3, hp: 110, mp: 30, str: 28, int: 10, vit: 10, agi: 8, dex: 10, vol: 2, luk: 5, def: 5, spd: 82, mov: 3, rng: 2, icon: "🕷️", skillIds: ["M006"], drops: [{id:"WP_AX_01", rate:0.08}, {id:"WP_BW_01", rate:0.08}, {id:"AR_LT_02", rate:0.08}, {id:"SH_02", rate:0.08}, {id:"CS_25", rate:0.08}, {id:"AC_RG_03", rate:0.05}] },
"WOLF": { name: "늑대", element: "WIND", race: "BEAST", armorClass: "LIGHT", atkType: "MELEE", level: 4, hp: 130, mp: 0, str: 32, int: 7, vit: 10, agi: 15, dex: 12, vol: 5, luk: 5, def: 3, spd: 90, mov: 4, rng: 1, icon: "🐺", skillIds: ["M007","M008"], drops: [{id:"WP_SW_02", rate:0.06}, {id:"WP_DG_02", rate:0.06}, {id:"AR_HV_01", rate:0.06}, {id:"AR_RB_01", rate:0.06}, {id:"CS_30", rate:0.06}, {id:"CS_02", rate:0.05}] },
"BOAR": { name: "멧돼지", element: "EARTH", race: "BEAST", armorClass: "HEAVY", atkType: "MELEE", level: 4, hp: 180, mp: 0, str: 40, int: 5, vit: 20, agi: 5, dex: 5, vol: 5, luk: 2, def: 8, spd: 77, mov: 5, rng: 1, icon: "🐗", skillIds: ["M009","M010"], drops: [{id:"WP_AX_02", rate:0.06}, {id:"WP_ST_02", rate:0.06}, {id:"AR_LT_03", rate:0.06}, {id:"SH_03", rate:0.06}, {id:"CS_90", rate:0.06}, {id:"CS_06", rate:0.05}] },
"SKELETON": { name: "스켈레톤", element: "DARK", race: "UNDEAD", armorClass: "LIGHT", atkType: "RANGED", level: 5, hp: 150, mp: 0, str: 36, int: 2, vit: 12, agi: 10, dex: 15, vol: 5, luk: 5, def: 8, spd: 80, mov: 3, rng: 2, icon: "☠️", skillIds: ["M011","M012"], drops: [{id:"WP_SP_02", rate:0.06}, {id:"WP_BW_02", rate:0.06}, {id:"AR_HV_01", rate:0.06}, {id:"AR_RB_01", rate:0.06}, {id:"AC_RG_04", rate:0.05}, {id:"CS_35", rate:0.05}] },
"ZOMBIE": { name: "좀비", element: "DARK", race: "UNDEAD", armorClass: "LIGHT", atkType: "MELEE", level: 5, hp: 250, mp: 0, str: 40, int: 2, vit: 30, agi: 2, dex: 5, vol: 5, luk: 0, def: 2, spd: 71, mov: 2, rng: 1, icon: "🧟", skillIds: ["M013","M014"], drops: [{id:"WP_SW_02", rate:0.06}, {id:"WP_DG_02", rate:0.06}, {id:"AR_LT_03", rate:0.06}, {id:"SH_03", rate:0.06}, {id:"AC_SP_01", rate:0.05}, {id:"CS_57", rate:0.05}] },
"ORC": { name: "오크", element: "EARTH", race: "HUMANOID", armorClass: "HEAVY", atkType: "MELEE", level: 6, hp: 300, mp: 10, str: 50, int: 11, vit: 25, agi: 5, dex: 8, vol: 10, luk: 5, def: 10, spd: 77, mov: 3, rng: 1, icon: "👹", skillIds: ["M015","M016"], drops: [{id:"WP_AX_02", rate:0.05}, {id:"WP_ST_02", rate:0.05}, {id:"AR_HV_02", rate:0.05}, {id:"AR_RB_02", rate:0.05}, {id:"WP_OT_03", rate:0.05}, {id:"CS_06", rate:0.05}] },
"BANDIT": { name: "도적", element: "WIND", race: "HUMANOID", armorClass: "LIGHT", atkType: "MELEE", level: 6, hp: 200, mp: 20, str: 44, int: 10, vit: 15, agi: 20, dex: 25, vol: 10, luk: 15, def: 5, spd: 88, mov: 4, rng: 1, icon: "🥷", skillIds: ["M017","M018"], drops: [{id:"WP_SP_02", rate:0.05}, {id:"WP_BW_02", rate:0.05}, {id:"AR_LT_04", rate:0.05}, {id:"SH_04", rate:0.05}, {id:"WP_OT_01", rate:0.05}, {id:"CS_37", rate:0.05}] },
"BEAR": { name: "불곰", element: "EARTH", race: "BEAST", armorClass: "HEAVY", atkType: "MELEE", level: 7, hp: 450, mp: 0, str: 70, int: 8, vit: 40, agi: 5, dex: 10, vol: 15, luk: 5, def: 15, spd: 74, mov: 3, rng: 1, icon: "🐻", skillIds: ["M019"], drops: [{id:"WP_SW_03", rate:0.05}, {id:"WP_DG_05", rate:0.05}, {id:"AR_HV_02", rate:0.05}, {id:"AR_RB_02", rate:0.05}, {id:"AC_RG_09", rate:0.05}, {id:"CS_15", rate:0.05}] },
"HARPY": { name: "하피", element: "WIND", race: "HUMANOID", armorClass: "ROBE", atkType: "RANGED", level: 7, hp: 220, mp: 50, str: 40, int: 30, vit: 12, agi: 25, dex: 15, vol: 10, luk: 10, def: 5, spd: 92, mov: 5, rng: 3, icon: "🦅", skillIds: ["M020","M021"], drops: [{id:"WP_SP_03", rate:0.05}, {id:"WP_BW_03", rate:0.05}, {id:"AR_LT_04", rate:0.05}, {id:"SH_04", rate:0.05}, {id:"AC_RG_05", rate:0.05}, {id:"CS_10", rate:0.05}] },
"GARGOYLE": { name: "가고일", element: "EARTH", race: "DEMON", armorClass: "HEAVY", atkType: "MELEE", level: 8, hp: 500, mp: 0, str: 60, int: 5, vit: 50, agi: 5, dex: 5, vol: 5, luk: 5, def: 30, spd: 71, mov: 3, rng: 1, icon: "🦇", skillIds: ["M022","M023"], drops: [{id:"WP_AX_04", rate:0.04}, {id:"WP_ST_03", rate:0.04}, {id:"AR_HV_03", rate:0.04}, {id:"AR_RB_03", rate:0.04}, {id:"AC_RG_06", rate:0.04}, {id:"CS_09", rate:0.04}, {id:"CS_53", rate:0.02}] },
"GHOST": { name: "유령", element: "DARK", race: "UNDEAD", armorClass: "ROBE", atkType: "MAGIC", level: 8, hp: 180, mp: 100, str: 10, int: 80, vit: 10, agi: 20, dex: 10, vol: 5, luk: 20, def: 5, spd: 84, mov: 4, rng: 1, icon: "👻", skillIds: ["M024","M025"], drops: [{id:"WP_SW_07", rate:0.04}, {id:"WP_DG_04", rate:0.04}, {id:"AR_LT_05", rate:0.04}, {id:"SH_06", rate:0.04}, {id:"AC_RG_07", rate:0.04}, {id:"CS_31", rate:0.04}, {id:"WP_OT_04", rate:0.02}] },
"WEREWOLF": { name: "늑대인간", element: "WIND", race: "HUMANOID", armorClass: "LIGHT", atkType: "MELEE", level: 9, hp: 550, mp: 50, str: 90, int: 10, vit: 35, agi: 30, dex: 25, vol: 20, luk: 15, def: 10, spd: 93, mov: 5, rng: 1, icon: "🐺", skillIds: ["M026","M027"], drops: [{id:"WP_SP_04", rate:0.04}, {id:"WP_BW_04", rate:0.04}, {id:"AR_HV_03", rate:0.04}, {id:"AR_RB_03", rate:0.04}, {id:"AC_RG_01", rate:0.04}, {id:"CS_14", rate:0.04}, {id:"WP_OT_02", rate:0.02}] },
"SUCCUBUS": { name: "서큐버스", element: "DARK", race: "DEMON", armorClass: "ROBE", atkType: "MAGIC", level: 9, hp: 350, mp: 100, str: 30, int: 80, vit: 20, agi: 20, dex: 20, vol: 10, luk: 25, def: 8, spd: 90, mov: 4, rng: 2, icon: "😈", skillIds: ["M028","M029"], drops: [{id:"WP_AX_03", rate:0.04}, {id:"WP_ST_04", rate:0.04}, {id:"AR_LT_05", rate:0.04}, {id:"SH_06", rate:0.04}, {id:"AC_RG_02", rate:0.04}, {id:"CS_91", rate:0.04}, {id:"WP_OT_05", rate:0.02}] },
"GOLEM": { name: "골렘", element: "EARTH", race: "CONSTRUCT", armorClass: "HEAVY", atkType: "MELEE", level: 10, hp: 1000, mp: 0, str: 120, int: 6, vit: 80, agi: 5, dex: 5, vol: 10, luk: 0, def: 50, spd: 68, mov: 2, rng: 1, icon: "🗿", skillIds: ["M030","M031"], drops: [{id:"WP_SW_04", rate:0.04}, {id:"WP_DG_03", rate:0.04}, {id:"AR_HV_02", rate:0.04}, {id:"AR_RB_02", rate:0.04}, {id:"AC_RG_03", rate:0.04}, {id:"CS_33", rate:0.04}] },
"TROLL": { name: "트롤", element: "WATER", race: "HUMANOID", armorClass: "LIGHT", atkType: "MELEE", level: 10, hp: 1200, mp: 20, str: 110, int: 10, vit: 90, agi: 5, dex: 10, vol: 20, luk: 5, def: 15, spd: 74, mov: 3, rng: 1, icon: "👺", skillIds: ["M032","M033"], drops: [{id:"WP_SP_03", rate:0.04}, {id:"WP_BW_03", rate:0.04}, {id:"AR_LT_03", rate:0.04}, {id:"SH_03", rate:0.04}, {id:"AC_RG_09", rate:0.04}, {id:"CS_20", rate:0.04}] },
"MINOTAUR": { name: "미노타우루스", element: "FIRE", race: "HUMANOID", armorClass: "HEAVY", atkType: "MELEE", level: 11, hp: 1100, mp: 30, str: 130, int: 12, vit: 60, agi: 10, dex: 15, vol: 15, luk: 5, def: 20, spd: 77, mov: 4, rng: 1, icon: "🐂", skillIds: ["M034","M035"], drops: [{id:"WP_AX_03", rate:0.04}, {id:"WP_ST_04", rate:0.04}, {id:"AR_HV_04", rate:0.04}, {id:"AR_RB_04", rate:0.04}, {id:"AC_SP_02", rate:0.03}, {id:"CS_14", rate:0.03}] },
"DULLAHAN": { name: "듀라한", element: "DARK", race: "UNDEAD", armorClass: "HEAVY", atkType: "MELEE", level: 12, hp: 900, mp: 50, str: 140, int: 30, vit: 50, agi: 20, dex: 25, vol: 10, luk: 5, def: 25, spd: 84, mov: 5, rng: 1, icon: "🎃", skillIds: ["M036","M037"], drops: [{id:"WP_SW_08", rate:0.04}, {id:"WP_DG_04", rate:0.04}, {id:"AR_LT_05", rate:0.04}, {id:"SH_05", rate:0.04}, {id:"WP_SW_09", rate:0.02}, {id:"CS_65", rate:0.03}] },
"TREANT": { name: "트리언트", element: "EARTH", race: "NATURE", armorClass: "HEAVY", atkType: "RANGED", level: 13, hp: 1500, mp: 50, str: 150, int: 40, vit: 100, agi: 5, dex: 5, vol: 10, luk: 10, def: 40, spd: 61, mov: 2, rng: 2, icon: "🌳", skillIds: ["M038","M039"], drops: [{id:"WP_SP_04", rate:0.04}, {id:"WP_BW_04", rate:0.04}, {id:"AR_SP_01", rate:0.04}, {id:"AR_SP_02", rate:0.04}, {id:"WP_ST_02", rate:0.03}, {id:"CS_51", rate:0.02}] },
"VAMPIRE": { name: "뱀파이어", element: "DARK", race: "UNDEAD", armorClass: "ROBE", atkType: "MAGIC", level: 14, hp: 800, mp: 100, str: 120, int: 120, vit: 40, agi: 40, dex: 30, vol: 20, luk: 20, def: 20, spd: 96, mov: 5, rng: 2, icon: "🧛", skillIds: ["M027","M040"], drops: [{id:"WP_AX_04", rate:0.04}, {id:"WP_ST_03", rate:0.04}, {id:"AR_HV_04", rate:0.04}, {id:"AR_RB_04", rate:0.04}, {id:"AC_RG_08", rate:0.03}, {id:"CS_78", rate:0.02}] },
"DRAKE": { name: "드레이크", element: "FIRE", race: "DRAGON", armorClass: "HEAVY", atkType: "MAGIC", level: 15, hp: 2000, mp: 100, str: 160, int: 100, vit: 100, agi: 20, dex: 20, vol: 20, luk: 15, def: 30, spd: 87, mov: 4, rng: 2, icon: "🐉", skillIds: ["M041","M042"], drops: [{id:"WP_SW_10", rate:0.03}, {id:"WP_DG_05", rate:0.03}, {id:"WP_SP_05", rate:0.03}, {id:"WP_AX_05", rate:0.03}, {id:"WP_BW_05", rate:0.03}, {id:"SH_07", rate:0.03}, {id:"AC_RG_06", rate:0.02}, {id:"CS_61", rate:0.02}] },
"LICH": { name: "리치", element: "DARK", race: "UNDEAD", armorClass: "ROBE", atkType: "MAGIC", level: 16, hp: 1000, mp: 500, str: 40, int: 200, vit: 50, agi: 30, dex: 30, vol: 20, luk: 20, def: 15, spd: 80, mov: 3, rng: 4, icon: "💀", skillIds: ["M043","M044"], drops: [{id:"WP_ST_05", rate:0.03}, {id:"WP_OT_02", rate:0.03}, {id:"AR_RB_05", rate:0.03}, {id:"AR_SP_02", rate:0.03}, {id:"AC_RG_10", rate:0.03}, {id:"CS_74", rate:0.03}, {id:"CS_64", rate:0.02}, {id:"WP_UN_01", rate:0.01}] },
"KRAKEN": { name: "크라켄", element: "WATER", race: "BEAST", armorClass: "HEAVY", atkType: "RANGED", level: 17, hp: 2500, mp: 200, str: 180, int: 80, vit: 120, agi: 5, dex: 10, vol: 15, luk: 10, def: 40, spd: 71, mov: 3, rng: 2, icon: "🦑", skillIds: ["M045","M046"], drops: [{id:"WP_SP_05", rate:0.03}, {id:"WP_OT_03", rate:0.03}, {id:"AR_LT_05", rate:0.03}, {id:"SH_07", rate:0.03}, {id:"AC_RG_07", rate:0.03}, {id:"CS_62", rate:0.03}, {id:"CS_46", rate:0.02}, {id:"WP_UN_02", rate:0.01}] },
"PHOENIX": { name: "피닉스", element: "FIRE", race: "BEAST", armorClass: "ROBE", atkType: "MAGIC", level: 18, hp: 1800, mp: 300, str: 100, int: 180, vit: 60, agi: 50, dex: 35, vol: 30, luk: 40, def: 25, spd: 99, mov: 6, rng: 3, icon: "🦅", skillIds: ["M047","M048"], drops: [{id:"WP_BW_05", rate:0.03}, {id:"WP_OT_04", rate:0.03}, {id:"AR_RB_03", rate:0.03}, {id:"AR_SP_01", rate:0.03}, {id:"AC_RG_05", rate:0.03}, {id:"CS_15", rate:0.03}, {id:"CS_03", rate:0.02}, {id:"SH_09", rate:0.01}] },
"BEHEMOTH": { name: "베히모스", element: "EARTH", race: "BEAST", armorClass: "HEAVY", atkType: "MELEE", level: 19, hp: 3500, mp: 50, str: 240, int: 40, vit: 150, agi: 5, dex: 5, vol: 20, luk: 10, def: 80, spd: 68, mov: 3, rng: 1, icon: "🦏", skillIds: ["M049","M050"], drops: [{id:"WP_AX_05", rate:0.03}, {id:"WP_OT_05", rate:0.03}, {id:"AR_HV_05", rate:0.03}, {id:"SH_05", rate:0.03}, {id:"AC_SP_03", rate:0.03}, {id:"CS_32", rate:0.03}, {id:"CS_39", rate:0.02}, {id:"AR_UN_01", rate:0.01}] },
"DRAGON": { name: "드래곤", element: "LIGHT", race: "DRAGON", armorClass: "HEAVY", atkType: "MAGIC", level: 20, hp: 5000, mp: 500, str: 300, int: 300, vit: 200, agi: 30, dex: 40, vol: 30, luk: 30, def: 60, spd: 90, mov: 5, rng: 3, icon: "🐲", skillIds: ["M051","M052","M053"], drops: [{id:"WP_UN_01", rate:0.02}, {id:"WP_UN_02", rate:0.02}, {id:"AR_UN_01", rate:0.02}, {id:"SH_09", rate:0.02}, {id:"WP_SW_10", rate:0.05}, {id:"AR_HV_05", rate:0.05}, {id:"AR_RB_05", rate:0.05}, {id:"CS_11", rate:0.05}] },
"DECOY": { name: "미끼", element: "NONE", race: "CONSTRUCT", armorClass: "LIGHT", atkType: "MELEE", level: 1, hp: 50, mp: 0, str: 0, int: 1, vit: 0, agi: 0, dex: 0, vol: 0, luk: 0, def: 0, spd: 10, mov: 3, rng: 1, icon: "🤡", skillIds: ["없음"], drops: [] },
"WALL_STONE": { name: "돌벽", element: "EARTH", race: "CONSTRUCT", armorClass: "HEAVY", atkType: "MELEE", level: 1, hp: 200, mp: 0, str: 0, int: 1, vit: 0, agi: 0, dex: 0, vol: 0, luk: 0, def: 50, spd: 1, mov: 2, rng: 2, icon: "🧱", skillIds: ["없음"], drops: [] },

};