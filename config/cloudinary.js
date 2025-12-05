import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

// Ensure environment variables are loaded even if this module is imported
// before the application's main dotenv.config() call.
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;
