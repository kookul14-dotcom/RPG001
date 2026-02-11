import { EFFECTS, STAGE_DATA, CLASS_DATA, SKILL_DATABASE, ELEMENTS, TERRAIN_TYPES } from '../../data/index.js';
import * as Formulas from '../../utils/formulas.js';
import { SkillProcessor } from './SkillProcessor.js';
import { BattleInput } from './BattleInput.js';
import { BattleUI } from './BattleUI.js';
import { BattleAI } from './BattleAI.js';
import { MAP_NAMES } from '../../data/MapNames.js';
// BattleSystem.js 최상단에 덮어씌우세요.

const NPC_SCRIPTS = {
    // ==========================================================================================
    // 🌲 챕터 1: 초록 성벽 마을 (Greenwall)
    // - 분위기: 평화로움, 초보자 친화적, 서로 이웃 사촌 같은 따뜻함과 티격태격함
    // ==========================================================================================
    '1-0': {
        'NPC_TEMPLE': {
            name: "대사제 루시우스", icon: "🧙‍♂️", role: "TEMPLE",
            first: [
                "오, 길 잃은 어린 양이여. 이곳은 신의 지혜를 구하는 곳이라네.",
                "스킬을 배우려면 고대 유적에서 발견되는 **'고대 주화'**가 필요하지.",
                "하지만 걱정 말게. 신께선 관대하시니 **스킬 초기화(리셋)는 언제든 무료**로 해주고 있다네. 마음껏 실험해보게나."
            ],
            random: [
                "내 안경 못 봤나? ...허허, 또 머리 위에 얹어두고 찾았구먼.",
                "무기점 브론은 망치질 소리가 너무 커. 기도가 안 돼, 기도가!",
                "자네, 활을 들고 검술 스킬을 쓰려하진 않겠지? **무기와 스킬의 궁합**을 꼭 확인하게.",
                "요즘 허리가 쑤시는 걸 보니 비가 오려나... 아니면 슬라임이 늘어났나?",
                "스킬 포인트가 꼬였다고 울지 말게. 내게 오면 머리를 맑게 씻어주지(리셋).",
                "신전 기둥에 낙서한 게 자네인가? ...아니라면 됐네. 껄껄.",
                "젊음이 좋구먼. 나도 왕년엔 자네처럼 모험을 즐겼지."
            ],
            service: "자, 어떤 지혜를 깨우치고 싶은가? (초기화 무료)"
        },
        'NPC_WEAPON': {
            name: "강철손 브론", icon: "⚒️", role: "SHOP_WEAPON",
            first: [
                "어이 신입! 눈에 힘 좀 빼라. 무기 보러 왔나?",
                "명심해라. **스킬이 아무리 화려해도, 손에 든 무기가 썩었으면 딜이 안 박혀.**",
                "네 직업에 맞는 무기를 골라. 마법사가 대검 들고 설치다간 제명에 못 죽는다."
            ],
            random: [
                "남자는 등으로 말하고, 전사는 장비로 말하는 거야.",
                "옆집 잡화점 핍 녀석... 자꾸 내 망치로 호두를 까먹으려 하는군. 확 그냥!",
                "내 강철은 드래곤 이빨보다 단단해. ...뭐, 직접 물려본 적은 없지만.",
                "무기 수질은 걱정 마. 내가 밤새 숫돌에 갈아놨으니까.",
                "돈이 부족해? 그럼 몸으로 때워야지. 밖에서 몬스터라도 잡아서 돈 벌어와!",
                "칼날에 베이지 않게 조심해. 약값은 안 물어준다.",
                "방어구점 한나는 겁이 너무 많아. 공격이 최선의 방어인 것을 쯧쯧."
            ],
            service: "골드는 넉넉히 챙겨왔겠지? 물건을 골라봐."
        },
        'NPC_ARMOR': {
            name: "방패지기 한나", icon: "🛡️", role: "SHOP_ARMOR",
            first: [
                "어머, 옷차림이 그게 뭐니? 그러다 스치기만 해도 죽겠어.",
                "공격이 최선의 방어라고? 흥, 그건 살아있을 때 얘기지. **죽으면 끝이야.**",
                "튼튼한 갑옷 없이는 마을 밖으로 한 발짝도 못 나가게 할 거야. 알겠니?"
            ],
            random: [
                "브론 아저씨는 무식하게 공격만 중요하대. 바보 같아.",
                "이 투구 어때? 이번 시즌 수도에서 유행하는 스타일인데. 방어력도 끝내줘.",
                "살아남아야 전설도 되고 영웅도 되는 법이지. 일단 입어봐.",
                "몬스터들은 비겁하게 약한 곳만 노린단다. 틈을 보이지 마.",
                "내 방패는 오크의 도끼질도 막아냈어. 기스 하나 안 났지.",
                "갑옷이 무겁다고? 목숨 무게보단 가벼울걸?",
                "가죽, 사슬, 판금... 네 직업에 맞는 걸 입어야 효과가 좋아."
            ],
            service: "네 목숨을 지켜줄 물건들이야. 꼼꼼히 봐."
        },
        'NPC_POTION': {
            name: "연금술사 핍", icon: "⚗️", role: "SHOP_POTION",
            first: [
                "히히! 어서 와요! 폭발... 아니, 물약 필요하죠?",
                "아참! 사냥하다 주운 **잡동사니 아이템들, 저한테 파세요!**",
                "주머니가 무거우면 못 싸우잖아요? 제가 비싸게(사실 정가에) 사드릴게요!"
            ],
            random: [
                "이 빨간 물약 먹어볼래요? 딸기 맛이 나요! ...부작용으로 머리가 파래질 수도 있지만?",
                "어제 실험하다가 눈썹을 태워먹었어요. 히히, 다시 자라겠죠?",
                "폭발은 예술이야! 콰광! ...아, 죄송해요. 혼잣말이에요.",
                "슬라임 젤리로 푸딩을 만들었는데, 드셔보실래요? 쫀득해요!",
                "브론 아저씨 대머리는 빛이 나서 눈이 부셔요. 선글라스가 필요해.",
                "**'판매' 탭**을 누르면 필요 없는 아이템을 돈으로 바꿀 수 있어요! 잊지 마요!",
                "재료가 부족해... 박쥐 날개가 더 필요한데..."
            ],
            service: "무엇이 필요해요? 아니면 뭘 팔 건가요? (판매 가능)"
        },
        'NPC_INN': {
            name: "마담 몰리", icon: "🛌", role: "INN",
            first: [
                "아이구, 꼴이 그게 뭐야? 먼지투성이네.",
                "여기서 푹 쉬고 가. **잠을 자야 HP랑 MP가 싹 회복**되지.",
                "돈 아끼려고 길바닥에서 자다가 입 돌아간다? 싸게 해줄게."
            ],
            random: [
                "오늘의 추천 메뉴는 '오크 통구이'야. ...농담이야, 그냥 돼지고기지.",
                "저기 구석에 앉은 바릭 씨, 또 술값 외상이네. 저 양반을 어쩐담.",
                "침대는 과학... 아니, 마법이라구. 누우면 기절할걸?",
                "마을 밖 숲속에 이상한 동굴이 있다는 소문이 있어. 조심해.",
                "새로운 소문 없어? 난 정보가 생명이라구. 재밌는 얘기 좀 해봐.",
                "내 여관은 마을에서 제일 안전해. 쥐새끼 한 마리도 못 들어오지.",
                "아침 식사는 포함 안 돼. 따로 주문해."
            ],
            service: "쉬러 왔어? 푹신한 침대가 기다린다구."
        },
        'NPC_TAVERN': {
            name: "용병대장 바릭", icon: "🍺", role: "TAVERN",
            first: [
                "크으~ 맥주 맛 좋고! ...응? 신입인가?",
                "혼자선 전쟁에서 못 이겨. **자네의 '명성'이 높다면** 내 유능한 부하들을 소개해주지.",
                "명성이 낮으면? 풋내기는 안 받아줘. 가서 이름 좀 날리고 오게."
            ],
            random: [
                "라떼는 말이야, 고블린을 맨손으로 때려잡았어. 한 손엔 맥주를 들고 말이지!",
                "명성이 곧 권력이고 힘이지. 유명해지고 다시 오게.",
                "몰리 아줌마! 여기 맥주 한 잔 더! 달아놓고!",
                "내 부하들은 일당백이야. 물론 몸값은 좀 비싸지만 밥값은 하지.",
                "전장에서 제일 중요한 게 뭔지 아나? 바로 등 뒤를 맡길 동료야.",
                "왕년엔 나도 왕실 근위대였어. 무릎에 화살만 안 맞았어도...",
                "동료가 필요하면 언제든 오게. 자네 명성에 맞는 녀석들로 골라줄 테니."
            ],
            service: "어떤 녀석을 동료로 삼고 싶나? (명성 필요)"
        }
    },

    // ==========================================================================================
    // 🏰 챕터 2: 회색벽 전초기지 (Iron Citadel)
    // - 분위기: 삭막함, 군사적, 고물가, 엘리트주의, 서로를 불신하거나 경쟁함
    // ==========================================================================================
    '2-0': {
        'NPC_TEMPLE': {
            name: "심판관 베인", icon: "🕯️", role: "TEMPLE",
            first: [
                "고통은 육체를 떠나는 나약함일 뿐이다.",
                "이곳에선 더 강력한 힘이 필요할 거다. **고대 주화**를 바쳐라.",
                "스킬 초기화? ...흥, 무료로 해주지. 실수를 바로잡을 기회는 주는 법이니."
            ],
            random: [
                "나약한 자는 살아남을 자격이 없다. 증명하라.",
                "초록 마을의 루시우스? 그 늙은이는 신앙이 너무 무러 터졌어.",
                "기도하라. 네 적들의 뼈가 부러지도록.",
                "신성한 힘은 공짜가 아니다. 네 헌신(플레이)으로 증명해라.",
                "이단자들의 냄새가 나는군... 네 얘기는 아니다. 아직은.",
                "고통을 즐겨라. 그것이 전사의 길이다.",
                "내 눈을 피하지 마라. 죄 지은 자만이 눈을 깔지."
            ],
            service: "힘을 원하는가. 대가는 치뤘겠지?"
        },
        'NPC_WEAPON': {
            name: "대장장인 카엘", icon: "🗡️", role: "SHOP_WEAPON",
            first: [
                "어디서 그런 싸구려를 차고 왔군. 냄새 나니 좀 떨어져.",
                "여기선 **진짜 명품**만 취급한다. 돈 없으면 구경만 하고 나가.",
                "내 무기는 예술품이야. 몬스터 피 묻히기도 아깝지."
            ],
            random: [
                "브론? 흥, 그 시골 대장장이? 망치질이 너무 투박해서 원.",
                "내 검은 베지 않는다. 공간을 가를 뿐이지.",
                "손 조심해. 날이 서 있어서 쳐다만 봐도 베일걸?",
                "이 검의 곡선을 봐. 완벽하지 않나? 하... 아름다워.",
                "비싸다고 징징대지 마. 목숨값보다 싸니까.",
                "돈 없는 용병들이랑 말 섞기 싫은데.",
                "제대로 관리 안 할 거면 내 무기 사지 마. 모욕이니까."
            ],
            service: "최고의 무기를 보여주지. 만지지는 마."
        },
        'NPC_ARMOR': {
            name: "수호자 아이언클래드", icon: "🤖", role: "SHOP_ARMOR",
            first: [
                "...분석 중. 네 방어력 수치, 생존 확률 5% 미만.",
                "...단단한 것. 그것이 정의다. 장비를 교체하라.",
                "...이곳의 적들은 강하다. 종잇장 갑옷은 찢겨진다."
            ],
            random: [
                "...치이익. (증기를 내뿜는다) 기름칠이 필요해.",
                "...카엘은 말이 너무 많아. 효율적이지 않아.",
                "...나는 절대 뚫리지 않는다. 너도 그렇게 만들어주지.",
                "...시스템 정상. 방어 프로토콜 가동.",
                "...갑옷은 두꺼울수록 좋다. 무게는 근력으로 극복해라.",
                "...감정은 불필요. 강철만이 영원하다.",
                "...너의 심장박동수가 높다. 공포를 느끼나?"
            ],
            service: "...골라라. 생존 확률을 높여라."
        },
        'NPC_POTION': {
            name: "역병의사 크로우", icon: "🧪", role: "SHOP_POTION",
            first: [
                "크큭... 독이 필요한가, 아니면 해독제가 필요한가?",
                "**필요 없는 물건은 내게 팔아.** 실험 재료로 쓰게 좋거든...",
                "여기 물약은 효과가 확실해. 죽거나, 살거나."
            ],
            random: [
                "새로운 역병... 아아, 너무 아름다워...",
                "이 주사, 조금 따끔할 거야. 아주 조금... 크큭.",
                "저기 기계 인간(아이언클래드) 해부해보고 싶군. 안에 뭐가 들었을까?",
                "내 가면? 벗으면 네가 감염될 텐데? 원하나?",
                "전리품을 팔아. 돈은 넉넉히 줄 테니. 출처는 묻지 않고.",
                "건강한 신체에 건강한 곰팡이가 깃드는 법이지.",
                "기침 소리가 좋지 않군. 내가 진찰해볼까? (메스를 꺼낸다)"
            ],
            service: "흐흐흐... 거래를 시작하지. 뭘 내놓을 텐가?"
        },
        'NPC_INN': {
            name: "보급관 라일라", icon: "📝", role: "INN",
            first: [
                "정지. 신분 확인. 아, 용병이군.",
                "병사는 휴식도 훈련이다. 효율적으로 쉬도록.",
                "침대 사용할 건가? 정해진 시간만 이용하고 정리 정돈 확실히 해."
            ],
            random: [
                "잡담 금지. 다음 사람.",
                "전선이 시끄럽군. 포격 소리가 자장가처럼 들리면 적응된 거다.",
                "베인 심판관님은 잠도 안 자나 봐. 괴물 같은 양반.",
                "식사는 전투식량뿐이다. 맛 따윈 기대하지 마.",
                "규율을 어기면 영창행이다. 알겠나?",
                "내 장부는 한 치의 오차도 없다. 외상은 절대 불가.",
                "너, 눈빛이 살아있군. 마음에 들어."
            ],
            service: "신분 확인 완료. 제3생활관 배정한다."
        },
        'NPC_TAVERN': {
            name: "검은 늑대 가츠", icon: "🐺", role: "TAVERN",
            first: [
                "흥, 냄새나는 녀석이 들어왔군.",
                "네 이름값(**명성**)을 증명해라. 약한 녀석 밑에서는 일 안 한다.",
                "여긴 강자들의 쉼터다. 쫄리면 1챕터로 꺼져."
            ],
            random: [
                "내 대검? 넌 못 들어. 허리 부러진다.",
                "강한 놈들만 모여라. 약자는 집에 가서 젖이나 먹어.",
                "이 기지엔 낭만이 없어, 낭만이. 피비린내뿐이지.",
                "라일라 저 여자는 너무 빡빡해. 술맛 떨어지게.",
                "전장에서는 나만 믿어. 내 등 뒤에 숨으면 안전하니까.",
                "현상금 사냥이나 갈까... 좀 쑤시는군.",
                "동료? 웃기는군. 내가 인정하는 건 오직 힘뿐이다."
            ],
            service: "쓸만한 녀석이 있는지 어디 한번 볼까."
        }
    }
};

