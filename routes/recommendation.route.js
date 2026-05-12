import express from "express";
import { getRecommendations, getTrending } from "../controller/recommendation.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const router = express.Router();
const { verifyToken, optionalAuth } = userMiddleware;

router.get("/trending", getTrending);
router.get("/:userId", verifyToken, getRecommendations);

export default router;
