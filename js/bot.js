/* Bot AI Opponent Logic */
import { SUITS, getTileFrequencies } from './engine.js?v=14';

// Evaluate hand tiles to find the least useful tiles to discard or pass
// Returns an array of 3 tiles to pass in the Charleston
export function botSelectCharlestonPass(hand) {
    // Basic Heuristic:
    // 1. Never pass Jokers (val = 'J') or Flowers (val = 'F')
    // 2. Count suits and numbers
    // 3. Find the least represented suits/values and pass them
    
    const candidates = hand.filter(t => t.suit !== SUITS.JOKERS && t.suit !== SUITS.FLOWERS);
    
    // Sort candidates by how "isolated" they are
    // Count frequencies of suits
    const suitCounts = {};
    for (const t of hand) {
        suitCounts[t.suit] = (suitCounts[t.suit] || 0) + 1;
    }
    
    // Sort candidates:
    // - Prioritize suits with fewer tiles
    // - Then prioritize unique values (no pairs)
    candidates.sort((a, b) => {
        const scoreA = (suitCounts[a.suit] || 0) * 10 + (hand.filter(t => t.val === a.val).length);
        const scoreB = (suitCounts[b.suit] || 0) * 10 + (hand.filter(t => t.val === b.val).length);
        return scoreA - scoreB;
    });

    // Take the 3 lowest scoring candidates
    const passed = candidates.slice(0, 3);
    
    // If we have fewer than 3 candidates (e.g. hand has lots of jokers/flowers, which is rare but possible),
    // fill in with other tiles that aren't jokers.
    while (passed.length < 3) {
        const remaining = hand.filter(t => !passed.includes(t) && t.suit !== SUITS.JOKERS);
        if (remaining.length > 0) {
            passed.push(remaining[0]);
        } else {
            // Ultimate fallback
            passed.push(hand.filter(t => !passed.includes(t))[0]);
        }
    }

    return passed;
}

// Select a tile to discard from a 14-tile hand
export function botSelectDiscard(hand) {
    // 1. Identify target strategy
    const target = botChooseTargetHand(hand);
    
    // 2. Filter out Jokers and Flowers (rarely discard them unless we have to, and never Jokers)
    const discardCandidates = hand.filter(t => t.suit !== SUITS.JOKERS);
    
    if (discardCandidates.length === 0) {
        return hand[0]; // Fallback
    }

    // 3. Score candidates based on alignment with target strategy
    // Lower score = better candidate to discard (less aligned)
    discardCandidates.sort((a, b) => {
        const scoreA = rateTileAlignment(a, target, hand);
        const scoreB = rateTileAlignment(b, target, hand);
        return scoreA - scoreB;
    });

    return discardCandidates[0];
}

// Decide whether to call a discarded tile
// Returns 'pung', 'kong', 'quint', 'mahjong', or null
export function botDecideClaim(botHand, discardTile, validClaims) {
    if (validClaims.includes('mahjong')) {
        return 'mahjong'; // Always call Mahjong to win!
    }

    // If bot has valid claim calls (pung, kong, quint), check if it fits target hand
    const target = botChooseTargetHand(botHand);
    
    if (isTileUsefulForTarget(discardTile, target, botHand)) {
        // Decide which claim to make
        if (validClaims.includes('kong')) return 'kong';
        if (validClaims.includes('pung')) return 'pung';
        if (validClaims.includes('quint')) return 'quint';
    }

    return null;
}

