/* Main application coordinator. Game state is canonical and shared by solo and multiplayer. */
import {
    createWall, shuffle, sortHandBySuit, sortHandByValue,
    checkDiscardClaims, checkMahjong, buildClaimMeld, undoLastClaim, isValidCharlestonPass,
    exchangeExposedJoker, SUITS
} from './engine.js?v=13';
import { botSelectCharlestonPass, botSelectDiscard, botDecideClaim } from './bot.js?v=13';
import {
    elements, switchScreen, toggleOverlay, showToast, renderPlayerRack,
    renderDiscardRiver, renderOpponentSeat, renderMyExposures, renderClaimPrompt,
    renderCharlestonStep, setupMenuOverlay, setupGuideOverlay, setupCardOverlay,
    getTileChar, renderCoPilotSuggestions, renderRoundResult, showCardPattern
} from './ui.js?v=18';
import {
    createRoom, joinRoom, subscribeToRoom, updateRoom, mutateRoom, leaveRoom, initFirebase
} from './firebase.js?v=10';

const appState = {
    mode: 'solo',
    roomId: null,
    playerIndex: 0,
    playerName: 'Player 1',
    players: [],
    wall: [],
    hands: [[], [], [], []],
    exposures: [[], [], [], []],
    discards: [],
    currentTurn: 0,
    activeDiscard: null,
    claimWindow: null,
    lastClaimUndo: null,
    canExchangeJoker: false,
    winnerMessage: null,
    roundResult: null,
    gamePhase: 'setup',
    charlestonStep: 0,
    charlestonPasses: [null, null, null, null],
    selectedTileId: null,
    unsubscribe: null
};

let myCharlestonSelections = [];
let charlestonPassPending = false;
let botTimer = null;
let drawingRoomTile = false;

initApp();

async function initApp() {
    await initFirebase();
    assertRequiredElements();
    setupUIEvents();
    setupGuideOverlay();
    setupCardOverlay();
    setupMenuOverlay(restartLocalGame, exitToMainLobby);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker unavailable:', error));
    }
}

function assertRequiredElements() {
    const missing = Object.entries(elements).filter(([, element]) => !element).map(([name]) => name);
    if (missing.length) throw new Error(`Missing required UI elements: ${missing.join(', ')}`);
}

function setupUIEvents() {
    elements.btnSinglePlayer.addEventListener('click', startSoloGame);
    elements.btnMultiplayerLobby.addEventListener('click', () => {
        elements.multiplayerPanels.classList.remove('hidden');
        elements.btnSinglePlayer.classList.add('hidden');
        elements.btnMultiplayerLobby.classList.add('hidden');
    });
    elements.btnBackToSolo.addEventListener('click', closeMultiplayerPanel);
    elements.btnCreateRoom.addEventListener('click', handleCreateRoom);
    elements.joinRoomForm.addEventListener('submit', event => {
        event.preventDefault();
        handleJoinRoom();
    });
    elements.btnLeaveLobby.addEventListener('click', handleLeaveLobby);
    elements.btnStartGame.addEventListener('click', handleStartGame);
    elements.chkFillBots.addEventListener('change', refreshLobbyStartButton);
    elements.btnCopyCode.addEventListener('click', copyRoomLink);

    elements.btnSortSuit.addEventListener('click', () => sortMyHand(sortHandBySuit));
    elements.btnSortValue.addEventListener('click', () => sortMyHand(sortHandByValue));
    elements.btnToggleCopilot.addEventListener('click', toggleCoPilot);
    elements.btnRackDiscard.addEventListener('click', handleManualDiscard);
    elements.btnUndoClaim.addEventListener('click', handleUndoClaim);
    elements.btnDeclareMahjong.addEventListener('click', handleDeclareMahjong);
    elements.btnCharlestonStop.addEventListener('click', finishCharlestonEarly);

    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) {
        elements.btnMultiplayerLobby.click();
        elements.inputRoomId.value = roomParam.toUpperCase();
        showLobbyMessage(`Room ${roomParam.toUpperCase()} is ready. Enter your name, then confirm to join.`);
        elements.inputPlayerName.focus();
    }
}

function showLobbyMessage(message, type = 'info') {
    elements.lobbyMessage.textContent = message;
    elements.lobbyMessage.className = `lobby-message ${type}`;
}

function closeMultiplayerPanel() {
    elements.multiplayerPanels.classList.add('hidden');
    elements.btnSinglePlayer.classList.remove('hidden');
    elements.btnMultiplayerLobby.classList.remove('hidden');
}

function startSoloGame() {
    appState.mode = 'solo';
    appState.roomId = null;
    appState.playerIndex = 0;
    appState.players = [
        { id: 'p1', name: 'You', seat: 0, isBot: false, isHost: true, active: true },
        { id: 'p2', name: 'Bot 2 🤖', seat: 1, isBot: true, active: true },
        { id: 'p3', name: 'Bot 3 🤖', seat: 2, isBot: true, active: true },
        { id: 'p4', name: 'Bot 4 🤖', seat: 3, isBot: true, active: true }
    ];
    Object.assign(appState, createFreshGameState());
    appState.gamePhase = 'charleston';
    switchScreen(elements.gameScreen);
    renderGame();
}

