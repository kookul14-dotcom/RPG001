import * as Formulas from '../../utils/formulas.js';

const NPC_SCRIPTS = {
    '1-0': {
        'NPC_TEMPLE': {
            name: "대사제 루시우스", icon: "🧙‍♂️", role: "TEMPLE",
            first: [
                "오, 길 잃은 어린 양이여. 이곳은 신의 지혜를 구하는 곳이라네.",
                "스킬을 배우려면 고대 유적에서 발견되는 **'고대 주화'**가 필요하지.",
                "하지만 걱정 말게. 신께선 관대하시니 **스킬 초기화(리셋)는 언제든 무료**로 해주고 있다네. 마음껏 실험해보게나."
            ],
            random: [
                "내 안경 못 봤나? ...허허, 또 머리 위에 얹어두고 찾았구먼.",
                "스킬 포인트가 꼬였다고 울지 말게. 내게 오면 머리를 맑게 씻어주지(리셋)."
            ],
            service: "자, 어떤 지혜를 깨우치고 싶은가? (초기화 무료)"
        },
        'NPC_WEAPON': {
            name: "강철손 브론", icon: "⚒️", role: "SHOP_WEAPON",
            first: ["어이 신입! 눈에 힘 좀 빼라. 무기 보러 왔나?"],
            random: ["남자는 등으로 말하고, 전사는 장비로 말하는 거야."],
            service: "골드는 넉넉히 챙겨왔겠지? 물건을 골라봐."
        },
        'NPC_ARMOR': {
            name: "방패지기 한나", icon: "🛡️", role: "SHOP_ARMOR",
            first: ["어머, 옷차림이 그게 뭐니? 그러다 스치기만 해도 죽겠어."],
            random: ["갑옷이 무겁다고? 목숨 무게보단 가벼울걸?"],
            service: "네 목숨을 지켜줄 물건들이야. 꼼꼼히 봐."
        },
        'NPC_POTION': {
            name: "연금술사 핍", icon: "⚗️", role: "SHOP_POTION",
            first: ["히히! 어서 와요! 폭발... 아니, 물약 필요하죠?"],
            random: ["이 빨간 물약 먹어볼래요? 딸기 맛이 나요!"],
            service: "무엇이 필요해요? 아니면 뭘 팔 건가요? (판매 가능)"
        },
        'NPC_INN': {
            name: "마담 몰리", icon: "🛌", role: "INN",
            first: ["여기서 푹 쉬고 가. **잠을 자야 HP랑 MP가 싹 회복**되지."],
            random: ["침대는 과학... 아니, 마법이라구. 누우면 기절할걸?"],
            service: "쉬러 왔어? 푹신한 침대가 기다린다구."
        },
        'NPC_TAVERN': {
            name: "용병대장 바릭", icon: "🍺", role: "TAVERN",
            first: ["혼자선 전쟁에서 못 이겨. **자네의 '명성'이 높다면** 내 유능한 부하들을 소개해주지."],
            random: ["내 부하들은 일당백이야. 물론 몸값은 좀 비싸지만 밥값은 하지."],
            service: "어떤 녀석을 동료로 삼고 싶나? (명성 필요)"
        },
        'NPC_TRAINER': {
            name: "훈련교관 마스터", icon: "⚔️", role: "TRAINER",
            first: [
                "전투의 감을 잃지 않았나? 언제든 훈련이 필요하면 말해라.",
                "이곳에선 어떤 상황이든 가상으로 시뮬레이션 할 수 있지."
            ],
            random: ["실전은 연습처럼, 연습은 실전처럼!"],
            service: "테스트 전장에 입장하겠나?"
        }
    }
};

