import express from "express";
import User from "../models/User.js"; // Import user model
import { verifyUser } from "../middleware/authMiddleware.js";


const router = express.Router();

// 📌 Get user details by ID
router.get("/user/:id", verifyUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// 

router.get("/find-mobile/:mobile", verifyUser, async (req, res) => {
  try {
    const { mobile } = req.params;
    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      // console.log(`Found user with username: ${mobile}`,req.user.id);
      if (req.user.id){
        const FindingBy = await User.findById(req.user.id).select("isAdmin fullname");
       
        if (FindingBy.isAdmin){
          console.log(`Admin with username: ${FindingBy.fullname}`,);
          return res.json({ available: true , });

        }
        return res.json({ available: true });
      }

      return res.json({ available: true });
    } else {
      return res.json({ available: false });
    }
  } catch (error) {
    console.error("Error checking mobile:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


router.get("/find-username/:username", verifyUser, async (req, res) => {
  try {
    const { username } = req.params;
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      // console.log(`Found user with username: ${username}`,req.user.fullname);
      return res.json({ available: true });
    } else {
      return res.json({ available: false });
    }
  } catch (error) {
    console.error("Error checking mobile:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// 📌 Update user details
router.put("/edit-user/:id", verifyUser, async (req, res) => {
  try {
    const { fullname, mobile, bio, gender, gmail, address,username, showProfilePicture } = req.body;

    // Find user by ID
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update fields
    user.fullname = fullname || user.fullname;
    user.mobile = mobile || user.mobile;
    user.username = username || user.username;
    user.bio = bio || user.bio;
    user.gender = gender || user.gender;
    user.gmail = gmail || user.gmail;
    user.address = address || user.address;
    user.showProfilePicture = showProfilePicture || user.showProfilePicture;

    // Save updates
    await user.save();


    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.__v;
    delete userObj.profilePic;

res.json({ message: "User updated successfully!", user: userObj });

  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// 📌 Complete profile for OAuth users (set username and mobile)
router.put("/complete-profile", verifyUser, async (req, res) => {
  try {
    const { username, mobile } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!username || !mobile) {
      return res.status(400).json({ message: "Username and mobile are required" });
    }

    // Validate username format (min 6 chars, alphanumeric + special chars)
    if (!/^[A-Za-z0-9!@#$%^&*(.)_+]{6,}$/.test(username)) {
      return res.status(400).json({
        message: "Username must be at least 6 characters (A-Z, 0-9, special characters allowed)"
      });
    }

    // Validate mobile format (10 digits)
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Mobile number must be exactly 10 digits" });
    }

    // Check if username already exists (excluding current user)
    const existingUsername = await User.findOne({ username, _id: { $ne: userId } });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Check if mobile already exists (excluding current user)
    const existingMobile = await User.findOne({ mobile, _id: { $ne: userId } });
    if (existingMobile) {
      return res.status(400).json({ message: "Mobile number already registered" });
    }

    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.username = username;
    user.mobile = mobile;
    user.profileCompleted = true;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.__v;
    delete userObj.profilePic;

    console.log("✅ Profile completed for:", user.fullname);

    res.json({
      message: "Profile completed successfully!",
      user: userObj
    });

  } catch (error) {
    console.error("Error completing profile:", error);
    res.status(500).json({ message: "Failed to complete profile" });
  }
});

export default router;
