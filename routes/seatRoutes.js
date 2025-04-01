import express from "express";
import { getAllSeats, getSeatDetails, assignSeat, releaseSeat } from "../controllers/seatController.js";

const router = express.Router();

// ✅ Get all seats
router.get("/", getAllSeats);

// ✅ Get a single seat's details
router.get("/:seatNumber", getSeatDetails);

// ✅ Assign a seat to a student
router.post("/assign", assignSeat);

// ✅ Manually release a seat (admin only)
router.post("/release", releaseSeat);

export default router; // ✅ Use ES Module syntax
