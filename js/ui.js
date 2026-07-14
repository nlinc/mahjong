import { SUITS, HANDS_CARD, CARD_CATEGORIES, analyzeHandStrengths, saveCustomHand, deleteCustomHand } from './engine.js?v=8';

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
    btnSortSuit: document.getElementById('btn-sort-suit'),
    btnSortValue: document.getElementById('btn-sort-value'),
    btnRackDiscard: document.getElementById('btn-rack-discard'),
    btnDeclareMahjong: document.getElementById('btn-declare-mahjong'),
    btnRestartGame: document.getElementById('btn-restart-game'),
    btnLeaveGame: document.getElementById('btn-leave-game'),
    btnCloseMenu: document.getElementById('btn-close-menu'),
    joinRoomForm: document.getElementById('join-room-form'),
    
    // Game Inputs
    inputRoomId: document.getElementById('input-room-id'),
    inputPlayerName: document.getElementById('input-player-name'),
    chkFillBots: document.getElementById('chk-fill-bots'),
    multiplayerPanels: document.getElementById('multiplayer-panels'),
    
    // Labels & Lists
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    lobbyPlayerCount: document.getElementById('lobby-player-count'),
    lobbyPlayersList: document.getElementById('lobby-players-list'),
    lobbyMessage: document.getElementById('lobby-message'),
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
    return getTileLabel(suit, val);
}

function getTileLabel(suit, val) {
    const suitNames = { dots: 'Dot', bams: 'Bam', crakes: 'Crak', winds: 'Wind', dragons: 'Dragon' };
    if (suit === SUITS.FLOWERS) return 'Flower';
    if (suit === SUITS.JOKERS) return 'Joker';
    return `${val} ${suitNames[suit] || suit}`;
}

function getTileFaceMarkup(suit, val) {
    const safeVal = String(val);
    if (suit === SUITS.DOTS) {
        const pips = Array.from({ length: Number(val) }, (_, index) => `<i class="pip pip-${index % 3}"></i>`).join('');
        return `<span class="tile-corner">${safeVal}</span><span class="tile-pips count-${safeVal}">${pips}</span>`;
    }
    if (suit === SUITS.BAMS) {
        const sticks = Array.from({ length: Number(val) }, (_, index) => `<i class="bam bam-${index % 2}"></i>`).join('');
        return `<span class="tile-corner">${safeVal}</span><span class="tile-bams count-${safeVal}">${sticks}</span>`;
    }
    if (suit === SUITS.CRAKES) {
        return `<span class="tile-corner">${safeVal}</span><span class="tile-glyph crak-glyph">萬</span>`;
    }
    if (suit === SUITS.WINDS) {
        return `<span class="tile-glyph wind-glyph">${safeVal}</span><span class="tile-caption">WIND</span>`;
    }
    if (suit === SUITS.DRAGONS) {
        const glyph = { G: '發', R: '中', W: '白' }[val] || safeVal;
        return `<span class="tile-glyph dragon-glyph">${glyph}</span><span class="tile-caption">DRAGON</span>`;
    }
    if (suit === SUITS.FLOWERS) {
        return '<span class="tile-glyph flower-glyph">✿</span><span class="tile-caption">FLOWER</span>';
    }
    return '<span class="tile-glyph joker-glyph">★</span><span class="tile-caption">JOKER</span>';
}

