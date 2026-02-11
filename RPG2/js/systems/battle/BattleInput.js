import * as Formulas from '../../utils/formulas.js';

export class BattleInput {
    constructor(battleSystem, canvas) {
        this.battle = battleSystem;
        this.canvas = canvas;
        
        this.isMouseDown = false;
        this.isDraggingMap = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragCamStart = { x: 0, y: 0 };

        this.bindEvents();
    }

    bindEvents() {
        this.canvas.onmousedown = (e) => this.handleMouseDown(e);
        this.canvas.onmousemove = (e) => this.handleMouseMove(e);
        this.canvas.onmouseup = (e) => this.handleMouseUp(e);
        this.canvas.onmouseleave = () => { 
             this.isMouseDown = false;
             this.isDraggingMap = false; 
             this.battle.hideTooltip(); 
        };
        this.canvas.onwheel = (e) => this.handleWheel(e);
        
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.handleKeyDown);
    }

    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        this.canvas.onmousedown = null;
        this.canvas.onmousemove = null;
        this.canvas.onmouseup = null;
        this.canvas.onwheel = null;
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    handleKeyDown(e) {
        if (this.battle.isProcessingTurn || this.battle.isBattleEnded) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        
        if (e.code === 'Space') {
            e.preventDefault();
            this.battle.onTurnEndClick();
        }
        
        if (e.key === 'm' || e.key === 'M') {
            // (Optional) 이동 모드 토글 등 추후 구현
        }

        if (e.key === 'Escape') {
            if (this.battle.selectedSkill || this.battle.confirmingSkill) {
                this.battle.log("스킬 선택 취소", "log-system");
                this.battle.selectedSkill = null;
                this.battle.confirmingSkill = null;
                this.battle.updateCursor();
                this.battle.updateStatusPanel();
                this.battle.updateFloatingControls();
            } else if (this.battle.viewingUnit !== this.battle.currentUnit) {
                if (this.battle.currentUnit && this.battle.currentUnit.team === 0) {
                    this.battle.viewingUnit = this.battle.currentUnit;
                    this.battle.updateStatusPanel();
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

    handleMouseDown(e) { 
        if (this.battle.isProcessingTurn && this.battle.currentUnit.team !== 0) return; 
        
        const u = this.battle.currentUnit;
        if (u && u.team === 0) { 
            if (this.battle.hasStatus(u, 'CC_STUN') || this.battle.hasStatus(u, 'CC_SLEEP') || 
                this.battle.hasStatus(u, 'CC_FREEZE') || this.battle.hasStatus(u, 'CC_CONFUSE') ||
                this.battle.hasStatus(u, 'CC_FEAR') || this.battle.hasStatus(u, 'CC_CHARM')) { 
                return; 
            } 
        } 
        
        const pos = this.getCanvasCoordinates(e); 
        this.isMouseDown = true; 
        this.isDraggingMap = false; 
        this.dragStart = { x: pos.x, y: pos.y }; 
        this.dragCamStart = { x: this.battle.camera.x, y: this.battle.camera.y }; 
        this.battle.updateCursor(); 
    }

    handleMouseUp(e) { 
        this.isMouseDown = false; 
        if (this.isDraggingMap) { 
            this.isDraggingMap = false; 
            return; 
        } 
        this.handleClick(e); 
    }

    handleMouseMove(e) { 
        const pos = this.getCanvasCoordinates(e); 
        if (this.isMouseDown) { 
            const dist = Math.sqrt(Math.pow(pos.x - this.dragStart.x, 2) + Math.pow(pos.y - this.dragStart.y, 2)); 
            if (dist > 5) this.isDraggingMap = true; 
            if (this.isDraggingMap) { 
                const dx = pos.x - this.dragStart.x; 
                const dy = pos.y - this.dragStart.y; 
                this.battle.camera.x = this.dragCamStart.x - dx; 
                this.battle.camera.y = this.dragCamStart.y - dy; 
                this.battle.updateFloatingControls(); 
            } 
        } else { 
            const worldX = pos.x + this.battle.camera.x; 
            const worldY = pos.y + this.battle.camera.y; 
            this.battle.hoverHex = this.battle.grid.pixelToHex(worldX, worldY); 
            
            if (this.battle.hoverHex) { 
                const u = this.battle.getUnitAt(this.battle.hoverHex.q, this.battle.hoverHex.r); 
                if (u) { 
                    this.battle.showUnitTooltip(e, u);
                } else { 
                    this.battle.hideTooltip(); 
                } 
            } 
        } 
        this.battle.updateCursor(); 
    }

    handleWheel(e) { 
        if (e.target !== this.canvas) return; 
        e.preventDefault(); 
        const delta = e.deltaY > 0 ? -0.1 : 0.1; 
        const newScale = this.battle.grid.scale + delta; 
        this.battle.grid.setScale(newScale); 
        this.battle.updateFloatingControls(); 
    }

    handleClick(e) { 
        const battle = this.battle;
        if (battle.isProcessingTurn || battle.isAnimating) return; 
        if (!battle.hoverHex || battle.currentUnit.team !== 0) return; 
        
        const u = battle.currentUnit;
        if (battle.hasStatus(u, 'CC_STUN') || battle.hasStatus(u, 'CC_SLEEP') || 
            battle.hasStatus(u, 'CC_FREEZE') || battle.hasStatus(u, 'CC_CONFUSE') ||
            battle.hasStatus(u, 'CC_FEAR') || battle.hasStatus(u, 'CC_CHARM')) { 
            battle.log("조작 불가 상태입니다.", "log-system"); 
            return; 
        } 
        
        const targetUnit = battle.getUnitAt(battle.hoverHex.q, battle.hoverHex.r); 
        if (targetUnit && targetUnit.isNPC) {
            // 평화 모드이고 내 턴(혹은 자유이동)일 때
            if (battle.isPeaceful && !battle.isProcessingTurn) {
                // NPC가 있는 타일로 이동 명령
                battle.moveUnit(u, battle.hoverHex.q, battle.hoverHex.r);
            }
            return; // ★ 중요: 더 이상 아래 로직(타겟팅 등)을 수행하지 않고 종료
        }
        
        const taunt = u.buffs.find(b => b.type === 'AGGRO_TAUNT'); 
        if (taunt && targetUnit && targetUnit.team === 1 && targetUnit.id !== taunt.casterId) { 
            battle.log("도발 상태입니다! (대상 고정)", "log-cc"); 
            battle.showFloatingText(u, "TAUNTED!", "#f55"); 
            return; 
        } 

        if (targetUnit && targetUnit.team !== u.team) {
            if (battle.hasStatus(targetUnit, 'BUFF_UNTARGETABLE') || battle.hasStatus(targetUnit, 'STEALTH')) {
                battle.log("타겟팅 할 수 없습니다! (은신/불가)", "log-system");
                return;
            }
        }
        if (battle.isPeaceful && !targetUnit) {
            // 갈 수 있는 길인지(벽이 아닌지)만 체크
            const path = battle.grid.findPath({q: u.q, r: u.r}, {q: battle.hoverHex.q, r: battle.hoverHex.r}, n => {
                // 단순 통행 가능 여부만 체크
                const tData = battle.grid.getTerrainData(n.q, n.r);
                return battle.grid.isPassable(tData.key);
            });

            if (path.length > 0) {
                battle.moveUnit(u, battle.hoverHex.q, battle.hoverHex.r);
            }
            return;
        }

        if (battle.selectedSkill) { 
            const dist = battle.grid.getDistance(u, battle.hoverHex); 
            const rngBonus = Formulas.getStat(u, 'rng'); 
            
            if (dist <= battle.selectedSkill.rng + rngBonus) { 
                battle.skillProcessor.execute(battle.hoverHex, targetUnit); 
            } else { 
                battle.log("사거리 밖입니다.", "log-system"); 
            } 
        } else if (targetUnit && targetUnit.team === 1) { 
            battle.log("스킬을 선택하세요.", "log-system"); 
            battle.showFloatingText(u, "스킬 선택", "#fa0"); 
        } else if (!targetUnit && !battle.actions.moved) { 
            if (battle.reachableHexes.some(h => h.q === battle.hoverHex.q && h.r === battle.hoverHex.r)) { 
                battle.moveUnit(u, battle.hoverHex.q, battle.hoverHex.r); 
            } 
        } 
    }
}