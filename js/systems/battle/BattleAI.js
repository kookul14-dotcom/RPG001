import * as Formulas from '../../utils/formulas.js';

export class BattleAI {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.isAutoOn = false; // ⭐ 신규: 자동전투 상태 플래그
        this.addAutoButton(); // ⭐ 신규: 자동전투 버튼 UI 추가
    }

    // ----------------------------------------------------------------
    // ⭐ 신규: 자동전투 버튼 UI 추가 및 제어
    // ----------------------------------------------------------------
    addAutoButton() {
        if (document.getElementById('btn-auto-battle')) return;

        const btn = document.createElement('button');
        btn.id = 'btn-auto-battle';
        btn.innerText = '자동전투 OFF';
        btn.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            padding: 10px 20px; background: rgba(0,0,0,0.7); color: white;
            border: 2px solid #666; border-radius: 5px; cursor: pointer; z-index: 1000;
            font-family: 'DungGeunMo', sans-serif; transition: all 0.2s;
        `;

        btn.onclick = () => this.toggleAutoBattle();
        document.body.appendChild(btn);
    }

    toggleAutoBattle() {
        this.isAutoOn = !this.isAutoOn;
        this.battle.isAutoBattle = this.isAutoOn; // battle 시스템 상태와 동기화
        const btn = document.getElementById('btn-auto-battle');
        
        if (this.isAutoOn) {
            btn.innerText = '자동전투 ON';
            btn.style.borderColor = '#0f0';
            btn.style.background = 'rgba(0,50,0,0.8)';
            this.battle.log("🤖 자동전투가 활성화되었습니다.", 'log-system');

            // 현재 아군 턴이라면 즉시 자동 행동 실행
            if (this.battle.currentUnit && this.battle.currentUnit.team === 0 && !this.battle.isProcessingTurn) {
                this.runAllyAuto();
            }
        } else {
            btn.innerText = '자동전투 OFF';
            btn.style.borderColor = '#666';
            btn.style.background = 'rgba(0,0,0,0.7)';
            this.battle.log("✋ 자동전투가 비활성화되었습니다.", 'log-system');
        }
    }

    updateButtonVisibility(show) {
        const btn = document.getElementById('btn-auto-battle');
        if (btn) btn.style.display = show ? 'block' : 'none';
    }

    // ⭐ [신규 추가] 전투 종료 시 자동전투 강제 해제 및 UI 삭제
    clearAutoBattleState() {
        this.isAutoOn = false;
        if (this.battle) this.battle.isAutoBattle = false;
        
        const btn = document.getElementById('btn-auto-battle');
        if (btn) {
            btn.remove(); // DOM(UI)에서 완전히 파괴
        }
    }

    // ----------------------------------------------------------------
    // ⚔️ 턴 진입점 (아군 / 적군)
    // ----------------------------------------------------------------
    async runEnemyTurn() {
        await this._executeAILogic(this.battle.currentUnit);
    }

    async runAllyAuto() {
        if (!this.isAutoOn || this.battle.currentUnit.team !== 0) return;
        await this._executeAILogic(this.battle.currentUnit);
    }

    // ================================================================
    // 🧠 통합 AI 엔진 (어그로 + 직업별 포지셔닝 + 스마트 버프/힐)
    // ================================================================
    async _executeAILogic(unit) {
        this.battle.isProcessingTurn = true;
        const isAlly = unit.team === 0;
        this.battle.log(`${isAlly ? '⚔️ [자동전투]' : '🤖'} ${unit.name} 행동 중...`, isAlly ? 'log-system' : 'log-effect');
        
        await this.battle.smoothCenterCameraOnUnit(unit, 500);
        await new Promise(r => setTimeout(r, 800)); 

        const controlState = this.battle.statusManager ? this.battle.statusManager.getControlState(unit) : 'NORMAL';
        if (controlState === 'CONFUSION' || controlState === 'DEMORALIZED') {
            await this._handleHardCC(unit, controlState);
            return;
        }

        // ⭐ 1. 직업(Role) 분류 (축약어 E_ARC, E_KNI 등 완벽 대응)
        const clsStr = String(unit.key || unit.classKey || '').toUpperCase();
        let role = 'BRUISER'; // 기본: WARRIOR(WOR), MARTIAL ARTIST(MAR)
        if (clsStr.includes('KNI') || clsStr.includes('KNIGHT')) role = 'TANK';
        else if (clsStr.includes('THI') || clsStr.includes('THIEF')) role = 'ASSASSIN';
        else if (clsStr.includes('ARC') || clsStr.includes('ARCHER')) role = 'RANGED';
        else if (clsStr.includes('SOR') || clsStr.includes('SORCERER')) role = 'CASTER';
        else if (clsStr.includes('CLE') || clsStr.includes('CLERIC') || clsStr.includes('ALC') || clsStr.includes('ALCHEMIST')) role = 'SUPPORT';
        else if (clsStr.includes('BAR') || clsStr.includes('BARD') || clsStr.includes('DAN') || clsStr.includes('DANCER')) role = 'AURA';

        // 2. 평타(기본 공격) 데이터 세팅 및 타겟 정보 강제 주입 (자해 방지)
        const basicId = unit.equippedBasic || '1000';
        let basicSkill = unit.skills?.find(s => s.id === basicId);
        if (!basicSkill) {
            basicSkill = { 
                id: basicId, name: '기본 공격', type: 'ACTIVE', target: 'ENEMY_SINGLE', 
                cost: 20, mp: 0, rng: unit.rng || 1, 
                effects: [{ type: 'DMG_PHYS', val: 1, target: 'ENEMY_SINGLE' }] 
            };
        } else {
            if (!basicSkill.target) basicSkill.target = 'ENEMY_SINGLE';
            if (basicSkill.effects) basicSkill.effects.forEach(e => { if (!e.target) e.target = 'ENEMY_SINGLE'; });
        }

        // ⭐ 3. 지원가/마법사 마나 고갈 시 턴 스킵 (대기) 로직 (축약어 대응)
        const activeSkills = (unit.skills || []).filter(s => s.type !== 'PASSIVE' && s.id !== basicId && unit.curMp >= s.mp);
        const isMpDependent = ['SOR', 'CLE', 'BAR', 'DAN', 'ALC', 'SORCERER', 'CLERIC', 'BARD', 'DANCER', 'ALCHEMIST'].some(c => clsStr.includes(c));
        
        if (activeSkills.length === 0 && isMpDependent) {
            // 적을 평타로 죽일 수 있는 킬각인지 확인
            let canKill = false;
            const enemies = this.battle.units.filter(u => u.team !== unit.team && u.curHp > 0 && !u.isWall);
            for (let e of enemies) {
                const res = Formulas.calculateDamage(unit, e, 1.0, unit.atkType || 'PHYS', this.battle.grid);
                if (res.damage >= e.curHp) { canKill = true; break; }
            }

            if (!canKill) {
                this.battle.showFloatingText(unit, "MP 집중", "#44aaff");
                this.battle.log(`💡 [고지능 AI] ${unit.name}이(가) 무의미한 평타를 포기하고 턴을 넘겨 MP를 모읍니다.`, 'log-system');
                this.battle.endTurn(true); 
                return;
            }
        }

        // 4. 어그로/지원 기반 타겟 선정
        let { finalTarget, intent } = this._evaluatePotentialTargets(unit, role);
        if (!finalTarget) { 
            this.battle.log("적절한 행동 대상이 없어 턴을 종료합니다.", "log-system");
            this.battle.endTurn(true); 
            return; 
        }

        // 5. 직업별 생존/전술 포지셔닝 타일 계산
        this.battle.calcReachable();
        let moveData = this._calculateBestMoveAndWall(unit, finalTarget, basicSkill, role, intent);
        let targetEntity = moveData.isAttackingWall ? moveData.wallTarget : finalTarget;

        // 6. 이동 실행
        if (moveData.hex && (moveData.hex.q !== unit.q || moveData.hex.r !== unit.r)) {
            await this.battle.moveUnit(unit, moveData.hex.q, moveData.hex.r);
            await new Promise(r => setTimeout(r, 400));
        } else if (moveData.minD > this.battle.grid.getDistance(unit, targetEntity) + 5 && !moveData.isAttackingWall) {
            this.battle.log(`[${unit.name}] 전방이 막혀 위치를 고수합니다.`, "log-system");
        }

        // 7. 스킬/평타 선택 및 공격/지원 실행
        await this._executeBestAction(unit, targetEntity, moveData.isAttackingWall, basicSkill, intent);

        this.battle.endTurn();
    }

    // ================================================================
    // 🛠️ 헬퍼 함수들 (세부 논리)
    // ================================================================

    async _handleHardCC(unit, state) {
        if (state === 'CONFUSION') {
            this.battle.log(`😵 ${unit.name} 혼란 상태! (통제 불능)`, 'log-cc');
            await new Promise(r => setTimeout(r, 400));
            if (Math.random() < 0.2) {
                this.battle.showFloatingText(unit, "멍 때림...", "#aaa");
                this.battle.endTurn(); return;
            }
            this.battle.calcReachable();
            if (this.battle.reachableHexes?.length > 0) {
                const validMoves = this.battle.reachableHexes.filter(h => h.q !== unit.q || h.r !== unit.r); 
                if (validMoves.length > 0) await this.battle.moveUnit(unit, validMoves[Math.floor(Math.random() * validMoves.length)].q, validMoves[0].r);
            }
            const allTargets = this.battle.units.filter(u => u.curHp > 0 && u.id !== unit.id && !u.isWall && u.type !== 'OBJECT' && !this.battle.hasStatus(u, 'STAT_STEALTH'));
            const targetsInRange = allTargets.filter(u => this.battle.grid.getDistance(unit, u) <= (parseInt(unit.rng) || 1));
            if (targetsInRange.length > 0) {
                const t = targetsInRange[Math.floor(Math.random() * targetsInRange.length)];
                this.battle.selectedSkill = { type: 'ACTIVE', target: 'ENEMY_SINGLE', effects: [{ type: 'DMG_PHYS', val: 1, target: 'ENEMY_SINGLE' }] };
                await this.battle.skillProcessor.execute(t, t);
            }
        } else if (state === 'DEMORALIZED') {
            this.battle.log(`🏳️ ${unit.name}이(가) 전의를 상실하여 도망칩니다!`, 'log-cc');
            const enemies = this.battle.units.filter(u => u.team !== unit.team && u.curHp > 0);
            if (enemies.length > 0) {
                const nearest = enemies.sort((a,b) => this.battle.grid.getDistance(unit, a) - this.battle.grid.getDistance(unit, b))[0];
                this.battle.calcReachable();
                let bestHex = null, maxDist = -1;
                this.battle.reachableHexes.forEach(h => {
                    const d = this.battle.grid.getDistance(h, nearest);
                    if (d > maxDist) { maxDist = d; bestHex = h; }
                });
                if (bestHex) await this.battle.moveUnit(unit, bestHex.q, bestHex.r);
            }
        }
        this.battle.endTurn();
    }

    _evaluatePotentialTargets(unit, role) {
        let bestTarget = null;
        let bestIntent = 'ATTACK';
        let highestScore = -9999;

        // ⭐ 1. 내가 현재 사용 가능한 행동(스킬+아이템) 목록 파악
        // (단순히 마나를 확인하는 것을 넘어 부활 수단이 있는지 대략적으로 체크)
        const availableSkills = (unit.skills || []).filter(s => s.type !== 'PASSIVE' && unit.curMp >= (s.mp || 0) && !(unit.cooldowns && unit.cooldowns[s.id] > 0));
        
        const hasHeal = availableSkills.some(s => s.effects && s.effects.some(e => e.type.includes('HEAL')));
        const hasRevive = availableSkills.some(s => s.effects && s.effects.some(e => e.type.includes('REVIVE') || e.type.includes('RESURRECT')));
        const hasPhysBuff = availableSkills.some(s => s.effects && s.effects.some(e => e.type === 'BUFF_ATK_PHYS' || e.type === 'BUFF_STR'));
        const hasMagBuff = availableSkills.some(s => s.effects && s.effects.some(e => e.type === 'BUFF_ATK_MAG' || e.type === 'BUFF_INT'));
        const hasDefBuff = availableSkills.some(s => s.effects && s.effects.some(e => e.type === 'BUFF_DEF' || e.type === 'BUFF_RES' || e.type === 'BUFF_VIT'));

        // ⭐ 2. 아군 지원 스코어링 (부활/힐/버프)
        // [핵심 변경] curHp > 0 조건에 isIncapacitated(전투 불능) 상태 추가!
        let allies = this.battle.units.filter(u => u.team === unit.team && (u.curHp > 0 || u.isIncapacitated) && !u.isFullyDead && !u.isWall && u.type !== 'OBJECT');
        
        allies.forEach(ally => {
            let score = 0;
            const hpPct = ally.hp > 0 ? (ally.curHp / ally.hp) : 0;
            
            // 🚨 [부활 대상 최우선 탐색]
            if (ally.isIncapacitated && !ally.isFullyDead) {
                // 내가 부활 스킬이 있거나, 나중에 아이템 시뮬레이션에서 찾을 가능성을 열어둠
                score += 3000; 
                if (ally.deathTimer <= 1) score += 2000; // 다음 턴에 진짜 죽는다면 초특급 우선도!
            }
            // 💚 [힐/버프 타겟팅] (살아있는 아군 대상)
            else if (ally.curHp > 0) {
                if (hasHeal) {
                    if (hpPct <= 0.3) score += 500; 
                    else if (hpPct <= 0.6) score += 200; 
                    else if (hpPct <= 0.8) score += 50;
                }
                
                const allyCls = String(ally.key || ally.classKey || '').toUpperCase();
                const isPhysDps = ['WAR', 'KNI', 'MAR', 'THF', 'ROG', 'ARC', 'DANCER'].some(c => allyCls.includes(c));
                const isMagDps = ['SOR', 'CLE', 'ALC', 'BAR'].some(c => allyCls.includes(c));

                if (hasPhysBuff && isPhysDps) {
                    const alreadyHasBuff = ally.buffs && ally.buffs.some(b => b.type === 'BUFF_ATK_PHYS' || b.type === 'BUFF_STR');
                    if (!alreadyHasBuff) score += 150;
                }
                if (hasMagBuff && isMagDps) {
                    const alreadyHasBuff = ally.buffs && ally.buffs.some(b => b.type === 'BUFF_ATK_MAG' || b.type === 'BUFF_INT');
                    if (!alreadyHasBuff) score += 150;
                }
                if (hasDefBuff && (allyCls.includes('KNI') || hpPct < 0.8)) {
                    const alreadyHasBuff = ally.buffs && ally.buffs.some(b => b.type === 'BUFF_DEF' || b.type === 'BUFF_RES');
                    if (!alreadyHasBuff) score += 100;
                }
            }

            if (score > highestScore) {
                highestScore = score;
                bestTarget = ally;
                bestIntent = 'SUPPORT';
            }
        });

        // ⭐ 3. 적군 공격 스코어링
        let enemies = this.battle.units.filter(u => 
            u.team !== unit.team && u.curHp > 0 && !u.isWall && u.type !== 'OBJECT' &&
            !this.battle.hasStatus(u, 'STEALTH') && !this.battle.hasStatus(u, 'STAT_STEALTH') && !this.battle.hasStatus(u, 'BUFF_UNTARGETABLE')
        );

        const tauntBuff = unit.buffs?.find(b => b.type.includes('TAUNT') || b.type.includes('AGGRO'));
        if (tauntBuff && tauntBuff.casterId) {
            const tauntSource = this.battle.units.find(u => String(u.id) === String(tauntBuff.casterId) && u.curHp > 0);
            if (tauntSource) return { finalTarget: tauntSource, intent: 'ATTACK' };
        }

        enemies.forEach(t => {
            let score = 100; 
            score -= this.battle.grid.getDistance(unit, t) * 10;

            const res = Formulas.calculateDamage(unit, t, 1.0, unit.atkType || 'PHYS', this.battle.grid);
            if (res.damage >= t.curHp) score += 300; 

            const cls = String(t.key || t.classKey || '').toUpperCase();
            if (['CLE', 'SOR', 'ALC', 'BAR', 'DAN'].some(c => cls.includes(c))) score += 100; 
            else if (cls.includes('KNI')) score -= 50; 
            
            if (this.battle.statusManager && this.battle.statusManager.getControlState(t) !== 'NORMAL') score -= 80;

            if (score > highestScore) {
                highestScore = score;
                bestTarget = t;
                bestIntent = 'ATTACK';
            }
        });

        return { finalTarget: bestTarget, intent: bestIntent };
    }
    // ================================================================
    // ⭐ [신규 추가] AI 전용 입체 지형 레이더 (Dijkstra Pathfinding)
    // 타겟으로부터 맵 전체로 퍼져나가는 가상의 물결을 만들어,
    // 도약력(Jump)으로 오르내릴 수 있는 '실제 걸어가는 거리'를 계산합니다.
    // ================================================================
    _buildDistanceMap(target, unit) {
        const grid = this.battle.grid;
        let distMap = new Map();
        if (!grid) return distMap;

        let queue = [{ q: target.q, r: target.r, dist: 0 }];
        distMap.set(`${target.q},${target.r}`, 0);
        
        // 현재 유닛의 최종 도약력(Jump) 계산
        let jump = 1;
        if (typeof Formulas !== 'undefined' && Formulas.getDerivedStat) {
            jump = Formulas.getDerivedStat(unit, 'jump') || unit.jump || 1;
        } else {
            jump = unit.jump || 1;
            let jMod = 0; (unit.buffs || []).forEach(b => { if (b.type.includes('JUMP')) jMod += (parseFloat(b.val) || 0); });
            jump += jMod;
        }
        
        while (queue.length > 0) {
            let curr = queue.shift();
            if (curr.dist > 40) continue; // 무한 루프 방지용 최대 탐색 깊이 제한

            const neighbors = [
                {q: curr.q+1, r: curr.r}, {q: curr.q+1, r: curr.r-1}, {q: curr.q, r: curr.r-1},
                {q: curr.q-1, r: curr.r}, {q: curr.q-1, r: curr.r+1}, {q: curr.q, r: curr.r+1}
            ];

            for (let n of neighbors) {
                let nKey = `${n.q},${n.r}`;
                if (distMap.has(nKey)) continue;

                let curData = grid.getTerrainData(curr.q, curr.r);
                let nData = grid.getTerrainData(n.q, n.r);
                if (!curData || !nData) continue; // 맵 밖으로 벗어남

                // ⭐ 도약력(Jump) 검사 (높이 차이가 도약력보다 크면 절벽/낭떠러지로 간주하여 길을 끊음)
                if (Math.abs(nData.h - curData.h) > jump) continue; 
                
                // ⭐ 장벽 검사 (타겟이 서 있는 곳의 벽은 무시, 가는 길에 있는 토벽/빙벽은 차단)
                let isBlockedByWall = this.battle.units.some(u => u.isWall && u.q === n.q && u.r === n.r && !(n.q === target.q && n.r === target.r));
                if (isBlockedByWall) continue;

                distMap.set(nKey, curr.dist + 1);
                queue.push({ q: n.q, r: n.r, dist: curr.dist + 1 });
            }
        }
        return distMap;
    }

   _calculateBestMoveAndWall(unit, target, basicSkill, role, intent) {
        let baseRng = Formulas.getDerivedStat(unit, 'rng') || parseInt(unit.rng) || 1;
        let maxRange = parseInt(basicSkill.rng) || baseRng;
        
        if (unit.skills) {
            unit.skills.forEach(s => {
                if ((unit.curMp || 0) >= (s.mp || 0) && !['PASSIVE'].includes(s.type)) {
                    const sRng = parseInt(s.rng) || baseRng;
                    if (sRng > maxRange) maxRange = sRng;
                }
            });
        }

        let moveHex = null; let bestScore = -9999;
        let isAttackingWall = false; let wallTarget = null;

        const allies = this.battle.units.filter(u => u.team === unit.team && u.curHp > 0 && u.id !== unit.id && !u.isWall);
        const enemies = this.battle.units.filter(u => u.team !== unit.team && u.curHp > 0 && !u.isWall);

        const hpPct = unit.curHp / unit.hp;
        let isFleeing = false;

        if (['RANGED', 'CASTER', 'SUPPORT', 'AURA'].includes(role)) {
            isFleeing = true; 
        } else if (hpPct < 0.4) {
            const healthyAllies = allies.filter(a => (a.curHp / a.hp) > 0.5);
            if (healthyAllies.length > 0) {
                isFleeing = true; 
            } else {
                isFleeing = false; 
                this.battle.log(`🔥 [결사항전] ${unit.name}이(가) 물러설 곳이 없음을 깨닫고 죽음을 각오합니다!`, 'log-system');
                this.battle.showFloatingText(unit, "결사항전!", "#ff4444");
            }
        }

        const realDistMap = this._buildDistanceMap(target, unit);

        this.battle.reachableHexes.forEach(h => {
            let score = 0;
            
            let dToTarget = realDistMap.get(`${h.q},${h.r}`);
            let isPathBlocked = false;

            if (dToTarget === undefined) {
                dToTarget = this.battle.grid.getDistance(h, target) + 100; 
                isPathBlocked = true;
            }

            let minEnemyDist = 999;
            let dangerScore = 0;

            enemies.forEach(e => {
                const ed = this.battle.grid.getDistance(h, e);
                if (ed < minEnemyDist) minEnemyDist = ed;
                
                const eMaxRng = (parseInt(e.rng) || 1) + (Formulas.getDerivedStat(e, 'mov') || 3);
                if (ed <= eMaxRng) {
                    dangerScore += (eMaxRng - ed + 1) * 20; 
                }
            });

            if (isFleeing) {
                score -= dangerScore * 2; 
                if (minEnemyDist <= 2) score -= 500; 
                else score += (minEnemyDist * 20); 

                let allyShieldScore = 0;
                allies.forEach(ally => {
                    const ad = this.battle.grid.getDistance(h, ally);
                    if (ad >= 1 && ad <= 2) {
                        const allyRole = String(ally.key || ally.classKey || '').toUpperCase();
                        const isTank = allyRole.includes('KNI') || allyRole.includes('WAR');
                        
                        if (isTank && (ally.curHp / ally.hp) > 0.5) allyShieldScore += 100;
                        else allyShieldScore += 30; 
                    }
                });
                score += allyShieldScore;
            }

            if (intent === 'SUPPORT' || role === 'AURA') {
                if (dToTarget <= maxRange && dToTarget > 0) score += 200; 
                else score -= Math.abs(dToTarget - maxRange) * 10; 
            } 
            else if (role === 'RANGED' || role === 'CASTER') {
                if (dToTarget === maxRange) score += 300;
                else score -= Math.abs(dToTarget - maxRange) * 50;
            }
            else if (role === 'ASSASSIN') {
                score -= dToTarget * 20; 
                if (Math.abs(h.q - target.q) > Math.abs(unit.q - target.q)) score += 150;
            }
            else if (role === 'TANK' || role === 'BRUISER') {
                if (isFleeing) {
                    score -= dToTarget * 10;
                } else {
                    // ⭐ [수정] 탱커/전사는 무조건 적에게 전진하는 것(-50점 페널티 상쇄)이 최우선이 됩니다.
                    score -= dToTarget * 50;
                    if (role === 'TANK') {
                        allies.forEach(u => {
                            if (String(u.classKey).includes('CLE') || String(u.classKey).includes('SOR') || String(u.classKey).includes('ARC')) {
                                // ⭐ [수정] 물몸 아군 보호 점수를 100점에서 20점으로 대폭 삭감 (우선순위 하향 조정)
                                if (this.battle.grid.getDistance(h, u) === 1) score += 20;
                            }
                        });
                    }
                }
            }

            if (score > bestScore) { bestScore = score; moveHex = h; }
        });

        const directDist = this.battle.grid.getDistance(unit, target); 
        let currentBestDist = moveHex ? (realDistMap.get(`${moveHex.q},${moveHex.r}`) || 999) : 999;

        if (moveHex && moveHex.q === unit.q && moveHex.r === unit.r && intent !== 'SUPPORT' && role !== 'AURA' && role !== 'RANGED' && role !== 'CASTER' && !isFleeing && currentBestDist < 100) {
            let altHex = null; let altScore = -9999;
            this.battle.reachableHexes.forEach(h => {
                if (h.q === unit.q && h.r === unit.r) return; 
                const d = realDistMap.get(`${h.q},${h.r}`) || 999;
                if (-d * 50 > altScore && d <= currentBestDist + 1) { altScore = -d * 50; altHex = h; }
            });
            if (altHex) moveHex = altHex; 
        }

        if (intent === 'ATTACK' && (!moveHex || currentBestDist >= 100)) {
            const walls = this.battle.units.filter(u => u.curHp > 0 && u.isWall && (u.key === 'WALL_EARTH' || u.key === 'WALL_ICE'));
            if (walls.length > 0) {
                const nearestWall = walls.sort((a,b) => this.battle.grid.getDistance(unit, a) - this.battle.grid.getDistance(unit, b))[0];
                const distToWall = this.battle.grid.getDistance(unit, nearestWall);

                if (distToWall <= maxRange + Formulas.getDerivedStat(unit, 'mov')) {
                    wallTarget = nearestWall; 
                    isAttackingWall = true;
                    this.battle.log(`🧱 [경로 차단] ${unit.name}이(가) 우회로가 없자 ${nearestWall.name}을(를) 파괴하려 합니다!`, 'log-system');
                    
                    let minD = 999;
                    this.battle.reachableHexes.forEach(h => {
                        const d = this.battle.grid.getDistance(h, nearestWall);
                        if (d < minD) { minD = d; moveHex = h; }
                    });
                }
            } else {
                let altHex = null; let altScore = -9999;
                this.battle.reachableHexes.forEach(h => {
                    if (h.q === unit.q && h.r === unit.r) return; 
                    const d = this.battle.grid.getDistance(h, target);
                    if (-d > altScore) { altScore = -d; altHex = h; }
                });
                if (altHex) moveHex = altHex; 
            }
        }
        
        return { hex: moveHex, minD: currentBestDist, isAttackingWall, wallTarget };
    }

    // ================================================================
    // ⭐ [신규 추가] 스킬 가치 시뮬레이션 엔진 (A.I. Value Simulator)
    // - 이 스킬을 대상에게 썼을 때 일어날 미래의 이득/손실을 점수로 반환합니다.
    // ================================================================
    _simulateSkillValue(unit, target, skill, intent, isAttackingWall) {
        if (!skill || !skill.effects || skill.effects.length === 0) return -9999;

        let totalScore = 0;
        const isAoE = parseInt(skill.area) > 0;
        const safeAlly = unit.skills?.some(ps => ps.type === 'PASSIVE' && ps.effects?.some(e => e.type === 'PAS_AOE_SAFE_ALLY'));

        let affectedTargets = [target];
        if (isAoE && this.battle.grid) {
            affectedTargets = [];
            this.battle.units.forEach(u => {
                // 부활기면 쓰러진 애들도 영역 안에 포함시킴
                if ((u.curHp > 0 || u.isIncapacitated) && this.battle.grid.getDistance(target, u) <= parseInt(skill.area)) {
                    affectedTargets.push(u);
                }
            });
        }

        affectedTargets.forEach(t => {
            const isEnemy = t.team !== unit.team;
            let targetScore = 0;

            skill.effects.forEach(eff => {
                const eType = String(eff.type).toUpperCase();

                // 🚨 [부활 로직 최우선 검사]
                if (t.isIncapacitated && !t.isFullyDead) {
                    if (eType.includes('REVIVE') || eType.includes('RESURRECT')) {
                        if (isEnemy) { targetScore -= 5000; return; } // 적 부활 금지
                        targetScore += 5000; // 부활 성공 시 압도적 가점!
                        if (t.deathTimer <= 1) targetScore += 3000; // 다음 턴 사망 확정이면 무조건 살림!
                    } else {
                        targetScore -= 1000; // 쓰러진 동료에게 부활 외의 힐/버프/공격은 모두 낭비(무의미)
                    }
                    return; // 전투불능자는 여기서 이펙트 판정 조기 종료
                }
                
                // 만약 멀쩡히 살아있는 녀석에게 부활 스킬을 쓴다면 낭비
                if (eType.includes('REVIVE') || eType.includes('RESURRECT')) {
                    targetScore -= 2000;
                    return;
                }

                // ⚔️ [데미지 로직]
                if (eType.includes('DMG')) {
                    if (!isEnemy && !safeAlly) { targetScore -= 400; return; }
                    if (isEnemy) {
                        const atkType = eType.includes('MAG') ? 'MAG' : 'PHYS';
                        const res = Formulas.calculateDamage(unit, t, parseFloat(eff.val) || 1.0, atkType, this.battle.grid);
                        targetScore += res.damage; 
                        if (res.damage >= t.curHp) targetScore += 600; 
                        if (t.isWall) targetScore += isAttackingWall ? 300 : -100;
                    }
                }
                // 🔵 상태이상 해제 (CURE / DISPEL / PURIFY)
                else if (eType.includes('CURE') || eType.includes('DISPEL') || eType.includes('PURIFY')) {
                    if (isEnemy) { targetScore -= 1000; return; } 
                    const hasSevereCC = t.buffs?.some(b => b.type.includes('CC_STUN') || b.type.includes('CC_FREEZE') || b.type.includes('CC_SLEEP') || b.type.includes('CC_CONFUSION') || b.type.includes('CC_CHARM'));
                    const hasSilence = t.buffs?.some(b => b.type.includes('CC_SILENCE'));
                    const hasDoT = t.buffs?.some(b => b.type.includes('POISON') || b.type.includes('BURN') || b.type.includes('BLEED') || b.type.includes('CURSE'));
                    const isMage = ['SOR', 'CLE', 'ALC', 'BAR'].some(c => String(t.classKey).toUpperCase().includes(c));

                    if (hasSevereCC) targetScore += 600;
                    else if (hasSilence && isMage) targetScore += 600; 
                    else if (hasDoT) targetScore += 250; 
                    else if (t.buffs?.some(b => b.type.includes('DEBUFF'))) targetScore += 150; 
                    else targetScore -= 300; 
                }
                // 🟢 치유 (HEAL)
                else if (eType.includes('HEAL')) {
                    if (isEnemy) { targetScore -= 800; return; }
                    const missingHp = t.hp - t.curHp;
                    const hpPct = t.curHp / t.hp;
                    
                    if (missingHp <= 0) targetScore -= 300; 
                    else {
                        let healAmt = eType === 'HEAL_PCT' ? t.hp * (parseFloat(eff.val)/100) : (Formulas.getDerivedStat(unit, 'atk_mag') * (parseFloat(eff.val) || 1));
                        targetScore += Math.min(healAmt, missingHp) * 2; 
                        
                        if (hpPct <= 0.3) targetScore += 800;       
                        else if (hpPct <= 0.6) targetScore += 300;  
                        else if (hpPct < 0.9) targetScore += 50;    
                    }
                }
                // 🟡 기본 버프 (BUFF)
                else if (eType.includes('BUFF')) {
                    if (isEnemy) { targetScore -= 400; return; }
                    if (t.buffs?.some(b => b.type === eff.type)) { targetScore -= 300; return; } 

                    const tCls = String(t.key || t.classKey || '').toUpperCase();
                    const hpPct = t.curHp / t.hp;
                    
                    if (eType.includes('ATK_PHYS') || eType.includes('STR')) {
                        targetScore += ['WAR','KNI','MAR','THF','ROG','ARC','DANCER'].some(c => tCls.includes(c)) ? 150 : -500;
                    } else if (eType.includes('ATK_MAG') || eType.includes('INT')) {
                        targetScore += ['SOR','CLE','ALC','BAR'].some(c => tCls.includes(c)) ? 150 : -500;
                    } else if (eType.includes('DEF') || eType.includes('RES')) {
                        targetScore += (hpPct < 0.6 || tCls.includes('KNI')) ? 120 : 50; 
                    } else {
                        targetScore += 80; 
                    }
                }
                // ☠️ 적군 디버프 / CC기
                else if (eType.includes('DEBUFF') || eType.includes('CC_') || eType.includes('STAT_')) {
                    if (!isEnemy && !safeAlly) { targetScore -= 300; return; }
                    if (isEnemy) {
                        if (t.buffs?.some(b => b.type === eff.type)) { targetScore -= 100; return; } 
                        if (eType.includes('CC_STUN') || eType.includes('CC_FREEZE') || eType.includes('CC_SLEEP')) targetScore += 250;
                        else if (eType.includes('CC_SILENCE') && ['SOR','CLE','ALC'].some(c => String(t.classKey).toUpperCase().includes(c))) targetScore += 250; 
                        else targetScore += 100; 
                    }
                }
            });
            totalScore += targetScore;
        });

        totalScore -= (skill.mp || 0) * 0.2;
        return totalScore;
    }

    // ================================================================
    // ⭐ [개편됨] 스킬 가치 시뮬레이터를 기반으로 최고의 행동 실행
    // ================================================================
    async _executeBestAction(unit, target, isAttackingWall, basicSkill, intent) {
        const dist = this.battle.grid.getDistance(unit, target);
        let bestAction = { actionDef: null, score: -9999, isBasic: false, isItem: false };
        
        // 내 기본 사거리를 정확히 인지
        const baseRng = Formulas.getDerivedStat(unit, 'rng') || parseInt(unit.rng) || 1;
        const basicRng = parseInt(basicSkill.rng) || baseRng;

        // 1. 평타(기본 공격) 기준점 설정
        if (dist <= basicRng) {
            const basicScore = this._simulateSkillValue(unit, target, basicSkill, intent, isAttackingWall);
            bestAction = { actionDef: basicSkill, score: basicScore, isBasic: true, isItem: false };
        }

        if (!isAttackingWall) {
            let candidateActions = [];

            if (unit.skills) {
                candidateActions.push(...unit.skills.map(s => ({ ...s, isItem: false })));
            }

            const maxPockets = this.battle.getMaxPockets ? this.battle.getMaxPockets(unit) : 4;
            for (let i = 1; i <= maxPockets; i++) {
                const slotKey = `pocket${i}`;
                const eqData = unit.equipment ? unit.equipment[slotKey] : null;
                const itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
                
                if (itemId) {
                    let itemDef = null;
                    if (this.battle.gameApp && this.battle.gameApp.itemData && this.battle.gameApp.itemData[itemId]) itemDef = this.battle.gameApp.itemData[itemId];
                    else if (typeof window.ITEM_DATA !== 'undefined' && window.ITEM_DATA[itemId]) itemDef = window.ITEM_DATA[itemId];
                    
                    if (itemDef) {
                        let refSkillId = itemDef.refSkill || itemId;
                        let itemAsSkill = null;
                        
                        if (typeof window.SKILL_DATABASE !== 'undefined' && window.SKILL_DATABASE[refSkillId]) {
                            itemAsSkill = JSON.parse(JSON.stringify(window.SKILL_DATABASE[refSkillId]));
                        } else if (itemDef.effects) {
                            itemAsSkill = { ...itemDef }; 
                        }

                        if (itemAsSkill) {
                            candidateActions.push({
                                ...itemAsSkill,
                                name: itemDef.name || itemAsSkill.name,
                                icon: itemDef.icon || itemAsSkill.icon,
                                _slotKey: slotKey,
                                isItem: true,
                                mp: 0,
                                cost: itemDef.cost !== undefined ? itemDef.cost : (itemAsSkill.cost || 50)
                            });
                        }
                    }
                }
            }

            // 마나 부족, 쿨타임, 사거리 미달 등 쓸 수 없는 스킬 필터링
            const usableActions = candidateActions.filter(s => {
                if (s.type === 'PASSIVE') return false;
                if (!s.isItem && s.id === basicSkill.id) return false;
                if (!s.isItem && (unit.curMp || 0) < (s.mp || 0)) return false; 
                if (!s.isItem && unit.cooldowns && unit.cooldowns[s.id] > 0) return false; 
                
                const tType = String(s.target || 'ENEMY').toUpperCase();
                const isSupportSkill = tType.includes('ALLY') || tType === 'SELF';
                
                if (intent === 'SUPPORT' && !isSupportSkill) return false;
                if (intent === 'ATTACK' && isSupportSkill && tType !== 'SELF') return false; 
                
                if (dist > (parseInt(s.rng) || baseRng) && tType !== 'ALLY_ALL' && tType !== 'AREA_ALL') return false; 
                
                const area = parseInt(s.area) || 0;
                if (intent === 'ATTACK' && area > 0 && dist <= area && !s.isItem) {
                    const safeAlly = unit.skills?.some(ps => ps.type === 'PASSIVE' && ps.effects?.some(e => e.type === 'PAS_AOE_SAFE_ALLY'));
                    if (!safeAlly) return false; 
                }
                return true;
            });

            // 스킬별 점수 시뮬레이션
            usableActions.forEach(action => {
                let score = this._simulateSkillValue(unit, target, action, intent, isAttackingWall);
                
                // ⭐ [신규 추가] 무희 & 음유시인 전용 "스킬 최우선" 보너스
                // 아무 의미 없는 스킬(점수 -50 이하)이 아니라면, 무조건 평타보다 스킬을 선호하도록 +300점 특혜 부여
                if (!action.isItem && score > -50) { 
                    const classStr = String(unit.classKey || unit.key || '').toUpperCase();
                    if (classStr.includes('BARD') || classStr.includes('DANCER') || classStr.includes('BRD') || classStr.includes('DNC')) {
                        score += 300; 
                    }
                }

                if (score > bestAction.score) {
                    bestAction = { actionDef: action, score: score, isBasic: false, isItem: action.isItem };
                }
            });
        }

        // 4. 결정된 행동 실행
        let actionDone = false;

        if (bestAction.actionDef && bestAction.score > -500) { 
            const finalTarget = (String(bestAction.actionDef.target).toUpperCase() === 'SELF') ? unit : target;

            this.battle.selectedSkill = bestAction.actionDef;
            await new Promise(r => setTimeout(r, 400));
            
            if (bestAction.isItem) {
                const isRevive = bestAction.actionDef.effects?.some(e => e.type.includes('REVIVE'));
                this.battle.showFloatingText(unit, "아이템 사용!", "#ffaa00");
                this.battle.log(`💊 [투척/사용] ${unit.name}이(가) ${finalTarget.name}에게 [${bestAction.actionDef.name}]을(를) 사용합니다!`, 'log-skill');
                
                await this.battle.skillProcessor.execute(finalTarget, finalTarget);
                if (this.battle.consumeItem) this.battle.consumeItem(unit, bestAction.actionDef._slotKey);
                
                if (isRevive && finalTarget.isIncapacitated && finalTarget.curHp > 0) {
                    finalTarget.isIncapacitated = false;
                    finalTarget.deathTimer = undefined;
                    finalTarget.icon = finalTarget.prevIcon || "👤";
                    if (this.battle.ui && this.battle.ui.renderUnitOverlays) this.battle.ui.renderUnitOverlays();
                }

            } else {
                if (intent === 'SUPPORT' && !bestAction.isBasic) {
                    const isHeal = bestAction.actionDef.effects?.some(e => e.type.includes('HEAL'));
                    const isRevive = bestAction.actionDef.effects?.some(e => e.type.includes('REVIVE'));
                    const msg = isRevive ? "부활의 빛!" : (isHeal ? "치유 시전!" : "지원 시전!");
                    const icon = isRevive ? "👼" : (isHeal ? "💚" : "🙌");
                    const color = isRevive ? "#ffffaa" : (isHeal ? "#00ff00" : "#00ffcc");

                    this.battle.showFloatingText(unit, msg, color);
                    this.battle.log(`${icon} [지원] ${unit.name}이(가) ${finalTarget.name}에게 [${bestAction.actionDef.name}]을(를) 시전합니다!`, 'log-skill');
                } else if (!bestAction.isBasic) {
                    // 무희나 음유시인이 공격적인 춤/노래를 불렀을 때
                    this.battle.log(`💥 [전술 스킬] ${unit.name}이(가) [${bestAction.actionDef.name}] 발동!`, 'log-skill');
                }
                
                await this.battle.skillProcessor.execute(finalTarget, finalTarget); 
                
                if (bestAction.actionDef.effects?.some(e => e.type.includes('REVIVE')) && finalTarget.curHp > 0) {
                    finalTarget.isIncapacitated = false;
                    finalTarget.deathTimer = undefined;
                    finalTarget.icon = finalTarget.prevIcon || "👤";
                    if (this.battle.ui && this.battle.ui.renderUnitOverlays) this.battle.ui.renderUnitOverlays();
                }
            }
            actionDone = true;
        } 
        
        // 쓸 스킬이 없고 평타조차 안 닿는 경우, 근처 적에게 묻지마 공격 시도 (평화주의자 탈피 로직)
        if (!actionDone && !isAttackingWall) {
            let atkTarget = target;
            let distToAtk = dist;

            if (intent === 'SUPPORT') {
                const enemies = this.battle.units.filter(u => u.team !== unit.team && u.curHp > 0 && !u.isWall);
                if (enemies.length > 0) {
                    atkTarget = enemies.sort((a,b) => this.battle.grid.getDistance(unit, a) - this.battle.grid.getDistance(unit, b))[0];
                    distToAtk = this.battle.grid.getDistance(unit, atkTarget);
                } else {
                    atkTarget = null;
                }
            }

            if (atkTarget && distToAtk <= basicRng) {
                this.battle.selectedSkill = basicSkill;
                await new Promise(r => setTimeout(r, 300));
                this.battle.log(`⚔️ [기본 공격] ${unit.name}이(가) ${atkTarget.name}을(를) 공격합니다.`, 'log-skill');
                await this.battle.skillProcessor.execute(atkTarget, atkTarget);
                actionDone = true;
            }
        }

        // 사거리가 안 닿아서 아무것도 못 쳤다면 대기
        if (!actionDone && !isAttackingWall) {
            const msg = intent === 'SUPPORT' ? "대기 (할 수 있는 게 없음)" : "대기 (기회 엿봄)";
            this.battle.showFloatingText(unit, msg, "#aaaaaa");
            this.battle.log(`🛡️ [${unit.name}] 완벽한 타이밍을 위해 행동을 보류하고 턴을 종료합니다.`, "log-system");
        }
    }
}