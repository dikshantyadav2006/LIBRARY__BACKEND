import mongoose from "mongoose";

/**
 * MonthlyBooking - Tracks seat bookings per month (like movie theater)
 * Each document represents one booking: a user's seat + shifts for a specific month/year
 */
const monthlyBookingSchema = new mongoose.Schema(
  {
    // The seat number being booked
    seatNumber: { type: Number, required: true },

    // Month (1-12) and Year (e.g., 2025)
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Which shifts are booked for this month
    shifts: [
      {
        shiftType: { type: String, enum: ["morning", "afternoon", "night"], required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        bookedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["available", "booked", "cancelled", "blocked", "protected"], default: "available" },
        blockedByAdmin: { type: Boolean, default: false },
        // Protection fields - seat reserved for user from previous month
        protectedForUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        protectedAt: { type: Date, default: null },
        protectionExpiresAt: { type: Date, default: null }, // Day 3 of the month
      },
    ],

    // Payment reference
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
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

// Instance method: Book shifts for a user
monthlyBookingSchema.methods.bookShifts = async function (shiftTypes, userId, paymentId) {
  for (const shiftType of shiftTypes) {
    const shift = this.shifts.find((s) => s.shiftType === shiftType);
    if (!shift) throw new Error(`Invalid shift type: ${shiftType}`);
    if (shift.status === "booked" && shift.userId) {
      throw new Error(`Shift ${shiftType} is already booked for this month!`);
    }

    shift.userId = userId;
    shift.status = "booked";
    shift.bookedAt = new Date();
  }

  this.paymentId = paymentId;
  await this.save();
};

// Instance method: Check if shifts are available (with optional userId for protected seats)
monthlyBookingSchema.methods.areShiftsAvailable = function (shiftTypes, userId = null) {
  for (const shiftType of shiftTypes) {
    const shift = this.shifts.find((s) => s.shiftType === shiftType);
    if (!shift) return false;
    if (shift.status === "booked" && shift.userId) return false;
    if (shift.status === "blocked" || shift.blockedByAdmin) return false;
    // Check if protected for another user
    if (shift.status === "protected" && shift.protectedForUser) {
      // If protection expired, it's available
      if (shift.protectionExpiresAt && new Date() > new Date(shift.protectionExpiresAt)) {
        // Protection expired - available for anyone
        continue;
      }
      // Otherwise only available for the protected user
      if (!userId || shift.protectedForUser.toString() !== userId.toString()) {
        return false;
      }
    }
  }
  return true;
};

// Instance method: Block/Unblock shifts by admin
monthlyBookingSchema.methods.setBlockStatus = async function (shiftTypes, block = true) {
  for (const shiftType of shiftTypes) {
    const shift = this.shifts.find((s) => s.shiftType === shiftType);
    if (!shift) throw new Error(`Invalid shift type: ${shiftType}`);

    // Can't block if already booked by user
    if (block && shift.status === "booked" && shift.userId) {
      throw new Error(`Shift ${shiftType} is already booked by a user and cannot be blocked`);
    }

    shift.blockedByAdmin = block;
    shift.status = block ? "blocked" : "available";
    shift.userId = null;
  }
  await this.save();
};

// Instance method: Protect shifts for a user (for next month booking)
monthlyBookingSchema.methods.protectShifts = async function (shiftTypes, userId) {
  // Protection expires on day 3 of this month at 23:59:59
  const expirationDate = new Date(this.year, this.month - 1, 3, 23, 59, 59);

  for (const shiftType of shiftTypes) {
    const shift = this.shifts.find((s) => s.shiftType === shiftType);
    if (!shift) throw new Error(`Invalid shift type: ${shiftType}`);

    // Can't protect if already booked or blocked
    if (shift.status === "booked" && shift.userId) {
      throw new Error(`Shift ${shiftType} is already booked`);
    }
    if (shift.status === "blocked" || shift.blockedByAdmin) {
      throw new Error(`Shift ${shiftType} is blocked by admin`);
    }
    // Can't protect if already protected by another user
    if (shift.status === "protected" && shift.protectedForUser &&
        shift.protectedForUser.toString() !== userId.toString()) {
      throw new Error(`Shift ${shiftType} is already protected by another user`);
    }

    shift.protectedForUser = userId;
    shift.protectedAt = new Date();
    shift.protectionExpiresAt = expirationDate;
    shift.status = "protected";
  }
  await this.save();
};

// Static method: Release expired protections
monthlyBookingSchema.statics.releaseExpiredProtections = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      "shifts.status": "protected",
      "shifts.protectionExpiresAt": { $lt: now },
    },
    {
      $set: {
        "shifts.$[elem].status": "available",
        "shifts.$[elem].protectedForUser": null,
        "shifts.$[elem].protectedAt": null,
        "shifts.$[elem].protectionExpiresAt": null,
      },
    },
    {
      arrayFilters: [{ "elem.status": "protected", "elem.protectionExpiresAt": { $lt: now } }],
    }
  );
  return result;
};

const MonthlyBooking = mongoose.model("MonthlyBooking", monthlyBookingSchema);
export default MonthlyBooking;

