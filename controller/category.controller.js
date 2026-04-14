import categoryModel from "../model/category.model.js";
import productModel from "../model/product.model.js";
import { getProductCountByCategory } from "../utils/category.util.js";

const categoryController = {
  // CREATE
  createCategory: async (req, res) => {
    try {
      const { name, slug, image, status } = req.body;

      const category = await categoryModel.create({
        name,
        slug,
        image,
        status,
      });

      res.status(201).json(category);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Slug already exists" });
      }
      res.status(500).json({ message: err.message });
    }
  },

  // GET ALL
  getCategories: async (req, res) => {
    try {
      const { page = 1, limit = 10, status, search } = req.query;

      const pageNumber = Number(page);
      const limitNumber = Number(limit);

      const skip = (pageNumber - 1) * limitNumber;

      const match = {};

      if (status) match.status = status;

      if (search) {
        match.$or = [
          { name: { $regex: search.trim(), $options: "i" } },
          { slug: { $regex: search.trim(), $options: "i" } },
        ];
      }

      const [categories, total, counts] = await Promise.all([
        categoryModel
          .find(match)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        categoryModel.countDocuments(match),

        productModel.aggregate([
          {
            $match: { status: "active" },
          },
          {
            $group: {
              _id: "$categoryId",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const countMap = {};
      counts.forEach((item) => {
        if (item._id) {
          countMap[item._id.toString()] = item.count;
        }
      });

      const data = categories.map((cat) => ({
        ...cat,
        productCount: countMap[cat._id.toString()] || 0,
      }));

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

  // GET ONE BY ID
  getCategoryById: async (req, res) => {
    try {
      const category = await categoryModel.findById(req.params.id).lean();

      if (!category) {
        return res.status(404).json({ message: "Not found" });
      }

      const productCount = await getProductCountByCategory(category._id);

      res.json({
        ...category,
        productCount,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET ONE BY SLUG
  getCategoryBySlug: async (req, res) => {
    try {
      const { slug } = req.params;

      const category = await categoryModel.findOne({ slug }).lean();

      if (!category) {
        return res.status(404).json({ message: "Not found" });
      }

      const productCount = await getProductCountByCategory(category._id);

      res.json({
        ...category,
        productCount,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // UPDATE
  updateCategory: async (req, res) => {
    try {
      const category = await categoryModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!category) {
        return res.status(404).json({ message: "Not found" });
      }

      res.json(category);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Slug already exists" });
      }
      res.status(500).json({ message: err.message });
    }
  },

  // DELETE
  deleteCategory: async (req, res) => {
    try {
      const categoryId = req.params.id;

      const productExists = await productModel.exists({
        categoryId: categoryId,
      });

      if (productExists) {
        return res.status(400).json({
          message: "Category still has products, cannot delete",
        });
      }

      const category = await categoryModel.findByIdAndDelete(categoryId);

      if (!category) {
        return res.status(404).json({ message: "Not found" });
      }

      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

export default categoryController;
