const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Triggered when a user document is deleted from Firestore
exports.deleteAuthUser = functions.firestore
    .document("users/{userId}")
    .onDelete((snap, context) => {
        const userId = context.params.userId;
        console.log("Deleting Auth user with UID:", userId);
        
        return admin.auth().deleteUser(userId)
            .then(() => {
                console.log("Successfully deleted user:", userId);
            })
            .catch((error) => {
                console.error("Error deleting user:", error);
            });
    });