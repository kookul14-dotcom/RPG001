import { HexGrid } from '../hex.js';

// =========================================================================
// ⭐ [신규 기획 반영] 지형, 몬스터, 건물, 히든 팔레트 정의
// =========================================================================
export const EDITOR_PALETTE = {
    // -------------------------------------------------------------------------
    // [시스템 / 마커]
    // -------------------------------------------------------------------------
    'DEPLOY_ZONE': { name: '🚩 영웅 배치', color: 'rgba(0, 100, 255, 0.3)', side: 'transparent', cost: 0, defaultH: 0, isMarker: true },
    
    // -------------------------------------------------------------------------
    // [지 속성 (Terrestrial)]
    // -------------------------------------------------------------------------
    'PLAIN':   { name: '평원', color: '#aed581', side: '#7cb342', cost: 1, defaultH: 0 },
    'GRASS':   { name: '풀밭', color: '#7cb342', side: '#558b2f', cost: 1, defaultH: 0 },
    'FOREST':  { name: '숲', color: '#388e3c', side: '#1b5e20', cost: 1.5, defaultH: 0.5, desc: '원거리 회피 +20%' },
    'THICKET': { name: '덤불', color: '#558b2f', side: '#33691e', cost: 1.5, defaultH: 0.5, desc: '턴 종료 시 묶임(포박) 확률' },
    'THORN':   { name: '가시덩굴', color: '#827717', side: '#9e9d24', cost: 1.5, defaultH: 0.2, desc: '포박 & 출혈 확률' },
    'ROAD':    { name: '보도', color: '#bcaaa4', side: '#8d6e63', cost: 1, defaultH: 0 },
    'ROCKY':   { name: '암석지', color: '#757575', side: '#424242', cost: 1.5, defaultH: 1, desc: 'Jump 요구치 +1' },

    // -------------------------------------------------------------------------
    // [수 속성 (Aquatic)]
    // -------------------------------------------------------------------------
    'WETLAND':       { name: '습지', color: '#81c784', side: '#388e3c', cost: 1.5, defaultH: -0.2, desc: '전격 전도' },
    'SWAMP':         { name: '늪', color: '#689f38', side: '#33691e', cost: 2, defaultH: -0.5, desc: '전격 전도 / 회피 -20%' },
    'WATER_SHALLOW': { name: '천수(얕은물)', color: '#4fc3f7', side: '#0288d1', cost: 2, defaultH: -0.5, desc: '전격 전도' },
    'WATER_DEEP':    { name: '심수(깊은물)', color: '#0288d1', side: '#01579b', cost: 99, defaultH: -1, desc: '일반 진입불가 / 전격 전도' },

    // -------------------------------------------------------------------------
    // [빙 속성 (Frozen)]
    // -------------------------------------------------------------------------
    'SNOWFIELD': { name: '설원', color: '#e1f5fe', side: '#b3e5fc', cost: 1.5, defaultH: 0.2 },
    'ICE':       { name: '빙판', color: '#b3e5fc', side: '#81d4fa', cost: 1, defaultH: 0, desc: '이동 시 미끄러짐 확률' },

    // -------------------------------------------------------------------------
    // [화 속성 (Pyric)]
    // -------------------------------------------------------------------------
    'DESERT':   { name: '사막', color: '#ffe082', side: '#ffca28', cost: 1.5, defaultH: 0, desc: '명중률 -10%' },
    'VOLCANO':  { name: '화산', color: '#d84315', side: '#bf360c', cost: 1.5, defaultH: 2 },
    'LAVA':     { name: '용암', color: '#ff5722', side: '#e64a19', cost: 2, defaultH: -1, desc: '진입 즉시 발화' },
    'BURN_GND': { name: '화염지', color: '#ff7043', side: '#d84315', cost: 1.5, defaultH: 0, desc: '10%피해+발화 / 번짐' },

    // -------------------------------------------------------------------------
    // [특수 지형 (Mystic) & 구조물]
    // -------------------------------------------------------------------------
    'POISON_LND': { name: '독지', color: '#ab47bc', side: '#7b1fa2', cost: 1, defaultH: -0.2, desc: '진입 즉시 중독' },
    'CRYSTAL':    { name: '수정', color: '#e040fb', side: '#aa00ff', cost: 1, defaultH: 0.5, desc: '마법 사거리 +1' },
    
    'WALL_STONE': { name: '성벽(장애물)', color: '#616161', side: '#424242', cost: 99, defaultH: 3 },
    'WALL_WOOD':  { name: '목책(장애물)', color: '#8d6e63', side: '#5d4037', cost: 99, defaultH: 1.5 }
};

export const MONSTER_PALETTE = {
    'SLIME':    { name: '슬라임', icon: '🟢', color: '#aaffaa' },
    'RAT':      { name: '거대쥐', icon: '🐀', color: '#bcaaa4' },
    'BAT':      { name: '박쥐', icon: '🦇', color: '#616161' },
    'KOBOLD':   { name: '코볼트', icon: '🐕', color: '#ffb74d' },
    'GOBLIN':   { name: '고블린', icon: '👺', color: '#66bb6a' },
    'SPIDER':   { name: '독거미', icon: '🕷️', color: '#424242' },
    'WOLF':     { name: '늑대', icon: '🐺', color: '#bdbdbd' },
    'BOAR':     { name: '멧돼지', icon: '🐗', color: '#8d6e63' },
    'SKELETON': { name: '스켈레톤', icon: '☠️', color: '#eeeeee' },
    'ZOMBIE':   { name: '좀비', icon: '🧟', color: '#81c784' },
    'ORC':      { name: '오크', icon: '👹', color: '#2e7d32' },
    'BANDIT':   { name: '도적', icon: '🥷', color: '#546e7a' },
    'BEAR':     { name: '불곰', icon: '🐻', color: '#5d4037' },
    'HARPY':    { name: '하피', icon: '🦅', color: '#90caf9' },
    'GARGOYLE': { name: '가고일', icon: '🦇', color: '#78909c' },
    'GHOST':    { name: '유령', icon: '👻', color: '#e1bee7' },
    'WEREWOLF': { name: '늑대인간', icon: '🐺', color: '#757575' },
    'SUCCUBUS': { name: '서큐버스', icon: '😈', color: '#f48fb1' },
    'GOLEM':    { name: '골렘', icon: '🗿', color: '#9e9e9e' },
    'TROLL':    { name: '트롤', icon: '👺', color: '#009688' },
    'MINOTAUR': { name: '미노타우', icon: '🐂', color: '#d84315' },
    'DULLAHAN': { name: '듀라한', icon: '🎃', color: '#37474f' },
    'TREANT':   { name: '트리언트', icon: '🌳', color: '#33691e' },
    'VAMPIRE':  { name: '뱀파이어', icon: '🧛', color: '#b71c1c' },
    'DRAKE':    { name: '드레이크', icon: '🐉', color: '#ef5350' },
    'LICH':     { name: '리치', icon: '💀', color: '#7b1fa2' },
    'KRAKEN':   { name: '크라켄', icon: '🦑', color: '#0277bd' },
    'PHOENIX':  { name: '피닉스', icon: '🦅', color: '#ff5722' },
    'BEHEMOTH': { name: '베히모스', icon: '🦏', color: '#5d4037' },
    'DRAGON':   { name: '드래곤', icon: '🐲', color: '#ffc107' }
};

