import { TERRAIN_TYPES, HEX_SIZE, BUILDING_TYPES } from '../data/index.js';
import { STANDING_DATA } from '../data/standing.js';
export class GameRenderer {
    constructor(canvas, hexGrid) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = hexGrid;
        
        this.cachedState = { skillId: null, hoverQ: null, hoverR: null };
        this.cachedSkillZone = [];
        this.cachedAreaZone = [];
        this.isDestroyed = false;
        this.imageStore = {};
        
        // 육각형 꼭짓점 오프셋 미리 계산 (매 프레임 삼각함수 연산 방지)
        this.hexOffsets = [];
        for (let i = 0; i < 6; i++) {
            const rad = (60 * i + 30) * Math.PI / 180;
            this.hexOffsets.push({ cos: Math.cos(rad), sin: Math.sin(rad) });
        }
        
        this.loop = this.loop.bind(this);
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    destroy() {
        this.isDestroyed = true; 
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    loop() {
        if (this.isDestroyed || !window.isBattleActive || !window.battle || window.renderer !== this) return;

        const ctx = this.ctx;
        const battle = window.battle;
        const cam = battle.camera;
        const screenW = this.canvas.width;
        const screenH = this.canvas.height;

        ctx.clearRect(0, 0, screenW, screenH);

        const time = Date.now() * 0.003;
        const pulse = 0.2 + Math.abs(Math.sin(time * 1.5)) * 0.3;
        const strongPulse = 0.4 + Math.abs(Math.sin(time * 2.5)) * 0.4;

        // ✅ 정렬된 헥스 가져오기 (hex.js에서 Z-Index 순서로 이미 정렬됨)
        const sortedHexes = this.grid.getSortedHexes();
        
        const size = HEX_SIZE * this.grid.scale;
        const tilt = this.grid.tilt || 1;

        // 1. 지형 그리기 (블록 형태)
        sortedHexes.forEach(h => {
            const tData = this.grid.getTerrainData(h.q, h.r);
            const height = tData.h || 0;
            
            // 3D 좌표 변환
            const topCenter = this.grid.hexToPixel3D(h.q, h.r, height);
            const topX = topCenter.x - cam.x;
            const topY = topCenter.y - cam.y;
            
            // 화면 밖 컬링 (넉넉하게 잡음)
            if (topX < -150 || topX > screenW + 150 || topY < -150 || topY > screenH + 150) return;

            const typeInfo = TERRAIN_TYPES[tData.key] || TERRAIN_TYPES['PLAIN'];
            
            // ★ [핵심] 입체 육각 기둥 그리기
            this._drawHexPrismFast(ctx, typeInfo, height, cam, topX, topY, size, tilt, h.q, h.r);

            // 건물 그리기 (높이 위에 얹기)
            if (tData.building) {
                const bInfo = BUILDING_TYPES[tData.building.key];
                if (bInfo) {
                    const textToShow = (tData.building.key === 'CHEST') ? null : tData.building.text;
                    this.drawBuilding(h.q, h.r, height, bInfo, textToShow, cam);
                }
            }
        });

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

                    const skipAreaDraw = sArea >= 99 || ['SELF', 'ALLY_ALL', 'ENEMY_ALL', 'GLOBAL'].includes(sTarget);

                    // 마우스 커서가 올라간 곳이 붉은색 타겟팅 범위 내에 있을 때만 스플래시(Area) 범위를 계산
                    const isValidHover = battle.hoverHex && this.cachedSkillZone.some(h => h.q === battle.hoverHex.q && h.r === battle.hoverHex.r);

                    if (!skipAreaDraw && isValidHover) {
                        const areaStr = String(skill.area || '0').toUpperCase();
                        
                        if (areaStr.includes('LINE') || sTarget.includes('LINE')) {
                            // 방향성 뻥튀기 반영(rngBonus는 RangeManager에서 이미 더해져서 넘어옴)
                            const lineLen = parseInt(areaStr.replace('LINE_', '')) || parseInt(skill.rng) || 1;
                            this.cachedAreaZone = this.grid.getLine(battle.currentUnit, battle.hoverHex, lineLen);
                        } 
                        else if (this.grid.getShapeHexes) {
                            this.cachedAreaZone = this.grid.getShapeHexes(battle.hoverHex, battle.currentUnit, areaStr);
                        } 
                        else {
                            const targetQ = battle.hoverHex.q;
                            const targetR = battle.hoverHex.r;
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

        // ⭐ [신규 반영] 2.8 덫(함정) 바닥 렌더링
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

        // 3. 유닛 그리기 (시체 먼저 -> 산 유닛)
        battle.units.forEach(u => { 
            // ⭐ [버그 수정 2] 전투 불능(isIncapacitated) 상태인 유닛도 캔버스에 그리도록 예외 추가
            if (u.curHp > 0 || u.isIncapacitated || u.isWall) {
                // u.curHp <= 0 이면 자동으로 isDead가 true로 넘어가며 흑백 처리됩니다.
                if (this.isOnScreen(u, cam, screenW, screenH)) this.drawUnit(u, cam, u.curHp <= 0);
            } 
        });

        // 4. 발사체 그리기
        if (battle.projectiles) {
            for (let i = battle.projectiles.length - 1; i >= 0; i--) {
                let p = battle.projectiles[i]; 
                p.t += p.speed;
                const curX = p.x + (p.tx - p.x) * p.t - cam.x; 
                const curY = p.y + (p.ty - p.y) * p.t - cam.y;
                
                // 발사체 그림자
                ctx.beginPath(); ctx.arc(curX, curY + 20, 4, 0, Math.PI*2);
                ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();

                // 발사체 본체
                ctx.beginPath(); ctx.arc(curX, curY, 6, 0, Math.PI*2);
                ctx.fillStyle = "#ffffaa"; ctx.fill();
                ctx.strokeStyle = "#fff"; ctx.stroke();

                if (p.t >= 1) battle.projectiles.splice(i, 1);
            }
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
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

    // ★ [핵심] 육각 기둥 그리기 (윗면 + 옆면)
    _drawHexPrismFast(ctx, typeInfo, height, cam, topX, topY, size, tilt, q, r) {
        // 1. 옆면 (Side) 그리기
        if (height > 0) {
            const baseCenter = this.grid.hexToPixel3D(q, r, 0); // 바닥 좌표 (h=0)
            const baseX = baseCenter.x - cam.x;
            const baseY = baseCenter.y - cam.y;

            // 옆면 색상 (윗면보다 조금 어둡게)
            ctx.fillStyle = typeInfo.sideColor || this.darkenColor(typeInfo.color, -40);
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.lineWidth = 1;

            // 6개 면 전체 그리기
            [0, 1, 2, 3, 4, 5].forEach(i => {
                const next = (i + 1) % 6;
                
                ctx.beginPath();
                ctx.moveTo(topX + size * this.hexOffsets[i].cos, topY + size * this.hexOffsets[i].sin * tilt);
                ctx.lineTo(topX + size * this.hexOffsets[next].cos, topY + size * this.hexOffsets[next].sin * tilt);
                ctx.lineTo(baseX + size * this.hexOffsets[next].cos, baseY + size * this.hexOffsets[next].sin * tilt);
                ctx.lineTo(baseX + size * this.hexOffsets[i].cos, baseY + size * this.hexOffsets[i].sin * tilt);
                ctx.closePath();
                ctx.fill();
                ctx.stroke(); 
            });
        }

        // 2. 윗면 (Top) 그리기
        ctx.fillStyle = typeInfo.color;
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; // 테두리 밝게
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

    drawBuilding(q, r, height, bInfo, text, cam) {
        const ctx = this.ctx;
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
        
        if (isDead) ctx.filter = 'grayscale(100%) brightness(0.5)';

        // ⭐ [중복 렌더링 방지 핵심 로직]
        // 돌기둥(WALL_PILLAR)은 이미 3D 헥스 지형으로 높게 솟아올라 표현되었고,
        // 독 장판/화염 장판(ZONE)은 위쪽의 2.5 단계 로직에서 바닥 색상으로 미리 깔렸습니다.
        // 따라서 이런 환경 통합형 오브젝트들은 흉측한 "유닛 배경(사각형/원형 박스)"을 그리지 않고 생략합니다!
        const isTerrainIntegratedObject = u.type === 'OBJECT' && (u.key === 'WALL_PILLAR' || (u.key && u.key.includes('ZONE')));
        
        if (!isTerrainIntegratedObject) {
            // ⭐ [반투명화 수정] 은신 상태 및 덫 반투명화 캔버스 적용
            const isStealthed = u.buffs && u.buffs.some(b => b.type.includes('STEALTH'));
            const isTrap = u.key && u.key.includes('TRAP');
            if (isStealthed || isTrap) this.ctx.globalAlpha = 0.4;

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
                    const facing = u.facing !== undefined ? u.facing : (u.team === 0 ? 0 : 3);
                    const sx = facing * frameWidth;
                    
                    ctx.drawImage(
                        img, 
                        sx, 0, frameWidth, frameHeight, 
                        drawX - (frameWidth / 2), drawY - (frameHeight / 2) - 25, 
                        frameWidth, frameHeight
                    );
                    
                    // 선택 테두리 (스프라이트용)
                    if (window.battle && window.battle.currentUnit === u) { 
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
                    
                    if (window.battle && window.battle.currentUnit === u) { 
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
                ctx.textAlign = "center"; 
                ctx.textBaseline = "middle";
                ctx.fillText(displayIcon, drawX, drawY); 
            }
            
            // ⭐ [반투명화 수정] 다음 유닛 렌더링에 영향을 주지 않도록 투명도 원상 복구
            this.ctx.globalAlpha = 1.0;
        }
        
        if (isDead) ctx.filter = 'none';
        
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
        const facing = u.facing !== undefined ? u.facing : (u.team === 0 ? 0 : 3);
        const angleRad = (facing * 60) * (Math.PI / 180);
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

    // 색상 어둡게 만드는 유틸 (간단히 반투명 검정 오버레이로 구현)
    darkenColor(color, percent) {
        return "rgba(0,0,0,0.3)";
    }
}