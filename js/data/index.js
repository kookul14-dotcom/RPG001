import { ITEM_DATA } from './items.js';
import { STAGE_DATA } from './stages.js';
import { SKILL_DATABASE } from './skills.js';
import { CLASS_DATA } from './units.js';           // ⭐ 원래대로 복구됨 (기존 영웅/몬스터)
import { JOB_CLASS_DATA } from './classes.js';     // ⭐ 신규 72개 직업 데이터 추가
import { PERK_DATA } from './perks.js';
import { 
    ELEMENTS, 
    EFFECTS, 
    TERRAIN_TYPES, 
    HEX_SIZE, 
    STAT_NAMES,
    BUILDING_TYPES,
    TIER_REQ 
} from './constants.js';

export { 
    ITEM_DATA, 
    STAGE_DATA, 
    SKILL_DATABASE, 
    CLASS_DATA,        // ⭐ 기존 데이터 정상 출력
    JOB_CLASS_DATA,    // ⭐ 신규 데이터 정상 출력
    PERK_DATA, 
    ELEMENTS, 
    EFFECTS,
    TERRAIN_TYPES,
    BUILDING_TYPES,
    HEX_SIZE,
    STAT_NAMES,
    TIER_REQ
};