import express from "express";
import multer from "multer";
import virtualController from "../controller/virtual.controller.js";

const virtualRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

virtualRouter.post(
  "/",
  upload.fields([
    { name: "person", maxCount: 1 },
    { name: "clothes", maxCount: 1 },
  ]),
  virtualController.virtualTryOn
);

export default virtualRouter;
