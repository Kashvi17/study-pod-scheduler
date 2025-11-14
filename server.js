// server.js
const express = require("express");
const path = require("path");
const { createBooking, getBookings, deleteBooking } = require("./google_calendar");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Fixed this line

// Root route - serve index.html explicitly
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get all bookings for today
app.get("/api/bookings", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 7); // Next 7 days
    
    const bookings = await getBookings(todayStart.toISOString(), todayEnd.toISOString());
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new booking
// Create a new booking
app.post("/api/bookings", async (req, res) => {
  try {
    const { roomName, startTime, duration, userEmail } = req.body;
    
    // Verify it's an @nyu.edu email
    if (!userEmail.endsWith("@nyu.edu")) {
      return res.status(403).json({ error: "Must use @nyu.edu email" });
    }
    
    // Treat the datetime-local input as Eastern Time
    // Add timezone offset for New York (EST is -05:00, EDT is -04:00)
    // For now using -05:00 (you may need -04:00 during daylight saving)
    const startWithTZ = startTime + ":00-05:00";
    const startDate = new Date(startWithTZ);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    
    const booking = await createBooking(
      `${roomName} - Booked`,
      `Study room booking`,
      startDate.toISOString(),
      endDate.toISOString(),
      userEmail
    );
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a booking
app.delete("/api/bookings/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userEmail } = req.body;
    
    await deleteBooking(eventId, userEmail);
    res.json({ success: true });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});