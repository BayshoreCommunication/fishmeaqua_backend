import { Router } from "express";
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
} from "../controllers/category.controller";
import { protect, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import {
  createCategoryRules,
  updateCategoryRules,
} from "../validators/category.validator";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Product category management
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List categories
 *     description: >
 *       Without `page`, returns every category as a plain array. Passing
 *       `page` returns a paginated object ({categories, total, page, limit,
 *       totalPages}) with `parent` populated as {_id, name, slug}, and enables
 *       the `limit`, `search` and `isActive` filters.
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Switches the response to paginated mode
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive name and slug search (paginated mode only)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by status (paginated mode only)
 *     responses:
 *       200:
 *         description: Categories fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   oneOf:
 *                     - type: array
 *                       items:
 *                         $ref: '#/components/schemas/Category'
 *                     - type: object
 *                       properties:
 *                         categories:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Category'
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *   post:
 *     summary: Create a category (manager/admin/superadmin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CategoryInput'
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Not permitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       409:
 *         description: Category name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       422:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router
  .route("/")
  .get(getCategories)
  .post(
    protect,
    authorize("manager", "admin", "superadmin"),
    upload.single("image"),
    createCategoryRules,
    validate,
    createCategory
  );

/**
 * @swagger
 * /categories/stats:
 *   get:
 *     summary: Category counts (manager/admin/superadmin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     inactive:
 *                       type: integer
 *                     subcategories:
 *                       type: integer
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Not permitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router
  .route("/stats")
  .get(protect, authorize("manager", "admin", "superadmin"), getCategoryStats);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get a category by id
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *   patch:
 *     summary: Update a category (manager/admin/superadmin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CategoryInput'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Not permitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       422:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *   delete:
 *     summary: Delete a category (manager/admin/superadmin only)
 *     description: Fails with 409 if the category has subcategories.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Not permitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       409:
 *         description: Category has subcategories
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router
  .route("/:id")
  .get(getCategory)
  .patch(
    protect,
    authorize("manager", "admin", "superadmin"),
    upload.single("image"),
    updateCategoryRules,
    validate,
    updateCategory
  )
  .delete(protect, authorize("manager", "admin", "superadmin"), deleteCategory);

export default router;
