import * as Formulas from '../../utils/formulas.js';

export class RangeManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    // ⭐ 1. 캐릭터가 실제로 서 있는 발판(지형)의 고도 (사거리 및 데미지 계산용)
    getStandingHeight(q, r) {
        const tData = this.battle.grid.getTerrainData(q, r);
        return tData ? (tData.h || 0) : 0;
    }

    // ⭐ 2. 시야(LOS)를 가리는 장애물의 체감 고도 (사선 가림 판정용)
    getObstacleHeight(q, r) {
        let h = this.getStandingHeight(q, r);
        
        // 타일 위에 석화된 유닛이나 벽이 있다면 고도 2 상승 (시야 차단용)
        const occupant = this.battle.getUnitAt(q, r);
        if (occupant) {
            if (occupant.isWall || this.battle.hasStatus(occupant, 'STAT_PETRIFY')) {
                h += 2; 
            }
        }
        return h;
    }

    // ⭐ 기획안 100% 반영: 무기별 수평/수직 유효 사거리 메타데이터
    getWeaponRangeData(weaponSubType) {
        const rules = {
            'SWORD': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'AXE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'DAGGER': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'MACE': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            'FAN': { min: 1, max: 1, vMax: 2, vMin: -2, type: 'MELEE' },
            
            'SPEAR': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE_PIERCE' },
            'LANCE': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE_PIERCE' },
            'HALBERD': { min: 1, max: 2, vMax: 3, vMin: -3, type: 'MELEE' }, // 관통 불가 명시
            
            'WHIP': { min: 1, max: 3, vMax: 3, vMin: -3, type: 'MELEE' },
            'INSTRUMENT': { min: 1, max: 3, vMax: 3, vMin: -3, type: 'MELEE' },
            
            'BOW': { min: 2, max: 6, vMax: 5, vMin: -99, type: 'PARABOLA', varMod: 1 }, // 고저차 1당 1
            'CROSSBOW': { min: 2, max: 7, vMax: 99, vMin: -99, type: 'DIRECT' },
            'SLING': { min: 2, max: 4, vMax: 3, vMin: -99, type: 'PARABOLA', varMod: 0 }, // 가변 사거리 없음
            
            'POTION': { min: 1, max: 3, vMax: 3, vMin: -99, type: 'PARABOLA', varMod: 2 } // 고저차 2당 1
        };
        return rules[weaponSubType] || rules['SWORD']; // 기본값 검
    }

    // ⭐ [1] 스킬 궤적 데이터 추출 (7대 키워드 적용)
    getSkillRangeData(skill) {
        // 1. 엑셀에서 입력한 7대 키워드를 최우선으로 적용합니다.
        if (skill.castType) {
            return String(skill.castType).toUpperCase().trim();
        }
        
        // 2. 만약 엑셀 데이터가 누락되었다면 자체 추론 (안전장치)
        const areaStr = String(skill.area || '0').toUpperCase();
        const targetStr = String(skill.target || '').toUpperCase();
        
        if (targetStr === 'GLOBAL' || areaStr.includes('999')) return 'GLOBAL';
        if (parseInt(skill.rng) === 1 && (skill.atkType === 'PHYS' || !skill.atkType)) return 'MELEE';
        
        return 'DIRECT'; 
    }

    // ⭐ [2] 타겟팅 사거리 및 궤적(장애물) 유효성 검사 (7대 궤적 적용)
    isTargetInValidRange(caster, targetHex, skill) {
        const dist = this.battle.grid.getDistance(caster, targetHex);
        
        // 발판 높이로만 순수하게 계산합니다.
        const casterH = this.getStandingHeight(caster.q, caster.r);
        const targetH = this.getStandingHeight(targetHex.q, targetHex.r);
        const diffH = targetH - casterH; // 양수면 상향, 음수면 하향

        const isBasicAttack = (skill.id === '1000');
        const isPotion = skill.type === 'ITEM' && !skill.castType; 

        // [일반 무기 타격 판정] (무기 고유의 포물선/직사 속성 유지)
        if (isBasicAttack || isPotion) {
            let weaponType = 'SWORD';
            if (isPotion) {
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
        // [7대 궤적 키워드 기반 스킬 타격 판정]
        else {
            const castType = this.getSkillRangeData(skill);
            const baseRange = parseInt(skill.rng) || 1;

            // 1. GLOBAL (전체/자신) - 거리, 장애물 완전 무시
            if (castType === 'GLOBAL') return true; 

            // 2. MELEE (근접) - 단차 2칸까지만 찌를 수 있음
            if (castType === 'MELEE') {
                if (dist > baseRange) return false;
                if (Math.abs(diffH) > 2) return false; 
                return true; 
            }

            // 3. ARC (곡사) - 하향 사격 보너스, 얕은 장애물 넘김
            if (castType === 'ARC') {
                let adjustedMaxRange = baseRange;
                if (diffH < 0) { 
                    adjustedMaxRange += Math.floor(Math.abs(diffH) / 1); // 하향 사격 사거리 1 증가
                } else if (diffH > 0) { 
                    adjustedMaxRange -= Math.floor(diffH / 1); // 상향 사격 사거리 1 감소
                }
                adjustedMaxRange = Math.max(1, adjustedMaxRange);

                if (dist > adjustedMaxRange) return false;
                if (diffH > 5) return false; // 최대 상향 한계

                return this.checkLOS(caster, targetHex, 'PARABOLA', casterH, targetH, dist);
            }

            // 4. DROP (강하) - 장애물과 벽 완벽 무시
            if (castType === 'DROP') {
                if (dist > baseRange) return false;
                return true; 
            }

            // 5. GROUND (지면) - 층간 단차가 3을 넘어가면 땅이 끊긴 것으로 간주
            if (castType === 'GROUND') {
                if (dist > baseRange) return false;
                if (Math.abs(diffH) > 3) return false; 
                return true; 
            }

            // 6. WAVE (파동) - 벽을 뚫고 지나가지만, 상하 한계(5)가 존재
            if (castType === 'WAVE') {
                if (dist > baseRange) return false;
                if (Math.abs(diffH) > 5) return false; 
                return true;
            }

            // 7. DIRECT (직사) - 기본값, 앞에 적/아군/벽이 있으면 막힘
            if (dist > baseRange) return false;
            return this.checkLOS(caster, targetHex, 'DIRECT', casterH, targetH, dist);
        }
    }

    // ⭐ [3] 광역기(Splash) 지형 필터링 엔진 (7대 궤적 적용)
    getSplashHexes(caster, centerHex, skill) {
        const areaStr = String(skill.area || '0').toUpperCase();
        const castType = this.getSkillRangeData(skill);
        const areaRadius = parseInt(areaStr.replace(/[^0-9]/g, '')) || 0; // 문자열에서 숫자만 추출

        let rawHexes = [];
        
        // 모양에 따른 순수 범위(헥스) 획득
        if (castType === 'GLOBAL' || areaStr.includes('999')) {
            rawHexes = Array.from(this.battle.grid.hexes.values());
        } else if (castType === 'WAVE') {
            // 파동형은 area가 없으면 rng를 파동의 반경으로 간주
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

        // 7대 궤적별 스플래시 고저차(단차) 필터링
        rawHexes.forEach(hex => {
            const targetH = this.getStandingHeight(hex.q, hex.r);
            let isValid = true;

            if (castType === 'MELEE' || castType === 'ARC' || castType === 'DIRECT') {
                // 물리적/직사형 광역기 (폭발 화살, 횡렬 베기 등) -> 타격 중심과 3칸 이상 단차가 나면 빗나감
                if (Math.abs(targetH - centerH) > 3) isValid = false;
            } 
            else if (castType === 'DROP') {
                // 하늘에서 떨어지는 광역기 (메테오) -> 지형 높낮이 무시 (아주 관대함)
                if (Math.abs(targetH - centerH) > 5) isValid = false;
            } 
            else if (castType === 'GROUND') {
                // 바닥을 타는 장판형 (독구름, 토벽) -> 중심과 고저차가 1이라도 나면(계단형) 효과가 끊김
                if (Math.abs(targetH - centerH) > 1) isValid = false;
            } 
            else if (castType === 'WAVE') {
                // 시전자 중심 파동형 -> 시전자(casterH)와의 고저차만 판별
                if (Math.abs(targetH - casterH) > 5) isValid = false;
            }

            if (isValid) validHexes.push(hex);
        });

        return validHexes;
    }

    // 궤적(LOS) 상세 검사 엔진
    checkLOS(startUnit, targetHex, type, startH, targetH, dist) {
        // 근접 무기는 궤적 검사 생략 (2칸 창/할버드 찌르기 포함)
        if (type === 'MELEE' || type === 'MELEE_PIERCE') return true;

        const line = this.battle.grid.getLine(startUnit, targetHex, dist);
        // 시전자와 타겟 헥스를 제외한 순수 중간 장애물 헥스들만 추출
        const intermediateHexes = line.filter(h => 
            (h.q !== startUnit.q || h.r !== startUnit.r) && 
            (h.q !== targetHex.q || h.r !== targetHex.r)
        );

        if (intermediateHexes.length === 0) return true; // 중간에 아무것도 없으면 통과

        // [직사형 궤적 - 석궁, 마법, 무희 안무]
        if (type === 'DIRECT') {
            for (let i = 0; i < intermediateHexes.length; i++) {
                const h = intermediateHexes[i];
                const stepRatio = (i + 1) / (intermediateHexes.length + 1);
                
                // ⭐ [버그 수정 1] 타겟의 발밑이 아닌, 가슴 높이(targetH + 1)를 향해 사선을 긋도록 수정
                const currentLineH = (startH + 1) + ((targetH + 1) - (startH + 1)) * stepRatio; 
                
                const obstacleH = this.getObstacleHeight(h.q, h.r);
                if (obstacleH >= currentLineH) {
                    return false; // 직선 사선이 벽이나 석화 유닛에 막힘
                }
            }
            return true;
        }
        // [포물선 궤적 - 활, 투석, 포션]
        else if (type === 'PARABOLA') {
            // 1. 포물선 정점(Apex) 한계 판정
            const apexH = ((startH + targetH) / 2) + (dist / 2);
            
            for (let i = 0; i < intermediateHexes.length; i++) {
                const h = intermediateHexes[i];
                // ⭐ [수정됨] 장애물을 체크할 때는 ObstacleHeight 사용
                const obstacleH = this.getObstacleHeight(h.q, h.r);
                // 장애물이 포물선 정점보다 높으면 화살이 벽을 넘지 못함
                if (obstacleH >= apexH) {
                    return false; 
                }
            }

            // 2. 사각지대(Dead Zone) 판정: 타겟 바로 앞의 높은 벽 검사
            if (dist >= 4 && targetH <= startH) { 
                const lastObstacle = intermediateHexes[intermediateHexes.length - 1]; // 타겟 바로 앞 칸
                const lastObstacleH = this.getObstacleHeight(lastObstacle.q, lastObstacle.r);
                
                // 타겟 바로 앞의 벽이 타겟보다 2 이상 높다면 화살이 머리 위를 지나감
                if (lastObstacleH - targetH >= 2) {
                    return false; // 사각지대 판정으로 공격 불가
                }
            }
            return true;
        }

        return true;
    }

    // UI에 타겟팅(빨간 타일)을 그려주기 위한 전체 맵 스캐너
    getAttackableHexes(caster, skill) {
        const validHexes = [];
        
        // 탐색 최적화를 위해 이론상 최대 사거리 도출
        let absoluteMaxRange = parseInt(skill.rng) || 1;
        
        // ⭐ [버그 수정] 무기 사거리가 스킬 사거리에 더해지는 렌더링 버그 제거
        // 오직 '캐스팅 사거리 증가 버프'를 받았을 때만 늘어나도록 수정합니다.
        let rngBonus = 0; 
        if (caster.buffs) {
            caster.buffs.forEach(b => {
                if (b.type === 'BUFF_CAST_RANGE') rngBonus += (parseFloat(b.val) || 0);
            });
        }

        // 고지대 하향 사격 보너스를 고려하여 넉넉하게 스캔 반경을 잡습니다 (+10칸)
        let searchRadius = absoluteMaxRange + rngBonus + 10; 
        if (skill.target === 'GLOBAL' || (skill.area && String(skill.area).includes('999'))) {
            searchRadius = 99;
        }

        // 범위 내 버프 보정치를 미리 더해둔 스킬 클론
        const checkSkill = { ...skill, rng: absoluteMaxRange + rngBonus };

        // 맵 전체(또는 searchRadius 내의) 헥스를 순회하며 유효성 검사
        this.battle.grid.hexes.forEach(hex => {
            const dist = this.battle.grid.getDistance(caster, hex);
            if (dist <= searchRadius) {
                // 이 헥스를 향해 쏘았을 때 궤적, 사거리, 고저차가 모두 유효한가?
                if (this.isTargetInValidRange(caster, hex, checkSkill)) {
                    validHexes.push(hex);
                }
            }
        });
        
        return validHexes;
    }
    
}