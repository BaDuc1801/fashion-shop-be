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
      const token = req.cookies.access_token ||
        req.headers.authorization?.split(" ")[1] ||
        req.headers["x-access-token"];


      if (!token) {
        return res.status(401).json({ message: "Access token is missing" });
      }
      jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(401).json({ message: "Access token is invalid" });
        }
        req.user = decoded;
        next();
      });
    } catch (error) {
      res.status(401).json({ message: "Access token is invalid" });
    }
  },
  optionalAuth: (req, res, next) => {
    try {
      const token = req.cookies.access_token ||
        req.headers.authorization?.split(" ")[1] ||
        req.headers["x-access-token"];

      if (token) {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded;
      }
    } catch (err) {
      console.log("JWT ERROR:", err.message);
    }

    next();
  },
};

export default userMiddleware;
