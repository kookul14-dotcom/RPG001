import { EFFECTS, PERK_DATA, ELEMENTS, SKILL_DATABASE } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';
import { CombatManager } from './CombatManager.js';
import { MovementEffectManager } from './MovementEffectManager.js';

export class SkillProcessor {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.combatManager = new CombatManager(battleSystem);
        this.movementEffect = new MovementEffectManager(battleSystem);
    }

    // ⭐ [신규 추가] 모든 스킬과 행동의 '통제탑' 역할을 하는 래퍼(Wrapper) 함수
    async execute(targetHex, targetUnit) {
        // 1. 스킬 시전 전, 이미 행동을 했었는지(acted) 상태를 기억해 둡니다.
        const alreadyActed = this.battle.actions.acted;
        
        // ⭐ [신규] 스킬 시전 시작 시, 전장의 모든 유닛의 '회피 표식'을 깨끗하게 초기화합니다.
        this.battle.units.forEach(u => u._missedSkill = false);

        // ⭐ [근본 해결] 어떠한 예외 상황(조건 불만족 조기 리턴 등)에서도 isProcessingTurn이 반드시 풀리도록 try-finally 적용
        try {
            // 2. 실제 모든 복잡한 스킬 로직은 기존 함수(이름을 바꾼 _executeCore)에게 통째로 맡깁니다.
            await this._executeCore(targetHex, targetUnit);
        } finally {
            // 시전이 완전히 끝났거나, 사거리 밖/조건 불일치로 스킬이 취소되었을 때 무조건 턴 락을 해제합니다.
            this.battle.isProcessingTurn = false;
            
            // 락이 정상적으로 해제되었으므로 플로팅 UI를 즉시 복구합니다.
            if (this.battle.ui) {
                this.battle.ui.updateFloatingControls();
            }
        }
        
        // 3. 스킬 처리가 끝난 직후, 이번 동작을 통해 행동이 완료(acted가 true가 됨)되었다면 부가 해제 로직 및 시간 증가
        if (this.battle.actions.acted) {
            const caster = this.battle.currentUnit;
            if (caster && caster.buffs) {
                // ⭐ [무투가 기획 반영] 천지역전세: 유지 중(2턴 째 등) 스킬/공격 등 다른 행동을 하면 자세가 즉각 풀림
                const celestial = caster.buffs.find(b => b.type === 'BUFF_CELESTIAL_REVERSAL');
                if (celestial && celestial.duration < 2) { 
                    caster.buffs = caster.buffs.filter(b => b !== celestial);
                    this.battle.showFloatingText(caster, "자세 풀림", "#ccc");
                    this.battle.log(`☯️ 다른 행동을 취하여 천지역전세가 해제되었습니다.`, 'log-system');
                }
            }

            if (!alreadyActed && this.battle.ui && typeof this.battle.ui.addTimeAction === 'function') {
                this.battle.ui.addTimeAction(1);
            }
        }
    }

    async _executeCore(targetHex, targetUnit) {
        const battle = this.battle;
        const u = battle.currentUnit;

        if (battle.actions.acted) return;
        if (!battle.selectedSkill) return;

        // 1. 초기 UI 및 타겟 락온 해제
        battle.attackableHexes = [];
        battle.hoverHex = null;
        battle.isProcessingTurn = true; 
        if (battle.ui) {
            const floatUI = document.getElementById('floating-controls');
            if (floatUI) floatUI.classList.add('hud-hidden');
            battle.ui.lockedTargetPanel = false;
            if (battle.ui.updateRightPanel) battle.ui.updateRightPanel([], null);
            battle.ui.updateCursor();
        }

        const isResurrection = battle.selectedSkill.effects && battle.selectedSkill.effects.some(e => ['RESURRECT', 'REVIVE', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL'].includes(String(e.type).toUpperCase()));        
        battle.units.forEach(unit => unit._missedSkill = false);

        if (!isResurrection && targetUnit && targetUnit.curHp <= 0) {
            battle.log("대상이 이미 전투 불능 상태입니다.", "log-bad");
            battle.selectedSkill = null;
            if (u.team === 0 && battle.ui) {
                battle.ui.updateFloatingControls();
                battle.ui.updateStatusPanel();
                battle.ui.updateCursor();
            }
            return;
        }
        
        // ⭐ [수정] 스킬 객체를 내부에서 재할당할 수 있도록 let으로 변경
        let skill = JSON.parse(JSON.stringify(battle.selectedSkill));

        // ============================================================================
        // ⭐ [근본 해결: 아이템-스킬 어댑터] CONSUME 타입 아이템을 실행 가능한 스킬 객체로 변환
        // ============================================================================
        if (skill.type === 'CONSUME') {
            const refSkillId = skill.refSkill || skill.id; 
            const realSkillData = SKILL_DATABASE[refSkillId];
            
            if (realSkillData) {
                const preservedSlotKey = skill._slotKey; 
                const originalItemId = skill.id;
                
                // 1. refSkill 데이터를 기반으로 새로운 스킬 객체 생성 (배열, 효과 등 복제)
                const mergedSkill = JSON.parse(JSON.stringify(realSkillData));
                
                // 2. _slotKey 추적 및 주입 (UI에서 넘어오지 않았을 경우 인벤토리 역추적)
                if (preservedSlotKey) {
                    mergedSkill._slotKey = preservedSlotKey;
                } else {
                    for (let i = 1; i <= 8; i++) {
                        const pocketItem = u.equipment[`pocket${i}`];
                        const itemId = typeof pocketItem === 'object' ? pocketItem.id : pocketItem;
                        if (itemId === originalItemId) {
                            mergedSkill._slotKey = `pocket${i}`;
                            break;
                        }
                    }
                }
                
                // 3. 엔진 내부 호환성(저주 무시, 차감 로직 등)을 완벽히 타게 하기 위해 타입을 ITEM으로 통일
                mergedSkill.type = 'ITEM';
                
                // 4. 기존 skill 변수를 완전히 덮어쓰기
                skill = mergedSkill;
            } else {
                battle.log(`[시스템] ${skill.name}의 발동 효과(refSkill: ${refSkillId})를 찾을 수 없습니다.`, "log-bad");
                battle.isProcessingTurn = false;
                battle.selectedSkill = null;
                if (battle.ui) battle.ui.updateFloatingControls();
                return;
            }
        }
        // ============================================================================

        this.applyPerks(skill, u);

        // ============================================================================
        // ⭐ [이슈 2 해결 1] 사거리 / 범위 보정치를 가장 먼저 계산합니다.
        // ============================================================================
        let rngBonus = Formulas.getStat(u, 'rng'); 
        let areaBonus = 0;
        let areaMult = 1.0; 
        
        if (u.buffs) {
            u.buffs.forEach(b => {
                if (b.type === 'BUFF_CAST_RANGE') rngBonus += (parseFloat(b.val) || 0);
                if (b.type === 'BUFF_CAST_AREA') areaBonus += (parseFloat(b.val) || 0);
            });
        }
        if (!battle.actions.moved && skill.atkType === 'MAG') {
            const focusPassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_CAST_RANGE'));
            if (focusPassive) rngBonus += parseInt(focusPassive.effects.find(e => e.type === 'PAS_CAST_RANGE').val) || 1;
        }
        const isSupport = skill.effects && skill.effects.some(e => e.type.startsWith('HEAL') || e.type.startsWith('BUFF') || e.type.startsWith('CLEANSE'));
        if (isSupport) {
            const rngSup = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_RANGE_SUP'));
            const areaSup = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AREA_SUP'));
            if (rngSup) rngBonus += 1;
            if (areaSup) areaBonus += 1;
        }
        const strongArm = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_THROW_RANGE'));
        if (strongArm && (skill.subType === 'THROW' || (skill.type === 'ITEM' && (parseInt(skill.rng) || 0) > 0))) {
            rngBonus += 1;
        }
        const isChantSkillCategory = skill.category && (skill.category.includes('HM') || skill.category.includes('RQ') || skill.category.includes('DR') || skill.category.includes('EP') || skill.category.includes('GF'));
        if (isChantSkillCategory) {
            const resonance = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_RANGE_CHANT_EXTEND'));
            if (resonance) {
                areaMult = parseFloat(resonance.effects[0].val) || 1.5;
                battle.log(`📡 [천상의 공명] 마력이 울려퍼지며 노랫소리가 전장 멀리까지 뻗어나갑니다!`, "log-skill");
            }
        }
        if ((areaBonus > 0 || areaMult > 1.0) && skill.effects) {
            skill.effects.forEach(eff => {
                const currentArea = parseInt(eff.area || skill.area) || 0;
                if (currentArea > 0 && currentArea < 99) {
                    eff.area = Math.floor((currentArea + areaBonus) * areaMult); 
                }
            });
        }

        // ============================================================================
        // ⭐ [이슈 2 해결 2] 타겟팅 및 사거리 유효성 검증을 아이템 소모 전(최상단)으로 끌어올렸습니다.
        // ============================================================================
        if (skill.effects && skill.effects.some(e => e.type && e.type.startsWith('NT_'))) {
            const checkTarget = targetHex || targetUnit;
            if (checkTarget && battle.grid.getDistance(u, checkTarget) !== 1 && parseInt(skill.rng) === 1) {
                battle.log("연성술은 시전자와 인접한 타일(1칸)을 눌러 방향 지정해야 합니다.", "log-bad");
                battle.showFloatingText(u, "사거리 밖!", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateStatusPanel(); battle.ui.updateCursor(); }
                return; 
            }
        }

        const tType = String(skill.target || 'ENEMY').toUpperCase().trim();        
        let effectiveTarget = targetHex || (battle.hoverHex ? {q: battle.hoverHex.q, r: battle.hoverHex.r} : null);
        
        if (!effectiveTarget) {
            if (['SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'PASSIVE'].includes(tType) || 
               (tType === 'AREA_ENEMY' && (parseInt(skill.area)||0) >= 99) ||
               parseInt(skill.rng) === 0) {
                effectiveTarget = u;
            } else if (skill.effects && skill.effects.some(e => ['RESURRECT', 'REVIVE', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL'].includes(String(e.type || '').toUpperCase()))) {
                const rng = (parseInt(skill.rng) || 1) + rngBonus;
                const corpses = battle.units.filter(c => c.curHp <= 0 && c.team === u.team && battle.grid.getDistance(u, c) <= rng);
                
                if (corpses.length === 1) {
                    effectiveTarget = { q: corpses[0].q, r: corpses[0].r };
                } else {
                    battle.log(corpses.length > 1 ? "대상이 여러 명입니다. 묘비를 정확히 클릭하세요." : "사거리 내에 부활시킬 대상이 없습니다.", "log-system");
                    battle.selectedSkill = null;
                    if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateStatusPanel(); battle.ui.updateCursor(); }
                    return; 
                }
             }
        }

        const isGlobalSkill = ['SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'PASSIVE'].includes(tType) || 
                              (tType === 'AREA_ENEMY' && (parseInt(skill.area)||0) >= 99) ||
                              parseInt(skill.rng) === 0 ||
                              (skill.effects && skill.effects.some(e => ['ATK_ONMISLASH', 'ATK_RANDOM_DASH'].includes(e.type)));
        
        const isSpecialAction = skill.effects && skill.effects.some(e => {
            const eT = String(e.type || '').toUpperCase();
            return ['RESURRECT', 'REVIVE'].includes(eT) || eT.startsWith('SUMMON') || eT.startsWith('SYS_CREATE') || eT === 'SYS_DISPEL_STEALTH';
        });
        
        if (!isGlobalSkill && !isSpecialAction && !effectiveTarget) return;

        // 사거리 검사 (가장 중요)
        if (!isGlobalSkill && effectiveTarget) {
             let isValidRange = false;

             if (isSpecialAction) {
                 const dist = battle.grid.getDistance(u, effectiveTarget);
                 if (dist <= ((parseInt(skill.rng) || 1) + rngBonus)) {
                     isValidRange = true;
                 }
             }
             else if (u.team === 0 && !battle.isAutoBattle && battle.attackableHexes && battle.attackableHexes.length > 0) {
                 isValidRange = battle.attackableHexes.some(h => h.q === effectiveTarget.q && h.r === effectiveTarget.r);
             } else {
                 const checkSkill = { ...skill, rng: (parseInt(skill.rng) || 1) + rngBonus };
                 isValidRange = battle.rangeManager.isTargetInValidRange(u, effectiveTarget, checkSkill);
             }
             
             // 검사 실패 시 아이템/MP 소모 전에 함수 탈출!
             if (!isValidRange) { 
                 battle.log("사거리 밖이거나 장애물(벽)에 막혔습니다.", "log-bad"); 
                 battle.showFloatingText(u, "막힘/사거리 외", "#aaa");
                 battle.selectedSkill = null;
                 if (u.team === 0 && battle.ui) {
                     battle.ui.updateFloatingControls();
                     battle.ui.updateStatusPanel();
                     battle.ui.updateCursor();
                 }
                 return; 
             }
        }

        const isDashSkill = (skill.effects && skill.effects.some(e => ['ATK_DASH', 'MOVE_DASH'].includes(e.type))) || 
                            ['돌진', '돌격', '혈로', '강철의 행진'].includes(skill.name); 

        if (isDashSkill && effectiveTarget) {
            let parsedArea = 1;
            const upperArea = String(skill.area || '').toUpperCase();
            if (upperArea.includes('LINE_')) parsedArea = parseInt(upperArea.replace('LINE_', '')) || 1;
            else parsedArea = parseInt(skill.area) || 1;
            
            const range = parseInt(skill.rng) || parsedArea;
            const lineHexes = battle.grid.getLine(u, effectiveTarget, range);
            let blockedByAllyOrWall = false;
            let foundEnemy = false;
            let enemyCount = 0; 
            const isPierce = skill.name.includes('혈로');
            const isDash = skill.name.includes('돌진');

            for (const h of lineHexes) {
                if (h.q === u.q && h.r === u.r) continue;
                const terrainKey = battle.grid.getTerrain(h.q, h.r);
                if (!battle.grid.isPassable(terrainKey)) { blockedByAllyOrWall = true; break; }
                const occupant = battle.getUnitAt(h.q, h.r);
                if (occupant && occupant.curHp > 0) {
                    if (occupant.team === u.team) { blockedByAllyOrWall = true; break; }
                    else {
                        foundEnemy = true; enemyCount++;
                        if (isDash) break; 
                        else if (isPierce && enemyCount > 1) { blockedByAllyOrWall = true; break; }
                    }
                }
            }

            if (blockedByAllyOrWall) {
                battle.log("경로가 장애물이나 아군으로 막혀있습니다!", "log-bad");
                battle.showFloatingText(u, "경로 막힘!", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateStatusPanel(); battle.ui.updateCursor(); }
                return;
            }
            if (!foundEnemy && isDash) {
                battle.log("부딪힐 적이 없어 돌진할 수 없습니다!", "log-bad");
                battle.showFloatingText(u, "대상 없음!", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateStatusPanel(); battle.ui.updateCursor(); }
                return;
            }
        }

        // ============================================================================
        // 사거리 검사도 완벽히 통과했으므로, 이제부터 자원(MP, 아이템)을 깎을 준비를 합니다.
        // ============================================================================
        const trapEffect = skill.effects ? skill.effects.find(e => e.type === 'SYS_CREATE_TRAP' || e.type.startsWith('TRAP_')) : null;
        if (trapEffect) {
            let trapType = trapEffect.type;
            if (trapType === 'SYS_CREATE_TRAP') {
                if (skill.name.includes('철사') || skill.id === 'THF_23') trapType = 'TRAP_DEADLY_WIRE';
                else if (skill.name.includes('독')) trapType = 'TRAP_POISON_BARBS';
                else trapType = 'TRAP_STUN';
            }
            const storedEffects = skill.effects.filter(e => e.type !== 'SYS_CREATE_TRAP' && !e.type.startsWith('TRAP_'));            
            storedEffects.forEach(e => {
                if (!e.target || String(e.target).trim() === '-') e.target = 'SINGLE'; 
                if (e.area === undefined || String(e.area).trim() === '-') e.area = 0;
                if (String(e.rng).trim() === '-') e.rng = 0;
                if (String(e.val).trim() === '-') e.val = 0; 
            });
            
            let placeHexes = [{ q: targetHex.q, r: targetHex.r }];
            const areaStr = String(skill.area || '0').toUpperCase();
            
            if (areaStr !== '0' && areaStr !== 'SINGLE') {
                if (areaStr.includes('CLEAVE') || areaStr.includes('CONE') || areaStr.includes('LINE')) {
                    if (battle.grid.getShapeHexes) placeHexes = battle.grid.getShapeHexes(targetHex, u, areaStr);
                } else {
                    const radius = parseInt(skill.area) || 0;
                    if (radius > 0 && battle.grid.getHexesInRange) placeHexes = battle.grid.getHexesInRange(targetHex, radius);
                }
            }

            let placedCount = 0;
            placeHexes.forEach(h => {
                if (battle.grid.isPassable(h.q, h.r)) {
                    if (battle.environment) battle.environment.placeTrap(h.q, h.r, trapType, u.id, storedEffects, skill);
                    placedCount++;
                }
            });

            if (placedCount > 0) {
                battle.actions.acted = true;
                battle.log(`🪤 ${u.name}이(가) [${skill.name}]을(를) 치밀하게 설치했습니다. (총 ${placedCount}칸)`, 'log-skill');
                if (skill.isStolen || skill.name.includes('[모방]')) {
                    u.skills = u.skills.filter(s => s.id !== skill.id);
                    battle.log(`💨 1회용 스킬 [${skill.name}]을(를) 사용하여 잊어버렸습니다.`, 'log-system');
                }
            } else {
                battle.log(`❌ 덫을 설치할 수 있는 빈 공간이 없습니다.`, 'log-bad');
            }
            
            battle.selectedSkill = null;
            battle.attackableHexes = [];
            battle.hoverHex = null;
            
            if (battle.ui) {
                battle.ui.lockedTargetPanel = false;
                if (battle.ui.updateRightPanel) battle.ui.updateRightPanel([], null); 
                battle.ui.updateFloatingControls(); 
                battle.ui.updateCursor();
            }
            battle.renderPartyList();
            battle.updateStatusPanel();
            return; 
        }

        if (skill.id === 'SOR_44') {
            if (!battle.teleportTarget) {
                battle.saveCameraState();
                await battle.smoothCenterCameraOnUnit(u, 300);

                const selectedUnit = targetUnit || battle.getUnitAt(targetHex.q, targetHex.r);
                if (selectedUnit && selectedUnit.curHp > 0) {
                    battle.teleportTarget = selectedUnit;
                    battle.log(`🌀 [순간이동] ${selectedUnit.name} 선택됨! 전송할 빈 공간을 클릭하세요.`, "log-skill");
                    battle.showFloatingText(selectedUnit, "순간이동...", "#0ff");
                    await battle.smoothCenterCameraOnUnit(selectedUnit, 300);
                    return; 
                } else {
                    battle.log("순간이동시킬 대상을 먼저 선택하세요.", "log-system");
                    await battle.restoreCameraState(); 
                    return;
                }
            } else {
                if (battle.getUnitAt(targetHex.q, targetHex.r) || !battle.grid.isPassable(targetHex.q, targetHex.r)) {
                    battle.log("이동할 수 없는 위치입니다. 빈 공간을 클릭하세요.", "log-system");
                    return;
                }
            }
        }

        if (skill.desc && skill.desc.includes('이동을 포기하고') && battle.actions.moved) {
            battle.log("이미 이동하여 이 스킬을 사용할 수 없습니다.", "log-bad");
            battle.showFloatingText(u, "이동 후 사용 불가", "#f55");
            battle.selectedSkill = null;
            if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateStatusPanel(); battle.ui.updateCursor(); }
            return;
        }

        if (!skill._isChargeCompleted) {
            let concentrationBroken = false;
            if (u.isCharging) {
                u.isCharging = false;
                u.chargingSkill = null;
                u.chargeTurnLimit = 0;
                u.buffs = u.buffs.filter(b => b.type !== 'BUFF_CASTING');
                if (battle.stopCastRipple) battle.stopCastRipple(u);
                concentrationBroken = true;
            }
            const hasChanneling = u.buffs.some(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
            if (hasChanneling) {
                u.buffs = u.buffs.filter(b => !b.type.startsWith('BUFF_CHANNELED') && !b.type.startsWith('DEBUFF_CHANNELED'));
                u.isAuraSource = false;
                u.auraEffects = []; 
                if (battle.stopAuraRipple) battle.stopAuraRipple(u);
                if (battle.updateAurasForUnit) battle.units.forEach(unit => battle.updateAurasForUnit(unit));
                concentrationBroken = true;
            }
            if (concentrationBroken) {
                battle.log(`💢 새로운 행동으로 인해 ${u.name}의 기존 집중(채널링/캐스팅)이 해제되었습니다.`, "log-system");
            }
        }

        if (!skill.effects || skill.effects.length === 0) {
            skill.effects = [];
            if (skill.main) skill.effects.push(skill.main);
            if (skill.sub) skill.effects.push(skill.sub);
        }        

        const isSilenced = battle.statusManager ? battle.statusManager.isSilenced(u) : false;
        if (isSilenced && (skill.atkType === 'MAG' || skill.type === 'MAGIC' || skill.id.startsWith('SOR'))) {
            battle.log("😶 침묵 상태! 마법을 사용할 수 없습니다.", "log-cc");
            battle.showFloatingText(u, "침묵!", "#aaa");
            return;
        }

        const isCursed = battle.statusManager ? battle.statusManager.isCursed(u) : false;
        const basicId = u.equippedBasic || '1000';
        if (isCursed && skill.id !== basicId && skill.type !== 'ITEM') {
            battle.log("👻 저주 상태! 스킬을 사용할 수 없습니다.", "log-cc");
            battle.showFloatingText(u, "저주!", "#808");
            return;
        }

        if (skill.reqWeapon && skill.reqWeapon.length > 0) {
            const weaponId = u.equipment ? u.equipment.mainHand : null;
            const offHandId = u.equipment ? u.equipment.offHand : null;
            const weapon = weaponId ? this.battle.gameApp.itemData[weaponId] : null;
            const shield = offHandId ? this.battle.gameApp.itemData[offHandId] : null;
            const mainType = weapon ? weapon.subType : (u.classKey === 'ALCHEMIST' ? 'ALCHEMY_BAG' : 'FIST');
            const subType = shield ? shield.subType : 'NONE';
            
            const isMatch = skill.reqWeapon.includes(mainType) || skill.reqWeapon.includes(subType);
            if (!isMatch) {
                battle.log(`⛔ 필요한 무기가 아닙니다! (${skill.reqWeapon.join(', ')})`, "log-system");
                battle.showFloatingText(u, "Weapon Invalid", "#f55");
                return; 
            }
        }

        const cType = skill.effects && skill.effects.length > 0 ? String(skill.effects[0].type).toUpperCase() : '';
        const cTarget = targetHex || targetUnit;
        
        if (cTarget && cType.startsWith('NT_')) {
            const tData = battle.grid.getTerrainData(cTarget.q, cTarget.r) || {};
            const tKey = String(tData.key || '').toUpperCase();
            let isValid = true;
            
            if (cType === 'NT_THORN' && !(tKey === 'PLAIN' || tKey.includes('GRASS') || tKey.includes('FOREST'))) isValid = false;
            else if (cType === 'NT_MAGMA' && !(tKey === 'PLAIN' || tKey.includes('GRASS') || tKey.includes('FOREST') || tKey.includes('VOLCANO'))) isValid = false;
            else if (cType === 'NT_SOLIDIFY' && !(tKey.includes('WATER') || tKey.includes('WETLAND') || tKey.includes('SWAMP'))) isValid = false;
            else if (cType === 'NT_MAGNETIC' && !(tKey === 'PLAIN' || tKey.includes('GRASS') || tKey.includes('FOREST') || tKey.includes('ROCK') || tKey.includes('MOUNTAIN') || tKey.includes('VOLCANO') || tKey.includes('LAVA'))) isValid = false;
            else if ((cType === 'NT_UPDRAFT' || cType === 'NT_PILLAR' || cType === 'NT_TECTONIC') && (tKey.includes('INDOOR') || tKey.includes('CAVE') || tKey.includes('DUNGEON'))) isValid = false;

            if (!isValid) {
                battle.log("해당 지형에는 이 연성술을 시전할 수 없습니다.", "log-bad");
                battle.showFloatingText(u, "지형 불가", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateCursor(); }
                return;
            }
        }

        let consumedItemSlots = [];
        let isFreeCastItem = false;

        if (skill.itemCost && skill.itemCost.length > 0) {
            const ultFormula = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ULTIMATE_FORMULA'));
            if (ultFormula) {
                const prob = parseFloat(ultFormula.effects.find(e=>e.type==='PAS_ULTIMATE_FORMULA').prob) || 20;
                if (Math.random() * 100 <= prob) {
                    isFreeCastItem = true;
                    battle.log(`💡 [궁극의 공식] 완벽한 배합으로 재료를 소모하지 않습니다!`, 'log-skill');
                    battle.showFloatingText(u, "재료 보존!", "#0ff");
                }
            }

            let tempInv = {}; 
            for (let i = 1; i <= 8; i++) {
                const eqData = u.equipment[`pocket${i}`];
                if (eqData) {
                    const itemId = typeof eqData === 'object' ? eqData.id : eqData;
                    const count = typeof eqData === 'object' ? (eqData.count || 1) : 1;
                    if (!tempInv[itemId]) tempInv[itemId] = [];
                    tempInv[itemId].push({ slot: `pocket${i}`, count: count });
                }
            }

            let hasAllItems = true;
            let tempDeductions = [];

            for (const reqItemId of skill.itemCost) {
                if (tempInv[reqItemId] && tempInv[reqItemId].length > 0) {
                    let targetPocket = tempInv[reqItemId][0];
                    targetPocket.count--;
                    tempDeductions.push({ slot: targetPocket.slot, id: reqItemId });
                    if (targetPocket.count <= 0) {
                        tempInv[reqItemId].shift();
                    }
                } else {
                    hasAllItems = false;
                    break;
                }
            }

            if (!hasAllItems) {
                battle.log("조합에 필요한 재료 아이템이 부족합니다!", "log-bad");
                battle.showFloatingText(u, "재료 부족!", "#f55");
                return;
            }

            if (!isFreeCastItem) {
                consumedItemSlots = tempDeductions;
            }
        }

        let mpCost = 0;
        let freecastBuff = null;
        if (u.buffs) freecastBuff = u.buffs.find(b => b.type === 'BUFF_SYS_FREECAST');
        let isAllMp = false; 

        if (String(skill.mp).toLowerCase() === 'all') {
            mpCost = u.curMp;
            isAllMp = true; 
        } else {
            mpCost = parseInt(skill.mp) || 0;
        }

        const isChantSkill = skill.effects && skill.effects.some(e => e.type.includes('CHANNELED') || e.type === 'SYS_CHARGE');
        if (isChantSkill && !isAllMp) { 
            const chantRed = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MP_COST_RED_CHANT' || e.type === 'PAS_MP_COST_RED_DANCE'));            
            if (chantRed) mpCost = Math.floor(mpCost * 0.8);
        }
        
        if (freecastBuff && skill.type !== 'ITEM' && (!skill.itemCost || skill.itemCost.length === 0)) {
            mpCost = 0;
            skill.cost = 0;
            if (u.classKey && u.classKey.includes('THF')) { 
                battle.log("🥷 [도적의 극의] 훔쳐낸 스킬을 마나 소모 없이 시전합니다!", "log-skill");
            } else { 
                battle.log("🌟 [주문 기억] 마나와 행동력 소모 없이 시전합니다!", "log-skill");
            }
            battle.showFloatingText(u, "FREE CAST!", "#0ff");
            u.buffs = u.buffs.filter(b => b !== freecastBuff);
        } else if (!isAllMp && (!skill.itemCost || skill.itemCost.length === 0)) { 
            let mpRedMult = Formulas.getMult(u, 'PASSIVE_COST_RED', 'MP_COST'); 
            const isSupport = skill.effects && skill.effects.some(e => e.type.startsWith('HEAL') || e.type.startsWith('BUFF') || e.type.startsWith('CLEANSE'));
            if (isSupport) {
                const supRedPassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MP_COST_RED_SUP'));
                if (supRedPassive) mpRedMult *= 0.8; 
            }
            if (mpRedMult !== 1.0) mpCost = Math.floor(mpCost * mpRedMult);
        }

        const isUltimate = skill.type === 'ULTIMATE' || (skill.name && (skill.name.includes('필살기') || skill.name.includes('오의')));
        const utgCost = isUltimate ? 100 : 0; 

        if (isUltimate) {
            if ((u.utg || 0) < utgCost) {
                battle.log("필살기 게이지(UTG)가 부족합니다!", "log-system");
                battle.showFloatingText(u, "UTG 부족!", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0 && battle.ui) { battle.ui.updateFloatingControls(); battle.ui.updateStatusPanel(); battle.ui.updateCursor(); }
                return;
            }
            mpCost = 0; 
            battle.log(`🔥 ${u.name}이(가) 한계 돌파! 필살기 게이지를 개방합니다!`, 'log-skill');
        } else if ((!skill.itemCost || skill.itemCost.length === 0) && u.curMp < mpCost) {
            battle.log("MP가 부족합니다!", "log-system");
            battle.showFloatingText(u, "마나 부족", "#f55");
            return;
        }
        
        skill._consumedMp = mpCost;
        skill._isUltimate = isUltimate;
        skill._utgCost = utgCost;

        // 아이템 소모 스킬(_slotKey) 탐색 (실제 차감은 아래 Loop에서 실행)
        if (skill.id === '10001') {
            let reagentSlot = null;
            for(let i=1; i<=8; i++) {
                const item = u.equipment[`pocket${i}`];
                const id = typeof item === 'object' ? item.id : item;
                if (id === 'REAGENT_UNSTABLE') { reagentSlot = `pocket${i}`; break; }
            }
            if (!reagentSlot) {
                battle.log("불안정한 시약이 없습니다!", "log-bad"); battle.showFloatingText(u, "시약 없음!", "#f55"); return;
            }
            skill._slotKey = reagentSlot; 
            const rand = Math.random() * 100;
            let statusType = 'STATUS_POISON';
            if (rand < 30) statusType = 'STATUS_BURN';        
            else if (rand < 60) statusType = 'STATUS_POISON'; 
            else if (rand < 80) statusType = 'CC_FREEZE';      
            else if (rand < 90) statusType = 'AGGRO_CONFUSE'; 
            else statusType = 'CC_STUN';                     
            if (!skill.effects) skill.effects = [];
            skill.effects.push({ type: statusType, val: 1, duration: 2, prob: 100 });
            battle.log(`🧪 시약 효과: ${statusType}`, 'log-skill');
        }

        if (skill.id === '10003') {
            let potionSlot = null; let potionItem = null;
            for(let i=1; i<=8; i++) {
                const item = u.equipment[`pocket${i}`];
                const id = typeof item === 'object' ? item.id : item;
                if (id && id.includes('POTION')) { potionSlot = `pocket${i}`; potionItem = id; break; }
            }
            if (!potionSlot) {
                battle.log("던질 포션이 없습니다!", "log-bad"); battle.showFloatingText(u, "포션 없음!", "#f55"); return;
            }
            skill._slotKey = potionSlot;
            const itemData = this.battle.gameApp.itemData[potionItem];
            const baseHeal = itemData ? (itemData.val || 30) : 30;
            if (skill.effects && skill.effects.length > 0) skill.effects[0].val = baseHeal; 
        }

        const chargeEff = skill.effects.find(e => e.type === 'SYS_CHARGE');
        if (chargeEff && !skill._isChargeCompleted) {
            u.isCharging = true;
            u.chargingSkill = JSON.parse(JSON.stringify(skill)); 
            
            let chargeWait = parseInt(chargeEff.val) || 1;
            const highSpeedCalc = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_FAST_TRANSMUTE'));
            if (highSpeedCalc && skill.id.startsWith('NT_')) {
                chargeWait = Math.max(0, chargeWait - 1); 
            }
            
            u.chargeTurnLimit = chargeWait;    

            if (u.chargeTurnLimit === 0) {
                battle.log(`✨ [고속 연산] 연성술을 즉시 발동합니다!`, 'log-skill');
                skill._isChargeCompleted = true;
                u.isCharging = false;
            } else {
                battle.log(`🎶 ${u.name}이(가) [${skill.name}] 집중을 시작합니다! (${u.chargeTurnLimit}턴 후 발동)`, 'log-skill');
                battle.showFloatingText(u, "집중...", "#ffaa00");
                
                this.applyStatus(u, { type: 'BUFF_CASTING', duration: 99, val: 0 }, u);
                if (battle.startCastRipple) battle.startCastRipple(u);

                u.curMp -= mpCost;
                
                if (consumedItemSlots.length > 0) {
                    consumedItemSlots.forEach(deduction => {
                        const eqData = u.equipment[deduction.slot];
                        if (typeof eqData === 'object') {
                            eqData.count -= 1;
                            if (eqData.count <= 0) u.equipment[deduction.slot] = null;
                        } else {
                            u.equipment[deduction.slot] = null;
                        }
                    });
                }

                u.actionGauge -= (skill.cost || 50);
                battle.actions.acted = true;
                
                battle.selectedSkill = null;
                battle.confirmingSkill = null;
                battle.hoverHex = null;
                if (u.team === 0 && battle.ui) {
                    battle.ui.updateStatusPanel();
                    battle.ui.updateFloatingControls();
                    battle.ui.updateCursor();
                }
                return;
            }
        }

        if (skill._isChargeCompleted) {
            skill.effects = skill.effects.filter(e => e.type !== 'SYS_CHARGE');
            if (battle.stopCastRipple) battle.stopCastRipple(u);
        }

        if (skill.id === '10002') { 
            const dex = Formulas.getStat(u, 'dex');
            const luk = Formulas.getStat(u, 'luk');
            const baseScore = dex * 2; 
            const rollCount = 1 + Math.floor(luk / 10); 
            let bestRoll = 0;
            for(let i=0; i<rollCount; i++) {
                const roll = Math.floor(Math.random() * 100) + 1;
                if (roll > bestRoll) bestRoll = roll;
            }
            const totalScore = baseScore + bestRoll;
            let targetItemId = 'REAGENT_UNSTABLE'; 
            let createCount = 1;
            let msg = "시약 추출";
            let msgColor = '#aaa';

            if (totalScore >= 190) { targetItemId = 'CS_03'; msg = "기적의 조합! (상급)"; msgColor = '#ff00ff'; } 
            else if (totalScore >= 160) { targetItemId = 'CS_02'; msg = "정밀한 배합! (중급)"; msgColor = '#00ffff'; } 
            else if (totalScore >= 110) { targetItemId = 'CS_01'; msg = "조제 성공 (하급)"; msgColor = '#00ff00'; } 
            else { targetItemId = 'REAGENT_UNSTABLE'; msg = "배합 불안정..."; createCount = 2; msgColor = '#888'; }

            battle.showFloatingText(u, msg, msgColor);
            const itemInfo = this.battle.gameApp.itemData[targetItemId] || { name: targetItemId };
            battle.log(`${u.name} 조제: ${itemInfo.name} x${createCount} (점수: ${totalScore})`, 'log-skill');

            for(let i=0; i<createCount; i++) battle.lootItem(targetItemId, u);
            u.curMp -= mpCost;
            u.actionGauge -= (skill.cost || 50);
            battle.actions.acted = true;
            if(u.team === 0 && battle.ui) battle.ui.updateStatusPanel();
            return; 
        }

        const isEconCreate = skill.effects && skill.effects.some(e => e.type === 'ECON_CREATE' || e.type === 'ECON_ITEM_GET');
        if (isEconCreate) {
            let hasPocketSpace = false;
            const maxP = this.getMaxPockets(u);
            if (u.equipment) {
                for (let i = 1; i <= maxP; i++) {
                    if (!u.equipment[`pocket${i}`]) { hasPocketSpace = true; break; }
                }
            }
            if (!hasPocketSpace) {
                battle.log("주머니가 가득 차서 생성할 수 없습니다.", "log-system");
                battle.showFloatingText(u, "주머니 가득참!", "#f55");
                return; 
            }
        }
        
        if (skill.effects) { 
            skill.effects.sort((a, b) => {
                const getPriority = (eff) => {
                    const tType = String(eff.type).toUpperCase().trim();
                    if (tType.includes('BUFF') || tType.includes('ACC_')) return 1;
                    if (tType.includes('MOVE') || tType.includes('KNOCKBACK') || tType.includes('PUSH')) return 3;
                    return 2; 
                };
                return getPriority(a) - getPriority(b);
            });

            skill.effects.forEach(eff => {
                if(!eff.target || String(eff.target).trim() === '-') eff.target = skill.target; 
                if(eff.area === undefined || String(eff.area).trim() === '-') eff.area = skill.area;
                if(String(eff.rng).trim() === '-') eff.rng = skill.rng;
            });
        }

        const combatOptions = { skill: skill }; 
        const modifierTypes = ['ATK_SNIPE', 'DMG_TRUE', 'CON_DEATH', 'ATK_MULTI', 'ATK_SUREHIT', 'SYS_DMG_REDUCTION', 'ATK_ACC_BONUS', 'ATK_ACC_PENALTY'];

        const extractOptions = (effect) => {
            if (!effect) return;
            const eType = String(effect.type || '').toUpperCase().trim(); 
            
            if (modifierTypes.includes(eType) || eType.includes('TRUE')) {
                if (eType === 'ATK_SNIPE') { combatOptions.snipe = effect.val; combatOptions.maxRng = parseInt(skill.rng) || 6; }
                if (eType === 'DMG_TRUE' || eType.includes('TRUE')) combatOptions.penetrate = (parseFloat(effect.val) || 1.0);
                if (eType === 'DMG_TRUE_BYMP') { combatOptions.penetrate = 1.0; combatOptions.mpScale = true; }
                if (eType === 'CON_DEATH') combatOptions.instantDeath = parseFloat(effect.prob) || 10;
                if (eType === 'ATK_MULTI') combatOptions.hitCount = parseInt(effect.val) || 1;
                if (eType === 'ATK_SUREHIT') combatOptions.sureHit = true;
                if (eType === 'SYS_DMG_REDUCTION') combatOptions.dmgReduction = parseFloat(effect.val) || -0.1;
                
                if (eType === 'ATK_ACC_BONUS' || eType === 'ATK_ACC_PENALTY') {
                    combatOptions.accBonus = (combatOptions.accBonus || 0) + (parseFloat(effect.val) || 0);
                } else if (eType !== 'DMG_TRUE_BYMP') {
                    effect._isOptionOnly = true; 
                }
            }
            if (eType === 'DMG_PHYS_CRIT' || eType === 'DMG_MAG_CRIT') combatOptions.forceCrit = true;
            if (eType === 'DMG_PHYS_LOWHP' || eType === 'DMG_MAG_LOWHP') combatOptions.lowHpScale = true; 
            if (eType === 'DMG_TRUE_MP') {
                combatOptions.penetrate = 1.0; 
                combatOptions.consumeAllMp = true; 
            }
        };

        if (skill.effects) skill.effects.forEach(eff => extractOptions(eff));
        if (combatOptions.consumeAllMp) {
            const currentMp = u.curMp;
            u.curMp = 0; 
            combatOptions.bonusDmg = currentMp * (parseFloat(skill.val) || 1); 
        }

        let castCount = 1;
        let doubleCastMult = 1.0;
        let isSecondCastFree = false; 
        
        const doubleCastBuff = u.buffs.find(b => b.type === 'BUFF_DOUBLE_CAST');
        if (doubleCastBuff) {
            castCount = 2;
            battle.log("⏩ 이중 시전 발동!", 'log-skill');
            u.buffs = u.buffs.filter(b => b !== doubleCastBuff);
            battle.updateStatusPanel();
        } else {
            const doublePassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLECAST' || e.type === 'PAS_DOUBLECAST_FREE'));
            
            if (doublePassive && (skill.atkType === 'MAG' || skill.category?.includes('HM') || skill.category?.includes('RQ') || skill.category?.includes('EP'))) {
                const pEff = doublePassive.effects.find(e => e.type.startsWith('PAS_DOUBLECAST'));
                const prob = parseFloat(pEff.prob) || 30;
                
                let canDoubleCast = true;
                let logMsg = "🔁 [주문 반향] 마법이 메아리쳐 연속 발동됩니다!";

                if (pEff.type === 'PAS_DOUBLECAST_FREE') {
                    const reqLevel = parseInt(skill.req_class_lv) || 99;
                    if (reqLevel > 4) canDoubleCast = false;
                } else if (u.classKey && u.classKey.includes('BRD')) {
                    logMsg = "👏 [앙코르] 열렬한 호응에 힘입어 한 번 더 시전합니다!";
                    isSecondCastFree = true;
                }

                if (canDoubleCast && Math.random() * 100 <= prob) {
                    castCount = 2;
                    if (pEff.type === 'PAS_DOUBLECAST_FREE' || (u.classKey && u.classKey.includes('BRD'))) {
                        doubleCastMult = 1.0; 
                        isSecondCastFree = true; 
                    } else {
                        doubleCastMult = parseFloat(pEff.val) || 0.5; 
                    }
                    battle.log(logMsg, 'log-skill');
                }
            }
        }

        const shouldPan = skill.type !== 'ITEM' && battle.smoothCenterCameraOnUnit;

        if (shouldPan) {
            battle.saveCameraState();
            if (skill.id !== 'SOR_44') {
                await battle.smoothCenterCameraOnUnit(u, 300); 
                await new Promise(r => setTimeout(r, 150)); 
            }
        }

        // ==============================================================
        // ⚔️ 실제 스킬 시전 루프
        // ==============================================================
        for(let c = 0; c < castCount; c++) {
            if (c > 0) {
                await new Promise(r => setTimeout(r, 500));
                battle.log("⏩ 연속 시전!", 'log-skill');
            }

            if (c === 0 || (c > 0 && !isSecondCastFree)) { 
                if (consumedItemSlots.length > 0) {
                    consumedItemSlots.forEach(deduction => {
                        const eqData = u.equipment[deduction.slot];
                        if (typeof eqData === 'object') {
                            eqData.count -= 1;
                            if (eqData.count <= 0) u.equipment[deduction.slot] = null;
                        } else {
                            u.equipment[deduction.slot] = null;
                        }
                    });
                } else {
                    if (skill._isUltimate) {
                        u.utg -= skill._utgCost;
                        battle.showFloatingText(u, "UTG 소모!", "#ff5500");
                    } else {
                        u.curMp -= mpCost; 
                    }
                }

                // ⭐ [이슈 4 버그 해결] 소비 아이템을 루프 내에서 범용적으로 완벽하게 차감!
                if (skill.type === 'ITEM' && skill._slotKey) {
                    const eqData = u.equipment[skill._slotKey];
                    if (eqData) {
                        if (typeof eqData === 'object') {
                            eqData.count -= 1;
                            if (eqData.count <= 0) u.equipment[skill._slotKey] = null;
                        } else {
                            u.equipment[skill._slotKey] = null;
                        }
                        if (battle.ui && battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();
                    }
                }

                let costRed = Formulas.getDerivedStat(u, 'cost_red');                
                if (!costRed || costRed <= 0) costRed = 1.0; 
                
                const isSupportCost = skill.effects && skill.effects.some(e => e.type.startsWith('HEAL') || e.type.startsWith('BUFF') || e.type.startsWith('CLEANSE'));
                if (isSupportCost) {
                    const supWtPassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_WT_REDUCTION_SUP'));
                    if (supWtPassive) costRed *= 0.8; 
                }
                
                const consume = Math.floor((skill.cost || 50) * costRed); 
                u.actionGauge -= consume;
                
                if (u.team === 0) battle.gainActionXp(u, 10);

                if (effectiveTarget && effectiveTarget !== u && effectiveTarget.q !== undefined) {
                    const dir = battle.grid.getDirection(u, effectiveTarget);
                    if (u.facing !== dir) {
                        u.facing = dir;
                        if (battle.ui && battle.ui.renderUnitOverlays) battle.ui.renderUnitOverlays();
                        await new Promise(r => setTimeout(r, 150)); 
                    }
                }

                battle.log(`${u.name} [${skill.name}] 시전!`, 'log-skill');
                battle.showSpeechBubble(u, skill.name);

                await new Promise(r => setTimeout(r, 800));

                if (combatOptions.costHp) {
                    const hpCost = Math.floor(u.hp * combatOptions.costHp);
                    u.curHp = Math.max(1, u.curHp - hpCost);
                    battle.showFloatingText(u, `HP -${hpCost}`, '#f00');
                }
            } else {
                combatOptions.globalMult = doubleCastMult;
            }

            let isFirstEffect = true;
            if (skill.effects) {
                for (const eff of skill.effects) {
                    if (eff._isOptionOnly) continue; 
                    if (!isFirstEffect) await new Promise(r => setTimeout(r, 300)); 
                    await this.processEffect(eff, effectiveTarget, targetUnit, u, combatOptions, skill);
                    isFirstEffect = false;
                }
            }
        }

        // ==============================================================
        // 🔄 스킬 시전 후 마무리 연산 및 UI 복구
        // ==============================================================
        if (shouldPan) {
            if (skill.id !== 'SOR_44') {
                await battle.smoothCenterCameraOnUnit(u, 200); 
                await new Promise(r => setTimeout(r, 1000)); 
                await battle.restoreCameraState(600); 
            }
        }
        
        const hasDamageEffect = skill.effects && skill.effects.some(e => e.type.startsWith('DMG_') || e.type.startsWith('ATK_'));
        if (!hasDamageEffect && battle.gainCombatPoints && skill.type !== 'ITEM') {
            const primaryTarget = targetUnit || u; 
            battle.gainCombatPoints(u, skill, true, primaryTarget);
        }

        battle.actions.acted = true; 
        
        if (skill.isStolen || skill.name.includes('[모방]')) {
            u.skills = u.skills.filter(s => s.id !== skill.id);
            battle.log(`💨 1회용 스킬 [${skill.name}]을(를) 사용하여 잊어버렸습니다.`, 'log-system');
        }

        battle.renderPartyList();
        if (battle.ui && battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();

        const afterCastPassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_AFTER_CAST'));
        if (afterCastPassive && skill && skill.type !== 'ITEM' && !skill.isStolen) {
            const pEff = afterCastPassive.effects.find(e => e.type === 'PAS_AFTER_CAST');
            const prob = parseFloat(pEff.prob) || 100;
            if (Math.random() * 100 <= prob) {
                battle.log(`✨ [${afterCastPassive.name}] 스킬 시전 후 특수 효과가 발동합니다!`, 'log-skill');
                for (const effect of afterCastPassive.effects) {
                    if (effect.type !== 'PAS_AFTER_CAST') {
                        await this.processEffect(effect, u, u, u, { triggerUnit: u }, afterCastPassive);
                    }
                }
            }
        }

        if(u.team === 0) { 
            battle.selectedSkill = null; 
            if (battle.ui) battle.ui.updateFloatingControls(); 
        }
        if (battle.ui) battle.ui.updateCursor();
    }
    async processEffect(eff, targetHex, clickedUnit, caster, options = {}, skill = null) {
        const battle = this.battle;
        let type = String(eff.type || '').toUpperCase().trim(); 
        
        if (type === '-' || type === 'NONE' || type === '') {
            return { isHit: false };
        }

        let val = parseFloat(eff.val);
        if (isNaN(val) || String(eff.val).trim() === '-') val = (eff.mult !== undefined) ? parseFloat(eff.mult) : 1;
        if (isNaN(val)) val = 1;
        
        if (['IT_POTION', 'IT_HIPOTION', 'IT_XPOTION', 'MT_COAGULANT', 'MT_VITALITY', 'MT_HALLOWED', 'MT_ROYALJELLY'].includes(type)) {            type = 'HEAL_HP';
            if (val <= 1) val = 30; // 안전 장치
        }
        if (['IT_ETHER', 'IT_HIETHER', 'IT_XETHER', 'MT_MANADEW', 'MT_AWAKENING'].includes(type)) {
            type = 'HEAL_MP'; 
        }

        // =================================================================
        // ⭐ [수정] 시체 가격 방지 시스템 (단, 부활 스킬은 예외로 통과시킴!)
        // =================================================================
        const isResurrectionType = ['REVIVE', 'RESURRECT', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL', 'SYS_EXORCISE_CORPSE'].includes(type);

        // ⭐ [버그 수정 2] 직전 타격에 적이 죽었더라도, 타겟이 시전자 본인(SELF)인 효과(예: 도적의 뒤로 빠지기)는 취소되지 않고 끝까지 발동되도록 예외 처리!
        if (clickedUnit && clickedUnit.curHp <= 0 && !isResurrectionType) {
            if (String(eff.target).toUpperCase().trim() !== 'SELF') {
                return { isHit: false };
            }
        }
        // =================================================================

        const isDashEffect = ['MOVE_ATK', 'ATK_MOVE', 'ATK_DASH', 'MOVE_DASH', 'CHARGE', 'MOVE_CHARGE'].includes(type) || 
                             (skill && ['돌격', '돌진', '혈로', '강철의 행진'].includes(skill.name) && eff === skill.effects[0]);

        if (isDashEffect) {
            return await this.handleMoveAttack(caster, clickedUnit, targetHex, eff, skill, options);
        }
        if (type === 'ATK_JUMP') return await this.handleJumpAttack(caster, clickedUnit, eff, skill, options);
        
        if (type === 'MOVE_HITBACK') {
            const startQ = caster.q;
            const startR = caster.r;
            const targetEnemy = clickedUnit || battle.getUnitAt(targetHex.q, targetHex.r);

            if (targetEnemy) {
                const neighbors = battle.grid.getNeighbors(targetEnemy);
                let bestSpot = neighbors.find(n => battle.grid.isPassable(n.q, n.r) && !battle.getUnitAt(n.q, n.r));
                if (!bestSpot) bestSpot = { q: targetEnemy.q, r: targetEnemy.r };

                caster.q = bestSpot.q; caster.r = bestSpot.r; caster.visualPos = null;
                if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
                battle.centerCameraOnUnit(caster);
                battle.log("슉! 치고 빠지기!", "log-skill");
                await new Promise(r => setTimeout(r, 150));

                const dmgEff = skill.effects.find(e => e.type.startsWith('DMG_') || e.type.startsWith('ATK_'));
                if (dmgEff) {
                    dmgEff._isOptionOnly = true; 
                    const mult = parseFloat(dmgEff.val) || 1.0;
                    await this.combatManager.performAttack(caster, targetEnemy, mult, "비상각", false, caster.atkType || 'PHYS', 1, options);
                    await new Promise(r => setTimeout(r, 200));
                }

                caster.q = startQ; caster.r = startR; caster.visualPos = null;
                if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
                battle.centerCameraOnUnit(caster);
            }
            return; 
        }

        if (type === 'MOVE_TELEPORT' && skill && skill.id === 'SOR_44') {
            if (battle.teleportTarget) {
                const t = battle.teleportTarget;
                battle.teleportTarget = null; 
                
                t.q = targetHex.q; t.r = targetHex.r; t.visualPos = null;
                battle.showFloatingText(t, "순간 이동!", "#0ff");
                battle.log(`🌌 ${t.name}이(가) 지정된 위치로 전송되었습니다!`, "log-skill");
                if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(t);
                
                if (battle.smoothCenterCameraOnUnit) {
                    await battle.smoothCenterCameraOnUnit(t, 250);
                    await new Promise(r => setTimeout(r, 600)); 
                    
                    await battle.smoothCenterCameraOnUnit(caster, 300);
                    await new Promise(r => setTimeout(r, 300)); 
                    
                    await battle.restoreCameraState();
                } else {
                    battle.centerCameraOnUnit(t);
                }
            }
            return;
        }

            if (type === 'MOVE_BACK') {
                const backDir = (caster.facing + 3) % 6; 
                let dest = null;
                let isRandomDodge = false;
                
                let distance = parseInt(val) || 1;
                
                // ⭐ [버그 수정 3] 엔진의 정식 grid 함수를 사용하여 맵의 방향 축과 정확히 일치하는 좌표를 구합니다.
                // 1. 먼저 정방향(바로 뒤) 후퇴 타일 확인
                let currentHex = {q: caster.q, r: caster.r};
                let canMoveBack = true;
                
                for(let i=0; i<distance; i++) {
                    const nextHex = battle.grid.getNeighborInDir(currentHex, backDir);
                    if (nextHex && battle.grid.isPassable(nextHex.q, nextHex.r) && !battle.getUnitAt(nextHex.q, nextHex.r)) {
                        currentHex = nextHex;
                    } else {
                        canMoveBack = false;
                        break;
                    }
                }
                
                if (canMoveBack && (currentHex.q !== caster.q || currentHex.r !== caster.r)) {
                    dest = currentHex;
                } else {
                    // 2. [기획 반영] 뒤가 막혔다면 좌우 대각선 후방으로 랜덤 회피 기동 시도 (1칸 기준)
                    const leftDir = (caster.facing + 4) % 6;
                    const rightDir = (caster.facing + 2) % 6;
                    let candidates = [];
                    
                    let leftHex = battle.grid.getNeighborInDir(caster, leftDir);
                    if (leftHex && battle.grid.isPassable(leftHex.q, leftHex.r) && !battle.getUnitAt(leftHex.q, leftHex.r)) {
                        candidates.push(leftHex);
                    }
                    
                    let rightHex = battle.grid.getNeighborInDir(caster, rightDir);
                    if (rightHex && battle.grid.isPassable(rightHex.q, rightHex.r) && !battle.getUnitAt(rightHex.q, rightHex.r)) {
                        candidates.push(rightHex);
                    }
                    
                    if (candidates.length > 0) {
                        dest = candidates[Math.floor(Math.random() * candidates.length)];
                        isRandomDodge = true;
                    }
                }

                if (dest) {
                    if (isRandomDodge) {
                        battle.log(`💨 뒤가 막혀 좌우측 빈 공간으로 회피합니다!`, "log-skill");
                    } else {
                        battle.log(`💨 ${caster.name}이(가) 타격 직후 거리를 벌립니다!`, "log-skill");
                    }
                    
                    if (battle.moveSpriteOnly) {
                        await battle.moveSpriteOnly(caster, dest.q, dest.r, 200, false);
                    }
                    
                    caster.q = dest.q; caster.r = dest.r; caster.visualPos = null;
                    if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
                    battle.showFloatingText(caster, "회피 기동!", "#fff");

                    if (battle.smoothCenterCameraOnUnit) {
                        await battle.smoothCenterCameraOnUnit(caster, 250);
                    }
                } else {
                    battle.log("모든 퇴로가 막혀 회피할 수 없습니다!", "log-bad");
                    battle.showFloatingText(caster, "퇴로 막힘!", "#aaa");
                }
                return; 
            }

            if (type === 'SPECIAL_TIME_STOP' || type === 'SYS_TIME_STOP') {
                caster.actionGauge += 100; 
                battle.showFloatingText(caster, "시간 정지!", "#00ffff");
                battle.log(`⏳ ${caster.name}이(가) 전장의 시간을 멈췄습니다!`, 'log-skill');
                battle.activeTimeStop = { caster: caster, remainingTurns: 3 };
                caster.actionGauge = battle.actionGaugeLimit; 
                return;
            }

        if (type === 'MOVE_TELEPORT') {
            const targetEnemy = clickedUnit || battle.getUnitAt(targetHex.q, targetHex.r);
            let dest = targetHex || { q: caster.q, r: caster.r };

            if (targetEnemy) {
                const pushDir = battle.grid.getDirection(caster, targetEnemy);
                let pushDest = battle.grid.getNeighborInDir(targetEnemy, pushDir);
                
                if (!pushDest || !battle.grid.isPassable(pushDest.q, pushDest.r) || battle.getUnitAt(pushDest.q, pushDest.r)) {
                    const neighbors = battle.grid.getNeighbors(targetEnemy);
                    pushDest = neighbors.find(n => battle.grid.isPassable(n.q, n.r) && !battle.getUnitAt(n.q, n.r));
                }

                if (pushDest) {
                    battle.createProjectile(targetEnemy, pushDest);
                    targetEnemy.q = pushDest.q;
                    targetEnemy.r = pushDest.r;
                    targetEnemy.visualPos = null;
                    if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(targetEnemy);
                    battle.showFloatingText(targetEnemy, "튕겨남!", "#aaa");
                    dest = { q: targetHex.q, r: targetHex.r };
                } else {
                    const casterNeighbors = battle.grid.getNeighbors(targetEnemy);
                    const altDest = casterNeighbors.find(n => battle.grid.isPassable(n.q, n.r) && !battle.getUnitAt(n.q, n.r));
                    
                    if (altDest) {
                        dest = altDest;
                    } else {
                        dest = { q: targetHex.q, r: targetHex.r };
                        targetEnemy.q = caster.q;
                        targetEnemy.r = caster.r;
                        targetEnemy.visualPos = null;
                        if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(targetEnemy);
                    }
                }
            }

            caster.q = dest.q; 
            caster.r = dest.r; 
            caster.visualPos = null;
            
            if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
            battle.centerCameraOnUnit(caster);
            battle.triggerShakeAnimation(caster);
            battle.showFloatingText(caster, "도약!", "#ffaa00");
            battle.log(`☄️ ${caster.name}이(가) 하늘 높이 솟아올라 강하게 착지합니다!`, 'log-skill');
            
            await new Promise(r => setTimeout(r, 200));

            if (targetEnemy) {
                const dmgEff = skill.effects.find(e => e.type.startsWith('DMG_') || e.type.startsWith('ATK_'));
                if (dmgEff) {
                    dmgEff._isOptionOnly = true; 
                    const mult = parseFloat(dmgEff.val) || 1.0;
                    await this.performAttack(caster, targetEnemy, mult, skill.name, false, caster.atkType || 'PHYS', 1, options);
                }
            }
            return;
        }

        if (type === 'ATK_ONMISLASH' || type === 'ATK_RANDOM_DASH') {
            const hitCount = eff.val !== undefined ? Math.floor(parseFloat(eff.val)) : 5; 
            
            const startQ = caster.q;
            const startR = caster.r;

            const dmgEff = skill.effects.find(e => e.type.startsWith('DMG_'));
            const mult = dmgEff ? parseFloat(dmgEff.val) : 1.0;
            if (dmgEff) dmgEff._isOptionOnly = true; 

            for (let i = 0; i < hitCount; i++) {
                const aliveEnemies = battle.units.filter(u => u.team !== caster.team && u.curHp > 0);
                if (aliveEnemies.length === 0) break; 
                
                const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                
                let bestSpot = null;
                const dirs = [
                    {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
                    {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
                ];
                
                for (let d of dirs) {
                    const cq = targetEnemy.q + d.q;
                    const cr = targetEnemy.r + d.r;
                    
                    if (battle.grid.hexes && !battle.grid.hexes.has(`${cq},${cr}`)) continue;
                    
                    const occupant = battle.getUnitAt(cq, cr);
                    if (!occupant || occupant.id === caster.id) {
                        bestSpot = { q: cq, r: cr };
                        break;
                    }
                }
                
                if (!bestSpot) bestSpot = { q: targetEnemy.q, r: targetEnemy.r };

                caster.q = bestSpot.q; 
                caster.r = bestSpot.r;
                caster.visualPos = null; 

                if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
                if (caster === battle.currentUnit) battle.centerCameraOnUnit(caster);
                
                battle.triggerShakeAnimation(caster);
                battle.log(`⚡ [${skill.name || '심연의 습격'}] ${i+1}연참!`, 'log-skill');
                
                await this.performAttack(caster, targetEnemy, mult, skill.name || "심연의 습격", false, caster.atkType || 'PHYS', 1, options);
                await new Promise(r => setTimeout(r, 200)); 
            }
            
            caster.q = startQ; 
            caster.r = startR;
            caster.visualPos = null; 
            
            if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
            battle.centerCameraOnUnit(caster);
            battle.log(`💨 그림자 속에서 원래 자리로 돌아왔습니다.`, 'log-system');
            
            return;
        }
        
        if (type === 'SYS_FORCE_ATTACK') {
            const victim = clickedUnit || battle.getUnitAt(targetHex.q, targetHex.r);
            if (victim && victim.curHp > 0) {
                battle.log(`🎭 그림자에 조종당해 스스로를 공격합니다!`, 'log-cc');
                await this.performAttack(victim, victim, 1.0, "강제 자해", false, victim.atkType || 'PHYS', 1);
            } else {
                battle.showFloatingText(caster, "조종 실패", "#aaa");
            }
            return;
        }
        
        if (type === 'SYS_TRIGGER_ARCHER') {
            // ⭐ [궁수 기획 반영] 일제 사격 (아군 전체 사격)
            const archers = battle.units.filter(u => u.team === caster.team && u.curHp > 0 && u.id !== caster.id && (u.classKey?.includes('ARC') || u.atkType === 'RANGED'));
            battle.log(`🏹 전군, 사격 개시! 아군 사수들의 일제 사격!`, 'log-skill');
            
            // 시전자(메인 딜러) 본인도 기본 공격 1회 실행
            await this.performAttack(caster, clickedUnit, 1.0, "일제 사격(본대)", false, 'PHYS', 1, options);

            for (const archer of archers) {
                const dist = battle.grid.getDistance(archer, clickedUnit);
                if (dist <= Formulas.getDerivedStat(archer, 'rng')) {
                    battle.triggerShakeAnimation(archer);
                    await new Promise(r => setTimeout(r, 150));
                    await this.performAttack(archer, clickedUnit, 1.0, "지원 사격", false, 'PHYS', 1, options);
                    
                    // ⭐ 지원 사격한 궁수들은 피로도로 인해 다음 턴 행동이 늦어짐 (WT +20%)
                    const penaltyWt = Math.floor(battle.actionGaugeLimit * 0.2);
                    archer.actionGauge -= penaltyWt;
                    battle.showFloatingText(archer, "WT 지연", "#ff5555");
                }
            }
            return;
        }

        if (type === 'SYS_MAXIMIZE_CHANT') {
            const chants = caster.buffs.filter(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
            if (chants.length > 0) {
                chants.forEach(b => {
                    b.duration = 99; 
                    battle.showFloatingText(caster, "영원의 메아리!", "#00ffff");
                });
                // ⭐ [음유시인 기획 반영] 시전자의 이동 및 행동 구속을 해제하고 매 턴 MP 소모를 없애는 특수 플래그
                caster._isChantFree = true; 
                battle.log(`🔔 노래가 영원히 메아리칩니다! 이제 ${caster.name}은(는) 자유롭게 행동할 수 있습니다.`, 'log-skill');
                
                // 엔진의 시각적 피드백 연동
                if (battle.ui && battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();
            } else {
                battle.log("현재 부르고 있는 노래(채널링)가 없습니다.", "log-system");
                battle.showFloatingText(caster, "연장할 노래 없음", "#aaa");
            }
            return;
        }

        if (type === 'SYS_POISON_LAND') {
            const areaStr = eff.area || skill.area || '0';
            const center = targetHex || clickedUnit || caster;
            const hexes = battle.grid.getShapeHexes(center, caster, areaStr);
            let spawnedCount = 0;

            hexes.forEach(h => {
                const existingUnit = battle.getUnitAt(h.q, h.r);
                if (!existingUnit) {
                    battle.spawnUnit('ZONE_POISON', caster.team, h.q, h.r, { hp: 999, casterId: caster.id, duration: eff.dur || 2, type: 'OBJECT', isPassable: true, isAuraSource: true, icon: ' ', name: '' });
                    spawnedCount++;
                }
                else {
                    this.applyStatus(existingUnit, { type: 'STAT_POISON', val: 1, duration: 2, prob: 100 }, caster);
                }
            });
            if (spawnedCount > 0) battle.log(`☠️ 독구름이 퍼졌습니다!`, 'log-skill');
            else battle.log(`☠️ 독이 유닛들을 덮쳤습니다!`, 'log-skill');
            return;
        }

        if (type === 'SYS_DISPEL_STEALTH') {
            battle.log(`🎆 조명탄이 터지며 전장의 숨은 적들을 밝힙니다!`, 'log-skill');
            battle.units.forEach(u => {
                if (u.curHp > 0 && (battle.hasStatus(u, 'STEALTH') || battle.hasStatus(u, 'STAT_STEALTH'))) {
                    u.buffs = u.buffs.filter(b => b.type !== 'STEALTH' && b.type !== 'STAT_STEALTH');
                    battle.showFloatingText(u, "은신 해제!", "#ccc");
                    battle.triggerShakeAnimation(u);
                }
            });
            return;
        }
        else if (type === 'SYS_DETECT') {
            battle.log(`👁️ [탐지] 전장 내의 모든 숨겨진 보물과 함정이 드러납니다!`, 'log-skill');
            
            if (battle.hiddenObj) {
                battle.hiddenObj.forEach(obj => {
                    obj.detected = true;
                    battle.triggerSparkle(obj);
                });
            }
            if (battle.traps) {
                battle.traps.forEach(t => {
                    battle.showFloatingText({q: t.q, r: t.r}, "함정 발견!", "#ff5555");
                });
            }
            return;
        }
        else if (type === 'REMOVE_TILE_EFFECT') {
            const center = targetHex || clickedUnit || caster;
            const hexes = battle.grid.getShapeHexes(center, caster, eff.area || skill.area || 0);
            
            hexes.forEach(h => {
                const trapIdx = battle.traps.findIndex(tr => tr.q === h.q && tr.r === h.r);
                if (trapIdx !== -1) battle.traps.splice(trapIdx, 1);
                
                const zoneUnit = battle.getUnitAt(h.q, h.r);
                if (zoneUnit && (zoneUnit.type === 'OBJECT' || zoneUnit.key?.includes('ZONE'))) {
                    zoneUnit.curHp = 0; 
                }
            });
            battle.showFloatingText(center, "지형 효과 정화!", "#55ff55");
            battle.log(`✨ 불결한 지형 효과가 정화되었습니다!`, 'log-heal');
        }

        let realTargetHex = targetHex;
        if (targetHex && targetHex.q !== undefined && targetHex.hp === undefined) {
            const unitAtHex = battle.getUnitAt(targetHex.q, targetHex.r);
            if (unitAtHex) realTargetHex = unitAtHex;
        }

        let targets = battle.collectTargets(eff, realTargetHex, clickedUnit, caster, skill);

        // ⭐ [이슈 1 해결 - 2단계] 이펙트의 타겟이 'SELF'라면, 클릭한 대상이 적이더라도 무조건 시전자에게 버프가 들어가도록 강제 고정합니다. (조준사격 명중버프 누락 해결)
        if (String(eff.target).toUpperCase().trim() === 'SELF') {
            targets = [caster];
        } else if (eff._forcedTarget) {
            targets = [eff._forcedTarget];
        }

        // ==============================================================
        // ⭐ 부활 스킬 전용 타겟팅 및 처리 로직 (완벽 격리)
        // ==============================================================
        if (type === 'RESURRECT' || type === 'REVIVE' || type === 'SYS_RESURRECTION' || type === 'SYS_RESURRECTION_ALL') {            
            if (targets.length === 0) {
                const targetArea = eff.area || (skill ? skill.area : 'SINGLE');
                
                const center = targetHex || (clickedUnit ? {q: clickedUnit.q, r: clickedUnit.r} : null);
                if (!center) {
                    const rng = parseInt(skill ? skill.rng : 1) || 1; // 사거리 체크
                    // ⭐ [수정] !c.isFullyDead 조건을 추가하여 완전 사망자는 탐색에서 제외
                    const corpses = battle.units.filter(c => c.curHp <= 0 && !c.isFullyDead && c.team === caster.team && battle.grid.getDistance(caster, c) <= rng);
                    if (corpses.length === 1) {
                        center = { q: corpses[0].q, r: corpses[0].r };
                    }
                }
                if (!center) {
                    battle.log("대상을 정확히 선택해야 합니다.", "log-system");
                    return;
                }

                if (targetArea === 'SINGLE' || targetArea === 0 || targetArea === undefined) {
                    // ⭐ [수정] 헥스 내의 시체를 찾을 때도 완전 사망자는 제외
                    const deadUnit = battle.units.find(u => u.q === center.q && u.r === center.r && u.curHp <= 0 && !u.isFullyDead);
                    if (deadUnit && !targets.includes(deadUnit)) targets.push(deadUnit);
                } else {
                    const hexes = battle.grid.getShapeHexes(center, caster, targetArea);
                    hexes.forEach(h => {
                        // ⭐ [수정] 광역 부활 시에도 완전 사망자는 제외
                        const deadUnit = battle.units.find(u => u.q === h.q && u.r === h.r && u.curHp <= 0 && !u.isFullyDead);
                        if (deadUnit && !targets.includes(deadUnit)) targets.push(deadUnit);
                    });
                }
            }

            if (targets.length === 0) {
                battle.log("부활시킬 대상이 없습니다. (또는 이미 완전히 사망했습니다)", "log-system");
                return;
            }

            targets.forEach(t => {
                // ⭐ [수정] 방어 코드: 혹시라도 대상에 들어왔다면 강제 튕겨내기
                if (t.curHp > 0 || t.isFullyDead) return;

                const recoverHp = Math.floor(t.hp * (val || 0.3));
                t.curHp = Math.max(1, recoverHp);
                t.actionGauge = Math.floor(battle.actionGaugeLimit * 0.5);
                
                t.isDead = false;
                t.dead = false; 
                // ⭐ [추가] 전투불능 상태값 초기화
                t.isIncapacitated = false; 
                t.deathTimer = undefined;

                if (t.prevIcon) {
                    t.icon = t.prevIcon;
                    t.prevIcon = null; 
                } else {
                    t.icon = "👤";
                }
                
                if (!t.buffs) t.buffs = [];
                t.isCharging = false;
                t.chargingSkill = null;

                battle.showFloatingText(t, "부활!", "#ffdd00");
                battle.log(`✝️ 기적! ${t.name}이(가) 되살아났습니다!`, 'log-heal');
                battle.triggerShakeAnimation(t);
                
                if (battle.ui && battle.ui.renderUnitOverlays) battle.ui.renderUnitOverlays();
            });

            battle.renderPartyList();
            
            if (battle.ui && battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();
            if (battle.ui && battle.ui.updateFloatingControls) battle.ui.updateFloatingControls();
            
            return;
        }

        // ⭐ [성직자 기획 반영] 구마술 전용 타겟팅 및 처리 로직 (완전 사망 처리)
        if (type === 'SYS_EXORCISE_CORPSE') {
            const targetArea = eff.area || (skill ? skill.area : 'SINGLE');
            const center = targetHex || (clickedUnit ? {q: clickedUnit.q, r: clickedUnit.r} : null);
            let deadUndeadTargets = [];

            if (center) {
                if (targetArea === 'SINGLE' || targetArea === 0 || targetArea === undefined) {
                    const deadUndead = battle.units.find(u => u.q === center.q && u.r === center.r && u.curHp <= 0 && !u.isFullyDead && u.race === 'UNDEAD');
                    if (deadUndead) deadUndeadTargets.push(deadUndead);
                } else {
                    const hexes = battle.grid.getShapeHexes(center, caster, targetArea);
                    hexes.forEach(h => {
                        const deadUndead = battle.units.find(u => u.q === h.q && u.r === h.r && u.curHp <= 0 && !u.isFullyDead && u.race === 'UNDEAD');
                        if (deadUndead && !deadUndeadTargets.includes(deadUndead)) deadUndeadTargets.push(deadUndead);
                    });
                }
            }

            if (deadUndeadTargets.length > 0) {
                deadUndeadTargets.forEach(t => {
                    t.isFullyDead = true; 
                    battle.showFloatingText(t, "EXORCISED!", "#ffffaa");
                    battle.log(`✨ [구마술] 이미 목숨을 잃은 언데드(${t.name})의 잔해가 빛에 의해 완전 소멸했습니다!`, 'log-system');
                    battle.triggerShakeAnimation(t);
                });
                
                // 엔진 렌더러에서 완전히 지워지도록 필터링 처리
                battle.units = battle.units.filter(u => u.isFullyDead !== true);
                battle.renderPartyList();
                if (battle.ui && battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();
            } else {
                battle.log("소멸시킬 언데드 시체가 범위 내에 없습니다.", "log-system");
            }
            return;
        }

        // ⭐ [버그 수정] LINE_3, LINE_5 등 관통기 스킬의 범위(range) 숫자를 완벽하게 파싱합니다.
        const areaStringValue = String(skill ? skill.area : '').toUpperCase();
        if (skill && (skill.name === '폭풍의 궤적' || areaStringValue.includes('LINE') || areaStringValue === 'PIERCE')) {            const dest = targetHex || (clickedUnit ? {q: clickedUnit.q, r: clickedUnit.r} : null);
            if (dest) {
                let parsedRange = 6;
                if (areaStringValue.includes('LINE_')) {
                    parsedRange = parseInt(areaStringValue.replace('LINE_', '')) || 6;
                } else {
                    parsedRange = parseInt(skill.rng) || parseInt(skill.area) || 6;
                }
                const lineHexes = battle.grid.getLine(caster, dest, parsedRange);
                targets = lineHexes
                    .map(h => battle.getUnitAt(h.q, h.r)) 
                    .filter(u => u && u.curHp > 0 && u.id !== caster.id); 
            }
        }

        if (skill && skill.atkType === 'MAG') {
            const hasSafeAlly = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_AOE_SAFE_ALLY'));
            if (hasSafeAlly && targets.length > 1) {
                const originalLength = targets.length;
                targets = targets.filter(t => t.team !== caster.team);
                if (targets.length < originalLength) battle.log(`🛡️ [술식 조정] 아군이 휘말리지 않도록 궤도를 수정했습니다.`, 'log-system');
            }
        }
        targets.sort((a, b) => battle.grid.getDistance(caster, a) - battle.grid.getDistance(caster, b));
        let pierceIndex = 0;

        const isWallCreation = type.includes('WALL') && type !== 'SYS_BREAK_WALL';

        if (type.startsWith('SUMMON') || type.startsWith('SYS_CREATE') || isWallCreation) {
            
            if (type === 'SYS_CREATE_TRAP') {
                const trapHexes = battle.grid.getShapeHexes(targetHex || clickedUnit || caster, caster, eff.area || skill.area);
                let placedCount = 0;
                
                const trapType = (skill && skill.name.includes('철사')) ? 'TRAP_WIRE' : 'TRAP_STUN';
                
                trapHexes.forEach(h => {
                    if (battle.grid.isPassable(h.q, h.r) && !battle.getUnitAt(h.q, h.r)) {
                        battle.placeTrap(h.q, h.r, trapType, caster.id); 
                        placedCount++;
                    }
                });
                if (placedCount > 0) battle.log(`🪤 ${placedCount}칸에 함정을 설치했습니다!`, "log-system");
                else battle.log("덫을 설치할 수 있는 공간이 없습니다.", "log-system");
                return;
            }

            if (isWallCreation) {
                let key = 'WALL_STONE';
                let hpRatio = 0.5;
                let isPassableType = false;
                let duration = eff.dur || 2;
                let auraEff = null; 
                
                // ⭐ [기획 반영] 장벽 전용 속성 상성 데이터
                let wallImmunities = []; // 무효화 속성
                let wallWeaknesses = []; // 1.5배 피해 속성
                let wallBreakers = [];   // 즉시 파괴 속성

                const sName = (skill && skill.name) ? skill.name : '';
                if (type.includes('FIRE') || sName.includes('화염') || sName.includes('불')) { 
                    key = 'WALL_FIRE'; isPassableType = true; hpRatio = 99; 
                    wallBreakers = ['ICE', 'WIND', 'DMG_ICE', 'DMG_WIND'];
                    wallImmunities = ['FIRE', 'EARTH', 'LIGHTNING', 'DMG_FIRE', 'DMG_EARTH', 'DMG_LIGHTNING'];
                } 
                else if (type.includes('ICE') || sName.includes('빙') || sName.includes('얼음')) { 
                    key = 'WALL_ICE'; hpRatio = 0.3; auraEff = [{ type: 'DEBUFF_STAT_MOVE', val: 1, area: 1, target: 'ENEMY_ALL' }]; 
                    wallBreakers = ['FIRE', 'LIGHTNING', 'DMG_FIRE', 'DMG_LIGHTNING']; // 번개는 관통+파괴
                    wallImmunities = ['ICE', 'WIND', 'DMG_ICE', 'DMG_WIND'];
                } 
                else if (type.includes('EARTH') || sName.includes('토') || sName.includes('땅')) { 
                    key = 'WALL_EARTH'; hpRatio = 0.5; duration = 99; 
                    wallImmunities = ['LIGHTNING', 'DMG_LIGHTNING'];
                    wallWeaknesses = ['WIND', 'DMG_WIND', 'PHYS', 'DMG_PHYS'];
                }
                
                const centerTarget = targetHex || clickedUnit || caster;
                const areaStr = eff.area || (skill ? skill.area : null) || 'CLEAVE_3';
                const wallHexes = battle.grid.getShapeHexes(centerTarget, caster, areaStr);
                
                if (wallHexes.length === 0) return;

                let sumQ = 0, sumR = 0;
                wallHexes.forEach(h => { sumQ += h.q; sumR += h.r; });
                const trueCenterQ = Math.round(sumQ / wallHexes.length);
                const trueCenterR = Math.round(sumR / wallHexes.length);

                let spawnedCount = 0;
                let failedCount = 0;

                // ⭐ [버그 수정] 한 칸이라도 조건이 안 맞는다고 시전을 통째로 취소(return)하는 방식을 폐기하고,
                // 설치할 수 있는 타일에만 부분적으로 벽을 깔아주는 유연한 방식으로 변경했습니다.
                wallHexes.forEach((h) => {
                    const occupant = battle.getUnitAt(h.q, h.r);
                    const isThisCenter = (h.q === trueCenterQ && h.r === trueCenterR);
                    const canRideEarthCenter = (key === 'WALL_EARTH' && isThisCenter && occupant && occupant.team === caster.team);
                    
                    const terrainData = battle.grid.getTerrainData(h.q, h.r) || {};
                    const terrainKey = terrainData.key || '';
                    const isWater = terrainKey.includes('WATER') || terrainKey.includes('SWAMP') || terrainKey.includes('LAKE');
                    const isLava = terrainKey.includes('LAVA') || terrainKey.includes('MAGMA');

                    let canPlaceHere = true;

                    // 해당 타일의 개별적 제약 조건 검사
                    if (key === 'WALL_FIRE' && isWater) canPlaceHere = false;
                    if (key === 'WALL_ICE' && isLava) canPlaceHere = false;
                    
                    if (occupant) {
                        if (key === 'WALL_FIRE' || key === 'WALL_ICE') canPlaceHere = false;
                        else if (key === 'WALL_EARTH') {
                            if (!isThisCenter) canPlaceHere = false;
                            else if (occupant.team !== caster.team) canPlaceHere = false;
                        }
                    }

                    // 제약 조건에 걸렸다면 이 칸은 건너뛰고 다음 칸으로 (부분 시전)
                    if (!canPlaceHere) {
                        failedCount++;
                        // 시각적 피드백
                        battle.showFloatingText({q: h.q, r: h.r}, "형성 실패", "#aaa");
                        return;
                    }

                    // 정상 설치
                    let isWallObj = !isPassableType;
                    let isPassableObj = isPassableType;
                    let displayIcon = "🧱";
                    let displayName = "장벽";

                    if (key === 'WALL_FIRE') { displayIcon = "🔥"; displayName = "화염벽"; }
                    else if (key === 'WALL_ICE') { displayIcon = "🧊"; displayName = "빙벽"; }
                    else if (key === 'WALL_EARTH') {
                        if (isThisCenter) {
                            isWallObj = false;     
                            isPassableObj = true;
                            displayIcon = "🪨";    
                            displayName = "토벽(상단)";
                        } else {
                            displayIcon = "⛰️";    
                            displayName = "토벽";
                        }
                    }
                    
                    const summonHP = Math.floor(Formulas.getDerivedStat(caster, 'hp_max') * hpRatio) || 100;
                    
                    battle.spawnUnit(key, caster.team, h.q, h.r, { 
                        hp: summonHP, casterId: caster.id, duration: duration, lifespan: duration, 
                        isWall: isWallObj, isPassable: isPassableObj, icon: displayIcon, name: displayName,
                        immunities: wallImmunities, weaknesses: wallWeaknesses, breakers: wallBreakers
                    }, auraEff); 
                    spawnedCount++;
                    
                    if (canRideEarthCenter) {
                        battle.log(`⛰️ ${occupant.name}이(가) 솟아오른 토벽 위로 탑승합니다!`, "log-system");
                        battle.triggerShakeAnimation(occupant); 
                    }
                });

                if (spawnedCount > 0) {
                    battle.log(`🧱 장벽이 ${spawnedCount}칸에 생성되었습니다. ${failedCount > 0 ? `(지형/유닛으로 인해 ${failedCount}칸 생성 실패)` : ''}`, "log-skill");
                } else {
                    battle.log("장벽을 형성할 수 있는 유효한 공간이 단 한 곳도 없었습니다.", "log-bad");
                }
                
                return;
            }

            if (type === 'SYS_CREATE_GRAVITY') {
                if (targetHex && !battle.getUnitAt(targetHex.q, targetHex.r)) {
                    battle.spawnUnit('ZONE_GRAVITY', caster.team, targetHex.q, targetHex.r, { 
                        hp: 999, casterId: caster.id, duration: eff.dur || 2, type: 'OBJECT', isPassable: true, icon: '🌌', name: '중력장'
                    }, [{ type: 'STAT_GRAVITY', val: 1, dur: 1, area: 2, target: 'ENEMY_ALL' }]);
                    battle.log(`🌌 지정된 위치에 초고밀도 중력장이 형성되었습니다!`, "log-skill");
                } else battle.log("소환 공간 부족", 'log-system');
                return;
            }

            if (type === 'SYS_CREATE_WEB') {
                const hexes = battle.grid.getShapeHexes(targetHex || clickedUnit || caster, caster, eff.area || skill.area);
                hexes.forEach(h => {
                    const occupant = battle.getUnitAt(h.q, h.r);
                    if (occupant && occupant.team !== caster.team) {
                        battle.showFloatingText(occupant, "🕸️", "#ffffff");
                    }
                });
                battle.log(`🕸️ 끈적한 거미줄이 뿜어져 나와 적들의 발을 묶습니다!`, "log-skill");
                return; 
            }

            if (type === 'SYS_CREATE_DECOY' || type === 'SUMMON_DECOY' || type === 'SUMMON_MIMIC_BOX') {
                if (targetHex && !battle.getUnitAt(targetHex.q, targetHex.r)) {
                    let key = type.includes('FIRE') ? 'WALL_FIRE' : 'DECOY';
                    let summonName = '소환물';
                    let icon = '👤';
                    let isPassable = true;
                    
                    // ⭐ [기획 반영] 가짜 보물상자 전용 스펙 (동시 복수 생성 불가, 5턴 유지 등)
                    if (type === 'SUMMON_MIMIC_BOX') {
                        key = 'MIMIC_BOX';
                        summonName = '가짜 보물상자';
                        icon = '🎁';
                        isPassable = false;
                        
                        const existingBox = battle.units.find(u => u.key === 'MIMIC_BOX' && u.team === caster.team);
                        if (existingBox) {
                            existingBox.curHp = 0;
                            if (battle.handleDeath) battle.handleDeath(existingBox);
                        }
                    }

                    const summonHP = type === 'SUMMON_MIMIC_BOX' ? 1 : Formulas.calculateEffectPower(caster, type, val); 
                    battle.spawnUnit(key, caster.team, targetHex.q, targetHex.r, { 
                        hp: summonHP || 50, casterId: caster.id, duration: eff.dur || (type==='SUMMON_MIMIC_BOX'?5:3),
                        type: 'OBJECT', name: summonName, icon: icon, isPassable: isPassable 
                    });
                    battle.log(`${icon} ${summonName}이(가) 생성/설치되었습니다.`, "log-skill");
                } else {
                    battle.log("소환/설치 공간 부족", 'log-system');
                }
                return;
            }
            if (type === 'SUMMON_GOLEM' || type === 'SUMMON_HOMUNCULUS' || type === 'SYS_SPAWN_GOLEM' || type === 'SYS_SPAWN_HOMUN') {
                const summonKey = (type === 'SUMMON_GOLEM' || type === 'SYS_SPAWN_GOLEM') ? 'GOLEM' : 'HOMUNCULUS';                
                let spawnQ = targetHex ? targetHex.q : caster.q;
                let spawnR = targetHex ? targetHex.r : caster.r;
                
                if (battle.getUnitAt(spawnQ, spawnR)) {
                    const neighbors = battle.grid.getNeighbors({q: spawnQ, r: spawnR});
                    const emptyHex = neighbors.find(n => battle.grid.isPassable(n.q, n.r) && !battle.getUnitAt(n.q, n.r));
                    if (emptyHex) {
                        spawnQ = emptyHex.q;
                        spawnR = emptyHex.r;
                    } else {
                        battle.log("소환/연성할 빈 공간이 부족합니다.", 'log-system');
                        battle.showFloatingText(caster, "공간 부족", "#aaa");
                        return;
                    }
                }

                if (summonKey === 'HOMUNCULUS' && caster.homunculusId) {
                    battle.log("이미 호문클루스가 존재합니다!", "log-bad");
                    return;
                }
                if (summonKey === 'GOLEM') {
                    const existingGolem = battle.units.find(u => u.key && u.key.includes('GOLEM') && (u.ownerId === caster.id || u.casterId === caster.id));
                    if (existingGolem) {
                        existingGolem.curHp = 0;
                        if(battle.handleDeath) battle.handleDeath(existingGolem);
                    }
                }
                battle.spawnUnit(summonKey, caster.team, spawnQ, spawnR, { casterId: caster.id });
                return;
            }

            if (type.includes('ZONE')) {
                let zKey = type.includes('HEAL') ? 'ZONE_HEAL' : 'ZONE_IMMUNE';
                let zName = type.includes('HEAL') ? '치유의 성소' : '절대 성역';
                let zIcon = type.includes('HEAL') ? '✨' : '🛡️';
                if (targetHex && !battle.getUnitAt(targetHex.q, targetHex.r)) {
                    battle.spawnUnit(zKey, caster.team, targetHex.q, targetHex.r, { hp: 999, casterId: caster.id, duration: eff.dur || 3, type: 'OBJECT', isPassable: true, icon: zIcon, name: zName });
                    battle.log(`${zIcon} 지정된 위치에 [${zName}]가 형성되었습니다!`, "log-skill");
                } else {
                    battle.log("소환 공간 부족", 'log-system');
                }
                return;
            }
            return;
        }
        if (type.startsWith('NT_') || ['CT_GREASE', 'CT_SMOKE', 'CT_CHOKE', 'CT_HALLUCINOGEN'].includes(type)) {
            const center = targetHex || clickedUnit;
            
            const dist = battle.grid.getDistance(caster, center);
            if (!center || dist !== 1) {
                battle.log("연성술은 시전자와 인접한 타일(1칸 거리)을 선택해 방향을 지정해야 합니다.", "log-bad");
                battle.showFloatingText(caster, "사거리 밖!", "#f55");
                return;
            }

            const isValidTerrain = (q, r, skillType) => {
                const tData = battle.grid.getTerrainData(q, r) || {};
                const tKey = String(tData.key || '').toUpperCase();
                
                const isWater = tKey.includes('WATER') || tKey.includes('WETLAND') || tKey.includes('SWAMP');
                const isNature = tKey === 'PLAIN' || tKey.includes('GRASS') || tKey.includes('FOREST');
                const isRockVolcano = tKey.includes('ROCK') || tKey.includes('MOUNTAIN') || tKey.includes('VOLCANO') || tKey.includes('LAVA');
                const isOutdoor = !tKey.includes('INDOOR') && !tKey.includes('CAVE') && !tKey.includes('DUNGEON');

                if (skillType === 'NT_THORN') return isNature;
                if (skillType === 'NT_MAGMA') return isNature || tKey.includes('VOLCANO');
                if (skillType === 'NT_SOLIDIFY') return isWater;
                if (skillType === 'NT_MAGNETIC') return isNature || isRockVolcano;
                if (skillType === 'NT_UPDRAFT' || skillType === 'NT_PILLAR' || skillType === 'NT_TECTONIC') return isOutdoor;
                return true; 
            };

            if (type.startsWith('NT_') && !isValidTerrain(center.q, center.r, type)) {
                battle.log("해당 지형 방향으로는 이 연성술을 시전할 수 없습니다!", "log-bad");
                battle.showFloatingText(caster, "지형 불일치!", "#f55");
                
                caster.curMp += skill._consumedMp || 0; 
                let costRed = Formulas.getDerivedStat(caster, 'cost_red') || 1.0;
                caster.actionGauge += Math.floor((skill.cost || 50) * costRed); 
                battle.actions.acted = false; 
                
                if (caster.team === 0) { 
                    battle.selectedSkill = null;
                    battle.ui.updateStatusPanel(); 
                    battle.ui.updateFloatingControls(); 
                    battle.ui.updateCursor();
                }
                return;
            }

            let areaType = eff.area || (skill ? skill.area : '0');
            
            // ⭐ [신규] 연금술사 전용 연성술 범위 1칸 확대 패시브
            const areaExpandPassive = (caster.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AREA_TRANSMUTE'));
            if (areaExpandPassive) {
                const currentRadius = parseInt(areaType) || 0;
                // 일자형이나 부채꼴이 아닌 일반 반경 형태일 때만 1칸 확장
                if (currentRadius > 0 && !String(areaType).includes('LINE') && !String(areaType).includes('CONE')) {
                    areaType = String(currentRadius + 1);
                    battle.log(`🧪 [범위 확대] 완벽한 연성! 지형 변환 범위가 넓어집니다!`, 'log-skill');
                }
            }
            
            let hexes = [];
            
            if (String(areaType).startsWith('FORWARD_HEX_')) {
                const radius = parseInt(areaType.split('_')[2]) || 3;
                const dq = center.q - caster.q;
                const dr = center.r - caster.r;
                
                const projectedCenter = { 
                    q: caster.q + (dq * radius), 
                    r: caster.r + (dr * radius) 
                };

                hexes = battle.grid.getShapeHexes(projectedCenter, caster, String(radius));
                hexes = hexes.filter(h => !(h.q === caster.q && h.r === caster.r));
            } else {
                hexes = battle.grid.getShapeHexes(center, caster, areaType);
            }

            let successCount = 0;

            hexes.forEach(h => {
                if (!battle.grid.hexes.has(`${h.q},${h.r}`)) return;
                
                if (type.startsWith('NT_') && !isValidTerrain(h.q, h.r, type)) return; 

                const occupant = battle.getUnitAt(h.q, h.r);

                if (type === 'NT_THORN') {
                    battle.environment.transmuteTerrain(h.q, h.r, { newKey: 'THORN', duration: 2 });
                    successCount++;
                } 
                else if (type === 'NT_MAGMA') {
                    battle.environment.transmuteTerrain(h.q, h.r, { newKey: 'LAVA', duration: 2 });
                    if (occupant) this.applyStatus(occupant, { type: 'STAT_BURN', duration: 2, prob: 100 });
                    successCount++;
                } 
                else if (type === 'NT_SOLIDIFY') {
                    battle.environment.transmuteTerrain(h.q, h.r, { newKey: 'ICE', duration: 2, linkUnitId: occupant ? occupant.id : null });
                    if (occupant) this.applyStatus(occupant, { type: 'STAT_FREEZE', duration: 2, prob: 100 });
                    successCount++;
                }
                else if (type === 'NT_MAGNETIC') {
                    battle.environment.transmuteTerrain(h.q, h.r, { newKey: 'ZONE_MAGNETIC', duration: 2 });
                    if (occupant) this.applyStatus(occupant, { type: 'DEBUFF_STAT_MOVE', val: 2, duration: 1 });
                    successCount++;
                }
                else if (type === 'NT_UPDRAFT') {
                    battle.environment.transmuteTerrain(h.q, h.r, { newKey: 'ZONE_UPDRAFT', duration: 2 });
                    successCount++;
                }
                else if (type === 'NT_PILLAR') {
                    if (battle.environment && battle.environment.transmuteTerrain) {
                        battle.environment.transmuteTerrain(h.q, h.r, { heightMod: 3, duration: 3 });
                    }
                    if (battle.handleResize) battle.handleResize(); 
                    
                    const pillarHp = Math.floor(Formulas.getDerivedStat(caster, 'hp_max') * 0.5) || 50;                    
                    const pillarObj = {
                        id: 'PILLAR_' + Date.now() + Math.floor(Math.random()*1000),
                        key: 'WALL_PILLAR', team: caster.team, q: h.q, r: h.r,
                        hp: pillarHp, curHp: pillarHp, maxHp: pillarHp,
                        casterId: caster.id, duration: 3, type: 'OBJECT',
                        isWall: occupant ? false : true, isPassable: occupant ? true : false,
                        icon: '🏛️', name: '돌기둥', actionGauge: 0, buffs: [], isDead: false
                    };
                    
                    battle.units.push(pillarObj);
                    if (battle.grid && battle.grid.updateUnitMap) battle.grid.updateUnitMap();
                    if (battle.ui) battle.ui.renderUnitOverlays();

                    if (occupant) {
                        battle.log(`⛰️ 돌기둥이 솟아오르며 ${occupant.name}이(가) 공중으로 솟구칩니다!`, "log-skill");
                        battle.triggerShakeAnimation(occupant);
                    }
                    successCount++;
                }
                else if (type === 'NT_TECTONIC') {
                    battle.environment.transmuteTerrain(h.q, h.r, { heightMod: val || 3, duration: 3 });
                    successCount++;
                }
                else if (type === 'CT_GREASE') {
                    battle.environment.transmuteTerrain(h.q, h.r, { newKey: 'ZONE_GREASE', duration: 3 });
                    successCount++;
                }
                else if (['CT_SMOKE', 'CT_CHOKE', 'CT_HALLUCINOGEN'].includes(type)) {
                    if (!occupant) {
                        let key = 'ZONE_POISON'; let icon = '💨'; let name = '가스';
                        if (type === 'CT_SMOKE') { name = '연막'; icon = '🌫️'; }
                        if (type === 'CT_HALLUCINOGEN') { name = '환각가스'; icon = '😵‍💫'; }
                        battle.spawnUnit(key, caster.team, h.q, h.r, { hp: 999, casterId: caster.id, duration: 3, type: 'OBJECT', isPassable: true, isAuraSource: true, icon: icon, name: name });
                        successCount++;
                    }
                }
            });

            if (successCount > 0) {
                if (type === 'CT_GREASE') battle.log("🛢️ 끈적한 기름이 주변에 흩뿌려집니다!", "log-skill");
                else if (type === 'NT_THORN') battle.log("🌿 지면에서 날카로운 가시덩굴이 솟아납니다!", "log-skill");
                else if (type === 'NT_MAGMA') battle.log("🌋 지면이 끓어오르며 용암으로 변이합니다!", "log-skill");
                else if (type === 'NT_SOLIDIFY') battle.log("❄️ 수분이 급격히 얼어붙어 빙판이 됩니다!", "log-skill");
                else if (type === 'NT_MAGNETIC') battle.log("🧲 지맥이 비틀리며 강력한 자기장이 형성됩니다!", "log-skill");
                else if (type === 'NT_UPDRAFT') battle.log("🌪️ 거대한 상승 기류가 솟구칩니다!", "log-skill");
                else if (type === 'NT_PILLAR') battle.log("🏛️ 거대한 돌기둥이 지면을 뚫고 솟아오릅니다!", "log-skill");
                else if (type === 'NT_TECTONIC') battle.log(`⛰️ ${successCount}칸의 지각 변동이 일어납니다!`, "log-skill");
                else battle.log("💨 치명적인 특수 가스가 살포되었습니다!", "log-skill");
            } else {
                battle.log("해당 영역에는 연성 가능한 지형이 없습니다.", "log-system");
            }
            return;
        }
        if (targets.length === 0) { 
            if (type.startsWith('TRAP')) {
                if (targetHex) battle.placeTrap(targetHex.q, targetHex.r, type, caster.id);
                return;
            }
            if (type === 'MOVE_TELEPORT' && skill && skill.id === 'SOR_44') {
                if (!battle.teleportTarget) {
                    const selectedUnit = clickedUnit || battle.getUnitAt(targetHex.q, targetHex.r);
                    if (selectedUnit && selectedUnit.curHp > 0) {
                        battle.teleportTarget = selectedUnit;
                        battle.log(`🌀 [순간이동] ${selectedUnit.name} 선택됨! 전송할 빈 공간을 클릭하세요.`, "log-skill");
                        battle.showFloatingText(selectedUnit, "TARGET", "#0ff");
                        return; 
                    } else {
                        battle.log("순간이동시킬 대상을 먼저 선택하세요.", "log-system");
                        return;
                    }
                } else {
                    if (battle.getUnitAt(targetHex.q, targetHex.r) || !battle.grid.isPassable(targetHex.q, targetHex.r)) {
                        battle.log("이동할 수 없는 위치입니다.", "log-system");
                        return;
                    }
                    const t = battle.teleportTarget;
                    battle.teleportTarget = null; 
                    
                    t.q = targetHex.q; t.r = targetHex.r; t.visualPos = null;
                    battle.showFloatingText(t, "WARP!", "#0ff");
                    battle.log(`🌌 ${t.name}이(가) 지정된 위치로 전송되었습니다!`, "log-skill");
                    if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(t);
                    battle.centerCameraOnUnit(t);
                    return;
                }
            }
            
            if (type === 'SPECIAL_TIME_STOP' || type === 'SYS_TIME_STOP') {
                caster.actionGauge = Math.max(caster.actionGauge, battle.actionGaugeLimit * 1.5); 
                battle.showFloatingText(caster, "TIME STOP!", "#00ffff");
                battle.log(`⏳ ${caster.name}이(가) 전장의 시간을 멈췄습니다!`, 'log-skill');
                battle.units.forEach(u => {
                    if (u.curHp > 0 && u.id !== caster.id) {
                        this.applyStatus(u, { type: 'CC_STUN', val: 1, duration: 2 }, caster);
                        this.applyStatus(u, { type: 'SYS_TIME_STOP', val: 1, duration: 2 }, caster);
                    }
                });
                return;
            }
            if (type.startsWith('ECON') || type.startsWith('UTIL') || type.includes('STEAL')) {
                targets.push(caster);
            }
        }
        
        if (type === 'MOVE_MARCH') {
            const dest = targetHex || clickedUnit;
            if (!dest) return;
            
            const range = parseInt(skill.rng) || 5;
            const lineHexes = battle.grid.getLine(caster, dest, range);
            let actualMove = {q: caster.q, r: caster.r};
            let enemiesHit = 0;

            for (const h of lineHexes) {
                if (h.q === caster.q && h.r === caster.r) continue;
                
                if (!battle.grid.isPassable(h.q, h.r)) break; // 벽에 막히면 정지
                
                const occupant = battle.getUnitAt(h.q, h.r);
                if (occupant) {
                    if (occupant.team === caster.team) break; // 아군이면 정지
                    
                    // 적군이면 MP 검사 후 밀치고 관통
                    const mpCost = Math.floor((skill._consumedMp || skill.mp || 0) * 0.1);
                    if (caster.curMp < mpCost) {
                        battle.log(`마나가 부족하여 진군이 중단되었습니다!`, "log-bad");
                        break;
                    }
                    caster.curMp -= mpCost;
                    enemiesHit++;

                    // 좌우 밀치기 + 데미지
                    const dir = battle.grid.getDirection(caster, occupant);
                    const leftHex = battle.grid.getNeighborInDir(occupant, (dir + 5) % 6);
                    const rightHex = battle.grid.getNeighborInDir(occupant, (dir + 1) % 6);
                    
                    let pushDest = null;
                    let hitWall = false;

                    if (Math.random() < 0.5) {
                        if (leftHex && battle.grid.isPassable(leftHex.q, leftHex.r) && !battle.getUnitAt(leftHex.q, leftHex.r)) pushDest = leftHex;
                        else if (rightHex && battle.grid.isPassable(rightHex.q, rightHex.r) && !battle.getUnitAt(rightHex.q, rightHex.r)) pushDest = rightHex;
                        else hitWall = true;
                    } else {
                        if (rightHex && battle.grid.isPassable(rightHex.q, rightHex.r) && !battle.getUnitAt(rightHex.q, rightHex.r)) pushDest = rightHex;
                        else if (leftHex && battle.grid.isPassable(leftHex.q, leftHex.r) && !battle.getUnitAt(leftHex.q, leftHex.r)) pushDest = leftHex;
                        else hitWall = true;
                    }

                    let mult = hitWall ? 1.3 : 1.0; 
                    await this.performAttack(caster, occupant, mult, "행진 충돌", false, 'PHYS', 1, options);
                    
                    if (pushDest && occupant.curHp > 0) {
                        battle.createProjectile(occupant, pushDest);
                        occupant.q = pushDest.q; occupant.r = pushDest.r;
                        battle.showFloatingText(occupant, "밀쳐짐!", "#aaa");
                        if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(occupant);
                    }
                }
                actualMove = {q: h.q, r: h.r};
            }
            
            if (actualMove.q !== caster.q || actualMove.r !== caster.r) {
                caster.q = actualMove.q; caster.r = actualMove.r;
                caster.visualPos = null;
                if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
                battle.centerCameraOnUnit(caster);
                battle.log(`🛡️ 강철의 행진! 적 ${enemiesHit}명을 돌파하며 전진했습니다!`, "log-skill");
            }
            return;
        }

        for (const t of targets) {
            // ⭐ [신규] 검문소: 대상이 앞선 타격(데미지)을 회피했다면, 이어지는 해로운 부가 효과는 튕겨냅니다.
            const isNegativeEffect = type.startsWith('STAT_') || type.startsWith('CC_') ||                                     type.startsWith('DEBUFF_') || type.startsWith('STATUS_') || 
                                     type.startsWith('DOT_') || type.includes('PUSH') || 
                                     type.includes('KNOCKBACK') || type.includes('RANDOM');
                                     
            if (isNegativeEffect && t._missedSkill) {
                // CombatManager에서 이미 "MISS" 판정이 났으므로 조용히 스킵합니다.
                continue; 
            }

            if (this.battle.hasStatus(t, 'STAT_PETRIFY')) {
                if (type !== 'SYS_BREAK_WALL' && !type.includes('CLEANSE') && !type.includes('DISPEL')) {
                    this.battle.showFloatingText(t, "돌덩이!", "#aaaaaa");
                    continue; 
                }
            }
            if (type === 'COST_HP_PER' || type === 'SYS_COST_HP_PER') {
                const hpCost = Math.floor(t.hp * (val || 0.5));
                t.curHp = Math.max(1, t.curHp - hpCost); // 최소 1은 남김
                battle.showFloatingText(t, `HP -${hpCost}`, '#f00');
                battle.log(`🩸 생명력 대가 지불: HP -${hpCost}`, 'log-dmg');
                continue;
            }
            if (type === 'SYS_COST_MP') {
                const mpCost = Math.floor(val || 10);
                t.curMp = Math.max(0, t.curMp - mpCost);
                battle.showFloatingText(t, `MP -${mpCost}`, '#00aaff');
                battle.log(`🌀 마나 대가 지불: MP -${mpCost}`, 'log-dmg');
                continue;
            }

            // ⭐ [데이터 맞춤 해결 3] 엑셀의 ATK_ACC_PENALTY(값 30)을 읽어 멋진 조준 이펙트 출력!
            if (type === 'ATK_ACC_BONUS' || type === 'ATK_ACC_PENALTY') {
                const valNum = parseFloat(val) || 0;
                if (valNum > 0) {
                    battle.showFloatingText(t, `명중 조준!`, '#00ffff');
                    battle.log(`🎯 [조준] ${t.name}이(가) 정밀하게 타겟을 겨냥합니다! (명중률 +${valNum}%)`, 'log-skill');
                } else {
                    battle.showFloatingText(t, `조준 방해`, '#ff5555');
                }
                continue;
            }
            
            if (t.curHp <= 0 && !['REVIVE', 'RESURRECT', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL', 'SYS_EXORCISE_CORPSE'].includes(type)) continue;            if (t.type === 'OBJECT' && type !== 'SYS_BREAK_WALL') continue;

            if (type === 'SYS_EXORCISE_CORPSE') {
                if (t.curHp <= 0 && t.race === 'UNDEAD') {
                    battle.showFloatingText(t, "제령됨", "#ffffaa");
                    battle.log(`✨ ${t.name}의 시체가 빛으로 산화되어 소멸합니다!`, 'log-system');
                    battle.units = battle.units.filter(u => u.id !== t.id); 
                }
                continue;
            }

            if (type === 'SYS_BREAK_WALL') {
                if (t.isWall || t.type === 'OBJECT') {
                    t.curHp = 0;
                    battle.showFloatingText(t, "CRUMBLED!", "#ffaa00");
                    battle.log(`🧱 장벽 파괴됨!`, 'log-dmg');
                    
                    const mountedUnit = battle.units.find(u => u.q === t.q && u.r === t.r && u.id !== t.id);
                    if (mountedUnit) {
                        const fallDmg = Math.floor(mountedUnit.hp * 0.3);
                        mountedUnit.curHp = Math.max(0, mountedUnit.curHp - fallDmg);
                        battle.showFloatingText(mountedUnit, `낙하 -${fallDmg}`, "#ff0000");
                        battle.log(`💥 ${mountedUnit.name}이(가) 무너지는 장벽에서 추락했습니다!`, 'log-dmg');
                    }
                }
                continue;
            }
            if (type.includes('CLEANSE') || type.includes('DISPEL') || type.includes('PURIFY')) {
                const initialCount = t.buffs.length;
                
                let targetAilment = null;
                if (type.startsWith('CLEANSE_') && type !== 'CLEANSE_ALL') {
                    targetAilment = type.replace('CLEANSE_', 'STAT_');
                }

                t.buffs = t.buffs.filter(b => {
                    if (!this.battle.statusManager) return true;
                    const bNorm = this.battle.statusManager.normalizeAilment(b.type);
                    const isAilment = !!this.battle.statusManager.TIERS[bNorm];
                    
                    if (isAilment) {
                        if (targetAilment) {
                            return bNorm !== targetAilment; 
                        } else {
                            return false; 
                        }
                    }
                    return true; 
                });

                if (t.buffs.length < initialCount) {
                    battle.showFloatingText(t, "정화!", "#55ff55");
                    battle.log(`✨ ${t.name}의 상태이상이 정화되었습니다.`, 'log-heal');
                } else {
                    battle.showFloatingText(t, "정화할 효과 없음", "#aaa");
                }
                continue; 
            }

            // ⭐ [성직자 기획 반영] 해제 (SYS_DISPEL_MAGIC) - 상태이상을 제외한 버프/너프 효과만 제거
            if (type === 'SYS_DISPEL_MAGIC') {
                const initialCount = t.buffs.length;
                t.buffs = t.buffs.filter(b => {
                    const typeStr = String(b.type);
                    const isBuffOrDebuff = typeStr.startsWith('BUFF_STAT_') || typeStr.startsWith('DEBUFF_STAT_');
                    const isAilment = typeStr.startsWith('STAT_') || typeStr.startsWith('CC_');
                    
                    if (isBuffOrDebuff && !isAilment) return false; 
                    return true; 
                });

                if (t.buffs.length < initialCount) {
                    battle.showFloatingText(t, "마법 해제!", "#00ffff");
                    battle.log(`🧹 ${t.name}에게 걸린 모든 마법적 스탯 증감 효과가 해제되었습니다!`, 'log-system');
                } else battle.showFloatingText(t, "해제할 마법 없음", "#aaa");
                continue;
            }

            // ⭐ [음유시인 기획 반영] 파멸의 노래 (SYS_DISPEL_BUFF) - 적의 이로운 버프만 강제로 모두 제거
            if (type === 'SYS_DISPEL_BUFF') {
                const initialCount = t.buffs.length;
                t.buffs = t.buffs.filter(b => {
                    const typeStr = String(b.type);
                    // 해제 대상: 능력치 증가 버프 및 각종 방어막(SHLD, DEF_) 등
                    const isBeneficial = typeStr.startsWith('BUFF_') || typeStr.startsWith('DEF_') || typeStr === 'SHLD';
                    const isAilment = typeStr.startsWith('STAT_') || typeStr.startsWith('CC_') || typeStr.startsWith('DEBUFF_');
                    
                    if (isBeneficial && !isAilment) return false; // 이로운 버프면 삭제
                    return true; // 디버프와 고유 상태는 유지
                });

                if (t.buffs.length < initialCount) {
                    battle.showFloatingText(t, "버프 강제 해제!", "#ff00ff");
                    battle.log(`💥 파멸의 노래가 ${t.name}의 모든 보호막과 강화 효과를 찢어버립니다!`, 'log-skill');
                }
                continue;
            }

            if (type === 'DMG_TRUE_BYMP') {
                const casterMatk = Formulas.getDerivedStat(caster, 'atk_mag') || 10;
                const consumedMp = skill._consumedMp || 0;
                const skillVal = parseFloat(val) || 1;
                const trueDmg = Math.floor((casterMatk * 1.5) * (consumedMp / 80) * skillVal);             
                t.curHp -= trueDmg;
                battle.log(`💥 [마력 폭발] ${t.name}에게 ${trueDmg}의 방어 무시 피해! (MATK ${Math.floor(casterMatk)}, 마나 ${consumedMp} 연소)`, 'log-dmg');
                battle.showFloatingText(t, `-${trueDmg}`, "#ff00ff"); 
                battle.triggerShakeAnimation(t);
                
                if (t.curHp <= 0) battle.handleDeath(t, caster);
                continue; 
            }

            if (type.startsWith('DMG') || type.startsWith('ATK') || (type.includes('DRAIN') && !type.startsWith('GAUGE'))) {
                if (['ATK_SUREHIT', 'ATK_PENETRATE', 'ATK_EXECUTE', 'ATK_MOVE', 'ATK_DASH', 'ATK_JUMP', 'ATK_DEF_SCALE', 'ATK_DIST'].includes(type)) continue;
                options.chainIndex = pierceIndex;

                let dmgType = type.startsWith('DMG_') ? type : (caster.atkType || 'PHYS');
                
                // ⭐ [궁수 기획 반영] 비산 화살 (메인 타겟 + 주변 횡렬 2명 유도 타격)
                if (type === 'ATK_SPLIT_ARROW') {
                    const baseMult = val || 1.0;
                    // 1. 메인 타겟 먼저 타격
                    await this.performAttack(caster, t, baseMult, "비산 화살", false, dmgType, 1, options);
                    
                    // 2. 타겟을 기준으로 좌우 횡렬(거리 1~2칸 이내) 적 탐색
                    const dirFromCaster = battle.grid.getDirection(caster, t);
                    const leftDir = (dirFromCaster + 5) % 6;
                    const rightDir = (dirFromCaster + 1) % 6;
                    
                    let splitTargets = [];
                    battle.units.forEach(u => {
                        if (u.team !== caster.team && u.curHp > 0 && u.id !== t.id) {
                            const dCaster = battle.grid.getDistance(caster, u);
                            const dT = battle.grid.getDistance(t, u);
                            // 시전자 기준 거리가 메인 타겟과 비슷하고(횡렬), 메인 타겟 근처(2칸 이내)일 때
                            if (Math.abs(dCaster - battle.grid.getDistance(caster, t)) <= 1 && dT <= 2) {
                                splitTargets.push(u);
                            }
                        }
                    });
                    
                    // 가장 가까운 2명에게만 분산
                    splitTargets.sort((a, b) => battle.grid.getDistance(t, a) - battle.grid.getDistance(t, b));
                    const finalSplits = splitTargets.slice(0, 2);
                    
                    for (const splitT of finalSplits) {
                        battle.createProjectile(caster, splitT); // 궤적 분리 연출
                        await new Promise(r => setTimeout(r, 100));
                        await this.performAttack(caster, splitT, baseMult, "갈라진 화살", false, dmgType, 1, options);
                    }
                    continue; // 일반 데미지 로직 스킵
                }

                // ⭐ [궁수 기획 반영] 도탄 사격 (사선이 막혔을 때 튕겨서 맞춤)
                if (skill && skill.name === '도탄 사격') {
                    const hasLineOfSight = battle.grid.hasLineOfSight(caster, t);
                    if (hasLineOfSight) {
                        battle.log(`⚠️ 사선이 열려있습니다. 도탄 시킬 필요 없이 직접 타격합니다!`, 'log-system');
                        await this.performAttack(caster, t, finalMult, "일반 사격", isDrain, dmgType, hitCount, options);
                        continue;
                    } else {
                        // 사선이 막혔다면 무조건 도탄(반사)를 시도함
                        battle.log(`🪃 [도탄 사격] 사선이 막혀있습니다! 장애물을 튕겨 적을 맞춥니다!`, 'log-skill');
                        // 튕기는 연출을 위해 투사체를 먼저 쏨
                        battle.createProjectile(caster, t);
                        await new Promise(r => setTimeout(r, 200));
                        battle.showFloatingText(t, "도탄 명중!", "#ff8800");
                        await this.performAttack(caster, t, finalMult, "도탄 사격", isDrain, dmgType, hitCount, options);
                        continue;
                    }
                }
                
                if (type === 'DMG_TRUE') {
                    options.penetrate = val || 1.0;
                    dmgType = 'DMG_PHYS'; 
                }

                const isDrain = type.includes('DRAIN');
                const hitCount = (type === 'ATK_MULTI') ? val : (options.hitCount || 1); 
                
                let finalMult = (type === 'ATK_MULTI') ? 1.0 : val;
                if (options.mpScale && skill._consumedMp) finalMult += (skill._consumedMp / 10);
                if (options.lowHpScale) finalMult += (1 - (caster.curHp / caster.hp)) * 0.5;
                if (options.globalMult) finalMult *= options.globalMult;

                if (type === 'ATK_CHAIN' || type === 'DMG_LIGHTNING_CHAIN') {
                     const chainType = type.includes('LIGHTNING') ? 'LIGHTNING' : 'MAG';
                     await this.performAttack(caster, t, finalMult, "체인", false, chainType, 1, options);
                     let curr = t;
                     let visited = [t.id];
                     const chainLimit = parseInt(eff.area) || val || 3; 

                     for(let i=0; i<chainLimit; i++) { 
                         const neighbors = battle.units.filter(u => u.team !== caster.team && u.curHp > 0 && !visited.includes(u.id) && battle.grid.getDistance(u, curr) <= 2);
                         if (neighbors.length > 0) {
                             const next = neighbors[0]; 
                             battle.createProjectile(curr, next);
                             await new Promise(r => setTimeout(r, 200));
                             await this.performAttack(caster, next, finalMult * 0.8, "전이", false, chainType, 1, options);
                             
                             if (skill.effects.some(e => e.type === 'STAT_PARALYSIS')) {
                                 this.applyStatus(next, { type: 'STAT_PARALYSIS', prob: 40, duration: 1 }, caster);
                             }
                             visited.push(next.id);
                             curr = next;
                         } else break;
                     }
                } else {
                    await this.performAttack(caster, t, finalMult, "스킬", isDrain, dmgType, hitCount, options);
                }
                
                if (skill.id === 'SOR_36' && type === 'DMG_LIGHTNING') {
                    const adjEnemies = battle.units.filter(u => 
                        u.team !== caster.team && 
                        u.curHp > 0 && 
                        !targets.some(targetUnit => targetUnit.id === u.id) && 
                        battle.grid.getDistance(u, t) === 1
                    );
                    
                    if (adjEnemies.length > 0) {
                        battle.log(`⚡ 전기가 주변 적들에게 튀어 오릅니다!`, 'log-skill');
                        for (const adj of adjEnemies) {
                            battle.createProjectile(t, adj); 
                            await new Promise(r => setTimeout(r, 150));
                            
                            let splashMult = finalMult * 0.2; 
                            await this.performAttack(caster, adj, splashMult, "전도", false, 'LIGHTNING', 1, options);
                        }
                    }
                }

                pierceIndex++;
            }
            else if (type.startsWith('HEAL')) {
                if (type === 'HEAL_MP' || type === 'HEAL_MP_PER') {
                    let healMp = val >= 9999 ? t.mp : (type === 'HEAL_MP_PER' ? t.mp * val : val); 
                    if (skill && (skill.type === 'ITEM' || skill.id.startsWith('IT_') || skill.id.startsWith('MT_'))) {
                        const hasPharma = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_PHARMA'));
                        const hasDenseExt = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DENSE_EXTRACTION'));
                        if (hasDenseExt) healMp = Math.floor(healMp * 2.0);
                        else if (hasPharma) healMp = Math.floor(healMp * 1.2);
                    }
                    t.curMp = Math.min(t.mp, t.curMp + healMp);
                    battle.showFloatingText(t, `MP +${Math.floor(healMp)}`, '#55ccff');
                    battle.log(`💧 ${t.name} MP 회복: ${Math.floor(healMp)}`, 'log-heal');
                    continue;
                }
                
                // ⭐ [무투가 기획 반영] 기혈순환, 운기조식 등: '잃은 체력/마나'에 비례하여 회복
                if (type === 'HEAL_MISSING_HP_PER') {
                    const maxHp = t.hp || Formulas.getDerivedStat(t, 'hp_max');
                    const missingHp = Math.max(0, maxHp - t.curHp);
                    const heal = Math.floor(missingHp * val);
                    if (heal > 0) {
                        t.curHp = Math.min(maxHp, t.curHp + heal);
                        battle.showFloatingText(t, `+${heal}`, '#55ff55');
                    }
                    continue;
                }
                if (type === 'HEAL_MISSING_MP_PER') {
                    const maxMp = t.mp || Formulas.getDerivedStat(t, 'mp_max');
                    const missingMp = Math.max(0, maxMp - t.curMp);
                    const heal = Math.floor(missingMp * val);
                    if (heal > 0) {
                        t.curMp = Math.min(maxMp, t.curMp + heal);
                        battle.showFloatingText(t, `MP +${heal}`, '#55ccff');
                    }
                    continue;
                }

                const mockSkill = { type: skill ? skill.type : 'ACTIVE', main: { val: val, type: type } };
                const healData = Formulas.calculateHeal(caster, t, mockSkill);
                let finalHealHp = healData.hp;

                if (skill.type === 'ITEM' || skill.id.startsWith('IT_') || skill.id.startsWith('MT_')) {
                    const hasPharma = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_PHARMA'));
                    const hasDenseExt = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DENSE_EXTRACTION'));
                    
                    if (hasDenseExt) {
                        finalHealHp = Math.floor(finalHealHp * 2.0); // 고밀도 추출 (우선적용)
                    } else if (hasPharma) {
                        finalHealHp = Math.floor(finalHealHp * 1.2); // 약리학 (20% 증가)
                    }
                }

                const isBleeding = battle.statusManager ? battle.statusManager.isBleeding(t) : false;

                if (isBleeding && finalHealHp > 0) {
                    finalHealHp = Math.floor(finalHealHp * 0.5);
                    battle.showFloatingText(t, "치유량 반감!", "#ff5555");
                    battle.log(`🩸 출혈로 인해 ${t.name}의 상처가 온전히 회복되지 않습니다.`, 'log-bad');
                }
                
                if (finalHealHp > 0) {
                    const maxHp = Formulas.getDerivedStat(t, 'hp_max');
                    const oldHp = t.curHp;
                    const overheal = (t.curHp + finalHealHp) - maxHp;
                    
                    t.curHp = Math.min(maxHp, t.curHp + finalHealHp);
                    battle.showFloatingText(t, `+${Math.floor(t.curHp - oldHp)}`, '#55ff55');
                    battle.log(`${t.name} 회복: ${Math.floor(t.curHp - oldHp)}`, 'log-heal');

                    if (overheal > 0 && t.skills) {
                        const overhealPassive = t.skills.find(s => s.effects && s.effects.some(e => e.type === 'PAS_OVERHEAL_SHIELD'));
                        if (overhealPassive) {
                            const ratio = parseFloat(overhealPassive.effects.find(e => e.type === 'PAS_OVERHEAL_SHIELD').val) || 0.5;
                            const shieldAmount = Math.floor(overheal * ratio);
                            
                            let shieldBuff = t.buffs.find(b => b.type === 'DEF_SHIELD' && b.name === '신의 자비');
                            if (shieldBuff) {
                                shieldBuff.amount += shieldAmount; 
                            } else {
                                t.buffs.push({ 
                                    type: 'DEF_SHIELD', name: '신의 자비', icon: '🤲', 
                                    duration: 99, amount: shieldAmount 
                                });
                            }
                            
                            battle.showFloatingText(t, `Shield +${shieldAmount}`, "#00ffff");
                            battle.log(`🛡️ [신의 자비] 초과 회복분(${overheal})이 ${t.name}의 보호막으로 전환되었습니다!`, 'log-heal');
                        }
                    }
                }
                if (healData.mp > 0) {
                    let healMp = healData.mp;
                    if (skill.type === 'ITEM' || skill.id.startsWith('IT_') || skill.id.startsWith('MT_')) {
                        const hasPharma = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_PHARMA'));
                        const hasDenseExt = (caster.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DENSE_EXTRACTION'));
                        
                        if (hasDenseExt) healMp = Math.floor(healMp * 2.0);
                        else if (hasPharma) healMp = Math.floor(healMp * 1.2);
                    }

                    t.curMp = Math.min(t.mp, t.curMp + healMp);
                    battle.showFloatingText(t, `MP +${Math.floor(healMp)}`, '#55ccff');
                }
            }
            else if (type.startsWith('GAUGE')) {
                let power = val; 
                if (power > 0 && power < 1) power = Math.floor(power * 100);
                const powerVal = Formulas.calculateEffectPower(caster, type, power);

                if (type.includes('FILL')) {
                    t.actionGauge = Math.min(battle.actionGaugeLimit, t.actionGauge + powerVal);
                    battle.showFloatingText(t, `Act +${powerVal}`, '#ffff00');
                } else if (type.includes('DRAIN') || type.includes('REDUCE')) {
                    t.actionGauge -= powerVal;
                    battle.showFloatingText(t, `Act -${powerVal}`, '#888888');
                } else if (type.includes('SET') || type.includes('MAX')) {
                    t.actionGauge = type.includes('MAX') ? battle.actionGaugeLimit : powerVal;
                    battle.showFloatingText(t, `Act Reset`, '#ffffff');
                }
            }
            else if (type === 'BUFF_STAT_WT' || type === 'DEBUFF_STAT_WT' || type === 'WT_CHANGE') {
                t.actionGauge -= val;
                t.actionGauge = Math.max(-100, Math.min(battle.actionGaugeLimit, t.actionGauge));
                
                if (val < 0) {
                    battle.showFloatingText(t, `WT ${val}`, '#00ffff');
                    battle.log(`⏩ ${t.name}의 턴이 앞당겨집니다!`, 'log-skill');
                } else if (val > 0) {
                    battle.showFloatingText(t, `WT +${val}`, '#ff5555');
                    battle.log(`⏳ ${t.name}의 행동이 지연되었습니다!`, 'log-bad');
                }
            }
            else if (type === 'MOVE_BEHIND') {
                const backHex = battle.grid.getHexInDirection(t, caster, -1);
                if (backHex && !battle.getUnitAt(backHex.q, backHex.r) && battle.grid.isPassable(backHex.q, backHex.r)) {
                    caster.q = backHex.q; caster.r = backHex.r;
                    battle.log("배후로 이동!", 'log-skill');
                    if(caster === battle.currentUnit) battle.centerCameraOnUnit(caster);
                } else battle.log("배후 공간이 없습니다.", "log-system");
            }
            else if (type === 'MOVE_SWAP') {
                const tempQ = caster.q, tempR = caster.r;
                caster.q = t.q; caster.r = t.r;
                t.q = tempQ; t.r = tempR;
                battle.showFloatingText(caster, "위치 교환!", "#fff");
            }
            else if (type === 'MOVE_PULL') {
                 const pullDest = battle.grid.getHexInDirection(caster, t, 1); 
                 if (pullDest && !battle.getUnitAt(pullDest.q, pullDest.r) && battle.grid.isPassable(pullDest.q, pullDest.r)) {
                     battle.createProjectile(t, pullDest);
                     await new Promise(r => setTimeout(r, 100));
                     t.q = pullDest.q; t.r = pullDest.r;
                     battle.showFloatingText(t, "당겨짐!", "#aaa");
                 }
            }
            else if (type === 'SYS_CRASH_LAND') {
                if (battle.isFlying(t)) {
                    this.applyStatus(t, { type: 'DEBUFF_GROUNDED', duration: 2, val: 1 }, caster);
                    const crashDmg = Math.floor(t.hp * (val || 0.3)); 
                    t.curHp = Math.max(0, t.curHp - crashDmg);
                    battle.showFloatingText(t, `추락! -${crashDmg}`, '#ff5500');
                    battle.log(`☄️ ${t.name}이(가) 지면으로 강제 추락합니다!`, 'log-skill');
                    battle.triggerShakeAnimation(t);
                } else battle.showFloatingText(t, "무효", "#aaa");
            }
            else if (type === 'DMG_FALL') {
                // ⭐ [기획 반영] 대지 분출 등 낙하 데미지는 비행 유닛에게 무효
                if (battle.isFlying(t)) {
                    battle.showFloatingText(t, "무효(비행)", "#aaa"); 
                    battle.log(`🦅 ${t.name}은(는) 비행 유닛이라 낙하 데미지를 받지 않습니다.`, 'log-system');
                } else {
                    const fallDmg = Math.floor(t.hp * (val || 0.5)); 
                    t.curHp = Math.max(0, t.curHp - fallDmg);
                    battle.showFloatingText(t, `낙하! -${fallDmg}`, '#ff8800');
                    battle.log(`💥 ${t.name} 낙하 피해!`, 'log-dmg');
                }
            }
            else if (type === 'DMG_BONUS_FLY') {
                if (battle.isFlying(t)) {
                    const dmg = Formulas.calculateDamage(caster, t, val, caster.atkType).damage;
                    t.curHp = Math.max(0, t.curHp - dmg);
                    battle.showFloatingText(t, `대공 추뎀! -${dmg}`, '#ff0000');
                    battle.log(`🦅 ${t.name}에게 대공 추가 피해!`, 'log-dmg');
                }
            }
            else if (type === 'SYS_EXORCISE') {
                if (t.race === 'UNDEAD') {
                    t.curHp = 0; 
                    battle.showFloatingText(t, "EXORCISED!", "#ffffaa");
                    battle.log(`✨ ${t.name}이(가) 정화되었습니다.`, 'log-system');
                    battle.triggerShakeAnimation(t);
                }
            }
            else if (type === 'SYS_PAY_GOLD' || type === 'SYS_PAYGOLD') {
                const cost = (t.level || 1) * val; 
                if (battle.gameApp.gameState.gold >= cost) {
                    battle.gameApp.gameState.gold -= cost;
                    battle.showFloatingText(caster, `-${cost}G`, "#ffd700");
                    battle.log(`💰 ${t.name}에게 ${cost}골드를 쥐어주었습니다!`, 'log-item');
                 } else {
                    battle.showFloatingText(caster, "골드 부족!", "#ff0000");
                    battle.log(`💰 골드가 부족하여 매수에 실패했습니다.`, 'log-bad');
                    t.buffs = t.buffs.filter(b => b.type !== 'STAT_CHARM' && b.type !== 'CC_CHARM');
                }
                if(caster.team === 0 && battle.gameApp.updateResourceDisplay) battle.gameApp.updateResourceDisplay();
            }
            else if (type === 'SYS_STEAL_SKILL') {
                if (t.skills && t.skills.length > 0) {
                    const activeSkills = t.skills.filter(s => s.type !== 'PASSIVE' && s.id !== '1000' && !s.isStolen);
                    if (activeSkills.length > 0) {
                        const stolen = activeSkills[Math.floor(Math.random() * activeSkills.length)];
                        battle.showFloatingText(t, "스킬 훔침!", "#d0f");
                        battle.log(`🥷 ${caster.name}이(가) [${stolen.name}] 스킬을 모방했습니다!`, 'log-skill');
                        
                        const copiedSkill = JSON.parse(JSON.stringify(stolen));
                        
                        copiedSkill.id = 'STOLEN_' + copiedSkill.id + '_' + Date.now();
                        copiedSkill.name = `[모방] ${copiedSkill.name}`;
                        copiedSkill.cost = 0;
                        copiedSkill.mp = 0;
                        copiedSkill.isStolen = true;
                        copiedSkill.stolenDuration = 2; 

                        // ⭐ [기획 반영] 도적의 극의: 훔친 스킬은 효과 및 데미지가 -20% 보정됨
                        if (copiedSkill.effects) {
                            copiedSkill.effects.forEach(e => {
                                if ((e.type.startsWith('DMG') || e.type.startsWith('HEAL')) && e.val) {
                                    e.val = (parseFloat(e.val) * 0.8).toFixed(2);
                                }
                            });
                        }

                        caster.skills.push(copiedSkill);
                        
                        if (caster.team === 0 && battle.ui) {
                            battle.ui.updateStatusPanel();
                            battle.ui.updateFloatingControls(); 
                        }
                    } else battle.showFloatingText(t, "훔칠 스킬 없음", "#aaa");
                } else battle.showFloatingText(t, "훔칠 스킬 없음", "#aaa");
            }
           else if (['CC_KNOCKBACK', 'CC_KNOCKBACK_HEAVY', 'MOVE_PUSH', 'STAT_KNOCKBACK', 'KNOCKBACK', 'MOVE_PUSH_SIDE'].includes(type)) {
                const hasImmuneBuff = this.battle.hasStatus(t, 'BUFF_IMMUNE_KNOCKBACK');
                const hasImmunePassive = (t.skills || []).some(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_IMMUNE_KNOCKBACK' || e.type === 'BUFF_IMMUNE_KNOCKBACK'));
                
                if (this.battle.hasStatus(t, 'STAT_GRAVITY') || hasImmuneBuff || hasImmunePassive) {
                    this.battle.showFloatingText(t, "밀려나지 않음!", "#fff");
                    continue; 
                }

                if (type === 'MOVE_PUSH_SIDE') {
                    const dir = battle.grid.getDirection(caster, t);
                    const leftHex = battle.grid.getNeighborInDir(t, (dir + 5) % 6);
                    const rightHex = battle.grid.getNeighborInDir(t, (dir + 1) % 6);
                    
                    let pushDest = null;
                    if (leftHex && battle.grid.isPassable(leftHex.q, leftHex.r) && !battle.getUnitAt(leftHex.q, leftHex.r)) pushDest = leftHex;
                    else if (rightHex && battle.grid.isPassable(rightHex.q, rightHex.r) && !battle.getUnitAt(rightHex.q, rightHex.r)) pushDest = rightHex;

                    if (pushDest) {
                        battle.createProjectile(t, pushDest);
                        setTimeout(() => {
                            t.q = pushDest.q; t.r = pushDest.r;
                            battle.showFloatingText(t, "밀쳐짐!", "#aaa");
                            battle.updateUnitOverlayPosition(t);
                        }, 150);
                    }
                    continue; 
                }
                
                const isHeavy = type === 'CC_KNOCKBACK_HEAVY';
                const pushCount = isHeavy ? 2 : val;
                
                const pushDir = battle.grid.getDirection(caster, t);
                let pushDest = null; 
                let hitObstacle = false;
                let obstacleUnit = null;

                let currQ = t.q, currR = t.r;

                for(let i=1; i<=pushCount; i++) {
                     const nextHex = battle.grid.getNeighborInDir({q: currQ, r: currR}, pushDir); 
                     if (nextHex && battle.grid.hexes.has(`${nextHex.q},${nextHex.r}`)) {
                         const occ = battle.getUnitAt(nextHex.q, nextHex.r);
                         if (battle.grid.isPassable(nextHex.q, nextHex.r) && !occ) {
                             pushDest = nextHex;
                             currQ = nextHex.q; currR = nextHex.r;
                         } else { 
                             hitObstacle = true; 
                             if (occ) obstacleUnit = occ;
                             break; 
                         }
                     } else { hitObstacle = true; break; }
                }

                if (pushDest) {
                    battle.createProjectile(t, pushDest); 
                    await new Promise(r => setTimeout(r, 150));
                    t.q = pushDest.q; t.r = pushDest.r;
                    battle.showFloatingText(t, "밀려남!", "#fff");
                }
                
                // ⭐ [기획 반영] 충돌 데미지 차등 적용 (대지 강타 대응)
                if (hitObstacle && isHeavy) {
                    const colMult = obstacleUnit ? 0.2 : 0.3; // 유닛 충돌 20%, 벽 충돌 30%
                    const dmg = Formulas.calculateDamage(caster, t, colMult, caster.atkType).damage;
                    t.curHp = Math.max(0, t.curHp - dmg);
                    battle.showFloatingText(t, `충돌 -${dmg}`, '#f55');
                    battle.log(`💥 ${t.name} 강하게 충돌하여 피해!`, 'log-dmg');

                    if (obstacleUnit) {
                        const obsDmg = Formulas.calculateDamage(caster, obstacleUnit, 0.2, caster.atkType).damage;
                        obstacleUnit.curHp = Math.max(0, obstacleUnit.curHp - obsDmg);
                        battle.showFloatingText(obstacleUnit, `연쇄 충돌 -${obsDmg}`, '#f55');
                    }
                } else if (hitObstacle && skill && skill.effects.some(e => e.type === 'DMG_COLLISION')) {
                    // 기존 일반 넉백 충돌
                    const colEff = skill.effects.find(e => e.type === 'DMG_COLLISION');
                    const dmg = Formulas.calculateDamage(caster, t, parseFloat(colEff.val) || 0.3, caster.atkType).damage;
                    t.curHp = Math.max(0, t.curHp - dmg);
                    battle.showFloatingText(t, `충돌 -${dmg}`, '#f55');
                    battle.log(`💥 ${t.name} 충돌 피해!`, 'log-dmg');
                }
            }
            else if (type === 'UTIL_CD_RESET') {
                 battle.showFloatingText(t, "재사용 대기시간 초기화!", "#0ff");
                 t.actionGauge = battle.actionGaugeLimit; 
            }
            else if (type === 'ECON_STEAL' || type === 'STEAL' || type === 'SYS_STEAL') { 
                if (t === caster) continue;
                
                let stealProb = eff.prob ? parseFloat(eff.prob) : 50;
                const ratePassive = (caster.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_STEAL_RATE'));
                // ⭐ [기획 반영] 가벼운 손놀림 값(15%) 참조
                if (ratePassive) stealProb += parseFloat(ratePassive.effects[0].val || 15);
                if (caster.level && t.level) stealProb += (caster.level - t.level) * 2;
                
                if (Math.random() * 100 > stealProb) {
                    battle.showFloatingText(t, "훔치기 실패!", "#aaa");
                    battle.log(`❌ ${caster.name}이(가) 골드를 훔치려 했으나 실패했습니다.`, "log-bad");
                    continue;
                }

                // ⭐ [기획 반영] 유닛 레벨과 스킬 레벨에 상응하여 획득 금액 증가
                const sLevel = skill ? (skill.level || 1) : 1;
                const stolen = Math.floor(Math.random() * 30 * sLevel) + 20 + (caster.level || 1) * 10;
                
                battle.gameApp.gameState.gold += stolen;
                battle.showFloatingText(t, "골드 훔침!", "#888");
                battle.showFloatingText(caster, `+${stolen}G`, "#ffd700");
                battle.log(`적에게서 ${stolen}골드를 훔쳤습니다!`, 'log-item');
                if (caster.team === 0 && battle.gameApp.updateResourceDisplay) battle.gameApp.updateResourceDisplay();
            }
            else if (type === 'ECON_STEAL_ITEM' || type === 'STEAL_ITEM' || type === 'SYS_STEAL_ITEM' || type.startsWith('SYS_STEAL_')) {
                if (t === caster) continue;

                let stealProb = eff.prob ? parseFloat(eff.prob) : 50; // 기본 확률 50% 적용
                const ratePassive = (caster.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_STEAL_RATE'));
                if (ratePassive) stealProb += parseFloat(ratePassive.effects[0].val || 15);
                if (caster.level && t.level) stealProb += (caster.level - t.level) * 3;

                if (Math.random() * 100 > stealProb) {
                    battle.showFloatingText(t, "강탈 실패!", "#aaa");
                    battle.log(`❌ ${caster.name}이(가) 장비를 강탈하려 했으나 실패했습니다.`, "log-bad");
                    continue;
                }

                let stolenItemId = null;
                let targetSlot = null;

                // ⭐ 오타 수정되었던 '방패 훔치기(SYS_STEAL_SHIELD)'가 offHand(방패 슬롯)을 정상적으로 훔치도록 연결되어 있음
                if (type === 'SYS_STEAL_ACC') targetSlot = 'ring';
                else if (type === 'SYS_STEAL_HELMET') targetSlot = 'head';
                else if (type === 'SYS_STEAL_SHIELD') targetSlot = 'offHand'; 
                else if (type === 'SYS_STEAL_ARMOR') targetSlot = 'body';
                else if (type === 'SYS_STEAL_WEAPON') targetSlot = 'mainHand';
                if (targetSlot && t.equipment && t.equipment[targetSlot]) {
                    stolenItemId = t.equipment[targetSlot];
                    t.equipment[targetSlot] = null;
                }
                else if (!targetSlot) {
                    if (t.drops && t.drops.length > 0) {
                        const validDrops = t.drops.filter(d => d.rate > 0);
                        if (validDrops.length > 0) {
                            const dropObj = validDrops[Math.floor(Math.random() * validDrops.length)];
                            stolenItemId = dropObj.id;
                            t.drops = t.drops.filter(d => d.id !== stolenItemId); 
                        }
                    } 
                    else if (t.equipment) {
                        for (let i = 1; i <= 4; i++) {
                            if (t.equipment[`pocket${i}`]) {
                                const eqData = t.equipment[`pocket${i}`];
                                stolenItemId = typeof eqData === 'object' ? eqData.id : eqData;
                                
                                if (typeof eqData === 'object') {
                                    eqData.count--;
                                    if (eqData.count <= 0) t.equipment[`pocket${i}`] = null;
                                } else {
                                    t.equipment[`pocket${i}`] = null;
                                }
                                break;
                            }
                        }
                    }
                }
                if (stolenItemId) {
                    battle.showFloatingText(t, "장비 탈취!", "#888");
                    const itemInfo = battle.gameApp.itemData[stolenItemId] || { name: stolenItemId };
                    battle.log(`🎁 ${t.name}에게서 [${itemInfo.name}]을(를) 훔쳤습니다!`, 'log-item');
                    let placedInPocket = false;
                    if (caster.equipment && caster.team === 0) {
                        for (let i = 1; i <= 8; i++) {
                            if (!caster.equipment[`pocket${i}`]) {
                                caster.equipment[`pocket${i}`] = stolenItemId;
                                placedInPocket = true;
                                battle.showFloatingText(caster, `🎒 ${itemInfo.name} 획득`, '#ffdd00');
                                if (battle.viewingUnit === caster) battle.ui.updateStatusPanel(); 
                                battle.ui.updateFloatingControls();
                                break;
                            }
                        }
                    }
                    if (!placedInPocket) {
                        battle.showFloatingText(caster, `인벤토리로 이동`, '#aaa');
                        battle.lootItem(stolenItemId, caster);
                    }
                } else {
                    battle.showFloatingText(t, "훔칠 아이템 없음", "#aaa");
                    battle.log(`훔칠 대상 장비가 존재하지 않습니다.`, "log-system");
                }
            }
            else if (type === 'CC_PUPPET' || type === 'CC_CHARM' || type === 'STAT_CHARM') { 
                battle.showFloatingText(t, "매혹!", "#d0d");
                
                battle.log(`💖 ${t.name}의 눈빛이 탁해집니다... (매혹 진행 중)`, 'log-cc');
                battle.triggerShakeAnimation(t);
                await new Promise(r => setTimeout(r, 1000)); 

                const alliesOfTarget = battle.units.filter(u => u.team === t.team && u.curHp > 0 && u.id !== t.id && battle.grid.getDistance(u, t) <= 2);
                if (alliesOfTarget.length > 0) {
                    const victim = alliesOfTarget[Math.floor(Math.random() * alliesOfTarget.length)];
                    battle.log(`😵 ${t.name}이(가) 매혹되어 아군인 ${victim.name}을(를) 냅다 공격합니다!`, 'log-cc');
                    await this.performAttack(t, victim, 1.0, "매혹 공격", false, t.atkType || 'PHYS', 1);
                } else {
                    battle.log(`😵 ${t.name}이(가) 매혹되었으나 공격할 대상이 없어 스턴에 걸립니다.`, 'log-cc');
                    this.applyStatus(t, {type: 'CC_STUN', val: 1, duration: 1}, caster);
                }
            }
            else if (type.startsWith('ECON')) {
                const bonusPower = Formulas.calculateEffectPower(caster, type, val);
                 if (type === 'ECON_GOLD') {
                    battle.goldMod *= val;
                    battle.showFloatingText(caster, "골드 획득 증가", "#ffd700");
                } else if (type.startsWith('ECON_DROP')) {
                    battle.dropMod *= val;
                    battle.showFloatingText(caster, "아이템 획득 증가", "#aaf");
                } else {
                    const items = Object.keys(battle.gameApp.itemData).filter(k => battle.gameApp.itemData[k].type === 'CONSUME');
                    if (items.length > 0) {
                        const randItem = items[Math.floor(Math.random() * items.length)];
                        if (randItem) {
                            const itemInfo = battle.gameApp.itemData[randItem];
                            let placed = false;
                            if (caster.equipment) {
                                for (let i = 1; i <= 4; i++) {
                                    const pocketKey = `pocket${i}`;
                                    if (!caster.equipment[pocketKey]) {
                                        caster.equipment[pocketKey] = randItem;
                                        placed = true;
                                        battle.showFloatingText(caster, `🎒 ${itemInfo.name}`, '#ffdd00');
                                        battle.log(`주머니 생성: ${itemInfo.name}`, 'log-item');
                                        if (caster.team === 0) { battle.ui.updateStatusPanel(); battle.ui.updateFloatingControls(); }
                                        break;
                                    }
                                }
                            }
                            if (!placed) battle.log("공간 부족으로 아이템이 소멸했습니다.", "log-bad");
                        }
                    }
                }
            }
            else {
                let appliedType = type;
                
                if (appliedType.startsWith('IT_') || appliedType.startsWith('MT_') || appliedType.startsWith('CT_')) {
                    continue;
                }

                let isSilentFail = false;

                // ⭐ [무희 기획 반영] 살로메의 일곱 베일: 매 턴 7가지 상태이상 중 하나를 무작위로 부여
                // (위계가 높을수록 즉, 치명적일수록 부여 확률이 낮게 세팅됩니다)
                if (appliedType === 'DEBUFF_CHANNELED_RANDOM') {
                    const randVal = Math.random() * 100;
                    if (randVal < 3) appliedType = 'CC_DEATH';            // 3% 확률 (즉사)
                    else if (randVal < 8) appliedType = 'CC_PETRIFY';     // 5% 확률 (석화)
                    else if (randVal < 18) appliedType = 'CC_CHARM';      // 10% 확률 (매혹)
                    else if (randVal < 33) appliedType = 'STAT_CONFUSION'; // 15% 확률 (혼란)
                    else if (randVal < 53) appliedType = 'STAT_CURSE';    // 20% 확률 (저주)
                    else if (randVal < 73) appliedType = 'CC_BIND';       // 20% 확률 (속박)
                    else appliedType = 'STAT_BLIND';                      // 27% 확률 (실명)
                    
                    isSilentFail = true; // 실패 시 불필요한 텍스트 도배 방지
                }

                const isDebuff = (appliedType.includes('DEBUFF_') || appliedType.includes('CC_') || appliedType.includes('RANDOM') || 
                                 ((appliedType.includes('STAT_') || appliedType.includes('STATUS_')) && !appliedType.includes('BUFF_'))) 
                                 && !appliedType.includes('CHANNELED');
                
                if (isDebuff && t.team === caster.team && String(skill.target).toUpperCase() !== 'SELF') {
                    continue; 
                }

                let parsedProb = parseFloat(eff.prob);
                if (isNaN(parsedProb)) parsedProb = 100;
                
                if (skill && (skill.job === '무희' || skill.name.includes('안무') || skill.name.includes('춤'))) {
                    const isNight = battle.isNight || false; 
                    if (isNight && isDebuff) {
                        parsedProb = Math.max(0, parsedProb - 20);
                    }
                }

                let finalDuration = eff.dur || eff.duration || 2;
                let finalVal = val;

                // ⭐ [음유시인 기획 반영] 아파시오나토 & 절대음감 & 메아리
                if (isDebuff && caster.skills) {
                    // 1. 아파시오나토 (HP 50% 이하 시 디버프 확률 20% 상승 및 보정치 1.2배)
                    const appassionato = caster.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_COND_HP'));
                    if (appassionato) {
                        const reqHpRatio = parseFloat(appassionato.effects.find(e => e.type === 'PAS_COND_HP').val) || 0.5;
                        const maxHp = Formulas.getDerivedStat ? Formulas.getDerivedStat(caster, 'hp_max') : (caster.hp || 100);
                        if ((caster.curHp / maxHp) <= reqHpRatio) {
                            parsedProb += 20;
                            finalVal *= 1.2; // 상태이상/스탯 보정치 20% 상승
                        }
                    }

                    // 2. 절대음감 (진혼곡(RQ) 스킬일 때 확률 +30%)
                    const absolutePitch = caster.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_RQ'));
                    if (absolutePitch && skill && skill.category && skill.category.includes('RQ')) {
                        parsedProb += 30;
                    }

                    // 3. 메아리 (진혼곡(RQ) 및 비가(DR) 스킬 상태이상 지속 시간 1턴 연장)
                    const echoSound = caster.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_EXTEND_DEBUFF'));
                    if (echoSound && skill && skill.category && (skill.category.includes('RQ') || skill.category.includes('DR'))) {
                        finalDuration += 1;
                    }
                }

                this.applyStatus(t, { 
                    type: appliedType, 
                    val: finalVal, 
                    duration: finalDuration, 
                    prob: parsedProb, 
                    area: eff.area || (skill ? skill.area : 999),
                    silentFail: isSilentFail 
                }, caster);
            }
        }
    }

    async performAttack(atk, def, mult, name, isDrain, type, hitCount = 1, options = {}) {
        const battle = this.battle;
        
        // ⭐ [이슈 1 버그 해결] 방어자가 없거나, 환경 피해(독/장판)로 공격자(atk)가 없을 경우의 치명적 오류 방지
        if (!def || def.hp === undefined || def.curHp <= 0) return;
        if (!atk) atk = { id: 'ENVIRONMENT', team: -1, name: '환경/지형', buffs: [], skills: [] };
        
        // ⭐ [타겟 패널 버그 수정] 피격 시 무조건 방어자를 우측 타겟 패널에 띄웁니다.
        if (battle.ui && battle.ui.updateRightPanel) {
            battle.ui.updateRightPanel([def]);
        }
        
        const skill = options.skill || {};

        if(name !== "스킬" && name !== "흡수") battle.actions.acted = true;
        
        if (battle.hasStatus(atk, 'STEALTH') || battle.hasStatus(atk, 'STAT_STEALTH')) {
            atk.buffs = atk.buffs.filter(b => b.type !== 'STEALTH' && b.type !== 'STAT_STEALTH');
            battle.showFloatingText(atk, "Revealed", "#ccc");
            if(atk.team === 0) battle.log(`👁️ [은신 해제] ${atk.name}이(가) 공격하여 모습을 드러냈습니다.`, 'log-system');
        }

        const dir = battle.grid.getDirection(atk, def);
        atk.facing = dir;

        if (!type) type = atk.atkType || 'PHYS';
        if (atk.team === 0) battle.gainActionXp(atk, 5);
        
        const isBasicAtk = (!skill || skill.id === '1000' || !skill.id || (skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => skill.name.includes(n))));

        const jokerPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP_THIEF' || e.type === 'PAS_PROB_UP'));
        const jokerBonus = jokerPassive ? 30 : 0;

        const perfectCrime = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_IGNORE_GUARD'));
        if (perfectCrime && isBasicAtk && !options.isCounter) {
            const prob = (parseFloat(perfectCrime.effects.find(e => e.type === 'PAS_IGNORE_GUARD').prob) || 20) + jokerBonus;
            if (Math.random() * 100 <= prob) {
                options.penetrate = 1.0; 
                options.isPerfectCrime = true;
                battle.showFloatingText(atk, "완전 범죄!", "#800080");
            }
        }

        if (name !== "분신 공격" && hitCount === 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
            const doublePassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLE_HIT'));
            const doubleSkillPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLE_HIT_SKILL'));

            if (doublePassive && isBasicAtk) {
                let prob = (parseFloat(doublePassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT').prob) || 20);
                if (Math.random() * 100 <= prob) hitCount = 2;
                if (hitCount === 2) battle.log(`👥 [그림자 분신] 환영이 함께 공격합니다!`, 'log-skill');
            } else if (doubleSkillPassive && skill && skill.name && skill.name.includes('단검 투척')) {
                let prob = (parseFloat(doubleSkillPassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT_SKILL').prob) || 30) + jokerBonus;
                if (Math.random() * 100 <= prob) {
                    hitCount = 2;
                    options.globalMult = (options.globalMult || 1.0) * (parseFloat(doubleSkillPassive.effects.find(e=>e.type==='PAS_DOUBLE_HIT_SKILL').val) || 0.7);
                    battle.log(`🗡️ [그림자 칼날] 두 번째 단검이 연달아 날아갑니다!`, 'log-skill');
                }
            }
        }

        let beforeHit = null;
        let rangeBeforeHit = null;
        let anyHit = null; 

        if (!options.isCounter && def.skills && atk !== def) {
            beforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_BEFORE_HIT'));
            rangeBeforeHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_RANGE_BEFORE_HIT'));
            anyHit = def.skills.find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_ANY_HIT')); 
        }

        const isBasicAtkCheck = (!skill || skill.id === '1000' || !skill.id || (skill.name && ['연격', '연타', '주작선무', '백호연환'].some(n => skill.name.includes(n))));
        const distToDef = battle.grid.getDistance(atk, def);
        
        if (!options.isCounter && !options.isPreemptive && distToDef <= 1 && isBasicAtkCheck && (type === 'PHYS' || type === 'DMG_PHYS')) {
            const preemptive = (def.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PREEMPTIVE_STRIKE'));
            if (preemptive) {
                const prob = parseFloat(preemptive.effects.find(e => e.type === 'PAS_PREEMPTIVE_STRIKE').prob) || 30;
                if (Math.random() * 100 <= prob) {
                    battle.showFloatingText(def, "선견!", "#ffcc00");
                    battle.log(`👁️ [선견] ${def.name}이(가) 적의 움직임을 읽고 선제 공격을 날립니다!`, 'log-skill');
                    await this.performAttack(def, atk, 1.0, "선제 공격", false, def.atkType || 'PHYS', 1, { isCounter: true, isPreemptive: true, skill: { id: '1000' } });
                    if (def.curHp <= 0 || atk.curHp <= 0) return; 
                }
            }
        }

        let firstHitLanded = false; 

        for (let i = 0; i < hitCount; i++) {
            if (atk.curHp <= 0) break; 
            
            let currentDef = def; 
            let dist = battle.grid.getDistance(atk, currentDef);

            if (!options.isCounter && !options.isCovered) {
                const sacrificeUnit = battle.units.find(u => 
                    u.team === currentDef.team && u.curHp > 0 && u !== currentDef && 
                    u.buffs.some(b => b.type === 'BUFF_SACRIFICE') && 
                    battle.grid.getDistance(u, currentDef) <= 1
                );

                if (sacrificeUnit) {
                    currentDef = sacrificeUnit;
                    dist = battle.grid.getDistance(atk, currentDef);
                    options.isCovered = true;
                    options.forceFrontal = true; 
                    options.sureHit = true;      
                    battle.showFloatingText(currentDef, "희생!", "#ffaa00");
                    battle.log(`❤️‍🩹 [희생] ${currentDef.name}이(가) ${def.name}의 피해를 온몸으로 대신 받습니다!`, 'log-skill');
                } else {
                    const coverUnit = battle.units.find(u => u.team === currentDef.team && u.curHp > 0 && u !== currentDef && battle.grid.getDistance(u, currentDef) <= 1 && u.skills && u.skills.some(s => s.type === 'PASSIVE' && s.effects.some(e=>e.type === 'PAS_COVER_DMG' || e.type === 'PAS_COVER_DMG_COND')));
                    if (coverUnit) {
                        const coverEff = coverUnit.skills.find(s=>s.type==='PASSIVE' && s.effects.some(e=>e.type.startsWith('PAS_COVER'))).effects.find(e=>e.type.startsWith('PAS_COVER'));
                        
                        let canCover = true;
                        if (coverEff.type === 'PAS_COVER_DMG_COND' && coverUnit.curHp <= coverUnit.hp * 0.3) canCover = false;
                        
                        if (canCover) {
                            const prob = parseFloat(coverEff.prob) || 50;
                            if (Math.random() * 100 <= prob) {
                                currentDef = coverUnit;
                                dist = battle.grid.getDistance(atk, currentDef);
                                options.isCovered = true; 
                                options.forceFrontal = true; 
                                options.sureHit = true;      
                                battle.showFloatingText(currentDef, "비호!", "#0ff");
                                battle.log(`🦸‍♂️ [비호] ${currentDef.name}이(가) ${def.name}을(를) 감싸며 대신 공격을 받습니다!`, 'log-skill');
                            }
                        }
                    }
                }
            }

            if (!options.isCounter && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && isBasicAtk) {
                const parryPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PARRY'));
                if (parryPassive) {
                    const prob = parseFloat(parryPassive.effects.find(e => e.type === 'PAS_PARRY').prob) || 20;
                    if (Math.random() * 100 <= prob) {
                        battle.showFloatingText(currentDef, "패링!", "#ffffff");
                        battle.log(`⚔️ [패링] ${currentDef.name}이(가) 적의 근접 일반공격을 완벽히 튕겨냈습니다!`, 'log-system');
                        continue; 
                    }
                }
            }

            if (!options.isCounter && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS')) { 
                const interceptPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'INTERCEPT'));
                const hitDirForIntercept = battle.grid ? battle.grid.getDirection(currentDef, atk) : 0;
                const diffForIntercept = Math.abs(currentDef.facing - hitDirForIntercept);
                const isBackstabForIntercept = (diffForIntercept === 3);

                if (interceptPassive && !isBackstabForIntercept) {
                    const prob = parseFloat(interceptPassive.effects.find(e=>e.type==='INTERCEPT').prob) || 20;
                    if (Math.random() * 100 <= prob) {
                        battle.createProjectile(atk, currentDef); 
                        await new Promise(r => setTimeout(r, 150));
                        battle.showFloatingText(currentDef, "요격!", "#fff");
                        battle.log(`🏹 [요격] ${currentDef.name}이(가) 날아오는 공격을 맞혀 무효화했습니다!`, 'log-system');
                        continue; 
                    }
                }
            }
            
            if (!options.isCounter && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                const blockIntPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'SPELL_BLOCK_INT'));
                if (blockIntPassive) {
                    const myInt = Formulas.getStat(currentDef, 'int');
                    const atkInt = Formulas.getStat(atk, 'int');
                    const intDiff = Math.max(0, myInt - atkInt);
                    const baseProb = parseFloat(blockIntPassive.effects.find(e => e.type === 'SPELL_BLOCK_INT').prob) || 30;
                    const prob = Math.min(80, baseProb + (intDiff * 1.5)); 
                    
                    if (Math.random() * 100 <= prob) {
                        battle.showFloatingText(currentDef, "주문 역산!", "#0ff");
                        battle.log(`🛡️ [주문 차단] ${currentDef.name}이(가) 지능의 격차를 이용해 마법 수식을 완벽히 역산하여 무효화했습니다!`, 'log-system');
                        continue; 
                    }
                }

                const blockPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_CASTER_DETECTED' || e.type === 'SPELL_BLOCK' || e.type === 'PAS_SPELL_REFLECTION'));
                if (blockPassive) {
                    const pEff = blockPassive.effects.find(e => e.type === 'PAS_CASTER_DETECTED' || e.type === 'SPELL_BLOCK' || e.type === 'PAS_SPELL_REFLECTION');
                    const prob = parseFloat(pEff.prob) || 25;
                    const isReflection = pEff.type === 'PAS_SPELL_REFLECTION';
                    const reflectMult = isReflection ? (parseFloat(pEff.val) || 1.0) : (parseFloat(pEff.val) || 0);

                    if (Math.random() * 100 <= prob) {
                        if (isReflection) {
                            battle.showFloatingText(currentDef, "주문 반사!", "#f0f");
                            battle.log(`🪞 [주문 반사] ${currentDef.name}이(가) 날아오는 공격 마법을 거울처럼 튕겨냅니다!`, 'log-skill');
                        } else {
                            battle.showFloatingText(currentDef, "주문 차단!", "#0ff");
                            battle.log(`🛡️ [주문 차단] ${currentDef.name}이(가) 날아오는 마법 수식을 파괴했습니다!`, 'log-system');
                        }
                        
                        if (reflectMult > 0) {
                            battle.createProjectile(currentDef, atk);
                            await new Promise(r => setTimeout(r, 150));
                            if (!isReflection) battle.showFloatingText(atk, "주문 반사!", "#f0f");
                            await this.performAttack(currentDef, atk, mult * reflectMult, isReflection ? "반사 마법" : "반사 마법", false, type, 1, {isCounter: true});
                        }
                        continue; 
                    }
                }
            }
            
            if (!options.isCounter) {
                const triggerOptions = { triggerUnit: atk, isCounter: true };

                if (anyHit) {
                    for (const eff of anyHit.effects) {
                        if (eff.type.startsWith('PAS_')) continue; 
                        await battle.skillProcessor.processEffect(eff, atk, atk, currentDef, triggerOptions, anyHit);
                    }
                }

                if (beforeHit && dist <= 1) {
                    for (const eff of beforeHit.effects) {
                        if (eff.type.startsWith('PAS_')) continue; 
                        await battle.skillProcessor.processEffect(eff, atk, atk, currentDef, triggerOptions, beforeHit);
                    }
                }
                if (rangeBeforeHit && dist > 1) {
                    for (const eff of rangeBeforeHit.effects) {
                        if (eff.type.startsWith('PAS_')) continue; 
                        await battle.skillProcessor.processEffect(eff, atk, atk, currentDef, triggerOptions, rangeBeforeHit);
                    }
                }
            }
            if (dist > 1) battle.createProjectile(atk, currentDef);
            else battle.triggerBumpAnimation(atk, currentDef);

            await new Promise(resolve => setTimeout(async () => {
                if (atk === currentDef) options.sureHit = true;

                const currentOptions = { ...options }; 

                if (currentOptions.skill) {
                    let buffChanceBonus = currentOptions.buffChanceBonus || 0;
                    let buffPowerBonus = currentOptions.buffPowerBonus || 0;
                    let durationBonus = currentOptions.debuffDurationBonus || 0;

                    const appassionato = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_COND_HP'));
                    if (appassionato) {
                        const reqHpRatio = parseFloat(appassionato.effects.find(e => e.type === 'PAS_COND_HP').val) || 0.5;
                        if ((atk.curHp / (atk.hp || 100)) <= reqHpRatio) {
                            buffChanceBonus += 20;
                            buffPowerBonus += 0.2;
                        }
                    }

                    const absolutePitch = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_RQ'));
                    if (absolutePitch && currentOptions.skill.category && currentOptions.skill.category.includes('RQ')) {
                        buffChanceBonus += 30;
                    }
                    const perfectBalance = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_DEBUFF_DM'));
                    if (perfectBalance && currentOptions.skill.category && currentOptions.skill.category.includes('DM')) {
                        buffChanceBonus += 30;
                    }

                    const echoSound = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_EXTEND_DEBUFF'));
                    if (echoSound && currentOptions.skill.category && (currentOptions.skill.category.includes('RQ') || currentOptions.skill.category.includes('DR') || currentOptions.skill.category.includes('DM'))) {
                        durationBonus = 1;
                    }

                    currentOptions.buffChanceBonus = buffChanceBonus;
                    currentOptions.buffPowerBonus = buffPowerBonus;
                    currentOptions.debuffDurationBonus = durationBonus;
                }

                if (atk.team === currentDef.team && atk !== currentDef && ['MAG', 'DMG_MAG', 'DMG_FIRE', 'DMG_ICE', 'DMG_LIGHTNING', 'DMG_EARTH', 'DMG_WIND', 'DMG_HOLY'].includes(type)) {
                    const safeAllyPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AOE_SAFE_ALLY')); 
                    if (safeAllyPassive && skill && skill.area && skill.area !== 0 && skill.area !== 'SINGLE') {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 0.5;
                        currentOptions.isSafeAlly = true; 
                        battle.showFloatingText(currentDef, "술식 보호", "#00ff00");
                    }
                }

                if (skill && skill.name === '청룡승천' && battle.isFlying && battle.isFlying(currentDef)) {
                    currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.5;
                }

                if (skill && skill.name === '발경') currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + 0.5;
                if (skill && skill.name === '권강') currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + 1.0;

                if (i > 0 && firstHitLanded && skill && (skill.name === '연타' || skill.name === '백호연환')) {
                    currentOptions.sureHit = true;
                }

                if (isBasicAtk) {
                    if (i === 0) {
                        const anatomical = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_IGNORE_DEF'));
                        if (anatomical && Math.random() * 100 <= (parseFloat(anatomical.effects[0].prob) || 30)) {
                            currentOptions.ignoreDefPct = (currentOptions.ignoreDefPct || 0) + parseFloat(anatomical.effects[0].val || 0.15);
                            battle.showFloatingText(atk, "혈도 타격", "#ffaa00");
                        }
                    }
                    if (i === 0) {
                        const basicUpPassive = (atk.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_ATK_UP'));
                        if (basicUpPassive) {
                            const val = parseFloat(basicUpPassive.effects.find(e => e.type === 'PAS_BASIC_ATK_UP').val) || 1.2;
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * val;
                        }
                    }

                    const basicDefUp = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_BASIC_DEF_UP'));
                    if (basicDefUp) {
                        const val = parseFloat(basicDefUp.effects.find(e => e.type === 'PAS_BASIC_DEF_UP').val) || 1.2;
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) / val;
                    }

                    const nextBasicBuff = atk.buffs.find(b => b.type === 'BUFF_NEXT_BASIC_ATK' || b.type === 'BUFF_NEXT_PHYS_ATK');
                    if (nextBasicBuff) {
                        currentOptions.globalMult = (currentOptions.globalMult || 1.0) * parseFloat(nextBasicBuff.val || 1.3);
                        atk.buffs = atk.buffs.filter(b => b !== nextBasicBuff); 
                        battle.log(`💢 [힘의 방출] ${atk.name}의 일격에 실린 힘이 터져나옵니다!`, 'log-skill');
                    }
                }
                
                if (battle.grid) {
                    const atkH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(atk.q, atk.r) : 0; 
                    const defH = battle.rangeManager && typeof battle.rangeManager.getStandingHeight === 'function' ? battle.rangeManager.getStandingHeight(currentDef.q, currentDef.r) : 0; 
                    const heightDiff = atkH - defH;
                    
                    let heightDmgMod = 1.0;
                    let heightAccMod = 0;
                    
                    if (heightDiff > 0) {
                        heightDmgMod += Math.min(0.30, heightDiff * 0.05);
                        heightAccMod += Math.min(30, heightDiff * 5);
                    } else if (heightDiff < 0) {
                        heightDmgMod += Math.max(-0.30, heightDiff * 0.05); 
                        heightAccMod += Math.max(-30, heightDiff * 5);
                    }

                    currentOptions.globalMult = (currentOptions.globalMult || 1.0) * heightDmgMod;
                    currentOptions.accBonus = (currentOptions.accBonus || 0) + heightAccMod;
                }

                const result = Formulas.calculateDamage(atk, currentDef, mult, type, battle.grid, currentOptions);

                if (atk === currentDef) {
                    result.isCrit = false;
                    result.isWeak = false;
                    result.isResist = false;
                    result.isMiss = false;
                }

                if (result.hitContext === 'BACKSTAB') battle.showFloatingText(currentDef, "배후 공격!", "#f0f");
                if (result.hitContext === 'BLOCK') battle.showFloatingText(currentDef, "막음!", "#aaa");
                if (result.hitContext === 'EXECUTE') battle.showFloatingText(currentDef, "처형!", "#f00");

                if (result.isMiss) {
                    battle.showFloatingText(currentDef, result.text, "#888"); 
                    battle.log(`💨 [빗나감] ${atk.name}의 공격이 ${currentDef.name}에게 빗나갔습니다!`, "log-system");
                    
                    // ⭐ [이슈 5 버그 해결] 빗나갔을 때의 어뷰징/혼란 경험치 조건 추가
                    const isFriendlyFire = (atk.team === currentDef.team);
                    const isCC = battle.hasStatus(atk, 'STAT_CONFUSION') || battle.hasStatus(atk, 'CC_CHARM') || battle.hasStatus(atk, 'CC_PUPPET');
                    if (!isFriendlyFire || isCC) {
                        if (battle.progression && battle.progression.gainCombatPoints) {
                            battle.progression.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, false, currentDef, false);
                        } else if (battle.gainCombatPoints) {
                            battle.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, false, currentDef, false);
                        }
                    }
                    
                    currentDef._missedSkill = true; 

                    const celestial = currentDef.buffs.find(b => b.type === 'BUFF_CELESTIAL_REVERSAL');
                    if (celestial && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && !options.isCounter) {
                        battle.showFloatingText(currentDef, "역전세!", "#00ffff");
                        battle.log(`☯️ [천지역전세] ${currentDef.name}이(가) 공격을 흘려내고 즉시 반격합니다!`, 'log-skill');
                        await this.performAttack(currentDef, atk, 0.7, "역전세 반격", false, currentDef.atkType || 'PHYS', 1, { isCounter: true, skill: { id: '1000' } });
                    }
                    
                    resolve({ isHit: false, damage: 0 }); return;
                }

                firstHitLanded = true; 

                if (result.isCursed) battle.showFloatingText(currentDef, "Cursed!", "#b0b");
                let dmg = result.damage;
                if (currentOptions.bonusDmg) {
                    dmg += currentOptions.bonusDmg;
                }
                
                if (currentDef.race === 'UNDEAD' && ['HOLY', 'DMG_HOLY'].includes(type)) {
                    battle.showFloatingText(currentDef, "언데드 추뎀!", "#ffff00");
                }

                if (skill && skill.name === '구마술' && currentDef.race === 'UNDEAD' && (currentDef.curHp - dmg) <= 0) {
                    currentDef.isFullyDead = true; 
                    battle.log(`✝️ [구마술] 불경한 자가 빛에 타들어가며 전장에서 영구히 소멸합니다!`, "log-skill");
                }
                
                if (currentDef.isWall || currentDef.type === 'OBJECT') {
                    const wallType = currentDef.unitName || currentDef.key;
                    
                    if (wallType === 'WALL_FIRE') {
                        if (type === 'DMG_ICE' || type === 'DMG_WIND') {
                            dmg = 9999; 
                            battle.log(`❄️ 바람과 얼음이 화염 장벽을 소멸시켰습니다!`, 'log-system');
                        }
                        if (type === 'DMG_LIGHTNING') dmg = 0; 
                        if (type === 'DMG_FIRE') {
                            dmg = 0; 
                            currentOptions.penetrate = 1.0;
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.3; 
                            battle.log(`🔥 화염 마법이 장벽을 관통하며 위력이 30% 증폭됩니다!`, 'log-skill');
                        }
                    } 
                    else if (wallType === 'WALL_ICE') {
                        if (type === 'DMG_FIRE') {
                            dmg = 9999; 
                            battle.log(`🔥 불꽃이 얼음 장벽을 녹여버렸습니다!`, 'log-system');
                        }
                        if (type === 'DMG_ICE' || type === 'DMG_WIND') dmg = 0; 
                        if (type === 'DMG_LIGHTNING') {
                            dmg = 9999; 
                            currentOptions.penetrate = 1.0; 
                            currentOptions.globalMult = (currentOptions.globalMult || 1.0) * 1.3; 
                            battle.log(`⚡ 벼락이 얼음 장벽을 분쇄하며 위력이 30% 증폭됩니다!`, 'log-skill');
                        }
                    } 
                    else if (wallType === 'WALL_EARTH') {
                        if (type === 'DMG_WIND') dmg = Math.floor(dmg * 1.3); 
                    }
                }

                if (result.text === "IMMUNE") { 
                    dmg = 0; 
                    battle.showFloatingText(currentDef, "면역!", "#fff"); 
                    battle.log(`🛡️ [면역] ${currentDef.name}은(는) 해당 공격에 면역입니다. (피해 무효)`, "log-system");
                }
                
                if (battle.hasStatus(currentDef, 'CC_FREEZE') || battle.hasStatus(currentDef, 'STAT_FREEZE')) {
                    if (type === 'DMG_LIGHTNING' || type === 'LIGHTNING') {
                        dmg *= 1.5;
                        battle.showFloatingText(currentDef, "초전도!", "#ffeb3b");
                        battle.log(`⚡ [초전도] 얼어붙은 ${currentDef.name}에게 전격이 흐르며 추가 피해!`, "log-dmg");
                    }
                    currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'CC_FREEZE' && b.type !== 'STAT_FREEZE');
                    battle.showFloatingText(currentDef, "쇄빙!", "#aef");
                    battle.log(`🧊 [쇄빙] 피격으로 인해 ${currentDef.name}의 빙결이 해제되었습니다.`, "log-system");
                }
                
                const shield = currentDef.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
                if (shield && dmg > 0) {
                    const absorbed = Math.min(shield.amount, dmg);
                    shield.amount -= absorbed;
                    dmg -= absorbed;
                    battle.showFloatingText(currentDef, `(${absorbed})`, "#00bfff"); 
                    battle.log(`💠 [보호막] ${currentDef.name}의 보호막이 ${absorbed} 피해를 흡수했습니다.`, "log-system");
                    
                    if (shield.amount <= 0 || shield.name === '신의 자비') {
                        currentDef.buffs = currentDef.buffs.filter(b => b !== shield);
                        if (shield.name === '신의 자비') battle.log(`✨ [신의 자비] 신성한 보호막이 피해를 흡수하고 소멸했습니다.`, "log-skill");
                    }
                }

                if (type === 'PHYS' || type === 'DMG_PHYS') {
                    if (currentDef.buffs && currentDef.buffs.some(b => b.type === 'BUFF_IMMUNE_PHYS')) {
                        dmg = 0;
                        battle.showFloatingText(currentDef, "PHYS IMMUNE", "#ccc");
                    }
                    const redBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_RED_DMG_PHYS');
                    if (redBuff && dmg > 0) dmg = Math.floor(dmg * parseFloat(redBuff.val)); 
                }
                
                let hasRedBuffAll = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_RED_DMG_ALL');
                let redBuffVal = hasRedBuffAll ? parseFloat(hasRedBuffAll.val) : 1.0;

                if (!hasRedBuffAll && currentDef.skills) {
                    const guardianAngel = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ANY_HIT') && s.name === '수호천사');
                    if (guardianAngel) {
                        const prob = parseFloat(guardianAngel.effects[0].prob) || 30;
                        if (Math.random() * 100 <= prob) {
                            hasRedBuffAll = true;
                            redBuffVal = parseFloat(guardianAngel.effects[1]?.val) || 0.5; 
                        }
                    }
                }

                if (hasRedBuffAll && dmg > 0) {
                    dmg = Math.floor(dmg * redBuffVal);
                    battle.showFloatingText(currentDef, "수호천사!", "#00ffff");
                    battle.log(`👼 [수호천사] 기적처럼 수호천사가 강림하여 피해를 반감시킵니다!`, 'log-skill');
                }

                const fixedPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'FIXED_TAKE_DMG' || e.type === 'DMG_TAKE_FIXED'));                if (fixedPassive && dmg > 0 && type === 'PHYS') { 
                    const pEff = fixedPassive.effects.find(e => e.type === 'FIXED_TAKE_DMG' || e.type === 'DMG_TAKE_FIXED');
                    const prob = parseFloat(pEff.prob) || 15;
                    if (Math.random() * 100 <= prob) {
                        dmg = 1;
                        battle.showFloatingText(currentDef, "금강불괴!", "#fff");
                        battle.log(`💎 [금강불괴] ${currentDef.name}이(가) 피해를 1로 고정시켰습니다!`, "log-system");
                    }
                }
                if (battle.hasStatus(currentDef, 'STAT_PETRIFY')) {
                    battle.showFloatingText(currentDef, "돌덩이!", "#aaaaaa");
                    resolve(); return;
                }

                if (dmg > 0) {
                    if (battle.hasStatus(currentDef, 'STAT_SLEEP') || battle.hasStatus(currentDef, 'CC_SLEEP')) {
                        currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'STAT_SLEEP' && b.type !== 'CC_SLEEP');
                        battle.showFloatingText(currentDef, "깨어남!", "#ffffff");
                        battle.log(`🔔 앗따가! 피해를 입고 ${currentDef.name}이(가) 잠에서 깼습니다.`, 'log-system');
                    }
                }

                if (currentDef.curHp - dmg <= 0 && currentDef.curHp > 1) {
                    const survivePassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'EFF_SURVIVE' || e.type === 'PAS_MANA_SHIELD_SURVIVE'));
                    const surviveBuff = currentDef.buffs && currentDef.buffs.find(b => b.type === 'BUFF_STAT_SURVIVE');
                    
                    if (survivePassive || surviveBuff) {
                        const manaShieldEff = survivePassive ? survivePassive.effects.find(e => e.type === 'PAS_MANA_SHIELD_SURVIVE') : null;
                        
                        if (manaShieldEff) {
                            if (!currentDef._manaShieldSurviveUsed) {
                                const excessDmg = dmg - (currentDef.curHp - 1);
                                if (currentDef.curMp >= excessDmg) {
                                    currentDef.curMp -= excessDmg;
                                    dmg = currentDef.curHp - 1; 
                                    currentDef._manaShieldSurviveUsed = true; 
                                    battle.showFloatingText(currentDef, `마력 방패 (-${Math.floor(excessDmg)}MP)`, "#00aaff");
                                    battle.log(`🛡️ [마력 방패] ${currentDef.name}이(가) 마나를 방패 삼아 치명상을 버텨냈습니다!`, "log-skill");
                                }
                            }
                        } else {
                            const prob = surviveBuff ? 100 : (parseFloat(survivePassive.effects.find(e => e.type === 'EFF_SURVIVE').prob) || 100);
                            if (Math.random() * 100 <= prob) {
                                dmg = currentDef.curHp - 1; 
                                battle.showFloatingText(currentDef, "불멸!", "#ff0");
                                battle.log(`🌬️ [불멸/마지막 숨결] ${currentDef.name}이(가) 치명상을 버텨냈습니다!`, "log-system");
                            }
                        }
                    }
                }
                if (battle.activeTimeStop && battle.activeTimeStop.caster.id !== currentDef.id) {
                    currentDef._delayedDamage = (currentDef._delayedDamage || 0) + dmg;
                    battle.showFloatingText(currentDef, "Time Stopped", "#aaa");
                    battle.log(`⏳ 시간 정지: 피해 누적 중... (${currentDef._delayedDamage})`, 'log-system');
                    dmg = 0; 
                }

                currentDef.curHp = Math.max(0, currentDef.curHp - dmg);

                if (skill && skill.name === '권강' && dmg > 0) {
                    const splashDmg = Math.floor(dmg * 0.3);
                    if (splashDmg > 0) {
                        const neighbors = battle.grid.getNeighbors(currentDef);
                        Object.values(neighbors).forEach(hex => {
                            const splashTarget = battle.getUnitAt(hex.q, hex.r);
                            if (splashTarget && splashTarget.team !== atk.team && splashTarget !== currentDef && splashTarget.curHp > 0) {
                                splashTarget.curHp = Math.max(0, splashTarget.curHp - splashDmg);
                                battle.showFloatingText(splashTarget, `파음 -${splashDmg}`, "#ff5500");
                            }
                        });
                    }
                }
                
                if (currentDef.curHp > 0 && currentDef.curHp < currentDef.hp * 0.3) {                   const autoPotionPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_AUTO_POTION' || e.type === 'PAS_EMERGENCY_POTION'));
                    if (autoPotionPassive && currentDef.equipment) {
                        for (let i = 1; i <= 8; i++) {
                            const pocketKey = `pocket${i}`;
                            const itemData = currentDef.equipment[pocketKey];
                            const itemId = typeof itemData === 'object' ? itemData.id : itemData;
                            
                            if (itemId && String(itemId).includes('POTION') && battle.gameApp && battle.gameApp.itemData[itemId]) {
                                const healVal = battle.gameApp.itemData[itemId].val || 30;
                                
                                if (typeof itemData === 'object') {
                                    itemData.count--;
                                    if (itemData.count <= 0) currentDef.equipment[pocketKey] = null;
                                } else {
                                    currentDef.equipment[pocketKey] = null;
                                }
                                
                                currentDef.curHp = Math.min(currentDef.hp, currentDef.curHp + healVal);
                                battle.showFloatingText(currentDef, `자동 회복 +${healVal}`, "#55ff55");
                                battle.log(`🧪 [비상 약품] ${currentDef.name}이(가) 빈사 상태에서 자동으로 포션을 마셨습니다!`, 'log-heal');
                                break; 
                            }
                        }
                    }
                }

                if (dmg > 0) {
                    atk.utg = Math.min(100, (atk.utg || 0) + 10); 
                    currentDef.utg = Math.min(100, (currentDef.utg || 0) + 15); 
                }

                // ⭐ [이슈 5 버그 해결] 명중 시 경험치 획득 (어뷰징 검사 추가)
                const isKill = (currentDef.curHp <= 0);
                const isFriendlyFireHit = (atk.team === currentDef.team);
                const isCCHit = battle.hasStatus(atk, 'STAT_CONFUSION') || battle.hasStatus(atk, 'CC_CHARM') || battle.hasStatus(atk, 'CC_PUPPET');
                
                if (!isFriendlyFireHit || isCCHit) {
                    if (battle.progression && battle.progression.gainCombatPoints) {
                        battle.progression.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                    } else if (battle.gainCombatPoints) {
                        battle.gainCombatPoints(atk, currentOptions.skill || { name: name, type: type }, true, currentDef, isKill);
                    }
                }
                
                const channelBuff = currentDef.buffs.find(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
                if (channelBuff && dmg > 0 && result.hitContext !== "CC_HIT") {
                    let cancelChance = 100; 
                    
                    const maintainPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MAINTAIN_CHANT' || e.type === 'PAS_MAINTAIN_DANCE'));
                    if (maintainPassive) {
                        const prob = parseFloat(maintainPassive.effects[0].prob) || 30; 
                        cancelChance -= prob; 
                    }
                    
                    if (Math.random() * 100 < cancelChance) {
                        currentDef.buffs = currentDef.buffs.filter(b => b !== channelBuff);
                        currentDef.isAuraSource = false;
                        currentDef.auraEffects = [];
                        if (battle.updateAurasForUnit) {
                            battle.units.forEach(u => battle.updateAurasForUnit(u));
                        }
                        if (battle.stopAuraRipple) battle.stopAuraRipple(currentDef);
                        
                        battle.showFloatingText(currentDef, "연주/춤 중단됨!", "#ff5555");
                        battle.log(`💢 공격을 받아 ${currentDef.name}의 지속 스킬이 강제로 끊겼습니다!`, "log-bad");
                        
                        const daCapo = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                        if (daCapo) {
                            const wtReturn = parseFloat(daCapo.effects.find(e => e.type === 'BUFF_WT_REDUCTION')?.val) || 0.5; 
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * wtReturn);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                            battle.log(`🔁 [다 카포] 스킬이 취소되어 ${currentDef.name}의 다음 턴이 빠르게 돌아옵니다.`, "log-skill");
                        }
                    } else {
                        battle.showFloatingText(currentDef, "집중 유지!", "#55ff55");
                        battle.log(`✨ ${currentDef.name}이(가) 피격에도 불구하고 스킬을 유지해냅니다!`, "log-skill");
                    }
                }

                if (currentDef.isCharging && dmg > 0 && result.hitContext !== "CC_HIT") {
                    let cancelChance = 100; 
                    
                    const maintainPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_MAINTAIN_CHANT' || e.type === 'PAS_MAINTAIN_DANCE'));
                    if (maintainPassive) {
                        const prob = parseFloat(maintainPassive.effects[0].prob) || 30; 
                        cancelChance -= prob; 
                    }
                    
                    if (Math.random() * 100 < cancelChance) {
                        currentDef.isCharging = false;
                        currentDef.chargingSkill = null;
                        currentDef.chargeTurnLimit = 0;
                        currentDef.buffs = currentDef.buffs.filter(b => b.type !== 'BUFF_CASTING');
                        
                        if (battle.stopCastRipple) battle.stopCastRipple(currentDef);

                        battle.showFloatingText(currentDef, "캐스팅 차단됨!", "#ff5555");
                        battle.log(`💢 공격을 받아 ${currentDef.name}의 캐스팅(집중)이 산산조각 났습니다!`, "log-bad");
                        
                        const daCapo = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ON_CANCEL'));
                        if (daCapo) {
                            const wtReturn = parseFloat(daCapo.effects.find(e => e.type === 'BUFF_WT_REDUCTION')?.val) || 0.5; 
                            currentDef.actionGauge += Math.floor(battle.actionGaugeLimit * wtReturn);
                            battle.showFloatingText(currentDef, "다 카포!", "#00ffff");
                            battle.log(`🔁 [다 카포] 스킬이 취소되어 ${currentDef.name}의 다음 턴이 빠르게 돌아옵니다.`, "log-skill");
                        }
                    } else {
                        battle.showFloatingText(currentDef, "집중 유지!", "#55ff55");
                        battle.log(`✨ ${currentDef.name}이(가) 피격에도 불구하고 캐스팅을 유지해냅니다!`, "log-skill");
                    }
                }
                
                let dmgColor = '#ffffff'; 
                if (result.isCrit) dmgColor = '#ff0000';
                else if (result.isWeak) dmgColor = '#ffd700'; 
                else if (result.isResist) dmgColor = '#aaaaaa'; 

                if (dmg > 0) {
                    battle.showFloatingText(currentDef, `-${dmg}`, dmgColor);
                    battle.log(`⚔️ [타격] ${atk.name} ➡️ ${currentDef.name} : ${dmg} 피해${result.isCrit ? ' (치명타!)' : ''}${result.isWeak ? ' (약점 찌름)' : ''}`, 'log-dmg');
                } else if (result.text !== "IMMUNE") {
                    battle.showFloatingText(currentDef, "0", "#aaa");
                    battle.log(`🛡️ [방어됨] ${atk.name} ➡️ ${currentDef.name} : 방어력에 막혀 피해를 주지 못했습니다.`, 'log-system');
                }

                if (currentOptions.instantDeath !== undefined && currentDef.curHp > 0) {
                    if (Math.random() * 100 <= currentOptions.instantDeath) {
                        currentDef.curHp = 0; 
                        battle.showFloatingText(currentDef, "즉사!", "#8800ff");
                        battle.log(`☠️ [즉사] ${atk.name}의 치명적인 일격! ${currentDef.name} 즉사!`, 'log-dmg');
                        battle.triggerShakeAnimation(currentDef);
                    } else {
                        battle.log(`💢 [즉사 실패] ${currentDef.name}이(가) 급소를 아슬아슬하게 피했습니다.`, 'log-system');
                    }
                }
                
                battle.triggerShakeAnimation(currentDef);

                if (isDrain && dmg > 0) {
                    let heal = Math.floor(dmg * 0.5); 
                    atk.curHp = Math.min(atk.hp, atk.curHp + heal);
                    battle.showFloatingText(atk, `+${heal}`, '#5f5');
                    battle.log(`🧛 [흡혈] ${atk.name}이(가) ${heal} HP를 흡수했습니다.`, 'log-heal');
                }

                const reflectBuff = currentDef.buffs.find(b => b.type === 'BUFF_REFLECT' || b.type === 'BUFF_COUNTER');
                const reflectPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_REFLECT_DMG'));
                
                let canPassiveReflect = false;
                if (reflectPassive) {
                    const mainEff = reflectPassive.effects[0];
                    if (!mainEff.type.startsWith('PAS_') || mainEff.type === 'PAS_REFLECT_DMG' || Formulas.checkPassiveCondition(currentDef, mainEff, battle)) {
                        canPassiveReflect = true;
                    }
                }

                const isFleshForBone = reflectPassive && reflectPassive.name === '육참골단';
                if (isFleshForBone && (!isBasicAtk || type !== 'PHYS')) {
                    canPassiveReflect = false;
                }

                const thornsPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_REFLECT_THORNS'));
                const isGuarding = currentDef.buffs.some(b => ['BUFF_DMG_REDUCE_PHYS', 'BUFF_ABSOLUTE_GUARD', 'BUFF_LAST_BASTION'].includes(b.type));
                
                if (thornsPassive && isGuarding && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS') && currentDef.curHp > 0) {
                    const prob = parseFloat(thornsPassive.effects.find(e => e.type === 'PAS_REFLECT_THORNS').prob) || 50;
                    if (Math.random() * 100 <= prob) {
                        const thornsDmg = Math.floor((result.originalDmg || dmg) * 0.2);
                        if (thornsDmg > 0) {
                            atk.curHp = Math.max(0, atk.curHp - thornsDmg);
                            battle.showFloatingText(atk, `Thorns -${thornsDmg}`, '#228b22');
                            battle.log(`🌿 [강철의 가시덩굴] ${currentDef.name}의 방어를 때린 댓가로 ${atk.name}에게 ${thornsDmg} 데미지!`, 'log-dmg');
                        }
                    }
                }
                
                const rangedReflect = currentDef.buffs.find(b => b.type === 'BUFF_REFLECT_RANGED');
                if (rangedReflect && dist > 1 && (type === 'PHYS' || type === 'DMG_PHYS') && dmg > 0 && currentDef.curHp > 0 && !currentOptions.isReflected) {
                    if (Math.random() * 100 <= 30) {
                        const refDmg = Math.floor((result.originalDmg || dmg) * 0.5);
                        if (refDmg > 0) {
                            battle.createProjectile(currentDef, atk);
                            await new Promise(r => setTimeout(r, 150));
                            atk.curHp = Math.max(0, atk.curHp - refDmg);
                            battle.showFloatingText(atk, `Reflect -${refDmg}`, '#f0f');
                            battle.log(`🪞 [방패 반사] ${currentDef.name}이(가) 원거리 공격을 튕겨내어 ${atk.name}에게 ${refDmg} 피해를 줍니다!`, 'log-dmg');
                        }
                    }
                }

                if ((reflectBuff || canPassiveReflect) && !currentOptions.isReflected && dmg > 0 && dist <= 1 && atk !== currentDef && currentDef.curHp > 0) { 
                    let prob = 100;
                    let reflectRatio = 0.5;
                    let isPassiveReflect = false; 
                    
                    if (reflectPassive) {
                        const rEff = reflectPassive.effects.find(e => e.type === 'PAS_REFLECT_DMG');
                        prob = parseFloat(rEff.prob) || 30; 
                        reflectRatio = parseFloat(rEff.val) || 1.5;
                        isPassiveReflect = true;
                    } else if (reflectBuff) {
                        reflectRatio = parseFloat(reflectBuff.val) || 0.5;
                    }

                    if (Math.random() * 100 <= prob) {
                        const reflectDmg = Math.floor(dmg * reflectRatio); 
                        
                        if (isPassiveReflect && reflectRatio < 1.0) {
                            dmg = Math.floor(dmg * (1.0 - reflectRatio)); 
                            battle.showFloatingText(currentDef, "피해 감소됨!", "#aaa");
                        }

                        if (reflectDmg > 0) {
                            atk.curHp = Math.max(0, atk.curHp - reflectDmg);
                            battle.showFloatingText(atk, `Reflect -${reflectDmg}`, '#f0f');
                            const reflectName = isPassiveReflect ? reflectPassive.name : "피해 반사";
                            battle.log(`🪞 [반사] ${currentDef.name}의 [${reflectName}]! ${atk.name}에게 ${reflectDmg} 데미지 반환!`, 'log-dmg');
                        }
                    }
                }

                if (!currentOptions.isCounter && currentDef.curHp > 0 && currentDef.skills && atk !== currentDef) {
                    const targetJoker = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_PROB_UP_THIEF' || e.type === 'PAS_PROB_UP'));
                    const targetJokerBonus = targetJoker ? 30 : 0;

                    const vanishing = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AFTER_HIT_STEALTH'));
                    const isHitByBasicDef = (!currentOptions.skill || currentOptions.skill.id === '1000' || !currentOptions.skill.id || (currentOptions.skill.name && currentOptions.skill.name.includes('연격')));
                    
                    if (vanishing && isHitByBasicDef && (type === 'PHYS' || type === 'DMG_PHYS')) {
                        const prob = (parseFloat(vanishing.effects.find(e => e.type === 'PAS_AFTER_HIT_STEALTH').prob) || 25) + targetJokerBonus;
                        if (Math.random() * 100 <= prob) {
                            battle.log(`👻 [소멸] ${currentDef.name}이(가) 피격의 반동을 이용해 그림자 속으로 사라집니다!`, 'log-skill');
                            battle.skillProcessor.applyStatus(currentDef, { type: 'BUFF_STEALTH', duration: 1, val: 0 }, currentDef);
                        }
                    }

                    const quickHands = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_QUICK_HANDS'));
                    if (quickHands && dist <= 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                        const prob = (parseFloat(quickHands.effects.find(e => e.type === 'PAS_QUICK_HANDS').prob) || 30) + targetJokerBonus;
                        if (Math.random() * 100 <= prob) {
                            battle.log(`⚡ [빠른 손] ${currentDef.name}이(가) 공격을 받아치며 손을 뻗습니다!`, 'log-skill');
                            const stealTypes = ['SYS_STEAL', 'SYS_STEAL_ITEM', 'SYS_STEAL_ACC', 'SYS_STEAL_HELMET', 'SYS_STEAL_SHIELD', 'SYS_STEAL_ARMOR', 'SYS_STEAL_WEAPON'];
                            const randSteal = stealTypes[Math.floor(Math.random() * stealTypes.length)];
                            battle.skillProcessor.processEffect({ type: randSteal, prob: 100 }, atk, atk, currentDef, {triggerUnit: atk}, quickHands);
                        }
                    }

                    const afterHit = currentDef.skills.find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AFTER_HIT'));
                    if (afterHit) {
                        const prob = parseFloat(afterHit.effects[0].prob) || 100;
                        if (Math.random() * 100 <= prob && afterHit.effects.length > 1) {
                            const triggerEff = afterHit.effects.find(e => !e.type.startsWith('PAS_'));
                            if (triggerEff) battle.skillProcessor.processEffect(triggerEff, atk, atk, currentDef, {triggerUnit: atk}, afterHit);
                        }
                    }
                }

                if (currentDef.curHp <= 0) {
                    if (currentDef === battle.currentUnit) {
                        battle.actions.moved = true;
                        battle.actions.acted = true;
                        if (battle.ui) battle.ui.updateFloatingControls();
                    }

                    const onDeathPassive = (currentDef.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_ONDEATH'));
                    if (onDeathPassive) {
                        battle.log(`♾️ [시작과 끝] ${currentDef.name}의 희생이 빛이 되어 아군을 감쌉니다!`, 'log-skill');
                        const healEff = onDeathPassive.effects.find(e => e.type.startsWith('HEAL'));                        
                        if (healEff) {
                            const allies = battle.units.filter(u => u.team === currentDef.team && u.curHp > 0 && u.id !== currentDef.id);
                            allies.forEach(ally => {
                                const missingHp = Math.max(0, Formulas.getDerivedStat(ally, 'hp_max') - ally.curHp);
                                const healAmount = Math.floor(missingHp * (parseFloat(healEff.val) || 0.5));
                                if (healAmount > 0) {
                                    ally.curHp += healAmount;
                                    battle.showFloatingText(ally, `+${healAmount}`, "#55ff55");
                                }
                            });
                        }
                    }
                    
                    battle.handleDeath(currentDef, atk);
                }

                if (!currentOptions.isCounter && !currentOptions.isPierceHit && hitCount === 1 && (type === 'PHYS' || type === 'DMG_PHYS')) {
                    let weaponType = 'SWORD';
                    if (atk.equipment && atk.equipment.mainHand && battle.gameApp.itemData[atk.equipment.mainHand]) {
                        weaponType = battle.gameApp.itemData[atk.equipment.mainHand].subType || 'SWORD';
                    }

                    if (weaponType === 'SPEAR' || weaponType === 'LANCE') {
                        const pushDir = battle.grid.getDirection(atk, currentDef);
                        const backHex = battle.grid.getNeighborInDir(currentDef, pushDir);
                        if (backHex) {
                            const backTarget = battle.getUnitAt(backHex.q, backHex.r);
                            if (backTarget && backTarget.curHp > 0 && backTarget.team !== atk.team) {
                                battle.log(`🗡️ [관통] 창날이 ${currentDef.name}을(를) 뚫고 뒤의 ${backTarget.name}까지 찌릅니다!`, 'log-skill');
                                
                                const pierceOptions = { ...currentOptions, isPierceHit: true, globalMult: (currentOptions.globalMult || 1.0) * 0.5 };
                                
                                setTimeout(async () => {
                                    await this.performAttack(atk, backTarget, mult, "관통", isDrain, type, 1, pierceOptions);
                                }, 200); 
                            }
                        }
                    }
                }

                resolve({ isHit: true, damage: dmg });
            }, dist > 1 ? 150 : 100));

            if (i < hitCount - 1) await new Promise(r => setTimeout(r, 200));
        }

        const endDist = battle.grid.getDistance(atk, def); 
        const counterBuff = def.buffs.find(b => b.type === 'BUFF_COUNTER');
        const counterPassive = (def.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_COUNTER'));
        
        let ignoreCounter = false;
        if (options.isPerfectCrime) {
            ignoreCounter = true;
            battle.log(`🎩 [완전 범죄] ${atk.name}의 치밀한 공격에 ${def.name}은(는) 반격할 틈을 찾지 못합니다!`, 'log-skill');
        }
        if (skill && skill.effects && skill.effects.some(e => e.type === 'PAS_DISABLE_COUNTER')) {
            ignoreCounter = true;
            battle.log(`🏃 [치고 빠지기] ${atk.name}이(가) 재빠르게 거리를 벌려 반격을 허용하지 않습니다!`, 'log-skill');
        }

        // ⭐ [이슈 1 버그 방지 및 3번 연출 추가] 반격 발동 조건 및 딜레이 삽입
        if (!ignoreCounter && (counterBuff || counterPassive) && def.curHp > 0 && endDist <= Formulas.getDerivedStat(def, 'rng') && !options.isCounter && atk !== def) {
            if (!(battle.activeTimeStop && atk && battle.activeTimeStop.caster.id === atk.id)) {
                let prob = 100;
                let triggerCounter = true;
                
                if (counterPassive) {
                    const cEff = counterPassive.effects.find(e => e.type.startsWith('PAS_COUNTER'));
                    prob = parseFloat(cEff.prob) || 30; 
                    
                    if ((cEff.type === 'PAS_COUNTER_RANGED' || cEff.type === 'PAS_COUNTER_RANGED_BASIC') && dist <= 1) {
                        triggerCounter = false;
                    }
                    
                    if ((cEff.type === 'PAS_COUNTER_BASIC' || cEff.type === 'PAS_COUNTER_RANGED_BASIC') && !isBasicAtk) {
                        triggerCounter = false;
                    }
                }
                
                if (triggerCounter && Math.random() * 100 <= prob) {
                    // ⭐ [이슈 3 해결] 반격 텍스트와 함께 카메라 시선을 붙잡아두는 딜레이 추가
                    battle.showFloatingText(def, "반격!", "#ffaa00");
                    battle.log(`⚔️ [반격 발동] ${def.name}이(가) 공격을 받아칩니다!`, 'log-skill');
                    if (battle.smoothCenterCameraOnUnit) await battle.smoothCenterCameraOnUnit(def, 200);
                    await new Promise(r => setTimeout(r, 600)); 

                    await this.performAttack(def, atk, 1.0, "반격", false, def.atkType || 'PHYS', 1, { isCounter: true, skill: { id: '1000' } }); 
                }
            }
        }

        // ⭐ [이슈 3 해결] 엄호 사격 연출 추가
        if (!options.isCounter && def.team === atk.team && def !== atk && def.curHp > 0) {
            const allies = battle.units.filter(u => u.team === def.team && u.curHp > 0 && u !== def);
            for (const ally of allies) {
                const coverPassive = (ally.skills || []).find(s => 
                    (ally.equippedSkills || []).includes(s.id) &&
                    (s.part === 'S' || s.part === 'P' || s.type === 'PASSIVE') && 
                    s.effects && s.effects.some(e => e.type === 'PAS_ALLY_HIT' || e.type === 'PAS_ALLY_HIT_BASIC')
                );                
                
                if (coverPassive && battle.grid.getDistance(ally, atk) <= Formulas.getDerivedStat(ally, 'rng')) {
                    const cEff = coverPassive.effects.find(e => e.type.startsWith('PAS_ALLY_HIT'));
                    
                    if (cEff.type === 'PAS_ALLY_HIT_BASIC' && !isBasicAtk) continue;
                    if (cEff.type === 'PAS_ALLY_HIT_BASIC' && ally._coverShotUsed) continue;

                    const prob = parseFloat(cEff.prob) || 40;
                    if (Math.random() * 100 <= prob) {
                        ally._coverShotUsed = true; 

                        // ⭐ 엄호 텍스트와 딜레이 추가
                        battle.showFloatingText(ally, "엄호 사격!", "#ffaa00");
                        battle.log(`🛡️ [엄호 사격] ${ally.name}이(가) 공격받은 아군을 지원합니다!`, 'log-skill');
                        if (battle.smoothCenterCameraOnUnit) await battle.smoothCenterCameraOnUnit(ally, 200);
                        await new Promise(r => setTimeout(r, 600));

                        await this.performAttack(ally, atk, 1.0, "엄호", false, ally.atkType || 'RANGED', 1, { isCounter: true, skill: { id: '1000' } }); 
                        break; 
                    }
                }
            }
        }
    }

    applyStatus(target, data, caster) {
        if (this.battle.statusManager) {
            // ⭐ [마법사 기획 반영] 술식 조정 (PAS_AOE_SAFE_ALLY) - 아군에게는 상태이상 100% 무효화
            if (caster && caster.team === target.team && caster.id !== target.id) {
                // CombatManager에서 세팅한 isSafeAlly 플래그(광역 마법 판정)가 있는지 확인하거나 패시브를 직접 체크
                const safeAllyPassive = (caster.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_AOE_SAFE_ALLY'));
                if (safeAllyPassive) {
                    // 술식 조정이 있고 타겟이 아군이라면, 부정적 상태이상(디버프/CC/STAT)은 무시함
                    const isNegative = String(data.type).startsWith('DEBUFF_') || String(data.type).startsWith('CC_') || String(data.type).startsWith('STAT_');
                    if (isNegative) {
                        this.battle.showFloatingText(target, "술식 보호(상태이상 면역)", "#00ff00");
                        return; // 상태이상 적용을 건너뜀
                    }
                }
            }
            this.battle.statusManager.applyStatus(target, data, caster);
        }
    }

    async handleMoveAttack(caster, clickedUnit, targetHex, effect, skill, options = {}) {
        return await this.movementEffect.handleMoveAttack(caster, clickedUnit, targetHex, effect, skill, options);
    }
    async handleJumpAttack(caster, target, effect, skill, options = {}) {
        return await this.movementEffect.handleJumpAttack(caster, target, effect, skill, options);
    }
    async executeChargeKnockback(attacker, target, skill) {
        return await this.movementEffect.executeChargeKnockback(attacker, target, skill);
    }
    getPushTile(attacker, target, dist) {
        return this.movementEffect.getPushTile(attacker, target, dist);
    }

    applyPerks(skill, caster) {
        if (!caster.perks) return skill; 
        Object.values(caster.perks).forEach(perkId => { 
            if (perkId && perkId.startsWith(skill.id)) { 
                const perkData = PERK_DATA[perkId]; 
                if (perkData) { 
                    if (perkData.cost !== undefined) skill.cost = perkData.cost; 
                    if (perkData.rng !== undefined) skill.rng = perkData.rng; 
                    if (perkData.mp !== undefined) skill.mp = perkData.mp; 
                } 
            } 
        }); 
        return skill;
    }
}