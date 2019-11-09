const { admin, db } = require("../utils/admin");
const firebase = require("firebase");
const config = require("../hanlders/config");
const { isEmail, isEmpty, reduceUserDetails } = require("../helpers");
const Busboy = require("busboy");
const path = require("path");
const os = require("os");
const fs = require("fs");
firebase.initializeApp(config);
let token, userId;
exports.signUp = (req, res) => {
  const { email, password, confirmPassword, handle } = req.body;
  let errors = {};
  if (isEmpty(email)) {
    errors.email = "Must not be empty";
  } else if (!isEmail(email)) {
    errors.email = "Must be a valid email address";
  }

  if (isEmpty(password)) {
    errors.password = "Must not be empty";
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = "Password Must Match";
  }
  if (isEmpty(handle)) {
    errors.password = "Must not be empty";
  }
  //let valid = Object.keys(errors) === 0 ? true : false;
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  let noImg = "noimage.png";
  const newUser = {
    email,
    password,
    confirmPassword,
    handle
  };
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: "This handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();

      // return res
      //   .status(201)
      //   .json({ msg: `user ${data.user.uid} sign up successfully` });
    })
    .then(_token => {
      token = _token;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        created: new Date().toISOString(),
        userId,
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.json({ token });
    })
    .catch(err => {
      //auth/wrong password
      // auth/user-not-user
      if (err.code == "auth/email-already-in-use") {
        return res.status(400).json({ email: "Email already in use" });
      }

      return res
        .status(500)
        .json({ general: "Something went wrong please try again" });
    });
};

exports.logIn = (req, res) => {
  const { email, password } = req.body;
  const user = {
    email,
    password
  };
  let errors = {};
  if (isEmpty(password)) {
    errors.password = "Must not be empty";
  }
  if (!isEmail(email)) {
    errors.email = "Enter a valid email";
  }
  if (isEmpty(email)) {
    errors.email = "Must not be empty";
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }
  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.json({ token });
    })
    .catch(err => {
      if (err.code === "auth/wrong-password") {
        return res.status(403).json({ general: "Invalid credentials " });
      }
      console.log(err);
      return res.status(500).json({ error: err.code });
    });
};

//add addUserDetails
exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);
  // console.log(userDetails);

  db.doc(`/users/${req.user.handle}`)
    .update(userDetails)
    .then(() => {
      return res.json({ message: "Details added successfully " });
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.uploadImage = (req, res) => {
  const busboy = new Busboy({ headers: req.headers });
  let imageFileName;
  let imageToBeUploaded = {};
  busboy.on("file", (fieldName, file, fileName, encoding, mimeType) => {
    if (
      mimeType !== "image/jpeg" &&
      mimeType !== "image/jpg" &&
      mimeType !== "image/png"
    ) {
      return res.status(400).json({ error: "Wrong file type submited" });
    }
    // console.log({ fieldName, fileName, mimeType });

    const imageExtension = fileName.split(".")[fileName.split(".").length - 1];
    imageFileName = `${Math.round(Math.random() * 12365478)}.${imageExtension}`;
    const filePath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filePath, mimeType };
    //console.log(imageToBeUploaded);

    file.pipe(fs.createWriteStream(filePath));
  });
  busboy.on("finish", () => {
    //console.log("on finish");

    admin
      .storage()
      .bucket("gs://socialmediaapp-441ba.appspot.com")
      .upload(imageToBeUploaded.filePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimeType
          }
        }
      })
      .then(() => {
        //console.log("uploading");

        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`users/${req.user.handle}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ msg: "Image Uploaded successfully" });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
  busboy.end(req.rawBody);
};

exports.getAuthUser = (req, res) => {
  let userData = {};
  db.doc(`users/${req.user.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection("likes")
          .where("userHandle", "==", req.user.handle)
          .get();
      }
    })
    .then(data => {
      userData.likes = [];
      data.forEach(doc => {
        userData.likes.push(doc.data());
      });
      return db
        .collection("/notifications")
        .where("recipient", "==", req.user.handle)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();
    })
    .then(data => {
      userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          screamId: doc.data().screamId,
          read: doc.data().read,
          type: doc.data().type,
          notificationId: doc.id
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.log(err);

      return res.status(500).json({ error: err.code });
    });
};

exports.getUserDetails = (req, res) => {
  let userData = {};
  let handle = req.params.handle;
  db.doc(`users/${handle}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "User not found" });
      }
      userData.user = doc.data();
      return db
        .collection("screams")
        .where("userHandle", "==", handle)
        .orderBy("createdAt", "desc")
        .get();
    })
    .then(data => {
      userData.screams = [];
      data.forEach(doc => {
        userData.screams.push({
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          createdAt: doc.data().createdAt,
          screamId: doc.id
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: err.code });
    });
};
exports.markNotificationsRead = (req, res) => {
  let batch = db.batch();

  req.body.forEach(notificationId => {
    const notification = db.doc(`/notifications/${notificationId}`);

    batch.update(notification, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.json({ message: "Notifications mark read" });
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: err.code });
    });
};
