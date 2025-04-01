const cron = require("node-cron");
const seatController = require("../controllers/seatController");

// Run the seat release job at midnight daily
cron.schedule("0 0 * * *", async () => {
  console.log("🔄 Running seat auto-release job...");
  await seatController.autoReleaseExpiredSeats();
});
