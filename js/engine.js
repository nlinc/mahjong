/* Core Mahjong Rules and Validation Engine */

import { buildExpandedPracticeHands } from './practice-card.js?v=1';

export const SUITS = {
    DOTS: 'dots',
    BAMS: 'bams',
    CRAKES: 'crakes',
    WINDS: 'winds',
    DRAGONS: 'dragons',
    FLOWERS: 'flowers',
    JOKERS: 'jokers'
};

// Tile representations:
// Dots/Bams/Crakes values: 1-9
// Winds values: E, S, W, N
// Dragons values: G (Green), R (Red), W (White / Sope)
// Flowers values: F
// Jokers values: J

export function createWall() {
    const wall = [];
    let id = 1;

    // 1. Suits: Dots, Bams, Crakes (1-9, 4 of each)
    const suitTypes = [SUITS.DOTS, SUITS.BAMS, SUITS.CRAKES];
    for (const suit of suitTypes) {
        for (let val = 1; val <= 9; val++) {
            for (let copy = 0; copy < 4; copy++) {
                wall.push({ id: id++, suit, val });
            }
        }
    }

    // 2. Winds (E, S, W, N, 4 of each)
    const winds = ['E', 'S', 'W', 'N'];
    for (const val of winds) {
        for (let copy = 0; copy < 4; copy++) {
            wall.push({ id: id++, suit: SUITS.WINDS, val });
        }
    }

    // 3. Dragons (G, R, W, 4 of each)
    const dragons = ['G', 'R', 'W'];
    for (const val of dragons) {
        for (let copy = 0; copy < 4; copy++) {
            wall.push({ id: id++, suit: SUITS.DRAGONS, val });
        }
    }

    // 4. Flowers (8 total, represented as F)
    for (let copy = 0; copy < 8; copy++) {
        wall.push({ id: id++, suit: SUITS.FLOWERS, val: 'F' });
    }

    // 5. Jokers (8 total, represented as J)
    for (let copy = 0; copy < 8; copy++) {
        wall.push({ id: id++, suit: SUITS.JOKERS, val: 'J' });
    }

    return wall;
}

// Fisher-Yates Shuffle
export function shuffle(wall) {
    for (let i = wall.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wall[i], wall[j]] = [wall[j], wall[i]];
    }
    return wall;
}

// Sorting Helpers
export function sortHandBySuit(hand) {
    const suitOrder = [
        SUITS.FLOWERS,
        SUITS.JOKERS,
        SUITS.DOTS,
        SUITS.BAMS,
        SUITS.CRAKES,
        SUITS.WINDS,
        SUITS.DRAGONS
    ];
    
    const windOrder = ['E', 'S', 'W', 'N'];
    const dragonOrder = ['G', 'R', 'W'];

    return [...hand].sort((a, b) => {
        if (a.suit !== b.suit) {
            return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        }
        if (a.suit === SUITS.DOTS || a.suit === SUITS.BAMS || a.suit === SUITS.CRAKES) {
            return a.val - b.val;
        }
        if (a.suit === SUITS.WINDS) {
            return windOrder.indexOf(a.val) - windOrder.indexOf(b.val);
        }
        if (a.suit === SUITS.DRAGONS) {
            return dragonOrder.indexOf(a.val) - dragonOrder.indexOf(b.val);
        }
        return 0;
    });
}

export function sortHandByValue(hand) {
    const valRank = (tile) => {
        if (tile.suit === SUITS.JOKERS) return 100;
        if (tile.suit === SUITS.FLOWERS) return 90;
        if (tile.suit === SUITS.WINDS) {
            const wOrder = { 'E': 71, 'S': 72, 'W': 73, 'N': 74 };
            return wOrder[tile.val];
        }
        if (tile.suit === SUITS.DRAGONS) {
            const dOrder = { 'G': 81, 'R': 82, 'W': 83 };
            return dOrder[tile.val];
        }
        // Suit numbers
        return tile.val; // 1-9
    };

    return [...hand].sort((a, b) => {
        const rA = valRank(a);
        const rB = valRank(b);
        if (rA !== rB) return rA - rB;
        // If same value, sort by suit
        const suitOrder = [SUITS.DOTS, SUITS.BAMS, SUITS.CRAKES];
        return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    });
}

