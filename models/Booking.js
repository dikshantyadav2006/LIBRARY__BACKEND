import mongoose from "mongoose";

/**
 * Booking - Tracks actual seat bookings (after payment)
 * Separate from MonthlyBooking which is now just a container
 */
const bookingSchema = new mongoose.Schema(
  {
    // The seat number being booked
    seatNumber: { type: Number, required: true },

    // Month (1-12) and Year (e.g., 2025)
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Which shifts are booked (morning, afternoon, night)
    shiftTypes: [
      {
        type: String,
        enum: ["morning", "afternoon", "night"],
        required: true,
      },
    ],

    // User who booked this seat
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Payment reference
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },

    // When booking was created
    bookedAt: { type: Date, default: Date.now },

    // Booking status
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique seat + month + year + shiftType combination
bookingSchema.index({ seatNumber: 1, month: 1, year: 1, shiftTypes: 1 });

// Index for finding bookings by user
bookingSchema.index({ userId: 1 });

// Index for finding bookings by payment
bookingSchema.index({ paymentId: 1 });

// Static method: Check if a shift is booked
bookingSchema.statics.isShiftBooked = async function (
  seatNumber,
  month,
  year,
  shiftType
) {
  const booking = await this.findOne({
    seatNumber,
    month,
    year,
    shiftTypes: shiftType,
    status: "active",
  });

  return !!booking;
};

// Static method: Get all bookings for a seat/month/year
bookingSchema.statics.getBookingsForSeat = async function (
  seatNumber,
  month,
  year
) {
  return await this.find({
    seatNumber,
    month,
    year,
    status: "active",
  })
    .populate("userId", "fullname username")
    .populate("paymentId");
};

// Static method: Create a booking
bookingSchema.statics.createBooking = async function (
  seatNumber,
  month,
  year,
  shiftTypes,
  userId,
  paymentId
) {
  // Check if any of these shifts are already booked
  for (const shiftType of shiftTypes) {
    const isBooked = await this.isShiftBooked(seatNumber, month, year, shiftType);
    if (isBooked) {
      throw new Error(`Shift ${shiftType} is already booked for this seat/month`);
    }
  }

  // Create booking
  const booking = new this({
    seatNumber,
    month,
    year,
    shiftTypes,
    userId,
    paymentId,
  });

  await booking.save();
  return booking;
};

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;

