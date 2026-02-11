import * as Formulas from '../../utils/formulas.js';

export class BattleAI {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    // ----------------------------------------------------------------
    // 적군 AI (Enemy Turn)
    // ----------------------------------------------------------------
    async runEnemyTurn() {
        const ai = this.battle.currentUnit;
        this.battle.isProcessingTurn = true;
        this.battle.log(`🤖 ${ai.name} 행동 중...`, 'log-effect');
        
        await new Promise(r => setTimeout(r, 600));

        // 1. 혼란 상태 (CC_CONFUSE): 랜덤 이동 후 랜덤 타겟 공격
        if (this.battle.hasStatus(ai, 'CC_CONFUSE')) {
            this.battle.log(`😵 ${ai.name} 혼란 상태!`, 'log-cc');
            
            // 랜덤 이동
            const neighbors = this.battle.grid.getNeighbors(ai);
            const validMoves = neighbors.filter(n => !this.battle.getUnitAt(n.q, n.r));
            if (validMoves.length > 0) {
                const r = validMoves[Math.floor(Math.random() * validMoves.length)];
                await this.battle.moveUnit(ai, r.q, r.r);
            }
            
            await new Promise(r => setTimeout(r, 200));
            
            // 랜덤 공격 (피아식별 없음)
            const nearUnits = this.battle.units.filter(u => u !== ai && u.curHp > 0 && this.battle.grid.getDistance(ai, u) <= 1);
            if (nearUnits.length > 0) {
                const randomTarget = nearUnits[Math.floor(Math.random() * nearUnits.length)];
                await this.battle.skillProcessor.performAttack(ai, randomTarget, 1.0, "혼란 공격");
            }
            this.battle.endTurn(); 
            return;
        }

        // 2. 공포 상태 (CC_FEAR): 적에게서 멀어지는 방향으로 도주
        if (this.battle.hasStatus(ai, 'FEAR') || this.battle.hasStatus(ai, 'CC_FEAR')) {
            this.battle.log(`😱 ${ai.name} 공포에 질려 도망칩니다!`, 'log-cc');
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
                }
            }
            this.battle.endTurn(); 
            return;
        }

        // 3. 타겟 선정 (Target Selection)
        let potentialTargets = [];
        // 매혹 상태면 아군 공격
        if (this.battle.hasStatus(ai, 'CHARM') || this.battle.hasStatus(ai, 'CC_CHARM')) {
            potentialTargets = this.battle.units.filter(u => u.team === ai.team && u.id !== ai.id && u.curHp > 0);
        } else {
            potentialTargets = this.battle.units.filter(u => u.team !== ai.team && u.curHp > 0);
        }

        // 은신 및 지정불가 대상 제외
        potentialTargets = potentialTargets.filter(t => 
            !this.battle.hasStatus(t, 'STEALTH') && !this.battle.hasStatus(t, 'BUFF_UNTARGETABLE')
        );

        if (potentialTargets.length === 0) { 
            this.battle.log("공격할 대상이 없습니다.", "log-system");
            this.battle.endTurn(true); 
            return; 
        }

        let finalTarget = null;
        
        // 도발 체크
        const tauntBuff = ai.buffs.find(b => b.type === 'AGGRO_TAUNT' || b.type === 'TAUNT');
        if (tauntBuff && tauntBuff.casterId) {
            const tauntSource = this.battle.units.find(u => u.id === tauntBuff.casterId && u.curHp > 0);
            if (tauntSource) finalTarget = tauntSource;
        }

        // 킬각(Kill opportunity) 우선, 없으면 가장 가까운 적
        if (!finalTarget) {
            const killable = potentialTargets.find(t => {
                const res = Formulas.calculateDamage(ai, t, 1.0, ai.atkType, this.battle.grid);
                return res.damage >= t.curHp;
            });
            if (killable) finalTarget = killable;
            else finalTarget = potentialTargets.sort((a,b) => this.battle.grid.getDistance(ai, a) - this.battle.grid.getDistance(ai, b))[0];
        }

        if (!finalTarget) { this.battle.endTurn(true); return; }

        // 4. 이동 및 행동 결정
        let maxRange = ai.rng;
        if (ai.skills) {
            ai.skills.forEach(s => {
                if (ai.curMp >= s.mp && !['PASSIVE'].includes(s.type)) {
                    if (s.rng > maxRange) maxRange = s.rng;
                }
            });
        }

        const dist = this.battle.grid.getDistance(ai, finalTarget);
        
        // 사거리 밖이면 이동
        if (dist > maxRange) {
            this.battle.calcReachable();
            let moveHex = null; 
            let minD = 999;
            
            this.battle.reachableHexes.forEach(h => {
                const d = this.battle.grid.getDistance(h, finalTarget);
                if (d < dist && d < minD) { minD = d; moveHex = h; }
            });
            
            if (moveHex && (moveHex.q !== ai.q || moveHex.r !== ai.r)) {
                await this.battle.moveUnit(ai, moveHex.q, moveHex.r);
            } else {
                // 이동 불가 시 대기
                this.battle.log("이동 경로 막힘", "log-system");
                this.battle.endTurn(true); 
                return;
            }
        }

        // 이동 후 거리 재계산 및 스킬 사용
        const newDist = this.battle.grid.getDistance(ai, finalTarget);
        let actionDone = false;

        if (ai.skills && ai.skills.length > 0) {
            const usableSkills = ai.skills.filter(s => 
                !['PASSIVE'].includes(s.type) && 
                ai.curMp >= s.mp && 
                newDist <= s.rng
            );

            if (usableSkills.length > 0) {
                // 위력이 높은 스킬 우선 사용
                usableSkills.sort((a, b) => (b.main?.val || 0) - (a.main?.val || 0));
                const bestSkill = usableSkills[0];
                this.battle.selectedSkill = bestSkill;
                await new Promise(r => setTimeout(r, 300));
                await this.battle.skillProcessor.execute(finalTarget, finalTarget); 
                actionDone = true;
            }
        }

        if (!actionDone) {
            if (newDist <= ai.rng) {
                await new Promise(r => setTimeout(r, 300));
                await this.battle.skillProcessor.performAttack(ai, finalTarget, 1.0, "공격");
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
        await new Promise(r => setTimeout(r, 600));

        const u = this.battle.currentUnit;

        // 1. 타겟팅: 은신 및 지정 불가 적 제외
        let ens = this.battle.units.filter(e => e.team === 1 && e.curHp > 0);
        ens = ens.filter(t => !this.battle.hasStatus(t, 'STEALTH') && !this.battle.hasStatus(t, 'BUFF_UNTARGETABLE'));

        if (ens.length === 0) { this.battle.endTurn(); return; }

        // 2. [핵심 변경] 액션 결정 로직 통합 (스킬 vs 기본공격)
        // 2-1. 기본 공격 스킬 객체 확보
        const basicId = u.equippedBasic || '1000';
        // 보유 스킬 목록에서 찾거나, 없으면 임시 객체 생성 (안전장치)
        let basicSkill = u.skills.find(s => s.id === basicId);
        if (!basicSkill) {
            // 데이터 누락 방지용 더미 기본 공격 객체
            basicSkill = { 
                id: basicId, name: '기본공격', type: 'ACTIVE', 
                cost: 80, mp: 0, rng: u.rng || 1, 
                main: { type: 'DMG_PHYS', val: 1 } 
            };
        }

        // 2-2. 사용 가능한 MP 스킬 검색 (패시브 제외, 마나 충족)
        const activeSkills = (u.skills || []).filter(s => 
            s.type !== 'PASSIVE' && 
            s.id !== basicId && 
            u.curMp >= s.mp
        );

        // 2-3. 우선순위 정렬 (위력(val)이 높은 순)
        if (activeSkills.length > 0) {
            activeSkills.sort((a, b) => (b.main?.val || 0) - (a.main?.val || 0));
        }

        // 2-4. 최종 액션 선택: 스킬이 있으면 스킬, 없으면 기본 공격
        const selectedAction = (activeSkills.length > 0) ? activeSkills[0] : basicSkill;

        // 3. 가장 가까운 적 타겟팅
        const t = ens.sort((a, b) => this.battle.grid.getDistance(u, a) - this.battle.grid.getDistance(u, b))[0];

        // 4. 이동 로직 (선택된 액션의 사거리(rng) 기준)
        this.battle.calcReachable();
        const dist = this.battle.grid.getDistance(u, t);
        const actionRange = selectedAction.rng || 1;

        if (dist > actionRange && !this.battle.actions.moved) {
            let moveHex = null;
            let minD = 999;
            
            // 사거리 내로 진입할 수 있는 가장 가까운 타일 탐색
            this.battle.reachableHexes.forEach(h => {
                const dx = this.battle.grid.getDistance(h, t);
                if (dx <= actionRange && dx < minD) { minD = dx; moveHex = h; }
            });
            
            if (moveHex) await this.battle.moveUnit(u, moveHex.q, moveHex.r);
        }

        // 5. [통합 실행] 모든 공격/스킬은 execute()를 통함
        // execute 내부에 게이지 차감 로직이 있으므로 무한 공격 버그 해결됨
        const finalDist = this.battle.grid.getDistance(u, t);
        
        if (finalDist <= actionRange) {
            // UI 시스템에 현재 선택된 스킬 주입 (SkillProcessor가 참조함)
            this.battle.selectedSkill = selectedAction;
            
            // 실행 (애니메이션 대기)
            await this.battle.skillProcessor.execute(t, t);
        }

        this.battle.endTurn();
    }
}