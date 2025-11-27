import MonthlyBooking from "../models/MonthlyBooking.js";
import User from "../models/User.js";

const TOTAL_SEATS = 59; // Total seats: Floor 1 (1-25) + Floor 2 (26-59)

/**
 * Get all bookings for a specific user
 * Returns all seats booked by the logged-in user across all months
 */
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT decoded token

    // Find all bookings where any shift has this user's ID
    const bookings = await MonthlyBooking.find({
      "shifts.userId": userId,
    }).sort({ year: -1, month: -1 }); // Sort by most recent first

    // Format the response - only include shifts booked by this user
    const userBookings = bookings.map((booking) => {
      const userShifts = booking.shifts.filter((shift) => {
        if (!shift.userId) return false;
        return shift.userId.toString() === userId;
      });

      return {
        _id: booking._id,
        seatNumber: booking.seatNumber,
        month: booking.month,
        year: booking.year,
        shifts: userShifts.map((shift) => ({
          shiftType: shift.shiftType,
          bookedAt: shift.bookedAt,
          status: shift.status,
        })),
        createdAt: booking.createdAt,
      };
    });

    // Filter out bookings with no user shifts (edge case)
    const filteredBookings = userBookings.filter((b) => b.shifts.length > 0);

    return res.status(200).json({
      success: true,
      totalBookings: filteredBookings.length,
      bookings: filteredBookings,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};

/**
 * Get all seats for a specific month/year
 * Returns availability status for each seat and shift
 */
export const getSeatsForMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: "Month must be between 1 and 12" });
    }

    // Get all seats for this month (creates virtual seats if not in DB)
    const seats = await MonthlyBooking.getAllForMonth(monthNum, yearNum, TOTAL_SEATS);

    return res.status(200).json({
      month: monthNum,
      year: yearNum,
      totalSeats: TOTAL_SEATS,
      seats,
    });
  } catch (error) {
    console.error("Error fetching seats for month:", error);
    return res.status(500).json({ message: "Error fetching seats", error: error.message });
  }
};

/**
 * Get details of a specific seat for a month
 */
export const getSeatDetailsForMonth = async (req, res) => {
  try {
    const { seatNumber } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const seatNum = parseInt(seatNumber);

    // Get or create booking record
    const booking = await MonthlyBooking.getOrCreateForMonth(seatNum, monthNum, yearNum);

    // Populate user details for booked shifts
    const shiftsWithDetails = await Promise.all(
      booking.shifts.map(async (shift) => {
        if (!shift.userId) {
          return { ...shift.toObject(), userDetails: null };
        }

        const user = await User.findById(shift.userId).select("fullname username");
        return {
          ...shift.toObject(),
          userDetails: user ? { fullname: user.fullname, username: user.username } : null,
        };
      })
    );

    return res.status(200).json({
      seatNumber: seatNum,
      month: monthNum,
      year: yearNum,
      shifts: shiftsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching seat details:", error);
    return res.status(500).json({ message: "Error fetching seat details", error: error.message });
  }
};

/**
 * Get available months for booking (current + next 3 months)
 */
export const getAvailableMonths = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    const months = [];
    for (let i = 0; i < 4; i++) {
      let month = currentMonth + i;
      let year = currentYear;

      if (month > 12) {
        month = month - 12;
        year = currentYear + 1;
      }

      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      months.push({
        month,
        year,
        label: `${monthNames[month - 1]} ${year}`,
        isCurrent: i === 0,
      });
    }

    return res.status(200).json({ months });
  } catch (error) {
    console.error("Error fetching available months:", error);
    return res.status(500).json({ message: "Error fetching months", error: error.message });
  }
};

/**
 * Check if user can protect their seat for next months
 * Returns protection eligibility and deadline info
 */
