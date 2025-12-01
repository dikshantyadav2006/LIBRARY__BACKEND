import mongoose from "mongoose";
import Booking from "./Booking.js";

/**
 * BlockedSeat - Tracks admin-blocked seats
 * Blocked seats cannot be booked or protected by anyone
 */
const blockedSeatSchema = new mongoose.Schema(
  {
    // The seat number being blocked
    seatNumber: { type: Number, required: true },

    // Month (1-12) and Year (e.g., 2025)
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Which shifts are blocked (morning, afternoon, night)
    shiftTypes: [
      {
        type: String,
        enum: ["morning", "afternoon", "night"],
        required: true,
      },
    ],

    // Admin who blocked this seat
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // When block was created
    blockedAt: { type: Date, default: Date.now },

    // Block status
    isBlocked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound index to ensure unique seat + month + year + shiftType combination
blockedSeatSchema.index({ seatNumber: 1, month: 1, year: 1, shiftTypes: 1 });

// Index for finding blocks by admin
blockedSeatSchema.index({ blockedBy: 1 });

// Static method: Check if a shift is blocked
blockedSeatSchema.statics.isShiftBlocked = async function (
  seatNumber,
  month,
  year,
  shiftType
) {
  const block = await this.findOne({
    seatNumber,
    month,
    year,
    shiftTypes: shiftType,
    isBlocked: true,
  });

  return !!block;
};

// Static method: Get all blocks for a seat/month/year
blockedSeatSchema.statics.getBlocksForSeat = async function (
  seatNumber,
  month,
  year
) {
  return await this.find({
    seatNumber,
    month,
    year,
    isBlocked: true,
  }).populate("blockedBy", "fullname username");
};

// Static method: Block shifts
blockedSeatSchema.statics.blockShifts = async function (
  seatNumber,
  month,
  year,
  shiftTypes,
  adminId
) {
  // Check if any shifts are already booked (can't block booked seats)
  for (const shiftType of shiftTypes) {
    const isBooked = await Booking.isShiftBooked(seatNumber, month, year, shiftType);
    if (isBooked) {
      throw new Error(`Shift ${shiftType} is already booked and cannot be blocked`);
    }
  }

  // Remove any existing blocks for these shifts (to update)
  await this.deleteMany({
    seatNumber,
    month,
    year,
    shiftTypes: { $in: shiftTypes },
  });

  // Create new blocks
  const blocks = [];
  for (const shiftType of shiftTypes) {
    const block = new this({
      seatNumber,
      month,
      year,
      shiftTypes: [shiftType],
      blockedBy: adminId,
    });
    await block.save();
    blocks.push(block);
  }

  return blocks;
};

// Static method: Unblock shifts
blockedSeatSchema.statics.unblockShifts = async function (
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
    },
    {
      $set: {
        isBlocked: false,
      },
    }
  );
};

const BlockedSeat =
  mongoose.models.BlockedSeat || mongoose.model("BlockedSeat", blockedSeatSchema);

export default BlockedSeat;

