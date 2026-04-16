import orderModel from "../model/order.model.js";
import productModel from "../model/product.model.js";
import voucherModel from "../model/voucher.model.js";
import {
  reserveStock,
  releaseReservedStock,
} from "../services/payment/stock.service.js";
import { createVNPayUrl } from "../services/payment/vnpay.service.js";

const orderController = {
  createOrder: async (req, res) => {
    try {
      const userId = req.user.id;

      const { items, shippingAddress, voucherCode, paymentMethod, note } =
        req.body;

      if (!items?.length) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      let subtotal = 0;
      const orderItems = [];

      // =====================
      // 1. VALIDATE PRODUCTS
      // =====================
      for (const item of items) {
        const product = await productModel.findById(item.productId);

        if (!product) {
          return res.status(404).json({
            message: `Product not found`,
          });
        }

        const sizeVariant = product.sizeVariants.find(
          (s) => s.size === item.size
        );

        const colorVariant = sizeVariant?.colors?.find(
          (c) => c.name === item.color
        );

        if (!colorVariant || colorVariant.quantity < item.quantity) {
          return res.status(400).json({
            message: `Not enough stock for ${product.name} (${item.size}/${item.color})`,
          });
        }

        subtotal += product.price * item.quantity;

        orderItems.push({
          productId: product._id,
          nameSnapshot: product.name,
          imageSnapshot: product.images?.[0] || "",
          size: item.size,
          color: item.color,
          price: product.price,
          quantity: item.quantity,
        });
      }

      // =====================
      // 2. VOUCHER
      // =====================
      let discountAmount = 0;
      let voucher = null;

      if (voucherCode) {
        voucher = await voucherModel.findOne({
          code: voucherCode,
          status: "active",
          expiresAt: { $gt: new Date() },
        });

        if (voucher) {
          discountAmount = (subtotal * voucher.discountPercent) / 100;

          if (discountAmount > voucher.maxDiscount) {
            discountAmount = voucher.maxDiscount;
          }
        }
      }

      const shippingFee = 0;
      const total = subtotal - discountAmount + shippingFee;

      // =====================
      // 3. CREATE ORDER FIRST (DRAFT)
      // =====================
      let order = await orderModel.create({
        userId,
        items: orderItems,
        subtotal,
        shippingFee,
        discount: voucher
          ? {
              voucherId: voucher._id,
              discountAmount,
            }
          : undefined,
        total,
        shippingAddress,
        paymentMethod,
        note,

        paymentStatus: "pending",
        orderStatus: "pending",
      });

      // =====================
      // 4. RESERVE STOCK AFTER ORDER CREATED
      // =====================
      try {
        await reserveStock(order.items);
      } catch (err) {
        await order.deleteOne();
        return res.status(400).json({
          message: err.message || "Reserve stock failed",
        });
      }

      return res.status(201).json({
        message: "Order created",
        order,
      });
    } catch (err) {
      return res.status(500).json({
        message: err.message,
      });
    }
  },

  getMyOrders: async (req, res) => {
    try {
      const userId = req.user.id;

      const orders = await orderModel.find({ userId }).sort({ createdAt: -1 });

      return res.json(orders);
    } catch (err) {
      return res.status(500).json({
        message: err.message,
      });
    }
  },
  getOrderById: async (req, res) => {
    try {
      const order = await orderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      return res.json(order);
    } catch (err) {
      return res.status(500).json({
        message: err.message,
      });
    }
  },
  cancelOrder: async (req, res) => {
    try {
      const order = await orderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      if (!["pending", "processing"].includes(order.paymentStatus)) {
        return res.status(400).json({
          message: "Cannot cancel paid order",
        });
      }

      order.orderStatus = "cancelled";
      order.paymentStatus = "failed";

      await order.save();
      await releaseReservedStock(order.items);

      return res.json({
        message: "Order cancelled",
        order,
      });
    } catch (err) {
      return res.status(500).json({
        message: err.message,
      });
    }
  },
};

export default orderController;