export const getProtectionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.params;

    // Find the booking
    const booking = await MonthlyBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if user has booked shifts in this booking
    const userShifts = booking.shifts.filter(
      (s) => s.userId && s.userId.toString() === userId && s.status === "booked"
    );
    if (userShifts.length === 0) {
      return res.status(403).json({ message: "You don't have any shifts booked for this seat" });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    // Check if this is a current or past booking
    const bookingDate = new Date(booking.year, booking.month - 1, 1);
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);

    if (bookingDate < currentMonthStart) {
      return res.status(200).json({
        canProtect: false,
        reason: "This booking is for a past month",
        isPastBooking: true,
      });
    }

    // Calculate days remaining in current month
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;

    // Protection only allowed in last 3 days of month
    const canProtect = daysRemaining <= 3;

    // Calculate next months available for protection (1-3 months)
    const protectionMonths = [];
    for (let i = 1; i <= 3; i++) {
      let nextMonth = booking.month + i;
      let nextYear = booking.year;
      if (nextMonth > 12) {
        nextMonth = nextMonth - 12;
        nextYear = nextYear + 1;
      }

      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      protectionMonths.push({
        month: nextMonth,
        year: nextYear,
        label: `${monthNames[nextMonth - 1]} ${nextYear}`,
        monthsFromNow: i,
      });
    }

    return res.status(200).json({
      canProtect,
      daysRemaining,
      daysInMonth,
      protectionDeadline: canProtect ? null : `Protection available in ${daysRemaining - 3} days`,
      protectionMonths,
      currentBooking: {
        seatNumber: booking.seatNumber,
        month: booking.month,
        year: booking.year,
        shifts: userShifts.map((s) => s.shiftType),
      },
      graceNote: "⚠️ After protection, you must complete payment by Day 3 of the new month, or the seat will be released.",
    });
  } catch (error) {
    console.error("Error getting protection status:", error);
    return res.status(500).json({ message: "Error getting protection status", error: error.message });
  }
};

/**
 * Protect seat for next month(s)
 * Reserves the same seat and shifts for user for specified future months
 */
export const protectSeat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId, months } = req.body; // months: array of { month, year }

    if (!bookingId || !months || !Array.isArray(months) || months.length === 0) {
      return res.status(400).json({ message: "bookingId and months array are required" });
    }

    if (months.length > 3) {
      return res.status(400).json({ message: "Maximum 3 months can be protected at once" });
    }

    // Find the current booking
    const currentBooking = await MonthlyBooking.findById(bookingId);
    if (!currentBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check user has booked shifts
    const userShifts = currentBooking.shifts.filter(
      (s) => s.userId && s.userId.toString() === userId && s.status === "booked"
    );
    if (userShifts.length === 0) {
      return res.status(403).json({ message: "You don't have any shifts booked for this seat" });
    }

    // Check if within protection window (last 3 days of month)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    if (daysRemaining > 3) {
      return res.status(400).json({
        message: `Protection only available in last 3 days of the month. ${daysRemaining - 3} more days until protection window opens.`,
      });
    }

    const shiftTypes = userShifts.map((s) => s.shiftType);
    const protectedBookings = [];

    // Protect each requested month
    for (const monthData of months) {
      const { month, year } = monthData;

      // Get or create booking for future month
      const futureBooking = await MonthlyBooking.getOrCreateForMonth(
        currentBooking.seatNumber,
        month,
        year
      );

      // Check if shifts are available for protection
      const available = futureBooking.areShiftsAvailable(shiftTypes, userId);
      if (!available) {
        return res.status(400).json({
          message: `Seat ${currentBooking.seatNumber} is not available for ${month}/${year}. Some shifts may already be booked or protected.`,
        });
      }

      // Protect the shifts
      await futureBooking.protectShifts(shiftTypes, userId);

      protectedBookings.push({
        seatNumber: currentBooking.seatNumber,
        month,
        year,
        shifts: shiftTypes,
        expiresAt: new Date(year, month - 1, 3, 23, 59, 59),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Seat #${currentBooking.seatNumber} protected for ${months.length} month(s)`,
      protectedBookings,
      warning: "⚠️ Complete payment by Day 3 of each month or protection expires!",
    });
  } catch (error) {
    console.error("Error protecting seat:", error);
    return res.status(500).json({ message: error.message || "Error protecting seat" });
  }
};

/**
 * Release expired seat protections (called periodically or on demand)
 */
export const releaseExpiredProtections = async (req, res) => {
  try {
    const result = await MonthlyBooking.releaseExpiredProtections();
    return res.status(200).json({
      success: true,
      message: "Expired protections released",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error releasing expired protections:", error);
    return res.status(500).json({ message: "Error releasing protections", error: error.message });
  }
};

