import { CLASS_DATA, SKILL_DATABASE } from '../../data/index.js';

export class SandboxManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.aiEnabled = false; 
        this.spawnTarget = null; 
        this.spawnTeam = 1; 
    }

    initTestBattlefield() {
        this.battle.isTestMode = true;
        this.battle.isBattleEnded = false;
        
        const sandboxMap = this.generateSandboxMap(15, 15);
        this.battle.grid.mapCols = 15;
        this.battle.grid.mapRows = 15;
        this.battle.grid.initGrid();
        
        this.battle.grid.terrainMap.clear();
        for (const [pos, val] of Object.entries(sandboxMap)) {
            this.battle.grid.terrainMap.set(pos, val);
        }

        this.battle.units = [];
        this.battle.traps = [];
        this.battle.currentUnit = null; 

        this.patchSystemsForSandbox();

        this.battle.cameraManager.centerCameraOnHeroes(); 
        this.renderSandboxUI();
        this.battle.log("🛠️ 샌드박스 진입 완료! 우측 톱니바퀴(⚙️)를 눌러 유닛을 배치하세요.", "log-system");
    }

    patchSystemsForSandbox() {
        if (this.battle.inputSystem && typeof this.battle.inputSystem.handleClick === 'function') {
            const originalClick = this.battle.inputSystem.handleClick.bind(this.battle.inputSystem);
            this.battle.inputSystem.handleClick = (hex) => {
                if (this.spawnTarget) {
                    this.executeSandboxAction(hex);
                } else {
                    if (!this.battle.currentUnit) return; 
                    originalClick(hex);
                }
            };
        }

        if (this.battle.ui && typeof this.battle.ui.renderPartyList === 'function') {
            const originalRenderParty = this.battle.ui.renderPartyList.bind(this.battle.ui);
            this.battle.ui.renderPartyList = () => {
                originalRenderParty(); 
                
                const heroes = this.battle.units.filter(u => u.team === 0 && u.type !== 'OBJECT' && !u.isAuraSource);
                const cards = document.querySelectorAll('.party-unit');
                
                cards.forEach((card, idx) => {
                    const u = heroes[idx];
                    if (u) {
                        card.onclick = () => {
                            this.battle.viewingUnit = u;
                            if (u.curHp > 0) {
                                this.battle.currentUnit = u;          
                                this.battle.centerCameraOnUnit(u);    
                                this.battle.calcReachable();
                                this.battle.updateFloatingControls(); 
                                this.battle.updateStatusPanel();
                            }
                            
                            // 좌측 영웅 클릭 시 드롭다운과 스킬툴 동시 업데이트
                            const heroSelect = document.getElementById('sb-hero-select');
                            if (heroSelect) heroSelect.value = u.id;
                            this.renderSkillTool(u);

                            this.battle.ui.renderPartyList(); 
                        };
                    }
                });
            };
        }
    }

    generateSandboxMap(cols, rows) {
        const map = {};
        for(let r = 0; r < rows; r++) {
            for(let c = 0; c < cols; c++) {
                const q = c - Math.floor(r/2);
                let key = 'PLAIN';
                if (r < 3) key = 'WATER_SHALLOW';       
                else if (r > 11) key = 'LAVA';          
                else if (c < 3) key = 'SNOWFIELD';      
                else if (c > 11) key = 'POISON_LND';    
                else if (r === 7 && c === 7) key = 'CRYSTAL'; 
                else if ((r === 4 || r === 10) && (c > 3 && c < 11)) key = 'FOREST'; 
                map[`${q},${r}`] = { key: key, h: 0 };
            }
        }
        return map;
    }

    renderSandboxUI() {
        const panelId = 'sandbox-panel-wrapper';
        let wrapper = document.getElementById(panelId);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = panelId;
            document.body.appendChild(wrapper);
        }

        wrapper.style.cssText = `
            position: fixed; top: 10px; right: 330px; z-index: 10000; 
            display: flex; align-items: flex-start; font-family: 'Noto Sans KR', sans-serif;
        `;

        wrapper.innerHTML = `
            <button id="sb-toggle-btn" style="
                background: #c5a059; border: 2px solid #fff; border-radius: 8px 0 0 8px;
                padding: 10px; font-size: 20px; cursor: pointer; color: #000;
                box-shadow: -2px 2px 5px rgba(0,0,0,0.5); z-index: 10001; transition: 0.2s;
            ">⚙️</button>

            <div id="sb-main-panel" style="
                width: 280px; background: rgba(20, 20, 30, 0.95); border: 2px solid #55a; 
                border-radius: 0 8px 8px 8px; padding: 15px; color: #fff; 
                box-shadow: 0 0 15px rgba(0,0,0,0.8); display: block;
                max-height: 85vh; overflow-y: auto;
            ">
                <h3 style="margin:0 0 10px 0; color:#5cf; text-align:center;">🛠️ 샌드박스 툴</h3>
                
                <div style="margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">
                    <div style="font-size:12px; color:#fc5; margin-bottom:5px;">[ 1. 유닛/몬스터 클릭 배치 ]</div>
                    <select id="sb-spawn-select" style="width:100%; padding:5px; background:#111; color:#fff; border:1px solid #555; margin-bottom:5px;">
                        <option value="">-- 배치할 대상을 고르세요 --</option>
                        <optgroup label="[ 아군 영웅 ]">
                            <option value="WARRIOR">전사 (Warrior)</option>
                            <option value="KNIGHT">기사 (Knight)</option>
                            <option value="ARCHER">궁수 (Archer)</option>
                            <option value="ROGUE">도적 (Rogue)</option>
                            <option value="SORCERER">마법사 (Sorcerer)</option>
                            <option value="CLERIC">클레릭 (Cleric)</option>
                            <option value="MARTIAL ARTIST">무투가 (Matial artist)</option>
                            <option value="BARD">음유시인 (Bard)</option>
                            <option value="DANCER">무희 (Dancer)</option>
                            <option value="ALCHEMIST">연금술사 (Alchemist)</option>
                        </optgroup>
                        <optgroup label="[ 적군 몬스터 ]">
                            <option value="SLIME">슬라임 (테스트 샌드백)</option>
                            <option value="GOBLIN">고블린</option>
                            <option value="ORC">오크</option>
                            <option value="BAT">박쥐</option>
                            <option value="WOLF">늑대</option>
                            <option value="SPIDER">독거미</option>
                            <option value="SKELETON">스켈레톤</option>
                            <option value="ZOMBIE">좀비</option>
                            <option value="GARGOYLE">가고일</option>
                            <option value="GOLEM">골렘</option>
                            <option value="DRAGON">드래곤</option>
                        </optgroup>
                    </select>
                    <button id="sb-btn-place" style="width:100%; padding:6px; background:#252; color:#fff; border:1px solid #5a5; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">🎯 대상 선택 후 맵 클릭</button>
                    
                    <div style="display:flex; gap:5px; margin-top:5px;">
                        <button id="sb-btn-clear-enemy" style="flex:1; padding:6px; background:#522; color:#fff; border:1px solid #a55; cursor:pointer; border-radius:4px; font-size:11px;">🧹 적 전체 삭제</button>
                        <button id="sb-btn-clear-hero" style="flex:1; padding:6px; background:#225; color:#fff; border:1px solid #55a; cursor:pointer; border-radius:4px; font-size:11px;">🧹 영웅 전체 삭제</button>
                    </div>
                </div>

                <div style="margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">
                    <div style="font-size:12px; color:#fc5; margin-bottom:5px;">[ 2. 영웅 능력치 조작 ]</div>
                    <select id="sb-hero-select" style="width:100%; padding:5px; background:#111; color:#fff; border:1px solid #555; margin-bottom:5px;">
                        <option value="">-- 맵에 영웅이 없습니다 --</option>
                    </select>
                    <button id="sb-btn-maxout" style="width:100%; padding:6px; background:linear-gradient(90deg, #528, #82a); color:#fff; border:1px solid #a5f; cursor:pointer; border-radius:4px; font-weight:bold; font-size:11px;">
                        ✨ 선택 영웅 Lv.99 (스킬은 장착 안됨)
                    </button>
                </div>

                <div style="margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">
                    <div id="sb-skill-title" style="font-size:12px; color:#fc5; margin-bottom:5px;">[ 3. 스킬 장착/해제 툴 ] (0 / 6)</div>
                    <div id="sb-skill-container" style="max-height:180px; overflow-y:auto; background:#111; padding:8px; border:1px solid #555; font-size:11px; border-radius:4px;">
                        좌측에서 영웅을 클릭하면 스킬을 관리할 수 있습니다.
                    </div>
                </div>

                <div style="margin-bottom:15px;">
                    <div style="font-size:12px; color:#fc5; margin-bottom:5px;">[ 4. 전투 환경 제어 ]</div>
                    <button id="sb-btn-ai" style="width:100%; padding:6px; background:${this.aiEnabled ? '#a33' : '#3a3'}; color:#fff; border:1px solid #fff; cursor:pointer; border-radius:4px; font-weight:bold; margin-bottom:5px; font-size:11px;">
                        ${this.aiEnabled ? '🤖 적 AI: ON (공격함)' : '🛑 적 AI: OFF (가만히 있음)'}
                    </button>
                    <button id="sb-btn-fill-mp" style="width:100%; padding:6px; background:#258; color:#fff; border:1px solid #5af; cursor:pointer; border-radius:4px; margin-bottom:5px; font-size:11px;">💧 아군 전원 상태 풀회복</button>
                </div>

                <button id="sb-btn-exit" style="width:100%; padding:8px; background:#334; color:#fff; border:1px solid #668; cursor:pointer; border-radius:4px; font-weight:bold; font-size:12px;">🚪 마을로 돌아가기</button>
            </div>
        `;

        this.bindSandboxEvents();
        this.updateHeroSelect();
    }

    // ⭐ [핵심 1] 범주 스킬 묶음 렌더링 및 6칸 장착 시스템 적용
    renderSkillTool(hero) {
        const container = document.getElementById('sb-skill-container');
        const titleEl = document.getElementById('sb-skill-title');
        if (!container) return;

        if (!hero || hero.team !== 0) {
            container.innerHTML = "<span style='color:#aaa'>좌측 파티 목록이나 맵에서 아군 영웅을 클릭하세요.</span>";
            if(titleEl) titleEl.innerText = `[ 3. 스킬 장착/해제 툴 ] (0 / 6 장착됨)`;
            return;
        }

        if (!hero.skills || hero.skills.length === 0) {
            container.innerHTML = "<span style='color:#aaa'>보유 중인 스킬이 없습니다.</span>";
            if(titleEl) titleEl.innerText = `[ 3. 스킬 장착/해제 툴 ] (0 / 6 장착됨)`;
            return;
        }

        // 스킬 데이터 분리 (범주 스킬 그룹화 vs 일반 개별 스킬)
        const skillGroups = {};
        const individualSkills = [];

        hero.skills.forEach(s => {
            if (s.category && s.category.trim() !== "") {
                if (!skillGroups[s.category]) {
                    skillGroups[s.category] = { category: s.category, skills: [], icon: '📦' };
                }
                skillGroups[s.category].skills.push(s);
            } else {
                individualSkills.push(s);
            }
        });

        const equippedIds = hero.equippedSkills || [];
        let currentCount = 0;

        // 그룹 스킬 체크 확인 (그룹 내 스킬이 모두 장착되어 있으면 체크된 것으로 간주)
        const groupStates = {};
        Object.values(skillGroups).forEach(g => {
            const isEquipped = g.skills.every(s => equippedIds.includes(s.id));
            groupStates[g.category] = isEquipped;
            if (isEquipped) currentCount++;
        });

        // 개별 스킬 체크 확인
        const indStates = {};
        individualSkills.forEach(s => {
            const isEquipped = equippedIds.includes(s.id);
            indStates[s.id] = isEquipped;
            if (isEquipped) currentCount++;
        });

        if(titleEl) titleEl.innerText = `[ 3. 스킬 장착/해제 툴 ] (${currentCount} / 6 장착됨)`;

        let html = '';

        // 범주 스킬 HTML 렌더링
        Object.values(skillGroups).forEach(g => {
            const isEquipped = groupStates[g.category];
            const bgCol = isEquipped ? 'rgba(50, 150, 250, 0.3)' : 'transparent';
            const borderCol = isEquipped ? '#5af' : '#444';
            
            html += `
                <label style="display:flex; align-items:center; margin-bottom:5px; cursor:pointer; padding:6px; background:${bgCol}; border-radius:4px; border:1px solid ${borderCol};">
                    <input type="checkbox" class="sb-skill-checkbox" data-category="${g.category}" ${isEquipped ? 'checked' : ''} style="cursor:pointer; margin-right:8px;">
                    <span style="color:${isEquipped ? '#fff' : '#aaa'}; font-weight:${isEquipped ? 'bold' : 'normal'}; flex-grow:1;">
                        [범주: ${g.category}] 스킬 세트 
                    </span>
                    <span style="font-size:9px; color:#aaa; background:#222; padding:2px 4px; border-radius:3px;">${g.skills.length}개</span>
                </label>
            `;
        });

        // 일반 개별 스킬 HTML 렌더링
        individualSkills.forEach(skill => {
            const isEquipped = indStates[skill.id];
            const bgCol = isEquipped ? 'rgba(50, 150, 50, 0.3)' : 'transparent';
            const borderCol = isEquipped ? '#5a5' : '#444';
            
            html += `
                <label style="display:flex; align-items:center; margin-bottom:4px; cursor:pointer; padding:5px; background:${bgCol}; border-radius:4px; border:1px solid ${borderCol};">
                    <input type="checkbox" class="sb-skill-checkbox" data-skill-id="${skill.id}" ${isEquipped ? 'checked' : ''} style="cursor:pointer; margin-right:8px;">
                    <span style="color:${isEquipped ? '#fff' : '#888'}; font-weight:${isEquipped ? 'bold' : 'normal'};">
                        ${skill.icon} ${skill.name}
                    </span>
                </label>
            `;
        });

        container.innerHTML = html;

        // 체크박스 클릭 이벤트 바인딩
        const checkboxes = container.querySelectorAll('.sb-skill-checkbox');
        checkboxes.forEach(cb => {
            cb.onchange = (e) => {
                const isChecked = e.target.checked;
                const skillId = e.target.getAttribute('data-skill-id');
                const category = e.target.getAttribute('data-category');

                if (isChecked && currentCount >= 6) {
                    alert("스킬 슬롯이 가득 찼습니다! (최대 6개)");
                    e.target.checked = false;
                    return;
                }

                if (category) {
                    // 범주 스킬 장착/해제 처리
                    const g = skillGroups[category];
                    if (isChecked) {
                        g.skills.forEach(s => {
                            if (!hero.equippedSkills.includes(s.id)) hero.equippedSkills.push(s.id);
                        });
                    } else {
                        hero.equippedSkills = hero.equippedSkills.filter(id => !g.skills.some(s => s.id === id));
                    }
                } else if (skillId) {
                    // 개별 스킬 장착/해제 처리
                    if (isChecked) {
                        if (!hero.equippedSkills.includes(skillId)) hero.equippedSkills.push(skillId);
                    } else {
                        hero.equippedSkills = hero.equippedSkills.filter(id => id !== skillId);
                    }
                }

                // 변경 후 즉시 리렌더링 및 UI 반영
                this.renderSkillTool(hero);
                this.battle.ui.updateStatusPanel();
                if (this.battle.currentUnit && this.battle.currentUnit.id === hero.id) {
                    if (typeof this.battle.updateFloatingControls === 'function') {
                        this.battle.updateFloatingControls();
                    }
                }
            };
        });
    }

    updateHeroSelect() {
        const select = document.getElementById('sb-hero-select');
        if (select) {
            const heroes = this.battle.units.filter(u => u.team === 0);
            select.innerHTML = heroes.length > 0 
                ? heroes.map(u => `<option value="${u.id}">${u.name} (Lv.${u.level})</option>`).join('')
                : `<option value="">-- 배치된 영웅이 없습니다 --</option>`;
                
            const currentHero = heroes.find(u => u.id === select.value) || heroes[0];
            this.renderSkillTool(currentHero);
        }
    }

    bindSandboxEvents() {
        const toggleBtn = document.getElementById('sb-toggle-btn');
        const mainPanel = document.getElementById('sb-main-panel');
        let isPanelOpen = true;

        toggleBtn.onclick = () => {
            isPanelOpen = !isPanelOpen;
            mainPanel.style.display = isPanelOpen ? 'block' : 'none';
            toggleBtn.innerHTML = isPanelOpen ? '⚙️' : '🛠️';
            toggleBtn.style.borderRadius = isPanelOpen ? '8px 0 0 8px' : '8px';
        };

        document.getElementById('sb-hero-select').onchange = (e) => {
            const hero = this.battle.units.find(u => u.id === e.target.value);
            this.renderSkillTool(hero);
            if (hero) this.battle.centerCameraOnUnit(hero);
        };

        document.getElementById('sb-btn-place').onclick = () => {
            const selectEl = document.getElementById('sb-spawn-select');
            const key = selectEl.value;
            
            if (!key) return alert("배치할 대상을 먼저 선택하세요!");
            
            const optGroup = selectEl.options[selectEl.selectedIndex].parentNode.label;
            
            this.spawnTarget = key;
            this.spawnTeam = optGroup.includes("아군") ? 0 : 1; 

            const teamName = this.spawnTeam === 0 ? "아군 영웅" : "적군 몬스터";
            this.battle.log(`맵의 빈 칸을 클릭하면 ${teamName} [${key}]이(가) 소환됩니다.`, "log-system");
            this.battle.grid.canvas.style.cursor = 'crosshair';
        };

        document.getElementById('sb-btn-clear-enemy').onclick = () => {
            this.battle.units = this.battle.units.filter(u => u.team === 0);
            this.battle.ui.renderUnitOverlays();
            this.battle.log("모든 적이 삭제되었습니다.", "log-system");
        };

        document.getElementById('sb-btn-clear-hero').onclick = () => {
            this.battle.units = this.battle.units.filter(u => u.team !== 0);
            this.battle.currentUnit = null;
            this.battle.ui.renderUnitOverlays();
            this.battle.ui.renderPartyList();
            this.updateHeroSelect();
            this.battle.log("모든 영웅이 맵에서 제거되었습니다.", "log-system");
        };

        document.getElementById('sb-btn-maxout').onclick = () => {
            const hId = document.getElementById('sb-hero-select').value;
            this.maxOutHero(hId);
        };

        document.getElementById('sb-btn-ai').onclick = (e) => {
            this.aiEnabled = !this.aiEnabled;
            e.target.style.background = this.aiEnabled ? '#a33' : '#3a3';
            e.target.textContent = this.aiEnabled ? '🤖 적 AI: ON (공격함)' : '🛑 적 AI: OFF (가만히 있음)';
            this.battle.log(this.aiEnabled ? "적 AI가 활성화되었습니다." : "적 AI가 정지되었습니다.", "log-system");
        };

        document.getElementById('sb-btn-fill-mp').onclick = () => {
            this.battle.units.filter(u => u.team === 0).forEach(u => {
                u.curHp = u.hp;
                u.curMp = u.mp;
                u.actionGauge = this.battle.actionGaugeLimit; 
            });
            this.battle.ui.updateStatusPanel();
            this.battle.ui.renderUnitOverlays();
            this.battle.ui.renderPartyList();
            this.battle.log("아군 전원의 상태가 완전히 회복되었습니다.", "log-heal");
        };

        document.getElementById('sb-btn-exit').onclick = () => {
            if(confirm("테스트를 종료하고 마을로 돌아가시겠습니까?")) {
                document.getElementById('sandbox-panel-wrapper')?.remove(); 
                this.battle.endBattleSequence(true); 
                
                setTimeout(() => {
                    if (window.game && typeof window.game.enterVillage === 'function') {
                        window.game.enterVillage();
                    }
                }, 1050);
            }
        };
    }

    executeSandboxAction(inputArg) {
        if (!this.spawnTarget) return;
        
        const targetKey = this.spawnTarget;
        const targetTeam = this.spawnTeam;
        
        this.spawnTarget = null;
        this.battle.grid.canvas.style.cursor = 'grab';

        let targetQ, targetR;
        
        if (inputArg && typeof inputArg.q !== 'undefined' && typeof inputArg.r !== 'undefined') {
            targetQ = parseInt(inputArg.q, 10);
            targetR = parseInt(inputArg.r, 10);
        } else if (inputArg && (inputArg.clientX !== undefined || inputArg.offsetX !== undefined)) {
            const rect = this.battle.grid.canvas.getBoundingClientRect();
            const screenX = inputArg.clientX !== undefined ? inputArg.clientX - rect.left : inputArg.offsetX;
            const screenY = inputArg.clientY !== undefined ? inputArg.clientY - rect.top : inputArg.offsetY;
            
            const cam = this.battle.camera || { x: 0, y: 0 };
            const worldX = screenX + cam.x;
            const worldY = screenY + cam.y;
            
            const hexPos = this.battle.grid.pixelToHex(worldX, worldY);
            if (!hexPos) return; 
            
            targetQ = hexPos.q;
            targetR = hexPos.r;
        } else {
            return;
        }

        const isOccupied = this.battle.units.some(u => u.q === targetQ && u.r === targetR && u.curHp > 0);
        if (isOccupied) {
            this.battle.log("해당 위치에 이미 유닛이 있습니다.", "log-bad");
            return;
        }

        let spawned = null;

        if (targetTeam === 0) {
            const baseData = CLASS_DATA[targetKey] || { name: targetKey, hp: 100, mp: 50 };
            spawned = JSON.parse(JSON.stringify(baseData));
            spawned.classKey = targetKey;
            spawned.id = `sandbox_hero_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            spawned.team = 0;
            
            const tData = this.battle.grid.getTerrainData(targetQ, targetR) || { h: 0 };
            const pos3D = this.battle.grid.hexToPixel3D(targetQ, targetR, tData.h || 0);

            spawned.q = targetQ;
            spawned.r = targetR;
            spawned.x = pos3D.x;
            spawned.y = pos3D.y;
            spawned.visualPos = { x: pos3D.x, y: pos3D.y };

            spawned.curHp = spawned.hp;
            spawned.curMp = spawned.mp;
            spawned.level = 1;
            spawned.actionGauge = this.battle.actionGaugeLimit || 100;
            
            spawned.equipment = {};
            for(let i=1; i<=8; i++) spawned.equipment[`pocket${i}`] = null;
            
            // ⭐ [핵심 2] 직업별 ID 접두사를 사용해 정확한 스킬만 필터링
            const PREFIX_MAP = {
                'WARRIOR': 'WAR', 'KNIGHT': 'KNT', 'ARCHER': 'ARC', 'ROGUE': 'THF',
                'SORCERER': 'SOR', 'CLERIC': 'CLR', 'MARTIAL ARTIST': 'MAR', 'BARD': 'BRD',
                'DANCER': 'DNC', 'ALCHEMIST': 'ALC'
            };
            const prefix = PREFIX_MAP[targetKey];
            
            const allClassSkills = Object.values(SKILL_DATABASE).filter(s => 
                s.id && typeof s.id === 'string' && s.id.startsWith(prefix)
            );
            
            spawned.skills = JSON.parse(JSON.stringify(allClassSkills));
            spawned.equippedSkills = []; // 소환 초기에는 장착 안됨 (0개)
            spawned.buffs = [];
            
            this.battle.units.push(spawned);
        } else {
            this.battle.lifecycle.spawnUnit(targetKey, targetTeam, targetQ, targetR);
            spawned = this.battle.units[this.battle.units.length - 1];
        }

        if (spawned) {
            this.battle.log(`[${spawned.name}] 맵에 배치되었습니다!`, "log-system");
        }
        
        this.updateHeroSelect();
        this.battle.ui.renderUnitOverlays();
        this.battle.ui.renderPartyList();

        if (targetTeam === 0 && (!this.battle.currentUnit || this.battle.currentUnit.curHp <= 0)) {
            this.battle.currentUnit = spawned;
            this.battle.calcReachable();
            this.battle.updateFloatingControls();
            this.battle.updateStatusPanel();
        }
    }

    maxOutHero(heroId) {
        if (!heroId) return alert("강화할 영웅을 먼저 맵에 배치하세요!");
        const hero = this.battle.units.find(u => u.id === heroId);
        if (!hero) return;

        hero.level = 99;
        hero.classLevel = 8;
        hero.statPoints += 500;
        
        ['str', 'int', 'vit', 'agi', 'dex', 'vol', 'luk'].forEach(s => hero[s] += 50);
        hero.hp = 9999; hero.curHp = 9999;
        hero.mp = 999; hero.curMp = 999;
        
        if (hero.classKey === 'ALCHEMIST' || hero.job === '연금술사') {
            hero.equipment.pocket1 = { id: 'POTION_S', count: 99 };
            hero.equipment.pocket2 = { id: 'REAGENT_UNSTABLE', count: 99 };
            hero.equipment.pocket3 = { id: 'IT_ETHER', count: 99 };
            hero.equipment.pocket4 = { id: 'CT_GREASE', count: 99 }; 
            hero.equipment.pocket5 = { id: 'CT_FLASHBANG', count: 99 };
            hero.equipment.pocket6 = { id: 'CT_HALLUCINOGEN', count: 99 };
            hero.equipment.pocket7 = { id: 'IT_XPOTION', count: 99 };
        }

        this.battle.ui.updateStatusPanel();
        this.renderSkillTool(hero); 
        this.battle.log(`✨ ${hero.name} Lv.99 스탯 풀강화 완료! (스킬은 하단 툴에서 장착)`, "log-heal");
    }
}