
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minLength: [2, "Name must be at least 2 characters"],
      maxLength: [50, "Name cannot exceed 50 characters"],
      match: [/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
        "Please enter a valid email address",
      ],
    },
    role: {
      type: String,
      enum: [
        "candidate",
        "recruiter",
        "franchise",
        "super_admin",
        "franchise_admin",
        "ADMIN",
        "FBDE",
        "creator",
      ],
      default: "candidate",
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    referrerId: {
      type: String || null,
      default: null,
    },
    franchiserId: {
      type: mongoose.Schema.Types.ObjectId || null,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    avatar: {
      type: String,
      default: "",
    },
    franchiseId: {
      type: String,
      unique: true,
      sparse: true,
    },
    assessmentsPaid: [
      {
        assessmentId: { type: String, required: true },
        assessmentIdVelox: { type: String, required: true },
        assessmentLink: { type: String, required: true },
        interviewId: { type: String, required: true },
        candidateId: { type: String, required: true },
        linkExpiryTime: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    certificates: [
        {
          type: String,
          
          default:[],
        },
      ],
    inviteLink: {
      type: String,
      unique: true,
      sparse: true,
    },
    profile: {
      college: {
        university: { type: String },
        college: { type: String },
        college_type: { type: String },
        state: { type: String },
        district: { type: String },
      },
      dateOfBirth: {
        type: String,
        validate: {
          validator: function (value) {
            if (!value) return false;
            const birthDate = new Date(value);
            if (isNaN(birthDate.getTime())) return false;
            const today = new Date();
            return birthDate <= today;
          },
          message: "Date of birth cannot be in the future or invalid",
        },
      },
      address: {
        street: {
          type: String,
          trim: true,
          minLength: [2, "Street address must be at least 2 characters"],
          maxLength: [100, "Street address cannot exceed 100 characters"],
        },
        city: {
          type: String,
          trim: true,
          minLength: [2, "City must be at least 2 characters"],
          maxLength: [50, "City cannot exceed 50 characters"],
        },
        state: {
          type: String,
          trim: true,
          minLength: [2, "State must be at least 2 characters"],
          maxLength: [50, "State cannot exceed 50 characters"],
        },
        country: {
          type: String,
          trim: true,
          minLength: [2, "Country must be at least 2 characters"],
          maxLength: [50, "Country cannot exceed 50 characters"],
        },
        zipCode: {
          type: String,
          trim: true,
        },
      },
      professionalInformation: {
        currentJobTitle: {
          type: String,
          trim: true,
          minLength: [2, "Current job title must be at least 2 characters"],
          maxLength: [100, "Current job title cannot exceed 100 characters"],
        },
        experience: {
          type: Number,
          min: [0, "Experience cannot be negative"],
          max: [25, "Experience cannot exceed 25 years"],
        },
        expectedSalaryAnnual: {
          type: Number,
          min: [0, "Expected salary cannot be negative"],
        },
        noticePeriod: {
          type: Number,
          min: [0, "Notice period cannot be negative"],
          max: [365, "Notice period cannot exceed 365 days (12 months)"],
        },
        workMode: {
          type: String,
          enum: ["Onsite", "Remote", "Hybrid"],
          default: "Onsite",
        },
        education: [
          {
            _id: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              default: () => new mongoose.Types.ObjectId(),
            },
            institution: {
              type: String,
              required: [true, "Institution name is required"],
              trim: true,
              minLength: [2, "Institution name must be at least 2 characters"],
              maxLength: [100, "Institution name cannot exceed 100 characters"],
            },
            degree: {
              type: String,
              required: [true, "Degree is required"],
              trim: true,
              minLength: [2, "Degree must be at least 2 characters"],
              maxLength: [100, "Degree cannot exceed 100 characters"],
            },
            fieldOfStudy: {
              type: String,
              trim: true,
              maxLength: [100, "Field of study cannot exceed 100 characters"],
            },
            percentage: {
              type: Number,
              required: [true, "Percentage is required"],
              min: [0, "Percentage cannot be negative"],
              max: [100, "Percentage cannot exceed 100"],
            },
            year: {
              type: Number,
              required: [true, "Year is required"],
              min: [1950, "Year must be after 1950"],
              max: [new Date().getFullYear(), "Year cannot be in the future"],
            },
          },
        ],
      },
      gender: {
        type: String,
        enum: ["Male", "Female", "Other"],
      },
      bio: {
        type: String,
        trim: true,
      },
      preferredJobRole: {
        type: String,
        trim: true,
      },
      resumeUrl: {
        type: String,
        trim: true,
        match: [/^https?:\/\/.+/, "Please provide a valid URL for resume"],
      },
      skills: [
        {
          type: String,
          trim: true,
          minLength: [2, "Skill name must be at least 2 characters"],
          maxLength: [30, "Skill name cannot exceed 30 characters"],
        },
      ],
      prefJobLocations: [
        {
          type: String,
          trim: true,
        },
      ],
      
      experience: [
        {
          title: {
            type: String,
            required: [true, "Job title is required"],
            trim: true,
            minLength: [2, "Job title must be at least 2 characters"],
            maxLength: [100, "Job title cannot exceed 100 characters"],
          },
          company: {
            type: String,
            required: [true, "Company name is required"],
            trim: true,
            minLength: [2, "Company name must be at least 2 characters"],
            maxLength: [100, "Company name cannot exceed 100 characters"],
          },
          from: {
            type: Date,
            required: [true, "Start date is required"],
            validate: {
              validator: function (value) {
                return value <= new Date();
              },
              message: "Start date cannot be in the future",
            },
          },
          to: {
            type: Date,
            validate: {
              validator: function (value) {
                if (!value) return true;
                return value >= this.from;
              },
              message: "End date must be after start date",
            },
          },
          current: {
            type: Boolean,
            default: false,
          },
          description: {
            type: String,
            trim: true,
            maxLength: [1000, "Description cannot exceed 1000 characters"],
          },
        },
      ],
      preferences: {
        jobType: {
          type: String,
          enum: {
            values: ["full-time", "part-time", "contract", "internship"],
            message: "{VALUE} is not a valid job type",
          },
        },
        location: {
          type: String,
          trim: true,
          maxLength: [100, "Location cannot exceed 100 characters"],
        },
        expectedSalary: {
          min: {
            type: Number,
            min: [0, "Minimum salary cannot be negative"],
          },
          max: {
            type: Number,
            validate: {
              validator: function (value) {
                return (
                  !this.expectedSalary.min || value >= this.expectedSalary.min
                );
              },
              message: "Maximum salary must be greater than minimum salary",
            },
          },
        },
      },
    },
    bankAccountDetails: {
      accountHolderName: {
        type: String,
        trim: true,
        maxLength: [100, "Account holder name cannot exceed 100 characters"],
      },
      accountNumber: {
        type: String,
        trim: true,
        match: [/^[0-9]{9,18}$/, "Please enter a valid account number"],
      },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please enter a valid IFSC code"],
      },
      bankName: {
        type: String,
        trim: true,
        maxLength: [100, "Bank name cannot exceed 100 characters"],
      },
      branchName: {
        type: String,
        trim: true,
        maxLength: [100, "Branch name cannot exceed 100 characters"],
      },
      accountType: {
        type: String,
        enum: ["Savings", "Current", "Salary", "Other"],
      },
      panCard: {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Please enter a valid PAN card number"],
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Modify password encryption to handle Google users
userSchema.pre("save", async function (next) {
  if (this.authProvider === "google") {
    next();
    return;
  }

  if (!this.isModified("password")) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Update password comparison to handle Google users
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (this.authProvider === "google") {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add method to handle Google profile
userSchema.statics.findOrCreateGoogleUser = async function (googleProfile) {
  try {
    let user = await this.findOne({ googleId: googleProfile.id });

    if (!user) {
      user = await this.findOne({ email: googleProfile.email });

      if (user) {
        user.googleId = googleProfile.id;
        user.authProvider = "google";
        await user.save();
      } else {
        user = await this.create({
          googleId: googleProfile.id,
          name: googleProfile.displayName,
          email: googleProfile.email,
          avatar: googleProfile.picture,
          authProvider: "google",
          isEmailVerified: true,
        });
      }
    }

    return user;
  } catch (error) {
    throw error;
  }
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model("User", userSchema);