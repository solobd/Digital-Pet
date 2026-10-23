// pet-care.js — Runs daily via GitHub Actions
// Calculates decay for all pets & sends Telegram reminders

const FIREBASE_URL = process.env.FIREBASE_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

async function fetchAllPets() {
  const res = await fetch(`${FIREBASE_URL}/pets.json`);
  return await res.json();
}

async function updatePet(id, updates) {
  await fetch(`${FIREBASE_URL}/pets/${id}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

async function sendTelegram(chatId, text) {
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

async function main() {
  console.log('🐾 Pet Care started:', new Date().toISOString());
  
  const pets = await fetchAllPets();
  if (!pets) {
    console.log('No pets found');
    return;
  }
  
  const now = Date.now();
  let processedCount = 0;
  let notifiedCount = 0;
  
  for (const [id, pet] of Object.entries(pets)) {
    if (!pet || !pet.name) continue;
    
    const hoursElapsed = (now - (pet.lastUpdated || now)) / (1000 * 60 * 60);
    if (hoursElapsed < 0.1) continue; // Skip if updated recently
    
    // Calculate decay
    const fullness = Math.max(0, Math.min(100, (pet.fullness || 100) - hoursElapsed * 3));
    const happiness = Math.max(0, Math.min(100, (pet.happiness || 100) - hoursElapsed * 2));
    const energy = Math.max(0, Math.min(100, (pet.energy || 100) + hoursElapsed * 5));
    
    let health = pet.health || 100;
    if (fullness <= 0 || happiness <= 0) {
      health = Math.max(0, health - hoursElapsed * 2);
    }
    
    // Update Firebase
    await updatePet(id, {
      fullness: Math.round(fullness * 10) / 10,
      happiness: Math.round(happiness * 10) / 10,
      energy: Math.round(energy * 10) / 10,
      health: Math.round(health * 10) / 10,
      lastUpdated: now
    });
    
    processedCount++;
    
    // Notify if needs attention
    const needsAttention = fullness < 30 || happiness < 30 || health < 50;
    if (needsAttention && pet.chatId) {
      const alertMsg = `${pet.emoji || '🐾'} *${pet.name} needs you!*\n\n` +
        `🍖 Fullness: ${Math.round(fullness)}%\n` +
        `😊 Happiness: ${Math.round(happiness)}%\n` +
        `❤️ Health: ${Math.round(health)}%\n\n` +
        `Open the app to take care of them! 💕`;
      await sendTelegram(pet.chatId, alertMsg);
      notifiedCount++;
    }
  }
  
  console.log(`✅ Processed: ${processedCount} pets | Notified: ${notifiedCount}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
