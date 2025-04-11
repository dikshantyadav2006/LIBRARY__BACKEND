import User from "../models/User.js";
import Student from "../models/Student.js";

// Fetch all users

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "username mobile isAdmin fullname");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Fetch details of a specific user
export const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const student = await Student.findOne({ userId: user._id });

    res.json({ user, student });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};





export const addStudent = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id; // Ensure `req.user` contains the admin ID
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required tooo." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const existingStudent = await Student.findOne({ userId: userId });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: "User is already a student." });
    }

    const newStudent = new Student({ userId: userId, addedBy: adminId });
    await newStudent.save();
    

    return res.status(201).json({ success: true, message: "Student added successfully!" });
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};


