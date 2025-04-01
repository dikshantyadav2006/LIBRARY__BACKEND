import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/adminRoutes.js";
import seatRoutes from "./routes/seatRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import userRoutes from "./routes/userRoutes.js";



dotenv.config();
const app = express();

// Middleware
app.use(express.json());
const allowedOrigins = [
  "http://localhost:5173", // Local frontend
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow cookies
  })
);
app.use(cookieParser());

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/seat", seatRoutes);
app.use("/student", studentRoutes);
app.use("/user", userRoutes);

console.log("MongoDB URI:", process.env.MONGO_URI); // Debugging Line

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
