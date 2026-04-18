import express from "express";
import dashboardController from "../controller/dashboard.controller.js";

const dashboardRouter = express.Router();

dashboardRouter.get("/summary", dashboardController.dashboardSummary);
dashboardRouter.get("/chart", dashboardController.dashboardChart);

export default dashboardRouter;