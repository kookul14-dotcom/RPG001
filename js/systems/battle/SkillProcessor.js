import { EFFECTS, PERK_DATA, ELEMENTS } from '../../data/index.js';
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
        
        // 2. 실제 모든 복잡한 스킬 로직은 기존 함수(이름을 바꾼 _executeCore)에게 통째로 맡깁니다.
        await this._executeCore(targetHex, targetUnit);
        
        // 3. 스킬 처리가 끝난 직후, 이번 동작을 통해 행동이 완료(acted가 true가 됨)되었다면 시간을 1 증가시킵니다.
        // (마나 부족 등으로 취소되었다면 acted가 false이므로 시간이 흐르지 않습니다.)
        if (!alreadyActed && this.battle.actions.acted) {
            if (this.battle.ui && typeof this.battle.ui.addTimeAction === 'function') {
                this.battle.ui.addTimeAction(1);
            }
        }
    }

    // ⭐ [이름 변경] 기존의 거대한 execute 함수는 내부 처리용인 _executeCore 로 이름만 바꿔줍니다.
    async _executeCore(targetHex, targetUnit) {
        const battle = this.battle;
        const u = battle.currentUnit;

        if (battle.actions.acted) return;
        if (!battle.selectedSkill) return;
        const isResurrection = battle.selectedSkill.effects && battle.selectedSkill.effects.some(e => ['RESURRECT', 'REVIVE', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL'].includes(String(e.type).toUpperCase()));
        
        battle.units.forEach(unit => unit._missedSkill = false);

        // 2. 부활/각성 스킬이 아닌데, 이미 죽은(전투 불능) 대상을 클릭했다면 스킬 낭비 차단
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
        
        const skill = JSON.parse(JSON.stringify(battle.selectedSkill));

        // ⭐ [함정 스킬 처리] 함정 스킬은 즉시 데미지를 주지 않고 타일에 효과를 '저장'만 한 뒤 턴을 넘깁니다.
        const trapEffect = skill.effects ? skill.effects.find(e => e.type === 'SYS_CREATE_TRAP') : null;
        if (trapEffect) {
            let trapType = 'TRAP_STUN';
            if (skill.name.includes('철사') || skill.id === 'THF_23') trapType = 'TRAP_WIRE';
            else if (skill.name.includes('독')) trapType = 'TRAP_POISON';
            else if (skill.name.includes('폭약')) trapType = 'TRAP_EXPLOSION';

            // 덫이 밟혔을 때 터져야 할 나머지 효과(DMG_TRUE, STAT_BLEED 등) 분리 추출
            const storedEffects = skill.effects.filter(e => e.type !== 'SYS_CREATE_TRAP');
            
            // ⭐ [근본 해결책] execute() 하단의 타겟 정규화 로직이 실행되기 전에 조기 반환(return) 되므로,
            // 덫에 데이터를 저장하기 직전에 target, area, val의 찌꺼기("-")를 명확한 값으로 강제 정제합니다.
            storedEffects.forEach(e => {
                // 함정을 밟은 단일 대상에게 효과가 적중하도록 타겟 강제 지정
                if (!e.target || String(e.target).trim() === '-') e.target = 'SINGLE'; 
                if (e.area === undefined || String(e.area).trim() === '-') e.area = 0;
                if (String(e.rng).trim() === '-') e.rng = 0;
                // JSON에 val이 "-" 로 들어가 있어 생기는 NaN 데미지/상태이상 오류 원천 차단
                if (String(e.val).trim() === '-') e.val = 0; 
            });
            
            // ⭐ 1. 렌더러에 의존하지 않고, 그리드(Grid) 엔진에서 CLEAVE 등의 스킬 범위를 직접 계산합니다.
            let placeHexes = [{ q: targetHex.q, r: targetHex.r }];
            const areaStr = String(skill.area || '0').toUpperCase();
            
            if (areaStr !== '0' && areaStr !== 'SINGLE') {
                if (areaStr.includes('CLEAVE') || areaStr.includes('CONE') || areaStr.includes('LINE')) {
                    if (battle.grid.getShapeHexes) {
                        placeHexes = battle.grid.getShapeHexes(targetHex, u, areaStr); // 부채꼴, 직선 등 계산
                    }
                } else {
                    const radius = parseInt(skill.area) || 0;
                    if (radius > 0 && battle.grid.getHexesInRange) {
                        placeHexes = battle.grid.getHexesInRange(targetHex, radius); // 원형 범위 계산
                    }
                }
            }

            let placedCount = 0;
            placeHexes.forEach(h => {
                // 지나갈 수 있는(Passable) 타일에만 덫을 설치
                if (battle.grid.isPassable(h.q, h.r)) {
                    if (battle.environment) battle.environment.placeTrap(h.q, h.r, trapType, u.id, storedEffects, skill);
                    placedCount++;
                }
            });

            if (placedCount > 0) {
                battle.actions.acted = true;
                battle.log(`🪤 ${u.name}이(가) [${skill.name}]을(를) 치밀하게 설치했습니다. (총 ${placedCount}칸)`, 'log-skill');
                
                // 모방(도적 극의)으로 훔친 덫 스킬이었다면 1회 사용 후 기억에서 삭제
                if (skill.isStolen || skill.name.includes('[모방]')) {
                    u.skills = u.skills.filter(s => s.id !== skill.id);
                    battle.log(`💨 1회용 스킬 [${skill.name}]을(를) 사용하여 잊어버렸습니다.`, 'log-system');
                }
            } else {
                battle.log(`❌ 덫을 설치할 수 있는 빈 공간이 없습니다.`, 'log-bad');
            }
            
            // ⭐ 2. 시전이 끝났으므로 타겟팅(빨간 장판)을 완전히 지우고 플로팅 UI를 갱신합니다.
            battle.selectedSkill = null;
            battle.attackableHexes = [];
            battle.hoverHex = null;
            
            if (battle.ui) {
                battle.ui.lockedTargetPanel = false;
                if (battle.ui.updateRightPanel) battle.ui.updateRightPanel([], null); // 타겟 정보창 비우기
                battle.ui.updateFloatingControls(); // 스킬 버튼 회색(비활성화) 처리
                battle.ui.updateCursor();
            }
            
            battle.renderPartyList();
            battle.updateStatusPanel();
            
            return; // 여기서 스킬 발동 함수를 깔끔하게 종료
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
            if (u.team === 0) {
                battle.updateFloatingControls();
                battle.updateStatusPanel();
                battle.updateCursor();
            }
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
                
                if (battle.updateAurasForUnit) {
                    battle.units.forEach(unit => battle.updateAurasForUnit(unit));
                }
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

        this.applyPerks(skill, u);

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
            const mpRedMult = Formulas.getMult(u, 'PASSIVE_COST_RED', 'MP_COST'); 
            if (mpRedMult !== 1.0) mpCost = Math.floor(mpCost * mpRedMult);
        }

        // ⭐ [UTG 기획 반영] 무기 레벨 2,3,4에서 해금되는 필살기인지 판별
        const isUltimate = skill.type === 'ULTIMATE' || (skill.name && (skill.name.includes('필살기') || skill.name.includes('오의')));
        const utgCost = isUltimate ? 100 : 0; // 필살기는 기본적으로 UTG를 100 소모한다고 가정

        if (isUltimate) {
            if ((u.utg || 0) < utgCost) {
                battle.log("필살기 게이지(UTG)가 부족합니다!", "log-system");
                battle.showFloatingText(u, "UTG 부족!", "#f55");
                
                // 타겟팅 패널 정리 및 UI 초기화
                battle.selectedSkill = null;
                if (u.team === 0) { battle.updateFloatingControls(); battle.updateStatusPanel(); battle.updateCursor(); }
                return;
            }
            mpCost = 0; // 필살기는 마나를 소모하지 않음
            battle.log(`🔥 ${u.name}이(가) 한계 돌파! 필살기 게이지를 개방합니다!`, 'log-skill');
        } else if ((!skill.itemCost || skill.itemCost.length === 0) && u.curMp < mpCost) {
            battle.log("MP가 부족합니다!", "log-system");
            return;
        }
        
        skill._consumedMp = mpCost;
        skill._isUltimate = isUltimate;
        skill._utgCost = utgCost;

        let rngBonus = Formulas.getStat(u, 'rng'); 
        let areaBonus = 0;
        
        if (u.buffs) {
            u.buffs.forEach(b => {
                if (b.type === 'BUFF_CAST_RANGE') rngBonus += (parseFloat(b.val) || 0);
                if (b.type === 'BUFF_CAST_AREA') areaBonus += (parseFloat(b.val) || 0);
            });
        }
        
        const strongArm = (u.skills || []).some(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_THROW_RANGE'));
        if (strongArm && (skill.id.startsWith('IT_') || skill.id.startsWith('MT_') || skill.id.startsWith('CT_') || skill.type === 'ITEM')) {
            rngBonus += 1;
        }

        if (skill.effects && skill.effects.some(e => e.type && e.type.startsWith('NT_'))) {
            const checkTarget = targetHex || targetUnit;
            if (checkTarget && battle.grid.getDistance(u, checkTarget) !== 1 && parseInt(skill.rng) === 1) {
                battle.log("연성술은 시전자와 인접한 타일(1칸)을 눌러 방향 지정해야 합니다.", "log-bad");
                battle.showFloatingText(u, "사거리 밖!", "#f55");
                
                battle.selectedSkill = null;
                if (u.team === 0) { battle.updateFloatingControls(); battle.updateStatusPanel(); battle.updateCursor(); }
                return; 
            }
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
                    if (battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();
                }

                u.actionGauge -= (skill.cost || 50);
                battle.actions.acted = true;
                
                battle.selectedSkill = null;
                battle.confirmingSkill = null;
                battle.hoverHex = null;
                if (u.team === 0) {
                    battle.updateFloatingControls();
                    battle.updateStatusPanel();
                    battle.updateCursor();
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
            if(u.team === 0) battle.ui.updateStatusPanel();
            return; 
        }

        if (skill.id === '10001') {
            let reagentSlot = null;
            for(let i=1; i<=8; i++) {
                const item = u.equipment[`pocket${i}`];
                const id = typeof item === 'object' ? item.id : item;
                if (id === 'REAGENT_UNSTABLE') { reagentSlot = `pocket${i}`; break; }
            }
            if (!reagentSlot) {
                battle.log("불안정한 시약이 없습니다!", "log-bad");
                battle.showFloatingText(u, "시약 없음!", "#f55");
                return;
            }
            
            const eqData = u.equipment[reagentSlot];
            if (typeof eqData === 'object') {
                eqData.count--;
                if (eqData.count <= 0) u.equipment[reagentSlot] = null;
            } else {
                u.equipment[reagentSlot] = null;
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
                battle.log("던질 포션이 없습니다!", "log-bad");
                battle.showFloatingText(u, "포션 없음!", "#f55");
                return;
            }
            
            const eqData = u.equipment[potionSlot];
            if (typeof eqData === 'object') {
                eqData.count--;
                if (eqData.count <= 0) u.equipment[potionSlot] = null;
            } else {
                u.equipment[potionSlot] = null;
            }
            skill._slotKey = potionSlot;
            const itemData = this.battle.gameApp.itemData[potionItem];
            const baseHeal = itemData ? (itemData.val || 30) : 30;
            if (skill.effects && skill.effects.length > 0) skill.effects[0].val = baseHeal; 
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
            skill.effects.forEach(eff => {
                if(!eff.target || String(eff.target).trim() === '-') eff.target = skill.target; 
                if(eff.area === undefined || String(eff.area).trim() === '-') eff.area = skill.area;
                if(String(eff.rng).trim() === '-') eff.rng = skill.rng;
            });
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

        const isGlobalSkill = ['SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'PASSIVE'].includes(tType) ||                              (tType === 'AREA_ENEMY' && (parseInt(skill.area)||0) >= 99) ||
                          parseInt(skill.rng) === 0 ||
                          (skill.effects && skill.effects.some(e => ['ATK_ONMISLASH', 'ATK_RANDOM_DASH'].includes(e.type)));
        const isSpecialAction = skill.effects && skill.effects.some(e => {
            const eT = String(e.type || '').toUpperCase();
            return ['RESURRECT', 'REVIVE'].includes(eT) || eT.startsWith('SUMMON') || eT.startsWith('SYS_CREATE') || eT === 'SYS_DISPEL_STEALTH';
        });
        
        if (!isGlobalSkill && !isSpecialAction && !effectiveTarget) return;

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
             
             if (!isValidRange) { 
                 battle.log("사거리 밖이거나 장애물(벽)에 막혔습니다.", "log-bad"); 
                 battle.showFloatingText(u, "막힘/사거리 외", "#aaa");
                 
                 battle.selectedSkill = null;
                 if (u.team === 0) {
                     battle.updateFloatingControls();
                     battle.updateStatusPanel();
                     battle.updateCursor();
                 }
                 return; 
             }
        }

        const isDashSkill = (skill.effects && skill.effects.some(e => ['ATK_DASH', 'MOVE_DASH'].includes(e.type))) || 
                            ['돌진', '돌격', '혈로', '강철의 행진'].includes(skill.name); 

        if (isDashSkill && effectiveTarget) {
            const range = parseInt(skill.rng) || parseInt(skill.area) || 1;
            const lineHexes = battle.grid.getLine(u, effectiveTarget, range);
            
            let blockedByAllyOrWall = false;
            let foundEnemy = false;
            let enemyCount = 0; 
            
            const isPierce = skill.name.includes('혈로');
            const isDash = skill.name.includes('돌진');

            for (const h of lineHexes) {
                if (h.q === u.q && h.r === u.r) continue;

                const terrainKey = battle.grid.getTerrain(h.q, h.r);
                if (!battle.grid.isPassable(terrainKey)) {
                    blockedByAllyOrWall = true; 
                    break;
                }

                const occupant = battle.getUnitAt(h.q, h.r);
                if (occupant && occupant.curHp > 0) {
                    if (occupant.team === u.team) {
                        blockedByAllyOrWall = true; 
                        break;
                    } else {
                        foundEnemy = true; 
                        enemyCount++;

                        if (isDash) {
                            break; 
                        } else if (isPierce) {
                            if (enemyCount > 1) {
                                blockedByAllyOrWall = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (blockedByAllyOrWall) {
                battle.log("경로가 장애물이나 아군으로 막혀있습니다!", "log-bad");
                battle.showFloatingText(u, "경로 막힘!", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0) {
                    battle.updateFloatingControls();
                    battle.updateStatusPanel();
                    battle.updateCursor();
                }
                return;
            }

            if (!foundEnemy && isDash) {
                battle.log("부딪힐 적이 없어 돌진할 수 없습니다!", "log-bad");
                battle.showFloatingText(u, "대상 없음!", "#f55");
                battle.selectedSkill = null;
                if (u.team === 0) { battle.updateFloatingControls(); battle.updateStatusPanel(); battle.updateCursor(); }
                return;
            }
        }
        
        const combatOptions = { skill: skill }; 
        const modifierTypes = ['ATK_SNIPE', 'DMG_TRUE', 'CON_DEATH', 'ATK_MULTI', 'ATK_SUREHIT', 'SYS_DMG_REDUCTION'];

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
                
                if (eType !== 'DMG_TRUE_BYMP') {
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
        
        const doubleCastBuff = u.buffs.find(b => b.type === 'BUFF_DOUBLE_CAST');
        if (doubleCastBuff) {
            castCount = 2;
            battle.log("⏩ 이중 시전 발동!", 'log-skill');
            u.buffs = u.buffs.filter(b => b !== doubleCastBuff);
            battle.updateStatusPanel();
        } else {
            const doublePassive = (u.skills || []).find(s => s.type === 'PASSIVE' && s.effects && s.effects.some(e => e.type === 'PAS_DOUBLECAST'));
            if (doublePassive && skill.atkType === 'MAG') {
                const pEff = doublePassive.effects.find(e => e.type === 'PAS_DOUBLECAST');
                const prob = parseFloat(pEff.prob) || 20;
                if (Math.random() * 100 <= prob) {
                    castCount = 2;
                    doubleCastMult = parseFloat(pEff.val) || 0.5; 
                    battle.log("🔁 [주문 반향] 마법이 메아리쳐 연속 발동됩니다!", 'log-skill');
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

            if (c === 0) {
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
                    // ⭐ [UTG 기획 반영] 필살기일 경우 마나 대신 게이지를 소모
                    if (skill._isUltimate) {
                        u.utg -= skill._utgCost;
                        battle.showFloatingText(u, "UTG 소모!", "#ff5500");
                    } else {
                        u.curMp -= mpCost; 
                    }
                }

                let costRed = Formulas.getDerivedStat(u, 'cost_red');                
                if (!costRed || costRed <= 0) costRed = 1.0; 
                const consume = Math.floor((skill.cost || 50) * costRed); 
                u.actionGauge -= consume;
                
                if (u.team === 0) battle.gainActionXp(u, 10);

                // ==============================================================
                // ⭐ [연출 순서 1] 타겟을 향해 몸의 방향(Facing)을 가장 먼저 돌립니다.
                // ==============================================================
                if (effectiveTarget && effectiveTarget !== u && effectiveTarget.q !== undefined) {
                    const dir = battle.grid.getDirection(u, effectiveTarget);
                    if (u.facing !== dir) {
                        u.facing = dir;
                        // 방향을 틀었을 때 렌더링에 즉시 반영하고, 0.15초 대기하여 부드러운 움직임 연출
                        if (battle.ui && battle.ui.renderUnitOverlays) battle.ui.renderUnitOverlays();
                        await new Promise(r => setTimeout(r, 150)); 
                    }
                }

                // ==============================================================
                // ⭐ [연출 순서 2] 적을 바라본 상태에서 대사(말풍선)를 외칩니다.
                // ==============================================================
                battle.log(`${u.name} [${skill.name}] 시전!`, 'log-skill');
                battle.showSpeechBubble(u, skill.name);

                // ==============================================================
                // ⭐ [연출 순서 3] 말풍선이 뜬 후, 실제 발동 전까지 0.8초간 뜸을 들입니다.
                // ==============================================================
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
        // 🔄 스킬 시전 후 카메라 원상복구
        // ==============================================================
        if (shouldPan) {
            if (skill.id !== 'SOR_44') {
                await battle.smoothCenterCameraOnUnit(u, 200); 
                
                // ⭐ [수정] 데미지, 상태이상 등의 플로팅 텍스트가 사라질 때까지 넉넉히 대기
                await new Promise(r => setTimeout(r, 1000)); 
                
                await battle.restoreCameraState(600); // 뷰 복구도 좀 더 부드럽게
            }
        }
        
        const hasDamageEffect = skill.effects && skill.effects.some(e => e.type.startsWith('DMG_') || e.type.startsWith('ATK_'));
        if (!hasDamageEffect && battle.gainCombatPoints && skill.type !== 'ITEM') {
            const primaryTarget = targetUnit || u; 
            battle.gainCombatPoints(u, skill, true, primaryTarget);
        }

        battle.actions.acted = true; 
        
        // ⭐ [버그 수정] 훔친 스킬을 사용했다면 리스트에서 즉시 깔끔하게 삭제
        if (skill.isStolen || skill.name.includes('[모방]')) {
            u.skills = u.skills.filter(s => s.id !== skill.id);
            battle.log(`💨 1회용 스킬 [${skill.name}]을(를) 사용하여 잊어버렸습니다.`, 'log-system');
        }

        battle.renderPartyList();
        battle.updateStatusPanel();

        if(u.team === 0) { 
            battle.selectedSkill = null; 
            battle.updateFloatingControls(); 
        }
        battle.updateCursor();
    }

    async processEffect(eff, targetHex, clickedUnit, caster, options = {}, skill = null) {
        const battle = this.battle;
        let type = String(eff.type || '').toUpperCase().trim(); 
        
        // ⭐ [근본 해결] 더미 데이터("-") 원천 차단: 세모(🔺) 버프 생성 및 엔진 에러 완벽 방지
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
        // ⭐ [신규] 전투 불능 해제(REVIVE) 처리 및 시체 가격 방지 시스템
        // =================================================================
        if (type === 'REVIVE') {
            if (clickedUnit && clickedUnit.isIncapacitated) {
                clickedUnit.isIncapacitated = false;
                clickedUnit.deathTimer = undefined;
                clickedUnit.isFullyDead = false;
                
                // 퍼센트 회복 (val = 10, 30, 60, 100 등)
                const healAmt = Math.floor(clickedUnit.hp * (val / 100));
                clickedUnit.curHp = Math.max(1, healAmt);
                
                battle.showFloatingText(clickedUnit, `각성! +${healAmt}`, '#00ffaa');
                battle.log(`✨ ${clickedUnit.name}이(가) 정신을 차리고 전선에 복귀했습니다!`, 'log-heal');
                
                // 회색 필터 제거 및 상태창 갱신
                if (battle.ui) {
                    battle.ui.renderUnitOverlays();
                    battle.ui.updateStatusPanel();
                }
                return { isHit: true, damage: -healAmt };
            } else if (clickedUnit) {
                battle.showFloatingText(clickedUnit, `효과 없음`, '#aaa');
                return { isHit: false };
            }
        }

        // ⭐ 안전장치: 타겟이 전투 불능(Incapacitated)이거나 완전 사망 상태라면
        // REVIVE를 제외한 그 어떤 힐링, 버프, 데미지, CC기도 들어가지 않도록 차단 (무시)
        if (clickedUnit && clickedUnit.curHp <= 0) {
            return { isHit: false };
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
                const dirs = [{q:1,r:0}, {q:0,r:1}, {q:-1,r:1}, {q:-1,r:0}, {q:0,r:-1}, {q:1,r:-1}];
                const d = dirs[backDir];
                
                let distance = parseInt(val) || 1;
                let actualMove = 0;

                for(let i = distance; i >= 1; i--) { 
                    const nextQ = caster.q + (d.q * i);
                    const nextR = caster.r + (d.r * i);
                    
                    if (battle.grid.isPassable(nextQ, nextR) && !battle.getUnitAt(nextQ, nextR)) {
                        dest = {q: nextQ, r: nextR};
                        actualMove = i;
                        break;
                    }
                }

                if (dest) {
                    battle.log(`💨 ${caster.name}이(가) 공격 후 ${actualMove}칸 물러섭니다!`, "log-skill");
                    
                    if (battle.moveSpriteOnly) {
                        await battle.moveSpriteOnly(caster, dest.q, dest.r, 200, false);
                    }
                    
                    caster.q = dest.q; caster.r = dest.r; caster.visualPos = null;
                    if (battle.updateUnitOverlayPosition) battle.updateUnitOverlayPosition(caster);
                    battle.showFloatingText(caster, "후퇴!", "#fff");

                    if (battle.smoothCenterCameraOnUnit) {
                        await battle.smoothCenterCameraOnUnit(caster, 250);
                    }
                } else {
                    battle.log("뒤가 막혀 물러설 수 없습니다!", "log-bad");
                    battle.showFloatingText(caster, "막힘!", "#aaa");
                }
                return; 
            }

            if (type === 'SPECIAL_TIME_STOP' || type === 'SYS_TIME_STOP') {
                caster.actionGauge += 100; 
                battle.showFloatingText(caster, "시간 정지!", "#00ffff");
                battle.log(`⏳ ${caster.name}이(가) 전장의 시간을 멈췄습니다!`, 'log-skill');
                battle.activeTimeStop = { caster: caster, remainingTurns: 3 };
                caster.actionGauge = battle.actionGaugeLimit; // 시전자가 다음 턴도 즉시 잡도록 보장
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
            const archers = battle.units.filter(u => u.team === caster.team && u.curHp > 0 && (u.classKey?.includes('ARC') || u.atkType === 'RANGED'));
            battle.log(`🏹 아군 사수 일제 사격!`, 'log-skill');
            for (const archer of archers) {
                const dist = battle.grid.getDistance(archer, clickedUnit);
                if (dist <= Formulas.getDerivedStat(archer, 'rng')) {
                    battle.triggerShakeAnimation(archer);
                    await new Promise(r => setTimeout(r, 150));
                    await this.performAttack(archer, clickedUnit, 1.0, "지원 사격", false, 'PHYS', 1, options);
                }
            }
            return;
        }

        if (type === 'SYS_MAXIMIZE_CHANT') {
            const chants = caster.buffs.filter(b => b.type.startsWith('BUFF_CHANNELED') || b.type.startsWith('DEBUFF_CHANNELED'));
            if (chants.length > 0) {
                chants.forEach(b => {
                    b.duration = 99; 
                    battle.showFloatingText(caster, "메아리...", "#fff");
                });
                battle.log(`🔔 노래가 영원히 메아리칩니다! (유지 비용 없음)`, 'log-skill');
            } else {
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

        // ⭐ [근본 해결책 1] 덫(함정) 등 외부 환경 시스템에서 타겟을 명확히 확정하여 주입(`_forcedTarget`)한 경우, 
        // collectTargets의 좌표 계산이나 유효성 검사 실패로 인해 타겟이 유실되는 사각지대를 강제로 덮어씌워 보완합니다.
        if (eff._forcedTarget) {
            targets = [eff._forcedTarget];
        }

        if (type === 'RESURRECT' || type === 'REVIVE' || type === 'SYS_RESURRECTION' || type === 'SYS_RESURRECTION_ALL') {            // 엔진이 시체를 걸러냈다면, 헥스에 있는 시체를 수동으로 긁어옴
            if (targets.length === 0) {
                const targetArea = eff.area || (skill ? skill.area : 'SINGLE');
                
                const center = targetHex || (clickedUnit ? {q: clickedUnit.q, r: clickedUnit.r} : null);
                if (!center) {
                    const rng = parseInt(skill ? skill.rng : 1) || 1; // 사거리 체크
                    const corpses = battle.units.filter(c => c.curHp <= 0 && c.team === caster.team && battle.grid.getDistance(caster, c) <= rng);
                    if (corpses.length === 1) {
                        center = { q: corpses[0].q, r: corpses[0].r };
                    }
                }
                if (!center) {
                    battle.log("대상을 정확히 선택해야 합니다.", "log-system");
                    return;
                }

                if (targetArea === 'SINGLE' || targetArea === 0 || targetArea === undefined) {
                    // ⭐ center 좌표에 있는 시체를 확실하게 가져오기
                    const deadUnit = battle.units.find(u => u.q === center.q && u.r === center.r && u.curHp <= 0);
                    if (deadUnit && !targets.includes(deadUnit)) targets.push(deadUnit);
                } else {
                    const hexes = battle.grid.getShapeHexes(center, caster, targetArea);
                    hexes.forEach(h => {
                        const deadUnit = battle.units.find(u => u.q === h.q && u.r === h.r && u.curHp <= 0);
                        if (deadUnit && !targets.includes(deadUnit)) targets.push(deadUnit);
                    });
                }
            }

            if (targets.length === 0) {
                battle.log("부활시킬 대상이 없습니다.", "log-system");
                return;
            }

            targets.forEach(t => {
                if (t.curHp > 0) return;

                const recoverHp = Math.floor(t.hp * (val || 0.3));
                t.curHp = Math.max(1, recoverHp);
                t.actionGauge = Math.floor(battle.actionGaugeLimit * 0.5);
                
                // ⭐ [버그 수정 2] 시체 상태 완벽 해제 (플로팅 UI에서 스킬이 사라지는 현상 방지)
                t.isDead = false;
                t.dead = false; // 안전장치
                if (t.prevIcon) {
                    t.icon = t.prevIcon;
                    t.prevIcon = null; // 백업 아이콘 초기화하여 완전한 산 자로 판정되게 함
                } else {
                    t.icon = "👤";
                }
                
                // 스킬 캐스팅 및 상태 이상 완벽 초기화
                if (!t.buffs) t.buffs = [];
                t.isCharging = false;
                t.chargingSkill = null;

                battle.showFloatingText(t, "부활!", "#ffdd00");
                battle.log(`✝️ 기적! ${t.name}이(가) 되살아났습니다!`, 'log-heal');
                battle.triggerShakeAnimation(t);
                
                if (battle.ui && battle.ui.renderUnitOverlays) battle.ui.renderUnitOverlays();
            });

            battle.renderPartyList();
            
            // ⭐ UI 강제 동기화 (부활 후 스킬 패널이 비어버리는 현상 복구)
            if (battle.ui && battle.ui.updateStatusPanel) battle.ui.updateStatusPanel();
            if (battle.ui && battle.ui.updateFloatingControls) battle.ui.updateFloatingControls();
            
            return;
        }

        if (skill && (skill.name === '폭풍의 궤적' || skill.area === 'LINE' || skill.area === 'PIERCE')) {
            const dest = targetHex || (clickedUnit ? {q: clickedUnit.q, r: clickedUnit.r} : null);
            if (dest) {
                const range = parseInt(skill.rng) || parseInt(skill.area) || 6;
                const lineHexes = battle.grid.getLine(caster, dest, range);
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
                
                // ⭐ [수정] 살인 철사 등 동적 덫 타입 지원
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

                const sName = (skill && skill.name) ? skill.name : '';
                if (type.includes('FIRE') || sName.includes('화염') || sName.includes('불')) { 
                    key = 'WALL_FIRE'; isPassableType = true; hpRatio = 99; 
                } 
                else if (type.includes('ICE') || sName.includes('빙') || sName.includes('얼음')) { 
                    key = 'WALL_ICE'; hpRatio = 0.3; auraEff = [{ type: 'DEBUFF_STAT_MOVE', val: 1, area: 1, target: 'ENEMY_ALL' }]; 
                } 
                else if (type.includes('EARTH') || sName.includes('토') || sName.includes('땅')) { 
                    key = 'WALL_EARTH'; hpRatio = 0.6; duration = 99; 
                } 
                
                const centerTarget = targetHex || clickedUnit || caster;
                const areaStr = eff.area || (skill ? skill.area : null) || 'CLEAVE_3';
                const wallHexes = battle.grid.getShapeHexes(centerTarget, caster, areaStr);
                
                if (wallHexes.length === 0) return;

                let sumQ = 0, sumR = 0;
                wallHexes.forEach(h => { sumQ += h.q; sumR += h.r; });
                const trueCenterQ = Math.round(sumQ / wallHexes.length);
                const trueCenterR = Math.round(sumR / wallHexes.length);

                let cannotCast = false;
                let reasonMsg = "";

                for (let i = 0; i < wallHexes.length; i++) {
                    const h = wallHexes[i];
                    const occupant = battle.getUnitAt(h.q, h.r);
                    const isThisCenter = (h.q === trueCenterQ && h.r === trueCenterR);
                    
                    // ⭐ [추가] 지형(Terrain) 속성 검사
                    const terrainData = battle.grid.getTerrainData(h.q, h.r) || {};
                    const terrainKey = terrainData.key || '';
                    const isWater = terrainKey.includes('WATER') || terrainKey.includes('SWAMP') || terrainKey.includes('LAKE');
                    const isLava = terrainKey.includes('LAVA') || terrainKey.includes('MAGMA');

                    if (key === 'WALL_FIRE' && isWater) {
                        cannotCast = true;
                        reasonMsg = "수중 지형에는 화염벽을 생성할 수 없습니다.";
                        break;
                    }
                    if (key === 'WALL_ICE' && isLava) {
                        cannotCast = true;
                        reasonMsg = "용암 위에는 빙벽을 생성할 수 없습니다. (즉시 녹음)";
                        break;
                    }

                    if (occupant) {
                        if (key === 'WALL_FIRE' || key === 'WALL_ICE') {
                            cannotCast = true;
                            reasonMsg = "유닛과 겹치는 곳에는 빙벽이나 화염벽을 시전할 수 없습니다.";
                            break;
                        } else if (key === 'WALL_EARTH') {
                            if (!isThisCenter) {
                                cannotCast = true;
                                reasonMsg = "토벽의 양 끝부분(산)은 유닛과 겹칠 수 없습니다.";
                                break;
                            } else if (occupant.team !== caster.team) {
                                cannotCast = true;
                                reasonMsg = "토벽의 중앙(발판)에 적군을 올릴 수 없습니다.";
                                break;
                            }
                        }
                    }
                }

                if (cannotCast) {
                    battle.log(reasonMsg, "log-bad");
                    caster.curMp += skill._consumedMp || 0; 
                    let costRed = Formulas.getDerivedStat(caster, 'cost_red') || 1.0;
                    caster.actionGauge += Math.floor((skill.cost || 50) * costRed); 
                    battle.actions.acted = false; 
                    battle.showFloatingText(caster, "시전 불가", "#aaa");
                    if (caster.team === 0) { battle.ui.updateStatusPanel(); battle.ui.updateFloatingControls(); }
                    return;
                }

                let spawnedCount = 0;
                wallHexes.forEach((h) => {
                    const isCenter = (h.q === trueCenterQ && h.r === trueCenterR); 
                    const existingUnit = battle.getUnitAt(h.q, h.r);
                    const canRideEarthCenter = (key === 'WALL_EARTH' && isCenter && existingUnit && existingUnit.team === caster.team);
                    
                    let isWallObj = !isPassableType;
                    let isPassableObj = isPassableType;
                    let displayIcon = "🧱";
                    let displayName = "장벽";

                    if (key === 'WALL_FIRE') { displayIcon = "🔥"; displayName = "화염벽"; }
                    else if (key === 'WALL_ICE') { displayIcon = "🧊"; displayName = "빙벽"; }
                    else if (key === 'WALL_EARTH') {
                        if (isCenter) {
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
                        hp: summonHP, casterId: caster.id, duration: duration, 
                        isWall: isWallObj, isPassable: isPassableObj, icon: displayIcon, name: displayName
                    }, auraEff); 
                    spawnedCount++;
                    
                    if (canRideEarthCenter) {
                        battle.log(`⛰️ ${existingUnit.name}이(가) 솟아오른 토벽 위로 탑승합니다!`, "log-system");
                        battle.triggerShakeAnimation(existingUnit); 
                    }
                });

                if (spawnedCount > 0) battle.log(`🧱 장벽이 ${spawnedCount}칸에 생성되었습니다.`, "log-skill");
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

            if (type === 'SYS_CREATE_DECOY' || type === 'SUMMON_DECOY') {
                if (targetHex && !battle.getUnitAt(targetHex.q, targetHex.r)) {
                    let key = type.includes('FIRE') ? 'WALL_FIRE' : 'DECOY';
                    const summonHP = Formulas.calculateEffectPower(caster, type, val); 
                    battle.spawnUnit(key, caster.team, targetHex.q, targetHex.r, { hp: summonHP || 50, casterId: caster.id, duration: eff.dur || 3 });
                    battle.log("👤 소환물이 생성되었습니다.", "log-skill");
                } else {
                    battle.log("소환/설치 공간 부족", 'log-system');
                }
                return;
            }
            if (type === 'SUMMON_GOLEM' || type === 'SUMMON_HOMUNCULUS') {
                const summonKey = type === 'SUMMON_GOLEM' ? 'GOLEM' : 'HOMUNCULUS';
                
                // 사용자가 지정한 타겟 헥스를 우선으로 하되, 겹치면 주변 빈 공간 탐색
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
            
            // ⭐ 1. 타겟 지정 검증 (무조건 연금술사와 인접한 1칸을 지정해야 함)
            const dist = battle.grid.getDistance(caster, center);
            if (!center || dist !== 1) {
                battle.log("연성술은 시전자와 인접한 타일(1칸 거리)을 선택해 방향을 지정해야 합니다.", "log-bad");
                battle.showFloatingText(caster, "사거리 밖!", "#f55");
                return;
            }

            // ⭐ 2. 지형 조건 판별기
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

            // ⭐ 3. 시전 타일(방향 앵커)이 불가능한 지형이면 즉시 취소 & 100% 환불
            if (type.startsWith('NT_') && !isValidTerrain(center.q, center.r, type)) {
                battle.log("해당 지형 방향으로는 이 연성술을 시전할 수 없습니다!", "log-bad");
                battle.showFloatingText(caster, "지형 불일치!", "#f55");
                
                // 마나 및 행동력(AG) 환불 처리
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

            // ⭐ 4. '전진하는 육각형' 진짜 중심점 수학적 계산
            let areaType = eff.area || (skill ? skill.area : '0');
            let hexes = [];
            
            // area 값이 "FORWARD_HEX_3" 처럼 특수 키워드인지 확인
            if (String(areaType).startsWith('FORWARD_HEX_')) {
                const radius = parseInt(areaType.split('_')[2]) || 3;
                const dq = center.q - caster.q;
                const dr = center.r - caster.r;
                
                // 시전자가 바라본 방향으로 반경만큼 떨어진 곳을 진짜 중심으로 잡음
                const projectedCenter = { 
                    q: caster.q + (dq * radius), 
                    r: caster.r + (dr * radius) 
                };

                hexes = battle.grid.getShapeHexes(projectedCenter, caster, String(radius));
                // 시전자 본인이 서있는 타일은 범위에서 제외
                hexes = hexes.filter(h => !(h.q === caster.q && h.r === caster.r));
            } else {
                // 일반 스킬인 경우 기존 로직 사용
                hexes = battle.grid.getShapeHexes(center, caster, areaType);
            }

            let successCount = 0;

            hexes.forEach(h => {
                if (!battle.grid.hexes.has(`${h.q},${h.r}`)) return;
                
                // ⭐ 5. 생성된 범위 내에서 '변성 가능한 타일'만 필터링
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
                    // 1. 맵 텍스처 즉시 갱신 (환경 객체 안전 검사 추가)
                    if (battle.environment && battle.environment.transmuteTerrain) {
                        battle.environment.transmuteTerrain(h.q, h.r, { heightMod: 3, duration: 3 });
                    }
                    if (battle.handleResize) battle.handleResize(); 
                    
                    const pillarHp = Math.floor(Formulas.getDerivedStat(caster, 'hp_max') * 0.5) || 50;                    
                    // 2. 엔진의 소환 차단 로직을 우회하여 직접 맵에 강제 주입
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
        
        for (const t of targets) {
            if (this.battle.hasStatus(t, 'STAT_PETRIFY')) {
                if (type !== 'SYS_BREAK_WALL' && !type.includes('CLEANSE') && !type.includes('DISPEL')) {
                    this.battle.showFloatingText(t, "돌덩이!", "#aaaaaa");
                    continue; 
                }
            }
            if (type === 'COST_HP_PER') {
                const hpCost = Math.floor(t.hp * (val || 0.5));
                t.curHp = Math.max(1, t.curHp - hpCost); // 최소 1은 남김
                battle.showFloatingText(t, `HP -${hpCost}`, '#f00');
                battle.log(`🩸 생명력 대가 지불: HP -${hpCost}`, 'log-dmg');
                continue;
            }
            if (type.startsWith('DMG_') || type.startsWith('ATK_')) {
                if (t.team === caster.team && t !== caster && (!skill || !skill.name.includes('희생'))) continue;
            }
            if (t.curHp <= 0 && !['REVIVE', 'RESURRECT', 'SYS_RESURRECTION', 'SYS_RESURRECTION_ALL', 'SYS_EXORCISE_CORPSE'].includes(type)) continue;
            if (t.type === 'OBJECT' && type !== 'SYS_BREAK_WALL') continue;

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
                t.buffs = t.buffs.filter(b => {
                    if (!this.battle.statusManager) return true;
                    return !this.battle.statusManager.TIERS[this.battle.statusManager.normalizeAilment(b.type)];
                });

                if (t.buffs.length < initialCount) {
                    battle.showFloatingText(t, "정화!", "#55ff55");
                    battle.log(`✨ ${t.name}의 상태이상이 정화되었습니다.`, 'log-heal');
                } else {
                    battle.showFloatingText(t, "정화할 효과 없음", "#aaa");
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
                
                // ⭐ [버그 수정 2] execute()를 우회하고 바로 들어온 덫의 DMG_TRUE 옵션 보정
                if (type === 'DMG_TRUE') {
                    options.penetrate = val || 1.0;
                    dmgType = 'DMG_PHYS'; // 전투 엔진이 에러를 뱉지 않게 물리 타격으로 취급 (방어력은 관통함)
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
                const mockSkill = { type: skill ? skill.type : 'ACTIVE', main: { val: val, type: type } };
                const healData = Formulas.calculateHeal(caster, t, mockSkill);

                let finalHealHp = healData.hp;

                // ⭐ [신규] 연금술사 약리학(Pharmacology) 패시브 적용 (아이템 효과 증가)
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
                    // 약리학/고밀도 추출 MP 회복에도 적용
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
                if (battle.isFlying(t)) battle.showFloatingText(t, "회피(비행)", "#aaa"); 
                else {
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
                    // 이미 훔친 스킬(isStolen)이거나 패시브/기본공격인 것은 제외
                    const activeSkills = t.skills.filter(s => s.type !== 'PASSIVE' && s.id !== '1000' && !s.isStolen);
                    if (activeSkills.length > 0) {
                        const stolen = activeSkills[Math.floor(Math.random() * activeSkills.length)];
                        battle.showFloatingText(t, "스킬 훔침!", "#d0f");
                        battle.log(`🥷 ${caster.name}이(가) [${stolen.name}] 스킬을 모방했습니다!`, 'log-skill');
                        
                        const copiedSkill = JSON.parse(JSON.stringify(stolen));
                        
                        // ⭐ [버그 수정] 훔친 스킬 고유화: ID 재발급, 비용 0, 수명 2턴(이번턴+다음턴) 부여
                        copiedSkill.id = 'STOLEN_' + copiedSkill.id + '_' + Date.now();
                        copiedSkill.name = `[모방] ${copiedSkill.name}`;
                        copiedSkill.cost = 0;
                        copiedSkill.mp = 0;
                        copiedSkill.isStolen = true;
                        copiedSkill.stolenDuration = 2; 

                        caster.skills.push(copiedSkill);
                        
                        if (caster.team === 0 && battle.ui) {
                            battle.ui.updateStatusPanel();
                            battle.ui.updateFloatingControls(); // 플로팅 UI 즉시 갱신
                        }
                    } else battle.showFloatingText(t, "훔칠 스킬 없음", "#aaa");
                } else battle.showFloatingText(t, "훔칠 스킬 없음", "#aaa");
            }
           else if (['CC_KNOCKBACK', 'MOVE_PUSH', 'STAT_KNOCKBACK', 'KNOCKBACK', 'MOVE_PUSH_SIDE'].includes(type)) {
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
                
                const pushDir = battle.grid.getDirection(caster, t);
                let pushDest = null; let hitObstacle = false;
                for(let i=1; i<=val; i++) {
                     const neighbors = battle.grid.getNeighbors(t);
                     const nextHex = neighbors[pushDir]; 
                     if (nextHex && battle.grid.hexes.has(`${nextHex.q},${nextHex.r}`) && battle.grid.isPassable(nextHex.q, nextHex.r) && !battle.getUnitAt(nextHex.q, nextHex.r)) {
                         pushDest = nextHex;
                     } else { hitObstacle = true; break; }
                }
                if (pushDest) {
                    battle.createProjectile(t, pushDest); 
                    await new Promise(r => setTimeout(r, 150));
                    t.q = pushDest.q; t.r = pushDest.r;
                    battle.showFloatingText(t, "밀려남!", "#fff");
                }
                if (hitObstacle && skill && skill.effects.some(e => e.type === 'DMG_COLLISION')) {
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
                
                // ⭐ [수정] 가벼운 손놀림(PAS_STEAL_RATE) 및 레벨 보정 적용
                let stealProb = eff.prob ? parseFloat(eff.prob) : 50;
                const ratePassive = (caster.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_STEAL_RATE'));
                if (ratePassive) stealProb += 20;
                if (caster.level && t.level) stealProb += (caster.level - t.level) * 2;
                
                if (Math.random() * 100 > stealProb) {
                    battle.showFloatingText(t, "훔치기 실패!", "#aaa");
                    battle.log(`❌ ${caster.name}이(가) 골드를 훔치려 했으나 실패했습니다.`, "log-bad");
                    continue;
                }

                const stolen = Math.floor(Math.random() * 50) + 10 + (caster.level || 1) * 5;
                battle.gameApp.gameState.gold += stolen;
                battle.showFloatingText(t, "골드 훔침!", "#888");
                battle.showFloatingText(caster, `+${stolen}G`, "#ffd700");
                battle.log(`적에게서 ${stolen}골드를 훔쳤습니다!`, 'log-item');
                if (caster.team === 0 && battle.gameApp.updateResourceDisplay) battle.gameApp.updateResourceDisplay();
            }
            else if (type === 'ECON_STEAL_ITEM' || type === 'STEAL_ITEM' || type === 'SYS_STEAL_ITEM') {
                if (t === caster) continue;

                // ⭐ [수정] 강탈(SYS_STEAL_ITEM) 성공률 공식 적용
                let stealProb = eff.prob ? parseFloat(eff.prob) : 30;
                const ratePassive = (caster.skills || []).find(s => s.type === 'PASSIVE' && s.effects.some(e => e.type === 'PAS_STEAL_RATE'));
                if (ratePassive) stealProb += 20;
                if (caster.level && t.level) stealProb += (caster.level - t.level) * 3;

                if (Math.random() * 100 > stealProb) {
                    battle.showFloatingText(t, "강탈 실패!", "#aaa");
                    battle.log(`❌ ${caster.name}이(가) 장비를 강탈하려 했으나 실패했습니다.`, "log-bad");
                    continue;
                }

                let stolenItemId = null;
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
                if (stolenItemId) {
                    battle.showFloatingText(t, "아이템 탈취!", "#888");
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
                    battle.log(`훔칠 아이템이 없습니다.`, "log-system");
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
                
                // ⭐ [근본 해결] 아이템(IT_), 조합 투척(MT_), 제작 투척(CT_)의 본래 식별자 타입은 
                // 회복이나 상태이상 등의 하위 효과로 이미 처리되었으므로 상태창에 버프로 등록되지 않도록 차단합니다.
                if (appliedType.startsWith('IT_') || appliedType.startsWith('MT_') || appliedType.startsWith('CT_')) {
                    continue;
                }

                let isSilentFail = false;
                if (appliedType.includes('RANDOM')) {
                    isSilentFail = false; 
                }

                // ⭐ [버그 수정] 'BUFF_'가 포함된 경우(BUFF_STAT_ATK 등)는 이로운 효과이므로 디버프 판정에서 제외합니다.
                const isDebuff = (appliedType.includes('DEBUFF_') || appliedType.includes('CC_') || appliedType.includes('RANDOM') || 
                                 ((appliedType.includes('STAT_') || appliedType.includes('STATUS_')) && !appliedType.includes('BUFF_'))) 
                                 && !appliedType.includes('CHANNELED');
                
                if (isDebuff && t.team === caster.team && String(skill.target).toUpperCase() !== 'SELF') {
                    continue; // 해로운 효과 아군 오폭 방지
                }

                let parsedProb = parseFloat(eff.prob);
                if (isNaN(parsedProb)) parsedProb = 100;
                
                if (skill && (skill.job === '무희' || skill.name.includes('안무') || skill.name.includes('춤'))) {
                    const isNight = battle.isNight || false; 
                    if (isNight && isDebuff) {
                        parsedProb = Math.max(0, parsedProb - 20);
                    }
                }

                // silentFail 플래그를 담아서 상태이상 매니저로 전달
                this.applyStatus(t, { 
                    type: appliedType, 
                    val: val, 
                    duration: eff.dur || eff.duration || 2, 
                    prob: parsedProb, 
                    area: eff.area || (skill ? skill.area : 999),
                    silentFail: isSilentFail 
                }, caster);
            }
        }
    }

    async performAttack(atk, def, mult, name, isDrain, type, hitCount = 1, options = {}) {
        // 1. 타격 전 대상의 체력 기억
        const hpBefore = def.curHp;

        // 2. 실제 공격 수행 (CombatManager로 위임)
        const result = await this.combatManager.performAttack(atk, def, mult, name, isDrain, type, hitCount, options);

        // 3. 타격 후 깎인 체력 계산
        const hpLost = hpBefore - def.curHp;

        // ⭐ 4. 데미지를 입었다면(체력이 깎였다면) 수면/혼란 해제 처리
        if (hpLost > 0) {
            // [수면 해제]: 기획서 2-10 (모든 피격으로 해제)
            if (this.battle.hasStatus(def, 'STAT_SLEEP')) {
                def.buffs = def.buffs.filter(b => this.battle.statusManager.normalizeAilment(b.type) !== 'STAT_SLEEP');
                this.battle.showFloatingText(def, "잠에서 깨어남!", "#fff");
            }
            // [혼란 해제]: 기획서 2-11 (물리 피격으로 해제)
            const currentAtkType = type || atk.atkType || 'PHYS'; 
            if (currentAtkType === 'PHYS' && this.battle.hasStatus(def, 'STAT_CONFUSION')) {
                def.buffs = def.buffs.filter(b => this.battle.statusManager.normalizeAilment(b.type) !== 'STAT_CONFUSION');
                this.battle.showFloatingText(def, "정신이 돌아옴!", "#fff");
            }
        }

        return result;
    }

    applyStatus(target, data, caster) {
        // 에러를 유발했던 찌꺼기 코드 완전 제거됨
        if (this.battle.statusManager) {
            this.battle.statusManager.applyStatus(target, data, caster);
        }
    }

    // ==========================================
    // 🏃‍♂️ 스킬 특수 이동 (MovementEffectManager) 연결
    // ==========================================
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