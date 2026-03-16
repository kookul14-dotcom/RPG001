// =========================================================================
// [SRPG 챕터 1 스테이지 데이터]
// 고저차, 우회로, 병목 현상, 지형 기믹을 극대화한 입체적 레벨 디자인
// (전 맵 6인 출격 기준, 적 난이도 완만한 상승 곡선 적용)
// =========================================================================

function buildStage(cols, rows, setupFunc) {
    let s = { cols, rows, map: {}, enemies: [], deployment: [], structures: [], hiddenObj: [] };
    
    s.getQ = (c, r) => c - Math.floor(r / 2);
    
    s.setTile = (c, r, key, h) => { 
        if(c >= 0 && c < cols && r >= 0 && r < rows) {
            const roundedH = Math.round(h * 5) / 5;
            s.map[`${s.getQ(c, r)},${r}`] = { key, h: roundedH }; 
        }
    };
    
    s.addDeploy = (c, r) => s.deployment.push(`${s.getQ(c, r)},${r}`);
    
    // ⭐ [수정된 부분] 4번째 인자는 level, 5번째 인자는 count(마릿수)로 명확하게 분리!
    s.addEnemy = (key, c, r, level = 1, count = 1) => {
        let str = `${key}:${s.getQ(c, r)}:${r}:${level}`; // 기본형: "E_WARRIOR:q:r:level"
        if (count > 1) str += `*${count}`;              // 마릿수가 2 이상일 때만 뒤에 "*2"를 붙임
        s.enemies.push(str);
    };
    
    s.addObj = (key, c, r, text='') => s.structures.push(`${key}:${s.getQ(c, r)}:${r}:${text}`);
    s.addHidden = (type, id, c, r) => s.hiddenObj.push({ type: type, id: id, q: s.getQ(c, r), r: r, detected: false });

    // 기본 평탄화 (Plain, h=0)
    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) s.setTile(c, r, 'PLAIN', 0);
    }

    setupFunc(s);

    delete s.getQ; delete s.setTile; delete s.addDeploy; delete s.addEnemy; delete s.addObj; delete s.addHidden;
    return s;
}

const CH1_STAGES = {};

