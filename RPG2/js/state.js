import { CLASS_DATA } from './data/index.js';

// 초기 데이터 구조
const rawGameState = {
    gold: 2000, 
    faith: 0,
    heroes: [], 
    inventory: [], 
    progress: { chapter: 1, stage: 1 },
    recruitPool: [],
    shopStock: [] 
};

// 저장하지 않을 속성들 (성능 최적화)
const IGNORED_PROPS = new Set([
    'shake', 'bumpX', 'bumpY', 't', 'tx', 'ty', 'isAnimating', 'projectiles', 'textQueue', 'lastTextTime', 'actionGauge'
]);

// Proxy 핸들러: 데이터 변경 시 localStorage에 자동 저장
const handler = {
    get(obj, prop) {
        const value = Reflect.get(obj, prop);
        if (typeof value === 'object' && value !== null) {
            return new Proxy(value, handler);
        }
        return value;
    },
    set(obj, prop, value) {
        const result = Reflect.set(obj, prop, value);
        if (!IGNORED_PROPS.has(prop)) {
            localStorage.setItem('hexRpgSave', JSON.stringify(rawGameState));
        }
        return result;
    },
    deleteProperty(obj, prop) {
        const result = Reflect.deleteProperty(obj, prop);
        localStorage.setItem('hexRpgSave', JSON.stringify(rawGameState));
        return result;
    }
};

export const GameState = new Proxy(rawGameState, handler);

export function loadGame() {
    const save = localStorage.getItem('hexRpgSave');
    if (save) {
        try {
            const data = JSON.parse(save);
            for (let key in data) {
                // 저장된 데이터를 현재 상태에 덮어쓰기
                rawGameState[key] = data[key];
            }
            console.log("💾 Save Loaded Successfully");
        } catch (e) {
            console.error("Save Load Failed:", e);
        }
    }
}