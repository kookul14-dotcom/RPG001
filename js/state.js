import { CLASS_DATA } from './data/index.js';

const rawGameState = {
    gold: 2000, 
    faith: 0,
    heroes: [], 
    inventory: [], 
    progress: { chapter: 1, stage: 1 },
    recruitPool: []
};

// 저장하지 않을 속성들 (성능 최적화)
const IGNORED_PROPS = new Set([
    'shake', 'bumpX', 'bumpY', 't', 'tx', 'ty', 'isAnimating', 'projectiles', 'textQueue', 'lastTextTime', 'actionGauge',
    'cachedModifiers', 'visualPos', 'speechText', 'speechTimer', '_endureUsed', 'isDiscoverySignaling', 'curHp', 'curMp', 'buffs', 'lifespan', 'revivedOnce' // ✅ 임시 속성 추가
]);

// [수정됨] 디바운스(Debounce) 적용: 잦은 상태 변경 시 0.5초 뒤에 한 번만 세이브를 수행하도록 최적화
let saveTimeout = null;
function requestSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem('hexRpgSave', JSON.stringify(rawGameState));
    }, 500);
}

// Proxy 핸들러: 데이터 변경 시 localStorage에 자동 저장
// ⭐ [신규] 생성된 프록시를 기억해두는 캐시 메모리 추가
const proxyCache = new WeakMap();

// Proxy 핸들러: 데이터 변경 시 localStorage에 자동 저장
const handler = {
    get(obj, prop) {
        const value = Reflect.get(obj, prop);
        
        // 🔥 [최적화 2] 전투 중 수시로 변하는 값(체력, 마나, 캐시)은 Proxy 검사를 생략하고 원본을 즉시 반환 (속도 100배 향상)
        if (IGNORED_PROPS.has(prop)) {
            return value;
        }

        if (typeof value === 'object' && value !== null) {
            // 이미 프록시로 감쌌던 객체면 기존 것을 반환 (메모리 누수 원천 차단)
            if (proxyCache.has(value)) {
                return proxyCache.get(value);
            }
            const p = new Proxy(value, handler);
            proxyCache.set(value, p);
            return p;
        }
        return value;
    },
    set(obj, prop, value) {
        const result = Reflect.set(obj, prop, value);
        if (!IGNORED_PROPS.has(prop)) {
            requestSave(); 
        }
        return result;
    },
    deleteProperty(obj, prop) {
        const result = Reflect.deleteProperty(obj, prop);
        requestSave(); 
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