import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Pressable, Animated, Modal } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { fetchEmojiKitchenMash } from '@/lib/emojiKitchenService';
import { useGame } from '@/context/GameContext';

type EmojiItem = { id?: string; emoji: string; name?: string; imageUrl?: string };
type Piece = { player: 1 | 2; isKing: boolean; emoji: string; imageUrl?: string };
type Difficulty = 'easy' | 'medium' | 'hard';

export const ChessGame: React.FC<{ onBack?: () => void; wallet: EmojiItem[] }> = ({ onBack, wallet }) => {
  const gameContext = useGame();
  const { registerCustomEmoji, emojiCatalog, grantEmojiUnlock } = gameContext;
  const [gameState, setGameState] = useState<'select' | 'difficulty' | 'playing' | 'gameOver'>('select');
  const [playerEmoji, setPlayerEmoji] = useState<EmojiItem | null>(null);
  const [cpuEmoji, setCpuEmoji] = useState<EmojiItem | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameWinner, setGameWinner] = useState<1 | 2 | null>(null);
  const [wins, setWins] = useState({ player: 0, cpu: 0 });
  const [board, setBoard] = useState<(Piece | null)[]>(Array(64).fill(null));
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [blendedEmojiUrl, setBlendedEmojiUrl] = useState<string | null>(null);
  const [winRewardEmojiUrl, setWinRewardEmojiUrl] = useState<string | null>(null);
  const [forcedJumpPiece, setForcedJumpPiece] = useState<number | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Hard mode reward states
  const [showHardModeRewardModal, setShowHardModeRewardModal] = useState(false);
  const [hardModeRewardEmoji, setHardModeRewardEmoji] = useState<{ emoji: string; name: string; imageUrl?: string } | null>(null);
  const [hardModeRewardEmojiId, setHardModeRewardEmojiId] = useState<string | null>(null);
  const [hardModeRewardGrantedForGame, setHardModeRewardGrantedForGame] = useState(false);

  useEffect(() => {
    if (playerEmoji && cpuEmoji && gameState === 'select') {
      const blendEmojis = async () => {
        try {
          console.log(`[ChessGame] Blending ${playerEmoji.emoji} + ${cpuEmoji.emoji}`);
          const result = await fetchEmojiKitchenMash(playerEmoji.emoji, cpuEmoji.emoji);
          console.log(`[ChessGame] Blend successful:`, result.imageUrl);
          setBlendedEmojiUrl(result.imageUrl);
        } catch (error) {
          console.log('[ChessGame] Blend failed:', error);
          setBlendedEmojiUrl(null);
        }
      };
      blendEmojis();
    }
  }, [playerEmoji, cpuEmoji, gameState]);

  // Handle hard mode reward - blended emoji when player wins on hard difficulty
  useEffect(() => {
    if (gameState !== 'gameOver' || gameWinner !== 1 || difficulty !== 'hard' || hardModeRewardGrantedForGame) {
      return;
    }

    const grantReward = async () => {
      const baseEmojis = emojiCatalog.filter(e => !e.id.startsWith('custom-'));
      if (baseEmojis.length < 2) {
        console.warn('[Hard Mode Reward] Not enough base emojis');
        setHardModeRewardGrantedForGame(true);
        return;
      }

      let foundBlend = false;
      let attemptCount = 0;
      const maxAttempts = 50;

      while (!foundBlend && attemptCount < maxAttempts) {
        try {
          const emoji1 = baseEmojis[Math.floor(Math.random() * baseEmojis.length)];
          let emoji2 = baseEmojis[Math.floor(Math.random() * baseEmojis.length)];
          
          let diffAttempts = 0;
          while (emoji2.id === emoji1.id && diffAttempts < 3) {
            emoji2 = baseEmojis[Math.floor(Math.random() * baseEmojis.length)];
            diffAttempts++;
          }

          console.log(`[Hard Mode Reward] Attempt ${attemptCount + 1}: Blending ${emoji1.emoji} + ${emoji2.emoji}`);
          const result = await fetchEmojiKitchenMash(emoji1.emoji, emoji2.emoji);
          const compositeEmoji = `${emoji1.emoji}${emoji2.emoji}`;
          
          // Validate the URL before using it
          if (!result.imageUrl || typeof result.imageUrl !== 'string' || result.imageUrl.trim() === '') {
            attemptCount++;
            continue;
          }
          
          const blendedDef = registerCustomEmoji(compositeEmoji, {
            name: `${emoji1.name} & ${emoji2.name}`,
            costOverride: 0,
            imageUrl: result.imageUrl,
            tags: ['hard mode reward', 'blend'],
          });
          
          if (blendedDef && blendedDef.imageUrl) {
            setHardModeRewardEmoji({ 
              emoji: compositeEmoji, 
              name: blendedDef.name,
              imageUrl: blendedDef.imageUrl,
            });
            setHardModeRewardEmojiId(blendedDef.id);
            setShowHardModeRewardModal(true);
            foundBlend = true;
          }
        } catch (error) {
          console.warn(`[Hard Mode Reward] Blend attempt ${attemptCount + 1} failed:`, error);
          attemptCount++;
        }
      }

      setHardModeRewardGrantedForGame(true);
    };

    grantReward();
  }, [gameState, gameWinner, difficulty, hardModeRewardGrantedForGame, emojiCatalog, registerCustomEmoji]);

  const initializeBoard = (p: EmojiItem, c: EmojiItem) => {
    const newBoard = Array(64).fill(null);
    
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          newBoard[row * 8 + col] = { player: 1, isKing: false, emoji: p.emoji, imageUrl: p.imageUrl };
        }
      }
    }
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          newBoard[row * 8 + col] = { player: 2, isKing: false, emoji: c.emoji, imageUrl: c.imageUrl };
        }
      }
    }
    
    setBoard(newBoard);
    setPlayerScore(0);
    setCpuScore(0);
    setSelectedSquare(null);
    setValidMoves([]);
    setForcedJumpPiece(null);
  };

  const startGame = (pEmoji: EmojiItem, cEmoji: EmojiItem) => {
    setPlayerEmoji(pEmoji);
    setCpuEmoji(cEmoji);
    initializeBoard(pEmoji, cEmoji);
    setGameState('difficulty');
  };

  const startGameWithDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    setGameState('playing');
  };

  const quickStart = () => {
    if (wallet.length >= 2) {
      const shuffled = [...wallet].sort(() => Math.random() - 0.5);
      startGame(shuffled[0], shuffled[1]);
    }
  };

  const getValidMoves = (index: number, piece: Piece): number[] => {
    const moves: number[] = [];
    const row = Math.floor(index / 8);
    const col = index % 8;

    const directions = piece.isKing
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.player === 1
        ? [[-1, -1], [-1, 1]]
        : [[1, -1], [1, 1]];

    // Regular moves (one square)
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      const newIndex = newRow * 8 + newCol;

      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && !board[newIndex]) {
        moves.push(newIndex);
      }
    }

    // Jump moves (two squares, capturing opponent)
    for (const [dRow, dCol] of directions) {
      const midRow = row + dRow;
      const midCol = col + dCol;
      const midIndex = midRow * 8 + midCol;

      const jumpRow = row + dRow * 2;
      const jumpCol = col + dCol * 2;
      const jumpIndex = jumpRow * 8 + jumpCol;

      // Check if jump is in bounds
      if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
        const midPiece = board[midIndex];
        const jumpSquare = board[jumpIndex];

        // Check if there's an opponent piece to jump over and empty landing square
        if (midPiece && midPiece.player !== piece.player && !jumpSquare) {
          moves.push(jumpIndex);
        }
      }
    }

    return moves;
  };

  const getJumpMoves = (index: number, piece: Piece, boardToCheck?: (Piece | null)[]): number[] => {
    const checkBoard = boardToCheck || board;
    const moves: number[] = [];
    const row = Math.floor(index / 8);
    const col = index % 8;

    const directions = piece.isKing
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.player === 1
        ? [[-1, -1], [-1, 1]]
        : [[1, -1], [1, 1]];

    // Jump moves (two squares, capturing opponent)
    for (const [dRow, dCol] of directions) {
      const midRow = row + dRow;
      const midCol = col + dCol;
      const midIndex = midRow * 8 + midCol;

      const jumpRow = row + dRow * 2;
      const jumpCol = col + dCol * 2;
      const jumpIndex = jumpRow * 8 + jumpCol;

      // Check if jump is in bounds
      if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
        const midPiece = checkBoard[midIndex];
        const jumpSquare = checkBoard[jumpIndex];

        // Check if there's an opponent piece to jump over and empty landing square
        if (midPiece && midPiece.player !== piece.player && !jumpSquare) {
          moves.push(jumpIndex);
        }
      }
    }

    return moves;
  };

  const handleSquarePress = (index: number) => {
    if (gameState !== 'playing') return;

    if (selectedSquare === null) {
      // If there's a forced jump piece, only allow selecting that piece
      if (forcedJumpPiece !== null && index !== forcedJumpPiece) {
        return;
      }
      
      const piece = board[index];
      if (piece && piece.player === 1) {
        setSelectedSquare(index);
        setValidMoves(getValidMoves(index, piece));
      }
    } else {
      if (validMoves.includes(index)) {
        const newBoard = [...board];
        const piece = newBoard[selectedSquare];
        if (piece) {
          const fromRow = Math.floor(selectedSquare / 8);
          const fromCol = selectedSquare % 8;
          const toRow = Math.floor(index / 8);
          const toCol = index % 8;

          // Check if this is a jump move (moving 2 squares diagonally)
          const rowDiff = Math.abs(toRow - fromRow);
          const colDiff = Math.abs(toCol - fromCol);
          
          if (rowDiff === 2 && colDiff === 2) {
            // Jump move - capture the piece in between
            const midRow = (fromRow + toRow) / 2;
            const midCol = (fromCol + toCol) / 2;
            const midIndex = midRow * 8 + midCol;
            const capturedPiece = newBoard[midIndex];
            
            if (capturedPiece) {
              newBoard[midIndex] = null;
              // Player 1 captured opponent (player 2)
              if (capturedPiece.player === 2) {
                setPlayerScore(playerScore + 1);
              }
            }
          }

          // Check for king promotion
          if ((piece.player === 1 && toRow === 0) || (piece.player === 2 && toRow === 7)) {
            piece.isKing = true;
          }
          
          newBoard[index] = piece;
          newBoard[selectedSquare] = null;
          
          // Check if this was a jump move and if there are more jumps available
          if (rowDiff === 2 && colDiff === 2) {
            // Was a jump, check for additional jumps from the new position
            const additionalJumps = getJumpMoves(index, newBoard[index]!, newBoard);
            if (additionalJumps.length > 0) {
              // Force the player to continue jumping with this piece
              setBoard(newBoard);
              setSelectedSquare(index);
              setValidMoves(additionalJumps);
              setForcedJumpPiece(index);
              return; // Don't end turn yet
            }
          }
          
          setBoard(newBoard);
          setSelectedSquare(null);
          setValidMoves([]);
          setForcedJumpPiece(null);

          setTimeout(() => {
            makeCPUMove(newBoard);
          }, 500);
        }
      } else if (board[index]?.player === 1) {
        setSelectedSquare(index);
        const piece = board[index];
        if (piece) setValidMoves(getValidMoves(index, piece));
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    }
  };

  const generateWinRewardEmoji = async () => {
    if (!wallet || wallet.length < 2) {
      console.log('[ChessGame] Not enough emojis in wallet to blend');
      return;
    }
    
    try {
      // Get two random emojis from wallet
      const shuffled = [...wallet].sort(() => Math.random() - 0.5);
      const emoji1 = shuffled[0];
      const emoji2 = shuffled[1];
      
      console.log(`[ChessGame] Generating win reward: blending ${emoji1.emoji} + ${emoji2.emoji}`);
      const result = await fetchEmojiKitchenMash(emoji1.emoji, emoji2.emoji);
      console.log(`[ChessGame] Win reward blend successful:`, result.imageUrl);
      setWinRewardEmojiUrl(result.imageUrl);
    } catch (error) {
      console.log('[ChessGame] Win reward blend failed:', error);
      setWinRewardEmojiUrl(null);
    }
  };

  const makeCPUMove = (currentBoard: (Piece | null)[]) => {
    const cpuPieces: number[] = [];
    currentBoard.forEach((piece, idx) => {
      if (piece?.player === 2) cpuPieces.push(idx);
    });

    if (cpuPieces.length === 0) {
      setGameWinner(1);
      setGameState('gameOver');
      setWins(prev => ({ ...prev, player: prev.player + 1 }));
      generateWinRewardEmoji();
      if (gameContext?.updateCheckersEmojiStats && playerEmoji?.id) {
        console.log('[ChessGame] Player won - updating stats for:', playerEmoji.id);
        gameContext.updateCheckersEmojiStats(playerEmoji.id, true);
      } else {
        console.warn('[ChessGame] Cannot update stats - gameContext:', !!gameContext, 'playerEmoji.id:', playerEmoji?.id);
      }
      return;
    }

    // Collect all possible moves
    const allMoves: { fromIndex: number; moves: number[] }[] = [];
    for (const fromIndex of cpuPieces) {
      const piece = currentBoard[fromIndex];
      if (piece) {
        const moves = getValidMoves(fromIndex, piece);
        if (moves.length > 0) {
          allMoves.push({ fromIndex, moves });
        }
      }
    }

    if (allMoves.length === 0) {
      setGameWinner(1);
      setGameState('gameOver');
      setWins(prev => ({ ...prev, player: prev.player + 1 }));
      generateWinRewardEmoji();
      if (gameContext?.updateCheckersEmojiStats && playerEmoji?.id) {
        console.log('[ChessGame] Player won (no CPU moves) - updating stats for:', playerEmoji.id);
        gameContext.updateCheckersEmojiStats(playerEmoji.id, true);
      } else {
        console.warn('[ChessGame] Cannot update stats - gameContext:', !!gameContext, 'playerEmoji.id:', playerEmoji?.id);
      }
      return;
    }

    let bestMove: { fromIndex: number; toIndex: number } | null = null;

    if (difficulty === 'easy') {
      // Easy: Random move
      const moveSet = allMoves[Math.floor(Math.random() * allMoves.length)];
      bestMove = { fromIndex: moveSet.fromIndex, toIndex: moveSet.moves[Math.floor(Math.random() * moveSet.moves.length)] };
    } else {
      // Medium and Hard: Prefer captures
      const captureMoves = allMoves.filter(m => {
        return m.moves.some(toIndex => {
          const rowDiff = Math.abs(Math.floor(toIndex / 8) - Math.floor(m.fromIndex / 8));
          return rowDiff === 2;
        });
      });

      if (captureMoves.length > 0) {
        const moveSet = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        const captureIndices = moveSet.moves.filter(toIndex => {
          const rowDiff = Math.abs(Math.floor(toIndex / 8) - Math.floor(moveSet.fromIndex / 8));
          return rowDiff === 2;
        });
        bestMove = { fromIndex: moveSet.fromIndex, toIndex: captureIndices[0] };
      } else {
        const moveSet = allMoves[Math.floor(Math.random() * allMoves.length)];
        bestMove = { fromIndex: moveSet.fromIndex, toIndex: moveSet.moves[0] };
      }
    }

    if (!bestMove) return;

    const newBoard = [...currentBoard];
    const movingPiece = newBoard[bestMove.fromIndex];
    if (movingPiece) {
      const fromRow = Math.floor(bestMove.fromIndex / 8);
      const toRow = Math.floor(bestMove.toIndex / 8);
      const toCol = bestMove.toIndex % 8;

      const rowDiff = Math.abs(toRow - fromRow);
      const colDiff = Math.abs(toCol - (bestMove.fromIndex % 8));
      
      if (rowDiff === 2 && colDiff === 2) {
        const midRow = (fromRow + toRow) / 2;
        const midCol = ((bestMove.fromIndex % 8) + toCol) / 2;
        const midIndex = midRow * 8 + midCol;
        const capturedPiece = newBoard[midIndex];
        
        if (capturedPiece) {
          newBoard[midIndex] = null;
          if (capturedPiece.player === 1) {
            setCpuScore(cpuScore + 1);
          }
        }
      }

      if ((movingPiece.player === 2 && toRow === 7) || (movingPiece.player === 1 && toRow === 0)) {
        movingPiece.isKing = true;
      }
      
      newBoard[bestMove.toIndex] = movingPiece;
      newBoard[bestMove.fromIndex] = null;
      setBoard(newBoard);
    }

    if (!newBoard.some(p => p?.player === 1)) {
      setGameWinner(2);
      setGameState('gameOver');
      setWins(prev => ({ ...prev, cpu: prev.cpu + 1 }));
      if (gameContext?.updateCheckersEmojiStats && playerEmoji?.id) {
        console.log('[ChessGame] Player lost - updating stats for:', playerEmoji.id);
        gameContext.updateCheckersEmojiStats(playerEmoji.id, false);
      } else {
        console.warn('[ChessGame] Cannot update stats - gameContext:', !!gameContext, 'playerEmoji.id:', playerEmoji?.id);
      }
    }
  };

  const resetGame = () => {
    setGameState('select');
    setPlayerEmoji(null);
    setCpuEmoji(null);
    setDifficulty('medium');
  };

  const newGame = () => {
    if (playerEmoji && cpuEmoji) {
      setWinRewardEmojiUrl(null);
      // Clear hard mode reward states for next game
      setHardModeRewardEmoji(null);
      setHardModeRewardEmojiId(null);
      setShowHardModeRewardModal(false);
      setHardModeRewardGrantedForGame(false);
      initializeBoard(playerEmoji, cpuEmoji);
      setGameState('difficulty');
    }
  };

  const rotateWinnerEmoji = () => {
    rotateAnim.setValue(0);
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  };

  // Difficulty selection screen
  if (gameState === 'difficulty') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => setGameState('select')}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Select Difficulty</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.difficultyContainer}>
          <Text style={styles.setupTitle}>Choose CPU Difficulty</Text>

          <TouchableOpacity
            style={[styles.difficultyButton, difficulty === 'easy' && styles.difficultyButtonSelected]}
            onPress={() => startGameWithDifficulty('easy')}
          >
            <Text style={styles.difficultyEmoji}>🟢</Text>
            <Text style={styles.difficultyTitle}>Easy</Text>
            <Text style={styles.difficultyDesc}>CPU makes random moves</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.difficultyButton, difficulty === 'medium' && styles.difficultyButtonSelected]}
            onPress={() => startGameWithDifficulty('medium')}
          >
            <Text style={styles.difficultyEmoji}>🟡</Text>
            <Text style={styles.difficultyTitle}>Medium</Text>
            <Text style={styles.difficultyDesc}>CPU prefers captures</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.difficultyButton, difficulty === 'hard' && styles.difficultyButtonSelected]}
            onPress={() => startGameWithDifficulty('hard')}
          >
            <Text style={styles.difficultyEmoji}>🔴</Text>
            <Text style={styles.difficultyTitle}>Hard</Text>
            <Text style={styles.difficultyDesc}>CPU always captures</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Game over screen - rendered as overlay on the game board
  // (game board is still rendered, game over popup is on top)

  // Character selection screen
  if (gameState === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Lettuce Checkers</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.setupContainer}>
          <Text style={styles.setupTitle}>Pick Your Characters</Text>
          <Text style={styles.setupSubtitle}>Choose 2 emojis to play as</Text>

          <View style={styles.characterSelectionRow}>
            <View style={styles.playerSection}>
              <Text style={styles.sectionLabel}>Your Character</Text>
              <TouchableOpacity
                style={styles.characterButton}
                onPress={() => setPlayerEmoji(wallet[Math.floor(Math.random() * wallet.length)])}
              >
                {playerEmoji?.imageUrl ? (
                  <ExpoImage source={{ uri: playerEmoji.imageUrl }} style={styles.characterEmojiImage} contentFit="contain" />
                ) : (
                  <Text style={styles.characterEmoji}>{playerEmoji?.emoji || '?'}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.cpuSection}>
              <Text style={styles.sectionLabel}>CPU Character</Text>
              <TouchableOpacity
                style={styles.characterButton}
                onPress={() => setCpuEmoji(wallet[Math.floor(Math.random() * wallet.length)])}
              >
                {cpuEmoji?.imageUrl ? (
                  <ExpoImage source={{ uri: cpuEmoji.imageUrl }} style={styles.characterEmojiImage} contentFit="contain" />
                ) : (
                  <Text style={styles.characterEmoji}>{cpuEmoji?.emoji || '?'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.startButton, { opacity: playerEmoji && cpuEmoji ? 1 : 0.5 }]}
            onPress={() => playerEmoji && cpuEmoji && startGame(playerEmoji, cpuEmoji)}
            disabled={!playerEmoji || !cpuEmoji}
          >
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickStartButton}
            onPress={quickStart}
          >
            <Text style={styles.quickStartButtonText}>Quick Start (Random)</Text>
          </TouchableOpacity>

          <Text style={styles.walletTitle}>Available Characters</Text>
          <View style={styles.walletGrid}>
            {wallet.map((e, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.walletItem}
                onPress={() => {
                  if (!playerEmoji) setPlayerEmoji(e);
                  else if (!cpuEmoji) setCpuEmoji(e);
                }}
              >
                {e.imageUrl ? (
                  <ExpoImage source={{ uri: e.imageUrl }} style={styles.walletEmojiImage} contentFit="contain" />
                ) : (
                  <Text style={styles.walletEmoji}>{e.emoji}</Text>
                )}
                <Text style={styles.walletName}>{e.name || ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Lettuce Checkers</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.gameContainer}>
        <View style={styles.checkersBoard}>
          {board.map((piece, index) => {
            const row = Math.floor(index / 8);
            const col = index % 8;
            const isLight = (row + col) % 2 === 0;
            const isSelected = index === selectedSquare;
            const isValidMove = validMoves.includes(index);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.square,
                  isLight ? styles.lightSquare : styles.darkSquare,
                  isSelected && styles.selectedSquare,
                  isValidMove && styles.validMoveSquare,
                ]}
                onPress={() => handleSquarePress(index)}
              >
                {piece && (
                  <View style={styles.pieceContainer}>
                    {piece.isKing && <Text style={styles.kingCrown}>👑</Text>}
                    {piece.imageUrl ? (
                      <ExpoImage source={{ uri: piece.imageUrl }} style={styles.squarePieceImage} contentFit="contain" />
                    ) : (
                      <Text style={styles.squarePiece}>{piece.emoji}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.scoreBar}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreEmoji}>{playerEmoji?.emoji}</Text>
            <Text style={styles.scoreText}>You: {playerScore}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreEmoji}>{cpuEmoji?.emoji}</Text>
            <Text style={styles.scoreText}>CPU: {cpuScore}</Text>
          </View>
        </View>

        <View style={styles.gameFooter}>
          <TouchableOpacity style={styles.button} onPress={() => setGameState('select')}>
            <Text style={styles.buttonText}>End Game</Text>
          </TouchableOpacity>
        </View>

        {gameState === 'gameOver' && (
          <View style={styles.gameOverOverlay}>
            <View style={styles.gameOverCardFlappy}>
              <Pressable onPress={rotateWinnerEmoji}>
                <Animated.View
                  style={[
                    styles.winnerCircleFlappy,
                    {
                      transform: [
                        {
                          rotate: rotateAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '-360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {gameWinner === 1 ? (
                    playerEmoji?.imageUrl ? (
                      <ExpoImage source={{ uri: playerEmoji.imageUrl }} style={styles.winnerEmojiImage} contentFit="contain" />
                    ) : (
                      <Text style={styles.winnerEmojiFlappy}>{playerEmoji?.emoji}</Text>
                    )
                  ) : (
                    cpuEmoji?.imageUrl ? (
                      <ExpoImage source={{ uri: cpuEmoji.imageUrl }} style={styles.winnerEmojiImage} contentFit="contain" />
                    ) : (
                      <Text style={styles.winnerEmojiFlappy}>{cpuEmoji?.emoji}</Text>
                    )
                  )}
                </Animated.View>
              </Pressable>

              <Text style={styles.gameOverTitleFlappy}>
                {gameWinner === 1 ? 'You Won! 🎉' : 'CPU Won! 🤖'}
              </Text>

              <View style={styles.scoreCardHeader}>
                <View style={styles.scoresSection}>
                  <View style={styles.scoreCardRow}>
                    <Text style={styles.scoreCardLabel}>Your Score</Text>
                    <Text style={styles.scoreCardValue}>{playerScore}</Text>
                  </View>
                  <View style={styles.scoreCardDivider} />
                  <View style={styles.scoreCardRow}>
                    <Text style={styles.scoreCardLabel}>CPU Score</Text>
                    <Text style={styles.scoreCardValue}>{cpuScore}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.scoreCardHeader}>
                <View style={styles.scoresSection}>
                  <View style={styles.scoreCardRow}>
                    <Text style={styles.scoreCardLabel}>Your Wins</Text>
                    <Text style={styles.scoreCardValue}>{wins.player}</Text>
                  </View>
                  <View style={styles.scoreCardDivider} />
                  <View style={styles.scoreCardRow}>
                    <Text style={styles.scoreCardLabel}>CPU Wins</Text>
                    <Text style={styles.scoreCardValue}>{wins.cpu}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.gameOverButtonRow}>
                <Pressable style={styles.playAgainButtonFlappy} onPress={newGame}>
                  <Text style={styles.playAgainTextFlappy}>Play Again</Text>
                </Pressable>
                <Pressable style={styles.homeButtonFlappy} onPress={onBack}>
                  <Text style={styles.homeTextFlappy}>Home</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Hard Mode Reward Modal */}
        <Modal
          visible={showHardModeRewardModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowHardModeRewardModal(false)}
        >
          <View style={styles.rewardModalOverlay}>
            <View style={styles.rewardModalCard}>
              <View style={styles.rewardModalHeader}>
                <Text style={styles.rewardModalIcon}>🎉</Text>
              </View>
              <Text style={styles.rewardModalTitle}>Hard Mode Victory!</Text>
              <Text style={styles.rewardModalSubtitle}>You earned a special blended emoji!</Text>
              
              {hardModeRewardEmoji && hardModeRewardEmoji.imageUrl ? (
                <View style={styles.rewardEmojiContainer}>
                  <ExpoImage
                    source={{ uri: hardModeRewardEmoji.imageUrl }}
                    style={styles.rewardEmojiImage}
                    contentFit="contain"
                  />
                  <Text style={styles.rewardEmojiName}>{hardModeRewardEmoji.name}</Text>
                </View>
              ) : null}
              
              <View style={{ gap: 12 }}>
                <Pressable
                  style={styles.rewardAcceptButton}
                  onPress={() => {
                    if (hardModeRewardEmojiId) {
                      grantEmojiUnlock(hardModeRewardEmojiId);
                    }
                    setShowHardModeRewardModal(false);
                  }}
                >
                  <Text style={styles.rewardAcceptButtonText}>Claim Emoji</Text>
                </Pressable>
                <Pressable
                  style={styles.rewardDeclineButton}
                  onPress={() => {
                    setShowHardModeRewardModal(false);
                  }}
                >
                  <Text style={styles.rewardDeclineButtonText}>Maybe Later</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0fdf4' },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#065f46' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#065f46' },
  headerSpacer: { width: 60 },
  setupContainer: { padding: 16, gap: 16 },
  setupTitle: { fontSize: 28, fontWeight: '700', color: '#065f46', textAlign: 'center' },
  setupSubtitle: { fontSize: 16, color: '#047857', textAlign: 'center' },
  characterSelectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 40 },
  playerSection: { alignItems: 'center', gap: 8 },
  cpuSection: { alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#047857' },
  characterButton: { paddingHorizontal: 20, paddingVertical: 20, borderRadius: 16, backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#86efac' },
  characterEmoji: { fontSize: 32 },
  characterEmojiImage: { width: 40, height: 40 },
  characterName: { fontSize: 12, color: '#047857', textAlign: 'center' },
  startButton: { marginTop: 12, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#86efac', borderWidth: 2, borderColor: '#22c55e' },
  startButtonText: { fontWeight: '700', fontSize: 16, color: '#065f46' },
  quickStartButton: { marginTop: 8, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: '#d1fae5', borderWidth: 2, borderColor: '#6ee7b7' },
  quickStartButtonText: { fontWeight: '600', fontSize: 14, color: '#065f46' },
  walletTitle: { fontSize: 16, fontWeight: '700', color: '#065f46', marginTop: 16, marginBottom: 8 },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  walletItem: { flex: 1, minWidth: 80, padding: 8, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac' },
  walletEmoji: { fontSize: 24, marginBottom: 4 },
  walletEmojiImage: { width: 32, height: 32, marginBottom: 4 },
  walletName: { fontSize: 11, color: '#047857', textAlign: 'center' },
  gameContainer: { flex: 1, padding: 12, flexDirection: 'column' },
  checkersBoard: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 2, borderColor: '#065f46', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  square: { width: '12.5%', height: '12.5%', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(0, 0, 0, 0.1)' },
  lightSquare: { backgroundColor: '#f5deb3' },
  darkSquare: { backgroundColor: '#8b7355' },
  selectedSquare: { backgroundColor: '#ffeb3b' },
  validMoveSquare: { backgroundColor: '#4caf50' },
  pieceContainer: { alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
  squarePiece: { fontSize: 28 },
  squarePieceImage: { width: 32, height: 32 },
  kingCrown: { fontSize: 16, marginBottom: -6 },
  scoreBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  scoreItem: { alignItems: 'center', gap: 4 },
  scoreEmoji: { fontSize: 20 },
  scoreText: { fontSize: 14, fontWeight: '600', color: '#065f46' },
  gameFooter: { paddingVertical: 12, gap: 8, alignItems: 'center' },
  gameOverText: { fontSize: 16, fontWeight: '700', color: '#065f46', marginBottom: 8 },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  buttonText: { fontWeight: '600', color: '#065f46' },
  difficultyContainer: { padding: 16, gap: 16 },
  difficultyButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac', flexDirection: 'row', gap: 12 },
  difficultyButtonSelected: { backgroundColor: '#86efac' },
  difficultyEmoji: { fontSize: 24 },
  difficultyTitle: { fontSize: 18, fontWeight: '600', color: '#065f46' },
  difficultyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  gameOverContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  gameOverCard: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 16, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac' },
  winnerCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#86efac', marginBottom: 16 },
  winnerEmoji: { fontSize: 32 },
  resultText: { fontSize: 20, fontWeight: '700', color: '#065f46', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#065f46' },
  statDivider: { width: 1, height: 24, backgroundColor: '#e0e0e0' },
  winsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24 },
  winsItem: { alignItems: 'center' },
  winsLabel: { fontSize: 12, color: '#6b7280' },
  winsValue: { fontSize: 16, fontWeight: '600', color: '#065f46' },
  winsDivider: { width: 1, height: 24, backgroundColor: '#e0e0e0' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  newGameButton: { flex: 1, marginRight: 8, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#86efac' },
  newGameButtonText: { fontWeight: '600', color: '#065f46' },
  homeButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#dcfce7' },
  homeButtonText: { fontWeight: '600', color: '#065f46' },
  gameOverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30, 58, 138, 0.9)', alignItems: 'center', justifyContent: 'center', padding: 40 },
  gameOverCardFlappy: { backgroundColor: '#FFF', borderRadius: 12, padding: 24, width: '100%', maxWidth: 320, borderWidth: 3, borderColor: '#8B7355' },
  winnerCircleFlappy: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F4B41A', borderWidth: 3, borderColor: '#D89B00', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  winnerEmojiFlappy: { fontSize: 50 },
  winnerEmojiImage: { width: 70, height: 70 },
  gameOverTitleFlappy: { fontSize: 28, fontWeight: '700', color: '#8B7355', textAlign: 'center', marginBottom: 16, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  scoreCardHeader: { flexDirection: 'row', gap: 15, marginBottom: 12 },
  scoresSection: { flex: 1 },
  scoreCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreCardLabel: { fontSize: 16, fontWeight: '600', color: '#8B7355' },
  scoreCardValue: { fontSize: 18, fontWeight: '700', color: '#2F6D22' },
  scoreCardDivider: { height: 1, backgroundColor: '#E5E5E5', marginVertical: 8 },
  gameOverButtonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  playAgainButtonFlappy: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#F4B41A', borderWidth: 3, borderColor: '#D89B00', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  playAgainTextFlappy: { fontSize: 16, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  homeButtonFlappy: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#E5E5E5', borderWidth: 2, borderColor: '#999' },
  homeTextFlappy: { fontSize: 16, fontWeight: '600', color: '#333' },
  
  // Reward modal styles
  rewardModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  rewardModalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', maxWidth: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  rewardModalHeader: { marginBottom: 16 },
  rewardModalIcon: { fontSize: 48 },
  rewardModalTitle: { fontSize: 24, fontWeight: '700', color: '#065f46', marginBottom: 8, textAlign: 'center' },
  rewardModalSubtitle: { fontSize: 16, color: '#047857', marginBottom: 16, textAlign: 'center' },
  rewardEmojiContainer: { alignItems: 'center', marginBottom: 24, gap: 12 },
  rewardEmojiImage: { width: 120, height: 120 },
  rewardEmojiName: { fontSize: 16, fontWeight: '600', color: '#065f46', textAlign: 'center' },
  rewardAcceptButton: { width: '100%', paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#16a34a' },
  rewardAcceptButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  rewardDeclineButton: { width: '100%', paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#E5E5E5', borderWidth: 1, borderColor: '#999' },
  rewardDeclineButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
});

export default ChessGame;