function createFreshGameState() {
    const wall = shuffle(createWall());
    const hands = [[], [], [], []];
    for (let round = 0; round < 13; round++) {
        for (let seat = 0; seat < 4; seat++) hands[seat].push(wall.pop());
    }
    hands[0].push(wall.pop());
    hands[0] = sortHandBySuit(hands[0]);
    return {
        wall,
        hands,
        exposures: [[], [], [], []],
        discards: [],
        currentTurn: 0,
        activeDiscard: null,
        claimWindow: null,
        lastClaimUndo: null,
        canExchangeJoker: false,
        winnerMessage: null,
        roundResult: null,
        charlestonStep: 0,
        charlestonPasses: [null, null, null, null],
        selectedTileId: null
    };
}

function myHand() { return appState.hands[appState.playerIndex] || []; }
function myExposures() { return appState.exposures[appState.playerIndex] || []; }
function exposureCount(exposures) { return (exposures || []).flat().length; }
function effectiveCount(state, seat) { return state.hands[seat].length + exposureCount(state.exposures[seat]); }
function nextSeat(seat) { return (seat + 1) % 4; }
function seatDistance(from, to) { return (to - from + 4) % 4; }

function renderGame() {
    elements.lblRoomIdDisplay.textContent = appState.mode === 'solo' ? 'Local Game' : `Room: ${appState.roomId}`;
    elements.lblGamePhase.textContent = `Phase: ${appState.gamePhase.toUpperCase()}`;
    elements.lblWallCount.textContent = `Wall: ${appState.wall.length}`;
    renderDiscardRiver(appState.discards);
    updateRackUI();
    updateOpponentsUI();

    if (appState.gamePhase === 'charleston') renderCharleston();
    else {
        document.body.classList.remove('charleston-active');
        toggleOverlay(elements.charlestonOverlay, false);
        renderTurnState();
    }
    const fallbackResult = appState.gamePhase === 'gameover' && appState.winnerMessage
        ? { type: appState.winnerMessage.startsWith('Draw') ? 'draw' : 'win', message: appState.winnerMessage }
        : null;
    const result = appState.roundResult || fallbackResult;
    const winnerSeat = Number.isInteger(result?.winnerSeat) ? result.winnerSeat : null;
    renderRoundResult(
        result,
        winnerSeat == null ? null : appState.hands[winnerSeat],
        winnerSeat == null ? [] : appState.exposures[winnerSeat],
        appState.mode === 'solo' || Boolean(appState.players[appState.playerIndex]?.isHost),
        {
            onNewRound: startNextRound,
            onViewCard: () => showCardPattern(result?.patternCategory, result?.patternId),
            onLobby: exitToMainLobby
        }
    );
}

function makeWinResult(state, seat, players, match, message = null) {
    const winnerName = players[seat]?.name || `Player ${seat + 1}`;
    return {
        type: 'win',
        winnerSeat: seat,
        winnerName,
        message: message || `${winnerName} completed Mahjong with ${state.hands[seat].length} concealed tile${state.hands[seat].length === 1 ? '' : 's'} and ${state.exposures[seat].length} exposed meld${state.exposures[seat].length === 1 ? '' : 's'}.`,
        patternId: match?.handInfo?.id || null,
        patternDisplay: match?.handInfo?.display || null,
        patternDescription: match?.handInfo?.desc || null,
        patternCategory: match?.handInfo?.category || null
    };
}

function makeDrawResult(message = 'The wall is empty. No player completed Mahjong.') {
    return { type: 'draw', message };
}

function winnerAnnouncement(name) {
    return name === 'You' ? 'You win with Mahjong!' : `${name} wins with Mahjong!`;
}

function updateRackUI() {
    renderPlayerRack(myHand(), appState.selectedTileId, handleTileSelect, handleTileDoubleClick);
    renderMyExposures(myExposures(), jokerExchangeOptions(appState.playerIndex));
    if (!elements.coPilotPanel.classList.contains('hidden')) renderCoPilotSuggestions(myHand(), myExposures());
}

function updateOpponentsUI() {
    const relativeSeats = [
        { relative: 1, id: 'seat-right' },
        { relative: 2, id: 'seat-top' },
        { relative: 3, id: 'seat-left' }
    ];
    for (const { relative, id } of relativeSeats) {
        const seat = (appState.playerIndex + relative) % 4;
        const player = appState.players[seat];
        const view = player ? {
            ...player,
            handCount: effectiveCount(appState, seat),
            exposures: appState.exposures[seat]
        } : null;
        renderOpponentSeat(
            seat,
            id,
            view,
            appState.currentTurn === seat && appState.gamePhase === 'playing',
            jokerExchangeOptions(seat)
        );
    }
}

