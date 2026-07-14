/* Unit Tests for Mahjong PWA validation engine */
import {
    createWall, sortHandBySuit, sortHandByValue, 
    checkMahjong, SUITS, HANDS_CARD, parseCustomPattern, checkGroupMatch,
    analyzeHandStrengths, getHandDifficulty, buildClaimMeld, checkDiscardClaims, undoLastClaim,
    isValidCharlestonPass, exchangeExposedJoker
} from './js/engine.js';
import { readFileSync } from 'node:fs';

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

// A Joker in any exposed meld can be redeemed for its matching natural tile,
// but only after the exchanger has started their turn by drawing or calling.
try {
    const joker = { id: 301, suit: SUITS.JOKERS, val: 'J' };
    const fiveDot = id => ({ id, suit: SUITS.DOTS, val: 5 });
    const exchangeState = {
        gamePhase: 'playing',
        currentTurn: 0,
        claimWindow: null,
        canExchangeJoker: false,
        hands: [[fiveDot(305)], [], [], []],
        exposures: [[], [[fiveDot(302), fiveDot(303), fiveDot(304), joker]], [], []],
        lastClaimUndo: { seat: 0 }
    };
    assert(!exchangeExposedJoker(exchangeState, 0, 1, 0, joker.id), 'Joker exchange must wait until the player has drawn or called');
    exchangeState.canExchangeJoker = true;
    const exchange = exchangeExposedJoker(exchangeState, 0, 1, 0, joker.id);
    assert(exchange?.joker.id === joker.id, 'Matching natural tile should redeem the exposed Joker');
    assert(exchangeState.hands[0].some(tile => tile.id === joker.id), 'Redeemed Joker should move into the exchanger rack');
    assert(exchangeState.exposures[1][0].every(tile => tile.suit === SUITS.DOTS && tile.val === 5), 'Natural tile should replace the Joker in the exposed meld');
    assert(exchangeState.lastClaimUndo === null, 'Joker exchange should close the prior claim undo window');
} catch (e) {
    assert(false, `Joker exchange failed: ${e.message}`);
}

// Charleston synchronization only treats a complete, unique 3-tile payload as submitted.
try {
    assert(isValidCharlestonPass([1, 2, 3]), 'A unique three-tile Charleston pass should be valid');
    assert(!isValidCharlestonPass([]), 'An empty legacy Charleston pass must not lock the submit button');
    assert(!isValidCharlestonPass([1, 2]), 'An incomplete Charleston pass must remain retryable');
    assert(!isValidCharlestonPass([1, 1, 2]), 'A Charleston pass cannot contain duplicate tile IDs');
} catch (e) {
    assert(false, `Charleston pass validation failed: ${e.message}`);
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
    assert(resA.handInfo?.category === 'consec', 'Winning result should identify the matched card category');

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
    assert(strengths[0].percentage === Math.round((strengths[0].matchCount / 14) * 100), 'Collected percentage should always be matched tiles divided by 14');
    assert(strengths[0].difficulty?.level, 'Every hand recommendation should include a difficulty level');
    passCount++;
    console.log(`✅ PASS: Hand Analyzer test (top match: ${strengths[0].percentage}%)`);

} catch (e) {
    assert(false, `Singles & Pairs tests failed: ${e.message}`);
}

// 3b. Structural difficulty is independent of current collection progress.
try {
    const flexibleRun = getHandDifficulty(HANDS_CARD.consec.find(hand => hand.id === 'consec_5').groups, false);
    const concealedPairsHand = HANDS_CARD.winds.find(hand => hand.id === 'winds_8');
    const concealedPairs = getHandDifficulty(concealedPairsHand.groups, concealedPairsHand.isConcealed);
    const jokerHeavyHand = HANDS_CARD.quints.find(hand => hand.id === 'quints_2');
    const jokerHeavy = getHandDifficulty(jokerHeavyHand.groups, jokerHeavyHand.isConcealed);
    const impossible = getHandDifficulty([
        { size: 2, suit: 'A', val: 1, isRelative: false },
        { size: 2, suit: 'A', val: 1, isRelative: false },
        { size: 2, suit: 'A', val: 1, isRelative: false }
    ], true);
    assert(flexibleRun.level === 'Easy', `Flexible consecutive run should be Easy (got ${flexibleRun.level})`);
    assert(concealedPairs.level === 'Extreme', `Fixed concealed pairs should be Extreme (got ${concealedPairs.level})`);
    assert(jokerHeavy.minJokers === 4 && ['Expert', 'Extreme'].includes(jokerHeavy.level), `Two Sextets should require four Jokers and be Expert+ (got ${jokerHeavy.minJokers}, ${jokerHeavy.level})`);
    assert(impossible.level === 'Impossible', `A pattern requiring six natural copies in pairs should be Impossible (got ${impossible.level})`);
} catch (e) {
    assert(false, `Difficulty analysis failed: ${e.message}`);
}

