const requestIp = require("request-ip");
const getIp = (req, res, next) => {
  let ip = requestIp.getClientIp(req);

  // Normalize IPv6 loopback to IPv4 loopback for local development
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    ip = "127.0.0.1";
  }

  req.clientIp = ip || "Unknown";
  next();
};

module.exports = getIp;
