import express from "express";
import {
  getSeatsForMonth,
  getSeatDetailsForMonth,
  getAvailableMonths,
  getUserBookings,
  getProtectionStatus,
  protectSeat,
  releaseExpiredProtections,
} from "../controllers/monthlyBookingController.js";
import { verifyUser, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /monthly-booking/months - Get available months for booking
router.get("/months", getAvailableMonths);

// GET /monthly-booking/my-bookings - Get logged-in user's bookings
router.get("/my-bookings", verifyUser, getUserBookings);

// GET /monthly-booking/seats?month=12&year=2025 - Get all seats for a month
router.get("/seats", getSeatsForMonth);

// GET /monthly-booking/seat/:seatNumber?month=12&year=2025 - Get seat details for a month
router.get("/seat/:seatNumber", getSeatDetailsForMonth);

// Seat Protection Routes
// GET /monthly-booking/protection-status/:bookingId - Check if user can protect seat
router.get("/protection-status/:bookingId", verifyUser, getProtectionStatus);

// POST /monthly-booking/protect - Protect seat for future months
router.post("/protect", verifyUser, protectSeat);

// POST /monthly-booking/release-expired - Release expired protections (Admin only)
router.post("/release-expired", verifyAdmin, releaseExpiredProtections);

export default router;