// =========================================================================
// 🟢 Stage 1: 협곡의 입구 (튜토리얼 - 고저차와 활의 위력)
// - 중앙의 낮은 길과 양옆의 높은 절벽(ROCKY). 
// - 적이 절벽 위에서 공격할 때의 위협을 배우고, 우회해서 올라가는 법을 익힘.
// =========================================================================
// =========================================================================
// 🟢 Stage 1: 속삭이는 협곡의 입구 (고저차와 지형지물 완벽 튜토리얼)
// - [디자인] 우하단에서 시작해 중앙의 굽이치는 강을 건너 좌측의 거대한 암산을 오르는 구조.
// - [전략] 일반적인 도약(Jump=2)으로는 올라갈 수 없는 깎아지른 절벽(h=2.0 이상 차이)을 구현하여
//          반드시 구불구불한 흙길(ROAD)을 따라 전진하도록 동선을 통제했습니다.
// - [학습] 숲(엄폐), 여울목(이동력 저하), 고지대 궁수의 위협을 뼈저리게 체험합니다.
// =========================================================================
CH1_STAGES[1] = buildStage(20, 20, (s) => {
    // 1. 전체 지형의 베이스 깎기 (강물을 기준으로 좌우 높낮이 다름)
    for(let r=0; r<20; r++) {
        // 중앙을 관통하는 S자 굽이치는 강물의 중심축 계산
        let riverC = 10 + Math.round(Math.sin(r * 0.4) * 3); 
        
        for(let c=0; c<20; c++) {
            let dist = c - riverC;
            
            if (Math.abs(dist) <= 1) {
                // 중앙: 강물 (이동 페널티, 회피 페널티)
                s.setTile(c, r, 'WATER_SHALLOW', -0.5);
            } 
            else if (dist < -1) {
                // 강물 좌측: 가파르게 솟아오르는 암산 (절벽)
                let d = Math.abs(dist) - 1; // 강에서 멀어질수록 1, 2, 3...
                let h = 0;
                let tile = 'ROCKY';
                if (d === 1) { h = 0; tile = 'GRASS'; } // 강기슭
                else if (d === 2) { h = 1.0; }          // 1단 절벽 (점프 2로 등반 가능)
                else if (d === 3) { h = 2.5; }          // 2단 절벽 (여기서부터 직등 불가)
                else if (d === 4) { h = 4.0; }          // 3단 절벽
                else { h = 5.0; }                       // 정상
                s.setTile(c, r, tile, h);
            } 
            else {
                // 강물 우측: 완만하게 높아지는 숲 언덕
                let d = Math.abs(dist) - 1;
                let h = 0;
                let tile = 'GRASS';
                if (d <= 2) { h = 0; }
                else if (d <= 4) { 
                    h = 1.0; 
                    tile = Math.random() < 0.6 ? 'FOREST' : 'GRASS'; 
                }
                else { 
                    h = 2.0; 
                    tile = 'FOREST'; 
                }
                s.setTile(c, r, tile, h);
            }
        }
    }

    // 2. 강물의 수심 디테일 (특정 구간은 깊어서 건널 수 없음)
    s.setTile(11, 16, 'WATER_DEEP', -0.5);
    s.setTile(12, 15, 'WATER_DEEP', -0.5);
    s.setTile(9, 9, 'WATER_DEEP', -0.5);
    s.setTile(8, 8, 'WATER_DEEP', -0.5);
    s.setTile(7, 4, 'WATER_DEEP', -0.5);

    // 3. 플레이어가 반드시 따라가야 하는 우회로(계단길) 조성
    const makeRoad = (c, r, hOverride) => {
        let existing = s.map[`${s.getQ(c,r)},${r}`];
        let baseH = existing ? existing.h : 0;
        let finalH = hOverride !== undefined ? hOverride : baseH;
        
        // 물 위를 지나는 곳은 얕은 여울목으로 처리
        if (existing && existing.key.includes('WATER')) {
            s.setTile(c, r, 'ROAD', -0.2); 
        } else {
            s.setTile(c, r, 'ROAD', finalH);
        }
    };

    // 우하단 시작 -> 여울목(강 건넘) -> 좌상단 절벽 등반 코스
    const path = [
        [16,19],[15,18],[15,17],[14,16], // 평지 진입로 (h=0)
        [13,15],[12,14],[11,13],[10,13], // 여울목 접근 (h=0)
        [9,13],[8,12],[7,12],            // 물 건너기! (h=-0.2)
        [6,11],[5,10],                   // 1단 오르막 (h=1.0)
        [4,9],[4,8],[5,7],               // 2단 오르막 (h=2.5)
        [6,6],[6,5],[5,4],               // 3단 오르막 (h=4.0)
        [4,3],[3,2],[2,1],[2,0]          // 산 정상으로 퇴장 (h=5.0)
    ];

    path.forEach(([c, r], index) => {
        let h = undefined;
        // 절벽을 부드럽게 오를 수 있도록 도로 타일의 높이를 수동 평탄화
        if (index >= 11 && index <= 12) h = 1.0; 
        if (index >= 13 && index <= 15) h = 2.5; 
        if (index >= 16 && index <= 18) h = 4.0;
        if (index >= 19) h = 5.0;                
        makeRoad(c, r, h);
    });

    // 4. 전술적 엄폐물 및 디테일 소품 배치
    s.setTile(12, 10, 'FOREST', 0); // 강 건너기 전 매복하기 좋은 숲
    s.addObj('WALL_STONE', 7, 13, "강가 이끼 낀 바위"); // 궁수의 시야를 피할 돌벽
    s.addObj('WALL_STONE', 15, 14, "부러진 고목");
    s.addObj('WALL_STONE', 5, 8, "풍화된 비석");
    s.addObj('SIGNPOST', 14, 17, "높은 곳에서 쏘는 화살은 치명적입니다. 바위 뒤에 숨으세요!");

    // 5. 출격 위치 (맵 우하단 평지)
    s.addDeploy(14, 19); s.addDeploy(15, 19); s.addDeploy(16, 19);
    s.addDeploy(14, 18); s.addDeploy(15, 18); s.addDeploy(16, 18);

    // 6. 적 배치 (점진적인 기믹 학습)
    // [페이즈 1] 평지 기본 전투
    s.addEnemy('RAT', 13, 16, 1); 
    // [페이즈 2] 물속 적과 숲의 궁수 (지형 패널티 체험)
    s.addEnemy('SLIME', 10, 14, 1); // 물 속에 대기 중 (플레이어 이동력 저하 노림)
    // [페이즈 3] 고지대 저격과 길목 틀어막기
    s.addEnemy('E_ARCHER', 3, 11, 1); // 좌측 아찔한 절벽(h=2.5) 위에서 길목을 쏘는 궁수! (매우 위험)
    // [페이즈 4] 정상 부근의 보스급 개체
    s.addEnemy('E_WARRIOR', 4, 3, 1); // 맵 정상 (h=5.0) 최후의 관문 (Lv 2)
    // 7. 숨겨진 보상 (도약을 잘 활용하거나 끝까지 탐색하는 유저용)
    s.addHidden('ITEM', 'IT_POTION', 1, 8); // 좌측 암산 중턱의 구석진 곳
});

