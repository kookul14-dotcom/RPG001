import { TERRAIN_TYPES } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';

export class MovementManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    isFlying(unit) {
        if (this.battle.hasStatus(unit, 'STAT_GRAVITY') || this.battle.hasStatus(unit, 'DEBUFF_GROUNDED')) return false; 
        
        if (['HARPY', 'DRAGON', 'GHOST'].includes(unit.race)) return true;
        if (unit.skills && unit.skills.some(s => s.effects && s.effects.some(e => e.type === 'PAS_MOVE_FLY'))) return true;
        return false;
    }

    calcReachable() {
        this.battle.reachableHexes = [];
        if(this.battle.actions.moved) return;

        const isFlyer = this.isFlying(this.battle.currentUnit);
        const ignoreHeight = (this.battle.currentUnit.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MOVE_HEIGHT'));
        const passThrough = (this.battle.currentUnit.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MOVE_THRU'));
        
        let jumpPower = (this.battle.currentUnit.stats && this.battle.currentUnit.stats.jump) ? this.battle.currentUnit.stats.jump : (this.battle.currentUnit.jump || 2);
        if (ignoreHeight) jumpPower = 99; 
        if (this.battle.hasStatus(this.battle.currentUnit, 'BUFF_STAT_MOVE_JUMP')) jumpPower += 1;
        
        // ⭐ 기획서 2-4: 중력 상태 시 점프 불가 (자기장 밟고 있을 때도 불가)
        if (this.battle.hasStatus(this.battle.currentUnit, 'STAT_GRAVITY')) jumpPower = 0;
        
        // ⭐ 환경 연성 기믹 적용 (자기장 & 상승 기류)
        const startTerrain = this.battle.grid.getTerrain(this.battle.currentUnit.q, this.battle.currentUnit.r);
        if (startTerrain === 'ZONE_MAGNETIC') jumpPower = 0;
        if (startTerrain === 'ZONE_UPDRAFT') {
            jumpPower += 5; // 기획서: 상승 기류 타일에서 도약 시 최대 높이 +5
        }

        const unitMap = new Map();
        for (let i = 0; i < this.battle.units.length; i++) {
            const u = this.battle.units[i];
            if (u.curHp > 0) unitMap.set(`${u.q},${u.r}`, u);
        }

        let frontier = [{q:this.battle.currentUnit.q, r:this.battle.currentUnit.r}];
        let cost = new Map();
        cost.set(`${this.battle.currentUnit.q},${this.battle.currentUnit.r}`, 0);
        
        const moveRange = Formulas.getDerivedStat(this.battle.currentUnit, 'mov');

        while(frontier.length > 0) {
            let cur = frontier.shift();

            const curData = this.battle.grid.getTerrainData(cur.q, cur.r);
            const curH = curData.h || 0;

            this.battle.grid.getNeighbors(cur).forEach(n => {
                const k = `${n.q},${n.r}`;
                if (!this.battle.grid.hexes.has(k)) return;

                // ⭐ [버그 수정됨] GRASS_01 대신 PLAIN을 Fallback으로 사용
                const tData = this.battle.grid.getTerrainData(n.q, n.r) || { key: 'PLAIN', h: 0 };
                const tInfo = TERRAIN_TYPES[tData.key] || TERRAIN_TYPES['PLAIN'];

                if (!isFlyer) {
                    const nextH = tData.h || 0;
                    if (Math.abs(nextH - curH) > jumpPower) return; // 높이 차이가 점프력보다 크면 이동 불가
                }

                let tileCost = tInfo.cost || 1;
                if (isFlyer && tileCost < 99) tileCost = 1;
                if (tileCost >= 99) return;

                const uAt = unitMap.get(k);

                if (!uAt || uAt === this.battle.currentUnit || uAt.isNPC || (passThrough && uAt.team !== this.battle.currentUnit.team)) {
                    let newCost = cost.get(`${cur.q},${cur.r}`) + tileCost;
                    if(newCost <= moveRange && (!cost.has(k) || newCost < cost.get(k))) {
                        cost.set(k, newCost);
                        frontier.push(n);
                    }
                }
            });
        }

        cost.forEach((v, k) => {
            const [q, r] = k.split(',').map(Number);
            this.battle.reachableHexes.push({q, r});
        });
    }

    async jumpUnit(unit, q, r) {
        this.battle.triggerShakeAnimation(unit);
        this.battle.log(`${unit.name} 도약!`, 'log-skill');
        await new Promise(resolve => setTimeout(resolve, 200));

        unit.q = q; unit.r = r;
        this.battle.triggerShakeAnimation(unit);
        
        if (unit.team === 0 || this.battle.isTestMode) {
            this.battle.centerCameraOnUnit(unit);
            this.battle.updateFloatingControls();
        }
        
        this.battle.calcReachable();
        this.battle.updateStatusPanel();
        if (unit.team === 0) this.battle.checkTileEvent(unit);
        return true;
    }

    async moveUnit(unit, q, r, cb) {
        const unitMap = new Map();
        for (let i = 0; i < this.battle.units.length; i++) {
            const u = this.battle.units[i];
            if (u.curHp > 0) unitMap.set(`${u.q},${u.r}`, u);
        }

        const path = this.battle.grid.findPath({q:unit.q, r:unit.r}, {q, r}, nh => {
            const uAt = unitMap.get(`${nh.q},${nh.r}`);

            if (uAt && this.battle.hasStatus(uAt, 'STAT_PETRIFY')) return false; 

            const passThrough = (unit.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MOVE_THRU'));
            return !uAt || uAt === unit || uAt.isNPC || (passThrough && uAt.team !== unit.team);
        });
        
        if (path.length === 0) { if(cb) cb(); return; }
        this.battle.isAnimating = true;

        if (!this.battle.isPeaceful || this.battle.isTestMode) {
            const moveCost = Math.max(0, path.length - 2);
            unit.actionGauge -= moveCost;
        }

        for (let i = 0; i < path.length; i++) {
            const s = path[i];
            const dir = this.battle.grid.getDirection({q: unit.q, r: unit.r}, s);
            unit.facing = dir;
            
            unit.q = s.q; unit.r = s.r;

            // ----------------------------------------------------------------------
            // ⭐ [경계 사격 (Overwatch) 체크] 
            // ----------------------------------------------------------------------
            if (!this.battle.isPeaceful && unit.curHp > 0) {
                const enemies = this.battle.units.filter(u => u.team !== unit.team && u.curHp > 0);
                for (const enemy of enemies) {
                    const overwatchSkill = (enemy.skills || []).find(sk => 
                        sk && sk.effects && sk.effects.some(e => e.type === 'PAS_PREEMPTIVE_RANGE')
                    );

                    if (overwatchSkill && !enemy.hasOverwatched) {
                        const dist = this.battle.grid.getDistance(enemy, unit);
                        const range = parseInt(overwatchSkill.rng || 4); 

                        if (dist <= range) {
                            this.battle.log(`⚠️ ${enemy.name}의 경계 사격 발동!`, 'log-warning');
                            await this.battle.smoothCenterCameraOnUnit(enemy, 300);
                            
                            await new Promise(resolve => setTimeout(resolve, 300));

                            if (this.battle.createProjectile) this.battle.createProjectile(enemy, unit);

                            const dmg = Math.max(1, Math.floor(enemy.atk - (unit.def * 0.5)));
                            unit.curHp = Math.max(0, unit.curHp - dmg);
                            
                            this.battle.showFloatingText(unit, `💥-${dmg}`, '#ff6600');
                            this.battle.triggerShakeAnimation(unit);

                            enemy.hasOverwatched = true; 

                            if (unit.curHp <= 0) {
                                this.battle.log(`${unit.name} 경계 사격에 사망!`, 'log-dead');
                                await this.battle.handleDeath(unit);
                                break; 
                            }
                            
                            await this.battle.smoothCenterCameraOnUnit(unit, 300);
                        }
                    }
                }
            }
            if (unit.curHp <= 0) break;

            this.battle.updateAurasForUnit(this.battle.currentUnit);
            
            if ((this.battle.isPeaceful || this.battle.isTestMode) && unit === this.battle.currentUnit) {
                this.battle.centerCameraOnUnit(unit);
            }

            const trapIdx = this.battle.traps.findIndex(t => t.q === s.q && t.r === s.r && t.casterId !== unit.id);
            if (trapIdx !== -1) {
                const trap = this.battle.traps[trapIdx];
                const isImmuneTrap = (unit.skills || []).some(sk => sk.type === 'PASSIVE' && sk.effects.some(e => e.type === 'PAS_IMMUNE_TRAP'));
                if (this.isFlying(unit) && !trap.type.includes('ANTI_AIR')) {
                    this.battle.showFloatingText(unit, "Fly Over", "#ccc");
                } else {
                    this.battle.traps.splice(trapIdx, 1); 
                    this.battle.log(`${unit.name} 함정 발동!`, 'log-dmg');
                    this.battle.showFloatingText(unit, "TRAP!", "#f00");
                    this.battle.triggerShakeAnimation(unit);

                    if (trap.type === 'TRAP_STUN' || trap.type === 'SYS_CREATE_TRAP') {
                        const dmg = 20;
                        unit.curHp = Math.max(0, unit.curHp - dmg);
                        this.battle.showFloatingText(unit, `-${dmg}`, "#f55");
                        if(this.battle.skillProcessor) {
                             this.battle.skillProcessor.applyStatus(unit, { type: 'STAT_BIND', duration: 1, val: 1 }, {id: trap.casterId});
                        }
                    }
                    if (unit.curHp <= 0) { await this.battle.handleDeath(unit); break; }
                    
                    break; 
                }
            }

            const tKey = this.battle.grid.getTerrain(s.q, s.r);
            if (tKey && (tKey.includes('WATER') || tKey.includes('RIVER') || tKey.includes('LAKE'))) {
                if (this.battle.hasStatus(unit, 'STAT_BURN')) {
                    unit.buffs = unit.buffs.filter(b => b.type !== 'STAT_BURN');
                    this.battle.showFloatingText(unit, "Extinguished", "#aaa");
                    this.battle.log(`💧 물에 닿아 ${unit.name}의 불이 꺼졌습니다.`, 'log-system');
                }
            }

            if (i > 0 && !this.battle.isPeaceful && !this.isFlying(unit)) {
                let stoppedByZoc = false;
                const neighbors = this.battle.grid.getNeighbors(unit);
                for (const n of neighbors) {
                    const adjUnit = this.battle.getUnitAt(n.q, n.r);
                    if (adjUnit && adjUnit.team !== unit.team && adjUnit.curHp > 0) {
                        const hasZoc = (adjUnit.skills || []).some(sk => 
                            sk && sk.type === 'PASSIVE' && sk.effects && sk.effects.some(e => e.type === 'PAS_STAT_MOVE_ZOC' || e.type === 'ZOC')
                        );
                        if (hasZoc && !this.battle.hasStatus(unit, 'BUFF_IGNORE_ZOC') && !this.battle.hasStatus(unit, 'STAT_STEALTH')) {
                            this.battle.showFloatingText(unit, "Blocked!", "#ff0000");
                            this.battle.log(`🛡️ ${adjUnit.name}의 통제 영역(ZOC)에 걸려 이동이 멈췄습니다.`, 'log-system');
                            stoppedByZoc = true;
                            break;
                        }
                    }
                }
                if (stoppedByZoc) break;
            }

            if (!this.battle.isPeaceful && unit.curHp > 0) {
                const neighbors = this.battle.grid.getNeighbors(unit);
                for (const n of neighbors) {
                    const wall = this.battle.getUnitAt(n.q, n.r);
                    if (wall && wall.key === 'WALL_FIRE' && wall.team !== unit.team) {
                        if (!this.battle.hasStatus(unit, 'STAT_BURN')) {
                            if (this.battle.skillProcessor) this.battle.skillProcessor.applyStatus(unit, {type: 'STAT_BURN', val: 1, duration: 2}, {id: wall.casterId});
                            this.battle.log(`🔥 화염벽의 열기로 인해 ${unit.name}에게 불이 붙습니다!`, 'log-dmg');
                        }
                    }
                }
            }
            
            // ⭐ [수정] 이동 템포 감소: 180ms -> 350ms로 늘려 천천히 걷게 합니다.
            await new Promise(resolve => setTimeout(resolve, this.battle.isPeaceful ? 200 : 350));
        }
        
        if (this.battle.hasStatus(unit, 'STAT_BLEED') && path.length > 0) {
            const bleedDmg = Math.max(1, Math.floor(unit.hp * 0.05));
            unit.curHp = Math.max(0, unit.curHp - bleedDmg);
            this.battle.showFloatingText(unit, `출혈 -${bleedDmg}`, "#ff0000");
            this.battle.log(`🩸 이동으로 인해 출혈이 심해집니다! (-${bleedDmg})`, 'log-dmg');
            
            if (unit.curHp <= 0) {
                this.battle.isAnimating = false; 
                this.battle.handleDeath(unit);
                if(cb) cb();
                return false;
            }
        }
        
        this.battle.isAnimating = false;
        if (!this.battle.isPeaceful || this.battle.isTestMode) {
            this.battle.actions.moved = true; 
            this.battle.actions.realMoved = true;
        }

        this.battle.updateAurasForUnit(unit);

        if (unit === this.battle.currentUnit) this.battle.updateFloatingControls();
        this.calcReachable();
        this.battle.updateStatusPanel();

        if (unit.team === 0) {
            this.battle.detectHiddenObjects(unit);
            this.battle.checkTileEvent(unit);       
            const heroData = this.battle.gameApp.gameState.heroes.find(h => h && h.id === unit.id);
            if (heroData && !this.battle.isTestMode) {
                heroData.q = unit.q; heroData.r = unit.r;
                this.battle.gameApp.saveGame(); 
            }
        }
        if(cb) cb();
    }
}