/**
 * FullscreenContext
 * 
 * Context provider for managing fullscreen state of cards/components.
 * 
 */
import React, { createContext, useContext, useState } from 'react';

const FullscreenContext = createContext();

export function FullscreenProvider({ children }) {
    const [fullscreenCardIndex, setFullscreenCardIndex] = useState(null);

    // Set the index of the card to be displayed in fullscreen
    const enterFullscreen = (index) => {
        setFullscreenCardIndex(index);
    };

    // Exit fullscreen mode
    const exitFullscreen = () => {
        setFullscreenCardIndex(null);
    };

    const isFullscreen = fullscreenCardIndex !== null;

    return (
        <FullscreenContext.Provider
            value={{
                fullscreenCardIndex,
                isFullscreen,
                enterFullscreen,
                exitFullscreen,
            }}
        >
            {children}
        </FullscreenContext.Provider>
    );
}

export function useFullscreen() {
    const context = useContext(FullscreenContext);
    if (!context) {
        throw new Error('useFullscreen must be used within a FullscreenProvider');
    }
    return context;
}
