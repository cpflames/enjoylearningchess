import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ChessGame from '../components/ChessGame.tsx';
import { BotLevel } from '../components/ChessBot';

export default function PlayChess() {
  const [searchParams] = useSearchParams();
  
  // Get level from URL parameter, default to 0 if not present or invalid
  const levelParam = searchParams.get('level');
  let botLevel: BotLevel = 0;
  if (levelParam !== null) {
    const parsedLevel = parseInt(levelParam, 10);
    if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 2) {
      botLevel = parsedLevel as BotLevel;
    }
  }

  return <ChessGame botLevel={botLevel} />;
}

