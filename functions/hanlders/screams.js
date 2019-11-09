const { db } = require("../utils/admin");

exports.getAllScreams = (req, res) => {
  db.collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let screams = [];
      data.forEach(doc => {
        screams.push({
          screamId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          userImage: doc.data().userImage
        });
      });
      return res.json(screams);
    })
    .catch(err => console.log(err));
};
exports.postOneScream = (req, res) => {
  const { body } = req.body;
  const newScream = {
    body,
    userHandle: req.user.handle,
    createdAt: new Date().toISOString(),
    userImage: req.user.imageUrl,
    likeCount: 0,
    commentCount: 0
  };

  db.collection("screams")
    .add(newScream)
    .then(doc => {
      const resScream = newScream;
      resScream.screamId = doc.id;
      return res.json(resScream);
    })
    .catch(err => {
      console.log(err);
      return res.status(500).send("server Error");
    });
};

//fetch one scream
exports.getScream = (req, res) => {
  let screamData = {};
  let id = req.params.id;
  //console.log(id);

  db.doc(`screams/${id}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      screamData = doc.data();
      screamData.screamId = doc.id;
      // console.log(screamData);

      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("screamId", "==", id)
        .get();
    })
    .then(docs => {
      screamData.comments = [];
      docs.forEach(doc => {
        screamData.comments.push(doc.data());
      });
      // console.log(screamData.comments);

      return res.json(screamData);
    })
    .catch(err => {
      console.log(err);

      return res.status(500).json({ error: err.code });
    });
};

//add one scream
exports.addCommentOnScream = (req, res) => {
  const { body } = req.body;
  const screamId = req.params.id;
  if (body.trim() === "") {
    return res.status(400).json({ comment: "must not be empty" });
  }
  const newComment = {
    body,
    createdAt: new Date().toISOString(),
    screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };
  db.doc(`screams/${screamId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      return res.json(newComment);
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: "Something went wrong" });
    });
};

exports.likeScream = async (req, res) => {
  const id = req.params.id;
  let likeDocument = await db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", id)
    .limit(1);

  let screamDocument = await db.doc(`/screams/${id}`);

  let screamData;

  screamDocument
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream does not exists" });
      }
      // console.log(doc.data());

      screamData = doc.data();
      screamData.screamId = doc.id;

      return likeDocument.get();
    })
    .then(data => {
      if (!data.empty) {
        return res.status(400).json({ error: "scream Already liked" });
      }
      return db
        .collection("likes")
        .add({
          screamId: id,
          userHandle: req.user.handle
        })
        .then(() => {
          screamData.likeCount++;
          return screamDocument.update({ likeCount: screamData.likeCount });
        })
        .then(() => {
          return res.json(screamData);
        })
        .catch(err => {
          console.log(err);
          return res.status(500).json({ error: err, code });
        });
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: err, code });
    });
};
exports.unlikeScream = (req, res) => {
  const id = req.params.id;
  //console.log(req.user);
  //console.log(id);

  let likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", id)
    .limit(1);

  let screamDocument = db.doc(`/screams/${id}`);

  let screamData;

  screamDocument
    .get()
    .then(doc => {
      // console.log(doc);

      if (!doc.exists) {
        return res.status(404).json({ error: "Scream does not exists" });
      } else {
        screamData = doc.data();
        screamData.screamId = doc.id;

        return likeDocument.get();
      }
    })
    .then(data => {
      //console.log(data.docs.data());
      //console.log(data);

      if (data.empty) {
        return res.status(400).json({ error: "scream not liked" });
      }
      return db
        .doc(`/likes/${data.docs[0].id}`)
        .delete()
        .then(() => {
          screamData.likeCount--;
          screamDocument.update({ likeCount: screamData.likeCount });
        })
        .then(() => {
          return res.json(screamData);
        });
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.deleteScream = (req, res) => {
  const id = req.params.id;

  const document = db.doc(`/screams/${id}`);

  document
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }

      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      return document.delete().then(() => {
        return res.json({ message: "Scream deleted successfully" });
      });
    })

    .catch(err => {
      console.log(err);
      return res.status(500).json({ error: err.code });
    });
};
