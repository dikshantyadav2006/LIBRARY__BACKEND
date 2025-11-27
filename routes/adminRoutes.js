import express from "express";
import { getAllUsers, getUserDetails, blockSeat, unblockSeat } from "../controllers/adminController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", verifyAdmin, getAllUsers);
router.get("/user/:_id", verifyAdmin, getUserDetails);

// Block/Unblock seats (Admin only)
router.post("/block-seat", verifyAdmin, blockSeat);
router.post("/unblock-seat", verifyAdmin, unblockSeat);

export default router;
