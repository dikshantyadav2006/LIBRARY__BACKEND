import express from "express";
import Feedback from "../models/Feedback.js";
import User from "../models/User.js";
import { verifyUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST - Submit feedback
router.post("/submit-feedback", verifyUser, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "Message is required" });

  const userId = req.user.id;

  try {
    const newFeedback = new Feedback({ user: userId, message });
    await newFeedback.save();

    await User.findByIdAndUpdate(userId, {
      $push: { feedbacks: newFeedback._id },
    });

    req.io.emit("feedback:new", newFeedback); // Emit real-time update

    res.status(200).json({ success: true, message: "Feedback submitted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET - All non-deleted feedbacks

// GET - All non-deleted and non-blocked feedbacks
// GET - All non-deleted, non-blocked feedbacks from non-blocked users
router.get("/all", async (req, res) => {
    try {
      const feedbacks = await Feedback.find({
        deleted: false,
        blocked: false,
      })
        .populate({
          path: "user",
          select: "username blockFeedback blockedFeedbacks deletedFeedbacks",
        })
        .populate({
          path: "comments.user",
          select: "username",
        })
        .populate({
          path: "comments.replies.user",
          select: "username",
        });
  
      // Filter out feedbacks from users who:
      // 1. Are blocked from feedback
      // 2. Have this feedback in their blocked or deleted list
      const filtered = feedbacks.filter((fb) => {
        const user = fb.user;
        if (!user || user.blockFeedback) return false;
  
        const isBlocked = user.blockedFeedbacks?.includes(fb._id);
        const isDeleted = user.deletedFeedbacks?.includes(fb._id);
  
        return !isBlocked && !isDeleted;
      });
  
      // Sort: Newest first, then by most likes
      const sorted = filtered.sort((a, b) => {
        const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0); // reverse
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.createdAt) - new Date(a.createdAt); // reverse
      });
      
      
  
      res.status(200).json(sorted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  



// PUT - Block/unblock feedback (admin only)
router.put("/block/:id", verifyUser, async (req, res) => {
  const { isAdmin } = req.user;
  if (!isAdmin) return res.status(403).json({ message: "Unauthorized" });

  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Feedback not found" });

    feedback.blocked = !feedback.blocked;
    await feedback.save();

    req.io.emit("feedback:status-change", {
      id: feedback._id,
      blocked: feedback.blocked,
    });

    res.status(200).json({ message: `Feedback ${feedback.blocked ? "blocked" : "unblocked"}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Mark feedback as deleted (admin only)
router.delete("/delete/:id", verifyUser, async (req, res) => {
  const { isAdmin } = req.user;
  if (!isAdmin) return res.status(403).json({ message: "Unauthorized" });

  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Feedback not found" });

    feedback.deleted = true;
    await feedback.save();

    req.io.emit("feedback:deleted", { id: feedback._id });

    res.status(200).json({ message: "Feedback marked as deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Like or Unlike Feedback
router.post("/like/:id", verifyUser, async (req, res) => {
  const feedbackId = req.params.id;
  const userId = req.user.id;

  if (!userId) return res.status(400).json({ message: "User ID is required" });

  try {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) return res.status(404).json({ message: "Feedback not found" });

    const liked = feedback.likes.includes(userId);
    if (liked) {
      feedback.likes.pull(userId);
    } else {
      feedback.likes.push(userId);
    }

    await feedback.save();

    req.io.emit("feedback:liked", {
      id: feedback._id,
      likes: feedback.likes,
    });

    res.status(200).json({ message: liked ? "Unliked" : "Liked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Comment
router.post("/add-comment/:id", verifyUser, async (req, res) => {
  const feedbackId = req.params.id;
  const { message } = req.body;
  const userId = req.user.id;

  try {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) return res.status(404).json({ message: "Feedback not found" });

    const newComment = { user: userId, message };
    feedback.comments.push(newComment);
    await feedback.save();

    req.io.emit("feedback:comment-added", {
      feedbackId: feedback._id,
      comment: newComment,
    });

    res.status(200).json({ message: "Comment added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Reply to Comment
router.post("/reply/:feedbackId/:commentId", verifyUser, async (req, res) => {
  const { feedbackId, commentId } = req.params;
  const { message } = req.body;
  const userId = req.user.id;

  try {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) return res.status(404).json({ message: "Feedback not found" });

    const comment = feedback.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const newReply = { user: userId, message };
    comment.replies.push(newReply);
    await feedback.save();

    req.io.emit("feedback:reply-added", {
      feedbackId,
      commentId,
      reply: newReply,
    });

    res.status(200).json({ message: "Reply added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