// Compact practice hand-card definition templates. Annual cards can be supplied separately.
// Group Size Map:
// single = 1, pair = 2, pung = 3, kong = 4, quint = 5, sextet = 6
export const CARD_CATEGORIES = {
    CONSEC: 'consec',
    NUM_2468: '2468',
    LIKE: 'like',
    WINDS_DRAGONS: 'winds',
    NUM_369: '369',
    SINGLES_PAIRS: 'singles',
    ODDS: 'odds',
    QUINTS: 'quints',
    CUSTOM: 'custom'
};

export const HANDS_CARD = {
    [CARD_CATEGORIES.CONSEC]: [
        {
            id: 'consec_1',
            display: 'F F F F 11111 22222',
            desc: '4 Flowers, Quint of any suit number, Quint of next consecutive number in SAME suit.',
            isConcealed: false,
            groups: [
                { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 5, suit: 'A', isRelative: true, relOffset: 0 },
                { size: 5, suit: 'A', isRelative: true, relOffset: 1 }
            ]
        },
        {
            id: 'consec_2',
            display: '11 22 333 4444 555',
            desc: 'Consecutive run in same suit. Pairs of 1st/2nd, Pung of 3rd, Kong of 4th, Pung of 5th.',
            isConcealed: false,
            groups: [
                { size: 2, suit: 'A', isRelative: true, relOffset: 0 },
                { size: 2, suit: 'A', isRelative: true, relOffset: 1 },
                { size: 3, suit: 'A', isRelative: true, relOffset: 2 },
                { size: 4, suit: 'A', isRelative: true, relOffset: 3 },
                { size: 3, suit: 'A', isRelative: true, relOffset: 4 }
            ]
        },
        {
            id: 'consec_3',
            display: '111 222 3333 4444',
            desc: 'Any 3 consecutive numbers in 2 different suits (Pung Pung same suit, Kong Kong other suit).',
            isConcealed: false,
            groups: [
                { size: 3, suit: 'A', isRelative: true, relOffset: 0 },
                { size: 3, suit: 'A', isRelative: true, relOffset: 1 },
                { size: 4, suit: 'B', isRelative: true, relOffset: 2 },
                { size: 4, suit: 'B', isRelative: true, relOffset: 3 }
            ]
        }
    ],
    [CARD_CATEGORIES.NUM_2468]: [
        {
            id: '2468_1',
            display: 'F F 22 44 6666 8888',
            desc: 'Pair Flowers, Pairs of 2 and 4, Kongs of 6 and 8 in same suit.',
            isConcealed: false,
            groups: [
                { size: 2, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 2, suit: 'A', val: 2, isRelative: false },
                { size: 2, suit: 'A', val: 4, isRelative: false },
                { size: 4, suit: 'A', val: 6, isRelative: false },
                { size: 4, suit: 'A', val: 8, isRelative: false }
            ]
        },
        {
            id: '2468_2',
            display: '222 444 6666 8888',
            desc: 'Even numbers in 2 different suits. Pung of 2, Pung of 4 (Suit A); Kong of 6, Kong of 8 (Suit B).',
            isConcealed: false,
            groups: [
                { size: 3, suit: 'A', val: 2, isRelative: false },
                { size: 3, suit: 'A', val: 4, isRelative: false },
                { size: 4, suit: 'B', val: 6, isRelative: false },
                { size: 4, suit: 'B', val: 8, isRelative: false }
            ]
        },
        {
            id: '2468_3',
            display: 'F F F F 2222 44 66 88',
            desc: 'Flowers, Kong of 2, Pairs of 4, 6, 8 in same suit.',
            isConcealed: false,
            groups: [
                { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 4, suit: 'A', val: 2, isRelative: false },
                { size: 2, suit: 'A', val: 4, isRelative: false },
                { size: 2, suit: 'A', val: 6, isRelative: false },
                { size: 2, suit: 'A', val: 8, isRelative: false }
            ]
        }
    ],
    [CARD_CATEGORIES.LIKE]: [
        {
            id: 'like_1',
            display: 'F F F F 1111 1111 11',
            desc: 'Flowers, and Kongs of same number in 2 different suits, Pair of same number in 3rd suit.',
            isConcealed: false,
            groups: [
                { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 4, suit: 'A', isRelative: true, relOffset: 0 },
                { size: 4, suit: 'B', isRelative: true, relOffset: 0 },
                { size: 2, suit: 'C', isRelative: true, relOffset: 0 }
            ]
        }
    ],
    [CARD_CATEGORIES.WINDS_DRAGONS]: [
        {
            id: 'winds_1',
            display: 'F F NNN EEE WWW SSS',
            desc: 'Pair Flowers, and Pungs of North, East, West, South. Exposeable.',
            isConcealed: false,
            groups: [
                { size: 2, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 3, suit: SUITS.WINDS, val: 'N', isRelative: false },
                { size: 3, suit: SUITS.WINDS, val: 'E', isRelative: false },
                { size: 3, suit: SUITS.WINDS, val: 'W', isRelative: false },
                { size: 3, suit: SUITS.WINDS, val: 'S', isRelative: false }
            ]
        },
        {
            id: 'winds_2',
            display: 'EEE WWW DD DD 111 111',
            desc: 'Pung East, Pung West, pair of matching Dragons, two matching Pungs of numbers.',
            isConcealed: false,
            groups: [
                { size: 3, suit: SUITS.WINDS, val: 'E', isRelative: false },
                { size: 3, suit: SUITS.WINDS, val: 'W', isRelative: false },
                { size: 2, suit: SUITS.DRAGONS, val: 'R', isRelative: false },
                { size: 3, suit: 'A', isRelative: true, relOffset: 0 },
                { size: 3, suit: 'B', isRelative: true, relOffset: 0 }
            ]
        }
    ],
    [CARD_CATEGORIES.NUM_369]: [
        {
            id: '369_1',
            display: 'F F F F 3333 6666 99',
            desc: 'Flowers, Kongs of 3, 6, and Pair of 9 in same suit.',
            isConcealed: false,
            groups: [
                { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 4, suit: 'A', val: 3, isRelative: false },
                { size: 4, suit: 'A', val: 6, isRelative: false },
                { size: 2, suit: 'A', val: 9, isRelative: false }
            ]
        },
        {
            id: '369_2',
            display: '333 666 9999 9999',
            desc: '3, 6, 9 in 2 different suits. Pung of 3, Pung of 6 (Suit A); two Kongs of 9 (Suit B & C).',
            isConcealed: false,
            groups: [
                { size: 3, suit: 'A', val: 3, isRelative: false },
                { size: 3, suit: 'A', val: 6, isRelative: false },
                { size: 4, suit: 'B', val: 9, isRelative: false },
                { size: 4, suit: 'C', val: 9, isRelative: false }
            ]
        }
    ],
    [CARD_CATEGORIES.SINGLES_PAIRS]: [
        {
            id: 'singles_1',
            display: 'F F 11 22 33 44 55 66',
            desc: 'Flowers, and 6 pairs of consecutive numbers in same suit. Concealed.',
            isConcealed: true,
            groups: [
                { size: 2, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
                { size: 2, suit: 'A', isRelative: true, relOffset: 0 },
                { size: 2, suit: 'A', isRelative: true, relOffset: 1 },
                { size: 2, suit: 'A', isRelative: true, relOffset: 2 },
                { size: 2, suit: 'A', isRelative: true, relOffset: 3 },
                { size: 2, suit: 'A', isRelative: true, relOffset: 4 },
                { size: 2, suit: 'A', isRelative: true, relOffset: 5 }
            ]
        },
        {
            id: 'singles_2',
            display: 'EE SS WW NN DD DD 11',
            desc: 'Pairs of East, South, West, North, pair of matching Dragon, pair of matching number. Concealed.',
            isConcealed: true,
            groups: [
                { size: 2, suit: SUITS.WINDS, val: 'E', isRelative: false },
                { size: 2, suit: SUITS.WINDS, val: 'S', isRelative: false },
                { size: 2, suit: SUITS.WINDS, val: 'W', isRelative: false },
                { size: 2, suit: SUITS.WINDS, val: 'N', isRelative: false },
                { size: 2, suit: SUITS.DRAGONS, val: 'G', isRelative: false },
                { size: 2, suit: SUITS.DRAGONS, val: 'R', isRelative: false },
                { size: 2, suit: 'A', isRelative: true, relOffset: 0 }
            ]
        }
    ]
};

// Add the larger original practice set without changing the tested starter hands above.
const expandedHands = buildExpandedPracticeHands();
for (const [category, hands] of Object.entries(expandedHands)) {
    HANDS_CARD[category] = [...(HANDS_CARD[category] || []), ...hands];
}

const CUSTOM_CARD_STORAGE_KEY = 'mahjong-custom-hands-v1';

function readSavedCustomHands() {
    try {
        const saved = JSON.parse(globalThis.localStorage?.getItem(CUSTOM_CARD_STORAGE_KEY) || '[]');
        return Array.isArray(saved) ? saved.filter(isValidSavedHand) : [];
    } catch {
        return [];
    }
}

function isValidSavedHand(hand) {
    return hand && typeof hand.id === 'string' && typeof hand.display === 'string' &&
        Array.isArray(hand.groups) && hand.groups.reduce((sum, group) => sum + Number(group.size || 0), 0) === 14;
}

HANDS_CARD[CARD_CATEGORIES.CUSTOM] = readSavedCustomHands();

function persistCustomHands() {
    try {
        globalThis.localStorage?.setItem(CUSTOM_CARD_STORAGE_KEY, JSON.stringify(HANDS_CARD[CARD_CATEGORIES.CUSTOM]));
    } catch {
        // Private browsing or locked-down storage should not break play.
    }
}

// Custom notation examples: FF 1111A 2222B 3333C, NN EEE 4444A RRRRR.
// A/B/C mean distinct numbered suits; 0 represents the White Dragon (soap).
export function parseCustomPattern(pattern) {
    const tokens = String(pattern || '').toUpperCase().trim().split(/[\s,|/]+/).filter(Boolean);
    if (!tokens.length) throw new Error('Enter a 14-tile pattern.');

    const groups = tokens.map(token => {
        if (/^F{1,6}$/.test(token)) return { size: token.length, suit: SUITS.FLOWERS, val: 'F', isRelative: false };
        if (/^([1-9])\1{0,5}[ABC]$/.test(token)) {
            const suit = token.at(-1);
            const digits = token.slice(0, -1);
            return { size: digits.length, suit, val: Number(digits[0]), isRelative: false };
        }
        if (/^([ESWN])\1{0,5}$/.test(token)) return { size: token.length, suit: SUITS.WINDS, val: token[0], isRelative: false };
        if (/^([RG0])\1{0,5}$/.test(token)) return { size: token.length, suit: SUITS.DRAGONS, val: token[0] === '0' ? 'W' : token[0], isRelative: false };
        throw new Error(`“${token}” is not valid notation.`);
    });

    const tileCount = groups.reduce((sum, group) => sum + group.size, 0);
    if (tileCount !== 14) throw new Error(`The pattern has ${tileCount} tiles; it must have exactly 14.`);
    const suitVars = new Set(groups.map(group => group.suit).filter(suit => ['A', 'B', 'C'].includes(suit)));
    if (suitVars.has('C') && (!suitVars.has('A') || !suitVars.has('B'))) throw new Error('Use A and B before using suit C.');
    if (suitVars.has('B') && !suitVars.has('A')) throw new Error('Use suit A before using suit B.');
    return groups;
}

export function saveCustomHand({ name, pattern, isConcealed = false }) {
    const cleanName = String(name || '').trim().slice(0, 60) || 'My custom hand';
    const cleanPattern = String(pattern || '').toUpperCase().trim().replace(/\s+/g, ' ');
    const groups = parseCustomPattern(cleanPattern);
    const customHand = {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        display: cleanPattern,
        desc: cleanName,
        groups,
        isConcealed: Boolean(isConcealed),
        isCustom: true
    };
    HANDS_CARD[CARD_CATEGORIES.CUSTOM].push(customHand);
    persistCustomHands();
    return customHand;
}

export function deleteCustomHand(id) {
    const hands = HANDS_CARD[CARD_CATEGORIES.CUSTOM];
    const index = hands.findIndex(hand => hand.id === id);
    if (index < 0) return false;
    hands.splice(index, 1);
    persistCustomHands();
    return true;
}

// Hand Matching Engine Helpers
// Returns frequency of non-Joker tiles in hand: { 'dots_5': 2, 'flowers_F': 1 }
export function getTileFrequencies(tiles) {
    const freq = {};
    let jokers = 0;
    for (const t of tiles) {
        if (t.suit === SUITS.JOKERS) {
            jokers++;
        } else {
            const key = `${t.suit}_${t.val}`;
            freq[key] = (freq[key] || 0) + 1;
        }
    }
    return { freq, jokers };
}

// Core Matching logic: Check if we can satisfy the groups using non-jokers and jokers.
// A group template is: { size: N, suit: 'A' | 'B' | 'C' | 'any' | 'flower' | 'dragon' | 'wind', val: 'any' | valValue, isRelative: boolean, relOffset: number }
// size: 1 (single), 2 (pair), 3 (pung), 4 (kong), 5 (quint), 6 (sextet)
// Rules: Jokers CANNOT substitute in singles (size=1) or pairs (size=2).
export function checkGroupMatch(reqGroups, tiles, exposures = []) {
    const { freq, jokers } = getTileFrequencies(tiles);
    
    // We will do backtrack-based mapping of suits (A, B, C) to actual suits (dots, bams, crakes)
    // and values (e.g. 1st consec index) to actual numbers (1 to 9).
    const numericSuits = [SUITS.DOTS, SUITS.BAMS, SUITS.CRAKES];
    
    // 1. Identify distinct relative value variables. 
    // In our patterns, relative values are offsets from a base value X.
    let needsRelVal = false;
    for (const g of reqGroups) {
        if (g.isRelative) {
            needsRelVal = true;
            break;
        }
    }

    const baseValOptions = needsRelVal ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [0];
    
    // Find distinct suit letters used: e.g. ['A', 'B']
    const suitVars = [...new Set(reqGroups.map(g => g.suit).filter(s => s === 'A' || s === 'B' || s === 'C'))];

    // Permute suit variables mapping to actual suits
    function getSuitMappings() {
        if (suitVars.length === 0) return [{}];
        const mappings = [];
        if (suitVars.length === 1) {
            for (const s of numericSuits) {
                mappings.push({ [suitVars[0]]: s });
            }
        } else if (suitVars.length === 2) {
            for (const s1 of numericSuits) {
                for (const s2 of numericSuits) {
                    if (s1 !== s2) {
                        mappings.push({ [suitVars[0]]: s1, [suitVars[1]]: s2 });
                    }
                }
            }
        } else if (suitVars.length === 3) {
            for (const s1 of numericSuits) {
                for (const s2 of numericSuits) {
                    for (const s3 of numericSuits) {
                        if (s1 !== s2 && s1 !== s3 && s2 !== s3) {
                            mappings.push({ [suitVars[0]]: s1, [suitVars[1]]: s2, [suitVars[2]]: s3 });
                        }
                    }
                }
            }
        }
        return mappings;
    }

    const suitMappings = getSuitMappings();

    for (const baseVal of baseValOptions) {
        // Validate if baseVal + offset does not exceed 9
        let rangeValid = true;
        for (const g of reqGroups) {
            if (g.isRelative) {
                const val = baseVal + g.relOffset;
                if (val < 1 || val > 9) {
                    rangeValid = false;
                    break;
                }
            }
        }
        if (!rangeValid) continue;

        for (const suitMap of suitMappings) {
            // Attempt to match the hand under this combination of baseVal and suitMap
            if (exposuresFitGroups(reqGroups, exposures, baseVal, suitMap) &&
                tryMatchCombination(reqGroups, freq, jokers, baseVal, suitMap)) {
                return true;
            }
        }
    }

    return false;
}

function tryMatchCombination(reqGroups, freq, availableJokers, baseVal, suitMap) {
    // Clone freq to manipulate
    const freqCopy = { ...freq };
    let jokersLeft = availableJokers;

    // First pass: Satisfy groups of size 1 (singles) and size 2 (pairs).
    // Jokers CANNOT be used to satisfy size 1 or size 2!
    for (const g of reqGroups) {
        if (g.size <= 2) {
            const actualTileKey = getActualTileKey(g, baseVal, suitMap);
            const count = freqCopy[actualTileKey] || 0;
            if (count < g.size) {
                return false; // Can't satisfy without jokers, and jokers are forbidden in singles/pairs
            }
            freqCopy[actualTileKey] -= g.size;
        }
    }

    // Second pass: Satisfy groups of size >= 3 (pungs, kongs, quints, sextets).
    // Jokers CAN be used here.
    for (const g of reqGroups) {
        if (g.size > 2) {
            const actualTileKey = getActualTileKey(g, baseVal, suitMap);
            const count = freqCopy[actualTileKey] || 0;
            
            // We use as many natural tiles as we can, up to the group size
            const naturalUsed = Math.min(count, g.size);
            freqCopy[actualTileKey] -= naturalUsed;
            
            const gap = g.size - naturalUsed;
            if (gap > 0) {
                if (jokersLeft >= gap) {
                    jokersLeft -= gap;
                } else {
                    return false; // Not enough jokers to fill the gap
                }
            }
        }
    }

    // Verify if there are leftover non-joker tiles that weren't assigned
    let leftoverCount = 0;
    for (const k in freqCopy) {
        leftoverCount += freqCopy[k];
    }

    // The match is valid if all 14 tiles are accounted for
    // (meaning leftoverCount + jokersLeft === 0, because hand is 14 tiles)
    return (leftoverCount + jokersLeft) === 0;
}

function getActualTileKey(group, baseVal, suitMap) {
    let suit = group.suit;
    if (suitMap[suit]) {
        suit = suitMap[suit];
    }
    
    let val = group.val;
    if (group.isRelative) {
        val = baseVal + group.relOffset;
    }
    return `${suit}_${val}`;
}

// Every exposed meld must map to one complete, exposeable group in the card
// pattern under the same suit/value interpretation as the rest of the hand.
function exposuresFitGroups(groups, exposures, baseVal, suitMap) {
    if (!exposures?.length) return true;
    const usedGroups = new Set();

    const assignExposure = exposureIndex => {
        if (exposureIndex >= exposures.length) return true;
        const meld = exposures[exposureIndex];
        if (!Array.isArray(meld) || meld.length < 3 || meld.length > 6) return false;
        const naturalTiles = meld.filter(tile => tile.suit !== SUITS.JOKERS);
        if (!naturalTiles.length) return false;

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            if (usedGroups.has(groupIndex)) continue;
            const group = groups[groupIndex];
            if (group.size !== meld.length || group.size < 3 || group.suit === SUITS.FLOWERS) continue;
            const expectedKey = getActualTileKey(group, baseVal, suitMap);
            const matches = naturalTiles.every(tile => `${tile.suit}_${tile.val}` === expectedKey);
            if (!matches) continue;
            usedGroups.add(groupIndex);
            if (assignExposure(exposureIndex + 1)) return true;
            usedGroups.delete(groupIndex);
        }
        return false;
    };

    return assignExposure(0);
}


