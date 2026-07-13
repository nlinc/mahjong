/* Main Application Coordinator */
import { 
    createWall, shuffle, sortHandBySuit, sortHandByValue, 
    checkDiscardClaims, checkMahjong, SUITS, HANDS_CARD 
} from './engine.js';
import { 
    botSelectCharlestonPass, botSelectDiscard, botDecideClaim 
} from './bot.js';
import { 
    elements, switchScreen, toggleOverlay, showToast, 
    renderPlayerRack, renderDiscardRiver, renderOpponentSeat, 
    renderMyExposures, renderClaimPrompt, renderCharlestonStep, 
    setupMenuOverlay, setupGuideOverlay, setupCardOverlay, getTileChar,
    renderCoPilotSuggestions
} from './ui.js';
import { 
    createRoom, joinRoom, subscribeToRoom, updateRoom, leaveRoom, isFirebaseConnected, initFirebase 
} from './firebase.js';

// Local Game State
let appState = {
    mode: 'solo', // 'solo' or 'multi'
    roomId: null,
    playerIndex: 0,
    playerName: 'Player 1',
    players: [], // list of player objects
    
    // Core Game Data
    wall: [],
    hands: [[], [], [], []], // hands of players 0-3
    exposures: [[], [], [], []], // exposed melds of players 0-3
    discards: [],
    currentTurn: 0,
    selectedTileId: null,
    
    // Phase control
    gamePhase: 'setup', // 'setup', 'charleston', 'playing', 'gameover'
    charlestonStep: 0, // 0 to 6
    charlestonPasses: [[], [], [], []], // Selected tiles to pass
    
    // Sync listener
    unsubscribe: null
};

// Selected tiles for Charleston pass (local player)
let myCharlestonSelections = [];

// Initialize game settings and bindings immediately (modules are deferred by default)
initApp();

async function initApp() {
    // Lazy-load Firebase configurations asynchronously
    await initFirebase();

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.error("Service worker registration failed:", err);
        });
    }

    setupUIEvents();
    setupGuideOverlay();
    setupCardOverlay();
    setupMenuOverlay(restartLocalGame, exitToMainLobby);
}

function setupUIEvents() {
    // Mode transitions
    elements.btnSinglePlayer.addEventListener('click', () => {
        appState.mode = 'solo';
        appState.players = [
            { id: 'p1', name: 'You (Player 1)', seat: 0, isBot: false },
            { id: 'p2', name: 'Bot 2 🤖', seat: 1, isBot: true },
            { id: 'p3', name: 'Bot 3 🤖', seat: 2, isBot: true },
            { id: 'p4', name: 'Bot 4 🤖', seat: 3, isBot: true }
        ];
        startNewGame();
    });

    elements.btnMultiplayerLobby.addEventListener('click', () => {
        elements.multiplayerPanels.classList.remove('hidden');
        elements.btnSinglePlayer.classList.add('hidden');
        elements.btnMultiplayerLobby.classList.add('hidden');
    });

    elements.btnBackToSolo.addEventListener('click', () => {
        elements.multiplayerPanels.classList.add('hidden');
        elements.btnSinglePlayer.classList.remove('hidden');
        elements.btnMultiplayerLobby.classList.remove('hidden');
    });

    // Multiplayer room actions
    elements.btnCreateRoom.addEventListener('click', handleCreateRoom);
    elements.btnJoinRoom.addEventListener('click', handleJoinRoom);
    elements.btnLeaveLobby.addEventListener('click', handleLeaveLobby);
    elements.btnStartGame.addEventListener('click', handleStartGame);
    
    elements.btnCopyCode.addEventListener('click', () => {
        const link = `${window.location.origin}${window.location.pathname}?room=${appState.roomId}`;
        navigator.clipboard.writeText(link).then(() => {
            showToast("Share Link Copied! 🔗");
        });
    });

    // Sort buttons
    elements.btnSortSuit.addEventListener('click', () => {
        appState.hands[0] = sortHandBySuit(appState.hands[0]);
        updateRackUI();
    });

    elements.btnSortValue.addEventListener('click', () => {
        appState.hands[0] = sortHandByValue(appState.hands[0]);
        updateRackUI();
    });

    // Co-pilot toggle button listener
    elements.btnToggleCopilot.addEventListener('click', () => {
        const isHidden = elements.coPilotPanel.classList.toggle('hidden');
        if (!isHidden) {
            updateCoPilot();
        }
        elements.btnToggleCopilot.classList.toggle('active', !isHidden);
    });

    // Discard selected button
    elements.btnRackDiscard.addEventListener('click', handleManualDiscard);

    // Deep Link Room check
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        elements.btnMultiplayerLobby.click();
        elements.inputRoomId.value = roomParam;
        handleJoinRoom();
    }
}

