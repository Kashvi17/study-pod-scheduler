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
const createBooking = async (summary, description, startTime, endTime, userEmail, nNumber) => {
  try {
    const event = {
      summary,
      description: `${description}\n\nBooked by: ${userEmail}\nN Number: ${nNumber}`,
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
          bookedBy: userEmail,
          nNumber: nNumber // Store N number for verification
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

// Delete a booking (only if N number matches)
const deleteBooking = async (eventId, nNumber) => {
  try {
    // First, get the event to check ownership
    const event = await calendar.events.get({
      calendarId,
      eventId,
    });
    
    const bookedByNNumber = event.data.extendedProperties?.private?.nNumber;
    
    if (bookedByNNumber !== nNumber) {
      throw new Error("You can only delete your own bookings. N number does not match.");
    }
    
    await calendar.events.delete({ calendarId, eventId });
    console.log("✅ Booking deleted:", eventId);
    return true;
  } catch (err) {
    console.error("❌ Error deleting booking:", err);
    throw err;
  }
};

// Check for time slot conflicts
const checkConflict = async (roomName, startTime, endTime) => {
  try {
    const bookings = await getBookings(startTime, endTime);
    
    // Check if any booking overlaps with the requested time for the same room
    const conflict = bookings.find(booking => {
      const bookingStart = new Date(booking.start.dateTime);
      const bookingEnd = new Date(booking.end.dateTime);
      const requestStart = new Date(startTime);
      const requestEnd = new Date(endTime);
      
      // Check if it's the same room and times overlap
      const isSameRoom = booking.summary.includes(roomName);
      const overlaps = (requestStart < bookingEnd && requestEnd > bookingStart);
      
      return isSameRoom && overlaps;
    });
    
    return conflict;
  } catch (err) {
    console.error("❌ Error checking conflicts:", err);
    throw err;
  }
};

// Auto-cancel bookings if no show (15+ minutes past start time)
const autoCancel NoShows = async () => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const bookings = await getBookings(oneHourAgo.toISOString(), now.toISOString());
    
    for (const booking of bookings) {
      const start = new Date(booking.start.dateTime);
      const end = new Date(booking.end.dateTime);
      const fifteenMinAfterStart = new Date(start.getTime() + 15 * 60 * 1000);
      
      // If it's past 15 minutes after start and before end time, cancel it
      if (now > fifteenMinAfterStart && now < end) {
        console.log(`Auto-cancelling no-show booking: ${booking.id}`);
        await calendar.events.delete({ calendarId, eventId: booking.id });
      }
    }
  } catch (err) {
    console.error("❌ Error auto-cancelling no-shows:", err);
  }
};

module.exports = {
  createBooking,
  getBookings,
  deleteBooking,
  checkConflict,
  autoCancelNoShows,
};