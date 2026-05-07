import sharp from "sharp";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import client from "../config/openAI.js";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "virtual-tryon",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);

        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

const getImageFromUrl = async (url) => {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  let buffer = Buffer.from(response.data);

  const isAvif = url.toLowerCase().includes(".avif");

  if (isAvif) {
    buffer = await sharp(buffer).png().toBuffer();
  }

  return {
    buffer,
    filename: isAvif ? "clothes.png" : "clothes.jpg",
    mime: isAvif ? "image/png" : "image/jpeg",
  };
};

export const generateVirtualTryOn = async ({ personFile, clothesUrl }) => {
  const clothesImage = await getImageFromUrl(clothesUrl);

  const result = await client.images.edit({
    model: "gpt-image-1",

    image: [
      new File([personFile.buffer], personFile.originalname || "person.jpg", {
        type: personFile.mimetype || "image/jpeg",
      }),

      new File([clothesImage.buffer], clothesImage.filename, {
        type: clothesImage.mime,
      }),
    ],

    prompt: `
      Create an ultra realistic virtual fashion try-on image.

      STRICT REQUIREMENTS:
      - First image is the REAL USER
      - Preserve EXACT SAME face identity
      - Do NOT change face
      - Keep original hairstyle and skin tone
      - Second image is the clothing item
      - User must naturally wear the clothing
      - Preserve realistic body proportions
      - Realistic shadows and folds
      - Ecommerce fashion photography
      - Output must look like a real photo
    `,

    size: "1024x1024",
  });

  const base64 = result.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error("Failed to generate image");
  }

  const outputBuffer = Buffer.from(base64, "base64");

  const uploaded = await uploadBufferToCloudinary(outputBuffer);

  return {
    imageUrl: uploaded.secure_url,
    publicId: uploaded.public_id,
  };
};
