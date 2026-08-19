import { body, type ValidationChain } from "express-validator";
import { PHONE_REGEX } from "../models/user.model";

export const signupRules: ValidationChain[] = [
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Please enter a valid email address"),
  body("phone")
    .optional({ checkFalsy: true })
    .matches(PHONE_REGEX)
    .withMessage("Please enter a valid phone number"),
  body("avatar")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Avatar must be a valid URL"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body().custom((_value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Either email or phone is required");
    }
    return true;
  }),
];

export const signinRules: ValidationChain[] = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Email or phone is required"),
  body("password").notEmpty().withMessage("Password is required"),
];
