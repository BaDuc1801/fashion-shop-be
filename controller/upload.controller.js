import cloudinary from "../config/cloudinary.js";

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "products" }, (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      })
      .end(buffer);
  });
};

export const uploadImage = async (req, res) => {
  try {
    const files = req.files;

    const urls = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer))
    );

    res.json({ urls });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
