import * as Formulas from '../../utils/formulas.js';

export class BattleAI {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    // ----------------------------------------------------------------
    // 적군 AI (Enemy Turn)
    // ----------------------------------------------------------------
    // ----------------------------------------------------------------
    // 적군 AI (Enemy Turn)
    // ----------------------------------------------------------------
    async runEnemyTurn() {
        const ai = this.battle.currentUnit;
        this.battle.isProcessingTurn = true;
        this.battle.log(`🤖 ${ai.name} 행동 중...`, 'log-effect');
        
        // ⭐ [수정] AI 턴 시작 시: 카메라를 부드럽게 유닛으로 옮기고, 도착 후 뜸을 들임
        await this.battle.smoothCenterCameraOnUnit(ai, 500);
        await new Promise(r => setTimeout(r, 800)); // 움직임 멈춘 후 뜸 들이기

        const controlState = this.battle.statusManager ? this.battle.statusManager.getControlState(ai) : 'NORMAL';

        // 1. 혼란 상태 (CONFUSION): 80% 주변 무작위 타격(없으면 랜덤 이동) / 20% 대기
        if (controlState === 'CONFUSION') {
            this.battle.log(`😵 ${ai.name} 혼란 상태! (통제 불능)`, 'log-cc');
            await new Promise(r => setTimeout(r, 400));

            const rand = Math.floor(Math.random() * 100);

            if (rand < 20) {
                this.battle.showFloatingText(ai, "멍 때림...", "#aaa");
                this.battle.log(`❓ ${ai.name}이(가) 혼란스러워하며 제자리에 멍하니 서 있습니다.`, 'log-system');
                this.battle.endTurn(); 
                return;
            }

            const allTargets = this.battle.units.filter(u => 
                u.curHp > 0 && u.id !== ai.id && !u.isWall && u.type !== 'OBJECT' && 
                !this.battle.statusManager.hasStatus(u, 'STAT_STEALTH')
            );

            const basicRng = parseInt(ai.rng) || 1;
            const targetsInRange = allTargets.filter(u => this.battle.grid.getDistance(ai, u) <= basicRng);

            if (targetsInRange.length > 0) {
                const randomTarget = targetsInRange[Math.floor(Math.random() * targetsInRange.length)];
                const targetTypeStr = (randomTarget.team === ai.team) ? '아군' : '적군';
                
                this.battle.log(`💥 ${ai.name}이(가) 눈에 뵈는 게 없이 가까이 있는 ${randomTarget.name}(${targetTypeStr})을(를) 공격합니다!`, 'log-cc');
                await new Promise(r => setTimeout(r, 300));
                await this.battle.skillProcessor.performAttack(ai, randomTarget, 1.0, "혼란 공격", false, ai.atkType || 'PHYS', 1);
            } else {
                this.battle.calcReachable();
                if (this.battle.reachableHexes && this.battle.reachableHexes.length > 0) {
                    const validMoves = this.battle.reachableHexes.filter(h => h.q !== ai.q || h.r !== ai.r); 
                    if (validMoves.length > 0) {
                        const randomHex = validMoves[Math.floor(Math.random() * validMoves.length)];
                        this.battle.log(`🌀 ${ai.name}이(가) 방향 감각을 잃고 비틀거리며 이동합니다.`, 'log-system');
                        await this.battle.moveUnit(ai, randomHex.q, randomHex.r);
                    } else {
                        this.battle.log(`❓ ${ai.name}이(가) 갈 곳을 찾지 못해 제자리를 맴돕니다.`, 'log-system');
                    }
                }
            }

            this.battle.endTurn();
            return;
        }
        
        // 2. 전의 상실 (DEMORALIZED)
        if (controlState === 'DEMORALIZED') {
            this.battle.log(`🏳️ ${ai.name}이(가) 전의를 상실하여 도망칩니다!`, 'log-cc');
            await new Promise(r => setTimeout(r, 400));

            const enemies = this.battle.units.filter(u => u.team !== ai.team && u.curHp > 0);
            if (enemies.length > 0) {
                const nearestEnemy = enemies.sort((a,b) => this.battle.grid.getDistance(ai, a) - this.battle.grid.getDistance(ai, b))[0];
                this.battle.calcReachable();
                
                let bestHex = null; 
                let maxDist = -1;
                this.battle.reachableHexes.forEach(h => {
                    const d = this.battle.grid.getDistance(h, nearestEnemy);
                    if (d > maxDist) { maxDist = d; bestHex = h; }
                });
                if (bestHex && (bestHex.q !== ai.q || bestHex.r !== ai.r)) {
                    await this.battle.moveUnit(ai, bestHex.q, bestHex.r);
                } else {
                    this.battle.log(`🏳️ 도망칠 곳이 없어 벌벌 떨고 있습니다.`, 'log-system');
                }
            }
            this.battle.endTurn(); 
            return;
        }

        // 3. 타겟 선정 (Target Selection)
        let potentialTargets = [];
        if (controlState === 'CHARM') {
            potentialTargets = this.battle.units.filter(u => u.team === ai.team && u.id !== ai.id && u.curHp > 0);
        } else {
            potentialTargets = this.battle.units.filter(u => u.team !== ai.team && u.curHp > 0 && !u.isWall && u.type !== 'OBJECT');
        }

        potentialTargets = potentialTargets.filter(t => 
            !this.battle.hasStatus(t, 'STEALTH') && 
            !this.battle.hasStatus(t, 'STAT_STEALTH') &&
            !this.battle.hasStatus(t, 'BUFF_UNTARGETABLE')
        );

        if (potentialTargets.length === 0) { 
            this.battle.log("공격할 대상이 없습니다.", "log-system");
            this.battle.endTurn(true); 
            return; 
        }

        let finalTarget = null;
        let isAttackingWall = false; 
        
        const tauntBuff = ai.buffs.find(b => b.type.includes('TAUNT') || b.type.includes('AGGRO'));
        if (tauntBuff && tauntBuff.casterId) {
            const tauntSource = this.battle.units.find(u => String(u.id) === String(tauntBuff.casterId) && u.curHp > 0);
            if (tauntSource) {
                potentialTargets = [tauntSource]; 
                finalTarget = tauntSource;
                this.battle.log(`💢 [도발] ${ai.name}이(가) 이성을 잃고 ${tauntSource.name}만을 노립니다!`, 'log-cc');
            }
        }

        if (!finalTarget) {
            const killable = potentialTargets.find(t => {
                const res = Formulas.calculateDamage(ai, t, 1.0, ai.atkType, this.battle.grid);
                return res.damage >= t.curHp;
            });
            if (killable) finalTarget = killable;
            else finalTarget = potentialTargets.sort((a,b) => this.battle.grid.getDistance(ai, a) - this.battle.grid.getDistance(ai, b))[0];
        }

        if (!finalTarget) { this.battle.endTurn(true); return; }

        // 4. 스킬 및 사거리 계산
        let maxRange = parseInt(ai.rng) || 1;
        if (ai.skills) {
            ai.skills.forEach(s => {
                if (ai.curMp >= s.mp && !['PASSIVE'].includes(s.type)) {
                    const sRng = parseInt(s.rng) || 1;
                    if (sRng > maxRange) maxRange = sRng;
                }
            });
        }

        const distToTarget = this.battle.grid.getDistance(ai, finalTarget);
        
        // 장벽 돌파 지능 AI
        if (distToTarget > maxRange) {
            this.battle.calcReachable();
            let moveHex = null; 
            let minD = 999;
            
            this.battle.reachableHexes.forEach(h => {
                const d = this.battle.grid.getDistance(h, finalTarget);
                if (d < minD) { minD = d; moveHex = h; }
            });

            if (moveHex && moveHex.q === ai.q && moveHex.r === ai.r) {
                let altHex = null;
                let altMinD = 999;
                this.battle.reachableHexes.forEach(h => {
                    if (h.q === ai.q && h.r === ai.r) return; 
                    const d = this.battle.grid.getDistance(h, finalTarget);
                    if (d < altMinD && d <= minD + 1) { 
                        altMinD = d; altHex = h; 
                    }
                });
                if (altHex) moveHex = altHex; 
            }

            const directDist = this.battle.grid.getDistance(ai, finalTarget); 
            
            if (!moveHex || minD > directDist + 5) {
                const walls = this.battle.units.filter(u => u.curHp > 0 && u.isWall && (u.key === 'WALL_EARTH' || u.key === 'WALL_ICE'));
                
                if (walls.length > 0) {
                    const nearestWall = walls.sort((a,b) => this.battle.grid.getDistance(ai, a) - this.battle.grid.getDistance(ai, b))[0];
                    const distToWall = this.battle.grid.getDistance(ai, nearestWall);

                    if (distToWall <= maxRange + Formulas.getDerivedStat(ai, 'mov')) {
                        finalTarget = nearestWall; 
                        isAttackingWall = true;
                        this.battle.log(`🧱 [경로 차단] ${ai.name}이(가) 길을 뚫기 위해 ${nearestWall.name}을(를) 파괴하려 합니다!`, 'log-system');
                        
                        minD = 999;
                        this.battle.reachableHexes.forEach(h => {
                            const d = this.battle.grid.getDistance(h, finalTarget);
                            if (d < minD) { minD = d; moveHex = h; }
                        });
                    }
                }
            }

            if (moveHex && (moveHex.q !== ai.q || moveHex.r !== ai.r)) {
                await this.battle.moveUnit(ai, moveHex.q, moveHex.r);
            } else {
                this.battle.log(`[${ai.name}] 전방이 막혀 위치를 고수합니다.`, "log-system");
            }
        }

        const newDist = this.battle.grid.getDistance(ai, finalTarget);
        let actionDone = false;

        if (!isAttackingWall && ai.skills && ai.skills.length > 0) {
            const usableSkills = ai.skills.filter(s => 
                !['PASSIVE'].includes(s.type) && 
                ai.curMp >= s.mp && 
                newDist <= (parseInt(s.rng) || 1) 
            );

            if (usableSkills.length > 0) {
                usableSkills.sort((a, b) => (b.main?.val || 0) - (a.main?.val || 0));
                const bestSkill = usableSkills[0];
                this.battle.selectedSkill = bestSkill;
                await new Promise(r => setTimeout(r, 300));
                await this.battle.skillProcessor.execute(finalTarget, finalTarget); 
                actionDone = true;
            }
        }

        if (!actionDone) {
            const basicRng = parseInt(ai.rng) || 1;
            if (newDist <= basicRng) {
                await new Promise(r => setTimeout(r, 300));
                await this.battle.skillProcessor.performAttack(ai, finalTarget, 1.0, isAttackingWall ? "장벽 파괴" : "공격");
                actionDone = true;
            } else {
                this.battle.endTurn(true);
                return;
            }
        }

        this.battle.endTurn();
    }

