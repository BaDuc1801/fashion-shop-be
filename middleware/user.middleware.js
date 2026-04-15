import jwt from "jsonwebtoken";
import userModel from "../model/user.model.js";

const userMiddleware = {
  checkValidUser: async (req, res, next) => {
    const { email } = req.body;
    const existed = await userModel.findOne({ email });
    if (existed) {
      return res.status(400).send({ message: "Email already exists" });
    } else {
      next();
    }
  },
  verifyToken: async (req, res, next) => {
    try {
      const token = req.cookies.access_token;
      if (token) {
        jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
          if (err) {
            return res.status(401).json({ message: "Access token is invalid" });
          } else {
            req.user = decoded;
            next();
          }
        });
      } else {
        res.status(401).json({ message: "Access token is missing" });
      }
    } catch (error) {
      res.status(401).json({ message: "Access token is missing" });
    }
  },
  optionalAuth: (req, res, next) => {
    try {
      const token = req.cookies.access_token;
  
      if (token) {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded;
      }
    } catch (err) {
      console.log("JWT ERROR:", err.message); // 👈 thêm dòng này
    }
  
    next();
  },
};

export default userMiddleware;
