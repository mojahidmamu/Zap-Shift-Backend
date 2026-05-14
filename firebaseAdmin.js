// firebaseAdmin.js
const admin = require('firebase-admin');

// You need a service account key from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./zapshift.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;