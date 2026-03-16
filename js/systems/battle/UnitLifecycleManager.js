import { STAGE_DATA, CLASS_DATA, SKILL_DATABASE } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';

export class UnitLifecycleManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    initUnits(chapter, stage) {
        const stageInfo = STAGE_DATA[chapter] && STAGE_DATA[chapter][stage];
        const stageKey = `${this.battle.chapter}-${this.battle.stage}`;
        const isCleared = this.battle.gameApp.gameState.clearedStages && this.battle.gameApp.gameState.clearedStages.includes(stageKey);

        let idCounter = 1;
        const occupied = new Set();
        let myTeamData = [];
        
        if (this.battle.customParty && this.battle.customParty.length > 0) {
            myTeamData = this.battle.customParty;
        } else {
            const allHeroes = this.battle.gameApp.gameState.heroes;
            myTeamData = allHeroes.length > 0 ? allHeroes.slice(0, 9).map(h => ({ hero: h, q: null, r: null })) : [];
        }

        const HERO_BASE_COL = 7;
        const ENEMY_BASE_COL = 14;

        // ⭐ 1. spawn 함수가 targetLevel(지정 레벨)을 받을 수 있도록 파라미터 추가
        const spawn = (entryData, team, fixedQ = null, fixedR = null, targetLevel = null) => {
            if (!entryData || (team === 0 && !entryData.hero)) return;
            
            // ⭐ 깊은 복사(Deep Copy)
            let unit = (team === 0) ? JSON.parse(JSON.stringify(entryData.hero)) : JSON.parse(JSON.stringify(entryData));
            
            // ⭐ 2. 스케일링 엔진이 돌아가기 전에, 기획자가 지정한 레벨을 몬스터에게 강제 주입!
            if (targetLevel !== null) {
                unit.level = targetLevel;
            }

            if (team === 0) unit.originalHero = entryData.hero;
            
            if (unit.skills) unit.skills = unit.skills.filter(s => s !== null && s !== undefined && typeof s === 'object');
            if (unit.skillIds) unit.skillIds = unit.skillIds.filter(id => id !== null && id !== undefined);
            
            if (unit.equippedSkills) {
                unit.equippedSkills = unit.equippedSkills.map(id => id === undefined ? null : id);
                while (unit.equippedSkills.length < 6) unit.equippedSkills.push(null);
                if (unit.equippedSkills.length > 6) unit.equippedSkills = unit.equippedSkills.slice(0, 6);
            }

            let q, r;
            if (fixedQ != null && fixedR != null) {
                q = Number(fixedQ); r = Number(fixedR);
            } else {
                if (team === 0) {
                    const ret = this.battle.gameApp.gameState.returnPoint;
                    if (ret && ret.chapter == chapter && ret.stage == stage) {
                        q = Number(ret.q); r = Number(ret.r);
                        if (idCounter > 1) {
                            const offsets = [{dq:0, dr:1}, {dq:-1, dr:1}, {dq:-1, dr:0}, {dq:0, dr:-1}, {dq:1, dr:-1}, {dq:1, dr:0}];
                            const idx = (idCounter - 2) % offsets.length;
                            q += offsets[idx].dq; r += offsets[idx].dr;
                        }
                    }
                    else if (stageInfo && stageInfo.deployment && stageInfo.deployment.length > 0) {
                        const deployIdx = (idCounter - 1) % stageInfo.deployment.length;
                        const coord = stageInfo.deployment[deployIdx].split(',');
                        q = Number(coord[0]); r = Number(coord[1]);
                    }
                    else if (stageInfo && stageInfo.structures) {
                        const startStruct = stageInfo.structures.find(s => s.startsWith('START_POINT'));
                        if (startStruct) {
                            const parts = startStruct.split(':');
                            const startQ = Number(parts[1]); const startR = Number(parts[2]);
                            const offsets = [{dq:0, dr:0}, {dq:0, dr:1}, {dq:-1, dr:1}, {dq:-1, dr:0}, {dq:0, dr:-1}, {dq:1, dr:-1}, {dq:1, dr:0}];
                            const idx = (idCounter - 1) % offsets.length;
                            q = startQ + offsets[idx].dq; r = startR + offsets[idx].dr;
                        }
                    }
                    if (q === undefined && entryData.hero.q !== undefined && !isNaN(entryData.hero.q)) {
                        q = Number(entryData.hero.q); r = Number(entryData.hero.r);
                    }
                    if (q === undefined) {
                        let col = HERO_BASE_COL;
                        const rowOffsets = [0, 1, -1, 2, -2, 3];
                        const rowIdx = (idCounter - 1) % rowOffsets.length;
                        let row = 6 + rowOffsets[rowIdx];
                        q = col - (row - (row & 1)) / 2; r = row;
                    }
                } else {
                    let col = ENEMY_BASE_COL;
                    const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4];
                    const rowIdx = (idCounter - 1) % rowOffsets.length;
                    let row = 6 + rowOffsets[rowIdx];
                    q = col - (row - (row & 1)) / 2; r = row;
                }
            }