/* ========================================================================= */
/*                              GAME LOOP LOGIC                              */
/* ========================================================================= */

function startNewGame() {
    document.body.classList.remove('charleston-active');
    switchScreen(elements.gameScreen);
    appState.gamePhase = 'charleston';
    appState.charlestonStep = 0;
    appState.discards = [];
    appState.exposures = [[], [], [], []];
    
    elements.lblRoomIdDisplay.textContent = appState.mode === 'solo' ? 'Local Game' : `Room: ${appState.roomId}`;
    
    // Generate and shuffle tiles
    appState.wall = shuffle(createWall());
    
    // Deal: 14 tiles to East (player 0 / dealer), 13 to others
    appState.hands = [[], [], [], []];
    for (let round = 0; round < 13; round++) {
        for (let player = 0; player < 4; player++) {
            appState.hands[player].push(appState.wall.pop());
        }
    }
    // East gets 14th tile
    appState.hands[0].push(appState.wall.pop());
    
    // Sort player's hand initially
    appState.hands[0] = sortHandBySuit(appState.hands[0]);
    
    // Update labels
    updateDashboardInfo();
    
    // Start Charleston
    startCharlestonPhase();
}

function restartLocalGame() {
    if (appState.mode === 'multi') {
        showToast("Cannot restart multiplayer match from menu.");
        return;
    }
    startNewGame();
}

function exitToMainLobby() {
    document.body.classList.remove('charleston-active');
    if (appState.mode === 'multi') {
        handleLeaveLobby();
    } else {
        switchScreen(elements.lobbyScreen);
    }
}

function updateDashboardInfo() {
    elements.lblGamePhase.textContent = `Phase: ${appState.gamePhase.toUpperCase()}`;
    elements.lblWallCount.textContent = `Wall: ${appState.wall.length}`;
}

function updateRackUI() {
    renderPlayerRack(
        appState.hands[0], 
        appState.selectedTileId, 
        handleTileSelect, 
        handleTileDblClick
    );
    renderMyExposures(appState.exposures[0]);
    updateCoPilot();
}

function updateCoPilot() {
    if (appState.hands[0]) {
        renderCoPilotSuggestions(appState.hands[0]);
    }
}

function updateOpponentsUI() {
    renderOpponentSeat(1, 'seat-right', appState.players[1], appState.currentTurn === 1);
    renderOpponentSeat(2, 'seat-top', appState.players[2], appState.currentTurn === 2);
    renderOpponentSeat(3, 'seat-left', appState.players[3], appState.currentTurn === 3);
}

function handleTileSelect(tileId) {
    if (appState.gamePhase === 'charleston') {
        // Toggle Charleston selection
        const tile = appState.hands[0].find(t => t.id === tileId);
        
        // Cannot pass Jokers in Charleston
        if (tile.suit === SUITS.JOKERS) {
            showToast("Jokers cannot be passed in the Charleston!");
            return;
        }

        const idx = myCharlestonSelections.findIndex(t => t.id === tileId);
        if (idx >= 0) {
            myCharlestonSelections.splice(idx, 1);
        } else {
            if (myCharlestonSelections.length < 3) {
                myCharlestonSelections.push(tile);
            } else {
                showToast("You can only pass 3 tiles.");
            }
        }
        updateCharlestonWizard();
    } else if (appState.gamePhase === 'playing' && appState.currentTurn === 0) {
        // Select tile for discarding
        appState.selectedTileId = appState.selectedTileId === tileId ? null : tileId;
        elements.btnRackDiscard.disabled = (appState.selectedTileId === null);
        updateRackUI();
    }
}

