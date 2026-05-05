const useragent = require("useragent");


const detectDevice = (req, res, next) => {
  const userAgentString = req.headers["user-agent"] || "";
  const agent = useragent.parse(userAgentString);

  // Get browser family name (e.g., "Chrome", "Edge", "Firefox", "Safari")
  const browser = agent.family || "Unknown";

  // Get OS family name (e.g., "Windows", "Mac OS X", "Linux", "Android", "iOS")
  const os = agent.os.family || "Unknown";

  // Determine device type based on User-Agent string patterns
  let deviceType = "Desktop"; // default

  const uaLower = userAgentString.toLowerCase();

  if (
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|opera mobi/i.test(
      userAgentString
    )
  ) {
    deviceType = "Mobile";
  } else if (/ipad|android(?!.*mobile)|tablet|kindle|silk/i.test(userAgentString)) {
    deviceType = "Tablet";
  }

  // Attach device info to the request object for use in controllers
  req.deviceInfo = {
    browser,
    os,
    deviceType,
    userAgent: userAgentString,
  };

  next();
};

module.exports = detectDevice;
