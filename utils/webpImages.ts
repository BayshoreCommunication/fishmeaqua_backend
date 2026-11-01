import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { spacesClient } from "../config/spaces";
import { env } from "../config/env";
import { convertToWebp } from "./uploadToSpaces";

// Images in Spaces that are not webp yet (old uploads stored in the DB as jpg/png/...).
const CONVERTIBLE_EXT = /\.(jpe?g|png|gif|tiff?|avif)$/i;
// How long a response may wait for missing webp copies before falling back.
const MAX_WAIT_MS = 2500;
const CONCURRENCY = 6;

const cdnPrefix = () => `${env.doSpaces.cdnUrl}/`;

const isConvertible = (value: string): boolean =>
  value.startsWith(cdnPrefix()) && CONVERTIBLE_EXT.test(value);

// "<cdn>/folder/products/abc.jpg" -> "<cdn>/folder/products/abc.webp"
export const toWebpUrl = (url: string): string =>
  isConvertible(url) ? url.replace(CONVERTIBLE_EXT, ".webp") : url;

const webpKeyOf = (url: string): string =>
  url.slice(cdnPrefix().length).replace(CONVERTIBLE_EXT, ".webp");

// Keys of webp copies that exist in Spaces (cached per server instance).
const ready = new Set<string>();
const inFlight = new Map<string, Promise<boolean>>();
let readyLoaded: Promise<void> | null = null;

// One listing call per instance instead of a HEAD request per image.
const loadReady = (): Promise<void> => {
  if (!readyLoaded) {
    readyLoaded = (async () => {
      let token: string | undefined;
      do {
        const page = await spacesClient.send(
          new ListObjectsV2Command({
            Bucket: env.doSpaces.bucket,
            Prefix: `${env.doSpaces.folder}/`,
            ContinuationToken: token,
          })
        );
        page.Contents?.forEach(({ Key }) => {
          if (Key?.endsWith(".webp")) ready.add(Key);
        });
        token = page.NextContinuationToken;
      } while (token);
    })().catch((err) => {
      console.error("[webp] could not list Spaces:", err.message);
      readyLoaded = null; // retry on the next response
    });
  }
  return readyLoaded;
};

const createWebpCopy = async (url: string): Promise<boolean> => {
  const key = url.slice(cdnPrefix().length);
  const webpKey = webpKeyOf(url);
  try {
    const original = await spacesClient.send(
      new GetObjectCommand({ Bucket: env.doSpaces.bucket, Key: key })
    );
    const buffer = Buffer.from(await original.Body!.transformToByteArray());
    await spacesClient.send(
      new PutObjectCommand({
        Bucket: env.doSpaces.bucket,
        Key: webpKey,
        Body: await convertToWebp(buffer),
        ContentType: "image/webp",
        ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    ready.add(webpKey);
    return true;
  } catch (err) {
    console.error(`[webp] could not convert ${key}:`, (err as Error).message);
    return false;
  }
};

// Simple queue so a big product list doesn't fire dozens of downloads at once.
const queue: Array<() => void> = [];
let running = 0;
const runQueued = <T>(task: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < CONCURRENCY) start();
    else queue.push(start);
  });

const ensureWebp = (url: string): Promise<boolean> => {
  let pending = inFlight.get(url);
  if (!pending) {
    pending = runQueued(() => createWebpCopy(url)).finally(() =>
      inFlight.delete(url)
    );
    inFlight.set(url, pending);
  }
  return pending;
};

const collectUrls = (value: unknown, found: Set<string>): void => {
  if (typeof value === "string") {
    if (isConvertible(value)) found.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectUrls(item, found));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectUrls(item, found));
  }
};

const replaceUrls = (value: unknown, urls: Set<string>): unknown => {
  if (typeof value === "string") {
    return urls.has(value) && ready.has(webpKeyOf(value))
      ? toWebpUrl(value)
      : value;
  }
  if (Array.isArray(value)) return value.map((item) => replaceUrls(item, urls));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, replaceUrls(v, urls)])
    );
  }
  return value;
};

/**
 * Returns a plain copy of `data` where every non-webp image URL from Spaces is
 * swapped for its webp version. Missing webp copies are created with sharp in
 * the background; if one isn't ready within MAX_WAIT_MS the original URL is
 * kept for that response only, so a response is never slow or broken.
 */
export const withWebpImages = async <T>(data: T): Promise<T> => {
  if (data === null || data === undefined) return data;

  // Same serialization res.json does (runs mongoose toJSON, etc.).
  const plain = JSON.parse(JSON.stringify(data));
  const urls = new Set<string>();
  collectUrls(plain, urls);
  if (urls.size === 0) return plain;

  await loadReady();

  const missing = [...urls].filter((url) => !ready.has(webpKeyOf(url)));
  if (missing.length > 0) {
    await Promise.race([
      Promise.all(missing.map(ensureWebp)),
      new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS)),
    ]);
  }

  return replaceUrls(plain, urls) as T;
};
