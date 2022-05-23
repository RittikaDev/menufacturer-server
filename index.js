const express = require("express");
const cors = require("cors");
// const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// techWorld;
// jHR8hwSxGICsPd9G;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6zs58.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    client.connect();
    const partsCollection = client.db("tech_world").collection("parts");

    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Get All Parts
    app.get("/parts", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const parts = await cursor.toArray();
      res.send(parts);
      //   console.log(parts);
    });

    // Dynamic load data
    app.get("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const item = await partsCollection.findOne(query);
      res.send(item);
    });

    // Place Order
    app.post("/part", async (req, res) => {
      const newPart = req.body;
      const result = await partsCollection.insertOne(newPart);
      res.send(result);
      // console.log(result);
    });

    // Load Orders Based On User
    app.get("/part", async (req, res) => {
      // const decodedEmail = req.decoded.email;
      const email = req.query.email;
      console.log(email);
      // if (email === decodedEmail) {
      const query = { email: email };
      const cursor = partsCollection.find(query);
      const items = await cursor.toArray();
      res.send(items);
      // console.log(items);
      // } else {
      //   res.status(403).send({ message: "Access Denied" });
      // }
    });

    // Payment with particular id
    app.get("/part/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const payment = await partsCollection.findOne(query);
      res.send(payment);
      console.log(payment);
    });

    console.log("Datatbase connected");
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Tech World");
});

app.listen(port, () => {
  console.log(`Tech World Running At ${port}`);
});
