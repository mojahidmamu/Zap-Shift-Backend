// routes/parcelRoutes.js
const express = require('express');
const Parcel = require('../models/Parcel');
const authMiddleware = require('../middleware/auth'); // protect routes
const router = express.Router();

// POST /api/parcels – create a new parcel
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user; // from auth middleware
        const parcelData = { ...req.body, userId };
        const parcel = new Parcel(parcelData);
        await parcel.save();
        res.status(201).json({ success: true, parcel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/parcels/my – get all parcels of logged-in user
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const parcels = await Parcel.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json({ success: true, parcels });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/parcels/:id – get single parcel
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const parcel = await Parcel.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!parcel) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, parcel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;