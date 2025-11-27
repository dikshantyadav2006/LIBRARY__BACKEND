import Seat from "../models/Seat.js";
import User from "../models/User.js";

// ✅ Get all seats (Legacy - use monthly-booking routes instead)
export const getAllSeats = async (req, res) => {
  try {
    const seats = await Seat.find();
    res.status(200).json(seats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching seats", error: error.message });
  }
};

// ✅ Get seat details (Legacy - use monthly-booking routes instead)
export const getSeatDetails = async (req, res) => {
  try {
    const { seatNumber } = req.params;
    const seat = await Seat.findOne({ seatNumber });
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    res.status(200).json({
      seatNumber: seat.seatNumber,
      shifts: seat.shifts,
    });
  } catch (error) {
    console.error("Error fetching seat details:", error);
    res.status(500).json({ message: "Error fetching seat details", error: error.message });
  }
};

// ✅ Assign seat - Now handled by monthly booking system via payment
export const assignSeat = async (req, res) => {
  return res.status(400).json({
    message: "Direct seat assignment is disabled. Please use the monthly booking system with payment."
  });
};


// =================================================>>
// ✅ Release seat(s) for a student
export const releaseSeat = async (req, res) => {
  try {
    const { seatNumber, shiftTypes, adminId } = req.body;

    if (!Array.isArray(shiftTypes) || shiftTypes.length === 0) {
      return res.status(400).json({ message: "Invalid shiftTypes format. It should be an array." });
    }

    const seat = await Seat.findOne({ seatNumber });
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    await seat.releaseSeat(shiftTypes, adminId);
    res.status(200).json({ message: "Seat released successfully", seat });
  } catch (error) {
    res.status(400).json({ message: "Error releasing seat", error: error.message });
  }
};
