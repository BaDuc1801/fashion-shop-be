import { generateVirtualTryOn } from "../services/virtual.service.js";

const virtualController = {
  virtualTryOn: async (req, res) => {
    try {
      const personFile = req.files?.person?.[0];
      const { clothesUrl } = req.body;

      if (!personFile || !clothesUrl) {
        return res.status(400).json({
          success: false,
          message: "Missing person image or clothesUrl",
        });
      }

      const result = await generateVirtualTryOn({
        personFile,
        clothesUrl,
      });

      return res.json({
        success: true,
        imageUrl: result.imageUrl,
      });
    } catch (err) {
      console.error(err);

      const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

      return res.status(status).json({
        success: false,
        message: err.message || "Something went wrong",
      });
    }
  },
};

export default virtualController;
