// ========== Recall Flow Pro (무제한 버전) ==========
// Recall Flow Pro - 공통 데이터 및 함수

// 덱 관리
const DeckManager = {
    // 현재 활성 덱 가져오기
    getCurrentDeck() {
        return localStorage.getItem('currentDeck') || 'default';
    },
    
    // 현재 덱 설정
    setCurrentDeck(deckName) {
        localStorage.setItem('currentDeck', deckName);
    },
    
    // 모든 덱 목록 가져오기
    getAllDecks() {
        const decksJson = localStorage.getItem('deckList');
        if (decksJson) {
            return JSON.parse(decksJson);
        }
        const defaultDecks = [{
            name: 'default',
            displayName: '기본 덱',
            createdAt: new Date().toISOString()
        }];
        this.saveDecks(defaultDecks);
        return defaultDecks;
    },
    
    saveDecks(decks) {
        localStorage.setItem('deckList', JSON.stringify(decks));
    },
    
    createDeck(displayName) {
        const decks = this.getAllDecks();
        const name = 'deck_' + Date.now();
        
        decks.push({
            name: name,
            displayName: displayName,
            createdAt: new Date().toISOString()
        });
        
        this.saveDecks(decks);
        
        const emptyData = RecallFlow.getDefaultData();
        localStorage.setItem('recallFlowData_' + name, JSON.stringify(emptyData));
        
        return name;
    },
    
    deleteDeck(deckName) {
        if (deckName === 'default') {
            return { success: false, message: '기본 덱은 삭제할 수 없습니다.' };
        }
        
        const decks = this.getAllDecks();
        const filtered = decks.filter(d => d.name !== deckName);
        
        if (filtered.length === decks.length) {
            return { success: false, message: '덱을 찾을 수 없습니다.' };
        }
        
        this.saveDecks(filtered);
        localStorage.removeItem('recallFlowData_' + deckName);
        
        if (this.getCurrentDeck() === deckName) {
            this.setCurrentDeck('default');
        }
        
        return { success: true };
    },
    
    renameDeck(deckName, newDisplayName) {
        const decks = this.getAllDecks();
        const deck = decks.find(d => d.name === deckName);
        
        if (!deck) {
            return { success: false, message: '덱을 찾을 수 없습니다.' };
        }
        
        deck.displayName = newDisplayName;
        this.saveDecks(decks);
        
        return { success: true };
    },
    
    getDeckInfo(deckName) {
        const decks = this.getAllDecks();
        return decks.find(d => d.name === deckName);
    },
    
    getDeckStats(deckName) {
        const key = deckName === 'default' ? 'recallFlowData' : 'recallFlowData_' + deckName;
        const saved = localStorage.getItem(key);
        
        if (!saved) {
            return {
                totalCards: 0,
                backlog: 0,
                studying: 0,
                mastered: 0
            };
        }
        
        try {
            const data = JSON.parse(saved);
            return {
                totalCards: (data.backlog?.length || 0) + 
                           (data.currentStudy?.length || 0) +
                           (data.stage1?.length || 0) +
                           (data.stage2?.length || 0) +
                           (data.stage3?.length || 0) +
                           (data.box1?.length || 0) +
                           (data.box2?.length || 0) +
                           (data.box3?.length || 0) +
                           (data.box4?.length || 0) +
                           (data.mastered?.length || 0),
                backlog: data.backlog?.length || 0,
                studying: (data.currentStudy?.length || 0) +
                         (data.stage1?.length || 0) +
                         (data.stage2?.length || 0) +
                         (data.stage3?.length || 0) +
                         (data.box1?.length || 0) +
                         (data.box2?.length || 0) +
                         (data.box3?.length || 0) +
                         (data.box4?.length || 0),
                mastered: data.mastered?.length || 0
            };
        } catch (e) {
            return {
                totalCards: 0,
                backlog: 0,
                studying: 0,
                mastered: 0
            };
        }
    }
};

// 시스템 상태 (localStorage와 동기화)
const RecallFlow = {
    loadData() {
        const currentDeck = DeckManager.getCurrentDeck();
        const key = currentDeck === 'default' ? 'recallFlowData' : 'recallFlowData_' + currentDeck;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('데이터 로드 실패:', e);
                return this.getDefaultData();
            }
        }
        return this.getDefaultData();
    },

    getDefaultData() {
        return {
            backlog: [],
            currentStudy: [],
            stage1: [],
            stage2: [],
            stage3: [],
            box1: [],
            box2: [],
            box3: [],
            box4: [],
            mastered: [],
            settings: {
                box1Size: 300,
                box2Size: 900,
                box3Size: 1800,
                box4Size: 3500
            }
        };
    },

    saveData(data) {
        const currentDeck = DeckManager.getCurrentDeck();
        const key = currentDeck === 'default' ? 'recallFlowData' : 'recallFlowData_' + currentDeck;
        localStorage.setItem(key, JSON.stringify(data));
    },

    resetAll() {
        if (confirm('정말로 모든 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            const currentDeck = DeckManager.getCurrentDeck();
            const key = currentDeck === 'default' ? 'recallFlowData' : 'recallFlowData_' + currentDeck;
            localStorage.removeItem(key);
            localStorage.removeItem('licenseDevice');
            alert('✅ 모든 데이터가 초기화되었습니다!');
            return true;
        }
        return false;
    },

    getStats(data) {
        return {
            backlogCount: data.backlog.length,
            currentStudyCount: data.currentStudy.length,
            stage1Count: data.stage1.length,
            stage2Count: data.stage2.length,
            stage3Count: data.stage3.length,
            box1Count: data.box1.length,
            box2Count: data.box2.length,
            box3Count: data.box3.length,
            box4Count: data.box4.length,
            masteredCount: data.mastered.length,
            totalCards: data.backlog.length +
