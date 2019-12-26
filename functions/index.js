const functions = require("firebase-functions");
const express = require("express");
const { db } = require("./utils/admin");
const cors = require("cors");
const {
  getAllScreams,
  postOneScream,
  getScream,
  addCommentOnScream,
  likeScream,
  unlikeScream,
  deleteScream
} = require("./hanlders/screams");
const {
  signUp,
  logIn,
  uploadImage,
  addUserDetails,
  getAuthUser,
  getUserDetails,
  markNotificationsRead
} = require("./hanlders/users");
const { fbAuth } = require("./middleware/fbAuth");

const app = express();
app.use(cors());

//getting the screams
app.get("/screams", getAllScreams);
//creating a scream
app.post("/scream", fbAuth, postOneScream);
app.delete("/scream/:id", fbAuth, deleteScream);
app.get("/scream/:id", getScream);
app.post("/scream/:id/comment", fbAuth, addCommentOnScream);
app.get("/scream/:id/like", fbAuth, likeScream);
app.get("/scream/:id/unlike", fbAuth, unlikeScream);
// Sign up route
app.post("/signup", signUp);
//sign in route
app.post("/login", logIn);
//upload photos
app.post("/user/image", fbAuth, uploadImage);

app.post("/user", fbAuth, addUserDetails);

app.get("/user", fbAuth, getAuthUser);

//get user details
app.get("/user/:handle", getUserDetails);
//notification
app.post("/notifications", fbAuth, markNotificationsRead);

exports.api = functions.https.onRequest(app);
//exports.api = functions.region("asia-northeast1").https.onRequest(app);
exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate((snapshot, context) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            read: false,
            screamId: doc.id,
            type: "like"
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });

exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate((snapshot, context) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            read: false,
            screamId: doc.id,
            type: "comment"
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });

exports.deleteNotificationOnUnlike = functions.firestore
  .document("/likes/{id}")
  .onDelete((snapshot, context) => {
    db.doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => {
        console.log(err);
      });
  });

exports.onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate((change, context) => {
    // console.log(change.before.data());
    // console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      // console.log("image has changed");
      let batch = db.batch();
      return db
        .collection("screams")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then(data => {
          //  console.log("1");

          data.forEach(doc => {
            console.log("2");

            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          // console.log("3");

          return batch.commit();
        });
    } else {
      // console.log("4");

      return true;
    }
  });

exports.onScreamDelete = functions.firestore
  .document("/screams/{screamId}")
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("screamId", "==", screamId)
      .get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection("likes")
          .where("screamId", "==", screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("screamId", "==", screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch(err => {
        console.log(err);
      });
  });
