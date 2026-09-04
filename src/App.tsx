import React, { useState, useEffect, useRef, useMemo } from 'react';
import io, { Socket } from 'socket.io-client';
import { GameRoomState, Player, ChatMessage } from './types';
import {
  Play,
  Users,
  Skull,
  ShieldCheck,
  Check,
  AlertTriangle,
  Volume2,
  VolumeX,
  Copy,
  Send,
  Eye,
  Code2,
  Columns,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Flame,
  Bug,
  Shuffle,
  Eraser,
  MessageSquare,
  ListTodo
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sounds } from './utils/sound';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Single socket instance
const socket: Socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
});

export default function App() {
  const [gameState, setGameState] = useState<GameRoomState | null>(null);
  const [name, setName] = useState(() => localStorage.getItem('cs_player_name') || '');
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'alert' } | null>(null);

  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Read roomId from URL hash or search params if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room') || window.location.hash.replace('#', '');
    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
    }
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'alert' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    socket.connect();

    socket.on('game_update', (state: GameRoomState) => {
      setGameState(state);
    });

    socket.on('sabotage_alert', (data: { taskId: string; remaining: number; sabotageType?: string }) => {
      sounds.playSabotage();
      showToast(`SABOTAGE DETECTED! (${data.sabotageType || 'Code altered'})`, 'alert');
    });

    socket.on('task_validation_result', (data: { taskId?: string; success: boolean; message: string }) => {
      if (data.success) {
        sounds.playSuccess();
        showToast(data.message, 'success');
      } else {
        sounds.playError();
        showToast(data.message, 'error');
      }
    });

    return () => {
      socket.off('game_update');
      socket.off('sabotage_alert');
      socket.off('task_validation_result');
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;
    sounds.playClick();
    localStorage.setItem('cs_player_name', name.trim());
    const cleanRoom = roomId.trim().toUpperCase();
    socket.emit('join_room', { roomId: cleanRoom, name: name.trim() });
    setJoined(true);
  };

  const generateRandomRoom = () => {
    sounds.playClick();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomId(res);
  };

  return (
    <div className="relative min-h-screen bg-[#38bdf8] text-[#422006] selection:bg-[#fdba74] selection:text-[#431407]">
      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div
            className={cn(
              "px-6 py-3 border-4 font-pixel text-xs md:text-sm uppercase shadow-[0_6px_0_rgba(0,0,0,0.4)] flex items-center gap-3",
              toastMessage.type === 'success' && "bg-emerald-400 border-[#064e3b] text-[#064e3b]",
              toastMessage.type === 'error' && "bg-rose-400 border-[#881337] text-[#881337]",
              toastMessage.type === 'alert' && "bg-amber-400 border-[#78350f] text-[#78350f]"
            )}
          >
            {toastMessage.type === 'success' && <Check className="w-5 h-5 stroke-[3]" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5 stroke-[3]" />}
            {toastMessage.type === 'alert' && <Flame className="w-5 h-5 stroke-[3]" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {!joined || !gameState ? (
        <JoinScreen
          name={name}
          setName={setName}
          roomId={roomId}
          setRoomId={setRoomId}
          onJoin={handleJoin}
          onGenerateRoom={generateRandomRoom}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          showHowToPlay={showHowToPlay}
          setShowHowToPlay={setShowHowToPlay}
        />
      ) : gameState.status === 'LOBBY' ? (
        <Lobby
          gameState={gameState}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          showToast={showToast}
        />
      ) : gameState.status === 'PLAYING' ? (
        <GameSession
          gameState={gameState}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          showToast={showToast}
        />
      ) : (
        <PostGame
          gameState={gameState}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
        />
      )}
    </div>
  );
}

// ==========================================
// 1. JOIN SCREEN
// ==========================================

function JoinScreen({
  name,
  setName,
  roomId,
  setRoomId,
  onJoin,
  onGenerateRoom,
  soundEnabled,
  setSoundEnabled,
  showHowToPlay,
  setShowHowToPlay,
}: {
  name: string;
  setName: (v: string) => void;
  roomId: string;
  setRoomId: (v: string) => void;
  onJoin: (e: React.FormEvent) => void;
  onGenerateRoom: () => void;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showHowToPlay: boolean;
  setShowHowToPlay: (v: boolean) => void;
}) {
  return (
    <div className="min-h-screen bg-[#38bdf8] flex flex-col items-center justify-center p-4 font-pixel relative overflow-hidden">
      {/* Retro Pixel Sky Background elements */}
      <div className="absolute top-12 left-12 opacity-60 w-28 h-8 bg-white" style={{ boxShadow: '28px -16px 0 white, -28px 12px 0 white' }} />
      <div className="absolute top-24 right-20 opacity-60 w-36 h-8 bg-white" style={{ boxShadow: '-28px -16px 0 white, 28px 16px 0 white' }} />
      <div className="absolute bottom-16 left-24 opacity-40 w-44 h-8 bg-white" style={{ boxShadow: '24px -16px 0 white, -24px 8px 0 white' }} />

      {/* Audio & Info Header Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
        <button
          onClick={() => {
            sounds.playClick();
            setShowHowToPlay(true);
          }}
          className="bg-[#fef3c7] hover:bg-[#fde68a] border-4 border-[#78350f] p-2.5 shadow-[0_4px_0_#78350f] active:translate-y-1 active:shadow-none transition-all text-[#78350f]"
          title="How to Play"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            sounds.playClick();
            setSoundEnabled(prev => !prev);
          }}
          className="bg-[#fef3c7] hover:bg-[#fde68a] border-4 border-[#78350f] p-2.5 shadow-[0_4px_0_#78350f] active:translate-y-1 active:shadow-none transition-all text-[#78350f]"
          title={soundEnabled ? "Mute Audio" : "Unmute Audio"}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      <div className="z-10 max-w-md w-full flex flex-col items-center">
        {/* Title Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#fde047] border-4 border-[#78350f] px-4 py-1 mb-4 shadow-[0_4px_0_#78350f]">
            <Sparkles className="w-4 h-4 text-[#78350f]" />
            <span className="text-xs uppercase text-[#78350f] font-bold">Multiplayer Coding Party</span>
          </div>
          <h1
            className="text-4xl sm:text-5xl text-[#fed7aa] tracking-wider uppercase mb-2"
            style={{
              textShadow:
                '4px 4px 0 #78350f, -3px -3px 0 #78350f, 3px -3px 0 #78350f, -3px 3px 0 #78350f, 0 6px 0 #78350f',
            }}
          >
            CODE SABOTAGE
          </h1>
          <p className="text-xs text-[#78350f] uppercase tracking-widest mt-2 bg-[#fef3c7] inline-block px-3 py-1 border-2 border-[#78350f]">
            Crewmates fix bugs • Imposters corrupt syntax
          </p>
        </div>

        {/* Form Card */}
        <div className="w-full bg-[#fef3c7] border-4 border-[#78350f] p-6 sm:p-8 shadow-[0_10px_0_#78350f]">
          <form onSubmit={onJoin} className="flex flex-col space-y-5">
            <div>
              <label className="block text-xs uppercase text-[#78350f] font-bold mb-2">
                YOUR CODER HANDLE
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={14}
                className="w-full bg-[#fffbeb] border-4 border-[#78350f] px-4 py-3 text-[#78350f] placeholder-[#d97706] focus:outline-none focus:bg-white text-center uppercase text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                placeholder="ENTER NAME"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs uppercase text-[#78350f] font-bold">
                  ROOM CODE
                </label>
                <button
                  type="button"
                  onClick={onGenerateRoom}
                  className="text-[10px] text-[#b45309] hover:underline uppercase flex items-center gap-1 font-bold"
                >
                  <Shuffle className="w-3 h-3" /> New Room
                </button>
              </div>
              <input
                type="text"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                className="w-full bg-[#fffbeb] border-4 border-[#78350f] px-4 py-3 text-[#78350f] placeholder-[#d97706] focus:outline-none focus:bg-white text-center uppercase text-sm tracking-widest shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                placeholder="E.G. ALPHA"
                maxLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] border-4 border-[#14532d] text-white py-4 px-4 shadow-[0_6px_0_#14532d] active:shadow-none active:translate-y-1.5 transition-all flex items-center justify-center gap-2 uppercase text-base font-bold mt-4 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" /> ENTER GAME
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-[#b45309] flex justify-between items-center text-[10px] uppercase text-[#78350f]">
            <span>1-10 PLAYERS</span>
            <span>REAL-TIME MULTIPLAYER</span>
          </div>
        </div>
      </div>

      {/* How To Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="max-w-lg w-full bg-[#fef3c7] border-4 border-[#78350f] p-6 shadow-[0_12px_0_#78350f] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b-4 border-[#78350f] pb-3 mb-4">
              <h2 className="text-xl uppercase text-[#78350f] flex items-center gap-2">
                <HelpCircle className="w-6 h-6" /> HOW TO PLAY
              </h2>
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowHowToPlay(false);
                }}
                className="bg-rose-500 hover:bg-rose-600 border-2 border-[#881337] text-white px-2 py-1 text-xs uppercase"
              >
                CLOSE [X]
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans text-[#78350f] leading-relaxed">
              <div className="bg-[#fffbeb] p-3 border-2 border-[#78350f]">
                <h3 className="font-pixel text-[11px] text-[#15803d] uppercase mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> CIVILIAN / CREWMATE
                </h3>
                <p>
                  Work together to solve all code missions before the countdown expires.
                  Write valid HTML/CSS/JS matching task goals and click <strong>RUN CODE</strong> to verify.
                </p>
              </div>

              <div className="bg-[#fffbeb] p-3 border-2 border-[#78350f]">
                <h3 className="font-pixel text-[11px] text-[#e11d48] uppercase mb-1 flex items-center gap-1.5">
                  <Skull className="w-4 h-4" /> THE IMPOSTER
                </h3>
                <p>
                  Blend in with the crew while stealthily sabotaging tasks! Use your Sabotage abilities or manual edits
                  to inject typos, break HTML tags, and stall progress until time runs out.
                </p>
              </div>

              <div className="bg-[#fed7aa] p-3 border-2 border-[#78350f]">
                <h3 className="font-pixel text-[11px] text-[#78350f] uppercase mb-1 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" /> LIVE PREVIEW & HOTKEYS
                </h3>
                <p>
                  Switch between <strong>Code Editor</strong>, <strong>Split View</strong>, and <strong>Live Preview</strong> anytime.
                  Press <kbd className="bg-white px-1 border border-neutral-600">Tab</kbd> to indent code and <kbd className="bg-white px-1 border border-neutral-600">Ctrl+Enter</kbd> to quickly submit code!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. LOBBY SCREEN
// ==========================================

function Lobby({
  gameState,
  soundEnabled,
  setSoundEnabled,
  showToast,
}: {
  gameState: GameRoomState;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (text: string, type?: 'success' | 'error' | 'alert') => void;
}) {
  const me = gameState.players[socket.id || ''];
  const players = Object.values(gameState.players);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [gameState.messages]);

  const copyRoomLink = () => {
    sounds.playClick();
    const url = `${window.location.origin}${window.location.pathname}?room=${gameState.roomId}`;
    navigator.clipboard.writeText(url);
    showToast(`Room link copied to clipboard!`, 'success');
  };

  const copyRoomCode = () => {
    sounds.playClick();
    navigator.clipboard.writeText(gameState.roomId);
    showToast(`Room code "${gameState.roomId}" copied!`, 'success');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('send_chat', { roomId: gameState.roomId, message: chatInput });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-[#38bdf8] text-[#422006] flex flex-col items-center py-8 px-4 font-pixel relative overflow-hidden">
      {/* Top right sound toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
        <button
          onClick={() => {
            sounds.playClick();
            setSoundEnabled(prev => !prev);
          }}
          className="bg-[#fef3c7] hover:bg-[#fde68a] border-4 border-[#78350f] p-2.5 shadow-[0_4px_0_#78350f] active:translate-y-1 active:shadow-none transition-all text-[#78350f]"
          title={soundEnabled ? "Mute" : "Unmute"}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      <div className="z-10 max-w-4xl w-full flex flex-col space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2
            className="text-[#fed7aa] text-3xl sm:text-4xl mb-3 tracking-widest uppercase"
            style={{
              textShadow:
                '4px 4px 0 #78350f, -2px -2px 0 #78350f, 2px -2px 0 #78350f, -2px 2px 0 #78350f, 0px 4px 0 #78350f',
            }}
          >
            MISSION BRIEFING LOBBY
          </h2>

          <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-[#fef3c7] border-4 border-[#78350f] px-6 py-2.5 shadow-[0_6px_0_#78350f]">
            <span className="text-xs uppercase text-[#b45309]">ROOM:</span>
            <span className="text-xl sm:text-2xl text-[#78350f] font-bold tracking-widest">{gameState.roomId}</span>
            <div className="flex gap-2 ml-2">
              <button
                onClick={copyRoomCode}
                className="bg-[#fed7aa] hover:bg-[#fdba74] border-2 border-[#78350f] px-2 py-1 text-[10px] uppercase flex items-center gap-1 shadow-[0_2px_0_#78350f] active:translate-y-0.5 active:shadow-none"
              >
                <Copy className="w-3 h-3" /> Code
              </button>
              <button
                onClick={copyRoomLink}
                className="bg-[#fed7aa] hover:bg-[#fdba74] border-2 border-[#78350f] px-2 py-1 text-[10px] uppercase flex items-center gap-1 shadow-[0_2px_0_#78350f] active:translate-y-0.5 active:shadow-none"
              >
                <Copy className="w-3 h-3" /> Invite Link
              </button>
            </div>
          </div>
        </div>

        {/* Players Grid + Chat Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Players Roster */}
          <div className="lg:col-span-2 flex flex-col space-y-4">
            <div className="bg-[#fef3c7] border-4 border-[#78350f] p-4 shadow-[0_8px_0_#78350f]">
              <div className="flex justify-between items-center mb-4 border-b-2 border-[#78350f] pb-2">
                <span className="text-xs uppercase text-[#78350f] font-bold flex items-center gap-2">
                  <Users className="w-4 h-4" /> CREW MANIFEST ({players.length} / 10)
                </span>
                <span className="text-[10px] uppercase text-[#b45309]">
                  {players.filter(p => p.ready).length}/{players.length} READY
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {players.map(p => (
                  <div
                    key={p.id}
                    className="bg-[#fffbeb] border-4 border-[#78350f] p-3 flex items-center justify-between shadow-[0_4px_0_#d97706]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={cn(
                          "w-3.5 h-3.5 border-2 border-[#78350f]",
                          p.id === socket.id ? "bg-emerald-400" : "bg-sky-400"
                        )}
                      />
                      <span className="text-xs uppercase truncate font-bold text-[#78350f]">
                        {p.name}
                        {p.id === socket.id && (
                          <span className="text-[10px] ml-1 text-[#b45309] font-normal">(YOU)</span>
                        )}
                      </span>
                    </div>

                    <div>
                      {p.ready ? (
                        <span className="bg-emerald-500 border-2 border-[#064e3b] text-white px-2 py-0.5 text-[10px] shadow-[0_2px_0_#064e3b]">
                          READY
                        </span>
                      ) : (
                        <span className="bg-rose-500 border-2 border-[#881337] text-white px-2 py-0.5 text-[10px] shadow-[0_2px_0_#881337]">
                          NOT READY
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Open slot indicators */}
                {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                  <div
                    key={`slot-${i}`}
                    className="bg-[#fed7aa]/40 border-4 border-[#d97706] border-dashed p-3 flex items-center justify-center"
                  >
                    <span className="text-[10px] uppercase text-[#b45309]">WAITING FOR CODER...</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  sounds.playClick();
                  socket.emit('toggle_ready', gameState.roomId);
                }}
                className="flex-1 bg-[#fed7aa] hover:bg-[#fdba74] border-4 border-[#78350f] py-4 px-4 shadow-[0_6px_0_#78350f] active:shadow-none active:translate-y-1.5 transition-all uppercase text-sm font-bold text-[#78350f] cursor-pointer"
              >
                {me?.ready ? "UNREADY" : "READY UP ✓"}
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  socket.emit('start_game', gameState.roomId);
                }}
                disabled={players.length < 1}
                className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] border-4 border-[#14532d] text-white py-4 px-4 shadow-[0_6px_0_#14532d] active:shadow-none active:translate-y-1.5 transition-all disabled:opacity-50 disabled:grayscale uppercase text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                {players.length === 1 ? "SOLO PRACTICE / START" : "START MISSION"}
              </button>
            </div>
          </div>

          {/* Lobby Chat & Activity Feed */}
          <div className="bg-[#fef3c7] border-4 border-[#78350f] p-4 shadow-[0_8px_0_#78350f] flex flex-col h-[320px] lg:h-auto">
            <div className="text-xs uppercase text-[#78350f] font-bold mb-3 border-b-2 border-[#78350f] pb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> COMMS LOG
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 font-sans text-xs">
              {(gameState.messages || []).map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    "p-2 border",
                    msg.isSystem
                      ? "bg-[#fffbeb] border-[#d97706] text-[#b45309] italic text-[11px]"
                      : "bg-white border-[#78350f] text-[#422006]"
                  )}
                >
                  <div className="font-pixel text-[9px] uppercase font-bold text-[#78350f] mb-0.5">
                    {msg.senderName}
                  </div>
                  <div className="break-words">{msg.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                maxLength={100}
                placeholder="Type message..."
                className="flex-1 bg-white border-2 border-[#78350f] px-2 py-1.5 text-xs text-[#78350f] focus:outline-none"
              />
              <button
                type="submit"
                className="bg-[#fed7aa] hover:bg-[#fdba74] border-2 border-[#78350f] px-3 py-1.5 text-xs uppercase shadow-[0_2px_0_#78350f] active:translate-y-0.5 active:shadow-none"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. GAME SESSION SCREEN
// ==========================================

function GameSession({
  gameState,
  soundEnabled,
  setSoundEnabled,
  showToast,
}: {
  gameState: GameRoomState;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (text: string, type?: 'success' | 'error' | 'alert') => void;
}) {
  const me = gameState.players[socket.id || ''];
  const [codeMap, setCodeMap] = useState<Record<string, string>>(gameState.code);
  const [timeLeft, setTimeLeft] = useState(gameState.timeLeft);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(gameState.tasks[0]?.id || 't1');
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [sidebarTab, setSidebarTab] = useState<'tasks' | 'chat'>('tasks');
  const [showHint, setShowHint] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isGlitching, setIsGlitching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCodeMap(gameState.code);
  }, [gameState.code]);

  useEffect(() => {
    setTimeLeft(gameState.timeLeft);
  }, [gameState.timeLeft]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleTimeSync = (serverTime: number) => {
      setTimeLeft(serverTime);
    };
    socket.on('time_update', handleTimeSync);
    return () => {
      socket.off('time_update', handleTimeSync);
    };
  }, []);

  useEffect(() => {
    const handleRemoteUpdate = ({ taskId, code }: { taskId: string; code: string }) => {
      setCodeMap(prev => ({ ...prev, [taskId]: code }));
      // Trigger subtle glitch animation on editor
      if (taskId === selectedTaskId) {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 300);
      }
    };
    socket.on('code_updated', handleRemoteUpdate);
    return () => {
      socket.off('code_updated', handleRemoteUpdate);
    };
  }, [selectedTaskId]);

  useEffect(() => {
    if (chatScrollRef.current && sidebarTab === 'chat') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [gameState.messages, sidebarTab]);

  const activeTask = useMemo(() => {
    return gameState.tasks.find(t => t.id === selectedTaskId) || gameState.tasks[0];
  }, [gameState.tasks, selectedTaskId]);

  const currentCode = codeMap[selectedTaskId] || '';

  const handleCodeChange = (newCode: string) => {
    setCodeMap(prev => ({ ...prev, [selectedTaskId]: newCode }));
    if (me?.role === 'imposter') {
      socket.emit('imposter_sabotage', {
        roomId: gameState.roomId,
        taskId: selectedTaskId,
        code: newCode,
        sabotageType: 'Manual Code Edit',
      });
    } else {
      socket.emit('update_code', {
        roomId: gameState.roomId,
        taskId: selectedTaskId,
        code: newCode,
      });
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleCodeChange(e.target.value);
  };

  // Imposter Quick Sabotage Tools
  const handleTriggerGlitchSabotage = () => {
    if (gameState.sabotagesRemaining <= 0) {
      showToast('No sabotages remaining!', 'error');
      return;
    }
    sounds.playSabotage();
    const glitches = [
      '<!-- GLITCH -->\n<div class="syntax-error-corrupt">\n',
      '<script>alert("SABOTAGE")</script>',
      '<!-- CORRUPTED STREAM -->\n',
      '<<<<<<< BUG INJECTED >>>>>>>',
    ];
    const picked = glitches[Math.floor(Math.random() * glitches.length)];
    const newCode = currentCode + '\n' + picked;
    socket.emit('imposter_sabotage', {
      roomId: gameState.roomId,
      taskId: selectedTaskId,
      code: newCode,
      sabotageType: 'Glitch Injection',
    });
  };

  const handleTriggerScrambleSabotage = () => {
    if (gameState.sabotagesRemaining <= 0) {
      showToast('No sabotages remaining!', 'error');
      return;
    }
    sounds.playSabotage();
    // Swaps characters in task code
    const scrambled = currentCode
      .split('')
      .map(char => (Math.random() < 0.08 ? char === '<' ? '>' : '_' : char))
      .join('');
    socket.emit('imposter_sabotage', {
      roomId: gameState.roomId,
      taskId: selectedTaskId,
      code: scrambled,
      sabotageType: 'Character Scramble',
    });
  };

  const handleTriggerLineErase = () => {
    if (gameState.sabotagesRemaining <= 0) {
      showToast('No sabotages remaining!', 'error');
      return;
    }
    sounds.playSabotage();
    const lines = currentCode.split('\n');
    if (lines.length > 0) {
      lines.pop();
    }
    socket.emit('imposter_sabotage', {
      roomId: gameState.roomId,
      taskId: selectedTaskId,
      code: lines.join('\n'),
      sabotageType: 'Line Wipe',
    });
  };

  const handleRunCode = () => {
    sounds.playClick();
    socket.emit('submit_task', { roomId: gameState.roomId, taskId: selectedTaskId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to Run Code
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
      return;
    }

    // Tab key indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newCode = currentCode.substring(0, start) + '  ' + currentCode.substring(end);
      handleCodeChange(newCode);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('send_chat', { roomId: gameState.roomId, message: chatInput });
    setChatInput('');
  };

  if (!me) return null;

  const isLowTime = timeLeft <= 30;

  return (
    <div className="h-screen bg-[#fef3c7] text-[#422006] flex flex-col font-pixel overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-[#fed7aa] border-b-4 border-[#78350f] px-4 py-2.5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-[#fffbeb] border-2 border-[#78350f] px-3 py-1 text-xs shadow-[0_2px_0_#78350f]">
            ROOM: <span className="font-bold">{gameState.roomId}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-[#b45309]">ROLE:</span>
            {me.role === 'imposter' ? (
              <span className="bg-rose-500 border-2 border-[#881337] text-white px-2.5 py-0.5 text-xs shadow-[0_2px_0_#881337] uppercase flex items-center gap-1">
                <Skull className="w-3.5 h-3.5" /> IMPOSTER
              </span>
            ) : (
              <span className="bg-emerald-500 border-2 border-[#064e3b] text-white px-2.5 py-0.5 text-xs shadow-[0_2px_0_#064e3b] uppercase flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> CIVILIAN
              </span>
            )}
          </div>
        </div>

        {/* Center View Switcher */}
        <div className="hidden md:flex items-center bg-[#fffbeb] border-2 border-[#78350f] p-0.5">
          <button
            onClick={() => {
              sounds.playClick();
              setViewMode('editor');
            }}
            className={cn(
              "px-3 py-1 text-[10px] uppercase flex items-center gap-1.5 transition-all",
              viewMode === 'editor' ? "bg-[#78350f] text-white" : "text-[#78350f] hover:bg-[#fed7aa]"
            )}
          >
            <Code2 className="w-3.5 h-3.5" /> Editor
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setViewMode('split');
            }}
            className={cn(
              "px-3 py-1 text-[10px] uppercase flex items-center gap-1.5 transition-all",
              viewMode === 'split' ? "bg-[#78350f] text-white" : "text-[#78350f] hover:bg-[#fed7aa]"
            )}
          >
            <Columns className="w-3.5 h-3.5" /> Split
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setViewMode('preview');
            }}
            className={cn(
              "px-3 py-1 text-[10px] uppercase flex items-center gap-1.5 transition-all",
              viewMode === 'preview' ? "bg-[#78350f] text-white" : "text-[#78350f] hover:bg-[#fed7aa]"
            )}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>

        {/* Right Timer & Controls */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "px-3 py-1 border-2 text-sm md:text-base font-bold shadow-[0_2px_0_rgba(0,0,0,0.3)] flex items-center gap-2",
              isLowTime
                ? "bg-rose-500 text-white border-[#881337] animate-pulse"
                : "bg-[#fffbeb] text-[#78350f] border-[#78350f]"
            )}
          >
            <span>TIME:</span>
            <span>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              setSoundEnabled(prev => !prev);
            }}
            className="bg-[#fffbeb] hover:bg-[#fed7aa] border-2 border-[#78350f] p-1.5 text-[#78350f] shadow-[0_2px_0_#78350f] active:translate-y-0.5 active:shadow-none"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 md:w-96 bg-[#fed7aa] border-r-4 border-[#78350f] flex flex-col shrink-0 overflow-hidden">
          {/* Sidebar Tab Selector */}
          <div className="flex border-b-4 border-[#78350f] bg-[#fde047]">
            <button
              onClick={() => {
                sounds.playClick();
                setSidebarTab('tasks');
              }}
              className={cn(
                "flex-1 py-2.5 text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-all",
                sidebarTab === 'tasks' ? "bg-[#fed7aa] text-[#78350f]" : "bg-[#fde047] text-[#b45309] hover:bg-[#fef08a]"
              )}
            >
              <ListTodo className="w-4 h-4" /> Missions
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setSidebarTab('chat');
              }}
              className={cn(
                "flex-1 py-2.5 text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-all",
                sidebarTab === 'chat' ? "bg-[#fed7aa] text-[#78350f]" : "bg-[#fde047] text-[#b45309] hover:bg-[#fef08a]"
              )}
            >
              <MessageSquare className="w-4 h-4" /> Comms ({gameState.messages.length})
            </button>
          </div>

          {sidebarTab === 'tasks' ? (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
              {/* Task Selector Pills */}
              <div>
                <div className="text-[10px] uppercase text-[#b45309] font-bold mb-2 tracking-wider">
                  MISSION SELECTOR
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {gameState.tasks.map((task, idx) => {
                    const status = gameState.taskStatus[task.id];
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <button
                        key={task.id}
                        onClick={() => {
                          sounds.playClick();
                          setSelectedTaskId(task.id);
                        }}
                        className={cn(
                          "py-2 px-1 border-2 text-[10px] font-bold uppercase transition-all shadow-[0_2px_0_rgba(0,0,0,0.2)]",
                          isSelected
                            ? "bg-[#78350f] text-white border-[#78350f] shadow-none translate-y-0.5"
                            : "bg-[#fffbeb] border-[#78350f] text-[#78350f] hover:bg-white active:translate-y-0.5 active:shadow-none",
                          status === 'COMPLETED' && !isSelected && "bg-emerald-100 border-emerald-700 text-emerald-800",
                          status === 'COMPLETED' && isSelected && "bg-emerald-600 border-[#064e3b] text-white",
                          status === 'SABOTAGED' && !isSelected && "bg-rose-100 border-rose-700 text-rose-800 animate-pulse",
                          status === 'SABOTAGED' && isSelected && "bg-rose-600 border-[#881337] text-white"
                        )}
                      >
                        {status === 'COMPLETED' ? `✓ T${idx + 1}` : status === 'SABOTAGED' ? `☠ T${idx + 1}` : `Task ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Task Card */}
              {activeTask && (
                <div
                  className={cn(
                    "bg-[#fffbeb] border-4 p-4 shadow-[0_4px_0_#d97706] flex flex-col space-y-3",
                    gameState.taskStatus[activeTask.id] === 'COMPLETED'
                      ? "border-emerald-600"
                      : gameState.taskStatus[activeTask.id] === 'SABOTAGED'
                      ? "border-rose-600 bg-rose-50"
                      : "border-[#78350f]"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#b45309] block">
                        {activeTask.category}
                      </span>
                      <h3 className="text-base uppercase font-bold text-[#78350f] leading-snug">
                        {activeTask.title}
                      </h3>
                    </div>
                    {gameState.taskStatus[activeTask.id] === 'COMPLETED' ? (
                      <span className="bg-emerald-500 text-white text-[9px] uppercase px-2 py-0.5 border border-[#064e3b]">
                        PASSED
                      </span>
                    ) : gameState.taskStatus[activeTask.id] === 'SABOTAGED' ? (
                      <span className="bg-rose-500 text-white text-[9px] uppercase px-2 py-0.5 border border-[#881337] animate-bounce">
                        SABOTAGED
                      </span>
                    ) : (
                      <span className="bg-amber-400 text-[#78350f] text-[9px] uppercase px-2 py-0.5 border border-[#78350f]">
                        PENDING
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-sans text-[#78350f] leading-relaxed">
                    {activeTask.description}
                  </p>

                  {/* Hint Toggle */}
                  <div className="pt-1 border-t border-dashed border-[#d97706]">
                    <button
                      onClick={() => setShowHint(prev => !prev)}
                      className="text-[10px] text-[#b45309] hover:underline uppercase flex items-center gap-1 font-bold"
                    >
                      <HelpCircle className="w-3 h-3" />
                      {showHint ? "Hide Hint" : "Show Hint"}
                    </button>
                    {showHint && (
                      <div className="mt-2 bg-[#fef3c7] p-2 border border-[#78350f] text-[11px] font-mono text-[#78350f] break-all">
                        {activeTask.hint}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Imposter Sabotage Action Panel */}
              {me.role === 'imposter' && (
                <div className="bg-rose-100 border-4 border-[#881337] p-3 shadow-[0_4px_0_#881337] space-y-2">
                  <div className="flex justify-between items-center text-xs uppercase font-bold text-[#881337]">
                    <span className="flex items-center gap-1">
                      <Flame className="w-4 h-4 text-rose-600" /> SABOTAGE DECK
                    </span>
                    <span className="bg-rose-600 text-white px-2 py-0.5 text-[10px]">
                      {gameState.sabotagesRemaining} LEFT
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={handleTriggerGlitchSabotage}
                      className="bg-[#fffbeb] hover:bg-rose-200 border-2 border-[#881337] p-1.5 text-[9px] text-[#881337] uppercase flex flex-col items-center gap-1 shadow-[0_2px_0_#881337] active:translate-y-0.5 active:shadow-none font-bold"
                      title="Inject syntax glitch"
                    >
                      <Bug className="w-3.5 h-3.5" /> Glitch
                    </button>
                    <button
                      onClick={handleTriggerScrambleSabotage}
                      className="bg-[#fffbeb] hover:bg-rose-200 border-2 border-[#881337] p-1.5 text-[9px] text-[#881337] uppercase flex flex-col items-center gap-1 shadow-[0_2px_0_#881337] active:translate-y-0.5 active:shadow-none font-bold"
                      title="Scramble characters"
                    >
                      <Shuffle className="w-3.5 h-3.5" /> Scramble
                    </button>
                    <button
                      onClick={handleTriggerLineErase}
                      className="bg-[#fffbeb] hover:bg-rose-200 border-2 border-[#881337] p-1.5 text-[9px] text-[#881337] uppercase flex flex-col items-center gap-1 shadow-[0_2px_0_#881337] active:translate-y-0.5 active:shadow-none font-bold"
                      title="Erase line of code"
                    >
                      <Eraser className="w-3.5 h-3.5" /> Wipe Line
                    </button>
                  </div>
                </div>
              )}

              {/* Run Code / Submit Button */}
              <div className="mt-auto pt-2">
                <button
                  onClick={handleRunCode}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] border-4 border-[#14532d] text-white py-3.5 px-4 shadow-[0_6px_0_#14532d] active:shadow-none active:translate-y-1.5 transition-all uppercase text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" /> RUN CODE / VERIFY (CTRL+ENTER)
                </button>
              </div>
            </div>
          ) : (
            /* Sidebar Comms / Chat Tab */
            <div className="flex-1 flex flex-col overflow-hidden p-3 bg-[#fef3c7]">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2 font-sans text-xs">
                {(gameState.messages || []).map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "p-2 border",
                      msg.isSystem
                        ? "bg-[#fffbeb] border-[#d97706] text-[#b45309] italic text-[11px]"
                        : "bg-white border-[#78350f] text-[#422006]"
                    )}
                  >
                    <div className="font-pixel text-[9px] uppercase font-bold text-[#78350f] mb-0.5">
                      {msg.senderName}
                    </div>
                    <div className="break-words">{msg.text}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  maxLength={100}
                  placeholder="Team message..."
                  className="flex-1 bg-white border-2 border-[#78350f] px-2 py-1.5 text-xs text-[#78350f] focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-[#fed7aa] hover:bg-[#fdba74] border-2 border-[#78350f] px-3 py-1.5 text-xs uppercase shadow-[0_2px_0_#78350f] active:translate-y-0.5 active:shadow-none"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </aside>

        {/* Main Code Editor / Live Preview Display */}
        <main className="flex-1 flex flex-col bg-[#1e1e2e] relative overflow-hidden">
          {/* Mobile view switch bar */}
          <div className="flex md:hidden bg-[#282a36] border-b-2 border-[#44475a] p-1 justify-around">
            <button
              onClick={() => setViewMode('editor')}
              className={cn("px-3 py-1 text-[10px] uppercase font-bold text-white", viewMode === 'editor' && "bg-[#44475a]")}
            >
              Editor
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={cn("px-3 py-1 text-[10px] uppercase font-bold text-white", viewMode === 'split' && "bg-[#44475a]")}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn("px-3 py-1 text-[10px] uppercase font-bold text-white", viewMode === 'preview' && "bg-[#44475a]")}
            >
              Preview
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {/* 1. Code Editor */}
            {(viewMode === 'editor' || viewMode === 'split') && (
              <div
                className={cn(
                  "flex-1 flex flex-col bg-[#1e1e2e] overflow-hidden relative border-r border-[#44475a]",
                  isGlitching && "opacity-80 translate-x-0.5"
                )}
              >
                <div className="bg-[#181825] px-4 py-1.5 border-b border-[#313244] flex justify-between items-center text-[10px] uppercase text-[#a6adc8] font-mono">
                  <span>mission_{selectedTaskId}.html</span>
                  <span>HTML / LIVE SYNC</span>
                </div>

                <div className="flex-1 relative font-mono text-sm sm:text-base leading-relaxed text-[#cdd6f4]">
                  <textarea
                    ref={textareaRef}
                    value={currentCode}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full bg-transparent p-4 sm:p-6 focus:outline-none resize-none z-10 font-mono text-emerald-400 leading-relaxed caret-white"
                    placeholder="Write HTML here..."
                  />
                </div>
              </div>
            )}

            {/* 2. Live Preview */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
                <div className="bg-[#f1f5f9] px-4 py-1.5 border-b border-[#cbd5e1] flex justify-between items-center text-[10px] uppercase text-[#64748b] font-pixel">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" /> LIVE BROWSER PREVIEW
                  </span>
                  <span>SANDBOX</span>
                </div>

                <div className="flex-1 p-6 overflow-auto bg-white text-neutral-900 font-sans">
                  {currentCode.trim() ? (
                    <div
                      className="preview-container prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: currentCode }}
                    />
                  ) : (
                    <div className="text-neutral-400 text-sm italic flex items-center justify-center h-full">
                      No HTML written yet. Start typing in the editor!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ==========================================
// 4. POST GAME / MATCH SUMMARY SCREEN
// ==========================================

function PostGame({
  gameState,
  soundEnabled,
  setSoundEnabled,
}: {
  gameState: GameRoomState;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const isCrewWin = gameState.status === 'WIN_CREW';
  const imposters = Object.values(gameState.players).filter(p => p.role === 'imposter');
  const completedTasks = gameState.tasks.filter(t => gameState.taskStatus[t.id] === 'COMPLETED');

  useEffect(() => {
    if (isCrewWin) {
      sounds.playVictory();
    } else {
      sounds.playDefeat();
    }
  }, [isCrewWin]);

  const handleRematch = () => {
    sounds.playClick();
    socket.emit('reset_room', gameState.roomId);
  };

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center p-4 font-pixel relative overflow-hidden",
        isCrewWin ? "bg-[#38bdf8]" : "bg-[#181825]"
      )}
    >
      {/* Audio toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => {
            sounds.playClick();
            setSoundEnabled(prev => !prev);
          }}
          className="bg-[#fef3c7] hover:bg-[#fde68a] border-4 border-[#78350f] p-2.5 shadow-[0_4px_0_#78350f] active:translate-y-1 active:shadow-none transition-all text-[#78350f]"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      <div className="z-10 max-w-2xl w-full flex flex-col items-center text-center space-y-6">
        {/* Victory/Defeat Banner */}
        <div className="space-y-2">
          <div
            className={cn(
              "inline-block border-4 px-4 py-1 text-xs uppercase font-bold",
              isCrewWin
                ? "bg-emerald-400 border-[#064e3b] text-[#064e3b]"
                : "bg-rose-500 border-[#881337] text-white"
            )}
          >
            {isCrewWin ? "MISSION ACCOMPLISHED" : "SYSTEM FAILURE"}
          </div>

          <h1
            className={cn(
              "text-4xl sm:text-6xl uppercase tracking-wider",
              isCrewWin ? "text-[#fed7aa]" : "text-rose-500"
            )}
            style={{
              textShadow: isCrewWin
                ? '5px 5px 0 #78350f, -2px -2px 0 #78350f, 2px -2px 0 #78350f, 0 6px 0 #78350f'
                : '5px 5px 0 #881337, -2px -2px 0 #881337, 2px -2px 0 #881337, 0 6px 0 #881337',
            }}
          >
            {isCrewWin ? "CIVILIANS WIN" : "IMPOSTER SURVIVED"}
          </h1>
        </div>

        {/* Imposter Reveal Card */}
        <div
          className={cn(
            "w-full border-4 p-6 shadow-[0_8px_0_rgba(0,0,0,0.3)] space-y-4",
            isCrewWin ? "bg-[#fef3c7] border-[#78350f] text-[#78350f]" : "bg-[#311b22] border-rose-900 text-rose-300"
          )}
        >
          <div className="text-xs uppercase font-bold tracking-widest border-b-2 border-current pb-2 flex items-center justify-center gap-2">
            <Skull className="w-4 h-4 text-rose-500" /> IMPOSTER IDENTITY REVEALED
          </div>

          <div className="space-y-2">
            {imposters.map(i => (
              <div key={i.id} className="text-xl sm:text-2xl font-bold uppercase tracking-wide">
                <span className="text-rose-500 underline decoration-wavy">{i.name}</span> WAS THE IMPOSTER!
              </div>
            ))}
          </div>

          <p className="text-xs font-sans max-w-md mx-auto opacity-90 leading-relaxed">
            {isCrewWin
              ? "The crew successfully repaired all critical code modules before compilation crashed!"
              : "The imposter successfully corrupted code execution and ran down the mission clock."}
          </p>

          {/* Stats Bar */}
          <div className="pt-3 border-t-2 border-dashed border-current grid grid-cols-2 gap-4 text-xs uppercase">
            <div>
              <span className="block opacity-75 text-[10px]">TASKS REPAIRED</span>
              <span className="font-bold text-sm">
                {completedTasks.length} / {gameState.tasks.length}
              </span>
            </div>
            <div>
              <span className="block opacity-75 text-[10px]">TIME REMAINING</span>
              <span className="font-bold text-sm">{gameState.timeLeft}s</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            onClick={handleRematch}
            className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] border-4 border-[#14532d] text-white py-4 px-6 shadow-[0_6px_0_#14532d] active:shadow-none active:translate-y-1.5 transition-all uppercase text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> PLAY AGAIN
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-[#fed7aa] hover:bg-[#fdba74] border-4 border-[#78350f] text-[#78350f] py-4 px-6 shadow-[0_6px_0_#78350f] active:shadow-none active:translate-y-1.5 transition-all uppercase text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    </div>
  );
}
