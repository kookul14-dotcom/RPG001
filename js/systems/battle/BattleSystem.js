import { STAGE_DATA, CLASS_DATA, SKILL_DATABASE, TERRAIN_TYPES,EFFECTS, ITEM_DATA } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';
import { UI } from '../../render/uiController.js';
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
import { GameRenderer } from '../../render/renderer.js';

const getActivePassives = (unit) => {
    if (!unit || !unit.skills) return [];
    return unit.skills.filter(s => s.type === 'PASSIVE' && (unit.team !== 0 || (unit.equippedSkills && unit.equippedSkills.includes(s.id))));
};

// =========================================================================
// ⭐ [신규 추가] 적(Enemy) 장비 자동 장착 헬퍼 함수
// =========================================================================
function autoEquipEnemy(enemy, itemDB) {
    if (!enemy || !itemDB) return;
    
    if (!enemy.equipment) {
        enemy.equipment = { mainHand: null, offHand: null, body: null, head: null, legs: null, ring: null, neck: null };
    }

    const level = enemy.level || 1;
    let allowedTiers = [];
    if (level < 10) allowedTiers = ['T1.POOR', 'T2.COMMON'];
    else if (level < 20) allowedTiers = ['T3.UNCOMMON', 'T4.RARE'];
    else if (level < 40) allowedTiers = ['T4.RARE', 'T5.UNIQUE', 'T6.EPIC'];
    else if (level < 60) allowedTiers = ['T6.EPIC', 'T7.ANCIENT', 'T8.LEGENDARY'];
    else allowedTiers = ['T8.LEGENDARY', 'T9.MYTHIC', 'T10.TRANSCENDENT'];

    const allItems = Object.values(itemDB);

    // 무기 무작위 장착
    if (enemy.EquipableWeapons && enemy.EquipableWeapons !== 'NONE') {
        const allowedWeaponSubTypes = enemy.EquipableWeapons.split(',').map(s => s.trim().toUpperCase());
        const weaponPool = allItems.filter(item => 
            item.type === 'WEAPON' && allowedTiers.includes(item.grade) && allowedWeaponSubTypes.includes(String(item.subType).toUpperCase())
        );

        if (weaponPool.length > 0) {
            const randomWeapon = weaponPool[Math.floor(Math.random() * weaponPool.length)];
            enemy.equipment.mainHand = randomWeapon.id;

            if (randomWeapon.hands === '1H' && allowedWeaponSubTypes.includes('SHIELD')) {
                const shieldPool = allItems.filter(item => item.type === 'SHIELD' && allowedTiers.includes(item.grade));
                if (shieldPool.length > 0) {
                    enemy.equipment.offHand = shieldPool[Math.floor(Math.random() * shieldPool.length)].id;
                }
            }
        }
    }

    // 몸통 방어구 무작위 장착
    if (enemy.armorClass) {
        const armorClass = String(enemy.armorClass).toUpperCase();
        const bodyPool = allItems.filter(item => item.type === 'BODY' && allowedTiers.includes(item.grade) && String(item.subType).toUpperCase() === armorClass);
        if (bodyPool.length > 0) enemy.equipment.body = bodyPool[Math.floor(Math.random() * bodyPool.length)].id;

        const headPool = allItems.filter(item => item.type === 'HEAD' && allowedTiers.includes(item.grade) && String(item.subType).toUpperCase() === armorClass);
        if (headPool.length > 0) enemy.equipment.head = headPool[Math.floor(Math.random() * headPool.length)].id;
    }
}
// =========================================================================

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
        
        let _selectedSkill = null;
        Object.defineProperty(this, 'selectedSkill', {
            get: () => _selectedSkill,
            set: (val) => {
                _selectedSkill = val;
                if (val) {
                    this.turnActionCost = val.cost !== undefined ? val.cost : 20;
                }
            },
            configurable: true,
            enumerable: true
        });

        this.confirmingSkill = null;
        this.confirmingItemSlot = null;        
        this.actions = { moved: false, acted: false, realMoved: false, moveDist: 0, maxMoveDist: 0, actionCost: 0 };
        this.sharedTurnStates = {}; 
        this.turnActionCost = null; 
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
        
        if (window.renderer) {
            window.renderer.destroy(); 
        }
        this.renderer = new GameRenderer(grid.canvas, grid, this); 
        window.renderer = this.renderer; 

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

        // ⭐ [적 장비 자동 세팅 적용부]
        // initUnits를 통해 맵에 배치된 직후, 적(team === 1)들에게 무작위 장비를 쥐여줍니다.
        this.units.forEach(u => {
            if (u.team === 1 && !u.isWall && u.type !== 'OBJECT') {
                autoEquipEnemy(u, ITEM_DATA);
            }
        });

        // 원본 세이브 데이터와의 메모리 참조 끊기
        this.units.forEach(u => {
            if (u.skills) u.skills = JSON.parse(JSON.stringify(u.skills));
            if (u.equippedSkills) u.equippedSkills = JSON.parse(JSON.stringify(u.equippedSkills));
        });

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
        
        this.units.forEach(u => {
            if (u.team === 0) {
                u.cachedModifiers = null; 
                Formulas.updateUnitCache(u); 
                
                const maxHp = Formulas.getDerivedStat(u, 'hp_max');
                const maxMp = Formulas.getDerivedStat(u, 'mp_max');
                if (maxHp > 0) u.hp = maxHp;
                if (maxMp > 0) u.mp = maxMp;
                if (u.curHp > u.hp) u.curHp = u.hp;
                u.curMp = 0;
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
        
        // ⭐ [신규 추가] 시스템 파괴 시 자동전투 UI 및 상태 청소
        if (this.aiSystem && typeof this.aiSystem.clearAutoBattleState === 'function') {
            this.aiSystem.clearAutoBattleState();
        }

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
        
        // ⭐ [신규 추가] 전투 종료 시 자동전투 강제 해제 및 UI 삭제
        if (this.aiSystem && typeof this.aiSystem.clearAutoBattleState === 'function') {
            this.aiSystem.clearAutoBattleState();
        }

        // ⭐ [타르코프식 정비 1] 전투 종료 시 생존/사망자의 HP 상태를 세이브 데이터에 완벽히 보존
        if (this.gameApp && this.gameApp.gameState && this.gameApp.gameState.heroes) {
            this.units.forEach(u => {
                if (u.team === 0 && !u.isNPC && u.type !== 'OBJECT' && u.type !== 'SUMMON') { // 본대 영웅만
                    const originalHero = this.gameApp.gameState.heroes.find(h => h.id === u.id);
                    if (originalHero) {
                        originalHero.curHp = u.isFullyDead ? 0 : Math.max(0, u.curHp);
                        originalHero.curMp = 0; // MP는 기획에 따라 무조건 초기화(0)
                    }
                }
            });
            this.gameApp.saveGame();
        }
        
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
                cost: 20, mp: 0, rng: 1, area: 0, 
                effects: [{target: 'ENEMY_SINGLE', type: 'DMG_PHYS', val: 1, rng: 1, prob: 100}]
            };
        }
        basicSkill.cost = 20;

        const moveRange = this.actions.moved ? 0 : Formulas.getDerivedStat(u, 'mov');
        const dist = this.grid.getDistance(u, target);

        this.saveCameraState();
        await this.smoothCenterCameraOnUnit(u, 300);

        const isInRange = this.rangeManager.isTargetInValidRange(u, target, basicSkill);

        if (isInRange) {
            this.log("기본 공격!", "log-skill");
            
            const tDataStart = this.grid.getTerrainData(u.q, u.r);
            const tDataEnd = this.grid.getTerrainData(target.q, target.r);
            const startPos = this.grid.hexToPixel3D(u.q, u.r, tDataStart.h || 0);
            const targetPos = this.grid.hexToPixel3D(target.q, target.r, tDataEnd.h || 0);
            
            if (this.renderer && this.renderer.playVFX) {
                this.renderer.playVFX('SLASH', startPos, targetPos);
            }

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
                
                const taxCollectors = this.units.filter(u => u.team === 0 && u.curHp > 0 && getActivePassives(u).some(s => s.effects.some(e => e.type === 'PAS_GOLD_GAIN')));
                if (taxCollectors.length > 0) {
                    let maxMultiplier = 1.0;
                    taxCollectors.forEach(u => {
                        const eff = getActivePassives(u).find(s => s.effects.some(e => e.type === 'PAS_GOLD_GAIN')).effects.find(e => e.type === 'PAS_GOLD_GAIN');
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
                    if (this.ui && typeof this.ui.hideAllCombatUI === 'function') {
                        this.ui.hideAllCombatUI();
                    }

                    const modal = document.getElementById('battle-result-modal');
                    const title = document.getElementById('battle-result-title');
                    const desc = document.getElementById('battle-result-desc');
                    const modalBtns = document.querySelector('.modal-btns');
                    
                    if (modal) modal.style.zIndex = '9999999';

                    title.textContent = "VICTORY!"; 
                    title.style.color = "gold";
                    desc.innerText = `적을 모두 물리쳤습니다!\n\n${rewardMsg}`;

                    modalBtns.innerHTML = `
                        <button id="btn-return-map" style="background:#2b5876; border-color:#66a;">부대 복귀 및 부상자 치료</button>
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

    triggerAuraPulse(caster) {
        if (!caster || !caster.auraEffects || caster.auraEffects.length === 0) return;
        
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
                    
                    if (eff.type.includes('REGEN_HP')) {
                        hitByPulse = true;
                        const heal = Math.floor(Formulas.getDerivedStat(caster, 'atk_mag') * (parseFloat(eff.val) || 1));
                        unit.curHp = Math.min(unit.hp, unit.curHp + heal);
                        this.showFloatingText(unit, `+${heal}`, '#00ff00');
                    } 
                    else if (eff.type.includes('REGEN_MP')) {
                        hitByPulse = true;
                        const mpHeal = parseFloat(eff.val) || 10;
                        unit.curMp = Math.min(unit.mp, unit.curMp + mpHeal);
                        this.showFloatingText(unit, `+${mpHeal} MP`, '#55ccff');
                    }
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
            
            if (hitByPulse) {
                this.triggerShakeAnimation(unit);
                const el = document.getElementById(`unit-overlay-${unit.id}`);
                if (el) {
                    const ripple = document.createElement('div');
                    ripple.className = 'aura-ripple';
                    ripple.style.animationDuration = '0.8s';
                    el.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 800);
                }
            }
        });
    }

    interruptCasting(unit, isHit = false) {
        if (!unit || unit.curHp <= 0) return;
        
        let wasInterrupted = false;
        
        if (unit.isCharging) {
            unit.isCharging = false;
            unit.chargingSkill = null;
            unit.buffs = unit.buffs.filter(b => b.type !== 'BUFF_CASTING');
            wasInterrupted = true;
        }
        
        const hasChannel = unit.buffs && unit.buffs.some(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
        if (hasChannel) {
            unit.buffs = unit.buffs.filter(b => !(b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')));
            unit.isAuraSource = false;
            unit.auraEffects = [];
            if (this.stopAuraRipple) this.stopAuraRipple(unit);
            if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
            wasInterrupted = true;
        }

        if (wasInterrupted) {
            this.showFloatingText(unit, "집중 깨짐!", "#ff0000");
            
            if (isHit) {
                this.log(`💥 물리적 타격으로 인해 ${unit.name}의 시전이 강제로 취소되었습니다!`, 'log-bad');
                
                const cancelPassive = getActivePassives(unit).find(s => s.effects && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
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
            } else {
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
                    
                    const isDebuff = eff.type.includes('DEBUFF') || eff.type.includes('STAT_') || eff.type.includes('CC_');
                    if (isDebuff && !isAlly) {
                        const auraResist = getActivePassives(unit).some(s => s.effects && s.effects.some(e => e.type === 'PAS_AURA_RESIST'));
                        if (auraResist) return; 
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

    async nextTurn() {
        if (this.checkBattleEnd()) return;
        
        if (this.activeTimeStop && this.activeTimeStop.remainingTurns > 0) {
            this.currentUnit = this.activeTimeStop.caster;
            if (this.currentUnit.curHp <= 0) {
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

        if (this.globalTick === undefined) {
            this.globalTick = 0;
            const fastUnits = this.units.filter(u => u.curHp > 0 && getActivePassives(u).some(s => s.effects.some(e => e.type === 'PAS_FIRST_TURN')));
            fastUnits.forEach(u => {
                u.actionGauge = this.actionGaugeLimit; 
                this.log(`⚡ [즉각반응] ${u.name}이(가) 누구보다 빠르게 움직입니다!`, 'log-skill');
            });
        }

        let ready = [];
        
        while (true) {
            ready = this.units.filter(u => (u.curHp > 0 || u.isIncapacitated) && !u.isFullyDead && u.actionGauge >= this.actionGaugeLimit - 0.001);
            if (ready.length > 0) break;

            let timePassed = false;
            this.units.forEach(u => {
                if (u.type === 'OBJECT' || u.isWall) return; 

                if ((u.curHp > 0 || u.isIncapacitated) && !this.hasStatus(u, 'SHOCK') && !u.isFullyDead) {
                    let spd = Formulas.getDerivedStat(u, 'spd') || 1;
                    u.actionGauge += (spd * 0.15); 
                    timePassed = true;
                }
            });

            if (timePassed) {
                if (!this.globalTick) this.globalTick = 0;
                this.globalTick += 1;
                
                if (this.globalTick >= 50) {
                    this.globalTick = 0;
                    if (this.environment && this.environment.processEnvironmentTurns) {
                        this.environment.processEnvironmentTurns();
                    }
                }
                
                if (this.ui) {
                    if (this.ui.renderPartyList) this.ui.renderPartyList(); 
                    if (this.ui.renderUnitOverlays) this.ui.renderUnitOverlays(); 
                }

                await new Promise(r => setTimeout(r, 40)); 
            } else {
                break;
            }
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
            
            if (this.currentUnit.actionGauge > this.actionGaugeLimit) {
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

        if (!this.sharedTurnStates) this.sharedTurnStates = {};
        this.sharedTurnStates[this.currentUnit.id] = { 
            moved: this.actions.moved, 
            realMoved: this.actions.realMoved 
        };

        this.currentUnit = targetUnit;
        
        const targetState = this.sharedTurnStates[targetUnit.id] || { moved: false, realMoved: false };
        this.actions.moved = targetState.moved;
        this.actions.realMoved = targetState.realMoved;

        this.viewingUnit = this.currentUnit;
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.attackableHexes = [];
        this.expandedCategory = null; 
        
        this.log(`🔄 [의지 투사] 조작 대상이 ${this.currentUnit.name}(으)로 변경되었습니다.`, "log-system");
        
        this.centerCameraOnUnit(this.currentUnit);
        this.updateStatusPanel();
        this.updateFloatingControls();
        this.updateCursor();
        this.calcReachable();
    }

    executeTransposition() {
        const u1 = this.currentUnit;
        if (!u1) return;
        
        const targetId = u1.homunculusId || u1.ownerId;
        if (!targetId) return;
        
        const u2 = this.units.find(u => u.id === targetId && u.curHp > 0);
        if (!u2) return;

        if (this.actions.moved || (this.sharedTurnStates && this.sharedTurnStates[u2.id] && this.sharedTurnStates[u2.id].moved)) {
            this.log("이미 이동력을 소모하여 치환할 수 없습니다.", "log-bad");
            this.showFloatingText(u1, "이동력 부족", "#aaa");
            return;
        }

        const tempQ = u1.q; const tempR = u1.r;
        u1.q = u2.q; u1.r = u2.r;
        u2.q = tempQ; u2.r = tempR;

        this.actions.moved = true;
        this.actions.realMoved = true;
        if (!this.sharedTurnStates) this.sharedTurnStates = {};
        this.sharedTurnStates[u1.id] = { moved: true, realMoved: true };
        this.sharedTurnStates[u2.id] = { moved: true, realMoved: true };

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
                    this.currentUnit.icon = "🪦";
                    this.showFloatingText(this.currentUnit, `사망 유예 (${this.currentUnit.deathTimer})`, '#ff5555');
                    this.log(`⏳ ${this.currentUnit.name} 의식이 흐려집니다. (사망까지 ${this.currentUnit.deathTimer}턴 남음)`, 'log-system');                    this.triggerShakeAnimation(this.currentUnit);
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

        const nightPassive = getActivePassives(this.currentUnit).find(s => s.effects.some(e => e.type === 'PAS_ATNIGHT'));        
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
            
            this.triggerAuraPulse(this.currentUnit);

            this.currentUnit.buffs.forEach(b => {
                if (b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')) {
                    b.duration--;
                }
            });

            const activeChannels = this.currentUnit.buffs.filter(b => (b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED')) && b.duration > 0);

            if (activeChannels.length > 0) {
                const channelBuff = activeChannels[0]; 
                let cost = 15;
                if (channelBuff.maintainCount === undefined) channelBuff.maintainCount = 0;
                channelBuff.maintainCount++; 
                if (channelBuff.maintainCount >= 2) {
                    cost = Math.floor(cost * 0.5); 
                }

                const reducePassive = getActivePassives(this.currentUnit).find(s => s.effects.some(e => e.type === 'PAS_MP_COST_RED_CHANT' || e.type === 'PAS_MP_COST_RED_DANCE'));
                const incPassive = getActivePassives(this.currentUnit).find(s => s.effects.some(e => e.type === 'PAS_MP_COST_INC'));
                if (reducePassive) cost = Math.floor(cost * 0.8); 
                if (incPassive) cost = Math.floor(cost * 1.5);
                
                if (this.hasStatus(this.currentUnit, 'BUFF_ENCORE_FREE')) {
                    cost = 0;
                    this.currentUnit.buffs = this.currentUnit.buffs.filter(b => b.type !== 'BUFF_ENCORE_FREE');
                    this.showFloatingText(this.currentUnit, "앙코르! (MP 0)", "#ffdd00");
                    this.log(`👏 앙코르 효과로 이번 턴의 연주 유지비가 소모되지 않습니다!`, 'log-skill');
                }
                
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
                    this.currentUnit.buffs = this.currentUnit.buffs.filter(b => !b.type.startsWith('BUFF_CHANNELED') && !b.type.startsWith('DEBUFF_CHANNELED'));
                    this.showFloatingText(this.currentUnit, "Song Ended", "#aaa");
                    this.log(`마력이 고갈되어 노래가 중단되었습니다.`, 'log-bad');
                    this.currentUnit.isAuraSource = false;
                    this.currentUnit.auraEffects = [];
                    if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                    if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
                }
            } else {
                this.currentUnit.buffs = this.currentUnit.buffs.filter(b => !b.type.startsWith('BUFF_CHANNELED') && !b.type.startsWith('DEBUFF_CHANNELED'));
                this.currentUnit.isAuraSource = false;
                this.currentUnit.auraEffects = [];
                if (this.updateAurasForUnit) this.units.forEach(u => this.updateAurasForUnit(u));
                if (this.stopAuraRipple) this.stopAuraRipple(this.currentUnit);
                
                this.showFloatingText(this.currentUnit, "연주 완료!", "#aaa");
                this.log(`🎵 ${this.currentUnit.name}의 연주가 끝났습니다. 이번 턴부터 즉시 행동이 가능합니다!`, "log-system");
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
        
        const ensembleLead = this.units.find(unit => unit.isEnsembleCharging && unit.ensemblePartnerId === this.currentUnit.id && unit.curHp > 0);
        if (ensembleLead && !this.statusManager.isIncapacitated(ensembleLead) && !this.statusManager.isIncapacitated(this.currentUnit)) {
            this.showEnsembleResponseModal(ensembleLead, this.currentUnit);
            return; 
        } else if (ensembleLead) {
            ensembleLead.isEnsembleCharging = false;
            ensembleLead.ensembleSkill = null;
            this.log(`❌ 상태이상으로 인해 앙상블 시전이 강제로 취소되었습니다.`, "log-bad");
            this.showFloatingText(ensembleLead, "앙상블 취소", "#aaa");
        }

        this.regenResources(this.currentUnit);
        this.viewingUnit = this.currentUnit;
        
        this.actions = { moved: false, acted: false, realMoved: false, moveDist: 0, maxMoveDist: 0, actionCost: 0 };
        this.sharedTurnStates = {}; 

        this.currentUnit._autoPotionUsed = false;
        this.currentUnit._emergencyPotionUsed = false;
        
        if (this.currentUnit.cooldowns) {
            for (let sId in this.currentUnit.cooldowns) {
                if (this.currentUnit.cooldowns[sId] > 0) this.currentUnit.cooldowns[sId]--;
            }
        }
        const medBuff = this.currentUnit.buffs ? this.currentUnit.buffs.find(b => b.type === 'BUFF_MEDITATION') : null;
        if (medBuff) {
            const healHp = Math.floor((this.currentUnit.hp || 100) * 0.25);
            const healMp = Math.floor((this.currentUnit.mp || 50) * 0.25);
            this.currentUnit.curHp = Math.min(this.currentUnit.hp, this.currentUnit.curHp + healHp);
            this.currentUnit.curMp = Math.min(this.currentUnit.mp, this.currentUnit.curMp + healMp);
            this.showFloatingText(this.currentUnit, `+${healHp} / +${healMp}MP`, "#55ff55");
            this.log(`🧘 [운기조식] 맑은 기운이 전신을 돌아 체력과 마나가 크게 회복되었습니다!`, 'log-heal');
        }

        this.selectedSkill = null; 
        this.confirmingSkill = null;
        this.attackableHexes = []; 
        this.expandedCategory = null; 

        const gaugePassive = getActivePassives(this.currentUnit).find(s => s.effects && s.effects.some(e => e.type === 'PASSIVE_GAUGE'));
        if (gaugePassive) this.currentUnit.actionGauge += 10; 

        let skipTurn = false;

        if (this.statusManager && this.statusManager.isIncapacitated(this.currentUnit)) {
            this.log(`${this.currentUnit.name}: [행동 불가] 턴을 넘깁니다.`, 'log-cc');
            this.showFloatingText(this.currentUnit, "행동 불가", '#ff00ff');
            skipTurn = true;
        }
        
        for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
            const b = this.currentUnit.buffs[i];
            
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
    
    toggleCategory(catName) {
        if (this.expandedCategory === catName) {
            this.expandedCategory = null; 
        } else {
            this.expandedCategory = catName; 
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
            if (this.ui.updateRightPanel) this.ui.updateRightPanel([], null); 
        }
    }

    selectSkillFromFloat(sId) {
        const u = this.currentUnit;
        if (!u) return;
        if (this.actions.acted) return;

        this.isMovingMode = false;
        this.reachableHexes = [];
        
        if (this.ui && this.ui.updateRightPanel) this.ui.updateRightPanel([], null);

        if (sId === 'basic') {
            const basicId = u.equippedBasic || '1000';
            let rawBasic = u.skills.find(s => s.id === basicId);
            
            if (!rawBasic && typeof SKILL_DATABASE !== 'undefined') {
                rawBasic = SKILL_DATABASE[basicId];
            }
            
            if (!rawBasic) {
                rawBasic = {
                    id: '1000', name: '기본 공격', type: 'ACTIVE', target: 'ENEMY_SINGLE', 
                    cost: 20, mp: 0, rng: Formulas.getDerivedStat(u, 'rng') || 1, area: 0, 
                    effects: [{target: 'ENEMY_SINGLE', type: 'DMG_PHYS', val: 1, rng: Formulas.getDerivedStat(u, 'rng') || 1, prob: 100}]
                };
            } else {
                rawBasic.cost = 20; 
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

        const isEnsemble = rawSkill && rawSkill.category && rawSkill.category.includes('EN');
        if (isEnsemble) {
            const partnerClass = u.classKey.includes('BRD') ? 'DNC' : 'BRD';
            const partners = this.units.filter(p => p.team === u.team && p.curHp > 0 && p.classKey && p.classKey.includes(partnerClass) && this.grid.getDistance(u, p) <= 1);
            
            if (partners.length === 0) {
                this.log(`앙상블 스킬은 1칸 이내에 [${partnerClass === 'DNC' ? '무희' : '음유시인'}] 파트너가 있어야 합니다!`, "log-bad");
                this.showFloatingText(u, "파트너 부재", "#f55");
                return;
            }
            
            const totalMp = u.curMp + partners[0].curMp;
            const cost = parseInt(rawSkill.mp) || 0;
            if (totalMp < cost) {
                this.log(`두 사람의 합산 마나가 부족합니다! (합산: ${totalMp} / 필요: ${cost})`, "log-bad");
                this.showFloatingText(u, "합산 마나 부족", "#f55");
                return;
            }
            rawSkill._ensemblePartnerId = partners[0].id;
        }

        if (!rawSkill) {
            let foundItemSlot = -1;
            
            if (u.equipment) {
                for (let i = 0; i < 8; i++) {
                    const slotKey = `pocket${i + 1}`;
                    const eqItem = u.equipment[slotKey];
                    const itemId = typeof eqItem === 'object' && eqItem !== null ? eqItem.id : eqItem;
                    
                    if (itemId === sId) {
                        foundItemSlot = i;
                        break;
                    }
                }
            }
            
            if (foundItemSlot !== -1) {
                this.useItem(foundItemSlot);
                return;
            }
            return;
        }

        if (u.cooldowns && u.cooldowns[rawSkill.id] > 0) {
            this.log(`⏳ 재사용 대기 중입니다. (${u.cooldowns[rawSkill.id]}턴 남음)`, "log-bad");
            this.showFloatingText(u, "쿨다운!", "#aaa");
            this.selectedSkill = null;
            if (this.ui) { this.ui.updateFloatingControls(); this.ui.updateCursor(); }
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
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted) return;

        const slotKey = `pocket${slotIndex + 1}`;
        let itemId = null; let item = null;

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

        this.isMovingMode = false;
        this.reachableHexes = [];
        if (this.ui && this.ui.updateRightPanel) this.ui.updateRightPanel([], null);

        const refSkillId = item.refSkill || itemId;
        let baseSkill = null;
        
        if (typeof SKILL_DATABASE !== 'undefined' && SKILL_DATABASE[refSkillId]) {
            baseSkill = JSON.parse(JSON.stringify(SKILL_DATABASE[refSkillId]));
        }

        if (!baseSkill) {
            this.log(`[${item.name}]의 스킬 데이터를 찾을 수 없습니다.`, "log-bad");
            return;
        }

        let skillData = {
            ...baseSkill,
            _slotKey: slotKey,
            cost: item.cost !== undefined ? item.cost : (baseSkill.cost || 50)
        };

        const strongArm = getActivePassives(u).some(s => s.effects && s.effects.some(e => e.type === 'PAS_THROW_RANGE'));
        if (strongArm && (skillData.subType === 'THROW' || skillData.subType === 'BOMB' || ((skillData.type === 'ITEM' || skillData.type === 'CONSUME') && skillData.rng > 0))) {            
            skillData.rng += 1;
        }

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
            const areaStr = String(skillData.area || '0').toUpperCase();
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
                if (this.rangeManager) {
                    this.attackableHexes = this.rangeManager.getAttackableHexes(u, skillData);
                }
                this.log(`[${item.name}] 조준... (타겟을 클릭하세요)`, "log-system");
            }
        }

        if (this.ui) {
            this.ui.updateFloatingControls();
            this.ui.updateStatusPanel();
            this.ui.updateCursor();
        }
    }

    consumeItem(unit, slotKey) {
        if (unit.equipment && unit.equipment[slotKey]) unit.equipment[slotKey] = null; 
        else if (unit.pocket) unit.pocket = null; 
        
        this.actions.actionCost = 50;
        
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
        
        const isEnsemble = skill.category && skill.category.includes('EN');

        if (isEnsemble) {
            u.isEnsembleCharging = true;
            u.ensembleSkill = JSON.parse(JSON.stringify(skill));
            u.ensemblePartnerId = skill._ensemblePartnerId;
            
            this.showFloatingText(u, "앙상블 대기!", "#ff00ff");
            this.log(`🎶 ${u.name}이(가) 파트너의 화답을 기다리며 차징에 들어갔습니다.`, "log-skill");
            
            this.selectedSkill = null;
            this.confirmingSkill = null;
            this.actions.acted = true;
            this.actions.moved = true; 
            
            const floatUI = document.getElementById('floating-controls');
            if (floatUI) floatUI.classList.add('hud-hidden');
            
            setTimeout(() => this.endTurn(), 800);
            return;
        }

        if (!isEnsemble && u.curMp < skill.mp) { 
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

    showEnsembleResponseModal(lead, responder) {
        this.log(`🎭 ${responder.name}의 턴! ${lead.name}의 앙상블 제안을 확인합니다.`, "log-system");
        
        const isYes = confirm(`[앙상블 제안]\n${lead.name}이(가) 합동 스킬 [${lead.ensembleSkill.name}]을 준비 중입니다.\n함께 마나를 소모하고 스킬을 발동하시겠습니까?\n(승낙 시 이번 턴이 즉시 소모되며 다음 턴 행동이 제약됩니다.)`);
        if (isYes) {
            this.executeEnsembleSkill(lead, responder);
        } else {
            lead.isEnsembleCharging = false;
            lead.ensembleSkill = null;
            this.log(`❌ ${responder.name}이(가) 앙상블을 거절했습니다.`, "log-bad");
            this.showFloatingText(responder, "거절함", "#aaa");
            this.startTurnLogic(); 
        }
    }

    async executeEnsembleSkill(lead, responder) {
        this.log(`✨ 두 사람의 호흡이 완벽히 맞아떨어집니다! 앙상블 시작!`, "log-skill");
        this.showFloatingText(lead, "앙상블!", "#ff00ff");
        this.showFloatingText(responder, "앙상블!", "#ff00ff");
        
        const skill = lead.ensembleSkill;
        lead.isEnsembleCharging = false;
        lead.ensembleSkill = null;
        
        const totalMpCost = parseInt(skill.mp) || 0;
        let leadCost = Math.floor(totalMpCost / 2);
        let respCost = totalMpCost - leadCost;

        if (lead.curMp < leadCost) {
            respCost += (leadCost - lead.curMp);
            leadCost = lead.curMp;
        } else if (responder.curMp < respCost) {
            leadCost += (respCost - responder.curMp);
            respCost = responder.curMp;
        }

        lead.curMp -= leadCost;
        responder.curMp -= respCost;

        skill._isEnsembleFired = true; 
        skill._ensembleResponder = responder;

        this.currentUnit = lead; 
        this.selectedSkill = skill;
        
        if (this.ui) {
            const floatUI = document.getElementById('floating-controls');
            if (floatUI) floatUI.classList.add('hud-hidden');
            this.ui.lockedTargetPanel = true;
        }
        
        await this.skillProcessor.execute(lead, lead);
        
        if (this.skillProcessor) {
            this.skillProcessor.applyStatus(lead, { type: 'DEBUFF_ACTION_LOCK', duration: 1, val: 1, icon: '🔒', name: '행동 구속' }, lead);
            this.skillProcessor.applyStatus(responder, { type: 'DEBUFF_ACTION_LOCK', duration: 1, val: 1, icon: '🔒', name: '행동 구속' }, responder);
        }
        
        this.currentUnit = responder; 
        this.actions.acted = true;
        this.actions.moved = true;
        this.endTurn();
    }

    cancelAction() {
        const u = this.currentUnit;
        if (!u || this.actions.acted) return;
        
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

    async endTurn(manual = false) {
        const f = document.getElementById('floating-controls'); 
        if(f) f.classList.add('hud-hidden'); 

        this.teleportTarget = null; 
        if (this.ui && typeof this.ui.playTurnEndAnimation === 'function') {
            this.ui.playTurnEndAnimation();
        }

        if (this.activeTimeStop && this.activeTimeStop.caster === this.currentUnit) {
            this.activeTimeStop.remainingTurns--;
            if (this.activeTimeStop.remainingTurns <= 0) {
                this.resumeTime(); 
            }
        }

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

        if (this.currentUnit && (this.currentUnit.type === 'OBJECT' || this.currentUnit.isWall || (this.currentUnit.key && this.currentUnit.key.includes('ZONE')))) {
            this.currentUnit.actionGauge = 0; 
            this.actions = { moved: false, acted: false, realMoved: false };
            setTimeout(() => this.nextTurn(), 50); 
            return; 
        }

        if (!this.actions.realMoved && !this.actions.acted && this.hasStatus(this.currentUnit, 'STAT_BLEED')) {
            if (Math.random() < 0.5) {
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
        const isSkipTurn = this.statusManager && this.statusManager.isIncapacitated(this.currentUnit);

        if (isChanneling || isCharging) {
            this.actions.moved = true;
            this.actions.realMoved = true;
            this.actions.acted = true;
        }

        const didMove = this.actions.realMoved || this.actions.moved || false; 
        const didAct = this.actions.acted || false;
        
        let cost = 0; 
        let logMsg = "";

        if (this.currentUnit && this.currentUnit.curHp <= 0) {
            cost = 100;
            logMsg = "전투불능 상태 (턴 온전 소모)";
        } else if (isSkipTurn) {
            cost = 60;
            logMsg = "행동 불가 (기본 대기 소모)";
        } else if (isChanneling) {
            cost = 100;
            logMsg = "연주/춤 유지 (턴 온전 소모)";
        } else if (isCharging) {
            cost = 100;
            logMsg = "캐스팅 집중 (턴 온전 소모)";
        } else {
            let baseCost = 60; 
            let actCost = 0;
            let moveCost = 0;
            let logDetails = [`대기 60`];

            if (didAct) {
                if (this.actions.actionCost) {
                    actCost = this.actions.actionCost; 
                } else if (this.turnActionCost !== null) {
                    actCost = this.turnActionCost;
                } else {
                    actCost = 20; 
                }
                logDetails.push(`행동 ${actCost}`);
            }

            if (didMove) {
                const actualDist = this.actions.moveDist || this.grid.getDistance(this.turnStartPos, { q: this.currentUnit.q, r: this.currentUnit.r });
                let maxDist = this.actions.maxMoveDist || Formulas.getDerivedStat(this.currentUnit, 'mov') || 1;
                
                if (actualDist > maxDist) maxDist = actualDist;
                
                if (actualDist > 0 && maxDist > 0) {
                    moveCost = Math.round((actualDist / maxDist) * 20);
                    logDetails.push(`이동 ${moveCost} (${actualDist}/${maxDist}칸)`);
                }
            }

            cost = baseCost + actCost + moveCost;
            logMsg = `턴 종료 [${logDetails.join(' + ')}]`;
        }

        if (this.currentUnit) {
            this.currentUnit.actionGauge -= cost;
            this.log(`${this.currentUnit.name} ${logMsg} (-${cost} AG)`, 'log-system');

            if (this.currentUnit.curHp > 0 && !isSkipTurn && !isChanneling && !isCharging) {
                const savedWT = Math.max(0, 100 - cost);
                if (savedWT > 0) {
                    const maxMp = Formulas.getDerivedStat(this.currentUnit, 'mp_max') || 10;
                    const restBonusMp = Math.floor(maxMp * (savedWT / 400));
                    
                    if (restBonusMp > 0) {
                        this.currentUnit.curMp = Math.min(maxMp, this.currentUnit.curMp + restBonusMp);
                        this.showFloatingText(this.currentUnit, `휴식 +${restBonusMp} MP`, '#55ccff');
                    }
                }
            }
        }

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

        if (this.currentUnit && this.currentUnit.curHp > 0) {
            const passives = getActivePassives(this.currentUnit).filter(s => s.effects && s.effects.length > 0);
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

                if (trigger.type === 'PAS_WAIT_BONUS' && !didAct) {
                    const prob = parseFloat(trigger.prob) || 100;
                    if (Math.random() * 100 <= prob) {
                        this.log(`⏸️ [${passive.name}] ${this.currentUnit.name}이(가) 숨을 고르며 태세를 정비합니다!`, 'log-skill');
                        for (const act of actions) {
                            if (this.skillProcessor) this.skillProcessor.processEffect(act, this.currentUnit, this.currentUnit, this.currentUnit, {}, passive);
                        }
                    }
                }
            }

            const encorePassive = getActivePassives(this.currentUnit).find(s => s.effects && s.effects.some(e => e.type === 'PAS_DOUBLECAST'));
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

        if (this.currentUnit && this.currentUnit.buffs) {
            for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
                const b = this.currentUnit.buffs[i];
                
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
        
        if (UI && typeof UI.waitForAllTexts === 'function') {
            await UI.waitForAllTexts(); 
        } else {
            await new Promise(r => setTimeout(r, 400)); 
        }
        
        this.nextTurn(); 
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
        const expandPassive = getActivePassives(unit).find(s => s.effects && s.effects.some(e => e.type === 'PAS_EXPANDED_POCKET'));
        if (expandPassive) {
            const extra = parseInt(expandPassive.effects.find(e => e.type === 'PAS_EXPANDED_POCKET').val) || 4;
            base += extra;
        }
        return Math.min(8, base);
    }

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

    cleanup() { this.environment.cleanupChatter(); }
    spawnTownNPC(id, q, r, data) { this.environment.spawnTownNPC(id, q, r, data); }
    handleNPCInteraction(npc) { this.environment.handleNPCInteraction(npc); }
    startNPCChatter() { this.environment.startNPCChatter(); }
    placeTrap(q, r, type, casterId) { this.environment.placeTrap(q, r, type, casterId); }
    checkTileEvent(unit) { this.environment.checkTileEvent(unit); }
    detectHiddenObjects(unit) { this.environment.detectHiddenObjects(unit); }
    triggerSparkle(obj) { this.environment.triggerSparkle(obj); }

    initTestBattlefield() { this.sandbox.initTestBattlefield(); }
    executeSandboxAction(hex) { this.sandbox.executeSandboxAction(hex); }

    getLootTable(tierKey) { return this.lootManager.getLootTable(tierKey); }
    rollLoot(tierKey, unit) { return this.lootManager.rollLoot(tierKey, unit); }
    lootItem(itemId, sourceUnit) { this.lootManager.lootItem(itemId, sourceUnit); }

    gainActionXp(unit, amount) { this.progression.gainActionXp(unit, amount); }
    gainVictoryBonus() { this.progression.gainVictoryBonus(); }
    gainCombatPoints(caster, skill, isHit, target) { this.progression.gainCombatPoints(caster, skill, isHit, target); }
    checkLevelUp(unit) { this.progression.checkLevelUp(unit); }

    calcReachable() { this.movement.calcReachable(); }
    
    async jumpUnit(unit, q, r) { 
        let heightCostPenalty = 0;
        if (this.rangeManager && typeof this.rangeManager.getStandingHeight === 'function') {
            const startH = this.rangeManager.getStandingHeight(unit.q, unit.r);
            const endH = this.rangeManager.getStandingHeight(q, r);
            if (Math.abs(endH - startH) >= 2 && unit.job === '기사') {
                heightCostPenalty = 1; 
            }
        }

        const res = await this.movement.jumpUnit(unit, q, r); 
        if (res !== false) {
            if (heightCostPenalty > 0) {
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
        if (unit === this.currentUnit && this.actions.maxMoveDist === 0) {
            if (this.reachableHexes && this.reachableHexes.length > 0) {
                let maxD = 0;
                this.reachableHexes.forEach(h => {
                    const d = this.grid.getDistance(unit, h);
                    if (d > maxD) maxD = d;
                });
                this.actions.maxMoveDist = maxD || 1;
            } else {
                this.actions.maxMoveDist = Formulas.getDerivedStat(unit, 'mov') || 1;
            }
        }
        const startHex = { q: unit.q, r: unit.r };

        const res = await this.movement.moveUnit(unit, q, r, cb); 
        if (res !== false) {
            if (unit === this.currentUnit) {
                const actualDist = this.grid.getDistance(startHex, { q: unit.q, r: unit.r });
                this.actions.moveDist += actualDist;
            }

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

    initUnits(chapter, stage) { this.lifecycle.initUnits(chapter, stage); }
    spawnUnit(key, team, q, r, overrides, auraEffects) { this.lifecycle.spawnUnit(key, team, q, r, overrides, auraEffects); }
    handleDeath(unit, killer) { this.lifecycle.handleDeath(unit, killer); }
    
    collectTargets(effectData, targetHex, clickedUnit, caster, skill, options = {}) {
        return this.targetingManager.collectTargets(effectData, targetHex, clickedUnit, caster, skill, options);
    }
}