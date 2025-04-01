import mongoose from "mongoose";
import dotenv from "dotenv";
import Seat from "../models/Seat.js";
import Admin from "../models/User.js"; // Ensure this file exists

dotenv.config();

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// 🚀 Initialize Seats
const initializeSeats = async () => {
  try {
    await connectDB();

    // 🔍 Find an admin to assign seats
    const admin = await Admin.findOne({ isAdmin: true });
    if (!admin) throw new Error("❌ No admin found! Create an admin first.");

    // 🏷 Admin ID
    const adminId = admin._id;

    // 🔄 Loop to create seats (1-10 for example)
    for (let i = 1; i <= 50; i++) {
      const seat = new Seat({
        seatNumber: i,
        shifts: [
          { shiftType: "morning", status: "available", assignedBy: adminId },
          { shiftType: "afternoon", status: "available", assignedBy: adminId },
          { shiftType: "night", status: "available", assignedBy: adminId },
        ],
      });

      await seat.save();
      console.log(`✅ Seat ${i} initialized`);
    }

    console.log("🎉 All seats initialized successfully!");
    process.exit();
  } catch (error) {
    console.error("❌ Error initializing seats:", error);
    process.exit(1);
  }
};

initializeSeats();
