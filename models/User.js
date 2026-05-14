const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    role: {
    type: String,
    enum: ['user', 'admin', 'rider'],
    default: 'user'
    }, 
    name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phone: {
    type: String,
    default: '',
  },
  address: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'rider'],
    default: 'user',
  },
  isRider: {
    type: Boolean,
    default: false,
  },
  riderStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'none'],
    default: 'none',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);