// 4. Exposed-hand validation
try {
    const complete = [
        { id: 1, suit: SUITS.FLOWERS, val: 'F' }, { id: 2, suit: SUITS.FLOWERS, val: 'F' },
        ...['N', 'N', 'N', 'E', 'E', 'E', 'W', 'W', 'W', 'S', 'S', 'S'].map((val, index) => ({ id: index + 3, suit: SUITS.WINDS, val }))
    ];
    const northExposure = [complete.slice(2, 5)];
    const concealed = [...complete.slice(0, 2), ...complete.slice(5)];
    assert(checkMahjong(concealed, northExposure).matched, 'Exposed tiles should count toward a valid exposable Mahjong hand');
    const exposedSuggestions = analyzeHandStrengths(concealed, northExposure);
    assert(exposedSuggestions.some(hand => hand.id === 'winds_1'), 'Co-pilot should retain patterns compatible with an exposed meld');
    assert(exposedSuggestions.every(hand => !HANDS_CARD[hand.category].find(item => item.id === hand.id)?.isConcealed), 'Co-pilot must exclude concealed patterns after an exposure');

    const southFlowerSouth = [[complete[11], complete[0], complete[12]]];
    const remainingAfterInvalidExposure = complete.filter(tile => !southFlowerSouth[0].includes(tile));
    assert(!checkMahjong(remainingAfterInvalidExposure, southFlowerSouth).matched, 'A mixed South-Flower-South exposure must never validate');
    assert(analyzeHandStrengths(remainingAfterInvalidExposure, southFlowerSouth).length === 0, 'Co-pilot must reject every pattern for an illegal mixed exposure');

    const claimRack = [
        { id: 40, suit: SUITS.WINDS, val: 'S' },
        { id: 41, suit: SUITS.FLOWERS, val: 'F' },
        { id: 42, suit: SUITS.JOKERS, val: 'J' }
    ];
    const claimedSouth = { id: 43, suit: SUITS.WINDS, val: 'S' };
    const builtClaim = buildClaimMeld(claimRack, claimedSouth, 'pung');
    assert(builtClaim?.meld.every(tile => tile.suit === SUITS.WINDS || tile.suit === SUITS.JOKERS), 'Claim construction must consume only matching tiles or Jokers');
    assert(!builtClaim?.consumedIds.includes(41), 'Claim construction must never consume an unrelated Flower');

    const redExposure = [[
        { id: 50, suit: SUITS.DRAGONS, val: 'R' },
        { id: 51, suit: SUITS.DRAGONS, val: 'R' },
        { id: 52, suit: SUITS.DRAGONS, val: 'R' }
    ]];
    const doomedRack = [
        { id: 53, suit: SUITS.BAMS, val: 3 },
        { id: 54, suit: SUITS.JOKERS, val: 'J' }
    ];
    const threeBamDiscard = { id: 55, suit: SUITS.BAMS, val: 3 };
    assert(!checkDiscardClaims(doomedRack, threeBamDiscard, redExposure).includes('pung'), 'A call that eliminates every card pattern must not be offered');
    const northRack = [
        { id: 56, suit: SUITS.WINDS, val: 'N' },
        { id: 57, suit: SUITS.WINDS, val: 'N' }
    ];
    assert(checkDiscardClaims(northRack, { id: 58, suit: SUITS.WINDS, val: 'N' }).includes('pung'), 'A call compatible with card patterns should remain available');

    const undoWindow = { tile: threeBamDiscard, discarder: 2, eligible: { '0': ['pung'] }, responses: { '0': 'pung' } };
    const undoState = {
        hands: [[], [], [], []],
        exposures: [[builtClaim.meld], [], [], []],
        discards: [],
        currentTurn: 0,
        activeDiscard: null,
        claimWindow: null,
        lastClaimUndo: {
            seat: 0,
            claimedTile: claimedSouth,
            consumedTiles: builtClaim.meld.slice(0, -1),
            meldIds: builtClaim.meld.map(tile => tile.id),
            exposureIndex: 0,
            priorClaimWindow: undoWindow
        }
    };
    assert(undoLastClaim(undoState, 0), 'The most recent call should be undoable before a discard');
    assert(undoState.exposures[0].length === 0 && undoState.hands[0].length === 2, 'Undo should return consumed rack tiles and remove the exposure');
    assert(undoState.claimWindow.responses['0'] === 'pass', 'Undo should restore the claim window as a pass');

    const concealedPattern = [
        { id: 20, suit: SUITS.FLOWERS, val: 'F' }, { id: 21, suit: SUITS.FLOWERS, val: 'F' },
        ...[1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6].map((val, index) => ({ id: index + 22, suit: SUITS.DOTS, val }))
    ];
    assert(!checkMahjong(concealedPattern.slice(2), [concealedPattern.slice(0, 2)]).matched, 'A concealed card hand must fail when any tiles are exposed');
} catch (e) {
    assert(false, `Exposure validation failed: ${e.message}`);
}

