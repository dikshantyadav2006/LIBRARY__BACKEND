import Student from "../models/Student.js";
import User from "../models/User.js";

// ✅ Get student details along with user full name
export const getStudentDetails = async (req, res) => {
    try {
        const { studentId } = req.params;
        console.log("Student ID received:", studentId);
    
        // 🔹 Fetch the student record from the Student collection
        const student = await Student.findById(studentId);
        console.log("Student record found:", student);
    
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
    
        if (!student.userId) {
          return res.status(400).json({ message: "Student has no associated user" });
        }

        // 🔹 Fetch the user details using student.userId
        const user = await User.findById(student.userId).select("fullName");
        console.log("User record found:", user);
    
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // 🔹 Return both student details and full name from user
        res.json({ 
            ...student.toObject(), 
            fullName: user.fullname 
        });

    } catch (error) {
        console.error("Error fetching student details:", error);
        res.status(500).json({ message: "Server error" });
    }
};
