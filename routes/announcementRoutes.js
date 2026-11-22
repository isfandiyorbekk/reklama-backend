const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const Announcement = require("../models/Announcement");
const User = require("../models/User");

// =====================================
// TOKEN TEKSHIRISH MIDDLEWARE
// =====================================
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Tizimga kirish talab qilinadi!",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token ichidagi userId orqali foydalanuvchini topamiz
    const user = await User.findById(decoded.userId).select("_id");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Foydalanuvchi topilmadi!",
      });
    }

    req.userId = user._id;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token yaroqsiz yoki muddati tugagan!",
    });
  }
}

// =====================================
// MULTER SOZLAMALARI
// =====================================
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Faqat rasm fayllarini yuklash mumkin!"));
    }
  },
});

// =====================================
// IMGBB GA RASM YUKLASH
// =====================================
async function uploadImageToImgBB(file) {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    throw new Error("IMGBB_API_KEY topilmadi!");
  }

  const base64Image = file.buffer.toString("base64");

  const params = new URLSearchParams();
  params.append("key", apiKey);
  params.append("image", base64Image);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const result = await response.json();

  if (!response.ok || !result.success || !result.data?.url) {
    console.error("ImgBB xatosi:", result);

    throw new Error(
      result?.error?.message || "Rasmni ImgBB ga yuklab bo'lmadi.",
    );
  }

  return result.data.url;
}

// =====================================
// 1. E'LON YARATISH
// =====================================
router.post(
  "/create",
  authMiddleware,
  upload.array("images", 10),
  async (req, res) => {
    try {
      const { title, category, location, description, number } = req.body;

      if (!title || !category || !location || !description || !number) {
        return res.status(400).json({
          success: false,
          message: "Barcha maydonlarni to'ldiring!",
        });
      }

      const files = req.files || [];
      const imageUrls = [];

      for (const file of files) {
        const imageUrl = await uploadImageToImgBB(file);
        imageUrls.push(imageUrl);
      }

      const newAnnouncement = new Announcement({
        title,
        category,
        location,
        description,
        number,
        images: imageUrls,

        // Token orqali aniqlangan foydalanuvchi ID si
        user: req.userId,
      });

      await newAnnouncement.save();

      return res.status(201).json({
        success: true,
        message: "E'lon muvaffaqiyatli joylandi!",
        data: newAnnouncement,
      });
    } catch (error) {
      console.error("E'lon yaratish xatosi:", error.message);

      return res.status(500).json({
        success: false,
        message: "E'lon yaratishda xatolik yuz berdi.",
        error: error.message,
      });
    }
  },
);

// =====================================
// 2. BARCHA E'LONLARNI OLISH
// =====================================
router.get("/all", async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({
      createdAt: -1,
    });

    return res.status(200).json(announcements);
  } catch (error) {
    console.error("E'lonlarni olish xatosi:", error.message);

    return res.status(500).json({
      message: "Ma'lumotlarni olishda xatolik.",
    });
  }
});

// =====================================
// 3. FAQAT KIRGAN FOYDALANUVCHINING E'LONLARI
// =====================================
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const announcements = await Announcement.find({
      user: req.userId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    console.error("Mening e'lonlarim xatosi:", error.message);

    return res.status(500).json({
      success: false,
      message: "E'lonlarni olishda xatolik yuz berdi.",
    });
  }
});

// =====================================
// 4. ID ORQALI BITTA E' LONNI OLISH
// =====================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "E'lon ID noto'g'ri!",
      });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        message: "Bunday e'lon topilmadi!",
      });
    }

    return res.status(200).json({
      message: "E'lon muvaffaqiyatli topildi!",
      data: announcement,
    });
  } catch (error) {
    console.error("Detail Page xatosi:", error.message);

    return res.status(500).json({
      message: "E'lon ma'lumotlarini olishda xatolik!",
      error: error.message,
    });
  }
});

module.exports = router;