export const BUILDING_PALETTE = {
    'START_POINT': { name: '입구 (START)', icon: '🏁', color: '#448aff' },
    'EXIT_POINT':  { name: '출구 (EXIT)',  icon: '🚪', color: '#ff5252' },
    
    'SHOP_WEAPON': { name: '무기 상점',   icon: '⚔️', color: '#ffb74d' },
    'SHOP_ARMOR':  { name: '방어구점',    icon: '🛡️', color: '#a1887f' },
    'SHOP_POTION': { name: '연금술사',    icon: '🧪', color: '#ba68c8' },
    'SHOP_MAGIC':  { name: '마법 상점',   icon: '🔮', color: '#9575cd' },
    'INN':         { name: '여관',        icon: '🏨', color: '#f06292' },
    'BLACKSMITH':  { name: '대장간',      icon: '🔨', color: '#ef5350' },
    'TAVERN':      { name: '선술집',      icon: '🍺', color: '#ffca28' },
    'BANK':        { name: '은행',        icon: '💰', color: '#ffd700' },
    'CASTLE':      { name: '성',          icon: '🏰', color: '#b0bec5' },
    'TOWER':       { name: '탑',          icon: '🗼', color: '#78909c' },
    'CHURCH':      { name: '교회',        icon: '⛪', color: '#81d4fa' },
    'TEMPLE':      { name: '신전',        icon: '🏛️', color: '#fff9c4' },
    'RUINS':       { name: '폐허',        icon: '🏚️', color: '#8d6e63' },
    'TENT':        { name: '텐트',        icon: '⛺', color: '#8bc34a' },
    'WELL':        { name: '우물',        icon: '🕳️', color: '#039be5' },
    'FOUNTAIN':    { name: '분수대',      icon: '⛲', color: '#29b6f6' },
    'SIGNPOST':    { name: '이정표',      icon: '🪧', color: '#d7ccc8' },
    'GRAVE':       { name: '무덤',        icon: '🪦', color: '#bdbdbd' },
    'PORTAL':      { name: '포탈',        icon: '🌀', color: '#e040fb' },

    'CHEST':           { name: '일반 상자 (직접입력)', icon: '📦', color: '#ffcc80' }, 
    'BOX_STAGE_1':     { name: '📦 초반 보급상자', icon: '📦', color: '#8d6e63' },
    'BOX_STAGE_2':     { name: '🎁 중반 탐험상자', icon: '🎁', color: '#26a69a' },
    'BOX_STAGE_3':     { name: '👑 후반 황금상자', icon: '👑', color: '#ffd700' },
    'BOX_SUPPLY':      { name: '🎒 보급품(물약)',  icon: '🎒', color: '#81c784' },
    'BOX_EQUIP_ONLY':  { name: '⚔️ 무기고(장비)',  icon: '⚔️', color: '#b0bec5' },
    'BOX_GAMBLE':      { name: '🎲 도박 상자',     icon: '🎲', color: '#ff5252' },
    'BOX_BOSS_MID':    { name: '👹 중간보스 보상', icon: '👹', color: '#7e57c2' },
    'BOX_BOSS_FINAL':  { name: '🐲 전설의 보물',   icon: '🐲', color: '#c62828' },
};

export const HIDDEN_PALETTE = {
    'HIDDEN_ITEM':    { name: '숨겨진 아이템(직접)', icon: '❓', color: 'rgba(255, 255, 255, 0.5)' },
    'HIDDEN_CAVE':    { name: '비밀 동굴(이동)',     icon: '🕳️', color: 'rgba(100, 100, 255, 0.5)' },
    'HIDDEN_TRAP':    { name: '숨겨진 함정(데미지)', icon: '💥', color: 'rgba(255, 50, 50, 0.5)' },
    'HIDDEN_STAGE_1': { name: '✨ 숨겨진 보급(초반)', icon: '✨', color: 'rgba(255, 215, 0, 0.5)' },
    'HIDDEN_STAGE_2': { name: '💎 숨겨진 보물(중반)', icon: '💎', color: 'rgba(0, 255, 255, 0.5)' },
    'HIDDEN_STAGE_3': { name: '👑 숨겨진 유산(후반)', icon: '👑', color: 'rgba(255, 100, 255, 0.5)' },
    'HIDDEN_SUPPLY':  { name: '🏺 매몰된 물자',       icon: '🏺', color: 'rgba(100, 200, 100, 0.5)' },
    'HIDDEN_EQUIP':   { name: '⚔️ 전사의 무덤',       icon: '⚔️', color: 'rgba(200, 200, 200, 0.5)' },
    'HIDDEN_GAMBLE':  { name: '🎲 도박꾼의 비상금',   icon: '🎲', color: 'rgba(255, 100, 100, 0.5)' }
};

class EditorApp {
    constructor() {
        this.viewports = {
            top: {
                canvas: document.getElementById('canvas-top'),
                ctx: null, grid: null, camera: { x: 0, y: 0 }, scale: 1.0, stageId: '1-1', readOnly: true
            },
            bottom: {
                canvas: document.getElementById('canvas-bottom'),
                ctx: null, grid: null, camera: { x: 0, y: 0 }, scale: 1.0, stageId: '1-1', readOnly: false
            }
        };

        this.viewports.top.ctx = this.viewports.top.canvas.getContext('2d');
        this.viewports.top.grid = new HexGrid(this.viewports.top.canvas);
        
        this.viewports.bottom.ctx = this.viewports.bottom.canvas.getContext('2d');
        this.viewports.bottom.grid = new HexGrid(this.viewports.bottom.canvas);

        this.brush = {
            type: 'terrain',
            key: 'PLAIN',
            height: 0,
            monsterLevel: 1,
            buildingText: '', 
            mode: 'paint'
        };

        this.paletteSettings = { terrain: {}, monster: {}, building: {}, hidden: {} };
        this.history = [];

        this.isDragging = false;
        this.isPainting = false;
        this.lastMouse = { x: 0, y: 0 };
        this.activeViewport = null;
        this.showInfo = true; 
        this.isResizingSplitter = false;
        
        this.selectedHex = null;

        this.init();
    }

    init() {
        this.initSettings();
        this.resizeCanvas();
        this.initUI();
        this.renderPalette('terrain');
        this.bindEvents();
        this.generateStageSlots();
        
        this.loadStage('bottom', '1-1', true);
        this.loadStage('top', '1-1', true);

        setTimeout(() => {
            this.centerCamera('bottom');
            this.centerCamera('top');
        }, 100);

        this.editorLoop();
    }

    initSettings() {
        for (const [key, data] of Object.entries(EDITOR_PALETTE)) {
            this.paletteSettings.terrain[key] = { height: data.defaultH !== undefined ? data.defaultH : 0, cost: data.cost };
        }
        for (const [key] of Object.entries(MONSTER_PALETTE)) {
            this.paletteSettings.monster[key] = { level: 1 };
        }
        for (const [key] of Object.entries(BUILDING_PALETTE)) {
            this.paletteSettings.building[key] = { text: '' };
        }
        for (const [key] of Object.entries(HIDDEN_PALETTE)) {
            this.paletteSettings.hidden[key] = { text: '' }; 
        }
    }

