import { JOB_CLASS_DATA } from '../../data/index.js';
import { PORTRAIT_DATA } from '../../data/portraits.js';

export class PartyManager {
    constructor(gameApp) {
        this.game = gameApp;
    }

    _getClassString(h) {
        let jobKeyStr = h.classKey || h.key || 'Unknown';
        
        if (typeof JOB_CLASS_DATA !== 'undefined') {
            const cInfo = Object.values(JOB_CLASS_DATA).find(c => c.jobKey === h.classKey || c.key === h.key);
            if (cInfo && cInfo.jobKey) {
                jobKeyStr = cInfo.jobKey;
            }
        }
        
        const formattedJobName = jobKeyStr.split(/[_ ]+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        return `${formattedJobName} (Class ${h.classLevel || 1})`;
    }

    openUI() {
        if (!window.game) return;

        let modal = document.getElementById('modal-party');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-party';
            document.body.appendChild(modal);
        }

        modal.style.cssText = `
            position: fixed !important; 
            top: 0 !important; left: 0 !important; 
            width: 100vw !important; height: 100vh !important; 
            background-color: #ebd9b4 !important; 
            background-image: url('data:image/svg+xml;utf8,<svg opacity="0.15" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.5"/></filter><rect width="100" height="100" filter="url(%23n)"/></svg>') !important;
            z-index: 100000 !important; 
            display: flex !important; 
            flex-direction: column !important;
            align-items: stretch !important; 
            justify-content: flex-start !important; 
            margin: 0 !important; padding: 0 !important;
        `;

        if (!this.game.gameState.heroes) this.game.gameState.heroes = [];
        while (this.game.gameState.heroes.length < 6) {
            this.game.gameState.heroes.push(null);
        }

        this.setupPartyModalStructure(modal);
        modal.style.display = 'flex';
        this.renderPartyUI();
    }

    setupPartyModalStructure(modal) {
        modal.innerHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; height: 80px; border-bottom: 4px double #5d4037; flex-shrink: 0; background: #d4bc96; box-sizing: border-box;">
                <h2 style="margin:0; font-family:'Cinzel', serif; font-size:36px; color:#3e2723; letter-spacing:4px; font-weight:bold; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);">PARTY MANAGEMENT</h2>
                <div style="display:flex; gap:15px;">
                    <button id="btn-party-to-hero" style="background:#f4ebd8; color:#3e2723; border:2px solid #5d4037; padding:10px 20px; font-family:'Cinzel', serif; font-size:14px; font-weight:bold; cursor:pointer; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); transition: 0.2s;" onmouseover="this.style.background='#fff'; this.style.borderColor='#8b0000'; this.style.color='#8b0000';" onmouseout="this.style.background='#f4ebd8'; this.style.borderColor='#5d4037'; this.style.color='#3e2723';">▶ CHARACTER</button>
                    <button id="btn-party-to-skill" style="background:#f4ebd8; color:#3e2723; border:2px solid #5d4037; padding:10px 20px; font-family:'Cinzel', serif; font-size:14px; font-weight:bold; cursor:pointer; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); transition: 0.2s;" onmouseover="this.style.background='#fff'; this.style.borderColor='#8b0000'; this.style.color='#8b0000';" onmouseout="this.style.background='#f4ebd8'; this.style.borderColor='#5d4037'; this.style.color='#3e2723';">▶ SKILL</button>
                    <button id="btn-party-real-close" style="background:#3e2723; color:#ebd9b4; border:2px solid #1a110a; padding:10px 40px; font-family:'Cinzel', serif; font-size:16px; font-weight:bold; cursor:pointer; box-shadow: 2px 4px 6px rgba(0,0,0,0.4); transition: background 0.2s;" onmouseover="this.style.background='#8b0000'" onmouseout="this.style.background='#3e2723'">BACK</button>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 25px; padding: 25px 40px; flex: 1; overflow: hidden; height: calc(100vh - 80px); box-sizing: border-box; background: transparent;">
                
                <div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1); flex-shrink: 0;">
                    <div style="font-family:'Cinzel',serif; font-size:20px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; letter-spacing:2px;">
                        <span>DEPLOYMENT LIST</span>
                        <span style="color:#ffd700; font-size:16px;"><span id="party-count-val">0</span> / 6</span>
                    </div>
                    <div id="party-slots-container" style="display: flex; justify-content: center; gap: 20px; padding: 25px;"></div>
                </div>
                
