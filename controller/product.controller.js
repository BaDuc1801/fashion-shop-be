import Product from "../model/product.model.js";
import cloudinary from "../config/cloudinary.js";

// upload buffer -> cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "products" }, (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      })
      .end(buffer);
  });
};

const productController = {
  // CREATE
  createProduct: async (req, res) => {
    try {
      const { body } = req;

      const product = await Product.create({
        name: body.name,
        sku: body.sku,
        price: body.price,
        status: body.status || "active",
        images: body.images || [],
        sizeVariants: body.sizeVariants || [],
      });

      res.status(201).json(product);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "SKU already exists" });
      }

      res.status(500).json({ message: err.message });
    }
  },

  // GET ALL (pagination + filter)
  getProducts: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 1,
        minPrice,
        maxPrice,
        status,
        search,
      } = req.query;

      const query = {};

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      if (status) query.status = status;

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        Product.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        Product.countDocuments(query),
      ]);

      res.json({
        data,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET ONE
  getProductById: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) return res.status(404).json({ message: "Not found" });

      res.json(product);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // UPDATE
  updateProduct: async (req, res) => {
    try {
      const { body } = req;

      const updateData = {
        ...body,
      };

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

      res.json(product);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "SKU already exists" });
      }

      res.status(500).json({ message: err.message });
    }
  },

  // DELETE
  deleteProduct: async (req, res) => {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

export default productController;
