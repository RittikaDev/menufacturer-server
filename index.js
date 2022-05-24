const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
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

function verifyJWT(req, res, next) {
  console.log("verifyJWT");
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    client.connect();
    const partsCollection = client.db("tech_world").collection("parts");
    const orderCollection = client.db("tech_world").collection("order");
    const reviewCollection = client.db("tech_world").collection("reviews");
    const userCollection = client.db("tech_world").collection("users");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      console.log(price);
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
    // Add A Product(Part)
    app.post("/parts", async (req, res) => {
      const newProduct = req.body;
      const result = await partsCollection.insertOne(newProduct);
      res.send(result);
      console.log(result);
    });
    // Delete A Product(Part)
    app.delete("/parts/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: ObjectId(id) };
      const result = await partsCollection.deleteOne(filter);
      res.send(result);
      console.log(result);
    });
    // Get Reviews
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const review = await cursor.toArray();
      res.send(review);
      //   console.log(parts);
    });
    // Add Reviews
    app.post("/reviews", async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
      // console.log(result);
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
      // console.log(newPart);
      const result = await orderCollection.insertOne(newPart);
      res.send(result);
      console.log(result);
    });

    // Get All Orders
    app.get("/part", async (req, res) => {
      const query = {};
      const cursor = orderCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
      console.log(orders);
    });

    // Delete An Order
    app.delete("/part/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
      console.log(result);
    });

    // Place Order with Particular ID
    app.patch("/part/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      console.log(id);
      console.log(payment);
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      // const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await orderCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });

    // Load Orders Based On User
    app.get("/part", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.query.email;
      // console.log(email);
      if (email === decodedEmail) {
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const items = await cursor.toArray();
        res.send(items);
        // console.log(items);
      } else {
        res.status(403).send({ message: "Access Denied" });
      }
    });

    // Payment with particular id
    app.get("/part/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const payment = await orderCollection.findOne(query);
      res.send(payment);
      console.log(payment);
    });

    // Get Admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    // Admin Update User
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Update User Upon Login
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    // Get All Users
    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // update users
    app.put("/user/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const updatedUser = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          address: updatedUser.address,
          phone: updatedUser.phone,
          education: updatedUser.education,
          linkedin: updatedUser.linkedin,
        },
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Get Updated User
    app.get("/user", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      const cursor = userCollection.find(query);
      const items = await cursor.toArray();
      res.send(items);
      console.log(items);
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
