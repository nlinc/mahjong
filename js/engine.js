/* Core Mahjong Rules and Validation Engine */

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

// 2026 NMJL Hand Card Definition Templates
// Group Size Map:
// single = 1, pair = 2, pung = 3, kong = 4, quint = 5, sextet = 6
export const CARD_CATEGORIES = {
    CONSEC: 'consec',
    NUM_2468: '2468',
    LIKE: 'like',
    WINDS_DRAGONS: 'winds',
    NUM_369: '369',
    SINGLES_PAIRS: 'singles'
};

export const HANDS_CARD = {
    [CARD_CATEGORIES.CONSEC]: [
        {
            id: 'consec_1',
            display: 'F F F F 11111 22222',
            desc: '4 Flowers, Quint of any suit number, Quint of next consecutive number in SAME suit.',
            isConcealed: false,
            // groups: FFFF (Flower Kong), Quint (X), Quint (Y = X+1)
            matchTest: (tiles) => matchConsecQuint(tiles)
        },
        {
            id: 'consec_2',
            display: '11 22 333 4444 555',
            desc: 'Consecutive run in same suit. Pairs of 1st/2nd, Pung of 3rd, Kong of 4th, Pung of 5th.',
            isConcealed: false,
            matchTest: (tiles) => matchConsecRun22344(tiles)
        },
        {
            id: 'consec_3',
            display: '111 222 3333 4444',
            desc: 'Any 3 consecutive numbers in 2 different suits (Pung Pung same suit, Kong Kong other suit).',
            isConcealed: false,
            matchTest: (tiles) => matchConsecRun3344(tiles)
        }
    ],
    [CARD_CATEGORIES.NUM_2468]: [
        {
            id: '2468_1',
            display: 'F F 22 44 6666 8888',
            desc: 'Pair Flowers, Pairs of 2 and 4, Kongs of 6 and 8 in same suit.',
            isConcealed: false,
            matchTest: (tiles) => match2468AllSame(tiles)
        },
        {
            id: '2468_2',
            display: '222 444 6666 8888',
            desc: 'Even numbers in 2 different suits. Pung of 2, Pung of 4 (Suit A); Kong of 6, Kong of 8 (Suit B).',
            isConcealed: false,
            matchTest: (tiles) => match2468TwoSuits(tiles)
        },
        {
            id: '2468_3',
            display: 'F F F F 2222 4444 6666 8888',
            desc: 'Flowers, and Kongs of 2, 4, 6, 8 in any combinations of suits.',
            isConcealed: false,
            matchTest: (tiles) => match2468WithFlowers(tiles)
        }
    ],
    [CARD_CATEGORIES.LIKE]: [
        {
            id: 'like_1',
            display: 'F F F F 1111 1111 11',
            desc: 'Flowers, and Kongs of same number in 2 different suits, Pair of same number in 3rd suit.',
            isConcealed: false,
            matchTest: (tiles) => matchLikeNumbers(tiles)
        }
    ],
    [CARD_CATEGORIES.WINDS_DRAGONS]: [
        {
            id: 'winds_1',
            display: 'F F NNN EEE WWW SSS',
            desc: 'Pair Flowers, and Pungs of North, East, West, South. Exposeable.',
            isConcealed: false,
            matchTest: (tiles) => matchFourWindKongs(tiles)
        },
        {
            id: 'winds_2',
            display: 'EEE WWW DD DD 111 111',
            desc: 'Pung East, Pung West, pair of matching Dragons, two matching Pungs of numbers.',
            isConcealed: false,
            matchTest: (tiles) => matchWindsDragonsMixed(tiles)
        }
    ],
    [CARD_CATEGORIES.NUM_369]: [
        {
            id: '369_1',
            display: 'F F F F 3333 6666 9999',
            desc: 'Flowers, and Kongs of 3, 6, 9 in same suit.',
            isConcealed: false,
            matchTest: (tiles) => match369SameSuit(tiles)
        },
        {
            id: '369_2',
            display: '333 666 9999 9999',
            desc: '3, 6, 9 in 2 different suits. Pung of 3, Pung of 6 (Suit A); two Kongs of 9 (Suit B & C).',
            isConcealed: false,
            matchTest: (tiles) => match369MixedSuits(tiles)
        }
    ],
    [CARD_CATEGORIES.SINGLES_PAIRS]: [
        {
            id: 'singles_1',
            display: 'F F 11 22 33 44 55 66',
            desc: 'Flowers, and 6 pairs of consecutive numbers in same suit. Concealed.',
            isConcealed: true,
            matchTest: (tiles) => matchSinglesPairsConsec(tiles)
        },
        {
            id: 'singles_2',
            display: 'EE SS WW NN DD DD 11',
            desc: 'Pairs of East, South, West, North, pair of matching Dragon, pair of matching number. Concealed.',
            isConcealed: true,
            matchTest: (tiles) => matchSinglesPairsMixed(tiles)
        }
    ]
};

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
export function checkGroupMatch(reqGroups, tiles) {
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
            if (tryMatchCombination(reqGroups, freq, jokers, baseVal, suitMap)) {
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


/* CARD TEMPLATE MATCHERS IMPLEMENTED VIA GROUP MATCHES */

// 1. Consec 1: FFFF 11111 22222 (4 Flowers, Quint of X, Quint of X+1)
function matchConsecQuint(tiles) {
    const groups = [
        { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
        { size: 5, suit: 'A', isRelative: true, relOffset: 0 },
        { size: 5, suit: 'A', isRelative: true, relOffset: 1 }
    ];
    return checkGroupMatch(groups, tiles);
}

// 2. Consec 2: 11 22 333 4444 555 (Pair X, Pair X+1, Pung X+2, Kong X+3, Pung X+4)
function matchConsecRun22344(tiles) {
    const groups = [
        { size: 2, suit: 'A', isRelative: true, relOffset: 0 },
        { size: 2, suit: 'A', isRelative: true, relOffset: 1 },
        { size: 3, suit: 'A', isRelative: true, relOffset: 2 },
        { size: 4, suit: 'A', isRelative: true, relOffset: 3 },
        { size: 3, suit: 'A', isRelative: true, relOffset: 4 }
    ];
    return checkGroupMatch(groups, tiles);
}

// 3. Consec 3: 111 222 3333 4444 (Pung X, Pung X+1 in Suit A, Kong X+2, Kong X+3 in Suit B)
function matchConsecRun3344(tiles) {
    // 3 consecutive numbers in 2 different suits
    // Or it could be 4 consecutive: X, X+1 (Suit A) and X+2, X+3 (Suit B)
    // Let's implement X, X+1 (Suit A) and X+2, X+3 (Suit B)
    const groups = [
        { size: 3, suit: 'A', isRelative: true, relOffset: 0 },
        { size: 3, suit: 'A', isRelative: true, relOffset: 1 },
        { size: 4, suit: 'B', isRelative: true, relOffset: 2 },
        { size: 4, suit: 'B', isRelative: true, relOffset: 3 }
    ];
    return checkGroupMatch(groups, tiles);
}

// 4. 2468 1: 2222 4444 6666 8888 (Four Kongs of 2, 4, 6, 8 same suit. Total 16 tiles? Wait, hand is 14 tiles!)
// Ah! How does 2468 work in a 14-tile hand?
// Typically: Pair of 2, Pair of 4, Kong of 6, Kong of 8 (2+2+4+4 = 12? No, 2+2+4+6 = 14 tiles)
// NMJL 2468 card usually has:
// - Pung 2, Pung 4, Pung 6, Pung 8, Pair of Flowers = 3+3+3+3+2 = 14 tiles.
// - Or: Pair 2, Pair 4, Kong 6, Kong 8, Pair Flowers = 2+2+4+4+2 = 14.
// Let's implement: Pair 2, Pair 4, Kong 6, Kong 8, Pair Flowers (in same suit A)
function match2468AllSame(tiles) {
    const groups = [
        { size: 2, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
        { size: 2, suit: 'A', val: 2, isRelative: false },
        { size: 2, suit: 'A', val: 4, isRelative: false },
        { size: 4, suit: 'A', val: 6, isRelative: false },
        { size: 4, suit: 'A', val: 8, isRelative: false }
    ];
    return checkGroupMatch(groups, tiles);
}

// 5. 2468 2: 222 444 6666 8888 (Pung 2, Pung 4 (Suit A), Kong 6, Kong 8 (Suit B) = 3+3+4+4 = 14 tiles)
function match2468TwoSuits(tiles) {
    const groups = [
        { size: 3, suit: 'A', val: 2, isRelative: false },
        { size: 3, suit: 'A', val: 4, isRelative: false },
        { size: 4, suit: 'B', val: 6, isRelative: false },
        { size: 4, suit: 'B', val: 8, isRelative: false }
    ];
    return checkGroupMatch(groups, tiles);
}

// 6. 2468 3: FFFF 2222 44 66 88 (Flower Kong, Kong 2, Pair 4, Pair 6, Pair 8 = 4+4+2+2+2 = 14 tiles)
function match2468WithFlowers(tiles) {
    const groups = [
        { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
        { size: 4, suit: 'A', val: 2, isRelative: false },
        { size: 2, suit: 'A', val: 4, isRelative: false },
        { size: 2, suit: 'A', val: 6, isRelative: false },
        { size: 2, suit: 'A', val: 8, isRelative: false }
    ];
    return checkGroupMatch(groups, tiles);
}

// 7. Like Numbers: FFFF 1111 1111 11 (Flower Kong, Kong X in Suit A, Kong X in Suit B, Pair X in Suit C = 4+4+4+2 = 14)
function matchLikeNumbers(tiles) {
    // X is any suit number 1-9
    const mappings = [];
    for (let val = 1; val <= 9; val++) {
        const groups = [
            { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
            { size: 4, suit: 'A', val, isRelative: false },
            { size: 4, suit: 'B', val, isRelative: false },
            { size: 2, suit: 'C', val, isRelative: false }
        ];
        if (checkGroupMatch(groups, tiles)) return true;
    }
    return false;
}

// 8. Winds 1: NNNN EEEE WWWW SSSS (Four wind Kongs - wait, that is 16 tiles!
// In NMJL: Winds hands are usually:
// - Pung North, Pung East, Pung West, Pung South, Pair of Flowers = 3+3+3+3+2 = 14.
// - Or Kong of North, Kong of East, Kong of West, Pair of South, single of something?
// Let's implement: Pung N, Pung E, Pung W, Pung S, Pair of Flowers.
function matchFourWindKongs(tiles) {
    const groups = [
        { size: 2, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
        { size: 3, suit: SUITS.WINDS, val: 'N', isRelative: false },
        { size: 3, suit: SUITS.WINDS, val: 'E', isRelative: false },
        { size: 3, suit: SUITS.WINDS, val: 'W', isRelative: false },
        { size: 3, suit: SUITS.WINDS, val: 'S', isRelative: false }
    ];
    return checkGroupMatch(groups, tiles);
}

// 9. Winds 2: EEE WWW DD DD 111 111 (Pung E, Pung W, Pair Dragon, Pair Dragon? No, total 14:
// Let's check typical: Pung E, Pung W, Pair Red Dragon (matching crakes), Pung 1 (Suit A), Pung 1 (Suit B)
// e.g. EEE WWW RR 111 111 (where R is Red Dragon matching Crakes, and numbers are 1s or any number).
// Let's simplify: Pung E, Pung W, Pair of matching Dragon, Pung of X, Pung of X.
function matchWindsDragonsMixed(tiles) {
    // Any matching number val 1-9
    for (let val = 1; val <= 9; val++) {
        const groups = [
            { size: 3, suit: SUITS.WINDS, val: 'E', isRelative: false },
            { size: 3, suit: SUITS.WINDS, val: 'W', isRelative: false },
            { size: 2, suit: SUITS.DRAGONS, val: 'R', isRelative: false },
            { size: 3, suit: 'A', val, isRelative: false },
            { size: 3, suit: 'B', val, isRelative: false }
        ];
        if (checkGroupMatch(groups, tiles)) return true;
    }
    return false;
}

// 10. 369 1: FFFF 3333 6666 99 (Flower Kong, Kong 3, Kong 6, Pair 9 same suit = 4+4+4+2 = 14)
function match369SameSuit(tiles) {
    const groups = [
        { size: 4, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
        { size: 4, suit: 'A', val: 3, isRelative: false },
        { size: 4, suit: 'A', val: 6, isRelative: false },
        { size: 2, suit: 'A', val: 9, isRelative: false }
    ];
    return checkGroupMatch(groups, tiles);
}

// 11. 369 2: 333 666 9999 99 (Pung 3 (Suit A), Pung 6 (Suit A), Kong 9 (Suit B), Pair 9 (Suit C) = 3+3+4+2 = 12?
// Wait, 14 tiles is: Pung 3 (Suit A), Pung 6 (Suit A), Kong 9 (Suit B), Kong 9 (Suit C)? No, 3+3+4+4 = 14.
function match369MixedSuits(tiles) {
    const groups = [
        { size: 3, suit: 'A', val: 3, isRelative: false },
        { size: 3, suit: 'A', val: 6, isRelative: false },
        { size: 4, suit: 'B', val: 9, isRelative: false },
        { size: 4, suit: 'C', val: 9, isRelative: false }
    ];
    return checkGroupMatch(groups, tiles);
}

// 12. Singles/Pairs 1: FF 11 22 33 44 55 66 (Pair Flowers, 6 consecutive pairs in same suit. Total 14. Concealed.)
function matchSinglesPairsConsec(tiles) {
    const groups = [
        { size: 2, suit: SUITS.FLOWERS, val: 'F', isRelative: false },
        { size: 2, suit: 'A', isRelative: true, relOffset: 0 },
        { size: 2, suit: 'A', isRelative: true, relOffset: 1 },
        { size: 2, suit: 'A', isRelative: true, relOffset: 2 },
        { size: 2, suit: 'A', isRelative: true, relOffset: 3 },
        { size: 2, suit: 'A', isRelative: true, relOffset: 4 },
        { size: 2, suit: 'A', isRelative: true, relOffset: 5 }
    ];
    return checkGroupMatch(groups, tiles);
}

// 13. Singles/Pairs 2: EE SS WW NN DD DD 11 (Pair E, S, W, N, Pair Green Dragon, Pair Red Dragon, Pair X number. Total 14. Concealed.)
function matchSinglesPairsMixed(tiles) {
    for (let val = 1; val <= 9; val++) {
        const groups = [
            { size: 2, suit: SUITS.WINDS, val: 'E', isRelative: false },
            { size: 2, suit: SUITS.WINDS, val: 'S', isRelative: false },
            { size: 2, suit: SUITS.WINDS, val: 'W', isRelative: false },
            { size: 2, suit: SUITS.WINDS, val: 'N', isRelative: false },
            { size: 2, suit: SUITS.DRAGONS, val: 'G', isRelative: false },
            { size: 2, suit: SUITS.DRAGONS, val: 'R', isRelative: false },
            { size: 2, suit: 'A', val, isRelative: false }
        ];
        if (checkGroupMatch(groups, tiles)) return true;
    }
    return false;
}


// Check if hand declared Mahjong matches ANY card hand
// Returns { matched: boolean, handInfo: Object | null }
export function checkMahjong(hand) {
    if (hand.length !== 14) {
        return { matched: false, reason: "Must have exactly 14 tiles." };
    }

    for (const cat in HANDS_CARD) {
        for (const item of HANDS_CARD[cat]) {
            if (item.matchTest(hand)) {
                return { matched: true, handInfo: item };
            }
        }
    }
    return { matched: false, reason: "Hand does not match any pattern on the card." };
}

// Validate claims of discarded tile for other players
// NMJL rules: A discarded tile can be called to complete a Pung, Kong, Quint, or Sextet.
// You CANNOT call a discard to complete a single or pair (except for declaring Mahjong).
// Returns list of valid calls: ['pung', 'kong', 'quint', 'mahjong']
export function checkDiscardClaims(playerHand, discardTile) {
    const claims = [];
    const simulatedHand = [...playerHand, discardTile];

    // Check if discard completes Mahjong
    if (checkMahjong(simulatedHand).matched) {
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
        if (naturalCount + jokers >= 2) {
            claims.push('pung');
        }
        // Kong requires 3 matching tiles
        if (naturalCount + jokers >= 3) {
            claims.push('kong');
        }
        // Quint requires 4 matching tiles
        if (naturalCount + jokers >= 4) {
            claims.push('quint');
        }
    }

    return claims;
}
