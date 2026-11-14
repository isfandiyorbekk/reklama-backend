const express = require("express");
const router = express.Router();
const User = require("../models/User");

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
        message: "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      phone,
    });

    res.status(201).json({
      success: true,
      message: "Ro'yxatdan o'tish muvaffaqiyatli!",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Serverda xatolik yuz berdi",
    });
  }
});

module.exports = router;
