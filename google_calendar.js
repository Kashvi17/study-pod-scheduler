// google_calendar.js
const { google } = require("googleapis");
require("dotenv").config();

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_KEY);
const calendarId = process.env.CALENDAR_ID;

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({ version: "v3", auth });

// Create a booking
const createBooking = async (summary, description, startTime, endTime, userEmail) => {
  try {
    const event = {
      summary,
      description: `${description}\n\nBooked by: ${userEmail}`,
      start: { 
        dateTime: startTime,
        timeZone: "America/New_York"
      },
      end: { 
        dateTime: endTime,
        timeZone: "America/New_York"
      },
      extendedProperties: {
        private: {
          bookedBy: userEmail
        }
      }
    };
    
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    console.log("✅ Booking created:", res.data.id);
    return res.data;
  } catch (err) {
    console.error("❌ Error creating booking:", err);
    throw err;
  }
};

// Get all bookings for a date range
const getBookings = async (startTime, endTime) => {
  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin: startTime,
      timeMax: endTime,
      orderBy: "startTime",
      singleEvents: true,
    });
    return res.data.items || [];
  } catch (err) {
    console.error("❌ Error getting bookings:", err);
    throw err;
  }
};

// Delete a booking (only if user owns it)
const deleteBooking = async (eventId, userEmail) => {
  try {
    // First, get the event to check ownership
    const event = await calendar.events.get({
      calendarId,
      eventId,
    });
    
    const bookedBy = event.data.extendedProperties?.private?.bookedBy;
    
    if (bookedBy !== userEmail) {
      throw new Error("You can only delete your own bookings");
    }
    
    await calendar.events.delete({ calendarId, eventId });
    console.log("✅ Booking deleted:", eventId);
    return true;
  } catch (err) {
    console.error("❌ Error deleting booking:", err);
    throw err;
  }
};

module.exports = {
  createBooking,
  getBookings,
  deleteBooking,
};