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
userRouter.get("/:id", userMiddleware.verifyToken, userController.getUserById);
userRouter.put(
  "/me/password",
  userMiddleware.verifyToken,
  userController.changePassword
);
userRouter.get("/", userMiddleware.verifyToken, userController.getUsers);
userRouter.put("/:id", userMiddleware.verifyToken, userController.updateUser);
userRouter.delete(
  "/:id",
  userMiddleware.verifyToken,
  userController.deleteUser
);
userRouter.post(
  "/invite",
  userMiddleware.verifyToken,
  userController.inviteUser
);
userRouter.post(
  "/wishlist",
  userMiddleware.verifyToken,
  userController.addToWishlist
);
userRouter.delete(
  "/wishlist/:productId",
  userMiddleware.verifyToken,
  userController.removeFromWishlist
);
userRouter.post("/cart", userMiddleware.verifyToken, userController.addToCart);
userRouter.delete(
  "/cart/:productId",
  userMiddleware.verifyToken,
  userController.removeFromCart
);
userRouter.put(
  "/me/cart",
  userMiddleware.verifyToken,
  userController.updateCartItem
);
userRouter.get(
  "/me/wishlist",
  userMiddleware.verifyToken,
  userController.getWishlist
);
userRouter.get("/me/cart", userMiddleware.verifyToken, userController.getCart);

export default userRouter;