function handleTileDblClick(tileId) {
    if (appState.gamePhase === 'playing' && appState.currentTurn === 0) {
        appState.selectedTileId = tileId;
        handleManualDiscard();
    }
}


/* ========================================================================= */
/*                          THE CHARLESTON PHASE                             */
/* ========================================================================= */

function startCharlestonPhase() {
    document.body.classList.add('charleston-active');
    myCharlestonSelections = [];
    appState.charlestonStep = 0;
    
    // Open Charleston wizard
    toggleOverlay(elements.charlestonOverlay, true);
    updateCharlestonWizard();
}

function updateCharlestonWizard() {
    updateRackUI();
    updateOpponentsUI();
    
    renderCharlestonStep(
        appState.charlestonStep,
        myCharlestonSelections,
        handleRemoveCharlestonTile,
        handleConfirmCharlestonPass
    );
}

function handleRemoveCharlestonTile(tileId) {
    myCharlestonSelections = myCharlestonSelections.filter(t => t.id !== tileId);
    updateCharlestonWizard();
}

function handleConfirmCharlestonPass() {
    if (myCharlestonSelections.length < 3) return;

    // Remove passed tiles from player's hand
    appState.hands[0] = appState.hands[0].filter(t => !myCharlestonSelections.some(sel => sel.id === t.id));

    // Get pass target seat
    const passTargetIndex = getCharlestonPassTarget(0, appState.charlestonStep);
    const passSourceIndex = getCharlestonPassSource(0, appState.charlestonStep);

    // Compute bot selections for the pass
    const botPasses = [[], [], [], []];
    botPasses[0] = [...myCharlestonSelections];

    for (let player = 1; player < 4; player++) {
        const passTarget = getCharlestonPassTarget(player, appState.charlestonStep);
        const selectedPass = botSelectCharlestonPass(appState.hands[player]);
        
        // Remove from bot's hand
        appState.hands[player] = appState.hands[player].filter(t => !selectedPass.some(sel => sel.id === t.id));
        botPasses[player] = selectedPass;
    }

    // Distribute passes
    for (let player = 0; player < 4; player++) {
        const sourceIndex = getCharlestonPassSource(player, appState.charlestonStep);
        const incomingTiles = botPasses[sourceIndex];
        appState.hands[player].push(...incomingTiles);
    }

    // Sort hand
    appState.hands[0] = sortHandBySuit(appState.hands[0]);

    // Go to next step
    appState.charlestonStep++;
    myCharlestonSelections = [];

    // Check if Charleston is complete (6 passes + optional courtesy)
    if (appState.charlestonStep >= 6) {
        concludeCharleston();
    } else {
        updateCharlestonWizard();
    }
}

function concludeCharleston() {
    document.body.classList.remove('charleston-active');
    toggleOverlay(elements.charlestonOverlay, false);
    appState.gamePhase = 'playing';
    appState.currentTurn = 0; // Dealer (East) starts
    
    showToast("Charleston Complete! East begins.");
    updateDashboardInfo();
    updateRackUI();
    updateOpponentsUI();
    
    // Trigger first discard prompt for East (Player 0)
    triggerTurnPrompt();
}

// Pass Directions helper based on step:
// 0: Right, 1: Across, 2: Left, 3: Left, 4: Across, 5: Right
function getCharlestonPassTarget(playerSeat, step) {
    const directions = [1, 2, 3, 3, 2, 1]; // Offset value to add
    const offset = directions[step % 6];
    return (playerSeat + offset) % 4;
}

function getCharlestonPassSource(playerSeat, step) {
    const directions = [3, 2, 1, 1, 2, 3]; // Offset value to add (opposite direction)
    const offset = directions[step % 6];
    return (playerSeat + offset) % 4;
}


