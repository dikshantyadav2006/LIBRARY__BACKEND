import Razorpay from "razorpay";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import MonthlyBooking from "../models/MonthlyBooking.js";
import Booking from "../models/Booking.js";
import ProtectedSeat from "../models/ProtectedSeat.js";
import { areShiftsAvailable } from "../services/seatAvailabilityService.js";

const SHIFT_PRICE_INR = 300; // ₹300 per shift (full month)
const MIN_PRICE_INR = 50; // Minimum price ₹50
const CURRENCY = "INR";

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// Calculate pro-rated price for current month based on remaining days
// Special handling: Day+Night combo on Floor 1 = ₹600 (Night is free)
const calculateProRatedPrice = (shiftCount, month, year, shiftTypes = [], seatNumber = null) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // Check if this is Day+Night combo on Floor 1 (seats 1-25)
  const isFloor1 = seatNumber && seatNumber <= 25;
  const hasDay = shiftTypes.includes("morning") && shiftTypes.includes("afternoon");
  const hasNight = shiftTypes.includes("night");
  const isDayNightCombo = isFloor1 && hasDay && hasNight;

  // For Day+Night combo, treat as 2 shifts (Day only) - Night is free
  let effectiveShiftCount = shiftCount;
  if (isDayNightCombo) {
    effectiveShiftCount = 2; // Day shift (morning + afternoon) = 2 shifts
  }

  // If not current month, return full price
  if (month !== currentMonth || year !== currentYear) {
    return effectiveShiftCount * SHIFT_PRICE_INR;
  }

  // Calculate remaining days in current month
  const today = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate(); // Last day of month
  const remainingDays = daysInMonth - today + 1; // Include today

  // Pro-rated price per shift = (SHIFT_PRICE / daysInMonth) * remainingDays
  const pricePerShift = Math.ceil((SHIFT_PRICE_INR / daysInMonth) * remainingDays);

  // Ensure minimum price per shift
  const finalPricePerShift = Math.max(pricePerShift, MIN_PRICE_INR);

  return effectiveShiftCount * finalPricePerShift;
};

// Create Razorpay order and a corresponding Payment document (Monthly Booking)
export const createOrder = async (req, res) => {
  try {
    const { seatNumber, shiftTypes, month, year } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!seatNumber || !Array.isArray(shiftTypes) || shiftTypes.length === 0) {
      return res.status(400).json({ message: "seatNumber and at least one shiftType are required" });
    }

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required for booking" });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: "Month must be between 1 and 12" });
    }

    // Get or create the monthly booking record (just a container)
    await MonthlyBooking.getOrCreateForMonth(seatNumber, monthNum, yearNum);

    // Check availability using new models (pass userId to allow booking if user protected the seat)
    const available = await areShiftsAvailable(seatNumber, monthNum, yearNum, shiftTypes, userId);
    if (!available) {
      return res.status(400).json({
        message: "One or more selected shifts are already booked, blocked, or protected by another user"
      });
    }

    // Calculate pro-rated price for current month (with Day+Night combo discount)
    const amountINR = calculateProRatedPrice(shiftTypes.length, monthNum, yearNum, shiftTypes, seatNumber);
    const amountInPaise = amountINR * 100; // Razorpay uses paise

    const razorpay = getRazorpayInstance();

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: CURRENCY,
      receipt: `seat-${seatNumber}-${monthNum}-${yearNum}-${Date.now()}`,
    });

    const productId = `seat-${seatNumber}-${shiftTypes.join("-")}-${monthNum}-${yearNum}`;

    const payment = new Payment({
      user: userId,
      productId,
      amount: amountInPaise,
      currency: CURRENCY,
      status: "created",
      seatNumber,
      shiftTypes,
      bookingMonth: monthNum,
      bookingYear: yearNum,
      gateway: "razorpay",
      razorpayOrderId: order.id,
    });

    await payment.save();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Check if this is current month for pro-rated info
    const now = new Date();
    const isCurrentMonth = monthNum === (now.getMonth() + 1) && yearNum === now.getFullYear();
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const remainingDays = isCurrentMonth ? (daysInMonth - now.getDate() + 1) : daysInMonth;

    return res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: amountInPaise,
      currency: CURRENCY,
      productId,
      seatNumber,
      shiftTypes,
      month: monthNum,
      isProRated: isCurrentMonth,
      remainingDays: isCurrentMonth ? remainingDays : null,
      pricePerShift: amountINR / shiftTypes.length,
      year: yearNum,
      monthLabel: `${monthNames[monthNum - 1]} ${yearNum}`,
    });
  } catch (error) {
    console.error("Error creating payment order:", error);

    if (error instanceof TypeError && error.message.includes("Cannot read properties of undefined")) {
      return res.status(502).json({
        message: "Could not reach payment gateway. Please check your internet connection and try again.",
      });
    }

    if (error.statusCode && error.error) {
      const desc = error.error.description || error.error.reason || "Payment gateway error";
      return res.status(error.statusCode).json({ message: desc });
    }

    return res.status(500).json({ message: "Error creating payment order", error: error.message });
  }
};

