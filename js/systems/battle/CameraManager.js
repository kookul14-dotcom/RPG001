import { UI } from '../../render/uiController.js'; // 플로팅 텍스트 큐 상태를 확인하기 위해 UI 임포트

export class CameraManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.isPanning = false; // 카메라 이동 상태 추적용 플래그
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
        if (this.battle.ui && this.battle.ui.updateFloatingControls) {
            this.battle.ui.updateFloatingControls();
        }
    }

    // =================================================================
    // ⭐ [근본 해결] 중복 선언된 smoothPanCamera 통합 및 DOM 결합 분리
    // =================================================================
    async smoothPanCamera(targetFocusX, targetFocusY, duration = 400, targetZoom = null) {
        return new Promise(resolve => {
            if (!this.battle.grid || !this.battle.grid.canvas) { resolve(); return; }
            
            this.isPanning = true; // 이동 시작 상태 알림
            
            // 향후 확대/축소 연출을 위한 targetZoom 처리 로직 기반 마련
            const startZoom = this.battle.grid.scale || 1.0; 
            const finalZoom = targetZoom || startZoom;

            const startFocusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / startZoom;
            const startFocusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / startZoom;

            const startTime = performance.now();

            // 카메라 이동 중 플로팅 UI 숨김 (직접 DOM 제어 대신 BattleUI의 메서드 활용 권장)
            // 임기응변 방지를 위해 전역 변수를 활용하여 UI 갱신 시 숨기도록 처리
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
                
                // 줌 아웃/인 전환 연출 적용
                if (targetZoom) {
                    this.battle.grid.scale = startZoom + (finalZoom - startZoom) * ease;
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
                    window.isHudHidden = false; // 이동 완료 후 HUD 복구
                    
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
            const focusX = this.battle.camera.x + (this.battle.grid.canvas.width / 2) / currentZoom;
            const focusY = this.battle.camera.y + (this.battle.grid.canvas.height / 2) / currentZoom;
            this.battle.savedCameraState = { focusX: focusX, focusY: focusY, zoom: currentZoom };
        }
    }

    // =================================================================
    // ⭐ [수정] 모든 텍스트 연출이 끝난 후 카메라가 복귀하도록 지능형 대기 시스템 도입
    // =================================================================
    async restoreCameraState(duration = 400) {
        if (this.battle.savedCameraState) {
            
            // ⭐ 외부 글로벌 객체 UI의 깔끔한 비동기 대기 함수 호출
            if (UI && typeof UI.waitForAllTexts === 'function') {
                await UI.waitForAllTexts();
            }

            await this.smoothPanCamera(this.battle.savedCameraState.focusX, this.battle.savedCameraState.focusY, duration, this.battle.savedCameraState.zoom);
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