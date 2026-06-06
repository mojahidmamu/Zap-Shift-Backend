const firebaseAdmin = require('../firebaseAdmin');  
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

let db;
const setDb = (database) => { db = database; };

// ✅ Protect routes – verify Firebase ID token
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No token",
      });
    }

    // Verify Firebase Token
    const decoded = await firebaseAdmin
      .auth()
      .verifyIdToken(token);

    // Find user from MongoDB using email
    const user = await db
      .collection("users")
      .findOne({
        email: decoded.email,
      });

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    req.user = user;

    next();

  } catch (err) {
    console.error(err);

    res.status(401).json({
      message: "Unauthorized",
    });
  }
};

// ✅ Admin middleware – check if user is admin (by email or custom logic)
const admin = async (req, res, next) => {
  if (req.user.email === process.env.ADMIN_EMAIL) {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

module.exports = { setDb, protect, admin };