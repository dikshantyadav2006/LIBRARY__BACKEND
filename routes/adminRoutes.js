import express from "express";
import { searchUsers ,getAllUsers, getUserDetails, blockSeat, unblockSeat } from "../controllers/adminController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import { adminCreateBooking } from "../controllers/adminBookingController.js";

const router = express.Router();

router.get("/users", verifyAdmin, getAllUsers);
router.get("/user/:_id", verifyAdmin, getUserDetails);

// Block/Unblock seats (Admin only)
router.post("/block-seat", verifyAdmin, blockSeat);
router.post("/unblock-seat", verifyAdmin, unblockSeat);

//
router.get("/bookseat/search", verifyAdmin, searchUsers);

router.post("/bookseat/create", verifyAdmin,adminCreateBooking );


export default router;
