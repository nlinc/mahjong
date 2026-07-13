import { SUITS, HANDS_CARD, CARD_CATEGORIES, analyzeHandStrengths } from './engine.js';

// DOM selectors
export const elements = {
    lobbyScreen: document.getElementById('lobby-screen'),
    roomLobbyScreen: document.getElementById('room-lobby-screen'),
    gameScreen: document.getElementById('game-screen'),
    
    // Buttons
    btnSinglePlayer: document.getElementById('btn-single-player'),
    btnMultiplayerLobby: document.getElementById('btn-multiplayer-lobby'),
    btnBackToSolo: document.getElementById('btn-back-to-solo'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnLeaveLobby: document.getElementById('btn-leave-lobby'),
    btnStartGame: document.getElementById('btn-start-game'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnViewCard: document.getElementById('btn-view-card'),
    btnViewGuideGame: document.getElementById('btn-view-guide-game'),
    btnOpenGuideLobby: document.getElementById('btn-open-guide-lobby'),
    btnMenu: document.getElementById('btn-menu'),
    btnRestartGame: document.getElementById('btn-restart-game'),
    btnLeaveGame: document.getElementById('btn-leave-game'),
    btnCloseMenu: document.getElementById('btnCloseMenu'),
    
    // Game Inputs
    inputRoomId: document.getElementById('input-room-id'),
    chkFillBots: document.getElementById('chk-fill-bots'),
    
    // Labels & Lists
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    lobbyPlayerCount: document.getElementById('lobby-player-count'),
    lobbyPlayersList: document.getElementById('lobby-players-list'),
    lblGamePhase: document.getElementById('lbl-game-phase'),
    lblWallCount: document.getElementById('lbl-wall-count'),
    lblRoomIdDisplay: document.getElementById('lbl-room-id-display'),
    turnInstruction: document.getElementById('turn-instruction'),
    
    // Overlays
    charlestonOverlay: document.getElementById('charleston-overlay'),
    cardOverlay: document.getElementById('card-overlay'),
    guideOverlay: document.getElementById('guide-overlay'),
    menuOverlay: document.getElementById('menu-overlay'),
    claimConsole: document.getElementById('claim-console'),
    gameToast: document.getElementById('game-toast'),
    
    // Board Containers
    discardRiver: document.getElementById('discard-river'),
    playerTileRack: document.getElementById('player-tile-rack'),
    myExposuresRow: document.getElementById('my-exposures-row'),
    
    // Claim console specifics
    claimTileDisplay: document.getElementById('claim-tile-display'),
    btnClaimPung: document.getElementById('btn-claim-pung'),
    btnClaimKong: document.getElementById('btn-claim-kong'),
    btnClaimQuint: document.getElementById('btn-claim-quint'),
    btnClaimMahjong: document.getElementById('btn-claim-mahjong'),
    btnClaimPass: document.getElementById('btn-claim-pass'),
    
    // Charleston specifics
    charStepTitle: document.getElementById('char-step-title'),
    charInstructions: document.getElementById('char-instructions'),
    charSelectCount: document.getElementById('char-select-count'),
    charSelectedTilesContainer: document.getElementById('char-selected-tiles-container'),
    btnCharlestonConfirm: document.getElementById('btn-charleston-confirm'),
    btnCharlestonStop: document.getElementById('btn-charleston-stop'),
    
    // Card specifics
    cardScrollView: document.getElementById('card-scroll-view'),

    // Co-pilot
    btnToggleCopilot: document.getElementById('btn-toggle-copilot'),
    coPilotPanel: document.getElementById('co-pilot-panel'),
    coPilotSuggestions: document.getElementById('co-pilot-suggestions')
};

// Map of Unicode tile representations for display
export const TILE_UNICODE = {
    [SUITS.FLOWERS]: '🌸',
    [SUITS.JOKERS]: '🃏',
    [SUITS.DOTS]: { 1: '🀙', 2: '🀚', 3: '🀛', 4: '🀜', 5: '🀝', 6: '🀞', 7: '🀟', 8: '🀠', 9: '🀡' },
    [SUITS.BAMS]: { 1: '🀐', 2: '🀑', 3: '🀒', 4: '🀓', 5: '🀔', 6: '🀕', 7: '🀖', 8: '🀗', 9: '🀘' },
    [SUITS.CRAKES]: { 1: '🀇', 2: '🀈', 3: '🀉', 4: '🀊', 5: '🀋', 6: '🀌', 7: '🀍', 8: '🀎', 9: '🀏' },
    [SUITS.WINDS]: { 'E': '🀀', 'S': '🀁', 'W': '🀂', 'N': '🀃' },
    [SUITS.DRAGONS]: { 'G': '🀅', 'R': '🀄', 'W': '🀆' }
};

export function getTileChar(suit, val) {
    if (suit === SUITS.FLOWERS) return TILE_UNICODE[SUITS.FLOWERS];
    if (suit === SUITS.JOKERS) return TILE_UNICODE[SUITS.JOKERS];
    return TILE_UNICODE[suit][val] || '🀄';
}

// Show active screen
export function switchScreen(targetScreen) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    targetScreen.classList.add('active');
}

// Show/Hide Overlays
export function toggleOverlay(overlay, forceShow = null) {
    if (forceShow === true) {
        overlay.classList.remove('hidden');
    } else if (forceShow === false) {
        overlay.classList.add('hidden');
    } else {
        overlay.classList.toggle('hidden');
    }
}

// Toast message
let toastTimeout;
export function showToast(message) {
    elements.gameToast.textContent = message;
    elements.gameToast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        elements.gameToast.classList.add('hidden');
    }, 2500);
}

