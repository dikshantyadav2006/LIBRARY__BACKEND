import MonthlyBooking from "../models/MonthlyBooking.js";
import Booking from "../models/Booking.js";
import ProtectedSeat from "../models/ProtectedSeat.js";
import { areShiftsAvailable } from "../services/seatAvailabilityService.js";
// import Payment from "../models/Payment.js"; // optional: if you want to store admin-provided price as a Payment doc

/**
 * Admin creates a booking on behalf of a user (no Razorpay).
 * Frontend payload:
 * {
 *   userId: "<target user id>",
 *   seatNumber: 41,
 *   shiftTypes: ["morning","afternoon"],
 *   month: 12,
 *   year: 2025,
 *   priceINR: 500   // admin-entered price (optional if you don't want to store)
 * }
 */
export const adminCreateBooking = async (req, res) => {
  try {
    // Admin must be authenticated and authorized (assume verifyAdmin middleware)
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });

    const { userId, seatNumber, shiftTypes, month, year, priceINR } = req.body;

    // Basic validation
    if (!userId) return res.status(400).json({ message: "userId is required" });
    if (!seatNumber || !Number.isFinite(Number(seatNumber)))
      return res.status(400).json({ message: "Valid seatNumber is required" });
    if (!Array.isArray(shiftTypes) || shiftTypes.length === 0)
      return res.status(400).json({ message: "At least one shiftType is required" });
    if (!month || !year) return res.status(400).json({ message: "month and year are required" });

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate month range
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: "Month must be between 1 and 12" });
    }

    // Ensure monthly container exists
    await MonthlyBooking.getOrCreateForMonth(seatNumber, monthNum, yearNum);

    // Check availability (DO NOT allow admin to override existing active bookings)
    // Pass target userId so protected seats for that user are allowed
    const available = await areShiftsAvailable(seatNumber, monthNum, yearNum, shiftTypes, userId);
    if (!available) {
      return res.status(400).json({
        message: "One or more selected shifts are already booked, blocked, or protected by another user"
      });
    }

    // OPTIONAL: If you want to persist an admin-provided price, you can create a Payment doc here.
    // If not needed, just pass null as paymentId into booking.
    let paymentId = null;
    /*
    if (priceINR) {
      const payment = new Payment({
        user: userId,
        amount: priceINR * 100,
        currency: "INR",
        status: "admin_created",
        seatNumber,
        shiftTypes,
        bookingMonth: monthNum,
        bookingYear: yearNum,
        gateway: "admin",
        createdByAdmin: adminId
      });
      await payment.save();
      paymentId = payment._id;
    }
    */

    // Create Booking (Booking.createBooking checks for double-booking internally)
    const booking = await Booking.createBooking(
      seatNumber,
      monthNum,
      yearNum,
      shiftTypes,
      userId,
      paymentId // null if not using Payment doc
    );

    // Attach adminId and save (createBooking doesn't set adminId in your model)
    booking.adminId = adminId;
    await booking.save();

    // MARK any existing protections for these shifts as converted (if you have such logic)
    try {
      await ProtectedSeat.markAsConverted?.(
        seatNumber,
        monthNum,
        yearNum,
        shiftTypes,
        userId
      );
    } catch (err) {
      // ProtectedSeat.markAsConverted may not exist; swallow non-fatal error but log
      console.warn("ProtectedSeat.markAsConverted error (non-fatal):", err?.message || err);
    }

    // AUTO-PROTECT next month (same rule as your payment flow)
    let autoProtected = false;
    let nextMonth = monthNum + 1;
    let nextYear = yearNum;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = yearNum + 1;
    }

    // Check availability for next month and protect if available
    const isNextMonthAvailable = await areShiftsAvailable(
      seatNumber,
      nextMonth,
      nextYear,
      shiftTypes,
      userId
    );

    if (isNextMonthAvailable) {
      // ensure container exists
      await MonthlyBooking.getOrCreateForMonth(seatNumber, nextMonth, nextYear);

      // Remove any existing protections for these exact shifts for this user (so we reset)
      await ProtectedSeat.deleteMany({
        seatNumber,
        month: nextMonth,
        year: nextYear,
        shiftTypes: { $in: shiftTypes },
        userId,
      });

      // Create separate ProtectedSeat docs (one per shiftType) matching your system
      const expirationDate = new Date(nextYear, nextMonth - 1, 3, 23, 59, 59);
      for (const shiftType of shiftTypes) {
        const protect = new ProtectedSeat({
          seatNumber,
          month: nextMonth,
          year: nextYear,
          shiftTypes: [shiftType],
          userId,
          protectionExpiresAt: expirationDate,
        });
        await protect.save();
      }

      autoProtected = true;
    }

    // Build response
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    const response = {
      success: true,
      message: `Seat ${seatNumber} booked for user.`,
      booking: {
        id: booking._id,
        seatNumber: booking.seatNumber,
        shiftTypes: booking.shiftTypes,
        month: booking.month,
        year: booking.year,
        userId: booking.userId,
        adminId: booking.adminId,
        paymentId: booking.paymentId || null,
        status: booking.status,
      },
      autoProtected,
      protectedMonth: autoProtected ? `${monthNames[nextMonth - 1]} ${nextYear}` : null
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Admin booking error:", error);
    return res.status(500).json({ message: "Admin booking failed", error: error.message });
  }
};