/* ========================================================================= */
/*                          DRAW & DISCARD TURNS                             */
/* ========================================================================= */

function triggerTurnPrompt() {
    updateDashboardInfo();
    updateRackUI();
    updateOpponentsUI();

    if (appState.currentTurn === 0) {
        // Human player's turn
        elements.turnInstruction.textContent = "Your turn. Draw a tile or select a tile to discard.";
        elements.btnRackDiscard.disabled = (appState.selectedTileId === null);
        
        // If human has 13 tiles, they must DRAW a tile from wall first
        if (appState.hands[0].length === 13) {
            handleManualDraw();
        } else {
            // Hand already has 14 tiles (e.g. from deal or claim), ready to discard
            elements.turnInstruction.textContent = "Select a tile from your rack to discard.";
        }
    } else {
        // Bot's turn
        elements.turnInstruction.textContent = `${appState.players[appState.currentTurn].name} is thinking...`;
        elements.btnRackDiscard.disabled = true;
        
        setTimeout(() => {
            runBotTurn();
        }, 1200); // 1.2s delay for realism
    }
}

function handleManualDraw() {
    if (appState.wall.length === 0) {
        declareGameEnd("Draw Game. The wall is empty!");
        return;
    }
    
    const tile = appState.wall.pop();
    appState.hands[0].push(tile);
    appState.selectedTileId = tile.id; // Auto select new tile
    
    // Render with drawn tile highlighted
    appState.hands[0] = sortHandBySuit(appState.hands[0]);
    updateRackUI();
    updateDashboardInfo();
    
    showToast(`Drew tile: ${getTileChar(tile.suit, tile.val)}`);
    elements.turnInstruction.textContent = "Select a tile from your rack to discard.";
}

function handleManualDiscard() {
    if (appState.selectedTileId === null || appState.currentTurn !== 0) return;
    
    const tileIndex = appState.hands[0].findIndex(t => t.id === appState.selectedTileId);
    if (tileIndex < 0) return;
    
    const discardedTile = appState.hands[0].splice(tileIndex, 1)[0];
    appState.selectedTileId = null;
    elements.btnRackDiscard.disabled = true;
    
    // Add to discard river
    appState.discards.push(discardedTile);
    renderDiscardRiver(appState.discards);
    
    updateRackUI();
    
    showToast(`You discarded: ${getTileChar(discardedTile.suit, discardedTile.val)}`);
    
    // Check if anyone can call this discard
    checkDiscardsClaims(discardedTile, 0);
}

function runBotTurn() {
    const botIndex = appState.currentTurn;
    
    // 1. Bot draws a tile if they only have 13
    if (appState.hands[botIndex].length === 13) {
        if (appState.wall.length === 0) {
            declareGameEnd("Draw Game. The wall is empty!");
            return;
        }
        const drawn = appState.wall.pop();
        appState.hands[botIndex].push(drawn);
    }
    
    // Verify bot has 14 tiles
    // 2. Check if bot has Mahjong self-draw
    const match = checkMahjong(appState.hands[botIndex]);
    if (match.matched) {
        declareGameEnd(`${appState.players[botIndex].name} calls MAHJONG and wins the game!`);
        return;
    }
    
    // 3. Bot chooses a discard
    const discard = botSelectDiscard(appState.hands[botIndex]);
    
    // Remove from bot's hand
    appState.hands[botIndex] = appState.hands[botIndex].filter(t => t.id !== discard.id);
    appState.discards.push(discard);
    renderDiscardRiver(appState.discards);
    
    showToast(`${appState.players[botIndex].name} discarded: ${getTileChar(discard.suit, discard.val)}`);
    
    // Check if anyone can call this discard
    checkDiscardsClaims(discard, botIndex);
}

/* ========================================================================= */
/*                              CALLING DISCARDS                             */
/* ========================================================================= */