function canExchangeJokerNow() {
    return appState.gamePhase === 'playing' && !appState.claimWindow &&
        appState.currentTurn === appState.playerIndex && appState.canExchangeJoker &&
        effectiveCount(appState, appState.playerIndex) === 14;
}

function jokerExchangeOptions(targetSeat) {
    if (!canExchangeJokerNow()) return null;
    return {
        targetSeat,
        playerHand: myHand(),
        onExchange: handleJokerExchange
    };
}

function hasAvailableJokerExchange() {
    if (!canExchangeJokerNow()) return false;
    return appState.exposures.some(melds => (melds || []).some(meld => {
        const required = meld.find(tile => tile.suit !== SUITS.JOKERS);
        return required && meld.some(tile => tile.suit === SUITS.JOKERS) &&
            myHand().some(tile => tile.suit === required.suit && tile.val === required.val);
    }));
}

async function handleJokerExchange(targetSeat, meldIndex, jokerTileId) {
    const seat = appState.playerIndex;
    if (!canExchangeJokerNow()) return showToast('Draw or complete a call before exchanging a Joker.');

    if (appState.mode === 'solo') {
        const exchange = exchangeExposedJoker(appState, seat, targetSeat, meldIndex, jokerTileId);
        if (!exchange) return showToast('That Joker can no longer be exchanged.');
        appState.selectedTileId = null;
        showToast(`Exchanged ${getTileChar(exchange.natural.suit, exchange.natural.val)} for a Joker.`);
        renderGame();
        return;
    }

    try {
        await mutateRoom(appState.roomId, room => {
            if (room.status !== 'playing') throw new Error('The round is no longer active.');
            const exchange = exchangeExposedJoker(room.gameState, seat, targetSeat, meldIndex, jokerTileId);
            if (!exchange) throw new Error('That Joker can no longer be exchanged.');
            return room;
        });
        appState.selectedTileId = null;
        updateActionButtons();
        showToast('Joker exchanged into your rack.');
    } catch (error) {
        showToast(error.message || 'Could not exchange the Joker.');
    }
}

function toggleCoPilot() {
    const hidden = elements.coPilotPanel.classList.toggle('hidden');
    elements.btnToggleCopilot.classList.toggle('active', !hidden);
    if (!hidden) renderCoPilotSuggestions(myHand(), myExposures());
}

function sortMyHand(sorter) {
    appState.hands[appState.playerIndex] = sorter(myHand());
    updateRackUI();
}

function handleTileSelect(tileId) {
    if (appState.gamePhase === 'charleston') {
        if (charlestonPassPending || isValidCharlestonPass(appState.charlestonPasses?.[appState.playerIndex])) return;
        const tile = myHand().find(item => item.id === tileId);
        if (!tile) return;
        if (tile.suit === SUITS.JOKERS) return showToast('Jokers cannot be passed in the Charleston.');
        const selectedIndex = myCharlestonSelections.findIndex(item => item.id === tileId);
        if (selectedIndex >= 0) myCharlestonSelections.splice(selectedIndex, 1);
        else if (myCharlestonSelections.length < 3) myCharlestonSelections.push(tile);
        else showToast('You can only pass 3 tiles.');
        renderCharleston();
        return;
    }

    if (appState.gamePhase !== 'playing' || appState.currentTurn !== appState.playerIndex || appState.claimWindow) return;
    appState.selectedTileId = appState.selectedTileId === tileId ? null : tileId;
    updateRackUI();
    updateActionButtons();
}

function handleTileDoubleClick(tileId) {
    if (appState.gamePhase !== 'playing' || appState.currentTurn !== appState.playerIndex || appState.claimWindow) return;
    appState.selectedTileId = tileId;
    handleManualDiscard();
}

/* Charleston */
function renderCharleston() {
    document.body.classList.add('charleston-active');
    toggleOverlay(elements.charlestonOverlay, true);
    const alreadySubmitted = isValidCharlestonPass(appState.charlestonPasses?.[appState.playerIndex]);
    renderCharlestonStep(
        appState.charlestonStep,
        myCharlestonSelections,
        tileId => {
            myCharlestonSelections = myCharlestonSelections.filter(tile => tile.id !== tileId);
            renderCharleston();
        },
        handleConfirmCharlestonPass
    );
    elements.btnCharlestonConfirm.disabled = charlestonPassPending || alreadySubmitted || myCharlestonSelections.length !== 3;
    elements.btnCharlestonConfirm.textContent = charlestonPassPending
        ? 'Submitting…'
        : alreadySubmitted ? 'Waiting for players…' : 'Confirm Pass';
    elements.btnCharlestonStop.classList.toggle('hidden', appState.charlestonStep !== 3);
    elements.btnCharlestonStop.textContent = 'Skip Optional Second Charleston';
    updateRackUI();
}

function passSourceFor(seat, step) {
    const offsets = [3, 2, 1, 1, 2, 3];
    return (seat + offsets[step]) % 4;
}