            let safetyCount = 0;
            while (occupied.has(`${q},${r}`)) { 
                r++; safetyCount++;
                if (safetyCount > 50) break; 
            }
            occupied.add(`${q},${r}`);

            unit.q = q; unit.r = r;
            unit.facing = team === 0 ? 0 : 3;
            unit.buffs = [];
            if (!unit.perks) unit.perks = {};
            unit.id = idCounter++;
            unit.team = team;
            unit.shake = 0; unit.bumpX = 0; unit.bumpY = 0;
            unit.stageActionXp = 0;
            
            unit.isDead = false;
            unit.isFullyDead = false;
            unit.isIncapacitated = false;
            unit.deathTimer = undefined;

            if (unit.prevIcon) {
                unit.icon = unit.prevIcon;
                unit.prevIcon = null;
            }
            
            unit.isCharging = false;
            unit.chargingSkill = null;
            unit.chargeTurnLimit = 0;
            unit.isAuraSource = false;
            unit.auraEffects = [];
            unit._delayedDamage = 0;
            unit._endureUsed = false;
            unit.revivedOnce = false;
            unit.hasOverwatched = false; 
            unit.speechText = null;

            // ⭐ 스탯 및 스킬 다이내믹 스케일링 엔진 적용
            this._applyDynamicScaling(unit);

