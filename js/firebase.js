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
            exposures: [[], [], [], []],
            charlestonStep: 0,
            charlestonPasses: [[], [], [], []],
            lastActionTime: Date.now()
        }
    };

    if (useFirebase) {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        await setDoc(doc(db, 'rooms', roomId), initialState);
    } else {
        localStorage.setItem(`mahjong_room_${roomId}`, JSON.stringify(initialState));
    }
    return initialState;
}

export async function joinRoom(roomId, playerName) {
    let state = null;
    
    if (useFirebase) {
        const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const docRef = doc(db, 'rooms', roomId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            state = docSnap.data();
            if (state.players.length >= 4) {
                throw new Error("Room is full.");
            }
            const pId = `p${state.players.length + 1}`;
            const newPlayer = { id: pId, name: playerName, isHost: false, active: true, seat: state.players.length };
            state.players.push(newPlayer);
            await updateDoc(docRef, { players: state.players });
        } else {
            throw new Error("Room not found.");
        }
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
                callback(docSnap.data());
            }
        });
        return unsub;
    } else {
        // Return dummy unsubscribe
        return () => {
            delete listeners[roomId];
        };
    }
}

export async function updateRoom(roomId, nextState) {
    // Inject timestamp to force update events
    if (nextState.gameState) {
        nextState.gameState.lastActionTime = Date.now();
    }
    
    if (useFirebase) {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        await updateDoc(doc(db, 'rooms', roomId), nextState);
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
        const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const docRef = doc(db, 'rooms', roomId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const state = docSnap.data();
            state.players.splice(playerIndex, 1);
            // Re-index seats
            state.players.forEach((p, idx) => p.seat = idx);
            if (state.players.length === 0) {
                // Delete if empty (can do deleteDoc if desired)
            } else {
                await updateDoc(docRef, { players: state.players });
            }
        }
    } else {
        const key = `mahjong_room_${roomId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            const state = JSON.parse(raw);
            state.players.splice(playerIndex, 1);
            state.players.forEach((p, idx) => p.seat = idx);
            if (state.players.length === 0) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(state));
            }
        }
    }
}
