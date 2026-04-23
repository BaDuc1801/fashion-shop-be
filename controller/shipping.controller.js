import { getDistance } from "geolib";

const shippingController = {
  calculateShippingFee: async (req, res) => {
    try {
      const { lat, lng } = req.body;

      if (!lat || !lng) {
        return res.status(400).json({
          message: "Latitude and longitude are required",
        });
      }

      const storeLocation = {
        latitude: 21.028511,
        longitude: 105.804817,
      };

      const customerLocation = {
        latitude: Number(lat),
        longitude: Number(lng),
      };

      const distanceInMeters = getDistance(storeLocation, customerLocation);

      let shippingFee = 0;

      if (distanceInMeters <= 3000) {
        shippingFee = 2;
      } else if (distanceInMeters <= 10000) {
        shippingFee = 5;
      } else {
        shippingFee = 10;
      }

      return res.json({
        distance: distanceInMeters,
        shippingFee,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Calculate shipping failed",
      });
    }
  },
};

export default shippingController;
