import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<string> => {
  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(env.mongoUri);
  return conn.connection.host;
};
