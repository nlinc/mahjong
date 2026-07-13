/* Main application coordinator. Game state is canonical and shared by solo and multiplayer. */
import {
    createWall, shuffle, sortHandBySuit, sortHandByValue,
    checkDiscardClaims, checkMahjong, SUITS
} from './engine.js?v=6';
import { botSelectCharlestonPass, botSelectDiscard, botDecideClaim } from './bot.js?v=6';
import {
    elements, switchScreen, toggleOverlay, showToast, renderPlayerRack,
    renderDiscardRiver, renderOpponentSeat, renderMyExposures, renderClaimPrompt,
    renderCharlestonStep, setupMenuOverlay, setupGuideOverlay, setupCardOverlay,
    getTileChar, renderCoPilotSuggestions
} from './ui.js?v=8';
import {
    createRoom, joinRoom, subscribeToRoom, updateRoom, mutateRoom, leaveRoom, initFirebase
} from './firebase.js?v=6';

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
    gamePhase: 'setup',
    charlestonStep: 0,
    charlestonPasses: [null, null, null, null],
    selectedTileId: null,
    unsubscribe: null
};

let myCharlestonSelections = [];
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
}

function updateRackUI() {
    renderPlayerRack(myHand(), appState.selectedTileId, handleTileSelect, handleTileDoubleClick);
    renderMyExposures(myExposures());
    if (!elements.coPilotPanel.classList.contains('hidden')) renderCoPilotSuggestions(myHand());
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
        renderOpponentSeat(seat, id, view, appState.currentTurn === seat && appState.gamePhase === 'playing');
    }
}

function toggleCoPilot() {
    const hidden = elements.coPilotPanel.classList.toggle('hidden');
    elements.btnToggleCopilot.classList.toggle('active', !hidden);
    if (!hidden) renderCoPilotSuggestions(myHand());
}

function sortMyHand(sorter) {
    appState.hands[appState.playerIndex] = sorter(myHand());
    updateRackUI();
}

function handleTileSelect(tileId) {
    if (appState.gamePhase === 'charleston') {
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
    const alreadySubmitted = Boolean(appState.charlestonPasses?.[appState.playerIndex]);
    renderCharlestonStep(
        appState.charlestonStep,
        myCharlestonSelections,
        tileId => {
            myCharlestonSelections = myCharlestonSelections.filter(tile => tile.id !== tileId);
            renderCharleston();
        },
        handleConfirmCharlestonPass
    );
    elements.btnCharlestonConfirm.disabled = alreadySubmitted || myCharlestonSelections.length !== 3;
    elements.btnCharlestonConfirm.textContent = alreadySubmitted ? 'Waiting for players…' : 'Confirm Pass';
    elements.btnCharlestonStop.classList.toggle('hidden', appState.charlestonStep !== 3);
    elements.btnCharlestonStop.textContent = 'Skip Optional Second Charleston';
    updateRackUI();
}

function passSourceFor(seat, step) {
    const offsets = [3, 2, 1, 1, 2, 3];
    return (seat + offsets[step]) % 4;
}

function resolveCharlestonPasses(state) {
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
    if (myCharlestonSelections.length !== 3) return;
    const selectedIds = myCharlestonSelections.map(tile => tile.id);
    myCharlestonSelections = [];

    if (appState.mode === 'solo') {
        appState.charlestonPasses[0] = selectedIds;
        for (let seat = 1; seat < 4; seat++) appState.charlestonPasses[seat] = botSelectCharlestonPass(appState.hands[seat]).map(tile => tile.id);
        resolveCharlestonPasses(appState);
        if (appState.charlestonStep >= 6) concludeCharleston(appState);
        renderGame();
        return;
    }

    try {
        await mutateRoom(appState.roomId, room => {
            if (room.status !== 'charleston') return room;
            const state = room.gameState;
            state.charlestonPasses ||= [null, null, null, null];
            if (state.charlestonPasses[appState.playerIndex]) return room;
            state.charlestonPasses[appState.playerIndex] = selectedIds;
            room.players.forEach((player, seat) => {
                if (player.isBot && !state.charlestonPasses[seat]) {
                    state.charlestonPasses[seat] = botSelectCharlestonPass(state.hands[seat]).map(tile => tile.id);
                }
            });
            if (state.charlestonPasses.every(Boolean)) {
                resolveCharlestonPasses(state);
                if (state.charlestonStep >= 6) {
                    room.status = 'playing';
                    state.currentTurn = 0;
                }
            }
            return room;
        });
    } catch (error) {
        myCharlestonSelections = selectedIds.map(id => myHand().find(tile => tile.id === id)).filter(Boolean);
        showToast(error.message || 'Could not submit pass.');
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
            room.gameState.currentTurn = 0;
            room.gameState.charlestonPasses = [null, null, null, null];
        }
        return room;
    });
}

