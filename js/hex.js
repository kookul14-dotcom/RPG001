import { HEX_SIZE, TERRAIN_TYPES } from './data/index.js';

// --- 커서 생성 ---
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

export class HexGrid {
    constructor(canvas) {
        this.canvas = canvas;
        this.hexes = new Map();
        this.terrainMap = new Map(); 
        this.scale = 1.0;
        this.mapCols = 22;
        this.mapRows = 12;
        
        // [중앙화] 렌더링 및 좌표 계산을 위한 통합 설정값
        this.tilt = 0.6;      // Y축 기울기 (3D 효과)
        this.startX = 80;     // 전체 맵 X 오프셋
        this.startY = 80;     // 전체 맵 Y 오프셋

        this.initGrid();
    }

    setTerrain(q, r, typeKey) {
        if (TERRAIN_TYPES[typeKey]) this.terrainMap.set(`${q},${r}`, typeKey);
    }
    
    getTerrain(q, r) { return this.terrainMap.get(`${q},${r}`) || 'GRASS_01'; }
    
    setScale(newScale) { this.scale = Math.max(0.5, Math.min(2.0, newScale)); }
    
    initGrid() {
        this.hexes.clear();
        for (let r = 0; r < this.mapRows; r++) {
            for (let c = 0; c < this.mapCols; c++) {
                const q = c - (r - (r & 1)) / 2;
                this.hexes.set(`${q},${r}`, { q, r, c, row: r });
            }
        }
    }
    
    getSortedHexes() { return Array.from(this.hexes.values()).sort((a, b) => a.r - b.r || a.q - b.q); }

    // --- 수학적 유틸리티 ---
    axialToCube(q, r) { return { x: q, z: r, y: -q-r }; }
    cubeToAxial(cube) { return { q: cube.x, r: cube.z }; }
    
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

    getDistance(h1, h2) {
        return (Math.abs(h1.q - h2.q) + Math.abs(h1.q + h1.r - h2.q - h2.r) + Math.abs(h1.r - h2.r)) / 2;
    }

    getNeighbors(hex) {
        const dirs = [
            {q:1, r:0}, {q:0, r:1}, {q:-1, r:1}, 
            {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1}
        ];
        return dirs.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
    }

    getDirection(from, to) {
        const neighbors = this.getNeighbors(from);
        for(let i=0; i<6; i++) {
            if(neighbors[i].q === to.q && neighbors[i].r === to.r) return i;
        }
        const fromP = this.hexToPixel(from.q, from.r);
        const toP = this.hexToPixel(to.q, to.r);
        const angle = Math.atan2(toP.y - fromP.y, toP.x - fromP.x) * 180 / Math.PI;
        
        let index = Math.round(angle / 60);
        if (index < 0) index += 6;
        return index % 6;
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

    getHexInDirection(start, target, distance) {
        const sCube = this.axialToCube(start.q, start.r);
        const tCube = this.axialToCube(target.q, target.r);
        const distToTarget = this.getDistance(start, target);
        if (distToTarget === 0) return start;
        const dx = (tCube.x - sCube.x) / distToTarget;
        const dy = (tCube.y - sCube.y) / distToTarget;
        const dz = (tCube.z - sCube.z) / distToTarget;
        let lastValidHex = start;
        for (let i = 1; i <= distance; i++) {
            const nextCube = { x: sCube.x + dx * i, y: sCube.y + dy * i, z: sCube.z + dz * i };
            const nextHex = this.cubeToAxial(this.cubeRound(nextCube));
            if (this.hexes.has(`${nextHex.q},${nextHex.r}`)) lastValidHex = nextHex;
            else break;
        }
        return lastValidHex;
    }

    // --- [중요] 2D 평면 좌표 (로직 계산용) ---
    hexToPixel(q, r) {
        const size = HEX_SIZE * this.scale;
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = size * (3/2 * r);
        return { x: x, y: y }; // 오프셋 없이 순수 평면 좌표
    }

    // --- [핵심] 3D 화면 좌표 (렌더링 및 UI 표시용) ---
    // height: 지형 높이 (TERRAIN_TYPES[key].height)
    hexToPixel3D(q, r, height = 0) {
        const size = HEX_SIZE * this.scale;
        
        // 1. 평면 좌표 계산
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = size * (3/2 * r);

        // 2. 3D 변환 (기울기 + 오프셋 - 높이)
        return { 
            x: x + this.startX, 
            y: ((y + this.startY) * this.tilt) - (height * this.scale)
        };
    }

    // 화면 좌표(마우스) -> 헥스 좌표 변환 (역산)
    pixelToHex(worldX, worldY) {
        // 3D 역변환: 높이는 고려하지 않음 (바닥 기준 클릭 판정)
        // y_3d = (y_2d + startY) * tilt => y_2d = (y_3d / tilt) - startY
        const y_2d = (worldY / this.tilt) - this.startY;
        const x_2d = worldX - this.startX;

        const size = HEX_SIZE * this.scale;
        const q = (Math.sqrt(3)/3 * x_2d - 1/3 * y_2d) / size;
        const r = (2/3 * y_2d) / size;
        
        return this.cubeToAxial(this.cubeRound(this.axialToCube(q, r)));
    }
}