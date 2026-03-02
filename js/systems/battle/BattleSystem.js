import { STAGE_DATA, CLASS_DATA, SKILL_DATABASE, TERRAIN_TYPES,EFFECTS } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';
import { SkillProcessor } from './SkillProcessor.js';
import { BattleInput } from './BattleInput.js';
import { BattleUI } from './BattleUI.js';
import { BattleAI } from './BattleAI.js';
import { MAP_NAMES } from '../../data/MapNames.js';
import { StatusManager } from './StatusManager.js';
import { SandboxManager } from './SandboxManager.js';
import { ProgressionManager } from './ProgressionManager.js';
import { CameraManager } from './CameraManager.js';
import { LootManager } from './LootManager.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { TargetingManager } from './TargetingManager.js'; 
import { MovementManager } from './MovementManager.js';   
import { UnitLifecycleManager } from './UnitLifecycleManager.js'; 
import { RangeManager } from './RangeManager.js';         

export class BattleSystem {
    constructor(grid, gameApp, chapter, stage, customParty = null) {
        this.grid = grid;
        this.gameApp = gameApp;
        this.chapter = Number(chapter);
        this.stage = isNaN(stage) ? stage : Number(stage);
        this.customParty = customParty;         
        this.units = [];
        this.traps = []; 
        this.actionGaugeLimit = 100;       
        this.currentUnit = null;
        this.viewingUnit = null; 
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.confirmingItemSlot = null;        
        this.actions = { moved: false, acted: false };
        this.goldMod = 1.0;
        this.dropMod = 1.0;      
        this.reachableHexes = []; 
        this.attackableHexes = []; 
        this.hoverHex = null;
        this.textQueue = []; 
        this.projectiles = []; 
        this.isAnimating = false;
        this.isProcessingTurn = false;
        this.isBattleEnded = false;
        this.isAutoBattle = false;
        this.isBattleWon = false;
        this.isTestMode = false; 
        this.activeTimeStop = null;
        this.camera = { x: 0, y: 0 };
        
        // --- Manager 생성 (Delegation) ---
        this.ui = new BattleUI(this, grid.canvas);
        this.skillProcessor = new SkillProcessor(this);
        this.inputSystem = new BattleInput(this, grid.canvas);
        this.aiSystem = new BattleAI(this);
        this.statusManager = new StatusManager(this);
        this.sandbox = new SandboxManager(this);
        this.progression = new ProgressionManager(this);
        this.cameraManager = new CameraManager(this);
        this.lootManager = new LootManager(this);
        this.environment = new EnvironmentManager(this);
        this.targetingManager = new TargetingManager(this);
        this.movement = new MovementManager(this);
        this.lifecycle = new UnitLifecycleManager(this);
        this.rangeManager = new RangeManager(this);

        this.injectStyles();      
        this.overlayContainer = document.getElementById('unit-overlays');
        if (!this.overlayContainer) {
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'unit-overlays';
            Object.assign(this.overlayContainer.style, {
                position: 'absolute', top: '0', left: '0', 
                pointerEvents: 'none', width: '100%', height: '100%', zIndex: '100'
            });
            document.body.appendChild(this.overlayContainer);
        }

        const stageData = STAGE_DATA[this.chapter]?.[this.stage];
        this.hiddenObj = stageData && stageData.hiddenObj ? JSON.parse(JSON.stringify(stageData.hiddenObj)) : [];
        if (stageData && stageData.cols && stageData.rows) {
            this.grid.resize(stageData.cols, stageData.rows);
        } else {
            this.grid.resize(30, 30);
        }
        Formulas.setBattleSystem(this);

        this.initUnits(chapter, stage);
        
        // ⭐ [근본 아키텍처 도입] 전투에 진입한 유닛들의 스킬 목록을 '장착 덱' 기준으로 단 1회 전처리하여 확정
        this._compileCombatDecks();
        
        setTimeout(() => {
            this.handleResize(); 
            this.centerCameraOnHeroes(); 
            this.showStageTitle();
        }, 100);
        
        this.nextTurn(); 
    }
    // =====================================================================
    // ⭐ [신규] 전투 덱 컴파일러 (Battle Instance Materialization)
    // 원본 저장 데이터를 훼손하지 않으면서, 전투 엔진(CombatManager 등)이 
    // 불필요한 패시브를 참조하지 못하도록 전투용 스킬 배열을 재구성합니다.
    // =====================================================================
    _compileCombatDecks() {
        this.units.forEach(u => {
            // 아군 영웅이고, 장착 스킬 시스템(equippedSkills)을 사용하는 경우에만 압축
            if (u.team === 0 && u.equippedSkills) {
                
                // 1. 원본 스킬 백업 (전투 중 UI나 특수 스킬이 전체 목록을 요구할 때를 대비한 안전장치)
                u.originalSkills = [...(u.skills || [])];

                // 2. 엔진이 참조할 u.skills를 '현재 장착된 세팅'으로 완전히 교체
                u.skills = u.originalSkills.filter(s => {
                    const part = s.part || (s.type === 'PASSIVE' ? 'S' : 'A');
                    
                    // 액션(A) 스킬은 무조건 전투 커맨드에 떠야 하므로 포함
                    if (part === 'A') return true; 

                    // 서포트(S)와 오토(P) 스킬은 장착 슬롯에 존재하는 것만 전투 덱에 포함
                    const catEquipId = s.category ? `CAT_${s.category}` : null;
                    return u.equippedSkills.includes(s.id) || (catEquipId && u.equippedSkills.includes(catEquipId));
                });
            }
        });
        console.log("⚔️ 시스템: 영웅들의 전투 덱(Combat Deck) 컴파일 완료.");
    }

    interactWithUnit(unit) {
        if (!unit) return;
        if (unit.isNPC) {
            this.handleNPCInteraction(unit);
            return;
        }
        if (this.currentUnit && this.currentUnit.team === 0 && !this.selectedSkill) {
            if (unit.team === 1 && !this.isPeaceful && !this.actions.acted) {
                this.executeAutoBasicAttack(unit);
                return;
            }
        }
        this.viewingUnit = unit;
        this.updateStatusPanel();
    }

    async executeAutoBasicAttack(target) {
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted || this.isProcessingTurn) return;

        this.isProcessingTurn = true; 
        this.updateFloatingControls(); 

        const basicId = u.equippedBasic || '1000';
        let basicSkill = null;
        if (typeof SKILL_DATABASE !== 'undefined' && SKILL_DATABASE[basicId]) {
            basicSkill = JSON.parse(JSON.stringify(SKILL_DATABASE[basicId]));
        } else {
            basicSkill = {
                id: '1000', name: '기본 공격', type: 'ACTIVE', target: 'ENEMY_SINGLE', 
                cost: 80, mp: 0, rng: 1, area: 0, 
                effects: [{target: 'ENEMY_SINGLE', type: 'DMG_PHYS', val: 1, rng: 1, prob: 100}]
            };
        }
        basicSkill.cost = 80;

        const moveRange = this.actions.moved ? 0 : Formulas.getDerivedStat(u, 'mov');
        const dist = this.grid.getDistance(u, target);

        this.saveCameraState();
        await this.smoothCenterCameraOnUnit(u, 300);

        const isInRange = this.rangeManager.isTargetInValidRange(u, target, basicSkill);

        if (isInRange) {
            this.log("기본 공격!", "log-skill");
            this.selectedSkill = basicSkill;
            await this.skillProcessor.execute(target, target);         
        } 
        else if (!this.actions.moved) {
            if (dist > moveRange + (parseInt(basicSkill.rng) || 1) + 2) { 
                this.log("너무 멉니다.", "log-bad");
                this.showFloatingText(u, "Too Far", "#aaa");
                this.triggerShakeAnimation(u);
                await this.restoreCameraState(); 
            } else {
                let bestHex = null;
                let minDistToTarget = 999;

                if (this.reachableHexes && this.reachableHexes.length > 0) {
                    for (const h of this.reachableHexes) {
                        const distFromHexToTarget = this.grid.getDistance(h, target);
                        const testUnit = { ...u, q: h.q, r: h.r };
                        if (this.rangeManager.isTargetInValidRange(testUnit, target, basicSkill)) {
                            const pathDist = this.grid.getDistance(u, h);
                            if (pathDist < minDistToTarget) {
                                minDistToTarget = pathDist;
                                bestHex = h;
                            }
                        }
                    }
                }

                if (bestHex) {
                    this.log("접근하여 공격합니다.", "log-system");
                    const moved = await this.moveUnit(u, bestHex.q, bestHex.r);
                    if (moved !== false && u.curHp > 0) {
                        this.selectedSkill = basicSkill;
                        await this.skillProcessor.execute(target, target);
                    } else {
                        await this.restoreCameraState();
                    }
                } else {
                    this.log("접근할 수 있는 빈 공간이 없거나 사선이 막혔습니다.", "log-bad");
                    this.showFloatingText(u, "Blocked", "#aaa");
                    this.triggerShakeAnimation(u);
                    await this.restoreCameraState();
                }
            }
        } else {
            this.log("사거리가 닿지 않거나 장애물에 막혔습니다.", "log-bad");
            this.showFloatingText(u, "막힘/사거리 외", "#aaa");
            this.triggerShakeAnimation(u);
            await this.restoreCameraState();
        }