// Heuristic: Choose the NMJL hand category that matches the bot's hand the best
function botChooseTargetHand(hand) {
    // We count matching pairs, consecutive sets, wind counts, etc.
    const suitCounts = { [SUITS.DOTS]: 0, [SUITS.BAMS]: 0, [SUITS.CRAKES]: 0 };
    let windCount = 0;
    let flowerCount = 0;
    let jokerCount = 0;
    const valueCounts = {};

    for (const t of hand) {
        if (t.suit === SUITS.DOTS || t.suit === SUITS.BAMS || t.suit === SUITS.CRAKES) {
            suitCounts[t.suit]++;
            valueCounts[t.val] = (valueCounts[t.val] || 0) + 1;
        } else if (t.suit === SUITS.WINDS) {
            windCount++;
        } else if (t.suit === SUITS.FLOWERS) {
            flowerCount++;
        } else if (t.suit === SUITS.JOKERS) {
            jokerCount++;
        }
    }

    // Find dominant suit
    let maxSuit = SUITS.DOTS;
    if (suitCounts[SUITS.BAMS] > suitCounts[maxSuit]) maxSuit = SUITS.BAMS;
    if (suitCounts[SUITS.CRAKES] > suitCounts[maxSuit]) maxSuit = SUITS.CRAKES;

    // Check if we have lots of winds
    if (windCount > 4) {
        return { category: 'winds', suit: null, pivotValue: null };
    }

    // Check for 2468 pattern
    const evenCount = (valueCounts[2] || 0) + (valueCounts[4] || 0) + (valueCounts[6] || 0) + (valueCounts[8] || 0);
    const oddCount = (valueCounts[1] || 0) + (valueCounts[3] || 0) + (valueCounts[5] || 0) + (valueCounts[7] || 0) + (valueCounts[9] || 0);
    
    if (evenCount > oddCount && evenCount > 3) {
        return { category: '2468', suit: maxSuit, pivotValue: null };
    }

    // Check for 369 pattern
    const count369 = (valueCounts[3] || 0) + (valueCounts[6] || 0) + (valueCounts[9] || 0);
    if (count369 > 3) {
        return { category: '369', suit: maxSuit, pivotValue: null };
    }

    // Default to consecutive run around the most frequent value
    let pivotValue = 4;
    let maxValCount = 0;
    for (let v = 1; v <= 9; v++) {
        if ((valueCounts[v] || 0) > maxValCount) {
            maxValCount = valueCounts[v];
            pivotValue = v;
        }
    }

    return { category: 'consec', suit: maxSuit, pivotValue };
}

function isTileUsefulForTarget(tile, target, hand) {
    if (tile.suit === SUITS.JOKERS) return true; // Jokers always useful
    if (tile.suit === SUITS.FLOWERS) return target.category !== 'winds'; // Flowers useful for most non-wind hands

    if (target.category === 'winds') {
        return tile.suit === SUITS.WINDS || tile.suit === SUITS.DRAGONS;
    }

    if (target.category === '2468') {
        return tile.suit === target.suit && [2, 4, 6, 8].includes(tile.val);
    }

    if (target.category === '369') {
        return tile.suit === target.suit && [3, 6, 9].includes(tile.val);
    }

    if (target.category === 'consec') {
        // Useful if in same suit and within range of pivot
        return tile.suit === target.suit && Math.abs(tile.val - target.pivotValue) <= 2;
    }

    return false;
}

function rateTileAlignment(tile, target, hand) {
    // Return higher rating if tile is highly aligned with target strategy
    let rating = 0;
    
    if (tile.suit === SUITS.FLOWERS) {
        return 8; // Keep flowers
    }

    if (target.category === 'winds') {
        if (tile.suit === SUITS.WINDS) rating += 5;
        if (tile.suit === SUITS.DRAGONS) rating += 3;
    } else if (target.category === '2468') {
        if (tile.suit === target.suit && [2, 4, 6, 8].includes(tile.val)) rating += 5;
    } else if (target.category === '369') {
        if (tile.suit === target.suit && [3, 6, 9].includes(tile.val)) rating += 5;
    } else if (target.category === 'consec') {
        if (tile.suit === target.suit) {
            const distance = Math.abs(tile.val - target.pivotValue);
            if (distance === 0) rating += 6;
            else if (distance === 1) rating += 4;
            else if (distance === 2) rating += 2;
        }
    }

    // Keep pairs
    const matchCount = hand.filter(t => t.suit === tile.suit && t.val === tile.val).length;
    rating += (matchCount - 1) * 3; // Keep duplicates

    return rating;
}
