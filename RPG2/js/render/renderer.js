import { TERRAIN_TYPES, HEX_SIZE } from '../data/index.js';

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

        // 3. 지형 그리기 (Z-Sorting)
        const sortedHexes = this.grid.getSortedHexes();
        sortedHexes.forEach(h => {
            const tKey = this.grid.getTerrain(h.q, h.r);
            const tData = TERRAIN_TYPES[tKey] || TERRAIN_TYPES['GRASS_01'];
            this.drawHexPrism(h.q, h.r, tData, cam);
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
        // [중요] Grid의 3D 좌표 계산 메서드 사용
        const p = this.grid.hexToPixel3D(q, r, height);
        return { x: p.x - cam.x, y: p.y - cam.y };
    }

    drawHexPrism(q, r, tData, cam) {
        const ctx = this.ctx;
        const height = tData.height || 0;
        const size = HEX_SIZE * this.grid.scale;
        
        // 타일의 윗면 중심점
        const center = this.getDrawPos(q, r, height, cam);
        // 타일의 바닥면 중심점 (기둥 효과용)
        const baseCenter = this.getDrawPos(q, r, 0, cam);

        const getCorners = (c) => {
            const corners = [];
            for (let i = 0; i < 6; i++) {
                const rad = (60 * i + 30) * Math.PI / 180;
                corners.push({
                    x: c.x + size * Math.cos(rad),
                    y: c.y + (size * Math.sin(rad) * this.grid.tilt) // Grid의 tilt 사용
                });
            }
            return corners;
        };

        const topCorners = getCorners(center);
        
        if (height !== 0) {
            const baseCorners = getCorners(baseCenter);
            ctx.fillStyle = tData.sideColor;
            [3, 4, 5, 0, 1, 2].forEach(i => {
                const next = (i + 1) % 6;
                ctx.beginPath();
                ctx.moveTo(topCorners[i].x, topCorners[i].y);
                ctx.lineTo(topCorners[next].x, topCorners[next].y);
                ctx.lineTo(baseCorners[next].x, baseCorners[next].y);
                ctx.lineTo(baseCorners[i].x, baseCorners[i].y);
                ctx.fill();
            });
        }

        ctx.fillStyle = tData.color;
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        topCorners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawUnit(u, cam, isDead) {
        const ctx = this.ctx;
        // 지형 높이 가져오기
        const tKey = this.grid.getTerrain(u.q, u.r);
        const hWeight = (TERRAIN_TYPES[tKey]?.height || 0);
        
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

        // 유닛 바닥 원
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

        // 유닛 이모지
        ctx.fillStyle = "white"; 
        ctx.font = `${24 * this.grid.scale}px serif`; 
        ctx.textAlign = "center"; 
        ctx.textBaseline = "middle";
        ctx.shadowColor = "black"; ctx.shadowBlur = 4;
        ctx.fillText(u.icon, drawX, drawY);
        ctx.shadowBlur = 0;

       if (u.buffs && u.buffs.length > 0) {
            ctx.font = `bold ${12 * this.grid.scale}px sans-serif`;
            const iconWidth = 16;
            const totalWidth = u.buffs.length * iconWidth;
            const startX = drawX - (totalWidth / 2);+ (iconWidth / 2);
            const iconY = drawY - (35 * this.grid.scale); // 캐릭터 머리 위 적절한 높이

            // 아이콘 그리기
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // 3. 선명화 효과: 검은색 테두리(Stroke)를 먼저 그리고 -> 흰색 채우기(Fill)
            ctx.lineWidth = 2;               // 테두리 두께
            ctx.strokeStyle = "black";       // 테두리 색상
            ctx.fillStyle = "white";         // 글자 색상

            u.buffs.forEach((b, i) => { 
                const xPos = startX + (i * iconWidth);
                
                // 테두리를 먼저 그려서 배경과 분리 (선명함 UP)
                ctx.strokeText(b.icon, xPos, iconY);
                // 그 위에 아이콘을 그림
                ctx.fillText(b.icon, xPos, iconY); 
            });
            ctx.textAlign = "center";
        }

        // [삭제됨] HP 바 그리기 코드 제거 (BattleSystem의 오버레이로 대체)

        if (isDead) ctx.filter = 'none';
    }

    drawZone(q, r, color, cam, glow = false) {
        const tKey = this.grid.getTerrain(q, r);
        const h = (TERRAIN_TYPES[tKey]?.height || 0);
        const center = this.getDrawPos(q, r, h + 1, cam);
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
        const tKey = this.grid.getTerrain(q, r);
        const h = (TERRAIN_TYPES[tKey]?.height || 0);
        const center = this.getDrawPos(q, r, h + 2, cam);
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