        this.isProcessingTurn = false;
        this.updateFloatingControls(); 
    }
    
    checkBattleEnd() {
        if (this.isBattleEnded) return true;
        if (this.isPeaceful) return false;
        if (this.isTestMode) return false; 
        
        const enemies = this.units.filter(u => u.team === 1 && u.curHp > 0).length;
        const allies = this.units.filter(u => u.team === 0 && u.curHp > 0).length;

        if (allies === 0) {
            this.endBattleSequence(false);
            return true;
        }

        if (enemies === 0) {
            if (!this.isBattleWon) {
                this.isBattleWon = true;
                this.gainVictoryBonus();
                const stageKey = `${this.chapter}-${this.stage}`;
                const isFirstClear = !this.gameApp.gameState.clearedStages.includes(stageKey);
                
                if (isFirstClear) this.gameApp.gameState.clearedStages.push(stageKey);
                
                let baseReward = 100 * this.chapter;
                
                // ⭐ [수정] 징세(Tax Collect) 패시브 적용
                const taxCollectors = this.units.filter(u => u.team === 0 && u.curHp > 0 && u.skills && u.skills.some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_GOLD_GAIN')));
                if (taxCollectors.length > 0) {
                    let maxMultiplier = 1.0;
                    taxCollectors.forEach(u => {
                        const eff = u.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_GOLD_GAIN')).effects.find(e => e.type === 'PAS_GOLD_GAIN');
                        const mult = parseFloat(eff.val) || 1.3;
                        if (mult > maxMultiplier) maxMultiplier = mult;
                    });
                    baseReward = Math.floor(baseReward * maxMultiplier);
                }
                
                let rewardMsg = `💰 골드: +${baseReward}`;
                this.gameApp.gameState.gold += baseReward;

                if (isFirstClear) {
                    const bonusRenown = 30;
                    const bonusCoin = (this.stage % 5 === 0) ? 3 : 1; 
                    this.gameApp.gameState.renown += bonusRenown;
                    this.gameApp.gameState.ancientCoin += bonusCoin;
                    rewardMsg += `\n🎖️ 명성: +${bonusRenown} (최초 클리어)`;
                    rewardMsg += `\n🧿 고대 주화: +${bonusCoin}`;
                }

                this.gameApp.updateResourceDisplay();
                this.gameApp.saveGame();
                if (this.ui && typeof this.ui.hideAllCombatUI === 'function') {
                    this.ui.hideAllCombatUI();
                }

                setTimeout(() => {
                    const modal = document.getElementById('battle-result-modal');
                    const title = document.getElementById('battle-result-title');
                    const desc = document.getElementById('battle-result-desc');
                    const modalBtns = document.querySelector('.modal-btns');

                    title.textContent = "VICTORY!"; 
                    title.style.color = "gold";
                    desc.innerText = `적을 모두 물리쳤습니다!\n\n${rewardMsg}`;

                    modalBtns.innerHTML = `
                        <button id="btn-return-map" style="background:#2b5876; border-color:#66a;">월드맵으로 이동</button>
                        <button id="btn-explore" style="background:#2a8a4b; border-color:#5f5;">남아서 둘러보기</button>
                    `;

                    modal.style.display = 'flex';

                    document.getElementById('btn-return-map').onclick = () => { 
                        modal.style.display = 'none'; 
                        this.gameApp.proceedToNextStage(true); 
                        this.endBattleSequence(true); 
                    };

                    document.getElementById('btn-explore').onclick = () => {
                        modal.style.display = 'none';
                        this.gameApp.proceedToNextStage(true); 
                        this.activatePeaceMode(); 
                    };
                }, 500); 
            }
            return false;
        }
        return false;
    }

    broadcastAura(sourceUnit) {
        if (!sourceUnit || !sourceUnit.auraEffects || sourceUnit.curHp <= 0) return;
        this.units.forEach(u => {
            if (u.curHp > 0) this.updateAurasForUnit(u);
        });
    }

    updateAurasForUnit(unit) {
        if (!unit || unit.curHp <= 0) return;

        if (unit.buffs) {
            unit.buffs = unit.buffs.filter(b => {
                if (!b.isAura) return true; 
                const caster = this.units.find(u => u.id === b.casterId && u.curHp > 0 && u.isAuraSource);
                if (!caster) return false;
                const auraData = caster.auraEffects.find(a => a.type === b.type);
                if (!auraData) return false;
                return this.grid.getDistance(caster, unit) <= (auraData.area || 999);
            });
        }

        const auraSources = this.units.filter(u => u.auraEffects && u.curHp > 0);
        auraSources.forEach(source => {
            source.auraEffects.forEach(eff => {
                const dist = this.grid.getDistance(source, unit);
                if (dist <= (eff.area || 999)) {
                    const targetStr = String(eff.target || "").toUpperCase();
                    const isAlly = (source.team === unit.team);
                    
                    if ((targetStr.includes('적') || targetStr.includes('ENEMY')) && isAlly) return;
                    if ((targetStr.includes('아군') || targetStr.includes('ALLY')) && !isAlly) return;
                    
                    if (this.statusManager) {
                        this.statusManager.applyStatus(unit, {type: eff.type, val: eff.val, duration: 99, isAura: true}, source);
                    }
                }
            });
        });
    }

    activatePeaceMode() {
        this.isPeaceful = true;
        console.log("🕊️ 평화 모드 전환: 자유 이동 가능");
        if (this.ui && this.ui.updateSidebarMode) {
            this.ui.updateSidebarMode(true);
        }

        const firstHero = this.units.find(u => u.team === 0 && u.curHp > 0);
        if (firstHero) {
            this.currentUnit = firstHero;
            this.currentUnit.curAp = 999; 
            
            if (this.ui && this.ui.selectUnit) {
                this.ui.selectUnit(firstHero);
            } else {
                this.viewingUnit = firstHero;
                this.updateStatusPanel();
            }
        }
        this.updateFloatingControls();
    }
    
    destroy() {
        this.isBattleEnded = true;
        // ⭐ [버그 수정] destroy 함수 존재 여부 확인 후 안전하게 호출
        if (this.inputSystem && typeof this.inputSystem.destroy === 'function') {
            this.inputSystem.destroy();
        }
        this.cleanup();
    }

    endBattleSequence(victory, isSurrender = false) {
        if (this.isBattleEnded) return;
        this.isBattleEnded = true;
        this.isAutoBattle = false;
        this.isTestMode = false;
        
        // ⭐ [버그 수정] destroy 함수 존재 여부 확인 후 안전하게 호출
        if (this.inputSystem && typeof this.inputSystem.destroy === 'function') {
            this.inputSystem.destroy();
        }
        this.cleanup();
        
        const float = document.getElementById('floating-controls');
        if (float) float.remove();
        const overlayContainer = document.getElementById('unit-overlays');
        if (overlayContainer) overlayContainer.innerHTML = '';
        const sbPanel = document.getElementById('sandbox-panel');
        if (sbPanel) sbPanel.remove();

        setTimeout(() => {
            this.gameApp.onBattleEnd(victory, isSurrender);
        }, 1000);
    }

    resumeTime() {
        this.log(`⏳💥 멈췄던 시간이 다시 흐르기 시작합니다!`, 'log-system');
        this.activeTimeStop = null;
        
        this.units.forEach(u => {
            if (u.curHp > 0 && u._delayedDamage > 0) {
                const dmg = u._delayedDamage;
                u.curHp = Math.max(0, u.curHp - dmg);
                this.showFloatingText(u, `지연 피해 -${dmg}`, '#ff00ff');
                this.log(`💥 ${u.name}에게 누적된 ${dmg}의 피해가 한꺼번에 터집니다!`, 'log-dmg');
                u._delayedDamage = 0;
                this.triggerShakeAnimation(u);
                
                if (u.curHp <= 0) {
                    this.handleDeath(u);
                }
            }
        });
    }

    nextTurn() {
        if (this.checkBattleEnd()) return;
        
        // ⭐ 신규: 시간 정지 상태이면 행동 게이지(AG) 연산을 깡그리 무시하고 시전자가 연속 턴을 가짐
        if (this.activeTimeStop && this.activeTimeStop.remainingTurns > 0) {
            this.currentUnit = this.activeTimeStop.caster;
            if (this.currentUnit.curHp <= 0) {
                // 시전자가 사망했다면 즉시 시간 정지 해제
                this.resumeTime();
            } else {
                this.currentUnit.actionGauge = this.actionGaugeLimit;
                this.startTurnLogic();
                return;
            }
        }
        
        if (this.isPeaceful && !this.isTestMode) {
            this.currentUnit = this.units.find(u => u.team === 0); 
            this.startTurnLogic();
            return;
        }

        // ⭐ [수정] 즉각반응(Instant Reaction) 패시브 적용 (전투 개시 시 첫 턴 획득)
        if (this.globalTick === undefined) {
            this.globalTick = 0;
            const fastUnits = this.units.filter(u => u.curHp > 0 && u.skills && u.skills.some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_FIRST_TURN')));
            fastUnits.forEach(u => {
                u.actionGauge = this.actionGaugeLimit; 
                this.log(`⚡ [즉각반응] ${u.name}이(가) 누구보다 빠르게 움직입니다!`, 'log-skill');
            });
        }

        const speedCache = new Map();
        this.units.forEach(u => {
            if ((u.curHp > 0 || u.isIncapacitated) && !this.hasStatus(u, 'SHOCK') && !u.isFullyDead) {
                let spd = Formulas.getDerivedStat(u, 'spd');
                speedCache.set(u.id, spd <= 0 ? 1 : spd);
            }
        });

        let ready = [];
        let safetyCount = 0;

        while (true) {
            safetyCount++;
            if (safetyCount > 1000) { console.error("턴 계산 루프 오버플로우"); break; }

            ready = this.units.filter(u => (u.curHp > 0 || u.isIncapacitated) && !u.isFullyDead && u.actionGauge >= this.actionGaugeLimit - 0.001);
            if (ready.length > 0) break;

            let minTick = Infinity;
            this.units.forEach(u => {
                if (speedCache.has(u.id)) {
                    const spd = speedCache.get(u.id);
                    const needed = (this.actionGaugeLimit - u.actionGauge) / spd;
                    if (needed < minTick) minTick = needed;
                }
            });

            if (minTick === Infinity || minTick <= 0) minTick = 1;
            minTick = Math.max(0.1, minTick);

            if (!this.globalTick) this.globalTick = 0;
            this.globalTick += minTick;
            if (this.globalTick >= 100) {
                const passedRounds = Math.floor(this.globalTick / 100);
                this.globalTick %= 100;
                for (let i = 0; i < passedRounds; i++) {
                    if (this.environment && this.environment.processEnvironmentTurns) {
                        this.environment.processEnvironmentTurns();
                    }
                }
            }

            this.units.forEach(u => {
                if (speedCache.has(u.id)) {
                    u.actionGauge += speedCache.get(u.id) * minTick;
                }
            });
        }

        if (ready.length > 0) {
            ready.sort((a, b) => {
                if (Math.abs(b.actionGauge - a.actionGauge) > 0.001) {
                    return b.actionGauge - a.actionGauge; 
                }
                const spdA = Formulas.getDerivedStat(a, 'spd') || 1;
                const spdB = Formulas.getDerivedStat(b, 'spd') || 1;
                return spdB - spdA;
            });
            this.currentUnit = ready[0];
            if (this.currentUnit.actionGauge > this.actionGaugeLimit * 2) {
                this.currentUnit.actionGauge = this.actionGaugeLimit;
            }
            this.startTurnLogic();
        }
    }

    toggleHomunculusControl() {
        if (!this.currentUnit) return;
        
        let targetId = null;
        if (this.currentUnit.homunculusId) targetId = this.currentUnit.homunculusId;
        else if (this.currentUnit.ownerId) targetId = this.currentUnit.ownerId;

        if (!targetId) return;

        const targetUnit = this.units.find(u => u.id === targetId && u.curHp > 0);
        if (!targetUnit) {
            this.log("전환할 대상이 전장에 없습니다.", "log-bad");
            return;
        }

        // 현재 조작 중이던 유닛의 이동 상태 저장
        if (!this.sharedTurnStates) this.sharedTurnStates = {};
        this.sharedTurnStates[this.currentUnit.id] = { 
            moved: this.actions.moved, 
            realMoved: this.actions.realMoved 
        };

        // 타겟 유닛으로 조작권 스왑
        this.currentUnit = targetUnit;
        
        // 타겟 유닛의 기존 이동 상태 복구 (행동 상태는 공유됨)
        const targetState = this.sharedTurnStates[targetUnit.id] || { moved: false, realMoved: false };
        this.actions.moved = targetState.moved;
        this.actions.realMoved = targetState.realMoved;

        this.viewingUnit = this.currentUnit;
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.attackableHexes = [];
        this.expandedCategory = null; // ⭐ 카테고리 상태 초기화 (플로팅 스킬 사라짐 방지)
        
        this.log(`🔄 [의지 투사] 조작 대상이 ${this.currentUnit.name}(으)로 변경되었습니다.`, "log-system");
        
        this.centerCameraOnUnit(this.currentUnit);
        this.updateStatusPanel();
        this.updateFloatingControls();
        this.updateCursor();
        this.calcReachable();
    }
    // ⭐ [신규] 기획서 2번: 호문클루스 치환 (Transposition)
    executeTransposition() {
        const u1 = this.currentUnit;
        if (!u1) return;
        
        const targetId = u1.homunculusId || u1.ownerId;
        if (!targetId) return;
        
        const u2 = this.units.find(u => u.id === targetId && u.curHp > 0);
        if (!u2) return;

        // 기획: 이동력을 소모하여 바꾸므로 둘 중 하나라도 이번 턴에 이동을 마쳤다면 사용 불가
        if (this.actions.moved || (this.sharedTurnStates && this.sharedTurnStates[u2.id] && this.sharedTurnStates[u2.id].moved)) {
            this.log("이미 이동력을 소모하여 치환할 수 없습니다.", "log-bad");
            this.showFloatingText(u1, "이동력 부족", "#aaa");
            return;
        }

        // 1. 좌표 맞교환
        const tempQ = u1.q; const tempR = u1.r;
        u1.q = u2.q; u1.r = u2.r;
        u2.q = tempQ; u2.r = tempR;

        // 2. 이동력 소모 처리 (치환 후에는 둘 다 걷기 불가, 행동은 가능)
        this.actions.moved = true;
        this.actions.realMoved = true;
        if (!this.sharedTurnStates) this.sharedTurnStates = {};
        this.sharedTurnStates[u1.id] = { moved: true, realMoved: true };
        this.sharedTurnStates[u2.id] = { moved: true, realMoved: true };

        // 3. 연출 및 상태창 갱신
        this.log(`🌌 [치환] ${u1.name}와(과) 호문클루스가 시공간을 가르고 위치를 바꿨습니다!`, "log-skill");
        this.triggerShakeAnimation(u1);
        this.triggerShakeAnimation(u2);
        
        if (this.cameraManager && this.cameraManager.updateUnitOverlayPosition) {
            this.cameraManager.updateUnitOverlayPosition(u1);
            this.cameraManager.updateUnitOverlayPosition(u2);
        }
        
        this.calcReachable();
        this.updateStatusPanel();
        this.centerCameraOnUnit(u1);
    }

    async startTurnLogic() { // ⭐ 함수 앞에 반드시 async를 붙여주세요!
        if (!this.currentUnit) {
            if (!this.isPeaceful && !this.isBattleEnded && !this.isTestMode) this.checkBattleEnd(); 
            return;
        }

        // =========================================================
        // ⭐ [신규 추가] 턴이 시작되면 대상을 향해 카메라를 부드럽게 이동합니다.
        // =========================================================
        if (!this.isPeaceful) { // 평화 모드(마을 등)가 아닐 때만 작동
            if (this.smoothCenterCameraOnUnit) {
                await this.smoothCenterCameraOnUnit(this.currentUnit, 300);
                await new Promise(r => setTimeout(r, 150)); // 카메라 이동 후 잠시 대기
            } else if (this.centerCameraOnUnit) {
                this.centerCameraOnUnit(this.currentUnit);
            }
        }

        if (this.currentUnit.curHp <= 0) { this.endTurn(); return; }
        
        // ⭐ [수정] 밤의 가호(Night's Grace) 패시브 적용... (이하 생략)
        const nightPassive = (this.currentUnit.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ATNIGHT'));
        if (nightPassive) {
            const isDarkTile = this.grid && this.grid.getTerrainData(this.currentUnit.q, this.currentUnit.r).key.includes('DARK');
            if (this.isNight || isDarkTile) {
                const eff = nightPassive.effects.find(e => e.type === 'PAS_ATNIGHT');
                const statBoost = parseFloat(eff.val) || 1.3;
                if (!this.hasStatus(this.currentUnit, 'BUFF_NIGHT_GRACE')) {
                    this.showFloatingText(this.currentUnit, "밤의 가호!", "#7b68ee");
                    this.currentUnit.buffs.push({ type: 'BUFF_NIGHT_GRACE', duration: 1, val: statBoost, icon: '🌙', name: '밤의 가호', isNew: true });
                }
            }
        }

        // ⭐ 1. 캐스팅(차징) 중일 때 남은 턴 수를 확실하게 표시하도록 수정
        if (this.currentUnit.isCharging && this.currentUnit.chargingSkill) {
            this.currentUnit.chargeTurnLimit -= 1;
            
            if (this.currentUnit.chargeTurnLimit <= 0) {
                this.log(`💥 ${this.currentUnit.name}의 [${this.currentUnit.chargingSkill.name}] 발동!`, 'log-skill');
                this.showFloatingText(this.currentUnit, "CAST!", "#ff0000");
                this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b.type !== 'BUFF_CASTING');
                this.currentUnit.isCharging = false;
                const skillToCast = this.currentUnit.chargingSkill;
                skillToCast._isChargeCompleted = true; 
                skillToCast.cost = 0; 
                skillToCast.mp = 0;   
                
                this.currentUnit.chargingSkill = null;
                this.selectedSkill = skillToCast;
                this.skillProcessor.execute(this.currentUnit, this.currentUnit).then(() => {
                    this.actions.acted = true;
                    this.endTurn(); 
                });
                return; 
            } 
            else {
                this.showFloatingText(this.currentUnit, `캐스팅... (${this.currentUnit.chargeTurnLimit}턴 남음)`, "#ffff00");
                this.log(`⏳ ${this.currentUnit.name}이(가) [${this.currentUnit.chargingSkill.name}] 시전을 위해 집중하고 있습니다. (발동까지: ${this.currentUnit.chargeTurnLimit}턴)`, 'log-system');
                this.actions.acted = true; 
                this.actions.moved = true; 
                this.currentUnit.actionGauge -= 50; 
                setTimeout(() => this.endTurn(), 800);
                return; 
            }
        }
        
        const channelBuff = this.currentUnit.buffs.find(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
        if (channelBuff) {
            this.currentUnit.isAuraSource = true;
            this.currentUnit.auraEffects = [{ 
                type: channelBuff.type.replace('CHANNELED_', 'STAT_'), 
                val: channelBuff.val, 
                area: channelBuff.area || 999, 
                target: channelBuff.type.startsWith('BUFF') ? 'ALLY_ALL' : 'ENEMY_ALL' 
            }];
            this.updateAurasForUnit(this.currentUnit);
            
        } else if (this.currentUnit.isAuraSource && (this.currentUnit.job === '음유시인' || this.currentUnit.job === '무희' || this.currentUnit.classKey?.includes('BRD'))) {
            this.currentUnit.isAuraSource = false;
            this.currentUnit.auraEffects = [];
        }

        // ⭐ 2. 채널링(오라/연주/춤) 중일 때 남은 턴 수 및 유지 상태를 명확히 표시하도록 수정
        if (channelBuff) {
            let cost = 15; 
            if (channelBuff.maintainCount === undefined) channelBuff.maintainCount = 0;
            channelBuff.maintainCount++; 
            if (channelBuff.maintainCount >= 2) {
                cost = Math.floor(cost * 0.5); 
            }

            if (this.currentUnit.skills) {
                const reducePassive = this.currentUnit.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MP_COST_RED_CHANT' || e.type === 'PAS_MP_COST_RED_DANCE'));
                const incPassive = this.currentUnit.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MP_COST_INC'));
                if (reducePassive) cost = Math.floor(cost * 0.8); 
                if (incPassive) cost = Math.floor(cost * 1.5);    
            }
            
            if (this.hasStatus(this.currentUnit, 'BUFF_ENCORE_FREE')) {
                cost = 0;
                this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b.type !== 'BUFF_ENCORE_FREE');
                this.showFloatingText(this.currentUnit, "앙코르! (MP 0)", "#ffdd00");
                this.log(`👏 앙코르 효과로 이번 턴의 연주 유지비가 소모되지 않습니다!`, 'log-skill');
            }
            
            if (this.currentUnit.curMp >= cost) {
                if (cost > 0) {
                    this.currentUnit.curMp -= cost;
                }
                
                // 채널링 남은 턴수 계산 (99 등 영구 지속은 마력 고갈 시까지로 표기)
                let remainText = channelBuff.duration > 50 ? "마력 고갈 시까지" : `${channelBuff.duration}턴 남음`;
                
                this.showFloatingText(this.currentUnit, `유지 중 (${remainText})`, '#55ccff');
                this.log(`🎶 ${this.currentUnit.name} 연주/춤 유지 중... (남은 시간: ${remainText}, MP -${cost})`, 'log-skill');
                
                if (!this.hasStatus(this.currentUnit, 'SYS_MAXIMIZE_CHANT')) {
                    this.actions.acted = true; 
                    this.actions.moved = true; 
                } else {
                    this.log(`🔔 영원의 메아리 효과로 ${this.currentUnit.name}은(는) 자유롭게 행동할 수 있습니다!`, 'log-skill');
                }
                
            } else {
                this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b !== channelBuff);
                this.showFloatingText(this.currentUnit, "Song Ended", "#aaa");
                this.log(`마력이 고갈되어 노래가 중단되었습니다.`, 'log-bad');
                this.currentUnit.isAuraSource = false;
                this.currentUnit.auraEffects = [];
                if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
            }
        }

        if (this.grid) {
            const tData = this.grid.getTerrainData(this.currentUnit.q, this.currentUnit.r);
            const tInfo = TERRAIN_TYPES[tData.key];

            if (tInfo && tInfo.effect) {
                const eff = tInfo.effect;
                
                if (eff.type.startsWith('DMG_')) {
                    const dmg = Math.floor(this.currentUnit.hp * (eff.val / 100));
                    this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                    this.showFloatingText(this.currentUnit, `-${dmg}`, '#ff4400');
                    this.log(`🌋 ${tInfo.name}의 효과로 ${dmg} 피해!`, 'log-dmg');
                    this.triggerShakeAnimation(this.currentUnit);
                }
                else if (eff.type === 'HEAL_PCT') {
                    const heal = Math.floor(this.currentUnit.hp * (eff.val / 100));
                    this.currentUnit.curHp = Math.min(this.currentUnit.hp, this.currentUnit.curHp + heal);
                    this.showFloatingText(this.currentUnit, `+${heal}`, '#00ff00');
                    this.log(`✨ ${tInfo.name}의 기운으로 회복합니다.`, 'log-heal');
                }
                else if (eff.type === 'APPLY_STATUS') {
                    if (this.skillProcessor && this.statusManager) {
                        this.statusManager.applyStatus(this.currentUnit, { 
                            type: eff.status, duration: 2, val: 1 
                        }, null); 
                    }
                }
            }
        }

        if (this.currentUnit.isWall || this.currentUnit.spd === 0) {
            this.currentUnit.actionGauge -= 100;
            this.endTurn();
            return;
        }

        const auraSources = this.units.filter(u => u.auraEffects && u.curHp > 0);
        auraSources.forEach(source => {
            source.auraEffects.forEach(eff => {
                const dist = this.grid.getDistance(source, this.currentUnit);
                if (dist <= (eff.area || 0)) {
                    const targetStr = String(eff.target || "").toUpperCase();
                    const isAlly = (source.team === this.currentUnit.team);
                    
                    if ((targetStr.includes('적') || targetStr.includes('ENEMY')) && isAlly) return;
                    if ((targetStr.includes('아군') || targetStr.includes('ALLY')) && !isAlly) return;
                    
                    if (this.statusManager) this.statusManager.applyStatus(this.currentUnit, {type: eff.type, val: eff.val, duration: eff.dur || 1}, source);
                }
            });
        });

        const mySummons = this.units.filter(u => u.casterId === this.currentUnit.id && u.curHp > 0);
        mySummons.forEach(summon => {
            if (summon.lifespan !== undefined) {
                summon.lifespan -= 1;
                if (summon.lifespan <= 0) {
                    summon.curHp = 0; 
                    summon._isNaturalDeath = true; 
                    this.log(`${summon.name}이(가) 유지 시간을 다해 소멸했습니다.`, "log-system");
                    this.handleDeath(summon);
                }
            }
        });

        if (this.currentUnit.curHp <= 0) { 
            // ⭐ [전투불능] 유예 턴 소모 로직
            if (this.currentUnit.isIncapacitated && !this.currentUnit.isFullyDead) {
                this.currentUnit.deathTimer--;
                if (this.currentUnit.deathTimer <= 0) {
                    this.log(`☠️ ${this.currentUnit.name}의 숨이 완전히 멎었습니다... (완전 사망)`, 'log-bad');
                    this.currentUnit.isFullyDead = true;
                    this.currentUnit.isIncapacitated = false;
                    this.handleDeath(this.currentUnit);
                } else {
                    this.showFloatingText(this.currentUnit, `사망까지 ${this.currentUnit.deathTimer}턴`, '#777');
                    this.log(`⏳ ${this.currentUnit.name}의 의식이 흐려집니다. (완전 사망까지 ${this.currentUnit.deathTimer}턴 남음)`, 'log-system');
                    this.currentUnit.actionGauge = 0; // 턴 넘김
                }
                this.endTurn();
                return;
            } else {
                this.handleDeath(this.currentUnit); 
                this.endTurn(); 
                return; 
            }
        }

        this.isProcessingTurn = true;
        if (!this.isPeaceful) {
            this.log(`▶ ${this.currentUnit.name}의 턴`, 'log-turn');
        }
        
        this.regenResources(this.currentUnit);
        this.viewingUnit = this.currentUnit;
        
        this.actions = { moved: false, acted: false, realMoved: false };
        this.sharedTurnStates = {}; 
        
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.attackableHexes = []; 
        this.expandedCategory = null; 

        if (this.currentUnit.skills) {
            const gaugePassive = this.currentUnit.skills.find(s => 
                s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PASSIVE_GAUGE')
            );
            if (gaugePassive) this.currentUnit.actionGauge += 10; 
        }

        let skipTurn = false;

        if (this.statusManager && this.statusManager.isIncapacitated(this.currentUnit)) {
            this.log(`${this.currentUnit.name}: [행동 불가] 턴을 넘깁니다.`, 'log-cc');
            this.showFloatingText(this.currentUnit, "행동 불가", '#ff00ff');
            skipTurn = true;
        }
        
        for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
            const b = this.currentUnit.buffs[i];
            const info = EFFECTS[b.type] || { name: b.type };
            const bType = b.type.toUpperCase();

            if (bType.includes('POLYMORPH')) {
                this.log(`${this.currentUnit.name}: 🐑 메에에~`, 'log-cc');
                this.showFloatingText(this.currentUnit, "Meee~", "#fff");
                this.actions.acted = true; 
            }
            else if (bType.includes('BURN') || bType.includes('POISON') || bType.includes('BLEED') || bType.includes('CURSE')) {
                const dmg = Formulas.calculateDotDamage(this.currentUnit, bType, b.val);
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                
                let color = '#ff8800';
                if (bType.includes('POISON')) color = '#88ff00';
                if (bType.includes('BLEED')) color = '#ff0000';

                this.log(`💥 ${info.name}: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, color);
            }
            else if (bType.includes('REGEN_MP')) { 
                const mpAmt = b.val ? parseFloat(b.val) : 10;
                this.currentUnit.curMp = Math.min(this.currentUnit.mp, this.currentUnit.curMp + mpAmt);
                this.showFloatingText(this.currentUnit, `+${mpAmt} MP`, '#55ccff');
                this.log(`🌌 마력 재생: +${mpAmt} MP`, 'log-heal');
            }
            else if (bType.includes('REGEN')) {
                const healAmt = Math.floor(this.currentUnit.hp * 0.1 * (b.val || 1));
                this.currentUnit.curHp = Math.min(this.currentUnit.hp, this.currentUnit.curHp + healAmt);
                this.showFloatingText(this.currentUnit, `+${healAmt}`, '#5f5');
                this.log(`🌿 재생: +${healAmt}`, 'log-heal');
            }
        }

        if (this.currentUnit.curHp <= 0) { 
            this.handleDeath(this.currentUnit); 
            this.endTurn(); 
            return; 
        }

        if (skipTurn) { 
            this.updateStatusPanel(); 
            this.renderPartyList(); 
            this.currentUnit.actionGauge -= 50; 
            setTimeout(() => this.endTurn(), 800); 
            return; 
        }

        if (this.hasStatus(this.currentUnit, 'SHOCK')) {
             this.log("⚡ 감전 상태! 행동력 회복 불가.", "log-cc");
        }

        // ⭐ 수정: 턴 시작 시 이동 모드를 끄고 이동 타일을 미리 그리지 않습니다.
        this.isMovingMode = false;
        this.reachableHexes = []; 
        
        if (Formulas.getDerivedStat(this.currentUnit, 'mov') <= 0) {
            this.actions.moved = true; 
            this.log("이동 불가 상태.");
        }

        this.updateStatusPanel();
        this.renderPartyList();
        this.updateCursor();
        
        if (this.isTestMode && this.currentUnit.team === 1 && !this.isAutoBattle) {
            this.isProcessingTurn = false; 
            this.renderUI();
            this.updateFloatingControls();
            this.log("🔴 적군 수동 조작 모드", "log-system");
        } else {
            const controlState = this.statusManager ? this.statusManager.getControlState(this.currentUnit) : 'NORMAL';
            
            const isAutoSummon = this.currentUnit.key === 'GOLEM' || (this.currentUnit.type === 'SUMMON' && !this.currentUnit.ownerId);

            if (controlState !== 'NORMAL') {
                this.log(`😵 ${this.currentUnit.name} 통제 불능 상태! (강제 조작)`, 'log-cc');
                this.aiSystem.runEnemyTurn(); 
            } else if (this.currentUnit.team === 1 || (this.currentUnit.team === 0 && isAutoSummon)) {
                if (this.currentUnit.team === 0 && isAutoSummon) {
                    this.log(`🤖 [자동 행동] ${this.currentUnit.name}이(가) 본능에 따라 적을 추적합니다.`, 'log-system');
                }
                this.aiSystem.runEnemyTurn(); 
            } else {
                this.isProcessingTurn = false; 
                this.renderUI();
                this.updateFloatingControls();
                if (this.isAutoBattle) setTimeout(() => this.aiSystem.runAllyAuto(), 300);
            }
        }
    }
    // ⭐ [신규] 카테고리 클릭 시 열림/닫힘 상태를 토글하는 함수
    toggleCategory(catName) {
        if (this.expandedCategory === catName) {
            this.expandedCategory = null; // 이미 열려있으면 닫기
        } else {
            this.expandedCategory = catName; // 아니면 열기
        }
        if (this.ui) this.ui.updateFloatingControls();
    }

    enterMoveMode() {
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.moved) return;

        if (this.isMovingMode) {
            this.isMovingMode = false;
            this.reachableHexes = [];
            this.log("이동 취소", "log-system");
        } else {
            this.selectedSkill = null;
            this.confirmingSkill = null;
            this.isMovingMode = true;
            this.attackableHexes = []; 
            this.calcReachable(); 
            this.log("이동할 위치를 선택하세요.", "log-system");
        }
        
        this.updateCursor();
        if (this.ui) {
            this.ui.updateFloatingControls();
            if (this.ui.updateRightPanel) this.ui.updateRightPanel([], null); // 이동 모드 진입 시 우측 패널 비우기
        }
    }

    selectSkillFromFloat(sId) {
        const u = this.currentUnit;
        if (!u || this.actions.acted) return;
        
        this.isMovingMode = false;
        this.reachableHexes = [];
        
        if (this.ui && this.ui.updateRightPanel) this.ui.updateRightPanel([], null); // 스킬 조준 진입 시 우측 패널 비우기

        if (sId === 'basic') {
            const basicId = u.equippedBasic || '1000';
            let rawBasic = u.skills.find(s => s.id === basicId);
            
            if (!rawBasic && typeof SKILL_DATABASE !== 'undefined') {
                rawBasic = SKILL_DATABASE[basicId];
            }
            
            if (!rawBasic) {
                rawBasic = {
                    id: '1000', name: '기본 공격', type: 'ACTIVE', target: 'ENEMY_SINGLE', 
                    cost: 80, mp: 0, rng: Formulas.getDerivedStat(u, 'rng') || 1, area: 0, 
                    effects: [{target: 'ENEMY_SINGLE', type: 'DMG_PHYS', val: 1, rng: Formulas.getDerivedStat(u, 'rng') || 1, prob: 100}]
                };
            }

            if (this.selectedSkill && this.selectedSkill.id === rawBasic.id) {
                this.selectedSkill = null;
                this.attackableHexes = [];
            } else {
                this.selectedSkill = JSON.parse(JSON.stringify(rawBasic)); 
                this.attackableHexes = this.rangeManager.getAttackableHexes(u, this.selectedSkill);
                this.log(`[${this.selectedSkill.name}] 조준... (타겟을 클릭하세요)`, 'log-system');
            }

            this.updateFloatingControls(); this.updateStatusPanel(); this.updateCursor();
            return;
        }

        const rawSkill = u.skills.find(s => s.id === sId);
        if (!rawSkill) return;

        if (u.curMp < rawSkill.mp) { this.log("마나가 부족합니다.", "log-system"); return; }

        if (this.selectedSkill && this.selectedSkill.id === rawSkill.id) {
            this.selectedSkill = null;
            this.attackableHexes = []; 
        }
        else { 
            this.selectedSkill = JSON.parse(JSON.stringify(rawSkill));
            const tType = String(this.selectedSkill.target || 'ENEMY').toUpperCase().trim();
            const rng = parseInt(this.selectedSkill.rng) || 0;
            const area = parseInt(this.selectedSkill.area) || 0;
            const areaStr = String(this.selectedSkill.area || '0').toUpperCase();
            const isDirectional = areaStr.includes('CLEAVE') || areaStr.includes('CONE') || areaStr.includes('LINE');

            const isAutoTarget = ['SELF', 'GLOBAL', 'ALLY_ALL', 'ENEMY_ALL', 'AREA_ALL'].includes(tType) || 
                                 (tType === 'AREA_ENEMY' && area >= 99) || 
                                 (rng === 0 && !isDirectional);

            if (isAutoTarget) {
                this.confirmingSkill = this.selectedSkill; 
                this.hoverHex = { q: u.q, r: u.r }; 
                this.attackableHexes = []; 
            } else {
                this.confirmingSkill = null;
                this.attackableHexes = this.rangeManager.getAttackableHexes(u, this.selectedSkill);
                this.log(`[${this.selectedSkill.name}] 조준... (타겟을 클릭하세요)`, 'log-system'); 
            }
        }

        this.updateFloatingControls(); this.updateStatusPanel(); this.updateCursor();
    }

    cancelAction() {
        const u = this.currentUnit;
        if (!u || this.actions.acted) return;
        
        const cancelPassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
        
        if (cancelPassive && this.selectedSkill) {
            const refundAmt = 30; 
            u.actionGauge = Math.min(this.actionGaugeLimit, u.actionGauge + refundAmt);
            this.showFloatingText(u, `WT +${refundAmt}`, '#00ffff');
            this.log(`🔁 [잔상/다 카포] 스킬 취소로 행동력이 일부 회복되었습니다.`, 'log-skill');
        }
        
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.confirmingItemSlot = null;
        this.hoverHex = null;
        this.teleportTarget = null; 
        this.expandedCategory = null; 
        
        this.isMovingMode = false;
        this.reachableHexes = [];
        this.attackableHexes = [];
        
        this.restoreCameraState(200);
        
        if (this.ui) {
            this.ui.updateFloatingControls();
            this.ui.updateStatusPanel();
            this.ui.updateCursor();
            if (this.ui.updateRightPanel) this.ui.updateRightPanel([], null); // 취소 시 우측 패널도 확실하게 비우기
        }
    }

    endTurn(manual = false) { 
        const f = document.getElementById('floating-controls'); 
        if(f) f.classList.add('hud-hidden'); 

        this.teleportTarget = null; 

        // ⭐ 신규: 턴이 끝날 때, 현재 유닛이 시간 정지 시전자라면 턴 카운트를 차감
        if (this.activeTimeStop && this.activeTimeStop.caster === this.currentUnit) {
            this.activeTimeStop.remainingTurns--;
            if (this.activeTimeStop.remainingTurns <= 0) {
                this.resumeTime(); // 2회가 끝나면 시간정지 해제
            }
        }

        if (this.currentUnit && (this.currentUnit.type === 'OBJECT' || this.currentUnit.isWall || (this.currentUnit.key && this.currentUnit.key.includes('ZONE')))) {
            this.currentUnit.actionGauge = 0; 
            this.actions = { moved: false, acted: false, realMoved: false };
            setTimeout(() => this.nextTurn(), 50); 
            return; 
        }

        if (!this.actions.realMoved && !this.actions.acted && this.hasStatus(this.currentUnit, 'STAT_BLEED')) {
            if (Math.random() < 0.5) { // 50% 확률
            this.currentUnit.buffs = this.currentUnit.buffs.filter(b => 
            (this.statusManager ? this.statusManager.normalizeAilment(b.type) : b.type) !== 'STAT_BLEED'
            );
            this.showFloatingText(this.currentUnit, "자연 지혈됨", "#fff");
            this.log(`🩸 ${this.currentUnit.name}의 상처가 지혈되었습니다.`, 'log-system');
            }
        }

        const hasBurn = this.hasStatus(this.currentUnit, 'STAT_BURN');
        const hasFreeze = this.hasStatus(this.currentUnit, 'STAT_FREEZE');
        
        if (hasBurn || hasFreeze) {
            const neighbors = this.grid.getNeighbors(this.currentUnit);
            for(const n of neighbors) {
                const adjUnit = this.getUnitAt(n.q, n.r);
                if (adjUnit) {
                    if (hasBurn && this.hasStatus(adjUnit, 'STAT_FREEZE')) {
                        this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b.type !== 'STAT_BURN');
                        adjUnit.buffs = adjUnit.buffs.filter(b => b.type !== 'STAT_FREEZE');
                        this.showFloatingText(this.currentUnit, "Melted", "#aef");
                    } 
                    else if (hasFreeze && this.hasStatus(adjUnit, 'STAT_BURN')) {
                        this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b.type !== 'STAT_FREEZE');
                        adjUnit.buffs = adjUnit.buffs.filter(b => b.type !== 'STAT_BURN');
                        this.showFloatingText(this.currentUnit, "Melted", "#aef");
                    }
                    else if (hasBurn && !this.hasStatus(adjUnit, 'STAT_BURN') && !this.hasStatus(adjUnit, 'STAT_PETRIFY') && Math.random() < 0.5) {
                        if (this.statusManager) this.statusManager.applyStatus(adjUnit, {type: 'STAT_BURN', val: 1}, this.currentUnit);
                        this.log(`🔥 불길이 ${adjUnit.name}에게 옮겨붙었습니다!`, 'log-dmg');
                    }
                }
            }
        }
        
        if (this.isPeaceful && !this.isTestMode) {
            this.actions = { moved: false, acted: false, realMoved: false };
            this.isProcessingTurn = false;
            this.updateStatusPanel();
            this.renderPartyList();
            this.updateCursor();
            if (this.currentUnit) this.centerCameraOnUnit(this.currentUnit);
            return;
        }
        
        const isChanneling = this.currentUnit && this.currentUnit.buffs && this.currentUnit.buffs.some(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
        const isCharging = this.currentUnit && this.currentUnit.isCharging;

        if (isChanneling || isCharging) {
            this.actions.moved = true;
            this.actions.realMoved = true;
            this.actions.acted = true;
        }

        const didMove = this.actions.realMoved || this.actions.moved || false; 
        const didAct = this.actions.acted || false;

        let cost = 100; 
        let logMsg = "";

        if (isChanneling) {
            cost = 100;
            logMsg = "연주/춤 유지 (턴 온전 소모)";
        } else if (isCharging) {
            cost = 100;
            logMsg = "캐스팅 집중 (턴 온전 소모)";
        } else if (!didMove && !didAct) {
            cost = 50;
            logMsg = "대기 (WT 50% 반환)";
        } else if (didMove && !didAct) {
            cost = 75;
            logMsg = "이동 후 대기 (WT 25% 반환)";
        } else if (!didMove && didAct) {
            cost = 75;
            logMsg = "제자리 행동 (WT 25% 반환)";
        } else {
            cost = 100;
            logMsg = "행동 완료";
        }

        this.currentUnit.actionGauge -= cost;
        this.log(`${this.currentUnit.name} ${logMsg} (-${cost} AG)`, 'log-system');

        const partnerId = this.currentUnit.homunculusId || this.currentUnit.ownerId;
        if (partnerId) {
            const partner = this.units.find(u => u.id === partnerId && u.curHp > 0);
            if (partner) {
                partner.actionGauge = this.currentUnit.actionGauge; 
                partner.curMp = this.currentUnit.curMp;             
                
                if (this.currentUnit.curMp <= 0) {
                    const homun = this.currentUnit.homunculusId ? partner : this.currentUnit;
                    const owner = this.currentUnit.homunculusId ? this.currentUnit : partner;
                    
                    this.log(`🌌 마력이 고갈되어 호문클루스가 소멸합니다!`, "log-bad");
                    homun.curHp = 0;
                    if (this.handleDeath) this.handleDeath(homun);
                    if (this.skillProcessor) this.skillProcessor.applyStatus(owner, {type: 'CC_STUN', duration: 1, val: 1});
                }
            }
        }

        if (this.currentUnit && this.currentUnit.curHp > 0 && this.currentUnit.skills) {
            
            const passives = this.currentUnit.skills.filter(s => s.type === 'PASSIVE' && s.effects && s.effects.length > 0);

            for (const passive of passives) {
                const trigger = passive.effects[0]; 
                const actions = passive.effects.slice(1); 

                if (trigger.type === 'PAS_TURNEND') {
                    const prob = parseFloat(trigger.prob) || 100;
                    if (Math.random() * 100 <= prob) {
                        if (actions.length > 0) {
                            
                            const flavorTexts = {
                                '이지스의 가호': `🛡️ [이지스의 가호] 성스러운 기운이 ${this.currentUnit.name}의 상처를 감싸며 치유합니다!`,
                                '영감': `💡 [영감] ${this.currentUnit.name}의 머릿속에 새로운 선율이 떠올라 마력을 채웁니다!`,
                                '도발': `🤬 [도발] ${this.currentUnit.name}이(가) 거칠게 무기를 부딪히며 적들의 시선을 자신에게 집중시킵니다!`,
                                '무아지경': `🧘 [무아지경] ${this.currentUnit.name}이(가) 깊은 호흡과 함께 다음 행동을 날카롭게 준비합니다!`
                            };

                            let logMsg = flavorTexts[passive.name];
                            if (!logMsg) {
                                logMsg = `✨ [${passive.name}] ${passive.desc || '패시브 효과가 발동했습니다.'}`;
                            }

                            this.log(logMsg, 'log-skill');

                            for (const act of actions) {
                                if (this.skillProcessor) this.skillProcessor.processEffect(act, this.currentUnit, this.currentUnit, this.currentUnit, {}, passive);
                            }
                        }
                    }
                }

                if (trigger.type === 'PAS_WAIT_BONUS' && !didAct && !didMove) {
                    const prob = parseFloat(trigger.prob) || 100;
                    if (Math.random() * 100 <= prob) {
                        this.log(`⏸️ [${passive.name}] ${this.currentUnit.name}이(가) 숨을 고르며 태세를 정비합니다!`, 'log-skill');
                        for (const act of actions) {
                            if (this.skillProcessor) this.skillProcessor.processEffect(act, this.currentUnit, this.currentUnit, this.currentUnit, {}, passive);
                        }
                    }
                }
            }

            const encorePassive = this.currentUnit.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLECAST'));
            if (encorePassive && didAct && this.selectedSkill && this.selectedSkill.mp > 0) {
                const isChantSkill = this.selectedSkill.effects && this.selectedSkill.effects.some(e => e.type.includes('CHANNELED') || e.type === 'SYS_CHARGE');
                if (isChantSkill) {
                    const prob = parseFloat(encorePassive.effects[0].prob) || 30; 
                    if (Math.random() * 100 <= prob) {
                        this.log(`👏 [앙코르] 관객들의 환호가 쏟아집니다! 다음 턴 마나가 소모되지 않습니다!`, 'log-skill');
                        if (this.statusManager) {
                            this.statusManager.applyStatus(this.currentUnit, { type: 'BUFF_ENCORE_FREE', val: 0, duration: 2, icon: '👏', name: '앙코르' }, this.currentUnit);
                        }
                    }
                }
            }
        }

        this.actions = { moved: false, acted: false, realMoved: false };

        // ⭐ [신규 반영] 도적의 극의: 턴 종료 시 훔친 스킬 수명 차감 및 만료 시 자동 삭제
        if (this.currentUnit && this.currentUnit.skills) {
            let lostStolen = false;
            this.currentUnit.skills = this.currentUnit.skills.filter(s => {
                if (s.isStolen) {
                    s.stolenDuration--;
                    if (s.stolenDuration <= 0) {
                        this.log(`💨 시간이 지나 훔쳐온 [${s.name}] 스킬의 기억이 흩어집니다.`, 'log-system');
                        lostStolen = true;
                        return false; 
                    }
                }
                return true;
            });
            if (lostStolen && this.ui) this.ui.updateFloatingControls();
        }

        if (this.currentUnit && this.currentUnit.buffs) {
            for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
                const b = this.currentUnit.buffs[i];
                
                if (b.isAura) continue; 

                if (b.isNew) {
                    b.isNew = false; 
                } else {
                    b.duration--;
                    if (b.duration <= 0) {
                        const removedBuff = this.currentUnit.buffs.splice(i, 1)[0];
                        
                        if (removedBuff.type.startsWith('BUFF_CHANNELED') || removedBuff.type.startsWith('DEBUFF_CHANNELED')) {
                            this.currentUnit.isAuraSource = false; 
                            this.currentUnit.auraEffects = [];     
                            
                            this.showFloatingText(this.currentUnit, "연주 완료", "#aaa");
                            this.log(`🎵 ${this.currentUnit.name}의 연주가 끝났습니다.`, "log-system");
                            
                            if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
                            if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                        }

                        if (this.statusManager && this.statusManager.normalizeAilment(removedBuff.type) === 'STAT_PETRIFY') {
                            this.currentUnit.isWall = false;
                            this.showFloatingText(this.currentUnit, "석화 풀림!", "#aaaaaa");
                            this.log(`🗿 ${this.currentUnit.name}의 석화가 풀려 원래 모습으로 돌아왔습니다.`, 'log-system');
                        }
                    }
                }
            }
        }

        this.units = this.units.filter(u => {
            if (u.curHp > 0) return true;
            if (!u.casterId && u.type !== 'OBJECT' && !u.isWall && !u.isAuraSource) return true;
            return false;
        });

        setTimeout(() => this.nextTurn(), 100); 
    }
    
    onTurnEndClick() {
        this.endTurn();
    }

    showStageTitle() {
        const stageData = STAGE_DATA[this.chapter]?.[this.stage];
        let mapKey = `${this.chapter}-${this.stage}`;
        if (typeof this.stage === 'string' || isNaN(Number(this.stage))) {
            mapKey = this.stage;
        }

        const info = MAP_NAMES[mapKey] || { title: `Unknown Area`, subtitle: `Stage ${mapKey}` };
        const overlay = document.getElementById('stage-title-overlay');
        const mainTitle = document.getElementById('stage-main-title');
        const subTitle = document.getElementById('stage-sub-title');

        if (!overlay || !mainTitle) return;

        mainTitle.textContent = info.title;
        subTitle.textContent = info.subtitle;

        overlay.classList.remove('hidden', 'show');
        void overlay.offsetWidth; 
        overlay.classList.add('show');

        setTimeout(() => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.classList.add('hidden'), 1000); 
        }, 4000);
    }
    
    getUnitAt(q, r) { return this.units.find(u => u.q === q && u.r === r && (u.curHp > 0 || u.isIncapacitated)); }
    hasStatus(unit, type) { 
        if (this.statusManager) return this.statusManager.hasStatus(unit, type);
        return unit.buffs && unit.buffs.some(b => b.type === type); 
    }
    
    log(msg, type) { this.ui.log(msg, type); }
    showFloatingText(u, txt, col) { this.ui.showFloatingText(u, txt, col); }
    showSpeechBubble(unit, text, duration = 3000) {
        if (!unit) return;
        if (unit.speechTimer) clearTimeout(unit.speechTimer);
        unit.speechText = text; 
        if (this.ui) this.ui.renderUnitOverlays(); 
        unit.speechTimer = setTimeout(() => {
            unit.speechText = null; unit.speechTimer = null;
            if (this.ui) this.ui.renderUnitOverlays(); 
        }, duration);
    }
    showUnitTooltip(e, u) { this.ui.showUnitTooltip(e, u); }
    showTooltip(e, html) { this.ui.showTooltip(e, html); }
    hideTooltip() { this.ui.hideTooltip(); }
    allocateStat(k) { this.ui.allocateStat(k); }
    updateStatusPanel() { this.ui.updateStatusPanel(); }
    renderPartyList() { this.ui.renderPartyList(); }
    updateFloatingControls() { this.ui.updateFloatingControls(); }
    updateCursor() { this.ui.updateCursor(); }
    renderUI() { this.ui.renderUI(); }

    handleResize() {
        const parent = this.grid.canvas.parentElement; 
        if (parent) { this.grid.canvas.width = parent.clientWidth; this.grid.canvas.height = parent.clientHeight; } 
        this.updateFloatingControls(); 
    }

    runAI() { this.aiSystem.runEnemyTurn(); }
    runAllyAutoAI() { this.aiSystem.runAllyAuto(); }

    regenResources(unit) { 
        if (unit.curHp <= 0) return; 
        const hpRegen = Formulas.getDerivedStat(unit, 'hp_regen'); 
        const mpRegen = Formulas.getDerivedStat(unit, 'mp_regen'); 
        unit.curHp = Math.min(unit.hp, unit.curHp + hpRegen); 
        if(unit.mp > 0) unit.curMp = Math.min(unit.mp, unit.curMp + mpRegen); 
    }

    useItem(slotIndex) {
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted) return;

        const slotKey = `pocket${slotIndex + 1}`;
        let itemId = null; let item = null;

        if (u.equipment && u.equipment[slotKey]) {
            itemId = u.equipment[slotKey];
            if (this.gameApp.itemData) item = this.gameApp.itemData[itemId];
        }

        if (!item) { this.log("사용할 아이템이 없습니다.", "log-system"); return; }

        let skillData = null;
        const refSkillId = item.refSkill || item.RefSkill;
        if (refSkillId && SKILL_DATABASE[refSkillId]) { 
            const rawSkill = SKILL_DATABASE[refSkillId];
            skillData = JSON.parse(JSON.stringify(rawSkill));
            skillData.id = itemId; skillData.name = item.name; skillData.type = 'ITEM'; 
            skillData.mp = 0; skillData._slotKey = slotKey; 
        }

        if (!skillData) {
            skillData = {
                id: itemId, name: item.name, type: 'ITEM', icon: item.icon,
                target: item.target || 'SELF', rng: item.rng || 0, area: item.area || 0, mp: 0, cost: 50,
                effects: [{ type: item.subType || 'HEAL_HP', val: item.val || 30, target: item.target || 'SELF' }],
                _slotKey: slotKey
            };
        }

        if (skillData.target === 'SELF' || skillData.target === 'GLOBAL' || skillData.rng == 0) {
            this.selectedSkill = skillData;
            this.skillProcessor.execute(u, u); 
        } else {
            if (this.selectedSkill && this.selectedSkill._slotKey === slotKey) {
                this.selectedSkill = null; this.log("취소됨", "log-system");
            } else {
                this.selectedSkill = skillData; this.log(`${item.name} 조준...`, "log-system");
                // ⭐ [버그 수정 3] 아이템을 조준할 때도 타겟팅 범위(장판)를 계산해서 띄워줍니다.
                this.attackableHexes = this.rangeManager.getAttackableHexes(u, skillData);
            }
            this.ui.updateFloatingControls();
            this.ui.updateStatusPanel();
            this.ui.updateCursor();
        }
    }

    consumeItem(unit, slotKey) {
        if (unit.equipment && unit.equipment[slotKey]) unit.equipment[slotKey] = null; 
        else if (unit.pocket) unit.pocket = null; 
        
        this.selectedSkill = null; 
        if (unit.team === 0) {
            this.ui.updateStatusPanel(); this.ui.updateFloatingControls(); this.renderPartyList(); 
        }
    }
    
    requestItemUse(slotIndex) {
        if (this.currentUnit.team !== 0 || this.actions.acted || this.isProcessingTurn) return;
        if (this.confirmingItemSlot === slotIndex) this.cancelItem();
        else { this.confirmingItemSlot = slotIndex; this.updateStatusPanel(); }
    }

    cancelItem() { this.confirmingItemSlot = null; this.updateStatusPanel(); }
    executeItem(slotIndex) { this.confirmingItemSlot = null; this.useItem(slotIndex); this.updateStatusPanel(); }
    
    
    confirmSkillSelf() {
        const u = this.currentUnit; const skill = this.selectedSkill;
        if (!u || !skill) return;
        if (u.curMp < skill.mp) { this.log("마나가 부족합니다.", "log-system"); return; }

        this.confirmingSkill = null; 
        this.hoverHex = null; 
        
        const floatUI = document.getElementById('floating-controls');
        if (floatUI) floatUI.classList.add('hud-hidden');

        this.skillProcessor.execute(u, u).then(() => {
            this.updateStatusPanel(); this.updateCursor(); this.renderPartyList();
        });
    }

    injectStyles() {
        if (document.getElementById('battle-system-styles')) return;
        const style = document.createElement('style');
        style.id = 'battle-system-styles';
        style.innerHTML = `
            #floating-controls { position: fixed; z-index: 1005; display: flex; flex-direction: row; align-items: flex-start; gap: 5px; pointer-events: auto; transition: opacity 0.2s; transform: translate(-50%, -100%); }
            .hud-hidden, .hud-hidden * { opacity: 0 !important; pointer-events: none !important; }
            .float-skill-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 3px; background: #151515; border: 1px solid #555; border-radius: 6px; width: 130px; height: 42px; overflow-y: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.9); }
            .float-skill-btn { width: 34px; height: 34px; background: #25252a; border: 1px solid #444; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; position: relative; flex-shrink: 0; }
            .float-skill-btn:hover { border-color: gold; background: #353540; }
            .float-skill-btn.active { border-color: gold; box-shadow: 0 0 5px gold; background: #443300; }
            .float-skill-btn.locked { opacity: 0.3; pointer-events: none; filter: grayscale(100%); }
            .float-skill-btn.mana-lack { opacity: 0.6; background: #311; border-color: #522; color: #f55; }
            .float-end-btn { width: 34px; height: 34px; background: linear-gradient(135deg, #722, #511); border: 1px solid #944; border-radius: 6px; color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); margin-top: 3px; }
            .float-end-btn:hover { background: linear-gradient(135deg, #933, #722); transform: scale(1.05); border-color: #f66; }

            .unit-overlay { position: absolute; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, 0); width: 0; height: 0; overflow: visible; pointer-events: none; z-index: 100; transition: top 0.05s linear, left 0.05s linear; }
            .overlay-anchor-group { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; width: 100px; padding-bottom: 2px; }
            .bar-group { position: relative; bottom: auto; left: auto; transform: none; width: 40px; display: flex; flex-direction: column; gap: 1px; }
            .hp-row { display: flex; width: 100%; height: 5px; background: #222; border: 1px solid #000; }
            .hp-fill { background: #f44; height: 100%; transition: width 0.2s; }
            .shield-fill { background: #00bfff; height: 100%; transition: width 0.2s; }
            .xp-fill { background: #7a7a7a; height: 100%; transition: width 0.2s; }
            .ag-row { width: 100%; height: 3px; background: #000; border: 1px solid #000; }
            .ag-fill { background: #ffd700; height: 100%; transition: width 0.2s; }

            .name-tag { position: absolute; top: 50px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: #eee; font-size: 9px; padding: 0 3px; border-radius: 3px; white-space: nowrap; text-shadow: 1px 1px 1px #000; border: 1px solid #333; }
            .status-icon-mini { font-size: 11px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.7); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 3px; box-shadow: 0 0 3px rgba(0,0,0,0.5); pointer-events: none; }
            .status-row { display: flex; gap: 2px; margin-bottom: 4px; justify-content: center; min-height: 18px; }

            .hud-guide-text { position: absolute; top: -16px; right: 0; font-size: 9px; color: rgba(255, 255, 255, 0.7); font-weight: bold; text-shadow: 1px 1px 0 #000; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
            #floating-controls:hover .hud-guide-text { opacity: 1; }

            .turn-highlight-circle { position: absolute; top: 40px; left: 0; width: 50px; height: 30px; border: 2px solid #ffd700; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 10px #ffd700; z-index: -1; animation: pulseBorder 1.5s infinite; }
            @keyframes pulseBorder { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } 50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } }
            .item-confirm-popup { position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; background: rgba(0,0,0,0.9); padding: 4px; border-radius: 4px; border: 1px solid #666; z-index: 9999; }
            
            .speech-bubble { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #fff; color: #000; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.5); z-index: 9999; border: 2px solid #333; animation: bubblePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; }
            .speech-bubble::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -6px; border-width: 6px; border-style: solid; border-color: #fff transparent transparent transparent; }
            .speech-bubble::before { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -8px; border-width: 8px; border-style: solid; border-color: #333 transparent transparent transparent; z-index: -1; }
            @keyframes bubblePop { 0% { transform: translateX(-50%) scale(0); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
            
            @keyframes auraRipple {
                0% { transform: translateX(-50%) scale(0.3); opacity: 1; border-width: 3px; }
                100% { transform: translateX(-50%) scale(4.0); opacity: 0; border-width: 1px; }
            }
            .aura-ripple {
                position: absolute; 
                left: 50%; 
                top: 25px; 
                width: 70px;  
                height: 42px; 
                border-radius: 50%; 
                border: 2px solid #00ffff; 
                pointer-events: none;
                animation: auraRipple 1.5s ease-out infinite;
                z-index: -5; 
                box-shadow: 0 0 12px #00ffff inset, 0 0 12px #00ffff;
            }
            @keyframes castGather {
                0% { transform: translateX(-50%) scale(3.5); opacity: 0; border-width: 1px; }
                30% { opacity: 0.8; border-width: 3px; }
                100% { transform: translateX(-50%) scale(0.3); opacity: 0; border-width: 5px; }
            }
            .cast-ripple {
                position: absolute; 
                left: 50%; 
                top: 25px;
                width: 70px;  
                height: 42px; 
                border-radius: 50%; 
                border: 2px solid #ffaa00;
                pointer-events: none;
                animation: castGather 1.2s ease-in infinite;
                z-index: -5; 
                box-shadow: 0 0 12px #ffaa00 inset, 0 0 12px #ffaa00;
            }
            .action-btn { flex: 1; text-align: center; background: #2a2a35; border: 1px solid #556; border-radius: 4px; padding: 6px 8px; color: #fff; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.1s; }
            .action-btn:hover:not(.disabled) { background: #4a4a55; border-color: gold; }
            .action-btn.active { background: #443300; border-color: gold; box-shadow: 0 0 5px gold; color: gold; }
            .action-btn.disabled { opacity: 0.4; pointer-events: none; filter: grayscale(100%); }
            
            .list-btn { background: #1a1a20; border: 1px solid #334; border-radius: 3px; padding: 4px 6px; color: #ccc; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: 0.1s; margin-bottom: 2px; }
            .list-btn:hover:not(.disabled) { background: #334; border-color: #55a; color: #fff; }
            .list-btn.active { border-color: gold; background: #443300; color: gold; box-shadow: 0 0 5px rgba(255,215,0,0.5); }
            .list-btn.disabled { opacity: 0.4; pointer-events: none; color: #888; }
            
            .skill-cat-wrap { position: relative; }
            .skill-sub-menu { position: absolute; top: 0; left: 100%; margin-left: 4px; display: none; flex-direction: column; background: rgba(20,25,30,0.98); border: 1px solid #5a5a6a; padding: 4px; border-radius: 4px; box-shadow: 2px 2px 10px rgba(0,0,0,0.8); z-index: 1000; min-width: 120px; }
            .skill-cat-wrap:hover .skill-sub-menu { display: flex; }
            
            .cost-text { font-size: 9px; color: #0cf; background: rgba(0,0,0,0.5); padding: 1px 3px; border-radius: 2px; }
        `;
        document.head.appendChild(style);
    }

    startAuraRipple(unit) {
        if (!unit) return;
        const el = document.getElementById(`unit-overlay-${unit.id}`);
        if (!el) return;
        
        if (el.querySelector('.aura-ripple')) return;

        const ripple = document.createElement('div');
        ripple.className = 'aura-ripple';
        if (unit.auraEffects && unit.auraEffects[0] && unit.auraEffects[0].type.includes('DEBUFF')) {
            ripple.style.borderColor = '#ff0055';
        }
        
        el.appendChild(ripple);
    }

    stopAuraRipple(unit) {
        if (!unit) return;
        const el = document.getElementById(`unit-overlay-${unit.id}`);
        if (!el) return;
        const ripples = el.querySelectorAll('.aura-ripple');
        ripples.forEach(r => r.remove()); 
    }
    
    startCastRipple(unit) {
        const unitEl = document.getElementById(`unit-overlay-${unit.id}`);
        if (!unitEl) return;
        if (unitEl.querySelector('.cast-ripple')) return;
        const ripple = document.createElement('div');
        ripple.className = 'cast-ripple';
        unitEl.appendChild(ripple);
    }

    stopCastRipple(unit) {
        const unitEl = document.getElementById(`unit-overlay-${unit.id}`);
        if (!unitEl) return;
        const ripple = unitEl.querySelector('.cast-ripple');
        if (ripple) {
            ripple.remove();
        }
    }
    
       
    getTerrainBonus(unit) {
        if (!this.grid) return { def: 0, eva: 0 };
        
        const tData = this.grid.getTerrainData(unit.q, unit.r);
        const tInfo = TERRAIN_TYPES[tData.key];
        
        if (tInfo && tInfo.effect && tInfo.effect.type === 'BUFF_EVA') {
            return { def: 0, eva: tInfo.effect.val }; 
        }
        let defBonus = 0;
        let evaBonus = 0;

        if (tInfo && tInfo.effect && tInfo.effect.type === 'BUFF_EVA') evaBonus += tInfo.effect.val;
        if (tInfo && tInfo.effect && tInfo.effect.type === 'BUFF_DEF') defBonus += tInfo.effect.val;
        
        const wallOnTile = this.units.find(u => u.q === unit.q && u.r === unit.r && u.key === 'WALL_EARTH' && u.curHp > 0);
        if (wallOnTile) {
            evaBonus -= 50; 
        }

        return { def: defBonus, eva: evaBonus };
    }

    // ==========================================
    // 🎥 카메라 및 시각 연출 (CameraManager) 연결부
    // ==========================================
    updateUnitOverlayPosition(unit) { this.cameraManager.updateUnitOverlayPosition(unit); }
    centerCameraOnUnit(unit) { this.cameraManager.centerCameraOnUnit(unit); }
    async smoothPanCamera(targetFocusX, targetFocusY, ...args) { return this.cameraManager.smoothPanCamera(targetFocusX, targetFocusY, ...args); }
    saveCameraState() { this.cameraManager.saveCameraState(); }
    async restoreCameraState(duration = 400) { return this.cameraManager.restoreCameraState(duration); }
    clearCameraState() { this.cameraManager.clearCameraState(); }
    async smoothCenterCameraOnUnit(unit, duration = 400) { return this.cameraManager.smoothCenterCameraOnUnit(unit, duration); }
    centerCameraOnHeroes() { this.cameraManager.centerCameraOnHeroes(); }
    triggerShakeAnimation(u) { this.cameraManager.triggerShakeAnimation(u); }
    triggerBumpAnimation(u, target) { this.cameraManager.triggerBumpAnimation(u, target); }
    createProjectile(start, end) { this.cameraManager.createProjectile(start, end); }
    moveSpriteOnly(unit, q, r, duration, isJump = false) { return this.cameraManager.moveSpriteOnly(unit, q, r, duration, isJump); }

    // ==========================================
    // 🗺️ 환경/기믹 및 NPC 대화 (EnvironmentManager) 연결부
    // ==========================================
    cleanup() { this.environment.cleanupChatter(); }
    spawnTownNPC(id, q, r, data) { this.environment.spawnTownNPC(id, q, r, data); }
    handleNPCInteraction(npc) { this.environment.handleNPCInteraction(npc); }
    startNPCChatter() { this.environment.startNPCChatter(); }
    placeTrap(q, r, type, casterId) { this.environment.placeTrap(q, r, type, casterId); }
    checkTileEvent(unit) { this.environment.checkTileEvent(unit); }
    detectHiddenObjects(unit) { this.environment.detectHiddenObjects(unit); }
    triggerSparkle(obj) { this.environment.triggerSparkle(obj); }

    // ==========================================
    // 🛠️ 테스트 전장 (Sandbox Mode) 연결부
    // ==========================================
    initTestBattlefield() { this.sandbox.initTestBattlefield(); }
    executeSandboxAction(hex) { this.sandbox.executeSandboxAction(hex); }

    // ==========================================
    // 📦 아이템 획득 및 루팅 (LootManager) 연결부
    // ==========================================
    getLootTable(tierKey) { return this.lootManager.getLootTable(tierKey); }
    rollLoot(tierKey, unit) { return this.lootManager.rollLoot(tierKey, unit); }
    lootItem(itemId, sourceUnit) { this.lootManager.lootItem(itemId, sourceUnit); }

    // ==========================================
    // 📈 성장 및 보상 시스템 (Progression) 연결부
    // ==========================================
    gainActionXp(unit, amount) { this.progression.gainActionXp(unit, amount); }
    gainVictoryBonus() { this.progression.gainVictoryBonus(); }
    gainCombatPoints(caster, skill, isHit, target) { this.progression.gainCombatPoints(caster, skill, isHit, target); }
    checkLevelUp(unit) { this.progression.checkLevelUp(unit); }

    // ==========================================
    // 🏃‍♂️ 이동 및 동선 기믹 (MovementManager) 연결부
    // ==========================================
    calcReachable() { this.movement.calcReachable(); }
    
    // ⭐ [수정] 도약 및 이동 완료 시 시간의 흐름(Time Action) 트리거 추가
    async jumpUnit(unit, q, r) { 
        const res = await this.movement.jumpUnit(unit, q, r); 
        if (res !== false && this.ui && typeof this.ui.addTimeAction === 'function') {
            this.ui.addTimeAction(1);
        }
        return res; 
    }
    async moveUnit(unit, q, r, cb) { 
        const res = await this.movement.moveUnit(unit, q, r, cb); 
        if (res !== false && this.ui && typeof this.ui.addTimeAction === 'function') {
            this.ui.addTimeAction(1);
        }
        return res; 
    }
    
    isFlying(unit) { return this.movement.isFlying(unit); }

    // ==========================================
    // 💀 유닛 소환 및 생사 (UnitLifecycleManager) 연결부
    // ==========================================
    initUnits(chapter, stage) { this.lifecycle.initUnits(chapter, stage); }
    spawnUnit(key, team, q, r, overrides, auraEffects) { this.lifecycle.spawnUnit(key, team, q, r, overrides, auraEffects); }
    handleDeath(unit, killer) { this.lifecycle.handleDeath(unit, killer); }
    
    // ==========================================
    // 🎯 타겟팅 엔진 (TargetingManager) 연결
    // ==========================================
    collectTargets(effectData, targetHex, clickedUnit, caster, skill, options = {}) {
        return this.targetingManager.collectTargets(effectData, targetHex, clickedUnit, caster, skill, options);
    }
}