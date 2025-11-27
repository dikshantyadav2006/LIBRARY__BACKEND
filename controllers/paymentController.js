import Razorpay from "razorpay";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import MonthlyBooking from "../models/MonthlyBooking.js";

const SHIFT_PRICE_INR = 300; // ₹300 per shift (full month)
const MIN_PRICE_INR = 99; // Minimum price ₹99
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
const calculateProRatedPrice = (shiftCount, month, year) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // If not current month, return full price
  if (month !== currentMonth || year !== currentYear) {
    return shiftCount * SHIFT_PRICE_INR;
  }

  // Calculate remaining days in current month
  const today = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate(); // Last day of month
  const remainingDays = daysInMonth - today + 1; // Include today

  // Pro-rated price per shift = (SHIFT_PRICE / daysInMonth) * remainingDays
  const pricePerShift = Math.ceil((SHIFT_PRICE_INR / daysInMonth) * remainingDays);

  // Ensure minimum price per shift
  const finalPricePerShift = Math.max(pricePerShift, MIN_PRICE_INR);

  return shiftCount * finalPricePerShift;
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

    // Get or create the monthly booking record
    const booking = await MonthlyBooking.getOrCreateForMonth(seatNumber, monthNum, yearNum);

    // Ensure requested shifts are currently available for this month (pass userId for protected seat check)
    if (!booking.areShiftsAvailable(shiftTypes, userId)) {
      return res.status(400).json({
        message: "One or more selected shifts are already booked or blocked for this month"
      });
    }

    // Calculate pro-rated price for current month
    const amountINR = calculateProRatedPrice(shiftTypes.length, monthNum, yearNum);
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

    // Get the monthly booking record
    const booking = await MonthlyBooking.getOrCreateForMonth(
      payment.seatNumber,
      payment.bookingMonth,
      payment.bookingYear
    );

    // Double-check availability before final booking
    if (!booking.areShiftsAvailable(payment.shiftTypes)) {
      payment.status = "failed";
      payment.failureReason = "Shifts already booked during verification";
      await payment.save();
      return res.status(400).json({ message: "One or more shifts are already booked" });
    }

    // Book the shifts in the monthly booking
    try {
      await booking.bookShifts(payment.shiftTypes, userId, payment._id);
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

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    return res.status(200).json({
      success: true,
      message: "Payment verified and seat booked successfully",
      seatNumber: payment.seatNumber,
      shiftTypes: payment.shiftTypes,
      month: payment.bookingMonth,
      year: payment.bookingYear,
      monthLabel: `${monthNames[payment.bookingMonth - 1]} ${payment.bookingYear}`,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ message: "Error verifying payment", error: error.message });
  }
};

// Get calculated price for shifts (for frontend display)
export const getPrice = async (req, res) => {
  try {
    const { shiftCount, month, year } = req.query;

    if (!shiftCount || !month || !year) {
      return res.status(400).json({ message: "shiftCount, month, and year are required" });
    }

    const shifts = parseInt(shiftCount);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const totalPrice = calculateProRatedPrice(shifts, monthNum, yearNum);
    const fullPrice = shifts * SHIFT_PRICE_INR;

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
