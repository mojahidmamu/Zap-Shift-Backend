const mongoose = require('mongoose');

const riderApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  vehicleType: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  experienceYears: { type: String, required: true },
  availableHours: { type: String, required: true },
  emergencyContactName: { type: String },
  emergencyContact: { type: String },
  nidFile: { type: String }, // store file path or URL
  licenseFile: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String }
});

module.exports = mongoose.model('RiderApplication', riderApplicationSchema);