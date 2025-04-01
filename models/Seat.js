import mongoose from "mongoose";

const seatSchema = new mongoose.Schema({
  seatNumber: { type: Number, required: true, unique: true },
  shifts: [
    {
      shiftType: { type: String, enum: ["morning", "afternoon", "night"], required: true },
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
      releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      assignedAt: { type: Date, default: Date.now },
      releasedAt: { type: Date, default: null },
      status: { type: String, enum: ["available", "occupied"], default: "available" },
    },
  ],
  history: [
    {
      shiftType: { type: String, enum: ["morning", "afternoon", "night"] },
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      assignedAt: { type: Date, default: Date.now },
      releasedAt: { type: Date, default: null },
    },
  ],
});

// ✅ Assign multiple shifts to a student
seatSchema.methods.assignSeat = async function (studentId, shiftTypes, adminId) {
  for (const shiftType of shiftTypes) {
    const shift = this.shifts.find((s) => s.shiftType === shiftType);
    if (!shift) throw new Error(`Invalid shift type: ${shiftType}`);
    if (shift.studentId) throw new Error(`Seat is already occupied for ${shiftType} shift!`);

    shift.studentId = studentId;
    shift.assignedBy = adminId;
    shift.status = "occupied";
    shift.assignedAt = new Date();

    this.history.push({
      shiftType,
      studentId,
      assignedBy: adminId,
      assignedAt: shift.assignedAt,
      releasedBy: null,
      releasedAt: null,
    });
  }

  await this.save();
};

// ✅ Release multiple shifts for a student
seatSchema.methods.releaseSeat = async function (shiftTypes, adminId) {
  for (const shiftType of shiftTypes) {
    const shift = this.shifts.find((s) => s.shiftType === shiftType);
    if (!shift || !shift.studentId) throw new Error(`Seat is already available for ${shiftType} shift!`);

    shift.releasedBy = adminId;
    shift.releasedAt = new Date();
    shift.status = "available";
    const releasedStudentId = shift.studentId;
    shift.studentId = null;

    this.history.push({
      shiftType,
      studentId: releasedStudentId,
      assignedBy: shift.assignedBy,
      assignedAt: shift.assignedAt,
      releasedBy: adminId,
      releasedAt: shift.releasedAt,
    });
  }

  await this.save();
};

const Seat = mongoose.model("Seat", seatSchema);
export default Seat;
