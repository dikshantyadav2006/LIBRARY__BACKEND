import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  joiningDate: { type: Date, default: Date.now, immutable: true },
  leavingDate: { type: Date, default: null },
  seatAllotedId: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", default: null },
  isActive: { type: Boolean, default: true },
  
  
},
{ timestamps: true } // Automatically adds createdAt and updatedAt
);

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);
export default Student;

