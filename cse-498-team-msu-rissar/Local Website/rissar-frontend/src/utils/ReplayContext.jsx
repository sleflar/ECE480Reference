/**
 * ReplayContext
 * 
 * Context provider for managing replay mode state.
 * Provides utilities to transform topic names for replay (appending `_bag`).
 * 
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ReplayContext = createContext(null);

export function ReplayProvider({ children }) {
  const [isReplaying, setIsReplaying] = useState(false);

  // Transform topic name for replay mode (append _bag)
  const getTopicName = useCallback((liveTopic) => {
    if (!isReplaying || !liveTopic) {
      return liveTopic;
    }

    if (liveTopic.endsWith('_bag')) {
      return liveTopic;
    }

    return `${liveTopic}_bag`;
  }, [isReplaying]);

  const startReplay = useCallback(() => {
    setIsReplaying(true);
  }, []);

  const stopReplay = useCallback(() => {
    setIsReplaying(false);
  }, []);

  // Log state changes
  useEffect(() => {
    console.log('[ReplayContext] Replay mode:', isReplaying ? 'ON' : 'OFF');
  }, [isReplaying]);

  const value = {
    isReplaying,
    getTopicName,
    startReplay,
    stopReplay,
  };

  return (
    <ReplayContext.Provider value={value}>
      {children}
    </ReplayContext.Provider>
  );
}

export function useReplay() {
  const context = useContext(ReplayContext);
  if (!context) {
    throw new Error('useReplay must be used within a ReplayProvider');
  }
  return context;
}


export function useReplayTopic(baseTopic) {
  const { getTopicName, isReplaying } = useReplay();
  const [currentTopic, setCurrentTopic] = useState(baseTopic);

  useEffect(() => {
    const topic = getTopicName(baseTopic);
    if (topic !== currentTopic) {
      setCurrentTopic(topic);
    }
  }, [baseTopic, getTopicName, isReplaying]);

  return currentTopic;
}