// 5. DOM contract checks catch missing registry entries before runtime.
try {
    const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
    const ui = readFileSync(new URL('./js/ui.js', import.meta.url), 'utf8');
    const app = readFileSync(new URL('./js/app.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
    const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
    assert(duplicateIds.length === 0, `HTML IDs must be unique${duplicateIds.length ? `: ${duplicateIds.join(', ')}` : ''}`);

    const registryEntries = [...ui.matchAll(/\b([A-Za-z][A-Za-z0-9]+): document\.getElementById\('([^']+)'\)/g)];
    const registryNames = new Set(registryEntries.map(match => match[1]));
    const missingHtmlIds = registryEntries.map(match => match[2]).filter(id => !htmlIds.includes(id));
    assert(missingHtmlIds.length === 0, `Every UI registry ID must exist in HTML${missingHtmlIds.length ? `: ${missingHtmlIds.join(', ')}` : ''}`);

    const usedElementNames = new Set([...app.matchAll(/elements\.([A-Za-z][A-Za-z0-9]+)/g)].map(match => match[1]));
    const missingRegistryNames = [...usedElementNames].filter(name => !registryNames.has(name));
    assert(missingRegistryNames.length === 0, `Every app element reference must be registered${missingRegistryNames.length ? `: ${missingRegistryNames.join(', ')}` : ''}`);
    assert(!css.includes('.claim-tile-announcement span'), 'Claim prompt styles must not override nested tile labels');
    assert(html.includes('co-pilot-color-key') && css.includes('--pattern-suit-a'), 'Co-pilot and card reference must include the relative-suit color key');
    assert(css.includes('.discard-river {\n    position: absolute;') && css.includes('.table-center {') && css.includes('overscroll-behavior: contain'), 'Discard river must scroll without contributing to mobile board height');
    assert(ui.includes("W: 'White Dragon (Soap)'") && ui.includes('tile-caption">SOAP'), 'White Dragon must render and read as Soap');
    assert(css.includes('body.charleston-active .game-header') && css.includes('.tile-exposed.joker-exchange'), 'Charleston header access and highlighted Joker exchanges must remain styled');
    assert(ui.includes("tileEl.setAttribute('title', getTileLabel(tile.suit, tile.val))"), 'Discarded tiles must expose readable tile names');
    assert(ui.includes("winnerName === 'You' ? 'You Win!'") && !ui.includes("`${result.winnerName || 'Player'} Wins!`"), 'Round result must use second-person winner grammar');
    assert(app.includes("elements.roundResultOverlay.classList.add('hidden')") && app.indexOf("switchScreen(elements.lobbyScreen)") < app.lastIndexOf('await leaveRoom'), 'Exit to Lobby must hide the result and switch screens before remote cleanup');
} catch (e) {
    assert(false, `DOM contract checks failed: ${e.message}`);
}

// 6. Expanded and custom card checks
try {
    const practiceHands = Object.entries(HANDS_CARD)
        .filter(([category]) => category !== 'custom')
        .flatMap(([, hands]) => hands);
    assert(practiceHands.length === 81, `Expanded original card should contain 81 hands (got ${practiceHands.length})`);
    const malformed = practiceHands.filter(hand =>
        !Array.isArray(hand.groups) || hand.groups.some(Array.isArray) ||
        hand.groups.reduce((sum, group) => sum + Number(group.size || 0), 0) !== 14
    );
    assert(malformed.length === 0, `Every practice pattern must define exactly 14 tiles${malformed.length ? `: ${malformed.map(hand => hand.id).join(', ')}` : ''}`);
    const malformedDisplays = practiceHands.filter(hand => hand.display.replace(/\s+/g, '').length !== 14);
    assert(malformedDisplays.length === 0, `Every displayed pattern must show exactly 14 tile symbols${malformedDisplays.length ? `: ${malformedDisplays.map(hand => hand.id).join(', ')}` : ''}`);

    const customGroups = parseCustomPattern('FF 1111A 2222B 3333C');
    assert(customGroups.reduce((sum, group) => sum + group.size, 0) === 14, 'Custom notation should parse a complete 14-tile hand');
    let invalidCustomRejected = false;
    try { parseCustomPattern('FF 111A'); } catch { invalidCustomRejected = true; }
    assert(invalidCustomRejected, 'Custom notation should reject incomplete hands');
} catch (e) {
    assert(false, `Expanded card checks failed: ${e.message}`);
}

console.log("-------------------------------------------------");
console.log(`📊 Test Summary: Passed ${passCount}/${passCount + failCount}`);
console.log("-------------------------------------------------");

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
