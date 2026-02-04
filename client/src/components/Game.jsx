import React, { useState, useEffect, useRef } from 'react';

const STATES = {
    WORD_ASSIGNMENT: 'WORD_ASSIGNMENT',
    MESSAGING: 'MESSAGING',
    PRE_VOTING: 'PRE_VOTING',
    VOTING: 'VOTING',
    VOTE_REVEAL: 'VOTE_REVEAL',
    RESULTS: 'RESULTS',
    ROUND_END: 'ROUND_END',
    GAME_OVER: 'GAME_OVER'
};

const TimerBar = ({ endTime, totalDuration }) => {
    const [width, setWidth] = useState(100);

    useEffect(() => {
        if (!endTime) return;
        const interval = setInterval(() => {
            const now = Date.now();
            const left = Math.max(0, endTime - now);
            const pct = (left / totalDuration) * 100;
            setWidth(pct);
            if (left <= 0) clearInterval(interval);
        }, 100);
        return () => clearInterval(interval);
    }, [endTime, totalDuration]);

    return (
        <div className="timer-bar">
            <div className="timer-fill" style={{ width: `${width}%` }} />
        </div>
    );
};

const WordReveal = ({ privateData, gameState }) => {
    if (!privateData || !privateData.word) {
        return (
            <div className="glass-panel" style={{ textAlign: 'center' }}>
                <h2>You are Spectating</h2>
                <p>Relax and watch the chaos unfold.</p>
            </div>
        );
    }

    return (
        <div className="role-card">
            <h3>Your Secret Word</h3>
            <div className="role-word">
                {privateData.word.toUpperCase()}
            </div>
            <p>
                Describe your word carefully. Blend in.
            </p>
            <div className="timer-bar" style={{ marginTop: '1rem' }}>
                <div className="timer-fill" style={{ width: '100%', animation: 'shrink 5s linear' }} />
            </div>
        </div>
    );
};

const Messaging = ({ gameState, myId, socket }) => {
    const [text, setText] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === myId;
    const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
    const currentTurnPlayer = gameState.players[currentTurnPlayerId];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [gameState.messages]);

    useEffect(() => {
        if (isMyTurn) {
            inputRef.current?.focus();
        }
    }, [isMyTurn]);

    const send = () => {
        if (!text.trim()) return;
        socket.emit('send_message', { text });
        setText('');
    };

    return (
        <div className="glass-panel chat-container">
            <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {isMyTurn ? "It's your turn!" : `Waiting for ${currentTurnPlayer?.name}...`}
            </div>

            <div className="messages-area">
                {gameState.messages.map((m, i) => (
                    <div key={i} className={`msg-bubble ${m.type === 'system' ? 'msg-system' : (m.senderId === myId ? 'msg-mine' : 'msg-others')}`}>
                        {m.type !== 'system' && <span className="msg-sender">{m.name}</span>}
                        {m.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    ref={inputRef}
                    className="input-field"
                    style={{ marginBottom: 0 }}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isMyTurn && send()}
                    placeholder={isMyTurn ? "Describe your word..." : "Wait for your turn..."}
                    disabled={!isMyTurn}
                    maxLength={100}
                />
                <button
                    className="btn-primary"
                    style={{ width: 'auto' }}
                    disabled={!isMyTurn}
                    onClick={send}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

const Voting = ({ gameState, myId, socket }) => {
    const [votedFor, setVotedFor] = useState(null);
    const me = gameState.players[myId];
    const canVote = !me.isSpectator && !me.isEliminated;

    const handleVote = (targetId) => {
        if (!canVote || votedFor) return;
        setVotedFor(targetId);
        socket.emit('vote', { targetId });
    };

    // Eligible targets: Active players (not eliminated, not spectator)
    // Actually, can we vote for ourselves? Rules don't say no.
    const targets = Object.values(gameState.players).filter(p => !p.isSpectator && !p.isEliminated && p.connected);

    return (
        <div className="glass-panel">
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Vote to Eliminate</h2>
            <div className="vote-grid">
                {targets.map(p => (
                    <div
                        key={p.id}
                        className={`player-card ${votedFor === p.id ? 'selected' : ''}`}
                        onClick={() => handleVote(p.id)}
                        style={{ cursor: canVote && !votedFor ? 'pointer' : 'default' }}
                    >
                        <div style={{ fontSize: '2rem' }}>👤</div>
                        <div>{p.name}</div>
                        {votedFor === p.id && <div style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>VOTED</div>}
                    </div>
                ))}
            </div>
            {!canVote && <div style={{ textAlign: 'center', marginTop: '1rem', opacity: 0.7 }}>You cannot vote</div>}
        </div>
    );
};

const VoteReveal = ({ gameState }) => {
    // Show charts nicely
    const votes = gameState.voteCounts || {};
    const players = gameState.players;
    const sortedPlayers = Object.values(players)
        .filter(p => !p.isSpectator && p.connected) // Show eliminated players too so we see who got kicked!
        .sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0));

    // Calculate max for bar scaling
    const maxVotes = Math.max(...Object.values(votes), 1);

    return (
        <div className="glass-panel">
            <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Vote Results</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sortedPlayers.map(p => {
                    const count = votes[p.id] || 0;
                    const pct = (count / maxVotes) * 100;
                    return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '100px', textAlign: 'right', fontWeight: 600 }}>{p.name}</div>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '24px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: count > 0 ? 'var(--danger)' : 'transparent',
                                    transition: 'width 1s ease-out'
                                }} />
                            </div>
                            <div style={{ width: '30px', fontWeight: 800 }}>{count}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Results = ({ gameState }) => {
    const { roundResult } = gameState;
    if (!roundResult) return null;

    return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Round Results</h2>
            {roundResult.eliminated ? (
                <div className="anim-fade-in">
                    <div style={{ fontSize: '4rem', margin: '1rem 0' }}>❌</div>
                    <h3>{roundResult.eliminated} was eliminated!</h3>
                    <p style={{ fontSize: '1.2rem', color: roundResult.wasImposter ? 'var(--danger)' : 'var(--success)' }}>
                        They were {roundResult.wasImposter ? 'AN IMPOSTER' : 'A CITIZEN'}
                    </p>
                </div>
            ) : (
                <div>
                    <div style={{ fontSize: '4rem', margin: '1rem 0' }}>😐</div>
                    <h3>No one was eliminated.</h3>
                    <p>{roundResult.reason}</p>
                </div>
            )}
            <div style={{ marginTop: '2rem', opacity: 0.7 }}>Next round starting...</div>
        </div>
    );
};

const GameOver = ({ gameState, socket }) => {
    const { roundResult } = gameState;
    const isHost = gameState.hostId === socket.id;

    return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>GAME OVER</h1>
            <h2>{roundResult.winner} Win!</h2>
            <p style={{ margin: '1rem 0', fontSize: '1.2rem' }}>{roundResult.reason}</p>

            {isHost && (
                <button className="btn-primary" onClick={() => socket.emit('start_game')}>
                    Play Again
                </button>
            )}
        </div>
    );
};

