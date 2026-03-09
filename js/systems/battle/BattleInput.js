import * as Formulas from '../../utils/formulas.js';

export class BattleInput {
    constructor(battleSystem, canvas) {
        this.battle = battleSystem;
        this.canvas = canvas;
        
        this.isMouseDown = false;
        this.isDraggingMap = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragCamStart = { x: 0, y: 0 };

        if (!this.battle.onTurnEndClick) {
            this.battle.onTurnEndClick = () => this.battle.endTurn();
        }

        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        this.onMouseLeave = () => { 
             this.isMouseDown = false;
             this.isDraggingMap = false; 
             if(this.battle.ui && this.battle.ui.hideTooltip) this.battle.ui.hideTooltip(); 
        };
        this.onWheel = this.handleWheel.bind(this);
        this.onKeyDown = this.handleKeyDown.bind(this);

        this.bindEvents();
    }

    bindEvents() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
        this.canvas.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('keydown', this.onKeyDown);

        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('mouseleave', this.onMouseLeave);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
        window.addEventListener('keydown', this.onKeyDown);
    }

    handleMouseDown(e) {
        if (e.button === 0 || e.button === 2) { 
            this.isMouseDown = true;
            this.isDraggingMap = false;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.dragCamStart = { x: this.battle.camera.x, y: this.battle.camera.y };
        }
    }

    handleMouseMove(e) {
        // ⭐ 마우스 드래그를 통한 카메라 이동 로직
        if (this.isMouseDown) {
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            
            // 5픽셀 이상 움직이면 드래그로 판정
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                this.isDraggingMap = true;
            }
            
            if (this.isDraggingMap) {
                this.battle.camera.x = this.dragCamStart.x - dx;
                this.battle.camera.y = this.dragCamStart.y - dy;
                if(this.battle.ui && this.battle.ui.updateFloatingPosition) this.battle.ui.updateFloatingPosition();
                return; 
            }
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hex = this.battle.grid.pixelToHex(x + this.battle.camera.x, y + this.battle.camera.y);
        const q = Math.round(hex.q);
        const r = Math.round(hex.r);

        if (this.battle.hoverHex && this.battle.hoverHex.q === q && this.battle.hoverHex.r === r) return;
        this.battle.hoverHex = { q, r };

        if (this.battle.isProcessingTurn || this.battle.isAnimating) return;

        // ⭐ 스킬을 시전하여 우측 패널이 "고정(Lock)"된 상태라면 덮어쓰지 않음
        if (this.battle.ui && this.battle.ui.lockedTargetPanel) return;

        // 조준 중일 때 피격 범위 내 적들을 우측 패널에 나열
        if (this.battle.selectedSkill && this.battle.attackableHexes.some(h => h.q === q && h.r === r)) {
            const skill = this.battle.selectedSkill;
            const targetUnit = this.battle.getUnitAt(q, r);
            const eff = (skill.effects && skill.effects.length > 0) ? skill.effects[0] : skill;
            
            if (this.battle.targetingManager) {
                const targets = this.battle.targetingManager.collectTargets(eff, {q, r}, targetUnit, this.battle.currentUnit, skill);
                if (this.battle.ui && this.battle.ui.updateRightPanel) {
                    this.battle.ui.updateRightPanel(targets, null);
                }
            }
        } else if (this.battle.selectedSkill) {
            if (this.battle.ui && this.battle.ui.updateRightPanel) this.battle.ui.updateRightPanel([], null);
        }
    }

    handleMouseUp(e) {
        this.isMouseDown = false;
        if (this.isDraggingMap) {
            setTimeout(() => { this.isDraggingMap = false; }, 50);
            return;
        }
        this.handleClick(e);
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const oldScale = this.battle.grid.scale;
        let newScale = oldScale - Math.sign(e.deltaY) * zoomSpeed;
        newScale = Math.max(0.5, Math.min(2.0, newScale));
        
        if (newScale !== oldScale) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const worldX = mouseX + this.battle.camera.x;
            const worldY = mouseY + this.battle.camera.y;
            
            this.battle.grid.scale = newScale;
            
            const newCameraX = worldX * (newScale / oldScale) - mouseX;
            const newCameraY = worldY * (newScale / oldScale) - mouseY;
            
            this.battle.camera.x = newCameraX;
            this.battle.camera.y = newCameraY;
            
            if (this.battle.ui) this.battle.ui.updateFloatingPosition();
        }
    }

    handleKeyDown(e) {
        if (this.battle.isProcessingTurn || this.battle.isBattleEnded) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (this.battle.endTurn) this.battle.endTurn();
        }
        
        if (e.key === 'Escape') {
            if (this.battle.selectedSkill || this.battle.confirmingSkill || this.battle.isMovingMode) {
                this.battle.log("행동 취소", "log-system");
                this.battle.cancelAction();
            } else if (this.battle.viewingUnit !== this.battle.currentUnit) {
                if (this.battle.currentUnit && this.battle.currentUnit.team === 0) {
                    this.battle.viewingUnit = this.battle.currentUnit;
                    if (this.battle.ui) this.battle.ui.updateStatusPanel();
                }
            }
        }

        if (['1','2','3','4','5'].includes(e.key)) {
            const idx = parseInt(e.key) - 1;
            const activeSkills = (this.battle.currentUnit?.skills || []).filter(s => s.type !== 'PASSIVE');
             if (activeSkills[idx]) {
                const btn = document.querySelector(`.skill-btn[data-skill-id="${activeSkills[idx].id}"]`);
                if(btn) btn.click();
            }
        }
    }

    handleClick(e) { 
        if (this.battle.confirmingSkill) return;
        const battle = this.battle;
        if (battle.isProcessingTurn || battle.isAnimating) return; 
        if (!battle.hoverHex) return; 

        if (battle.isTestMode && battle.sandboxState && battle.sandboxState.mode !== 'NONE') {
            if (battle.executeSandboxAction) battle.executeSandboxAction(battle.hoverHex);
            return;
        }

        if (battle.currentUnit && battle.currentUnit.team !== 0) return;
        
        const u = battle.currentUnit;
        if (u && (battle.hasStatus(u, 'CC_STUN') || battle.hasStatus(u, 'CC_SLEEP') || 
            battle.hasStatus(u, 'CC_FREEZE') || battle.hasStatus(u, 'CC_CONFUSE') ||
            battle.hasStatus(u, 'CC_FEAR') || battle.hasStatus(u, 'CC_CHARM'))) { 
            battle.log("조작 불가 상태입니다.", "log-system"); 
            return; 
        } 
        
        let targetUnit = battle.getUnitAt(battle.hoverHex.q, battle.hoverHex.r); 
        
        if (!targetUnit && battle.selectedSkill) {
            const skillTarget = String(battle.selectedSkill.target || '').toUpperCase();
            if (skillTarget.includes('DEAD') || skillTarget.includes('CORPSE')) {
                targetUnit = battle.units.find(unit => unit.q === battle.hoverHex.q && unit.r === battle.hoverHex.r && unit.curHp <= 0);
            }
        }

        if (targetUnit && targetUnit.isNPC) {
            if (battle.interactWithUnit) battle.interactWithUnit(targetUnit);
            if (battle.isPeaceful && !battle.isProcessingTurn) {
                battle.moveUnit(u, battle.hoverHex.q, battle.hoverHex.r);
            }
            return;
        }
        
        const taunt = u ? u.buffs.find(b => b.type === 'AGGRO_TAUNT') : null; 
        if (taunt && targetUnit && targetUnit.team === 1 && targetUnit.id !== taunt.casterId) { 
            battle.log("도발 상태입니다! (대상 고정)", "log-cc"); 
            if(battle.ui) battle.ui.showFloatingText(u, "TAUNTED!", "#f55"); 
            return; 
        } 

        if (targetUnit && u && targetUnit.team !== u.team) {
            if (battle.hasStatus(targetUnit, 'BUFF_UNTARGETABLE') || battle.hasStatus(targetUnit, 'STEALTH')) {
                battle.log("타겟팅 할 수 없습니다! (은신/불가)", "log-system");
                return;
            }
        }
        
        if (battle.isPeaceful && !targetUnit && u) {
            const path = battle.grid.findPath({q: u.q, r: u.r}, {q: battle.hoverHex.q, r: battle.hoverHex.r}, n => {
                const tData = battle.grid.getTerrainData(n.q, n.r);
                return battle.grid.isPassable(tData.key);
            });

            if (path.length > 0) {
                battle.moveUnit(u, battle.hoverHex.q, battle.hoverHex.r);
            }
            return;
        }

        if (battle.selectedSkill) { 
            const skill = battle.selectedSkill;
            const isValidHex = battle.attackableHexes.some(h => h.q === battle.hoverHex.q && h.r === battle.hoverHex.r);

            if (!isValidHex && battle.attackableHexes.length > 0) {
                battle.log("범위 밖을 클릭하여 행동을 취소했습니다.", "log-system");
                if (battle.ui) battle.ui.showFloatingText(u, "취소됨", "#aaa");
                battle.cancelAction();
                return;
            }

            const targetType = String(skill.target || '').toUpperCase();
            const areaStr = String(skill.area || '0').toUpperCase();
            
            const isDirectional = areaStr.includes('CLEAVE') || areaStr.includes('CONE') || areaStr.includes('LINE');
            const isAoE = parseInt(skill.area) > 0 || isDirectional || targetType.includes('AREA') || targetType === 'GROUND';
            const isSingleTarget = targetType.includes('SINGLE') || ['ENEMY', 'ALLY', 'ALLY_DEAD', 'ALLY_CORPSE'].includes(targetType);

            if (isSingleTarget && !isAoE) {
                if (!targetUnit) {
                    battle.log("빈 땅을 클릭하여 취소했습니다.", "log-system");
                    battle.cancelAction();
                    return; 
                }
                
                const isHostileSkill = targetType.includes('ENEMY');
                const isFriendlySkill = targetType.includes('ALLY');
                
                if (isHostileSkill && targetUnit.team === u.team) {
                    battle.log("아군에게는 사용할 수 없습니다! (취소됨)", "log-bad");
                    battle.cancelAction();
                    return; 
                }
                if (isFriendlySkill && targetUnit.team !== u.team) {
                    battle.log("적에게는 사용할 수 없습니다! (취소됨)", "log-bad");
                    battle.cancelAction();
                    return; 
                }
            }

            if (battle.skillProcessor) {
                // ⭐ 스킬이 시전되면 우측 패널(타겟 정보)을 고정시킵니다.
                if (battle.ui) battle.ui.lockedTargetPanel = true; 
                battle.skillProcessor.execute(battle.hoverHex, targetUnit); 
            }
            
        } 
        else if (battle.isMovingMode && !battle.actions.moved) { 
            const isValidMove = !targetUnit && battle.reachableHexes && battle.reachableHexes.some(h => h.q === battle.hoverHex.q && h.r === battle.hoverHex.r);
            
            if (isValidMove) { 
                battle.isMovingMode = false; 
                battle.reachableHexes = [];  
                if (battle.ui && battle.ui.updateRightPanel) battle.ui.updateRightPanel([], null);
                battle.moveUnit(u, battle.hoverHex.q, battle.hoverHex.r); 
            } else {
                battle.log("이동 범위 밖을 클릭하여 취소했습니다.", "log-system");
                battle.cancelAction();
            }
        } 
        else if (!battle.isMovingMode && !battle.selectedSkill) {
            // ⭐ 그냥 맵을 클릭했을 때는 고정을 풀고 대상 정보를 띄웁니다.
            if (battle.ui) battle.ui.lockedTargetPanel = false;
            if (targetUnit) {
                battle.viewingUnit = targetUnit;
                if (battle.ui && battle.ui.updateRightPanel) {
                    battle.ui.updateRightPanel([targetUnit], null);
                }
            } else {
                battle.viewingUnit = null;
                const tData = battle.grid.getTerrainData(battle.hoverHex.q, battle.hoverHex.r);
                if (battle.ui && battle.ui.updateRightPanel) {
                    battle.ui.updateRightPanel([], tData);
                }
            }
        }
    }

    // ⭐ [버그 수정 및 메모리 누수 방지] 전투 종료 시 모든 이벤트를 깔끔하게 해제합니다.
    destroy() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.onMouseDown);
            this.canvas.removeEventListener('mousemove', this.onMouseMove);
            this.canvas.removeEventListener('mouseup', this.onMouseUp);
            this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
            this.canvas.removeEventListener('wheel', this.onWheel);
        }
        window.removeEventListener('keydown', this.onKeyDown);
    }
}