// Generalized Hand Matching Scoring (returns matchCount out of 14)
export function getHandScore(groups, tiles, exposures = []) {
    const { freq, jokers } = getTileFrequencies(tiles);
    const numericSuits = [SUITS.DOTS, SUITS.BAMS, SUITS.CRAKES];
    
    let needsRelVal = false;
    for (const g of groups) {
        if (g.isRelative) {
            needsRelVal = true;
            break;
        }
    }

    const baseValOptions = needsRelVal ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [0];
    const suitVars = [...new Set(groups.map(g => g.suit).filter(s => s === 'A' || s === 'B' || s === 'C'))];

    function getSuitMappings() {
        if (suitVars.length === 0) return [{}];
        const mappings = [];
        if (suitVars.length === 1) {
            for (const s of numericSuits) {
                mappings.push({ [suitVars[0]]: s });
            }
        } else if (suitVars.length === 2) {
            for (const s1 of numericSuits) {
                for (const s2 of numericSuits) {
                    if (s1 !== s2) {
                        mappings.push({ [suitVars[0]]: s1, [suitVars[1]]: s2 });
                    }
                }
            }
        } else if (suitVars.length === 3) {
            for (const s1 of numericSuits) {
                for (const s2 of numericSuits) {
                    for (const s3 of numericSuits) {
                        if (s1 !== s2 && s1 !== s3 && s2 !== s3) {
                            mappings.push({ [suitVars[0]]: s1, [suitVars[1]]: s2, [suitVars[2]]: s3 });
                        }
                    }
                }
            }
        }
        return mappings;
    }

    const suitMappings = getSuitMappings();
    let maxMatchCount = 0;

    for (const baseVal of baseValOptions) {
        let rangeValid = true;
        for (const g of groups) {
            if (g.isRelative) {
                const val = baseVal + g.relOffset;
                if (val < 1 || val > 9) {
                    rangeValid = false;
                    break;
                }
            }
        }
        if (!rangeValid) continue;

        for (const suitMap of suitMappings) {
            if (!exposuresFitGroups(groups, exposures, baseVal, suitMap)) continue;
            const score = evalCombinationScore(groups, freq, jokers, baseVal, suitMap);
            if (score > maxMatchCount) {
                maxMatchCount = score;
            }
        }
    }

    return maxMatchCount;
}

