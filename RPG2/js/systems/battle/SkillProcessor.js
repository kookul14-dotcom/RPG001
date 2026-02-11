import { EFFECTS, PERK_DATA, ELEMENTS } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';

export class SkillProcessor {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    // [수정됨] 옵션 추출(전처리) -> 실행 3단계 구조 적용
    async execute(targetHex, targetUnit) {
        const battle = this.battle;
        const u = battle.currentUnit;

        // 이미 행동했으면 중단
        if (battle.actions.acted) return;

        // 침묵 체크
        if (battle.hasStatus(u, 'CC_SILENCE')) {
            battle.log("😶 침묵 상태입니다!", "log-cc");
            return;
        }

        const baseSkill = battle.selectedSkill;
        if (!baseSkill) return;
        if (baseSkill.reqWeapon && baseSkill.reqWeapon.length > 0) {
            const weaponId = u.equipment ? u.equipment.mainHand : null;
            const offHandId = u.equipment ? u.equipment.offHand : null;
            
            // 아이템 데이터 가져오기
            const weapon = weaponId ? this.battle.gameApp.itemData[weaponId] : null;
            const shield = offHandId ? this.battle.gameApp.itemData[offHandId] : null;
            
            // 무기 타입 확인 (없으면 FIST)
            const mainType = weapon ? weapon.subType : 'FIST';
            const subType = shield ? shield.subType : 'NONE';
            
            // 스킬 요구사항과 내 장비 비교
            const isMatch = baseSkill.reqWeapon.includes(mainType) || baseSkill.reqWeapon.includes(subType);
            
            if (!isMatch) {
                // 안 맞으면 로그 띄우고 강제 종료(return)
                battle.log(`⛔ 필요한 무기가 아닙니다! (${baseSkill.reqWeapon.join(', ')})`, "log-system");
                battle.showFloatingText(u, "Weapon Invalid", "#f55");
                return; 
            }
        }

        // Perk(특성) 적용
        const skill = this.applyPerks(baseSkill, u);
        if (skill.id === '10002') { 
            const dex = Formulas.getStat(u, 'dex');
            const luk = Formulas.getStat(u, 'luk');
            
            // 1. 점수 계산 (DEX 기반 + LUK 주사위)
            const baseScore = dex * 2; 
            const rollCount = 1 + Math.floor(luk / 10); // LUK 10당 주사위 1개 추가
            
            let bestRoll = 0;
            let rolls = []; 
            for(let i=0; i<rollCount; i++) {
                const roll = Math.floor(Math.random() * 100) + 1;
                rolls.push(roll);
                if (roll > bestRoll) bestRoll = roll;
            }

            const totalScore = baseScore + bestRoll;

            // 2. 결과 아이템 판정
            let targetItemId = 'REAGENT_UNSTABLE'; // 기본: 불안정한 시약 (실패작 컨셉)
            let createCount = 1;
            let msg = "시약 추출";
            let msgColor = '#aaa';

            // Lv.1 (Dex 9) 기준 -> Base 18.
            // 주사위(1~100) 더해서 판정.
            
            if (totalScore >= 190) { 
                targetItemId = 'CS_03'; // 상급 물약
                msg = "기적의 조합! (상급)"; 
                msgColor = '#ff00ff'; // 보라색
            } 
            else if (totalScore >= 160) { 
                targetItemId = 'CS_02'; // 중급 물약
                msg = "정밀한 배합! (중급)"; 
                msgColor = '#00ffff'; // 하늘색
            } 
            else if (totalScore >= 110) { 
                targetItemId = 'CS_01'; // 하급 물약
                msg = "조제 성공 (하급)"; 
                msgColor = '#00ff00'; // 초록색
            } 
            else {
                // 70점 미만: 불안정한 시약 (꽝이지만 투척 무기로 사용 가능)
                targetItemId = 'REAGENT_UNSTABLE';
                msg = "배합 불안정..."; 
                createCount = 2; // 대신 개수를 좀 더 줌 (2개)
                msgColor = '#888';
            }

            // 3. UI 및 로그 출력
            const rollText = rolls.length > 1 ? `[${rolls.join(',')}]→${bestRoll}` : `${bestRoll}`;
            battle.showFloatingText(u, msg, msgColor);
            
            // 아이템 이름 가져오기 (로그용)
            const itemInfo = this.battle.gameApp.itemData[targetItemId] || { name: targetItemId };
            battle.log(`${u.name} 조제: ${itemInfo.name} x${createCount} (점수: ${totalScore})`, 'log-skill');

            // 4. 아이템 획득 실행
            for(let i=0; i<createCount; i++) {
                battle.lootItem(targetItemId, u);
            }
            
            // 자원 소모 및 턴 종료
            u.curMp -= skill.mp;
            u.actionGauge -= (skill.cost || 50);
            battle.actions.acted = true;
            if(u.team === 0) battle.ui.updateStatusPanel();
            
            return; 
        }

        // 2. [시약 투척] (10001) - 8칸 탐색 & 랜덤 효과
        if (skill.id === '10001') {
            let reagentSlot = null;
            // 1~8번 슬롯 탐색
            for(let i=1; i<=8; i++) {
                const item = u.equipment[`pocket${i}`];
                if (item === 'REAGENT_UNSTABLE') {
                    reagentSlot = `pocket${i}`;
                    break;
                }
            }

            // [중요] 시약이 없으면 여기서 강제 종료
            if (!reagentSlot) {
                battle.log("불안정한 시약이 없습니다!", "log-bad");
                battle.showFloatingText(u, "No Reagent", "#f55");
                return; // [수정] return으로 스킬 실행 막음
            }
            this.battle.consumeItem(u, reagentSlot);
            skill._slotKey = reagentSlot; // 소모할 슬롯 예약

            // 랜덤 상태이상 로직
            const rand = Math.random() * 100;
            let statusType = 'STATUS_POISON';
            
            if (rand < 30) statusType = 'STATUS_BURN';       
            else if (rand < 60) statusType = 'STATUS_POISON'; 
            else if (rand < 80) statusType = 'CC_FREEZE';     
            else if (rand < 90) statusType = 'AGGRO_CONFUSE'; 
            else statusType = 'CC_STUN';                      

            skill.sub = { 
                type: statusType, 
                val: 1, 
                duration: 2, 
                prob: 100, 
                desc: "Random Effect" 
            };
            battle.log(`🧪 시약 효과: ${statusType}`, 'log-skill');
            // 여기서 return 하지 않고 아래로 흘려보내서 공격 로직 실행
        }

        // 3. [회복 포션 투척] (10003) - 8칸 탐색 & INT 보정
        if (skill.id === '10003') {
            let potionSlot = null;
            let potionItem = null;
            
            for(let i=1; i<=8; i++) {
                const item = u.equipment[`pocket${i}`];
                // 아이템 ID에 'POTION'이 포함되어 있으면 사용 가능
                if (item && item.includes('POTION')) {
                    potionSlot = `pocket${i}`;
                    potionItem = item;
                    break;
                }
            }

            if (!potionSlot) {
                battle.log("던질 포션이 없습니다!", "log-bad");
                battle.showFloatingText(u, "No Potion", "#f55");
                return;
            }

            skill._slotKey = potionSlot;
            
            // 아이템의 기본 회복량을 가져와서 skill.main.val에 주입
            // Formulas.js에서 이 값을 기반으로 INT 보너스를 계산함
            const itemData = this.battle.gameApp.itemData[potionItem];
            const baseHeal = itemData ? (itemData.val || 30) : 30;
            skill.main.val = baseHeal; 
        }
        if (skill.main && (skill.main.type === 'ECON_CREATE' || skill.main.type === 'ECON_ITEM_GET')) {
            let hasPocketSpace = false;
            if (u.equipment) {
                // 주머니 1~4번 중 비어있는 곳이 하나라도 있는지 확인
                for (let i = 1; i <= 4; i++) {
                    if (!u.equipment[`pocket${i}`]) {
                        hasPocketSpace = true;
                        break;
                    }
                }
            }
            // 공간이 없으면 시전 불가 (MP 소모 안 함)
            if (!hasPocketSpace) {
                battle.log("주머니가 가득 차서 생성할 수 없습니다.", "log-system");
                battle.showFloatingText(u, "Pockets Full", "#f55");
                return; 
            }
        }
        
        // 타겟/범위 정보 보정
        if (skill.main) { 
            if(!skill.main.target) skill.main.target = skill.target; 
            if(skill.main.area === undefined) skill.main.area = skill.area; 
        }
        if (skill.sub) { 
            if(!skill.sub.target) skill.sub.target = skill.target; 
            if(skill.sub.area === undefined) skill.sub.area = skill.area; 
        }

        // MP 체크
        if (u.curMp < skill.mp) {
            battle.log("MP가 부족합니다!", "log-system");
            return;
        }

        // 유효 타겟 결정 (자가버프, 광역기 등은 타겟 없이도 발동)
        let effectiveTarget = targetHex;
        if (!effectiveTarget) {
            const tType = skill.main.target;
            if (['SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'AREA_ALL'].includes(tType) || 
               (tType === 'AREA_ENEMY' && (skill.main.area||0) >= 99) ||
               skill.rng === 0) {
                effectiveTarget = u;
            }
        }

        const isGlobalSkill = ['SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL', 'AREA_ALL'].includes(skill.main.target) || 
                              (skill.main.target === 'AREA_ENEMY' && (skill.main.area||0) >= 99);

        // 부활, 소환 등은 타겟이 없어도(빈 땅이어도) 진행
        if (!isGlobalSkill && skill.main.type !== 'RESURRECT' && !skill.main.type.startsWith('SUMMON') && !effectiveTarget) return;

        // 사거리 체크
        if (!isGlobalSkill && effectiveTarget) {
             const dist = battle.grid.getDistance(u, effectiveTarget);
             const rngBonus = Formulas.getStat(u, 'rng');
             // 0이면 무제한(전체) 아님
             if (skill.rng > 0 && dist > skill.rng + rngBonus) { 
                 battle.log("사거리 밖입니다.", "log-system"); return; 
             }
        }

        // ============================================================
        // [STEP 1] 전처리 (옵션 추출)
        // Main이나 Sub에 "계산에 영향을 주는 태그"가 있는지 미리 확인합니다.
        // 실행(Effect)은 하지 않고, combatOptions 객체만 채웁니다.
        // ============================================================
        const combatOptions = {};
        
        // 옵션 성격의 타입 목록 정의
        const modifierTypes = [
            'ATK_SUREHIT',    // 필중
            'ATK_PENETRATE',  // 관통
            'ATK_EXECUTE',    // 처형
            'ATK_DEF_SCALE',  // 방어 비례
            'ATK_DIST',       // 거리 비례
            'COST_HP' ,        // 자해 (특수 처리)
            'ATK_BACK_CRIT' // [추가] 배후 공격 보너스
        ];

        // Helper: 옵션 추출 함수
        const extractOptions = (effect) => {
            if (!effect) return;
            if (modifierTypes.includes(effect.type)) {
                if (effect.type === 'ATK_SUREHIT') combatOptions.sureHit = true;
                if (effect.type === 'ATK_PENETRATE') combatOptions.penetrate = effect.val;
                if (effect.type === 'ATK_EXECUTE') combatOptions.execute = effect.val;
                if (effect.type === 'ATK_DEF_SCALE') combatOptions.defScaleBonus = effect.val;
                if (effect.type === 'ATK_DIST') { 
                    if(!combatOptions.tags) combatOptions.tags = [];
                    combatOptions.tags.push('ATK_DIST');
                }
                if (effect.type === 'COST_HP') combatOptions.costHp = effect.val;
                if (effect.type === 'ATK_BACK_CRIT') { 
            combatOptions.backstabMult = effect.val; 
            effect._isOptionOnly = true; 
        }
                // 이 효과는 '옵션'이므로 실제 액션 단계에서는 스킵한다고 표시
                effect._isOptionOnly = true; 
            }
        };

        extractOptions(skill.main); // 혹시 메인에 옵션이 있을 수도 있으니 확인
        extractOptions(skill.sub);  // 서브에 있는 옵션 확인

        // 이중 시전 체크
        const doubleCastBuff = u.buffs.find(b => b.type === 'BUFF_DOUBLE_CAST');
        let castCount = doubleCastBuff ? 2 : 1;
        if (doubleCastBuff) {
            battle.log("⏩ 이중 시전 발동!", 'log-skill');
            u.buffs = u.buffs.filter(b => b !== doubleCastBuff);
            battle.updateStatusPanel();
        }

        // ============================================================
        // [STEP 2] 시전 및 실행 루프
        // ============================================================
        for(let c = 0; c < castCount; c++) {
            if (c > 0) {
                await new Promise(r => setTimeout(r, 500));
                battle.log("⏩ 연속 시전!", 'log-skill');
            }

            // 1회차 시전 시에만 자원 소모 및 방향 전환
            if (c === 0) {
                u.curMp -= skill.mp;
                
                let costRed = Formulas.getDerivedStat(u, 'cost_red');
                if (!costRed || costRed <= 0) costRed = 1.0; 
                const consume = Math.floor((skill.cost || 50) * costRed); 
                u.actionGauge -= consume;
                
                if (u.team === 0) battle.gainActionXp(u, 10);
                
                battle.log(`${u.name} [${skill.name}] 시전!`, 'log-skill');
                battle.showSpeechBubble(u, skill.name);

                // 방향 전환
                if (effectiveTarget && effectiveTarget !== u && effectiveTarget.q !== undefined) {
                    const dir = battle.grid.getDirection(u, effectiveTarget);
                    u.facing = dir;
                }
                
                // [자해 데미지 처리] - 아까 추출한 옵션 사용
                if (combatOptions.costHp) {
                    const hpCost = Math.floor(u.hp * combatOptions.costHp);
                    u.curHp = Math.max(1, u.curHp - hpCost);
                    battle.showFloatingText(u, `HP -${hpCost}`, '#f00');
                }
            }

            // ============================================================
            // [STEP 3] 실제 효과 실행 (Action)
            // '_isOptionOnly'가 아닌 것들만 실행합니다.
            // ============================================================
            
            // 1. Main 실행 (옵션 제외)
            if (!skill.main._isOptionOnly) {
                await this.processEffect(skill.main, effectiveTarget, targetUnit, u, combatOptions, skill);
            }
            const isMainMulti = (skill.main.type === 'ATK_MULTI' || skill.main.type === 'ATK_CHAIN');
            
            // 2. Sub 실행 (옵션 제외)
            if (skill.sub && !skill.sub._isOptionOnly) {
                await new Promise(r => setTimeout(r, 300)); // 연출 딜레이
                await this.processEffect(skill.sub, effectiveTarget, targetUnit, u, combatOptions, skill);
            }
        }

        // 행동 완료 처리
        battle.actions.acted = true; 
        if (skill.type === 'ITEM' && skill._slotKey) {
            battle.consumeItem(u, skill._slotKey);
        }

        if(u.team === 0) { 
            battle.selectedSkill = null; 
            battle.updateStatusPanel(); 
            battle.updateFloatingControls(); 
        }
        battle.updateCursor();
    }

    async processEffect(eff, targetHex, clickedUnit, caster, options = {}, skill = null) {
        const battle = this.battle;
        const type = eff.type;
        const val = (eff.val !== undefined) ? eff.val : (eff.mult || 1);

        // 1. 특수 액션 처리 (이동 + 공격 등)
        if (type === 'MOVE_ATK' || type === 'ATK_MOVE' || type === 'ATK_DASH') {
            return await this.handleMoveAttack(caster, clickedUnit, targetHex, eff, skill);
        }
        if (type === 'ATK_JUMP') {
            return await this.handleJumpAttack(caster, clickedUnit, eff, skill);
        }

        // 2. 부활 처리 (사망 유닛 대상)
        if (type === 'RESURRECT' || type === 'REVIVE') {
            let deadAllies = battle.units.filter(u => u.team === caster.team && u.curHp <= 0);
            if (deadAllies.length === 0) { battle.log("부활시킬 대상이 없습니다.", "log-system"); return; }
            deadAllies.forEach(t => {
                const healData = Formulas.calculateHeal(caster, t, { main: eff });
                t.curHp = healData.hp;
                battle.showFloatingText(t, "REVIVE!", "#ffdd00");
                battle.log(`✨ ${t.name} 부활!`, 'log-heal');
            });
            battle.renderPartyList();
            return;
        }

        // 3. 일반 타겟 수집
        let targets = battle.collectTargets(eff, targetHex, clickedUnit, caster, skill);

        // 4. 타겟이 없는 경우 특수 처리 (소환, 함정, 순간이동 등)
        if (targets.length === 0) { 
            if (type.startsWith('SUMMON')) {
                if (targetHex && !battle.getUnitAt(targetHex.q, targetHex.r)) {
                    const key = type === 'SUMMON_WALL' ? 'WALL_STONE' : 'DECOY';
                    
                    // [수정] formulas의 계산식을 가져와서 적용
                    const summonHP = Formulas.calculateEffectPower(caster, type, val); 
                    
                    // spawnUnit에 계산된 체력 전달
                    battle.spawnUnit(key, caster.team, targetHex.q, targetHex.r, { hp: summonHP });
                } else battle.log("소환 공간 부족", 'log-system');
                return;
            }
            if (type.startsWith('TRAP')) {
                if (targetHex) battle.placeTrap(targetHex.q, targetHex.r, type, caster.id);
                return;
            }
            if (type === 'MOVE_TELEPORT') {
                if (targetHex && !battle.getUnitAt(targetHex.q, targetHex.r)) {
                    caster.q = targetHex.q; caster.r = targetHex.r;
                    battle.triggerShakeAnimation(caster);
                    battle.log("순간이동!", 'log-skill');
                    // 카메라 이동
                    if(caster === battle.currentUnit) battle.centerCameraOnUnit(caster);
                }
                return;
            }
            
            // [추가] MOVE_BACK (후퇴) 구현
            if (type === 'MOVE_BACK') {
                const backDir = (caster.facing + 3) % 6; 
                let dest = null;
                // 해당 방향으로 val(거리)만큼 이동 가능한 가장 먼 곳 찾기
                for(let i=1; i<=val; i++) {
                    const dirs = [{q:1,r:0}, {q:0,r:1}, {q:-1,r:1}, {q:-1,r:0}, {q:0,r:-1}, {q:1,r:-1}];
                    const d = dirs[backDir];
                    const nextQ = caster.q + (d.q * i);
                    const nextR = caster.r + (d.r * i);
                    
                    if (battle.grid.isPassable(nextQ, nextR) && !battle.getUnitAt(nextQ, nextR)) {
                        dest = {q: nextQ, r: nextR};
                    } else {
                        break; 
                    }
                }
                
                if (dest) {
                    await battle.moveUnit(caster, dest.q, dest.r);
                    battle.log("후퇴!", "log-skill");
                } else {
                    battle.log("물러설 공간이 없습니다.", "log-system");
                }
                return;
            }

            // [추가] SPECIAL_TIME_STOP (시간 정지) 구현
            if (type === 'SPECIAL_TIME_STOP') {
                caster.actionGauge += 200; // 시전자에게 즉시 턴을 주는 방식(GAUGE_MAX)을 2회 반복하는 것으로 구현
                battle.showFloatingText(caster, "TIME STOP!", "#fff");
                return;
            }

            // 경제/유틸 효과는 타겟이 없으면 시전자 본인에게 적용
            if (type.startsWith('ECON') || type.startsWith('UTIL')) {
                targets.push(caster);
            }
        }
        
        // 5. 모든 타겟에게 개별 효과 적용
        for (const t of targets) {
            if (t.curHp <= 0 && type !== 'REVIVE') continue;

            // --- [공격 계열] ---
            if (type.startsWith('DMG') || type.startsWith('ATK') || (type.includes('DRAIN') && !type.startsWith('GAUGE'))) {
                // 공식 변경용 태그는 여기서 건너뜀 (Main 계산 시 options로 이미 반영됨)
                if (['ATK_SUREHIT', 'ATK_PENETRATE', 'ATK_EXECUTE', 'ATK_MOVE', 'ATK_DASH', 'ATK_JUMP', 'ATK_DEF_SCALE', 'ATK_DIST'].includes(type)) continue;

                let dmgType = type.includes('MAG') ? 'MAG' : (type.includes('HOLY') ? 'HOLY' : (type.includes('DARK') ? 'DARK' : (caster.atkType || 'PHYS')));
                const isDrain = type.includes('DRAIN');
                const hitCount = (type === 'ATK_MULTI') ? val : 1;
                let finalMult = (type === 'ATK_MULTI') ? 1.0 : val;

                if (type === 'ATK_MULTI' && skill.sub && skill.sub.type.startsWith('DMG')) {
                    finalMult = skill.sub.val || 1.0; // Sub의 데미지 배율(0.8) 가져오기
                    skill.sub._isOptionOnly = true;
                }

                if (type === 'ATK_CHAIN') {
                     // 첫 타겟 공격
                     await this.performAttack(caster, t, 1.0, "체인", false, 'MAG', 1, options);
                     // 주변 전이 로직
                     let curr = t;
                     let visited = [t.id];
                     for(let i=0; i<val; i++) { // val = 체인 횟수
                         const neighbors = battle.units.filter(u => u.team !== caster.team && u.curHp > 0 && !visited.includes(u.id) && battle.grid.getDistance(u, curr) <= 2);
                         if (neighbors.length > 0) {
                             const next = neighbors[0]; 
                             battle.createProjectile(curr, next);
                             await new Promise(r => setTimeout(r, 200));
                             await this.performAttack(caster, next, 0.7, "전이", false, 'MAG', 1, options);
                             visited.push(next.id);
                             curr = next;
                         } else break;
                     }
                } else {
                    await this.performAttack(caster, t, finalMult, "스킬", isDrain, dmgType, hitCount, options);
                }
            }
            // --- [회복 계열] ---
            else if (type.startsWith('HEAL')) {
                const healData = Formulas.calculateHeal(caster, t, { main: eff });
                if (healData.hp > 0) {
                    const oldHp = t.curHp;
                    t.curHp = Math.min(t.hp, t.curHp + healData.hp);
                    battle.showFloatingText(t, `+${Math.floor(t.curHp - oldHp)}`, '#55ff55');
                    battle.log(`${t.name} 회복: ${Math.floor(t.curHp - oldHp)}`, 'log-heal');
                }
                if (healData.mp > 0) {
                    t.curMp = Math.min(t.mp, t.curMp + healData.mp);
                    battle.showFloatingText(t, `MP +${Math.floor(healData.mp)}`, '#55ccff');
                }
            }
            // --- [게이지 계열] ---
            else if (type.startsWith('GAUGE')) {
                let power = val; 
                // 만약 0.x 단위라면 100을 곱해줌 (안전장치)
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
            // --- [이동 및 위치 계열] ---
            else if (type === 'MOVE_BEHIND') {
                const backHex = battle.grid.getHexInDirection(t, caster, -1);
                if (backHex && !battle.getUnitAt(backHex.q, backHex.r) && battle.grid.isPassable(backHex.q, backHex.r)) {
                    caster.q = backHex.q; caster.r = backHex.r;
                    battle.log("배후로 이동!", 'log-skill');
                    if(caster === battle.currentUnit) battle.centerCameraOnUnit(caster);
                } else {
                    battle.log("배후 공간이 없습니다.", "log-system");
                }
            }
            else if (type === 'MOVE_SWAP') {
                const tempQ = caster.q, tempR = caster.r;
                caster.q = t.q; caster.r = t.r;
                t.q = tempQ; t.r = tempR;
                battle.showFloatingText(caster, "Swap!", "#fff");
            }
            // [추가] MOVE_PULL (끌어오기)
            else if (type === 'MOVE_PULL') {
                 const pullDest = battle.grid.getHexInDirection(caster, t, 1); 
                 if (pullDest && !battle.getUnitAt(pullDest.q, pullDest.r) && battle.grid.isPassable(pullDest.q, pullDest.r)) {
                     battle.createProjectile(t, pullDest);
                     await new Promise(r => setTimeout(r, 100));
                     t.q = pullDest.q; t.r = pullDest.r;
                     battle.showFloatingText(t, "Pulled!", "#aaa");
                 }
            }
            // ▼▼▼ [추가] CC_KNOCKBACK (밀치기) 구현 ▼▼▼
            else if (type === 'CC_KNOCKBACK') {
                // 시전자 -> 타겟 방향으로 밀어냄
                const pushDir = battle.grid.getDirection(caster, t);
                let pushDest = null;
                
                // val(밀어내는 거리)만큼 체크
                for(let i=1; i<=val; i++) {
                     // getHexInDirection은 현재 BattleSystem에 없으므로 간단 로직 사용
                     // (또는 battle.grid.getNeighborInDir 사용)
                     const neighbors = battle.grid.getNeighbors(t);
                     const nextHex = neighbors[pushDir]; // 해당 방향 이웃
                     
                     // 맵 안에 있고, 이동 가능하며, 유닛이 없어야 밀림
                     if (nextHex && battle.grid.hexes.has(`${nextHex.q},${nextHex.r}`) && 
                         battle.grid.isPassable(nextHex.q, nextHex.r) && 
                         !battle.getUnitAt(nextHex.q, nextHex.r)) {
                         pushDest = nextHex;
                     } else {
                         // 벽에 부딪힘 -> 추가 데미지 (선택 사항)
                         battle.showFloatingText(t, "Wall Hit!", "#f00");
                         t.curHp -= 10; 
                         break;
                     }
                }

                if (pushDest) {
                    battle.createProjectile(t, pushDest); // 밀려나는 효과
                    await new Promise(r => setTimeout(r, 150));
                    t.q = pushDest.q; t.r = pushDest.r;
                    battle.showFloatingText(t, "Knockback!", "#fff");
                }
            }

            // --- [유틸리티 계열] ---
            // [추가] UTIL_CD_RESET
            else if (type === 'UTIL_CD_RESET') {
                 battle.showFloatingText(t, "Cooldown Reset!", "#0ff");
                 t.actionGauge = battle.actionGaugeLimit; // 재행동 부여
            }
            
            else if (type.startsWith('ECON')) {
                const bonusPower = Formulas.calculateEffectPower(caster, type, val);
                if (type === 'ECON_STEAL') {
                    battle.gameApp.gameState.gold += bonusPower;
                    battle.showFloatingText(caster, `+${bonusPower} G`, '#ffd700');
                    battle.log(`골드 강탈: ${bonusPower}`, 'log-item');
                } else if (type === 'ECON_GOLD') {
                    battle.goldMod *= val;
                    battle.showFloatingText(caster, "Gold UP", "#ffd700");
                } else if (type.startsWith('ECON_DROP')) {
                    battle.dropMod *= val;
                    battle.showFloatingText(caster, "Drop UP", "#aaf");
                } else {
                    const items = Object.keys(battle.gameApp.itemData).filter(k => battle.gameApp.itemData[k].type === 'CONSUME');
                    
                    if (items.length > 0) {
                        const randItem = items[Math.floor(Math.random() * items.length)];
                        if (randItem) {
                            const itemInfo = battle.gameApp.itemData[randItem];
                            let placed = false;

                            // 주머니 1~4 확인
                            if (caster.equipment) {
                                for (let i = 1; i <= 4; i++) {
                                    const pocketKey = `pocket${i}`;
                                    if (!caster.equipment[pocketKey]) {
                                        caster.equipment[pocketKey] = randItem;
                                        placed = true;
                                        
                                        battle.showFloatingText(caster, `🎒 ${itemInfo.name}`, '#ffdd00');
                                        battle.log(`주머니 생성: ${itemInfo.name}`, 'log-item');
                                        
                                        // UI 즉시 갱신
                                        if (caster.team === 0) {
                                            battle.ui.updateStatusPanel(); 
                                            battle.ui.updateFloatingControls();
                                        }
                                        break;
                                    }
                                }
                            }

                            // [중요] 주머니가 꽉 찼으면 아이템 소멸 (공용 인벤토리로 보내지 않음)
                            if (!placed) {
                                battle.log("공간 부족으로 아이템이 소멸했습니다.", "log-bad");
                            }
                        }
                    }
                }
            }
            // --- [기타 상태이상 적용] ---
            else {
                const info = EFFECTS[type];
                if(info) this.applyStatus(t, eff, caster);
            }
        }
    
}

    async performAttack(atk, def, mult, name, isDrain, type, hitCount = 1, options = {}) {
        const battle = this.battle;
        
        if(name !== "스킬" && name !== "흡수") battle.actions.acted = true; 
        
        if (battle.hasStatus(atk, 'STEALTH')) {
            atk.buffs = atk.buffs.filter(b => b.type !== 'STEALTH');
            battle.showFloatingText(atk, "Revealed", "#ccc");
            if(atk.team === 0) battle.log(`${atk.name} 공격하여 은신 해제`, 'log-system');
        }

        const dir = battle.grid.getDirection(atk, def);
        atk.facing = dir;

        if (!type) type = atk.atkType || 'PHYS';
        if (atk.team === 0) battle.gainActionXp(atk, 5);

        for (let i = 0; i < hitCount; i++) {
            const dist = battle.grid.getDistance(atk, def);
            if (dist > 1) battle.createProjectile(atk, def);
            else battle.triggerBumpAnimation(atk, def);

            await new Promise(resolve => setTimeout(() => {
                const result = Formulas.calculateDamage(atk, def, mult, type, battle.grid, options);

                if (result.hitContext === 'BACKSTAB') battle.showFloatingText(def, "BACK ATTACK!", "#f0f");
                if (result.hitContext === 'BLOCK') battle.showFloatingText(def, "BLOCKED", "#aaa");
                if (result.hitContext === 'EXECUTE') battle.showFloatingText(def, "EXECUTE!", "#f00");

                if (result.isMiss) {
                    battle.showFloatingText(atk, result.text, "#888");
                    
                    let boostAmount = 0;
                    const passiveSkill = (def.skills || []).find(s => s.type === 'PASSIVE' && s.main?.type === 'PASSIVE_EVA_BOOST');
                    if (passiveSkill) boostAmount = passiveSkill.main.val;

                    if (boostAmount === 0) {
                        const buff = def.buffs.find(b => b.type === 'PASSIVE_EVA_BOOST');
                        if (buff) boostAmount = buff.val;
                    }

                    if (boostAmount > 0) {
                        def.actionGauge += boostAmount;
                        battle.showFloatingText(def, `Speed +${boostAmount}`, "#0ff");
                        battle.log(`🎵 전장의 뮤즈: 행동력 +${boostAmount}`, 'log-skill');
                        if (battle.viewingUnit === def) battle.updateStatusPanel();
                    }

                    resolve(); return;
                }

                if (result.isWeak) battle.showFloatingText(def, "Weak!", "#ffcc00");
                if (result.isResist) battle.showFloatingText(def, "Resist", "#888");
                if (result.isCrit) battle.showFloatingText(def, "CRIT!", "#f00");
                if (result.isCursed) battle.showFloatingText(def, "Cursed!", "#b0b");

                let dmg = result.damage;
                
                if (result.text === "IMMUNE") { dmg = 0; battle.showFloatingText(def, "IMMUNE", "#fff"); }
                
                if (battle.hasStatus(def, 'CC_FREEZE')) {
                    dmg *= 2;
                    battle.showFloatingText(def, "SHATTER!", "#aef");
                    def.buffs = def.buffs.filter(b => b.type !== 'CC_FREEZE');
                }
                if (battle.hasStatus(def, 'CC_SLEEP')) {
                    battle.showFloatingText(def, "Wake Up", "#fff");
                    def.buffs = def.buffs.filter(b => b.type !== 'CC_SLEEP');
                }

                const shield = def.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
                if (shield && dmg > 0) {
                    const absorbed = Math.min(shield.amount, dmg);
                    shield.amount -= absorbed;
                    dmg -= absorbed;
                    battle.showFloatingText(def, `(${absorbed})`, "#00bfff"); 
                    if (shield.amount <= 0) def.buffs = def.buffs.filter(b => b !== shield);
                }

                def.curHp = Math.max(0, def.curHp - dmg);
                if(dmg > 0) battle.showFloatingText(def, `-${dmg}`, '#f55');
                
                battle.triggerShakeAnimation(def);
                battle.log(`${atk.name} -> ${def.name}: ${dmg}`, 'log-dmg');

                if (isDrain && dmg > 0) {
                    let heal = Math.floor(dmg * 0.5); 
                    atk.curHp = Math.min(atk.hp, atk.curHp + heal);
                    battle.showFloatingText(atk, `+${heal}`, '#5f5');
                }

                const reflectBuff = def.buffs.find(b => b.type === 'BUFF_REFLECT');
                if (reflectBuff && !options.isReflected && dmg > 0) { 
                    const reflectDmg = Math.floor(dmg * 0.5); 
                    if (reflectDmg > 0) {
                        atk.curHp -= reflectDmg;
                        battle.showFloatingText(atk, `Reflect -${reflectDmg}`, '#f0f');
                        battle.log(`반사 피해: ${reflectDmg}`, 'log-dmg');
                    }
                }

                if (def.curHp <= 0) battle.handleDeath(def);
                battle.renderPartyList();
                battle.updateStatusPanel();
                
                resolve();
            }, dist > 1 ? 300 : 150));

            if (i < hitCount - 1) await new Promise(r => setTimeout(r, 200));
        }

        const dist = battle.grid.getDistance(atk, def);
        const counterBuff = def.buffs.find(b => b.type === 'BUFF_COUNTER');
        if (counterBuff && def.curHp > 0 && dist === 1 && !options.isCounter) {
            battle.log(`${def.name} 반격!`, 'log-skill');
            await new Promise(r => setTimeout(r, 300));
            await this.performAttack(def, atk, 0.8, "반격", false, 'PHYS', 1, { isCounter: true });
        }
    }

    applyStatus(target, data, caster) {
        const battle = this.battle;
        const type = data.type; 
        
        // ▼▼▼ [수정됨] 1. 정화(CLEANSE) 스킬 우선 처리 (버프 추가가 아니라 제거 로직) ▼▼▼
        if (type === 'CLEANSE' || type === 'DISPEL') {
            // 제거할 해로운 상태이상 타입 목록 (CC, 지속피해, 디버프 등)
            // 프로젝트에서 사용하는 해로운 상태 키워드를 모두 포함시킵니다.
            const badPrefixes = ['CC_', 'STATUS_', 'DEBUFF_', 'DOT_'];
            const badSpecifics = ['SHOCK', 'CONFUSE', 'FEAR', 'STUN', 'FREEZE', 'BURN', 'POISON', 'BLEED'];

            const initialCount = target.buffs.length;

            // 해로운 효과를 필터링하여 제거
            target.buffs = target.buffs.filter(b => {
                // EFFECTS 데이터에서 타입이 debuff인지 확인하거나, 키워드로 확인
                const bInfo = EFFECTS[b.type];
                const isDebuff = (bInfo && bInfo.type === 'debuff');
                const isBadKeyword = badPrefixes.some(pre => b.type.startsWith(pre)) || badSpecifics.includes(b.type);
                
                // 해로운 효과라면 제거(false), 아니면 유지(true)
                return !(isDebuff || isBadKeyword);
            });

            if (target.buffs.length < initialCount) {
                battle.showFloatingText(target, "Cleanse!", "#55ff55");
                battle.log(`✨ ${target.name}의 상태이상이 정화되었습니다.`, 'log-heal');
            } else {
                battle.showFloatingText(target, "No Effect", "#aaa");
            }
            
            // UI 갱신 후 즉시 종료 (정화 아이콘이 남지 않도록 함)
            battle.renderPartyList();
            if (battle.viewingUnit === target) {
                battle.updateStatusPanel();
            }
            return; 
        }
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        const info = EFFECTS[type];
        if (!info) return;
                
        // 2. 효과 저항 로직 (디버프일 경우만)
        if (info.type === 'debuff') {
            if (Formulas.getDerivedStat(target, 'tenacity') > 150) { 
                 battle.showFloatingText(target, "IMMUNE", "#fff"); return; 
            }
            const atkPower = caster.level + (Formulas.getStat(caster, 'dex') * 0.5) + (Formulas.getStat(caster, 'int') * 0.5);
            const defPower = target.level + (Formulas.getStat(target, 'vit') * 0.5) + (Formulas.getStat(target, 'agi') * 0.5);
            let successChance = 75 + (atkPower - defPower);
            if (data.prob) successChance = data.prob;
            
            if(data.prob !== 100) successChance = Math.max(10, Math.min(90, successChance));

            if (Math.random() * 100 > successChance) {
                battle.log(`🛡️ ${target.name} 효과 저항!`, 'log-system');
                battle.showFloatingText(target, "RESIST!", "#ffffff");
                return;
            }
        }
        
        // 3. 버프/디버프 적용 (기존 로직)
        const multiplier = (data.val !== undefined) ? data.val : (data.mult !== undefined ? data.mult : 1);

        const buff = { 
            type: type, 
            name: info.name, 
            icon: info.icon, 
            duration: data.duration || 2, 
            val: multiplier, 
            casterId: caster.id,
            desc: info.desc || EFFECTS[type]?.desc || "" 
        };

        if (type === 'BUFF_SHIELD' || type === 'DEF_SHIELD') {
            const shieldVal = Math.floor(Formulas.getStat(caster, 'int') * multiplier * 2);
            buff.amount = shieldVal;
            battle.log(`🛡️ ${target.name} 보호막: ${shieldVal}`, 'log-heal');
        }

        const exist = target.buffs.find(b => b.type === type);
        if (exist) { 
            exist.duration = data.duration || 2; 
            exist.casterId = caster.id; 
            exist.val = multiplier;
            if(buff.amount) exist.amount = buff.amount; 
            battle.log(`${target.name}: [${info.name}] 갱신`, 'log-effect'); 
        } 
        else { 
            target.buffs.push(buff); 
            battle.log(`${target.name}: [${info.name}] 적용`, 'log-effect'); 
        }
        
        let color = info.type === 'buff' ? '#5f5' : '#f55';
        battle.showFloatingText(target, `${info.name}`, color);
        
        battle.renderPartyList(); 
        if (battle.viewingUnit === target) {
            battle.updateStatusPanel();
        }
    }
    // [수정] targetHex 매개변수 추가 및 로직 전면 개편
    async handleMoveAttack(caster, clickedUnit, targetHex, effect, skill) {
        const grid = this.battle.grid;
        const maxMoveRange = skill.rng || 1;
        const isDash = (effect.type === 'ATK_DASH');
        let destQ, destR;

        // 1. 목표 지점 결정 (유닛을 찍었으면 유닛 위치, 땅을 찍었으면 땅 위치)
        if (clickedUnit) {
            // [수정] 유닛을 클릭한 경우: 유닛 위로 가는 게 아니라, 유닛 주변의 '가장 가까운 빈 칸'을 찾습니다.
            const neighbors = grid.getNeighbors(clickedUnit);
            
            // 시전자와 거리가 가장 가까우면서 + 이동 가능하고 + 비어있는 칸 찾기
            const bestSpot = neighbors
                .filter(n => grid.isPassable(n.q, n.r) && !this.battle.getUnitAt(n.q, n.r))
                .sort((a, b) => grid.getDistance(caster, a) - grid.getDistance(caster, b))[0];

            if (bestSpot) {
                destQ = bestSpot.q;
                destR = bestSpot.r;
            } else {
                // 주변에 빈 공간이 하나도 없으면 (포위됨)
                this.battle.log("접근할 공간이 없습니다.", "log-system");
                return false; 
            }
        }

        // 2. 사거리 체크
        const dist = grid.getDistance(caster, {q: destQ, r: destR});
        if (dist > maxMoveRange) {
            this.battle.log("사거리 밖입니다.", "log-system");
            return false;
        }

        // 3. 이동 가능 여부 체크 (목표 지점에 유닛이 있거나 벽이면 안됨)
        // 단, ATK_DASH(혈로)는 적을 관통하므로, 목표 지점만 비어있으면 됨.
        if (!grid.isPassable(destQ, destR) || this.battle.getUnitAt(destQ, destR)) {
             // 만약 유닛을 타겟팅했는데 그 자리에 갈 수 없다면(적 위치니까),
             // 적의 '앞'까지만 이동하도록 로직을 짤 수도 있지만,
             // GROUND 타겟팅인 '혈로'는 빈 땅을 찍어야 하므로 여기서는 불가 처리.
             this.battle.log("이동할 수 없는 위치입니다.", "log-system");
             return false;
        }

        // 4. 경로상의 적 계산 (혈로 구현 핵심)
        let enemiesInPath = [];
        if (isDash) {
            const lineHexes = grid.getLine(caster, {q: destQ, r: destR}, dist);
            
            // [추가] 경로상에 벽(이동 불가 지형)이 있는지 체크
            for (const h of lineHexes) {
                if (!grid.isPassable(h.q, h.r)) {
                    this.battle.log("경로가 막혀있습니다.", "log-system");
                    return false; // 이동 중단
                }
            }
            enemiesInPath = this.battle.units.filter(u => 
                u.team !== caster.team && 
                u.curHp > 0 &&
                lineHexes.some(h => h.q === u.q && h.r === u.r)
            );
        }

        // 5. 이동 실행
        const moved = await this.battle.moveUnit(caster, destQ, destR);
        if (!moved) return false;

        // 6. 공격 실행
        // 6-1. 혈로: 경로상의 모든 적 공격
        if (isDash && enemiesInPath.length > 0) {
            // Sub 효과(DMG_PHYS)의 계수를 가져오거나 기본 1.0
            const dmgMult = (skill.sub && skill.sub.val) ? skill.sub.val : 1.0;
            
            this.battle.log(`${enemiesInPath.length}명을 베고 지나갑니다!`, 'log-skill');
            for (const enemy of enemiesInPath) {
                const dmg = Formulas.calculateDamage(caster, enemy, dmgMult, 'PHYS', grid);
                this.battle.applyDamage(enemy, dmg);
                await new Promise(r => setTimeout(r, 100)); // 타격감 연출
            }
        } 
        // 6-2. 일반 돌진(ATK_MOVE): 타겟 유닛 하나만 공격
        else if (clickedUnit) {
            const dmg = Formulas.calculateDamage(caster, clickedUnit, effect.val, 'PHYS', grid);
            this.battle.applyDamage(clickedUnit, dmg);
        }

        return true;
    }

    async handleJumpAttack(caster, target, effect, skill) {
        const grid = this.battle.grid;

        // 1. 적 주변 6칸 중 빈 칸 탐색
        const neighbors = grid.getNeighbors(target);
        const landingHex = neighbors.find(hex => 
            grid.isPassable(hex.q, hex.r) && !this.battle.getUnitAt(hex.q, hex.r)
        );

        if (!landingHex) {
            this.battle.log("착지할 공간이 없어 점프할 수 없습니다.", "log-system");
            return false;
        }

        // 2. 점프 실행 (BattleSystem에 jumpUnit이 구현되어 있어야 함)
        await this.battle.jumpUnit(caster, landingHex.q, landingHex.r);

        // 3. 데미지 계산 및 적용
        const dmg = Formulas.calculateDamage(caster, target, effect.val, 'PHYS', grid);
        this.battle.applyDamage(target, dmg);
        return true;
    }


    applyPerks(baseSkill, caster) {
        const skill = JSON.parse(JSON.stringify(baseSkill)); 
        if (!caster.perks) return skill; 
        Object.values(caster.perks).forEach(perkId => { 
            if (perkId && perkId.startsWith(skill.id)) { 
                const perkData = PERK_DATA[perkId]; 
                if (perkData) { 
                    if (perkData.cost !== undefined) skill.cost = perkData.cost; 
                    if (perkData.rng !== undefined) skill.rng = perkData.rng; 
                    if (perkData.mp !== undefined) skill.mp = perkData.mp; 
                    if (perkData.main) skill.main = { ...skill.main, ...perkData.main }; 
                    if (perkData.sub) skill.sub = { ...skill.sub, ...perkData.sub }; 
                } 
            } 
        }); 
        return skill;
    }
    applySkillEffect(attacker, target, skill) {
        const battle = this.battle;
        
        // 1. 데미지 타입 및 배율 결정
        // ATK_JUMP 등은 물리 기반으로 가정, 마법 스킬이면 MAG 등
        let dmgType = 'PHYS';
        if (skill.main.type.includes('MAG')) dmgType = 'MAG';
        else if (skill.main.type.includes('HOLY')) dmgType = 'HOLY';
        else if (skill.main.type.includes('DARK')) dmgType = 'DARK';
        
        const mult = skill.main.val || 1.0;

        // 2. 데미지 공식 계산 (Formulas 활용)
        // performAttack 내부 로직을 재사용하여 일관성 유지
        const result = Formulas.calculateDamage(attacker, target, mult, dmgType, battle.grid);
        let finalDmg = result.damage;

        // 3. 결과 적용 (회피/무적 등 체크)
        if (result.isMiss) {
            battle.showFloatingText(target, "MISS", "#888");
            return 0;
        }
        if (result.text === "IMMUNE") {
            battle.showFloatingText(target, "IMMUNE", "#fff");
            return 0;
        }

        // 4. 보호막 계산
        const shield = target.buffs.find(b => b.type === 'SHLD' || b.type === 'DEF_SHIELD');
        if (shield && finalDmg > 0) {
            const absorbed = Math.min(shield.amount, finalDmg);
            shield.amount -= absorbed;
            finalDmg -= absorbed;
            battle.showFloatingText(target, `(${absorbed})`, "#00bfff");
            if (shield.amount <= 0) target.buffs = target.buffs.filter(b => b !== shield);
        }

        // 5. 체력 차감
        target.curHp = Math.max(0, target.curHp - finalDmg);

        // 6. UI 표시
        if (finalDmg > 0) {
            battle.showFloatingText(target, `-${finalDmg}`, result.isCrit ? '#ff0000' : '#ffffff');
            if (result.isCrit) battle.showFloatingText(target, "CRIT!", "#ff0000");
            if (result.isWeak) battle.showFloatingText(target, "Weak!", "#ffcc00");
        } else {
            battle.showFloatingText(target, "0", "#aaa");
        }

        battle.log(`${attacker.name}의 ${skill.name}! ${finalDmg} 피해`, 'log-dmg');

        // 7. 서브 효과(상태이상) 적용
        // 단, 넉백(KNOCKBACK)은 BattleSystem에서 물리적으로 처리하므로 여기서 중복 적용하지 않음
        if (skill.sub && skill.sub.type) {
            const subType = skill.sub.type;
            if (subType !== 'CC_KNOCKBACK' && subType !== 'KNOCKBACK') {
                this.applyStatus(target, skill.sub, attacker);
            }
        }

        // 8. 흡혈(Drain) 로직 (필요 시)
        if (skill.main.type.includes('DRAIN') && finalDmg > 0) {
            const heal = Math.floor(finalDmg * 0.5);
            attacker.curHp = Math.min(attacker.hp, attacker.curHp + heal);
            battle.showFloatingText(attacker, `+${heal}`, '#5f5');
        }

        // UI 갱신
        battle.renderPartyList();
        if (battle.viewingUnit === target) battle.updateStatusPanel();

        return finalDmg; // 사망 판정을 위해 데미지 반환
    }
}