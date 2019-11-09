const admin = require("firebase-admin");
let serviceAccount = require("../serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://socialmediaapp-441ba.firebaseio.com"
});
const db = admin.firestore();
module.exports = { admin, db };
