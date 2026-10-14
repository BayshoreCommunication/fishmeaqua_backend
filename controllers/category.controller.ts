import type { Request, Response } from "express";
import { Category } from "../models/category.model";
import { Product } from "../models/product.model";
import { asyncHandler } from "../middleware/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { uploadToSpaces, deleteFromSpaces } from "../utils/uploadToSpaces";

const activeProductCounts = async (categoryIds?: unknown[]) => {
  const match: Record<string, unknown> = { isActive: true };
  if (categoryIds) match.category = { $in: categoryIds };
  const counts = await Product.aggregate<{ _id: unknown; productCount: number }>([
    { $match: match },
    { $group: { _id: "$category", productCount: { $sum: 1 } } },
  ]);
  return new Map(
    counts.map(({ _id, productCount }) => [String(_id), productCount]),
  );
};

// Without `page`, returns every category as a plain array — the storefront
// and the product form dropdowns rely on that. Passing `page` (the dashboard
// list) switches to a paginated, searchable response with the parent populated
// so its name is available even when the parent sits on another page.
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.query.page === undefined) {
      const [categories, countsByCategory] = await Promise.all([
        Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
        activeProductCounts(),
      ]);
      const categoriesWithCounts = categories.map((category) => ({
        ...category,
        productCount: countsByCategory.get(String(category._id)) ?? 0,
      }));

      return ApiResponse(
        res,
        200,
        "Categories fetched successfully",
        categoriesWithCounts,
      );
    }

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20),
    );
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }
    if (req.query.search) {
      const escapedSearch = String(req.query.search)
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (escapedSearch) {
        const searchPattern = { $regex: escapedSearch, $options: "i" };
        filter.$or = [{ name: searchPattern }, { slug: searchPattern }];
      }
    }

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .populate("parent", "name slug")
        .sort({ sortOrder: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter),
    ]);
    const countsByCategory = await activeProductCounts(
      categories.map((c) => c._id),
    );

    return ApiResponse(res, 200, "Categories fetched successfully", {
      categories: categories.map((category) => ({
        ...category,
        productCount: countsByCategory.get(String(category._id)) ?? 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  },
);

// Catalog-wide counts for the dashboard stat cards — independent of whichever
// page of the list is loaded.
export const getCategoryStats = asyncHandler(
  async (req: Request, res: Response) => {
    const [total, active, subcategories] = await Promise.all([
      Category.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Category.countDocuments({ parent: { $ne: null } }),
    ]);

    return ApiResponse(res, 200, "Category stats fetched successfully", {
      total,
      active,
      inactive: total - active,
      subcategories,
    });
  },
);

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found");
  return ApiResponse(res, 200, "Category fetched successfully", category);
});

export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description, parent, isActive, sortOrder } = req.body;

    if (parent) {
      const parentExists = await Category.exists({ _id: parent });
      if (!parentExists) throw new ApiError(422, "Parent category not found");
    }

    const image = req.file ? await uploadToSpaces(req.file, "categories") : "";

    const category = await Category.create({
      name,
      description,
      image,
      parent: parent || null,
      isActive,
      sortOrder,
    });

    return ApiResponse(res, 201, "Category created successfully", category);
  },
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw new ApiError(404, "Category not found");

    const { name, description, parent, isActive, sortOrder } = req.body;

    if (parent) {
      if (parent === req.params.id) {
        throw new ApiError(422, "A category cannot be its own parent");
      }
      const parentExists = await Category.exists({ _id: parent });
      if (!parentExists) throw new ApiError(422, "Parent category not found");
    }

    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (parent !== undefined) category.parent = parent || null;
    if (isActive !== undefined) category.isActive = isActive;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;

    if (req.file) {
      const previousImage = category.image;
      category.image = await uploadToSpaces(req.file, "categories");
      if (previousImage) await deleteFromSpaces(previousImage);
    }

    await category.save();

    return ApiResponse(res, 200, "Category updated successfully", category);
  },
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const hasChildren = await Category.exists({ parent: req.params.id });
    if (hasChildren) {
      throw new ApiError(
        409,
        "Cannot delete a category that has subcategories",
      );
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) throw new ApiError(404, "Category not found");

    if (category.image) {
      await deleteFromSpaces(category.image);
    }

    return ApiResponse(res, 200, "Category deleted successfully");
  },
);