export default function Game({ gameState, privateData, socket, myId }) {
    // Determine timer duration based on phase
    const getDuration = () => {
        switch (gameState.state) {
            case STATES.MESSAGING: return gameState.settings.messageTime * 1000;
            case STATES.PRE_VOTING: return 10000;
            case STATES.VOTING: return gameState.settings.voteTime * 1000;
            case STATES.VOTE_REVEAL: return 4000;
            case STATES.WORD_ASSIGNMENT: return 5000;
            default: return 0;
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            {/* Context Header */}
            <div className="glass-panel" style={{
                padding: '0.5rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid var(--primary)'
            }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Round {gameState.round}</div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                    SECRET WORD: <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                        {privateData?.word?.toUpperCase() || "SPECTATING"}
                    </span>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{Object.values(gameState.players).length} Players</div>
            </div>

            {gameState.timer.active && (
                <TimerBar endTime={gameState.timer.endTime} totalDuration={getDuration()} />
            )}

            <div style={{ marginTop: '1rem' }}>
                {gameState.state === STATES.WORD_ASSIGNMENT && (
                    <WordReveal privateData={privateData} gameState={gameState} />
                )}

                {(gameState.state === STATES.MESSAGING || gameState.state === STATES.PRE_VOTING) && (
                    <>
                        <Messaging gameState={gameState} myId={myId} socket={socket} />
                        {gameState.state === STATES.PRE_VOTING && (
                            <div style={{
                                position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                                background: 'var(--warning)', color: 'black', padding: '1rem 2rem',
                                borderRadius: '99px', fontWeight: '800', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                zIndex: 100, animation: 'bounce 1s infinite'
                            }}>
                                Voting opens soon!
                            </div>
                        )}
                    </>
                )}

                {gameState.state === STATES.VOTING && (
                    <Voting gameState={gameState} myId={myId} socket={socket} />
                )}

                {gameState.state === STATES.VOTE_REVEAL && (
                    <VoteReveal gameState={gameState} />
                )}

                {(gameState.state === STATES.RESULTS || gameState.state === STATES.ROUND_END) && (
                    <Results gameState={gameState} />
                )}

                {gameState.state === STATES.GAME_OVER && (
                    <GameOver gameState={gameState} socket={socket} />
                )}
            </div>
        </div>
    );
}
