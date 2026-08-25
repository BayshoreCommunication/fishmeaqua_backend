import { Router } from "express";
import authRoutes from "./auth.route";
import userRoutes from "./user.route";
import categoryRoutes from "./category.route";
import productRoutes from "./product.route";
import orderRoutes from "./order.route";
import reviewRoutes from "./review.route";
import customerRoutes from "./customer.route";
import messagesRoutes from "./messages.route";
import dashboardRoutes from "./dashboard.route";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check API health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is healthy" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/customers", customerRoutes);
router.use("/messages", messagesRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