function checkDiscardsClaims(discardTile, discardedPlayerIdx) {
    let claimQueue = []; // array of { playerIndex: N, claims: [...] }

    // 1. Check human player (0) if it wasn't their discard
    if (discardedPlayerIdx !== 0) {
        const humanClaims = checkDiscardClaims(appState.hands[0], discardTile);
        if (humanClaims.length > 0) {
            claimQueue.push({ playerIndex: 0, claims: humanClaims });
        }
    }

    // 2. Check bots
    for (let player = 1; player < 4; player++) {
        if (player !== discardedPlayerIdx) {
            const botClaims = checkDiscardClaims(appState.hands[player], discardTile);
            if (botClaims.length > 0) {
                // Decide if bot wants to claim
                const claimType = botDecideClaim(appState.hands[player], discardTile, botClaims);
                if (claimType) {
                    claimQueue.push({ playerIndex: player, claims: [claimType] });
                }
            }
        }
    }

    if (claimQueue.length === 0) {
        // No claims, advance turn
        appState.currentTurn = (discardedPlayerIdx + 1) % 4;
        triggerTurnPrompt();
    } else {
        // Solve claim queue priorities
        // Mahjong has highest priority. Pung/Kong/Quint follows turn order from discarded player.
        
        // Check Mahjong calls
        const mjCall = claimQueue.find(q => q.claims.includes('mahjong'));
        if (mjCall) {
            executeClaim(mjCall.playerIndex, 'mahjong', discardTile);
            return;
        }

        // Pung/Kong/Quint priority: nearest turn order
        // Sort queue by seat distance from discardedPlayerIdx
        claimQueue.sort((a, b) => {
            const distA = (a.playerIndex - discardedPlayerIdx + 4) % 4;
            const distB = (b.playerIndex - discardedPlayerIdx + 4) % 4;
            return distA - distB;
        });

        const highestClaim = claimQueue[0];
        if (highestClaim.playerIndex === 0) {
            // Human player has a claim, prompt them!
            renderClaimPrompt(discardTile, appState.players[discardedPlayerIdx].name, highestClaim.claims, (chosenClaim) => {
                if (chosenClaim === 'pass') {
                    // Human passed, let next in queue try
                    claimQueue.shift();
                    processNextClaimInQueue(claimQueue, discardTile, discardedPlayerIdx);
                } else {
                    executeClaim(0, chosenClaim, discardTile);
                }
            });
        } else {
            // Bot has highest claim, execute after dramatic delay
            setTimeout(() => {
                executeClaim(highestClaim.playerIndex, highestClaim.claims[0], discardTile);
            }, 1200);
        }
    }
}

function processNextClaimInQueue(queue, discardTile, discardedPlayerIdx) {
    if (queue.length === 0) {
        // All passed, next turn
        appState.currentTurn = (discardedPlayerIdx + 1) % 4;
        triggerTurnPrompt();
        return;
    }
    const nextClaim = queue[0];
    if (nextClaim.playerIndex === 0) {
        // Should not happen since player already passed, but safety fallback
        queue.shift();
        processNextClaimInQueue(queue, discardTile, discardedPlayerIdx);
    } else {
        executeClaim(nextClaim.playerIndex, nextClaim.claims[0], discardTile);
    }
}

