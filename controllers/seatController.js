import Seat from "../models/Seat.js";
import Student from "../models/Student.js";
import User from "../models/User.js";

// ✅ Get all seats
export const getAllSeats = async (req, res) => {
  try {
    const seats = await Seat.find();

    res.status(200).json(seats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching seats", error: error.message });
  }
};


export const getSeatDetails = async (req, res) => {
  try {
    const { seatNumber } = req.params;

    // 🔹 Find seat & populate shifts with studentId
    const seat = await Seat.findOne({ seatNumber }).populate("shifts.studentId");
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    // 🔹 Process shift data
    const shiftsWithStudentData = await Promise.all(
      seat.shifts.map(async (shift) => {
        if (!shift.studentId) {
          return { ...shift.toObject(), status: "Available" }; // No student assigned
        }

        // 🔹 Fetch student details
        const student = await Student.findById(shift.studentId);
        if (!student) {
          return { ...shift.toObject(), status: "Available" }; // Student record missing
        }

        // 🔹 Fetch user details (username)
        const user = await User.findById(student.userId).select("-password");
        if (!user) {
          return { ...shift.toObject(), status: "Available" }; // User record missing
        }

        return {
          ...shift.toObject(),
          studentDetails: {
            studentId: student._id,
            name: student.name,
            joiningDate: student.joiningDate,
            feesPaid: student.feesPaid,
            duration: student.duration,
            timing: student.timing,
          },
          userDetails: {
            userId: user._id,
            username: user.username,
            fullname: user.fullname,
          },
          status: "Occupied",
        };
      })
    );

    // 🔹 Send response
    res.status(200).json({
      seatNumber: seat.seatNumber,
      shifts: shiftsWithStudentData,
    });

  } catch (error) {
    console.error("Error fetching seat details:", error);
    res.status(500).json({ message: "Error fetching seat details", error: error.message });
  }
};


// ✅ Assign seat(s) to a student
export const assignSeat = async (req, res) => {
  try {
    const { seatNumber, studentId, shiftType, adminId } = req.body;
    console.log(req.body)

    console.log("Received Data:", { seatNumber, studentId, shiftType, adminId });


    if (!Array.isArray(shiftType) || shiftType.length === 0) {
      return res.status(400).json({ message: "Invalid shiftTypes format. It should be an array." });
    }

    const seat = await Seat.findOne({ seatNumber });
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    await seat.assignSeat(studentId, shiftType, adminId);
    res.status(200).json({ message: "Seat assigned successfully", seat });
  } catch (error) {
    res.status(400).json({ message: "Error assigning seat", error: error.message });
  }
};

// ✅ Release seat(s) for a student
export const releaseSeat = async (req, res) => {
  try {
    const { seatNumber, shiftTypes, adminId } = req.body;

    if (!Array.isArray(shiftTypes) || shiftTypes.length === 0) {
      return res.status(400).json({ message: "Invalid shiftTypes format. It should be an array." });
    }

    const seat = await Seat.findOne({ seatNumber });
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    await seat.releaseSeat(shiftTypes, adminId);
    res.status(200).json({ message: "Seat released successfully", seat });
  } catch (error) {
    res.status(400).json({ message: "Error releasing seat", error: error.message });
  }
};
