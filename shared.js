// ========== Recall Flow (무료 버전 - 덱 3개, 카드 10,000개 제한) ==========
// Recall Flow - 공통 데이터 및 함수

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
        // 기본 덱 생성 및 저장
        const defaultDecks = [{
            name: 'default',
            displayName: '기본 덱',
            createdAt: new Date().toISOString()
        }];
        this.saveDecks(defaultDecks);
        return defaultDecks;
    },
    
    // 덱 목록 저장
    saveDecks(decks) {
        localStorage.setItem('deckList', JSON.stringify(decks));
    },
    
    // 새 덱 생성
    createDeck(displayName) {
        const decks = this.getAllDecks();
        
        // 무료 버전 제한 확인
        const restrictions = License.getRestrictions();
        if (decks.length >= restrictions.maxDecks) {
            alert(`무료 버전은 최대 ${restrictions.maxDecks}개의 덱을 만들 수 있습니다.\n\n💎 기부 라이선스로 무제한 덱을 사용하세요!`);
            return null;
        }
        
        const name = 'deck_' + Date.now();
        
        decks.push({
            name: name,
            displayName: displayName,
            createdAt: new Date().toISOString()
        });
        
        this.saveDecks(decks);
        
        // 새 덱의 빈 데이터 생성
        const emptyData = RecallFlow.getDefaultData();
        localStorage.setItem('recallFlowData_' + name, JSON.stringify(emptyData));
        
        return name;
    },
    
    // 덱 삭제
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
        
        // 현재 덱이 삭제된 경우 기본 덱으로 전환
        if (this.getCurrentDeck() === deckName) {
            this.setCurrentDeck('default');
        }
        
        return { success: true };
    },
    
    // 덱 순서 변경
    reorderDeck(deckName, direction) {
        const decks = this.getAllDecks();
        const index = decks.findIndex(d => d.name === deckName);
        if (index === -1) return false;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= decks.length) return false;
        
        [decks[index], decks[newIndex]] = [decks[newIndex], decks[index]];
        this.saveDecks(decks);
        return true;
    },

    // 덱 순서 직접 저장 (드래그앤드롭용)
    saveReorderedDecks(newOrder) {
        const decks = this.getAllDecks();
        const reordered = newOrder.map(name => decks.find(d => d.name === name)).filter(Boolean);
        // 빠진 덱이 있으면 뒤에 추가
        decks.forEach(d => {
            if (!reordered.find(r => r.name === d.name)) reordered.push(d);
        });
        this.saveDecks(reordered);
    },

    // 덱 이름 변경
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
    
    // 덱 정보 가져오기
    getDeckInfo(deckName) {
        const decks = this.getAllDecks();
        return decks.find(d => d.name === deckName);
    },
    
    // 덱 통계 가져오기
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
    // 데이터 로드 (현재 덱 기준)
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

    // 기본 데이터 구조
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

    // 데이터 저장 (현재 덱 기준)
    saveData(data) {
        // 무료 버전 카드 제한 확인
        const restrictions = License.getRestrictions();
        if (!restrictions.isDonor) {
            const totalCards = this.getStats(data).totalCards;
            if (totalCards > restrictions.maxCards) {
                alert(`무료 버전은 최대 ${restrictions.maxCards.toLocaleString()}개의 카드를 추가할 수 있습니다.\n\n현재: ${totalCards.toLocaleString()}개\n\n💎 기부 라이선스로 무제한 카드를 사용하세요!`);
                return false;
            }
        }
        
        const currentDeck = DeckManager.getCurrentDeck();
        const key = currentDeck === 'default' ? 'recallFlowData' : 'recallFlowData_' + currentDeck;
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    },

    // 전체 초기화 (현재 덱만)
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

    // 통계 계산
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
            totalCards: data.backlog.length + data.currentStudy.length + 
                       data.stage1.length + data.stage2.length + data.stage3.length +
                       data.box1.length + data.box2.length + data.box3.length + 
                       data.box4.length + data.mastered.length
        };
    }
};

