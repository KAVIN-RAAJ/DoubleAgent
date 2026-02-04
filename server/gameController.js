const { STATES } = require('./gameState');
const { getRandomWordPair } = require('./words');

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const getActivePlayers = (game) => {
    return Object.values(game.players).filter(p => !p.isSpectator && !p.isEliminated && p.connected);
};

const addSystemMessage = (game, text) => {
    game.messages.push({
        type: 'system',
        text,
        timestamp: Date.now()
    });
};

const resetRoundState = (game) => {
    game.messages = [];
    game.votes = {};
    game.voteCounts = {};
    game.turnOrder = [];
    game.currentTurnIndex = 0;

    Object.values(game.players).forEach(p => {
        if (p.connected) {
            p.isSpectator = false;
            p.isEliminated = false;
            p.isImposter = false;
            p.word = null;
        }
    });
};

const startRound = (game) => {
    resetRoundState(game);
    game.state = STATES.WORD_ASSIGNMENT;
    game.roundResult = null;

    const players = getActivePlayers(game);
    if (players.length < 3) {
        game.state = STATES.GAME_OVER;
        game.roundResult = { reason: 'Not enough players' };
        return;
    }

    // Assign Roles
    const { common, imposter } = getRandomWordPair();
    const imposterCount = Math.min(game.settings.imposterCount, Math.floor(players.length / 2));

    const shuffledIds = shuffleArray(players.map(p => p.id));
    const imposterIds = shuffledIds.slice(0, imposterCount);

    players.forEach(p => {
        if (imposterIds.includes(p.id)) {
            p.isImposter = true;
            p.word = imposter;
        } else {
            p.isImposter = false;
            p.word = common;
        }
    });

    game.turnOrder = shuffleArray([...shuffledIds]);

    addSystemMessage(game, `🟢 Round ${game.round} has started`);
    addSystemMessage(game, `🎯 Words have been assigned`);
};

const nextPhase = (game) => {
    switch (game.state) {
        case STATES.ROUND_INIT:
            startRound(game);
            break;
        case STATES.WORD_ASSIGNMENT:
            game.state = STATES.MESSAGING;
            game.currentTurnIndex = 0;
            const firstPlayer = game.players[game.turnOrder[0]];
            addSystemMessage(game, `🗣️ It is now ${firstPlayer.name}'s turn to speak`);
            break;
        case STATES.MESSAGING:
            game.state = STATES.PRE_VOTING;
            addSystemMessage(game, `Voting page is gonna open soon...`);
            break;
        case STATES.PRE_VOTING:
            game.state = STATES.VOTING;
            addSystemMessage(game, `⏳ Voting has begun`);
            break;
        case STATES.VOTING:
            processVotes(game); // Calculates counts & result
            game.state = STATES.VOTE_REVEAL; // Show counts first
            addSystemMessage(game, `Voting ended. Revealing votes...`);
            break;
        case STATES.VOTE_REVEAL:
            game.state = STATES.RESULTS; // Show elimination
            break;
        case STATES.RESULTS:
            checkWinCondition(game);
            if (game.state !== STATES.GAME_OVER) {
                game.state = STATES.ROUND_END;
                addSystemMessage(game, `Next round starting soon...`);
            } else {
                addSystemMessage(game, `Game Over: ${game.roundResult.reason}`);
            }
            break;
        case STATES.ROUND_END:
            game.round++;
            if (game.round > game.settings.maxRounds) {
                game.state = STATES.GAME_OVER;
                game.roundResult = { reason: 'Max rounds reached' };
            } else {
                game.state = STATES.ROUND_INIT;
                startRound(game);
            }
            break;
    }
};

const checkWinCondition = (game) => {
    const active = getActivePlayers(game);
    const imposters = active.filter(p => p.isImposter);

    if (imposters.length === 0) {
        game.state = STATES.GAME_OVER;
        game.roundResult = { winner: 'Citizens', reason: 'Imposter eliminated!' };
        addSystemMessage(game, `🎉 Imposter caught! Game Over`);
    } else if (imposters.length >= active.length - imposters.length) {
        game.state = STATES.GAME_OVER;
        game.roundResult = { winner: 'Imposters', reason: 'Imposters dominate!' };
        addSystemMessage(game, `💀 Impostars win! Game Over`);
    } else if (active.length <= 2) {
        game.state = STATES.GAME_OVER;
        game.roundResult = { winner: 'Imposters', reason: 'Only 2 players left!' };
        addSystemMessage(game, `💀 Only 2 players left - Imposters win!`);
    }
};

const processVotes = (game) => {
    const voteCounts = {};
    Object.values(game.votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    // SAVE TO GAME STATE for VOTE_REVEAL phase
    game.voteCounts = voteCounts;

    let maxVotes = 0;
    let target = null;
    let tie = false;

    Object.entries(voteCounts).forEach(([pid, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            target = pid;
            tie = false;
        } else if (count === maxVotes) {
            tie = true;
        }
    });

    if (target && !tie) {
        const player = game.players[target];
        if (player) {
            player.isEliminated = true;
            const role = player.isImposter ? "an Imposter" : "a Citizen";
            game.roundResult = {
                eliminated: player.name,
                wasImposter: player.isImposter
            };
            addSystemMessage(game, `❌ ${player.name} was eliminated (${role})`);
        }
    } else {
        game.roundResult = { eliminated: null, reason: 'Tie or no votes' };
        addSystemMessage(game, `No one was eliminated (Tie/No votes)`);
    }
};

module.exports = {
    startRound,
    nextPhase,
    getActivePlayers,
    checkWinCondition,
    addSystemMessage // Export if needed by index.js
};
