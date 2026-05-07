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

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  },
};

export default virtualController;
