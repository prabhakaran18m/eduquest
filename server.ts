import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";

// --- Game Logic Interface & State ---

interface Player {
  id: string;
  name: string;
  role: "crewmate" | "imposter" | null;
  ready: boolean;
}

interface Task {
  id: string;
  title: string;
  category: string;
  description: string;
  hint: string;
  startingCode: string;
  goalHTMLPatterns: string[];
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface GameRoom {
  roomId: string;
  status: "LOBBY" | "PLAYING" | "WIN_CREW" | "WIN_IMPOSTER";
  players: Record<string, Player>;
  tasks: Task[];
  taskStatus: Record<string, "PENDING" | "COMPLETED" | "SABOTAGED">;
  code: Record<string, string>;
  timeLeft: number;
  totalTime: number;
  sabotagesRemaining: number;
  messages: ChatMessage[];
  lastSabotage?: {
    taskId: string;
    timestamp: number;
  };
}

const TASKS: Task[] = [
  {
    id: "t1",
    title: "Main Heading",
    category: "HTML Basics",
    description: 'Create an <h1> heading with the text "Code Sabotage"',
    hint: "Use <h1>Code Sabotage</h1>",
    startingCode: "<!-- Task 1: Create an h1 heading with 'Code Sabotage' -->\n\n",
    goalHTMLPatterns: ["<h1[^>]*>[\\s\\n\\r]*code\\s+sabotage[\\s\\n\\r]*<\\/h1>"],
  },
  {
    id: "t2",
    title: "Action Button",
    category: "Interactive",
    description: 'Create a <button> with the text "Launch Rocket"',
    hint: "Use <button>Launch Rocket</button>",
    startingCode: "<!-- Task 2: Create a button with 'Launch Rocket' -->\n\n",
    goalHTMLPatterns: ["<button[^>]*>[\\s\\n\\r]*launch\\s+rocket[\\s\\n\\r]*<\\/button>"],
  },
  {
    id: "t3",
    title: "Status Paragraph",
    category: "Typography",
    description: 'Create a <p> paragraph containing "Systems Operational"',
    hint: "Use <p>Systems Operational</p>",
    startingCode: "<!-- Task 3: Create a paragraph with 'Systems Operational' -->\n\n",
    goalHTMLPatterns: ["<p[^>]*>[\\s\\n\\r]*systems\\s+operational[\\s\\n\\r]*<\\/p>"],
  },
  {
    id: "t4",
    title: "Danger Alert",
    category: "Styling & Tags",
    description: 'Create a paragraph <p> containing bold text "CRITICAL WARNING" inside <strong> or <b> tags',
    hint: "Use <p><strong>CRITICAL WARNING</strong></p>",
    startingCode: "<!-- Task 4: Create a paragraph with bold text 'CRITICAL WARNING' -->\n\n",
    goalHTMLPatterns: [
      "<p[^>]*>[\\s\\n\\r]*<(strong|b)[^>]*>[\\s\\n\\r]*critical\\s+warning[\\s\\n\\r]*<\\/(strong|b)>[\\s\\n\\r]*<\\/p>",
      "<(strong|b)[^>]*>[\\s\\n\\r]*critical\\s+warning[\\s\\n\\r]*<\\/(strong|b)>"
    ],
  },
  {
    id: "t5",
    title: "Hyperlink Navigation",
    category: "Links",
    description: 'Create an anchor link <a> with href="https://example.com" and link text "Emergency Portal"',
    hint: 'Use <a href="https://example.com">Emergency Portal</a>',
    startingCode: "<!-- Task 5: Create a link pointing to https://example.com with text 'Emergency Portal' -->\n\n",
    goalHTMLPatterns: ["<a[^>]*href=[\"'][^\"']*example\\.com[^\"']*[\"'][^>]*>[\\s\\n\\r]*emergency\\s+portal[\\s\\n\\r]*<\\/a>"],
  },
  {
    id: "t6",
    title: "Crew Checklist",
    category: "Lists",
    description: 'Create an unordered list <ul> with at least 2 list items <li> (e.g., "Shields" and "Engines")',
    hint: "Use <ul><li>Item 1</li><li>Item 2</li></ul>",
    startingCode: "<!-- Task 6: Create an unordered list with 2 list items -->\n\n",
    goalHTMLPatterns: ["<ul[^>]*>(?:[\\s\\S]*?<li[^>]*>[\\s\\S]*?<\\/li>){2,}[\\s\\S]*?<\\/ul>"],
  }
];

const rooms: Record<string, GameRoom> = {};

function validateCodeAgainstTask(code: string, task: Task): boolean {
  if (!code || typeof code !== "string") return false;
  return task.goalHTMLPatterns.some((pattern) => {
    try {
      const regex = new RegExp(pattern, "i");
      return regex.test(code);
    } catch {
      // Fallback simple search
      const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
      const cleanPattern = pattern.toLowerCase().replace(/[^a-z0-9<>]/g, "");
      return normalizedCode.includes(cleanPattern);
    }
  });
}

// Tick all games every second for timer
setInterval(() => {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.status === "PLAYING") {
      room.timeLeft -= 1;
      if (room.timeLeft <= 0) {
        room.status = "WIN_IMPOSTER";
        room.messages.push({
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          senderName: "SYSTEM",
          text: "Time expired! The Imposter successfully sabotaged the ship!",
          timestamp: Date.now(),
          isSystem: true,
        });
        io.to(roomId).emit("game_update", room);
      } else if (room.timeLeft % 5 === 0) {
        io.to(roomId).emit("time_update", room.timeLeft);
      }
    }
  }
}, 1000);

