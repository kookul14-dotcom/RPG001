export class CameraManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    updateUnitOverlayPosition(unit) {
        const el = document.getElementById(`unit-overlay-${unit.id}`);
        if (!el) return;

        let h = unit.height;
        if (h === undefined && this.battle.grid) {
            const tData = this.battle.grid.getTerrainData(unit.q, unit.r);
            h = tData ? tData.h : 0;
        }

        const pos = this.battle.grid.hexToPixel3D(unit.q, unit.r, h || 0);
        const screenX = pos.x - this.battle.camera.x;
        const screenY = pos.y - this.battle.camera.y;

        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
        el.style.zIndex = Math.floor(screenY);
    }

    centerCameraOnUnit(unit) {
        if (!this.battle.grid || !this.battle.grid.canvas) return;
        const p = this.battle.grid.hexToPixel3D(unit.q, unit.r, 0); 
        this.battle.camera.x = p.x - this.battle.grid.canvas.width / 2;
        this.battle.camera.y = p.y - this.battle.grid.canvas.height / 2;
        this.battle.ui.updateFloatingControls();
    }

    async smoothPanCamera(targetFocusX, targetFocusY, targetZoom = null, duration = 400) {
        return new Promise(resolve => {
            if (!this.battle.grid || !this.battle.grid.canvas) { resolve(); return; }
            const currentZoom = this.battle.grid.scale || 1.0; 
            const startFocusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / currentZoom;
            const startFocusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / currentZoom;

            const startTime = performance.now();

            const floatUI = document.getElementById('floating-controls');
            if (floatUI) floatUI.style.opacity = '0'; 

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                let progress = elapsed / duration;
                if (progress > 1) progress = 1;

                const ease = 1 - Math.pow(1 - progress, 3); 

                const currentFocusX = startFocusX + (targetFocusX - startFocusX) * ease;
                const currentFocusY = startFocusY + (targetFocusY - startFocusY) * ease;

                this.battle.camera.x = currentFocusX - (this.battle.grid.canvas.width / 2) / currentZoom;
                this.battle.camera.y = currentFocusY - (this.battle.grid.canvas.height / 2) / currentZoom;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.battle.camera.x = targetFocusX - (this.battle.grid.canvas.width / 2) / currentZoom;
                    this.battle.camera.y = targetFocusY - (this.battle.grid.canvas.height / 2) / currentZoom;
                    
                    if (floatUI) floatUI.style.opacity = '';
                    if (this.battle.ui && this.battle.ui.updateFloatingControls) this.battle.ui.updateFloatingControls();
                    
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    // =================================================================
    // ⭐ [카메라 상태 관리 및 연출 시스템 - 렉 & 궤적 완벽 수정본]
    // =================================================================
    saveCameraState() {
        if (!this.battle.savedCameraState) {
            const currentZoom = this.battle.grid.scale || 1.0;
            const focusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / currentZoom;
            const focusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / currentZoom;
            this.battle.savedCameraState = { focusX: focusX, focusY: focusY, zoom: currentZoom };
        }
    }

    async restoreCameraState(duration = 400) {
        if (this.battle.savedCameraState) {
            await this.smoothPanCamera(this.battle.savedCameraState.focusX, this.battle.savedCameraState.focusY, duration);
            this.battle.savedCameraState = null;
        }
    }

    clearCameraState() {
        this.battle.savedCameraState = null;
    }

    async smoothPanCamera(targetFocusX, targetFocusY, duration = 400) {
        return new Promise(resolve => {
            if (!this.battle.grid || !this.battle.grid.canvas) { resolve(); return; }
            
            const currentZoom = this.battle.grid.scale || 1.0; 

            const startFocusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / currentZoom;
            const startFocusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / currentZoom;

            const startTime = performance.now();

            const floatUI = document.getElementById('floating-controls');
            if (floatUI) floatUI.style.opacity = '0'; 

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                let progress = elapsed / duration;
                if (progress > 1) progress = 1;

                const ease = 1 - Math.pow(1 - progress, 3); 

                const currentFocusX = startFocusX + (targetFocusX - startFocusX) * ease;
                const currentFocusY = startFocusY + (targetFocusY - startFocusY) * ease;

                this.battle.camera.x = currentFocusX - (this.battle.grid.canvas.width / 2) / currentZoom;
                this.battle.camera.y = currentFocusY - (this.battle.grid.canvas.height / 2) / currentZoom;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.battle.camera.x = targetFocusX - (this.battle.grid.canvas.width / 2) / currentZoom;
                    this.battle.camera.y = targetFocusY - (this.battle.grid.canvas.height / 2) / currentZoom;
                    
                    if (floatUI) floatUI.style.opacity = '';
                    if (this.battle.ui && this.battle.ui.updateFloatingControls) this.battle.ui.updateFloatingControls();
                    
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    async smoothCenterCameraOnUnit(unit, duration = 400) {
        if (!this.battle.grid || !this.battle.grid.canvas) return;
        
        const p = this.battle.grid.hexToPixel3D(unit.q, unit.r, 0);
        
        await this.smoothPanCamera(p.x, p.y, duration);
    }

    centerCameraOnHeroes() { 
        let totalX=0, totalY=0, count=0; 
        const targets = this.battle.units.filter(u => u.team === 0).length > 0 ? this.battle.units.filter(u => u.team === 0) : this.battle.units; 
        targets.forEach(u => { 
            const p = this.battle.grid.hexToPixel3D(u.q, u.r, 0); 
            totalX += p.x; totalY += p.y; count++; 
        }); 
        if (count > 0) { 
            this.battle.camera.x = totalX / count - this.battle.grid.canvas.width / 2; 
            this.battle.camera.y = totalY / count - this.battle.grid.canvas.height / 2; 
        } 
        this.battle.updateFloatingControls();
    }

    triggerShakeAnimation(u) { u.shake = 10; }
    
    triggerBumpAnimation(u, target) { 
        const s = this.battle.grid.hexToPixel(u.q, u.r); 
        const t = this.battle.grid.hexToPixel(target.q, target.r); 
        const dx = t.x - s.x; const dy = t.y - s.y; 
        u.bumpX = dx * 0.3; u.bumpY = dy * 0.3; 
    }
    
    createProjectile(start, end) { 
        const sPos = this.battle.grid.hexToPixel(start.q, start.r); 
        const ePos = this.battle.grid.hexToPixel(end.q, end.r); 
        
        const proj = { x:sPos.x, y:sPos.y, tx:ePos.x, ty:ePos.y, t:0, speed:0.1 };
        this.battle.projectiles.push(proj); 
        
        setTimeout(() => {
            const index = this.battle.projectiles.indexOf(proj);
            if (index > -1) this.battle.projectiles.splice(index, 1);
        }, 300);
    }
    
    moveSpriteOnly(unit, q, r, duration, isJump = false) {
        return new Promise(resolve => {
            const el = document.getElementById(`unit-overlay-${unit.id}`);
            if (!el) { resolve(); return; }

            const dest = this.battle.grid.hexToPixel3D(q, r, unit.height || 0);
            const screenX = dest.x - this.battle.camera.x; const screenY = dest.y - this.battle.camera.y;

            el.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
            if (isJump) {
                el.style.transform = `translate(-50%, -50px) scale(1.2)`; 
                setTimeout(() => { el.style.transform = `translate(-50%, 0) scale(1)`; }, duration * 0.8);
            }

            el.style.left = `${screenX}px`; el.style.top = `${screenY}px`;
            setTimeout(() => { el.style.transition = ''; resolve(); }, duration);
        });
    }
}