require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { riderRoutes, setCollections } = require("./routes/riderRoutes");
const { setDb, protect, admin } = require("./middleware/authMiddleware");

const app = express();

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://zap-shift-blush.vercel.app"],
    credentials: true,
  }),
);

// middleware
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({
      message: "unautorized access",
    });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unautorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pa6ljqy.mongodb.net/zapShiftDB?retryWrites=true&w=majority`;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function run() {
  try {
    // connect mongodb
    await client.connect();
    console.log("✅ MongoDB Connected Successfully");
    // database + collection
    const database = client.db("zapShiftDB");
    const parcelCollection = database.collection("parcels");
    const userCollection = database.collection("users");
    const riderAppCollection = database.collection("riderApplications");
    const contactCollection = database.collection("contacts");

    // middleware :
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }

      next();
    };

    const { setDb } = require("./middleware/authMiddleware");
    setDb(database);

    // 🔥 Set collections for rider routes
    setCollections(riderAppCollection, userCollection);

    app.use("/api/rider", riderRoutes);

    // user authentication routes
    app.post("/api/auth/register", async (req, res) => {
      try {
        const { name, email, password, phone } = req.body;
        const existing = await userCollection.findOne({ email });
        if (existing)
          return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          name,
          email,
          password: hashedPassword,
          phone: phone || "",
          role: "user",
          isRider: false,
          riderStatus: "none",
          createdAt: new Date(),
        };
        const result = await userCollection.insertOne(newUser);
        const token = jwt.sign(
          { id: result.insertedId },
          process.env.JWT_SECRET,
          { expiresIn: "30d" },
        );
        res.status(201).json({
          token,
          user: { id: result.insertedId, name, email, role: "user" },
        });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.post("/api/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await userCollection.findOne({ email });
        if (!user)
          return res.status(401).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: "30d",
        });
        res.json({
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // user related api:
    app.post("/users", async (req, res) => {
      try {
        const userData = req.body;
        userData.role = userData.role || "user";
        userData.createdAt = new Date();
        // If you have Firebase UID, store it
        // userData.uid = req.body.uid;
        const result = await userCollection.insertOne(userData);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, message: error.message });
      }
    });

    //
    app.get("/users", async (req, res) => {
      try {
        const cursor = userCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ✅ GET all users – Admin only
    app.get("/users", protect, admin, async (req, res) => {
      try {
        // Exclude password field
        const users = await userCollection
          .find({}, { projection: { password: 0 } })
          .toArray();
        res.json(users);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
      }
    });

    app.get("/users/:id", async (req, res) => {});

    app.get(
      "/users/:email/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { email };
        const user = await userCollection.findOne(query);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.send({ role: user?.role || "user " });
      },
    );

    // UPDATE user role (admin only)
    app.patch("/users/:id/role", protect, admin, async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } },
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, message: `Role updated to ${role}` });
    });

    // POST PARCEL
    app.post("/parcels", async (req, res) => {
      try {
        const parcelData = req.body;
        const result = await parcelCollection.insertOne(parcelData);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET ALL PARCELS
    app.get("/parcels", async (req, res) => {
      try {
        const result = await parcelCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET PARCEL BY ID
    app.get("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        // Validate ObjectId format
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid parcel ID" });
        }
        const parcel = await parcelCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        res.json(parcel);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });

    // DELETE PARCEL
    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await parcelCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // UPDATE parcel
    app.put("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        const query = { _id: new ObjectId(id) };
        const result = await parcelCollection.updateOne(query, {
          $set: updatedData,
        });
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });

    // Payment Intent Route
    app.post("/create-checkout-session", async (req, res) => {
      const { parcelId } = req.body;

      const parcel = await parcelCollection.findOne({
        _id: new ObjectId(parcelId),
      });

      const amount = parcel.cost * 100;

      const productName =
        parcel.parcelType === "document"
          ? parcel.documentName
          : parcel.parcelName;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: productName || "Parcel Payment",
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: parcel.userEmail,

        metadata: {
          parcelId: parcelId,
        },

        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?parcelId=${parcelId}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    app.patch("/payment-success/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const transactionId =
          "TXN-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              payment_status: "paid",
              status: "paid",
              transactionId: transactionId, // 🔥 NEW
              paid_at: new Date(),
            },
          },
        );

        res.send({ success: true, transactionId });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: error.message });
      }
    });

    app.get("/my-payments", async (req, res) => {
      const email = req.query.email;

      const result = await parcelCollection
        .find({
          userEmail: email,
          payment_status: "paid",
        })
        .toArray();

      res.send(result);
    });

    app.get("/all-payments", async (req, res) => {
      const result = await parcelCollection
        .find({ payment_status: "paid" })
        .toArray();

      res.send(result);
    });

    // Contact route with email-(This mail will be sent to the admin email configured) and database storage:
    app.post("/contact", async (req, res) => {
      const { name, email, topic, details } = req.body;

      try {
         // Save to Database
        const contactData = {
          name,
          email,
          subject: topic,
          message: details,
          status: "unread",
          createdAt: new Date(),
        };
        const dbResult = await contactCollection.insertOne(contactData);

        // send mail: 
        const mailOptions = {
          from: `"Zap Shift Contact" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER,
          replyTo: email,
          subject: `New Contact: ${topic}`,
          html: `
                  <h2>New Contact Message from Zap Shift </h2>
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Topic:</strong> ${topic}</p>
                  <p><strong>Details:</strong></p>
                  <p>${details}</p>
              `,
        };

        await transporter.sendMail(mailOptions);

        res.status(201).send({
          success: true,
          insertedId: dbResult.insertedId,
          message: "Message sent and saved successfully",
        });
      } catch (error) {
        console.error("EMAIL ERROR:", error);
        res.status(500).send({ success: false, error: error.message });
      }
    });
    
    // Admin - Get All Contact Messages
    app.get('/contacts', async (req, res) => {
        try {
            const result = await contactCollection
                .find()
                .sort({ createdAt: -1 })
                .toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({
                success: false,
                message: error.message
            });

        }
    });

    // Mark Message As Read: 
    app.patch('/contacts/:id/read', async (req, res) => {
      try{
        const {id} = req.params;
        const result = await contactCollection.updateOne(
          {_id: new ObjectId(id)},
          {
                $set: {
                    status: 'read'
                }
            }
          );
        res.send({
          success: true,
          message: "Message marked as read successfully",
          modifiedCount: result.modifiedCount,

        })
      } 
      catch(error){
        res.status(500).send({
            success: false,
            message: error.message
        });
      }
    })

    // Delete Contact Message: 
    app.delete('/contacts/:id', async (req, res) => {
      try{
        const {id} = req.params;
        const result = await contactCollection.deleteOne({_id: new ObjectId(id)});
        res.send({
          success: true,
          message: "Message deleted successfully",
          deletedCount: result.deletedCount,

        })
      } 
      catch(error){
        res.status(500).send({
            success: false,
            message: error.message
        });
      }
    })



   // PARCEL ASSIGNMENT (Admin) 

    // GET unassigned parcels (riderId is null)
    app.get('/api/parcels/unassigned', protect, admin, async (req, res) => {
      try {
        const parcels = await parcelCollection.find({ riderId: null }).toArray();
        res.json(parcels);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // GET all riders (users with isRider: true)
    app.get('/api/users/riders', protect, admin, async (req, res) => {
      try {
        const riders = await userCollection.find({ isRider: true }).toArray();
        res.json(riders);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // PUT assign a rider to a parcel
    app.put('/api/parcels/:id/assign', protect, admin, async (req, res) => {
      try {
        const { id } = req.params;
        const { riderId } = req.body;
        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { riderId, status: 'assigned' } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Parcel not found' });
        }
        res.json({ success: true, message: 'Rider assigned successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //   RIDER PARCEL ACTIONS 

    // GET parcels assigned to the logged‑in rider
    app.get('/api/rider/my-parcels', protect, async (req, res) => {
      try {
        const riderId = req.user._id.toString();
        const parcels = await parcelCollection.find({ riderId }).toArray();
        res.json(parcels);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // PUT rider accepts or rejects the assignment
    app.put('/api/parcels/:id/rider-action', protect, async (req, res) => {
      try {
        const { id } = req.params;
        const { action } = req.body; // 'accept' or 'reject'
        const riderId = req.user._id.toString();

        const parcel = await parcelCollection.findOne({ _id: new ObjectId(id), riderId });
        if (!parcel) {
          return res.status(404).json({ message: 'Parcel not found or not assigned to you' });
        }

        let newStatus = action === 'accept' ? 'accepted' : 'rejected';
        await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: newStatus } }
        );
        res.json({ success: true, message: `You ${action}ed the delivery` });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // PUT rider marks delivery as complete
    app.put('/api/parcels/:id/complete', protect, async (req, res) => {
      try {
        const { id } = req.params;
        const riderId = req.user._id.toString();

        const parcel = await parcelCollection.findOne({ _id: new ObjectId(id), riderId });
        if (!parcel) {
          return res.status(404).json({ message: 'Parcel not found' });
        }

        await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'delivered', completedAt: new Date() } }
        );
        res.json({ success: true, message: 'Delivery completed successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });


    //   ADMIN: PENDING PARCELS 
    app.get('/api/parcels/pending', protect, admin, async (req, res) => {
      try {
        const parcels = await parcelCollection.find({ status: 'pending' }).toArray();
        res.json(parcels);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // ---------------------------------------------
    //   ADMIN: AVAILABLE RIDERS  
    app.get('/api/users/available-riders', protect, admin, async (req, res) => {
      try {
        const riders = await userCollection.find({
          role: 'rider',
          riderStatus: 'approved',
          availability: 'available'
        }).toArray();
        // you may also want to include only certain fields
        res.json(riders);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //   ADMIN: ASSIGN RIDER 
    app.put('/api/parcels/:id/assign', protect, admin, async (req, res) => {
      const { id } = req.params;
      const { riderId } = req.body;
      try {
        // get rider details
        const rider = await userCollection.findOne({ _id: new ObjectId(riderId) });
        if (!rider) {
          return res.status(404).json({ message: 'Rider not found' });
        }

        // update parcel
        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              riderId: rider._id.toString(),
              riderName: rider.name,
              riderEmail: rider.email,
              status: 'assigned',
              assignedAt: new Date()
            }
          }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Parcel not found' });
        }

        // update rider availability to busy
        await userCollection.updateOne(
          { _id: new ObjectId(riderId) },
          { $set: { availability: 'busy' } }
        );

        res.json({ success: true, message: 'Rider assigned successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //   RIDER: ACCEPT ASSIGNMENT  
    app.put('/api/parcels/:id/accept', protect, async (req, res) => {
      const { id } = req.params;
      const riderId = req.user._id.toString();

      try {
        const parcel = await parcelCollection.findOne({ _id: new ObjectId(id), riderId });
        if (!parcel) {
          return res.status(404).json({ message: 'Parcel not assigned to you' });
        }
        if (parcel.status !== 'assigned') {
          return res.status(400).json({ message: 'Parcel is not in assigned status' });
        }

        await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'picked_up' } }
        );
        res.json({ success: true, message: 'You accepted the delivery' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //   RIDER: REJECT ASSIGNMENT  
    app.put('/api/parcels/:id/reject', protect, async (req, res) => {
      const { id } = req.params;
      const riderId = req.user._id.toString();

      try {
        const parcel = await parcelCollection.findOne({ _id: new ObjectId(id), riderId });
        if (!parcel) {
          return res.status(404).json({ message: 'Parcel not assigned to you' });
        }
        if (parcel.status !== 'assigned') {
          return res.status(400).json({ message: 'Parcel is not in assigned status' });
        }

        await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'rejected' } }
        );

        // also free the rider (set availability back to available) because rider rejected
        await userCollection.updateOne(
          { _id: new ObjectId(riderId) },
          { $set: { availability: 'available' } }
        );

        res.json({ success: true, message: 'You rejected the delivery' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //   RIDER: COMPLETE DELIVERY  
    app.put('/api/parcels/:id/complete', protect, async (req, res) => {
      const { id } = req.params;
      const riderId = req.user._id.toString();

      try {
        const parcel = await parcelCollection.findOne({ _id: new ObjectId(id), riderId });
        if (!parcel) {
          return res.status(404).json({ message: 'Parcel not assigned to you' });
        }
        if (parcel.status !== 'picked_up') {
          return res.status(400).json({ message: 'Parcel is not in picked_up status' });
        }

        await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'delivered', completedAt: new Date() } }
        );

        // free the rider
        await userCollection.updateOne(
          { _id: new ObjectId(riderId) },
          { $set: { availability: 'available' } }
        );

        res.json({ success: true, message: 'Delivery completed successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //  RIDER: GET MY PARCELS  
    app.get('/api/rider/my-parcels', protect, async (req, res) => {
      try {
        const riderId = req.user._id.toString();
        const parcels = await parcelCollection.find({ riderId }).toArray();
        res.json(parcels);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });


    // ADMIN EMAIL VERIFICATION & OTP =======
    // Generate a 6-digit OTP
    const generateOTP = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    };
    let otpStore = {}; // In-memory store for OTPs (use Redis or DB in production)

    // Route 1: Request OTP – check admin email & send OTP
    app.post('/api/admin/request-otp', async (req, res) => {
      const { email } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL;

      if(!email || email.trim() !== adminEmail) {
        return res.status(403).json({message: "Unauthorized: Email does not match admin email"});
      }

      const otp = generateOTP();
      const expiresAt = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes
      otpStore[email] = { otp, expiresAt };

      // send OTP email
      try{
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        }); 

        await transporter.sendMail({
          from: `"Zap Shift Admin Verification" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Admin Login Verification Code', 
          html: `
            <h2>Your Admin Verification Code</h2>
            <p>Use the following 6-digit code to access the admin dashboard:</p>
            <h1 style="color: #4f46e5; font-size: 2rem;">${otp}</h1>
            <p>This code expires in 5 minutes.</p>
            <p>If you didn't request this, ignore this email.</p>`
        });

        res.json({ success: true, message: "OTP sent to admin email" });

      } catch(error) {
        console.log('Email send error',error);
        res.status(500).json({message: "Failed to send OTP email"});
      }
    });

    // Route 2: Verify OTP
    app.post('/api/admin/verify-otp', (req, res) => {
      const { email, otp } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL;

      if (email !== adminEmail) {
        return res.status(401).json({ message: 'Invalid email' });
      }

      const record = otpStore[email];
      if (!record) {
        return res.status(400).json({ message: 'No OTP requested. Please request again.' });
      }

      if (Date.now() > record.expiresAt) {
        delete otpStore[email];
        return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
      }

      if (record.otp !== otp) {
        return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
      }

      delete otpStore[email];

      const verificationToken = jwt.sign(
        { email, verified: true },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      res.json({
        success: true,
        message: 'OTP verified successfully',
        verificationToken,
      });
    });


  } catch (error) {
    console.log("❌ MongoDB Connection Error:", error);
  }
}

run();

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send(
    "Zap Shift Backend and Server is Running with API and Database Connected",
  );
});

// START SERVER
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
  console.log(`✅ Email configured for: abdullahallmojahidstudent@gmail.com`);
});