function resolveCharlestonPasses(state) {
    if (!Array.isArray(state.charlestonPasses) || !state.charlestonPasses.every(isValidCharlestonPass)) {
        throw new Error('All players must submit exactly 3 tiles before the pass can resolve.');
    }
    const passes = state.charlestonPasses.map((ids, seat) => ids.map(id => state.hands[seat].find(tile => tile.id === id)));
    if (passes.some(pass => pass.some(tile => !tile || tile.suit === SUITS.JOKERS))) throw new Error('Invalid Charleston pass.');
    for (let seat = 0; seat < 4; seat++) {
        const ids = new Set(state.charlestonPasses[seat]);
        state.hands[seat] = state.hands[seat].filter(tile => !ids.has(tile.id));
    }
    for (let seat = 0; seat < 4; seat++) state.hands[seat].push(...passes[passSourceFor(seat, state.charlestonStep)]);
    state.hands.forEach((hand, seat) => { state.hands[seat] = sortHandBySuit(hand); });
    state.charlestonStep++;
    state.charlestonPasses = [null, null, null, null];
}

async function handleConfirmCharlestonPass() {
    if (charlestonPassPending || myCharlestonSelections.length !== 3) return;
    const selectedIds = myCharlestonSelections.map(tile => tile.id);

    if (appState.mode === 'solo') {
        myCharlestonSelections = [];
        appState.charlestonPasses[0] = selectedIds;
        for (let seat = 1; seat < 4; seat++) appState.charlestonPasses[seat] = botSelectCharlestonPass(appState.hands[seat]).map(tile => tile.id);
        resolveCharlestonPasses(appState);
        if (appState.charlestonStep >= 6) concludeCharleston(appState);
        renderGame();
        return;
    }

    const submittedStep = appState.charlestonStep;
    charlestonPassPending = true;
    renderCharleston();
    try {
        const updatedRoom = await mutateRoom(appState.roomId, room => {
            if (room.status !== 'charleston') return room;
            const state = room.gameState;
            if (state.charlestonStep !== submittedStep) return room;
            state.charlestonPasses = [0, 1, 2, 3].map(seat =>
                isValidCharlestonPass(state.charlestonPasses?.[seat]) ? state.charlestonPasses[seat] : null
            );
            if (isValidCharlestonPass(state.charlestonPasses[appState.playerIndex])) return room;
            const selectedTiles = selectedIds.map(id => state.hands[appState.playerIndex].find(tile => tile.id === id));
            if (selectedTiles.some(tile => !tile) || selectedTiles.some(tile => tile.suit === SUITS.JOKERS)) {
                throw new Error('Those tiles are no longer available to pass. Select 3 tiles again.');
            }
            state.charlestonPasses[appState.playerIndex] = selectedIds;
            room.players.forEach((player, seat) => {
                if (player.isBot && !isValidCharlestonPass(state.charlestonPasses[seat])) {
                    state.charlestonPasses[seat] = botSelectCharlestonPass(state.hands[seat]).map(tile => tile.id);
                }
            });
            if (state.charlestonPasses.every(isValidCharlestonPass)) {
                resolveCharlestonPasses(state);
                if (state.charlestonStep >= 6) {
                    room.status = 'playing';
                    state.gamePhase = 'playing';
                    state.currentTurn = 0;
                }
            }
            return room;
        });
        const finalState = updatedRoom.gameState;
        const passWasAccepted = updatedRoom.status !== 'charleston' ||
            finalState.charlestonStep > submittedStep ||
            (finalState.charlestonStep === submittedStep &&
                isValidCharlestonPass(finalState.charlestonPasses?.[appState.playerIndex]) &&
                finalState.charlestonPasses[appState.playerIndex].every(id => selectedIds.includes(id)));
        if (!passWasAccepted) throw new Error('The pass did not reach the room. Please try again.');
        myCharlestonSelections = [];
    } catch (error) {
        showToast(error.message || 'Could not submit pass.');
    } finally {
        charlestonPassPending = false;
        if (appState.gamePhase === 'charleston') renderCharleston();
    }
}

async function finishCharlestonEarly() {
    if (appState.charlestonStep !== 3) return;
    myCharlestonSelections = [];
    if (appState.mode === 'solo') {
        concludeCharleston(appState);
        renderGame();
        return;
    }
    await mutateRoom(appState.roomId, room => {
        if (room.status === 'charleston' && room.gameState.charlestonStep === 3) {
            room.status = 'playing';
            room.gameState.gamePhase = 'playing';
            room.gameState.currentTurn = 0;
            room.gameState.charlestonPasses = [null, null, null, null];
            room.gameState.canExchangeJoker = false;
        }
        return room;
    });
}

function concludeCharleston(state) {
    state.gamePhase = 'playing';
    state.currentTurn = 0;
    state.charlestonPasses = [null, null, null, null];
    state.canExchangeJoker = false;
    document.body.classList.remove('charleston-active');
    showToast('Charleston complete. East begins.');
}

