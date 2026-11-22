const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Announcement = require("../models/Announcement");

// ================= GENERATE TOKEN =================

function generateToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

// ================= AUTH MIDDLEWARE =================

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Tizimga kirish talab qilinadi",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("_id");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Foydalanuvchi topilmadi",
      });
    }

    req.userId = user._id;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token yaroqsiz yoki muddati tugagan",
    });
  }
}

// ================= REGISTER =================

router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        message: "Barcha maydonlarni to'ldiring",
      });
    }

    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Bu raqam allaqachon ro'yxatdan o'tgan",
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      phone,
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Register xatosi:", error);

    return res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
});

// ================= GET PROFILE =================

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token mavjud emas",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select(
      "firstName lastName phone createdAt",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profil olish xatosi:", error);

    return res.status(401).json({
      success: false,
      message: "Token yaroqsiz yoki muddati tugagan",
    });
  }
});

// ================= DELETE ONE ANNOUNCEMENT =================

router.delete("/announcement/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "E'lon ID noto'g'ri",
      });
    }

    // Faqat foydalanuvchining o'z e'lonini topamiz
    const announcement = await Announcement.findOne({
      _id: id,
      user: req.userId,
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "E'lon topilmadi yoki sizga tegishli emas",
      });
    }

    // E'lonni MongoDB'dan o'chiramiz
    await Announcement.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "E'lon muvaffaqiyatli o'chirildi",
    });
  } catch (error) {
    console.error("E'lonni o'chirish xatosi:", error);

    return res.status(500).json({
      success: false,
      message: "E'lonni o'chirishda server xatosi",
    });
  }
});

// ================= DELETE ACCOUNT =================

router.delete("/delete-account", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Foydalanuvchining barcha e'lonlarini o'chirish
    await Announcement.deleteMany({
      user: userId,
    });

    // Foydalanuvchi profilini o'chirish
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "Profil va unga tegishli e'lonlar muvaffaqiyatli o'chirildi",
    });
  } catch (error) {
    console.error("Profilni o'chirish xatosi:", error);

    return res.status(500).json({
      success: false,
      message: "Profilni o'chirishda server xatosi",
    });
  }
});

module.exports = router;
