const firebaseAdmin = require('../firebaseAdmin');
const { ObjectId } = require('mongodb');

let db;
const setDb = (database) => { db = database; };

// ✅ Protect – verify Firebase token and attach user from DB
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify Firebase ID token
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Find the user in your MongoDB (collection name: "users")
    const user = await db.collection('users').findOne({ email: decoded.email });
    if (!user) {
      return res.status(401).json({ message: 'User not found in database' });
    }

    // Attach the full user document (including _id, role, etc.)
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// ✅ Admin – simply check `req.user.role`
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

module.exports = { setDb, protect, admin };