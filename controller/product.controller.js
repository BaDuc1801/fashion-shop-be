import categoryModel from "../model/category.model.js";
import orderModel from "../model/order.model.js";
import productModel from "../model/product.model.js";
import ratingModel from "../model/rating.model.js";
import userModel from "../model/user.model.js";

const productController = {
  // CREATE
  createProduct: async (req, res) => {
    try {
      const { body } = req;

      const category = await categoryModel.findById(body.categoryId);
      if (!category) {
        return res.status(400).json({ message: "Category not found" });
      }

      const product = await productModel.create({
        name: body.name,
        nameEn: body.nameEn,
        sku: body.sku,
        price: body.price,
        description: body.description,
        descriptionEn: body.descriptionEn,
        status: body.status || "active",
        images: body.images || [],
        sizeVariants: body.sizeVariants || [],
        categoryId: body.categoryId,
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
        limit = 10,
        status,
        search,
        categoryId,
        categorySlug,
        categoryName,
        categoryNameEn,
        sortPrice,
        lang = "en",
      } = req.query;
      let sortOption = { createdAt: -1 };
      if (sortPrice) {
        sortOption = { price: sortPrice === "asc" ? 1 : -1 };
      }

      const query = {};
      if (status) query.status = status;

      if (search) {
        const keyword = search.trim();

        if (lang === "vi") {
          query.$or = [
            { name: { $regex: keyword, $options: "i" } },
            { sku: { $regex: keyword, $options: "i" } },
          ];
        } else {
          query.$or = [
            { nameEn: { $regex: keyword, $options: "i" } },
            { sku: { $regex: keyword, $options: "i" } },
          ];
        }
      }

      if (categoryId) query.categoryId = categoryId;

      if (categorySlug) {
        const category = await categoryModel.findOne({
          slug: categorySlug,
        });

        if (!category) {
          return res.json({
            data: [],
            total: 0,
            page: Number(page),
            totalPages: 0,
          });
        }

        query.categoryId = category._id;
      }

      if (categoryName || categoryNameEn) {
        const match = {};

        if (categoryName) {
          match.name = categoryName;
        }

        if (categoryNameEn) {
          match.nameEn = categoryNameEn;
        }

        const category = await categoryModel.findOne(match);

        if (!category) {
          return res.json({
            data: [],
            total: 0,
            page: Number(page),
            totalPages: 0,
          });
        }

        query.categoryId = category._id;
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        productModel
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(Number(limit))
          .populate("categoryId"),

        productModel.countDocuments(query),
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
      const product = await productModel.findById(req.params.id);

      if (!product) return res.status(404).json({ message: "Not found" });

      res.json(product);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET ONE BY SKU
  getProductBySku: async (req, res) => {
    try {
      const { sku } = req.params;
      const { limit = 10, page = 1, lang = "en" } = req.query;

      const limitNum = Number(limit);
      const pageNum = Number(page);
      const skip = (pageNum - 1) * limitNum;

      const [product, user] = await Promise.all([
        productModel.findOne({ sku }).populate("categoryId"),
        req.user ? userModel.findById(req.user.id) : null,
      ]);

      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }

      const [reviews, stats] = await Promise.all([
        ratingModel
          .find({
            productId: product._id,
            isPublic: true,
          })
          .populate("userId", "name avatar")
          .sort({ createdAt: -1 })
          .limit(limitNum)
          .skip(skip),
        ratingModel.calcAverageRating(product._id),
      ]);

      let inWishlist = false;

      if (user?.wishlist?.length) {
        const wishlistSet = new Set(user.wishlist.map((id) => id.toString()));
        inWishlist = wishlistSet.has(product._id.toString());
      }

      const data = product.toObject();

      const name =
        data.name_i18n?.get?.(lang) || data.name_i18n?.[lang] || data.name;

      const description =
        data.description_i18n?.get?.(lang) ||
        data.description_i18n?.[lang] ||
        data.description;

      return res.json({
        ...product.toObject(),
        inWishlist,
        reviews,
        ratingStats: stats,
        name,
        description,
      });
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

      const product = await productModel.findByIdAndUpdate(
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
      await productModel.findByIdAndDelete(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  decreaseStock: async (items) => {
    try {
      for (const item of items) {
        const product = await productModel.findById(item.productId);

        if (!product) continue;

        const sizeIndex = product.sizeVariants.findIndex(
          (s) => s.size === item.size
        );

        if (sizeIndex === -1) continue;

        product.sizeVariants[sizeIndex].stock -= item.quantity;

        if (product.sizeVariants[sizeIndex].stock < 0) {
          product.sizeVariants[sizeIndex].stock = 0;
        }

        await product.save();
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  getTopPurchasedProducts: async (req, res) => {
    try {
      const { limit = 10, page = 1, lang = "en" } = req.query;

      const limitNum = parseInt(limit || 10);
      const pageNum = parseInt(page || 1);
      const skip = (pageNum - 1) * limitNum;

      const basePipeline = [
        { $match: { orderStatus: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalSold: { $sum: "$items.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: ["$items.quantity", "$items.price"],
              },
            },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            name: "$product.name",
            nameEn: "$product.nameEn",
            sku: "$product.sku",
            image: { $arrayElemAt: ["$product.images", 0] },
            price: "$product.price",
            totalSold: 1,
            totalRevenue: 1,
          },
        },
      ];

      const countResult = await orderModel.aggregate([
        ...basePipeline,
        { $count: "total" },
      ]);

      const total = countResult[0]?.total || 0;
      const totalPages = Math.ceil(total / limitNum);

      const data = await orderModel.aggregate([
        ...basePipeline,
        { $sort: { totalSold: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ]);

      res.json({
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        data,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

export default productController;