// Verify Razorpay payment and book seat for the month
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing Razorpay payment details" });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, user: userId });
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Verify signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      payment.status = "failed";
      payment.failureReason = "Invalid Razorpay signature";
      await payment.save();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Get or create the monthly booking record (just a container)
    await MonthlyBooking.getOrCreateForMonth(
      payment.seatNumber,
      payment.bookingMonth,
      payment.bookingYear
    );

    // Double-check availability before final booking (pass userId to allow if user protected it)
    const available = await areShiftsAvailable(
      payment.seatNumber,
      payment.bookingMonth,
      payment.bookingYear,
      payment.shiftTypes,
      userId
    );
    if (!available) {
      payment.status = "failed";
      payment.failureReason = "Shifts already booked, blocked, or protected during verification";
      await payment.save();
      return res.status(400).json({ message: "One or more shifts are no longer available" });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Create booking using Booking model
    let autoProtected = false;
    let nextMonth = null;
    let nextYear = null;
    
    try {
      await Booking.createBooking(
        payment.seatNumber,
        payment.bookingMonth,
        payment.bookingYear,
        payment.shiftTypes,
        userId,
        payment._id
      );

      // Mark any protections as converted to booking
      await ProtectedSeat.markAsConverted(
        payment.seatNumber,
        payment.bookingMonth,
        payment.bookingYear,
        payment.shiftTypes
      );

      // Automatic protection: Protect the same seat with same shifts for next month if available
      nextMonth = payment.bookingMonth + 1;
      nextYear = payment.bookingYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = payment.bookingYear + 1;
      }

      // Check if the same seat with same shifts is available in the next month
      const isNextMonthAvailable = await areShiftsAvailable(
        payment.seatNumber,
        nextMonth,
        nextYear,
        payment.shiftTypes,
        userId
      );

      if (isNextMonthAvailable) {
        // Get or create booking container for next month
        await MonthlyBooking.getOrCreateForMonth(
          payment.seatNumber,
          nextMonth,
          nextYear
        );

        // Create protection for next month
        // Protection expires on Day 3 of the next month at 23:59:59
        const expirationDate = new Date(nextYear, nextMonth - 1, 3, 23, 59, 59);

        // Remove any existing protections for these shifts (to update)
        await ProtectedSeat.deleteMany({
          seatNumber: payment.seatNumber,
          month: nextMonth,
          year: nextYear,
          shiftTypes: { $in: payment.shiftTypes },
          userId: userId,
        });

        // Create new protections for each shift
        for (const shiftType of payment.shiftTypes) {
          const protection = new ProtectedSeat({
            seatNumber: payment.seatNumber,
            month: nextMonth,
            year: nextYear,
            shiftTypes: [shiftType],
            userId: userId,
            protectionExpiresAt: expirationDate,
          });
          await protection.save();
        }
        autoProtected = true;
      }
    } catch (err) {
      payment.status = "failed";
      payment.failureReason = `Booking error: ${err.message}`;
      await payment.save();
      return res.status(400).json({ message: "Booking failed", error: err.message });
    }

    payment.status = "successful";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paidAt = new Date();
    await payment.save();

    // Build response message
    let message = "Payment verified and seat booked successfully";
    if (autoProtected) {
      message += `. Your seat has been automatically protected for ${monthNames[nextMonth - 1]} ${nextYear}. You must complete payment by Day 3, or the protection will expire.`;
    }

    return res.status(200).json({
      success: true,
      message: message,
      seatNumber: payment.seatNumber,
      shiftTypes: payment.shiftTypes,
      month: payment.bookingMonth,
      year: payment.bookingYear,
      monthLabel: `${monthNames[payment.bookingMonth - 1]} ${payment.bookingYear}`,
      autoProtected: autoProtected,
      protectedMonth: autoProtected ? `${monthNames[nextMonth - 1]} ${nextYear}` : null,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ message: "Error verifying payment", error: error.message });
  }
};

// Get calculated price for shifts (for frontend display)
export const getPrice = async (req, res) => {
  try {
    const { shiftCount, month, year, shiftTypes, seatNumber } = req.query;

    if (!shiftCount || !month || !year) {
      return res.status(400).json({ message: "shiftCount, month, and year are required" });
    }

    const shifts = parseInt(shiftCount);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Parse shiftTypes if provided
    let parsedShiftTypes = [];
    if (shiftTypes) {
      try {
        parsedShiftTypes = JSON.parse(decodeURIComponent(shiftTypes));
      } catch {
        // If not JSON, try as comma-separated string
        parsedShiftTypes = shiftTypes.split(",").map(s => s.trim());
      }
    }

    const parsedSeatNumber = seatNumber ? parseInt(seatNumber) : null;

    const totalPrice = calculateProRatedPrice(shifts, monthNum, yearNum, parsedShiftTypes, parsedSeatNumber);
    
    // Calculate full price with same logic
    const isFloor1 = parsedSeatNumber && parsedSeatNumber <= 25;
    const hasDay = parsedShiftTypes.includes("morning") && parsedShiftTypes.includes("afternoon");
    const hasNight = parsedShiftTypes.includes("night");
    const isDayNightCombo = isFloor1 && hasDay && hasNight;
    const effectiveShiftCount = isDayNightCombo ? 2 : shifts;
    const fullPrice = effectiveShiftCount * SHIFT_PRICE_INR;

    const now = new Date();
    const isCurrentMonth = monthNum === (now.getMonth() + 1) && yearNum === now.getFullYear();
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const remainingDays = isCurrentMonth ? (daysInMonth - now.getDate() + 1) : daysInMonth;

    return res.status(200).json({
      success: true,
      totalPrice,
      fullPrice,
      isProRated: isCurrentMonth,
      remainingDays: isCurrentMonth ? remainingDays : null,
      daysInMonth,
      pricePerShift: totalPrice / shifts,
      savings: fullPrice - totalPrice,
    });
  } catch (error) {
    console.error("Error calculating price:", error);
    return res.status(500).json({ message: "Error calculating price", error: error.message });
  }
};
