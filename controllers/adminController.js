import User from "../models/User.js";
import MonthlyBooking from "../models/MonthlyBooking.js";
import BlockedSeat from "../models/BlockedSeat.js";

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
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Block seat shifts (Admin only)
export const blockSeat = async (req, res) => {
  try {
    const { seatNumber, shiftTypes, month, year } = req.body;

    if (!seatNumber || !Array.isArray(shiftTypes) || shiftTypes.length === 0) {
      return res.status(400).json({ message: "seatNumber and shiftTypes array are required" });
    }

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const adminId = req.user.id; // Admin user ID

    // Get or create the booking container
    await MonthlyBooking.getOrCreateForMonth(seatNumber, monthNum, yearNum);

    // Block the shifts using BlockedSeat model
    await BlockedSeat.blockShifts(seatNumber, monthNum, yearNum, shiftTypes, adminId);

    return res.status(200).json({
      success: true,
      message: `Seat ${seatNumber} shifts [${shiftTypes.join(", ")}] blocked for ${monthNum}/${yearNum}`,
    });
  } catch (error) {
    console.error("Error blocking seat:", error);
    return res.status(500).json({ message: error.message || "Error blocking seat" });
  }
};

// Unblock seat shifts (Admin only)
export const unblockSeat = async (req, res) => {
  try {
    const { seatNumber, shiftTypes, month, year } = req.body;

    if (!seatNumber || !Array.isArray(shiftTypes) || shiftTypes.length === 0) {
      return res.status(400).json({ message: "seatNumber and shiftTypes array are required" });
    }

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Get or create the booking container
    await MonthlyBooking.getOrCreateForMonth(seatNumber, monthNum, yearNum);

    // Unblock the shifts using BlockedSeat model
    await BlockedSeat.unblockShifts(seatNumber, monthNum, yearNum, shiftTypes);

    return res.status(200).json({
      success: true,
      message: `Seat ${seatNumber} shifts [${shiftTypes.join(", ")}] unblocked for ${monthNum}/${yearNum}`,
    });
  } catch (error) {
    console.error("Error unblocking seat:", error);
    return res.status(500).json({ message: error.message || "Error unblocking seat" });
  }
};



// Search users by Partial Match (fullname, username, mobile, gmail, address)
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.json([]); // empty search → no result
    }

    const searchTerm = new RegExp(query, "i"); // case-insensitive

    const users = await User.find(
      {
        $or: [
          { fullname: { $regex: searchTerm } },
          { username: { $regex: searchTerm } },
          { mobile: { $regex: searchTerm } },
          { gmail: { $regex: searchTerm } },
          { address: { $regex: searchTerm } },
        ],
      },
      "fullname username mobile gmail address" // return only needed fields
    ).limit(50);

    res.json(users);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
