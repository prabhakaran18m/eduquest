export interface Player {
  id: string;
  name: string;
  role: 'crewmate' | 'imposter' | null;
  ready: boolean;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  description: string;
  hint: string;
  startingCode: string;
  goalHTMLPatterns: string[];
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface GameRoomState {
  roomId: string;
  status: 'LOBBY' | 'PLAYING' | 'WIN_CREW' | 'WIN_IMPOSTER';
  players: Record<string, Player>;
  tasks: Task[];
  taskStatus: Record<string, 'PENDING' | 'COMPLETED' | 'SABOTAGED'>;
  code: Record<string, string>;
  timeLeft: number;
  totalTime: number;
  sabotagesRemaining: number;
  messages: ChatMessage[];
  lastSabotage?: {
    taskId: string;
    timestamp: number;
    imposterName?: string;
  };
}
