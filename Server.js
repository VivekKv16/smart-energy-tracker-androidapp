// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Replace this with your actual MongoDB connection string
mongoose.connect('mongodb+srv://vivekkvacharya:W8E3PAlrtRXuAuVG@volts.5yg3wvg.mongodb.net/billPower?retryWrites=true&w=majority&appName=volts', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const device1Schema = new mongoose.Schema({
  powerUsed: Number,
  price: Number,
  month: Number,
  year: Number,
  sessionId: String
});
const device2Schema = new mongoose.Schema({
  powerUsed: Number,
  price: Number,
  month: Number,
  year: Number,
  sessionId: String
});

//const latest1Schema = new mongoose.Schema({
//  powerUsed: Number,
//  price: Number,
//  month: Number,
//  year: Number
//});
//
//const latest2Schema = new mongoose.Schema({
//  powerUsed: Number,
//  price: Number,
//  month: Number,
//  year: Number
//});

const Device1Bill = mongoose.model('Device1Bill', device1Schema, 'device1Bill');
const Device2Bill = mongoose.model('Device2Bill', device2Schema, 'device2Bill');

//const Latest1Bill = mongoose.model('Latest1Bill', latest1Schema, 'latest1Bill');
//const Latest2Bill = mongoose.model('Latest2Bill', latest2Schema, 'latest2Bill');

app.post('/bill/device1', async (req, res) => {
  const { powerUsed, price, sessionId } = req.body;

  try {
    // Delete previous entry of this session
    await Device1Bill.deleteMany({ sessionId });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const newEntry = await Device1Bill.create({ powerUsed, price, month, year, sessionId });

    res.status(200).send('Device 1 bill stored for session');
  } catch (error) {
    res.status(500).send(error.message);
  }
});



app.post('/bill/device2', async (req, res) => {
  const { powerUsed, price, sessionId } = req.body;

  try {
    // Delete previous entry of this session
    await Device2Bill.deleteMany({ sessionId });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const newEntry = await Device2Bill.create({ powerUsed, price, month, year, sessionId });

    res.status(200).send('Device 2 bill stored for session');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

//app.post('/new/device1', async (req, res) => {
//   console.log("latest1");
//
//   try {
//     console.log("database try1");
//     const latestEntry = await Device1Bill.findOne().sort({ _id: -1 });
//
//     if (!latestEntry) {
//       return res.status(404).send('No entries found in device1Bill');
//     }
//
//     await Latest1Bill.create({
//       powerUsed: latestEntry.powerUsed,
//       price: latestEntry.price,
//       month: latestEntry.month,
//       year: latestEntry.year
//     });
//
//     res.status(200).send('Latest Device 1 bill stored');
//   } catch (error) {
//     res.status(500).send(error.message);
//   }
// });
//
//app.post('/new/device2', async (req, res) => {
//  console.log("latest2");
//
//  try {
//    console.log("database try2");
//    const latestEntry = await Device2Bill.findOne().sort({ _id: -1 });
//
//    if (!latestEntry) {
//      return res.status(404).send('No entries found in device2Bill');
//    }
//
//    console.log('Inserting into Latest1Bill:', latestEntry);
//    await Latest2Bill.create({
//      powerUsed: latestEntry.powerUsed,
//      price: latestEntry.price,
//      month: latestEntry.month,
//      year: latestEntry.year
//    });
//    console.log('Insertion successful into Latest1Bill');
//
//    res.status(200).send('Latest Device 2 bill stored');
//  } catch (error) {
//    res.status(500).send(error.message);
//  }
//});

app.post('/bill/device1/monthly', async (req, res) => {
  const { month, year } = req.body;

  try {
    const bills = await Device1Bill.find({ month, year });

    const total = bills.reduce(
      (acc, bill) => ({
        powerUsed: acc.powerUsed + bill.powerUsed,
        price: acc.price + bill.price,
      }),
      { powerUsed: 0, price: 0 }
    );

    res.status(200).json(total);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/bill/device2/monthly', async (req, res) => {
  const { month, year } = req.body;

  try {
    const bills = await Device2Bill.find({ month, year });

    const total = bills.reduce(
      (acc, bill) => ({
        powerUsed: acc.powerUsed + bill.powerUsed,
        price: acc.price + bill.price,
      }),
      { powerUsed: 0, price: 0 }
    );

    res.status(200).json(total);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


const PORT = 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
