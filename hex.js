import { HEX_SIZE } from './data.js';

// --- 1. 커서 생성 (전역) ---
const cursorCanvas = document.createElement('canvas');
cursorCanvas.width = 32; cursorCanvas.height = 32;
const cursorCtx = cursorCanvas.getContext('2d');

export function createCursorFromEmoji(emoji) {
    cursorCtx.clearRect(0, 0, 32, 32);
    cursorCtx.font = "24px serif";
    cursorCtx.textAlign = "center";
    cursorCtx.textBaseline = "middle";
    cursorCtx.fillText(emoji, 16, 16);
    return cursorCanvas.toDataURL();
}

// --- 2. HexGrid 클래스 ---
export class HexGrid {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hexes = new Map();
        
        // 맵 크기 설정 (직사각형 22x12)
        this.mapCols = 22;
        this.mapRows = 12;

        // 중앙 정렬 오프셋 (1920x1080 기준)
        const mapPixelWidth = this.mapCols * Math.sqrt(3) * HEX_SIZE;
        const mapPixelHeight = this.mapRows * 1.5 * HEX_SIZE;

        this.startX = (1920 - mapPixelWidth) / 2 + 50; 
        this.startY = (1080 - mapPixelHeight) / 2 + 50;

        // 최적화용 오프스크린 캔버스
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = 1920 + HEX_SIZE * 2;
        this.offscreenCanvas.height = 1080 + HEX_SIZE * 2;
        this.offCtx = this.offscreenCanvas.getContext('2d');
        
        this.initGrid();
        this.prerenderGrid();
    }

    drawHex(ctx, x, y, color, stroke, width = 1) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i + 30; 
            const angle_rad = Math.PI / 180 * angle_deg;
            const px = x + HEX_SIZE * Math.cos(angle_rad);
            const py = y + HEX_SIZE * Math.sin(angle_rad);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (color) { ctx.fillStyle = color; ctx.fill(); }
        if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    initGrid() {
        for (let r = 0; r < this.mapRows; r++) {
            for (let c = 0; c < this.mapCols; c++) {
                const q = c - (r - (r & 1)) / 2;
                const r_coord = r; 

                const {x, y} = this.hexToPixelRaw(q, r_coord);
                
                if (x > -HEX_SIZE && x < 1920 + HEX_SIZE && y > -HEX_SIZE && y < 1080 + HEX_SIZE) {
                    this.hexes.set(`${q},${r_coord}`, { q, r: r_coord, x, y, col: c, row: r });
                }
            }
        }
    }

    prerenderGrid() {
        this.offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        this.offCtx.fillStyle = "#050505";
        this.offCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        
        this.hexes.forEach(h => {
            this.drawHex(this.offCtx, h.x, h.y, "#1a1a1a", "#333", 1);
        });
    }

    hexToPixelRaw(q, r) {
        const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = HEX_SIZE * (3/2 * r);
        return { 
            x: x + this.startX, 
            y: y + this.startY 
        };
    }

    hexToPixel(q, r) {
        return this.hexToPixelRaw(q, r);
    }

    // [핵심 수정] 입력받는 mx, my는 '카메라와 오프셋이 반영된 절대 월드 좌표'여야 함
    pixelToHex(worldX, worldY) {
        let x = worldX - this.startX;
        let y = worldY - this.startY;

        const q = (Math.sqrt(3)/3 * x - 1/3 * y) / HEX_SIZE;
        const r = (2/3 * y) / HEX_SIZE;
        return this.cubeToAxial(this.cubeRound(this.axialToCube(q, r)));
    }
    
    // --- 수학 및 유틸리티 함수 ---
    axialToCube(q, r) { return { x: q, z: r, y: -q-r }; }
    
    cubeRound(cube) {
        let rx = Math.round(cube.x); 
        let ry = Math.round(cube.y); 
        let rz = Math.round(cube.z);

        const x_diff = Math.abs(rx - cube.x);
        const y_diff = Math.abs(ry - cube.y);
        const z_diff = Math.abs(rz - cube.z);

        if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
        else if (y_diff > z_diff) ry = -rx - rz;
        else rz = -rx - ry;

        return { x: rx, z: rz, y: ry };
    }

    cubeToAxial(cube) { return { q: cube.x, r: cube.z }; }

    getDistance(h1, h2) {
        return (Math.abs(h1.q - h2.q) + Math.abs(h1.q + h1.r - h2.q - h2.r) + Math.abs(h1.r - h2.r)) / 2;
    }

    getNeighbors(hex) {
        const dirs = [
            {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1}, 
            {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
        ];
        return dirs.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
    }

    getLine(start, target, range) {
        let results = [];
        let dist = this.getDistance(start, target);
        if (dist === 0) return [start];
        
        let s = this.axialToCube(start.q, start.r);
        let t = this.axialToCube(target.q, target.r);
        
        for (let i = 0; i <= range; i++) {
            let weight = i / dist; 
            let lerpCube = { 
                x: s.x + (t.x - s.x) * weight, 
                y: s.y + (t.y - s.y) * weight, 
                z: s.z + (t.z - s.z) * weight 
            };
            results.push(this.cubeToAxial(this.cubeRound(lerpCube)));
        }
        return results;
    }

    // A* 길찾기
    findPath(start, end, isWalkable) {
        let frontier = [start];
        let cameFrom = new Map();
        cameFrom.set(`${start.q},${start.r}`, null);

        while (frontier.length > 0) {
            let current = frontier.shift();
            if (current.q === end.q && current.r === end.r) break;

            this.getNeighbors(current).forEach(next => {
                const key = `${next.q},${next.r}`;
                if (this.hexes.has(key) && !cameFrom.has(key) && isWalkable(next)) {
                    frontier.push(next);
                    cameFrom.set(key, current);
                }
            });
        }
        
        const endKey = `${end.q},${end.r}`;
        if (!cameFrom.has(endKey)) return []; 

        let current = end;
        let path = [];
        while (current.q !== start.q || current.r !== start.r) {
            path.push(current);
            const prev = cameFrom.get(`${current.q},${current.r}`);
            if(!prev) break; 
            current = prev;
        }
        return path.reverse();
    }
}