function concludeCharleston(state) {
    state.gamePhase = 'playing';
    state.currentTurn = 0;
    state.charlestonPasses = [null, null, null, null];
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
        else elements.turnInstruction.textContent = 'Select a tile from your rack to discard.';
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
}

async function requestDraw() {
    if (appState.wall.length === 0) return endRoundLocal('Draw game—the wall is empty.');
    if (appState.mode === 'solo') {
        const tile = appState.wall.pop();
        appState.hands[appState.playerIndex].push(tile);
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
    const tile = state.hands[seat].splice(index, 1)[0];
    state.discards.push(tile);
    state.activeDiscard = tile;
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
        state.activeDiscard = null;
        state.claimWindow = null;
        return;
    }
    executeClaim(state, calls[0].seat, calls[0].type, window.tile, players);
}

function executeClaim(state, seat, type, tile, players) {
    state.discards.pop();
    if (type === 'mahjong') {
        state.hands[seat].push(tile);
        state.gamePhase = 'gameover';
        state.winnerMessage = `${players[seat].name} wins with Mahjong!`;
        state.claimWindow = null;
        state.activeDiscard = null;
        return;
    }

    const size = { pung: 3, kong: 4, quint: 5 }[type];
    if (!size) return;
    const needed = size - 1;
    const hand = state.hands[seat];
    const chosen = [];
    for (const candidate of hand) {
        if (chosen.length < needed && candidate.suit === tile.suit && candidate.val === tile.val) chosen.push(candidate);
    }
    for (const candidate of hand) {
        if (chosen.length < needed && candidate.suit === SUITS.JOKERS) chosen.push(candidate);
    }
    if (chosen.length !== needed) {
        state.currentTurn = nextSeat(state.claimWindow.discarder);
        state.claimWindow = null;
        state.activeDiscard = null;
        return;
    }
    const chosenIds = new Set(chosen.map(candidate => candidate.id));
    state.hands[seat] = hand.filter(candidate => !chosenIds.has(candidate.id));
    state.exposures[seat].push([...chosen, tile]);
    state.currentTurn = seat;
    state.claimWindow = null;
    state.activeDiscard = null;
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
    if (appState.mode === 'solo') return endRoundLocal(message);
    await mutateRoom(appState.roomId, room => {
        if (room.status === 'playing' && room.gameState.currentTurn === appState.playerIndex) {
            room.status = 'ended';
            room.gameState.gamePhase = 'gameover';
            room.gameState.winnerMessage = message;
        }
        return room;
    });
}

function endRoundLocal(message) {
    appState.gamePhase = 'gameover';
    appState.winnerMessage = message;
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
            return;
        }
        state.hands[seat].push(state.wall.pop());
    }
    const match = checkMahjong(state.hands[seat], state.exposures[seat]);
    if (match.matched) {
        state.gamePhase = 'gameover';
        state.winnerMessage = `${players[seat].name} wins with Mahjong!`;
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
    Object.assign(appState, {
        wall: state.wall || [],
        hands: state.hands || [[], [], [], []],
        exposures: state.exposures || [[], [], [], []],
        discards: state.discards || [],
        currentTurn: state.currentTurn || 0,
        activeDiscard: state.activeDiscard || null,
        claimWindow: state.claimWindow || null,
        charlestonStep: state.charlestonStep || 0,
        charlestonPasses: state.charlestonPasses || [null, null, null, null],
        gamePhase: room.status === 'ended' ? 'gameover' : room.status
    });
    if (appState.gamePhase !== 'charleston') myCharlestonSelections = [];
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
    if (appState.roomId) await leaveRoom(appState.roomId, appState.playerIndex).catch(() => {});
    appState.roomId = null;
    appState.players = [];
    closeMultiplayerPanel();
    switchScreen(elements.lobbyScreen);
}

function restartLocalGame() {
    if (appState.mode !== 'solo') return showToast('Only the host can start a new multiplayer round.');
    startSoloGame();
}

function exitToMainLobby() {
    clearTimeout(botTimer);
    document.body.classList.remove('charleston-active');
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
