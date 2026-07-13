/* Unit Tests for Mahjong PWA validation engine */
import { 
    createWall, sortHandBySuit, sortHandByValue, 
    checkMahjong, SUITS 
} from './js/engine.js';

console.log("-------------------------------------------------");
console.log("🀄 running American Mahjong Engine Unit Tests...");
console.log("-------------------------------------------------");

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passCount++;
    } else {
        console.log(`❌ FAIL: ${message}`);
        failCount++;
    }
}

// 1. Wall Generation Tests
try {
    const wall = createWall();
    assert(wall.length === 152, `Wall should contain exactly 152 tiles (got ${wall.length})`);
    
    const jokers = wall.filter(t => t.suit === SUITS.JOKERS);
    assert(jokers.length === 8, `Wall should contain exactly 8 Jokers (got ${jokers.length})`);
    
    const flowers = wall.filter(t => t.suit === SUITS.FLOWERS);
    assert(flowers.length === 8, `Wall should contain exactly 8 Flowers (got ${flowers.length})`);
    
    const dots = wall.filter(t => t.suit === SUITS.DOTS);
    assert(dots.length === 36, `Wall should contain exactly 36 Dots (got ${dots.length})`);
} catch (e) {
    assert(false, `Wall generation failed: ${e.message}`);
}

// 2. Hand Matching Tests - Consec 1 (FFFF 11111 22222)
try {
    // Hand A: Pure natural tiles
    const handA = [
        { id: 1, suit: SUITS.FLOWERS, val: 'F' },
        { id: 2, suit: SUITS.FLOWERS, val: 'F' },
        { id: 3, suit: SUITS.FLOWERS, val: 'F' },
        { id: 4, suit: SUITS.FLOWERS, val: 'F' },
        // Quint of 5 Dots
        { id: 5, suit: SUITS.DOTS, val: 5 },
        { id: 6, suit: SUITS.DOTS, val: 5 },
        { id: 7, suit: SUITS.DOTS, val: 5 },
        { id: 8, suit: SUITS.DOTS, val: 5 },
        { id: 9, suit: SUITS.DOTS, val: 5 }, // 5th tile must be a joker because there are only 4 naturals!
        // Quint of 6 Dots
        { id: 10, suit: SUITS.DOTS, val: 6 },
        { id: 11, suit: SUITS.DOTS, val: 6 },
        { id: 12, suit: SUITS.DOTS, val: 6 },
        { id: 13, suit: SUITS.DOTS, val: 6 },
        { id: 14, suit: SUITS.JOKERS, val: 'J' } // joker for the 6 quint
    ];
    // Replace the 5th tile of 5 Dots with Joker too
    handA[8] = { id: 9, suit: SUITS.JOKERS, val: 'J' };

    const resA = checkMahjong(handA);
    assert(resA.matched === true, `Hand A (natural + jokers) should match Consec 1 (got: ${resA.matched})`);

    // Hand B: Invalid tile count (13 tiles)
    const handB = handA.slice(0, 13);
    const resB = checkMahjong(handB);
    assert(resB.matched === false, `Hand B (13 tiles) should fail validation (got: ${resB.matched})`);

} catch (e) {
    assert(false, `Consec 1 tests failed: ${e.message}`);
}

// 3. Hand Matching Tests - Singles & Pairs 2 (EE SS WW NN DD DD 11)
// Pairs of East, South, West, North, pair of Green Dragon, pair of Red Dragon, pair of X number.
try {
    const handC = [
        { id: 1, suit: SUITS.WINDS, val: 'E' }, { id: 2, suit: SUITS.WINDS, val: 'E' },
        { id: 3, suit: SUITS.WINDS, val: 'S' }, { id: 4, suit: SUITS.WINDS, val: 'S' },
        { id: 5, suit: SUITS.WINDS, val: 'W' }, { id: 6, suit: SUITS.WINDS, val: 'W' },
        { id: 7, suit: SUITS.WINDS, val: 'N' }, { id: 8, suit: SUITS.WINDS, val: 'N' },
        { id: 9, suit: SUITS.DRAGONS, val: 'G' }, { id: 10, suit: SUITS.DRAGONS, val: 'G' },
        { id: 11, suit: SUITS.DRAGONS, val: 'R' }, { id: 12, suit: SUITS.DRAGONS, val: 'R' },
        { id: 13, suit: SUITS.BAMS, val: 5 }, { id: 14, suit: SUITS.BAMS, val: 5 }
    ];
    const resC = checkMahjong(handC);
    assert(resC.matched === true, `Hand C (Singles/Pairs 2) should match successfully (got: ${resC.matched})`);

    // Hand D: One of the pairs contains a Joker (EE SS WW NN DD DD 5 + J)
    const handD = [...handC];
    handD[13] = { id: 14, suit: SUITS.JOKERS, val: 'J' }; // Replace 5 Bam with Joker
    const resD = checkMahjong(handD);
    assert(resD.matched === false, `Hand D (contains Joker in pair) should FAIL validation (got: ${resD.matched})`);

    // 4. Co-pilot Suggestions Strength Analyzer Test
    const { analyzeHandStrengths } = await import("./js/engine.js");
    const testHand = [
        { id: 1, suit: SUITS.WINDS, val: 'E' }, { id: 2, suit: SUITS.WINDS, val: 'E' },
        { id: 3, suit: SUITS.WINDS, val: 'S' }, { id: 4, suit: SUITS.WINDS, val: 'S' },
        { id: 5, suit: SUITS.WINDS, val: 'W' }, { id: 6, suit: SUITS.WINDS, val: 'W' },
        { id: 7, suit: SUITS.WINDS, val: 'N' }, { id: 8, suit: SUITS.WINDS, val: 'N' }
    ];
    const strengths = analyzeHandStrengths(testHand);
    assert(strengths.length > 0, "Should generate strength recommendations");
    assert(strengths[0].percentage > 0, `Top match should be >0% (got ${strengths[0].percentage}%)`);
    passCount++;
    console.log(`✅ PASS: Hand Analyzer test (top match: ${strengths[0].percentage}%)`);

} catch (e) {
    assert(false, `Singles & Pairs tests failed: ${e.message}`);
}

console.log("-------------------------------------------------");
console.log(`📊 Test Summary: Passed ${passCount}/${passCount + failCount}`);
console.log("-------------------------------------------------");

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
