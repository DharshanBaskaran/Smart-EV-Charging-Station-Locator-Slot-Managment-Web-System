const auth = require('./middleware/auth');
console.log('Auth middleware keys:', Object.keys(auth));

try {
  console.log('Requiring referrals.js...');
  require('./routes/referrals');
  console.log('referrals.js loaded.');
} catch (e) {
  console.error('Failed to load referrals.js:', e);
}

try {
  console.log('Requiring owner.js...');
  require('./routes/owner');
  console.log('owner.js loaded.');
} catch (e) {
  console.error('Failed to load owner.js:', e);
}

try {
  console.log('Requiring fleet.js...');
  require('./routes/fleet');
  console.log('fleet.js loaded.');
} catch (e) {
  console.error('Failed to load fleet.js:', e);
}

try {
  console.log('Requiring chat.js...');
  require('./routes/chat');
  console.log('chat.js loaded.');
} catch (e) {
  console.error('Failed to load chat.js:', e);
}

console.log('Finished testing route requirements.');
