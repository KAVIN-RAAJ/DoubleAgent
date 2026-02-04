const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createGameState, STATES } = require('./gameState');
const { startRound, nextPhase, getActivePlayers, addSystemMessage } = require('./gameController');
const { generateRoomCode } = require('./utils');
const { WORD_PAIRS } = require('./words');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const games = {}; // roomCode -> game

const getPublicState = (game) => {
    // Create a copy without the internal timer ID (which causes circular JSON errors)
    const { timer, ...rest } = game;
    const safeGame = {
        ...rest,
        timer: {
            active: timer.active,
            endTime: timer.endTime
            // id is excluded
        }
    };

    // Clone game to avoid mutating original
    const publicGame = JSON.parse(JSON.stringify(safeGame));

    // Mask private info
    Object.values(publicGame.players).forEach(p => {
        delete p.word;
        delete p.isImposter;
    });

    // Hide votes during voting phase
    if (game.state === STATES.VOTING) {
        publicGame.votes = {}; // Hide who voted for whom
        publicGame.voteCounts = {};
    }
    // In VOTE_REVEAL, we allow voteCounts to be seen (but votes map still effectively hidden since we don't show who-voted-who)

    return publicGame;
};

const sendStateUpdate = (roomCode) => {
    const game = games[roomCode];
    if (!game) return;

    const publicState = getPublicState(game);

    // Send public state to room
    io.to(roomCode).emit('state_update', publicState);

    // Send private info (role/word) to individual sockets
    Object.values(game.players).forEach(p => {
        if (game.players[p.id]) { // Check if still exists
            const privateData = {
                word: game.players[p.id].word,
                isImposter: game.players[p.id].isImposter
            };
            io.to(p.id).emit('private_data', privateData);
        }
    });
};

const handleGameTimeout = (game) => {
    if (!game) return;

    // Logic for timeout expiration
    if (game.state === STATES.MESSAGING) {
        // Force next turn
        game.currentTurnIndex++;
        if (game.currentTurnIndex >= game.turnOrder.length) {
            nextPhase(game); // Go to voting
        } else {
            const nextId = game.turnOrder[game.currentTurnIndex];
            const nextName = game.players[nextId].name;
            addSystemMessage(game, `🗣️ It is now ${nextName}'s turn to speak`);
        }
        setupPhaseTimer(game);
    } else if (game.state === STATES.PRE_VOTING) {
        nextPhase(game); // Go to VOTING
        setupPhaseTimer(game);
    } else if (game.state === STATES.VOTING) {
        // End voting
        nextPhase(game); // To VOTE_REVEAL
        setupPhaseTimer(game);
    } else if (game.state === STATES.VOTE_REVEAL) {
        nextPhase(game); // To RESULTS
        setupPhaseTimer(game);
    } else if (game.state === STATES.WORD_ASSIGNMENT) {
        nextPhase(game); // Go to MESSAGING
        setupPhaseTimer(game);
    } else if (game.state === STATES.RESULTS || game.state === STATES.ROUND_END) {
        nextPhase(game); // Go to next round or end
        setupPhaseTimer(game);
    }

    sendStateUpdate(game.roomCode);
};

const setupPhaseTimer = (game) => {
    if (game.timer.id) clearTimeout(game.timer.id);

    let duration = 0;

    switch (game.state) {
        case STATES.WORD_ASSIGNMENT:
            duration = 5000; // 5s to view words
            break;
        case STATES.MESSAGING:
            duration = game.settings.messageTime * 1000;
            break;
        case STATES.PRE_VOTING:
            duration = 10000; // 10s wait before voting
            break;
        case STATES.VOTING:
            duration = game.settings.voteTime * 1000;
            break;
        case STATES.VOTE_REVEAL:
            duration = 4000; // 4s to see votes
            break;
        case STATES.RESULTS:
            duration = 5000; // 5s to see results
            break;
        case STATES.ROUND_END:
            duration = 3000;
            break;
        default:
            game.timer.active = false;
            return;
    }

    game.timer.active = true;
    game.timer.endTime = Date.now() + duration;
    game.timer.id = setTimeout(() => {
        handleGameTimeout(game);
    }, duration);
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_game', ({ playerName }) => {
        const roomCode = generateRoomCode();
        games[roomCode] = createGameState(roomCode, socket.id, playerName);
        socket.join(roomCode);
        socket.emit('game_created', { roomCode });
        sendStateUpdate(roomCode);
    });

    socket.on('join_game', ({ roomCode, playerName }) => {
        const game = games[roomCode];
        if (game) {
            game.players[socket.id] = {
                id: socket.id,
                name: playerName,
                isSpectator: game.state !== STATES.LOBBY,
                isEliminated: false,
                isImposter: false,
                word: null,
                connected: true
            };
            socket.join(roomCode);
            sendStateUpdate(roomCode);
        } else {
            socket.emit('error', 'Game not found');
        }
    });

    socket.on('start_game', () => {
        // Find game where socket is host
        const roomCode = Array.from(socket.rooms).find(r => games[r]);
        const game = games[roomCode];

        if (game && game.hostId === socket.id && Object.keys(game.players).length >= 3) {
            game.state = STATES.ROUND_INIT;
            nextPhase(game); // Start Round 1
            setupPhaseTimer(game);
            sendStateUpdate(roomCode);
        }
    });

    socket.on('send_message', ({ text }) => {
        const roomCode = Array.from(socket.rooms).find(r => games[r]);
        const game = games[roomCode];

        if (game && game.state === STATES.MESSAGING) {
            const currentPlayerId = game.turnOrder[game.currentTurnIndex];
            if (socket.id === currentPlayerId) {
                game.messages.push({
                    senderId: socket.id,
                    name: game.players[socket.id].name,
                    text: text,
                    timestamp: Date.now()
                });

                // Next turn
                game.currentTurnIndex++;
                if (game.currentTurnIndex >= game.turnOrder.length) {
                    nextPhase(game); // To Voting
                } else {
                    const nextId = game.turnOrder[game.currentTurnIndex];
                    const nextName = game.players[nextId].name;
                    addSystemMessage(game, `🗣️ It is now ${nextName}'s turn to speak`);
                }
                setupPhaseTimer(game);
                sendStateUpdate(roomCode);
            }
        }
    });

    socket.on('vote', ({ targetId }) => {
        const roomCode = Array.from(socket.rooms).find(r => games[r]);
        const game = games[roomCode];

        if (game && game.state === STATES.VOTING && !game.players[socket.id].isSpectator && !game.players[socket.id].isEliminated) {
            if (!game.votes[socket.id]) { // One vote per player
                game.votes[socket.id] = targetId;

                // Check if all voted
                const activePlayers = getActivePlayers(game);
                if (Object.keys(game.votes).length >= activePlayers.length) {
                    nextPhase(game); // Early finish
                    setupPhaseTimer(game);
                }

                sendStateUpdate(roomCode);
            }
        }
    });

    socket.on('disconnect', () => {
        // Handle disconnect logic (assign new host, mark disconnected)
        // ... simplistic for now
        // Find game
        Object.values(games).forEach(game => {
            if (game.players[socket.id]) {
                game.players[socket.id].connected = false;
                if (game.hostId === socket.id) {
                    // Reassign host
                    const remaining = Object.values(game.players).find(p => p.connected);
                    if (remaining) {
                        game.hostId = remaining.id;
                    } else {
                        delete games[game.roomCode]; // Delete if empty
                        return;
                    }
                }
                sendStateUpdate(game.roomCode);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
