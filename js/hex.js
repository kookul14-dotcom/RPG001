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

    setTerrain(q, r, inputData) {
        let data = inputData;
        
        // 문자열로 들어오면 객체로 변환 (구버전 호환)
        if (typeof inputData === 'string') {
            const defH = TERRAIN_TYPES[inputData]?.defaultH || 0;
            data = { key: inputData, h: defH };
        }

        // 유효한 타일인지 확인 후 저장
        if (TERRAIN_TYPES[data.key]) {
            // 높이 값이 없으면 기본값 사용
            if (data.h === undefined) {
                data.h = TERRAIN_TYPES[data.key].defaultH || 0;
            }
            this.terrainMap.set(`${q},${r}`, data);
        }
    }
    
    // [수정] 키값만 반환 (로직용)
    getTerrain(q, r) { 
        const data = this.terrainMap.get(`${q},${r}`);
        return data ? data.key : 'GRASS_01'; 
    }

    // [신규] 전체 데이터(높이 포함) 반환 (렌더링용)
    getTerrainData(q, r) {
        return this.terrainMap.get(`${q},${r}`) || { key: 'GRASS_01', h: 0 };
    }

    // ▼▼▼ [추가됨] 통행 가능 여부 확인 메서드 ▼▼▼
    isPassable(terrainKey) {
        const info = TERRAIN_TYPES[terrainKey];
        // 정보가 없으면 기본적으로 갈 수 있다고 가정(true), 혹은 막힘(false)
        // 여기서는 데이터가 있으면 비용 체크, 없으면 갈 수 있음으로 처리
        if (!info) return true; 
        return info.cost < 99; // 비용이 99 미만이면 통행 가능
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

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
    resize(cols, rows) {
        this.mapCols = cols;
        this.mapRows = rows;
        this.initGrid(); // 좌표 다시 계산
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
    clearMap() {
        this.map = {}; // 지형 데이터 초기화
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // 캔버스 화면 지우기
        }
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

    // 특정 방향의 이웃 하나만 가져오기
    getNeighborInDir(hex, dirIndex) {
        const dirs = [
            {q:1, r:0}, {q:0, r:1}, {q:-1, r:1}, 
            {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1}
        ];
        const d = dirs[dirIndex % 6];
        return { q: hex.q + d.q, r: hex.r + d.r };
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
                // 1. 맵 범위 내에 있는지 확인 (this.hexes.has)
                // 2. 방문하지 않았는지 확인 (!cameFrom.has)
                // 3. 이동 가능한지 확인 (isWalkable 콜백)
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
    hexToPixel3D(q, r, heightOverride = null) {
        const size = HEX_SIZE * this.scale;
        
        // 1. 평면 좌표
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = size * (3/2 * r);

        // 2. 높이 결정 (인자 값 우선 -> 저장된 값 -> 0)
        let h = 0;
        if (heightOverride !== null) {
            h = heightOverride;
        } else {
            const data = this.terrainMap.get(`${q},${r}`);
            h = data ? data.h : 0;
        }

        // 3. 3D 변환 (기울기 - 높이)
        return { 
            x: x + this.startX, 
            y: ((y + this.startY) * this.tilt) - (h * 10 * this.scale) // 높이 배율(10) 적용
        };
    }

    // 화면 좌표(마우스) -> 헥스 좌표 변환 (역산)
    pixelToHex(worldX, worldY) {
        // 간단한 역변환 (높이 0 기준)
        const y_2d = (worldY / this.tilt) - this.startY;
        const x_2d = worldX - this.startX;

        const size = HEX_SIZE * this.scale;
        const q = (Math.sqrt(3)/3 * x_2d - 1/3 * y_2d) / size;
        const r = (2/3 * y_2d) / size;
        
        return this.cubeToAxial(this.cubeRound(this.axialToCube(q, r)));
    }
}