function evalCombinationScore(reqGroups, freq, availableJokers, baseVal, suitMap) {
    const freqCopy = { ...freq };
    let jokersLeft = availableJokers;
    let matchCount = 0;

    // First pass: Satisfy size 1 and 2 groups (no Jokers allowed)
    for (const g of reqGroups) {
        if (g.size <= 2) {
            const actualTileKey = getActualTileKey(g, baseVal, suitMap);
            const count = freqCopy[actualTileKey] || 0;
            const naturalUsed = Math.min(count, g.size);
            freqCopy[actualTileKey] -= naturalUsed;
            matchCount += naturalUsed;
        }
    }

    // Second pass: Satisfy size >= 3 groups (Jokers allowed)
    for (const g of reqGroups) {
        if (g.size > 2) {
            const actualTileKey = getActualTileKey(g, baseVal, suitMap);
            const count = freqCopy[actualTileKey] || 0;
            const naturalUsed = Math.min(count, g.size);
            freqCopy[actualTileKey] -= naturalUsed;
            matchCount += naturalUsed;
            
            const gap = g.size - naturalUsed;
            if (gap > 0) {
                const jokersUsed = Math.min(jokersLeft, gap);
                jokersLeft -= jokersUsed;
                matchCount += jokersUsed;
            }
        }
    }

    return matchCount;
}

