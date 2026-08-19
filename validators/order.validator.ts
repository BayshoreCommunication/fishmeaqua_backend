import { body, type ValidationChain } from "express-validator";
import mongoose from "mongoose";
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../models/order.model";
import { BD_DIVISIONS, DELIVERY_ZONES, PHONE_REGEX } from "../models/user.model";

const isValidObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

export const createOrderRules: ValidationChain[] = [
  body("customerName").trim().notEmpty().withMessage("Customer name is required"),
  body("customerPhone")
    .trim()
    .notEmpty()
    .withMessage("Customer phone is required")
    .matches(PHONE_REGEX)
    .withMessage("Please enter a valid phone number"),
  body("customerEmail")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Please enter a valid email address"),
  body("shippingAddress.division").optional({ checkFalsy: true }).isIn(BD_DIVISIONS),
  body("shippingAddress.district").optional({ checkFalsy: true }).trim(),
  body("shippingAddress.upazila").optional({ checkFalsy: true }).trim(),
  body("shippingAddress.postOffice").optional({ checkFalsy: true }).trim(),
  body("shippingAddress.postCode").optional({ checkFalsy: true }).trim(),
  body("shippingAddress.area").optional({ checkFalsy: true }).trim(),
  body("shippingAddress.zone").optional({ checkFalsy: true }).isIn(DELIVERY_ZONES),
  body("items")
    .isArray({ min: 1 })
    .withMessage("An order must have at least one item"),
  body("items.*.product")
    .custom(isValidObjectId)
    .withMessage("Each item must reference a valid product id"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Each item's quantity must be a positive integer")
    .toInt(),
  body("deliveryFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Delivery fee must be a non-negative number")
    .toFloat(),
  body("discount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount must be a non-negative number")
    .toFloat(),
  body("paymentMethod")
    .isIn(PAYMENT_METHODS)
    .withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`),
  body("notes").optional({ checkFalsy: true }).trim(),
];

export const updateOrderRules: ValidationChain[] = [
  body("orderStatus")
    .optional()
    .isIn(ORDER_STATUSES)
    .withMessage(`Order status must be one of: ${ORDER_STATUSES.join(", ")}`),
  body("paymentStatus")
    .optional()
    .isIn(PAYMENT_STATUSES)
    .withMessage(`Payment status must be one of: ${PAYMENT_STATUSES.join(", ")}`),
  body("notes").optional({ checkFalsy: true }).trim(),
];
