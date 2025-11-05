const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./config/database");
const errorHandler = require("./middlewares/errorHandler");

// Route imports

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const resultRoutes = require("./routes/resultRoutes");
const adminRoutes = require("./routes/adminRoutes");
const webhookRoutes = require("./routes/webhook");
const createOrder = require("./routes/payment");
const authMiddleware = require("./middlewares/authMiddleware");
const tranctions = require("./routes/transactions");
const offerRoutes = require("./routes/offerRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const examRoutes = require("./routes/exam.route");
const teamRoutes=require('./routes/teamRoutes');
const browseCandidateRoutes = require("./routes/browseCandidateRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const candidateRoutes= require("./routes/candidateRoutes");

//const resumeRoutes =require("./routes/resumeRoutes");

// const profileRoutes = require('./routes/profileRoutes');

const app = express();

// Connect to MongoDB
connectDB();
app.use(
  cors({
    origin: [
      "https://earlyjobs.ai",
      "http://localhost:8080",
      "https://www.earlyjobs.ai",
      "https://early-jobs-assessment-frontend-5n6w4951x-earlyjobs-projects.vercel.app",
      "https://www.earlyjobs.in",
      "https://earlyjobs.in",
      "https://dev2.earlyjobs.in",
      "https://www.dev2.earlyjobs.in",
      "https://franchise.earlyjobs.in",
      "https://www.franchise.earlyjobs.in",
      "http://localhost:3000",
      "https://nextjs.earlyjobs.ai",
      "https://dev.earlyjobs.ai",
      "https://portal.earlyjobs.ai",
      "https://qa-portal.earlyjobs.ai"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400, // 24 hours in seconds
  })
);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data sanitization
app.use(xss());

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Cookie parser
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/getOrderIdForPayment", authMiddleware, createOrder);
app.use("/api/transactions", tranctions);
app.use("/api/offers", offerRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/exam", examRoutes);
app.use("/api", otpRoutes);
app.use("/api", resumeRoutes);
app.use("/api/browseCandidates", browseCandidateRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/candidate", candidateRoutes);

//app.use("/api/resume", resumeRoutes);
// app.use('/api/results', resultRoutes);
// app.use('/api/profile', profileRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EarlyJobs API is running",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 EarlyJobs server running on port ${PORT}`);
});

module.exports = app;