/* Draw, discard, claims, and wins */
function renderTurnState() {
    elements.claimConsole.classList.add('hidden');
    if (appState.gamePhase === 'gameover') {
        elements.turnInstruction.textContent = 'Round complete.';
        updateActionButtons();
        return;
    }

    if (appState.claimWindow) {
        const claims = appState.claimWindow.eligible[String(appState.playerIndex)] || [];
        const response = appState.claimWindow.responses[String(appState.playerIndex)];
        if (claims.length && response == null) {
            const discarder = appState.players[appState.claimWindow.discarder]?.name || 'Player';
            renderClaimPrompt(appState.claimWindow.tile, discarder, claims, submitClaimResponse);
            elements.turnInstruction.textContent = 'Choose whether to claim the discard.';
        } else {
            elements.turnInstruction.textContent = 'Waiting for claim responses…';
        }
        updateActionButtons();
        return;
    }

    if (appState.currentTurn === appState.playerIndex) {
        if (effectiveCount(appState, appState.playerIndex) === 13) requestDraw();
        else elements.turnInstruction.textContent = hasAvailableJokerExchange()
            ? 'Discard a tile, or tap a highlighted exposed Joker to exchange.'
            : 'Select a tile from your rack to discard.';
    } else {
        elements.turnInstruction.textContent = `${appState.players[appState.currentTurn]?.name || 'Player'} is thinking…`;
        scheduleBotTurnIfNeeded();
    }
    updateActionButtons();
}

function updateActionButtons() {
    const canAct = appState.gamePhase === 'playing' && !appState.claimWindow && appState.currentTurn === appState.playerIndex;
    elements.btnRackDiscard.disabled = !canAct || appState.selectedTileId == null || effectiveCount(appState, appState.playerIndex) !== 14;
    const canDeclare = canAct && effectiveCount(appState, appState.playerIndex) === 14;
    elements.btnDeclareMahjong.classList.toggle('hidden', !canDeclare);
    const canUndo = canAct && appState.lastClaimUndo?.seat === appState.playerIndex;
    elements.btnUndoClaim.classList.toggle('hidden', !canUndo);
}

async function requestDraw() {
    if (appState.wall.length === 0) {
        if (appState.mode === 'solo') return endRoundLocal('Draw game—the wall is empty.');
        await mutateRoom(appState.roomId, room => {
            room.status = 'ended';
            room.gameState.gamePhase = 'gameover';
            room.gameState.winnerMessage = 'Draw game—the wall is empty.';
            room.gameState.roundResult = makeDrawResult();
            return room;
        });
        return;
    }
    if (appState.mode === 'solo') {
        const tile = appState.wall.pop();
        appState.hands[appState.playerIndex].push(tile);
        appState.canExchangeJoker = true;
        appState.selectedTileId = tile.id;
        appState.hands[appState.playerIndex] = sortHandBySuit(myHand());
        showToast(`Drew ${getTileChar(tile.suit, tile.val)}`);
        renderGame();
        return;
    }
    if (drawingRoomTile) return;
    drawingRoomTile = true;
    try {
        await mutateRoom(appState.roomId, room => {
            const state = room.gameState;
            if (room.status !== 'playing' || state.claimWindow || state.currentTurn !== appState.playerIndex) return room;
            if (effectiveCount(state, appState.playerIndex) !== 13 || !state.wall.length) return room;
            state.hands[appState.playerIndex].push(state.wall.pop());
            state.canExchangeJoker = true;
            return room;
        });
    } finally {
        drawingRoomTile = false;
    }
}

async function handleManualDiscard() {
    const seat = appState.playerIndex;
    if (appState.currentTurn !== seat || appState.claimWindow || effectiveCount(appState, seat) !== 14) return;
    const tileId = appState.selectedTileId;
    if (tileId == null) return;
    appState.selectedTileId = null;

    if (appState.mode === 'solo') {
        applyDiscard(appState, seat, tileId, appState.players);
        renderGame();
        return;
    }
    await mutateRoom(appState.roomId, room => {
        const state = room.gameState;
        if (room.status !== 'playing' || state.currentTurn !== seat || state.claimWindow) return room;
        applyDiscard(state, seat, tileId, room.players);
        if (state.gamePhase === 'gameover') room.status = 'ended';
        return room;
    });
}

function applyDiscard(state, seat, tileId, players) {
    const index = state.hands[seat].findIndex(tile => tile.id === tileId);
    if (index < 0 || effectiveCount(state, seat) !== 14) return false;
    state.lastClaimUndo = null;
    const tile = state.hands[seat].splice(index, 1)[0];
    state.discards.push(tile);
    state.activeDiscard = tile;
    state.canExchangeJoker = false;
    state.claimWindow = buildClaimWindow(state, tile, seat, players);
    if (!state.claimWindow || allClaimsAnswered(state.claimWindow)) resolveClaimWindow(state, players);
    return true;
}