// =========================================================================
// 🌊 Stage 2: 가라앉은 유적 (수중 페널티와 고지대 쟁탈전)
// - [디자인] 중앙이 깊고 얕은 물로 침수된 고대 유적. 
// - [전략 1] 좌측: 도약이 필요한 끊어진 '고지대 다리(h=1.5)'. 궁수가 선점 중.
// - [전략 2] 우측: 우거진 '숲과 풀밭(h=0~0.5)'. 엄폐하기 좋으나 적이 매복 중.
// - [전략 3] 중앙: 가장 빠르지만 회피율과 이동력이 바닥을 치는 '얕은 물'.
// - 7기의 적이 각자의 특성에 맞는 지형(비행, 수중, 고지대)에서 대기합니다.
// =========================================================================
CH1_STAGES[2] = buildStage(18, 20, (s) => {
    // 1. 전체 지형 베이스 (시작점, 침수 구역, 제단 구역 분리)
    for(let r=0; r<20; r++) {
        for(let c=0; c<18; c++) {
            if (r >= 16) {
                s.setTile(c, r, 'PLAIN', 0); // 플레이어 시작 지점 (안전 지대)
            } else if (r <= 4) {
                s.setTile(c, r, 'ROCKY', 1.0); // 북쪽 유적 제단 (고지대)
            } else {
                s.setTile(c, r, 'WATER_SHALLOW', -0.5); // 중앙은 기본적으로 얕은 물
            }
        }
    }

    // 2. 좌측: 끊어진 고가 교량 (도약으로만 건널 수 있는 저격 포인트)
    const bridgeCoords = [
        [3,15], [3,14], [4,13], [4,12], /* 1칸 끊김 */ 
        [5,10], [5,9], [6,8], /* 1칸 끊김 */ 
        [7,6], [8,5]
    ];
    bridgeCoords.forEach(([c, r]) => {
        s.setTile(c, r, 'ROAD', 1.5); // 물보다 무려 2.0 높은 고지대
    });

    // 3. 우측: 물에 잠기지 않은 수풀 둑길 (엄폐 및 우회로)
    for(let r=7; r<16; r++) {
        for(let c=12; c<18; c++) {
            if ((c + r) % 3 === 0) s.setTile(c, r, 'FOREST', 0.5);
            else s.setTile(c, r, 'GRASS', 0);
        }
    }

    // 4. 중앙: 깊은 물 (건널 수 없는 자연 장애물, 비행형만 통과 가능)
    const deepWater = [
        [7,14], [8,14], [9,14], 
        [6,11], [7,11], [10,10], [11,10],
        [5,7], [6,7], [9,7], [10,7]
    ];
    deepWater.forEach(([c, r]) => s.setTile(c, r, 'WATER_DEEP', -1.0));

    // 5. 북쪽 제단부 디테일 (계단식으로 높아짐)
    for(let c=6; c<=12; c++) {
        s.setTile(c, 4, 'ROAD', 0.5);  // 제단 1단 계단
        s.setTile(c, 3, 'ROAD', 1.0);  // 제단 2단 계단
        s.setTile(c, 2, 'ROCKY', 1.5); // 제단 본체
        s.setTile(c, 1, 'ROCKY', 1.5);
    }

    // 6. 전술적 엄폐물 및 맵 소품
    s.addObj('WALL_STONE', 13, 12, "이끼 낀 유적 기둥"); // 우측 숲 엄폐물
    s.addObj('WALL_STONE', 15, 9, "부서진 조각상");
    s.addObj('WALL_STONE', 7, 2, "제단 마력 기둥"); // 보스방 엄폐물
    s.addObj('WALL_STONE', 11, 2, "제단 마력 기둥");
    s.addObj('SIGNPOST', 8, 16, "얕은 물은 이동력을 깎고 회피를 포기하게 만듭니다. 좌우의 길을 활용하십시오.");

    // 7. 출격 위치 (남쪽 중앙 평지)
    s.addDeploy(7, 19); s.addDeploy(8, 19); s.addDeploy(9, 19); s.addDeploy(10, 19);
    s.addDeploy(8, 18); s.addDeploy(9, 18);

    // 8. 적 배치 (총 7기 - 각 지형에 특화된 유닛 배치)
    
    // [좌측 교량조] 고저차를 이용한 저격
    s.addEnemy('E_ARC_01', 4, 12, 1); // 끊어진 교량 위(h=1.5)에서 물 속을 쏘는 궁수
    // [우측 숲조] 숲의 회피 보너스를 받는 매복 병력
    s.addEnemy('SLIME', 12, 11, 1);   // 숲과 물 경계의 슬라임
    // [중앙 수로조] 이동이 제한된 늪지대 압박
    s.addEnemy('SLIME', 9, 13, 1);    // 플레이어가 물에 들어오면 접근
    s.addEnemy('BAT', 7, 9, 1);       // 깊은 물(WATER_DEEP) 위를 날아다니며 자유롭게 기습
    // [북쪽 제단조] 최종 돌파구 방어
    s.addEnemy('KOBOLD', 8, 5, 1);    // 제단으로 올라오는 계단 길목 통제
    s.addEnemy('E_SORCERER', 9, 2, 2);  // 제단 최상단(h=1.5)에서 범위 마법을 쏘는 마법사 (미니 보스격)
});

