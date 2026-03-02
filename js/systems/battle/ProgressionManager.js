import * as Formulas from '../../utils/formulas.js';

export class ProgressionManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    gainActionXp(unit, amount) {
        if (this.battle.isTestMode) return;
        const ACTION_XP_LIMIT = 40; 
        if ((unit.stageActionXp || 0) >= ACTION_XP_LIMIT) {
            if (!unit.hasShownMaxXpMsg) {
                this.battle.showFloatingText(unit, "Max Action XP", "#888"); 
                unit.hasShownMaxXpMsg = true;
            }
            return;
        }
        if (!unit.stageActionXp) unit.stageActionXp = 0;
        let actualGain = amount;
        if (unit.stageActionXp + amount > ACTION_XP_LIMIT) actualGain = ACTION_XP_LIMIT - unit.stageActionXp;

        if (actualGain > 0) {
            unit.stageActionXp += actualGain;
            unit.xp += actualGain;
            this.checkLevelUp(unit);
            this.battle.gameApp.saveGame();
        }
    }

    // =====================================================================
    // ⭐ [신규] 전투 승리 시 생존 아군 전원 공통 경험치 지급 (기획: 총량의 약 30%)
    // =====================================================================
    gainVictoryBonus() {
        if (this.battle.isTestMode || this.battle.isPeaceful) return;

        const allies = this.battle.units.filter(u => u.team === 0 && u.curHp > 0);
        if (allies.length === 0) return;

        // 기획: 1회 전투(약 1레벨업=100XP)의 30% 정도를 보상으로 설정 (챕터 비례 증가)
        let victoryXp = 30 + (this.battle.chapter * 5); 
        
        // 이미 클리어한 스테이지 반복(노가다) 시 경험치 절반
        const stageKey = `${this.battle.chapter}-${this.battle.stage}`;
        if (this.battle.gameApp.gameState.clearedStages.includes(stageKey)) {
            victoryXp = Math.floor(victoryXp * 0.5); 
        }

        allies.forEach(u => {
            u.xp += victoryXp;
            this.battle.showFloatingText(u, `승전 +${victoryXp} XP`, '#ffaa00');
            this.checkLevelUp(u);
        });
        
        this.battle.log(`🎉 생존한 아군 전원에게 승전 보너스 ${victoryXp} XP가 지급되었습니다!`, 'log-system');
    }

    // =====================================================================
    // ⭐ [신규] 4중 성장 시스템 포인트 획득 중앙 처리 함수
    // =====================================================================
    // ⭐ [수정] CombatManager에서 전달하는 isKillParam을 명시적으로 수신하여 적 처치 30% 보너스 보장
    gainCombatPoints(caster, skill, isHit, target, isKillParam = false) {
        if (this.battle.isTestMode || !caster || caster.team !== 0) return; // 아군만 성장

        // 명시적으로 넘겨받은 킬 플래그를 최우선으로 적용 (타이밍 차이로 인한 보상 누락 방지)
        const isKill = isKillParam || (target && target.curHp <= 0);
        const isMiss = !isHit;
        const targetLv = target ? (target.level || 1) : caster.level;
        const casterLv = caster.level || 1;
        
        // 무기 타입 파악
        let weaponType = 'FIST';
        if (caster.equipment && caster.equipment.mainHand && this.battle.gameApp.itemData[caster.equipment.mainHand]) {
            weaponType = this.battle.gameApp.itemData[caster.equipment.mainHand].subType || 'FIST';
        }

        // ⭐ [추가] 구버전 세이브 데이터를 위한 안전 장치 (에러 방지)
        if (caster.jpTotal === undefined) caster.jpTotal = 0;
        if (caster.jpAvailable === undefined) caster.jpAvailable = 0;
        if (!caster.wp) caster.wp = {};
        if (!caster.sp) caster.sp = {};

        // 1. EXP (Level) 획득
        // 상대 레벨이 자신보다 5 이상 낮으면 획득량 0
        if (!isMiss && (casterLv - targetLv < 5)) {
            let expGain = 10; // 기본 공격 성공 시
            if (isKill) expGain += 3; // 처치 시 30% 추가
            
            // 기존 actionXp 로직 대신 새로운 EXP 획득 처리
            caster.xp += expGain;
            this.battle.showFloatingText(caster, `EXP +${expGain}`, '#ffffff');
        }

        // 2. JP (Class) 획득
        // 명중 시 20, 빗나갈 시 6 (30%)
        let jpGain = isMiss ? 6 : 20;
        caster.jpTotal += jpGain;
        caster.jpAvailable += jpGain;
        
        // 3. WP (Weapon Dexterity) 획득
        // 일반 공격이거나 무기를 사용하는 물리 스킬일 경우
        if (skill.id === '1000' || skill.atkType === 'PHYS' || skill.type === 'ACTIVE') {
            let wpGain = isMiss ? 2.5 : 5; // 명중 5, 빗나감 2.5 (50%)
            if (!caster.wp[weaponType]) caster.wp[weaponType] = { level: 1, xp: 0 };
            caster.wp[weaponType].xp += wpGain;
        }

        // 4. SP (Skill Level) 획득
        // 기본 공격이나 아이템이 아닌 고유 스킬일 경우
        if (skill.id !== '1000' && skill.type !== 'ITEM') {
            let spGain = isMiss ? 1 : 5; // 성공 5, 실패 1 (20%)
            if (!caster.sp[skill.id]) caster.sp[skill.id] = { level: 1, xp: 0 };
            caster.sp[skill.id].xp += spGain;
        }
        
        // ⭐ [핵심 수정] 레벨업 판정을 무조건 마지막에 실행 (빗나가서 WP/SP가 올랐을 때도 레벨업 되도록)
        this.checkLevelUp(caster);
        
        // 성장 데이터 저장
        if (this.battle.gameApp) this.battle.gameApp.saveGame();
    }

    // =====================================================================
    // ⭐ [신규] 4중 성장 시스템 레벨업 통합 판정
    // =====================================================================
    checkLevelUp(unit) {
        if (!unit || unit.team !== 0) return; // 아군만 성장 처리

        let levelUpOccurred = false;

        // 1. 유닛 레벨업 (Max 60)
        while (unit.level < 60 && unit.xp >= Formulas.EXP_REQ(unit.level)) {
            unit.xp -= Formulas.EXP_REQ(unit.level);
            unit.level++;
            unit.statPoints += 3; // 기본 스탯 포인트 부여 (기획에 맞게 수정 가능)
            
            // 레벨업 시 HP/MP 풀 회복
            unit.hp += 10; // 레벨당 체력 증가량 예시
            unit.mp += 5;  // 레벨당 마나 증가량 예시
            unit.curHp = unit.hp;
            unit.curMp = unit.mp;
            
            this.battle.showFloatingText(unit, `LEVEL UP! (Lv.${unit.level})`, '#ffff00');
            this.battle.log(`🎉 [레벨업] ${unit.name}의 레벨이 ${unit.level}(으)로 상승했습니다!`, 'log-system');
            levelUpOccurred = true;
        }

        // 2. 직업 클래스업 (Max 8)
        while (unit.classLevel < 8 && unit.jpTotal >= Formulas.CLASS_JP_REQ[unit.classLevel]) {
            // JP는 소모하는 것이 아니라 누적치로 클래스업을 판정하므로 빼지 않음
            unit.classLevel++;
            this.battle.showFloatingText(unit, `CLASS UP! (Lv.${unit.classLevel})`, '#ffaa00');
            this.battle.log(`🌟 [클래스업] ${unit.name}의 직업 클래스가 ${unit.classLevel}(으)로 상승했습니다! 새로운 스킬이 해금됩니다.`, 'log-system');
            levelUpOccurred = true;
        }

        // 3. 무기 숙련도 레벨업 (Max 4)
        for (let wType in unit.wp) {
            let wpData = unit.wp[wType];
            while (wpData.level < 4 && wpData.xp >= Formulas.WEAPON_WP_REQ[wpData.level]) {
                wpData.xp -= Formulas.WEAPON_WP_REQ[wpData.level];
                wpData.level++;
                this.battle.showFloatingText(unit, `WEAPON UP!`, '#00ffaa');
                this.battle.log(`⚔️ [무기 숙련] ${unit.name}의 [${wType}] 무기 숙련도가 ${wpData.level}(으)로 상승했습니다!`, 'log-system');
                
                // 기획안 반영: 레벨 2, 3, 4에서 필살기 해금
                if (wpData.level >= 2) {
                    this.battle.log(`🔥 [필살기 해금] ${unit.name}이(가) 새로운 필살기를 습득했습니다!`, 'log-skill');
                }
                levelUpOccurred = true;
            }
        }

        // 4. 스킬 숙련도 레벨업 (Max 4)
        for (let sId in unit.sp) {
            let spData = unit.sp[sId];
            while (spData.level < 4 && spData.xp >= Formulas.SKILL_SP_REQ[spData.level]) {
                spData.xp -= Formulas.SKILL_SP_REQ[spData.level];
                spData.level++;
                this.battle.showFloatingText(unit, `SKILL UP!`, '#ff00aa');
                this.battle.log(`✨ [스킬 강화] ${unit.name}의 특정 스킬 레벨이 상승하여 효과가 강화됩니다!`, 'log-system');
                levelUpOccurred = true;
            }
        }

        // 시각 및 UI 업데이트
        if (levelUpOccurred) {
            this.battle.triggerShakeAnimation(unit); // 레벨업 시 유닛 흔들림 효과
            this.battle.updateStatusPanel();         // UI 갱신
            if (this.battle.gameApp) this.battle.gameApp.saveGame();
        }
    }
}