function buildClaimWindow(state, tile, discarder, players) {
    const eligible = {};
    const responses = {};
    for (let seat = 0; seat < 4; seat++) {
        if (seat === discarder) continue;
        const claims = checkDiscardClaims(state.hands[seat], tile, state.exposures[seat]);
        if (!claims.length) continue;
        eligible[String(seat)] = claims;
        responses[String(seat)] = players[seat]?.isBot ? (botDecideClaim(state.hands[seat], tile, claims) || 'pass') : null;
    }
    if (!Object.keys(eligible).length) return null;
    return { tile, discarder, eligible, responses };
}

function allClaimsAnswered(window) {
    return Object.keys(window.eligible).every(seat => window.responses[seat] != null);
}

function resolveClaimWindow(state, players) {
    const window = state.claimWindow;
    if (!window) {
        state.currentTurn = nextSeat(state.currentTurn);
        state.canExchangeJoker = false;
        state.activeDiscard = null;
        return;
    }
    if (!allClaimsAnswered(window)) return;
    const calls = Object.entries(window.responses)
        .filter(([, response]) => response && response !== 'pass')
        .map(([seat, type]) => ({ seat: Number(seat), type }));
    calls.sort((a, b) => {
        if (a.type === 'mahjong' && b.type !== 'mahjong') return -1;
        if (b.type === 'mahjong' && a.type !== 'mahjong') return 1;
        return seatDistance(window.discarder, a.seat) - seatDistance(window.discarder, b.seat);
    });
    if (!calls.length) {
        state.currentTurn = nextSeat(window.discarder);
        state.canExchangeJoker = false;
        state.activeDiscard = null;
        state.claimWindow = null;
        return;
    }
    executeClaim(state, calls[0].seat, calls[0].type, window.tile, players);
}

function executeClaim(state, seat, type, tile, players) {
    if (type === 'mahjong') {
        state.discards.pop();
        state.hands[seat].push(tile);
        const match = checkMahjong(state.hands[seat], state.exposures[seat]);
        state.gamePhase = 'gameover';
        state.winnerMessage = winnerAnnouncement(players[seat].name);
        state.roundResult = makeWinResult(state, seat, players, match);
        state.claimWindow = null;
        state.activeDiscard = null;
        return;
    }

    const hand = state.hands[seat];
    const claim = buildClaimMeld(hand, tile, type);
    if (!claim) {
        state.currentTurn = nextSeat(state.claimWindow.discarder);
        state.canExchangeJoker = false;
        state.claimWindow = null;
        state.activeDiscard = null;
        return;
    }
    state.discards.pop();
    const priorClaimWindow = structuredClone(state.claimWindow);
    const chosenIds = new Set(claim.consumedIds);
    state.hands[seat] = hand.filter(candidate => !chosenIds.has(candidate.id));
    state.exposures[seat].push(claim.meld);
    state.lastClaimUndo = {
        seat,
        type,
        claimedTile: tile,
        consumedTiles: claim.meld.slice(0, -1),
        meldIds: claim.meld.map(candidate => candidate.id),
        exposureIndex: state.exposures[seat].length - 1,
        priorClaimWindow
    };
    state.currentTurn = seat;
    state.canExchangeJoker = true;
    state.claimWindow = null;
    state.activeDiscard = null;
}

async function handleUndoClaim() {
    const seat = appState.playerIndex;
    if (appState.mode === 'solo') {
        if (!undoLastClaim(appState, seat)) return;
        appState.hands[seat] = sortHandBySuit(appState.hands[seat]);
        resolveClaimWindow(appState, appState.players);
        showToast('Call undone. You passed on that discard.');
        renderGame();
        return;
    }
    await mutateRoom(appState.roomId, room => {
        if (!undoLastClaim(room.gameState, seat)) return room;
        room.gameState.hands[seat] = sortHandBySuit(room.gameState.hands[seat]);
        resolveClaimWindow(room.gameState, room.players);
        return room;
    });
    showToast('Call undone. You passed on that discard.');
}

async function submitClaimResponse(type) {
    const seat = appState.playerIndex;
    if (appState.mode === 'solo') {
        const allowed = appState.claimWindow?.eligible[String(seat)] || [];
        appState.claimWindow.responses[String(seat)] = type === 'pass' || allowed.includes(type) ? type : 'pass';
        resolveClaimWindow(appState, appState.players);
        renderGame();
        return;
    }
    await mutateRoom(appState.roomId, room => {
        const window = room.gameState.claimWindow;
        const allowed = window?.eligible[String(seat)] || [];
        if (!window || window.responses[String(seat)] != null) return room;
        window.responses[String(seat)] = type === 'pass' || allowed.includes(type) ? type : 'pass';
        resolveClaimWindow(room.gameState, room.players);
        if (room.gameState.gamePhase === 'gameover') room.status = 'ended';
        return room;
    });
}

