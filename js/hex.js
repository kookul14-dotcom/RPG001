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
        this.startY = 120;    // 전체 맵 Y 오프셋 (높이 솟아오름을 고려해 조금 내림)
        this.heightStep = 14; // ★ 높이 1당 솟아오르는 픽셀 수 (입체감 핵심)

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

        // ★ 지형(높이)이 바뀌면 그리는 순서도 바뀌어야 하므로 캐시 초기화
        this.sortedHexesCache = null;
    }
    
    // 키값만 반환 (로직용)
    getTerrain(q, r) { 
        const data = this.terrainMap.get(`${q},${r}`);
        return data ? data.key : 'PLAIN'; 
    }

    // 전체 데이터(높이 포함) 반환 (렌더링용)
    getTerrainData(q, r) {
        return this.terrainMap.get(`${q},${r}`) || { key: 'GRASS_01', h: 0 };
    }

    isPassable(q_or_key, r) {
        let key = q_or_key;
        
        // 인자가 두 개(q, r 좌표 숫자)로 들어왔다면 자동으로 지형 키워드로 변환
        if (typeof q_or_key === 'number' && typeof r === 'number') {
            
            // ⭐ [부작용 방지] 맵의 범위를 벗어난 허공(Out of Bounds)이면 무조건 통과 불가 처리!
            if (!this.hexes.has(`${q_or_key},${r}`)) return false;
            
            key = this.getTerrain(q_or_key, r);
        }
        
        const info = TERRAIN_TYPES[key];
        
        // 타일 데이터가 없으면 강제 차단
        if (!info) return false; 
        return info.cost < 99; // 비용이 99 미만이면 통행 가능
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
        // 초기화 시 정렬 캐시 비움
        this.sortedHexesCache = null;
    }

    // ⭐ [핵심] 그리기 순서 정렬 (Z-Ordering)
    // 1. 위쪽 줄(r이 작은 곳)부터 그린다.
    // 2. 같은 줄이면 높이(h)가 낮은 타일 먼저 그린다 (높은 타일이 덮어써야 함).
    getSortedHexes() { 
        if (!this.sortedHexesCache) {
            this.sortedHexesCache = Array.from(this.hexes.values()).sort((a, b) => {
                // 1차 기준: 행 (Row) - 뒤쪽(위)부터 그림
                if (a.r !== b.r) return a.r - b.r;
                
                // 2차 기준: 높이 (Height) - 낮은 것부터 그려야 높은 것이 덮음
                const hA = this.getTerrainData(a.q, a.r).h || 0;
                const hB = this.getTerrainData(b.q, b.r).h || 0;
                return hA - hB;
            });
        }
        return this.sortedHexesCache;
    }

    resize(cols, rows) {
        this.mapCols = cols;
        this.mapRows = rows;
        this.initGrid(); // 좌표 다시 계산
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

        // ★ [핵심] 높이만큼 Y축을 위로 올림 (this.heightStep)
        // scale을 곱해 줌/아웃 시에도 비율 유지
        const lift = h * this.heightStep * this.scale;

        return { 
            x: x + this.startX, 
            y: ((y + this.startY) * this.tilt) - lift 
        };
    }

    // ⭐ 극한으로 최적화된 화면 좌표 -> 헥스 좌표 변환
    pixelToHex(worldX, worldY) {
        // 1. 역산으로 '가상 2D 평면' 기준 헥스를 단번에 찾음 O(1)
        const y_2d = (worldY / this.tilt) - this.startY;
        const x_2d = worldX - this.startX;
        const size = HEX_SIZE * this.scale;
        const q_float = (Math.sqrt(3)/3 * x_2d - 1/3 * y_2d) / size;
        const r_float = (2/3 * y_2d) / size;
        const baseHex = this.cubeToAxial(this.cubeRound(this.axialToCube(q_float, r_float)));

        let bestHex = null;
        let minDist = Infinity;
        
        // 2. [극한 최적화] 높이는 타일을 화면 위로만 올리므로, 
        // 바닥 타일을 기준으로 화면 아래쪽(r 증가 방향)만 길게 검사합니다.
        for (let dr = 0; dr <= 5; dr++) {         // 아래로 최대 5칸 (최대 높이를 커버)
            for (let dq = -1; dq <= 1; dq++) {    // 좌우 지그재그 보정용 1칸
                const testQ = baseHex.q + dq;
                const testR = baseHex.r + dr;
                
                if (this.hexes.has(`${testQ},${testR}`)) {
                    const center = this.hexToPixel3D(testQ, testR);
                    const dx = worldX - center.x;
                    const dy = worldY - center.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < (HEX_SIZE * this.scale) && dist < minDist) {
                        minDist = dist;
                        bestHex = { q: testQ, r: testR };
                    }
                }
            }
        }
        return bestHex || baseHex;
    }

    // [추가] 다양한 모양의 범위(AoE) 좌표 수집기
    getShapeHexes(center, caster, areaStr) {
        if (!center || !areaStr) return [];
        
        let results = [];
        const parts = String(areaStr).toUpperCase().split('_');
        const shape = parts[0];
        const length = parseInt(parts[1]) || 1;

        // 시전자로부터 타겟(중심)까지의 방향 (제자리 시전이면 현재 바라보는 방향 사용)
        const isSelf = (caster.q === center.q && caster.r === center.r);
        const dirIdx = isSelf && caster.facing !== undefined ? caster.facing : this.getDirection(caster, center);
        const dirs = [ {q:1, r:0}, {q:0, r:1}, {q:-1, r:1}, {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1} ];

        // ⭐ [신규] 연금술사 전진형 육각형 (FORWARD_HEX_3 등)
        if (shape === 'FORWARD' && parts[1] === 'HEX') {
            const radius = parseInt(parts[2]) || 3;
            
            // 시전자로부터 지정된 방향(center) 구하기
            const dq = center.q - caster.q;
            const dr = center.r - caster.r;
            
            // 육각형의 진짜 중심점을 그 방향으로 radius만큼 전진시킨 위치로 잡음
            const projectedCenter = { 
                q: caster.q + (dq * radius), 
                r: caster.r + (dr * radius) 
            };

            // 진짜 중심점을 기준으로 반경 반경만큼의 정육각형 생성
            for (let q = -radius; q <= radius; q++) {
                for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
                    const hq = projectedCenter.q + q;
                    const hr = projectedCenter.r + r;
                    
                    // 시전자 본인이 서있는 타일은 범위에서 제외
                    if (!(hq === caster.q && hr === caster.r)) {
                        results.push({ q: hq, r: hr });
                    }
                }
            }
        }
        // 1. 기본 원형 (숫자만 있거나 CIRCLE 키워드)
        else if (!isNaN(shape) || shape === 'CIRCLE') {
            const rad = !isNaN(shape) ? parseInt(shape) : length;
            for (let q = -rad; q <= rad; q++) {
                for (let r = Math.max(-rad, -q - rad); r <= Math.min(rad, -q + rad); r++) {
                    results.push({ q: center.q + q, r: center.r + r });
                }
            }
        }
        else if (shape === 'LINE') {
            // 시전자 위치부터 시작해서 방향대로 length만큼 전진
            for (let i = 1; i <= length; i++) {
                results.push({ q: caster.q + dirs[dirIdx].q * i, r: caster.r + dirs[dirIdx].r * i });
            }
        } 
        else if (shape === 'CLEAVE') {
            // ⭐ [수정됨] 사거리에 상관없이 항상 폭이 3칸(중앙+좌우 1칸씩)으로 고정 유지되는 횡베기
            // dist: 시전자와 중심의 거리 (기본 1)
            // length: 타격 호의 두께 (CLEAVE_2 라면 두께 2칸)
            const dist = isSelf ? 1 : this.getDistance(caster, center);
            
            for (let r = dist; r < dist + length; r++) {
                const rowCenterQ = caster.q + dirs[dirIdx].q * r;
                const rowCenterR = caster.r + dirs[dirIdx].r * r;
                results.push({ q: rowCenterQ, r: rowCenterR });
                
                // 양옆 날개 
                const wingLeftDir = (dirIdx + 2) % 6;
                const wingRightDir = (dirIdx + 4) % 6;
                
                // ⭐ 핵심 수정: w <= r 이었던 것을 w <= 1 로 변경하여 거리가 멀어져도 폭을 3칸으로 제한
                for (let w = 1; w <= 1; w++) { 
                    results.push({ q: rowCenterQ + dirs[wingLeftDir].q * w, r: rowCenterR + dirs[wingLeftDir].r * w });
                    results.push({ q: rowCenterQ + dirs[wingRightDir].q * w, r: rowCenterR + dirs[wingRightDir].r * w });
                }
            }
        }
        else if (shape === 'CONE') {
            // 거리가 멀어질수록 좌우폭이 넓어지는 삼각뿔 형태 (CLEAVE와 달리 안쪽이 꽉 참)
            for (let d = 1; d <= length; d++) {
                const rowCenterQ = caster.q + dirs[dirIdx].q * d;
                const rowCenterR = caster.r + dirs[dirIdx].r * d;
                results.push({ q: rowCenterQ, r: rowCenterR });
                
                const wingLeftDir = (dirIdx + 2) % 6;
                const wingRightDir = (dirIdx + 4) % 6;
                for (let w = 1; w <= d; w++) { // ⭐ 기존 버그 수정 (구멍이 뚫리지 않도록 w < d 에서 w <= d 로 변경)
                    results.push({ q: rowCenterQ + dirs[wingLeftDir].q * w, r: rowCenterR + dirs[wingLeftDir].r * w });
                    results.push({ q: rowCenterQ + dirs[wingRightDir].q * w, r: rowCenterR + dirs[wingRightDir].r * w });
                }
            }
        } 
        else if (shape === 'STAR' || shape === 'CROSS') {
            // ⭐ [추가됨] 그랜드크로스를 위한 제자리 중심 6방향(십자/성방) 폭발
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

        // 중복 제거 및 유효한 타일(맵 내부)만 반환
        const unique = Array.from(new Set(results.map(h => `${h.q},${h.r}`)));
        return unique.map(key => {
            const [q, r] = key.split(',').map(Number);
            return { q, r };
        }).filter(h => this.hexes.has(`${h.q},${h.r}`));
    }

    // 반지름이 딱 n인 고리 좌표 수집용 유틸
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