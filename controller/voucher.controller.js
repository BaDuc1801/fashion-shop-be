import voucherModel from "../model/voucher.model.js";

const voucherController = {
  // CREATE
  createVoucher: async (req, res) => {
    try {
      const body = req.body;

      const voucher = await voucherModel.create({
        ...body,
        expiresAt: new Date(body.expiresAt),
      });

      res.status(201).json(voucher);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Voucher code already exists" });
      }
      res.status(500).json({ message: err.message });
    }
  },

  // GET ALL
  getVouchers: async (req, res) => {
    try {
      const { page = 1, limit = 10, search, status } = req.query;

      const pageNumber = Number(page);
      const limitNumber = Number(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const match = {};

      if (status) match.status = status;

      if (search) {
        match.code = { $regex: search.trim(), $options: "i" };
      }

      const [data, total] = await Promise.all([
        voucherModel
          .find(match)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber),

        voucherModel.countDocuments(match),
      ]);

      res.json({
        data,
        total,
        page: pageNumber,
        totalPages: Math.ceil(total / limitNumber),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET BY ID
  getVoucherById: async (req, res) => {
    try {
      const voucher = await voucherModel.findById(req.params.id);

      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      res.json(voucher);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // UPDATE
  updateVoucher: async (req, res) => {
    try {
      const body = req.body;

      if (body.expiresAt) {
        body.expiresAt = new Date(body.expiresAt);
      }

      const voucher = await voucherModel.findByIdAndUpdate(
        req.params.id,
        body,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      res.json(voucher);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Voucher code already exists" });
      }
      res.status(500).json({ message: err.message });
    }
  },

  // DELETE
  deleteVoucher: async (req, res) => {
    try {
      const voucher = await voucherModel.findByIdAndDelete(req.params.id);

      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      res.json({ message: "Deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

export default voucherController;
