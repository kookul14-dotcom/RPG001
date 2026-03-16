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
        this.startY = 120;    // 전체 맵 Y 오프셋
        this.heightStep = 14; // ★ 높이 1당 솟아오르는 픽셀 수 (입체감 핵심)

        // ⭐ [신규] 카메라 회전 상태 (0 ~ 5, 60도 단위)
        this.cameraRotation = 0; 

        this.initGrid();
    }

    // ==============================================================
    // ⭐ [신규] 3D 회전 제어 및 좌표계 변환 로직
    // ==============================================================
    
    // 시점 회전 적용 (Q, E 키 등을 통해 외부에서 호출)
    setRotation(rotationStep) {
        // 음수 방지 및 0~5 사이 값 유지
        this.cameraRotation = (rotationStep % 6 + 6) % 6; 
        this.sortedHexesCache = null; // 시점이 바뀌면 그리기 순서도 초기화!
    }

    // 큐브 좌표를 시계방향으로 60도씩 회전시키는 핵심 수학 공식
    rotateCube(cube, steps) {
        let {x, y, z} = cube;
        const rot = (steps % 6 + 6) % 6;
        for (let i = 0; i < rot; i++) {
            let tx = x, ty = y, tz = z;
            x = -tz;
            y = -tx;
            z = -ty;
        }
        return {x, y, z};
    }

    // 실제 논리 좌표(q,r) -> 현재 카메라 시점이 반영된 시각적 좌표(vq,vr)
    getVisualHex(logicalQ, logicalR) {
        const cube = this.axialToCube(logicalQ, logicalR);
        const rotCube = this.rotateCube(cube, this.cameraRotation);
        return this.cubeToAxial(rotCube);
    }

    // 화면의 시각적 좌표(vq,vr) -> 맵의 실제 논리 좌표(q,r) 역추적
    getLogicalHex(visualQ, visualR) {
        const cube = this.axialToCube(visualQ, visualR);
        // 반대 방향으로 회전시켜 원상복구
        const rotCube = this.rotateCube(cube, (6 - this.cameraRotation) % 6);
        return this.cubeToAxial(rotCube);
    }

    // ==============================================================
    // 기존 기능들 (지형, 맵 생성 등)
    // ==============================================================

    setTerrain(q, r, inputData) {
        let data = inputData;
        if (typeof inputData === 'string') {
            const defH = TERRAIN_TYPES[inputData]?.defaultH || 0;
            data = { key: inputData, h: defH };
        }
        if (TERRAIN_TYPES[data.key]) {
            if (data.h === undefined) {
                data.h = TERRAIN_TYPES[data.key].defaultH || 0;
            }
            this.terrainMap.set(`${q},${r}`, data);
        }
        this.sortedHexesCache = null;
    }
    
    getTerrain(q, r) { 
        const data = this.terrainMap.get(`${q},${r}`);
        return data ? data.key : 'PLAIN'; 
    }

    getTerrainData(q, r) {
        return this.terrainMap.get(`${q},${r}`) || { key: 'GRASS_01', h: 0 };
    }

    isPassable(q_or_key, r) {
        let key = q_or_key;
        if (typeof q_or_key === 'number' && typeof r === 'number') {
            if (!this.hexes.has(`${q_or_key},${r}`)) return false;
            key = this.getTerrain(q_or_key, r);
        }
        const info = TERRAIN_TYPES[key];
        if (!info) return false; 
        return info.cost < 99;
    }

    setScale(newScale) { this.scale = Math.max(0.5, Math.min(2.0, newScale)); }
    
    initGrid() {
        this.hexes.clear();
        for (let r = 0; r < this.mapRows; r++) {
            for (let c = 0; c < this.mapCols; c++) {
                const q = c - (r - (r & 1)) / 2;
                this.hexes.set(`${q},${r}`, { q, r, c, row: r });
            }
        }
        this.sortedHexesCache = null;
    }

    // ⭐ [수정됨] 회전된 화면을 기준으로 앞뒤를 정렬하여 완벽한 입체 가림 처리
    getSortedHexes() { 
        if (!this.sortedHexesCache) {
            this.sortedHexesCache = Array.from(this.hexes.values()).sort((a, b) => {
                // 실제 논리 좌표가 아닌, "카메라에 비춰지는 회전된 좌표"를 기준으로 렌더링
                const vA = this.getVisualHex(a.q, a.r);
                const vB = this.getVisualHex(b.q, b.r);
                
                // 1차 기준: 시각적 Row(Y축). 뒤쪽(위)부터 그려야 앞쪽 타일이 덮음
                if (vA.r !== vB.r) return vA.r - vB.r;
                
                // 2차 기준: 높이. 같은 줄에 있다면 바닥부터 기둥 꼭대기 순으로 그림
                const hA = this.getTerrainData(a.q, a.r).h || 0;
                const hB = this.getTerrainData(b.q, b.r).h || 0;
                if (hA !== hB) return hA - hB;

                // 3차 기준: 시각적 Col(X축) - 깜빡임(Z-fighting) 방지
                return vA.q - vB.q;
            });
        }
        return this.sortedHexesCache;
    }

    resize(cols, rows) {
        this.mapCols = cols;
        this.mapRows = rows;
        this.initGrid(); 
    }

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
        this.map = {}; 
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
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

    getNeighborInDir(hex, dirIndex) {
        const dirs = [
            {q:1, r:0}, {q:0, r:1}, {q:-1, r:1}, 
            {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1}
        ];
        const d = dirs[dirIndex % 6];
        return { q: hex.q + d.q, r: hex.r + d.r };
    }

    // ⭐ (로직 보존) 카메라가 회전해도, 캐릭터 기준의 논리적 방향은 100% 보존됨
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

    // --- [로직 연산용] 카메라 회전과 무관한 절대 좌표 (변경 안 함) ---
    hexToPixel(q, r) {
        const size = HEX_SIZE * this.scale;
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = size * (3/2 * r);
        return { x: x, y: y }; 
    }

    // --- ⭐ [수정됨] 화면 렌더링용 3D 좌표 (카메라 회전 적용) ---
    hexToPixel3D(q, r, heightOverride = null) {
        // 실제 좌표(q, r)를 카메라 시점에 맞게 비틀기(vq, vr)
        const visual = this.getVisualHex(q, r);
        const vq = visual.q;
        const vr = visual.r;

        const size = HEX_SIZE * this.scale;
        
        // 1. 회전된 2D 평면 좌표
        const x = size * (Math.sqrt(3) * vq + Math.sqrt(3)/2 * vr);
        const y = size * (3/2 * vr);

        // 2. 높이 결정
        let h = 0;
        if (heightOverride !== null) {
            h = heightOverride;
        } else {
            const data = this.terrainMap.get(`${q},${r}`);
            h = data ? data.h : 0;
        }

        // 3. 지형 고저차 3D 처리
        const lift = h * this.heightStep * this.scale;

        return { 
            x: x + this.startX, 
            y: ((y + this.startY) * this.tilt) - lift 
        };
    }

    // --- ⭐ [수정됨] 마우스 포인터 정밀 역추적 (높이 + 시점 회전 모두 보정) ---
    pixelToHex(worldX, worldY) {
        // 1. 마우스 좌표를 역산하여 현재 "화면에 보이는" 2D 시각적 좌표(VQ, VR)를 찾음
        const y_2d = (worldY / this.tilt) - this.startY;
        const x_2d = worldX - this.startX;
        const size = HEX_SIZE * this.scale;
        const q_float = (Math.sqrt(3)/3 * x_2d - 1/3 * y_2d) / size;
        const r_float = (2/3 * y_2d) / size;
        
        const visualBaseHex = this.cubeToAxial(this.cubeRound(this.axialToCube(q_float, r_float)));

        let bestHex = null;
        let minDist = Infinity;
        
        // 2. 높이가 솟아오른 기둥 등을 클릭했을 수 있으므로 화면 기준 아래쪽 타일들을 검사
        for (let dr = 0; dr <= 5; dr++) { 
            for (let dq = -1; dq <= 1; dq++) { 
                const testVQ = visualBaseHex.q + dq;
                const testVR = visualBaseHex.r + dr;
                
                // 시각적 좌표를 맵의 논리 좌표(Q, R)로 역변환!
                const logicalHex = this.getLogicalHex(testVQ, testVR);
                
                if (this.hexes.has(`${logicalHex.q},${logicalHex.r}`)) {
                    const center = this.hexToPixel3D(logicalHex.q, logicalHex.r);
                    const dx = worldX - center.x;
                    const dy = worldY - center.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < (HEX_SIZE * this.scale) && dist < minDist) {
                        minDist = dist;
                        bestHex = logicalHex;
                    }
                }
            }
        }
        
        return bestHex || this.getLogicalHex(visualBaseHex.q, visualBaseHex.r);
    }

    // 범위(AoE) 마법 및 타겟팅 연산 (로직용이므로 회전과 무관하게 기존과 똑같이 작동)
    getShapeHexes(center, caster, areaStr) {
        if (!center || !areaStr) return [];
        
        let results = [];
        const parts = String(areaStr).toUpperCase().split('_');
        const shape = parts[0];
        const length = parseInt(parts[1]) || 1;

        const isSelf = (caster.q === center.q && caster.r === center.r);
        const dirIdx = isSelf && caster.facing !== undefined ? caster.facing : this.getDirection(caster, center);
        const dirs = [ {q:1, r:0}, {q:0, r:1}, {q:-1, r:1}, {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1} ];

        if (shape === 'FORWARD' && parts[1] === 'HEX') {
            const radius = parseInt(parts[2]) || 3;
            const dq = center.q - caster.q;
            const dr = center.r - caster.r;
            const projectedCenter = { q: caster.q + (dq * radius), r: caster.r + (dr * radius) };

            for (let q = -radius; q <= radius; q++) {
                for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
                    const hq = projectedCenter.q + q;
                    const hr = projectedCenter.r + r;
                    if (!(hq === caster.q && hr === caster.r)) {
                        results.push({ q: hq, r: hr });
                    }
                }
            }
        }
        else if (!isNaN(shape) || shape === 'CIRCLE') {
            const rad = !isNaN(shape) ? parseInt(shape) : length;
            for (let q = -rad; q <= rad; q++) {
                for (let r = Math.max(-rad, -q - rad); r <= Math.min(rad, -q + rad); r++) {
                    results.push({ q: center.q + q, r: center.r + r });
                }
            }
        }
        else if (shape === 'LINE') {
            for (let i = 1; i <= length; i++) {
                results.push({ q: caster.q + dirs[dirIdx].q * i, r: caster.r + dirs[dirIdx].r * i });
            }
        } 
        else if (shape === 'CLEAVE') {
            const dist = isSelf ? 1 : this.getDistance(caster, center);
            for (let r = dist; r < dist + length; r++) {
                const rowCenterQ = caster.q + dirs[dirIdx].q * r;
                const rowCenterR = caster.r + dirs[dirIdx].r * r;
                results.push({ q: rowCenterQ, r: rowCenterR });
                
                const wingLeftDir = (dirIdx + 2) % 6;
                const wingRightDir = (dirIdx + 4) % 6;
                for (let w = 1; w <= 1; w++) { 
                    results.push({ q: rowCenterQ + dirs[wingLeftDir].q * w, r: rowCenterR + dirs[wingLeftDir].r * w });
                    results.push({ q: rowCenterQ + dirs[wingRightDir].q * w, r: rowCenterR + dirs[wingRightDir].r * w });
                }
            }
        }
        else if (shape === 'CONE') {
            for (let d = 1; d <= length; d++) {
                const rowCenterQ = caster.q + dirs[dirIdx].q * d;
                const rowCenterR = caster.r + dirs[dirIdx].r * d;
                results.push({ q: rowCenterQ, r: rowCenterR });
                
                const wingLeftDir = (dirIdx + 2) % 6;
                const wingRightDir = (dirIdx + 4) % 6;
                for (let w = 1; w <= d; w++) {
                    results.push({ q: rowCenterQ + dirs[wingLeftDir].q * w, r: rowCenterR + dirs[wingLeftDir].r * w });
                    results.push({ q: rowCenterQ + dirs[wingRightDir].q * w, r: rowCenterR + dirs[wingRightDir].r * w });
                }
            }
        } 
        else if (shape === 'STAR' || shape === 'CROSS') {
            results.push({ q: center.q, r: center.r });
            for (let d = 0; d < 6; d++) {
                for (let i = 1; i <= length; i++) {
                    results.push({ q: center.q + dirs[d].q * i, r: center.r + dirs[d].r * i });
                }
            }
        } 
        else if (shape === 'RING') {
            results = this.getHexesAtDistance(center, length);
        }
        else if (shape === 'BEHIND') {
            results.push({ q: center.q + dirs[dirIdx].q, r: center.r + dirs[dirIdx].r });
        }

        const unique = Array.from(new Set(results.map(h => `${h.q},${h.r}`)));
        return unique.map(key => {
            const [q, r] = key.split(',').map(Number);
            return { q, r };
        }).filter(h => this.hexes.has(`${h.q},${h.r}`));
    }

    getHexesAtDistance(center, dist) {
        const results = [];
        const dirs = [ {q:1, r:0}, {q:0, r:1}, {q:-1, r:1}, {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1} ];
        let curr = { q: center.q + dirs[4].q * dist, r: center.r + dirs[4].r * dist };
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < dist; j++) {
                results.push(curr);
                curr = { q: curr.q + dirs[i].q, r: curr.r + dirs[i].r };
            }
        }
        return results;
    }
}