const META_LOOT_TABLES = {
    // =================================================================
    // 1. 스테이지 진행도별 일반 상자 (필드 기본 배치용)
    // =================================================================
    
    // [초반 지역] 1-1 ~ 1-5: 장비보다는 생존 물품 위주
    "BOX_STAGE_1": { 
        "LOOT_POTION": 50,   // 50% 물약 (생존 중요)
        "LOOT_BOMB": 30,     // 30% 폭탄/도구
        "LOOT_TIER_1": 20    // 20% 1티어 장비 (가끔 득템)
    },

    // [중반 지역] 1-6 ~ 2-5: 장비 파밍 시작 + 주문서 등장
    "BOX_STAGE_2": {
        "LOOT_TIER_1": 30,   // 30% 1티어 장비
        "LOOT_TIER_2": 20,   // 20% 2티어 장비 (핵심)
        "LOOT_SCROLL": 30,   // 30% 주문서 (전략용)
        "LOOT_POTION": 20    // 20% 물약
    },

    // [후반 지역] 2-6 ~ 3-10: 고등급 장비 및 희귀 소모품
    "BOX_STAGE_3": {
        "LOOT_TIER_2": 50,   // 50% 2티어 장비
        "LOOT_TIER_3": 20,   // 20% 3티어 장비 (대박)
        "LOOT_SCROLL": 20,   // 20% 주문서
        "LOOT_BOMB": 10      // 10% 고급 도구
    },

    // =================================================================
    // 2. 특수 목적 상자 (숨겨진 요소, 이벤트, 보상방용)
    // =================================================================

    // [보급 상자] 장비 안 나옴. 전투 소모품만 100%
    "BOX_SUPPLY": {
        "LOOT_POTION": 60,
        "LOOT_BOMB": 40
    },

    // [무기 상자] 물약 안 나옴. 장비만 나옴 (황금 상자 등)
    "BOX_EQUIP_ONLY": {
        "LOOT_TIER_1": 40,
        "LOOT_TIER_2": 50,
        "LOOT_TIER_3": 10
    },

    // [도박 상자] 대박 아니면 쪽박 (3티어 장비 or 1티어 똥템)
    "BOX_GAMBLE": {
        "LOOT_TIER_3": 15,   // 15% 확률로 전설/에픽 노리기
        "LOOT_SCROLL": 25,   // 25% 확률로 주문서
        "LOOT_TIER_1": 60    // 60% 확률로 초반 장비 (꽝 느낌)
    },

    // =================================================================
    // 3. 보스/정예 보상 상자
    // =================================================================

    // [중간 보스] 2티어 장비 확정 수준
    "BOX_BOSS_MID": {
        "LOOT_TIER_2": 80,
        "LOOT_SCROLL": 20
    },

    // [최종 보스] 3티어 장비 획득 기회 높음
    "BOX_BOSS_FINAL": {
        "LOOT_TIER_2": 40,
        "LOOT_TIER_3": 60    // 60% 확률로 최고 등급 테이블 접근
    }
};

export class BattleSystem {
    constructor(grid, gameApp, chapter, stage, customParty = null) {
        this.grid = grid;
        this.gameApp = gameApp;
        this.chapter = Number(chapter);
        this.stage = isNaN(stage) ? stage : Number(stage);
        this.customParty = customParty; 
        
        this.units = [];
        this.traps = []; 
        this.actionGaugeLimit = 100;
        
        this.currentUnit = null;
        this.viewingUnit = null; 
        this.selectedSkill = null;
        this.confirmingSkill = null;
        this.confirmingItemSlot = null;
        
        this.actions = { moved: false, acted: false };
        this.goldMod = 1.0;
        this.dropMod = 1.0;
        
        this.reachableHexes = []; 
        this.hoverHex = null;
        this.textQueue = []; 
        this.projectiles = []; 
        this.isAnimating = false;
        this.isProcessingTurn = false;
        this.isBattleEnded = false;
        this.isAutoBattle = false;
        this.isBattleWon = false;

        this.camera = { x: 0, y: 0 };

        // 하위 시스템 초기화
        this.ui = new BattleUI(this, grid.canvas);
        this.skillProcessor = new SkillProcessor(this);
        this.inputSystem = new BattleInput(this, grid.canvas);
        this.aiSystem = new BattleAI(this);

        this.injectStyles();
        
        this.overlayContainer = document.getElementById('unit-overlays');
        if (!this.overlayContainer) {
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'unit-overlays';
            Object.assign(this.overlayContainer.style, {
                position: 'absolute', top: '0', left: '0', 
                pointerEvents: 'none', width: '100%', height: '100%', zIndex: '100'
            });
            document.body.appendChild(this.overlayContainer);
        }

        const stageData = STAGE_DATA[this.chapter]?.[this.stage];
        this.hiddenObj = stageData && stageData.hiddenObj ? JSON.parse(JSON.stringify(stageData.hiddenObj)) : [];
        if (stageData && stageData.cols && stageData.rows) {
            this.grid.resize(stageData.cols, stageData.rows);
        } else {
            this.grid.resize(30, 30);
        }

        this.initUnits(chapter, stage);
        
        setTimeout(() => {
            this.handleResize(); 
            this.centerCameraOnHeroes(); 
            this.showStageTitle();
        }, 100);
        
        this.nextTurn(); 
    }

    // [UI] 오버레이 위치 업데이트
    updateUnitOverlayPosition(unit) {
        const el = document.getElementById(`unit-overlay-${unit.id}`);
        if (!el) return;

        let h = unit.height;
        if (h === undefined && this.grid) {
            const tData = this.grid.getTerrainData(unit.q, unit.r);
            h = tData ? tData.h : 0;
        }

        const pos = this.grid.hexToPixel3D(unit.q, unit.r, h || 0);
        const screenX = pos.x - this.camera.x;
        const screenY = pos.y - this.camera.y;

        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
        el.style.zIndex = Math.floor(screenY);
    }

    initUnits(chapter, stage) {
        // 1. 스테이지 정보 로드
        const stageInfo = STAGE_DATA[chapter] && STAGE_DATA[chapter][stage];
        const stageKey = `${this.chapter}-${this.stage}`;
        const isCleared = this.gameApp.gameState.clearedStages && this.gameApp.gameState.clearedStages.includes(stageKey);

        let idCounter = 1;
        const occupied = new Set();
        let myTeamData = [];
        
        // 파티 데이터 로드
        if (this.customParty && this.customParty.length > 0) {
            myTeamData = this.customParty;
        } else {
            const allHeroes = this.gameApp.gameState.heroes;
            myTeamData = allHeroes.length > 0 ? allHeroes.slice(0, 6).map(h => ({ hero: h, q: null, r: null })) : [];
        }

        const HERO_BASE_COL = 7;
        const ENEMY_BASE_COL = 14;

        // -------------------------------------------------------------
        // [내부 함수] 유닛 생성 (spawn)
        // -------------------------------------------------------------
        const spawn = (entryData, team, fixedQ = null, fixedR = null) => {
            let unit = (team === 0) ? entryData.hero : JSON.parse(JSON.stringify(entryData));
            
            // 스킬 데이터 주입 (Hydration)
            const hasHydratedSkills = unit.skills && unit.skills.length > 0 && typeof unit.skills[0] === 'object' && unit.skills[0].name;
            if (!hasHydratedSkills) {
                if (unit.skillIds) {
                    unit.skills = unit.skillIds.map(id => {
                        const s = SKILL_DATABASE[id];
                        if (!s) return null;
                        return JSON.parse(JSON.stringify({ ...s, id: id }));
                    }).filter(s => s !== null);
                } else {
                    unit.skills = [];
                }
            }

            // -------------------------------------------------------------
            // 📍 좌표 계산 로직 (여기가 깔끔해졌습니다)
            // -------------------------------------------------------------
            let q, r;

            // 1. 고정 좌표 (적군 등)
            if (fixedQ != null && fixedR != null) {
                q = Number(fixedQ); r = Number(fixedR);
            } else {
                if (team === 0) {
                    // [아군 배치 우선순위]
                    // 1순위: 복귀 좌표 (Return Point)
                    const ret = this.gameApp.gameState.returnPoint;
                    if (ret && ret.chapter == chapter && ret.stage == stage) {
                        q = Number(ret.q);
                        r = Number(ret.r);
                        
                        // 겹치지 않게 오프셋 적용
                        if (idCounter > 1) {
                            const offsets = [{dq:0, dr:1}, {dq:-1, dr:1}, {dq:-1, dr:0}, {dq:0, dr:-1}, {dq:1, dr:-1}, {dq:1, dr:0}];
                            const idx = (idCounter - 2) % offsets.length;
                            q += offsets[idx].dq;
                            r += offsets[idx].dr;
                        }
                    }
                    // 2순위: 맵 데이터의 deployment (방금 추가하신 좌표들!)
                    else if (stageInfo && stageInfo.deployment && stageInfo.deployment.length > 0) {
                        const deployIdx = (idCounter - 1) % stageInfo.deployment.length;
                        const coord = stageInfo.deployment[deployIdx].split(',');
                        q = Number(coord[0]);
                        r = Number(coord[1]);
                    }
                    // 3순위: 맵 데이터의 START_POINT
                    else if (stageInfo && stageInfo.structures) {
                        const startStruct = stageInfo.structures.find(s => s.startsWith('START_POINT'));
                        if (startStruct) {
                            const parts = startStruct.split(':');
                            const startQ = Number(parts[1]);
                            const startR = Number(parts[2]);
                            
                            const offsets = [{dq:0, dr:0}, {dq:0, dr:1}, {dq:-1, dr:1}, {dq:-1, dr:0}, {dq:0, dr:-1}, {dq:1, dr:-1}, {dq:1, dr:0}];
                            const idx = (idCounter - 1) % offsets.length;
                            q = startQ + offsets[idx].dq;
                            r = startR + offsets[idx].dr;
                        }
                    }
                    
                    // 4순위: 저장된 위치 (Auto Save)
                    if (q === undefined && entryData.hero.q !== undefined && !isNaN(entryData.hero.q)) {
                        q = Number(entryData.hero.q);
                        r = Number(entryData.hero.r);
                    }

                    // 5순위: 최후의 기본값 (알고리즘)
                    if (q === undefined) {
                        let col = HERO_BASE_COL;
                        const rowOffsets = [0, 1, -1, 2, -2, 3];
                        const rowIdx = (idCounter - 1) % rowOffsets.length;
                        let row = 6 + rowOffsets[rowIdx];
                        q = col - (row - (row & 1)) / 2;
                        r = row;
                    }
                } else {
                    // 적군 기본 배치
                    let col = ENEMY_BASE_COL;
                    const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4];
                    const rowIdx = (idCounter - 1) % rowOffsets.length;
                    let row = 6 + rowOffsets[rowIdx];
                    q = col - (row - (row & 1)) / 2;
                    r = row;
                }
            }

            // 위치 중복 방지 (기본 안전장치)
            let safetyCount = 0;
            while (occupied.has(`${q},${r}`)) { 
                r++; 
                safetyCount++;
                if (safetyCount > 50) break; // 50번 이상 못 찾으면 그냥 겹침 허용 (멈춤 방지)
            }
            occupied.add(`${q},${r}`);

            // 속성 설정
            unit.q = q; unit.r = r;
            unit.facing = team === 0 ? 0 : 3;
            unit.buffs = [];
            if (!unit.perks) unit.perks = {};
            unit.id = idCounter++;
            unit.team = team;
            unit.shake = 0; unit.bumpX = 0; unit.bumpY = 0;
            unit.stageActionXp = 0;

            unit.hp = Formulas.getDerivedStat(unit, 'hp_max', true);
            unit.mp = Formulas.getDerivedStat(unit, 'mp_max', true);

            if (team === 0) {
                unit.curHp = (unit.curHp !== undefined && !isNaN(unit.curHp)) ? Math.min(unit.curHp, unit.hp) : unit.hp;
                unit.curMp = (unit.curMp !== undefined && !isNaN(unit.curMp)) ? Math.min(unit.curMp, unit.mp) : unit.mp;
                if(unit.curHp <= 0) unit.curHp = 1;
            } else {
                unit.curHp = unit.hp;
                unit.curMp = unit.mp;
            }

            const spd = Formulas.getDerivedStat(unit, 'spd');
            unit.actionGauge = Math.min(50, spd * 0.5);

            this.units.push(unit);
        };

        // -------------------------------------------------------------
        // [실행]
        // -------------------------------------------------------------
        
        // 1. 아군 배치
        myTeamData.forEach(d => spawn(d, 0, d.q, d.r));

        // 2. 적군 배치
        if (!isCleared && stageInfo && stageInfo.enemies) {
            stageInfo.enemies.forEach(raw => {
                let entry = raw;
                let count = 1;
                if (entry.includes('*')) {
                    const p = entry.split('*');
                    entry = p[0];
                    count = parseInt(p[1]) || 1;
                }
                
                let key = entry;
                let q = null;
                let r = null;

                if (entry.includes(':')) {
                    const parts = entry.split(':');
                    key = parts[0];
                    q = Number(parts[1]);
                    r = Number(parts[2]);
                }
                
                key = key.trim().toUpperCase().replace(/,/g, '');
                
                if (CLASS_DATA[key]) {
                    for (let i = 0; i < count; i++) spawn(CLASS_DATA[key], 1, q, r);
                }
            });
        } else if (!isCleared) {
            if (CLASS_DATA['SLIME']) spawn(CLASS_DATA['SLIME'], 1);
        }

