const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Update leaderboard when user stats change
async function updateLeaderboard(userId) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return;
  
  const userData = userDoc.data();
  
  await db.collection('leaderboard').doc(userId).set({
    userId,
    name: userData.name || userData.email.split('@')[0],
    points: userData.totalPoints || 0,
    co2Saved: userData.totalCO2Saved || 0,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// Calculate streak based on action dates
function calculateStreak(actions) {
  if (actions.length === 0) return 0;
  
  const sortedActions = [...actions].sort((a, b) => 
    b.timestamp.toDate() - a.timestamp.toDate()
  );
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  // Check if today has an action
  const todayAction = sortedActions.find(action => {
    const actionDate = action.timestamp.toDate();
    actionDate.setHours(0, 0, 0, 0);
    return actionDate.getTime() === currentDate.getTime();
  });
  
  if (todayAction) streak = 1;
  
  // Check previous days
  for (let i = todayAction ? 1 : 0; i < sortedActions.length; i++) {
    currentDate.setDate(currentDate.getDate() - 1);
    
    const actionDate = sortedActions[i].timestamp.toDate();
    actionDate.setHours(0, 0, 0, 0);
    
    if (actionDate.getTime() === currentDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// When new action is logged
exports.onActionCreated = functions.firestore
  .document('actions/{actionId}')
  .onCreate(async (snap, context) => {
    const actionData = snap.data();
    const userId = actionData.userId;
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    const lastActionDate = userData.lastActionDate?.toDate();
    
    // Calculate new streak
    const actionsSnapshot = await db.collection('actions')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get();
    
    const actions = actionsSnapshot.docs.map(doc => doc.data());
    const streak = calculateStreak(actions);
    
    // Update user stats
    await userRef.update({
      totalPoints: admin.firestore.FieldValue.increment(actionData.points),
      totalCO2Saved: admin.firestore.FieldValue.increment(actionData.co2Saved),
      streak,
      lastActionDate: actionData.timestamp
    });
    
    // Update leaderboard
    await updateLeaderboard(userId);
    
    // Check for badge achievements
    await checkForBadges(userId);
  });

// Check and award badges
async function checkForBadges(userId) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return;
  
  const userData = userDoc.data();
  const currentPoints = userData.totalPoints || 0;
  const currentStreak = userData.streak || 0;
  
  const badgesSnapshot = await db.collection('badges').get();
  const userBadgesSnapshot = await db.collection('userBadges')
    .where('userId', '==', userId)
    .get();
  
  const existingBadgeIds = userBadgesSnapshot.docs.map(doc => doc.data().badgeId);
  
  const batch = db.batch();
  let newBadgesCount = 0;
  
  badgesSnapshot.forEach(badgeDoc => {
    const badgeData = badgeDoc.data();
    const meetsRequirements = 
      (badgeData.pointsRequired && currentPoints >= badgeData.pointsRequired) ||
      (badgeData.streakRequired && currentStreak >= badgeData.streakRequired);
    
    if (!existingBadgeIds.includes(badgeDoc.id) && meetsRequirements) {
      const userBadgeRef = db.collection('userBadges').doc();
      batch.set(userBadgeRef, {
        userId,
        badgeId: badgeDoc.id,
        earnedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      newBadgesCount++;
    }
  });
  
  if (newBadgesCount > 0) {
    await batch.commit();
    
    // Send notification about new badges
    const newBadges = badgesSnapshot.docs
      .filter(doc => !existingBadgeIds.includes(doc.id))
      .map(doc => doc.data().name);
    
    await db.collection('notifications').add({
      userId,
      type: 'badge',
      message: `You earned new badges: ${newBadges.join(', ')}`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Generate personalized eco tips
exports.generateEcoTips = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'Authentication required'
    );
  }
  
  const userId = context.auth.uid;
  
  // Get user's recent actions
  const actionsSnapshot = await db.collection('actions')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  const recentActions = actionsSnapshot.docs.map(doc => doc.data().type);
  
  // Get tips not recently done by user
  let tipsQuery = db.collection('ecoTips').limit(5);
  
  if (recentActions.length > 0) {
    tipsQuery = db.collection('ecoTips')
      .where('category', 'not-in', recentActions)
      .limit(5);
  }
  
  const tipsSnapshot = await tipsQuery.get();
  
  if (tipsSnapshot.empty) {
    return { suggestions: [] };
  }
  
  const suggestions = tipsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  return { suggestions };
});

// Daily leaderboard update
exports.dailyLeaderboardUpdate = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    const usersSnapshot = await db.collection('users').get();
    
    const updatePromises = usersSnapshot.docs.map(async (userDoc) => {
      await updateLeaderboard(userDoc.id);
    });
    
    await Promise.all(updatePromises);
    console.log('Leaderboard updated for all users');
  });

// User registration handler
exports.onUserCreated = functions.auth.user()
  .onCreate(async (user) => {
    await db.collection('users').doc(user.uid).set({
      email: user.email,
      name: user.email.split('@')[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      totalPoints: 0,
      totalCO2Saved: 0,
      streak: 0,
      lastActionDate: null,
      profileImage: ''
    });
    
    // Add welcome badge
    const welcomeBadge = await db.collection('badges')
      .where('name', '==', 'Green Starter')
      .limit(1)
      .get();
    
    if (!welcomeBadge.empty) {
      await db.collection('userBadges').add({
        userId: user.uid,
        badgeId: welcomeBadge.docs[0].id,
        earnedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });