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

const INVALID_PERSON_IMAGE_MESSAGE =
  "Invalid image: the uploaded file must be a photo containing a person.";

const assertPersonImage = async (personFile) => {
  const mime = personFile.mimetype || "image/jpeg";
  const dataUrl = `data:${mime};base64,${personFile.buffer.toString("base64")}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You validate images for a virtual clothing try-on feature.

Answer YES only if the image clearly shows at least one real human (a normal photograph of a person). Answer NO if it is: only clothing/product on a hanger or flat lay with no visible person, only mannequins without a real person, cartoons or illustrations only, landscapes, animals only, text-only, abstract art, or you cannot confidently see a real person.

Reply with exactly one word: YES or NO.`,
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    max_tokens: 5,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const answer = raw.toUpperCase();
  const isPerson = /^\s*YES\b/.test(answer) || /\bYES\b/.test(answer);

  if (!isPerson) {
    const err = new Error(INVALID_PERSON_IMAGE_MESSAGE);
    err.code = "INVALID_PERSON_IMAGE";
    err.statusCode = 400;
    throw err;
  }
};

export const generateVirtualTryOn = async ({ personFile, clothesUrl }) => {
  await assertPersonImage(personFile);

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
    Fashion outfit replacement.
    
    Use the first image as the base photo.
    Keep the person's face, hairstyle, pose, background, and image framing unchanged.
    DO NOT crop or zoom.
    Keep full body inside frame.
    Preserve face/body exactly.
    The person must be fully visible from head to toe.
    No cropping of head, feet, or hands.
    
    Replace the outfit using the clothing from the second image.
    
    The final result should look like a realistic fashion catalog photo with natural lighting and realistic fabric details.
    `,
    size: "auto",
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
