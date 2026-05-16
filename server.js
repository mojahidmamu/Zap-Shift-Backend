require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { riderRoutes, setCollections } = require("./routes/riderRoutes");
const { setDb, protect, admin } = require("./middleware/authMiddleware");

const app = express();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pa6ljqy.mongodb.net/zapShiftDB?retryWrites=true&w=majority`;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
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
    app.get('/users', protect, admin, async (req, res) => {
      try {
        // Exclude password field
        const users = await userCollection.find({}, { projection: { password: 0 } }).toArray();
        res.json(users);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
      }
    });

    // UPDATE user role (admin only)
    app.put('/users/:id/role', protect, admin, async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'User not found' });
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
  } catch (error) {
    console.log("❌ MongoDB Connection Error:", error);
  }
}

run();

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send(
    "Zap Shift Backend and Server is  Running wit API and Database Connected",
  );
});

// START SERVER
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