// --- Server Setup ---

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 30000,
  pingInterval: 10000,
});

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeRooms: Object.keys(rooms).length,
    timestamp: new Date().toISOString(),
  });
});

io.on("connection", (socket) => {
  socket.on(
    "join_room",
    ({ roomId, name }: { roomId: string; name: string }) => {
      const cleanRoomId = (roomId || "LOBBY").trim().toUpperCase();
      const cleanName = (name || "Coder").trim().substring(0, 16);
      socket.join(cleanRoomId);

      if (!rooms[cleanRoomId]) {
        rooms[cleanRoomId] = {
          roomId: cleanRoomId,
          status: "LOBBY",
          players: {},
          tasks: TASKS,
          taskStatus: {},
          code: {},
          timeLeft: 120,
          totalTime: 120,
          sabotagesRemaining: 6,
          messages: [
            {
              id: `msg-${Date.now()}`,
              senderName: "SYSTEM",
              text: `Room ${cleanRoomId} initialized. Welcome!`,
              timestamp: Date.now(),
              isSystem: true,
            },
          ],
        };
      }

      const room = rooms[cleanRoomId];

      room.players[socket.id] = {
        id: socket.id,
        name: cleanName,
        role: null,
        ready: false,
      };

      room.messages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        senderName: "SYSTEM",
        text: `${cleanName} joined the crew.`,
        timestamp: Date.now(),
        isSystem: true,
      });

      io.to(cleanRoomId).emit("game_update", room);
    }
  );

  socket.on("toggle_ready", (roomId: string) => {
    const cleanRoomId = roomId.toUpperCase();
    const room = rooms[cleanRoomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].ready = !room.players[socket.id].ready;
      io.to(cleanRoomId).emit("game_update", room);
    }
  });

  socket.on("start_game", (roomId: string) => {
    const cleanRoomId = roomId.toUpperCase();
    const room = rooms[cleanRoomId];
    if (room && room.status === "LOBBY") {
      const playerIds = Object.keys(room.players);
      if (playerIds.length === 0) return;

      // Assign roles
      playerIds.forEach((id) => (room.players[id].role = "crewmate"));
      
      // Select 1 imposter (if 1 player for solo test, make them imposter 50% or allow practice)
      const imposterIndex = Math.floor(Math.random() * playerIds.length);
      room.players[playerIds[imposterIndex]].role = "imposter";

      room.status = "PLAYING";
      room.code = {};
      room.tasks.forEach((t) => (room.code[t.id] = t.startingCode));
      room.taskStatus = {};
      room.tasks.forEach((t) => (room.taskStatus[t.id] = "PENDING"));
      room.timeLeft = 120;
      room.totalTime = 120;
      room.sabotagesRemaining = Math.max(4, playerIds.length * 3);

      room.messages.push({
        id: `msg-${Date.now()}`,
        senderName: "SYSTEM",
        text: "Game started! Fix all code missions before time runs out. Watch out for the imposter!",
        timestamp: Date.now(),
        isSystem: true,
      });

      io.to(cleanRoomId).emit("game_update", room);
    }
  });

  socket.on(
    "update_code",
    ({
      roomId,
      taskId,
      code,
    }: {
      roomId: string;
      taskId: string;
      code: string;
    }) => {
      const cleanRoomId = roomId.toUpperCase();
      const room = rooms[cleanRoomId];
      if (room && room.status === "PLAYING") {
        room.code[taskId] = code;
        socket.to(cleanRoomId).emit("code_updated", { taskId, code });
      }
    }
  );

  socket.on(
    "imposter_sabotage",
    ({
      roomId,
      taskId,
      code,
      sabotageType,
    }: {
      roomId: string;
      taskId: string;
      code: string;
      sabotageType?: string;
    }) => {
      const cleanRoomId = roomId.toUpperCase();
      const room = rooms[cleanRoomId];
      const player = room?.players[socket.id];

      if (
        room &&
        room.status === "PLAYING" &&
        player?.role === "imposter" &&
        room.sabotagesRemaining > 0
      ) {
        room.sabotagesRemaining -= 1;
        room.code[taskId] = code;
        room.lastSabotage = {
          taskId,
          timestamp: Date.now(),
        };

        if (
          room.taskStatus[taskId] === "COMPLETED" ||
          room.taskStatus[taskId] === "PENDING"
        ) {
          room.taskStatus[taskId] = "SABOTAGED";
        }

        const taskTitle = room.tasks.find((t) => t.id === taskId)?.title || "Task";
        room.messages.push({
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          senderName: "ALERT",
          text: `WARNING: Sabotage detected on ${taskTitle}! (${sabotageType || "Code altered"})`,
          timestamp: Date.now(),
          isSystem: true,
        });

        socket.to(cleanRoomId).emit("code_updated", { taskId, code });
        io.to(cleanRoomId).emit("sabotage_alert", {
          taskId,
          remaining: room.sabotagesRemaining,
          sabotageType,
        });
        io.to(cleanRoomId).emit("game_update", room);
      }
    }
  );

  socket.on("submit_task", ({ roomId, taskId }: { roomId: string; taskId?: string }) => {
    const cleanRoomId = roomId.toUpperCase();
    const room = rooms[cleanRoomId];
    if (room && room.status === "PLAYING") {
      let anyNewCompleted = false;
      let completedTaskTitle = "";

      const tasksToCheck = taskId
        ? room.tasks.filter((t) => t.id === taskId)
        : room.tasks;

      tasksToCheck.forEach((task) => {
        const isMatch = validateCodeAgainstTask(room.code[task.id] || "", task);
        if (isMatch) {
          if (room.taskStatus[task.id] !== "COMPLETED") {
            room.taskStatus[task.id] = "COMPLETED";
            anyNewCompleted = true;
            completedTaskTitle = task.title;
          }
        } else if (taskId === task.id) {
          socket.emit("task_validation_result", {
            taskId: task.id,
            success: false,
            message: `Task "${task.title}" requirements not satisfied. Check hints & tags!`,
          });
        }
      });

      const allCompleted = room.tasks.every(
        (t) => room.taskStatus[t.id] === "COMPLETED"
      );

      if (allCompleted) {
        room.status = "WIN_CREW";
        room.messages.push({
          id: `msg-${Date.now()}`,
          senderName: "SYSTEM",
          text: "VICTORY! The crew repaired all code missions!",
          timestamp: Date.now(),
          isSystem: true,
        });
      } else if (anyNewCompleted) {
        room.messages.push({
          id: `msg-${Date.now()}`,
          senderName: "SYSTEM",
          text: `Mission "${completedTaskTitle}" verified and completed!`,
          timestamp: Date.now(),
          isSystem: true,
        });
      }

      if (anyNewCompleted || allCompleted) {
        io.to(cleanRoomId).emit("task_validation_result", {
          taskId,
          success: true,
          message: allCompleted ? "ALL TASKS COMPLETED!" : `Task verified!`,
        });
        io.to(cleanRoomId).emit("game_update", room);
      }
    }
  });

  socket.on(
    "send_chat",
    ({ roomId, message }: { roomId: string; message: string }) => {
      const cleanRoomId = roomId.toUpperCase();
      const room = rooms[cleanRoomId];
      const player = room?.players[socket.id];
      if (room && player && message && message.trim()) {
        const chatMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          senderName: player.name,
          text: message.trim().substring(0, 140),
          timestamp: Date.now(),
        };
        room.messages.push(chatMsg);
        if (room.messages.length > 50) {
          room.messages.shift();
        }
        io.to(cleanRoomId).emit("chat_message", chatMsg);
      }
    }
  );

  socket.on("reset_room", (roomId: string) => {
    const cleanRoomId = roomId.toUpperCase();
    const room = rooms[cleanRoomId];
    if (room) {
      room.status = "LOBBY";
      room.taskStatus = {};
      room.code = {};
      room.timeLeft = 120;
      Object.keys(room.players).forEach((id) => {
        room.players[id].ready = false;
        room.players[id].role = null;
      });
      room.messages.push({
        id: `msg-${Date.now()}`,
        senderName: "SYSTEM",
        text: "Room reset to lobby. Ready up for the next match!",
        timestamp: Date.now(),
        isSystem: true,
      });
      io.to(cleanRoomId).emit("game_update", room);
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        const playerName = room.players[socket.id].name;
        delete room.players[socket.id];

        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
        } else {
          room.messages.push({
            id: `msg-${Date.now()}`,
            senderName: "SYSTEM",
            text: `${playerName} disconnected.`,
            timestamp: Date.now(),
            isSystem: true,
          });
          io.to(roomId).emit("game_update", room);
        }
      }
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), "dist"))
      ? path.join(process.cwd(), "dist")
      : path.resolve(__dirname);

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🎮 Code Sabotage server running at:`);
    console.log(`   > Local:   http://localhost:${PORT}`);
    console.log(`   > Network: http://127.0.0.1:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
