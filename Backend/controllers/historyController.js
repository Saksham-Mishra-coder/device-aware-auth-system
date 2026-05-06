const LoginHistory = require("../modles/LoginHistory");

/**
 * GET /api/history/:userId
 * Retrieve the login history for a specific user, sorted by most recent first.
 */
const getLoginHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const history = await LoginHistory.find({ userId })
      .sort({ loginAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: history.length,
      loginHistory: history,
    });
  } catch (error) {
    console.error("Get Login History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching login history.",
    });
  }
};

module.exports = { getLoginHistory };
