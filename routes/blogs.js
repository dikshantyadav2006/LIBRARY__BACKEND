import express from "express";
import upload from "../middleware/multerConfig.js"; 
import cloudinary from "../config/cloudinary.js";
import Blog from "../models/Blog.js"; 
import User from "../models/User.js";

const router = express.Router();

// ---------------------------
// 📌 CREATE BLOG
// ---------------------------
router.post("/create/:userId", upload.single("image"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, description } = req.body;

    if (!title || !description)
      return res.status(400).json({ message: "Title & description required" });

    // Check file
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    // Upload to Cloudinary
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "shai_library/blogs",
      resource_type: "image",
      unique_filename: true,
    });

    const image = result.secure_url || result.url;

    let newBlog = await Blog.create({
      title,
      description,
      image,
      userId,
      likes: [],
      comments: [],
    });

    // ⚡ REALTIME: Populate user details immediately so it displays correctly on frontend without refresh
    newBlog = await newBlog.populate("userId", "username profilePic");

    // Emit real-time event
    req.io.emit("blog:new", newBlog);

    res.status(201).json({ message: "Blog created", blog: newBlog });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---------------------------
// 📌 GET ALL BLOGS
// ---------------------------
router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find()
      .populate("userId", "username profilePic")
      .populate("comments.user", "username profilePic")
      .populate("comments.replies.user", "username profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(blogs);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---------------------------
// 📌 LIKE / UNLIKE BLOG
// ---------------------------
router.post("/like/:blogId/:userId", async (req, res) => {
  try {
    const { blogId, userId } = req.params;

    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const index = blog.likes.indexOf(userId);

    if (index === -1) blog.likes.push(userId);
    else blog.likes.splice(index, 1);

    await blog.save();

    // ⚡ REALTIME: Emit only necessary data (matching feedback.js pattern)
    req.io.emit("blog:liked", {
      _id: blog._id,
      likes: blog.likes,
    });

    res.status(200).json({ message: "Like updated", likes: blog.likes });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---------------------------
// 📌 COMMENT ON BLOG
// ---------------------------
router.post("/comment/:blogId/:userId", async (req, res) => {
  try {
    const { blogId, userId } = req.params;
    const { message } = req.body;

    if (!message.trim())
      return res.status(400).json({ message: "Comment cannot be empty" });

    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const newComment = {
      user: userId,
      message,
      replies: [],
    };

    blog.comments.push(newComment);
    await blog.save();

    // ⚡ REALTIME: Fetch the specific comment with populated User to send via socket
    // We get the last comment (the one we just added)
    const addedComment = blog.comments[blog.comments.length - 1];
    
    // We need to populate this specific comment user to show name/pic instantly
    const populatedBlog = await Blog.findById(blogId).populate(
      "comments.user",
      "username profilePic"
    );
    const populatedComment = populatedBlog.comments.id(addedComment._id);

    req.io.emit("blog:comment-added", {
      blogId: blog._id,
      comment: populatedComment,
    });

    res.status(200).json({ message: "Comment added", comments: blog.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---------------------------
// 📌 REPLY TO COMMENT
// ---------------------------
router.post("/reply/:blogId/:commentId/:userId", async (req, res) => {
  try {
    const { blogId, commentId, userId } = req.params;
    const { message } = req.body;

    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const comment = blog.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const newReply = {
      user: userId,
      message,
    };

    comment.replies.push(newReply);
    await blog.save();

    // ⚡ REALTIME: Populate the user details for the reply
    const populatedBlog = await Blog.findById(blogId).populate(
      "comments.replies.user",
      "username profilePic"
    );
    
    // Navigate to the specific reply to get the populated version
    const populatedComment = populatedBlog.comments.id(commentId);
    const populatedReply = populatedComment.replies[populatedComment.replies.length - 1];

    req.io.emit("blog:reply-added", {
      blogId,
      commentId,
      reply: populatedReply,
    });

    res.status(200).json({ message: "Reply added" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;