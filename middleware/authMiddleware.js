import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const verifyUser = (req, res, next) => {
  const token = req.cookies.authToken;
  
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized, please log in" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next(); // Proceed to next middleware
  } catch (error) {
    return res.status(403).json({ message: "Invalid token, access denied" });
  }
};

export const verifyAdmin = async (req, res, next) => {
  const token = req.cookies.authToken;
  
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized, please log in" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next(); // Proceed to next middleware
  } catch (error) {
    return res.status(403).json({ message: "Invalid token, access denied" });
  }
};