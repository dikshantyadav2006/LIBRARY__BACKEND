import mongoose from "mongoose";

/**
 * ProtectedSeat - Tracks seat protections (reservations for next month)
 * A protected seat cannot be booked by others until protection expires or is released
 */
const protectedSeatSchema = new mongoose.Schema(
  {
    // The seat number being protected
    seatNumber: { type: Number, required: true },

    // Month (1-12) and Year (e.g., 2025) for which the seat is protected
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Which shifts are protected (morning, afternoon, night)
    shiftTypes: [
      {
        type: String,
        enum: ["morning", "afternoon", "night"],
        required: true,
      },
    ],

    // User who protected this seat
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // When protection was created
    protectedAt: { type: Date, default: Date.now },

    // Protection expires on Day 3 of the month at 23:59:59
    protectionExpiresAt: { type: Date, required: true },

    // Whether protection has been converted to a booking
    isConvertedToBooking: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index to ensure unique seat + month + year + shiftType combination
protectedSeatSchema.index({ seatNumber: 1, month: 1, year: 1, shiftTypes: 1 });

// Index for finding protections by user
protectedSeatSchema.index({ userId: 1 });

// Index for finding expired protections
protectedSeatSchema.index({ protectionExpiresAt: 1 });

// Static method: Check if a shift is protected
protectedSeatSchema.statics.isShiftProtected = async function (
  seatNumber,
  month,
  year,
  shiftType,
  userId = null
) {
  const now = new Date();
  
  const protection = await this.findOne({
    seatNumber,
    month,
    year,
    shiftTypes: shiftType,
    isConvertedToBooking: false,
    protectionExpiresAt: { $gt: now }, // Not expired
  });

  if (!protection) return { isProtected: false, protection: null };

  // If userId is provided and matches, it's protected for them (they can book it)
  if (userId && protection.userId.toString() === userId.toString()) {
    return { isProtected: false, protection: null }; // Not protected for them (they can book)
  }

  // Protected for someone else
  return { isProtected: true, protection };
};

// Static method: Get all protections for a seat/month/year
protectedSeatSchema.statics.getProtectionsForSeat = async function (
  seatNumber,
  month,
  year
) {
  const now = new Date();
  
  return await this.find({
    seatNumber,
    month,
    year,
    isConvertedToBooking: false,
    protectionExpiresAt: { $gt: now }, // Not expired
  }).populate("userId", "fullname username");
};

// Static method: Release expired protections
protectedSeatSchema.statics.releaseExpiredProtections = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      protectionExpiresAt: { $lt: now },
      isConvertedToBooking: false,
    },
    {
      $set: {
        isConvertedToBooking: true, // Mark as expired (treated as converted)
      },
    }
  );
  return result;
};

// Static method: Mark protection as converted to booking
protectedSeatSchema.statics.markAsConverted = async function (
  seatNumber,
  month,
  year,
  shiftTypes
) {
  return await this.updateMany(
    {
      seatNumber,
      month,
      year,
      shiftTypes: { $in: shiftTypes },
      isConvertedToBooking: false,
    },
    {
      $set: {
        isConvertedToBooking: true,
      },
    }
  );
};

const ProtectedSeat =
  mongoose.models.ProtectedSeat || mongoose.model("ProtectedSeat", protectedSeatSchema);

export default ProtectedSeat;

