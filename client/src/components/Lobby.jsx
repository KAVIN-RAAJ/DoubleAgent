import React from 'react';

export default function Lobby({ gameState, socket, myId }) {
    const players = Object.values(gameState.players);
    const isHost = gameState.hostId === myId;
    const canStart = players.length >= 3;

    const copyCode = () => {
        navigator.clipboard.writeText(gameState.roomCode);
        // Maybe show toast instead of alert? Alert is fine for prototype.
    };

    return (
        <div className="glass-panel">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>MISSION CODE</p>
                <div
                    onClick={copyCode}
                    style={{
                        display: 'inline-block',
                        background: 'rgba(99, 102, 241, 0.2)',
                        padding: '0.75rem 2rem',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        border: '1px dashed var(--primary)',
                        transition: 'all 0.2s'
                    }}
                >
                    <span style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '4px', fontFamily: 'monospace' }}>{gameState.roomCode}</span>
                </div>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.5 }}>Tap to copy invite link</p>
            </div>

            <h3 style={{ marginBottom: '1rem' }}>Agents ({players.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
                {players.map(p => (
                    <div key={p.id} style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: p.id === myId ? '1px solid var(--success)' : '1px solid var(--glass-border)',
                        position: 'relative'
                    }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>👤</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        {p.id === gameState.hostId && <div style={{ position: 'absolute', top: '-5px', right: '-5px', fontSize: '0.7rem' }}>👑</div>}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 'auto' }}>
                {isHost ? (
                    <button
                        className="btn-primary"
                        disabled={!canStart}
                        onClick={() => socket.emit('start_game')}
                    >
                        {canStart ? 'INITIATE MISSION' : `Need ${3 - players.length} more agents`}
                    </button>
                ) : (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
                        <div className="anim-fade-in">Waiting for host to initiate...</div>
                    </div>
                )}
            </div>
        </div>
    );
}
