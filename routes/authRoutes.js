const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  getMe,
  updateProfile,
  completeProfile,
  isUserLoggedIn,
  refreshToken,
  userLogout,
  verifyFranchiseId,
  resetPassword,
  generateAndSendOtp,
  verifyOtp,
  getColleges,
  updateBankDetails,
} = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");


const router = express.Router();

// Validation rules
const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("mobile")
    .isMobilePhone()
    .withMessage("Please provide a valid mobile number"),
  body("experienceLevel")
    .isIn(["fresher", "experienced"])
    .withMessage("Invalid experience level"),
  body("role")
    .optional()
    .isIn(["candidate", "recruiter", "super_admin", "franchise_admin"])
    .withMessage("Invalid role"),
];

const loginValidation = [
  body("emailormobile")
    .trim()
    .notEmpty()
    .withMessage("Email or mobile number is required")
    .custom((value) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isMobile = /^\d{10}$/.test(value); // Accepts mobile numbers with 5 or more digits
      if (!isEmail && !isMobile) {
        throw new Error("Please provide a valid email or mobile number");
      }
      return true;
    }),

   body("otp") 
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isNumeric()
    .withMessage("OTP must be a number")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits long")
];

// Auth routes
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/me", authMiddleware, getMe);
router.get("/is-logged-in", authMiddleware, isUserLoggedIn); // Alias for getMe
router.put("/update-profile", authMiddleware, updateProfile);
router.put("/complete-profile", authMiddleware, completeProfile); // get from onboarding form details route
router.put("/update-bank-details", authMiddleware, updateBankDetails);
router.post("/refresh-token", refreshToken);
router.get("/verifyFranchiseId/:franchiseId", verifyFranchiseId);
router.patch("/reset-password/:userId", resetPassword);
router.get("/colleges", authMiddleware, getColleges);

router.post("/send-otp", generateAndSendOtp);
router.post("/verify-otp", verifyOtp);

router.post("/logout", authMiddleware, userLogout);

module.exports = router;