function executeClaim(playerIndex, claimType, tile) {
    showToast(`${appState.players[playerIndex].name} calls ${claimType.toUpperCase()}!`);
    
    // Remove last discard from river
    appState.discards.pop();
    renderDiscardRiver(appState.discards);

    if (claimType === 'mahjong') {
        appState.hands[playerIndex].push(tile);
        declareGameEnd(`${appState.players[playerIndex].name} wins with MAHJONG!`);
        return;
    }

    // Build exposed meld: need to gather the matching tiles from player's hand
    let requiredCount = 3; // pung
    if (claimType === 'kong') requiredCount = 4;
    if (claimType === 'quint') requiredCount = 5;

    // Grab natural matching tiles
    const meldTiles = [];
    const restHand = [];
    
    for (const t of appState.hands[playerIndex]) {
        if (t.suit === tile.suit && t.val === tile.val) {
            meldTiles.push(t);
        } else {
            restHand.push(t);
        }
    }

    // Add Jokers if we don't have enough natural tiles
    const gap = (requiredCount - 1) - meldTiles.length;
    let jokersUsed = 0;
    const finalHand = [];

    for (const t of restHand) {
        if (t.suit === SUITS.JOKERS && jokersUsed < gap) {
            meldTiles.push(t);
            jokersUsed++;
        } else {
            finalHand.push(t);
        }
    }

    // Add discarded tile to meld
    meldTiles.push(tile);

    // Save exposures
    appState.exposures[playerIndex].push(meldTiles);
    appState.hands[playerIndex] = finalHand;

    // Shift turn to claiming player
    appState.currentTurn = playerIndex;
    
    // Claiming player has 14 tiles (meld is separate, hand has 14 - meldCount = 14-3 = 11 tiles)
    // Actually, in standard display, the rack holds remaining unexposed tiles (11 tiles)
    // and they must immediately DISCARD to get back to 13.
    updateDashboardInfo();
    updateRackUI();
    updateOpponentsUI();
    
    if (playerIndex === 0) {
        showToast("Expose completed! Select a tile to discard.");
        elements.turnInstruction.textContent = "Exposed meld. Discard a tile to complete your turn.";
        elements.btnRackDiscard.disabled = (appState.selectedTileId === null);
    } else {
        setTimeout(() => {
            runBotTurn();
        }, 1200);
    }
}

function declareGameEnd(message) {
    appState.gamePhase = 'gameover';
    updateDashboardInfo();
    
    // Reveal all hands
    updateOpponentsUI();
    updateRackUI();
    
    elements.turnInstruction.textContent = "Game Over. " + message;
    showToast(message);
    
    // Highlight winning player
    const alertModal = document.createElement('div');
    alertModal.className = 'overlay';
    alertModal.innerHTML = `
        <div class="modal-card glass">
            <h2>🏆 Match Results</h2>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="this.closest('.overlay').remove()">View Board</button>
        </div>
    `;
    document.body.appendChild(alertModal);
}


/* ========================================================================= */
/*                            MULTIPLAYER SYNC                               */
/* ========================================================================= */

// Multiplayer orchestration triggers
async function handleCreateRoom() {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    appState.playerName = 'Host';
    appState.roomId = roomCode;
    appState.playerIndex = 0;
    
    switchScreen(elements.roomLobbyScreen);
    elements.lobbyRoomCode.textContent = roomCode;
    
    try {
        await createRoom(roomCode, appState.playerName);
        
        // Subscribe to changes
        appState.unsubscribe = await subscribeToRoom(roomCode, handleRoomStateUpdate);
        showToast("Room created! Waiting for players.");
    } catch (e) {
        showToast("Error creating room.");
        console.error(e);
        switchScreen(elements.lobbyScreen);
    }
}

async function handleJoinRoom() {
    const roomCode = elements.inputRoomId.value.trim().toUpperCase();
    if (roomCode.length < 4) {
        showToast("Enter a valid Room Code.");
        return;
    }
    
    appState.playerName = `Player ${Math.floor(Math.random() * 90) + 10}`;
    appState.roomId = roomCode;
    
    try {
        const state = await joinRoom(roomCode, appState.playerName);
        appState.playerIndex = state.players.length - 1;
        
        switchScreen(elements.roomLobbyScreen);
        elements.lobbyRoomCode.textContent = roomCode;
        
        // Subscribe
        appState.unsubscribe = await subscribeToRoom(roomCode, handleRoomStateUpdate);
        showToast("Joined room lobby!");
    } catch (e) {
        showToast(e.message || "Failed to join room.");
        console.error(e);
    }
}

