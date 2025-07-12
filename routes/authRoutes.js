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
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .optional()
    .isIn(["candidate", "recruiter", "super_admin", "franchise_admin"])
    .withMessage("Invalid role"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Auth routes
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/me", authMiddleware, getMe);
router.get("/is-logged-in", authMiddleware, isUserLoggedIn); // Alias for getMe
router.put("/update-profile", authMiddleware, updateProfile);
router.put("/complete-profile", authMiddleware, completeProfile); // get from onboarding form details route
router.post("/refresh-token", refreshToken);
router.get("/verifyFranchiseId/:franchiseId", verifyFranchiseId);
router.patch("/reset-password/:userId", authMiddleware, resetPassword);

router.post("/send-otp", generateAndSendOtp);
router.post("/verify-otp", verifyOtp);

router.post("/logout", authMiddleware, userLogout);

module.exports = router;
