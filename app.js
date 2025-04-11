import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server as SocketServer } from "socket.io";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/adminRoutes.js";
import seatRoutes from "./routes/seatRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";

dotenv.config();
const app = express();
const server = http.createServer(app); // <-- Wrap express in HTTP server
const io = new SocketServer(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend origin
    credentials: true,
  },
});

// Optional: Handle socket connections
io.on("connection", (socket) => {
  console.log("🟢 A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected:", socket.id);
  });
});

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173 ",
    
    // Your frontend origin
    credentials: true,
  })
);
app.use(cookieParser());

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/seat", seatRoutes);
app.use("/student", studentRoutes);
app.use("/user", userRoutes);
app.use("/feedback", feedbackRoutes);

console.log("MongoDB URI:", process.env.MONGO_URI); // Debug line

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

// Server Listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
