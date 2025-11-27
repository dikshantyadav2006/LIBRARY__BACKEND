import express from "express";
import { verifyUser } from "../middleware/authMiddleware.js";
import { createOrder, verifyPayment, getPrice } from "../controllers/paymentController.js";

const router = express.Router();

// User must be logged in to create an order or verify a payment
router.post("/create-order", verifyUser, createOrder);
router.post("/verify", verifyUser, verifyPayment);

// Get price calculation (public)
router.get("/price", getPrice);

export default router;