    // ----------------------------------------------------------------
    // 아군 자동 전투 (Auto Battle)
    // ----------------------------------------------------------------
    async runAllyAuto() {
        if (!this.battle.isAutoBattle || this.battle.currentUnit.team !== 0) return;

        this.battle.isProcessingTurn = true;
        
        const u = this.battle.currentUnit;
        
        // ⭐ [수정] 오토 턴 시작 시: 카메라를 부드럽게 유닛으로 옮기고, 도착 후 뜸을 들임
        await this.battle.smoothCenterCameraOnUnit(u, 500);
        await new Promise(r => setTimeout(r, 800)); 

        let ens = this.battle.units.filter(e => e.team === 1 && e.curHp > 0 && !e.isWall && e.type !== 'OBJECT');
        ens = ens.filter(t => 
            !this.battle.hasStatus(t, 'STEALTH') && 
            !this.battle.hasStatus(t, 'STAT_STEALTH') &&
            !this.battle.hasStatus(t, 'BUFF_UNTARGETABLE')
        );

        if (ens.length === 0) { this.battle.endTurn(); return; }

        const basicId = u.equippedBasic || '1000';
        let basicSkill = u.skills.find(s => s.id === basicId);
        if (!basicSkill) {
            basicSkill = { 
                id: basicId, name: '기본공격', type: 'ACTIVE', 
                cost: 80, mp: 0, rng: u.rng || 1, 
                main: { type: 'DMG_PHYS', val: 1 } 
            };
        }

        const activeSkills = (u.skills || []).filter(s => 
            s.type !== 'PASSIVE' && 
            s.id !== basicId && 
            u.curMp >= s.mp
        );

        if (activeSkills.length > 0) {
            activeSkills.sort((a, b) => (b.main?.val || 0) - (a.main?.val || 0));
        }

        const selectedAction = (activeSkills.length > 0) ? activeSkills[0] : basicSkill;

        let targetEnemy = null;
        let isAttackingWall = false;
        
        const tauntBuff = u.buffs.find(b => b.type.includes('TAUNT') || b.type.includes('AGGRO'));
        if (tauntBuff && tauntBuff.casterId) {
            const tauntSource = ens.find(e => String(e.id) === String(tauntBuff.casterId));
            if (tauntSource) {
                targetEnemy = tauntSource;
                this.battle.log(`💢 [자동전투] 도발당하여 강제로 ${tauntSource.name}을(를) 노립니다!`, 'log-cc');
            }
        }

        if (!targetEnemy) {
            targetEnemy = ens.sort((a, b) => this.battle.grid.getDistance(u, a) - this.battle.grid.getDistance(u, b))[0];
        }

        let t = targetEnemy;

        this.battle.calcReachable();
        const dist = this.battle.grid.getDistance(u, t);
        const actionRange = parseInt(selectedAction.rng) || 1; 

        if (dist > actionRange && !this.battle.actions.moved) {
            let moveHex = null;
            let minD = 999;
            
            this.battle.reachableHexes.forEach(h => {
                const dx = this.battle.grid.getDistance(h, t);
                if (dx < minD) { minD = dx; moveHex = h; }
            });
            
            if (moveHex && moveHex.q === u.q && moveHex.r === u.r) {
                let altHex = null;
                let altMinD = 999;
                this.battle.reachableHexes.forEach(h => {
                    if (h.q === u.q && h.r === u.r) return; 
                    const d = this.battle.grid.getDistance(h, t);
                    if (d < altMinD && d <= minD + 1) { altMinD = d; altHex = h; }
                });
                if (altHex) moveHex = altHex; 
            }
            
            const directDist = this.battle.grid.getDistance(u, t);
            if (!moveHex || minD > directDist + 5) {
                const walls = this.battle.units.filter(w => w.curHp > 0 && w.isWall && (w.key === 'WALL_EARTH' || w.key === 'WALL_ICE'));
                if (walls.length > 0) {
                    const nearestWall = walls.sort((a,b) => this.battle.grid.getDistance(u, a) - this.battle.grid.getDistance(u, b))[0];
                    const distToWall = this.battle.grid.getDistance(u, nearestWall);

                    if (distToWall <= actionRange + Formulas.getDerivedStat(u, 'mov')) {
                        t = nearestWall; 
                        isAttackingWall = true;
                        this.battle.log(`🧱 [자동전투] 적에게 닿을 수 없어 ${nearestWall.name}을(를) 부수려 합니다!`, 'log-system');
                        
                        minD = 999;
                        this.battle.reachableHexes.forEach(h => {
                            const d = this.battle.grid.getDistance(h, t);
                            if (d < minD) { minD = d; moveHex = h; }
                        });
                    }
                }
            }

            if (moveHex && (moveHex.q !== u.q || moveHex.r !== u.r)) {
                await this.battle.moveUnit(u, moveHex.q, moveHex.r);
            }
        }

        const finalDist = this.battle.grid.getDistance(u, t);
        
        if (finalDist <= actionRange) {
            this.battle.selectedSkill = isAttackingWall ? basicSkill : selectedAction;
            await this.battle.skillProcessor.execute(t, t);
        }

        this.battle.endTurn();
    }
}