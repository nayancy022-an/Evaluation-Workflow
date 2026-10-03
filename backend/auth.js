const jwt = require("jsonwebtoken");
const User = require("./models/User");

const COOKIE = "evalflow_token";
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days, in seconds

function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cookieFlags() {
  return `HttpOnly; SameSite=Lax; Path=/${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function issueCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: MAX_AGE });
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; ${cookieFlags()}; Max-Age=${MAX_AGE}`);
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieFlags()}; Max-Age=0`);
}

async function getUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(sub);
  } catch {
    return null;
  }
}

const publicUser = (user) => ({ id: String(user._id), name: user.name, email: user.email });

module.exports = { issueCookie, clearCookie, getUser, publicUser };