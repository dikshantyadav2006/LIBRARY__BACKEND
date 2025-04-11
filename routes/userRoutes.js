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

export default router;