function handleRoomStateUpdate(roomState) {
    appState.players = roomState.players;
    
    // Update lobby lists
    elements.lobbyPlayerCount.textContent = roomState.players.length;
    elements.lobbyPlayersList.innerHTML = '';
    
    roomState.players.forEach((p, idx) => {
        const li = document.createElement('li');
        li.className = 'player-slot';
        li.innerHTML = `${p.name} ${p.isHost ? '<span class="badge">Host</span>' : '<span class="badge">Joined</span>'}`;
        elements.lobbyPlayersList.appendChild(li);
    });
    
    // Fill in empty slots representation
    for (let i = roomState.players.length; i < 4; i++) {
        const li = document.createElement('li');
        li.className = 'player-slot empty';
        li.textContent = 'Waiting for player...';
        elements.lobbyPlayersList.appendChild(li);
    }
    
    // Enable start button if host and lobby is ready
    const isHost = roomState.players[appState.playerIndex]?.isHost;
    elements.btnStartGame.disabled = !isHost || (roomState.players.length < 4 && !elements.chkFillBots.checked);

    // If game has started on server, switch to board!
    if (roomState.status === 'playing' || roomState.status === 'charleston') {
        syncStartedGame(roomState);
    }
}

async function handleLeaveLobby() {
    if (appState.unsubscribe) {
        appState.unsubscribe();
        appState.unsubscribe = null;
    }
    
    if (appState.roomId) {
        await leaveRoom(appState.roomId, appState.playerIndex);
    }
    
    switchScreen(elements.lobbyScreen);
    appState.roomId = null;
}

async function handleStartGame() {
    if (elements.chkFillBots.checked && appState.players.length < 4) {
        // Fill empty slots with bots on server state
        const botNames = ["Bot Alpha 🤖", "Bot Beta 🤖", "Bot Gamma 🤖"];
        let botIdx = 0;
        while (appState.players.length < 4) {
            const pId = `p${appState.players.length + 1}`;
            appState.players.push({
                id: pId,
                name: botNames[botIdx++],
                isHost: false,
                active: true,
                isBot: true,
                seat: appState.players.length
            });
        }
    }

    // Trigger board transition state on DB
    const wall = shuffle(createWall());
    const hands = [[], [], [], []];
    for (let round = 0; round < 13; round++) {
        for (let player = 0; player < 4; player++) {
            hands[player].push(wall.pop());
        }
    }
    hands[0].push(wall.pop()); // East dealer

    const nextState = {
        status: 'charleston',
        players: appState.players,
        gameState: {
            wall,
            hands,
            exposures: [[], [], [], []],
            discards: [],
            currentTurn: 0,
            activeDiscard: null,
            claimPrompt: null,
            charlestonStep: 0,
            charlestonPasses: [[], [], [], []]
        }
    };

    await updateRoom(appState.roomId, nextState);
}

function syncStartedGame(roomState) {
    appState.gamePhase = roomState.status;
    appState.players = roomState.players;
    
    // In multi-client tab-mode or server-mode, playerIndex determines our seat
    // We map seats so that our playerIndex is always Seat 0 (Bottom) in the UI
    const offset = appState.playerIndex;
    
    appState.wall = roomState.gameState.wall;
    appState.hands = rotateSeats(roomState.gameState.hands, offset);
    appState.exposures = rotateSeats(roomState.gameState.exposures, offset);
    appState.discards = roomState.gameState.discards;
    appState.currentTurn = (roomState.gameState.currentTurn - offset + 4) % 4;
    
    // Render
    switchScreen(elements.gameScreen);
    updateDashboardInfo();
    updateRackUI();
    renderDiscardRiver(appState.discards);
    updateOpponentsUI();
    
    if (appState.gamePhase === 'charleston') {
        toggleOverlay(elements.charlestonOverlay, true);
        appState.charlestonStep = roomState.gameState.charlestonStep;
        updateCharlestonWizard();
    } else {
        toggleOverlay(elements.charlestonOverlay, false);
        triggerTurnPrompt();
    }
}

// Rotate seats so that client player is index 0
function rotateSeats(arr, offset) {
    const rotated = [];
    for (let i = 0; i < 4; i++) {
        rotated.push(arr[(i + offset) % 4]);
    }
    return rotated;
}
