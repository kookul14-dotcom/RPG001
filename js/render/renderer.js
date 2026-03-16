import { TERRAIN_TYPES, HEX_SIZE, BUILDING_TYPES } from '../data/index.js';
import { STANDING_DATA } from '../data/standing.js';

export class GameRenderer {
    // ⭐ [근본 해결 1] 전역 참조 대신 명시적으로 battleSystem을 주입받도록 생성자 수정
    constructor(canvas, hexGrid, battleSystem) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = hexGrid;
        this.battle = battleSystem; 
        
        this.cachedState = { skillId: null, hoverQ: null, hoverR: null };
        this.cachedSkillZone = [];
        this.cachedAreaZone = [];
        this.isDestroyed = false;
        this.imageStore = {};
        
        // ⭐ [신규] 시각 효과(VFX) 관리를 위한 전용 배열 추가
        this.vfxList = []; 
        
        this.hexOffsets = [];
        for (let i = 0; i < 6; i++) {
            const rad = (60 * i + 30) * Math.PI / 180;
            this.hexOffsets.push({ cos: Math.cos(rad), sin: Math.sin(rad) });
        }

        this.terrainCacheCanvas = document.createElement('canvas');
        this.terrainCacheCtx = this.terrainCacheCanvas.getContext('2d', { alpha: true });
        this.needsUpdateCache = true;
        this.terrainCacheOffset = { x: 0, y: 0 };
        
        // ⭐ [신규] 카메라 회전 상태 감지용 변수
        this.lastRotation = 0;

