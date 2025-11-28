import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

const configurePassport = () => {
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select("-password -profilePic");
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // User exists, return it
            console.log("✅ Existing Google user found:", user.fullname);
            return done(null, user);
          }

          // Check if user exists with same email (gmail field)
          const email = profile.emails?.[0]?.value;
          if (email) {
            user = await User.findOne({ gmail: email });
            if (user) {
              // Link Google account to existing user
              user.googleId = profile.id;
              user.authProvider = "google";
              await user.save();
              console.log("✅ Linked Google account to existing user:", user.fullname);
              return done(null, user);
            }
          }

          // Create new user from Google profile
          const username = `google_${profile.id}`;
          const newUser = new User({
            fullname: profile.displayName || "Google User",
            username: username,
            googleId: profile.id,
            gmail: email,
            authProvider: "google",
            isVerified: true, // Google accounts are verified
            showProfilePicture: false,
            profileCompleted: false, // New OAuth users need to complete their profile
          });

          await newUser.save();
          console.log("✅ New Google user created (profile incomplete):", newUser.fullname);
          return done(null, newUser);

        } catch (error) {
          console.error("❌ Google OAuth Error:", error);
          return done(error, null);
        }
      }
    )
  );
};

export default configurePassport;