        // 평화 모드 설정
        const enemies = this.units.filter(u => u.team === 1);
        this.isPeaceful = (enemies.length === 0);

        if (this.isPeaceful) {
            console.log("🕊️ 평화 지역입니다. (자유 이동 모드)");
            this.units.forEach(u => u.actionGauge = this.actionGaugeLimit);
            if (this.ui && this.ui.updateSidebarMode) {
                this.ui.updateSidebarMode(this.isPeaceful);
            }
        }
        
        // 복귀 포인트 초기화
        if (this.gameApp.gameState.returnPoint && 
            this.gameApp.gameState.returnPoint.chapter == chapter && 
            this.gameApp.gameState.returnPoint.stage == stage) {
            this.gameApp.gameState.returnPoint = null;
        }

        const mapKey = `${chapter}-${stage}`;
        const npcSet = NPC_SCRIPTS[mapKey];

        if (npcSet) {
            // [챕터 1 마을 좌표 (1-0)]
            if (mapKey === '1-0') {
                this.spawnTownNPC('NPC_TEMPLE', 1, 2, npcSet['NPC_TEMPLE']);
                this.spawnTownNPC('NPC_WEAPON', 6, 2, npcSet['NPC_WEAPON']);
                this.spawnTownNPC('NPC_ARMOR', 7, 5, npcSet['NPC_ARMOR']);
                this.spawnTownNPC('NPC_POTION', 5, 8, npcSet['NPC_POTION']);
                this.spawnTownNPC('NPC_INN', -1, 8, npcSet['NPC_INN']);
                this.spawnTownNPC('NPC_TAVERN', 11, 2, npcSet['NPC_TAVERN']);
            }
            // [챕터 2 마을 좌표 (2-0)]
            else if (mapKey === '2-0') {
                this.spawnTownNPC('NPC_TEMPLE', 2, 2, npcSet['NPC_TEMPLE']);
                this.spawnTownNPC('NPC_WEAPON', 5, 2, npcSet['NPC_WEAPON']);
                this.spawnTownNPC('NPC_ARMOR', 6, 2, npcSet['NPC_ARMOR']);
                this.spawnTownNPC('NPC_POTION', 8, 2, npcSet['NPC_POTION']);
                this.spawnTownNPC('NPC_INN', 2, 6, npcSet['NPC_INN']);
                this.spawnTownNPC('NPC_TAVERN', 5, 6, npcSet['NPC_TAVERN']);
            }

            // NPC 말풍선 루프 시작
            this.startNPCChatter();
        }
    }
    // NPC 생성 헬퍼 함수
    spawnTownNPC(id, q, r, data) {
        if (!data) return;
        const npc = {
            id: id,
            name: data.name,
            icon: data.icon,
            team: 2, // 중립 팀
            q: q, r: r,
            
            // [핵심 수정] UI 렌더링에 필요한 필수 속성 초기화
            curHp: 9999, hp: 9999,
            curMp: 9999, mp: 9999,
            actionGauge: 0,
            
            buffs: [],       // 이게 없어서 find 에러 발생
            skills: [],      // 이게 없어서 map 에러 발생
            equipment: {},   // 이게 없어서 장비 확인 시 에러 발생
            
            isNPC: true,
            role: data.role,
            hasMet: false,
            
            // 시각적 요소 초기화
            shake: 0, bumpX: 0, bumpY: 0
        };
        
        // 겹침 방지
        if (this.getUnitAt(q, r)) npc.r += 1;
        this.units.push(npc);
    }

    // 외부(BattleInput)에서 호출할 상호작용 진입점
    interactWithUnit(unit) {
        if (!unit) return;

        // NPC인지 확인
        if (unit.isNPC) {
            this.handleNPCInteraction(unit);
            return;
        }
        // NPC가 아니면 기존 로직 등 수행 (필요 시 작성)
    }

    // NPC 클릭 시 대화 및 기능 실행 로직
    handleNPCInteraction(npc) {
        const mapKey = `${this.chapter}-${this.stage}`;
        const npcSet = NPC_SCRIPTS[mapKey];
        if (!npcSet) return;

        const scriptData = npcSet[npc.id];
        if (!scriptData) return;

        let msg = "";

        // 대사 패턴 결정
        if (!npc.hasMet) {
            // 첫 만남: 필수 안내 (첫 번째 문장)
            msg = scriptData.first[0];
            npc.hasMet = true; 
        } else {
            // 이후: 40% 확률로 서비스 대사, 60% 확률로 랜덤 잡담
            if (Math.random() < 0.4) {
                msg = scriptData.service;
            } else {
                const randIdx = Math.floor(Math.random() * scriptData.random.length);
                msg = scriptData.random[randIdx];
            }
        }

        // 말풍선 및 로그 출력
        this.showSpeechBubble(npc, msg);
        this.log(`[${scriptData.name}] ${msg}`, 'log-system');

        // 기능 실행 (대사를 읽을 시간을 주기 위해 1.2초 딜레이)
        setTimeout(() => {
            const sys = this.gameApp.townSystem;
            switch (scriptData.role) {
                case 'TEMPLE': sys.openTemple(); break;
                case 'SHOP_WEAPON': sys.openShop('weapon'); break;
                case 'SHOP_ARMOR': sys.openShop('armor'); break;
                case 'SHOP_POTION': sys.openShop('potion'); break; 
                case 'INN': sys.openInn(); break;
                case 'TAVERN': sys.openTavern(); break;
            }
        }, 1200); 
    }

    // 자동 잡담 루프
    startNPCChatter() {
        if (this.chatterInterval) clearInterval(this.chatterInterval);

        this.chatterInterval = setInterval(() => {
            if (!this.isPeaceful || document.querySelector('.modal-overlay[style*="flex"]')) return;

            const npcs = this.units.filter(u => u.isNPC);
            if (npcs.length === 0) return;

            // [중요] 이미 누군가 말하고 있다면 이번 턴은 쉼 (동시 다발적 대화 방지)
            const isAnyoneTalking = npcs.some(u => u.speechText);
            if (isAnyoneTalking) return;

            // 랜덤 NPC 1명 선택
            const npc = npcs[Math.floor(Math.random() * npcs.length)];
            const mapKey = `${this.chapter}-${this.stage}`;
            const npcSet = NPC_SCRIPTS[mapKey];
            
            if (npcSet && npcSet[npc.id]) {
                const data = npcSet[npc.id];
                const randMsg = data.random[Math.floor(Math.random() * data.random.length)];
                // 4초 동안 말풍선 유지
                this.showSpeechBubble(npc, randMsg, 4000);
            }
        }, 5000); // 5초마다 체크 (말하고 있으면 패스하므로 실제 간격은 더 김)
    }

    // 정리 (맵 나갈 때 호출 필요)
    cleanup() {
        if (this.chatterInterval) {
            clearInterval(this.chatterInterval);
            this.chatterInterval = null;
        }
    }

    spawnUnit(key, team, q, r, overrides = {}) {
        if (this.getUnitAt(q, r)) return;
        let data = CLASS_DATA[key];
        if (!data) return;

        const unit = JSON.parse(JSON.stringify(data));
        unit.id = 9000 + this.units.length + Math.floor(Math.random()*1000);
        unit.team = team;
        unit.q = q; unit.r = r;
        unit.facing = team === 0 ? 0 : 3;
        
        // 스탯 오버라이드 적용
        if (overrides.hp) unit.hp = overrides.hp;
        if (overrides.atk) unit.str = overrides.atk; // 소환물은 str을 공격력으로 간주
        if (overrides.def) unit.def = overrides.def; // 기본 방어력 보정
        if (overrides.duration) unit.lifespan = overrides.duration; // 수명(턴)

        // 오버라이드가 없으면 기본 계산
        if (!overrides.hp) unit.hp = Formulas.getDerivedStat(unit, 'hp_max', true);
        unit.mp = Formulas.getDerivedStat(unit, 'mp_max', true);
        
        unit.curHp = unit.hp; unit.curMp = unit.mp;
        unit.actionGauge = 0; 
        unit.buffs = [];
        unit.equipment = {};
        unit.isSummon = true; 

        this.units.push(unit);
        this.log(`${unit.name} 소환!`, 'log-skill');
        this.triggerShakeAnimation(unit);
        this.renderPartyList();
    }

    checkBattleEnd() {
        if (this.isBattleEnded) return true;
        if (this.isPeaceful) return false;
        
        const enemies = this.units.filter(u => u.team === 1 && u.curHp > 0).length;
        const allies = this.units.filter(u => u.team === 0 && u.curHp > 0).length;

        // 패배
        if (allies === 0) {
            this.gameApp.onBattleEnd(false);
            return true;
        }

        // 승리
        if (enemies === 0) {
            if (!this.isBattleWon) {
                this.isBattleWon = true;

                // [클리어 여부 확인]
                const stageKey = `${this.chapter}-${this.stage}`;
                const isFirstClear = !this.gameApp.gameState.clearedStages.includes(stageKey);
                
                if (isFirstClear) {
                    this.gameApp.gameState.clearedStages.push(stageKey);
                }
                
                // [기본 보상] (골드)
                const baseReward = 100 * this.chapter;
                let rewardMsg = `💰 골드: +${baseReward}`;
                this.gameApp.gameState.gold += baseReward;

                // [최초 클리어 보너스] (명성 + 고대 주화)
                if (isFirstClear) {
                    const bonusRenown = 30;
                    const bonusCoin = (this.stage % 5 === 0) ? 3 : 1; // 5스테이지마다 3개, 아니면 1개

                    this.gameApp.gameState.renown += bonusRenown;
                    this.gameApp.gameState.ancientCoin += bonusCoin;

                    rewardMsg += `\n🎖️ 명성: +${bonusRenown} (최초 클리어)`;
                    rewardMsg += `\n🧿 고대 주화: +${bonusCoin}`;
                }

                this.gameApp.updateResourceDisplay();
                this.gameApp.saveGame();

                this.gameApp.showAlert(
                    `🎉 VICTORY! 스테이지 클리어!\n\n` +
                    `${rewardMsg}\n\n` +
                    `🕊️ [평화 모드] 자유롭게 이동하여 출구(EXIT)로 나가세요.`
                );

                this.activatePeaceMode(); 
            }
            return false;
        }

        return false;
    }
    activatePeaceMode() {
        this.isPeaceful = true;
        console.log("🕊️ 평화 모드 전환: 자유 이동 가능");
        if (this.ui && this.ui.updateSidebarMode) {
            this.ui.updateSidebarMode(true);
        }

        // 1. 아군 첫 번째 유닛을 찾아 강제로 선택 상태로 만듦
        const firstHero = this.units.find(u => u.team === 0 && u.curHp > 0);
        if (firstHero) {
            this.currentUnit = firstHero;
            this.currentUnit.curAp = 999; // 이동력 무제한
            
            // UI에 선택 반영 (selectUnit 함수가 BattleSystem에 있다고 가정)
            // 만약 BattleSystem에 selectUnit이 없다면 ui.selectUnit 혹은 아래 로직 사용
            if (this.ui && this.ui.selectUnit) {
                this.ui.selectUnit(firstHero);
            } else {
                // 직접 선택 로직 (fallback)
                this.viewingUnit = firstHero;
                this.updateStatusPanel();
            }
        }

        // 2. UI 업데이트 (AP바 숨기기 등)
        this.updateFloatingControls();
        
        // 3. 이동 경로 초기화
        // this.renderer.showPath([]);
    }

    endBattleSequence(victory, isSurrender = false) {
        if (this.isBattleEnded) return;
        this.isBattleEnded = true;
        this.isAutoBattle = false;
        
        if (this.inputSystem) this.inputSystem.destroy();
        this.cleanup();
        
        const float = document.getElementById('floating-controls');
        if (float) float.remove();
        const overlayContainer = document.getElementById('unit-overlays');
        if (overlayContainer) {
            overlayContainer.innerHTML = '';
        }

        setTimeout(() => {
            this.gameApp.onBattleEnd(victory, isSurrender);
        }, 1000);
    }

    nextTurn() {
        if (this.checkBattleEnd()) return;
        if (this.isPeaceful) {
            this.currentUnit = this.units.find(u => u.team === 0); 
            this.startTurnLogic();
            return;
        }

        let ready = this.units.filter(u => u.curHp > 0 && u.actionGauge >= this.actionGaugeLimit);
        
        if (ready.length > 0) {
            ready.sort((a, b) => b.actionGauge - a.actionGauge);
            this.currentUnit = ready[0];
            
            if (this.currentUnit.actionGauge > this.actionGaugeLimit * 2) {
                this.currentUnit.actionGauge = this.actionGaugeLimit;
            }
            this.startTurnLogic();
        } else {
            let minTick = Infinity;
            this.units.forEach(u => {
                if (u.curHp <= 0) return;
                let spd = Formulas.getDerivedStat(u, 'spd');
                if (spd <= 0) spd = 1;
                
                if (this.hasStatus(u, 'SHOCK')) return;

                const needed = (this.actionGaugeLimit - u.actionGauge) / spd;
                if (needed < minTick) minTick = needed;
            });

            if (minTick === Infinity || minTick < 0) minTick = 1;

            this.units.forEach(u => {
                if (u.curHp > 0 && !this.hasStatus(u, 'SHOCK')) {
                    let spd = Formulas.getDerivedStat(u, 'spd');
                    if (spd <= 0) spd = 1;
                    u.actionGauge += spd * minTick;
                }
            });
            
            requestAnimationFrame(() => this.nextTurn());
        }
    }

    startTurnLogic() {
        if (!this.currentUnit) {
            console.warn("⚠️ 턴을 시작할 유닛이 없습니다. 전투를 종료하거나 대기합니다.");
            if (!this.isPeaceful && !this.isBattleEnded) {
                // 강제 종료 또는 다음 틱으로 넘기기
                this.checkBattleEnd(); 
            }
            return;
        }

        if (this.currentUnit.curHp <= 0) { this.endTurn(); return; }

        this.isProcessingTurn = true;
        if (!this.isPeaceful) {
            this.log(`▶ ${this.currentUnit.name}의 턴`, 'log-turn');
        }
        
        this.regenResources(this.currentUnit);
        this.viewingUnit = this.currentUnit;
        this.actions = { moved: false, acted: false };
        this.selectedSkill = null;
        this.confirmingSkill = null;

        if (this.currentUnit.skills) {
            const gaugePassive = this.currentUnit.skills.find(s => s.type === 'PASSIVE' && (s.main?.type === 'PASSIVE_GAUGE' || s.sub?.type === 'PASSIVE_GAUGE'));
            if (gaugePassive) {
                this.currentUnit.actionGauge += 10; 
            }
        }

        let skipTurn = false;
        
        for (let i = this.currentUnit.buffs.length - 1; i >= 0; i--) {
            const b = this.currentUnit.buffs[i];
            const info = EFFECTS[b.type];

            if (['CC_STUN', 'CC_FREEZE', 'CC_SLEEP', 'CC_FEAR', 'CC_CHARM'].includes(b.type)) {
                this.log(`${this.currentUnit.name}: [${info.name}] 행동 불가!`, 'log-cc');
                this.showFloatingText(this.currentUnit, info.name, '#ff00ff');
                skipTurn = true;
            }
            if (b.type === 'CC_POLYMORPH') {
                this.log(`${this.currentUnit.name}: 🐑 메에에~`, 'log-cc');
                this.showFloatingText(this.currentUnit, "Meee~", "#fff");
                // 행동(Attack/Skill)만 불가, 이동은 가능
                this.actions.acted = true; // '이미 행동함'으로 처리하여 스킬 사용 막음
            }
            if (b.type === 'STATUS_BURN') {
                let dmg = Math.max(1, Math.floor(b.val * 10) || 5); 
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                this.log(`🔥 화상: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, '#ff8800');
            } else if (b.type === 'STATUS_POISON') {
                let dmg = Math.floor(this.currentUnit.hp * 0.05); dmg = Math.max(1, dmg);
                this.currentUnit.curHp = Math.max(0, this.currentUnit.curHp - dmg);
                this.log(`☠️ 맹독: -${dmg}`, 'log-dmg');
                this.showFloatingText(this.currentUnit, `-${dmg}`, '#88ff00');
            } else if (b.type === 'HEAL_REGEN') {
                const healAmt = Math.floor(this.currentUnit.hp * 0.1 * (b.val || 1));
                this.currentUnit.curHp = Math.min(this.currentUnit.hp, this.currentUnit.curHp + healAmt);
                this.showFloatingText(this.currentUnit, `+${healAmt}`, '#5f5');
                this.log(`🌿 재생: +${healAmt}`, 'log-heal');
            }
            b.duration--;
            if (b.duration <= 0) this.currentUnit.buffs.splice(i, 1);
        }

        if (this.currentUnit.curHp <= 0) { 
            this.handleDeath(this.currentUnit); 
            this.endTurn(); 
            return; 
        }

        if (skipTurn) { 
            this.updateStatusPanel(); 
            this.renderPartyList(); 
            this.currentUnit.actionGauge -= 50; 
            setTimeout(() => this.endTurn(), 800); 
            return; 
        }

        if (this.hasStatus(this.currentUnit, 'SHOCK')) {
             this.log("⚡ 감전 상태! 행동력 회복 불가.", "log-cc");
        }

        if (Formulas.getDerivedStat(this.currentUnit, 'mov') <= 0) {
            this.actions.moved = true; 
            this.log("이동 불가 상태.");
        } else {
            this.calcReachable();
        }

        this.updateStatusPanel();
        this.renderPartyList();
        this.updateCursor();
        
        if (this.currentUnit.team === 0) {
            this.isProcessingTurn = false;
            this.updateFloatingControls();
            this.updateStatusPanel();       
        }

        if (this.currentUnit.team === 1) { 
            this.aiSystem.runEnemyTurn();
        } else {
            if (this.hasStatus(this.currentUnit, 'CC_CONFUSE')) {
                this.log(`😵 ${this.currentUnit.name} 혼란 상태!`, 'log-cc');
                this.aiSystem.runEnemyTurn(); 
            } else {
                this.isProcessingTurn = false; 
                this.renderUI();
                this.updateFloatingControls();
                if (this.isAutoBattle) setTimeout(() => this.aiSystem.runAllyAuto(), 300);
            }
        }
    }

    endTurn(manual = false) { 
        const f = document.getElementById('floating-controls'); 
        if(f) f.classList.add('hud-hidden'); 
        
        if (this.isPeaceful) {
            this.actions = { moved: false, acted: false };
            this.isProcessingTurn = false;
            
            this.updateStatusPanel();
            this.renderPartyList();
            this.updateCursor();
            
            if (this.currentUnit) {
                this.centerCameraOnUnit(this.currentUnit);
            }
            return;
        }
        
        if (this.actions.acted) {
            this.log(`${this.currentUnit.name} 행동 완료.`, 'log-system');
        } else if (this.actions.moved) {
            this.currentUnit.actionGauge -= 20;
            this.log(`${this.currentUnit.name} 이동 후 대기 (-20 AG)`, 'log-system');
        } else {
            this.currentUnit.actionGauge -= 50;
            this.log(`${this.currentUnit.name} 즉시 대기 (-50 AG)`, 'log-system');
        }

        this.actions = { moved: false, acted: false }; 
        setTimeout(() => this.nextTurn(), 100); 
    }

    calcReachable() {
        this.reachableHexes = [];
        if(this.actions.moved) return;

        let frontier = [{q:this.currentUnit.q, r:this.currentUnit.r}];
        let cost = new Map();
        cost.set(`${this.currentUnit.q},${this.currentUnit.r}`, 0);
        
        const moveRange = Formulas.getDerivedStat(this.currentUnit, 'mov');

        while(frontier.length > 0) {
            let cur = frontier.shift();
            this.grid.getNeighbors(cur).forEach(n => {
                const k = `${n.q},${n.r}`;
                if (!this.grid.hexes.has(k)) return;

                const tKey = this.grid.getTerrain(n.q, n.r);
                const tInfo = TERRAIN_TYPES[tKey] || TERRAIN_TYPES['GRASS_01'];
                const tileCost = tInfo.cost || 1;

                if (tileCost >= 99) return;

                const uAt = this.getUnitAt(n.q, n.r);
                if (!uAt || uAt === this.currentUnit || uAt.isNPC) {
                    let newCost = cost.get(`${cur.q},${cur.r}`) + tileCost;
                    if(newCost <= moveRange && (!cost.has(k) || newCost < cost.get(k))) {
                        cost.set(k, newCost);
                        frontier.push(n);
                        this.reachableHexes.push(n);
                    }
                }
            });
        }
    }
    // [신규] 점프 이동 (경로 무시, 즉시 이동)
    async jumpUnit(unit, q, r) {
        // 시작점과 목표점 시각적 효과
        this.triggerShakeAnimation(unit);
        
        // 로그 출력
        this.log(`${unit.name} 도약!`, 'log-skill');
        
        // 간단한 연출 대기 (점프하는 느낌)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 좌표 강제 변경
        unit.q = q; 
        unit.r = r;
        
        // 착지 효과
        this.triggerShakeAnimation(unit);
        
        // 카메라 추적 (아군인 경우)
        if (unit.team === 0) {
            this.centerCameraOnUnit(unit);
            this.updateFloatingControls();
        }
        
        // 이동 후처리
        this.calcReachable();
        this.updateStatusPanel();
        
        // 타일 이벤트 체크 (함정 등)
        if (unit.team === 0) this.checkTileEvent(unit);
        
        return true;
    }

    async moveUnit(unit, q, r, cb) {
        // 1. 경로 탐색
        const path = this.grid.findPath({q:unit.q, r:unit.r}, {q, r}, nh => {
            const uAt = this.units.find(target => 
                target.q === nh.q && target.r === nh.r && target.curHp > 0
            );
            return !uAt || uAt === unit || uAt.isNPC;
        });
        
        if (path.length === 0) { if(cb) cb(); return; }
        
        this.isAnimating = true;

        if (!this.isPeaceful) {
            const moveCost = Math.max(0, path.length - 2);
            unit.actionGauge -= moveCost;
            if(unit.team === 0) this.log(`이동 소모: ${moveCost}`, 'log-system');
        }

        // 2. 이동 애니메이션 루프
        for (let s of path) {
            const dir = this.grid.getDirection({q: unit.q, r: unit.r}, s);
            unit.facing = dir;
            unit.q = s.q; unit.r = s.r;
            
            if (this.isPeaceful && unit === this.currentUnit) {
                this.centerCameraOnUnit(unit);
            }

            if (this.hasStatus(unit, 'STATUS_BLEED')) {
                let dmg = Math.max(1, Math.floor(unit.hp * 0.05));
                unit.curHp = Math.max(0, unit.curHp - dmg);
                this.showFloatingText(unit, `🩸-${dmg}`, '#ff0000');
                if (unit.curHp <= 0) { this.handleDeath(unit); break; }
            }

            const trapIdx = this.traps.findIndex(t => t.q === s.q && t.r === s.r && t.casterId !== unit.id);
            if (trapIdx !== -1) {
                const trap = this.traps[trapIdx];
                this.traps.splice(trapIdx, 1); 
                
                this.log(`${unit.name} 함정 발동!`, 'log-dmg');
                this.showFloatingText(unit, "TRAP!", "#f00");
                this.triggerShakeAnimation(unit);

                if (trap.type === 'TRAP_STUN') {
                    unit.curHp = Math.max(0, unit.curHp - 20);
                    this.showFloatingText(unit, "-20", "#f55");
                    this.skillProcessor.applyStatus(unit, { type: 'CC_STUN', duration: 1, val: 1 }, {id: trap.casterId});
                }
                break;
            }
            
            if (unit === this.currentUnit) {
                this.updateFloatingControls();
            }

            await new Promise(resolve => setTimeout(resolve, this.isPeaceful ? 200 : 300));
        }
        
        this.isAnimating = false;

        if (!this.isPeaceful) {
            this.actions.moved = true; 
        }

        this.calcReachable();
        this.updateStatusPanel();

        if (unit.team === 0) {
            this.detectHiddenObjects(unit); // 주변 감지
            this.checkTileEvent(unit);      // 타일 이벤트 실행
            
            // [추가된 코드] 이동 완료 시 현재 좌표를 영구 저장 (Auto Save)
            const heroData = this.gameApp.gameState.heroes.find(h => h.id === unit.id);
            if (heroData) {
                heroData.q = unit.q;
                heroData.r = unit.r;
                this.gameApp.saveGame(); // 즉시 저장
                console.log(`💾 위치 저장 완료: ${unit.name} (${unit.q}, ${unit.r})`);
            }
        }

        if(cb) cb();
    }

    centerCameraOnUnit(unit) {
        if (!this.grid || !this.grid.canvas) return;
        const p = this.grid.hexToPixel3D(unit.q, unit.r, 0); 
        this.camera.x = p.x - this.grid.canvas.width / 2;
        this.camera.y = p.y - this.grid.canvas.height / 2;
        
        this.ui.updateFloatingControls();
    }
    // ▼▼▼ [추가] 스테이지 이름 출력 함수 ▼▼▼
    showStageTitle() {
        const stageData = STAGE_DATA[this.chapter]?.[this.stage];
        // 숨겨진 동굴 등은 ID가 다를 수 있으므로 체크 (예: CAVE1)
        // 현재 구조상 this.stage가 숫자면 일반, 문자열이면 특수일 가능성
        
        let mapKey = `${this.chapter}-${this.stage}`;
        
        // 만약 this.stage가 문자열(예: "CAVE1")이라면 그대로 키로 사용
        if (typeof this.stage === 'string' || isNaN(Number(this.stage))) {
            mapKey = this.stage;
        }

        const info = MAP_NAMES[mapKey] || { title: `Unknown Area`, subtitle: `Stage ${mapKey}` };

        const overlay = document.getElementById('stage-title-overlay');
        const mainTitle = document.getElementById('stage-main-title');
        const subTitle = document.getElementById('stage-sub-title');

        if (!overlay || !mainTitle) return;

        mainTitle.textContent = info.title;
        subTitle.textContent = info.subtitle;

        // 애니메이션 리셋 및 실행
        overlay.classList.remove('hidden');
        overlay.classList.remove('show');
        void overlay.offsetWidth; // 리플로우 강제 (애니메이션 재시작 트리거)
        overlay.classList.add('show');

        // 4초 후 사라지기
        setTimeout(() => {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 1000); // fade out 시간 대기
        }, 4000);
    }

    
    getUnitAt(q, r) { return this.units.find(u => u.q === q && u.r === r && u.curHp > 0); }
    hasStatus(unit, type) { return unit.buffs && unit.buffs.some(b => b.type === type); }
    
    collectTargets(effectData, targetHex, clickedUnit, caster) {
        let targets = [];
        const units = this.units.filter(u => u.curHp > 0);
        // 타겟 우선순위: 지정한 타일 > 클릭한 유닛 > 시전자 본인
        const center = targetHex || clickedUnit || caster; 
        const targetType = effectData.target;
        const area = effectData.area || 0;

        if (targetType === 'SELF') targets.push(caster);
        else if (targetType === 'ENEMY_SINGLE' && clickedUnit && clickedUnit.team !== caster.team) targets.push(clickedUnit);
        else if (targetType === 'ALLY_DEAD') {
            // 1. 클릭한 타일이나 유닛 위치에 죽은 아군이 있는지 확인
            if (targetHex) {
                const deadBody = allUnits.find(u => 
                    u.curHp <= 0 && u.team === caster.team && u.q === targetHex.q && u.r === targetHex.r
                );
                if (deadBody) targets.push(deadBody);
            }
            // 2. 혹은 전체 죽은 아군 대상 (AREA_ALL 등과 조합 시)
            else {
                allUnits.filter(u => u.curHp <= 0 && u.team === caster.team).forEach(u => targets.push(u));
            }
        }

        // [수정 4] 자물쇠 따기 / 상인 (OBJECT) 구현
        else if (targetType === 'OBJECT') {
            // 클릭한 대상이 'NEUTRAL' 팀이거나, 데이터상 type이 'OBJECT'인 경우
            if (clickedUnit && (clickedUnit.team === 2 || clickedUnit.type === 'OBJECT')) {
                targets.push(clickedUnit);
            }
        }
        else if (targetType === 'ALLY_SINGLE' && clickedUnit && clickedUnit.team === caster.team) targets.push(clickedUnit);
        
        // [수정] 범위 타겟팅 로직 세분화 (아군/적군/전체 구분)
        else if (targetType === 'AREA_CIRCLE' || targetType === 'AREA_ALL') {
            // 피아식별 없이 범위 내 모든 유닛 (신성화 등 복합 스킬용)
            units.forEach(u => {
                if (this.grid.getDistance(u, center) <= area) targets.push(u);
            });
        }
        else if (targetType === 'AREA_ENEMY') { // 범위 내 적만
            units.forEach(u => {
                if (u.team !== caster.team && this.grid.getDistance(u, center) <= area) targets.push(u);
            });
        }
        else if (targetType === 'AREA_ALLY') { // 범위 내 아군만
            units.forEach(u => {
                if (u.team === caster.team && this.grid.getDistance(u, center) <= area) targets.push(u);
            });
        }
        // ▼▼▼ [통합 수정] AREA_ARC: 전방 3칸 (공격/버프 자동 판별) ▼▼▼
        else if (targetType === 'AREA_ARC') {
            // 1. 시전자에서 타겟(클릭지점)으로 향하는 방향 구하기
            // (이 방향이 곧 시전자의 facing이 됩니다)
            const dir = this.grid.getDirection(caster, center);
            
            // 2. 전방 3칸 좌표 계산 (좌측전방, 정면, 우측전방)
            const targetHexes = [
                this.grid.getNeighborInDir(caster, (dir + 5) % 6), 
                this.grid.getNeighborInDir(caster, dir),           
                this.grid.getNeighborInDir(caster, (dir + 1) % 6)  
            ].filter(h => h);

            // 3. 성격 판별 (공격성 스킬인가? 지원형 스킬인가?)
            // effectData.type이 DMG, DEBUFF, CC 등으로 시작하면 '적' 대상
            const isAggressive = /^(DMG|DEBUFF|CC|STATUS|ATK|ECON_STEAL|GAUGE_DRAIN)/.test(effectData.type);

            units.forEach(u => {
                // 해당 유닛이 범위(3칸) 안에 있는지 확인
                const isAtTarget = targetHexes.some(h => h.q === u.q && h.r === u.r);
                
                if (isAtTarget) {
                    if (isAggressive) {
                        // 공격 스킬이면 적군만 (자신 제외)
                        if (u.team !== caster.team) targets.push(u);
                    } else {
                        // 버프 스킬이면 아군만 (자신 포함 가능)
                        if (u.team === caster.team) targets.push(u);
                    }
                }
            });
        }
        
        
        else if (targetType === 'ALLY_ALL') units.forEach(u => { if (u.team === caster.team) targets.push(u); });
        else if (targetType === 'ENEMY_ALL') units.forEach(u => { if (u.team !== caster.team) targets.push(u); });
        else if (targetType === 'LINE') {
            // 스킬 정보가 있으면 rng 사용, 없으면 기본값 10 (안전장치)
            // rng 보너스(아이템 등)가 있다면 여기서 formulas.getStat(caster, 'rng')로 가져와 더해도 됨
            const lineLength = (skill && skill.rng) ? skill.rng : 10;

            const lineHexes = this.grid.getLine(caster, center, lineLength);
            
            units.forEach(u => {
                if(u.team !== caster.team && lineHexes.some(h => h.q === u.q && h.r === u.r)) {
                    targets.push(u);
                }
            });
        }
        return targets;
    }

    log(msg, type) { this.ui.log(msg, type); }
    showFloatingText(u, txt, col) { this.ui.showFloatingText(u, txt, col); }
    showSpeechBubble(unit, text, duration = 3000) {
        if (!unit) return;
        if (unit.speechTimer) clearTimeout(unit.speechTimer);

        unit.speechText = text; // 텍스트 저장
        if (this.ui) this.ui.renderUnitOverlays(); // 즉시 갱신

        unit.speechTimer = setTimeout(() => {
            unit.speechText = null;
            unit.speechTimer = null;
            if (this.ui) this.ui.renderUnitOverlays(); // 삭제 후 갱신
        }, duration);
    }
    showUnitTooltip(e, u) { this.ui.showUnitTooltip(e, u); }
    showTooltip(e, html) { this.ui.showTooltip(e, html); }
    hideTooltip() { this.ui.hideTooltip(); }
    allocateStat(k) { this.ui.allocateStat(k); }

    updateStatusPanel() { this.ui.updateStatusPanel(); }
    renderPartyList() { this.ui.renderPartyList(); }
    updateFloatingControls() { this.ui.updateFloatingControls(); }
    updateCursor() { this.ui.updateCursor(); }
    renderUI() { this.ui.renderUI(); }

    triggerShakeAnimation(u) { u.shake = 10; }
    triggerBumpAnimation(u, target) { 
        const s = this.grid.hexToPixel(u.q, u.r); 
        const t = this.grid.hexToPixel(target.q, target.r); 
        const dx = t.x - s.x; const dy = t.y - s.y; 
        u.bumpX = dx * 0.3; u.bumpY = dy * 0.3; 
    }
    createProjectile(start, end) { 
        const sPos = this.grid.hexToPixel(start.q, start.r); 
        const ePos = this.grid.hexToPixel(end.q, end.r); 
        this.projectiles.push({ x:sPos.x, y:sPos.y, tx:ePos.x, ty:ePos.y, t:0, speed:0.1 }); 
    }
    
    handleDeath(unit) {
        // 1. 부활 패시브 체크 (기존 유지)
        const revivePassive = (unit.skills || []).find(s => s.type === 'PASSIVE' && s.main?.type === 'PASSIVE_REVIVE_SELF');
        if (revivePassive && !unit.revivedOnce) {
            unit.revivedOnce = true; 
            const recoverPct = revivePassive.main.val || 0.5;
            unit.curHp = Math.max(1, Math.floor(unit.hp * recoverPct));
            this.showFloatingText(unit, "RESURRECT!", "#ffdd00");
            this.log(`✝️ ${unit.name} 자가 부활!`, 'log-heal');
            this.triggerShakeAnimation(unit); 
            this.renderPartyList();
            if (this.viewingUnit === unit) this.updateStatusPanel();
            return; 
        }
        
        this.log(`☠ ${unit.name} 사망`, 'log-dmg'); 
        
        // 2. 적군(Team 1) 사망 시 보상 드롭 로직
        if (unit.team === 1) { 
            const prog = this.gameApp.gameState.progress; 
            const isRepeat = (this.chapter < prog.chapter) || (this.chapter === prog.chapter && this.stage < prog.stage); 
            
            // [경험치]
            let xp = (unit.level || 1) * 20; 
            if (isRepeat) xp = Math.max(1, Math.floor(xp * 0.5)); // 반복 시 50%
            this.gainKillXp(xp); 

            // [골드] (레벨 * 10 ~ 15)
            let goldDrop = (unit.level || 1) * 10 + Math.floor(Math.random() * 5);
            // 패시브 보너스 적용 (ECON_GOLD)
            if (this.goldMod > 1.0) goldDrop = Math.floor(goldDrop * this.goldMod);
            
            this.gameApp.gameState.gold += goldDrop;
            this.showFloatingText(unit, `+${goldDrop} G`, '#ffd700');

            // [명성] (보스급 처치 시 소량 획득)
            if (unit.grade === 'BOSS' || unit.grade === 'ELITE') {
                const renownDrop = unit.grade === 'BOSS' ? 10 : 2;
                this.gameApp.gameState.renown += renownDrop;
                this.showFloatingText(unit, `+${renownDrop} 🎖️`, '#ff9955');
            }

            // [고대 주화] (매우 낮은 확률 1%)
            if (Math.random() < 0.01) {
                this.gameApp.gameState.ancientCoin += 1;
                this.showFloatingText(unit, `+1 🧿`, '#00ffff');
                this.log(`✨ 희귀한 고대 주화를 발견했습니다!`, 'log-item');
            }

            // [아이템 드롭] (기존 유지)
            if (unit.drops && unit.drops.length > 0) {
                unit.drops.forEach(drop => {
                    const chance = drop.rate * (this.dropMod || 1.0);
                    if (Math.random() < chance) {
                        this.lootItem(drop.id, unit);
                    }
                });
            }
        } 
        
        this.checkBattleEnd();
        this.renderPartyList(); 
        this.gameApp.updateResourceDisplay(); // UI 갱신
    }
    lootItem(itemId, sourceUnit) {
        if (!sourceUnit.equipment) sourceUnit.equipment = {};
        
        let success = false;

        // 1번부터 8번 주머니까지 빈 곳 탐색
        for (let i = 1; i <= 8; i++) {
            const slotKey = `pocket${i}`;
            
            // 해당 슬롯이 비어있으면 아이템 저장
            if (!sourceUnit.equipment[slotKey]) {
                sourceUnit.equipment[slotKey] = itemId; 
                success = true;
                break; // 하나 넣었으면 루프 종료
            }
        }

        if (success) {
            const itemInfo = this.gameApp.itemData[itemId];
            const itemName = itemInfo ? itemInfo.name : itemId;
            const itemIcon = itemInfo ? itemInfo.icon : '📦'; // [수정] itemIcon 정의 추가
            
            this.showFloatingText(sourceUnit, `📦 ${itemName}`, '#ffdd00');
            
            // 팀 0(아군)일 때만 로그 및 UI 갱신
            if (sourceUnit.team === 0) {
                // this.gameApp.showAlert(`🎉 [발견] ${itemIcon} ${itemName} 획득!`); // 전투 중 팝업은 방해될 수 있어 주석 처리 (선택)
                this.log(`획득: ${itemName}`, 'log-item');
                this.ui.updateStatusPanel(); 
                this.ui.updateFloatingControls();
            }
        } else {
            this.showFloatingText(sourceUnit, `주머니 꽉 참!`, '#888');
            if (sourceUnit.team === 0) {
                this.log(`주머니(8칸)가 가득 차 ${itemId}를 획득하지 못했습니다.`, 'log-system');
            }
        }
    }

    runAI() { this.aiSystem.runEnemyTurn(); }
    runAllyAutoAI() { this.aiSystem.runAllyAuto(); }

    regenResources(unit) { if (unit.curHp <= 0) return; const hpRegen = Formulas.getDerivedStat(unit, 'hp_regen'); const mpRegen = Formulas.getDerivedStat(unit, 'mp_regen'); unit.curHp = Math.min(unit.hp, unit.curHp + hpRegen); if(unit.mp > 0) unit.curMp = Math.min(unit.mp, unit.curMp + mpRegen); }
    gainActionXp(unit, amount) {
        // [설계] 스테이지당 행동 경험치 제한: 40 (몬스터 약 3마리 처치 분량)
        const ACTION_XP_LIMIT = 40; 

        // 이미 제한에 도달했으면 종료
        if ((unit.stageActionXp || 0) >= ACTION_XP_LIMIT) {
            if (!unit.hasShownMaxXpMsg) {
                // 너무 자주 뜨면 귀찮으므로 로그만 남기거나, 색상을 흐리게 처리
                this.showFloatingText(unit, "Max Action XP", "#888"); 
                unit.hasShownMaxXpMsg = true;
            }
            return;
        }

        // 초기화 안전장치
        if (!unit.stageActionXp) unit.stageActionXp = 0;

        // 실제 획득량 계산 (제한을 넘지 않도록 잘라냄)
        let actualGain = amount;
        if (unit.stageActionXp + amount > ACTION_XP_LIMIT) {
            actualGain = ACTION_XP_LIMIT - unit.stageActionXp;
        }

        if (actualGain > 0) {
            unit.stageActionXp += actualGain;
            unit.xp += actualGain;
            
            // [추가] 행동 경험치 획득 시 작게 표시 (파란색 등 구분)
            // 너무 시끄러우면 주석 처리 가능
            // this.showFloatingText(unit, `+${actualGain} axp`, '#aaf');

            this.checkLevelUp(unit);
            this.gameApp.saveGame();
        }
    }
    gainKillXp(targetUnit) {
        const allies = this.units.filter(u => u.team === 0 && u.curHp > 0);
        if (allies.length === 0) return;

        // [공식 변경] 마리당 획득량 대폭 감소
        // Lv1: 13 XP, Lv5: 45 XP, Lv10: 85 XP
        const monsterLv = targetUnit.level || 1;
        let baseXp = (monsterLv * 8) + 5; 

        // 이미 클리어한 스테이지면 절반만 획득 (노가다 효율 감소)
        const stageKey = `${this.chapter}-${this.stage}`;
        if (this.gameApp.gameState.clearedStages.includes(stageKey)) {
            baseXp = Math.floor(baseXp * 0.5);
        }
        if (baseXp < 1) baseXp = 1;

        allies.forEach(u => {
            u.xp += baseXp;
            this.showFloatingText(u, `+${baseXp} XP`, '#fff');
            this.checkLevelUp(u);
        });
        
        this.gameApp.saveGame();
    }

    // 2. 레벨업 체크 (풀피 회복 기능 삭제)
    checkLevelUp(unit) {
        // [공식 변경] 필요 경험치 대폭 상향 (Lv1->2: 300XP 필요)
        // 약 25마리(스테이지 4~5개)를 잡아야 첫 레벨업 가능
        if (!unit.maxXp) {
            unit.maxXp = Math.floor(300 * Math.pow(1.5, unit.level - 1));
        }

        let leveledUp = false;

        while (unit.xp >= unit.maxXp) {
            unit.xp -= unit.maxXp;
            unit.level++;
            leveledUp = true;
            
            // 스탯 성장 (+1씩)
            unit.statPoints += 3; 
            ['str','int','vit','agi','dex','vol','luk'].forEach(s => unit[s] += 1);
            
            // [중요] 최대 HP/MP는 늘려주되, 현재 체력(curHp)은 회복시켜주지 않음
            // 늘어난 최대치만큼의 차이만 현재 체력에 더해주는 방식도 좋으나,
            // 더 하드코어하게 하기 위해 아예 회복 로직을 제거함.
            
            // 다음 레벨 필요량 갱신
            unit.maxXp = Math.floor(300 * Math.pow(1.5, unit.level - 1));
        }

        if (leveledUp) {
            this.showFloatingText(unit, "LEVEL UP!", "#ffff00");
            this.log(`🎉 ${unit.name} 레벨 ${unit.level} 달성!`, 'log-skill');
            this.triggerShakeAnimation(unit);
            
            // 상태창 갱신을 위해 저장
            this.gameApp.saveGame();
        }
    }

    useItem(slotIndex) {
        const u = this.currentUnit;
        if (!u || u.team !== 0 || this.actions.acted) return;

        // slotIndex는 0~7이 들어옴 (pocket1 ~ pocket8)
        const slotKey = `pocket${slotIndex + 1}`;
        
        let itemId = null;
        let item = null;

        // 주머니 확인
        if (u.equipment && u.equipment[slotKey]) {
            itemId = u.equipment[slotKey];
            if (this.gameApp.itemData) item = this.gameApp.itemData[itemId];
        }

        if (!item) { 
            this.log("사용할 아이템이 없습니다.", "log-system"); 
            return; 
        }

        // [스킬 변환 로직]
        let skillData = null;

        // 1. RefSkill (연결된 스킬) 확인
        const refSkillId = item.refSkill || item.RefSkill;
        if (refSkillId && SKILL_DATABASE[refSkillId]) { 
            const rawSkill = SKILL_DATABASE[refSkillId];
            skillData = JSON.parse(JSON.stringify(rawSkill));
            skillData.id = itemId;        
            skillData.name = item.name;   
            skillData.type = 'ITEM';      
            skillData.mp = 0;             
            skillData._slotKey = slotKey; 
        }

        // 2. 일반 소모품 (힐/버프 등)
        if (!skillData) {
            skillData = {
                id: itemId,
                name: item.name,
                type: 'ITEM',
                icon: item.icon,
                target: item.target || 'SELF',
                rng: item.rng || 0,
                area: item.area || 0,
                mp: 0,
                cost: 50,
                main: { 
                    type: item.subType || 'HEAL_HP', 
                    val: item.val || 30,
                    target: item.target || 'SELF'
                },
                _slotKey: slotKey
            };
        }

        console.log(`🧪 아이템 사용: ${skillData.name} (Target: ${skillData.target})`);

        // 즉시 사용 (타겟팅 불필요)
        if (skillData.target === 'SELF' || skillData.target === 'GLOBAL' || skillData.rng === 0) {
            this.selectedSkill = skillData;
            this.skillProcessor.execute(u, u); 
        } 
        // 조준 필요
        else {
            if (this.selectedSkill && this.selectedSkill._slotKey === slotKey) {
                this.selectedSkill = null;
                this.log("취소됨", "log-system");
            } else {
                this.selectedSkill = skillData;
                this.log(`${item.name} 조준...`, "log-system");
            }
            this.ui.updateFloatingControls();
            this.ui.updateStatusPanel();
            this.ui.updateCursor();
        }
    }

    consumeItem(unit, slotKey) {
        if (unit.equipment && unit.equipment[slotKey]) {
            unit.equipment[slotKey] = null; // 슬롯 비움
        } else if (unit.pocket) {
            unit.pocket = null; // 구버전 호환
        }
        
        this.selectedSkill = null; // 선택 해제
        
        if (unit.team === 0) {
            this.ui.updateStatusPanel();
            this.ui.updateFloatingControls();
            this.renderPartyList(); 
        }
    }
    
    requestItemUse(slotIndex) {
        if (this.currentUnit.team !== 0 || this.actions.acted || this.isProcessingTurn) return;
        if (this.confirmingItemSlot === slotIndex) {
            this.cancelItem();
        } else {
            this.confirmingItemSlot = slotIndex;
            this.updateStatusPanel();
        }
    }

    cancelItem() {
        this.confirmingItemSlot = null;
        this.updateStatusPanel();
    }

    executeItem(slotIndex) {
        this.confirmingItemSlot = null;
        this.useItem(slotIndex);
        this.updateStatusPanel();
    }
    
    selectSkillFromFloat(sId) {
        const u = this.currentUnit;
        if (!u || this.actions.acted) return;
        if (!u) return;
        
        if (sId === 'basic') {
            const basicId = u.equippedBasic || '1000';
            const basicSkill = u.skills.find(s => s.id === basicId) || SKILL_DATABASE[basicId];
            if (basicSkill) {
                this.selectedSkill = (this.selectedSkill === basicSkill) ? null : basicSkill;
                this.log(`[${basicSkill.name}] 선택`, 'log-system');
                this.updateFloatingControls(); 
                this.updateStatusPanel();
                this.updateCursor();
                return;
            }
        }

        const skill = u.skills.find(s => s.id === sId);
        if (!skill) return;

        if (u.curMp < skill.mp) {
            this.log("마나가 부족합니다.", "log-system");
            return;
        }

        if (this.selectedSkill === skill) {
            this.selectedSkill = null;
        } else {
            this.selectedSkill = skill;
            this.log(`[${skill.name}] 선택`, 'log-system');
        }

        this.updateFloatingControls(); 
        this.updateStatusPanel();
        this.updateCursor();
    }
    confirmSkillSelf() {
        const u = this.currentUnit;
        const skill = this.selectedSkill;
        if (!u || !skill) return;

        if (u.curMp < skill.mp) {
            this.log("마나가 부족합니다.", "log-system");
            return;
        }

        this.skillProcessor.execute(u, u).then(() => {
            this.selectedSkill = null;
            this.updateFloatingControls();
            this.updateStatusPanel();
            this.updateCursor();
            this.renderPartyList();
        });
    }
    async useSkill(attacker, targetTile, skillId) {
        // ID로 스킬 데이터 찾기
        let skill = attacker.skills.find(s => s.id === skillId);
        if (!skill) skill = SKILL_DATABASE[skillId];

        // 타겟 유닛 확인
        const targetUnit = this.getUnitAt(targetTile.q, targetTile.r); 

        if (!targetUnit) {
            // Toast 메시지 기능이 없다면 log로 대체
            if(this.gameApp.showToast) this.gameApp.showToast("대상이 없습니다.");
            else this.log("대상이 없습니다.", "log-system");
            return;
        }

        // -----------------------------------------------------------
        // [로직 분기] 스킬 타입에 따른 행동 결정
        // -----------------------------------------------------------
        const mainType = skill.main ? skill.main.type : '';
        const subType = skill.sub ? skill.sub.type : '';
        
        // 조건: 메인 타입이 이동공격(ATK_JUMP 등)이고, 서브가 넉백인 경우
        const isChargeSkill = ['ATK_MOVE', 'ATK_JUMP', 'ATK_DASH'].includes(mainType);
        const isKnockback = (subType === 'CC_KNOCKBACK' || subType === 'KNOCKBACK');

        if (isChargeSkill && isKnockback) {
            // [CASE 1] 날아차기 (돌진 + 넉백)
            await this.executeChargeKnockback(attacker, targetUnit, skill);
        } 
        else {
            // [CASE 2] 일반 스킬 처리
            if (this.skillProcessor) {
                await this.skillProcessor.execute(attacker, targetUnit, skill);
            } else {
                console.error("SkillProcessor가 연결되지 않았습니다.");
            }
        }

        // 행동 종료 처리
        this.endAction(attacker);
    }

    // [신규 추가] 돌진 + 넉백 + 자리뺏기 로직 (날아차기 전용)
    async executeChargeKnockback(attacker, target, skill) {
        // 1. 밀어낼 거리
        const pushDist = (skill.sub && skill.sub.val) ? skill.sub.val : 1;

        // 2. 밀려날 위치 계산
        const pushTile = this.getPushTile(attacker, target, pushDist);
        
        if (!pushTile) {
            this.log("적 뒤에 공간이 없어 밀어낼 수 없습니다!", "log-bad");
            return;
        }

        console.log(`🚀 [돌진] ${attacker.name} -> ${target.name}`);

        // 3. [비주얼] 공격자가 적 위치로 날아감 (데이터 변경 없이 이미지만 이동)
        // 점프 공격이면 점프 연출(scale up/down) 추가
        const isJump = (skill.main.type === 'ATK_JUMP');
        await this.moveSpriteOnly(attacker, target.q, target.r, 300, isJump);

        // 4. [타격] 데미지 및 이펙트 처리
        if (this.skillProcessor) {
            // 데미지 계산 및 적용 (간이 구현)
            // 실제로는 skillProcessor.calculateDamage 등을 쓰는 게 좋습니다.
            const baseDmg = Formulas.getDerivedStat(attacker, 'atk');
            const multiplier = skill.main.val || 1;
            let finalDmg = Math.floor(baseDmg * multiplier) - Formulas.getDerivedStat(target, 'def');
            finalDmg = Math.max(1, finalDmg);

            target.curHp = Math.max(0, target.curHp - finalDmg);
            this.showFloatingText(target, `-${finalDmg}`, '#ff0000');
            this.triggerShakeAnimation(target);
            this.triggerBumpAnimation(attacker, target); // 타격감
            this.log(`${attacker.name}의 ${skill.name}! ${finalDmg} 피해`, 'log-dmg');
        }

        // 적이 죽었으면 넉백 없이 공격자가 그 자리 차지하고 종료
        if (target.curHp <= 0) {
            this.handleDeath(target);
            
            // 공격자 데이터 이동
            attacker.q = target.q;
            attacker.r = target.r;
            this.updateUnitOverlayPosition(attacker);
            return;
        }

        // 5. [넉백 & 자리교체] 핵심 로직
        // [비주얼] 적이 뒤로 밀려나는 연출 (200ms)
        const pushAnim = this.moveSpriteOnly(target, pushTile.q, pushTile.r, 200, false);
        
        // [데이터] 좌표 확정
        attacker.q = target.q;
        attacker.r = target.r;
        
        target.q = pushTile.q;
        target.r = pushTile.r;

        // 애니메이션 대기
        await pushAnim;

        // [후처리] UI 및 시야 갱신
        this.updateUnitOverlayPosition(attacker);
        this.updateUnitOverlayPosition(target);
        
        // 카메라를 공격자에게 맞춤
        if(attacker.team === 0) this.centerCameraOnUnit(attacker);
    }

    // [신규 헬퍼] 밀려날 좌표 계산 (직선)
    getPushTile(attacker, target, dist) {
        // 공격자 -> 타겟 방향 구하기
        const dir = this.grid.getDirection(attacker, target);
        let curr = target;
        
        for(let i=0; i<dist; i++) {
            const next = this.grid.getNeighborInDir(curr, dir);
            // 맵 밖이거나, 이동 불가 지형이거나, 유닛이 있으면 막힘
            if (!next || 
                this.grid.getTerrainData(next.q, next.r).block || 
                this.getUnitAt(next.q, next.r)) {
                return null;
            }
            curr = next;
        }
        return curr;
    }

    // [신규 헬퍼] 이미지(Overlay)만 부드럽게 이동 (Promise)
    moveSpriteOnly(unit, q, r, duration, isJump = false) {
        return new Promise(resolve => {
            const el = document.getElementById(`unit-overlay-${unit.id}`);
            if (!el) { resolve(); return; }

            // 목표 픽셀 좌표
            const dest = this.grid.hexToPixel3D(q, r, unit.height || 0);
            // 현재 화면 기준 좌표로 변환
            const screenX = dest.x - this.camera.x;
            const screenY = dest.y - this.camera.y;

            // CSS Transition 설정
            el.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
            
            // 점프 연출 (크기 변화로 고도 표현)
            if (isJump) {
                el.style.transform = `translate(-50%, -50px) scale(1.2)`; 
                setTimeout(() => {
                    el.style.transform = `translate(-50%, 0) scale(1)`; 
                }, duration * 0.8);
            }

            el.style.left = `${screenX}px`;
            el.style.top = `${screenY}px`;

            setTimeout(() => {
                el.style.transition = ''; // 트랜지션 초기화
                resolve();
            }, duration);
        });
    }

    // [신규 헬퍼] 행동 종료 처리
    endAction(unit) {
        this.actions.acted = true;
        this.actions.moved = true; // 공격 후 이동 불가
        
        // UI 갱신
        this.updateStatusPanel();
        this.renderPartyList();
        this.ui.updateFloatingControls();
        
        // 범위 표시 제거
        this.reachableHexes = [];
        this.selectedSkill = null;
        this.updateCursor();
    }

    onTurnEndClick() {
        this.endTurn();
    }
    // 1. 해당 티어의 아이템만 골라오는 도우미 함수
    getLootTable(tierKey) {
        const table = [];
        // ITEM_DATA 전체를 뒤져서 lootTier가 일치하는 것만 찾음
        // (this.gameApp.itemData는 엑셀 데이터를 붙여넣은 그곳을 가리킵니다)
        const allItems = this.gameApp.itemData || {}; 

        Object.values(allItems).forEach(item => {
            if (item.lootTier === tierKey) {
                table.push({
                    id: item.id,
                    weight: Number(item.lootWeight) || 1000, // 엑셀에서 가져온 가중치
                    grade: item.grade || 'COMMON'
                });
            }
        });
        return table;
    }

    // 2. 실제 주사위를 굴리는 핵심 함수 (LUK 반영)
    rollLoot(tierKey, unit) {
        // A. 메타 테이블(랜덤 상자)인지 먼저 확인
        if (typeof META_LOOT_TABLES !== 'undefined' && META_LOOT_TABLES[tierKey]) {
            const metaGroup = META_LOOT_TABLES[tierKey];
            
            // 상자 종류 추첨 (예: 물약 vs 장비)
            let totalMetaWeight = 0;
            for (let key in metaGroup) totalMetaWeight += metaGroup[key];

            let randomVal = Math.floor(Math.random() * totalMetaWeight);
            let selectedTier = null;

            for (let key in metaGroup) {
                randomVal -= metaGroup[key];
                if (randomVal < 0) {
                    selectedTier = key;
                    break;
                }
            }
            console.log(`🎲 [상자깡] ${tierKey} -> 당첨 그룹: ${selectedTier}`);
            // 당첨된 그룹(예: LOOT_TIER_1)으로 다시 돌리기 (재귀)
            return this.rollLoot(selectedTier, unit);
        }

        // B. 실제 아이템 목록 가져오기
        const table = this.getLootTable(tierKey);
        
        if (table.length === 0) {
            console.warn(`⚠️ [Loot] ${tierKey}에 해당하는 아이템이 없습니다. (데이터 확인 필요)`);
            return null; // 꽝
        }

        // C. LUK 스탯 적용 (행운이 높으면 고급템 확률 증가)
        const luk = (unit && unit.luk) ? unit.luk : 0;
        
        // 등급별 가중치 보너스 (LUK 1당 추가되는 가중치)
        const gradeBonus = {
            'COMMON': 0,      // 일반: 보너스 없음
            'UNCOMMON': 5,    // 고급: LUK * 5 만큼 확률 증가
            'RARE': 20,       // 희귀: LUK * 20 만큼 확률 증가
            'EPIC': 50,       // 영웅: LUK * 50 만큼 확률 증가
            'LEGENDARY': 100  // 전설: LUK * 100 만큼 확률 증가
        };

        // 가중치 재계산
        let totalWeight = 0;
        const weightedPool = table.map(entry => {
            const bonusMult = gradeBonus[entry.grade] || 0;
            const finalWeight = entry.weight + (luk * bonusMult);
            totalWeight += finalWeight;
            return { ...entry, finalWeight: finalWeight };
        });

        // D. 최종 추첨
        let itemRand = Math.floor(Math.random() * totalWeight);
        for (const entry of weightedPool) {
            itemRand -= entry.finalWeight;
            if (itemRand < 0) return entry.id; // 당첨된 아이템 ID 반환
        }

        return weightedPool[weightedPool.length - 1].id; // 안전장치
    }
    
    checkTileEvent(unit) {
        // ---------------------------------------------------------------------
        // [필수] 저장공간 초기화
        // ---------------------------------------------------------------------
        if (!this.gameApp.gameState.collectedObjects) {
            this.gameApp.gameState.collectedObjects = [];
        }

        // ---------------------------------------------------------------------
        // 1. [느낌표 삭제] 도착했으므로 발견 알림 제거
        // ---------------------------------------------------------------------
        if (unit.isDiscoverySignaling) {
            unit.isDiscoverySignaling = false;
            unit.discoveryTarget = null;
            this.updateUnitOverlayPosition(unit); 
        }

        // ---------------------------------------------------------------------
        // 2. [숨겨진 오브젝트] 보물, 동굴
        // ---------------------------------------------------------------------
        const hiddenIdx = this.hiddenObj.findIndex(obj => obj.q === unit.q && obj.r === unit.r);
        
        if (hiddenIdx !== -1) {
            const obj = this.hiddenObj[hiddenIdx];
            const objKey = `HIDDEN_${obj.type}_${this.chapter}_${this.stage}_${obj.q}_${obj.r}`;
            const isAlreadyCollected = this.gameApp.gameState.collectedObjects.includes(objKey);

            // [A] 아이템 (ITEM)
            if (obj.type === 'ITEM') {
                if (isAlreadyCollected) {
                    this.hiddenObj.splice(hiddenIdx, 1);
                    return;
                }
                
                obj.detected = true;

                if (!this.isPeaceful) {
                    this.showFloatingText(unit, "Not Yet...", "#aaa");
                    return;
                }

                const itemIds = String(obj.id).split(',');
                let acquiredNames = [];
                itemIds.forEach(rawId => {
                    const finalId = rawId.trim();
                    if (finalId) {
                        this.lootItem(finalId, unit);
                        const itemData = this.gameApp.itemData[finalId];
                        if (itemData) acquiredNames.push(itemData.name);
                    }
                });

                this.showFloatingText(unit, "GET!", "#ffdf00");
                if (acquiredNames.length > 0) {
                    this.gameApp.showAlert(`[${acquiredNames.join(', ')}]을(를) 획득했습니다!`);
                }

                this.gameApp.gameState.collectedObjects.push(objKey);
                this.hiddenObj.splice(hiddenIdx, 1);
                this.gameApp.saveGame();
                return;
            } 
            
            // [B] 동굴 (CAVE)
            else if (obj.type === 'CAVE') {
                if (isAlreadyCollected) {
                    obj.detected = true;
                } else {
                    if (!obj.detected) {
                        this.showFloatingText(unit, "비밀 통로!", "#55ff55");
                        obj.detected = true;
                        this.gameApp.gameState.collectedObjects.push(objKey);
                        this.gameApp.saveGame();
                    }
                }

                if (this.isPeaceful) {
                    if (confirm("비밀스러운 통로입니다.\n입장하시겠습니까?")) {
                        this.gameApp.gameState.returnPoint = {
                            chapter: this.chapter, stage: this.stage, q: unit.q, r: unit.r
                        };
                        this.gameApp.saveGame();

                        let targetChap = this.chapter;
                        let targetStage = obj.stageId;
                        if (String(obj.stageId).includes('-')) {
                            const parts = obj.stageId.split('-');
                            targetChap = parseInt(parts[0]);
                            targetStage = parseInt(parts[1]);
                        }
                        this.isBattleEnded = true; 
                        
                        // [안전장치 적용] 파티 정보가 없으면 현재 영웅 목록으로 생성
                        const party = (this.gameApp.prepState && this.gameApp.prepState.party) 
                                      ? this.gameApp.prepState.party 
                                      : this.gameApp.gameState.heroes.map(h => ({ hero: h }));

                        this.gameApp.startBattle(targetChap, targetStage, party);
                    }
                } else {
                    this.showFloatingText(unit, "전투 중 입장 불가", "#aaa");
                }
                return;
            }
        }

        // ---------------------------------------------------------------------
        // 3. [함정 체크]
        // ---------------------------------------------------------------------
        if (this.tileEvents) {
            const trapIndex = this.tileEvents.findIndex(t => t.q === unit.q && t.r === unit.r && !t.triggered);
            if (trapIndex !== -1) {
                const trap = this.tileEvents[trapIndex];
                if (trap.ownerId !== unit.id) { 
                    this.log(`${unit.name} 함정 발동!`, "log-bad");
                    this.showFloatingText(unit, "TRAP!", "#ff0000");
                    if (trap.type === 'TRAP_STUN') {
                        const dmg = Math.floor(unit.hp * 0.1) + 10;
                        if (this.applyDamage) this.applyDamage(unit, dmg);
                        else unit.curHp = Math.max(0, unit.curHp - dmg);
                        if (this.skillProcessor) this.skillProcessor.applyStatus(unit, { type: 'CC_STUN', duration: 1 });
                        this.updateStatusPanel();
                    }
                    this.tileEvents.splice(trapIndex, 1);
                }
            }
        }

        // ---------------------------------------------------------------------
        // 4. [건물 및 포탈] (아군만)
        // ---------------------------------------------------------------------
        if (unit.team === 0) {
            const key = `${unit.q},${unit.r}`;
            const cell = this.grid.terrainMap.get(key);
            
            if (cell && cell.building) {
                const bKey = cell.building.key;
                const bInfo = this.gameApp.buildingData[bKey];

                if (!bInfo && !['CHEST', 'EXIT_POINT', 'START_POINT', 'PORTAL', 'TEMPLE', 'BLACKSMITH'].includes(bKey)) return;

                // [E] 포탈 (PORTAL)
                if (bKey === 'PORTAL' || (bInfo && bInfo.type === 'teleport')) {
                    
                    let isPortalActive = false;
                    let lockMsg = "";

                    // 마을(1-0) 로직
                    if (this.chapter === 1 && this.stage === 0) {
                        const hasCleared1_1 = this.gameApp.gameState.clearedStages.includes('1-1');
                        if (hasCleared1_1) isPortalActive = true;
                        else lockMsg = "🔒 1-1 스테이지를 클리어해야 개방됩니다.";
                    }
                    // 일반 던전 로직
                    else {
                        const enemiesAlive = this.units.some(u => u.team === 1 && u.curHp > 0);
                        if (!enemiesAlive) isPortalActive = true;
                        else lockMsg = "⚠️ 적을 모두 물리쳐야 활성화됩니다.";
                    }

                    if (!isPortalActive) {
                        this.showFloatingText(unit, "🔒 봉인됨", "#aaa");
                        this.log(lockMsg, "log-system");
                        this.triggerShakeAnimation(unit); 
                        return;
                    }

                    const text = cell.building.text;
                    // 텍스트가 있으면 특정 구역 이동
                    if (text && text.match(/^\d+-\d+$/)) {
                        this.gameApp.showConfirm(`[${text}] 구역으로 이동하시겠습니까?`, () => {
                            const [c, s] = text.split('-').map(Number);
                            this.isBattleEnded = true;
                            
                            // [안전장치 적용] 파티 정보가 없으면 현재 영웅 목록으로 생성
                            const party = (this.gameApp.prepState && this.gameApp.prepState.party) 
                                          ? this.gameApp.prepState.party 
                                          : this.gameApp.gameState.heroes.map(h => ({ hero: h }));

                            this.gameApp.startBattle(c, s, party);
                        });
                    } else {
                        // 통합 포탈 메뉴
                        this.gameApp.showConfirm("🌀 다른 지역으로 이동하시겠습니까?", () => {
                            if (this.gameApp.townSystem.openPortal) {
                                this.gameApp.townSystem.openPortal();
                            } else {
                                this.gameApp.showAlert("이동 가능한 지역이 없습니다.");
                            }
                        });
                    }
                    return;
                }

                // [F] 보물상자 (CHEST)
                if (bKey === 'CHEST') {
                    const chestKey = `CHEST_${this.chapter}_${this.stage}_${unit.q}_${unit.r}`;
                    if (this.gameApp.gameState.collectedObjects.includes(chestKey)) {
                        this.showFloatingText(unit, "빈 상자", "#aaa");
                        delete cell.building; return;
                    }
                    const lootString = cell.building.text;
                    if (!lootString) { this.showFloatingText(unit, "빈 상자", "#aaa"); return; }
                    this.log(`📦 보물상자를 열었습니다!`, 'log-item');
                    if (lootString.startsWith('BOX') || lootString.startsWith('LOOT') || lootString.startsWith('TIER') || lootString === 'POTION') {
                        const pickedId = this.rollLoot(lootString, unit);
                        if (pickedId) this.lootItem(pickedId, unit);
                        else this.showFloatingText(unit, "꽝...", "#888");
                    } else {
                        const itemIds = lootString.split(',');
                        itemIds.forEach(rawId => {
                            const finalId = rawId.trim();
                            if (finalId) this.lootItem(finalId, unit);
                        });
                    }
                    this.gameApp.gameState.collectedObjects.push(chestKey);
                    this.gameApp.saveGame();
                    delete cell.building;
                    return;
                }

                // [A] 입구/출구
                if (bKey === 'EXIT_POINT' || bKey === 'START_POINT') {
                    const enemiesAlive = this.units.some(u => u.team === 1 && u.curHp > 0);
                    if (!this.isPeaceful && enemiesAlive) {
                        this.gameApp.showAlert(`⛔ 적이 남아있어 이동할 수 없습니다!`);
                        return;
                    }
                    let targetChap = this.chapter, targetStage = this.stage;
                    const text = cell.building.text;
                    if (text && text.match(/^\d+-\d+$/)) {
                        [targetChap, targetStage] = text.split('-').map(Number);
                    } else {
                        if (bKey === 'EXIT_POINT') targetStage++;
                        else if (bKey === 'START_POINT') {
                            const memory = this.gameApp.gameState.returnPoint;
                            if (memory && (memory.chapter !== this.chapter || memory.stage !== this.stage)) {
                                targetChap = memory.chapter; targetStage = memory.stage;
                            } else targetStage--;
                        }
                    }
                    if (targetStage < 0) return;
                    const moveMsg = (bKey === 'EXIT_POINT') ? "다음 지역으로" : "이전 지역으로";
                    this.gameApp.showConfirm(`${moveMsg} 이동하시겠습니까?`, () => {
                        this.isBattleEnded = true;
                        const isForward = (bKey === 'EXIT_POINT');
                        const skipReward = this.isPeaceful || !isForward;
                        if (isForward) this.gameApp.gameState.returnPoint = { chapter: this.chapter, stage: this.stage };
                        this.gameApp.onBattleEnd(true, false, skipReward, { chapter: targetChap, stage: targetStage });
                    });
                    return;
                }

                // [상점/시설]
                if (bInfo && bInfo.type === 'shop') {
    // [수정 포인트] this.gameApp.townSystem.openShop을 직접 넘기지 않고, 화살표 함수로 감쌉니다.
    this.gameApp.showConfirm(`${bInfo.name}을(를) 이용하시겠습니까?`, () => {
        this.gameApp.townSystem.openShop(bInfo.shopType || 'all');
    }); 
    return;
}

if (bKey === 'TEMPLE' || (bInfo && bInfo.action === 'skill')) {
    // [수정 포인트] 화살표 함수 확인
    this.gameApp.showConfirm("신전에 입장하시겠습니까?", () => {
        this.gameApp.townSystem.openTemple();
    });
    return;
}

if (bKey === 'BLACKSMITH' || (bInfo && bInfo.action === 'upgrade')) {
    // [수정 포인트] 화살표 함수 확인
    this.gameApp.showConfirm("대장간을 이용하시겠습니까?", () => {
        this.gameApp.townSystem.openShop('weapon');
    });
    return;
}

if (bInfo && bInfo.action === 'rest') {
    // [수정 포인트] 화살표 함수 확인
    this.gameApp.showConfirm("휴식하시겠습니까?", () => {
        this.gameApp.townSystem.openInn();
    });
    return;
}

if (bInfo && bInfo.action === 'recruit') {
    // [수정 포인트] 화살표 함수 확인
    this.gameApp.showConfirm("입장하시겠습니까?", () => {
        this.gameApp.townSystem.openTavern();
    });
    return;
}
            }
        }
    }
    

    detectHiddenObjects(unit) {
        // 1. 일단 느낌표 끄기 (이동해서 멀어졌을 경우를 대비해 초기화)
        unit.isDiscoverySignaling = false;
        
        // 2. 주변 6칸(Neighbors) 탐색
        const neighbors = this.grid.getNeighbors(unit);
        let nearbyFound = false;

        neighbors.forEach(n => {
            // 이미 찾았거나(looted/triggered) 없는 건 제외
            const nearbyObj = this.hiddenObj.find(o => o.q === n.q && o.r === n.r);
            
            if (nearbyObj) {
                // 공식: INT 20 이상 OR LUK 15 이상일 때만 "감지"
                const totalInt = Formulas.getDerivedStat(unit, 'int', true);
                const totalLuk = Formulas.getDerivedStat(unit, 'luk', true);

                if (totalInt >= 20 || totalLuk >= 15) {
                    nearbyObj.detected = true; // 맵에 반짝임 표시용 플래그
                    this.triggerSparkle(nearbyObj);
                    nearbyFound = true;
                }
            }
        });

        // 주변에 감지된 게 하나라도 있으면 머리 위 느낌표(!) 표시
        if (nearbyFound) {
            unit.isDiscoverySignaling = true;
            // 로그는 너무 자주 뜨면 시끄러우므로, 최초 1회만 띄우거나 생략
            // this.log(`${unit.name}의 감각이 반응합니다!`, 'log-skill'); 
        }
        
        // UI 갱신 (느낌표 반영)
        this.updateUnitOverlayPosition(unit); 
    }

    // [신규 메서드] 반짝임 효과
    triggerSparkle(obj) {
        // 이미 렌더링된 이펙트가 없다면 플로팅 텍스트로 표시
        // (추후 BattleRenderer에서 this.hiddenObj를 순회하며 detected된 좌표에 이미지를 그리면 됩니다)
        this.showFloatingText({q: obj.q, r: obj.r}, "✨✨✨", "#ffffaa");
    }
    placeTrap(q, r, trapType, ownerId) {
        // 이미 유닛이나 함정이 있으면 설치 불가
        if (this.getUnitAt(q, r)) {
            this.log("설치할 공간이 부족합니다.", "log-system");
            return;
        }

        // 함정을 '유닛'처럼 취급하여 units 배열에 추가 (혹은 별도 traps 배열 관리)
        // 여기서는 편의상 투명한 유닛(Team 2 or 별도)으로 처리하거나,
        // 타일 이벤트(TileEvent)로 등록하는 것이 일반적입니다.
        
        // 예시: 타일 이벤트로 등록
        if (!this.tileEvents) this.tileEvents = [];
        this.tileEvents.push({
            q: q, r: r,
            type: trapType, // 'TRAP_STUN' 등
            ownerId: ownerId,
            triggered: false
        });

        this.log("함정이 설치되었습니다.", "log-skill");
        // 시각적 연출 (함정 아이콘 등)이 필요하면 별도 처리
    }
    // [누락된 함수 추가] 창 크기 변경 시 캔버스 리사이징
    handleResize() {
        const parent = this.grid.canvas.parentElement; 
        if (parent) { 
            this.grid.canvas.width = parent.clientWidth; 
            this.grid.canvas.height = parent.clientHeight; 
        } 
        this.updateFloatingControls(); 
    }
    
    // [누락된 함수 추가] 아군 영웅들 중심으로 카메라 이동
    centerCameraOnHeroes() { 
        let totalX=0, totalY=0, count=0; 
        // 아군이 있으면 아군 기준, 없으면 전체 유닛 기준
        const targets = this.units.filter(u => u.team === 0).length > 0 
                        ? this.units.filter(u => u.team === 0) 
                        : this.units; 
        
        targets.forEach(u => { 
            // 3D 좌표 변환 (높이 0 기준)
            const p = this.grid.hexToPixel3D(u.q, u.r, 0); 
            totalX += p.x; 
            totalY += p.y; 
            count++; 
        }); 
        
        if (count > 0) { 
            this.camera.x = totalX / count - this.grid.canvas.width / 2; 
            this.camera.y = totalY / count - this.grid.canvas.height / 2; 
        } 
        this.updateFloatingControls();
    }
    // =================================================================
    // ▼▼▼ [누락된 스킬 로직 추가] useSkill 및 날아차기 구현 ▼▼▼
    // =================================================================

    // 스킬 사용 메인 진입점
    async useSkill(attacker, targetTile, skillId) {
        // ID로 스킬 데이터 찾기
        let skill = attacker.skills.find(s => s.id === skillId);
        if (!skill) skill = SKILL_DATABASE[skillId];

        // 타겟 유닛 확인
        const targetUnit = this.getUnitAt(targetTile.q, targetTile.r); 

        if (!targetUnit) {
            if(this.gameApp.showToast) this.gameApp.showToast("대상이 없습니다.");
            else this.log("대상이 없습니다.", "log-system");
            return;
        }

        // -----------------------------------------------------------
        // [로직 분기] 스킬 타입에 따른 행동 결정
        // -----------------------------------------------------------
        const mainType = skill.main ? skill.main.type : '';
        const subType = skill.sub ? skill.sub.type : '';
        
        // 조건: 메인 타입이 이동공격(ATK_JUMP 등)이고, 서브가 넉백인 경우
        const isChargeSkill = ['ATK_MOVE', 'ATK_JUMP', 'ATK_DASH'].includes(mainType);
        const isKnockback = (subType === 'CC_KNOCKBACK' || subType === 'KNOCKBACK');

        if (isChargeSkill && isKnockback) {
            // [CASE 1] 날아차기 (돌진 + 넉백)
            await this.executeChargeKnockback(attacker, targetUnit, skill);
        } 
        else {
            // [CASE 2] 일반 스킬 처리
            if (this.skillProcessor) {
                await this.skillProcessor.execute(attacker, targetUnit, skill);
            } else {
                console.error("SkillProcessor가 연결되지 않았습니다.");
            }
        }

        // 행동 종료 처리
        this.endAction(attacker);
    }

    // [신규] 돌진 + 넉백 로직 (날아차기 전용)
    async executeChargeKnockback(attacker, target, skill) {
        // 1. 밀어낼 거리
        const pushDist = (skill.sub && skill.sub.val) ? skill.sub.val : 1;

        // 2. 밀려날 위치 계산
        const pushTile = this.getPushTile(attacker, target, pushDist);
        
        if (!pushTile) {
            this.log("적 뒤에 공간이 없어 밀어낼 수 없습니다!", "log-bad");
            return;
        }

        console.log(`🚀 [돌진] ${attacker.name} -> ${target.name}`);

        // 3. [비주얼] 공격자가 적 위치로 날아감 (데이터 변경 없이 이미지만 이동)
        const isJump = (skill.main.type === 'ATK_JUMP');
        await this.moveSpriteOnly(attacker, target.q, target.r, 300, isJump);

        // 4. [타격] SkillProcessor에게 효과 적용 위임 (데미지+상태이상)
        if (this.skillProcessor && this.skillProcessor.applySkillEffect) {
            this.skillProcessor.applySkillEffect(attacker, target, skill);
            
            this.triggerShakeAnimation(target);
            this.triggerBumpAnimation(attacker, target);
        } else {
            // 비상용 (applySkillEffect가 없을 때)
            const dmg = Math.max(1, (attacker.str || 10) * 1.5 - (target.def || 0));
            target.curHp = Math.max(0, target.curHp - dmg);
            this.showFloatingText(target, `-${Math.floor(dmg)}`, '#f00');
        }

        // 적이 죽었으면 넉백 없이 공격자가 그 자리 차지하고 종료
        if (target.curHp <= 0) {
            this.handleDeath(target);
            // 공격자 데이터 이동
            attacker.q = target.q;
            attacker.r = target.r;
            this.updateUnitOverlayPosition(attacker);
            return;
        }

        // 5. [넉백 & 자리교체] 핵심 로직
        // [비주얼] 적이 뒤로 밀려나는 연출 (200ms)
        const pushAnim = this.moveSpriteOnly(target, pushTile.q, pushTile.r, 200, false);
        
        // [데이터] 좌표 확정
        attacker.q = target.q;
        attacker.r = target.r;
        
        target.q = pushTile.q;
        target.r = pushTile.r;

        // 애니메이션 대기
        await pushAnim;

        // [후처리] UI 및 시야 갱신
        this.updateUnitOverlayPosition(attacker);
        this.updateUnitOverlayPosition(target);
        
        if(attacker.team === 0) this.centerCameraOnUnit(attacker);
    }

    // [헬퍼] 밀려날 좌표 계산 (직선)
    getPushTile(attacker, target, dist) {
        const dir = this.grid.getDirection(attacker, target);
        let curr = target;
        
        for(let i=0; i<dist; i++) {
            const next = this.grid.getNeighborInDir(curr, dir);
            // 맵 밖이거나, 이동 불가 지형이거나, 유닛이 있으면 막힘
            if (!next || 
                this.grid.getTerrainData(next.q, next.r).block || 
                this.getUnitAt(next.q, next.r)) {
                return null;
            }
            curr = next;
        }
        return curr;
    }

    // [헬퍼] 이미지(Overlay)만 부드럽게 이동 (Promise)
    moveSpriteOnly(unit, q, r, duration, isJump = false) {
        return new Promise(resolve => {
            const el = document.getElementById(`unit-overlay-${unit.id}`);
            if (!el) { resolve(); return; }

            const dest = this.grid.hexToPixel3D(q, r, unit.height || 0);
            const screenX = dest.x - this.camera.x;
            const screenY = dest.y - this.camera.y;

            el.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
            
            // 점프 연출
            if (isJump) {
                el.style.transform = `translate(-50%, -50px) scale(1.2)`; 
                setTimeout(() => {
                    el.style.transform = `translate(-50%, 0) scale(1)`; 
                }, duration * 0.8);
            }

            el.style.left = `${screenX}px`;
            el.style.top = `${screenY}px`;

            setTimeout(() => {
                el.style.transition = ''; // 트랜지션 초기화
                resolve();
            }, duration);
        });
    }

    // [헬퍼] 행동 종료 처리
    endAction(unit) {
        this.actions.acted = true;
        this.actions.moved = true; // 공격 후 이동 불가
        
        this.updateStatusPanel();
        this.renderPartyList();
        this.ui.updateFloatingControls();
        
        this.reachableHexes = [];
        this.selectedSkill = null;
        this.updateCursor();
    }

    injectStyles() {
        if (document.getElementById('battle-system-styles')) return;
        const style = document.createElement('style');
        style.id = 'battle-system-styles';
        style.innerHTML = `
            /* [기본 UI 스타일] */
            #floating-controls { position: fixed; z-index: 9999; display: flex; flex-direction: row; align-items: flex-start; gap: 5px; pointer-events: auto; transition: opacity 0.2s; transform: translate(-50%, -100%); }
            .hud-hidden, .hud-hidden * { opacity: 0 !important; pointer-events: none !important; }
            .float-skill-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 3px; background: #151515; border: 1px solid #555; border-radius: 6px; width: 130px; height: 42px; overflow-y: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.9); }
            .float-skill-btn { width: 34px; height: 34px; background: #25252a; border: 1px solid #444; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; position: relative; flex-shrink: 0; }
            .float-skill-btn:hover { border-color: gold; background: #353540; }
            .float-skill-btn.active { border-color: gold; box-shadow: 0 0 5px gold; background: #443300; }
            .float-skill-btn.locked { opacity: 0.3; pointer-events: none; filter: grayscale(100%); }
            .float-skill-btn.mana-lack { opacity: 0.6; background: #311; border-color: #522; color: #f55; }
            .float-end-btn { width: 34px; height: 34px; background: linear-gradient(135deg, #722, #511); border: 1px solid #944; border-radius: 6px; color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); margin-top: 3px; }
            .float-end-btn:hover { background: linear-gradient(135deg, #933, #722); transform: scale(1.05); border-color: #f66; }

            .unit-overlay { 
                position: absolute; 
                display: flex;
                flex-direction: column; 
                align-items: center;
                transform: translate(-50%, 0); 
                width: 0; height: 0; 
                overflow: visible;
                pointer-events: none; 
                z-index: 100;
                transition: top 0.05s linear, left 0.05s linear; 
            }

            .overlay-anchor-group {
                position: absolute;
                bottom: 0; 
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100px; 
                padding-bottom: 2px; 
            }

            .bar-group { 
                position: relative; 
                bottom: auto; left: auto; transform: none; 
                width: 40px; 
                display: flex; flex-direction: column; gap: 1px; 
            }

            .hp-row { display: flex; width: 100%; height: 5px; background: #222; border: 1px solid #000; }
            .hp-fill { background: #f44; height: 100%; transition: width 0.2s; }
            .shield-fill { background: #00bfff; height: 100%; transition: width 0.2s; }
            .xp-fill { background: #7a7a7a; height: 100%; transition: width 0.2s; }
            .ag-row { width: 100%; height: 3px; background: #000; border: 1px solid #000; }
            .ag-fill { background: #ffd700; height: 100%; transition: width 0.2s; }

            .name-tag { 
                position: absolute;
                top: 50px; 
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.6); 
                color: #eee; 
                font-size: 9px; 
                padding: 0 3px; 
                border-radius: 3px; 
                white-space: nowrap; 
                text-shadow: 1px 1px 1px #000; 
                border: 1px solid #333; 
            }
                .status-icon-mini {
            font-size: 11px; 
            width: 16px; 
            height: 16px; 
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.7); 
            border: 1px solid rgba(255, 215, 0, 0.3); 
            border-radius: 3px; 
            box-shadow: 0 0 3px rgba(0,0,0,0.5);
            pointer-events: none;
        }

        .status-row {
            display: flex;
            gap: 2px;
            margin-bottom: 4px;
            justify-content: center;
            min-height: 18px; 
        }

            .hud-guide-text { position: absolute; top: -16px; right: 0; font-size: 9px; color: rgba(255, 255, 255, 0.7); font-weight: bold; text-shadow: 1px 1px 0 #000; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
            #floating-controls:hover .hud-guide-text { opacity: 1; }

            .turn-highlight-circle { position: absolute; top: 40px; left: 0; width: 50px; height: 30px; border: 2px solid #ffd700; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 10px #ffd700; z-index: -1; animation: pulseBorder 1.5s infinite; }
            @keyframes pulseBorder { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } 50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } }
            .item-confirm-popup { position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; background: rgba(0,0,0,0.9); padding: 4px; border-radius: 4px; border: 1px solid #666; z-index: 9999; }
            .speech-bubble {
                position: absolute;
                bottom: 100%; /* 유닛 머리 위 */
                left: 50%;
                transform: translateX(-50%);
                background: #fff;
                color: #000;
                padding: 6px 10px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                z-index: 9999;
                border: 2px solid #333;
                animation: bubblePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: none; /* 클릭 통과 (중요!) */
            }
            
            /* 말풍선 꼬리 */
            .speech-bubble::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                margin-left: -6px;
                border-width: 6px;
                border-style: solid;
                border-color: #fff transparent transparent transparent;
            }
            
            /* 말풍선 꼬리 테두리 (선택사항) */
            .speech-bubble::before {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                margin-left: -8px;
                border-width: 8px;
                border-style: solid;
                border-color: #333 transparent transparent transparent;
                z-index: -1;
            }

            @keyframes bubblePop {
                0% { transform: translateX(-50%) scale(0); opacity: 0; }
                100% { transform: translateX(-50%) scale(1); opacity: 1; }
            }
        
            `;
        document.head.appendChild(style);
    }
}