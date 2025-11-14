// server.js
const express = require("express");
const path = require("path");
const moment = require("moment-timezone");
const { createBooking, getBookings, deleteBooking, checkConflict, autoCancelNoShows } = require("./google_calendar");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Root route - serve index.html explicitly
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get all bookings
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
app.post("/api/bookings", async (req, res) => {
  try {
    const { roomName, startTime, duration, userEmail, nNumber } = req.body;
    
    // Verify it's an @nyu.edu email
    if (!userEmail.endsWith("@nyu.edu")) {
      return res.status(403).json({ error: "Must use @nyu.edu email" });
    }
    
    // Validate N number format (N followed by 8 digits)
    if (!/^N\d{8}$/.test(nNumber)) {
      return res.status(400).json({ error: "Invalid N number format. Must be N followed by 8 digits (e.g., N12345678)" });
    }
    
    // The browser sends datetime-local as "2025-11-14T17:35" (no timezone)
    // We need to interpret this AS New York time
    const startMoment = moment.tz(startTime, "America/New_York");
    const endMoment = startMoment.clone().add(duration, 'minutes');
    
    // Check for conflicts
    const conflict = await checkConflict(roomName, startMoment.toISOString(), endMoment.toISOString());
    
    if (conflict) {
      const conflictStart = new Date(conflict.start.dateTime);
      const conflictEnd = new Date(conflict.end.dateTime);
      return res.status(409).json({ 
        error: `This room is already booked from ${conflictStart.toLocaleTimeString()} to ${conflictEnd.toLocaleTimeString()}. Please choose a different time.` 
      });
    }
    
    const booking = await createBooking(
      `${roomName} - Booked`,
      `Study room booking`,
      startMoment.toISOString(),
      endMoment.toISOString(),
      userEmail,
      nNumber
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
    const { nNumber } = req.body;
    
    // Validate N number format
    if (!/^N\d{8}$/.test(nNumber)) {
      return res.status(400).json({ error: "Invalid N number format" });
    }
    
    await deleteBooking(eventId, nNumber);
    res.json({ success: true });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

// Auto-cancel no-shows every 5 minutes
setInterval(async () => {
  console.log("🔍 Checking for no-show bookings...");
  await autoCancelNoShows();
}, 5 * 60 * 1000); // Every 5 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Auto-cancellation service active`);
});