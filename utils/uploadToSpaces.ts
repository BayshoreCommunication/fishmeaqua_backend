import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import { spacesClient } from "../config/spaces";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

const WEBP_QUALITY = 80;
const MAX_IMAGE_DIMENSION = 2000;

// Converts any image buffer (jpeg, png, gif, webp, ...) to webp.
export const convertToWebp = (buffer: Buffer): Promise<Buffer> =>
  sharp(buffer, { animated: true })
    .rotate() // respect EXIF orientation from phone photos
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

// Images become webp; non-image files (e.g. PDF review attachments) are left untouched.
const prepareFile = async (
  file: Express.Multer.File
): Promise<{ body: Buffer; ext: string; contentType: string }> => {
  if (!file.mimetype.startsWith("image/")) {
    return {
      body: file.buffer,
      ext: path.extname(file.originalname),
      contentType: file.mimetype,
    };
  }

  try {
    const body = await convertToWebp(file.buffer);
    return { body, ext: ".webp", contentType: "image/webp" };
  } catch {
    throw new ApiError(422, "Uploaded image is invalid or corrupted");
  }
};

export const uploadToSpaces = async (
  file: Express.Multer.File,
  subfolder = ""
): Promise<string> => {
  const { body, ext, contentType } = await prepareFile(file);
  const key = [env.doSpaces.folder, subfolder, `${randomUUID()}${ext}`]
    .filter(Boolean)
    .join("/");

  await spacesClient.send(
    new PutObjectCommand({
      Bucket: env.doSpaces.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  return `${env.doSpaces.cdnUrl}/${key}`;
};

export const deleteFromSpaces = async (fileUrl?: string): Promise<void> => {
  if (!fileUrl || !fileUrl.startsWith(env.doSpaces.cdnUrl)) return;

  const key = fileUrl.replace(`${env.doSpaces.cdnUrl}/`, "");
  // Old jpg/png images may also have a webp copy created for API responses.
  const webpCopyKey = key.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, ".webp");
  const keys = webpCopyKey === key ? [key] : [key, webpCopyKey];

  await Promise.all(
    keys.map((Key) =>
      spacesClient.send(
        new DeleteObjectCommand({ Bucket: env.doSpaces.bucket, Key })
      )
    )
  );
};
