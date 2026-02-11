import { TERRAIN_TYPES, HEX_SIZE, BUILDING_TYPES } from '../data/index.js'; // [수정] BUILDING_TYPES 추가

export class GameRenderer {
    constructor(canvas, hexGrid) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = hexGrid;
        
        // 애니메이션 루프 시작
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    // 메인 렌더링 루프
    loop() {
        if (!window.isBattleActive || !window.battle) {
            requestAnimationFrame(this.loop);
            return;
        }

        const ctx = this.ctx;
        const battle = window.battle;
        const cam = battle.camera;

        // 1. 화면 초기화
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. 호흡 효과
        const time = Date.now() * 0.003;
        const pulse = 0.2 + Math.abs(Math.sin(time * 1.5)) * 0.3;
        const strongPulse = 0.4 + Math.abs(Math.sin(time * 2.5)) * 0.4;

        // 3. 지형 및 건물 그리기 (Z-Sorting)
        const sortedHexes = this.grid.getSortedHexes();
        sortedHexes.forEach(h => {
            // [수정] Grid에서 타일 데이터(key, h, building)를 가져옴
            const tData = this.grid.getTerrainData(h.q, h.r);
            const typeInfo = TERRAIN_TYPES[tData.key] || TERRAIN_TYPES['GRASS_01'];
            
            // 3-1. 지형(기둥) 그리기
            this.drawHexPrism(h.q, h.r, typeInfo, tData.h, cam);

            // 3-2. [추가] 건물 그리기
            if (tData.building) {
                const bInfo = BUILDING_TYPES[tData.building.key];
                if (bInfo) {
                    // ▼▼▼ [수정됨] 상자(CHEST)가 아닐 때만 텍스트를 보여줌 ▼▼▼
                    const textToShow = (tData.building.key === 'CHEST') ? null : tData.building.text;
                    
                    this.drawBuilding(h.q, h.r, tData.h, bInfo, textToShow, cam);
                }
            }
        });

        // 4. 범위 가이드
        if (battle.currentUnit && battle.currentUnit.team === 0 && !battle.isProcessingTurn) {
            if (battle.selectedSkill) {
                const skill = battle.selectedSkill;
                this.grid.hexes.forEach(h => {
                    if (this.grid.getDistance(h, battle.currentUnit) <= skill.rng) {
                        this.drawZoneOutline(h.q, h.r, `rgba(255, 230, 80, ${pulse})`, cam);
                    }
                });
                if (battle.hoverHex && this.grid.getDistance(battle.currentUnit, battle.hoverHex) <= skill.rng) {
                    let affected = [];
                    if (skill.main.target === 'LINE') {
                        affected = this.grid.getLine(battle.currentUnit, battle.hoverHex, skill.rng);
                    } else {
                        const area = skill.main.area || 0;
                        this.grid.hexes.forEach(h => { 
                            if (this.grid.getDistance(h, battle.hoverHex) <= area) affected.push(h); 
                        });
                    }
                    affected.forEach(h => this.drawZone(h.q, h.r, `rgba(255, 100, 0, ${strongPulse * 0.7})`, cam, true));
                }
            } else {
                
                if (!battle.actions.moved && battle.reachableHexes) {
                    battle.reachableHexes.forEach(h => {
                        this.drawZone(h.q, h.r, `rgba(0, 160, 255, ${pulse * 0.3})`, cam);
                        this.drawZoneOutline(h.q, h.r, `rgba(0, 200, 255, ${pulse})`, cam);
                    });
                }
            }
        }

        // 5. 마우스 커서
        if (battle.hoverHex) {
            this.drawZoneOutline(battle.hoverHex.q, battle.hoverHex.r, "rgba(255, 255, 255, 0.9)", cam);
        }

        // 6. 유닛 그리기 (시체 -> 산 유닛)
        battle.units.forEach(u => { if (u.curHp <= 0) this.drawUnit(u, cam, true); });
        battle.units.forEach(u => { if (u.curHp > 0) this.drawUnit(u, cam, false); });

        // 7. 발사체
        if (battle.projectiles) {
            for (let i = battle.projectiles.length - 1; i >= 0; i--) {
                let p = battle.projectiles[i]; 
                p.t += p.speed;
                const curX = p.x + (p.tx - p.x) * p.t - cam.x; 
                const curY = p.y + (p.ty - p.y) * p.t - cam.y;
                ctx.beginPath(); ctx.arc(curX, curY, 6, 0, Math.PI*2);
                ctx.fillStyle = "#ffffaa"; ctx.fill();
                if (p.t >= 1) battle.projectiles.splice(i, 1);
            }
        }

        requestAnimationFrame(this.loop);
    }

