import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // Which user is paying
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Logical product you are selling (for now: seat + shift combination)
    productId: { type: String, required: true },

    // Amount in smallest currency unit (paise for INR). Example: 100 INR => 100 * 100 = 10000
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    // Payment status lifecycle
    status: {
      type: String,
      enum: ["created", "pending", "successful", "failed", "refunded"],
      default: "created",
    },

    // Extra info that is very useful for your use‑case
    seatNumber: { type: Number, default: null },
    shiftTypes: [
      {
        type: String,
        enum: ["morning", "afternoon", "night"],
      },
    ],

    // 🆕 Monthly booking fields (like movie theater)
    bookingMonth: { type: Number, min: 1, max: 12, default: null }, // 1-12
    bookingYear: { type: Number, default: null }, // e.g., 2025

    // Razorpay / gateway fields (optional but recommended)
    gateway: { type: String, default: "razorpay" },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },

    paidAt: { type: Date, default: null },
    failureReason: { type: String, default: null },

    // For any extra data you may want to store later
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
export default Payment;