            unit.spriteImg = null;
            this.battle.units.push(unit);
        };

        myTeamData.forEach(d => spawn(d, 0, d.q, d.r));

        if (!isCleared && stageInfo && stageInfo.enemies) {
            stageInfo.enemies.forEach(raw => {
                let entry = raw; let count = 1;
                if (entry.includes('*')) {
                    const p = entry.split('*');
                    entry = p[0]; count = parseInt(p[1]) || 1;
                }
                
                let key = entry; let q = null; let r = null; let targetLevel = null; // ⭐ 레벨 변수 추가
                
                if (entry.includes(':')) {
                    const parts = entry.split(':');
                    key = parts[0]; 
                    q = Number(parts[1]); 
                    r = Number(parts[2]);
                    if (parts[3] !== undefined) targetLevel = Number(parts[3]); // ⭐ 4번째 값(: 뒤에 오는 값)을 레벨로 인식!
                }
                key = key.trim().toUpperCase().replace(/,/g, '');
                
                // 몬스터 데이터 우선 검색, 없으면 클래스 데이터
                const md = window.MONSTER_DATA || (this.battle.gameApp && this.battle.gameApp.monsterData) || {};
                const template = md[key] || CLASS_DATA[key];
                if (template) {
                    // ⭐ 추출한 레벨(targetLevel)을 spawn 함수로 전달
                    for (let i = 0; i < count; i++) spawn(template, 1, q, r, targetLevel); 
                }
            });
        } else if (!isCleared) {
            if (CLASS_DATA['SLIME']) spawn(CLASS_DATA['SLIME'], 1);
        }

        const enemies = this.battle.units.filter(u => u.team === 1);
        this.battle.isPeaceful = (enemies.length === 0);

        if (this.battle.isPeaceful) {
            this.battle.units.forEach(u => u.actionGauge = this.battle.actionGaugeLimit);
            if (this.battle.ui && this.battle.ui.updateSidebarMode) {
                this.battle.ui.updateSidebarMode(this.battle.isPeaceful);
            }
        }
        
        if (this.battle.gameApp.gameState.returnPoint && 
            this.battle.gameApp.gameState.returnPoint.chapter == chapter && 
            this.battle.gameApp.gameState.returnPoint.stage == stage) {
            this.battle.gameApp.gameState.returnPoint = null;
        }

        if (this.battle.environment) {
            this.battle.environment.initNPCs(chapter, stage);
        }
        
        if (!this.battle.isPeaceful) {
            this.battle.units.forEach(u => {
                if (u.skills && u.skills.some(s => s.type === 'PASSIVE' && (u.team !== 0 || (u.equippedSkills && u.equippedSkills.includes(s.id))) && s.effects.some(e => e.type === 'PAS_FIRST_TURN'))) {                    
                    u.actionGauge = this.battle.actionGaugeLimit; 
                    this.battle.log(`⚡ [즉각반응] ${u.name}이(가) 첫 번째 턴을 가져갑니다!`, 'log-skill');
                }
                
                const startBuffPassives = (u.skills || []).filter(s => 
                    s.type === 'PASSIVE' && 
                    (u.team !== 0 || (u.equippedSkills && u.equippedSkills.includes(s.id))) && 
                    s.effects && s.effects.some(e => e.type === 'PAS_START_BUFF')
                );                
                startBuffPassives.forEach(passiveSkill => {
                    const buffEffects = passiveSkill.effects.filter(e => !e.type.startsWith('PAS_'));
                    if (this.battle.skillProcessor && buffEffects.length > 0) {
                        this.battle.log(`✨ [전투 태세] ${u.name}의 [${passiveSkill.name}] 효과 발동!`, 'log-skill');
                        buffEffects.forEach(eff => {
                            this.battle.skillProcessor.processEffect(eff, u, u, u, {}, passiveSkill);
                        });
                    }
                });
            });
        }
    }

    spawnUnit(key, team, q, r, overrides = {}, auraEffects = null) {
        let template = null;
        const md = window.MONSTER_DATA || (this.battle.gameApp && this.battle.gameApp.monsterData) || {};
        if (md[key]) template = md[key];

        let caster = null;
        if (overrides && overrides.casterId) {
            caster = this.battle.units.find(u => u.id === overrides.casterId);
        }

        if (!template) {
            if (key === 'DECOY') template = { name: "미끼", icon: "👤", hp: 100, isWall: false, type: 'OBJECT', spd: 0 };
            else if (key.includes('WALL')) {
                let wName = "장벽", wIcon = "🧱";
                if (key.includes('FIRE')) { wName = "화염벽"; wIcon = "🔥"; }
                else if (key.includes('ICE')) { wName = "빙벽"; wIcon = "🧊"; }
                else if (key.includes('EARTH') || key.includes('STONE')) { wName = "토벽"; wIcon = "🪨"; }
                template = { name: wName, icon: wIcon, hp: 500, isWall: true, type: 'OBJECT', spd: 0 };
            }
            else if (key.includes('ZONE_HEAL')) template = { name: "치유의 성소", icon: "✨", hp: 999, isWall: false, type: 'OBJECT', spd: 0 };
            else if (key.includes('ZONE_IMMUNE')) template = { name: "절대 성역", icon: "🛡️", hp: 999, isWall: false, type: 'OBJECT', spd: 0 };
            else if (key.includes('ZONE_FIRE')) template = { name: "불바다", icon: "🔥", hp: 999, isWall: false, type: 'OBJECT', spd: 0 };
            else if (key === 'ZONE_POISON') template = { name: "독 지대", icon: "☠️", hp: 999, isWall: false, type: 'OBJECT', spd: 0 };
            
            else if (key === 'GOLEM' && caster) {
                const tData = this.battle.grid.getTerrainData(q, r);
                const tKey = tData.key;
                let gType = 'EARTH';
                
                if (['WETLAND', 'SWAMP', 'WATER_SHALLOW', 'WATER_DEEP'].includes(tKey)) gType = 'WATER';
                else if (['SNOWFIELD', 'ICE'].includes(tKey)) gType = 'ICE';
                else if (['DESERT', 'VOLCANO', 'LAVA', 'BURN_GND'].includes(tKey)) gType = 'FIRE';
                else if (tKey === 'POISON_LND') gType = 'POISON';
                else if (tKey === 'CRYSTAL') gType = 'NONE';

                let gName = "어스 골렘", gIcon = "🪨", gEle = "EARTH";
                if (gType === 'WATER') { gName = "아쿠아 골렘"; gIcon = "💧"; gEle = "WATER"; }
                else if (gType === 'ICE') { gName = "아이스 골렘"; gIcon = "🧊"; gEle = "ICE"; }
                else if (gType === 'FIRE') { gName = "파이어 골렘"; gIcon = "🔥"; gEle = "FIRE"; }
                else if (gType === 'POISON') { gName = "베놈 골렘"; gIcon = "☠️"; gEle = "POISON"; } 
                else if (gType === 'NONE') { gName = "크리스탈 골렘"; gIcon = "💎"; gEle = "NONE"; }

                let passives = [{ type: 'PAS_IMMUNE_ALL' }]; 
                if (gType === 'EARTH') passives.push({ type: 'PASSIVE_DEF', val: 0.3 }); 
                else if (gType === 'NONE') passives.push({ type: 'PASSIVE_MAG_DEF', val: 0.3 }); 

                template = {
                    name: gName, icon: gIcon, element: gEle, isWall: false, type: 'SUMMON',
                    hp: caster.hp, mp: 0,
                    str: caster.int, int: 1, vit: caster.vit, 
                    agi: 1, dex: caster.dex, luk: caster.luk, spd: caster.spd,
                    mov: 3, jmp: 1, atkType: 'PHYS',
                    equippedBasic: 'GOLEM_AUTO_ATK',
                    skills: [
                        {
                            id: 'GOLEM_AUTO_ATK', name: '자연의 일격', type: 'ACTIVE', rng: 1, cost: 80, mp: 0,
                            effects: [
                                { type: 'DMG_PHYS', val: 1, prob: 100 },
                                ...(gType === 'POISON' ? [{ type: 'STAT_POISON', val: 1, duration: 2, prob: 100 }] : [])
                            ]
                        },
                        {
                            id: 'GOLEM_PASSIVE', name: '골렘의 신체', type: 'PASSIVE',
                            effects: passives
                        }
                    ],
                    buffs: [{ type: 'BUFF_IMMUNE', duration: 99, name: '상태이상 면역', icon: '🛡️' }]
                };
            }
            else if (key === 'HOMUNCULUS' && caster) {
                template = JSON.parse(JSON.stringify(caster));
                template.name = "호문클루스";
                template.icon = "👻";
                template.isAuraSource = false;
                template.auraEffects = [];
                template.actionGauge = 0; 
                template.curMp = caster.curMp; 
                template.buffs = JSON.parse(JSON.stringify(caster.buffs || [])); 
                template.speechText = null; 
                template.speechTimer = null; 
            }
            else template = { name: "오브젝트", icon: "❓", hp: 1, type: 'OBJECT', spd: 0 };
        }

        let unit = JSON.parse(JSON.stringify(template));
        unit.id = `summon_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        unit.key = key; 
        unit.team = team;
        unit.q = q;
        unit.r = r;

        if (overrides) {
            Object.keys(overrides).forEach(k => {
                if (k === 'hp') { unit.hp = overrides.hp; unit.curHp = overrides.hp; }
                else if (k === 'duration') unit.lifespan = overrides.duration; 
                else unit[k] = overrides[k];
            });
        }

        if (key === 'HOMUNCULUS' && caster) {
            unit.ownerId = caster.id;
            caster.homunculusId = unit.id;
            
            const mpSeal = Math.floor(caster.mp * 0.3);
            caster.mp -= mpSeal;
            caster.curMp = Math.min(caster.curMp, caster.mp);
            caster._mpSealedByHomunculus = mpSeal; 
            
            unit.hp = caster.hp; 
            unit.curHp = unit.hp; 
        }

        unit.isDead = false;
        unit.isFullyDead = false;
        unit.isIncapacitated = false;
        unit.deathTimer = undefined;
        if (unit.curHp === undefined) unit.curHp = unit.hp || 1;
        if (unit.curMp === undefined) unit.curMp = unit.mp || 0;
        unit.actionGauge = 0;
        if (!unit.buffs) unit.buffs = [];

        if (auraEffects && auraEffects.length > 0) {
            unit.auraEffects = auraEffects;
            unit.isAuraSource = true; 
        }

        // ⭐ 스탯 및 스킬 다이내믹 스케일링 엔진 적용
        this._applyDynamicScaling(unit);

        unit.spriteImg = null;
        this.battle.units.push(unit);
        if (!unit.isAuraSource && unit.type !== 'OBJECT') this.battle.log(`${unit.name} 등장!`, 'log-skill');
        this.battle.renderPartyList();
        this.battle.updateCursor();
        
        if (this.battle.ui && this.battle.ui.renderUnitOverlays) {
            this.battle.ui.renderUnitOverlays();
        }
    }

    // =================================================================
    // ⭐ [신규] 다이내믹 스케일링 전담 엔진 (A.I. Scaling Engine)
    // =================================================================
    _applyDynamicScaling(unit) {
        if (unit.type === 'OBJECT') return;

        // 1. 아군 (Team 0): 레벨업 분배 포인트 누적 (기존 로직 유지)
        if (unit.team === 0) {
            if (!unit._levelScaled || unit._levelScaled < unit.level) {
                const startLevel = unit._levelScaled || 1;
                const levelDiff = unit.level - startLevel;
                if (levelDiff > 0) {
                    unit.statPoints = (unit.statPoints || 0) + (levelDiff * 3); 
                    ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(s => {
                        unit[s] = (unit[s] || 10) + levelDiff; 
                    });
                    unit._levelScaled = unit.level; 
                }
            }
        } 
        // 2. 적군 (Team 1): 다이내믹 성장률(Growth) 적용 및 스킬 해금
        else if (unit.team === 1) {
            if (!unit._levelScaled || unit._levelScaled < unit.level) {
                const lv = unit.level || 1;
                
                // 마스터 템플릿인지 확인 (growth 속성이 있는지)
                if (unit.growth) {
                    const levelDiff = lv - 1; // 1레벨 기본 스탯 기준차
                    
                    // A. 성장률 기반 스탯 빚어내기
                    ['hp', 'mp', 'str', 'int', 'vit', 'agi', 'dex', 'luk'].forEach(stat => {
                        if (unit.baseStats && unit[stat] === undefined) {
                            unit[stat] = unit.baseStats[stat] || 10;
                        }
                        if (unit.growth[stat]) {
                            const baseVal = unit.baseStats?.[stat] || unit[stat] || 10;
                            unit[stat] = Math.floor(baseVal + (unit.growth[stat] * levelDiff));
                        }
                    });

                    // B. 레벨 티어별 호칭(이름) 동적 변경
                    if (unit.tierNames) {
                        let bestTier = 1;
                        Object.keys(unit.tierNames).forEach(tierLv => {
                            if (lv >= Number(tierLv) && Number(tierLv) >= bestTier) {
                                bestTier = Number(tierLv);
                            }
                        });
                        unit.name = unit.tierNames[bestTier];
                    }

                    // C. 해금 레벨(Unlock Level) 기반 스킬 장착
                    if (unit.skillPool) {
                        unit.skills = [];
                        unit.skillPool.forEach(sk => {
                            if (lv >= (sk.unlockLv || 1)) {
                                const sData = SKILL_DATABASE[sk.id];
                                if (sData) unit.skills.push(JSON.parse(JSON.stringify({ ...sData, id: sk.id })));
                            }
                        });
                    }
                } 
                
                // 오라 추출 (공통)
                let extractedIds = unit.skillIds ? [...unit.skillIds] : [];
                if (unit.skills) {
                    unit.skills.forEach(s => { 
                        if (s && s.id && !extractedIds.includes(s.id)) extractedIds.push(s.id); 
                    });
                }
                
                if (!unit.auraEffects) unit.auraEffects = [];
                extractedIds.forEach(id => {
                    const s = SKILL_DATABASE[id];
                    if (s && s.type === 'PASSIVE' && s.effects) {
                        const auraAcc = s.effects.find(e => e.type === 'PAS_AURA_DEBUFF_ACC');
                        if (auraAcc) {
                            unit.auraEffects.push({ type: 'DEBUFF_STAT_ACC', val: auraAcc.val, area: auraAcc.rng || 1, target: 'ENEMY_ALL' });
                            unit.isAuraSource = true;
                        }
                    }
                });

                // 기존 구형 데이터 호환 유지
                if (!unit.growth) {
                    let validSkills = [];
                    extractedIds.forEach(id => {
                        if (id && SKILL_DATABASE[id]) {
                            validSkills.push(JSON.parse(JSON.stringify(SKILL_DATABASE[id])));
                        }
                    });
                    if (unit.key !== 'HOMUNCULUS' && unit.key !== 'GOLEM') {
                        unit.skills = validSkills; 
                    }
                }

                unit._levelScaled = unit.level;
            }
        }

        // 3. 파생 스탯(최대 HP/MP) 뻥튀기 재계산
        unit.hp = Formulas.getDerivedStat(unit, 'hp_max', true) || unit.hp;
        unit.mp = Formulas.getDerivedStat(unit, 'mp_max', true) || unit.mp;

        if (unit.team === 0) {
            unit.curHp = (unit.curHp !== undefined && !isNaN(unit.curHp)) ? Math.min(unit.curHp, unit.hp) : unit.hp;
            unit.curMp = (unit.curMp !== undefined && !isNaN(unit.curMp)) ? Math.min(unit.curMp, unit.mp) : unit.mp;
            if(unit.curHp <= 0) unit.curHp = 1;
        } else {
            // 소환/스폰 시 적군은 무조건 풀피/풀마나
            if (unit.curHp === undefined) unit.curHp = unit.hp;
            if (unit.curMp === undefined) unit.curMp = unit.mp;
        }
        
        const spd = Formulas.getDerivedStat(unit, 'spd');
        unit.actionGauge = Math.min(50, spd * 0.5);
    }

    handleDeath(unit, killer = null) {
        if (unit.key === 'WALL_PILLAR') {
            const rider = this.battle.units.find(u => u.q === unit.q && u.r === unit.r && u.id !== unit.id && u.curHp > 0);
            if (rider) {
                if (!unit._isNaturalDeath) {
                    const fallDmg = Math.floor(rider.hp * 0.3);
                    rider.curHp = Math.max(0, rider.curHp - fallDmg);
                    this.battle.showFloatingText(rider, `추락 -${fallDmg}`, "#ff0000");
                    this.battle.log(`💥 기둥이 산산조각 나며 ${rider.name}이(가) 바닥으로 추락합니다! (-${fallDmg})`, 'log-dmg');
                    this.battle.triggerShakeAnimation(rider);
                    
                    if (rider.curHp <= 0) this.handleDeath(rider, killer); 
                } else {
                    this.battle.log(`⛰️ 기둥이 부드럽게 가라앉아 ${rider.name}이(가) 무사히 착지합니다.`, 'log-system');
                }
            }
            if (this.battle.environment && this.battle.environment.revertTerrain) {
                this.battle.environment.revertTerrain(unit.q, unit.r);
            }
        }
        
        const hasEndureBuff = unit.buffs && unit.buffs.find(b =>
            b.type === 'BUFF_ENDURE' || b.type === 'UNBREAKABLE' || b.type === 'BUFF_STAT_SURVIVE'
        );
        const hasEndurePassive = (unit.skills || []).some(s => 
            s.type === 'PASSIVE' && 
            (unit.team !== 0 || (unit.equippedSkills && unit.equippedSkills.includes(s.id))) && 
            s.effects && s.effects.some(e => e.type === 'PASSIVE_ENDURE' || e.type === 'UNBREAKABLE')
        );

        if (unit.type === 'OBJECT' || unit.isWall || (unit.key && unit.key.includes('ZONE'))) {
            if (unit.key === 'WALL_EARTH') {
                const rider = this.battle.units.find(u => u.q === unit.q && u.r === unit.r && u.id !== unit.id && u.curHp > 0);
                if (rider) {
                    const fallDmg = Math.floor(rider.hp * 0.3); 
                    rider.curHp = Math.max(0, rider.curHp - fallDmg);
                    this.battle.showFloatingText(rider, `낙하 -${fallDmg}`, "#ff0000");
                    this.battle.log(`💥 토벽이 붕괴하며 ${rider.name}이(가) 추락했습니다! (-${fallDmg})`, 'log-dmg');
                    this.battle.triggerShakeAnimation(rider);
                    if (rider.curHp <= 0) this.handleDeath(rider, killer); 
                }
            }

            this.battle.showFloatingText(unit, "파괴됨", "#aaaaaa");
            this.battle.units = this.battle.units.filter(u => u.id !== unit.id);
            if (this.battle.ui) this.battle.ui.renderUnitOverlays(); 
            return; 
        }
        
        if ((hasEndureBuff || hasEndurePassive) && !unit._endureUsed) {
            unit.curHp = 1;
            unit._endureUsed = true; 
            if (hasEndureBuff) unit.buffs = unit.buffs.filter(b => b !== hasEndureBuff); 
            
            this.battle.showFloatingText(unit, "ENDURE!", "#ffffff");
            this.battle.log(`🛡️ ${unit.name} 불굴의 의지로 생존!`, 'log-system');
            this.battle.renderPartyList();
            if (this.battle.viewingUnit === unit) this.battle.updateStatusPanel();
            return; 
        }

        const revivePassive = (unit.skills || []).find(s => 
            s.type === 'PASSIVE' && 
            (unit.team !== 0 || (unit.equippedSkills && unit.equippedSkills.includes(s.id))) && 
            s.effects && s.effects.some(e => e.type === 'PASSIVE_REVIVE_SELF')
        );

        if (revivePassive && !unit.revivedOnce) {
            unit.revivedOnce = true; 
            const eff = revivePassive.effects.find(e => e.type === 'PASSIVE_REVIVE_SELF');
            const recoverPct = eff ? eff.val : 0.5;
            unit.curHp = Math.max(1, Math.floor(unit.hp * recoverPct));
            this.battle.showFloatingText(unit, "RESURRECT!", "#ffdd00");
            this.battle.log(`✝️ ${unit.name} 자가 부활!`, 'log-heal');
            this.battle.triggerShakeAnimation(unit); 
            this.battle.renderPartyList();
            if (this.battle.viewingUnit === unit) this.battle.updateStatusPanel();
            return; 
        }
        
        if (unit.team === 0 && !unit.isFullyDead) {
            if (unit.isIncapacitated) return; 
            
            unit.isIncapacitated = true;
            unit.deathTimer = 3; 
            unit.buffs = []; 
            unit.isCharging = false;
            unit.chargingSkill = null;
            unit.actionGauge = 0; 
            
            this.battle.log(`⚠️ ${unit.name}이(가) 치명상을 입고 쓰러졌습니다! (사망까지 ${unit.deathTimer}턴)`, 'log-bad');
            this.battle.showFloatingText(unit, "전투 불능", "#ff5555");
            
            if (this.battle.ui) this.battle.ui.renderUnitOverlays(); 
            this.battle.checkBattleEnd(); 
            return; 
        }

        unit.isFullyDead = true; 
        unit.isIncapacitated = false; 
        
        this.battle.log(`☠ ${unit.name} 사망`, 'log-dmg'); 

        unit.isDead = true;
        unit.actionGauge = -9999;
        unit.buffs = []; 
        unit.isCharging = false;
        unit.chargingSkill = null;
        if (!unit.prevIcon) unit.prevIcon = unit.icon;
        
        unit.icon = "🪦"; 

        if (this.battle.grid && this.battle.grid.updateUnitMap) this.battle.grid.updateUnitMap();
        if (this.battle.ui && this.battle.ui.renderUnitOverlays) this.battle.ui.renderUnitOverlays(); 

        const onDeathPassive = (unit.skills || []).find(s => 
            s.type === 'PASSIVE' && 
            (unit.team !== 0 || (unit.equippedSkills && unit.equippedSkills.includes(s.id))) && 
            s.effects && s.effects.some(e => e.type === 'PAS_ONDEATH')
        );        
        if (onDeathPassive && onDeathPassive.effects.length > 1) {
            this.battle.log(`🕊️ [유언] ${unit.name}의 패시브가 발동합니다!`, 'log-skill');
            const triggerEff = onDeathPassive.effects.find(e => !e.type.startsWith('PAS_'));
            if (triggerEff && this.battle.skillProcessor) {
                this.battle.skillProcessor.processEffect(triggerEff, {q: unit.q, r: unit.r}, null, unit, {}, onDeathPassive);
            }
        }

        if (killer && killer.curHp > 0) {
            const onKillPassive = (killer.skills || []).find(s => 
                s.type === 'PASSIVE' && 
                (killer.team !== 0 || (killer.equippedSkills && killer.equippedSkills.includes(s.id))) && 
                s.effects && s.effects.some(e => e.type === 'PAS_ONKILL')
            );            
            if (onKillPassive && onKillPassive.effects.length > 1) {
                this.battle.log(`📈 [처치 보상] ${killer.name}의 패시브가 발동합니다!`, 'log-skill');
                const triggerEff = onKillPassive.effects.find(e => !e.type.startsWith('PAS_'));
                if (triggerEff && this.battle.skillProcessor) {
                    this.battle.skillProcessor.processEffect(triggerEff, killer, null, killer, {}, onKillPassive);
                }
            }
        }

        if (unit.ownerId) {
            const caster = this.battle.units.find(u => u.id === unit.ownerId);
            if (caster) {
                caster.homunculusId = null;
                if (caster._mpSealedByHomunculus) {
                    caster.mp += caster._mpSealedByHomunculus;
                    caster._mpSealedByHomunculus = 0;
                }
                if (this.battle.skillProcessor) {
                    this.battle.skillProcessor.applyStatus(caster, {type: 'CC_STUN', val: 1, duration: 1}, null);
                }
                this.battle.log(`👻 호문클루스가 파괴되어 ${caster.name}이(가) 정신적 충격(기절)을 받습니다!`, 'log-bad');
            }
        }
        
        if (unit.homunculusId) {
            const homun = this.battle.units.find(u => u.id === unit.homunculusId);
            if (homun && homun.curHp > 0) {
                homun.curHp = 0;
                this.battle.log(`🌌 연결된 생명선이 끊어져 호문클루스도 함께 소멸합니다!`, 'log-system');
                this.handleDeath(homun, killer);
            }
        }
        
        if (unit.team === 1 && !this.battle.isTestMode) { 
            let goldDrop = (unit.level || 1) * 10 + Math.floor(Math.random() * 5);
            if (this.battle.goldMod > 1.0) goldDrop = Math.floor(goldDrop * this.battle.goldMod);
            
            this.battle.gameApp.gameState.gold += goldDrop;
            this.battle.showFloatingText(unit, `+${goldDrop} G`, '#ffd700');

            if (unit.grade === 'BOSS' || unit.grade === 'ELITE') {
                const renownDrop = unit.grade === 'BOSS' ? 10 : 2;
                this.battle.gameApp.gameState.renown += renownDrop;
                this.battle.showFloatingText(unit, `+${renownDrop} 🎖️`, '#ff9955');
            }

            if (Math.random() < 0.01) {
                this.battle.gameApp.gameState.ancientCoin += 1;
                this.battle.showFloatingText(unit, `+1 🧿`, '#00ffff');
                this.battle.log(`✨ 희귀한 고대 주화를 발견했습니다!`, 'log-item');
            }

            if (unit.drops && unit.drops.length > 0) {
                unit.drops.forEach(drop => {
                    const chance = drop.rate * (this.battle.dropMod || 1.0);
                    if (Math.random() < chance) this.battle.lootItem(drop.id, unit);
                });
            }
        } 
        
        this.battle.checkBattleEnd();
        this.battle.renderPartyList(); 
        if(!this.battle.isTestMode && this.battle.gameApp.updateResourceDisplay) this.battle.gameApp.updateResourceDisplay();
    }
}