// Render Player Rack
export function renderPlayerRack(hand, selectedId, onTileSelect, onTileDblClick) {
    elements.playerTileRack.innerHTML = '';
    
    hand.forEach(tile => {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile';
        if (tile.id === selectedId) {
            tileEl.classList.add('selected');
        }
        tileEl.setAttribute('data-id', tile.id);
        tileEl.setAttribute('data-suit', tile.suit);
        tileEl.setAttribute('data-val', tile.val);
        tileEl.textContent = getTileChar(tile.suit, tile.val);
        
        tileEl.addEventListener('click', () => {
            onTileSelect(tile.id);
        });
        
        tileEl.addEventListener('dblclick', () => {
            onTileDblClick(tile.id);
        });
        
        elements.playerTileRack.appendChild(tileEl);
    });
}

// Render Discard River
export function renderDiscardRiver(discards) {
    elements.discardRiver.innerHTML = '';
    
    if (discards.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'river-placeholder';
        placeholder.textContent = 'Discarded tiles will appear here';
        elements.discardRiver.appendChild(placeholder);
        return;
    }
    
    discards.forEach((tile, index) => {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile tile-discarded';
        tileEl.setAttribute('data-suit', tile.suit);
        tileEl.setAttribute('data-val', tile.val);
        tileEl.textContent = getTileChar(tile.suit, tile.val);
        
        // Highlight last discard
        if (index === discards.length - 1) {
            tileEl.classList.add('new-drawn');
            tileEl.style.boxShadow = '0 0 12px var(--accent)';
        }
        
        elements.discardRiver.appendChild(tileEl);
    });
    
    // Auto scroll bottom
    elements.discardRiver.scrollTop = elements.discardRiver.scrollHeight;
}

// Render Opponent Seat
export function renderOpponentSeat(seatIndex, seatDivId, playerState, isActiveTurn) {
    const seatEl = document.getElementById(seatDivId);
    if (!seatEl) return;
    
    const profileName = seatEl.querySelector('.name');
    const profileStatus = seatEl.querySelector('.status-indicator');
    const tileCountBar = seatEl.querySelector('.tile-count-bar');
    const exposuresRow = seatEl.querySelector('.exposed-melds-row');
    
    if (playerState) {
        profileName.textContent = playerState.name;
        profileStatus.textContent = isActiveTurn ? '⭐ Active Turn' : (playerState.active ? 'Ready' : 'Offline');
        
        const count = playerState.handCount || 13;
        tileCountBar.textContent = `${count} Tiles`;
        
        // Render exposures
        exposuresRow.innerHTML = '';
        if (playerState.exposures && playerState.exposures.length > 0) {
            playerState.exposures.forEach(meld => {
                const groupEl = document.createElement('div');
                groupEl.style.display = 'flex';
                groupEl.style.gap = '2px';
                groupEl.style.marginRight = '8px';
                meld.forEach(tile => {
                    const tileEl = document.createElement('div');
                    tileEl.className = 'tile tile-exposed';
                    tileEl.setAttribute('data-suit', tile.suit);
                    tileEl.setAttribute('data-val', tile.val);
                    tileEl.textContent = getTileChar(tile.suit, tile.val);
                    groupEl.appendChild(tileEl);
                });
                exposuresRow.appendChild(groupEl);
            });
        }
    } else {
        profileName.textContent = 'Empty Slot';
        profileStatus.textContent = 'Waiting...';
        tileCountBar.textContent = '0 Tiles';
        exposuresRow.innerHTML = '';
    }
}

