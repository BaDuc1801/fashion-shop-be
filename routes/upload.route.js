import express from "express";
import { uploadImage } from "../controller/upload.controller.js";
import upload from "../middleware/upload.middleware.js";

const uploadRouter = express.Router();

uploadRouter.post("/", upload.array("images"), uploadImage);

export default uploadRouter;
