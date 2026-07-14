/* Firebase & LocalStorage Room Synchronizer */

// We dynamically support Firebase if configured, otherwise fallback to LocalStorage tab-sync
let db = null;
let useFirebase = false;

// Default config for the project
const defaultFirebaseConfig = {
    projectId: "mahjong-lincoln",
    appId: "1:626242943126:web:db95ad98a48ed4c0e36ab7",
    storageBucket: "mahjong-lincoln.firebasestorage.app",
    apiKey: "AIzaSyCWULCN7sxPverHGK9gvmRuqB88f7dYhC8",
    authDomain: "mahjong-lincoln.firebaseapp.com",
    messagingSenderId: "626242943126",
    projectNumber: "626242943126"
};

// Subscriptions storage
const listeners = {};

function encodeRoom(room) {
    const encoded = structuredClone(room);
    const state = encoded.gameState;
    if (!state) return encoded;
    if (Array.isArray(state.hands)) state.hands = Object.fromEntries(state.hands.map((hand, seat) => [seat, hand]));
    if (Array.isArray(state.exposures)) {
        state.exposures = Object.fromEntries(state.exposures.map((melds, seat) => [seat,
            Object.fromEntries((melds || []).map((meld, index) => [index, meld]))
        ]));
    }
    if (Array.isArray(state.charlestonPasses)) {
        state.charlestonPasses = Object.fromEntries(state.charlestonPasses.map((pass, seat) => [seat, pass]));
    }
    return encoded;
}

function decodeRoom(room) {
    const decoded = structuredClone(room);
    const state = decoded.gameState;
    if (!state) return decoded;
    if (state.hands && !Array.isArray(state.hands)) state.hands = [0, 1, 2, 3].map(seat => state.hands[String(seat)] || []);
    if (state.exposures && !Array.isArray(state.exposures)) {
        state.exposures = [0, 1, 2, 3].map(seat => {
            const melds = state.exposures[String(seat)] || {};
            return Object.keys(melds).sort((a, b) => Number(a) - Number(b)).map(key => melds[key]);
        });
    }
    if (state.charlestonPasses && !Array.isArray(state.charlestonPasses)) {
        state.charlestonPasses = [0, 1, 2, 3].map(seat => state.charlestonPasses[String(seat)] ?? null);
    }
    return decoded;
}

// LocalStorage Room state listener to mock multiplayer across tabs
window.addEventListener('storage', (event) => {
    if (!useFirebase && event.key && event.key.startsWith('mahjong_room_')) {
        const roomId = event.key.replace('mahjong_room_', '');
        if (listeners[roomId]) {
            try {
                const data = JSON.parse(event.newValue);
                if (data) listeners[roomId](data);
            } catch (e) {
                console.error("Failed to parse local room state:", e);
            }
        }
    }
});

export async function initFirebase() {
    if (db) return;
    
    // Attempt to load Firebase config from localStorage if saved by user, or fallback to default config
    const savedConfig = localStorage.getItem('mahjong_firebase_config');
    let config = null;
    if (savedConfig) {
        try {
            config = JSON.parse(savedConfig);
        } catch (e) {
            console.warn("Failed to parse saved Firebase config:", e);
        }
    }
    if (!config) {
        config = defaultFirebaseConfig;
    }

    if (config) {
        try {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js");
            const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
            
            const app = initializeApp(config);
            db = getFirestore(app);
            useFirebase = true;
            console.log("Firebase initialized successfully for multiplayer.");
        } catch (e) {
            console.warn("Failed to initialize Firebase, falling back to LocalStorage sync:", e);
        }
    }
}

export function isFirebaseConnected() {
    return useFirebase;
}

export function saveFirebaseConfig(config) {
    try {
        localStorage.setItem('mahjong_firebase_config', JSON.stringify(config));
        return true;
    } catch (e) {
        return false;
    }
}

export async function createRoom(roomId, hostName) {
    const initialState = {
        roomId,
        status: 'lobby', // lobby, charleston, playing, ended
        players: [
            { id: 'p1', name: hostName, isHost: true, active: true, seat: 0 }
        ],
        gameState: {
            wall: [],
            discards: [],
            currentTurn: 0,
            activeDiscard: null,
            claimPrompt: null,
            lastClaimUndo: null,
            canExchangeJoker: false,
            winnerMessage: null,
            roundResult: null,
            exposures: [[], [], [], []],
            charlestonStep: 0,
            charlestonPasses: [null, null, null, null],
            lastActionTime: Date.now()
        }
    };

    if (useFirebase) {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        await setDoc(doc(db, 'rooms', roomId), encodeRoom(initialState));
    } else {
        localStorage.setItem(`mahjong_room_${roomId}`, JSON.stringify(initialState));
    }
    return initialState;
}

