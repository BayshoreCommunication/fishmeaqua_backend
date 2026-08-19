import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Order, type IOrderItem } from "../models/order.model";
import { Product } from "../models/product.model";
import { asyncHandler } from "../middleware/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20)
  );
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.orderStatus) filter.orderStatus = req.query.orderStatus;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.search) {
    const term = String(req.query.search);
    filter.$or = [
      { orderNumber: { $regex: term, $options: "i" } },
      { customerName: { $regex: term, $options: "i" } },
      { customerPhone: { $regex: term, $options: "i" } },
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return ApiResponse(res, 200, "Orders fetched successfully", {
    orders,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { orderNumber: id };

  const order = await Order.findOne(query);
  if (!order) throw new ApiError(404, "Order not found");
  return ApiResponse(res, 200, "Order fetched successfully", order);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    shippingAddress,
    items,
    deliveryFee,
    discount,
    paymentMethod,
    notes,
  } = req.body as {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    shippingAddress?: unknown;
    items: { product: string; quantity: number }[];
    deliveryFee?: number;
    discount?: number;
    paymentMethod: string;
    notes?: string;
  };

  const productIds = items.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productById = new Map(products.map((p) => [p.id, p]));

  const orderItems: IOrderItem[] = items.map((item) => {
    const product = productById.get(item.product);
    if (!product) {
      throw new ApiError(422, `Product not found: ${item.product}`);
    }
    return {
      product: product._id as mongoose.Types.ObjectId,
      title: product.title,
      image: product.featureImage,
      sku: product.sku,
      price: product.discountPrice ?? product.price,
      quantity: item.quantity,
    };
  });

  const order = await Order.create({
    customerName,
    customerPhone,
    customerEmail,
    shippingAddress,
    items: orderItems,
    deliveryFee,
    discount,
    paymentMethod,
    notes,
  });

  return ApiResponse(res, 201, "Order created successfully", order);
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  const { orderStatus, paymentStatus, notes } = req.body;

  if (orderStatus !== undefined) order.orderStatus = orderStatus;
  if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
  if (notes !== undefined) order.notes = notes;

  await order.save();

  return ApiResponse(res, 200, "Order updated successfully", order);
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  return ApiResponse(res, 200, "Order deleted successfully");
});