async function handleDeclareMahjong() {
    const result = checkMahjong(myHand(), myExposures());
    if (!result.matched) return showToast(result.reason || 'That hand is not Mahjong yet.');
    const message = `You win with ${result.handInfo.display}!`;
    if (appState.mode === 'solo') return endRoundLocal(message, makeWinResult(appState, appState.playerIndex, appState.players, result, message));
    await mutateRoom(appState.roomId, room => {
        if (room.status === 'playing' && room.gameState.currentTurn === appState.playerIndex) {
            room.status = 'ended';
            room.gameState.gamePhase = 'gameover';
            room.gameState.winnerMessage = message;
            const roomMatch = checkMahjong(room.gameState.hands[appState.playerIndex], room.gameState.exposures[appState.playerIndex]);
            room.gameState.roundResult = makeWinResult(room.gameState, appState.playerIndex, room.players, roomMatch, message);
        }
        return room;
    });
}

function endRoundLocal(message, result = makeDrawResult(message)) {
    appState.gamePhase = 'gameover';
    appState.winnerMessage = message;
    appState.roundResult = result;
    showToast(message);
    renderGame();
}

function scheduleBotTurnIfNeeded() {
    clearTimeout(botTimer);
    const player = appState.players[appState.currentTurn];
    if (!player?.isBot || appState.claimWindow || appState.gamePhase !== 'playing') return;
    if (appState.mode === 'multi' && !appState.players[appState.playerIndex]?.isHost) return;
    botTimer = setTimeout(runBotTurn, 650);
}

async function runBotTurn() {
    const seat = appState.currentTurn;
    if (appState.mode === 'solo') {
        performBotTurn(appState, seat, appState.players);
        renderGame();
        return;
    }
    await mutateRoom(appState.roomId, room => {
        if (room.status !== 'playing' || room.gameState.claimWindow || room.gameState.currentTurn !== seat || !room.players[seat]?.isBot) return room;
        performBotTurn(room.gameState, seat, room.players);
        if (room.gameState.gamePhase === 'gameover') room.status = 'ended';
        return room;
    });
}

function performBotTurn(state, seat, players) {
    if (effectiveCount(state, seat) === 13) {
        if (!state.wall.length) {
            state.gamePhase = 'gameover';
            state.winnerMessage = 'Draw game—the wall is empty.';
            state.roundResult = makeDrawResult();
            return;
        }
        state.hands[seat].push(state.wall.pop());
        state.canExchangeJoker = true;
    }
    const match = checkMahjong(state.hands[seat], state.exposures[seat]);
    if (match.matched) {
        state.gamePhase = 'gameover';
        state.winnerMessage = winnerAnnouncement(players[seat].name);
        state.roundResult = makeWinResult(state, seat, players, match);
        return;
    }
    const discard = botSelectDiscard(state.hands[seat]);
    applyDiscard(state, seat, discard.id, players);
}

/* Multiplayer lobby and room synchronization */
async function handleCreateRoom() {
    const roomCode = Math.random().toString(36).slice(2, 7).toUpperCase();
    appState.mode = 'multi';
    appState.playerName = 'Host';
    appState.roomId = roomCode;
    appState.playerIndex = 0;
    switchScreen(elements.roomLobbyScreen);
    elements.lobbyRoomCode.textContent = roomCode;
    elements.btnCreateRoom.disabled = true;
    try {
        const room = await createRoom(roomCode, appState.playerName);
        handleRoomStateUpdate(room);
        appState.unsubscribe = await subscribeToRoom(roomCode, handleRoomStateUpdate);
    } catch (error) {
        switchScreen(elements.lobbyScreen);
        showLobbyMessage(error.message || 'Could not create room.', 'error');
    } finally {
        elements.btnCreateRoom.disabled = false;
    }
}

async function handleJoinRoom() {
    const roomCode = elements.inputRoomId.value.trim().toUpperCase();
    const playerName = elements.inputPlayerName.value.trim();
    if (!playerName) return showLobbyMessage('Enter your name before joining.', 'error');
    if (!/^[A-Z0-9]{5}$/.test(roomCode)) return showLobbyMessage('Enter the 5-character room code exactly as shared.', 'error');
    appState.mode = 'multi';
    appState.playerName = playerName.slice(0, 20);
    appState.roomId = roomCode;
    elements.btnJoinRoom.disabled = true;
    elements.btnJoinRoom.textContent = 'Joining…';
    showLobbyMessage(`Looking for room ${roomCode}…`);
    try {
        const room = await joinRoom(roomCode, appState.playerName);
        appState.playerIndex = room.players.length - 1;
        switchScreen(elements.roomLobbyScreen);
        elements.lobbyRoomCode.textContent = roomCode;
        handleRoomStateUpdate(room);
        appState.unsubscribe = await subscribeToRoom(roomCode, handleRoomStateUpdate);
    } catch (error) {
        showLobbyMessage(error.message || 'Could not join room. Check the code and try again.', 'error');
    } finally {
        elements.btnJoinRoom.disabled = false;
        elements.btnJoinRoom.textContent = 'Confirm & Join';
    }
}