    editorLoop() {
        this.renderViewport('top');
        this.renderViewport('bottom');
        requestAnimationFrame(() => this.editorLoop());
    }

    renderViewport(vpName) {
        const vp = this.viewports[vpName];
        if(!vp.ctx) return;

        vp.ctx.clearRect(0, 0, vp.canvas.width, vp.canvas.height);
        const sorted = vp.grid.getSortedHexes();
        
        sorted.forEach(h => {
            const data = vp.grid.terrainMap.get(`${h.q},${h.r}`) || { key: 'PLAIN', h: 0 };
            const terrain = EDITOR_PALETTE[data.key] || EDITOR_PALETTE['PLAIN'];
            const drawH = (data.h || 0) * 10; 
            
            const center = this.drawHex(vp, h.q, h.r, terrain, drawH);
            
            if (data.deploy) this.drawDeployMarker(vp, center.x, center.y, 40 * vp.grid.scale);
            if (data.monster) this.drawMonster(vp, center.x, center.y, data.monster);
            if (data.building) this.drawBuilding(vp, center.x, center.y, data.building);
            
            if (data.hidden) this.drawHidden(vp, center.x, center.y, data.hidden);

            if (vpName === 'bottom' && this.showInfo && vp.grid.scale > 0.4) {
                const yOffset = (data.monster || data.building || data.hidden) ? (20 * vp.grid.scale) : 0;
                this.drawHexInfo(vp, center.x, center.y + yOffset, terrain, data);
            }
        });

        if (this.activeViewport === vpName && this.hoverHex) {
            this.drawCursor(vp, this.hoverHex);
        }

        if (vpName === 'bottom' && this.selectedHex) {
            this.drawCursor(vp, this.selectedHex, "cyan");
        }
    }

    drawHex(vp, q, r, terrain, height) {
        const size = 40 * vp.grid.scale;
        const tilt = 0.6;
        
        const x2d = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y2d = size * (3/2 * r);
        const centerX = x2d + 400 + vp.camera.x;
        const centerY = (y2d * tilt) - height + 300 + vp.camera.y;
        
        if (height !== 0) {
            const baseY = (y2d * tilt) + 300 + vp.camera.y;
            vp.ctx.fillStyle = terrain.side;
            this.drawPrismSides(vp.ctx, centerX, centerY, baseY, size, tilt);
        }

        vp.ctx.fillStyle = terrain.color;
        vp.ctx.lineWidth = 1;
        vp.ctx.strokeStyle = "rgba(0,0,0,0.15)"; 
        this.drawHexPoly(vp.ctx, centerX, centerY, size, tilt);
        vp.ctx.fill();
        vp.ctx.stroke();

        return { x: centerX, y: centerY };
    }