    getDrawPos(q, r, height, cam) {
        const p = this.grid.hexToPixel3D(q, r, height);
        return { x: p.x - cam.x, y: p.y - cam.y };
    }

    drawHexPrism(q, r, typeInfo, height, cam) {
        const ctx = this.ctx;
        const size = HEX_SIZE * this.grid.scale;
        
        // 3D 좌표 계산 (윗면과 바닥면)
        const topCenter = this.grid.hexToPixel3D(q, r, height);
        const baseCenter = this.grid.hexToPixel3D(q, r, 0);

        // 카메라 적용
        const top = { x: topCenter.x - cam.x, y: topCenter.y - cam.y };
        const base = { x: baseCenter.x - cam.x, y: baseCenter.y - cam.y };

        const getCorners = (c) => {
            const corners = [];
            for (let i = 0; i < 6; i++) {
                const rad = (60 * i + 30) * Math.PI / 180;
                corners.push({
                    x: c.x + size * Math.cos(rad),
                    y: c.y + (size * Math.sin(rad) * this.grid.tilt)
                });
            }
            return corners;
        };

        const topCorners = getCorners(top);
        
        // 높이가 있으면 옆면(기둥) 그리기
        if (height !== 0) {
            const baseCorners = getCorners(base);
            ctx.fillStyle = typeInfo.sideColor;
            
            // 뒷면부터 앞면 순서로 그리기 (3, 4, 5, 0, 1, 2)
            [3, 4, 5, 0, 1, 2].forEach(i => {
                const next = (i + 1) % 6;
                ctx.beginPath();
                ctx.moveTo(topCorners[i].x, topCorners[i].y);
                ctx.lineTo(topCorners[next].x, topCorners[next].y);
                ctx.lineTo(baseCorners[next].x, baseCorners[next].y);
                ctx.lineTo(baseCorners[i].x, baseCorners[i].y);
                ctx.fill();
                // 입체감을 위한 모서리 선
                ctx.strokeStyle = "rgba(0,0,0,0.15)";
                ctx.lineWidth = 1;
                ctx.stroke(); 
            });
        }

        // 윗면 그리기
        ctx.fillStyle = typeInfo.color;
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        topCorners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // [추가] 건물 그리기 메서드
    drawBuilding(q, r, height, bInfo, text, cam) {
        const ctx = this.ctx;
        const size = HEX_SIZE * this.grid.scale;
        
        // 건물은 타일 바닥이 아니라, 타일 높이 위에 그려져야 함
        const p = this.grid.hexToPixel3D(q, r, height); 
        const x = p.x - cam.x;
        const y = p.y - cam.y;

        // 아이콘 위치 (타일 중심보다 약간 위로 올림)
        const iconY = y - (size * 0.5);

        // 1. 그림자
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 5;

        // 2. 아이콘
        ctx.fillStyle = "#fff";
        ctx.font = `${size}px serif`;
        ctx.fillText(bInfo.icon, x, iconY);
        
        ctx.shadowBlur = 0; // 그림자 초기화

        // 3. 텍스트 라벨 (있으면)
        if (text) {
            ctx.font = 'bold 10px sans-serif';
            const textWidth = ctx.measureText(text).width;
            
            // 배경 박스
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(x - textWidth/2 - 3, iconY - size + 2, textWidth + 6, 14);
            
            // 글자
            ctx.fillStyle = "#ffd700";
            ctx.fillText(text, x, iconY - size + 9);
        }
    }

    drawUnit(u, cam, isDead) {
        const ctx = this.ctx;
        
        const tData = this.grid.getTerrainData(u.q, u.r);
        const hWeight = tData.h || 0; 
        
        let drawX, drawY;

        // 이동 중이면 visualPos 사용, 아니면 그리드 좌표 계산
        if (u.visualPos) {
            drawX = u.visualPos.x - cam.x;
            drawY = u.visualPos.y - cam.y;
        } else {
            const pos = this.grid.hexToPixel3D(u.q, u.r, hWeight);
            drawX = pos.x - cam.x;
            drawY = pos.y - cam.y;
        }

        if (u.shake > 0) {
            drawX += (Math.random() - 0.5) * u.shake; drawY += (Math.random() - 0.5) * u.shake;
            u.shake *= 0.9;
        }
        if (u.bumpX || u.bumpY) {
            drawX += u.bumpX; drawY += u.bumpY;
            u.bumpX *= 0.8; u.bumpY *= 0.8;
        }

        if (isDead) ctx.filter = 'grayscale(100%) brightness(0.5)';

        // 유닛 바닥 그림자
        ctx.beginPath(); 
        ctx.arc(drawX, drawY, 25 * this.grid.scale, 0, Math.PI*2);
        ctx.fillStyle = u.team === 0 ? "rgba(51, 85, 136, 0.7)" : "rgba(136, 51, 51, 0.7)"; 
        ctx.fill();
        
        if (!isDead) this.drawCompass(ctx, u, drawX, drawY);
        
        if (window.battle && window.battle.currentUnit === u) { 
            ctx.strokeStyle = "gold"; ctx.lineWidth = 3; ctx.stroke(); 
        } else {
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
        }
        // [추가] 변이 상태 확인
        let displayIcon = u.icon;
        if (u.buffs && u.buffs.some(b => b.type === 'CC_POLYMORPH')) {
            displayIcon = '🐑'; // 양 아이콘으로 덮어쓰기
        }

        // 유닛 이모지
        ctx.fillStyle = "white"; 
        ctx.font = `${24 * this.grid.scale}px serif`; 
        ctx.textAlign = "center"; 
        ctx.textBaseline = "middle";
        ctx.shadowColor = "black"; ctx.shadowBlur = 4;
        ctx.fillText(u.icon, drawX, drawY);
        ctx.shadowBlur = 0;

        if (isDead) ctx.filter = 'none';
    }

    drawZone(q, r, color, cam, glow = false) {
        const tData = this.grid.getTerrainData(q, r);
        const h = tData.h || 0;
        
        // 존(Zone)은 바닥보다 살짝 위에 표시 (+0.1)
        const center = this.getDrawPos(q, r, h + 0.1, cam);
        const size = HEX_SIZE * this.grid.scale - 2;
        
        this.ctx.save();
        if(glow) { this.ctx.shadowBlur = 10; this.ctx.shadowColor = color; }
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        for(let i=0; i<6; i++) {
            const rad = (60*i+30)*Math.PI/180;
            const px = center.x + size*Math.cos(rad);
            const py = center.y + (size*Math.sin(rad)*this.grid.tilt);
            i===0 ? this.ctx.moveTo(px,py) : this.ctx.lineTo(px,py);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    drawZoneOutline(q, r, color, cam, isDashed = false) {
        const tData = this.grid.getTerrainData(q, r);
        const h = tData.h || 0;
        
        // 아웃라인은 바닥보다 조금 더 위에 (+0.2)
        const center = this.getDrawPos(q, r, h + 0.2, cam);
        const size = HEX_SIZE * this.grid.scale - 1;

        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        if(isDashed) {
            const offset = (Date.now()/40)%15;
            this.ctx.setLineDash([10,5]);
            this.ctx.lineDashOffset = -offset;
        }
        this.ctx.beginPath();
        for(let i=0; i<6; i++) {
            const rad = (60*i+30)*Math.PI/180;
            const px = center.x + size*Math.cos(rad);
            const py = center.y + (size*Math.sin(rad)*this.grid.tilt);
            i===0 ? this.ctx.moveTo(px,py) : this.ctx.lineTo(px,py);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawCompass(ctx, u, x, y) {
        const facing = u.facing !== undefined ? u.facing : (u.team === 0 ? 0 : 3);
        const angleRad = (facing * 60) * (Math.PI / 180);
        const radius = 25 * this.grid.scale;

        ctx.save();
        ctx.translate(x, y);
        
        const pointerSize = 8 * this.grid.scale;
        const px = (radius + 5) * Math.cos(angleRad);
        const py = (radius + 5) * Math.sin(angleRad) * this.grid.tilt;

        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        ctx.translate(px, py);
        ctx.rotate(angleRad);
        ctx.moveTo(0, 0);
        ctx.lineTo(-pointerSize, -pointerSize * 0.6);
        ctx.lineTo(-pointerSize, pointerSize * 0.6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}