// =========================================================================
// ⛺ Stage 3: 붉은 이빨 야영지 (ZOC 돌파와 측면 기습)
// - [디자인] 남쪽 평지에서 시작해, 깎아지른 절벽(우측)과 울창한 숲(좌측) 사이의
//          좁은 오르막길을 두 번의 방어선에 걸쳐 뚫고 올라가는 산채 구조.
// - [전략 1] 정면: 목책(WALL_WOOD) 사이를 몸으로 막고 있는 전사(E_WAR_01)들을 뚫어야 함.
// - [전략 2] 좌측 숲: 방어력은 낮지만 회피율이 높은 도적(E_THI_01)이 숲에 매복 중.
// - [전략 3] 우측 고지대: 접근하기 힘든 암산 위에서 궁수(E_ARC_01)가 화살을 쏟아냄.
// =========================================================================
CH1_STAGES[3] = buildStage(20, 20, (s) => {
    // 1. 전체 지형 등고선 작업 (대각선 형태의 유기적인 산비탈)
    for(let r=0; r<20; r++) {
        for(let c=0; c<20; c++) {
            let h = 0;
            let type = 'GRASS';
            
            // r + c 연산을 통해 지형을 가로/세로 일직선이 아닌 대각선 사선으로 형성
            let slope = r + (c * 0.5); 

            if (slope < 10) { h = 2.0; type = 'DIRT'; }      // 북서~북동: 본진 (고지대)
            else if (slope < 17) { h = 1.0; type = 'GRASS'; } // 중앙: 중턱
            else { h = 0; type = 'GRASS'; }                  // 남쪽: 진입로 (저지대)

            // 특수 지형 1: 우측의 깎아지른 암산 (스나이퍼 고지대, 통행 까다로움)
            if (c >= 14 && r >= 9 && r <= 16) {
                h = 2.5; 
                type = 'ROCKY';
            }

            // 특수 지형 2: 좌측의 우회로 (도적이 은신하기 좋은 울창한 숲)
            if (c <= 6 && r >= 5) {
                type = 'FOREST';
                h = (r < 12) ? 1.0 : 0.5; // 숲속의 완만한 단차
            }

            s.setTile(c, r, type, h);
        }
    }

    // 2. 중앙을 관통하며 부드럽게 올라가는 S자 흙길 (정확한 단차 계산)
    const roadPath = [
        [10,19],[10,18],[9,17],[9,16],[8,15], // 0~4: 진입 (h=0)
        [8,14],[9,13],[10,12],[11,11],        // 5~8: 1차 오르막 (h=0.25 -> 1.0)
        [12,10],[12,9],[12,8],                // 9~11: 중턱 평지 (h=1.0)
        [11,7],[11,6],[12,5],[13,5],          // 12~15: 2차 오르막 (h=1.25 -> 2.0)
        [14,4],[15,4],[16,4],[16,3]           // 16~19: 본진 내부 진입 (h=2.0)
    ];
    
    roadPath.forEach(([c, r], i) => {
        let roadH = 0;
        if (i <= 4) roadH = 0;
        else if (i <= 8) roadH = 0 + ((i-4) * 0.25);      // 0.0 -> 1.0 부드러운 경사
        else if (i <= 11) roadH = 1.0;
        else if (i <= 15) roadH = 1.0 + ((i-11) * 0.25);  // 1.0 -> 2.0 부드러운 경사
        else roadH = 2.0;

        s.setTile(c, r, 'ROAD', roadH);
    });

    // 3. 야영지 방어 시설 (초크포인트 형성)
    // 1차 방어선 (계곡 입구) - [8,14] 길을 중심으로 좌우 차단
    s.addObj('WALL_WOOD', 7, 14, "부서진 목책"); 
    s.addObj('WALL_WOOD', 9, 14, "목책"); 
    
    // 2차 방어선 (본진 입구) - [12,8] 길을 중심으로 좌우 차단
    s.addObj('WALL_WOOD', 11, 8, "강화 목책"); 
    s.addObj('WALL_WOOD', 13, 8, "강화 목책"); 
    
    // 본진 오브젝트
    s.addObj('TENT', 14, 2, "대형 텐트");
    s.addObj('TENT', 18, 3, "보급품 텐트");
    s.addObj('CAMPFIRE', 16, 5, "모닥불");

    // 4. 출격 위치 (남쪽 평지)
    s.addDeploy(9, 19); s.addDeploy(10, 19); s.addDeploy(11, 19);
    s.addDeploy(9, 18); s.addDeploy(10, 18); s.addDeploy(11, 18);

    // 5. 적 배치 (총 7기 밸런싱 및 전술적 위치 배정)
    
    // [1차 방어선 - 계곡 초크포인트]
    s.addEnemy('E_WARRIOR', 8, 14, 2);  // 좁은 길목 정면을 틀어막는 탱커 (ZOC 활용)
    s.addEnemy('E_ARCHER', 14, 12, 1); // 우측 암산(h=2.5)에서 1차 방어선을 지원 사격하는 궁수 (고지대 이점)
    
    // [좌측 우회로 변수]
    s.addEnemy('E_THIEF', 4, 14, 2);  // 좌측 숲(h=0.5)에 숨어있다 진격하는 아군의 측면/후방을 찌르는 도적
    
    // [2차 방어선 - 본진 입구]
    s.addEnemy('E_WARRIOR', 12, 8, 1);  // 2차 목책 길목을 지키는 수비대장
    
    
    // [본진 - 보스 및 호위]
    s.addEnemy('E_WARRIOR', 15, 6, 1);    // 모닥불 근처를 배회하는 근접 호위병
    
});
// =========================================================================
// ☠️ Stage 4: 망자의 분지 (독 장판과 고립된 구역)
// - 분지(Crater) 형태. 맵 중앙은 낮고 넓은 독 늪.
// - 중앙을 가로지르면 빠르지만 큰 피해를 입고, 가장자리로 돌면 안전하지만 멈.
// =========================================================================
CH1_STAGES[4] = buildStage(26, 26, (s) => {
    // 1. 유기적인 늪지대 생성 (삼각함수를 이용한 자연스러운 물웅덩이 패턴)
    for(let r=0; r<26; r++) {
        for(let c=0; c<26; c++) {
            // 파동(Noise) 값을 만들어 불규칙한 지형 생성
            let noise = Math.sin(c * 0.4) + Math.cos(r * 0.4) + Math.sin((c + r) * 0.2);
            
            if (noise < -0.5) {
                s.setTile(c, r, 'POISON_LND', -1.0); // 깊고 위험한 맹독 늪
            } else if (noise < 1.0) {
                s.setTile(c, r, 'SWAMP', -0.5);      // 이동이 불편한 일반 늪지대
            } else {
                s.setTile(c, r, 'PLAIN', 0);         // 늪 사이의 마른 땅
            }
        }
    }
    
    // 2. 맵을 대각선(좌상단 -> 우하단)으로 가로지르는 거대한 무너진 능선(고지대)
    for(let r=0; r<26; r++) {
        for(let c=0; c<26; c++) {
            // 능선의 두께와 불규칙한 고저차(1.5 ~ 2.5) 부여
            if (Math.abs(c - r) <= 2) { 
                let height = 1.5 + Math.abs(Math.sin(c * 0.5)); 
                s.setTile(c, r, 'ROCKY', height);
            }
            
            // 우측 상단의 적 보스 구역(제단) 형성
            if (c > 18 && r < 8) {
                s.setTile(c, r, 'ROCKY', 2.0);
            }
        }
    }

    // 3. 전술적 초크포인트 (능선 중앙이 무너져 내린 유일한 횡단로)
    for(let r=11; r<=14; r++) {
        for(let c=11; c<=14; c++) {
            s.setTile(c, r, 'SWAMP', -0.5); 
        }
    }
    // 초크포인트 한가운데 치명적인 독 웅덩이 하나 배치 (플레이어의 강제 우회 유도)
    s.setTile(12, 12, 'POISON_LND', -1.0);

    // 4. 오브젝트 (보스 제단의 묘비들)
    s.addObj('GRAVE', 22, 4); 
    s.addObj('GRAVE', 21, 3);
    s.addObj('GRAVE', 23, 5);

    // 5. 출격 위치 (좌측 하단 능선 뒤쪽 안전지대)
    s.addDeploy(2, 23); s.addDeploy(3, 23); s.addDeploy(4, 23); s.addDeploy(5, 23);
    s.addDeploy(2, 24); s.addDeploy(3, 24); s.addDeploy(4, 24);

    // 6. 입체적 적 배치
    s.addEnemy('E_WARRIOR', 10, 16, 3); 
    s.addEnemy('E_KNIGHT', 12, 18, 3); 
    s.addEnemy('E_ARCHER', 8, 8, 3);
    s.addEnemy('E_MARTIAL_ARTIST', 22, 4, 3);
});