// Render Player Exposures
export function renderMyExposures(exposures) {
    elements.myExposuresRow.innerHTML = '';
    if (!exposures || exposures.length === 0) return;
    
    exposures.forEach(meld => {
        const groupEl = document.createElement('div');
        groupEl.style.display = 'flex';
        groupEl.style.gap = '3px';
        groupEl.style.marginRight = '12px';
        
        meld.forEach(tile => {
            const tileEl = document.createElement('div');
            tileEl.className = 'tile tile-exposed';
            tileEl.setAttribute('data-suit', tile.suit);
            tileEl.setAttribute('data-val', tile.val);
            tileEl.textContent = getTileChar(tile.suit, tile.val);
            groupEl.appendChild(tileEl);
        });
        elements.myExposuresRow.appendChild(groupEl);
    });
}

// Render Claim Prompt
export function renderClaimPrompt(discardTile, discardPlayerName, claims, onClaimSelected) {
    if (claims.length === 0) {
        elements.claimConsole.classList.add('hidden');
        return;
    }
    
    elements.claimTileDisplay.textContent = getTileChar(discardTile.suit, discardTile.val);
    elements.claimConsole.querySelector('.claim-tile-announcement').innerHTML = 
        `${discardPlayerName} discarded: <span id="claim-tile-display" data-suit="${discardTile.suit}">${getTileChar(discardTile.suit, discardTile.val)}</span>`;
    
    // Toggle action buttons
    elements.btnClaimPung.classList.toggle('hidden', !claims.includes('pung'));
    elements.btnClaimKong.classList.toggle('hidden', !claims.includes('kong'));
    elements.btnClaimQuint.classList.toggle('hidden', !claims.includes('quint'));
    elements.btnClaimMahjong.classList.toggle('hidden', !claims.includes('mahjong'));
    
    // Setup listeners
    const triggerClaim = (type) => {
        elements.claimConsole.classList.add('hidden');
        onClaimSelected(type);
    };
    
    elements.btnClaimPung.onclick = () => triggerClaim('pung');
    elements.btnClaimKong.onclick = () => triggerClaim('kong');
    elements.btnClaimQuint.onclick = () => triggerClaim('quint');
    elements.btnClaimMahjong.onclick = () => triggerClaim('mahjong');
    elements.btnClaimPass.onclick = () => triggerClaim('pass');
    
    elements.claimConsole.classList.remove('hidden');
}

// Render Charleston overlay
export function renderCharlestonStep(step, selectedTiles, onTileRemove, onConfirm) {
    const stepNames = [
        "First Pass: Right ➡️",
        "First Pass: Across ⬆️",
        "First Pass: Left ⬅️",
        "Second Pass: Left ⬅️",
        "Second Pass: Across ⬆️",
        "Second Pass: Right ➡️",
        "Courtesy Pass 🤝"
    ];
    
    elements.charStepTitle.textContent = stepNames[step] || "Charleston Passing";
    elements.charSelectCount.textContent = selectedTiles.length;
    
    elements.charSelectedTilesContainer.innerHTML = '';
    
    for (let i = 0; i < 3; i++) {
        const slotEl = document.createElement('div');
        if (selectedTiles[i]) {
            slotEl.className = 'tile';
            slotEl.setAttribute('data-suit', selectedTiles[i].suit);
            slotEl.setAttribute('data-val', selectedTiles[i].val);
            slotEl.textContent = getTileChar(selectedTiles[i].suit, selectedTiles[i].val);
            slotEl.addEventListener('click', () => {
                onTileRemove(selectedTiles[i].id);
            });
        } else {
            slotEl.className = 'tile-placeholder';
            slotEl.textContent = 'Select';
        }
        elements.charSelectedTilesContainer.appendChild(slotEl);
    }
    
    elements.btnCharlestonConfirm.disabled = selectedTiles.length < 3;
    elements.btnCharlestonConfirm.onclick = onConfirm;
    
    // Show stop button after the first round (after step 3, before step 4)
    // In our index, step 3 is left. Before starting step 4, we could stop.
    // We will handle option to stop in app logic
}

