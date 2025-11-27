import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    mobile: { type: String, unique: true, required: true }, // edit only by admin
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    bio: { type: String, default: "No bio available" },

    // ===================================================>> posts
    // 
    // 
    // ===================================================>> feedbacks 
    feedbacks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feedback" }],
    blockedFeedbacks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feedback" }],
    deletedFeedbacks:  [{ type: mongoose.Schema.Types.ObjectId, ref: "Feedback" }],
    blockCommenting: { type: Boolean, default: false },
    blockReplying: { type: Boolean, default: false },
    blockFeedback: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    // ====================================================>> 
    isVerified: { type: Boolean, default: false },
    private: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    showProfilePicture: { type: Boolean, default: false },
    // ====================================================>>
    loginDetails: [
      {
        loginTime: { type: Date, default: Date.now },
        logoutTime: { type: Date, default: null },
        isLoggedIn: { type: Boolean, default: false },
        sessionToken: { type: String, default: null },
        lastloginTime: { type: Date, default: null },
        lastAttemptedLoginTime: { type: Date, default: null },
        loginAttempts: { type: Number, default: 0 },
      },
    ],
    profilePic: {
      data: Buffer, // Store image as binary data
      contentType: String, // Store image type (jpeg, png, etc.)
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "not available"], // Add "not available" as a valid option
      default: "not available",
    },
    gmail: { type: String, default: null },
    address: { type: String, default: null },

    // blocked and unblocked profile only by admin
    blocked: [
      {
        blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        blockedAt: { type: Date, default: Date.now },
        reason: { type: String, default: "No reason provided" },
        isBlocked: { type: Boolean, default: false },
        unblockedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        unblockedAt: { type: Date, default: null },
        unblockReason: {
          type: String,
          default:
            "Follow the rules and regulations. You have been given one more chance.",
        },
      },
    ],

    joiningDate: { type: Date, default: Date.now, immutable: true },
    leavingDate: { type: Date, default: null },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