// =========================================================================
// 💎 Stage 5: 마력 깃든 정동 (지형 마법 상성 & 크리스탈)
// - 마법 방어력과 범위에 영향을 주는 CRYSTAL 타일 다수 배치.
// - 기둥에 숨어 마법사의 시야를 차단하며 전진하는 맵.
// =========================================================================
CH1_STAGES[5] = buildStage(28, 28, (s) => {
    // 1. 유기적인 베이스 지형 생성 (굽이치는 동굴 바닥)
    for(let r=0; r<28; r++) {
        for(let c=0; c<28; c++) {
            s.setTile(c, r, 'PLAIN', 0);

            // 삼각함수를 이용한 S자 형태의 거대한 크리스탈 광맥
            let vein = Math.sin(c * 0.3) + Math.cos(r * 0.3) + Math.sin((c + r) * 0.15);
            // 💡 단차로 인한 길막힘을 방지하기 위해 광맥과 독지대의 높이는 0으로 고정합니다.
            if (Math.abs(vein) < 0.4) {
                s.setTile(c, r, 'CRYSTAL', 0); 
            } else if (vein > 1.8) {
                s.setTile(c, r, 'POISON_LND', 0); 
            }
        }
    }
    
    // 2. 우측 상단 마법사들의 요새 (도약력 1도 오르내릴 수 있는 완만한 지구라트 형태)
    // 제단의 중심점: c=22, r=6
    for(let r=0; r<28; r++) {
        for(let c=0; c<28; c++) {
            // 맨해튼 거리(Manhattan Distance)를 이용해 마름모꼴의 피라미드 계단 생성
            let dist = Math.abs(c - 22) + Math.abs(r - 6);
            
            // 💡 인접한 칸과의 높이 차이가 무조건 0.5 이하가 되도록 설계!
            if (dist <= 2) s.setTile(c, r, 'ROCKY', 2.0);      // 최상단 제단 (높이 2.0)
            else if (dist <= 4) s.setTile(c, r, 'ROCKY', 1.5); // 3단 계단 (높이 1.5)
            else if (dist <= 6) s.setTile(c, r, 'ROCKY', 1.0); // 2단 계단 (높이 1.0)
            else if (dist <= 8) s.setTile(c, r, 'ROCKY', 0.5); // 1단 진입로 (높이 0.5)
        }
    }

    // 제단 한가운데의 거대 크리스탈 코어 (보스의 자리)
    s.setTile(22, 6, 'CRYSTAL', 2.0);

    // 3. 중앙 돌진을 막는 바위 기둥 (우회로 강제)
    // 계단 정면을 일부 가려서, 좌우 측면 계단으로 돌아오도록 유도합니다.
    const pillars = [[15, 13], [16, 12], [17, 11], [18, 10]];
    pillars.forEach(([c, r]) => {
        s.setTile(c, r, 'ROCKY', 3.0); // 완전히 시야와 이동을 차단하는 기둥
        s.addObj('WALL_STONE', c, r);
    });

    // 4. 아군 출격 위치 (좌측 하단 평지)
    s.addDeploy(2, 25); s.addDeploy(3, 25); s.addDeploy(4, 25); s.addDeploy(5, 25);
    s.addDeploy(2, 24); s.addDeploy(3, 24); s.addDeploy(4, 24); s.addDeploy(5, 24);

    // =========================================================================
    // 5. 입체적 적 배치 (다이내믹 스케일링 적용)
    // =========================================================================
    
    // [전방 방어선] 평지에서 플레이어를 맞이하는 근접 병력
    s.addEnemy('E_KNIGHT', 10, 20, 3);  // 길목 방어 기사 (Lv 5)
    s.addEnemy('E_WARRIOR', 12, 22, 3); // 돌격하는 전사 (Lv 5)

    // [중턱 요격진] 석주(돌기둥) 근처와 1.0 높이 단상에서 방어
    s.addEnemy('GOLEM', 14, 15, 3);    // 기둥 옆 수문장 골렘 (Lv 6)
    s.addEnemy('E_BARD', 16, 8, 3);  // 단상 위에서 저격하는 궁수 (Lv 6)
    s.addEnemy('E_THIEF', 19, 13, 3);  // 측면 계단을 타고 우회해서 내려오는 도적 (Lv 6)

    // [최상층 제단] 도약력 1이라도 언제든 계단을 타고 내려올 수 있는 마법사들
    s.addEnemy('E_ALCHEMIST', 20, 8, 3); // 1.5 높이 단상에서 독병 투척 (Lv 7)
    
    // [보스] 2.0 높이 최상단에서 전장을 굽어보는 대마도사
    s.addEnemy('E_SORCERER', 22, 6, 4);  // 대마도사 (Lv 9)
});

