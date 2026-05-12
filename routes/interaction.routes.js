import express from "express";
import { trackView, trackClick, trackAddToCart, trackPurchase } from "../controller/interaction.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const router = express.Router();
const { verifyToken } = userMiddleware;

router.use(verifyToken);

router.post("/view", trackView);
router.post("/click", trackClick);
router.post("/add-to-cart", trackAddToCart);
router.post("/purchase", trackPurchase);

export default router;
