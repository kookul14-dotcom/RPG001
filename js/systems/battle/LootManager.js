export class LootManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        this.META_LOOT_TABLES = {
            "BOX_STAGE_1": { "LOOT_POTION": 50, "LOOT_BOMB": 30, "LOOT_TIER_1": 20 },
            "BOX_STAGE_2": { "LOOT_TIER_1": 30, "LOOT_TIER_2": 20, "LOOT_SCROLL": 30, "LOOT_POTION": 20 },
            "BOX_STAGE_3": { "LOOT_TIER_2": 50, "LOOT_TIER_3": 20, "LOOT_SCROLL": 20, "LOOT_BOMB": 10 },
            "BOX_SUPPLY": { "LOOT_POTION": 60, "LOOT_BOMB": 40 },
            "BOX_EQUIP_ONLY": { "LOOT_TIER_1": 40, "LOOT_TIER_2": 50, "LOOT_TIER_3": 10 },
            "BOX_GAMBLE": { "LOOT_TIER_3": 15, "LOOT_SCROLL": 25, "LOOT_TIER_1": 60 },
            "BOX_BOSS_MID": { "LOOT_TIER_2": 80, "LOOT_SCROLL": 20 },
            "BOX_BOSS_FINAL": { "LOOT_TIER_2": 40, "LOOT_TIER_3": 60 }
        };
    }

    getLootTable(tierKey) {
        const table = [];
        const allItems = this.battle.gameApp.itemData || {}; 
        Object.values(allItems).forEach(item => {
            if (item.lootTier === tierKey) {
                table.push({ id: item.id, weight: Number(item.lootWeight) || 1000, grade: item.grade || 'COMMON' });
            }
        });
        return table;
    }

    rollLoot(tierKey, unit) {
        if (this.META_LOOT_TABLES[tierKey]) {
            const metaGroup = this.META_LOOT_TABLES[tierKey];
            let totalMetaWeight = 0;
            for (let key in metaGroup) totalMetaWeight += metaGroup[key];
            let randomVal = Math.floor(Math.random() * totalMetaWeight);
            let selectedTier = null;
            for (let key in metaGroup) {
                randomVal -= metaGroup[key];
                if (randomVal < 0) { selectedTier = key; break; }
            }
            return this.rollLoot(selectedTier, unit);
        }

        const table = this.getLootTable(tierKey);
        if (table.length === 0) return null; 

        const luk = (unit && unit.luk) ? unit.luk : 0;
        const gradeBonus = { 'COMMON': 0, 'UNCOMMON': 5, 'RARE': 20, 'EPIC': 50, 'LEGENDARY': 100 };

        let totalWeight = 0;
        const weightedPool = table.map(entry => {
            const bonusMult = gradeBonus[entry.grade] || 0;
            const finalWeight = entry.weight + (luk * bonusMult);
            totalWeight += finalWeight;
            return { ...entry, finalWeight: finalWeight };
        });

        let itemRand = Math.floor(Math.random() * totalWeight);
        for (const entry of weightedPool) {
            itemRand -= entry.finalWeight;
            if (itemRand < 0) return entry.id; 
        }
        return weightedPool[weightedPool.length - 1].id; 
    }

    lootItem(itemId, sourceUnit) {
        const inventory = this.battle.gameApp.gameState.inventory;
        if (!inventory) this.battle.gameApp.gameState.inventory = [];
        
        let emptyIdx = inventory.findIndex(id => id === null || id === undefined);
        if (emptyIdx === -1 && inventory.length < 20) {
            emptyIdx = inventory.length;
        }

        const textTarget = sourceUnit || this.battle.currentUnit;

        if (emptyIdx !== -1 && emptyIdx < 20) {
            inventory[emptyIdx] = itemId;
            const itemInfo = this.battle.gameApp.itemData[itemId] || { name: itemId };
            
            if (textTarget) this.battle.showFloatingText(textTarget, `📦 ${itemInfo.name}`, '#ffdd00');
            this.battle.log(`획득: ${itemInfo.name} (인벤토리 저장됨)`, 'log-item');
            
            this.battle.gameApp.saveGame();
        } else {
            if (textTarget) this.battle.showFloatingText(textTarget, `가방 꽉 참!`, '#888');
            this.battle.log(`인벤토리가 가득 차서 아이템을 획득하지 못했습니다.`, 'log-bad');
        }
    }
}