// =========================================================================
// ❄️ Stage 6: 칼바람 얼음절벽 (미끄러짐과 상승 기류)
// - 빙판(ICE)과 상승 기류(ZONE_UPDRAFT)의 적극적 활용.
// - 적의 넉백(멧돼지, 전사)을 맞으면 빙판을 타고 맵 끝으로 밀려날 수 있음.
// =========================================================================
CH1_STAGES[6] = buildStage(28, 28, (s) => {
    // 1. 유기적인 빙곡(계곡) 지형 생성
    for(let r=0; r<28; r++) {
        for(let c=0; c<28; c++) {
            let h = 0;
            let isIceValley = false;

            // 북쪽(r이 작아질수록)으로 갈수록 기본 고도가 서서히 높아짐 (0 -> 2.0)
            if (r < 22) h += 0.5;
            if (r < 16) h += 0.5;
            if (r < 10) h += 0.5;
            if (r < 5) h += 0.5;

            // 중앙(c=12~15)은 빙판 계곡으로 주변 절벽보다 낮음
            if (c >= 12 && c <= 15) {
                h -= 0.5; 
                if (h < 0) h = 0;
                // 계곡 중심부는 미끄러운 얼음
                s.setTile(c, r, 'ICE', h);
                isIceValley = true;
            } else {
                // 좌우 절벽은 눈밭(SNOWFIELD)이며, 불규칙한 바위 지형으로 높낮이를 추가
                if ((c + r) % 5 === 0) h += 0.5;
                s.setTile(c, r, 'SNOWFIELD', h);
            }

            // 고지대 가장자리(절벽 끝부분)의 시각적 강조
            if (!isIceValley && (c === 11 || c === 16) && r < 18) {
                s.setTile(c, r, 'ROCKY', h + 0.5); 
            }
        }
    }
    
    // 2. 전술적 도약을 돕는 상승 기류(UPDRAFT) 타일 배치
    // 이 타일을 밟으면 도약력이 대폭 상승하여 깎아지른 절벽을 한 번에 올라갈 수 있습니다.
    s.setTile(10, 18, 'ZONE_UPDRAFT', 0.5); // 좌측 능선으로 기습 점프
    s.setTile(17, 18, 'ZONE_UPDRAFT', 0.5); // 우측 능선으로 기습 점프
    s.setTile(13, 10, 'ZONE_UPDRAFT', 1.0); // 계곡 중앙에서 최상층 요새로 진입하는 점프대
    s.setTile(14, 10, 'ZONE_UPDRAFT', 1.0);

    // 3. 시야 차단 및 경로 강제를 위한 거대 얼음벽 배치
    const iceWalls = [[11, 14], [16, 14], [12, 8], [15, 8]];
    iceWalls.forEach(([c, r]) => {
        const currentH = s.map[`${s.getQ(c, r)},${r}`]?.h || 0;
        s.setTile(c, r, 'ICE', currentH + 1.0); 
        s.addObj('WALL_ICE', c, r);
    });

    // 4. 아군 출격 위치 (계곡 최하단 진입로)
    s.addDeploy(12, 26); s.addDeploy(13, 26); s.addDeploy(14, 26); s.addDeploy(15, 26);
    s.addDeploy(13, 25); s.addDeploy(14, 25);

    // =========================================================================
    // 5. 입체적 적 배치 (총 7기 / 레벨 3~4 믹스)
    // =========================================================================
    
    // [중앙 빙판 길목] 넉백과 돌파를 담당하는 근접조
    // 빙판 위에서 멧돼지에게 들이받히면 크게 밀려나 진형이 붕괴될 수 있습니다.
    s.addEnemy('BOAR', 13, 17, 4);      // 돌진 넉백 위협 (Lv 4)
    s.addEnemy('E_WARRIOR', 14, 15, 4); // 길목을 틀어막는 방패병 역할 (Lv 4)

    // [좌우 측면 고지대] 상승 기류를 수호하며 눈밭을 뛰어다니는 늑대들
    s.addEnemy('WOLF', 9, 15, 3);       // 좌측 기동 타격 (Lv 3)
    s.addEnemy('WOLF', 18, 15, 3);      // 우측 기동 타격 (Lv 3)

    // [고지대 저격진] 절벽 위에서 일방적으로 아래를 향해 화살을 쏘는 궁수들
    // 아군이 상승 기류를 타지 않고 걸어 올라가면 벌집이 됩니다.
    s.addEnemy('E_ARCHER', 10, 10, 4);  // 좌측 절벽 저격수 (Lv 4)
    s.addEnemy('E_ARCHER', 17, 10, 4);  // 우측 절벽 저격수 (Lv 4)

    // [최정상 매복조] 플레이어가 꼭대기에 도달했을 때 기습하는 도적
    s.addEnemy('E_THIEF', 14, 5, 3);    // 빙판 꼭대기 매복 암살자 (Lv 3)
});

