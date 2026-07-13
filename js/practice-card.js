// Original practice patterns for this app. These are not copied from any annual card.
// Each group totals 14 tiles; A/B/C represent distinct numbered suits.

const F = 'flowers';
const W = 'winds';
const D = 'dragons';
const g = (size, suit, val, relOffset = null) => ({
    size,
    suit,
    ...(val !== undefined ? { val } : {}),
    isRelative: relOffset !== null,
    ...(relOffset !== null ? { relOffset } : {})
});

const hand = (id, display, desc, groups, isConcealed = false) => ({
    id, display, desc, groups, isConcealed
});

export function buildExpandedPracticeHands() {
    return {
        consec: [
            hand('consec_4', '111 222 3333 4444', 'Four consecutive numbers; first two groups one suit, last two another.', [g(3,'A',undefined,0),g(3,'A',undefined,1),g(4,'B',undefined,2),g(4,'B',undefined,3)]),
            hand('consec_5', '11 222 3333 444 55', 'Five consecutive numbers in one suit.', [g(2,'A',undefined,0),g(3,'A',undefined,1),g(4,'A',undefined,2),g(3,'A',undefined,3),g(2,'A',undefined,4)]),
            hand('consec_6', 'FF 1111 2222 3333', 'Pair of Flowers and three consecutive Kongs in three suits.', [g(2,F,'F'),g(4,'A',undefined,0),g(4,'B',undefined,1),g(4,'C',undefined,2)]),
            hand('consec_7', '11111 2222 333 44', 'Descending group sizes across four consecutive numbers in one suit.', [g(5,'A',undefined,0),g(4,'A',undefined,1),g(3,'A',undefined,2),g(2,'A',undefined,3)]),
            hand('consec_8', 'FF 11 222 333 4444', 'Flowers plus a four-number run in one suit.', [g(2,F,'F'),g(2,'A',undefined,0),g(3,'A',undefined,1),g(3,'A',undefined,2),g(4,'A',undefined,3)]),
            hand('consec_9', '111 2222 3333 444', 'Balanced four-number run split between two suits.', [g(3,'A',undefined,0),g(4,'A',undefined,1),g(4,'B',undefined,2),g(3,'B',undefined,3)]),
            hand('consec_10', '11 2222 3333 4444', 'Pair followed by three Kongs of consecutive numbers in three suits.', [g(2,'A',undefined,0),g(4,'A',undefined,1),g(4,'B',undefined,2),g(4,'C',undefined,3)]),
            hand('consec_11', 'FFF 111 2222 3333', 'Flowers and a three-number consecutive run.', [g(3,F,'F'),g(3,'A',undefined,0),g(4,'A',undefined,1),g(4,'B',undefined,2)]),
            hand('consec_12', '111111 2222 3333', 'Sextet followed by two consecutive Kongs.', [g(6,'A',undefined,0),g(4,'A',undefined,1),g(4,'B',undefined,2)])
        ],
        '2468': [
            hand('2468_4','22 4444 6666 8888','Even pair and three even Kongs in three suits.',[g(2,'A',2),g(4,'A',4),g(4,'B',6),g(4,'C',8)]),
            hand('2468_5','FF 222 444 666 888','Flowers and even Pungs in two suits.',[g(2,F,'F'),g(3,'A',2),g(3,'A',4),g(3,'B',6),g(3,'B',8)]),
            hand('2468_6','2222 44 6666 8888','Even-number pair and Kongs in one suit.',[g(4,'A',2),g(2,'A',4),g(4,'A',6),g(4,'A',8)]),
            hand('2468_7','222 4444 66 88888','Ascending even groups across two suits.',[g(3,'A',2),g(4,'A',4),g(2,'B',6),g(5,'B',8)]),
            hand('2468_8','FFFF 22 4444 66 88','Flowers with even pair work.',[g(4,F,'F'),g(2,'A',2),g(4,'A',4),g(2,'B',6),g(2,'B',8)]),
            hand('2468_9','22 222 444 666 888','Pair and four even Pungs across three suits.',[g(2,'A',2),g(3,'B',2),g(3,'A',4),g(3,'B',6),g(3,'C',8)]),
            hand('2468_10','22222 444 66 8888','Even Quint, Pung, pair and Kong.',[g(5,'A',2),g(3,'A',4),g(2,'B',6),g(4,'B',8)]),
            hand('2468_11','FF 2222 4444 66 88','Flowers, even Kongs and pairs.',[g(2,F,'F'),g(4,'A',2),g(4,'B',4),g(2,'A',6),g(2,'B',8)])
        ],
        like: [
            hand('like_2','11 1111 1111 1111','Same number: pair and three Kongs in three suits.',[g(2,'A',undefined,0),g(4,'A',undefined,0),g(4,'B',undefined,0),g(4,'C',undefined,0)]),
            hand('like_3','FF 1111 1111 1111','Flowers and same-number Kongs in three suits.',[g(2,F,'F'),g(4,'A',undefined,0),g(4,'B',undefined,0),g(4,'C',undefined,0)]),
            hand('like_4','11111 11111 1111','Same number: two Quints and a Kong in three suits.',[g(5,'A',undefined,0),g(5,'B',undefined,0),g(4,'C',undefined,0)]),
            hand('like_5','FFF 111 1111 1111','Flowers and same-number groups in three suits.',[g(3,F,'F'),g(3,'A',undefined,0),g(4,'B',undefined,0),g(4,'C',undefined,0)]),
            hand('like_6','11 111 1111 11111','Same number with increasing group sizes.',[g(2,'A',undefined,0),g(3,'A',undefined,0),g(4,'B',undefined,0),g(5,'C',undefined,0)]),
            hand('like_7','FFFF 111 111 1111','Flowers plus same number across three suits.',[g(4,F,'F'),g(3,'A',undefined,0),g(3,'B',undefined,0),g(4,'C',undefined,0)]),
            hand('like_8','111111 1111 1111','Same-number Sextet and two Kongs.',[g(6,'A',undefined,0),g(4,'B',undefined,0),g(4,'C',undefined,0)]),
            hand('like_9','FF 11 11111 11111','Flowers, pair and two same-number Quints.',[g(2,F,'F'),g(2,'A',undefined,0),g(5,'B',undefined,0),g(5,'C',undefined,0)]),
            hand('like_10','111 111 1111 1111','Same-number Pungs and Kongs across three suits.',[g(3,'A',undefined,0),g(3,'B',undefined,0),g(4,'B',undefined,0),g(4,'C',undefined,0)])
        ],
        winds: [
            hand('winds_3','NNN EEE WWWW SSSS','Wind Pungs and Kongs.',[g(3,W,'N'),g(3,W,'E'),g(4,W,'W'),g(4,W,'S')]),
            hand('winds_4','NN EE WW SS RRR GGG','Wind pairs and Dragon Pungs.',[g(2,W,'N'),g(2,W,'E'),g(2,W,'W'),g(2,W,'S'),g(3,D,'R'),g(3,D,'G')]),
            hand('winds_5','FFFF NNN EEE WWWW','Flowers with North, East and West.',[g(4,F,'F'),g(3,W,'N'),g(3,W,'E'),g(4,W,'W')]),
            hand('winds_6','NNNN EEEE WWW SSS','Wind Kongs and Pungs.',[g(4,W,'N'),g(4,W,'E'),g(3,W,'W'),g(3,W,'S')]),
            hand('winds_7','NNNNN EEE RRR GGG','North Quint, East and Dragon Pungs.',[g(5,W,'N'),g(3,W,'E'),g(3,D,'R'),g(3,D,'G')]),
            hand('winds_8','FF NN EE WW SS RR GG','Pairs of Flowers, winds and Dragons.',[g(2,F,'F'),g(2,W,'N'),g(2,W,'E'),g(2,W,'W'),g(2,W,'S'),g(2,D,'R'),g(2,D,'G')],true),
            hand('winds_9','EEE SSS WWWW NNNN','Wind compass groups.',[g(3,W,'E'),g(3,W,'S'),g(4,W,'W'),g(4,W,'N')]),
            hand('winds_10','FFF EEE SSSS RRRR','Flowers, winds and Dragons.',[g(3,F,'F'),g(3,W,'E'),g(4,W,'S'),g(4,D,'R')])
        ],
        '369': [
            hand('369_3','33 333 6666 99999','3-6-9 groups across two suits.',[g(2,'A',3),g(3,'B',3),g(4,'A',6),g(5,'B',9)]),
            hand('369_4','FF 333 666 999 999','Flowers and 3-6-9 Pungs.',[g(2,F,'F'),g(3,'A',3),g(3,'A',6),g(3,'A',9),g(3,'B',9)]),
            hand('369_5','3333 66 9999 9999','3-6-9 pair and Kongs.',[g(4,'A',3),g(2,'A',6),g(4,'B',9),g(4,'C',9)]),
            hand('369_6','FFFF 33 6666 9999','Flowers with 3-6-9.',[g(4,F,'F'),g(2,'A',3),g(4,'B',6),g(4,'C',9)]),
            hand('369_7','33333 666 99 9999','3-6-9 Quint, Pung, pair and Kong.',[g(5,'A',3),g(3,'A',6),g(2,'A',9),g(4,'B',9)]),
            hand('369_8','33 6666 9999 9999','3-6-9 in three suits.',[g(2,'A',3),g(4,'A',6),g(4,'B',9),g(4,'C',9)]),
            hand('369_9','FFF 333 6666 9999','Flowers with 3-6-9 groups.',[g(3,F,'F'),g(3,'A',3),g(4,'B',6),g(4,'C',9)]),
            hand('369_10','333 666 9999 9999','3-6-9 split across three suits.',[g(3,'A',3),g(3,'B',6),g(4,'B',9),g(4,'C',9)])
        ],
        singles: [
            hand('singles_3','FF 11 22 33 44 55 66','Six consecutive pairs plus Flowers.',[g(2,F,'F'),g(2,'A',undefined,0),g(2,'B',undefined,1),g(2,'A',undefined,2),g(2,'B',undefined,3),g(2,'A',undefined,4),g(2,'B',undefined,5)],true),
            hand('singles_4','11 22 33 44 55 66 77','Seven consecutive pairs in one suit.',[...([0,1,2,3,4,5,6].map(o=>g(2,'A',undefined,o)))],true),
            hand('singles_5','11 22 33 44 55 66 77','Seven consecutive pairs alternating two suits.',[g(2,'A',undefined,0),g(2,'B',undefined,1),g(2,'A',undefined,2),g(2,'B',undefined,3),g(2,'A',undefined,4),g(2,'B',undefined,5),g(2,'A',undefined,6)],true),
            hand('singles_6','FF 22 44 66 88 RR GG','Flowers, even pairs and Dragon pairs.',[g(2,F,'F'),g(2,'A',2),g(2,'A',4),g(2,'B',6),g(2,'B',8),g(2,D,'R'),g(2,D,'G')],true),
            hand('singles_7','11 33 55 77 99 RR GG','Odd pairs and Dragon pairs.',[g(2,'A',1),g(2,'A',3),g(2,'A',5),g(2,'A',7),g(2,'A',9),g(2,D,'R'),g(2,D,'G')],true),
            hand('singles_8','NN EE SS WW 11 55 99','Wind pairs and number pairs.',[g(2,W,'N'),g(2,W,'E'),g(2,W,'S'),g(2,W,'W'),g(2,'A',1),g(2,'B',5),g(2,'C',9)],true),
            hand('singles_9','FF 11 33 55 77 99 RR','Flowers, odd pairs and Red Dragons.',[g(2,F,'F'),g(2,'A',1),g(2,'A',3),g(2,'A',5),g(2,'A',7),g(2,'A',9),g(2,D,'R')],true),
            hand('singles_10','22 44 66 88 NN SS GG','Even, wind and Dragon pairs.',[g(2,'A',2),g(2,'A',4),g(2,'B',6),g(2,'B',8),g(2,W,'N'),g(2,W,'S'),g(2,D,'G')],true)
        ],
        odds: [
            hand('odds_1','FF 111 333 555 777','Flowers and four odd Pungs.',[g(2,F,'F'),g(3,'A',1),g(3,'A',3),g(3,'B',5),g(3,'B',7)]),
            hand('odds_2','11 3333 5555 9999','Odd pair and Kongs.',[g(2,'A',1),g(4,'A',3),g(4,'B',5),g(4,'C',9)]),
            hand('odds_3','1111 33 7777 9999','Odd-number Kongs and pair.',[g(4,'A',1),g(2,'A',3),g(4,'B',7),g(4,'B',9)]),
            hand('odds_4','FFFF 1111 55 9999','Flowers with odd Kong, pair and Kong.',[g(4,F,'F'),g(4,'A',1),g(2,'B',5),g(4,'C',9)]),
            hand('odds_5','111 333 5555 7777','Odd Pungs and Kongs.',[g(3,'A',1),g(3,'A',3),g(4,'B',5),g(4,'B',7)]),
            hand('odds_6','11111 333 55 9999','Odd Quint, Pung, pair and Kong.',[g(5,'A',1),g(3,'A',3),g(2,'B',5),g(4,'C',9)]),
            hand('odds_7','FF 1111 3333 55 77','Flowers and odd groups.',[g(2,F,'F'),g(4,'A',1),g(4,'B',3),g(2,'A',5),g(2,'B',7)]),
            hand('odds_8','111111 5555 9999','Odd Sextet and Kongs.',[g(6,'A',1),g(4,'B',5),g(4,'C',9)]),
            hand('odds_9','FFF 111 5555 9999','Flowers and anchor odds.',[g(3,F,'F'),g(3,'A',1),g(4,'B',5),g(4,'C',9)]),
            hand('odds_10','11 333 5555 99999','Odd pair through Quint.',[g(2,'A',1),g(3,'A',3),g(4,'B',5),g(5,'C',9)])
        ],
        quints: [
            hand('quints_1','FFFF 11111 22222','Flowers and consecutive Quints.',[g(4,F,'F'),g(5,'A',undefined,0),g(5,'B',undefined,1)]),
            hand('quints_2','11 111111 111111','Same number pair and two Sextets.',[g(2,'A',undefined,0),g(6,'B',undefined,0),g(6,'C',undefined,0)]),
            hand('quints_3','FF 333333 666666','Flowers with 3 and 6 Sextets.',[g(2,F,'F'),g(6,'A',3),g(6,'B',6)]),
            hand('quints_4','11111 5555 99999','Odd Quints around a Kong.',[g(5,'A',1),g(4,'B',5),g(5,'C',9)]),
            hand('quints_5','22222 4444 66666','Even Quints around a Kong.',[g(5,'A',2),g(4,'B',4),g(5,'C',6)]),
            hand('quints_6','FFF 11111 222 333','Flowers, Quint and consecutive Pungs.',[g(3,F,'F'),g(5,'A',undefined,0),g(3,'A',undefined,1),g(3,'B',undefined,2)]),
            hand('quints_7','NNNNN EEEE SSSSS','Wind Quints around a Kong.',[g(5,W,'N'),g(4,W,'E'),g(5,W,'S')]),
            hand('quints_8','RRRRR GGGG 11111','Dragon Quint, Dragon Kong and number Quint.',[g(5,D,'R'),g(4,D,'G'),g(5,'A',undefined,0)])
        ]
    };
}
