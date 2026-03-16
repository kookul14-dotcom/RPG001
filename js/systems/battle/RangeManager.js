import * as Formulas from '../../utils/formulas.js';

export class RangeManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    // 1. 캐릭터가 실제로 서 있는 발판(지형)의 고도
    getStandingHeight(q, r) {
        const tData = this.battle.grid.getTerrainData(q, r);
        return tData ? (tData.h || 0) : 0;
    }

    // 2. 시야(LOS)를 가리는 장애물의 체감 고도
    getObstacleHeight(q, r) {
        let h = this.getStandingHeight(q, r);
        
        const occupant = this.battle.getUnitAt(q, r);
        if (occupant) {
            if (occupant.isWall || this.battle.hasStatus(occupant, 'STAT_PETRIFY')) {
                h += 2; 
            }
        }
        return h;
    }

    // 3. 기획안 100% 반영: 무기별 수평/수직 유효 사거리 메타데이터
    getWeaponRangeData(weaponSubType) {
        const rules = {
            // 1. Sword
            'SHORT_SWORD': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'ARMING_SWORD': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'RAPIER': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'BASTARD_SWORD': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'GREAT_SWORD': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            
            // 2. Blade
            'HWANDO': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'KATANA': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'DADAO': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            
            // 3. Axe
            'HAND_AXE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'BATTLE_AXE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'GREAT_AXE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },

            // 4. Blunt Weapon
            'MACE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'MORNING_STAR': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'WAR_HAMMER': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'FLAIL': { min: 1, max: 1, vMax: 3, vMin: -3, type: 'MELEE' },
            'MAUL': { min: 1, max: 1, vMax: 3, vMin: -3, type: 'MELEE' },

            // 5. Fist Weapon
            'BARE_HANDS': { min: 1, max: 1, vMax: 1, vMin: -1, type: 'MELEE' },
            'KNUCKLE': { min: 1, max: 1, vMax: 1, vMin: -1, type: 'MELEE' },
            'CESTUS': { min: 1, max: 1, vMax: 1, vMin: -1, type: 'MELEE' },

            // 6. Striking Weapon
            'TONFA': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'NUNCHAKU': { min: 1, max: 1, vMax: 3, vMin: -3, type: 'MELEE' },
            'QUARTERSTAFF': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE_WIDE' }, // 스플래시에서 횡렬 3칸 처리

            // 7. Staff
            'WAND': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'ROD': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'GREAT_STAFF': { min: 1, max: 1, vMax: 3, vMin: -3, type: 'MELEE' },

            // 8. Spear
            'SHORT_SPEAR': { min: 1, max: 1, vMax: 3, vMin: -3, type: 'MELEE' },
            'LONG_SPEAR': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE_PIERCE' },
            'LANCE': { min: 1, max: 2, vMax: 2, vMin: -2, type: 'MELEE_PIERCE' },
            'HALBERD': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE' },
            'GLAIVE': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE' },
            'GUAN_DAO': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE' },

            // 9. Bow
            'SHORT_BOW': { min: 2, max: 6, vMax: 5, vMin: -99, type: 'PARABOLA', varMod: 1 },
            'COMPOSITE_BOW': { min: 2, max: 6, vMax: 5, vMin: -99, type: 'PARABOLA', varMod: 1 },
            'LONG_BOW': { min: 3, max: 7, vMax: 6, vMin: -99, type: 'PARABOLA', varMod: 1 },
            'CROSSBOW': { min: 2, max: 7, vMax: 99, vMin: -99, type: 'DIRECT' },

            // 10. Exotic Weapon
            'CLAWS': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'DAGGER': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'GRIMOIRE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'FAN': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'WHIP': { min: 1, max: 3, vMax: 2, vMin: -2, type: 'MELEE_PIERCE' },
            'INSTRUMENT': { min: 1, max: 3, vMax: 99, vMin: -99, type: 'MELEE' }, // 수직 무제한
            'SLING': { min: 2, max: 4, vMax: 3, vMin: -99, type: 'PARABOLA', varMod: 0 },
            
            // 연금술사 아이템 투척
            'POTION': { min: 1, max: 3, vMax: 3, vMin: -99, type: 'PARABOLA', varMod: 2 } 
        };
        return rules[weaponSubType] || rules['SHORT_SWORD'];
    }

    // 4. 기획안 17종 스킬 형태 분류
    getSkillRangeType(skill) {
        if (skill.castType) return String(skill.castType).toUpperCase().trim();
        
        // 데이터 누락 시 기본 추론
        const targetStr = String(skill.target || '').toUpperCase();
        if (targetStr === 'GLOBAL') return 'GLOBAL';
        if (skill.atkType === 'PHYS' && parseInt(skill.rng) === 1) return 'WEAPON';
        return 'DIRECT'; 
    }

    // 5. 타겟팅 사거리 및 고저차 유효성 검사 (17종 궤적 적용)
    isTargetInValidRange(caster, targetHex, skill) {
        if (caster.q === targetHex.q && caster.r === targetHex.r) return true;

        const dist = this.battle.grid.getDistance(caster, targetHex);
        
        // 직선/돌진기 6방향 축 검사 유지
        const areaStrForLine = String(skill.area || '0').toUpperCase();
        const isDashEffect = skill.effects && skill.effects.some(e => 
            ['MOVE_ATK', 'ATK_MOVE', 'ATK_DASH', 'MOVE_DASH', 'CHARGE', 'MOVE_CHARGE'].includes(e.type)
        );
        const hasDashName = skill.name && ['돌진', '돌격', '혈로', '강철의 행진', '직선'].some(keyword => skill.name.includes(keyword));

        if (areaStrForLine.includes('LINE') || isDashEffect || hasDashName) {
            const dq = targetHex.q - caster.q;
            const dr = targetHex.r - caster.r;
            if (dq !== 0 && dr !== 0 && dq !== -dr) return false;
        }

        const casterH = this.getStandingHeight(caster.q, caster.r);
        const targetH = this.getStandingHeight(targetHex.q, targetHex.r);
        const diffH = targetH - casterH; 

        const castType = this.getSkillRangeType(skill);
        const baseRange = parseInt(skill.rng) || 1;

        // (1) 무기 연동형 및 일반 타격/아이템 투척
        if (castType === 'WEAPON' || skill.id === '1000' || (skill.type === 'ITEM' && !skill.castType)) {
            let weaponType = 'BARE_HANDS'; // 기본 맨손
            if (skill.type === 'ITEM') {
                weaponType = 'POTION';
            } else if (caster.equipment && caster.equipment.mainHand) {
                const wepItem = this.battle.gameApp.itemData[caster.equipment.mainHand];
                if (wepItem && wepItem.subType) weaponType = wepItem.subType;
            }
            const wData = this.getWeaponRangeData(weaponType);

            let adjustedMaxRange = wData.max;
            if (wData.type === 'PARABOLA' && wData.varMod > 0) {
                if (diffH < 0) {
                    adjustedMaxRange += Math.floor(Math.abs(diffH) / wData.varMod);
                } else if (diffH > 0) {
                    adjustedMaxRange -= Math.floor(diffH / wData.varMod);
                }
            }
            adjustedMaxRange = Math.max(wData.min, adjustedMaxRange); 

            if (dist < wData.min || dist > adjustedMaxRange) return false; 
            if (diffH > wData.vMax || diffH < wData.vMin) return false;    

            return this.checkLOS(caster, targetHex, wData.type, casterH, targetH, dist);
        } 

        // 17종 스킬 궤적 판정 로직
        switch(castType) {
            case 'GLOBAL': // (15) 전체형
            case 'DROP_VERTICAL': // (6) 수직 낙하형
            case 'PILLAR': // (12) 기둥형
            case 'CHAIN': // (13) 지형 연쇄형
                if (castType !== 'GLOBAL' && dist > baseRange) return false;
                return true; // 거리와 장애물, 고저차 무시
                
            case 'INJECT': // (2) 주입형
            case 'DEPLOY': // (5) 전개형
                if (dist > baseRange) return false;
                if (Math.abs(diffH) > 2) return false;
                return true;

            case 'THROW': // (3) 투척형
                if (dist > baseRange) return false;
                if (diffH > 3) return false; // 상향 +3, 하향 무제한
                return this.checkLOS(caster, targetHex, 'PARABOLA', casterH, targetH, dist);

            case 'DROP_ARC': // (7) 투하형
                if (dist > baseRange) return false;
                if (diffH > 5) return false; // 상향 +5, 하향 무제한
                return true; // 장애물 무시

            case 'GROUND': // (8) 지면형
                if (dist > baseRange) return false;
                if (Math.abs(diffH) > 1) return false; // 고저차 ±1
                return true;

            case 'BARD': // (16) 바드의 영창
                if (dist > 4) return false;
                if (Math.abs(diffH) > 4) return false;
                return true; // 지형/장애물 무시

            case 'DANCER': // (17) 무희의 안무
                if (dist > 5) return false;
                if (Math.abs(diffH) > 5) return false;
                return this.checkLOS(caster, targetHex, 'DIRECT', casterH, targetH, dist);

            case 'TARGET': // (14) 지정형
                if (dist > baseRange) return false;
                return this.checkLOS(caster, targetHex, 'DIRECT', casterH, targetH, dist); // 시야 차단만 확인

            case 'DIRECT': // (4) 직사형 및 기본 처리
            default:
                if (dist > baseRange) return false;
                return this.checkLOS(caster, targetHex, 'DIRECT', casterH, targetH, dist);
        }
    }

    // 6. 스플래시 지형 필터링 (기획안의 방사, 폭발, 분출 등 세부 처리)
    getSplashHexes(caster, centerHex, skill) {
        const areaStr = String(skill.area || '0').toUpperCase();
        const castType = this.getSkillRangeType(skill);
        const areaRadius = parseInt(areaStr.replace(/[^0-9]/g, '')) || 0; 

        let rawHexes = [];
        
        if (castType === 'GLOBAL' || areaStr.includes('999')) {
            rawHexes = Array.from(this.battle.grid.hexes.values());
        } else if (castType === 'RADIAL' || castType === 'WAVE') {
            const rad = areaRadius > 0 ? areaRadius : (parseInt(skill.rng) || 0);
            rawHexes = rad > 0 ? this.battle.grid.getShapeHexes(caster, caster, `CIRCLE_${rad}`) : [centerHex];
        } else if (areaStr !== '0' && areaStr !== 'SINGLE') {
            rawHexes = this.battle.grid.getShapeHexes(centerHex, caster, areaStr);
        } else {
            const centerNode = this.battle.grid.hexes.get(`${centerHex.q},${centerHex.r}`);
            rawHexes = centerNode ? [centerNode] : [];
        }

        const validHexes = [];
        const centerH = this.getStandingHeight(centerHex.q, centerHex.r);
        const casterH = this.getStandingHeight(caster.q, caster.r);

        // 분출형(ERUPT)의 경우 범위 내 가장 낮은 지형 고도 계산
        let lowestH = centerH;
        if (castType === 'ERUPT') {
            lowestH = Math.min(...rawHexes.map(h => this.getStandingHeight(h.q, h.r)));
        }

        rawHexes.forEach(hex => {
            const targetH = this.getStandingHeight(hex.q, hex.r);
            const occupant = this.battle.getUnitAt(hex.q, hex.r);
            const isFlying = occupant && occupant.isFlying; // 비행 유닛 판별

            let isValid = true;

            if (castType === 'GROUND') { // (8) 지면형
                if (isFlying || Math.abs(targetH - casterH) > 1) isValid = false;
            } 
            else if (castType === 'ERUPT') { // (9) 분출형
                if (isFlying || targetH > lowestH + 2) isValid = false;
            }
            else if (castType === 'EXPLOSION') { // (10) 폭발형
                if (Math.abs(targetH - centerH) > 3) isValid = false;
            }
            else if (castType === 'RADIAL') { // (11) 방사형
                const radDist = this.battle.grid.getDistance(caster, hex);
                if (Math.abs(targetH - casterH) > radDist) isValid = false; 
            }
            else if (castType === 'WEAPON' || castType === 'DIRECT') {
                if (Math.abs(targetH - centerH) > 3) isValid = false;
            }

            if (isValid) validHexes.push(hex);
        });

        return validHexes;
    }

    // 7. 궤적(LOS) 상세 검사 엔진
    checkLOS(startUnit, targetHex, type, startH, targetH, dist) {
        if (type === 'MELEE' || type === 'MELEE_PIERCE' || type === 'MELEE_WIDE') return true;

        const line = this.battle.grid.getLine(startUnit, targetHex, dist);
        const intermediateHexes = line.filter(h => 
            (h.q !== startUnit.q || h.r !== startUnit.r) && 
            (h.q !== targetHex.q || h.r !== targetHex.r)
        );

        if (intermediateHexes.length === 0) return true; 

        if (type === 'DIRECT') {
            for (let i = 0; i < intermediateHexes.length; i++) {
                const h = intermediateHexes[i];
                const stepRatio = (i + 1) / (intermediateHexes.length + 1);
                
                const currentLineH = (startH + 1) + ((targetH + 1) - (startH + 1)) * stepRatio; 
                
                const obstacleH = this.getObstacleHeight(h.q, h.r);
                if (obstacleH >= currentLineH) {
                    return false; 
                }
            }
            return true;
        }
        else if (type === 'PARABOLA') {
            const apexH = ((startH + targetH) / 2) + (dist / 2);
            
            for (let i = 0; i < intermediateHexes.length; i++) {
                const h = intermediateHexes[i];
                const obstacleH = this.getObstacleHeight(h.q, h.r);
                if (obstacleH >= apexH) {
                    return false; 
                }
            }

            if (dist >= 4 && targetH <= startH) { 
                const lastObstacle = intermediateHexes[intermediateHexes.length - 1]; 
                const lastObstacleH = this.getObstacleHeight(lastObstacle.q, lastObstacle.r);
                
                if (lastObstacleH - targetH >= 2) {
                    return false; 
                }
            }
            return true;
        }

        return true;
    }

    // 8. UI 타겟팅 전체 맵 스캐너
    getAttackableHexes(caster, skill) {
        const validHexes = [];
        let absoluteMaxRange = parseInt(skill.rng) || 1;
        
        let rngBonus = 0; 
        if (caster.buffs) {
            caster.buffs.forEach(b => {
                if (b.type === 'BUFF_CAST_RANGE') rngBonus += (parseFloat(b.val) || 0);
            });
        }

        let searchRadius = absoluteMaxRange + rngBonus + 10; 
        if (skill.target === 'GLOBAL' || (skill.area && String(skill.area).includes('999'))) {
            searchRadius = 99;
        }

        const checkSkill = { ...skill, rng: absoluteMaxRange + rngBonus };

        this.battle.grid.hexes.forEach(hex => {
            const dist = this.battle.grid.getDistance(caster, hex);
            if (dist <= searchRadius) {
                if (this.isTargetInValidRange(caster, hex, checkSkill)) {
                    validHexes.push(hex);
                }
            }
        });
        
        return validHexes;
    }
}