// =========================================================================
// 🏛️ Stage 7: 대수도원 정문 (시가전 및 ZOC 돌파)
// - 넓은 계단과 광장, 그리고 다수의 장애물.
// - 적의 기사들이 통제 영역(ZOC)으로 길을 막고 궁수가 후방 지원.
// =========================================================================
CH1_STAGES[7] = buildStage(20, 20, (s) => {
    for(let r=0; r<20; r++) {
        for(let c=0; c<20; c++) {
            if (r < 6) s.setTile(c, r, 'ROCKY', 2.0); // 수도원 내부 (제일 높음)
            else if (r < 9) s.setTile(c, r, 'ROAD', 1.0); // 광장
            else if (r < 14) { // 대형 계단
                let step = Math.floor((14 - r) / 2) * 0.4;
                s.setTile(c, r, 'ROAD', step);
            }
            else s.setTile(c, r, 'PLAIN', 0); // 하층부
        }
    }
    
    // 광장의 화단과 조각상 (엄폐물)
    s.setTile(6, 7, 'FOREST', 1.0); s.setTile(13, 7, 'FOREST', 1.0);
    s.addObj('WALL_STONE', 9, 6, "석상"); s.addObj('WALL_STONE', 10, 6, "석상");

    s.addDeploy(8, 19); s.addDeploy(9, 19); s.addDeploy(10, 19); s.addDeploy(11, 19);
    s.addDeploy(9, 18); s.addDeploy(10, 18);

    // 훈련된 정규 병력 (Lv 5~6)
    s.addEnemy('E_KNI_05', 8, 10, 6); // 계단 중턱을 막는 중갑병
    s.addEnemy('E_KNI_05', 11, 10, 6);
    s.addEnemy('E_ARC_05', 6, 6, 5);  // 화단 뒤 궁수
    s.addEnemy('E_ARC_05', 13, 6, 5); 
    s.addEnemy('E_CLE_05', 9, 4, 6);  // 수도원 입구 힐러
    s.addEnemy('E_WAR_05', 10, 4, 6);
});

// =========================================================================
// 🌋 Stage 8: 타오르는 용광로 (시간 압박과 지형 상성)
// - 바닥이 LAVA로 가득 찬 공장. 용암은 매 턴 데미지.
// - 좁은 캣워크(ROAD)를 타고 가거나, 불 속성 저항을 믿고 돌파해야 함.
// =========================================================================
CH1_STAGES[8] = buildStage(20, 20, (s) => {
    for(let r=0; r<20; r++) {
        for(let c=0; c<20; c++) {
            s.setTile(c, r, 'LAVA', -0.5); // 맵 대부분이 용암
        }
    }
    
    // 격자 형태의 금속 캣워크(안전지대, h=1.0)
    for(let i=2; i<18; i++) {
        s.setTile(i, 16, 'ROAD', 1.0);
        s.setTile(i, 4, 'ROAD', 1.0);
        s.setTile(4, i, 'ROAD', 1.0);
        s.setTile(15, i, 'ROAD', 1.0);
        s.setTile(9, i, 'ROAD', 1.0); // 중앙 관통로
        s.setTile(10, i, 'ROAD', 1.0);
    }
    
    // 중앙 교차로 넓은 플랫폼
    for(let r=9; r<=11; r++) {
        for(let c=8; c<=11; c++) s.setTile(c, r, 'ROCKY', 1.0);
    }

    s.addDeploy(8, 18); s.addDeploy(9, 18); s.addDeploy(10, 18); s.addDeploy(11, 18);
    s.addDeploy(9, 19); s.addDeploy(10, 19);

    // 용암/불 속성 위주 적 (Lv 6)
    s.addEnemy('MINOTAUR', 9, 10, 6); // 교차로 미노타우르스
    s.addEnemy('MINOTAUR', 10, 10, 6);
    s.addEnemy('E_SOR_05', 4, 8, 6);  // 좌측 캣워크 화염 법사
    s.addEnemy('E_SOR_05', 15, 8, 6); // 우측 캣워크 화염 법사
    s.addEnemy('DRAKE', 9, 4, 6);     // 비행형 용 (용암 무시)
});

