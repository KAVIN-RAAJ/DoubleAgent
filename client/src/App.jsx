import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

import Settings from './components/Settings';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
    const [socket, setSocket] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [privateData, setPrivateData] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [myId, setMyId] = useState(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setIsConnected(true);
            setMyId(newSocket.id);
        });

        newSocket.on('state_update', (state) => {
            console.log('State Update:', state);
            setGameState(state);
        });

        newSocket.on('private_data', (data) => {
            console.log('Private Data:', data);
            setPrivateData(data);
        });

        newSocket.on('disconnect', () => setIsConnected(false));

        return () => newSocket.close();
    }, []);

    const handleLeaveGame = () => {
        if (socket) {
            socket.emit('leave_game'); // Server should handle this, or just disconnect
        }
        setGameState(null);
        setPrivateData(null);
        // Optional: Force reload to ensure clean state
        window.location.reload();
    };

    if (!socket) return <div className="app-container">Loading...</div>;

    // Render Logic
    let content;
    if (!gameState) {
        content = <Home socket={socket} />;
    } else if (gameState.state === 'LOBBY') {
        content = <Lobby gameState={gameState} socket={socket} myId={myId} />;
    } else {
        content = <Game gameState={gameState} privateData={privateData} socket={socket} myId={myId} />;
    }

    return (
        <div className="app-container">
            {gameState && (
                <Settings roomCode={gameState.roomCode} onLeave={handleLeaveGame} />
            )}
            {content}
        </div>
    );
}

export default App;