// Evaluate completion percentages for all card hands based on hand tiles
export function analyzeHandStrengths(hand, exposures = []) {
    const results = [];
    const exposedTiles = exposures.flat();
    const completeTiles = [...hand, ...exposedTiles];
    
    for (const cat in HANDS_CARD) {
        for (const item of HANDS_CARD[cat]) {
            if (exposedTiles.length > 0 && item.isConcealed) continue;
            const matchCount = getHandScore(item.groups, completeTiles, exposures);
            if (exposedTiles.length > 0 && matchCount === 0) continue;
            const percentage = Math.round((matchCount / 14) * 100);
            results.push({
                id: item.id,
                display: item.display,
                desc: item.desc,
                category: cat,
                percentage,
                matchCount
            });
        }
    }

    // Sort descending by percentage
    results.sort((a, b) => b.percentage - a.percentage);
    return results;
}

// Check if hand declared Mahjong matches ANY card hand
// Returns { matched: boolean, handInfo: Object | null }
export function checkMahjong(hand, exposures = []) {
    const exposedTiles = exposures.flat();
    const completeHand = [...hand, ...exposedTiles];

    if (completeHand.length !== 14) {
        return { matched: false, reason: "Must have exactly 14 tiles." };
    }

    for (const cat in HANDS_CARD) {
        for (const item of HANDS_CARD[cat]) {
            if (exposedTiles.length > 0 && item.isConcealed) continue;
            if (checkGroupMatch(item.groups, completeHand, exposures)) {
                return { matched: true, handInfo: { ...item, category: cat } };
            }
        }
    }
    return { matched: false, reason: "Hand does not match any pattern on the card." };
}