let latestHandStrengths = []; // Cache of the latest analysis

// Setup Card Catalog viewer
export function initCardReference() {
    const tabs = document.querySelectorAll('.card-viewer-modal .tab-btn');
    
    const loadCategory = (cat) => {
        tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-category') === cat));
        elements.cardScrollView.innerHTML = '';
        
        const hands = HANDS_CARD[cat] || [];
        if (hands.length === 0) {
            elements.cardScrollView.innerHTML = '<p class="small-text">No hands defined for this category.</p>';
            return;
        }
        
        hands.forEach(h => {
            const row = document.createElement('div');
            row.className = 'hand-card-row';
            
            // Find current match percentage if available
            const strength = latestHandStrengths.find(s => s.id === h.id);
            const pctText = strength ? `<div class="card-match-pct${strength.percentage >= 50 ? ' high' : ''}">${strength.percentage}% Match</div>` : '';

            row.innerHTML = `
                <div class="hand-pattern">${h.display}</div>
                <div class="hand-details">
                    <span>${h.desc}</span>
                    <span class="expose-badge">${h.isConcealed ? 'C' : 'X'}</span>
                </div>
                ${pctText}
            `;
            elements.cardScrollView.appendChild(row);
        });
    };
    
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            loadCategory(btn.getAttribute('data-category'));
        });
    });
    
    // Default load first
    loadCategory('consec');
}

export function renderCoPilotSuggestions(hand) {
    if (!hand || hand.length === 0) return;
    if (!elements.coPilotSuggestions) {
        console.warn("Co-pilot suggestions container not found in DOM.");
        return;
    }
    
    // Analyze hand strengths
    latestHandStrengths = analyzeHandStrengths(hand);
    
    // Render top 3 suggestions in the Co-pilot panel
    elements.coPilotSuggestions.innerHTML = '';
    
    // Display top 3
    const top3 = latestHandStrengths.slice(0, 3);
    top3.forEach(item => {
        const isHigh = item.percentage >= 50;
        const card = document.createElement('div');
        card.className = `copilot-suggestion-card${isHigh ? ' high-match' : ''}`;
        
        let catText = item.category.toUpperCase().replace('_', ' ');
        if (catText.startsWith('NUM ')) catText = catText.replace('NUM ', '');

        card.innerHTML = `
            <div class="copilot-pattern" title="${item.desc}">${item.display}</div>
            <div class="copilot-info">
                <span>${catText}</span>
                <span class="copilot-pct">${item.percentage}%</span>
            </div>
        `;
        
        card.addEventListener('click', () => {
            toggleOverlay(elements.cardOverlay, true);
            const tabBtn = document.querySelector(`.card-viewer-modal .tab-btn[data-category="${item.category}"]`);
            if (tabBtn) {
                tabBtn.click();
                // Ensure the category tab is scrolled into view in horizontal list
                tabBtn.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        });
        
        elements.coPilotSuggestions.appendChild(card);
    });
}
export function setupMenuOverlay(onRestart, onLeave) {
    elements.btnRestartGame.onclick = () => {
        toggleOverlay(elements.menuOverlay, false);
        onRestart();
    };
    elements.btnLeaveGame.onclick = () => {
        toggleOverlay(elements.menuOverlay, false);
        onLeave();
    };
    
    elements.btnMenu.onclick = () => toggleOverlay(elements.menuOverlay, true);
    
    // Ensure button with ID btn-close-menu works, wait, the HTML says id="btn-close-menu", but JS has elements.btnCloseMenu
    const closeBtn = document.getElementById('btn-close-menu');
    if (closeBtn) {
        closeBtn.onclick = () => toggleOverlay(elements.menuOverlay, false);
    }
}
export function setupGuideOverlay() {
    elements.btnViewGuideGame.onclick = () => toggleOverlay(elements.guideOverlay, true);
    elements.btnOpenGuideLobby.onclick = () => toggleOverlay(elements.guideOverlay, true);
    document.getElementById('btn-close-guide').onclick = () => toggleOverlay(elements.guideOverlay, false);
}
export function setupCardOverlay() {
    elements.btnViewCard.onclick = () => toggleOverlay(elements.cardOverlay, true);
    document.getElementById('btn-close-card').onclick = () => toggleOverlay(elements.cardOverlay, false);
    initCardReference();
}
