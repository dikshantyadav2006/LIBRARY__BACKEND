// server.js or index.js

import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server as SocketServer } from "socket.io";
import passport from "passport";

// Passport Configuration
import configurePassport from "./config/passport.js";

// Routes
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/adminRoutes.js";
import seatRoutes from "./routes/seatRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import monthlyBookingRoutes from "./routes/monthlyBookingRoutes.js";

// Load environment variables
dotenv.config();

// Initialize Passport with Google OAuth strategy
configurePassport();

// Express app setup
const app = express();
const server = http.createServer(app);

// CORS allowed origins
const allowedOrigins = [
  "http://localhost:5173", // local dev
  "https://shai-library.vercel.app", // deployed frontend
  "https://sai-library.vercel.app", // deployed frontend
];

// Setup Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Socket.IO connection
io.on("connection", (socket) => {
  // console.log("🟢 A user connected:", socket.id);

  socket.on("disconnect", () => {
    // console.log("🔴 A user disconnected:", socket.id);
  });
});

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(cookieParser());

// Initialize Passport middleware
app.use(passport.initialize());

// Attach socket.io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/seat", seatRoutes);
app.use("/student", studentRoutes);
app.use("/user", userRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/payment", paymentRoutes);
app.use("/monthly-booking", monthlyBookingRoutes);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Server Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