// =========================================================================
// ⚔️ Stage 9: 통곡의 방벽 (대규모 공성전 총력)
// - 높이 h=3.0의 거대한 성벽. 도약(Jump) 능력치가 낮으면 올라갈 수 없음.
// - 성벽을 부수거나, 비행/도약 캐릭터를 활용해 측면의 틈새를 노려야 함.
// =========================================================================
CH1_STAGES[9] = buildStage(20, 20, (s) => {
    for(let r=0; r<20; r++) {
        for(let c=0; c<20; c++) {
            if (r < 8) s.setTile(c, r, 'PLAIN', 3.0); // 성벽 위
            else if (r === 8) s.setTile(c, r, 'ROCKY', 3.0); // 성벽 흉벽
            else if (r < 11) s.setTile(c, r, 'WATER_DEEP', -0.5); // 해자
            else s.setTile(c, r, 'GRASS', 0); // 평야
        }
    }
    
    // 정문 도개교와 파괴 가능한 문
    for(let r=8; r<=10; r++) {
        s.setTile(9, r, 'ROAD', 0); s.setTile(10, r, 'ROAD', 0);
    }
    s.addObj('WALL_STONE', 9, 8, "성문"); s.addObj('WALL_STONE', 10, 8, "성문");

    // 측면 해자에 놓인 부서진 공성탑 (계단 역할)
    s.setTile(3, 8, 'ROCKY', 1.5); s.setTile(3, 9, 'ROCKY', 1.0); s.setTile(3, 10, 'ROCKY', 0.5);
    s.setTile(16, 8, 'ROCKY', 1.5); s.setTile(16, 9, 'ROCKY', 1.0); s.setTile(16, 10, 'ROCKY', 0.5);

    s.addDeploy(8, 18); s.addDeploy(9, 18); s.addDeploy(10, 18); s.addDeploy(11, 18);
    s.addDeploy(9, 19); s.addDeploy(10, 19);

    // 정예 요격 부대 (Lv 6~7)
    s.addEnemy('E_KNI_05', 9, 7, 7); // 성문 뒤 기사
    s.addEnemy('E_KNI_05', 10, 7, 7);
    s.addEnemy('E_ARC_05', 6, 8, 7); // 성벽 위 궁수진
    s.addEnemy('E_ARC_05', 13, 8, 7);
    s.addEnemy('E_CLE_05', 9, 4, 7); 
    s.addEnemy('E_SOR_05', 10, 4, 7);
    s.addEnemy('E_THI_05', 3, 12, 6); // 공성탑 쪽 기습
});

// =========================================================================
// 👑 Stage 10: 어둠의 나락 (Chapter 1 Final Boss)
// - 역피라미드 구조(가장자리가 높고 중앙이 푹 파인 아레나).
// - 보스가 중앙 가장 낮은 곳에 있지만, 넓은 광역기로 플레이어를 압박함.
// =========================================================================
CH1_STAGES[10] = buildStage(20, 20, (s) => {
    for(let r=0; r<20; r++) {
        for(let c=0; c<20; c++) {
            // 중앙(10,10)이 제일 낮고(h=0), 외곽으로 갈수록 높아짐(h=2.0)
            let dist = Math.max(Math.abs(c - 10), Math.abs(r - 10));
            let h = Math.min(4, Math.floor(dist / 2)) * 0.5;
            
            s.setTile(c, r, 'ROCKY', h);
            
            // 곳곳에 불길한 독기 (디버프 존)
            if (dist === 3 || dist === 4) {
                if (Math.random() < 0.4) s.setTile(c, r, 'POISON_LND', h);
            }
        }
    }
    
    // 진입을 위한 북쪽/남쪽 계단
    for(let r=0; r<20; r++) {
        s.setTile(9, r, 'ROAD', Math.min(4, Math.floor(Math.max(Math.abs(9-10), Math.abs(r-10)) / 2)) * 0.5);
        s.setTile(10, r, 'ROAD', Math.min(4, Math.floor(Math.max(Math.abs(10-10), Math.abs(r-10)) / 2)) * 0.5);
    }

    s.addDeploy(8, 19); s.addDeploy(9, 19); s.addDeploy(10, 19); s.addDeploy(11, 19);
    s.addDeploy(9, 18); s.addDeploy(10, 18);

    // 챕터 1 최종 보스전 (Lv 7~8)
    s.addEnemy('LICH', 9, 9, 8);      // 맵 정중앙 나락의 보스
    s.addEnemy('DULLAHAN', 9, 12, 7); // 남쪽 진입로 호위
    s.addEnemy('DULLAHAN', 10, 12, 7);
    s.addEnemy('GARGOYLE', 4, 10, 7); // 좌측 외곽 고지대 폭격기
    s.addEnemy('GARGOYLE', 15, 10, 7); // 우측 외곽 고지대 폭격기
    s.addEnemy('E_CLE_05', 10, 6, 8); // 북쪽 힐러
});

export const STAGE_DATA = {
    1: CH1_STAGES
};