        this.loop = this.loop.bind(this);
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    destroy() {
        this.isDestroyed = true; 
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // ⭐ 외부 의존성 없이 내부 배열을 순회해 맵 전체 크기를 잰 후 한 장의 캐시로 구워내는 메서드
    updateTerrainCache() {
        const sortedHexes = this.grid.getSortedHexes();
        if (!sortedHexes || sortedHexes.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const size = HEX_SIZE * this.grid.scale;
        const tilt = this.grid.tilt || 1;
        const baseThickness = 40 * this.grid.scale;

        // 1. 맵 전체의 픽셀 바운딩 박스(Bounding Box) 직접 계산
        sortedHexes.forEach(h => {
            const tData = this.grid.getTerrainData(h.q, h.r);
            const height = tData.h || 0;
            const topCenter = this.grid.hexToPixel3D(h.q, h.r, height);
            
            if (topCenter.x < minX) minX = topCenter.x;
            if (topCenter.x > maxX) maxX = topCenter.x;
            if (topCenter.y < minY) minY = topCenter.y;
            if (topCenter.y + baseThickness > maxY) maxY = topCenter.y + baseThickness; 
        });

        // 잘림 방지용 여백(Padding)
        const padding = size * 2;
        minX -= padding; maxX += padding;
        minY -= padding; maxY += padding;

        this.terrainCacheCanvas.width = Math.ceil(maxX - minX);
        this.terrainCacheCanvas.height = Math.ceil(maxY - minY);
        this.terrainCacheOffset = { x: minX, y: minY };

        const ctx = this.terrainCacheCtx;
        ctx.clearRect(0, 0, this.terrainCacheCanvas.width, this.terrainCacheCanvas.height);

        // 2. 가짜 카메라 객체(맵 좌상단 끝점)를 생성
        const fakeCam = { x: minX, y: minY };

        // 3. 맵을 순회하며 지형과 건물을 딱 한 번만 캐시에 렌더링
        sortedHexes.forEach(h => {
            const tData = this.grid.getTerrainData(h.q, h.r);
            const height = tData.h || 0;
            const topCenter = this.grid.hexToPixel3D(h.q, h.r, height);
            
            const topX = topCenter.x - fakeCam.x;
            const topY = topCenter.y - fakeCam.y;
            const typeInfo = TERRAIN_TYPES[tData.key] || TERRAIN_TYPES['PLAIN'];
            
            this._drawHexPrismFast(ctx, typeInfo, height, fakeCam, topX, topY, size, tilt, h.q, h.r);

            if (tData.building) {
                const bInfo = BUILDING_TYPES[tData.building.key];
                if (bInfo) {
                    const textToShow = (tData.building.key === 'CHEST') ? null : tData.building.text;
                    // 대상 컨텍스트(ctx)를 명시적으로 넘겨서 메인 캔버스가 아닌 캐시 캔버스에 그리게 함
                    this.drawBuilding(h.q, h.r, height, bInfo, textToShow, fakeCam, ctx);
                }
            }
        });

        this.needsUpdateCache = false;
    }

    loop() {
        // ⭐ [근본 해결 2] window.isBattleActive, window.battle 제거. 내부 속성에만 의존
        if (this.isDestroyed || !this.battle || this.battle.isBattleEnded) return;

        // ⭐ [신규] 카메라 회전각이 변경되었다면 지형 캐시를 새로 굽도록 강제 지시
        if (this.lastRotation !== this.grid.cameraRotation) {
            this.needsUpdateCache = true;
            this.lastRotation = this.grid.cameraRotation;
        }

        // ⭐ [최적화] 지형 갱신이 필요할 때만 캐시를 재생성 (프레임 드랍 근본 차단)
        if (this.needsUpdateCache) this.updateTerrainCache();

        const ctx = this.ctx;
        const battle = this.battle; // 전역 변수 대신 의존성 객체 사용
        const cam = battle.camera;
        const screenW = this.canvas.width;
        const screenH = this.canvas.height;

        ctx.clearRect(0, 0, screenW, screenH);

        // ⭐ 1. 지형 그리기 (수천 번의 연산 대신 오프스크린 캔버스에 구워둔 한 장의 이미지를 복사)
        ctx.drawImage(
            this.terrainCacheCanvas, 
            this.terrainCacheOffset.x - cam.x,  // ✔️ 정상적인 좌표 계산
            this.terrainCacheOffset.y - cam.y   // ✔️ 정상적인 좌표 계산
        );

        const time = Date.now() * 0.003;
        const pulse = 0.2 + Math.abs(Math.sin(time * 1.5)) * 0.3;
        const strongPulse = 0.4 + Math.abs(Math.sin(time * 2.5)) * 0.4;

        // =====================================================================
        // ⭐ [신규 반영] 2. 이동 및 스킬 범위 표시 (타일 위에 덧그리기)
        // =====================================================================
        if (battle.currentUnit && battle.currentUnit.team === 0 && !battle.isProcessingTurn) {
            
            // A. 스킬이 선택되었을 때 (붉은색/노란색 타겟팅)
            if (battle.selectedSkill) {
                const skill = battle.selectedSkill;
                const sTarget = skill.target || 'ENEMY'; 
                const sArea = parseInt(skill.area) || 0;
                
                const hoverChanged = battle.hoverHex 
                    ? (this.cachedState.hoverQ !== battle.hoverHex.q || this.cachedState.hoverR !== battle.hoverHex.r) 
                    : (this.cachedState.hoverQ !== null);
                const skillChanged = this.cachedState.skillId !== skill.id;

                if (skillChanged) {
                    this.cachedState.skillId = skill.id;
                    
                    // ⭐ [핵심 교체] 기존의 단순 거리 계산(cachedSkillZone) 대신, 
                    // BattleSystem이 RangeManager를 통해 검증을 마친 attackableHexes를 사용합니다!
                    this.cachedSkillZone = battle.attackableHexes || [];
                }

                if (skillChanged || hoverChanged) {
                    this.cachedState.hoverQ = battle.hoverHex ? battle.hoverHex.q : null;
                    this.cachedState.hoverR = battle.hoverHex ? battle.hoverHex.r : null;
                    this.cachedAreaZone = [];

                    // ⭐ [버그 수정/개선] 제자리 시전 스킬(SELF)도 마우스 호버와 상관없이 항상 자신의 발밑에 범위를 표시함
                    // 단, 맵 전체 판정(99 이상)이나 타겟이 명백히 전체(ALL/GLOBAL)인 스킬은 무의미하므로 그리지 않음
                    const skipAreaDraw = sArea >= 99 || ['ALLY_ALL', 'ENEMY_ALL', 'GLOBAL'].includes(sTarget);

                    const isSelfTarget = sTarget === 'SELF' || sTarget === 'AREA_SELF' || parseInt(skill.rng) === 0;
                    
                    // 마우스 호버 중이거나 제자리 시전 스킬일 때 발동 범위를 계산
                    const isValidHover = battle.hoverHex && this.cachedSkillZone.some(h => h.q === battle.hoverHex.q && h.r === battle.hoverHex.r);
                    const shouldDrawArea = !skipAreaDraw && (isValidHover || isSelfTarget);

                    if (shouldDrawArea) {
                        const areaStr = String(skill.area || '0').toUpperCase();
                        // 제자리 스킬이면 중심점을 시전자 위치로, 아니면 마우스 위치로 잡음
                        const centerHex = isSelfTarget ? {q: battle.currentUnit.q, r: battle.currentUnit.r} : battle.hoverHex;
                        
                        if (areaStr.includes('LINE') || sTarget.includes('LINE')) {
                            // 방향성 뻥튀기 반영(rngBonus는 RangeManager에서 이미 더해져서 넘어옴)
                            const lineLen = parseInt(areaStr.replace('LINE_', '')) || parseInt(skill.rng) || 1;
                            this.cachedAreaZone = this.grid.getLine(battle.currentUnit, centerHex, lineLen);
                        } 
                        else if (this.grid.getShapeHexes) {
                            this.cachedAreaZone = this.grid.getShapeHexes(centerHex, battle.currentUnit, areaStr);
                        } 
                        else {
                            const targetQ = centerHex.q;
                            const targetR = centerHex.r;
                            for (let dq = -sArea; dq <= sArea; dq++) {
                                for (let dr = Math.max(-sArea, -dq - sArea); dr <= Math.min(sArea, -dq + sArea); dr++) {
                                    const checkQ = targetQ + dq;
                                    const checkR = targetR + dr;
                                    if (this.grid.hexes.has(`${checkQ},${checkR}`)) {
                                        this.cachedAreaZone.push({q: checkQ, r: checkR});
                                    }
                                }
                            }
                        }
                    }
                }

                // 🔴 공격 가능 헥스 전체 테두리 (붉은 톤으로 변경)
                this.cachedSkillZone.forEach(h => {
                    this.drawZoneOutline(h.q, h.r, `rgba(255, 100, 100, ${pulse + 0.3})`, cam);
                });
                
                // 🟠 실제 타격이 들어가는 스플래시(광역) 범위 칠하기
                this.cachedAreaZone.forEach(h => {
                    // 제자리 시전 지원기(버프/힐)라면 긍정적인 초록색 빛, 공격기면 주황/붉은색 빛으로 차등 적용
                    const isSupport = skill.effects && skill.effects.some(e => e.type.startsWith('HEAL') || e.type.startsWith('BUFF'));
                    const fillColor = isSupport ? `rgba(100, 255, 100, ${strongPulse * 0.6})` : `rgba(255, 100, 0, ${strongPulse * 0.7})`;
                    this.drawZone(h.q, h.r, fillColor, cam, true);
                });
                
                // 🟠 실제 타격이 들어가는 스플래시(광역) 범위 칠하기
                this.cachedAreaZone.forEach(h => {
                    this.drawZone(h.q, h.r, `rgba(255, 100, 0, ${strongPulse * 0.7})`, cam, true);
                });

            } 
            // B. 이동만 할 때 (푸른색 이동 범위)
            else {
                this.cachedState.skillId = null; 
                if (!battle.actions.moved && battle.reachableHexes) {
                    battle.reachableHexes.forEach(h => {
                        this.drawZone(h.q, h.r, `rgba(0, 160, 255, ${pulse * 0.3})`, cam);
                        this.drawZoneOutline(h.q, h.r, `rgba(0, 200, 255, ${pulse})`, cam);
                    });
                }
            }
        }

        // 마우스 호버 표시
        if (battle.hoverHex) {
            this.drawZoneOutline(battle.hoverHex.q, battle.hoverHex.r, "rgba(255, 255, 255, 0.9)", cam);
        }
        
        // ⭐ 2.5 장판(Zone) 바닥 렌더링 (유닛을 그리기 전에 바닥에 먼저 깜)
        battle.units.forEach(u => {
            if (u.type === 'OBJECT' && u.key && u.key.includes('ZONE') && u.curHp > 0) {
                let zoneColor = "rgba(0, 0, 0, 0.5)"; // 기본 (검정 늪)
                if (u.key.includes('POISON')) zoneColor = "rgba(100, 255, 50, 0.4)"; // 독성 녹색
                else if (u.key.includes('FIRE')) zoneColor = "rgba(255, 80, 0, 0.4)"; // 불타는 빨강
                else if (u.key.includes('HEAL') || u.key.includes('IMMUNE')) zoneColor = "rgba(255, 255, 100, 0.4)"; // 신성한 황금빛
                
                // 해당 타일 위에 장판 색상을 그린다 (약간 빛나는 효과 포함)
                this.drawZone(u.q, u.r, zoneColor, cam, true);
                
                // 애니메이션 효과 (테두리가 살짝 깜빡임)
                const animPulse = 0.2 + Math.abs(Math.sin(Date.now() * 0.003)) * 0.3;
                this.drawZoneOutline(u.q, u.r, `rgba(255, 255, 255, ${animPulse})`, cam, true);
            }
        });

        // ⭐ 2.8 덫(함정) 바닥 렌더링
        if (battle.traps && battle.traps.length > 0) {
            battle.traps.forEach(trap => {
                const caster = battle.units.find(u => u.id === trap.casterId);
                const isAllyTrap = caster && caster.team === 0;

                // 적의 트랩이고 아직 발견되지(isHidden) 않았다면 화면에 아예 그리지 않음 (은신 기믹)
                if (trap.isHidden && !isAllyTrap) return;

                const tData = this.grid.getTerrainData(trap.q, trap.r);
                const hWeight = tData.h || 0;
                const pos = this.grid.hexToPixel3D(trap.q, trap.r, hWeight);
                
                const drawX = pos.x - cam.x;
                const drawY = pos.y - cam.y - (5 * this.grid.scale); // 바닥에 살짝 붙게 위치 보정

                // 화면 밖이면 그리지 않음 (최적화)
                if (drawX < -50 || drawX > screenW + 50 || drawY < -50 || drawY > screenH + 50) return;

                ctx.save();
                
                // 아군의 트랩이면서 숨겨진 상태면 플레이어에게 보이도록 반투명하게 렌더링
                if (trap.isHidden && isAllyTrap) {
                    ctx.globalAlpha = 0.6;
                }
                
                // 트랩 아이콘 그리기 (살짝씩 맥박이 뛰는 애니메이션 추가)
                const trapPulse = 0.8 + Math.abs(Math.sin(Date.now() * 0.004)) * 0.2;
                ctx.globalAlpha = ctx.globalAlpha * trapPulse;
                
                ctx.fillStyle = "white"; 
                ctx.font = `${24 * this.grid.scale}px serif`; 
                ctx.textAlign = "center"; 
                ctx.textBaseline = "middle";
                ctx.fillText(trap.icon || '🪤', drawX, drawY); 
                
                ctx.restore();
            });
        }

        // =====================================================================
        // ⭐ [오류 4 완벽 해결] 3. 유닛 Z-Sorting 렌더링 적용!
        // =====================================================================
        // Y좌표(화면 아래쪽)가 큰 유닛이 나중에 그려져서 앞을 가리도록 정렬합니다.
        
        let drawableUnits = [];
        
        battle.units.forEach(u => { 
            // 그릴 가치가 있는 유닛만 추출
            if (u.curHp > 0 || u.isIncapacitated || u.isWall || u.curHp <= 0) {
                if (this.isOnScreen(u, cam, screenW, screenH)) {
                    
                    // 각 유닛의 실시간 화면 픽셀 Y좌표를 계산하여 달아줍니다.
                    const tData = this.grid.getTerrainData(u.q, u.r);
                    const hWeight = tData.h || 0; 
                    
                    let drawY = u.visualPos ? (u.visualPos.y - cam.y) : (this.grid.hexToPixel3D(u.q, u.r, hWeight).y - cam.y);
                    u._sortY = drawY; // 정렬을 위한 캐싱
                    
                    drawableUnits.push(u);
                }
            } 
        });

        // Y좌표 기준으로 오름차순 정렬 (시체가 바닥에 깔리도록 추가 보정)
        drawableUnits.sort((a, b) => {
            // ⭐ [묘비 겹침 버그 수정] 완전한 시체뿐만 아니라 '사망 유예(전투 불능)' 상태인 캐릭터도 무조건 최하단에 깔리도록 조건 완화
            const aIsDeadOrDying = a.curHp <= 0;
            const bIsDeadOrDying = b.curHp <= 0;

            if (aIsDeadOrDying && !bIsDeadOrDying) return -1; // a가 죽었고 b가 살아있으면 a를 먼저 그려서 바닥에 깖
            if (bIsDeadOrDying && !aIsDeadOrDying) return 1;  // b가 죽었고 a가 살아있으면 b를 먼저 깖
            
            // 상태가 같다면 화면의 Y좌표에 따라 정렬 (값이 작을수록 위쪽이므로 먼저 그려서 뒤로 보냄)
            return a._sortY - b._sortY;
        });

        // 정렬된 순서대로 그리기
        drawableUnits.forEach(u => {
            this.drawUnit(u, cam, u.curHp <= 0 && !u.isIncapacitated);
        });

        // ⭐ [최적화 반영] 4. 시각 효과(VFX) 및 발사체 일괄 렌더링
        this._renderVFX(ctx, cam);

        this.animationFrameId = requestAnimationFrame(this.loop);
    }
    // =====================================================================
    // ⭐ [신규] VFX 컨트롤 매니저
    // 외부(BattleSystem)에서 렌더러의 playVFX를 호출하여 이펙트를 발동시킵니다.
    // =====================================================================
    playVFX(type, startPos, targetPos, options = {}) {
        // startPos와 targetPos는 월드 픽셀 좌표 {x, y} 가 들어와야 합니다.
        this.vfxList.push({
            type: type, // 'ARROW' (포물선), 'MAGIC' (직사), 'SLASH' (근접베기), 'EXPLOSION' (타격폭발)
            startPos: startPos || targetPos, 
            targetPos: targetPos,
            t: 0, // 진행도 (0 ~ 1)
            speed: options.speed || 0.06, // 애니메이션 속도
            color: options.color || "#ffffff",
            arcHeight: options.arcHeight || (60 * this.grid.scale) // 포물선 높이 (기본값)
        });
    }

    _renderVFX(ctx, cam) {
        if (this.vfxList.length === 0) return;

        // 역순 순회로 렌더링 중 안전하게 배열 요소 삭제(Garbage Collection)를 수행합니다.
        for (let i = this.vfxList.length - 1; i >= 0; i--) {
            const vfx = this.vfxList[i];
            vfx.t += vfx.speed; 

            // 애니메이션이 끝났을 때
            if (vfx.t >= 1) {
                // 투사체(화살, 마법)가 목표에 명중했다면 타격 이펙트 연계
                if (vfx.type === 'ARROW' || vfx.type === 'MAGIC') {
                    this.playVFX('EXPLOSION', null, vfx.targetPos, { color: vfx.color, speed: 0.08 });
                }
                this.vfxList.splice(i, 1);
                continue;
            }

            ctx.save();
            // 화면 렌더링용 상대 좌표 변환
            const startX = vfx.startPos.x - cam.x;
            const startY = vfx.startPos.y - cam.y - (15 * this.grid.scale); // 몸통 높이 보정
            const targetX = vfx.targetPos.x - cam.x;
            const targetY = vfx.targetPos.y - cam.y - (15 * this.grid.scale);

            // 선형 보간(Lerp)으로 현재 X, Y 위치 계산
            let curX = startX + (targetX - startX) * vfx.t;
            let curY = startY + (targetY - startY) * vfx.t;

            if (vfx.type === 'ARROW') {
                // 🟠 1. 포물선 궤적 (활, 투척)
                // Math.sin 곡선을 이용하여 t가 0.5일 때 최고점(arcHeight)에 도달하도록 계산
                curY -= Math.sin(vfx.t * Math.PI) * vfx.arcHeight;

                // 날아가는 방향(각도) 계산을 위해 바로 다음 프레임의 위치를 추적하여 atan2 적용
                const nextT = vfx.t + 0.05;
                const nextX = startX + (targetX - startX) * nextT;
                let nextY = startY + (targetY - startY) * nextT;
                nextY -= Math.sin(nextT * Math.PI) * vfx.arcHeight;
                const angle = Math.atan2(nextY - curY, nextX - curX);

                ctx.translate(curX, curY);
                ctx.rotate(angle);
                
                // 화살 그리기 (무거운 이미지 로드 대신 순수 캔버스 Path로 최적화)
                ctx.fillStyle = '#e0e0e0';
                ctx.fillRect(-10, -1, 20, 2); // 화살대
                ctx.fillStyle = '#ff3333';
                ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(16, 0); ctx.lineTo(10, 4); ctx.fill(); // 화살촉
            } 
            else if (vfx.type === 'MAGIC') {
                // 🔵 2. 직사 궤적 (마법, 레이저, 총알)
                ctx.translate(curX, curY);
                
                // 안쪽 밝은 코어
                ctx.beginPath();
                ctx.arc(0, 0, 6 * this.grid.scale, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                
                // 바깥쪽 반투명 아우라 (shadowBlur를 쓰지 않아 프레임 방어)
                ctx.globalAlpha = 0.5;
                ctx.beginPath(); 
                ctx.arc(0, 0, 14 * this.grid.scale, 0, Math.PI * 2); 
                ctx.fillStyle = vfx.color;
                ctx.fill();
            } 
            else if (vfx.type === 'SLASH') {
                // 🔴 3. 근접 타격 궤적 (반달 베기)
                // 시작점에서 대상점 방향으로 각도를 맞춰 목표물 앞에 칼날 이펙트를 그립니다.
                const angle = Math.atan2(targetY - startY, targetX - startX);
                ctx.translate(targetX, targetY);
                ctx.rotate(angle);
                
                // 진행도(t)가 높아질수록 곡선이 커지고, 점점 투명하게 사라짐
                ctx.globalAlpha = 1 - Math.pow(vfx.t, 2); 
                ctx.beginPath();
                ctx.arc(0, 0, 15 + (vfx.t * 20), -Math.PI/2.5, Math.PI/2.5);
                ctx.lineWidth = 4 * this.grid.scale;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            } 
            else if (vfx.type === 'EXPLOSION') {
                // 💥 4. 폭발 / 피격 이펙트 (원형 파형)
                ctx.translate(targetX, targetY);
                ctx.globalAlpha = 1 - Math.pow(vfx.t, 1.5);
                
                const radius = 5 + (vfx.t * 30 * this.grid.scale);
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fillStyle = vfx.color;
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // 화면 밖 체크 헬퍼
    isOnScreen(u, cam, w, h) {
        const pos = u.visualPos || this.grid.hexToPixel3D(u.q, u.r, 0); // 근사치
        const x = pos.x - cam.x;
        const y = pos.y - cam.y;
        return (x > -100 && x < w + 100 && y > -100 && y < h + 100);
    }

    getDrawPos(q, r, height, cam) {
        const p = this.grid.hexToPixel3D(q, r, height);
        return { x: p.x - cam.x, y: p.y - cam.y };
    }

    // ★ [핵심] 육각 기둥 그리기 (윗면 + 옆면) - 디오라마 토대 및 입체 명암 적용
    _drawHexPrismFast(ctx, typeInfo, height, cam, topX, topY, size, tilt, q, r) {
        
        // ⭐ [해결 1] 높이(height) 조건문 삭제 및 기본 두께 부여
        // 높이가 0이거나 음수인 지형(물 등)도 무조건 아래로 토대가 뻗도록 만듭니다.
        // 이 두께(40) 덕분에 낮은 지형 뒤로 구멍이 뚫려 뒷배경이 보이던 현상이 완벽히 사라집니다.
        const baseThickness = 40 * this.grid.scale; 
        
        const baseCenter = this.grid.hexToPixel3D(q, r, 0); 
        const baseX = baseCenter.x - cam.x;
        const baseY = baseCenter.y - cam.y + baseThickness; // 바닥면을 강제로 깊게 내림

        // 옆면 베이스 색상 (데이터에 side나 sideColor가 없으면 color 사용)
        const baseSideColor = typeInfo.sideColor || typeInfo.side || typeInfo.color;

        // 카메라에서 보여야 하는 기둥의 4면(좌측, 좌측앞, 우측앞, 우측) 렌더링
        [2, 1, 0, 5].forEach(i => {
            const next = (i + 1) % 6;
            
            ctx.beginPath();
            ctx.moveTo(topX + size * this.hexOffsets[i].cos, topY + size * this.hexOffsets[i].sin * tilt);
            ctx.lineTo(topX + size * this.hexOffsets[next].cos, topY + size * this.hexOffsets[next].sin * tilt);
            ctx.lineTo(baseX + size * this.hexOffsets[next].cos, baseY + size * this.hexOffsets[next].sin * tilt);
            ctx.lineTo(baseX + size * this.hexOffsets[i].cos, baseY + size * this.hexOffsets[i].sin * tilt);
            ctx.closePath();

            // 1단계: 기본 색상 채우기 및 쓸모없는 선(Seam) 방지
            ctx.fillStyle = baseSideColor;
            ctx.strokeStyle = baseSideColor; 
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke(); 

            // ⭐ [해결 2] 입체 조명(Shading) 적용
            // 빛이 좌측 상단에서 우측 하단으로 비춘다고 가정하고 각 면에 명암을 줍니다.
            let shadeColor = "transparent";
            if (i === 2) shadeColor = "rgba(255, 255, 255, 0.15)";      // 좌측 면 (빛을 정면으로 받아 가장 밝음)
            else if (i === 1) shadeColor = "rgba(0, 0, 0, 0.1)";        // 좌측 앞면 (기본 음영)
            else if (i === 0) shadeColor = "rgba(0, 0, 0, 0.3)";        // 우측 앞면 (어두워지기 시작)
            else if (i === 5) shadeColor = "rgba(0, 0, 0, 0.5)";        // 우측 면 (그림자가 져서 가장 어두움)
            
            // 2단계: 명암 오버레이 덧칠하기
            if (shadeColor !== "transparent") {
                ctx.fillStyle = shadeColor;
                ctx.strokeStyle = shadeColor;
                ctx.fill();
                ctx.stroke();
            }
        });

        // 2. 윗면 (Top) 그리기
        ctx.fillStyle = typeInfo.color;
        ctx.strokeStyle = "rgba(255,255,255,0.2)"; // 윗면 테두리에 은은한 하이라이트
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        for(let i = 0; i < 6; i++) {
            const px = topX + size * this.hexOffsets[i].cos;
            const py = topY + size * this.hexOffsets[i].sin * tilt;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // 기존 drawHexPrism은 외부 호환성을 위해 유지
    drawHexPrism(q, r, typeInfo, height, cam) {
        const size = HEX_SIZE * this.grid.scale;
        const tilt = this.grid.tilt || 1;
        const topCenter = this.grid.hexToPixel3D(q, r, height);
        const topX = topCenter.x - cam.x;
        const topY = topCenter.y - cam.y;
        this._drawHexPrismFast(this.ctx, typeInfo, height, cam, topX, topY, size, tilt, q, r);
    }

    drawBuilding(q, r, height, bInfo, text, cam, targetCtx = this.ctx) {
        const ctx = targetCtx; // 파라미터로 넘어온 컨텍스트를 우선 사용 (캐시 작업 보장)
        const size = HEX_SIZE * this.grid.scale;
        const p = this.grid.hexToPixel3D(q, r, height); 
        const x = p.x - cam.x;
        const y = p.y - cam.y;
        
        // 아이콘을 타일 위로 띄움
        const iconY = y - (size * 0.6); 
        
        ctx.fillStyle = "#fff";
        ctx.font = `${size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(bInfo.icon, x, iconY);
        
        if (text) {
            ctx.font = 'bold 10px sans-serif';
            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(x - textWidth/2 - 3, iconY - size + 2, textWidth + 6, 14);
            ctx.fillStyle = "#ffd700";
            ctx.fillText(text, x, iconY - size + 9);
        }
    }

    drawUnit(u, cam, isDead) {
        const ctx = this.ctx;
        const tData = this.grid.getTerrainData(u.q, u.r);
        const hWeight = tData.h || 0; 
        
        let drawX, drawY;
        if (u.visualPos) {
            drawX = u.visualPos.x - cam.x;
            drawY = u.visualPos.y - cam.y;
        } else {
            const pos = this.grid.hexToPixel3D(u.q, u.r, hWeight);
            drawX = pos.x - cam.x;
            drawY = pos.y - cam.y;
        }
        
        // 유닛을 타일 위에 세우기 (Y축 보정)
        drawY -= (10 * this.grid.scale); 

        if (u.shake > 0) {
            drawX += (Math.random() - 0.5) * u.shake; drawY += (Math.random() - 0.5) * u.shake;
            u.shake *= 0.9;
        }
        if (u.bumpX || u.bumpY) {
            drawX += u.bumpX; drawY += u.bumpY;
            u.bumpX *= 0.8; u.bumpY *= 0.8;
        }
        
        // ⭐ [최적화 1] 치명적인 성능 저하를 일으키는 ctx.filter 제거
        const previousAlpha = ctx.globalAlpha;
        if (isDead) {
            ctx.globalAlpha = 0.5; // 필터 대신 반투명으로 죽음을 가볍게 표현
        }

        // ⭐ [중복 렌더링 방지 핵심 로직]
        const isTerrainIntegratedObject = u.type === 'OBJECT' && (u.key === 'WALL_PILLAR' || (u.key && u.key.includes('ZONE')));
        
        if (!isTerrainIntegratedObject) {
            // ⭐ [반투명화 수정] 은신 상태 및 덫 반투명화 캔버스 적용
            const isStealthed = u.buffs && u.buffs.some(b => b.type.includes('STEALTH'));
            const isTrap = u.key && u.key.includes('TRAP');
            if (isStealthed || isTrap) ctx.globalAlpha = 0.4;

            // 그림자
            ctx.beginPath(); 
            ctx.ellipse(drawX, drawY + 15 * this.grid.scale, 15 * this.grid.scale, 8 * this.grid.scale, 0, 0, Math.PI*2);
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fill();

            // ⭐ [버그 수정] 단순히 존재하는지 뿐만 아니라, 진짜 '이미지 객체'인지 확실히 검증 (세이브 파일 오염 방어)
            const spriteKey = u.classKey || u.key || u.race;
            const imagePath = STANDING_DATA[spriteKey];
            
            let isSpriteDrawn = false; // 스프라이트를 성공적으로 그렸는지 확인하는 플래그

            if (imagePath) {
                // 1. 메모리에 아직 이 캐릭터의 이미지가 없다면 로딩을 시작합니다.
                if (!this.imageStore[spriteKey]) {
                    const img = new Image();
                    img.src = imagePath;
                    this.imageStore[spriteKey] = img;
                }

                const img = this.imageStore[spriteKey];
                
                // 2. 이미지가 완벽하게 로딩 완료되었을 때만 캔버스에 그립니다.
                if (img.complete && img.naturalWidth > 0) {
                    isSpriteDrawn = true;
                    
                    const frameWidth = 100;  
                    const frameHeight = 100; 
                    
                    // ⭐ [핵심 1] 캐릭터 빌보딩: 맵이 회전한 만큼 캐릭터의 방향 인덱스도 더해(+) 줍니다.
                    const logicalFacing = u.facing !== undefined ? u.facing : (u.team === 0 ? 0 : 3);
                    const visualFacing = (logicalFacing + this.grid.cameraRotation) % 6;
                    const sx = visualFacing * frameWidth;
                    
                    // ⭐ [요청 반영 1] 아군(team === 0)이면서 쓰러진 경우 흑백 필터 적용
                    
                    // ⭐ [요청 반영 1] 아군(team === 0)이면서 쓰러진 경우 흑백 필터 적용
                    // 죽은 유닛에게만 제한적으로 사용하므로 최적화에 영향을 주지 않습니다.
                    if (u.team === 0 && u.curHp <= 0) {
                        ctx.filter = 'grayscale(100%) brightness(70%)';
                    }

                    ctx.drawImage(
                        img, 
                        sx, 0, frameWidth, frameHeight, 
                        drawX - (frameWidth / 2), drawY - (frameHeight / 2) - 25, 
                        frameWidth, frameHeight
                    );
                    
                    // 필터 원상 복구 (살아있는 유닛에 전염되지 않도록 반드시 리셋)
                    ctx.filter = 'none';
                    
                    // ⭐ [근본 해결 3] 전역 객체 대신 주입받은 this.battle 참조
                    if (this.battle && this.battle.currentUnit === u) { 
                        ctx.beginPath(); 
                        ctx.ellipse(drawX, drawY + 15 * this.grid.scale, 18 * this.grid.scale, 10 * this.grid.scale, 0, 0, Math.PI*2);
                        ctx.strokeStyle = "gold"; ctx.lineWidth = 3; ctx.stroke(); 
                    }

                    // 폴리모프 상태 아이콘 덧그리기
                    if (u.buffs && u.buffs.some(b => b.type === 'CC_POLYMORPH')) {
                        ctx.fillStyle = "white"; 
                        ctx.font = `${22 * this.grid.scale}px serif`;
                        ctx.textAlign = "center"; 
                        ctx.textBaseline = "middle";
                        ctx.fillText('🐑', drawX, drawY); 
                    }
                }
            }

            // ⭐ 3. 만약 이미지가 없거나, 아직 로딩 중이라면 기존의 임시 도형을 그립니다.
            if (!isSpriteDrawn) {
                if (u.isWall) {
                    const w = 36 * this.grid.scale;
                    const h = 44 * this.grid.scale;
                    if (u.key && u.key.includes('FIRE')) ctx.fillStyle = "rgba(220, 60, 20, 0.85)"; 
                    else if (u.key && u.key.includes('ICE')) ctx.fillStyle = "rgba(100, 200, 255, 0.85)"; 
                    else ctx.fillStyle = "rgba(130, 90, 50, 0.9)"; 
                    
                    ctx.fillRect(drawX - w/2, drawY - h/2, w, h);
                    ctx.strokeStyle = "rgba(255,255,255,0.6)"; 
                    ctx.lineWidth = 2; 
                    ctx.strokeRect(drawX - w/2, drawY - h/2, w, h);
                } 
                else {
                    ctx.beginPath(); 
                    ctx.arc(drawX, drawY, 22 * this.grid.scale, 0, Math.PI*2);
                    if (u.team === 0) ctx.fillStyle = "rgba(60, 100, 170, 0.9)";
                    else if (u.team === 2) ctx.fillStyle = "rgba(100, 150, 100, 0.9)";
                    else ctx.fillStyle = "rgba(180, 60, 60, 0.9)";
                    ctx.fill();
                    
                    if (!isDead) this.drawCompass(ctx, u, drawX, drawY);
                    
                    // ⭐ [근본 해결 4] 전역 객체 대신 주입받은 this.battle 참조
                    if (this.battle && this.battle.currentUnit === u) { 
                        ctx.strokeStyle = "gold"; ctx.lineWidth = 3; ctx.stroke(); 
                    } else {
                        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.stroke();
                    }
                }

                // 아이콘 표시 (기존 유닛용)
                let displayIcon = u.icon || '❓';
                if (u.buffs && u.buffs.some(b => b.type === 'CC_POLYMORPH')) displayIcon = '🐑';
                
                ctx.fillStyle = "white"; 
                ctx.font = `${(u.isWall ? 26 : 22) * this.grid.scale}px serif`; 

                // ⭐ [개선] 전투 불능이거나 시체 상태라면 촌스럽게 거대한 아이콘을 대폭 축소 (14px)
                if (isDead || u.curHp <= 0) {
                    ctx.font = `${14 * this.grid.scale}px serif`;
                    ctx.globalAlpha = 0.8; // 살짝 투명하게 해서 전장 가림 방지
                    displayIcon = '🪦'; // 거대한 해골이나 이상한 아이콘 대신 작은 묘비 고정
                }

                ctx.textAlign = "center"; 
                ctx.textBaseline = "middle";
                ctx.fillText(displayIcon, drawX, drawY); 
            }
        }

        // =================================================================
        // ⭐ [신규] 전장 맵 위 흑백 캐릭터 머리 위에 '사망 유예 카운트다운' 상시 렌더링
        // =================================================================
        if (u.curHp <= 0 && u.isIncapacitated) {
            ctx.save();
            const textY = drawY - (45 * this.grid.scale); // 머리 살짝 위로 띄움
            const timer = u.deathTimer || 0;
            
            // 1. 검은색 원형 배경
            ctx.beginPath();
            ctx.arc(drawX, textY, 14 * this.grid.scale, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            ctx.fill();
            
            // 2. 경고 펄스 테두리 (1턴 남았을 때 강하게 깜빡임)
            const pulseAlert = 0.5 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.5;
            ctx.strokeStyle = timer === 1 ? `rgba(255, 50, 50, ${pulseAlert})` : `rgba(255, 180, 50, 0.8)`;
            ctx.lineWidth = 2 * this.grid.scale;
            ctx.stroke();

            // 3. 깔끔한 카운트다운 숫자 (아이콘 제거)
            ctx.font = `bold ${16 * this.grid.scale}px sans-serif`; 
            ctx.fillStyle = timer === 1 ? "#ff5555" : "#ffcc00"; 
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle";
            ctx.fillText(timer, drawX, textY + 1);   
            ctx.restore();
        }
        
        // ⭐ [최적화 1] Alpha 원상 복구 (필터 해제 대신)
        ctx.globalAlpha = previousAlpha;
    }

    drawZone(q, r, color, cam, glow = false) {
        const tData = this.grid.getTerrainData(q, r);
        const h = tData.h || 0;
        const center = this.getDrawPos(q, r, h, cam); // 높이에 맞춰 그림
        const size = HEX_SIZE * this.grid.scale - 2;
        
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        for(let i=0; i<6; i++) {
            const px = center.x + size * this.hexOffsets[i].cos;
            const py = center.y + size * this.hexOffsets[i].sin * (this.grid.tilt || 1);
            i===0 ? this.ctx.moveTo(px,py) : this.ctx.lineTo(px,py);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    drawZoneOutline(q, r, color, cam, isDashed = false) {
        const tData = this.grid.getTerrainData(q, r);
        const h = tData.h || 0;
        const center = this.getDrawPos(q, r, h, cam);
        const size = HEX_SIZE * this.grid.scale - 1;
        
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        if(isDashed) {
            const offset = (Date.now()/40)%15;
            this.ctx.setLineDash([10,5]);
            this.ctx.lineDashOffset = -offset;
        }
        this.ctx.beginPath();
        for(let i=0; i<6; i++) {
            const px = center.x + size * this.hexOffsets[i].cos;
            const py = center.y + size * this.hexOffsets[i].sin * (this.grid.tilt || 1);
            i===0 ? this.ctx.moveTo(px,py) : this.ctx.lineTo(px,py);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawCompass(ctx, u, x, y) {
        // ⭐ [핵심 2] 컴퍼스(시선 화살표) 빌보딩: 회전된 화면에서도 정확한 방향을 가리키도록 보정
        const logicalFacing = u.facing !== undefined ? u.facing : (u.team === 0 ? 0 : 3);
        const visualFacing = (logicalFacing + this.grid.cameraRotation) % 6;
        const angleRad = (visualFacing * 60) * (Math.PI / 180);
        
        const radius = 22 * this.grid.scale;
        
        ctx.save();
        ctx.translate(x, y);
        
        const pointerSize = 6 * this.grid.scale;
        const px = (radius + 4) * Math.cos(angleRad);
        const py = (radius + 4) * Math.sin(angleRad) * (this.grid.tilt || 1);
        
        ctx.fillStyle = "#ffd700"; // 금색 화살표
        ctx.beginPath();
        ctx.translate(px, py);
        ctx.rotate(angleRad);
        ctx.moveTo(0, 0);
        ctx.lineTo(-pointerSize, -pointerSize * 0.6);
        ctx.lineTo(-pointerSize, pointerSize * 0.6);
        ctx.fill();
        ctx.restore();
    }

    darkenColor(color, percent) {
        return "rgba(0,0,0,0.3)";
    }
}