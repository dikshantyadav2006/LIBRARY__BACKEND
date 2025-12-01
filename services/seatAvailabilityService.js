import Booking from "../models/Booking.js";
import ProtectedSeat from "../models/ProtectedSeat.js";
import BlockedSeat from "../models/BlockedSeat.js";
import User from "../models/User.js";

/**
 * Service to check seat availability and populate shift data
 * Combines data from Booking, ProtectedSeat, and BlockedSeat models
 */

/**
 * Check if shifts are available for booking
 * @param {number} seatNumber - Seat number
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {string[]} shiftTypes - Array of shift types to check
 * @param {string} userId - Optional user ID (for protected seat check)
 * @returns {Promise<boolean>} - True if all shifts are available
 */
export const areShiftsAvailable = async (seatNumber, month, year, shiftTypes, userId = null) => {
  for (const shiftType of shiftTypes) {
    // Check if blocked
    const isBlocked = await BlockedSeat.isShiftBlocked(seatNumber, month, year, shiftType);
    if (isBlocked) {
      return false;
    }

    // Check if booked
    const isBooked = await Booking.isShiftBooked(seatNumber, month, year, shiftType);
    if (isBooked) {
      return false;
    }

    // Check if protected
    const { isProtected } = await ProtectedSeat.isShiftProtected(
      seatNumber,
      month,
      year,
      shiftType,
      userId
    );
    if (isProtected) {
      return false;
    }
  }

  return true;
};

/**
 * Populate shift data for a MonthlyBooking document
 * Combines data from Booking, ProtectedSeat, and BlockedSeat
 * @param {Object} monthlyBooking - MonthlyBooking document
 * @returns {Promise<Object>} - MonthlyBooking with populated shift data
 */
export const populateShiftData = async (monthlyBooking) => {
  const seatNumber = monthlyBooking.seatNumber;
  const month = monthlyBooking.month;
  const year = monthlyBooking.year;

  // Get all bookings, protections, and blocks for this seat/month/year
  const [bookings, protections, blocks] = await Promise.all([
    Booking.getBookingsForSeat(seatNumber, month, year),
    ProtectedSeat.getProtectionsForSeat(seatNumber, month, year),
    BlockedSeat.getBlocksForSeat(seatNumber, month, year),
  ]);

  // Create maps for quick lookup
  const bookingMap = new Map();
  bookings.forEach((booking) => {
    booking.shiftTypes.forEach((shiftType) => {
      bookingMap.set(shiftType, booking);
    });
  });

  const protectionMap = new Map();
  protections.forEach((protection) => {
    protection.shiftTypes.forEach((shiftType) => {
      protectionMap.set(shiftType, protection);
    });
  });

  const blockMap = new Map();
  blocks.forEach((block) => {
    block.shiftTypes.forEach((shiftType) => {
      blockMap.set(shiftType, block);
    });
  });

  // Populate each shift
  const populatedShifts = monthlyBooking.shifts.map((shift) => {
    const shiftType = shift.shiftType;
    const shiftData = { ...shift.toObject ? shift.toObject() : shift };

    // Check if blocked
    const block = blockMap.get(shiftType);
    if (block) {
      shiftData.status = "blocked";
      shiftData.blockedByAdmin = true;
      shiftData.userId = null;
      shiftData.bookedAt = null;
      shiftData.protectedForUser = null;
      shiftData.protectedAt = null;
      shiftData.protectionExpiresAt = null;
      return shiftData;
    }

    // Check if booked
    const booking = bookingMap.get(shiftType);
    if (booking) {
      shiftData.status = "booked";
      shiftData.userId = booking.userId._id || booking.userId;
      shiftData.bookedAt = booking.bookedAt;
      shiftData.blockedByAdmin = false;
      shiftData.protectedForUser = null;
      shiftData.protectedAt = null;
      shiftData.protectionExpiresAt = null;
      // Populate user details if available
      if (booking.userId && booking.userId.fullname) {
        shiftData.userDetails = {
          fullname: booking.userId.fullname,
          username: booking.userId.username,
        };
      }
      return shiftData;
    }

    // Check if protected
    const protection = protectionMap.get(shiftType);
    if (protection) {
      shiftData.status = "protected";
      shiftData.protectedForUser = protection.userId._id || protection.userId;
      shiftData.protectedAt = protection.protectedAt;
      shiftData.protectionExpiresAt = protection.protectionExpiresAt;
      shiftData.userId = null;
      shiftData.bookedAt = null;
      shiftData.blockedByAdmin = false;
      // Populate user details if available
      if (protection.userId && protection.userId.fullname) {
        shiftData.userDetails = {
          fullname: protection.userId.fullname,
          username: protection.userId.username,
        };
      }
      return shiftData;
    }

    // Available
    shiftData.status = "available";
    shiftData.userId = null;
    shiftData.bookedAt = null;
    shiftData.blockedByAdmin = false;
    shiftData.protectedForUser = null;
    shiftData.protectedAt = null;
    shiftData.protectionExpiresAt = null;
    return shiftData;
  });

  // Return updated monthly booking with populated shifts
  return {
    ...monthlyBooking.toObject ? monthlyBooking.toObject() : monthlyBooking,
    shifts: populatedShifts,
  };
};

/**
 * Populate shift data for multiple MonthlyBooking documents
 * @param {Array} monthlyBookings - Array of MonthlyBooking documents
 * @returns {Promise<Array>} - Array of MonthlyBookings with populated shift data
 */
export const populateShiftDataForMultiple = async (monthlyBookings) => {
  return Promise.all(monthlyBookings.map((booking) => populateShiftData(booking)));
};

