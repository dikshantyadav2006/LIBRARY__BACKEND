import express from "express";
import upload from "../middleware/multerConfig.js"; // Import multer
import User from "../models/User.js"; // Import User model
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// Profile picture upload
router.post("/upload-profile/:userId", upload.single("profilePic"), async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("User ID:", userId);

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary instead of saving buffer
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "shai_library/profile_pics",
      resource_type: "image",
      unique_filename: true,
      overwrite: true,
    });

    const profilePic = result.secure_url || result.url;

    // Update user with Cloudinary URL
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic, showProfilePicture: true },
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

    // Return the Cloudinary URL in JSON so clients can consume it directly
    if (!user.profilePic) {
      return res.status(404).json({ message: "Profile picture not found" });
    }

    return res.status(200).json({ profilePic: user.profilePic });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


export default router; // ✅ Use ES Module syntax
