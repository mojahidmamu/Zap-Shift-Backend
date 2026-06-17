const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { ObjectId } = require('mongodb');

// MongoDB collections (set from server.js)
let riderAppCollection, userCollection;

const setCollections = (riderCol, userCol) => {
  riderAppCollection = riderCol;
  userCollection = userCol;
};

// ✅ 1. Apply for Rider
router.post('/apply', protect, async (req, res) => {
  try {
    const {
      fullName,
      phone,
      address,
      city,
      vehicleType,
      licenseNumber,
      experienceYears,
      availableHours,
      emergencyContactName,
      emergencyContact
    } = req.body;

    // check existing application
   const existing = await riderAppCollection.findOne({
    userId: req.user._id.toString(),
    status: { $in: ['pending', 'approved'] }
  });

    if (existing) {
      return res.status(400).json({
        message: 'You already have an active application'
      });
    }

    const newApplication = {
      userId: req.user._id.toString(),
      email: req.user.email,
      fullName: fullName || req.user.name,
      phone,
      address,
      city,
      vehicleType,
      licenseNumber,
      experienceYears,
      availableHours,
      emergencyContactName,
      emergencyContact,
      status: 'pending',
      appliedAt: new Date()
    };

    await riderAppCollection.insertOne(newApplication);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Server error, try again later'
    });
  }
});

// ✅ 2. Get all applications (Admin only)
router.get('/applications', protect, admin, async (req, res) => {
  try {
    const { status } = req.query;

    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const applications = await riderAppCollection
      .find(filter)
      .sort({ appliedAt: -1 })
      .toArray();

    res.json(applications);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ 3. Approve / Reject application (Admin)
router.put('/applications/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const application = await riderAppCollection.findOne({
      _id: new ObjectId(id)
    });

    if (!application) {
      return res.status(404).json({
        message: 'Application not found'
      });
    }

    // update application
    await riderAppCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          reviewedAt: new Date(),
          reviewedBy: req.user._id.toString(),
          ...(status === 'rejected' && { rejectionReason })
        }
      }
    );

    // update user rider status
    if (status === 'approved') {
      await userCollection.updateOne(
        { _id: new ObjectId(application.userId) },
        {
          $set: {
            isRider: true,
            riderStatus: 'approved'
          }
        }
      );
    } else if (status === 'rejected') {
      await userCollection.updateOne(
        { _id: new ObjectId(application.userId) },
        {
          $set: {
            riderStatus: 'rejected'
          }
        }
      );
    }

    res.json({
      success: true,
      message: `Application ${status}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get logged-in rider's own application
router.get('/my-application', protect, async (req, res) => {
  try {
    const application = await riderAppCollection.findOne({
      userId: req.user._id.toString()
    });
    if (!application) {
      return res.status(404).json({ message: 'No application found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
 

// PUT update parcel status (rider)
// router.put('/api/parcels/:id/status', protect, async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;
//   await parcelCollection.updateOne(
//     { _id: new ObjectId(id), riderId: req.user._id.toString() },
//     { $set: { status } }
//   );
//   res.json({ success: true });
// });

// // ✅ Get parcels assigned to the logged‑in rider
// router.get('/my-parcels', protect, async (req, res) => {
//   try {
//     const riderId = req.user._id.toString(); // from protect middleware
//     const parcels = await parcelCollection.find({ riderId }).toArray();
//     res.json(parcels);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

module.exports = { riderRoutes: router, setCollections };