// 라이선스 관리
const License = {
    // 유효한 라이선스 키 목록
    validKeys: [
        '매일하겠습니다',  // 무료 버전 키 (제한)
        '고맙습니다',      // 기부자용 키 (무제한)
    ],
    
    // 무료 버전 제한 확인
    getRestrictions() {
        const licenseInfo = this.getLicenseInfo();
        const hasValidLicense = licenseInfo.hasLicense && this.validateKey(licenseInfo.licenseKey);
        
        // "고맙습니다" 키는 무제한
        if (hasValidLicense && licenseInfo.licenseKey === '고맙습니다') {
            return {
                maxDecks: Infinity,
                maxCards: Infinity,
                isDonor: true
            };
        } else {
            // "매일하겠습니다" 또는 기타 = 제한
            return {
                maxDecks: 3,
                maxCards: 10000,
                isDonor: false
            };
        }
    },
    
    // 라이선스 키 검증 (한글 키)
    validateKey(key) {
        if (!key || typeof key !== 'string') return false;
        return this.validKeys.includes(key.trim());
    },
    
    // 라이선스 정보 가져오기
    getLicenseInfo() {
        const licenseKey = localStorage.getItem('licenseKey');
        const deviceId = localStorage.getItem('licenseDevice');
        const activatedAt = localStorage.getItem('licenseActivatedAt');
        
        return {
            hasLicense: !!licenseKey,
            licenseKey: licenseKey,
            deviceId: deviceId,
            activatedAt: activatedAt
        };
    },
    
    // 라이선스 활성화 (Pro 버전 - 간단)
    activate(key) {
        if (!this.validateKey(key)) {
            return { 
                success: false, 
                message: '유효하지 않은 라이선스 키입니다.' 
            };
        }
        
        const deviceId = this.getDeviceId();
        
        localStorage.setItem('licenseKey', key.trim());
        localStorage.setItem('licenseDevice', deviceId);
        localStorage.setItem('licenseActivatedAt', new Date().toISOString());
        
        return { 
            success: true, 
            message: '라이선스가 활성화되었습니다!' 
        };
    },
    
    
    // 기기 고유 ID 생성
    getDeviceId() {
        // 더 안정적인 fingerprint (시간과 무관한 값만 사용)
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
            navigator.hardwareConcurrency || 'unknown',
            navigator.platform
        ].join('|');
        
        return btoa(fingerprint);
    },

    // 라이선스 체크 (Pro 버전 - 기기 무제한)
    check() {
        const licenseInfo = this.getLicenseInfo();
        
        // 라이선스 키가 없으면
        if (!licenseInfo.hasLicense) {
            return { 
                valid: false, 
                reason: '라이선스 키가 등록되지 않았습니다.',
                needActivation: true 
            };
        }
        
        // 라이선스 키 검증
        if (!this.validateKey(licenseInfo.licenseKey)) {
            return { 
                valid: false, 
                reason: '유효하지 않은 라이선스 키입니다.',
                needActivation: true 
            };
        }
        
        // 기기 체크 (정보만 기록, 차단 안 함)
        const currentDeviceId = this.getDeviceId();
        const isDifferentDevice = licenseInfo.deviceId !== currentDeviceId;
        
        return { 
            valid: true,
            isDifferentDevice: isDifferentDevice
        };
    },

    // 라이선스 정보 가져오기 (상세)
    getInfo() {
        const info = this.getLicenseInfo();
        
        return {
            licenseKey: info.licenseKey || null,
            fullKey: info.licenseKey,
            deviceId: this.getDeviceId(),
            registeredDevice: info.deviceId,
            activatedAt: info.activatedAt,
            isRegistered: info.hasLicense,
            isValid: this.check().valid
        };
    },
    

    // 라이선스 해제
    deactivate() {
        if (confirm('이 컴퓨터의 라이선스를 해제하시겠습니까?\n\n해제 후 다른 컴퓨터에서 같은 키로 등록할 수 있습니다.')) {
            localStorage.removeItem('licenseKey');
            localStorage.removeItem('licenseDevice');
            localStorage.removeItem('licenseActivatedAt');
            alert('라이선스가 해제되었습니다.');
            return true;
        }
        return false;
    }
};

