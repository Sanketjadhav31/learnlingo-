const mongoose = require("mongoose");

const UserAuthSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

function getUserAuthModel() {
  return mongoose.models.UserAuth || mongoose.model("UserAuth", UserAuthSchema);
}

module.exports = { getUserAuthModel };
