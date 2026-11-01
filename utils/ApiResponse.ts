import type { Response } from "express";
import { withWebpImages } from "./webpImages";

// Every image URL in the response is served as webp, whatever format is stored in the DB.
export const ApiResponse = async <T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T | null = null
) => {
  return res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data: await withWebpImages(data),
  });
};
