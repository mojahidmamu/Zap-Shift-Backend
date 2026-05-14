// models/Parcel.js
const mongoose = require('mongoose');

const parcelSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parcelType: { type: String, enum: ['document', 'non-document'], required: true },
    weight: { type: Number, required: true },
    documentName: { type: String },
    parcelName: { type: String },
    sender: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        region: { type: String, required: true },
        district: { type: String, required: true },
        address: { type: String, required: true },
        pickupInstruction: { type: String, required: true },
    },
    receiver: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        region: { type: String, required: true },
        district: { type: String, required: true },
        address: { type: String, required: true },
        deliveryInstruction: { type: String, required: true },
    },
    cost: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Parcel', parcelSchema);