// Validate claims of discarded tile for other players
// NMJL rules: A discarded tile can be called to complete a Pung, Kong, Quint, or Sextet.
// You CANNOT call a discard to complete a single or pair (except for declaring Mahjong).
// Returns list of valid calls: ['pung', 'kong', 'quint', 'mahjong']
export function checkDiscardClaims(playerHand, discardTile, exposures = []) {
    const claims = [];
    const simulatedHand = [...playerHand, discardTile];

    // Check if discard completes Mahjong
    if (checkMahjong(simulatedHand, exposures).matched) {
        claims.push('mahjong');
    }

    // Filter out Jokers to check group calls
    const { freq, jokers } = getTileFrequencies(playerHand);
    
    // We can complete a Pung (3), Kong (4), Quint (5) if:
    // we have enough matching natural tiles + jokers
    const key = `${discardTile.suit}_${discardTile.val}`;
    const naturalCount = freq[key] || 0;
    
    // Jokers cannot match jokers/flowers in this standard call check
    if (discardTile.suit !== SUITS.JOKERS && discardTile.suit !== SUITS.FLOWERS) {
        // Pung requires 2 matching tiles (natural + jokers >= 2)
        if (naturalCount + jokers >= 2 && claimPreservesCardOptions(playerHand, discardTile, 'pung', exposures)) {
            claims.push('pung');
        }
        // Kong requires 3 matching tiles
        if (naturalCount + jokers >= 3 && claimPreservesCardOptions(playerHand, discardTile, 'kong', exposures)) {
            claims.push('kong');
        }
        // Quint requires 4 matching tiles
        if (naturalCount + jokers >= 4 && claimPreservesCardOptions(playerHand, discardTile, 'quint', exposures)) {
            claims.push('quint');
        }
    }

    return claims;
}

