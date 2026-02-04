// advice.js
// Gen Z style advice generator and mood board logic

const advices = {
  happy: [
    "Keep slaying, bestie. If you’re feeling down, blast your favorite playlist and remember: you’re the main character. 💅✨",
    "Stay on your grind, but don’t forget to touch grass. 🌱",
    "You’re literally built different. Go flex that energy! 💪",
    "Post a selfie, hype yourself up, and let the haters hate. #Unbothered 😌"
  ],
  sad: [
    "It’s okay to not be okay. Order some boba, binge your comfort show, and let yourself feel. 🧋📺",
    "Text your group chat, someone’s got memes to cheer you up. 🥲",
    "Take a break from doomscrolling and go for a walk. You got this. 🚶‍♂️",
    "Remember: even your favs have off days. Tomorrow’s a reset. 🔄"
  ],
  angry: [
    "Take a deep breath, rage type in your notes, then delete it. Don’t let the drama win. 😤",
    "Channel that energy into a workout or dance break. Release the beast! 🕺",
    "Mute, block, move on. Protect your vibe. 🚫",
    "You’re not toxic, you’re just passionate. But maybe chill for a sec. 😅"
  ],
  neutral: [
    "Sometimes mid is good. Hydrate, scroll TikTok, and vibe. 🥤",
    "No big feels? No big deal. Enjoy the peace. ✌️",
    "You’re in your NPC era. Embrace it. 🎮",
    "Just because it’s quiet doesn’t mean you’re not growing. 🌱"
  ],
  surprised: [
    "Plot twist! React with a meme, then adapt. You’re quick like that. 🤯",
    "Didn’t see that coming? Neither did anyone else. Roll with it. 🎲",
    "Life’s full of jump scares. Stay iconic. 👻",
    "Surprise yourself: try something new today. 🚀"
  ],
  fearful: [
    "Anxiety’s a liar. You’re braver than you think. 🦁",
    "Send a voice note to a friend, even if it’s cringe. You’ll feel better. 🎤",
    "Take a break from the group chat and do some self-care. 🛁",
    "You’ve survived 100% of your worst days. That’s a flex. 💯"
  ],
  unknown: [
    "No mood detected? No problem. You’re a mystery, and that’s cool. 🕵️‍♂️",
    "Sometimes you just vibe in the void. Embrace the chaos. 🌌"
  ]
};

function getNewAdvice() {
  const mood = document.getElementById('lastMood').textContent.toLowerCase();
  const options = advices[mood] || advices['unknown'];
  const advice = options[Math.floor(Math.random() * options.length)];
  document.getElementById('adviceText').textContent = advice;
}

function goToScan() {
  window.location.href = 'scan.html';
}

// Example: update mood board from backend (replace with real API call)
document.addEventListener('DOMContentLoaded', () => {
  // Simulate fetching last mood, confidence, and text
  const moods = ['Happy','Sad','Angry','Neutral','Surprised','Fearful'];
  const mood = moods[Math.floor(Math.random()*moods.length)];
  document.getElementById('lastMood').textContent = mood;
  document.getElementById('lastConfidence').textContent = (80 + Math.random()*20).toFixed(1) + '%';
  document.getElementById('lastText').textContent = '"' + [
    'Feeling lit today!','Not my best day','Why is everyone so extra?','Just chilling','Whoa, plot twist','Lowkey anxious'
  ][Math.floor(Math.random()*6)] + '"';
  document.getElementById('moodTitle').textContent = mood;
  document.getElementById('emoji').textContent = {
    Happy:'😎', Sad:'🥲', Angry:'😡', Neutral:'😐', Surprised:'😲', Fearful:'😨'
  }[mood] || '😶';
  getNewAdvice();
});
