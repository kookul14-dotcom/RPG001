export class TargetingManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    collectTargets(effectData, targetHex, clickedUnit, caster, skill, options = {}) {
        let targets = [];
        
        // 1. 타겟 타입 및 범위 정보 파악
        const targetType = String(effectData.target || skill?.target || '').toUpperCase().trim();
        const areaStr = String(effectData.area || skill?.area || '0');
        const effectType = String(effectData.type || '').toUpperCase();

        // 2. 대상 유닛 풀(Pool) 설정: 부활 스킬이면 죽은 유닛, 아니면 산 유닛
        let units;
        const isResurrection = ['RESURRECT', 'REVIVE', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL'].includes(effectType) || 
                               targetType.includes('CORPSE');

        if (isResurrection) {
            // 죽은 유닛들만 필터링 (부활 대상)
            units = this.battle.units.filter(u => u.curHp <= 0);
        } else {
            // 산 유닛들만 필터링 (일반 스킬)
            units = this.battle.units.filter(u => u.curHp > 0);
        }

        const center = targetHex || clickedUnit || caster; 

        // 3. 단일 및 특수 타겟팅 (빠른 리턴)
        if (targetType === 'SELF' || targetType === 'PASSIVE') return [caster];

        // ALLY_CORPSE: 단일 죽은 아군 타겟팅
        if (targetType === 'ALLY_CORPSE') {
            if (clickedUnit && clickedUnit.team === caster.team && clickedUnit.curHp <= 0) {
                targets.push(clickedUnit);
            }
            return targets;
        }
        
        // ALLY_DEAD (기존 코드 유지 및 호환)
        if (targetType === 'ALLY_DEAD') {
            return targetHex ? 
                [this.battle.units.find(u => u.curHp <= 0 && u.team === caster.team && u.q === targetHex.q && u.r === targetHex.r)].filter(Boolean) : 
                this.battle.units.filter(u => u.curHp <= 0 && u.team === caster.team);
        }

        if (targetType === 'ENEMY_SINGLE' || targetType === 'ENEMY') {
            // CLEAVE, BEHIND는 단일 타겟처럼 보여도 범위가 있으므로 예외 처리
            if (!['CLEAVE', 'BEHIND'].some(k => areaStr.includes(k))) {
                if (clickedUnit && clickedUnit.team !== caster.team && clickedUnit.curHp > 0) targets.push(clickedUnit);
                return targets;
            }
        } 
        
        if (targetType === 'ALLY_SINGLE' || targetType === 'ALLY') {
            if (clickedUnit && clickedUnit.team === caster.team && clickedUnit.curHp > 0) targets.push(clickedUnit);
            return targets;
        }

        if (targetType === 'STRYKER' || targetType === 'CASTER') {
            if (options.triggerUnit) targets.push(options.triggerUnit);
            return targets;
        }

        if (targetType === 'ENEMY_RAND' || targetType.includes('RANDOM')) {
            const aliveEnemies = units.filter(u => u.team !== caster.team);
            if (aliveEnemies.length > 0) targets.push(aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]);
            return targets;
        }

        if (targetType === 'TARGET_FROZEN') {
            return units.filter(u => u.team !== caster.team && u.buffs.some(b => b.type === 'STAT_FREEZE' || b.type === 'CC_FREEZE'));
        }

        // 4. 글로벌 스킬 최적화
        if (targetType === 'GLOBAL' || targetType === 'ALL_STAT' || areaStr.includes('999')) {
            if (targetType.includes('ENEMY')) return units.filter(u => u.team !== caster.team);
            if (targetType.includes('ALLY')) return units.filter(u => u.team === caster.team);
            return units;
        }

        // 5. ⭐ RangeManager를 거쳐 철저히 검증된 유효 사거리(AOE) 타일 집합 호출
        let validSplashHexes = [];
        if (this.battle.rangeManager) {
            validSplashHexes = this.battle.rangeManager.getSplashHexes(caster, center, skill || effectData);
        } else {
            // fallback (에러 방지용)
            validSplashHexes = this.battle.grid.getShapeHexes(center, caster, areaStr);
        }
        let shapeHexSet = new Set(validSplashHexes.map(h => `${h.q},${h.r}`));

        const isAggressive = /^(DMG|DEBUFF|STAT_|CC|SYS_STEAL|ATK)/.test(effectType);
        
        units.forEach(u => {
            // RangeManager를 통과한 헥스 위에 서 있는 유닛만 타격 대상(Set)으로 인정
            if (shapeHexSet.has(`${u.q},${u.r}`)) {
                if (targetType === 'AREA_ENEMY' || targetType.includes('ENEMY')) { 
                    if (u.team !== caster.team) targets.push(u); 
                } 
                else if (targetType === 'AREA_ALLY' || targetType === 'AREA_ALLY_CORPSE' || targetType.includes('ALLY')) { 
                    if (u.team === caster.team) targets.push(u); 
                }
                else if (targetType === 'AREA_ALL' || targetType === 'ANY' || targetType === 'GROUND') { 
                    targets.push(u); 
                }
                else {
                    // 타겟 타입이 명확하지 않을 때 성향(공격/지원)에 따라 자동 판단
                    if (isAggressive && u.team !== caster.team) targets.push(u);
                    else if (!isAggressive && u.team === caster.team) targets.push(u);
                }
            }
        });

        // 6. 경로 타겟팅 (돌진 등)
        if (targetType === 'PATH_ENEMY' && options.pathHexes) {
            const pathSet = new Set(options.pathHexes.map(h => `${h.q},${h.r}`));
            // 돌진은 산 적만 대상이므로 this.units에서 hp>0 필터링을 다시 하거나 units가 산 유닛일 때만 동작
            return this.battle.units.filter(u => u.curHp > 0 && u.team !== caster.team && pathSet.has(`${u.q},${u.r}`));
        }

        return targets;
    }
}