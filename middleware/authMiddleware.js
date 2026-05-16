const firebaseAdmin = require('../firebaseAdmin'); // rename to avoid conflict
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

let db;
const setDb = (database) => { db = database; };

// ✅ Protect routes – verify Firebase ID token
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Received token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('Token verified for:', decoded.email);
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name };
    next();
  } catch (error) {
    console.error('Verification error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
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