// Build a legal exposed meld without ever consuming unrelated rack tiles.
export function buildClaimMeld(playerHand, discardTile, type) {
    const size = { pung: 3, kong: 4, quint: 5 }[type];
    if (!size || !discardTile || discardTile.suit === SUITS.JOKERS || discardTile.suit === SUITS.FLOWERS) return null;
    const needed = size - 1;
    const naturals = playerHand.filter(tile => tile.suit === discardTile.suit && tile.val === discardTile.val);
    const jokers = playerHand.filter(tile => tile.suit === SUITS.JOKERS);
    const chosen = naturals.slice(0, needed);
    if (chosen.length < needed) chosen.push(...jokers.slice(0, needed - chosen.length));
    if (chosen.length !== needed) return null;
    return { meld: [...chosen, discardTile], consumedIds: chosen.map(tile => tile.id) };
}

function claimPreservesCardOptions(playerHand, discardTile, type, exposures) {
    const claim = buildClaimMeld(playerHand, discardTile, type);
    if (!claim) return false;
    return analyzeHandStrengths([], [...(exposures || []), claim.meld]).length > 0;
}

// Restore the state immediately before a call. The caller resolves the restored
// claim window after marking this player as having passed.
export function undoLastClaim(state, seat) {
    const undo = state?.lastClaimUndo;
    if (!undo || undo.seat !== seat || state.currentTurn !== seat || state.claimWindow) return false;
    const exposure = state.exposures?.[seat]?.[undo.exposureIndex];
    if (!exposure || exposure.map(tile => tile.id).join(',') !== undo.meldIds.join(',')) return false;

    state.exposures[seat].splice(undo.exposureIndex, 1);
    state.hands[seat].push(...undo.consumedTiles);
    state.discards.push(undo.claimedTile);
    state.activeDiscard = undo.claimedTile;
    state.claimWindow = undo.priorClaimWindow;
    if (state.claimWindow?.responses) state.claimWindow.responses[String(seat)] = 'pass';
    state.lastClaimUndo = null;
    return true;
}
