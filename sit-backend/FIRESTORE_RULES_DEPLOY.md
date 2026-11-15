# Firestore Security Rules Deployment Guide

## Problem
Employees are getting "Missing or insufficient permissions" errors when trying to update task status (Mark as Taken / Mark as Done).

## Solution
Two rule files have been created:

1. **`firestore.rules`** - Full version with role-based access control (recommended for production)
2. **`firestore.rules.simple`** - Simplified version that works immediately without role checks (use this if the full version doesn't work)

### Full Version (`firestore.rules`)
- **Employees** to update `status` and `completed` fields for tasks assigned to them or to "all"
- **Managers/Admins** to create, update, and delete any task
- **All authenticated users** to read tasks they have access to
- Requires user role to be stored in `users` collection

### Simple Version (`firestore.rules.simple`)
- **Any authenticated user** can update `status` and `completed` for tasks assigned to their email or "all"
- Works immediately without requiring role checks
- Less secure but functional for testing/development

## How to Deploy

### Quick Fix (Use Simple Rules - Recommended First)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `smart-inventory-tracker-65588`
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules.simple` file
5. Paste it into the rules editor
6. Click **Publish**
7. Test - employees should now be able to update tasks

### Option 1: Using Firebase CLI

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in the project** (if not already done):
   ```bash
   cd sit-backend
   firebase init firestore
   ```
   - Select "Use an existing project"
   - Choose your project: `smart-inventory-tracker-65588`
   - When asked about firestore.rules, say "Yes" and it will use the existing file

4. **Deploy the simple rules first** (to fix the issue quickly):
   ```bash
   # Copy simple rules to main file temporarily
   cp firestore.rules.simple firestore.rules
   firebase deploy --only firestore:rules
   ```

5. **Or deploy the full rules** (after ensuring user documents exist):
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 2: Using Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `smart-inventory-tracker-65588`
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules.simple` (for quick fix) or `firestore.rules` (for full version)
5. Paste it into the rules editor
6. Click **Publish**

## Verify the Rules

After deploying, test by:
1. Logging in as an employee
2. Trying to mark a task as "Taken" or "Done"
3. The operation should now succeed without permission errors

## Important Notes

- The rules check the user's role from the `users` collection using the authenticated user's UID
- Employees can only update `status` and `completed` fields
- All other task fields (title, description, assignedToEmail, etc.) remain protected for employees
- Managers and Admins have full access to all task operations

## Troubleshooting

If you still get permission errors after deploying:
1. Verify the user's role is correctly stored in the `users` collection
2. Check that the user document ID matches the Firebase Auth UID (not email)
3. Ensure the `role` field exists and has the correct value ('employee', 'manager', or 'admin')
4. Verify that the task's `assignedToEmail` field matches the employee's email address
5. Check the browser console for detailed error messages
6. In Firebase Console, go to Firestore Database → Rules → Simulator to test the rules

## Testing Rules in Firebase Console

1. Go to Firebase Console → Firestore Database → Rules
2. Click on "Rules Playground" or "Simulator"
3. Test with:
   - Location: `tasks/{taskId}`
   - Authenticated: Yes
   - User ID: Your employee's UID
   - Operation: Update
   - Data: `{status: "Taken", completed: false}`
4. Check if the rule passes or fails

