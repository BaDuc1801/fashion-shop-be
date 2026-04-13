import express from "express";
import userController from "../controller/user.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const userRouter = express.Router();

userRouter.post(
  "/register",
  userMiddleware.checkValidUser,
  userController.register
);
userRouter.post("/login", userController.login);
userRouter.post("/logout", userController.logout);
userRouter.post("/refresh", userController.refresh);
userRouter.post("/send-otp", userController.sendOTP);
userRouter.post("/resend-otp", userController.resendOTP);
userRouter.post("/verify-otp", userController.verifyOTP);
userRouter.post("/reset-password", userController.resetPassword);
userRouter.get("/me", userMiddleware.verifyToken, userController.getProfile);
userRouter.get("/", userMiddleware.verifyToken, userController.getUsers);
userRouter.put("/:id", userMiddleware.verifyToken, userController.updateUser);
userRouter.delete(
  "/:id",
  userMiddleware.verifyToken,
  userController.deleteUser
);

export default userRouter;