// 페이지 시작 시 라이선스 자동 체크
function checkLicenseOnLoad() {
    // 개발/테스트 모드: 라이선스 체크 건너뛰기
    // 실제 배포 시 이 줄을 삭제하세요
    // return true;
    
    const result = License.check();
    
    if (!result.valid) {
        // 라이선스 키 입력 필요
        if (result.needActivation) {
            showLicenseActivation();
            return false;
        }
        
        // 다른 기기 오류
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px;">
                    <h1 style="color: #f56565; margin-bottom: 20px;">⚠️ 라이선스 오류</h1>
                    <p style="font-size: 18px; color: #2d3748; margin-bottom: 20px;">
                        이 프로그램은 다른 컴퓨터에서 등록되었습니다.
                    </p>
                    <p style="color: #718096;">
                        ${result.reason}
                    </p>
                    <a href="license.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">
                        라이선스 관리
                    </a>
                </div>
            </div>
        `;
        return false;
    }
    
    return true;
}

// 라이선스 활성화 화면
function showLicenseActivation() {
    // License 객체를 전역으로 보존
    window.LicenseBackup = License;
    
    // 활성화 함수를 미리 전역으로 정의
    window.activateLicense = function() {
        const input = document.getElementById('license-key-input');
        const key = input ? input.value.trim() : '';
        const message = document.getElementById('activation-message');
        
        if (!key) {
            showMessage('라이선스 키를 입력하세요.', 'error');
            return;
        }
        
        try {
            const License = window.LicenseBackup;
            const result = License.activate(key);
            
            if (result.success) {
                showMessage(result.message + ' 페이지를 새로고침합니다...', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                showMessage(result.message, 'error');
            }
        } catch (e) {
            showMessage('오류: ' + e.message, 'error');
            console.error(e);
        }
    };
    
    window.showMessage = function(text, type) {
        const message = document.getElementById('activation-message');
        if (message) {
            message.style.display = 'block';
            
            if (type === 'success') {
                message.style.background = '#c6f6d5';
                message.style.color = '#22543d';
            } else if (type === 'error') {
                message.style.background = '#fed7d7';
                message.style.color = '#742a2a';
            } else if (type === 'info') {
                message.style.background = '#bee3f8';
                message.style.color = '#2c5282';
            }
            
            message.textContent = text;
        }
    };
    
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
            <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; width: 100%;">
                <h1 style="margin-bottom: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    ⚡ Recall Flow
                </h1>
                <h2 style="color: #2d3748; margin-bottom: 30px;">라이선스 활성화</h2>
                
                <p style="color: #718096; margin-bottom: 20px; text-align: left;">
                    라이선스 키를 입력하세요.
                </p>
                
                <input 
                    type="text" 
                    id="license-key-input" 
                    placeholder="TRY-YYMMDD-XXXX"
                    style="width: 100%; padding: 15px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; text-align: center; text-transform: uppercase; font-family: monospace; margin-bottom: 20px;"
                    maxlength="16"
                />
                
                <button 
                    id="activate-btn"
                    style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 10px;"
                >
                    활성화
                </button>
                
                <div id="activation-message" style="margin-top: 20px; padding: 15px; border-radius: 8px; display: none;"></div>
            </div>
        </div>
    `;
    
    // DOM이 준비된 후 이벤트 리스너 추가
    setTimeout(() => {
        const btn = document.getElementById('activate-btn');
        const input = document.getElementById('license-key-input');
        
        if (btn) {
            btn.addEventListener('click', window.activateLicense);
        }
        
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    window.activateLicense();
                }
            });
            input.focus();
        }
    }, 100);
}

// 네비게이션 바 생성
function createNavbar(activePage) {
    const pages = [
        { name: 'index', label: '🏠', url: 'index.html' },
        { name: 'study', label: '📖', url: 'study.html' },
        { name: 'boxes', label: '📦', url: 'boxes.html' },
        { name: 'backlog', label: '📚', url: 'backlog.html' },
        { name: 'decks', label: '🗂️', url: 'decks.html' },
        { name: 'settings', label: '⚙️', url: 'settings.html' },
        { name: 'license', label: '🔑', url: 'license.html' }
    ];

    const currentDeck = DeckManager.getCurrentDeck();
    const deckInfo = DeckManager.getDeckInfo(currentDeck);
    const allDecks = DeckManager.getAllDecks();

    const navbar = document.createElement('div');
    navbar.className = 'navbar';
    
    navbar.innerHTML = `
        <div class="navbar-brand">⚡ Recall Flow</div>
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <select id="deck-selector" onchange="switchDeck(this.value)" style="padding: 6px 12px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 14px; cursor: pointer; max-width: 150px;">
                    ${allDecks.map(deck => `
                        <option value="${deck.name}" ${deck.name === currentDeck ? 'selected' : ''}>
                            ${deck.displayName}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="navbar-menu">
                ${pages.map(page => `
                    <a href="${page.url}" class="nav-link ${activePage === page.name ? 'active' : ''}" title="${getPageTitle(page.name)}">
                        ${page.label}
                    </a>
                `).join('')}
            </div>
        </div>
    `;
    
    return navbar;
}

// 페이지 제목 가져오기 (tooltip용)
function getPageTitle(pageName) {
    const titles = {
        'index': '메인',
        'study': '학습',
        'boxes': '상자',
        'backlog': '대기풀',
        'decks': '덱 관리',
        'settings': '설정',
        'license': '라이선스'
    };
    return titles[pageName] || '';
}

// 덱 전환 함수
function switchDeck(deckName) {
    DeckManager.setCurrentDeck(deckName);
    location.reload();
}


// 주기적 라이선스 체크 (60초마다)
setInterval(() => {
    const result = License.check();
    if (!result.valid) {
        alert('⚠️ 라이선스 오류: 프로그램이 종료됩니다.');
        window.location.href = 'license.html';
    }
}, 60000);
