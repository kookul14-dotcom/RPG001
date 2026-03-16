export class MovementEffectManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    async handleMoveAttack(caster, clickedUnit, targetHex, effect, skill, options = {}) {
        const grid = this.battle.grid;
        const maxMoveRange = parseInt(skill.rng) || parseInt(skill.area) || 1;

        let destTarget = targetHex || (clickedUnit ? {q: clickedUnit.q, r: clickedUnit.r} : null);
        if (!destTarget) return false;

        const lineHexes = grid.getLine(caster, destTarget, maxMoveRange);
        const dashDir = grid.getDirection(caster, destTarget); 

        let lastEmptyHex = {q: caster.q, r: caster.r}; 
        let hitEnemies = [];
        
        const isPierce = skill.name.includes('혈로');
        const isCharge = skill.name === '돌격' || skill.name === '강철의 행진'; 
        let piercedCount = 0;

        for (const h of lineHexes) {
            if (h.q === caster.q && h.r === caster.r) continue; 

            if (!grid.isPassable(h.q, h.r)) break; 

            const occupant = this.battle.getUnitAt(h.q, h.r);
            
            if (occupant) {
                if (occupant.team === caster.team) {
                    break; 
                } else if (occupant.curHp > 0) {
                    if (!hitEnemies.includes(occupant)) hitEnemies.push(occupant);

                    if (isPierce) {
                        piercedCount++;
                        if (piercedCount > 1) break; 
                        continue; 
                    } 
                    else if (isCharge) {
                        const leftHex = grid.getNeighborInDir(occupant, (dashDir + 5) % 6);
                        const rightHex = grid.getNeighborInDir(occupant, (dashDir + 1) % 6);
                        
                        let pushDest = null;
                        if (leftHex && grid.isPassable(leftHex.q, leftHex.r) && !this.battle.getUnitAt(leftHex.q, leftHex.r)) pushDest = leftHex;
                        else if (rightHex && grid.isPassable(rightHex.q, rightHex.r) && !this.battle.getUnitAt(rightHex.q, rightHex.r)) pushDest = rightHex;

                        if (pushDest) {
                            this.battle.createProjectile(occupant, pushDest);
                            occupant.q = pushDest.q; occupant.r = pushDest.r; occupant.visualPos = null;
                            if (this.battle.updateUnitOverlayPosition) this.battle.updateUnitOverlayPosition(occupant);
                            this.battle.showFloatingText(occupant, "밀쳐짐!", "#fff");
                            
                            lastEmptyHex = { q: h.q, r: h.r }; 
                            await new Promise(r => setTimeout(r, 100));
                            continue; 
                        } else {
                            this.battle.showFloatingText(occupant, "돌파 저지!", "#f55");
                            break; 
                        }
                    } 
                    else {
                        break; 
                    }
                }
            } else {
                lastEmptyHex = { q: h.q, r: h.r }; 
            }
        }

        caster.q = lastEmptyHex.q; 
        caster.r = lastEmptyHex.r; 
        caster.visualPos = null;

        if (this.battle.updateUnitOverlayPosition) this.battle.updateUnitOverlayPosition(caster);
        this.battle.centerCameraOnUnit(caster);
        this.battle.triggerShakeAnimation(caster);

        this.battle.log(`💨 ${skill.name} 쇄도!`, 'log-skill');
        await new Promise(r => setTimeout(r, 150));

        const dmgEff = skill.effects.find(e => e.type.startsWith('DMG_') || e.type.startsWith('ATK_'));
        const mult = dmgEff ? (parseFloat(dmgEff.val) || 1.0) : 1.0;
        if (dmgEff) dmgEff._isOptionOnly = true; 
        
        const pushEff = skill.effects.find(e => e.type.includes('PUSH') || e.type.includes('KNOCKBACK'));
        if (pushEff) pushEff._isOptionOnly = true; 
        
        for (const enemy of hitEnemies) {
            await this.battle.skillProcessor.performAttack(caster, enemy, mult, skill.name, false, caster.atkType || 'PHYS', 1, options);
            await new Promise(r => setTimeout(r, 150));
        }

        return true;
    }
    
    async handleJumpAttack(caster, target, effect, skill, options = {}) {
        const grid = this.battle.grid;
        let dest = null;

        if (target) {
            const neighbors = grid.getNeighbors(target);
            dest = neighbors.find(hex => grid.isPassable(hex.q, hex.r) && !this.battle.getUnitAt(hex.q, hex.r));
            if (!dest) dest = { q: target.q, r: target.r };
        } else {
            this.battle.log("착지 대상을 찾을 수 없습니다.", "log-system"); 
            return false; 
        }
        
        caster.q = dest.q; 
        caster.r = dest.r; 
        caster.visualPos = null;

        if (this.battle.updateUnitOverlayPosition) this.battle.updateUnitOverlayPosition(caster);
        this.battle.centerCameraOnUnit(caster);
        this.battle.triggerShakeAnimation(caster);
        this.battle.log("점프!", "log-skill");
        await new Promise(r => setTimeout(r, 150));

        if (target) {
            const dmgEff = skill.effects.find(e => e.type.startsWith('DMG_') || e.type.startsWith('ATK_'));
            if (dmgEff) {
                dmgEff._isOptionOnly = true; 
                const mult = parseFloat(dmgEff.val) || 1.0;
                await this.battle.skillProcessor.performAttack(caster, target, mult, skill.name, false, dmgEff.type, 1, options);
            }
        }
        return true;
    }

    async executeChargeKnockback(attacker, target, skill) {
        const pushEff = skill.effects.find(e => ['CC_KNOCKBACK', 'KNOCKBACK', 'MOVE_PUSH'].includes(e.type));
        const pushDist = pushEff ? (pushEff.val || 1) : 1;
        const pushTile = this.getPushTile(attacker, target, pushDist);
        
        if (!pushTile) { this.battle.log("적 뒤에 공간이 없어 밀어낼 수 없습니다!", "log-bad"); return; }

        console.log(`🚀 [돌진] ${attacker.name} -> ${target.name}`);

        const isJump = skill.effects.some(e => e.type === 'ATK_JUMP');
        await this.battle.moveSpriteOnly(attacker, target.q, target.r, 300, isJump);

        if (this.battle.skillProcessor && this.battle.skillProcessor.applyStatus) {
            // 이펙트 직접 적용이 아닌 applyStatus를 통해 상태이상 부여
            skill.effects.forEach(e => {
                if (e.type.startsWith('STAT_') || e.type.startsWith('CC_')) {
                    this.battle.skillProcessor.applyStatus(target, e, attacker);
                }
            });
            this.battle.triggerShakeAnimation(target);
            this.battle.triggerBumpAnimation(attacker, target);
        } else {
            const dmgEff = skill.effects.find(e => e.type.startsWith('DMG_'));
            const multiplier = dmgEff ? (dmgEff.val || 1) : 1;
            const dmg = Math.max(1, (attacker.str || 10) * multiplier - (target.def || 0));
            target.curHp = Math.max(0, target.curHp - dmg);
            this.battle.showFloatingText(target, `-${Math.floor(dmg)}`, '#f00');
        }

        if (target.curHp <= 0) {
            this.battle.handleDeath(target);
            attacker.q = target.q; attacker.r = target.r;
            this.battle.updateUnitOverlayPosition(attacker);
            return;
        }

        const pushAnim = this.battle.moveSpriteOnly(target, pushTile.q, pushTile.r, 200, false);
        
        attacker.q = target.q; attacker.r = target.r;
        target.q = pushTile.q; target.r = pushTile.r;

        await pushAnim;

        this.battle.updateUnitOverlayPosition(attacker);
        this.battle.updateUnitOverlayPosition(target);
        if(attacker.team === 0 || this.battle.isTestMode) this.battle.centerCameraOnUnit(attacker);
    }

    getPushTile(attacker, target, dist) {
        const dir = this.battle.grid.getDirection(attacker, target);
        let curr = target;
        for(let i=0; i<dist; i++) {
            const next = this.battle.grid.getNeighborInDir(curr, dir);
            if (!next || this.battle.grid.getTerrainData(next.q, next.r).block || this.battle.getUnitAt(next.q, next.r)) return null;
            curr = next;
        }
        return curr;
    }
}