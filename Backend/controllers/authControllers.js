const jwt = require("jsonwebtoken");
const User = require("../modles/User");
const LoginHistory = require("../modles/LoginHistory");
const { generateOTP, verifyOTP } = require("../service/otpService");
const { sendOTPEmail } = require("../service/emailService");


const isChromeBrowser = (browser) => {
  const b = browser.toLowerCase();
  return b.includes("chrome") && !b.includes("edge");
};

/**
 * Helper: Determine if the browser is Microsoft Edge (no auth required).
 */
const isMicrosoftBrowser = (browser, userAgent = "") => {
  const b = browser.toLowerCase();
  const ua = userAgent.toLowerCase();
  return b.includes("edge") || b.includes("ie") || b.includes("internet explorer") || ua.includes("edg/");
};

/**
 * Helper: Create a JWT token for the user.
 */
const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

/**
 * Helper: Save a login history record.
 */
const saveLoginHistory = async (userId, req, status) => {
  await LoginHistory.create({
    userId,
    ipAddress: req.clientIp || "Unknown",
    browser: req.deviceInfo?.browser || "Unknown",
    os: req.deviceInfo?.os || "Unknown",
    deviceType: req.deviceInfo?.deviceType || "Unknown",
    loginStatus: status,
  });
};

// ─── REGISTER ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user with name, email, and password.
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password.",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    // Create new user (storing plain password — in production, hash with bcrypt)
    const user = await User.create({ name, email, password });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password.",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Verify password (plain text comparison — use bcrypt in production)
    if (user.password !== password) {
      await saveLoginHistory(user._id, req, "failed");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const browser = req.deviceInfo?.browser || "Unknown";
    const userAgent = req.deviceInfo?.userAgent || "";

    // ── CASE 1: Microsoft Browser (Edge/IE) — allow without extra auth ──
    if (isMicrosoftBrowser(browser, userAgent)) {
      const token = createToken(user._id);
      await saveLoginHistory(user._id, req, "success");

      return res.status(200).json({
        success: true,
        message: "Login successful. Microsoft browser detected — no OTP required.",
        authType: "direct",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        deviceInfo: req.deviceInfo,
        ipAddress: req.clientIp,
      });
    }

    // ── CASE 2: Google Chrome — require OTP via email ───────────────────
    if (isChromeEngine(browser, req.deviceInfo?.userAgent)) {
      // Generate OTP and send it via email
      const otp = await generateOTP(user._id);
      await sendOTPEmail(user.email, otp);
      await saveLoginHistory(user._id, req, "otp_pending");

      return res.status(200).json({
        success: true,
        message: "Chrome browser detected. OTP has been sent to your email.",
        authType: "otp_required",
        userId: user._id,
        deviceInfo: req.deviceInfo,
        ipAddress: req.clientIp,
      });
    }

    // ── CASE 3: Other browsers — standard login ────────────────────────
    const token = createToken(user._id);
    await saveLoginHistory(user._id, req, "success");

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      authType: "direct",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      deviceInfo: req.deviceInfo,
      ipAddress: req.clientIp,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
};

/**
 * Helper: Check if the browser is Chrome-engine based (not Edge).
 * Edge also reports "Chrome" in its UA, so we exclude it explicitly.
 */
const isChromeEngine = (browser, userAgent = "") => {
  const b = browser.toLowerCase();
  const ua = userAgent.toLowerCase();

  // Edge contains "chrome" in UA but should NOT trigger OTP
  if (b.includes("edge") || ua.includes("edg/")) {
    return false;
  }

  return b.includes("chrome") || ua.includes("chrome/");
};

// ─── VERIFY OTP ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/verify-otp
 * Verify the OTP sent to the user's email during Chrome-based login.
 */
const verifyLoginOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide userId and OTP.",
      });
    }

    const isValid = await verifyOTP(userId, otp);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    // OTP verified — issue JWT token
    const user = await User.findById(userId);
    const token = createToken(user._id);

    // Update the login history from otp_pending to success
    await LoginHistory.findOneAndUpdate(
      { userId: user._id, loginStatus: "otp_pending" },
      { loginStatus: "success" },
      { sort: { createdAt: -1 } }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. Login complete.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification.",
    });
  }
};

module.exports = { register, login, verifyLoginOTP };
