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
        
        this.scale = 1.0; // 줌 스케일 초기값

        // 중앙 정렬 오프셋 (초기값)
        this.startX = 0;
        this.startY = 0;

        // 최적화용 오프스크린 캔버스
        this.offscreenCanvas = document.createElement('canvas');
        this.offCtx = this.offscreenCanvas.getContext('2d');
        
        // [수정] 초기화 순서 명확화: 버퍼 크기/오프셋 계산 -> 그리드 좌표 생성 -> 프리렌더링
        this.resizeOffscreenBuffer();
        this.initGrid();
        this.prerenderGrid();
    }

    setScale(newScale) {
        this.scale = Math.max(0.5, Math.min(2.0, newScale)); // 0.5 ~ 2.0 배율 제한
        this.resizeOffscreenBuffer(); // 스케일 변경 시 버퍼 크기 재조정
        // 스케일이 바뀌면 좌표도 바뀌므로 initGrid 다시 필요할 수 있으나, 
        // 현재 로직상 drawHex시 pixel 변환을 하므로 prerender만 다시 해도 됨.
        // 하지만 hexes 내부의 x,y 캐싱값을 쓴다면 initGrid도 필요. 
        // 여기서는 hexes에 x,y를 저장하고 있으므로 initGrid 재호출 권장.
        this.initGrid(); 
        this.prerenderGrid();
    }

    // 맵 전체 크기를 계산하여 오프스크린 캔버스 크기 조정 및 startX 설정
    resizeOffscreenBuffer() {
        const scaledHexSize = HEX_SIZE * this.scale;
        const mapPixelWidth = this.mapCols * Math.sqrt(3) * scaledHexSize;
        const mapPixelHeight = this.mapRows * 1.5 * scaledHexSize;
        
        // 여유 공간 포함
        this.offscreenCanvas.width = mapPixelWidth + scaledHexSize * 2;
        this.offscreenCanvas.height = mapPixelHeight + scaledHexSize * 2;
        
        // [중요] startX, startY 설정 (이 값이 initGrid보다 먼저 설정되어야 함)
        this.startX = scaledHexSize; 
        this.startY = scaledHexSize;
    }

    drawHex(ctx, x, y, color, stroke, width = 1) {
        const size = HEX_SIZE * this.scale;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i + 30; 
            const angle_rad = Math.PI / 180 * angle_deg;
            const px = x + size * Math.cos(angle_rad);
            const py = y + size * Math.sin(angle_rad);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (color) { ctx.fillStyle = color; ctx.fill(); }
        if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    initGrid() {
        this.hexes.clear();
        for (let r = 0; r < this.mapRows; r++) {
            for (let c = 0; c < this.mapCols; c++) {
                const q = c - (r - (r & 1)) / 2;
                const r_coord = r; 

                // resizeOffscreenBuffer에서 설정된 startX, startY를 사용
                const {x, y} = this.hexToPixelRaw(q, r_coord);
                // 맵 전체를 등록
                this.hexes.set(`${q},${r_coord}`, { q, r: r_coord, x, y, col: c, row: r });
            }
        }
    }

    prerenderGrid() {
        this.offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        // 배경색 (#viewport 배경과 구분되도록 함, 어차피 캔버스 배경은 투명하거나 CSS 따름)
        // 여기서는 오프스크린 캔버스 자체 배경을 그림
        this.offCtx.fillStyle = "#080808"; 
        this.offCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        
        // 그리드 다시 그리기 (스케일 반영됨)
        this.hexes.forEach(h => {
            const pos = this.hexToPixelRaw(h.q, h.r);
            // [수정] 시인성 개선 (Visual Contrast Issue 해결)
            // 기존: Fill #1a1a1a, Stroke #333
            // 변경: Fill #222222 (조금 더 밝음), Stroke #505050 (훨씬 잘 보임)
            this.drawHex(this.offCtx, pos.x, pos.y, "#222222", "#505050", 1);
        });
    }

    hexToPixelRaw(q, r) {
        const size = HEX_SIZE * this.scale;
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = size * (3/2 * r);
        return { 
            x: x + this.startX, 
            y: y + this.startY 
        };
    }

    hexToPixel(q, r) {
        return this.hexToPixelRaw(q, r);
    }

    // [핵심] 줌 스케일 반영된 역산
    pixelToHex(worldX, worldY) {
        let x = worldX - this.startX;
        let y = worldY - this.startY;
        const size = HEX_SIZE * this.scale;

        const q = (Math.sqrt(3)/3 * x - 1/3 * y) / size;
        const r = (2/3 * y) / size;
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
