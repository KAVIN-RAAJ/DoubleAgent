const STATES = {
    LOBBY: 'LOBBY',
    ROUND_INIT: 'ROUND_INIT',
    WORD_ASSIGNMENT: 'WORD_ASSIGNMENT',
    MESSAGING: 'MESSAGING',
    PRE_VOTING: 'PRE_VOTING',
    VOTING: 'VOTING',
    VOTE_REVEAL: 'VOTE_REVEAL',
    RESULTS: 'RESULTS',
    ROUND_END: 'ROUND_END',
    GAME_OVER: 'GAME_OVER'
};

const createGameState = (roomCode, hostId, hostName) => {
    return {
        roomCode,
        hostId,
        players: {
            [hostId]: {
                id: hostId,
                name: hostName,
                isSpectator: false, // Peristent status (e.g. late joiner)
                isEliminated: false, // Per round status
                isImposter: false,
                word: null,
                connected: true
            }
        },
        state: STATES.LOBBY,
        round: 1,
        // Round specific data - MUST BE RESET per round
        turnOrder: [],
        currentTurnIndex: 0,
        messages: [],
        votes: {}, // Map of voterId -> targetId
        voteCounts: {}, // Derived for results
        roundResult: null,

        // System config
        settings: {
            imposterCount: 1,
            messageTime: 40,
            voteTime: 30,
            maxRounds: 5
        },
        timer: {
            endTime: null,
            active: false
        }
    };
};

module.exports = { STATES, createGameState };
