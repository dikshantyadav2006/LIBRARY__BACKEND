import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import User from "../models/User.js";
import { verifyUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// Frontend URL for redirects
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";



// ✅ Fetch user data using ID from cookie
router.get("/userdata", verifyUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v"); // Exclude password and profilePic fields
    // console.log(user); // Exclude password field
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);

  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Signup Route with Auto-Login
router.post("/signup", async (req, res) => {
  try {
    const { fullname,username, mobile, password } = req.body;
    console.log("Signup request received:", { fullname, username, mobile });

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { mobile }] });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({ fullname, username, mobile, password: hashedPassword });
    console.log("New user created:", newUser);
    console.log("Saving user to database...");
await newUser.save();
console.log("User successfully saved!");


    // 🎟️ Generate JWT Token
    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // console.log("JWT Token generated");

    
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: true, // Required for HTTPS
      sameSite: "None", // THIS IS CRUCIAL for cross-origin cookies
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }).json({
      message: "Login successful",
      token,
      user: { id: newUser._id, username: newUser.username, mobile: newUser.mobile },
    });
    

    console.log("User logged in successfully");
    console.log("signup successful & logged in")

  } catch (err) {
    console.error("Error saving user:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body; // Use `identifier` for username or mobile

    if (!identifier || !password) {
      return res.status(400).json({ message: "Username or mobile and password are required" });
    }

    // console.log("Login request received:", { identifier });

    // 🔍 Check if user exists (search by username OR mobile)
    const user = await User.findOne({ $or: [{ username: identifier }, { mobile: identifier }] });

    if (!user) {
      // console.log("User not found");
      return res.status(400).json({ message: "User not found" });
    }

    // console.log("User found:", user);

    // 🔑 Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Invalid password");
      return res.status(400).json({ message: "Incorrect password" });
    }

    // console.log("Password match successful");

    // 🎟️ Generate JWT Token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // console.log("JWT Token generated");

    
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: true, // Required for HTTPS
      sameSite: "None", // THIS IS CRUCIAL for cross-origin cookies
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }).json({
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username, mobile: user.mobile },
    });
    

    console.log("User logged in successfully");

  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});


// Logout Route
router.post("/logout", verifyUser, (req, res) => {
  try {
    // Clear the authToken cookie set during login
    res
      .clearCookie("authToken", {
        httpOnly: true,
        secure: true, // Ensure cookies are cleared securely (used HTTPS)
        sameSite: "None", // Match the sameSite policy used when setting the cookie
      })
      .status(200)
      .json({ message: "Logged out successfully" });

    console.log("User logged out successfully");
  } catch (error) {
    console.error("Logout Error:", error.message);
    res.status(500).json({ message: "Server Error during logout", error: error.message });
  }
});

// =====================================================
// 🔐 GOOGLE OAUTH ROUTES
// =====================================================

// Initiate Google OAuth
router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

// Google OAuth Callback
router.get("/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_user`);
      }

      // Generate JWT Token for the OAuth user
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Set the auth cookie
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log("✅ Google OAuth successful for:", user.fullname);

      // Redirect based on profile completion status
      if (!user.profileCompleted) {
        // New OAuth user - redirect to complete profile page
        console.log("📝 Redirecting to complete profile page");
        res.redirect(`${FRONTEND_URL}/complete-profile`);
      } else {
        // Existing user with completed profile - redirect to dashboard
        res.redirect(`${FRONTEND_URL}/dashboard`);
      }

    } catch (error) {
      console.error("❌ Google OAuth Callback Error:", error);
      res.redirect(`${FRONTEND_URL}/login?error=auth_error`);
    }
  }
);

// Check if Google Auth is configured
router.get("/google/status", (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({
    googleAuthEnabled: isConfigured,
    message: isConfigured ? "Google OAuth is configured" : "Google OAuth is not configured"
  });
});

export default router;