export async function joinRoom(roomId, playerName) {
    let state = null;
    
    if (useFirebase) {
        const { doc, runTransaction } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const docRef = doc(db, 'rooms', roomId);
        await runTransaction(db, async transaction => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) throw new Error("Room not found.");
            state = decodeRoom(docSnap.data());
            if (state.status !== 'lobby') throw new Error("Game has already started.");
            if (state.players.length >= 4) {
                throw new Error("Room is full.");
            }
            const pId = `p${state.players.length + 1}`;
            const newPlayer = { id: pId, name: playerName, isHost: false, active: true, seat: state.players.length };
            state.players.push(newPlayer);
            transaction.update(docRef, { players: state.players });
        });
    } else {
        const key = `mahjong_room_${roomId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            state = JSON.parse(raw);
            if (state.players.length >= 4) {
                throw new Error("Room is full.");
            }
            const pId = `p${state.players.length + 1}`;
            const newPlayer = { id: pId, name: playerName, isHost: false, active: true, seat: state.players.length };
            state.players.push(newPlayer);
            localStorage.setItem(key, JSON.stringify(state));
        } else {
            throw new Error("Room not found.");
        }
    }
    return state;
}

export async function subscribeToRoom(roomId, callback) {
    listeners[roomId] = callback;

    if (useFirebase) {
        const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const unsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
            if (docSnap.exists()) {
                callback(decodeRoom(docSnap.data()));
            }
        });
        return unsub;
    } else {
        const raw = localStorage.getItem(`mahjong_room_${roomId}`);
        if (raw) callback(JSON.parse(raw));
        // Return dummy unsubscribe
        return () => {
            delete listeners[roomId];
        };
    }
}

// Atomically read, transform, and replace a room. The transform must be synchronous
// and return the complete next room state.
export async function mutateRoom(roomId, transform) {
    if (useFirebase) {
        const { doc, runTransaction } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const docRef = doc(db, 'rooms', roomId);
        let result = null;
        await runTransaction(db, async transaction => {
            const snapshot = await transaction.get(docRef);
            if (!snapshot.exists()) throw new Error("Room not found.");
            result = transform(decodeRoom(snapshot.data()));
            if (!result) throw new Error("Room action was rejected.");
            if (result.gameState) result.gameState.lastActionTime = Date.now();
            transaction.set(docRef, encodeRoom(result));
        });
        return result;
    }

    const key = `mahjong_room_${roomId}`;
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Room not found.");
    const result = transform(JSON.parse(raw));
    if (!result) throw new Error("Room action was rejected.");
    if (result.gameState) result.gameState.lastActionTime = Date.now();
    localStorage.setItem(key, JSON.stringify(result));
    if (listeners[roomId]) listeners[roomId](result);
    return result;
}

export async function updateRoom(roomId, nextState) {
    // Inject timestamp to force update events
    if (nextState.gameState) {
        nextState.gameState.lastActionTime = Date.now();
    }
    
    if (useFirebase) {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        await updateDoc(doc(db, 'rooms', roomId), encodeRoom(nextState));
    } else {
        localStorage.setItem(`mahjong_room_${roomId}`, JSON.stringify(nextState));
        // Force callback locally because localStorage events don't fire on the same tab
        if (listeners[roomId]) {
            listeners[roomId](nextState);
        }
    }
}

export async function leaveRoom(roomId, playerIndex) {
    if (useFirebase) {
        const { doc, getDoc, setDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const docRef = doc(db, 'rooms', roomId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const state = decodeRoom(docSnap.data());
            if (state.status === 'lobby') {
                state.players.splice(playerIndex, 1);
                state.players.forEach((player, seat) => { player.seat = seat; });
            } else if (state.players[playerIndex]) {
                state.players[playerIndex] = {
                    ...state.players[playerIndex],
                    name: `${state.players[playerIndex].name.replace(/ \(Bot\)$/, '')} (Bot)`,
                    isBot: true,
                    isHost: false,
                    active: true
                };
            }
            const humans = state.players.filter(player => !player.isBot);
            if (humans.length === 0) {
                await deleteDoc(docRef);
            } else {
                if (!state.players.some(player => player.isHost)) {
                    const successor = state.players.find(player => !player.isBot) || state.players[0];
                    if (successor) successor.isHost = true;
                }
                await setDoc(docRef, encodeRoom(state));
            }
        }
    } else {
        const key = `mahjong_room_${roomId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            const state = JSON.parse(raw);
            if (state.status === 'lobby') {
                state.players.splice(playerIndex, 1);
                state.players.forEach((player, seat) => { player.seat = seat; });
            } else if (state.players[playerIndex]) {
                state.players[playerIndex] = { ...state.players[playerIndex], isBot: true, isHost: false, active: true };
            }
            if (!state.players.some(player => !player.isBot)) {
                localStorage.removeItem(key);
            } else {
                if (!state.players.some(player => player.isHost)) state.players[0].isHost = true;
                localStorage.setItem(key, JSON.stringify(state));
            }
        }
    }
}
