import { useState } from 'react';

export default function Home({ socket }) {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [mode, setMode] = useState('menu'); // menu, create, join

    const handleCreate = () => {
        if (!name.trim()) return alert('Enter name');
        socket.emit('create_game', { playerName: name });
    };

    const handleJoin = () => {
        if (!name.trim() || !code.trim()) return alert('Enter name and code');
        socket.emit('join_game', { roomCode: code, playerName: name });
    };

    if (mode === 'menu') {
        return (
            <div className="glass-panel" style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem', background: 'linear-gradient(to right, #6366f1, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Double Agent</h1>
                <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>Trust no one. Word is key.</p>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <button className="btn-primary" onClick={() => setMode('create')}>Create Game</button>
                    <button className="btn-secondary" style={{ color: 'white' }} onClick={() => setMode('join')}>Join Game</button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel">
            <button className="btn-secondary" onClick={() => setMode('menu')} style={{ marginBottom: '1rem', width: 'auto' }}>← Back</button>
            <h2 style={{ marginBottom: '1.5rem' }}>{mode === 'create' ? 'New Mission' : 'Join Mission'}</h2>

            <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Codename</label>
                <input
                    className="input-field"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={12}
                />
            </div>

            {mode === 'join' && (
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mission Code</label>
                    <input
                        className="input-field"
                        placeholder="6-digit code"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        maxLength={6}
                    />
                </div>
            )}

            <button
                className="btn-primary"
                onClick={mode === 'create' ? handleCreate : handleJoin}
            >
                {mode === 'create' ? 'Initialize Lobby' : 'Connect'}
            </button>
        </div>
    );
}
