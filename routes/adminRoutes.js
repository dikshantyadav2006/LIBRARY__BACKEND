import express from "express";
import { getAllUsers, getUserDetails, addStudent, } from "../controllers/adminController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", verifyAdmin, getAllUsers);
router.get("/user/:_id", verifyAdmin, getUserDetails);
router.post("/user/:userId/add-student", verifyAdmin, addStudent);


export default router;
