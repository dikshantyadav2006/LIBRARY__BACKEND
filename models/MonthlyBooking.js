import mongoose from "mongoose";

/**
 * MonthlyBooking - Container for seat/month/year combinations
 * Actual booking/protection/blocking data is stored in separate models:
 * - Booking: Actual bookings
 * - ProtectedSeat: Protected seats
 * - BlockedSeat: Admin-blocked seats
 */
const monthlyBookingSchema = new mongoose.Schema(
  {
    // The seat number
    seatNumber: { type: Number, required: true },

    // Month (1-12) and Year (e.g., 2025)
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Shifts structure (for compatibility with frontend)
    // Status will be populated from Booking, ProtectedSeat, and BlockedSeat models
    shifts: [
      {
        shiftType: { type: String, enum: ["morning", "afternoon", "night"], required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        bookedAt: { type: Date, default: null },
        status: { type: String, enum: ["available", "booked", "cancelled", "blocked", "protected"], default: "available" },
        blockedByAdmin: { type: Boolean, default: false },
        // Protection fields - populated from ProtectedSeat model
        protectedForUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        protectedAt: { type: Date, default: null },
        protectionExpiresAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

// Compound index to ensure unique seat + month + year combination
monthlyBookingSchema.index({ seatNumber: 1, month: 1, year: 1 }, { unique: true });

// Static method: Get or create a monthly booking record for a seat
monthlyBookingSchema.statics.getOrCreateForMonth = async function (seatNumber, month, year) {
  let booking = await this.findOne({ seatNumber, month, year });

  if (!booking) {
    // Create new booking with all shifts available
    booking = new this({
      seatNumber,
      month,
      year,
      shifts: [
        { shiftType: "morning", status: "available" },
        { shiftType: "afternoon", status: "available" },
        { shiftType: "night", status: "available" },
      ],
    });
    await booking.save();
  }

  return booking;
};

// Static method: Get all bookings for a specific month/year
monthlyBookingSchema.statics.getAllForMonth = async function (month, year, totalSeats = 30) {
  const existingBookings = await this.find({ month, year });

  // Create a map of existing bookings by seat number
  const bookingMap = new Map();
  existingBookings.forEach((b) => bookingMap.set(b.seatNumber, b));

  // Generate data for all seats (1 to totalSeats)
  const allSeats = [];
  for (let seatNum = 1; seatNum <= totalSeats; seatNum++) {
    if (bookingMap.has(seatNum)) {
      allSeats.push(bookingMap.get(seatNum));
    } else {
      // Virtual seat with all shifts available (not saved to DB yet)
      allSeats.push({
        seatNumber: seatNum,
        month,
        year,
        shifts: [
          { shiftType: "morning", status: "available", userId: null },
          { shiftType: "afternoon", status: "available", userId: null },
          { shiftType: "night", status: "available", userId: null },
        ],
      });
    }
  }

  return allSeats;
};

// Note: Booking, protection, and blocking logic has been moved to separate models:
// - Booking model for actual bookings
// - ProtectedSeat model for protected seats
// - BlockedSeat model for admin-blocked seats
// Use the seatAvailabilityService helper to populate shift data

const MonthlyBooking = mongoose.model("MonthlyBooking", monthlyBookingSchema);
export default MonthlyBooking;

