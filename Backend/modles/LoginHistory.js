const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    browser: {
      type: String,
      required: true,
    },
    os: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet", "Unknown"],
      required: true,
    },
    loginStatus: {
      type: String,
      enum: ["success", "failed", "otp_pending"],
      default: "success",
    },
    loginAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