    drawPrismSides(ctx, cx, topY, baseY, size, tilt) {
        const angles = [0, 1, 2, 3, 4, 5];
        const pointsTop = angles.map(i => {
            const rad = (60 * i + 30) * Math.PI / 180;
            return { x: cx + size * Math.cos(rad), y: topY + size * Math.sin(rad) * tilt };
        });
        const pointsBase = angles.map(i => {
            const rad = (60 * i + 30) * Math.PI / 180;
            return { x: cx + size * Math.cos(rad), y: baseY + size * Math.sin(rad) * tilt };
        });

        const originalStroke = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        
        // ⭐ [버그 해결 1] 기둥 내부의 쓸모없는 선(Seam) 제거
        // 테두리 색상(strokeStyle)을 기둥 면의 색상(fillStyle)과 완전히 동일하게 맞춰서 통짜 블록처럼 보이게 만듭니다.
        ctx.strokeStyle = ctx.fillStyle; 
        ctx.lineWidth = 1.5; // 안티앨리어싱으로 인한 미세한 틈새를 메우기 위해 1.5로 설정

        // ⭐ [버그 해결 2] 뒷배경이 뚫려 보이는 현상 (Missing Face) 해결
        // 카메라 시점에서 보이지 않는 뒷면(3, 4)을 빼고, 반드시 그려야 하는 앞면/왼쪽면(2, 1, 0, 5)을 렌더링하도록 궤도를 수정합니다.
        [2, 1, 0, 5].forEach(i => {
            const next = (i + 1) % 6;
            ctx.beginPath();
            ctx.moveTo(pointsTop[i].x, pointsTop[i].y);
            ctx.lineTo(pointsTop[next].x, pointsTop[next].y);
            ctx.lineTo(pointsBase[next].x, pointsBase[next].y);
            ctx.lineTo(pointsBase[i].x, pointsBase[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        ctx.strokeStyle = originalStroke;
        ctx.lineWidth = originalLineWidth;
    }

    drawDeployMarker(vp, x, y, size) {
        const tilt = 0.6;
        vp.ctx.fillStyle = "rgba(0, 100, 255, 0.4)";
        vp.ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
        vp.ctx.lineWidth = 3;
        this.drawHexPoly(vp.ctx, x, y, size * 0.9, tilt);
        vp.ctx.fill();
        vp.ctx.stroke();
    }

    getContrastColor(hexColor) {
        if(hexColor.startsWith('rgba')) return '#000000';
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }

    drawMonster(vp, x, y, monsterData) {
        const info = MONSTER_PALETTE[monsterData.key];
        if (!info) return;

        const iconSize = Math.max(12, 24 * vp.grid.scale);
        const fontSize = Math.max(9, 10 * vp.grid.scale);

        vp.ctx.textAlign = "center";
        vp.ctx.textBaseline = "middle";
        
        vp.ctx.font = `${iconSize}px serif`;
        vp.ctx.fillStyle = "#fff";
        vp.ctx.shadowColor = "rgba(0,0,0,0.5)";
        vp.ctx.shadowBlur = 2;
        vp.ctx.fillText(info.icon, x, y - iconSize * 0.2); 
        vp.ctx.shadowBlur = 0;
        
        const lvText = `Lv.${monsterData.level}`;
        vp.ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = vp.ctx.measureText(lvText).width;
        
        vp.ctx.fillStyle = "rgba(0,0,0,0.6)"; 
        vp.ctx.fillRect(x - textWidth/2 - 2, y + iconSize/2, textWidth + 4, fontSize + 2);
        
        vp.ctx.fillStyle = "#ff5555"; 
        vp.ctx.fillText(lvText, x, y + iconSize/2 + fontSize/2 + 1);
    }

    drawBuilding(vp, x, y, buildingData) {
        const info = BUILDING_PALETTE[buildingData.key];
        if (!info) return;

        const iconSize = Math.max(14, 28 * vp.grid.scale);
        const fontSize = Math.max(9, 11 * vp.grid.scale);

        vp.ctx.textAlign = "center";
        vp.ctx.textBaseline = "middle";

        vp.ctx.font = `${iconSize}px serif`;
        vp.ctx.shadowColor = "rgba(0,0,0,0.5)";
        vp.ctx.shadowBlur = 4;
        vp.ctx.fillStyle = "#fff";
        vp.ctx.fillText(info.icon, x, y - iconSize * 0.3);
        vp.ctx.shadowBlur = 0;

        if (buildingData.text) {
            vp.ctx.font = `bold ${fontSize}px sans-serif`;
            const textWidth = vp.ctx.measureText(buildingData.text).width;
            
            vp.ctx.fillStyle = "rgba(0,0,0,0.7)";
            vp.ctx.fillRect(x - textWidth/2 - 4, y + iconSize/2 - 2, textWidth + 8, fontSize + 6);
            
            vp.ctx.fillStyle = "#ffd700"; 
            vp.ctx.fillText(buildingData.text, x, y + iconSize/2 + fontSize/2);
        }
    }

    drawHidden(vp, x, y, hiddenData) {
        const info = HIDDEN_PALETTE[hiddenData.key];
        if (!info) return;

        const iconSize = Math.max(12, 24 * vp.grid.scale);
        const fontSize = Math.max(8, 10 * vp.grid.scale);

        vp.ctx.textAlign = "center";
        vp.ctx.textBaseline = "middle";
        vp.ctx.globalAlpha = 0.6;

        vp.ctx.font = `${iconSize}px serif`;
        vp.ctx.shadowColor = info.color;
        vp.ctx.shadowBlur = 10;
        vp.ctx.fillStyle = "#fff";
        vp.ctx.fillText(info.icon, x, y); 
        
        vp.ctx.shadowBlur = 0;
        vp.ctx.globalAlpha = 1.0; 

        if (hiddenData.text) {
            vp.ctx.font = `bold ${fontSize}px monospace`;
            vp.ctx.fillStyle = "#ff88ff"; 
            vp.ctx.fillText(hiddenData.text, x, y + iconSize/2 + 5);
        }
    }

    drawHexInfo(vp, x, y, terrain, data) {
        const ctx = vp.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textColor = this.getContrastColor(terrain.color);
        const subColor = (textColor === '#ffffff') ? '#cccccc' : '#444444';
        
        const nameSize = Math.max(9, 11 * vp.grid.scale);
        const infoSize = Math.max(8, 9 * vp.grid.scale);
        
        ctx.font = `${nameSize}px sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(terrain.name, x, y - infoSize * 0.6);

        const costText = terrain.cost >= 99 ? "X" : terrain.cost;
        const costColor = terrain.cost >= 99 ? '#ff0000' : (textColor === '#ffffff' ? '#aaaaff' : '#0000ff');

        ctx.font = `${infoSize}px monospace`;
        const infoY = y + infoSize * 0.6;
        
        ctx.fillStyle = subColor;
        ctx.fillText(`h:${(data.h||0)}`, x - 10 * vp.grid.scale, infoY);
        ctx.fillStyle = textColor;
        ctx.fillText("|", x, infoY);
        ctx.fillStyle = costColor;
        ctx.fillText(`c:${costText}`, x + 12 * vp.grid.scale, infoY);

        if (vp.grid.scale > 0.6) { 
            ctx.font = `${Math.max(8, 9 * vp.grid.scale)}px sans-serif`;
            ctx.fillStyle = (textColor === '#ffffff') ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)"; 
            
            const desc = terrain.desc || ""; 
            if (desc) {
                ctx.fillText(desc.substring(0, 15) + (desc.length > 15 ? "..." : ""), x, y + 14 * vp.grid.scale);
            }
        }
    }

    getDynamicCost(terrain, height) {
        return terrain.cost;
    }

    drawHexPoly(ctx, x, y, size, tilt) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const rad = (60 * i + 30) * Math.PI / 180;
            const px = x + size * Math.cos(rad);
            const py = y + size * Math.sin(rad) * tilt;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    drawCursor(vp, hex, color="white") {
        const size = 40 * vp.grid.scale;
        const tilt = 0.6;
        
        const data = vp.grid.terrainMap.get(`${hex.q},${hex.r}`);
        const currentH = data ? (data.h || 0) * 10 : 0;
        
        const targetH = (vp.readOnly || this.brush.mode !== 'paint' || this.brush.type !== 'terrain') 
                        ? currentH : this.brush.height * 10;
        
        const x2d = size * (Math.sqrt(3) * hex.q + Math.sqrt(3)/2 * hex.r);
        const y2d = size * (3/2 * hex.r);
        const cx = x2d + 400 + vp.camera.x;
        const cy = (y2d * tilt) - targetH + 300 + vp.camera.y;

        vp.ctx.strokeStyle = color;
        vp.ctx.lineWidth = 3;
        this.drawHexPoly(vp.ctx, cx, cy, size * 0.9, tilt);
        vp.ctx.stroke();
    }

    initUI() {
        this.brushPreview = document.getElementById('brush-preview-box');
        
        const splitter = document.getElementById('splitter');
        splitter.addEventListener('mousedown', () => { this.isResizingSplitter = true; });
        window.addEventListener('mouseup', () => { this.isResizingSplitter = false; });
        window.addEventListener('mousemove', (e) => {
            if (this.isResizingSplitter) {
                const totalH = document.getElementById('split-viewport').clientHeight;
                const topH = e.clientY - document.getElementById('editor-nav').clientHeight;
                const percent = (topH / totalH) * 100;
                if (percent > 10 && percent < 90) {
                    document.getElementById('view-top').style.height = `${percent}%`;
                    this.resizeCanvas();
                }
            }
        });

        document.getElementById('chk-show-info').addEventListener('change', (e) => {
            this.showInfo = e.target.checked;
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
                this.renderPalette(btn.dataset.tab);
            };
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.onclick = () => this.setMode(btn.dataset.mode);
        });

        const textInput = document.getElementById('inp-brush-text');
        textInput.addEventListener('input', (e) => {
            const val = e.target.value;
            this.brush.buildingText = val;
            
            if (this.brush.type === 'building' && this.brush.key) {
                this.paletteSettings.building[this.brush.key].text = val;
            } else if (this.brush.type === 'hidden' && this.brush.key) {
                this.paletteSettings.hidden[this.brush.key].text = val;
            }
            
            if (this.selectedHex) {
                const vp = this.viewports.bottom;
                const key = `${this.selectedHex.q},${this.selectedHex.r}`;
                const cell = vp.grid.terrainMap.get(key);
                
                if (cell) {
                    if (this.brush.type === 'building' && cell.building) {
                        cell.building.text = val; 
                    } else if (this.brush.type === 'hidden' && cell.hidden) {
                        cell.hidden.text = val;
                    }
                }
            }
            
            this.updateBrushPreview();
        });
        
        document.getElementById('btn-save-local').onclick = () => this.saveStage('bottom');
        document.getElementById('btn-load-local').onclick = () => {
            const currentSlot = this.viewports.bottom.stageId;
            this.loadStage('bottom', currentSlot);
            alert(`Loaded Slot: ${currentSlot}`);
        };
        document.getElementById('btn-export-json').onclick = () => this.exportJson();
        document.getElementById('btn-import-json').onclick = () => this.promptImport('bottom');

        document.getElementById('btn-undo').onclick = () => this.handleUndo();
        document.getElementById('btn-reset-map').onclick = () => this.resetMap();
        
        document.getElementById('btn-resize-map').onclick = () => {
            const cols = parseInt(document.getElementById('inp-map-cols').value) || 22;
            const rows = parseInt(document.getElementById('inp-map-rows').value) || 12;
            this.viewports.bottom.grid.mapCols = cols;
            this.viewports.bottom.grid.mapRows = rows;
            this.viewports.bottom.grid.initGrid();
            this.loadStage('bottom', this.viewports.bottom.stageId); 
            this.centerCamera('bottom');
            alert(`Map Resized to ${cols}x${rows}`);
        };

        document.getElementById('btn-center-map').onclick = () => this.centerCamera('bottom');
        document.getElementById('btn-center-top').onclick = () => this.centerCamera('top');
        
        document.getElementById('stage-slot-select').onchange = (e) => {
            this.viewports.bottom.stageId = e.target.value;
            this.loadStage('bottom', e.target.value);
        };
        
        document.getElementById('top-view-select').onchange = (e) => {
            const val = e.target.value;
            if(val) {
                this.viewports.top.stageId = val;
                this.loadStage('top', val);
            }
        };

        const btnImportTop = document.getElementById('btn-import-top');
        if (btnImportTop) {
            btnImportTop.onclick = () => this.promptImport('top');
        }
    }

    generateStageSlots() {
        const selBottom = document.getElementById('stage-slot-select');
        const selTop = document.getElementById('top-view-select');
        selBottom.innerHTML = '';
        selTop.innerHTML = '<option value="">(Select Stage)</option>'; 
        
        for(let c=1; c<=3; c++) {
            for(let s=1; s<=10; s++) {
                const val = `${c}-${s}`;
                const text = `Stage ${c}-${s}`;
                const opt1 = document.createElement('option'); opt1.value = val; opt1.textContent = text;
                selBottom.appendChild(opt1);
                const opt2 = document.createElement('option'); opt2.value = val; opt2.textContent = text;
                selTop.appendChild(opt2);
            }
        }
    }

    renderPalette(type = 'terrain') {
        let gridId, source;
        if (type === 'terrain') {
            gridId = 'palette-terrain'; source = EDITOR_PALETTE;
        } else if (type === 'object') {
            gridId = 'palette-monster'; source = MONSTER_PALETTE;
        } else if (type === 'building') {
            gridId = 'palette-building'; source = BUILDING_PALETTE;
        } else if (type === 'hidden') {
            gridId = 'palette-hidden'; source = HIDDEN_PALETTE;
        }
        
        const grid = document.getElementById(gridId);
        if(!grid) return;
        grid.innerHTML = '';

        const textInputGroup = document.getElementById('group-text-input');
        if (type === 'building' || type === 'hidden') {
            textInputGroup.style.display = 'block';
            const label = textInputGroup.querySelector('label');
            if(type === 'hidden') label.innerHTML = '🏷️ Parameter (ID/Stage/Dmg)';
            else label.innerHTML = '🏷️ Custom Text';
        } else {
            textInputGroup.style.display = 'none';
        }

        for (const [key, data] of Object.entries(source)) {
            const item = document.createElement('div');
            item.className = 'palette-item';
            
            const visual = document.createElement('div');
            visual.className = 'palette-visual';
            if (type === 'terrain') {
                visual.style.background = data.color;
            } else {
                visual.style.background = data.color;
                visual.innerHTML = data.icon;
            }
            
            const infoBox = document.createElement('div');
            infoBox.className = 'palette-info';
            
            const nameEl = document.createElement('div');
            nameEl.className = 'palette-name';
            nameEl.textContent = data.name;
            
            const ctrlBox = document.createElement('div');
            ctrlBox.className = 'palette-controls';
            
            if (type === 'terrain' && !data.isMarker) {
                const btnMinus = document.createElement('div'); btnMinus.className = 'p-btn'; btnMinus.textContent = '-';
                const valDisplay = document.createElement('div'); valDisplay.className = 'p-val';
                const btnPlus = document.createElement('div'); btnPlus.className = 'p-btn'; btnPlus.textContent = '+';
                
                const setting = this.paletteSettings.terrain[key];
                const updateDisplay = () => {
                     const cost = this.getDynamicCost(data, setting.height);
                     valDisplay.innerHTML = `H:${setting.height.toFixed(1)} <span class="p-sub">(C:${cost})</span>`;
                     if (this.brush.key === key && this.brush.type === 'terrain') {
                         this.brush.height = setting.height;
                         this.updateBrushPreview();
                     }
                };
                btnMinus.onclick = (e) => { e.stopPropagation(); setting.height = parseFloat((setting.height - 0.2).toFixed(1)); updateDisplay(); };
                btnPlus.onclick = (e) => { e.stopPropagation(); setting.height = parseFloat((setting.height + 0.2).toFixed(1)); updateDisplay(); };
                updateDisplay();
                ctrlBox.append(btnMinus, valDisplay, btnPlus);
                infoBox.append(nameEl, ctrlBox);
            } 
            else if (type === 'object') {
                const btnMinus = document.createElement('div'); btnMinus.className = 'p-btn'; btnMinus.textContent = '-';
                const valDisplay = document.createElement('div'); valDisplay.className = 'p-val';
                const btnPlus = document.createElement('div'); btnPlus.className = 'p-btn'; btnPlus.textContent = '+';

                const setting = this.paletteSettings.monster[key];
                const updateDisplay = () => {
                     valDisplay.textContent = `Lv.${setting.level}`;
                     if (this.brush.key === key && this.brush.type === 'object') {
                         this.brush.monsterLevel = setting.level;
                         this.updateBrushPreview();
                     }
                };
                btnMinus.onclick = (e) => { e.stopPropagation(); if(setting.level>1) setting.level--; updateDisplay(); };
                btnPlus.onclick = (e) => { e.stopPropagation(); if(setting.level<99) setting.level++; updateDisplay(); };
                updateDisplay();
                ctrlBox.append(btnMinus, valDisplay, btnPlus);
                infoBox.append(nameEl, ctrlBox);
            } 
            else {
                infoBox.append(nameEl);
            }

            item.append(visual, infoBox);

            item.onclick = () => {
                this.brush.type = type;
                this.brush.key = key;
                this.setMode('paint');
                
                let defaultText = '';
                
                if (type === 'terrain') {
                    if(!data.isMarker) this.brush.height = this.paletteSettings.terrain[key].height;
                } else if (type === 'object') {
                    this.brush.monsterLevel = this.paletteSettings.monster[key].level;
                } else if (type === 'building') {
                    defaultText = this.paletteSettings.building[key].text || data.text || '';
                    this.brush.buildingText = defaultText;
                    document.getElementById('inp-brush-text').value = defaultText;
                    
                    if (data.text) this.paletteSettings.building[key].text = data.text;

                } else if (type === 'hidden') {
                    defaultText = this.paletteSettings.hidden[key].text || data.text || '';
                    this.brush.buildingText = defaultText; 
                    document.getElementById('inp-brush-text').value = defaultText;
                    
                    if (data.text) this.paletteSettings.hidden[key].text = data.text;
                }

                document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.updateBrushPreview();
            };
            
            grid.appendChild(item);
        }
    }

    updateBrushPreview() {
        let source, data;
        if (this.brush.type === 'terrain') { source = EDITOR_PALETTE; }
        else if (this.brush.type === 'object') { source = MONSTER_PALETTE; }
        else if (this.brush.type === 'building') { source = BUILDING_PALETTE; }
        else if (this.brush.type === 'hidden') { source = HIDDEN_PALETTE; }

        data = source[this.brush.key];
        
        if (this.brush.type === 'terrain') {
            const h = data.isMarker ? '-' : this.brush.height.toFixed(1);
            this.brushPreview.style.backgroundColor = data ? data.color : '#333';
            this.brushPreview.textContent = `${data.name} (H:${h})`;
            this.brushPreview.style.color = '#fff';
        } else if (this.brush.type === 'object') {
            this.brushPreview.style.backgroundColor = data ? data.color : '#333';
            this.brushPreview.textContent = `${data.icon} ${data.name} (Lv.${this.brush.monsterLevel})`;
            this.brushPreview.style.color = '#fff';
        } else if (this.brush.type === 'hidden') {
            this.brushPreview.style.backgroundColor = '#333';
            const txt = this.brush.buildingText ? `[${this.brush.buildingText}]` : '';
            this.brushPreview.textContent = `${data.icon} ${data.name} ${txt}`;
            this.brushPreview.style.color = '#ff88ff';
        } else {
            this.brushPreview.style.backgroundColor = data ? data.color : '#333';
            const txt = this.brush.buildingText ? `"${this.brush.buildingText}"` : '';
            this.brushPreview.textContent = `${data.icon} ${data.name} ${txt}`;
            this.brushPreview.style.color = '#fff';
        }
        this.brushPreview.style.textShadow = '1px 1px 2px #000';
    }
    
    setMode(mode) {
        this.brush.mode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active');
        
        const cursor = mode === 'hand' ? 'grab' : 'crosshair';
        this.viewports.bottom.canvas.style.cursor = cursor;
        this.viewports.top.canvas.style.cursor = cursor;
    }

    bindEvents() {
        ['top', 'bottom'].forEach(vpName => {
            const canvas = this.viewports[vpName].canvas;
            
            canvas.onmousedown = (e) => {
                this.activeViewport = vpName;
                const vp = this.viewports[vpName];

                if (e.button === 2) {
                    this.handleSelect(e, vp);
                    return;
                }

                if (this.brush.mode === 'hand' || e.button === 1 || (e.button === 0 && e.altKey)) { 
                    this.isDragging = true;
                    this.lastMouse = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'grabbing';
                } else if (e.button === 0 && !vp.readOnly) { 
                    this.isPainting = true;
                    this.handlePaint(e, vp);
                }
            };

            canvas.oncontextmenu = (e) => e.preventDefault();

            canvas.onmousemove = (e) => {
                this.activeViewport = vpName;
                const vp = this.viewports[vpName];
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const x2d = mouseX - 400 - vp.camera.x;
                const y2d = (mouseY - 300 - vp.camera.y) / 0.6; 
                
                const size = 40 * vp.grid.scale;
                const q = (Math.sqrt(3)/3 * x2d - 1/3 * y2d) / size;
                const r = (2/3 * y2d) / size;
                
                this.hoverHex = vp.grid.cubeToAxial(vp.grid.cubeRound(vp.grid.axialToCube(q, r)));
                
                if (vpName === 'bottom') {
                    const h = vp.grid.terrainMap.get(`${this.hoverHex.q},${this.hoverHex.r}`)?.h || 0;
                    document.getElementById('coordinate-info').textContent = `Hex: ${this.hoverHex.q}, ${this.hoverHex.r} | H: ${h.toFixed(1)}`;
                }

                if (this.isDragging) {
                    const dx = e.clientX - this.lastMouse.x;
                    const dy = e.clientY - this.lastMouse.y;
                    vp.camera.x += dx;
                    vp.camera.y += dy;
                    this.lastMouse = { x: e.clientX, y: e.clientY };
                }

                if (this.isPainting && !vp.readOnly) {
                    this.handlePaint(e, vp);
                }
            };

            canvas.onmouseup = () => {
                this.isDragging = false;
                this.isPainting = false;
                if(this.brush.mode === 'hand') canvas.style.cursor = 'grab';
                else canvas.style.cursor = 'crosshair';
            };
            
            canvas.onwheel = (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const vp = this.viewports[vpName];
                vp.grid.scale = Math.max(0.2, Math.min(3.0, vp.grid.scale + delta));
            };

            canvas.onmouseleave = () => {
                this.activeViewport = null;
                this.isDragging = false;
                this.isPainting = false;
            };
        });

        window.addEventListener('resize', () => this.resizeCanvas());

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return; 

            if (e.ctrlKey && e.code === 'KeyZ') {
                this.handleUndo();
            } else if (e.code === 'KeyH') {
                this.setMode('hand');
            } else if (e.code === 'KeyE') {
                this.setMode('erase');
            } else if (e.code === 'Space') {
                ['top', 'bottom'].forEach(k => this.viewports[k].canvas.style.cursor = 'grab');
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this.brush.mode !== 'hand') {
                ['top', 'bottom'].forEach(k => this.viewports[k].canvas.style.cursor = 'crosshair');
            }
        });
    }

    handleSelect(e, vp) {
        const rect = vp.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const x2d = mouseX - 400 - vp.camera.x;
        const y2d = (mouseY - 300 - vp.camera.y) / 0.6;
        
        const size = 40 * vp.grid.scale;
        const q = (Math.sqrt(3)/3 * x2d - 1/3 * y2d) / size;
        const r = (2/3 * y2d) / size;
        const hex = vp.grid.cubeToAxial(vp.grid.cubeRound(vp.grid.axialToCube(q, r)));

        this.selectedHex = hex;
        const key = `${hex.q},${hex.r}`;
        const cell = vp.grid.terrainMap.get(key);

        document.getElementById('coordinate-info').textContent = `Selected: ${key}`;

        if (cell) {
            if (cell.building) {
                this.brush.type = 'building';
                this.brush.key = cell.building.key;
                this.brush.buildingText = cell.building.text || '';
                
                document.getElementById('inp-brush-text').value = this.brush.buildingText;
                document.getElementById('group-text-input').style.display = 'block';
                
                const btn = document.querySelector('.tab-btn[data-tab="building"]');
                if(btn) btn.click();
            } 
            else if (cell.hidden) {
                this.brush.type = 'hidden';
                this.brush.key = cell.hidden.key;
                this.brush.buildingText = cell.hidden.text || '';
                
                document.getElementById('inp-brush-text').value = this.brush.buildingText;
                document.getElementById('group-text-input').style.display = 'block';
                
                const btn = document.querySelector('.tab-btn[data-tab="hidden"]');
                if(btn) btn.click();
            }
        }
    }

    saveState(key, vp) {
        const prev = vp.grid.terrainMap.get(key);
        const data = prev ? JSON.parse(JSON.stringify(prev)) : null;
        this.history.push({ key: key, data: data });
        if (this.history.length > 50) this.history.shift(); 
    }

    handleUndo() {
        const action = this.history.pop();
        if (!action) return;
        
        const vp = this.viewports.bottom;
        if (action.data) {
            vp.grid.terrainMap.set(action.key, action.data);
        } else {
            vp.grid.terrainMap.delete(action.key);
        }
    }

    handlePaint(e, vp) {
        if (!this.hoverHex || this.brush.mode === 'hand' || vp.readOnly) return; 
        const key = `${this.hoverHex.q},${this.hoverHex.r}`;
        let currentData = vp.grid.terrainMap.get(key);

        if (this.brush.mode === 'paint') {
            let newData;
            
            if (this.brush.type === 'terrain') {
                if (this.brush.key === 'DEPLOY_ZONE') {
                    if (currentData) {
                        newData = { ...currentData, deploy: true };
                    } else {
                        newData = { key: 'PLAIN', h: 0, deploy: true };
                    }
                } else {
                    if (currentData && currentData.key === this.brush.key && currentData.h === this.brush.height && !currentData.monster && !currentData.building && !currentData.hidden) return;
                    newData = { 
                        key: this.brush.key, 
                        h: this.brush.height,
                        monster: currentData ? currentData.monster : undefined,
                        building: currentData ? currentData.building : undefined,
                        hidden: currentData ? currentData.hidden : undefined,
                        deploy: currentData ? currentData.deploy : false
                    };
                }
            } 
            else if (this.brush.type === 'object') {
                newData = {
                    key: currentData ? currentData.key : 'PLAIN',
                    h: currentData ? currentData.h : 0,
                    monster: {
                        key: this.brush.key,
                        level: this.brush.monsterLevel
                    },
                    building: currentData ? currentData.building : undefined,
                    hidden: currentData ? currentData.hidden : undefined,
                    deploy: currentData ? currentData.deploy : false
                };
            } 
            else if (this.brush.type === 'building') {
                newData = {
                    key: currentData ? currentData.key : 'PLAIN',
                    h: currentData ? currentData.h : 0,
                    monster: currentData ? currentData.monster : undefined,
                    building: {
                        key: this.brush.key,
                        text: this.brush.buildingText
                    },
                    hidden: currentData ? currentData.hidden : undefined,
                    deploy: currentData ? currentData.deploy : false
                };
            }
            else if (this.brush.type === 'hidden') {
                newData = {
                    key: currentData ? currentData.key : 'PLAIN',
                    h: currentData ? currentData.h : 0,
                    monster: currentData ? currentData.monster : undefined,
                    building: currentData ? currentData.building : undefined,
                    hidden: {
                        key: this.brush.key,
                        text: this.brush.buildingText
                    },
                    deploy: currentData ? currentData.deploy : false
                };
                this.paletteSettings.hidden[this.brush.key].text = this.brush.buildingText;
            }

            this.saveState(key, vp);
            vp.grid.terrainMap.set(key, newData);

        } else if (this.brush.mode === 'erase') {
            if (!currentData) return;
            this.saveState(key, vp);

            if (this.brush.type === 'object') {
                if (currentData.monster) {
                    delete currentData.monster;
                    vp.grid.terrainMap.set(key, currentData);
                }
            } else if (this.brush.type === 'building') {
                 if (currentData.building) {
                    delete currentData.building;
                    vp.grid.terrainMap.set(key, currentData);
                }
            } else if (this.brush.type === 'hidden') {
                 if (currentData.hidden) {
                    delete currentData.hidden;
                    vp.grid.terrainMap.set(key, currentData);
                }
            } else if (this.brush.key === 'DEPLOY_ZONE') {
                 vp.grid.terrainMap.delete(key);
            } else {
                vp.grid.terrainMap.delete(key);
            }
        }
    }

    resizeCanvas() {
        ['top', 'bottom'].forEach(k => {
            const wrapper = document.getElementById(`view-${k}`);
            if(wrapper) {
                this.viewports[k].canvas.width = wrapper.clientWidth;
                this.viewports[k].canvas.height = wrapper.clientHeight;
            }
        });
    }
    
    centerCamera(vpName) {
        const vp = this.viewports[vpName];
        const size = 40 * vp.grid.scale;
        const midQ = Math.floor(vp.grid.mapCols / 2);
        const midR = Math.floor(vp.grid.mapRows / 2);
        const x2d = size * (Math.sqrt(3) * midQ + Math.sqrt(3)/2 * midR);
        const y2d = size * (3/2 * midR);
        vp.camera.x = (vp.canvas.width / 2) - x2d - 400;
        const tilt = 0.6;
        vp.camera.y = (vp.canvas.height / 2) - (y2d * tilt) - 300;
    }

    saveStage(vpName) {
        const vp = this.viewports[vpName];
        const data = {};
        for (const [pos, val] of vp.grid.terrainMap.entries()) {
            data[pos] = val; 
        }
        const saveData = {
            meta: { cols: vp.grid.mapCols, rows: vp.grid.mapRows },
            map: data
        };
        localStorage.setItem(`HEX_EDITOR_${vp.stageId}`, JSON.stringify(saveData));
        if(vpName === 'bottom') alert(`Stage ${vp.stageId} Saved!`);
    }

    loadStage(vpName, stageId, forceDefault = false) {
        const json = localStorage.getItem(`HEX_EDITOR_${stageId}`);
        const vp = this.viewports[vpName];
        vp.grid.terrainMap.clear();
        
        if (json) {
            const parsed = JSON.parse(json);
            if (parsed.meta) {
                vp.grid.mapCols = parsed.meta.cols;
                vp.grid.mapRows = parsed.meta.rows;
                vp.grid.initGrid(); 
                if (vpName === 'bottom') {
                    document.getElementById('inp-map-cols').value = parsed.meta.cols;
                    document.getElementById('inp-map-rows').value = parsed.meta.rows;
                }
                
                for (const [pos, val] of Object.entries(parsed.map)) {
                    if (typeof val === 'string') {
                        vp.grid.terrainMap.set(pos, { key: val, h: 0 });
                    } else {
                        // ⭐ [신규] 혹시라도 구버전 GRASS_01 데이터가 로드되면 즉시 PLAIN으로 세탁
                        if (val.key && val.key.includes('GRASS_0') && val.key !== 'GRASS') val.key = 'PLAIN';
                        vp.grid.terrainMap.set(pos, val);
                    }
                }
            } else {
                for (const [pos, val] of Object.entries(parsed.map || parsed)) { 
                    if (typeof val === 'string') {
                        vp.grid.terrainMap.set(pos, { key: val, h: 0 });
                    } else {
                        if (val.key && val.key.includes('GRASS_0') && val.key !== 'GRASS') val.key = 'PLAIN';
                        vp.grid.terrainMap.set(pos, val);
                    }
                }
            }
        } else if (forceDefault) {
            vp.grid.mapCols = 22; vp.grid.mapRows = 12;
            vp.grid.initGrid();
            for(let r=0; r<12; r++) {
                for(let c=0; c<22; c++) {
                    const q = c - (r - (r & 1)) / 2;
                    vp.grid.terrainMap.set(`${q},${r}`, { key: 'PLAIN', h: 0 });
                }
            }
        }
    }

    resetMap() {
        if(!confirm("Clear all tiles?")) return;
        const vp = this.viewports.bottom;
        vp.grid.terrainMap.clear();
        for(let r=0; r<vp.grid.mapRows; r++) {
            for(let c=0; c<vp.grid.mapCols; c++) {
                const q = c - (r - (r & 1)) / 2;
                vp.grid.terrainMap.set(`${q},${r}`, { key: 'PLAIN', h: 0 });
            }
        }
        this.centerCamera('bottom');
    }

    exportJson() {
        const vp = this.viewports.bottom;
        
        const exportData = {
            cols: vp.grid.mapCols, 
            rows: vp.grid.mapRows, 
            map: {},                
            enemies: [],
            structures: [],         
            deployment: [],
            hiddenObj: []
        };
        
        for (const [pos, val] of vp.grid.terrainMap.entries()) {
            exportData.map[pos] = { key: val.key, h: val.h || 0 };
            
            if (val.monster) {
                const [q, r] = pos.split(',');
                const monsterStr = `${val.monster.key}:${q}:${r}*${val.monster.level}`;
                exportData.enemies.push(monsterStr); 
            }

            if (val.building) {
                const [q, r] = pos.split(',');
                const text = val.building.text || '';
                const buildStr = `${val.building.key}:${q}:${r}:${text}`;
                exportData.structures.push(buildStr);
            }

            if (val.hidden) {
                const [q, r] = pos.split(',').map(Number);
                const pText = val.hidden.text || ''; 
                const hKey = val.hidden.key;         

                let type = null;
                let obj = { q: q, r: r, detected: false };

                if (hKey === 'HIDDEN_ITEM') {
                    type = 'ITEM'; 
                    obj.id = pText || 'POTION_S'; 
                } 
                else if (hKey === 'HIDDEN_CAVE') {
                    type = 'CAVE'; 
                    obj.stageId = pText || '1-1';
                } 
                else if (hKey === 'HIDDEN_TRAP') {
                    type = 'TRAP'; 
                    obj.val = parseInt(pText) || 10;
                }
                else if (pText.startsWith('BOX_') || 
                         ['HIDDEN_STAGE_1', 'HIDDEN_STAGE_2', 'HIDDEN_STAGE_3', 
                          'HIDDEN_SUPPLY', 'HIDDEN_EQUIP', 'HIDDEN_GAMBLE'].includes(hKey)) {
                    
                    type = 'ITEM';
                    if (pText) {
                        obj.id = pText;
                    } else {
                        if (hKey === 'HIDDEN_STAGE_1') obj.id = 'BOX_STAGE_1';
                        else if (hKey === 'HIDDEN_STAGE_2') obj.id = 'BOX_STAGE_2';
                        else if (hKey === 'HIDDEN_STAGE_3') obj.id = 'BOX_STAGE_3';
                        else obj.id = 'BOX_STAGE_1'; 
                    }
                }

                if (type) {
                    obj.type = type;
                    exportData.hiddenObj.push(obj);
                }
            }

            if (val.deploy) {
                exportData.deployment.push(pos);
            }
        }
        
        const jsonStr = JSON.stringify(exportData); 
        
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert("맵 데이터가 클립보드에 복사되었습니다!\n(몬스터, 건물, 숨겨진 요소 포함)");
        });
    }

    promptImport(vpName) {
        const jsonStr = prompt("스테이지 데이터(JSON)를 붙여넣으세요:");
        if (!jsonStr) return;
        this.loadFromJson(vpName, jsonStr);
    }

    loadFromJson(vpName, jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            const vp = this.viewports[vpName];
            
            const cols = data.cols || (data.meta ? data.meta.cols : 22);
            const rows = data.rows || (data.meta ? data.meta.rows : 12);
            
            vp.grid.mapCols = cols;
            vp.grid.mapRows = rows;
            vp.grid.initGrid(); 

            if (vpName === 'bottom') {
                const colsInput = document.getElementById('inp-map-cols');
                const rowsInput = document.getElementById('inp-map-rows');
                if (colsInput) colsInput.value = cols;
                if (rowsInput) rowsInput.value = rows;
            }

            vp.grid.terrainMap.clear();

            if (data.map) {
                Object.entries(data.map).forEach(([pos, val]) => {
                    if (typeof val === 'string') {
                        vp.grid.terrainMap.set(pos, { key: val, h: 0 });
                    } else {
                        // ⭐ 구버전 데이터 세탁
                        if (val.key && val.key.includes('GRASS_0') && val.key !== 'GRASS') val.key = 'PLAIN';
                        vp.grid.terrainMap.set(pos, val);
                    }
                });
            }

            if (data.enemies && Array.isArray(data.enemies)) {
                data.enemies.forEach(str => {
                    const [mainPart, lvStr] = str.split('*');
                    const level = parseInt(lvStr || '1');
                    
                    const parts = mainPart.split(':');
                    if (parts.length >= 3) {
                        const type = parts[0];
                        const q = parts[1];
                        const r = parts[2];
                        const key = `${q},${r}`;

                        let cell = vp.grid.terrainMap.get(key);
                        if (!cell) {
                            cell = { key: 'PLAIN', h: 0 };
                            vp.grid.terrainMap.set(key, cell);
                        }
                        cell.monster = { key: type, level: level };
                    }
                });
            }

            if (data.structures && Array.isArray(data.structures)) {
                data.structures.forEach(str => {
                    const parts = str.split(':');
                    if (parts.length >= 3) {
                        const type = parts[0];
                        const q = parts[1];
                        const r = parts[2];
                        const text = parts.slice(3).join(':'); 
                        const key = `${q},${r}`;

                        let cell = vp.grid.terrainMap.get(key);
                        if (!cell) {
                            cell = { key: 'PLAIN', h: 0 };
                            vp.grid.terrainMap.set(key, cell);
                        }
                        cell.building = { key: type, text: text };
                    }
                });
            }

            if (data.hiddenObj && Array.isArray(data.hiddenObj)) {
                data.hiddenObj.forEach(obj => {
                    const key = `${obj.q},${obj.r}`;
                    let cell = vp.grid.terrainMap.get(key);
                    // ⭐ [버그 픽스] 빈 타일에 숨겨진 오브젝트 생성 시 더 이상 'GRASS_01'이 나오지 않고 'PLAIN'으로 자동 생성됩니다.
                    if (!cell) {
                        cell = { key: 'PLAIN', h: 0 };
                        vp.grid.terrainMap.set(key, cell);
                    }

                    let editorKey, textVal;
                    if (obj.type === 'ITEM') { editorKey = 'HIDDEN_ITEM'; textVal = obj.id; }
                    else if (obj.type === 'CAVE') { editorKey = 'HIDDEN_CAVE'; textVal = obj.stageId; }
                    else if (obj.type === 'TRAP') { editorKey = 'HIDDEN_TRAP'; textVal = obj.val; }

                    if (editorKey) {
                        cell.hidden = { key: editorKey, text: textVal };
                    }
                });
            }

            if (data.deployment && Array.isArray(data.deployment)) {
                data.deployment.forEach(pos => {
                    let cell = vp.grid.terrainMap.get(pos);
                    // ⭐ [버그 픽스] 빈 타일에 배치구역 생성 시 더 이상 'GRASS_01'이 나오지 않고 'PLAIN'으로 자동 생성됩니다.
                    if (!cell) {
                        cell = { key: 'PLAIN', h: 0 };
                        vp.grid.terrainMap.set(pos, cell);
                    }
                    cell.deploy = true;
                });
            }

            this.centerCamera(vpName);

        } catch (e) {
            console.error(e);
            alert("데이터 로드 실패!\n올바른 JSON 형식이 아닙니다.\n" + e.message);
        }
    }
}

new EditorApp();