import { useState, useEffect, useRef } from 'react';

function Settings({ roomCode, onLeave }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="settings-container" ref={menuRef}>
            <button
                className={`settings-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Settings"
            >
                ⚙️
            </button>

            {isOpen && (
                <div className="settings-menu anim-fade-in">
                    <div className="settings-header">
                        <span className="settings-label">Room Code</span>
                        <span className="settings-code">{roomCode}</span>
                    </div>
                    <div className="settings-divider"></div>
                    <button className="btn-danger btn-sm" onClick={onLeave}>
                        Leave Game
                    </button>
                </div>
            )}
        </div>
    );
}

export default Settings;
