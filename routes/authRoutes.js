const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Announcement = require("../models/Announcement");

function generateToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
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
    console.error(error);

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
    console.error(error);

    return res.status(401).json({
      success: false,
      message: "Token yaroqsiz yoki muddati tugagan",
    });
  }
});

// ================= DELETE ACCOUNT =================

router.delete("/delete-account", async (req, res) => {
  try {
    // Tokenni tekshirish
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Tizimga kirish talab qilinadi",
      });
    }

    const token = authHeader.split(" ")[1];

    // Tokenni tasdiqlash
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.userId;

    // Foydalanuvchini tekshirish
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi",
      });
    }

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
