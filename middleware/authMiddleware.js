const firebaseAdmin = require('../firebaseAdmin'); // ✅ rename

// 🔐 Protect middleware
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// 👑 Admin middleware
const admin = async (req, res, next) => {
  if (req.user.email === 'abdullahallmojahidstudent@gmail.com') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

module.exports = { protect, admin };