function handleRoomStateUpdate(room) {
    appState.players = room.players || [];
    renderLobby(room);
    if (!['charleston', 'playing', 'ended'].includes(room.status)) return;
    const state = room.gameState;
    const previousCharlestonStep = appState.charlestonStep;
    const normalizedPasses = [0, 1, 2, 3].map(seat =>
        isValidCharlestonPass(state.charlestonPasses?.[seat]) ? state.charlestonPasses[seat] : null
    );
    Object.assign(appState, {
        wall: state.wall || [],
        hands: state.hands || [[], [], [], []],
        exposures: state.exposures || [[], [], [], []],
        discards: state.discards || [],
        currentTurn: state.currentTurn || 0,
        activeDiscard: state.activeDiscard || null,
        claimWindow: state.claimWindow || null,
        lastClaimUndo: state.lastClaimUndo || null,
        canExchangeJoker: Boolean(state.canExchangeJoker),
        winnerMessage: state.winnerMessage || null,
        roundResult: state.roundResult || null,
        charlestonStep: state.charlestonStep || 0,
        charlestonPasses: normalizedPasses,
        gamePhase: room.status === 'ended' ? 'gameover' : room.status
    });
    if (appState.gamePhase !== 'charleston' || appState.charlestonStep !== previousCharlestonStep) myCharlestonSelections = [];
    switchScreen(elements.gameScreen);
    renderGame();
    if (room.status === 'ended' && state.winnerMessage) showToast(state.winnerMessage);
}

function renderLobby(room) {
    elements.lobbyPlayerCount.textContent = room.players.length;
    elements.lobbyPlayersList.innerHTML = '';
    for (const player of room.players) {
        const item = document.createElement('li');
        item.className = 'player-slot';
        item.textContent = `${player.name}${player.isBot ? ' (Bot)' : ''}`;
        if (player.isHost) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = 'Host';
            item.appendChild(badge);
        }
        elements.lobbyPlayersList.appendChild(item);
    }
    for (let seat = room.players.length; seat < 4; seat++) {
        const item = document.createElement('li');
        item.className = 'player-slot empty';
        item.textContent = 'Waiting for player…';
        elements.lobbyPlayersList.appendChild(item);
    }
    refreshLobbyStartButton();
}

function refreshLobbyStartButton() {
    const isHost = appState.players[appState.playerIndex]?.isHost;
    const ready = appState.players.length === 4 || elements.chkFillBots.checked;
    elements.btnStartGame.disabled = !isHost || !ready;
    elements.btnStartGame.textContent = ready ? 'Start Game' : 'Start Game (Need 4 Players)';
}

async function handleStartGame() {
    if (!appState.players[appState.playerIndex]?.isHost) return;
    const players = structuredClone(appState.players);
    if (elements.chkFillBots.checked) {
        const names = ['Bot Alpha 🤖', 'Bot Beta 🤖', 'Bot Gamma 🤖'];
        while (players.length < 4) {
            const seat = players.length;
            players.push({ id: `p${seat + 1}`, name: names[seat - 1], seat, isBot: true, active: true, isHost: false });
        }
    }
    const fresh = createFreshGameState();
    await updateRoom(appState.roomId, {
        roomId: appState.roomId,
        status: 'charleston',
        players,
        gameState: { ...fresh, gamePhase: 'charleston', lastActionTime: Date.now() }
    });
}

async function handleLeaveLobby() {
    clearTimeout(botTimer);
    if (appState.unsubscribe) appState.unsubscribe();
    appState.unsubscribe = null;
    const roomId = appState.roomId;
    const playerIndex = appState.playerIndex;
    appState.roomId = null;
    appState.players = [];
    elements.roundResultOverlay.classList.add('hidden');
    elements.menuOverlay.classList.add('hidden');
    closeMultiplayerPanel();
    switchScreen(elements.lobbyScreen);
    if (roomId) await leaveRoom(roomId, playerIndex).catch(() => {});
}

function restartLocalGame() {
    if (appState.mode !== 'solo') return showToast('Only the host can start a new multiplayer round.');
    startSoloGame();
}

async function startNextRound() {
    elements.roundResultOverlay.classList.add('hidden');
    if (appState.mode === 'solo') return startSoloGame();
    if (!appState.players[appState.playerIndex]?.isHost) return;
    await handleStartGame();
}

function exitToMainLobby() {
    clearTimeout(botTimer);
    document.body.classList.remove('charleston-active');
    elements.roundResultOverlay.classList.add('hidden');
    elements.menuOverlay.classList.add('hidden');
    if (appState.mode === 'multi') handleLeaveLobby();
    else switchScreen(elements.lobbyScreen);
}

async function copyRoomLink() {
    const link = `${location.origin}${location.pathname}?room=${appState.roomId}`;
    try {
        await navigator.clipboard.writeText(link);
        showToast('Share link copied.');
    } catch {
        showToast(`Room code: ${appState.roomId}`);
    }
}
