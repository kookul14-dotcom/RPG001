import { UI } from '../../render/uiController.js'; 

export class CameraManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.isPanning = false; 
    }

    // ⭐ [수정] 오버레이(체력바 등 DOM 요소)도 회전된 3D 좌표를 따라가도록 보정
    updateUnitOverlayPosition(unit) {
        const el = document.getElementById(`unit-overlay-${unit.id}`);
        if (!el) return;

        let h = unit.height;
        if (h === undefined && this.battle.grid) {
            const tData = this.battle.grid.getTerrainData(unit.q, unit.r);
            h = tData ? tData.h : 0;
        }

        // hexToPixel3D 내부에서 이미 cameraRotation 연산을 거쳐 반환됩니다.
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
        if (this.battle.ui && this.battle.ui.updateFloatingControls) {
            this.battle.ui.updateFloatingControls();
        }
    }

    async smoothPanCamera(targetFocusX, targetFocusY, duration = 400, targetZoom = null) {
        return new Promise(resolve => {
            if (!this.battle.grid || !this.battle.grid.canvas) { resolve(); return; }
            
            this.isPanning = true; 
            
            const startZoom = this.battle.grid.scale || 1.0; 
            const finalZoom = targetZoom || startZoom;

            const startFocusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / startZoom;
            const startFocusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / startZoom;

            const startTime = performance.now();

            window.isHudHidden = true; 
            if (this.battle.ui && this.battle.ui.updateFloatingControls) {
                this.battle.ui.updateFloatingControls();
            }

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                let progress = elapsed / duration;
                if (progress > 1) progress = 1;

                const ease = 1 - Math.pow(1 - progress, 3); 

                const currentFocusX = startFocusX + (targetFocusX - startFocusX) * ease;
                const currentFocusY = startFocusY + (targetFocusY - startFocusY) * ease;
                
                if (targetZoom) {
                    const lastScale = this.battle.grid.scale;
                    this.battle.grid.scale = startZoom + (finalZoom - startZoom) * ease;
                    
                    if (Math.abs(lastScale - this.battle.grid.scale) > 0.01) {
                        if (this.battle.renderer) this.battle.renderer.needsUpdateCache = true;
                    }
                }
                const currentZoom = this.battle.grid.scale || 1.0;

                this.battle.camera.x = currentFocusX - (this.battle.grid.canvas.width / 2) / currentZoom;
                this.battle.camera.y = currentFocusY - (this.battle.grid.canvas.height / 2) / currentZoom;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.battle.camera.x = targetFocusX - (this.battle.grid.canvas.width / 2) / finalZoom;
                    this.battle.camera.y = targetFocusY - (this.battle.grid.canvas.height / 2) / finalZoom;
                    
                    this.isPanning = false;
                    window.isHudHidden = false; 
                    
                    if (this.battle.ui && this.battle.ui.updateFloatingControls) {
                        this.battle.ui.updateFloatingControls();
                    }
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    saveCameraState() {
        if (!this.battle.savedCameraState) {
            const currentZoom = this.battle.grid.scale || 1.0;
            // ⭐ [개선] 현재 화면의 '중심 픽셀(focusX,Y)' 뿐만 아니라, 
            // 그 픽셀이 어떤 '헥스 타일(q,r)'인지도 함께 기억해둡니다.
            // (그래야 복귀 전에 사용자가 Q/E 키로 화면을 돌려도 정확한 위치로 찾아갈 수 있음)
            const focusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / currentZoom;
            const focusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / currentZoom;
            
            const centerHex = this.battle.grid.pixelToHex(focusX, focusY);

            this.battle.savedCameraState = { 
                hexQ: centerHex.q, 
                hexR: centerHex.r, 
                zoom: currentZoom 
            };
        }
    }

    async restoreCameraState(duration = 400) {
        if (this.battle.savedCameraState) {
            
            if (UI && typeof UI.waitForAllTexts === 'function') {
                await UI.waitForAllTexts();
            }

            // ⭐ [개선] 픽셀을 직접 부르는 대신 기억해둔 헥스 타일의 '현재 시점 3D 픽셀 위치'를 재계산해서 돌아갑니다.
            // 이렇게 해야 스킬 연출 중에 Q/E로 맵을 돌려도 엉뚱한 허공으로 날아가지 않습니다.
            const targetPixel = this.battle.grid.hexToPixel3D(
                this.battle.savedCameraState.hexQ, 
                this.battle.savedCameraState.hexR, 
                0
            );

            await this.smoothPanCamera(targetPixel.x, targetPixel.y, duration, this.battle.savedCameraState.zoom);
            this.battle.savedCameraState = null;
        }
    }

    clearCameraState() {
        this.battle.savedCameraState = null;
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
        if (this.battle.ui && this.battle.ui.updateFloatingControls) {
            this.battle.ui.updateFloatingControls();
        }
    }

    triggerShakeAnimation(u) { u.shake = 10; }
    
    triggerBumpAnimation(u, target) { 
        // 시각 효과 전용이므로 현재 회전 상태가 반영된 hexToPixel3D를 이용해 방향을 구해야 자연스럽습니다.
        const s = this.battle.grid.hexToPixel3D(u.q, u.r, 0); 
        const t = this.battle.grid.hexToPixel3D(target.q, target.r, 0); 
        const dx = t.x - s.x; const dy = t.y - s.y; 
        u.bumpX = dx * 0.3; u.bumpY = dy * 0.3; 
    }
    
    createProjectile(start, end) { 
        // 투사체 역시 회전된 화면 좌표를 따라가도록 수정
        const sPos = this.battle.grid.hexToPixel3D(start.q, start.r, 0); 
        const ePos = this.battle.grid.hexToPixel3D(end.q, end.r, 0); 
        
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
            const screenX = dest.x - this.battle.camera.x; 
            const screenY = dest.y - this.battle.camera.y;

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