export class EnvironmentManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.chatterInterval = null;
    }
    
    initNPCs(chapter, stage) {
        const mapKey = `${chapter}-${stage}`;
        const npcSet = NPC_SCRIPTS[mapKey];

        if (npcSet) {
            if (mapKey === '1-0') {
                this.spawnTownNPC('NPC_TEMPLE', 1, 2, npcSet['NPC_TEMPLE']);
                this.spawnTownNPC('NPC_WEAPON', 6, 2, npcSet['NPC_WEAPON']);
                this.spawnTownNPC('NPC_ARMOR', 7, 5, npcSet['NPC_ARMOR']);
                this.spawnTownNPC('NPC_POTION', 5, 8, npcSet['NPC_POTION']);
                this.spawnTownNPC('NPC_INN', -1, 8, npcSet['NPC_INN']);
                this.spawnTownNPC('NPC_TAVERN', 11, 2, npcSet['NPC_TAVERN']);
                this.spawnTownNPC('NPC_TRAINER', -2, 5, npcSet['NPC_TRAINER']);
            }
            this.startNPCChatter();
        }
    }

    spawnTownNPC(id, q, r, data) {
        if (!data) return;
        const npc = {
            id: id, name: data.name, icon: data.icon, team: 2, q: q, r: r,
            curHp: 9999, hp: 9999, curMp: 9999, mp: 9999, actionGauge: 0,
            buffs: [], skills: [], equipment: {}, isNPC: true, role: data.role, hasMet: false,
            shake: 0, bumpX: 0, bumpY: 0
        };
        if (this.battle.getUnitAt(q, r)) npc.r += 1;
        this.battle.units.push(npc);
    }

    handleNPCInteraction(npc) {
        const mapKey = `${this.battle.chapter}-${this.battle.stage}`;
        const npcSet = NPC_SCRIPTS[mapKey];
        if (!npcSet) return;
        const scriptData = npcSet[npc.id];
        if (!scriptData) return;

        let msg = "";
        if (!npc.hasMet) {
            msg = scriptData.first[0]; npc.hasMet = true; 
        } else {
            if (Math.random() < 0.4) { msg = scriptData.service; } 
            else { const randIdx = Math.floor(Math.random() * scriptData.random.length); msg = scriptData.random[randIdx]; }
        }

        this.battle.showSpeechBubble(npc, msg);
        this.battle.log(`[${scriptData.name}] ${msg}`, 'log-system');

        setTimeout(() => {
            const sys = this.battle.gameApp.townSystem;
            switch (scriptData.role) {
                case 'TEMPLE': sys.openTemple(); break;
                case 'SHOP_WEAPON': sys.openShop('weapon'); break;
                case 'SHOP_ARMOR': sys.openShop('armor'); break;
                case 'SHOP_POTION': sys.openShop('potion'); break; 
                case 'INN': sys.openInn(); break;
                case 'TAVERN': sys.openTavern(); break;
                case 'TRAINER': this.battle.gameApp.showConfirm("테스트 전장으로 이동하시겠습니까?", () => this.battle.initTestBattlefield()); break;
            }
        }, 1200); 
    }

    startNPCChatter() {
        if (this.chatterInterval) clearInterval(this.chatterInterval);
        this.chatterInterval = setInterval(() => {
            if (!this.battle.isPeaceful || document.querySelector('.modal-overlay[style*="flex"]')) return;
            const npcs = this.battle.units.filter(u => u.isNPC);
            if (npcs.length === 0) return;
            const isAnyoneTalking = npcs.some(u => u.speechText);
            if (isAnyoneTalking) return;

            const npc = npcs[Math.floor(Math.random() * npcs.length)];
            const mapKey = `${this.battle.chapter}-${this.battle.stage}`;
            const npcSet = NPC_SCRIPTS[mapKey];
            
            if (npcSet && npcSet[npc.id]) {
                const data = npcSet[npc.id];
                const randMsg = data.random[Math.floor(Math.random() * data.random.length)];
                this.battle.showSpeechBubble(npc, randMsg, 4000);
            }
        }, 5000);
    }

    cleanupChatter() {
        if (this.chatterInterval) {
            clearInterval(this.chatterInterval);
            this.chatterInterval = null;
        }
    }

    // ⭐ [매개변수 추가] 저장된 효과와 스킬 데이터를 받도록 추가
    placeTrap(q, r, type, casterId, storedEffects = null, skillData = null) {
        if (this.battle.getUnitAt(q, r)) { 
            this.battle.log("유닛이 있어 함정을 설치할 수 없습니다.", "log-system"); 
            return; 
        }

        if (!this.battle.traps) this.battle.traps = [];
        const existingIdx = this.battle.traps.findIndex(t => t.q === q && t.r === r);
        if (existingIdx !== -1) this.battle.traps.splice(existingIdx, 1);
        
        let trapIcon = '🪤';
        let trapName = '함정';
        if (type === 'TRAP_WIRE') { trapIcon = '〰️'; trapName = '살인 철사'; } 
        else if (type === 'TRAP_STUN') { trapIcon = '🪤'; trapName = '기절 덫'; } 
        else if (type === 'TRAP_POISON') { trapIcon = '☠️'; trapName = '맹독 덫'; } 
        else if (type === 'TRAP_EXPLOSION') { trapIcon = '💣'; trapName = '폭약 덫'; }

        this.battle.traps.push({ 
            q: q, r: r, type: type, casterId: casterId, icon: trapIcon, name: trapName, isHidden: true 
        });

        if (!this.battle.tileEvents) this.battle.tileEvents = [];
        
        // ⭐ [버그 수정] 바닥 데이터에 effects(출혈, 방어무시 데미지 등)를 온전히 기록
        this.battle.tileEvents.push({ 
            q, r, type, ownerId: casterId, triggered: false, 
            effects: storedEffects, skill: skillData 
        });

        this.battle.showFloatingText({q, r}, "TRAP PLACED", "#ffaa00");
        this.battle.log(`📍 지정된 위치에 보이지 않는 [${trapName}]이(가) 설치되었습니다.`, 'log-system');
    }

    checkTileEvent(unit) {
        if (!this.battle.gameApp.gameState.collectedObjects) this.battle.gameApp.gameState.collectedObjects = [];

        if (unit.isDiscoverySignaling) {
            unit.isDiscoverySignaling = false; unit.discoveryTarget = null;
            this.battle.updateUnitOverlayPosition(unit); 
        }

        const hiddenIdx = this.battle.hiddenObj.findIndex(obj => obj.q === unit.q && obj.r === unit.r);
        if (hiddenIdx !== -1) {
            const obj = this.battle.hiddenObj[hiddenIdx];
            const objKey = `HIDDEN_${obj.type}_${this.battle.chapter}_${this.battle.stage}_${obj.q}_${obj.r}`;
            const isAlreadyCollected = this.battle.gameApp.gameState.collectedObjects.includes(objKey);

            if (obj.type === 'ITEM') {
                if (isAlreadyCollected) { this.battle.hiddenObj.splice(hiddenIdx, 1); return; }
                obj.detected = true;
                if (!this.battle.isPeaceful) { this.battle.showFloatingText(unit, "Not Yet...", "#aaa"); return; }

                const itemIds = String(obj.id).split(',');
                let acquiredNames = [];
                itemIds.forEach(rawId => {
                    const finalId = rawId.trim();
                    if (finalId) {
                        this.battle.lootItem(finalId, unit);
                        const itemData = this.battle.gameApp.itemData[finalId];
                        if (itemData) acquiredNames.push(itemData.name);
                    }
                });

                this.battle.showFloatingText(unit, "GET!", "#ffdf00");
                if (acquiredNames.length > 0) this.battle.gameApp.showAlert(`[${acquiredNames.join(', ')}]을(를) 획득했습니다!`);
                this.battle.gameApp.gameState.collectedObjects.push(objKey);
                this.battle.hiddenObj.splice(hiddenIdx, 1);
                this.battle.gameApp.saveGame();
                return;
            } 
            else if (obj.type === 'CAVE') {
                if (isAlreadyCollected) obj.detected = true;
                else if (!obj.detected) {
                    this.battle.showFloatingText(unit, "비밀 통로!", "#55ff55");
                    obj.detected = true;
                    this.battle.gameApp.gameState.collectedObjects.push(objKey);
                    this.battle.gameApp.saveGame();
                }

                if (this.battle.isPeaceful) {
                    if (confirm("비밀스러운 통로입니다.\n입장하시겠습니까?")) {
                        this.battle.gameApp.gameState.returnPoint = { chapter: this.battle.chapter, stage: this.battle.stage, q: unit.q, r: unit.r };
                        this.battle.gameApp.saveGame();

                        let targetChap = this.battle.chapter; let targetStage = obj.stageId;
                        if (String(obj.stageId).includes('-')) {
                            const parts = obj.stageId.split('-');
                            targetChap = parseInt(parts[0]); targetStage = parseInt(parts[1]);
                        }
                        this.battle.isBattleEnded = true; 
                        const party = (this.battle.gameApp.prepState && this.battle.gameApp.prepState.party) ? this.battle.gameApp.prepState.party : this.battle.gameApp.gameState.heroes.map(h => ({ hero: h }));
                        this.battle.gameApp.startBattle(targetChap, targetStage, party);
                    }
                } else this.battle.showFloatingText(unit, "전투 중 입장 불가", "#aaa");
                return;
            }
        }

        if (this.battle.tileEvents) {
            const trapIndex = this.battle.tileEvents.findIndex(t => t.q === unit.q && t.r === unit.r && !t.triggered);
            if (trapIndex !== -1) {
                const trap = this.battle.tileEvents[trapIndex];
                if (trap.ownerId !== unit.id) { 
                    this.battle.log(`🚨 ${unit.name}이(가) 숨겨진 덫을 밟았습니다!`, "log-bad");
                    this.battle.showFloatingText(unit, "TRAP!", "#ff0000");
                    this.battle.triggerShakeAnimation(unit);
                    
                    if (trap.effects && trap.effects.length > 0) {
                        // ⭐ [버그 수정 1] 설치자 사망 시 대체 스탯 대폭 보완 (NaN 데미지 방지)
                        const caster = this.battle.units.find(u => u.id === trap.ownerId) || { 
                            id: trap.ownerId, name: '설치자(사망)', team: 0, 
                            hp: 100, curHp: 100, maxHp: 100,
                            level: 1, str: 10, dex: 10, int: 10, agi: 10, vit: 10, luk: 10, 
                            atk: 10, matk: 10, atkType: 'PHYS', skills: [] 
                        };
                        
                        const trapExplosionEffects = trap.effects.filter(e => e.type !== 'SYS_CREATE_TRAP');
                        
                        (async () => {
                            for (const eff of trapExplosionEffects) {
                                if (this.battle.skillProcessor) {
                                    const clonedEff = JSON.parse(JSON.stringify(eff));
                                    
                                    // ⭐ [근본 해결책 연계] 스킬 엔진이 좌표(q, r)나 불확실한 키워드로 대상을 찾다가 
                                    // 타겟을 잃어버리는 사각지대를 막기 위해, 밟은 유닛을 스킬 엔진에 강제로 주입합니다.
                                    clonedEff._forcedTarget = unit; 
                                    
                                    if (String(clonedEff.val).trim() === '-' || String(clonedEff.val).trim() === '0') {
                                        clonedEff.val = 1;
                                    }
                                    
                                    const combatOptions = { skill: trap.skill };
                                    await this.battle.skillProcessor.processEffect(clonedEff, unit, unit, caster, combatOptions, trap.skill);
                                }
                            }
                        })();
                    } 
                    else if (trap.type === 'TRAP_STUN') {
                        const dmg = Math.floor(unit.hp * 0.1) + 10;
                        if (this.battle.applyDamage) this.battle.applyDamage(unit, dmg);
                        else unit.curHp = Math.max(0, unit.curHp - dmg);
                        if (this.battle.skillProcessor) this.battle.skillProcessor.applyStatus(unit, { type: 'CC_STUN', duration: 1 });
                        this.battle.updateStatusPanel();
                    }
                    
                    this.battle.tileEvents.splice(trapIndex, 1);
                    const visualTrapIdx = this.battle.traps.findIndex(t => t.q === trap.q && t.r === trap.r);
                    if (visualTrapIdx !== -1) this.battle.traps.splice(visualTrapIdx, 1);
                }
            }
        }

        if (unit.team === 0 && !this.battle.isTestMode) {
            const key = `${unit.q},${unit.r}`;
            const cell = this.battle.grid.terrainMap.get(key);
            
            if (cell && cell.building) {
                const bKey = cell.building.key;
                const bInfo = this.battle.gameApp.buildingData[bKey];

                if (!bInfo && !['CHEST', 'EXIT_POINT', 'START_POINT', 'PORTAL', 'TEMPLE', 'BLACKSMITH'].includes(bKey)) return;

                if (bKey === 'PORTAL' || (bInfo && bInfo.type === 'teleport')) {
                    let isPortalActive = false; let lockMsg = "";

                    if (this.battle.chapter === 1 && this.battle.stage === 0) {
                        const hasCleared1_1 = this.battle.gameApp.gameState.clearedStages.includes('1-1');
                        if (hasCleared1_1) isPortalActive = true;
                        else lockMsg = "🔒 1-1 스테이지를 클리어해야 개방됩니다.";
                    } else {
                        const enemiesAlive = this.battle.units.some(u => u.team === 1 && u.curHp > 0);
                        if (!enemiesAlive) isPortalActive = true;
                        else lockMsg = "⚠️ 적을 모두 물리쳐야 활성화됩니다.";
                    }

                    if (!isPortalActive) {
                        this.battle.showFloatingText(unit, "🔒 봉인됨", "#aaa");
                        this.battle.log(lockMsg, "log-system");
                        this.battle.triggerShakeAnimation(unit); 
                        return;
                    }

                    const text = cell.building.text;
                    if (text && text.match(/^\d+-\d+$/)) {
                        this.battle.gameApp.showConfirm(`[${text}] 구역으로 이동하시겠습니까?`, () => {
                            const [c, s] = text.split('-').map(Number);
                            this.battle.isBattleEnded = true;
                            const party = (this.battle.gameApp.prepState && this.battle.gameApp.prepState.party) ? this.battle.gameApp.prepState.party : this.battle.gameApp.gameState.heroes.map(h => ({ hero: h }));
                            this.battle.gameApp.startBattle(c, s, party);
                        });
                    } else {
                        this.battle.gameApp.showConfirm("🌀 다른 지역으로 이동하시겠습니까?", () => {
                            if (this.battle.gameApp.townSystem.openPortal) this.battle.gameApp.townSystem.openPortal();
                            else this.battle.gameApp.showAlert("이동 가능한 지역이 없습니다.");
                        });
                    }
                    return;
                }

                if (bKey === 'CHEST') {
                    const chestKey = `CHEST_${this.battle.chapter}_${this.battle.stage}_${unit.q}_${unit.r}`;
                    if (this.battle.gameApp.gameState.collectedObjects.includes(chestKey)) {
                        this.battle.showFloatingText(unit, "빈 상자", "#aaa"); delete cell.building; return;
                    }
                    const lootString = cell.building.text;
                    if (!lootString) { this.battle.showFloatingText(unit, "빈 상자", "#aaa"); return; }
                    this.battle.log(`📦 보물상자를 열었습니다!`, 'log-item');
                    if (lootString.startsWith('BOX') || lootString.startsWith('LOOT') || lootString.startsWith('TIER') || lootString === 'POTION') {
                        const pickedId = this.battle.rollLoot(lootString, unit);
                        if (pickedId) this.battle.lootItem(pickedId, unit);
                        else this.battle.showFloatingText(unit, "꽝...", "#888");
                    } else {
                        const itemIds = lootString.split(',');
                        itemIds.forEach(rawId => {
                            const finalId = rawId.trim();
                            if (finalId) this.battle.lootItem(finalId, unit);
                        });
                    }
                    this.battle.gameApp.gameState.collectedObjects.push(chestKey);
                    this.battle.gameApp.saveGame();
                    delete cell.building;
                    return;
                }

                if (bKey === 'EXIT_POINT' || bKey === 'START_POINT') {
                    const enemiesAlive = this.battle.units.some(u => u.team === 1 && u.curHp > 0);
                    if (!this.battle.isPeaceful && enemiesAlive) { this.battle.gameApp.showAlert(`⛔ 적이 남아있어 이동할 수 없습니다!`); return; }
                    let targetChap = this.battle.chapter, targetStage = this.battle.stage;
                    const text = cell.building.text;
                    if (text && text.match(/^\d+-\d+$/)) { [targetChap, targetStage] = text.split('-').map(Number); } 
                    else {
                        if (bKey === 'EXIT_POINT') targetStage++;
                        else if (bKey === 'START_POINT') {
                            const memory = this.battle.gameApp.gameState.returnPoint;
                            if (memory && (memory.chapter !== this.battle.chapter || memory.stage !== this.battle.stage)) { targetChap = memory.chapter; targetStage = memory.stage; } 
                            else targetStage--;
                        }
                    }
                    if (targetStage < 0) return;
                    const moveMsg = (bKey === 'EXIT_POINT') ? "다음 지역으로" : "이전 지역으로";
                    this.battle.gameApp.showConfirm(`${moveMsg} 이동하시겠습니까?`, () => {
                        this.battle.isBattleEnded = true;
                        const isForward = (bKey === 'EXIT_POINT');
                        const skipReward = this.battle.isPeaceful || !isForward;
                        if (isForward) this.battle.gameApp.gameState.returnPoint = { chapter: this.battle.chapter, stage: this.battle.stage };
                        this.battle.gameApp.onBattleEnd(true, false, skipReward, { chapter: targetChap, stage: targetStage });
                    });
                    return;
                }

                if (bInfo && bInfo.type === 'shop') {
                    this.battle.gameApp.showConfirm(`${bInfo.name}을(를) 이용하시겠습니까?`, () => this.battle.gameApp.townSystem.openShop(bInfo.shopType || 'all')); return;
                }
                if (bKey === 'TEMPLE' || (bInfo && bInfo.action === 'skill')) {
                    this.battle.gameApp.showConfirm("신전에 입장하시겠습니까?", () => this.battle.gameApp.townSystem.openTemple()); return;
                }
                if (bKey === 'BLACKSMITH' || (bInfo && bInfo.action === 'upgrade')) {
                    this.battle.gameApp.showConfirm("대장간을 이용하시겠습니까?", () => this.battle.gameApp.townSystem.openShop('weapon')); return;
                }
                if (bInfo && bInfo.action === 'rest') {
                    this.battle.gameApp.showConfirm("휴식하시겠습니까?", () => this.battle.gameApp.townSystem.openInn()); return;
                }
                if (bInfo && bInfo.action === 'recruit') {
                    this.battle.gameApp.showConfirm("입장하시겠습니까?", () => this.battle.gameApp.townSystem.openTavern()); return;
                }
            }
        }
    }

    detectHiddenObjects(unit) {
        unit.isDiscoverySignaling = false;
        const neighbors = this.battle.grid.getNeighbors(unit);
        let nearbyFound = false;

        neighbors.forEach(n => {
            const nearbyObj = this.battle.hiddenObj.find(o => o.q === n.q && o.r === n.r);
            if (nearbyObj) {
                const totalInt = Formulas.getDerivedStat(unit, 'int', true);
                const totalLuk = Formulas.getDerivedStat(unit, 'luk', true);
                if (totalInt >= 20 || totalLuk >= 15) {
                    nearbyObj.detected = true; 
                    this.triggerSparkle(nearbyObj);
                    nearbyFound = true;
                }
            }
        });
        if (nearbyFound) unit.isDiscoverySignaling = true;
        this.battle.updateUnitOverlayPosition(unit); 
    }

    triggerSparkle(obj) { 
        this.battle.showFloatingText({q: obj.q, r: obj.r}, "✨✨✨", "#ffffaa"); 
    }

    // =========================================================================
    // ⭐ [신규] 연금술사 Phase 3 - 지형 연성 및 환경 상호작용 (Environment Transmuting)
    // =========================================================================

    /**
     * 특정 헥스의 지형을 한시적으로 변이시키거나 고도(높이)를 조작합니다.
     * @param {number} q 헥스 q좌표
     * @param {number} r 헥스 r좌표
     * @param {object} options { newKey: 변이될 지형키, heightMod: 고도 가감치, duration: 유지턴수 }
     */
    transmuteTerrain(q, r, options = {}) {
        const keyStr = `${q},${r}`;
        const cell = this.battle.grid.terrainMap.get(keyStr);
        if (!cell) return;

        if (!this.battle.transmutedTerrains) this.battle.transmutedTerrains = [];
        let existing = this.battle.transmutedTerrains.find(t => t.q === q && t.r === r);

        // 이미 연성된 타일이라면 원본 데이터를 보존하면서 덮어쓰기
        if (!existing) {
            existing = {
                q, r,
                originalKey: cell.key,
                originalH: cell.h || 0,
                duration: options.duration || 2,
                // ⭐ 링크 옵션 저장
                linkUnitId: options.linkUnitId || null
            };
            this.battle.transmutedTerrains.push(existing);
        } else {
            existing.duration = Math.max(existing.duration, options.duration || 2);
        }

        // 지형 속성 및 고도 변경
        if (options.newKey) cell.key = options.newKey;
        if (options.heightMod !== undefined) cell.h = existing.originalH + options.heightMod;

        this.battle.showFloatingText({q, r}, "연성!", "#dd88ff");

        // 🌟 기둥 연성 등 고저차 변동 시 그 위에 있는 유닛 강제 승강 연출
        const occupant = this.battle.getUnitAt(q, r);
        if (occupant) {
            occupant.visualPos = null; // 3D 좌표 캐시 초기화
            if (this.battle.updateUnitOverlayPosition) this.battle.updateUnitOverlayPosition(occupant);
            
            if (options.heightMod !== undefined && options.heightMod !== 0) {
                const dirStr = options.heightMod > 0 ? '솟아올라' : '가라앉아';
                this.battle.log(`⛰️ 지형이 ${dirStr} ${occupant.name}의 고도가 변경되었습니다!`, "log-system");
                this.battle.triggerShakeAnimation(occupant);
            }
        }
        
        // ⭐ [수정됨] 유닛(occupant) 유무와 관계없이 무조건 지형 갱신 로직 실행
        this.battle.grid.setTerrain(q, r, { key: cell.key, h: cell.h });
        
        // 렌더링 강제 업데이트
        if (this.battle.forceRenderMap) {
            this.battle.forceRenderMap();
        } else if (this.battle.handleResize) {
            this.battle.handleResize(); 
        }
    }

    /**
     * 변이되었던 지형을 원상태로 복구합니다.
     */
    revertTerrain(q, r) {
        const keyStr = `${q},${r}`;
        const cell = this.battle.grid.terrainMap.get(keyStr);
        if (!cell) return;

        if (!this.battle.transmutedTerrains) return;
        const index = this.battle.transmutedTerrains.findIndex(t => t.q === q && t.r === r);
        
        if (index !== -1) {
            const record = this.battle.transmutedTerrains[index];
            cell.key = record.originalKey;
            cell.h = record.originalH;
            
            this.battle.transmutedTerrains.splice(index, 1);

            const occupant = this.battle.getUnitAt(q, r);
            if (occupant) {
                occupant.visualPos = null;
                if (this.battle.updateUnitOverlayPosition) this.battle.updateUnitOverlayPosition(occupant);
            }
            
            // ⭐ [수정됨] 원상 복구 시에도 렌더링 캐시를 초기화하고 화면을 다시 그림
            this.battle.grid.setTerrain(q, r, { key: cell.key, h: cell.h });
            
            if (this.battle.forceRenderMap) {
                this.battle.forceRenderMap();
            } else if (this.battle.handleResize) {
                this.battle.handleResize(); 
            }
        }
    }

    processEnvironmentTurns() {
        if (!this.battle.transmutedTerrains) return;
        
        for (let i = this.battle.transmutedTerrains.length - 1; i >= 0; i--) {
            const t = this.battle.transmutedTerrains[i];
            
            // ⭐ [신규] 액체 응고 기믹: 링크된 유닛의 빙결이 풀렸는지 즉각 검사
            let forceRevert = false;
            if (t.linkUnitId && this.battle.grid.getTerrain(t.q, t.r) === 'ICE') {
                const linkedUnit = this.battle.units.find(u => u.id === t.linkUnitId);
                // 유닛이 죽었거나 빙결(STAT_FREEZE)이 풀렸다면?
                if (!linkedUnit || linkedUnit.curHp <= 0 || !this.battle.hasStatus(linkedUnit, 'STAT_FREEZE')) {
                    forceRevert = true;
                    this.battle.log(`🧊 얼음이 깨지며 지형도 원래대로 돌아옵니다!`, "log-system");
                }
            }

            t.duration--;
            
            if (t.duration <= 0 || forceRevert) {
                this.revertTerrain(t.q, t.r);
                if (!forceRevert) this.battle.log(`⛰️ 연성 유지 시간이 지나 지형이 원래대로 복구되었습니다.`, "log-system");
            }
        }
    }

    /**
     * 전투 중 원소 마법 피격 시 호출되어 환경 상호작용(폭발, 응고, 진화 등)을 처리합니다.
     * @param {number} q 헥스 q좌표
     * @param {number} r 헥스 r좌표
     * @param {string} atkType 공격 속성 (DMG_FIRE 등)
     */
    checkEnvironmentalReaction(q, r, atkType) {
        const keyStr = `${q},${r}`;
        const cell = this.battle.grid.terrainMap.get(keyStr);
        if (!cell) return;

        const isFire = atkType.includes('FIRE');
        const isWaterIce = atkType.includes('WATER') || atkType.includes('ICE');

        // 반응 1: 기름(Grease) + 화염(Fire) = 화염지 폭발(BURN_GND)
        if (isFire && cell.key === 'ZONE_GREASE') {
            this.transmuteTerrain(q, r, { newKey: 'BURN_GND', duration: 3 });
            this.battle.log(`🔥 기름이 불길과 만나 거대한 화염지로 폭발했습니다!`, "log-dmg");
            
            const occupant = this.battle.getUnitAt(q, r);
            if (occupant && this.battle.skillProcessor) {
                this.battle.skillProcessor.applyStatus(occupant, { type: 'STAT_BURN', val: 1, duration: 2, prob: 100 });
            }
            // 여기서도 안전장치로 한번 더 호출
            this.battle.grid.setTerrain(q, r, { key: cell.key, h: cell.h });
            if (this.battle.handleResize) this.battle.handleResize(); 
        }
        
        // 반응 2: 화염지(BURN_GND) + 물/얼음 = 진화(원상복구)
        else if (isWaterIce && cell.key === 'BURN_GND') {
            this.revertTerrain(q, r);
            this.battle.log(`💦 쏟아진 수분과 냉기가 화염지의 불길을 진압했습니다.`, "log-system");
        }
    }
}