                <div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.3); border: 2px solid #5d4037; border-radius: 2px; box-shadow: inset 0 0 10px rgba(93,64,55,0.1); flex: 1; overflow: hidden;">
                    <div style="font-family:'Cinzel',serif; font-size:20px; font-weight:bold; color:#ebd9b4; background:#5d4037; padding:12px 20px; text-align:left; letter-spacing:2px; flex-shrink:0;">STANDBY LIST</div>
                    <div id="party-roster-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; padding: 25px; overflow-y: auto; align-content: start;"></div>
                </div>

            </div>
        `;
        
        // ⭐ 버튼 이벤트 리스너 세팅
        const handleModalClose = (e) => {
            if(e) { e.preventDefault(); e.stopPropagation(); }
            modal.style.display = 'none';
            if (document.getElementById('scene-battle-prep') && document.getElementById('scene-battle-prep').classList.contains('active')) {
                if (this.game.syncPrepParty) this.game.syncPrepParty();
                if (this.game.renderPrepUI) this.game.renderPrepUI();
            }
        };

        modal.querySelector('#btn-party-real-close').onclick = handleModalClose;
        modal.querySelector('#btn-party-to-hero').onclick = (e) => {
            handleModalClose(e);
            if(this.game.heroManager) this.game.heroManager.openUI();
        };
        modal.querySelector('#btn-party-to-skill').onclick = (e) => {
            handleModalClose(e);
            if(this.game.skillManager) this.game.skillManager.openUI();
        };
    }

    renderPartyUI() {
        const slotsContainer = document.getElementById('party-slots-container');
        const rosterContainer = document.getElementById('party-roster-list');
        const countDisplay = document.getElementById('party-count-val');

        if (!slotsContainer || !rosterContainer) return;

        slotsContainer.innerHTML = '';
        rosterContainer.innerHTML = '';

        let currentPartyCount = 0;

        const getHeroInfoHtml = (h) => {
            return `
                <div style="font-weight:bold; font-size:16px; color:#8b0000; text-align:center; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${h.name}</div>
                <div style="font-size:12px; color:#555; text-align:center; font-weight:bold;">Lv.${h.level}</div>
                <div style="font-size:12px; color:#5d4037; text-align:center; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this._getClassString(h)}</div>
            `;
        };

        for (let i = 0; i < 6; i++) {
            const hero = this.game.gameState.heroes[i];
            const slot = document.createElement('div');
            
            slot.ondragover = (e) => { e.preventDefault(); slot.style.borderColor = '#8b0000'; slot.style.transform = 'scale(1.05)'; };
            slot.ondragleave = (e) => { slot.style.borderColor = '#5d4037'; slot.style.transform = 'scale(1)'; };
            slot.ondrop = (e) => { e.preventDefault(); slot.style.borderColor = '#5d4037'; slot.style.transform = 'scale(1)'; this.handlePartyDrop(e, i); };

            if (hero) {
                currentPartyCount++;
                slot.draggable = true;
                slot.ondragstart = (e) => this.handlePartyDragStart(e, 'party', i);

                const portraitSrc = PORTRAIT_DATA[hero.classKey || hero.key];
                // ⭐ object-position: center 적용
                const iconHtml = portraitSrc 
                    ? `<img src="${portraitSrc}" style="width:100%; aspect-ratio:1/1; object-fit:cover; object-position:center; display:block;" />` 
                    : `<div style="width:100%; aspect-ratio:1/1; background:#ebd9b4; display:flex; align-items:center; justify-content:center; font-size:60px;">${hero.icon}</div>`;

                slot.style.cssText = 'width: 180px; background: #fff; border: 3px solid #5d4037; border-radius: 2px; cursor: pointer; transition: 0.2s; position: relative; box-shadow: 2px 4px 8px rgba(0,0,0,0.2); display:flex; flex-direction:column; overflow:hidden;';
                slot.innerHTML = `
                    ${iconHtml}
                    <div style="padding: 10px; background: #f4ebd8; border-top: 2px solid #5d4037;">
                        ${getHeroInfoHtml(hero)}
                    </div>
                    <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(139,0,0,0.8); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px; opacity:0; transition:0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">✖ 해제</div>
                `;
                
                slot.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.removeFromParty(i); };
            } else {
                slot.style.cssText = 'width: 180px; aspect-ratio: 180/265; background: rgba(255,255,255,0.4); border: 3px dashed #d4bc96; border-radius: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: rgba(93,64,55,0.5); font-weight: bold; font-family: var(--font-game); cursor: pointer;';
                slot.innerHTML = `<div style="font-size:50px; opacity:0.3; margin-bottom:10px;">➕</div><div>EMPTY SLOT</div>`;
            }
            slotsContainer.appendChild(slot);
        }
        
        if (countDisplay) countDisplay.innerText = currentPartyCount;

        for (let i = 6; i < this.game.gameState.heroes.length; i++) {
            const hero = this.game.gameState.heroes[i];
            if (!hero) continue;

            const card = document.createElement('div');
            card.draggable = true;
            card.ondragstart = (e) => this.handlePartyDragStart(e, 'roster', i);

            const portraitSrc = PORTRAIT_DATA[hero.classKey || hero.key];
            // ⭐ object-position: center 적용
            const iconHtml = portraitSrc 
                ? `<img src="${portraitSrc}" style="width:100%; aspect-ratio:1/1; object-fit:cover; object-position:center; display:block;" />` 
                : `<div style="width:100%; aspect-ratio:1/1; background:#ebd9b4; display:flex; align-items:center; justify-content:center; font-size:50px;">${hero.icon}</div>`;

            card.style.cssText = 'background: #fff; border: 2px solid #5d4037; border-radius: 2px; cursor: pointer; transition: 0.2s; box-shadow: 1px 2px 5px rgba(0,0,0,0.1); display:flex; flex-direction:column; overflow:hidden; position:relative;';
            card.onmouseover = () => { card.style.borderColor = '#8b0000'; card.style.transform = 'scale(1.05)'; };
            card.onmouseout = () => { card.style.borderColor = '#5d4037'; card.style.transform = 'scale(1)'; };

            card.innerHTML = `
                ${iconHtml}
                <div style="padding: 10px; background: #f4ebd8; border-top: 1px solid #5d4037;">
                    ${getHeroInfoHtml(hero)}
                </div>
            `;
            
            card.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.addToParty(i); };
            rosterContainer.appendChild(card);
        }
    }

    handlePartyDragStart(e, type, index) {
        e.dataTransfer.setData("type", type);
        e.dataTransfer.setData("index", index);
    }

    handlePartyDrop(e, targetSlotIdx) {
        const type = e.dataTransfer.getData("type");
        const sourceIdx = parseInt(e.dataTransfer.getData("index"));

        if (isNaN(sourceIdx)) return;

        if (type === 'roster') {
            this.addToParty(sourceIdx, targetSlotIdx);
        } else if (type === 'party') {
            if (sourceIdx === targetSlotIdx) return;
            const temp = this.game.gameState.heroes[targetSlotIdx];
            this.game.gameState.heroes[targetSlotIdx] = this.game.gameState.heroes[sourceIdx];
            this.game.gameState.heroes[sourceIdx] = temp;
            this.renderPartyUI(); 
        }
    }

    removeFromParty(partyIndex) {
        if (!this.game.gameState.heroes || !this.game.gameState.heroes[partyIndex]) return;
        const hero = this.game.gameState.heroes[partyIndex];
        this.game.gameState.heroes[partyIndex] = null;
        this.game.gameState.heroes.push(hero);

        const partySlots = this.game.gameState.heroes.slice(0, 6);
        const rosterSlots = this.game.gameState.heroes.slice(6).filter(h => h !== null);
        this.game.gameState.heroes = [...partySlots, ...rosterSlots];
        
        this.game.saveGame();
        this.renderPartyUI();
    }

    addToParty(rosterIndex, targetSlot = -1) {
        const hero = this.game.gameState.heroes[rosterIndex];
        if (!hero) return;

        if (targetSlot !== -1) {
            const existing = this.game.gameState.heroes[targetSlot];
            this.game.gameState.heroes[targetSlot] = hero;
            if (existing) {
                this.game.gameState.heroes[rosterIndex] = existing; 
            } else {
                this.game.gameState.heroes[rosterIndex] = null; 
            }
        } else {
            let emptySlot = -1;
            for (let i = 0; i < 6; i++) { 
                if (!this.game.gameState.heroes[i]) { emptySlot = i; break; }
            }
            if (emptySlot === -1) {
                this.game.showAlert("파티 슬롯이 꽉 찼습니다. 영웅을 먼저 해제하세요.");
                return;
            }
            this.game.gameState.heroes[emptySlot] = hero;
            this.game.gameState.heroes[rosterIndex] = null;
        }

        const party = this.game.gameState.heroes.slice(0, 6);
        const roster = this.game.gameState.heroes.slice(6).filter(h => h !== null);
        this.game.gameState.heroes = [...party, ...roster];

        this.game.saveGame();
        this.renderPartyUI(); 
    }
}