function setTileFace(element, tile) {
    element.setAttribute('data-suit', tile.suit);
    element.setAttribute('data-val', tile.val);
    element.innerHTML = getTileFaceMarkup(tile.suit, tile.val);
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
        const tileEl = document.createElement('button');
        tileEl.type = 'button';
        tileEl.className = 'tile';
        if (tile.id === selectedId) {
            tileEl.classList.add('selected');
        }
        tileEl.setAttribute('data-id', tile.id);
        setTileFace(tileEl, tile);
        tileEl.setAttribute('aria-label', getTileLabel(tile.suit, tile.val));
        tileEl.setAttribute('aria-pressed', String(tile.id === selectedId));
        
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
        setTileFace(tileEl, tile);
        
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
                    setTileFace(tileEl, tile);
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
            setTileFace(tileEl, tile);
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
    
    const announcement = elements.claimConsole.querySelector('.claim-tile-announcement');
    announcement.textContent = `${discardPlayerName} discarded:`;
    const tileDisplay = document.createElement('span');
    tileDisplay.id = 'claim-tile-display';
    tileDisplay.className = 'tile claim-tile-face';
    setTileFace(tileDisplay, discardTile);
    announcement.appendChild(tileDisplay);
    
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
    
    const directionNames = ['right', 'across', 'left', 'left', 'across', 'right'];
    elements.charStepTitle.textContent = stepNames[step] || "Charleston Passing";
    elements.charInstructions.textContent = `Select 3 tiles from your rack to pass ${directionNames[step] || 'across'}.`;
    elements.charSelectCount.textContent = selectedTiles.length;
    
    elements.charSelectedTilesContainer.innerHTML = '';
    
    for (let i = 0; i < 3; i++) {
        let slotEl;
        if (selectedTiles[i]) {
            slotEl = document.createElement('button');
            slotEl.type = 'button';
            slotEl.className = 'tile';
            setTileFace(slotEl, selectedTiles[i]);
            slotEl.setAttribute('aria-label', `Remove ${getTileLabel(selectedTiles[i].suit, selectedTiles[i].val)} from pass`);
            slotEl.addEventListener('click', () => {
                onTileRemove(selectedTiles[i].id);
            });
        } else {
            slotEl = document.createElement('div');
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

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
}

// Setup Card Catalog viewer
export function initCardReference() {
    const tabs = document.querySelectorAll('.card-viewer-modal .tab-btn');

    const updateHandCount = () => {
        const count = Object.entries(HANDS_CARD)
            .filter(([category]) => category !== CARD_CATEGORIES.CUSTOM)
            .reduce((sum, [, hands]) => sum + hands.length, 0);
        const countEl = document.getElementById('practice-hand-count');
        if (countEl) countEl.textContent = String(count);
    };

    const renderCustomEditor = () => {
        const editor = document.createElement('section');
        editor.className = 'custom-card-editor';
        editor.innerHTML = `
            <div class="custom-editor-heading">
                <div><h3>Add a hand from your card</h3><p>Saved privately on this device and used by the co-pilot and Mahjong checker.</p></div>
                <span class="custom-count">${HANDS_CARD[CARD_CATEGORIES.CUSTOM].length} saved</span>
            </div>
            <form id="custom-hand-form">
                <label for="custom-hand-name">Hand name or card section</label>
                <input id="custom-hand-name" maxlength="60" placeholder="Example: Consecutive run #1">
                <label for="custom-hand-pattern">14-tile pattern</label>
                <input id="custom-hand-pattern" autocapitalize="characters" autocomplete="off" placeholder="FF 1111A 2222B 3333C" required>
                <div class="notation-help"><strong>How:</strong> Repeat each tile, then add A/B/C for numbered suits. Use F for Flowers; E/S/W/N for winds; R/G/0 for Red/Green/White Dragons.</div>
                <label class="custom-concealed"><input id="custom-hand-concealed" type="checkbox"> Concealed hand</label>
                <p id="custom-hand-error" class="custom-hand-error" role="alert"></p>
                <button class="btn btn-primary btn-sm" type="submit">Save Hand</button>
            </form>`;
        elements.cardScrollView.appendChild(editor);

        editor.querySelector('#custom-hand-form').addEventListener('submit', event => {
            event.preventDefault();
            const error = editor.querySelector('#custom-hand-error');
            try {
                saveCustomHand({
                    name: editor.querySelector('#custom-hand-name').value,
                    pattern: editor.querySelector('#custom-hand-pattern').value,
                    isConcealed: editor.querySelector('#custom-hand-concealed').checked
                });
                loadCategory(CARD_CATEGORIES.CUSTOM);
            } catch (err) {
                error.textContent = err.message;
            }
        });
    };
    
    const loadCategory = (cat) => {
        tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-category') === cat));
        elements.cardScrollView.innerHTML = '';
        elements.cardScrollView.scrollTop = 0;

        if (cat === CARD_CATEGORIES.CUSTOM) renderCustomEditor();
        
        const hands = HANDS_CARD[cat] || [];
        if (hands.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'small-text custom-empty';
            empty.textContent = cat === CARD_CATEGORIES.CUSTOM ? 'No custom hands yet. Add the first one above.' : 'No hands defined for this category.';
            elements.cardScrollView.appendChild(empty);
            return;
        }
        
        hands.forEach(h => {
            const row = document.createElement('div');
            row.className = 'hand-card-row';
            
            // Find current match percentage if available
            const strength = latestHandStrengths.find(s => s.id === h.id);
            const pctText = strength ? `<div class="card-match-pct${strength.percentage >= 50 ? ' high' : ''}">${strength.percentage}% Match</div>` : '';

            row.innerHTML = `
                <div class="hand-pattern">${escapeHtml(h.display)}</div>
                <div class="hand-details">
                    <span>${escapeHtml(h.desc)}</span>
                    <span class="expose-badge">${h.isConcealed ? 'C' : 'X'}</span>
                </div>
                ${pctText}
            `;
            if (h.isCustom) {
                const remove = document.createElement('button');
                remove.className = 'btn-delete-hand';
                remove.type = 'button';
                remove.textContent = 'Delete';
                remove.setAttribute('aria-label', `Delete ${h.desc}`);
                remove.addEventListener('click', () => {
                    deleteCustomHand(h.id);
                    loadCategory(CARD_CATEGORIES.CUSTOM);
                });
                row.appendChild(remove);
            }
            elements.cardScrollView.appendChild(row);
        });
    };
    
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            loadCategory(btn.getAttribute('data-category'));
        });
    });
    
    // Default load first
    updateHandCount();
    loadCategory('consec');
}

export function renderCoPilotSuggestions(hand, exposures = []) {
    if (!hand || hand.length === 0) return;
    if (!elements.coPilotSuggestions) {
        console.warn("Co-pilot suggestions container not found in DOM.");
        return;
    }
    
    // Analyze hand strengths
    latestHandStrengths = analyzeHandStrengths(hand, exposures);
    
    // Render top 3 suggestions in the Co-pilot panel
    elements.coPilotSuggestions.innerHTML = '';
    const header = elements.coPilotPanel.querySelector('.co-pilot-header');
    const exposedCount = exposures.flat().length;
    if (header) header.textContent = exposedCount
        ? `🔒 Committed: only patterns compatible with ${exposures.length} exposed meld${exposures.length === 1 ? '' : 's'}`
        : '💡 Mahjong Co-pilot Suggestions';
    
    // Display top 3
    const top3 = latestHandStrengths.slice(0, 3);
    if (!top3.length) {
        const warning = document.createElement('p');
        warning.className = 'copilot-no-match';
        warning.textContent = 'No card patterns are compatible with the exposed tiles. This meld may be invalid.';
        elements.coPilotSuggestions.appendChild(warning);
        return;
    }
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
    
    if (elements.btnCloseMenu) {
        elements.btnCloseMenu.onclick = () => toggleOverlay(elements.menuOverlay, false);
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
