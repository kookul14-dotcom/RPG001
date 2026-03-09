import { STAGE_DATA, CLASS_DATA, SKILL_DATABASE, TERRAIN_TYPES,EFFECTS, ITEM_DATA } from '../../data/index.js';
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
import { GameRenderer } from '../../render/renderer.js'; // ⭐ 렌더러 임포트 추가 (경로는 프로젝트 구조에 맞게 수정하세요)

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
        
        // ⭐ [근본 아키텍처 도입] GameRenderer 생성 시 this 주입 추가
        if (window.renderer) {
            window.renderer.destroy(); // 기존 렌더러가 있다면 파괴
        }
        this.renderer = new GameRenderer(grid.canvas, grid, this); 
        window.renderer = this.renderer; // 호환성을 위해 전역에도 잠시 연결해둠 (추후 제거 권장)

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

        this.units.forEach(u => {
            if (u.curHp > 0) {
                u.isFullyDead = false;
                u.isIncapacitated = false;
                u.isDead = false;
                u.deathTimer = undefined;
                if (u.prevIcon) {
                    u.icon = u.prevIcon;
                    u.prevIcon = null;
                } else if (u.icon === '🪦' || String(u.icon).includes('⏳')) {
                    u.icon = "👤"; 
                }
            }
        });
        
        // ⭐ 만악의 근원이었던 this._compileCombatDecks(); 호출을 영구 삭제했습니다. 원본 스킬은 100% 보존됩니다.

        this.units.forEach(u => {
            if (u.team === 0) {
                u.cachedModifiers = null; 
                Formulas.updateUnitCache(u); 
                
                // ⭐ 장착된 패시브 연산(최대 마나 +30% 등) 결과를 전투 시작 시 즉각 반영합니다.
                const maxHp = Formulas.getDerivedStat(u, 'hp_max');
                const maxMp = Formulas.getDerivedStat(u, 'mp_max');
                if (maxHp > 0) u.hp = maxHp;
                if (maxMp > 0) u.mp = maxMp;
                
                if (u.curHp > u.hp) u.curHp = u.hp;
                if (u.curMp > u.mp) u.curMp = u.mp;
            }
        });
        
        setTimeout(() => {
            this.handleResize(); 
            this.centerCameraOnHeroes(); 
            this.showStageTitle();
        }, 100);
        
        this.nextTurn();
    }
        
    destroy() {
        this.isBattleEnded = true;
        this.units.forEach(u => {
            if (u.team === 0) {
                u.cachedModifiers = null; 
                u.buffs = [];
                u.actionGauge = 0;
                u.isCharging = false;
                u.chargingSkill = null;
                u.isAuraSource = false;
                u.auraEffects = [];
                u._delayedDamage = 0;
                u.isIncapacitated = false;
                u.isFullyDead = false;
                u.deathTimer = undefined;
                if (u.prevIcon) {
                    u.icon = u.prevIcon;
                    u.prevIcon = null;
                }
                // ⭐ [버그 수정] 배열을 새로 할당(filter)하면 Proxy 참조가 끊어져 세이브가 망가집니다. 
                // 기존 배열(Proxy)을 유지한 채 splice로 훔친 스킬만 안전하게 직접 제거합니다.
                if (u.skills) {
                    for (let i = u.skills.length - 1; i >= 0; i--) {
                        if (u.skills[i] && u.skills[i].isStolen) {
                            u.skills.splice(i, 1);
                        }
                    }
                }
            }
        });

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
        
        this.units.forEach(u => {
            if (u.team === 0) {
                u.cachedModifiers = null; 
                u.buffs = [];
                u.actionGauge = 0;
                u.isCharging = false;
                u.chargingSkill = null;
                u.isAuraSource = false;
                u.auraEffects = [];
                u._delayedDamage = 0;
                u.isIncapacitated = false;
                u.isFullyDead = false;
                u.deathTimer = undefined;
                if (u.prevIcon) {
                    u.icon = u.prevIcon;
                    u.prevIcon = null;
                }
                // ⭐ [버그 수정] 배열을 새로 할당(filter/map)하면 Proxy 참조가 끊어져 세이브가 망가집니다. 
                // 기존 배열(Proxy)을 유지한 채 splice로 훔친 스킬만 안전하게 직접 제거합니다.
                if (u.skills) {
                    for (let i = u.skills.length - 1; i >= 0; i--) {
                        if (u.skills[i] && u.skills[i].isStolen) {
                            u.skills.splice(i, 1);
                        }
                    }
                }
            }
        });

        if (this.inputSystem && typeof this.inputSystem.destroy === 'function') {            this.inputSystem.destroy();
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

                setTimeout(() => {
                    // ⭐ [버그 수정] 승리 모달이 뜨기 직전에 마을 UI 등 방해 요소를 완벽 은폐
                    if (this.ui && typeof this.ui.hideAllCombatUI === 'function') {
                        this.ui.hideAllCombatUI();
                    }

                    const modal = document.getElementById('battle-result-modal');
                    const title = document.getElementById('battle-result-title');
                    const desc = document.getElementById('battle-result-desc');
                    const modalBtns = document.querySelector('.modal-btns');
                    
                    // ⭐ [버그 수정] 결과창 z-index 최상단 고정
                    if (modal) modal.style.zIndex = '9999999';

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
    // =========================================================================
    // ⭐ [신규] 채널링 스킬 맥박(Pulse) 동시 발현 시스템
    // 시전자 중심으로 범위 내 모든 대상에게 동시에 이펙트와 효과(힐, 디버프 등)를 부여
    // =========================================================================
    triggerAuraPulse(caster) {
        if (!caster || !caster.auraEffects || caster.auraEffects.length === 0) return;
        
        // 능동적으로 펄스(효과/텍스트)를 뿜어내야 하는 스킬인지 필터링 (단순 스탯 뻥튀기는 이펙트 제외)
        let hasPulseEffect = caster.auraEffects.some(eff => eff.type.includes('REGEN') || eff.type.includes('RANDOM'));
        if (!hasPulseEffect) return;

        this.log(`🌊 ${caster.name}의 기운이 전장에 공명합니다!`, 'log-skill');
        
        this.units.forEach(unit => {
            if (unit.curHp <= 0) return;
            
            let hitByPulse = false;
            
            caster.auraEffects.forEach(eff => {
                const dist = this.grid.getDistance(caster, unit);
                if (dist <= (eff.area || 5)) {
                    const targetStr = String(eff.target || "").toUpperCase();
                    const isAlly = (caster.team === unit.team);
                    
                    if ((targetStr.includes('ENEMY') || targetStr.includes('적')) && isAlly) return;
                    if ((targetStr.includes('ALLY') || targetStr.includes('아군')) && !isAlly) return;
                    
                    // ⭐ [버그 해결] 엔진이 자동 변환한 이름(BUFF_STAT_REGEN_HP 등)을 캐치할 수 있도록 includes 사용
                    
                    // 1. 생명의 축가 (HP 회복)
                    if (eff.type.includes('REGEN_HP')) {
                        hitByPulse = true;
                        const heal = Math.floor(Formulas.getDerivedStat(caster, 'atk_mag') * (parseFloat(eff.val) || 1));
                        unit.curHp = Math.min(unit.hp, unit.curHp + heal);
                        this.showFloatingText(unit, `+${heal}`, '#00ff00');
                    } 
                    // 2. 코스모스의 아리아 (MP 회복)
                    else if (eff.type.includes('REGEN_MP')) {
                        hitByPulse = true;
                        const mpHeal = parseFloat(eff.val) || 10;
                        unit.curMp = Math.min(unit.mp, unit.curMp + mpHeal);
                        this.showFloatingText(unit, `+${mpHeal} MP`, '#55ccff');
                    }
                    // 3. 살로메의 일곱 베일 (매 턴 랜덤 디버프)
                    else if (eff.type.includes('RANDOM')) {
                        hitByPulse = true;
                        const debuffs = ['STAT_BLIND', 'CC_FEAR', 'CC_BIND', 'STAT_CURSE', 'STAT_CONFUSION', 'CC_CHARM', 'STAT_DEATH'];
                        const rDebuff = debuffs[Math.floor(Math.random() * debuffs.length)];
                        if (this.statusManager) {
                            if (rDebuff === 'STAT_DEATH' && Math.random() > 0.05) return; 
                            if ((rDebuff === 'CC_CHARM' || rDebuff === 'STAT_CONFUSION') && Math.random() > 0.3) return; 
                            
                            this.statusManager.applyStatus(unit, {type: rDebuff, val: 0, duration: 1}, caster);
                        }
                    }
                }
            });
            
            // 공명 대상들에게 시각적 이펙트 동시 재생 (흔들림 + 물결)
            if (hitByPulse) {
                this.triggerShakeAnimation(unit);
                const el = document.getElementById(`unit-overlay-${unit.id}`);
                if (el) {
                    const ripple = document.createElement('div');
                    ripple.className = 'aura-ripple';
                    ripple.style.animationDuration = '0.8s'; // 빠르게 퍼지는 연출
                    el.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 800);
                }
            }
        });
    }
    // =========================================================================
    // ⭐ [신규] 피격/CC기로 인한 캐스팅/채널링 강제 중단 및 패시브 연동 시스템
    // =========================================================================
    interruptCasting(unit, isHit = false) {
        if (!unit || unit.curHp <= 0) return;
        
        let wasInterrupted = false;
        
        // 1. 차징(Casting) 중단
        if (unit.isCharging) {
            unit.isCharging = false;
            unit.chargingSkill = null;
            unit.buffs = unit.buffs.filter(b => b.type !== 'BUFF_CASTING');
            wasInterrupted = true;
        }
        
        // 2. 채널링(장판/연주) 중단
        const hasChannel = unit.buffs && unit.buffs.some(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
        if (hasChannel) {
            unit.buffs = unit.buffs.filter(b => !(b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')));
            unit.isAuraSource = false;
            unit.auraEffects = [];
            if (this.stopAuraRipple) this.stopAuraRipple(unit);
            if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
            wasInterrupted = true;
        }

        // ⭐ 3. 중단 처리 및 패시브 연동
        if (wasInterrupted) {
            this.showFloatingText(unit, "집중 깨짐!", "#ff0000");
            
            // ⭐ [기획 반영] 피격(isHit)으로 인한 취소일 때만 WT 반환 패시브 발동
            if (isHit) {
                this.log(`💥 물리적 타격으로 인해 ${unit.name}의 시전이 강제로 취소되었습니다!`, 'log-bad');
                
                if (unit.skills) {
                    const cancelPassive = unit.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                    if (cancelPassive && this.statusManager) {
                        this.log(`🔁 [${cancelPassive.name}] 타격에 의한 강제 취소로 몸이 가벼워집니다! (WT 감소)`, 'log-skill');
                        
                        const buffEff = cancelPassive.effects[1]; 
                        if (buffEff && buffEff.type !== '-') {
                            this.statusManager.applyStatus(unit, { 
                                type: buffEff.type, 
                                val: buffEff.val, 
                                duration: parseInt(buffEff.dur) || 1,
                                name: cancelPassive.name,
                                icon: cancelPassive.icon || '💨'
                            }, unit);
                        }
                    }
                }
            } else {
                // 수면, 기절 등 상태이상으로 인한 취소 (WT 반환 없음)
                this.log(`💤 상태이상으로 인해 ${unit.name}의 시전이 무력화되었습니다!`, 'log-bad');
            }
            
            this.updateStatusPanel();
        }
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
                    
                    // ⭐ [신규] PAS_AURA_RESIST (오라 디버프 저항) 패시브 검사
                    const isDebuff = eff.type.includes('DEBUFF') || eff.type.includes('STAT_') || eff.type.includes('CC_');
                    if (isDebuff && !isAlly) {
                        const auraResist = (unit.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_AURA_RESIST'));
                        if (auraResist) return; // 오라 저항이 있으면 적의 디버프 장판 효과를 완전히 무시합니다.
                    }

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

    async startTurnLogic() { 
        if (!this.currentUnit) {
            if (!this.isPeaceful && !this.isBattleEnded && !this.isTestMode) this.checkBattleEnd(); 
            return;
        }

        // ⭐ [신규 추가] 턴이 시작될 때마다 우측 타겟 패널을 초기화하여 전 턴의 잔재가 남지 않게 합니다.
        if (this.ui && typeof this.ui.updateRightPanel === 'function') {
            this.ui.updateRightPanel([], null);
        }

        if (!this.isPeaceful) { 
            if (this.smoothCenterCameraOnUnit) {
                await this.smoothCenterCameraOnUnit(this.currentUnit, 300);
                await new Promise(r => setTimeout(r, 150)); 
            } else if (this.centerCameraOnUnit) {
                this.centerCameraOnUnit(this.currentUnit);
            }
        }

        // =========================================================
        // ⭐ 전투불능(3턴 유예) 및 사망 처리
        // =========================================================
        if (this.currentUnit.curHp <= 0) {
            if (this.currentUnit.deathTimer === undefined) {
                this.currentUnit.deathTimer = 3;
                this.currentUnit.isIncapacitated = true;
                this.currentUnit.isFullyDead = false;
                if (!this.currentUnit.prevIcon) {
                    this.currentUnit.prevIcon = this.currentUnit.icon;
                }
            }

            this.isProcessingTurn = true;
            
            if (this.smoothCenterCameraOnUnit) {
                await this.smoothCenterCameraOnUnit(this.currentUnit, 500);
            }
            await new Promise(r => setTimeout(r, 300)); 

            if (this.currentUnit.isIncapacitated && !this.currentUnit.isFullyDead) {
                this.currentUnit.deathTimer--;
                
                if (this.currentUnit.deathTimer <= 0) {
                    this.log(`☠️ ${this.currentUnit.name}의 숨이 완전히 멎었습니다... (완전 사망)`, 'log-bad');
                    this.showFloatingText(this.currentUnit, `사망!`, '#ff0000');
                    
                    this.currentUnit.isFullyDead = true;
                    this.currentUnit.isIncapacitated = false;
                    this.currentUnit.actionGauge = 0; 
                    this.currentUnit.icon = "🪦"; 

                    setTimeout(() => {
                        if (this.ui && this.ui.renderUnitOverlays) this.ui.renderUnitOverlays();
                        this.handleDeath(this.currentUnit);
                        this.isProcessingTurn = false;
                        this.endTurn();
                    }, 1500);
                    return;
                } else {
                    this.currentUnit.icon = `⏳${this.currentUnit.deathTimer}`;
                    this.showFloatingText(this.currentUnit, `사망까지 ${this.currentUnit.deathTimer}턴`, '#ff5555');
                    this.log(`⏳ ${this.currentUnit.name} 의식이 흐려집니다. (사망까지 ${this.currentUnit.deathTimer}턴 남음)`, 'log-system');
                    this.triggerShakeAnimation(this.currentUnit);
                    this.currentUnit.actionGauge = 0;
                    
                    setTimeout(() => {
                        if (this.ui && this.ui.renderUnitOverlays) this.ui.renderUnitOverlays();
                        this.isProcessingTurn = false;
                        this.endTurn();
                    }, 1200);
                    return;
                }
            } else {
                this.currentUnit.actionGauge = 0;
                this.isProcessingTurn = false;
                this.endTurn();
                return;
            }
        }

        const nightPassive = (this.currentUnit.skills || []).find(s => 
            s.type === 'PASSIVE' && 
            (this.currentUnit.team !== 0 || (this.currentUnit.equippedSkills && this.currentUnit.equippedSkills.includes(s.id))) && 
            s.effects.some(e => e.type === 'PAS_ATNIGHT')
        );        
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

        // ⭐ 1. 캐스팅(차징) 중일 때 남은 턴 수
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
        
        // =========================================================
        // ⭐ 2. 완벽하게 개편된 채널링(오라/연주/춤) 유지 시스템
        // =========================================================
        const channelBuffs = this.currentUnit.buffs.filter(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
        
        if (channelBuffs.length > 0) {
            this.currentUnit.isAuraSource = true;
            
            if (!this.currentUnit.auraEffects || this.currentUnit.auraEffects.length === 0) {
                this.currentUnit.auraEffects = channelBuffs.map(cb => ({
                    type: cb.type.replace('CHANNELED_', 'STAT_'),
                    val: cb.val,
                    area: cb.area !== undefined ? parseInt(cb.area) : 5,
                    target: cb.type.startsWith('BUFF') ? 'ALLY_ALL' : 'ENEMY_ALL'
                }));
            }
            this.broadcastAura(this.currentUnit);
            
            // 1) 턴 시작 시 즉시 펄스 폭발 (마나 회복/디버프 등)
            this.triggerAuraPulse(this.currentUnit);

            // 2) 펄스가 터진 직후 바로 횟수를 1 차감 (UI 표기 정상화)
            this.currentUnit.buffs.forEach(b => {
                if (b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')) {
                    b.duration--;
                }
            });

            // 3) 차감 후 아직 횟수가 남았는지 체크
            const activeChannels = this.currentUnit.buffs.filter(b => (b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')) && b.duration > 0);

            if (activeChannels.length > 0) {
                const channelBuff = activeChannels[0]; 
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
                
                // 마나 차감 및 유지
                if (this.currentUnit.curMp >= cost) {
                    if (cost > 0) this.currentUnit.curMp -= cost;
                    
                    let remainText = channelBuff.duration > 50 ? "마력 고갈 시까지" : `앞으로 ${channelBuff.duration}번 발동`;
                    
                    this.showFloatingText(this.currentUnit, `유지 중 (${remainText})`, '#55ccff');
                    this.log(`🎶 ${this.currentUnit.name} 연주/춤 유지 중... (${remainText}, MP -${cost})`, 'log-skill');
                    
                    if (!this.hasStatus(this.currentUnit, 'SYS_MAXIMIZE_CHANT')) {
                        this.actions.acted = true; 
                        this.actions.moved = true; 
                    } else {
                        this.log(`🔔 영원의 메아리 효과로 ${this.currentUnit.name}은(는) 자유롭게 행동할 수 있습니다!`, 'log-skill');
                    }
                    
                } else {
                    // 마나 부족 시 강제 종료
                    this.currentUnit.buffs = this.currentUnit.buffs.filter(b => !b.type.startsWith('BUFF_CHANNELED') && !b.type.startsWith('DEBUFF_CHANNELED'));
                    this.showFloatingText(this.currentUnit, "Song Ended", "#aaa");
                    this.log(`마력이 고갈되어 노래가 중단되었습니다.`, 'log-bad');
                    this.currentUnit.isAuraSource = false;
                    this.currentUnit.auraEffects = [];
                    if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                    if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
                }
            } else {
                // ⭐ [마지막 턴 해방] 1 남은 상태에서 펄스를 터뜨려 0이 된 경우!
                this.currentUnit.buffs = this.currentUnit.buffs.filter(b => !b.type.startsWith('BUFF_CHANNELED') && !b.type.startsWith('DEBUFF_CHANNELED'));
                this.currentUnit.isAuraSource = false;
                this.currentUnit.auraEffects = [];
                if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
                
                this.showFloatingText(this.currentUnit, "연주 완료!", "#aaa");
                this.log(`🎵 ${this.currentUnit.name}의 연주가 끝났습니다. 이번 턴부터 즉시 행동이 가능합니다!`, "log-system");
                // acted와 moved를 true로 막지 않으므로, 이 시점에서 바로 이동/공격 가능
            }
        } else if (this.currentUnit.isAuraSource && (this.currentUnit.job === '음유시인' || this.currentUnit.job === '무희' || this.currentUnit.classKey?.includes('BRD') || this.currentUnit.classKey?.includes('DNC'))) {
            this.currentUnit.isAuraSource = false;
            this.currentUnit.auraEffects = [];
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

        this.updateAurasForUnit(this.currentUnit);

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
        
        // =========================================================
        // ⭐ 도트 데미지 처리 (이중 힐/피해 완벽 차단)
        // =========================================================
        for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
            const b = this.currentUnit.buffs[i];
            
            // 남이 씌운 장판(isAura)이나 내가 부르는 채널링(CHANNELED)은 위에서 처리했으므로 완전 무시!
            if (b.isAura || String(b.type).includes('CHANNELED')) {
                continue;
            }

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
            setTimeout(() => this.endTurn(), 800); 
            return; 
        }

        if (this.hasStatus(this.currentUnit, 'SHOCK')) {
             this.log("⚡ 감전 상태! 행동력 회복 불가.", "log-cc");
        }

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
        console.log(`\n================================`);
        console.log(`[디버그: 1단계] UI에서 클릭 신호 도착! 전달된 sId: [${sId}] (타입: ${typeof sId})`);
        
        const u = this.currentUnit;
        if (!u) { console.log(`[디버그: 종료] 현재 선택된 유닛이 없습니다.`); return; }
        if (this.actions.acted) { console.log(`[디버그: 종료] 이미 행동을 완료한 유닛입니다.`); return; }

        this.isMovingMode = false;
        this.reachableHexes = [];
        
        if (this.ui && this.ui.updateRightPanel) this.ui.updateRightPanel([], null);

        if (sId === 'basic') {
            console.log(`[디버그] 기본 공격 분기로 진입했습니다.`);
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
        console.log(`[디버그: 2단계] 유닛 스킬 목록 검색 결과:`, rawSkill ? '스킬 발견됨' : '스킬 아님 (아이템 탐색 시작)');

        if (!rawSkill) {
            let foundItemSlot = -1;
            console.log(`[디버그: 3단계] 유닛 주머니(Pocket) 탐색을 시작합니다. u.equipment 상태:`, u.equipment);
            
            if (u.equipment) {
                for (let i = 0; i < 8; i++) {
                    const slotKey = `pocket${i + 1}`;
                    const eqItem = u.equipment[slotKey];
                    const itemId = typeof eqItem === 'object' && eqItem !== null ? eqItem.id : eqItem;
                    
                    console.log(`  -> 슬롯 [${slotKey}] 검사 중... 들어있는 아이템 ID: ${itemId}`);
                    
                    if (itemId === sId) {
                        foundItemSlot = i;
                        console.log(`  => 🎯 일치하는 아이템 발견! 슬롯 인덱스: ${foundItemSlot}`);
                        break;
                    }
                }
            }
            
            if (foundItemSlot !== -1) {
                console.log(`[디버그: 4단계] useItem 함수로 제어권을 넘깁니다.`);
                this.useItem(foundItemSlot);
                return;
            }
            
            console.log(`[디버그: 치명적 종료] 스킬도 아니고 장착된 아이템도 아닙니다. ID 불일치로 여기서 코드가 죽습니다.`);
            return;
        }

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
                
                if (area > 0) {
                    this.attackableHexes = [];
                    for (let dq = -area; dq <= area; dq++) {
                        for (let dr = Math.max(-area, -dq - area); dr <= Math.min(area, -dq + area); dr++) {
                            const targetQ = u.q + dq;
                            const targetR = u.r + dr;
                            if (this.grid && this.grid.getTerrainData(targetQ, targetR)) {
                                this.attackableHexes.push({ q: targetQ, r: targetR });
                            }
                        }
                    }
                } else {
                    this.attackableHexes = []; 
                }
            } else {
                this.confirmingSkill = null;
                this.attackableHexes = this.rangeManager.getAttackableHexes(u, this.selectedSkill);
                this.log(`[${this.selectedSkill.name}] 조준... (타겟을 클릭하세요)`, 'log-system'); 
            }
        }

        this.updateStatusPanel(); 
        this.updateCursor();
    }

    useItem(slotIndex) {
        console.log(`\n--------------------------------`);
        console.log(`[디버그: 5단계] useItem 실행됨. 요청된 슬롯 인덱스: ${slotIndex}`);
        
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted) {
            console.log(`[디버그: 종료] 유닛 상태 이상 또는 이미 행동 완료함.`);
            return;
        }

        const slotKey = `pocket${slotIndex + 1}`;
        let itemId = null; let item = null;

        if (u.equipment && u.equipment[slotKey]) {
            const eqData = u.equipment[slotKey];
            itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            
            console.log(`[디버그: 6단계] 슬롯 [${slotKey}]에서 찾은 아이템 ID: ${itemId}`);
            
            if (this.gameApp && this.gameApp.itemData && this.gameApp.itemData[itemId]) {
                item = this.gameApp.itemData[itemId];
            } else if (typeof ITEM_DATA !== 'undefined' && ITEM_DATA[itemId]) {
                item = ITEM_DATA[itemId];
            }
        }

        if (!item) { 
            console.log(`[디버그: 치명적 에러] ITEM_DATA에서 [${itemId}]에 해당하는 세부 정보를 찾지 못했습니다!`);
            this.log("사용할 아이템 정보를 찾을 수 없습니다.", "log-bad"); 
            return; 
        }

        console.log(`[디버그: 7단계] 획득한 아이템 원본 데이터:`, item);

        this.isMovingMode = false;
        this.reachableHexes = [];
        if (this.ui && this.ui.updateRightPanel) this.ui.updateRightPanel([], null);

        const refSkillId = item.refSkill || itemId;
        let baseSkill = null;
        
        console.log(`[디버그: 8단계] 변환할 타겟 스킬 ID (refSkill): [${refSkillId}]`);

        if (typeof SKILL_DATABASE !== 'undefined' && SKILL_DATABASE[refSkillId]) {
            baseSkill = JSON.parse(JSON.stringify(SKILL_DATABASE[refSkillId]));
        }

        if (!baseSkill) {
            console.log(`[디버그: 치명적 에러] SKILL_DATABASE에 [${refSkillId}] 데이터가 아예 존재하지 않습니다!`);
            this.log(`[${item.name}]의 스킬 데이터를 찾을 수 없습니다.`, "log-bad");
            return;
        }

        console.log(`[디버그: 9단계] SKILL_DATABASE에서 성공적으로 스킬 복사 완료:`, baseSkill);

        let skillData = {
            ...baseSkill,
            _slotKey: slotKey,
            cost: item.cost !== undefined ? item.cost : (baseSkill.cost || 50)
        };

        const strongArm = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_THROW_RANGE'));
        if (strongArm && (skillData.subType === 'THROW' || skillData.subType === 'BOMB' || ((skillData.type === 'ITEM' || skillData.type === 'CONSUME') && skillData.rng > 0))) {
            skillData.rng += 1;
        }

        if (this.selectedSkill && this.selectedSkill._slotKey === slotKey) {
            this.selectedSkill = null;
            this.confirmingSkill = null;
            this.attackableHexes = [];
            this.log("취소됨", "log-system");
            console.log(`[디버그: 10단계] 동일 아이템 재클릭으로 타겟팅 취소됨.`);
        } else {
            this.selectedSkill = skillData; 
            console.log(`[디버그: 11단계] 최종적으로 시스템에 등록된 selectedSkill 상태:`, this.selectedSkill);
            
            const tType = String(skillData.target || 'ENEMY').toUpperCase().trim();
            const rng = parseInt(skillData.rng) || 0;
            const area = parseInt(skillData.area) || 0;
            const isDirectional = String(skillData.area || '0').toUpperCase().includes('CLEAVE');

            const isAutoTarget = ['SELF', 'GLOBAL', 'ALLY_ALL', 'ENEMY_ALL', 'AREA_ALL'].includes(tType) || 
                                 (tType === 'AREA_ENEMY' && area >= 99) || 
                                 (rng === 0 && !isDirectional);

            if (isAutoTarget) {
                this.confirmingSkill = this.selectedSkill; 
                this.hoverHex = { q: u.q, r: u.r }; 
                this.attackableHexes = []; 
                console.log(`[디버그: 12단계] 사거리 0 자동 타겟팅 모드 진입. (확인 버튼 띄울 준비)`);
            } else {
                this.confirmingSkill = null;
                if (this.rangeManager) {
                    this.attackableHexes = this.rangeManager.getAttackableHexes(u, skillData);
                }
                this.log(`[${item.name}] 조준... (타겟을 클릭하세요)`, "log-system");
                console.log(`[디버그: 12단계] 수동 타겟팅 모드 진입. 계산된 공격 가능 범위(장판):`, this.attackableHexes);
            }
        }

        if (this.ui) {
            console.log(`[디버그: 13단계] UI 화면 갱신 함수들 호출함.`);
            this.ui.updateFloatingControls();
            this.ui.updateStatusPanel();
            this.ui.updateCursor();
        }
        console.log(`================================\n`);
    }

    cancelAction() {
        const u = this.currentUnit;
        if (!u || this.actions.acted) return;
        
        // ⭐ 메뉴창의 '취소'를 눌렀을 때 행동력(WT)이 차오르는 어뷰징 버그 원천 삭제
        // 스킬 선택을 무르는 것은 '행동'이 아니므로 아무런 페널티나 보상 없이 창만 닫아야 합니다.
        
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
            this.ui.updateStatusPanel();
            this.ui.updateCursor();
            if (this.ui.updateRightPanel) this.ui.updateRightPanel([], null); 
        }
    }

    endTurn(manual = false) { 
        const f = document.getElementById('floating-controls'); 
        if(f) f.classList.add('hud-hidden'); 

        this.teleportTarget = null; 
        if (this.ui && typeof this.ui.playTurnEndAnimation === 'function') {
            this.ui.playTurnEndAnimation();
        }

        // ⭐ 신규: 턴이 끝날 때, 현재 유닛이 시간 정지 시전자라면 턴 카운트를 차감
        if (this.activeTimeStop && this.activeTimeStop.caster === this.currentUnit) {
            this.activeTimeStop.remainingTurns--;
            if (this.activeTimeStop.remainingTurns <= 0) {
                this.resumeTime(); // 2회가 끝나면 시간정지 해제
            }
        }

        // =========================================================================
        // ⭐ [3단계 기획] 채널링/연주 중인 캐릭터가 이번 턴에 행동(이동/공격)했다면 집중 강제 해제!
        // =========================================================================
        if (this.currentUnit && this.currentUnit.curHp > 0 && this.currentUnit.buffs) {
            if (this.actions.moved || this.actions.acted) {
                const hasOldChannel = this.currentUnit.buffs.some(b => 
                    (b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')) && !b.isNew
                );
                
                if (hasOldChannel) {
                    this.currentUnit.buffs = this.currentUnit.buffs.filter(b => 
                        !((b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')) && !b.isNew)
                    );
                    this.currentUnit.isAuraSource = false;
                    this.currentUnit.auraEffects = [];
                    
                    this.showFloatingText(this.currentUnit, "집중 깨짐!", "#ffaa00");
                    this.log(`⚠️ 다른 행동을 취하여 ${this.currentUnit.name}의 채널링(집중)이 강제로 해제되었습니다!`, 'log-bad');
                    
                    if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
                    if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                }
            }
        }

        // 오브젝트 및 벽 턴 패스
        if (this.currentUnit && (this.currentUnit.type === 'OBJECT' || this.currentUnit.isWall || (this.currentUnit.key && this.currentUnit.key.includes('ZONE')))) {
            this.currentUnit.actionGauge = 0; 
            this.actions = { moved: false, acted: false, realMoved: false };
            setTimeout(() => this.nextTurn(), 50); 
            return; 
        }

        // 지혈 판정
        if (!this.actions.realMoved && !this.actions.acted && this.hasStatus(this.currentUnit, 'STAT_BLEED')) {
            if (Math.random() < 0.5) {
                this.currentUnit.buffs = this.currentUnit.buffs.filter(b => 
                    (this.statusManager ? this.statusManager.normalizeAilment(b.type) : b.type) !== 'STAT_BLEED'
                );
                this.showFloatingText(this.currentUnit, "자연 지혈됨", "#fff");
                this.log(`🩸 ${this.currentUnit.name}의 상처가 지혈되었습니다.`, 'log-system');
            }
        }

        // 불길/얼음 전파
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
        
        // 평화 모드
        if (this.isPeaceful && !this.isTestMode) {
            this.actions = { moved: false, acted: false, realMoved: false };
            this.isProcessingTurn = false;
            this.updateStatusPanel();
            this.renderPartyList();
            this.updateCursor();
            if (this.currentUnit) this.centerCameraOnUnit(this.currentUnit);
            return;
        }

        // ⭐ [에러 수정] 채널링/스턴/차징 상태 판단 변수를 가장 적절한 위치에서 미리 선언!
        const isChanneling = this.currentUnit && this.currentUnit.buffs && this.currentUnit.buffs.some(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
        const isCharging = this.currentUnit && this.currentUnit.isCharging;
        const isSkipTurn = this.statusManager && this.statusManager.isIncapacitated(this.currentUnit);

        // 채널링이거나 차징중이면 무조건 행동한 것으로 간주 (WT 환불 방지)
        if (isChanneling || isCharging) {
            this.actions.moved = true;
            this.actions.realMoved = true;
            this.actions.acted = true;
        }

        if (isSkipTurn) {
            this.log(`${this.currentUnit.name}: [행동 불가] 턴을 넘깁니다.`, 'log-cc');
            this.showFloatingText(this.currentUnit, "행동 불가", '#ff00ff');
        }

        const didMove = this.actions.realMoved || this.actions.moved || false; 
        const didAct = this.actions.acted || false;
        
        let cost = 100; 
        let logMsg = "";

        // 행동력(WT/AG) 차감 계산
        if (this.currentUnit && this.currentUnit.curHp <= 0) {
            cost = 100;
            logMsg = "전투불능 상태 (턴 온전 소모)";
        } else if (isSkipTurn) {
            cost = 50;
            logMsg = "행동 불가 (WT 50% 반환)";
        } else if (isChanneling) {
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

        if (this.currentUnit) {
            this.currentUnit.actionGauge -= cost;
            this.log(`${this.currentUnit.name} ${logMsg} (-${cost} AG)`, 'log-system');
        }

        // 호문클루스 마나 공유
        const partnerId = this.currentUnit && (this.currentUnit.homunculusId || this.currentUnit.ownerId);
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

        // 턴 종료 패시브 처리
        if (this.currentUnit && this.currentUnit.curHp > 0 && this.currentUnit.skills) {
            const passives = this.currentUnit.skills.filter(s => 
                s.type === 'PASSIVE' && 
                (this.currentUnit.team !== 0 || (this.currentUnit.equippedSkills && this.currentUnit.equippedSkills.includes(s.id))) && 
                s.effects && s.effects.length > 0
            );
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

        // 훔친 스킬 수명 차감
        if (this.currentUnit && this.currentUnit.skills) {
            let lostStolen = false;
            for (let i = this.currentUnit.skills.length - 1; i >= 0; i--) {
                let s = this.currentUnit.skills[i];
                if (s && s.isStolen) {
                    s.stolenDuration--;
                    if (s.stolenDuration <= 0) {
                        this.log(`💨 시간이 지나 훔쳐온 [${s.name}] 스킬의 기억이 흩어집니다.`, 'log-system');
                        this.currentUnit.skills.splice(i, 1);
                        lostStolen = true;
                    }
                }
            }
            if (lostStolen && this.ui) this.ui.updateFloatingControls();
        }

        // 버프 지속시간 차감
        if (this.currentUnit && this.currentUnit.buffs) {
            for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
                const b = this.currentUnit.buffs[i];
                
                // ⭐ [수정] 오라 수신자(isAura)와 채널링 시전자 버프(CHANNELED)는 여기서 차감하지 않습니다.
                if (b.isAura || String(b.type).includes('CHANNELED')) continue; 

                if (b.isNew) {
                    b.isNew = false; 
                } else {
                    b.duration--;
                    if (b.duration <= 0) {
                        const removedBuff = this.currentUnit.buffs.splice(i, 1)[0];
                        
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

        if (isSkipTurn) {
            this.updateStatusPanel(); 
            this.renderPartyList(); 
        }
        
        setTimeout(() => this.nextTurn(), isSkipTurn ? 800 : 1000); 
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

    getMaxPockets(unit) {
        let base = 4;
        const expandPassive = (unit.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_EXPANDED_POCKET'));
        if (expandPassive) {
            const extra = parseInt(expandPassive.effects.find(e => e.type === 'PAS_EXPANDED_POCKET').val) || 4;
            base += extra;
        }
        return Math.min(8, base);
    }

    useItem(slotIndex) {
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted) return;

        const slotKey = `pocket${slotIndex + 1}`;
        let itemId = null; let item = null;

        // 1. 아이템 데이터 탐색
        if (u.equipment && u.equipment[slotKey]) {
            const eqData = u.equipment[slotKey];
            itemId = typeof eqData === 'object' && eqData !== null ? eqData.id : eqData;
            
            if (this.gameApp && this.gameApp.itemData && this.gameApp.itemData[itemId]) {
                item = this.gameApp.itemData[itemId];
            } else if (typeof ITEM_DATA !== 'undefined' && ITEM_DATA[itemId]) {
                item = ITEM_DATA[itemId];
            }
        }

        if (!item) { 
            this.log("사용할 아이템 정보를 찾을 수 없습니다.", "log-bad"); 
            return; 
        }

        // 기존 패널 및 장판 초기화 (UI 꼬임 방지)
        this.isMovingMode = false;
        this.reachableHexes = [];
        if (this.ui && this.ui.updateRightPanel) this.ui.updateRightPanel([], null);

        // ⭐ 2. [근본 해결] 억지 번역기를 완전히 삭제하고, items.js의 refSkill을 통해 skills.js의 원본 데이터를 그대로 뽑아옵니다.
        const refSkillId = item.refSkill || itemId;
        let baseSkill = null;

        if (typeof SKILL_DATABASE !== 'undefined' && SKILL_DATABASE[refSkillId]) {
            baseSkill = JSON.parse(JSON.stringify(SKILL_DATABASE[refSkillId]));
        }

        if (!baseSkill) {
            this.log(`[${item.name}]의 스킬 데이터를 찾을 수 없습니다.`, "log-bad");
            return;
        }

        // 뽑아온 원본 스킬 데이터에, 소모할 '주머니 슬롯' 정보와 'WT 코스트'만 살짝 덮어씌웁니다.
        let skillData = {
            ...baseSkill,
            _slotKey: slotKey,
            cost: item.cost !== undefined ? item.cost : (baseSkill.cost || 50)
        };

        // 3. 연금술사 패시브 (투척 사거리 증가) 반영
        const strongArm = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_THROW_RANGE'));
        if (strongArm && (skillData.subType === 'THROW' || skillData.subType === 'BOMB' || ((skillData.type === 'ITEM' || skillData.type === 'CONSUME') && skillData.rng > 0))) {
            skillData.rng += 1;
        }

        // 4. 타겟팅 로직 연결
        if (this.selectedSkill && this.selectedSkill._slotKey === slotKey) {
            this.selectedSkill = null;
            this.confirmingSkill = null;
            this.attackableHexes = [];
            this.log("취소됨", "log-system");
        } else {
            this.selectedSkill = skillData; 
            
            const tType = String(skillData.target || 'ENEMY').toUpperCase().trim();
            const rng = parseInt(skillData.rng) || 0;
            const area = parseInt(skillData.area) || 0;
            const isDirectional = String(skillData.area || '0').toUpperCase().includes('CLEAVE');

            const isAutoTarget = ['SELF', 'GLOBAL', 'ALLY_ALL', 'ENEMY_ALL', 'AREA_ALL'].includes(tType) || 
                                 (tType === 'AREA_ENEMY' && area >= 99) || 
                                 (rng === 0 && !isDirectional);

            if (isAutoTarget) {
                // 사거리가 0인 포션류: 누르자마자 '확인/취소' 버튼 띄움
                this.confirmingSkill = this.selectedSkill; 
                this.hoverHex = { q: u.q, r: u.r }; 
                this.attackableHexes = []; 
            } else {
                // 사거리가 있는 폭탄, 투척병: 빨간색/초록색 조준 장판 띄움
                this.confirmingSkill = null;
                if (this.rangeManager) {
                    this.attackableHexes = this.rangeManager.getAttackableHexes(u, skillData);
                }
                this.log(`[${item.name}] 조준... (타겟을 클릭하세요)`, "log-system");
            }
        }

        // 플로팅 UI 갱신 (확인 버튼 등장)
        if (this.ui) {
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
        
        // ⭐ [이슈 4 버그 해결] 마나가 부족해 시전이 거부되었을 때, 먹통이 되지 않게 UI 락을 풀어줍니다.
        if (u.curMp < skill.mp) { 
            this.log("마나가 부족합니다.", "log-bad"); 
            this.showFloatingText(u, "마나 부족", "#f55");
            
            this.selectedSkill = null;
            this.confirmingSkill = null;
            this.attackableHexes = [];
            this.hoverHex = null;
            
            if (this.ui) {
                const floatUI = document.getElementById('floating-controls');
                if (floatUI) floatUI.classList.add('hud-hidden');
                this.ui.updateStatusPanel();
                this.ui.updateFloatingControls();
                this.ui.updateCursor();
            }
            return; 
        }

        this.confirmingSkill = null; 
        this.hoverHex = null; 
        this.attackableHexes = []; 
        
        const floatUI = document.getElementById('floating-controls');
        if (floatUI) floatUI.classList.add('hud-hidden');

        this.skillProcessor.execute(u, u).then(() => {
            const isChannel = skill.effects && skill.effects.some(e => e.type.includes('CHANNELED'));
            if (isChannel) {
                this.triggerAuraPulse(u);
                
                if (u.buffs) {
                    u.buffs.forEach(b => {
                        if (b.type.includes('CHANNELED')) b.duration--;
                    });
                    
                    const active = u.buffs.filter(b => b.type.includes('CHANNELED') && b.duration > 0);
                    if (active.length === 0) {
                        u.buffs = u.buffs.filter(b => !b.type.includes('CHANNELED'));
                        u.isAuraSource = false;
                        u.auraEffects = [];
                        if (this.stopAuraRipple) this.stopAuraRipple(u);
                        if (this.updateAurasForUnit) this.units.forEach(unit => this.updateAurasForUnit(unit));
                    }
                }
            }
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
    // ⭐ [수정] 도약 및 이동 완료 시 시간의 흐름(Time Action) 트리거 추가
    async jumpUnit(unit, q, r) { 
        let heightCostPenalty = 0;
        if (this.rangeManager && typeof this.rangeManager.getStandingHeight === 'function') {
            const startH = this.rangeManager.getStandingHeight(unit.q, unit.r);
            const endH = this.rangeManager.getStandingHeight(q, r);
            // ⭐ [기획 반영] 기사가 고저차 2 이상 도약 시 이동력 1 추가 소모
            if (Math.abs(endH - startH) >= 2 && unit.job === '기사') {
                heightCostPenalty = 1; 
            }
        }

        const res = await this.movement.jumpUnit(unit, q, r); 
        if (res !== false) {
            if (heightCostPenalty > 0) {
                // 행동 포인트를 깎아 이동력 소모를 연출
                unit.actionGauge = Math.max(-100, unit.actionGauge - 25);
                this.log(`🧗 [중갑 페널티] 기사가 높은 지형을 오르며 추가 행동력을 소모했습니다.`, 'log-system');
            }
            if (this.ui && typeof this.ui.addTimeAction === 'function') {
                this.ui.addTimeAction(1);
            }
        }
        return res; 
    }
    async moveUnit(unit, q, r, cb) { 
        const res = await this.movement.moveUnit(unit, q, r, cb); 
        if (res !== false) {
            // ⭐ [기획 반영] 천지역전세: 유지 중 다른 장소로 이동하면 자세가 즉각 풀림
            const celestial = unit.buffs && unit.buffs.find(b => b.type === 'BUFF_CELESTIAL_REVERSAL');
            if (celestial && celestial.duration < 2) {
                unit.buffs = unit.buffs.filter(b => b !== celestial);
                this.log(`☯️ 이동을 하여 천지역전세가 해제되었습니다.`, 'log-system');
                this.showFloatingText(unit, "자세 풀림", "#ccc");
            }
            
            if (this.ui && typeof this.ui.addTimeAction === 'function') {
                this.ui.addTimeAction(1);
            }
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