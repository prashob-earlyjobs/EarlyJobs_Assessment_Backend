// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minLength: [2, 'Name must be at least 2 characters'],
    maxLength: [50, 'Name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
      'Please enter a valid email address'
    ]
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [
      /^[0-9]{10}$/,
      'Please enter a valid 10-digit mobile number'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minLength: [6, 'Password must be at least 6 characters'],
    match: [
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{6,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    ],
    select: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows null values and maintains uniqueness for non-null values
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  avatar: {
    type: String,
    default: ''
  },
  profile: {
    bio: {
      type: String,
      trim: true,
      maxLength: [500, 'Bio cannot exceed 500 characters']
    },
    resumeUrl: {
      type: String,
      trim: true,
      match: [
        /^https?:\/\/.+/,
        'Please provide a valid URL for resume'
      ]
    },
    skills: [{
      type: String,
      trim: true,
      minLength: [2, 'Skill name must be at least 2 characters'],
      maxLength: [30, 'Skill name cannot exceed 30 characters']
    }],
    experience: [{
      title: {
        type: String,
        required: [true, 'Job title is required'],
        trim: true,
        minLength: [2, 'Job title must be at least 2 characters'],
        maxLength: [100, 'Job title cannot exceed 100 characters']
      },
      company: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true,
        minLength: [2, 'Company name must be at least 2 characters'],
        maxLength: [100, 'Company name cannot exceed 100 characters']
      },
      location: {
        type: String,
        trim: true,
        maxLength: [100, 'Location cannot exceed 100 characters']
      },
      from: {
        type: Date,
        required: [true, 'Start date is required'],
        validate: {
          validator: function(value) {
            return value <= new Date();
          },
          message: 'Start date cannot be in the future'
        }
      },
      to: {
        type: Date,
        validate: {
          validator: function(value) {
            if (!value) return true; // Allow null for current jobs
            return value >= this.from;
          },
          message: 'End date must be after start date'
        }
      },
      current: {
        type: Boolean,
        default: false
      },
      description: {
        type: String,
        trim: true,
        maxLength: [1000, 'Description cannot exceed 1000 characters']
      }
    }],
    education: [{
      institution: {
        type: String,
        required: [true, 'Institution name is required'],
        trim: true,
        minLength: [2, 'Institution name must be at least 2 characters'],
        maxLength: [100, 'Institution name cannot exceed 100 characters']
      },
      degree: {
        type: String,
        required: [true, 'Degree is required'],
        trim: true,
        minLength: [2, 'Degree must be at least 2 characters'],
        maxLength: [100, 'Degree cannot exceed 100 characters']
      },
      fieldOfStudy: {
        type: String,
        required: [true, 'Field of study is required'],
        trim: true,
        maxLength: [100, 'Field of study cannot exceed 100 characters']
      },
      year: {
        type: Number,
        required: [true, 'Year is required'],
        min: [1950, 'Year must be after 1950'],
        max: [new Date().getFullYear(), 'Year cannot be in the future']
      }
    }],
    preferences: {
      jobType: {
        type: String,
        enum: {
          values: ['full-time', 'part-time', 'contract', 'internship'],
          message: '{VALUE} is not a valid job type'
        }
      },
      location: {
        type: String,
        trim: true,
        maxLength: [100, 'Location cannot exceed 100 characters']
      },
      expectedSalary: {
        min: {
          type: Number,
          min: [0, 'Minimum salary cannot be negative']
        },
        max: {
          type: Number,
          validate: {
            validator: function(value) {
              return !this.expectedSalary.min || value >= this.expectedSalary.min;
            },
            message: 'Maximum salary must be greater than minimum salary'
          }
        }
      }
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Modify password encryption to handle Google users
userSchema.pre('save', async function(next) {
  // Skip password encryption for Google users
  if (this.authProvider === 'google') {
    next();
    return;
  }

  if (!this.isModified('password')) {
    next();
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Update password comparison to handle Google users
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (this.authProvider === 'google') {
    return false; // Google users can't use password login
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add method to handle Google profile
userSchema.statics.findOrCreateGoogleUser = async function(googleProfile) {
  try {
    // Try to find existing user
    let user = await this.findOne({ googleId: googleProfile.id });

    if (!user) {
      // Try to find user by email
      user = await this.findOne({ email: googleProfile.email });

      if (user) {
        // Link Google ID to existing account
        user.googleId = googleProfile.id;
        user.authProvider = 'google';
        await user.save();
      } else {
        // Create new user
        user = await this.create({
          googleId: googleProfile.id,
          name: googleProfile.displayName,
          email: googleProfile.email,
          avatar: googleProfile.picture,
          authProvider: 'google',
          isEmailVerified: true // Google emails are verified
        });
      }
    }

    return user;
  } catch (error) {
    throw error;
  }
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
