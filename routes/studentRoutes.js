import express from "express";
import {  getStudentDetails } from "../controllers/studentController.js";
import upload from "../middleware/multerConfig.js"; // Import multer
import User from "../models/User.js"; // Import User model

const router = express.Router();

// ✅ Get all seats
router.get("/:studentId", getStudentDetails);

router.post("/upload-profile/:userId", upload.single("profilePic"), async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("User ID:", userId);

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Convert the image to Buffer
    const profilePic = {
      data: req.file.buffer,
      contentType: req.file.mimetype,
    };

    // Update user with new profile picture
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic,
        showProfilePicture: true 
       },
      
      { new: true }

    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Profile picture uploaded successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get Profile Picture Route

router.get("/profile-pic/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    // ✅ Check if the user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Check if showProfilePicture is true
    if (!user.showProfilePicture) {
      return res.status(403).json({ message: "Profile picture is hidden by the user" });
    }

    // ✅ Check if profilePic exists
    if (!user.profilePic || !user.profilePic.data) {
      return res.status(404).json({ message: "Profile picture not found" });
    }

    // ✅ Set correct content type and send image data
    res.set("Content-Type", user.profilePic.contentType);
    res.send(user.profilePic.data);
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


export default router; // ✅ Use ES Module syntax
